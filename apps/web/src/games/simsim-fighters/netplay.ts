import { SYNC_INTERVAL } from './config';
import type { SimEvent } from './fighter';
import type { NetMessage, NetworkManager_WebRTC } from './network';
import type { FightSim, SimSnapshot } from './sim';

/** 입력 기록을 이만큼(프레임) 남겨 둔다 — 상태 보정 후 다시 계산할 때 쓴다 */
const HISTORY = 360;

/**
 * NetplaySession — 락스텝(lockstep) 온라인 대전.
 *
 * 두 브라우저는 같은 FightSim 을 각자 돌리고 "프레임 번호 + 입력"만 주고받는다.
 *  - 내 입력은 delay 프레임 뒤에 적용되도록 미리 보낸다 (그동안 상대 입력이 도착한다)
 *  - 두 사람 입력이 다 모인 프레임만 진행한다 → 양쪽 화면이 항상 같다
 *  - 방장은 SYNC_INTERVAL 마다 상태(좌표 · 체력 · 게이지)를 보내고,
 *    참가자는 자기 상태와 다르면 방장 상태로 맞춘 뒤 그 뒤 프레임을 다시 계산한다
 */
export class NetplaySession {
  readonly matchId: number;
  /** 상대 입력을 기다리며 멈춘 틱 수 */
  stall = 0;
  desyncFixes = 0;

  private local = new Map<number, number>();
  private remote = new Map<number, number>();
  private hashes = new Map<number, number>();
  private pendingSync: { f: number; h: number; s: SimSnapshot } | null = null;
  private lastLocal = 0;
  private remoteMax = 0;
  private unsub: () => void;

  constructor(
    private net: NetworkManager_WebRTC,
    private sim: FightSim,
    private localSide: 0 | 1,
    matchId: number,
    /** 입력 지연 프레임 — 두 사람이 같은 값을 써야 한다 (방장이 정해서 알려 준다) */
    readonly delay: number,
  ) {
    this.matchId = matchId;
    for (let f = 1; f <= delay; f++) {
      this.local.set(f, 0);
      this.remote.set(f, 0);
    }
    this.lastLocal = delay;
    this.remoteMax = delay;
    this.unsub = net.onMessage(this.onMessage);
  }

  destroy() {
    this.unsub();
  }

  private onMessage = (m: NetMessage) => {
    if (m.t === 'in' && m.m === this.matchId) {
      this.remote.set(m.f, m.b);
      if (m.f > this.remoteMax) this.remoteMax = m.f;
    } else if (m.t === 'sync' && m.m === this.matchId && this.net.role === 'guest') {
      this.pendingSync = { f: m.f, h: m.h, s: m.s };
      this.checkSync();
    }
  };

  private inputsFor(f: number): [number, number] | null {
    const l = this.local.get(f);
    const r = this.remote.get(f);
    if (l === undefined || r === undefined) return null;
    return this.localSide === 0 ? [l, r] : [r, l];
  }

  /**
   * 한 틱 (1/60초) — 내 입력을 예약·전송하고, 진행할 수 있는 만큼 시뮬레이션한다.
   * onStep 은 프레임마다 그 프레임의 이벤트와 함께 불린다.
   */
  tick(bits: number, onStep: (events: SimEvent[]) => void) {
    const target = this.sim.frame + 1 + this.delay;
    while (this.lastLocal < target) {
      this.lastLocal++;
      this.local.set(this.lastLocal, bits);
      this.net.send({ t: 'in', m: this.matchId, f: this.lastLocal, b: bits });
    }

    // 상대보다 많이 뒤처졌으면 한 틱에 두 프레임까지 따라간다
    const behind = this.remoteMax - (this.sim.frame + this.delay);
    const maxSteps = behind > 2 ? 2 : 1;
    let steps = 0;
    while (steps < maxSteps) {
      const f = this.sim.frame + 1;
      const inputs = this.inputsFor(f);
      if (!inputs) break;
      this.sim.step(inputs);
      onStep(this.sim.events);
      this.afterStep(f);
      steps++;
      // 두 번째 프레임을 위해 내 입력도 이어서 예약
      const t2 = this.sim.frame + 1 + this.delay;
      while (this.lastLocal < t2) {
        this.lastLocal++;
        this.local.set(this.lastLocal, bits);
        this.net.send({ t: 'in', m: this.matchId, f: this.lastLocal, b: bits });
      }
    }
    this.stall = steps === 0 ? this.stall + 1 : 0;
  }

  private afterStep(f: number) {
    if (this.net.role === 'host') {
      if (f % SYNC_INTERVAL === 0) {
        this.net.send({
          t: 'sync',
          m: this.matchId,
          f,
          h: this.sim.hash(),
          s: this.sim.snapshot(),
        });
      }
    } else {
      this.hashes.set(f, this.sim.hash());
      this.checkSync();
    }
    const old = f - HISTORY;
    this.local.delete(old);
    this.remote.delete(old);
    this.hashes.delete(old);
  }

  /** 참가자 — 방장 상태와 비교해서 어긋났으면 맞춘다 */
  private checkSync() {
    const ps = this.pendingSync;
    if (!ps) return;
    const mine = this.hashes.get(ps.f);
    if (mine === undefined) {
      // 아직 그 프레임까지 못 갔거나, 너무 오래된 기록
      if (this.sim.frame - ps.f > HISTORY - 10) this.pendingSync = null;
      return;
    }
    this.pendingSync = null;
    if (mine === ps.h) return;

    // 어긋남 — 방장 상태로 되돌린 뒤 지금 프레임까지 다시 계산 (연출 없이)
    const now = this.sim.frame;
    this.sim.restore(ps.s);
    this.hashes.set(ps.f, ps.h);
    for (let f = ps.f + 1; f <= now; f++) {
      const inputs = this.inputsFor(f);
      if (!inputs) break;
      this.sim.step(inputs);
      this.hashes.set(f, this.sim.hash());
    }
    this.desyncFixes++;
  }
}
