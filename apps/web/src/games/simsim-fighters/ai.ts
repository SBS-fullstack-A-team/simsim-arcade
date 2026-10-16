import { IN, SUPER_COST, ULT_COST, BURST_COST } from './config';
import type { MoveDef } from './characters';
import type { Fighter } from './fighter';
import type { FightSim } from './sim';

/** 레벨별 성격 (1 = 입문 · 6 = 최강) */
interface AiTuning {
  /** 상대 공격을 알아차리는 데 걸리는 프레임 */
  reaction: number;
  /** 알아차린 공격을 막을 확률 */
  block: number;
  /** 맞힌 뒤 콤보를 이어 갈 확률 */
  combo: number;
  /** 대공 확률 */
  antiAir: number;
  /** 공격을 고민하는 간격 (프레임) */
  thinkGap: number;
  burst: number;
}

const TUNING: readonly AiTuning[] = [
  { reaction: 22, block: 0.15, combo: 0.15, antiAir: 0.1, thinkGap: 34, burst: 0.05 },
  { reaction: 18, block: 0.3, combo: 0.3, antiAir: 0.2, thinkGap: 28, burst: 0.1 },
  { reaction: 14, block: 0.45, combo: 0.45, antiAir: 0.32, thinkGap: 22, burst: 0.18 },
  { reaction: 11, block: 0.58, combo: 0.6, antiAir: 0.45, thinkGap: 18, burst: 0.26 },
  { reaction: 8, block: 0.7, combo: 0.72, antiAir: 0.58, thinkGap: 14, burst: 0.34 },
  { reaction: 6, block: 0.8, combo: 0.85, antiAir: 0.7, thinkGap: 11, burst: 0.42 },
];

/** 기술이 닿는 거리 — 판정 상자가 없으면 투사체가 날아가는 거리 */
const reachOf = (d: MoveDef | null) => {
  if (!d) return 0;
  if (d.box) return d.box.x + d.box.w / 2;
  if (d.projectile) return d.projectile.x + Math.abs(d.projectile.vx) * d.projectile.life;
  return 0;
};

/**
 * AIController — 1인 플레이 스파링 상대.
 * 사람처럼 반응 시간을 두고 거리 조절 · 가드 · 대공 · 콤보 · 필살기를 고른다.
 * 결과는 키보드와 똑같은 입력 비트라서 Fighter 는 사람과 AI 를 구분하지 않는다.
 */
export class AIController {
  private tune: AiTuning;
  private queue: number[] = [];
  private hold = 0;
  private holdT = 0;
  private guardT = 0;
  private guardLow = false;
  private nextThink = 0;
  /** 이미 막을지 정한 상대 기술 (같은 기술에 여러 번 주사위를 굴리지 않게) */
  private judgedMove = '';
  private judgedBlock = false;
  private frame = 0;

  constructor(level: number) {
    this.tune = TUNING[Math.max(0, Math.min(TUNING.length - 1, level - 1))] as AiTuning;
  }

  think(sim: FightSim, side: 0 | 1): number {
    this.frame++;
    if (sim.phase !== 'fight' || sim.freeze > 0) {
      this.queue = [];
      return 0;
    }
    const me = sim.fighters[side];
    const op = sim.fighters[side === 0 ? 1 : 0];
    const fwd = me.facing > 0 ? IN.RIGHT : IN.LEFT;
    const back = me.facing > 0 ? IN.LEFT : IN.RIGHT;
    const dist = Math.abs(op.x - me.x);

    if (this.queue.length > 0) return this.queue.shift() ?? 0;

    // 긴 콤보를 맞고 있으면 버스트
    if (
      me.act === 'hitstun' &&
      me.combo >= 4 &&
      me.meter >= BURST_COST &&
      Math.random() < this.tune.burst * 0.25
    ) {
      this.queue = [0];
      return IN.F;
    }

    // 맞혔으면 콤보 이어 가기
    if (me.act === 'attack' && me.connected && op.act === 'hitstun') {
      const c = this.comboFollowUp(me, fwd);
      if (c) return c;
    }

    // 가드 유지
    if (this.guardT > 0) {
      this.guardT--;
      return IN.D | (this.guardLow ? IN.DOWN : 0);
    }

    // 상대 공격 · 투사체 읽기
    const threat = this.threat(sim, me, op);
    if (threat) {
      const key = `${op.move}:${sim.frame - op.t}`;
      if (this.judgedMove !== key) {
        this.judgedMove = key;
        this.judgedBlock = Math.random() < this.tune.block;
      }
      // 받아치기 캐릭터는 막는 대신 받아치기를 노리기도 한다
      if (
        this.judgedBlock &&
        me.moves.sp2.parry &&
        !me.airborne &&
        (me.act === 'idle' || me.act === 'walk') &&
        Math.random() < 0.35
      ) {
        this.judgedBlock = false;
        return this.motion(fwd, IN.S);
      }
      if (this.judgedBlock) {
        this.guardLow = threat === 'low';
        this.guardT = 10;
        return IN.D | (this.guardLow ? IN.DOWN : 0);
      }
    }

    if (me.act === 'hitstun' || me.act === 'blockstun' || me.act === 'attack') return 0;

    // 대공
    if (
      op.airborne &&
      op.act !== 'hitstun' &&
      dist < 210 &&
      !me.airborne &&
      Math.random() < this.tune.antiAir * 0.2
    ) {
      const sp2 = me.moves.sp2;
      if (sp2.anim === 'upper' || (sp2.box?.y ?? 0) > 120) return this.motion(fwd, IN.S);
      if (Math.random() < 0.5) return IN.A;
      this.guardT = 14;
      this.guardLow = false;
      return IN.D;
    }

    // 계속 누르고 있는 이동
    if (this.holdT > 0) {
      this.holdT--;
      if (this.frame < this.nextThink) return this.hold;
    }

    if (this.frame < this.nextThink) return 0;
    this.nextThink =
      this.frame + this.tune.thinkGap + Math.floor(Math.random() * this.tune.thinkGap);
    return this.decide(sim, me, op, dist, fwd, back);
  }

  private decide(sim: FightSim, me: Fighter, op: Fighter, dist: number, fwd: number, back: number) {
    const m = me.moves;
    const zoner = !!m.sp1.projectile || (m.sp1.box?.w ?? 0) > 250;
    const prefer = zoner ? 320 : 110;
    const r = Math.random();

    // 초필살기 — 게이지가 있고 맞을 만한 거리
    if (me.meter >= SUPER_COST && !me.airborne) {
      const sup = me.meter >= ULT_COST ? m.ult : m.super;
      const sp = sup.projectile;
      // 상대 자리에 생기거나 화면 전체를 덮는 기술은 어디서든 닿는다
      const range = sp
        ? sp.sky || sp.atOpp || sp.flank
          ? 900
          : 600
        : reachOf(sup) + sup.selfVx * sup.active * 0.6 + sup.startVx * sup.startup;
      const opOpen = op.act === 'attack' || op.act === 'land' || op.act === 'jumpsquat';
      if (dist < range && (opOpen || r < 0.12)) return IN.F;
    }

    // 잡기 캐릭터는 붙으면 잡는다
    if (m.sp2.grab && dist < reachOf(m.sp2) + 10 && r < 0.45) return this.motion(fwd, IN.S);

    if (dist < reachOf(m.punch) + 6) {
      if (r < 0.35) return IN.A;
      if (r < 0.55) return IN.DOWN | IN.S;
      if (r < 0.7) return IN.DOWN | IN.A;
      if (r < 0.82) {
        this.hold = back;
        this.holdT = 12;
        return back;
      }
      this.guardT = 12;
      this.guardLow = Math.random() < 0.5;
      return IN.D;
    }
    if (dist < reachOf(m.kick) + 4) {
      if (r < 0.45) return IN.S;
      if (r < 0.6) return IN.DOWN | IN.S;
      if (r < 0.75) return this.motion(fwd, IN.S);
    }

    // 원거리 견제
    if (dist > 180 && dist < 560 && r < (zoner ? 0.5 : 0.18)) {
      const hasProj = sim.projectiles.some((p) => p.owner === me.side);
      if (!hasProj) return this.motion(fwd, IN.A);
    }

    // 점프 공격
    if (dist > 140 && dist < 320 && r > 0.86) {
      this.queue = [IN.UP | fwd, fwd, fwd, fwd, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, IN.S];
      return IN.UP | fwd;
    }

    // 대시 — 멀면 앞 대시로 파고들고, 원거리 캐릭터는 붙으면 백대시로 빠진다 (→ 떼고 → 두 번 탭)
    if (dist > prefer + 150 && r < 0.4) {
      this.queue = [0, fwd, fwd, fwd, fwd, fwd, fwd];
      return fwd;
    }
    if (zoner && dist < prefer - 160 && r > 0.6) {
      this.queue = [0, back];
      return back;
    }

    // 거리 조절
    if (dist > prefer + 40) {
      this.hold = fwd;
      this.holdT = 16 + Math.floor(Math.random() * 20);
      return fwd;
    }
    if (dist < prefer - 50 && zoner) {
      this.hold = back;
      this.holdT = 14 + Math.floor(Math.random() * 14);
      return back;
    }
    if (r < 0.3) {
      this.hold = fwd;
      this.holdT = 10;
      return fwd;
    }
    return 0;
  }

  /** 맞힌 직후 이어 갈 입력 */
  private comboFollowUp(me: Fighter, fwd: number): number {
    const d = me.moveDef;
    if (!d || me.t <= d.startup) return 0;
    // 연계기가 있는 기술은 같은 버튼으로 바로 잇는다
    if (d.chain && Math.random() < this.tune.combo * 0.6) return d.chain === 'A' ? IN.A : IN.S;
    if (Math.random() > this.tune.combo * 0.35) return 0;
    if (d.id === 'punch' || d.id === 'cPunch') {
      return Math.random() < 0.6 ? IN.S : IN.DOWN | IN.S;
    }
    if (d.id === 'kick' || d.id === 'cKick') {
      if (me.meter >= SUPER_COST && Math.random() < 0.5) return IN.F;
      return this.motion(fwd, Math.random() < 0.5 ? IN.A : IN.S);
    }
    if ((d.id === 'sp1' || d.id === 'sp2') && me.meter >= SUPER_COST && Math.random() < 0.6) {
      return IN.F;
    }
    return 0;
  }

  /** 막아야 할 공격이 오고 있는지 — 'low' 면 앉아서 막는다 */
  private threat(sim: FightSim, me: Fighter, op: Fighter): 'high' | 'low' | null {
    const d = op.moveDef;
    const dist = Math.abs(op.x - me.x);
    if (
      op.act === 'attack' &&
      d &&
      op.t >= this.tune.reaction - 2 &&
      op.t <= d.startup + d.active
    ) {
      const reach = reachOf(d) + d.selfVx * d.active + 40;
      if (dist < reach || (d.superLevel > 0 && dist < 700)) {
        if (d.grab) return null;
        return d.level === 'low' ? 'low' : 'high';
      }
    }
    for (const p of sim.projectiles) {
      if (p.owner === me.side || p.age < Math.max(0, p.delay - 6)) continue;
      const dx = me.x - p.x;
      const coming = Math.sign(p.vx) === Math.sign(dx) || p.vx === 0;
      if (coming && Math.abs(dx) < 120 + Math.abs(p.vx) * this.tune.reaction) {
        return p.level === 'low' ? 'low' : 'high';
      }
    }
    return null;
  }

  /** ↓ → + 버튼 커맨드를 몇 프레임에 걸쳐 입력한다 */
  private motion(fwd: number, button: number) {
    this.queue = [IN.DOWN | fwd, fwd, fwd | button, 0];
    return IN.DOWN;
  }
}
