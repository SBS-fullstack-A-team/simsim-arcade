import {
  FIGHT_CALL_FRAME,
  GROUND_Y,
  INTRO_FRAMES,
  KO_FRAMES,
  MAX_ROUNDS,
  MAX_SEP,
  METER_PASSIVE,
  ROUND_FRAMES,
  ROUNDS_TO_WIN,
  STAGE_W,
  START_GAP,
  SUPER_FREEZE,
  ULT_FREEZE,
  WALL,
} from './config';
import { ULT_EXPLOSION, type CharId, type ProjSpec } from './characters';
import { Fighter, type FighterWorld, type SimEvent } from './fighter';
import { HitboxManager, toCloud, type HitWorld, type Projectile } from './hitbox';

export type Phase = 'intro' | 'fight' | 'ko' | 'matchEnd';

export interface SimOptions {
  /** P2 체력 배율 (아케이드 후반 상대) */
  hpScale2?: number;
}

/**
 * FightSim — 한 경기(여러 라운드)의 결정적(deterministic) 시뮬레이션.
 * 같은 입력을 넣으면 어느 컴퓨터에서든 같은 결과가 나오도록 난수·실제 시간을 쓰지 않는다.
 * (온라인 대전에서 두 브라우저가 입력만 주고받아도 같은 화면이 되게)
 */
export class FightSim implements HitWorld, FighterWorld {
  frame = 0;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[] = [];
  round = 1;
  phase: Phase = 'intro';
  phaseT = 0;
  timer = ROUND_FRAMES;
  timeOver = false;
  hitstop = 0;
  /** 초필살기 컷인 정지 */
  freeze = 0;
  freezeTotal = 0;
  freezeSide: -1 | 0 | 1 = -1;
  freezeUlt = false;
  matchWinner: -2 | -1 | 0 | 1 = -2;
  nextId = 1;
  /** 이번 step 에서 생긴 일 (연출 · 효과음용) */
  events: SimEvent[] = [];

  private hits = new HitboxManager();

  constructor(p1: CharId, p2: CharId, opts: SimOptions = {}) {
    this.fighters = [new Fighter(0, p1), new Fighter(1, p2, opts.hpScale2 ?? 1)];
    this.resetPositions();
  }

  /* ---------------- FighterWorld / HitWorld ---------------- */

  emit(e: SimEvent) {
    this.events.push(e);
  }

  clampX(x: number) {
    return Math.max(WALL, Math.min(STAGE_W - WALL, x));
  }

  addHitstop(frames: number) {
    this.hitstop = Math.max(this.hitstop, frames);
  }

  superFreeze(owner: Fighter, ult: boolean) {
    this.freeze = ult ? ULT_FREEZE : SUPER_FREEZE;
    this.freezeTotal = this.freeze;
    this.freezeSide = owner.side;
    this.freezeUlt = ult;
    this.emit({ type: 'super', side: owner.side, ult });
  }

  spawnProjectile(owner: Fighter, spec: ProjSpec, index: number, opp: Fighter) {
    const f = owner.facing;
    const s = owner.def.scale;
    let x = owner.x + f * (spec.x + index * spec.step) * (spec.step ? 1 : s);
    let y = owner.h + spec.y * s;
    let vx = spec.vx * f;
    let face = f;
    if (spec.sky) {
      x = spec.aim ? opp.x : owner.x + f * (spec.x + index * spec.spread);
      y = GROUND_Y + spec.h / 2;
    }
    if (spec.atOpp) {
      // 상대가 서 있는 자리 (땅 기준)
      x = opp.x;
      y = spec.y;
    }
    if (spec.flank) {
      // 분신 — 상대 양옆을 번갈아 나타나 상대 쪽으로 덮친다
      const side = index % 2 === 0 ? -f : f;
      x = opp.x + side * spec.x;
      y = opp.h + spec.y;
      vx = -side * Math.abs(spec.vx);
      face = vx >= 0 ? 1 : -1;
    }
    // 같은 줄로 여러 발 쏘는 기술은 높이를 조금씩 다르게
    if (spec.count > 2 && !spec.sky && !spec.step && !spec.flank && !spec.fan) {
      y += ((index % 3) - 1) * 14;
    }
    // 공중에서 쏘면 비스듬히 아래로 (땅에 닿으면 사라진다)
    const airShot = owner.airborne && !!owner.moveDef?.airOk && !spec.sky;
    let vy = airShot ? -Math.abs(spec.vx) * 0.55 : spec.vy;
    if (spec.fan && spec.count > 1) {
      // 부채꼴 — 위에서 아래로 훑으며 쏜다
      const a = spec.fan * (0.5 - index / (spec.count - 1));
      vx = Math.cos(a) * spec.vx * f;
      vy = Math.sin(a) * spec.vx;
    }
    const gravity = airShot ? 0.0001 : spec.gravity;
    const ult = owner.move === 'ult';
    this.projectiles.push({
      id: this.nextId++,
      owner: owner.side,
      fx: spec.fx,
      facing: face,
      x: this.clampX(x),
      y,
      vx,
      vy,
      gravity,
      w: spec.w,
      h: spec.h,
      life: spec.life,
      age: 0,
      damage: Math.round(spec.damage / spec.hits),
      hitsLeft: spec.hits,
      totalHits: spec.hits,
      interval: spec.interval,
      cd: 0,
      level: spec.level,
      hitstun: spec.hitstun,
      blockstun: spec.blockstun,
      push: spec.push,
      launch: spec.launch,
      knockdown: spec.knockdown,
      pierce: spec.pierce,
      delay: spec.delay,
      linger: spec.linger,
      homing: spec.homing,
      landed: false,
      sky: spec.sky,
      superLevel: owner.moveDef?.superLevel ?? 0,
      ult,
      otg: spec.fx === 'explosion',
      dead: false,
      boomerang: spec.boomerang,
      speed0: vx,
      wave: spec.wave,
      waveBase: y,
      growW: spec.growW,
      growH: spec.growH,
      dot: spec.dot,
      slow: spec.slow,
      look: spec.look,
      trackX: spec.trackX,
      suck: spec.suck,
      drain: spec.drain,
      explode: spec.explode,
      linger0: spec.linger,
      freeze: spec.freeze,
    });
    this.emit({ type: 'projectile', side: owner.side, fx: spec.fx, x, y });
  }

  /* ---------------- 한 프레임 ---------------- */

  step(inputs: readonly [number, number]) {
    this.events = [];
    this.frame++;
    const [p1, p2] = this.fighters;
    const frozen = this.hitstop > 0 || this.freeze > 0;
    p1.readInput(inputs[0], frozen);
    p2.readInput(inputs[1], frozen);

    if (this.phase === 'matchEnd') return;
    if (this.freeze > 0) {
      this.freeze--;
      if (this.freeze === 0) this.freezeSide = -1;
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }

    this.updatePhase();
    const control = this.phase === 'fight';
    p1.update(p2, this, control);
    p2.update(p1, this, control);
    this.applyHolds();
    this.updateFacing();
    this.separate();
    this.updateProjectiles();
    this.hits.resolve(this);
    this.checkUlt();
    this.checkKO();
  }

  private updatePhase() {
    switch (this.phase) {
      case 'intro':
        this.phaseT++;
        if (this.phaseT === 1) this.emit({ type: 'round', round: this.round });
        if (this.phaseT === FIGHT_CALL_FRAME) this.emit({ type: 'fight' });
        if (this.phaseT >= INTRO_FRAMES) {
          this.phase = 'fight';
          this.phaseT = 0;
          for (const f of this.fighters) {
            f.setAct('idle');
            f.bufA = 0;
            f.bufS = 0;
            f.bufF = 0;
          }
        }
        break;
      case 'fight':
        this.timer--;
        for (const f of this.fighters) f.addMeter(METER_PASSIVE);
        if (this.timer <= 0) {
          this.timer = 0;
          this.timeOver = true;
          this.phase = 'ko';
          this.phaseT = 0;
          this.emit({ type: 'timeover' });
        }
        break;
      case 'ko':
        this.phaseT++;
        if (this.phaseT === 80) {
          for (const f of this.fighters) {
            if (f.hp > 0 && !f.airborne && f.act !== 'attack' && f.act !== 'hitstun') {
              f.move = null;
              f.setAct('win');
            }
          }
        }
        if (this.phaseT >= KO_FRAMES) this.endRound();
        break;
      default:
        break;
    }
  }

  private updateFacing() {
    const [a, b] = this.fighters;
    for (const [f, o] of [
      [a, b],
      [b, a],
    ] as const) {
      if (f.airborne) continue;
      if (!['idle', 'walk', 'crouch', 'guard', 'land', 'intro', 'getup'].includes(f.act)) continue;
      if (o.x > f.x + 1) f.facing = 1;
      else if (o.x < f.x - 1) f.facing = -1;
    }
  }

  /** 붙잡힘 · 얼어붙음 — 붙잡은 기술이 이어지는 동안 상대를 그 자리에 묶거나 들고 간다 */
  private applyHolds() {
    for (const f of this.fighters) {
      if (f.act === 'ko') {
        f.lockedBy = 0;
        f.frozenT = 0;
        continue;
      }
      if (f.lockedBy) {
        const att = this.fighters[f.lockedBy === 1 ? 0 : 1];
        const d = att.moveDef;
        const holding = att.act === 'attack' && !!d && !!d.lock && att.t <= d.startup + d.active;
        if (!holding || !d) {
          f.lockedBy = 0;
        } else if (d.lock === 'carry') {
          f.x = this.clampX(att.x + att.facing * 44 * att.def.scale);
          f.h = Math.max(0.01, att.h + 30);
          f.vx = 0;
          f.vy = att.vy;
          f.stun = Math.max(f.stun, 12);
        } else {
          f.vx = 0;
          f.vy = 0;
          if (f.h > 0) f.h = Math.max(0.01, f.lockH);
          f.stun = Math.max(f.stun, 12);
        }
      }
      if (f.frozenT > 0) {
        f.frozenT--;
        f.vx = 0;
        if (f.h > 0) f.vy = 0;
        if (f.act === 'hitstun') f.stun = Math.max(f.stun, 2);
      }
    }
  }

  /** 몸끼리 겹치지 않게 밀어내고, 벽과 최대 거리를 지킨다 */
  private separate() {
    const [a, b] = this.fighters;
    const wa = 22 * a.def.scale;
    const wb = 22 * b.def.scale;
    const ha = a.crouching ? 95 : 150;
    const hb = b.crouching ? 95 : 150;
    const vertical = a.h < b.h + hb * b.def.scale && b.h < a.h + ha * a.def.scale;
    // 관통 돌진 중에는 상대 몸을 지나간다
    const passing = (f: Fighter) => {
      const d = f.moveDef;
      return f.act === 'attack' && !!d && d.passThrough && f.t <= d.startup + d.active + 2;
    };
    const solid =
      a.act !== 'ko' &&
      b.act !== 'ko' &&
      a.act !== 'knockdown' &&
      b.act !== 'knockdown' &&
      !passing(a) &&
      !passing(b) &&
      !a.lockedBy &&
      !b.lockedBy;
    const dx = b.x - a.x;
    const minD = wa + wb;
    if (vertical && solid && Math.abs(dx) < minD) {
      const sign = dx !== 0 ? Math.sign(dx) : a.facing;
      const push = (minD - Math.abs(dx)) / 2;
      a.x -= sign * push;
      b.x += sign * push;
    }
    for (const f of this.fighters) f.x = this.clampX(f.x);
    // 한쪽이 벽에 붙어 있으면 다른 쪽을 밀어낸다
    if (vertical && solid && Math.abs(b.x - a.x) < minD - 0.5) {
      const sign = b.x >= a.x ? 1 : -1;
      if (a.x <= WALL + 0.5 || a.x >= STAGE_W - WALL - 0.5) b.x = this.clampX(a.x + sign * minD);
      else if (b.x <= WALL + 0.5 || b.x >= STAGE_W - WALL - 0.5)
        a.x = this.clampX(b.x - sign * minD);
    }
    // 화면 밖으로 벌어지지 않게
    const [l, r] = a.x <= b.x ? [a, b] : [b, a];
    const gap = r.x - l.x;
    if (gap > MAX_SEP) {
      const ex = gap - MAX_SEP;
      const lAway = l.vx < 0;
      const rAway = r.vx > 0;
      if (lAway && !rAway) l.x += ex;
      else if (rAway && !lAway) r.x -= ex;
      else {
        l.x += ex / 2;
        r.x -= ex / 2;
      }
    }
  }

  private updateProjectiles() {
    const [p1, p2] = this.fighters;
    for (const p of this.projectiles) {
      p.age++;
      if (p.cd > 0) p.cd--;
      if (!p.landed) {
        if (p.homing > 0) {
          const target = p.owner === 0 ? p2 : p1;
          const ty = target.h + 80;
          p.vy += Math.sign(ty - p.y) * p.homing;
          p.vy = Math.max(-2.4, Math.min(2.4, p.vy));
        }
        p.vy -= p.gravity;
        if (p.boomerang) {
          // 부메랑 — 앞으로 날아가다 멈춰서 되돌아온다 (돌아올 때 다시 맞힐 수 있다)
          p.vx = p.speed0 * Math.cos((Math.PI * p.age) / p.life);
          if (p.age === Math.round(p.life / 2)) p.hitsLeft = p.totalHits;
          const owner = this.fighters[p.owner];
          if (p.age > p.life / 2 && Math.abs(p.x - owner.x) < 30) p.dead = true;
        }
        if (p.trackX > 0) {
          // 위성 레이저 — 상대를 따라 좌우로 움직인다
          const target = p.owner === 0 ? p2 : p1;
          const dx = target.x - p.x;
          p.x += Math.max(-p.trackX, Math.min(p.trackX, dx));
        }
        if (p.suck > 0 && p.age >= p.delay) {
          // 블랙홀 — 가까운 상대를 가운데로 빨아들인다 (막아도 끌려온다)
          const target = p.owner === 0 ? p2 : p1;
          const dx = p.x - target.x;
          if (Math.abs(dx) < 420 && target.act !== 'knockdown' && target.act !== 'ko') {
            target.x = this.clampX(target.x + Math.sign(dx) * Math.min(Math.abs(dx), p.suck));
          }
        }
        p.x += p.vx;
        if (p.wave > 0) {
          // 음파 — 위아래로 출렁인다
          p.waveBase += p.vy;
          p.y = p.waveBase + Math.sin(p.age * 0.16) * p.wave;
        } else {
          p.y += p.vy;
        }
        if (p.growW || p.growH) {
          // 퍼져 나가는 충격파 · 커지는 화염파 (바닥 높이는 그대로)
          p.w += p.growW;
          p.h += p.growH;
          p.y += p.growH / 2;
        }
        const bottom = p.y - p.h / 2;
        if (bottom <= 0 && (p.gravity > 0 || p.sky)) {
          if (p.linger > 0) {
            // 땅에 떨어지면 그 자리에 독구름
            p.landed = true;
            p.vx = 0;
            p.vy = 0;
            p.w = 96;
            p.h = 70;
            p.y = 35;
            p.life = p.age + p.linger;
          } else if (p.sky) {
            p.vy = 0;
            p.y = p.h / 2;
            p.landed = true;
          } else {
            p.dead = true;
          }
        }
      }
      if (p.age >= p.life) {
        // 호문쿨루스는 아무것도 못 맞혀도 수명이 다하면 그 자리에서 터진다
        if (p.explode && !p.landed) toCloud(p);
        else p.dead = true;
      }
      if (p.x < -100 || p.x > STAGE_W + 100) p.dead = true;
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  /** 버스트 얼티밋이 맞았으면 끝날 때 화면 전체 대폭발 */
  private checkUlt() {
    for (const f of this.fighters) {
      if (f.ultState === 0) continue;
      const d = f.moveDef;
      const moveDone = f.move !== 'ult' || (!!d && !!d.box && f.moveHits >= d.hits);
      const liveProj = this.projectiles.some((p) => p.owner === f.side && p.ult && !p.otg);
      if (!moveDone || liveProj) continue;
      if (f.ultState === 2) {
        const opp = this.fighters[f.side === 0 ? 1 : 0];
        const prevMove = f.move;
        f.move = 'ult';
        this.spawnProjectile(f, { ...ULT_EXPLOSION, x: 0 }, 0, opp);
        f.move = prevMove;
        const ex = this.projectiles[this.projectiles.length - 1];
        if (ex) {
          ex.x = opp.x;
          ex.y = ULT_EXPLOSION.y;
          ex.ult = false;
          ex.superLevel = 3;
        }
        this.emit({ type: 'explosion', x: opp.x, y: opp.h + 90 });
      }
      f.ultState = 0;
    }
  }

  private checkKO() {
    if (this.phase === 'matchEnd') return;
    const [a, b] = this.fighters;
    let any = false;
    for (const [f, o] of [
      [a, b],
      [b, a],
    ] as const) {
      if (f.hp > 0 || f.act === 'ko') continue;
      f.hp = 0;
      f.move = null;
      f.setAct('ko');
      f.vy = Math.max(f.vy, 9);
      f.h = Math.max(f.h, 0.01);
      f.vx = (f.x >= o.x ? 1 : -1) * 4.5;
      f.invul = 9999;
      this.emit({ type: 'ko', side: f.side, superFinish: o.superFinish });
      any = true;
    }
    if (any && this.phase === 'fight') {
      this.phase = 'ko';
      this.phaseT = 0;
      this.addHitstop(34);
    }
  }

  private endRound() {
    const [a, b] = this.fighters;
    let winner: -1 | 0 | 1 = -1;
    if (a.hp > 0 && b.hp <= 0) winner = 0;
    else if (b.hp > 0 && a.hp <= 0) winner = 1;
    else if (a.hp > 0 && b.hp > 0) {
      const ra = a.hp / a.maxHp;
      const rb = b.hp / b.maxHp;
      winner = ra > rb ? 0 : rb > ra ? 1 : -1;
    }
    const w = winner >= 0 ? this.fighters[winner as 0 | 1] : null;
    if (w) w.roundWins++;
    this.emit({
      type: 'roundEnd',
      winner,
      perfect: !!w && w.hp >= w.maxHp,
      timeLeft: Math.ceil(this.timer / 60),
    });

    let match: -2 | -1 | 0 | 1 = -2;
    if (a.roundWins >= ROUNDS_TO_WIN) match = 0;
    else if (b.roundWins >= ROUNDS_TO_WIN) match = 1;
    else if (this.round >= MAX_ROUNDS) {
      match = a.stats.damage > b.stats.damage ? 0 : b.stats.damage > a.stats.damage ? 1 : -1;
    }
    if (match !== -2) {
      this.matchWinner = match;
      this.phase = 'matchEnd';
      this.phaseT = 0;
      this.emit({ type: 'matchEnd', winner: match });
      return;
    }
    this.round++;
    this.timer = ROUND_FRAMES;
    this.timeOver = false;
    this.phase = 'intro';
    this.phaseT = 0;
    this.projectiles = [];
    this.resetPositions();
  }

  private resetPositions() {
    const [a, b] = this.fighters;
    a.resetForRound(STAGE_W / 2 - START_GAP, 1);
    b.resetForRound(STAGE_W / 2 + START_GAP, -1);
  }

  /* ---------------- 스냅샷 (온라인 동기화) ---------------- */

  snapshot(): SimSnapshot {
    return {
      frame: this.frame,
      round: this.round,
      phase: this.phase,
      phaseT: this.phaseT,
      timer: this.timer,
      timeOver: this.timeOver,
      hitstop: this.hitstop,
      freeze: this.freeze,
      freezeTotal: this.freezeTotal,
      freezeSide: this.freezeSide,
      freezeUlt: this.freezeUlt,
      matchWinner: this.matchWinner,
      nextId: this.nextId,
      projectiles: this.projectiles.map((p) => ({ ...p })),
      fighters: [this.fighters[0].snapshot(), this.fighters[1].snapshot()],
    };
  }

  restore(s: SimSnapshot) {
    this.frame = s.frame;
    this.round = s.round;
    this.phase = s.phase;
    this.phaseT = s.phaseT;
    this.timer = s.timer;
    this.timeOver = s.timeOver;
    this.hitstop = s.hitstop;
    this.freeze = s.freeze;
    this.freezeTotal = s.freezeTotal;
    this.freezeSide = s.freezeSide;
    this.freezeUlt = s.freezeUlt;
    this.matchWinner = s.matchWinner;
    this.nextId = s.nextId;
    this.projectiles = s.projectiles.map((p) => ({ ...p }));
    this.fighters[0].restore(s.fighters[0]);
    this.fighters[1].restore(s.fighters[1]);
  }

  /** 어긋남 확인용 해시 — 소수점 오차를 줄이려고 위치는 반올림해서 섞는다 */
  hash(): number {
    let h = 2166136261;
    const mix = (n: number) => {
      h ^= Math.round(n * 100) | 0;
      h = Math.imul(h, 16777619);
    };
    mix(this.frame);
    mix(this.timer);
    mix(this.round);
    for (const f of this.fighters) {
      mix(f.x);
      mix(f.h);
      mix(f.hp);
      mix(f.meter);
      mix(f.t);
      mix(f.roundWins);
    }
    mix(this.projectiles.length);
    return h >>> 0;
  }
}

export interface SimSnapshot {
  frame: number;
  round: number;
  phase: Phase;
  phaseT: number;
  timer: number;
  timeOver: boolean;
  hitstop: number;
  freeze: number;
  freezeTotal: number;
  freezeSide: -1 | 0 | 1;
  freezeUlt: boolean;
  matchWinner: -2 | -1 | 0 | 1;
  nextId: number;
  projectiles: Projectile[];
  fighters: [Record<string, unknown>, Record<string, unknown>];
}
