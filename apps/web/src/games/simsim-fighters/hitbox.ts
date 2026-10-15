import { GUARD_CRUSH_STUN, GUARD_MAX, JUGGLE_LIMIT, STAGE_W, WALL } from './config';
import type { FxKind, Level } from './characters';
import type { Fighter, FighterWorld, WorldBox } from './fighter';

/** 날아가는 공격 (투사체 · 낙하 공격 · 기둥 · 대폭발) */
export interface Projectile {
  id: number;
  owner: 0 | 1;
  fx: FxKind;
  facing: 1 | -1;
  x: number;
  /** 중심 높이 */
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  w: number;
  h: number;
  life: number;
  age: number;
  /** 1타 피해 */
  damage: number;
  hitsLeft: number;
  totalHits: number;
  interval: number;
  cd: number;
  level: Level;
  hitstun: number;
  blockstun: number;
  push: number;
  launch: number;
  knockdown: boolean;
  pierce: boolean;
  delay: number;
  linger: number;
  homing: number;
  landed: boolean;
  sky: boolean;
  superLevel: number;
  /** 얼티밋에서 나온 공격 */
  ult: boolean;
  /** 다운된 상대도 맞는다 (대폭발) */
  otg: boolean;
  dead: boolean;
}

/** 맞았을 때 적용할 값 (근접 기술 · 투사체 공통) */
interface HitParams {
  damage: number;
  level: Level;
  hitstun: number;
  blockstun: number;
  push: number;
  launch: number;
  knockdown: boolean;
  hitstop: number;
  meter: number;
  chip: number;
  fx: FxKind;
  superLevel: number;
  ult: boolean;
  melee: boolean;
  grab: boolean;
  /** 밀어내는 방향 (+1 = 오른쪽) */
  dir: number;
}

/** 시뮬레이션이 HitboxManager 에게 열어 주는 기능 */
export interface HitWorld extends FighterWorld {
  readonly fighters: [Fighter, Fighter];
  readonly projectiles: Projectile[];
  addHitstop(frames: number): void;
}

export function overlap(a: WorldBox, b: WorldBox) {
  return Math.abs(a.cx - b.cx) * 2 < a.w + b.w && Math.abs(a.cy - b.cy) * 2 < a.h + b.h;
}

export function projBox(p: Projectile): WorldBox {
  return { cx: p.x, cy: p.y, w: p.w, h: p.h };
}

/** 누워 있는 캐릭터 판정 — 대폭발(OTG)만 맞힐 수 있다 */
function lyingBox(f: Fighter): WorldBox {
  return { cx: f.x, cy: f.h + 20, w: 130, h: 40 };
}

/**
 * HitboxManager — 공격 판정(Hitbox)과 몸통 판정(Hurtbox)을 비교해
 * 피격·가드·가드 크래시·카운터·콤보 보정·텐션 증가를 처리한다.
 */
export class HitboxManager {
  resolve(world: HitWorld) {
    const [p1, p2] = world.fighters;

    // 1) 근접 공격 — 같은 프레임에 서로 맞히면 둘 다 맞는다 (상쇄)
    const pending: { att: Fighter; vic: Fighter; box: WorldBox }[] = [];
    for (const [att, vic] of [
      [p1, p2],
      [p2, p1],
    ] as const) {
      const box = att.attackBox();
      if (!box) continue;
      const d = att.moveDef;
      if (!d) continue;
      if (d.grab && !vic.grabbable()) continue;
      const hurt = vic.hurtbox();
      if (!hurt || !overlap(box, hurt)) continue;
      if (this.juggleLocked(vic, d.superLevel)) continue;
      pending.push({ att, vic, box });
    }
    for (const { att, vic, box } of pending) {
      const d = att.moveDef;
      if (!d) continue;
      const last = att.moveHits + 1 >= d.hits;
      const per = Math.round(d.damage / d.hits);
      att.moveHits++;
      att.nextHitT = att.t + d.interval;
      att.connected = true;
      if (d.grab) {
        vic.x = world.clampX(att.x + att.facing * 46 * att.def.scale);
      }
      const hurt = vic.hurtbox() ?? box;
      this.apply(
        world,
        att,
        vic,
        {
          damage: per,
          level: d.level,
          hitstun: last ? d.hitstun : Math.max(d.hitstun, d.interval + 12),
          blockstun: last ? d.blockstun : Math.max(d.blockstun, d.interval + 8),
          push: last ? d.push : Math.min(d.push, 1.5) + (d.selfVx > 0 ? d.selfVx * 0.9 : 0),
          launch: last ? d.launch : 0,
          knockdown: last ? d.knockdown : false,
          hitstop: last ? d.hitstop : Math.min(d.hitstop, 4),
          meter: d.meter,
          chip: d.chip,
          fx: d.fx,
          superLevel: d.superLevel,
          ult: d.superLevel === 3,
          melee: true,
          grab: d.grab,
          dir: Math.sign(vic.x - att.x) || att.facing,
        },
        (box.cx + hurt.cx) / 2,
        Math.min(box.cy, hurt.cy + hurt.h / 3),
      );
    }

    // 2) 투사체끼리 부딪치면 상쇄
    const ps = world.projectiles;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i] as Projectile;
      if (a.dead || a.age < a.delay) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j] as Projectile;
        if (b.dead || b.owner === a.owner || b.age < b.delay) continue;
        if (a.otg || b.otg) continue;
        if (!overlap(projBox(a), projBox(b))) continue;
        if (!a.pierce) a.dead = true;
        if (!b.pierce) b.dead = true;
        if (a.dead || b.dead) world.emit({ type: 'clash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }

    // 3) 투사체 → 상대
    for (const p of ps) {
      if (p.dead || p.age < p.delay || p.cd > 0) continue;
      const att = world.fighters[p.owner];
      const vic = world.fighters[p.owner === 0 ? 1 : 0];
      let hurt = vic.hurtbox();
      if (!hurt && p.otg && vic.act !== 'ko') hurt = lyingBox(vic);
      if (!hurt || !overlap(projBox(p), hurt)) continue;
      if (!p.otg && this.juggleLocked(vic, p.superLevel)) continue;
      p.hitsLeft--;
      p.cd = p.interval;
      const last = p.hitsLeft <= 0;
      if (last) p.dead = true;
      if (vic.act === 'knockdown' || vic.act === 'getup') {
        // 대폭발이 누운 상대를 다시 띄운다
        vic.h = 0.01;
      }
      this.apply(
        world,
        att,
        vic,
        {
          damage: p.damage,
          level: p.level,
          hitstun: last ? p.hitstun : Math.max(p.hitstun, p.interval + 12),
          blockstun: last ? p.blockstun : Math.max(p.blockstun, p.interval + 8),
          push: last ? p.push : Math.min(p.push, 1.5),
          launch: last ? p.launch : 0,
          knockdown: last ? p.knockdown : false,
          hitstop: p.otg ? 16 : last ? 9 : 4,
          meter: 8,
          chip: p.superLevel > 0 ? 0.2 : 0.12,
          fx: p.fx,
          superLevel: p.superLevel,
          ult: p.ult,
          melee: false,
          grab: false,
          dir: p.otg ? Math.sign(vic.x - att.x) || att.facing : Math.sign(p.vx) || p.facing,
        },
        (p.x + hurt.cx) / 2,
        Math.min(p.y, hurt.cy + hurt.h / 3),
      );
    }
  }

  /** 공중 콤보가 너무 길면 더 맞지 않는다 (초필살기는 예외) */
  private juggleLocked(vic: Fighter, superLevel: number) {
    return superLevel === 0 && vic.act === 'hitstun' && vic.airborne && vic.juggle >= JUGGLE_LIMIT;
  }

  private apply(world: HitWorld, att: Fighter, vic: Fighter, p: HitParams, hx: number, hy: number) {
    const dir = p.dir;
    const atWall = vic.x <= WALL + 4 || vic.x >= STAGE_W - WALL - 4;

    if (vic.canBlock(p.level)) {
      // 가드 — 깎기 피해 · 가드 게이지 감소
      const chip = Math.round(p.damage * p.chip);
      vic.hp = Math.max(p.superLevel > 0 ? 0 : 1, vic.hp - chip);
      vic.guardHp -= p.damage * 0.32 + 4;
      vic.stats.blocks++;
      att.addMeter(2 + p.meter * 0.3);
      vic.addMeter(4);
      if (p.melee && atWall) att.vx = -dir * p.push * 0.7;
      if (vic.guardHp <= 0) {
        vic.guardHp = GUARD_MAX * 0.5;
        vic.move = null;
        vic.guarding = false;
        vic.setAct('hitstun');
        vic.stun = GUARD_CRUSH_STUN;
        vic.hardKD = false;
        vic.vx = dir * 3;
        vic.flash = 8;
        world.addHitstop(16);
        world.emit({ type: 'guardCrush', side: vic.side, x: vic.x, y: vic.h + 100 });
        return;
      }
      vic.move = null;
      vic.setAct('blockstun');
      vic.stun = p.blockstun;
      vic.vx = dir * p.push * 0.9;
      world.addHitstop(Math.max(4, Math.round(p.hitstop * 0.7)));
      world.emit({
        type: 'hit',
        side: vic.side,
        x: hx,
        y: hy,
        damage: chip,
        blocked: true,
        heavy: p.damage >= 60,
        counter: false,
        fx: p.fx,
        combo: 0,
        superLevel: p.superLevel,
      });
      return;
    }

    // 피격
    const vd = vic.moveDef;
    const counter = vic.act === 'attack' && !!vd && vic.t <= vd.startup && vd.superLevel === 0;
    const scale = Math.max(0.3, 1 - 0.085 * vic.combo);
    const raw = p.damage * scale * vic.def.stats.defense * (counter ? 1.2 : 1);
    const dmg = Math.max(1, Math.round(raw));
    const dealt = Math.min(dmg, vic.hp);
    vic.hp -= dmg;
    vic.combo++;
    vic.comboDamage += dmg;
    att.stats.damage += dealt;
    att.stats.maxCombo = Math.max(att.stats.maxCombo, vic.combo);
    att.addMeter(p.meter);
    vic.addMeter(dmg * 0.05);
    if (p.ult && att.ultState === 1) att.ultState = 2;
    if (vic.hp <= 0 && p.superLevel > 0) att.superFinish = true;

    vic.move = null;
    vic.guarding = false;
    vic.flash = 6;
    vic.setAct('hitstun');
    if (p.melee && atWall) att.vx = -dir * p.push * 0.7;

    const air = vic.airborne || p.launch > 0;
    if (air) {
      vic.juggle++;
      vic.vy = p.launch > 0 ? p.launch : Math.max(4.5, Math.min(vic.vy + 3, 7));
      vic.h = Math.max(vic.h, 0.01);
      vic.vx = dir * Math.max(2, p.push * 0.6);
      vic.hardKD = vic.hardKD || p.knockdown || p.launch > 0;
      vic.stun = p.hitstun;
    } else if (p.knockdown) {
      vic.vy = 5;
      vic.h = 0.01;
      vic.vx = dir * Math.max(2.5, p.push * 0.6);
      vic.hardKD = true;
      vic.stun = p.hitstun;
    } else {
      vic.stun = p.hitstun + (counter ? 6 : 0);
      vic.vx = dir * p.push;
      vic.hardKD = false;
    }

    world.addHitstop(Math.min(22, p.hitstop + (counter ? 4 : 0)));
    world.emit({
      type: 'hit',
      side: vic.side,
      x: hx,
      y: hy,
      damage: dmg,
      blocked: false,
      heavy: p.damage >= 60 || p.knockdown || p.launch > 0,
      counter,
      fx: p.fx,
      combo: vic.combo,
      superLevel: p.superLevel,
    });
  }
}
