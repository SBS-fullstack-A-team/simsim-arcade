import {
  DOT_FRAMES,
  DOT_TICK,
  BACKDASH_FRAMES,
  BACKDASH_INVUL,
  BURST_COST,
  DASH_CANCEL,
  DASH_FRAMES,
  DASH_WINDOW,
  GETUP_FRAMES,
  GRAVITY,
  GUARD_MAX,
  GUARD_REGEN,
  IN,
  JUMP_SQUAT,
  KNOCKDOWN_FRAMES,
  LAND_LAG,
  METER_MAX,
  SUPER_COST,
  ULT_COST,
  WALK_BACK,
  WALK_FWD,
} from './config';
import {
  CharacterRegistry,
  type CharId,
  type CharacterDef,
  type Level,
  type MoveDef,
  type MoveId,
  type MoveSet,
  type ProjSpec,
} from './characters';

export type Act =
  | 'idle'
  | 'walk'
  | 'dash'
  | 'crouch'
  | 'jumpsquat'
  | 'air'
  | 'land'
  | 'attack'
  | 'guard'
  | 'blockstun'
  | 'hitstun'
  | 'knockdown'
  | 'getup'
  | 'ko'
  | 'win'
  | 'intro';

/** 월드 좌표 판정 상자 (cx, cy = 중심, cy 는 땅에서 높이) */
export interface WorldBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** 시뮬레이션이 Fighter 에게 열어 주는 기능 */
export interface FighterWorld {
  spawnProjectile(owner: Fighter, spec: ProjSpec, index: number, opp: Fighter): void;
  superFreeze(owner: Fighter, ult: boolean): void;
  emit(e: SimEvent): void;
  clampX(x: number): number;
}

export type SimEvent =
  | { type: 'jump'; side: 0 | 1; x: number }
  | { type: 'land'; side: 0 | 1; x: number }
  | { type: 'dash'; side: 0 | 1; x: number; dir: number }
  | { type: 'swing'; side: 0 | 1; move: MoveId; x: number; y: number }
  | { type: 'teleport'; side: 0 | 1; from: number; to: number; y: number }
  | { type: 'burst'; side: 0 | 1; x: number; y: number }
  | { type: 'parry'; side: 0 | 1; x: number; y: number }
  | { type: 'armor'; side: 0 | 1; x: number; y: number }
  | {
      type: 'hit';
      side: 0 | 1;
      x: number;
      y: number;
      damage: number;
      blocked: boolean;
      heavy: boolean;
      counter: boolean;
      fx: string;
      combo: number;
      superLevel: number;
    }
  | { type: 'guardCrush'; side: 0 | 1; x: number; y: number }
  | { type: 'super'; side: 0 | 1; ult: boolean }
  | { type: 'projectile'; side: 0 | 1; fx: string; x: number; y: number }
  | { type: 'explosion'; x: number; y: number }
  | { type: 'clash'; x: number; y: number }
  | { type: 'ko'; side: 0 | 1; superFinish: boolean }
  | { type: 'round'; round: number }
  | { type: 'fight' }
  | { type: 'timeover' }
  | { type: 'roundEnd'; winner: -1 | 0 | 1; perfect: boolean; timeLeft: number }
  | { type: 'matchEnd'; winner: -1 | 0 | 1 };

export interface FighterStats {
  /** 상대에게 준 피해 */
  damage: number;
  maxCombo: number;
  supers: number;
  bursts: number;
  blocks: number;
}

/** 지속 프레임 동안 상대를 맞힐 수 있는 상태인지 계산할 때 쓰는 몸통 판정 크기 */
const HURT = {
  stand: { y: 78, w: 54, h: 156 },
  crouch: { y: 50, w: 58, h: 100 },
  air: { y: 70, w: 50, h: 112 },
};

/**
 * Fighter — 캐릭터 한 명의 상태 머신.
 * 모든 값은 숫자·문자열·배열뿐이라 snapshot()/restore() 로 그대로 복사할 수 있다 (온라인 동기화).
 */
export class Fighter {
  side: 0 | 1;
  charId: CharId;
  x = 0;
  /** 땅에서의 높이 (위가 +) */
  h = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  hp: number;
  maxHp: number;
  meter = 0;
  guardHp = GUARD_MAX;
  act: Act = 'intro';
  /** 지금 상태로 들어온 뒤 지난 프레임 */
  t = 0;
  move: MoveId | null = null;
  /** 이번 기술로 맞힌(또는 막힌) 타수 */
  moveHits = 0;
  nextHitT = 0;
  /** 맞히거나 막혔는지 (캔슬 가능 여부) */
  connected = false;
  projSpawned = 0;
  stun = 0;
  /** 착지할 때 다운되는 피격인지 */
  hardKD = false;
  landLag = LAND_LAG;
  guarding = false;
  guardLow = false;
  /** 앞으로 걸으면 1, 뒤로 걸으면 -1 */
  walkDir = 0;
  jumpDir = 0;
  juggle = 0;
  /** 내가 지금 맞고 있는 콤보 타수 */
  combo = 0;
  comboDamage = 0;
  invul = 0;
  /** 0: 없음 · 1: 얼티밋 진행 중 · 2: 얼티밋이 맞음 (대폭발 대기) */
  ultState = 0;
  superFinish = false;
  roundWins = 0;
  /** 입력 — 이전 프레임 키, 방향 기록(텐키 표기), 선입력 버퍼 */
  prevIn = 0;
  held = 0;
  motion: number[] = [];
  bufA = 0;
  bufS = 0;
  bufF = 0;
  /** 대시 — 첫 탭 방향(화면 기준 -1 왼쪽 / 1 오른쪽) · 두 번째 탭을 기다리는 남은 프레임 · 대시 선입력 */
  tapDir = 0;
  tapT = 0;
  bufDash = 0;
  bufDashDir = 0;
  /** 상태 이상 — 지속 피해(남은 프레임 · 한 번에 깎이는 양 · 속성) · 둔화 남은 프레임 */
  dotT = 0;
  dotPer = 0;
  dotFx = '';
  slowT = 0;
  /** 이번 기술로 버틴 슈퍼아머 타수 */
  armorUsed = 0;
  /** 다음 착지 때 바닥에서 한 번 튀어 오른다 */
  bounce = false;
  /** 붙잡힘 — 붙잡은 쪽 (0: 없음 · 1: 1P · 2: 2P) 과 붙잡힌 높이 */
  lockedBy = 0;
  lockH = 0;
  /** 얼어붙어 움직이지 못하는 남은 프레임 · 묶은 속성 (얼음 · 가시) */
  frozenT = 0;
  frozenFx = '';
  /** 각성(오버드라이브) 남은 프레임 */
  buffT = 0;
  /** 맞은 순간 하얗게 번쩍이는 연출용 */
  flash = 0;
  stats: FighterStats = { damage: 0, maxCombo: 0, supers: 0, bursts: 0, blocks: 0 };

  constructor(side: 0 | 1, charId: CharId, hpScale = 1) {
    this.side = side;
    this.charId = charId;
    this.maxHp = Math.round(CharacterRegistry.get(charId).stats.hp * hpScale);
    this.hp = this.maxHp;
  }

  get def(): CharacterDef {
    return CharacterRegistry.get(this.charId);
  }

  get moves(): MoveSet {
    return CharacterRegistry.moves(this.charId);
  }

  get moveDef(): MoveDef | null {
    return this.move ? this.moves[this.move] : null;
  }

  get airborne() {
    return this.h > 0 || this.vy > 0;
  }

  get crouching() {
    if (this.act === 'crouch') return true;
    if ((this.act === 'guard' || this.act === 'blockstun') && this.guardLow) return true;
    return this.act === 'attack' && (this.move === 'cPunch' || this.move === 'cKick');
  }

  /* ---------------- 스냅샷 (온라인 동기화) ---------------- */

  snapshot(): Record<string, unknown> {
    return { ...this, motion: this.motion.slice(), stats: { ...this.stats } } as unknown as Record<
      string,
      unknown
    >;
  }

  restore(s: Record<string, unknown>) {
    Object.assign(this, s);
    this.motion = (s.motion as number[]).slice();
    this.stats = { ...(s.stats as FighterStats) };
  }

  /* ---------------- 라운드 ---------------- */

  resetForRound(x: number, facing: 1 | -1) {
    this.x = x;
    this.h = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.hp = this.maxHp;
    this.guardHp = GUARD_MAX;
    this.act = 'intro';
    this.t = 0;
    this.move = null;
    this.stun = 0;
    this.combo = 0;
    this.comboDamage = 0;
    this.juggle = 0;
    this.invul = 0;
    this.ultState = 0;
    this.superFinish = false;
    this.guarding = false;
    this.guardLow = false;
    this.bufA = 0;
    this.bufS = 0;
    this.bufF = 0;
    this.tapDir = 0;
    this.tapT = 0;
    this.bufDash = 0;
    this.motion = [];
    this.flash = 0;
    this.dotT = 0;
    this.dotPer = 0;
    this.slowT = 0;
    this.bounce = false;
    this.lockedBy = 0;
    this.frozenT = 0;
    this.buffT = 0;
  }

  /** 지속 피해 걸기 — 이미 걸려 있으면 남은 양에 더해 3초를 새로 센다 */
  addDot(total: number, fx: string) {
    const left = this.dotT > 0 ? this.dotPer * Math.ceil(this.dotT / DOT_TICK) : 0;
    this.dotT = DOT_FRAMES;
    this.dotPer = (left + total) / (DOT_FRAMES / DOT_TICK);
    this.dotFx = fx;
  }

  /** 이동 속도 배율 — 둔화면 느리게, 각성 중이면 빠르게 */
  get slowMul() {
    return (this.slowT > 0 ? 0.6 : 1) * (this.buffT > 0 ? 1.3 : 1);
  }

  addMeter(n: number) {
    this.meter = Math.max(0, Math.min(METER_MAX, this.meter + n));
  }

  /* ---------------- 입력 ---------------- */

  /** 매 프레임 (히트스톱 중에도) 입력을 읽어 선입력 버퍼와 방향 기록을 갱신한다 */
  readInput(bits: number, frozen: boolean) {
    const pressed = bits & ~this.prevIn;
    this.prevIn = bits;
    this.held = bits;
    if (!frozen) {
      if (this.bufA > 0) this.bufA--;
      if (this.bufS > 0) this.bufS--;
      if (this.bufF > 0) this.bufF--;
      if (this.tapT > 0) this.tapT--;
      if (this.bufDash > 0) this.bufDash--;
    }
    // 같은 방향키 두 번 연타 → 대시 (위 · 아래를 함께 누르고 있으면 대시가 아니다)
    const tap = pressed & (IN.LEFT | IN.RIGHT);
    if (tap && tap !== (IN.LEFT | IN.RIGHT) && !(bits & (IN.UP | IN.DOWN))) {
      const dir = tap & IN.RIGHT ? 1 : -1;
      if (this.tapT > 0 && this.tapDir === dir) {
        this.bufDash = 6;
        this.bufDashDir = dir;
        this.tapT = 0;
      } else {
        this.tapDir = dir;
        this.tapT = DASH_WINDOW;
      }
    }
    if (pressed & IN.A) this.bufA = 7;
    if (pressed & IN.S) this.bufS = 7;
    if (pressed & IN.F) this.bufF = 7;
    this.motion.push(this.numpad(bits));
    if (this.motion.length > 20) this.motion.shift();
  }

  /** 입력을 바라보는 방향 기준 텐키 숫자로 (6 = 앞, 4 = 뒤, 2 = 아래, 8 = 위) */
  private numpad(bits: number) {
    const fwd = this.facing > 0 ? IN.RIGHT : IN.LEFT;
    const back = this.facing > 0 ? IN.LEFT : IN.RIGHT;
    const f = (bits & fwd) !== 0;
    const b = (bits & back) !== 0;
    if (bits & IN.DOWN) return f ? 3 : b ? 1 : 2;
    if (bits & IN.UP) return f ? 9 : b ? 7 : 8;
    return f ? 6 : b ? 4 : 5;
  }

  /** ↓ → (반원 앞) 커맨드 — 최근 14프레임 안에 ↓ 다음 → 가 들어왔는지 */
  private qcf() {
    const m = this.motion;
    const n = m.length;
    const from = Math.max(0, n - 14);
    let fwdAt = -1;
    for (let i = n - 1; i >= Math.max(from, n - 5); i--) {
      const d = m[i];
      if (d === 6 || d === 3) {
        fwdAt = i;
        break;
      }
    }
    if (fwdAt < 0) return false;
    for (let i = fwdAt - 1; i >= from; i--) if (m[i] === 2) return true;
    return false;
  }

  /* ---------------- 판정 ---------------- */

  hurtbox(): WorldBox | null {
    if (this.invul > 0) return null;
    if (this.act === 'knockdown' || this.act === 'getup' || this.act === 'ko') return null;
    const s = this.def.scale;
    const shift = this.act === 'attack' ? 10 * this.facing : 0;
    if (this.airborne) {
      return {
        cx: this.x + shift,
        cy: this.h + HURT.air.y * s,
        w: HURT.air.w * s,
        h: HURT.air.h * s,
      };
    }
    const k = this.crouching ? HURT.crouch : HURT.stand;
    return { cx: this.x + shift, cy: k.y * s, w: k.w * s, h: k.h * s };
  }

  /** 지속 프레임인지 */
  isActive() {
    const d = this.moveDef;
    if (this.act !== 'attack' || !d) return false;
    return this.t > d.startup && this.t <= d.startup + d.active;
  }

  /** 지금 상대를 맞힐 수 있는 공격 판정 */
  attackBox(): WorldBox | null {
    const d = this.moveDef;
    if (!d || !d.box || !this.isActive()) return null;
    if (this.moveHits >= d.hits || this.t < this.nextHitT) return null;
    return {
      cx: this.x + this.facing * d.box.x,
      cy: this.h + d.box.y,
      w: d.box.w,
      h: d.box.h,
    };
  }

  canBlock(level: Level) {
    if (!this.guarding || level === 'unblockable') return false;
    if (this.airborne) return true;
    return this.guardLow ? level !== 'overhead' : level !== 'low';
  }

  /** 잡기에 걸릴 수 있는 상태 */
  grabbable() {
    if (this.airborne || this.invul > 0) return false;
    return !['hitstun', 'blockstun', 'knockdown', 'getup', 'ko', 'jumpsquat'].includes(this.act);
  }

  /* ---------------- 상태 전환 ---------------- */

  setAct(act: Act) {
    this.act = act;
    this.t = 0;
  }

  toNeutral() {
    this.move = null;
    this.bounce = false;
    this.setAct(this.airborne ? 'air' : 'idle');
    this.combo = 0;
    this.comboDamage = 0;
    this.juggle = 0;
  }

  startMove(id: MoveId, world: FighterWorld) {
    const d = this.moves[id];
    // 앞 대시에서 바로 낸 공격은 관성이 조금 남아 미끄러지듯 들어간다
    const dashMomentum = this.act === 'dash' && this.walkDir > 0;
    if (!this.airborne && !d.air) this.vx = dashMomentum ? this.vx * 0.55 : 0;
    this.bufDash = 0;
    this.armorUsed = 0;
    if (d.install > 0) this.buffT = d.install;
    this.move = id;
    this.setAct('attack');
    this.moveHits = 0;
    this.nextHitT = 0;
    this.connected = false;
    this.projSpawned = 0;
    this.guarding = false;
    if (d.invul > 0) this.invul = Math.max(this.invul, d.invul);
    if (d.superLevel > 0) {
      const ult = d.superLevel === 3;
      this.addMeter(-(ult ? ULT_COST : SUPER_COST));
      this.stats.supers++;
      this.ultState = ult ? 1 : 0;
      world.superFreeze(this, ult);
    }
    if (id === 'burst') {
      this.addMeter(-BURST_COST);
      this.stats.bursts++;
      this.stun = 0;
      this.combo = 0;
      this.juggle = 0;
      if (this.airborne) this.vy = Math.max(this.vy, 2);
      world.emit({ type: 'burst', side: this.side, x: this.x, y: this.h + 80 });
    }
  }

  /* ---------------- 매 프레임 ---------------- */

  update(opp: Fighter, world: FighterWorld, control: boolean) {
    this.t++;
    if (this.invul > 0) this.invul--;
    if (this.flash > 0) this.flash--;
    if (this.slowT > 0) this.slowT--;
    if (this.buffT > 0) this.buffT--;
    if (this.dotT > 0) {
      this.dotT--;
      // 지속 피해로는 쓰러지지 않는다 (체력 1 까지만)
      if (this.dotT % DOT_TICK === 0 && this.act !== 'ko' && this.hp > 1) {
        this.hp = Math.max(1, this.hp - Math.max(1, Math.round(this.dotPer)));
      }
    }
    if (!this.guarding && this.act !== 'blockstun' && this.guardHp < GUARD_MAX) {
      this.guardHp = Math.min(GUARD_MAX, this.guardHp + GUARD_REGEN);
    }

    switch (this.act) {
      case 'hitstun':
        if (!this.airborne) {
          this.stun--;
          if (this.stun <= 0) this.toNeutral();
        }
        break;
      case 'blockstun':
        this.stun--;
        if (this.stun <= 0) this.toNeutral();
        break;
      case 'knockdown':
        if (this.t >= KNOCKDOWN_FRAMES) {
          this.setAct('getup');
          this.invul = GETUP_FRAMES + 2;
        }
        break;
      case 'getup':
        if (this.t >= GETUP_FRAMES) this.toNeutral();
        break;
      case 'land':
        if (this.t >= this.landLag) this.setAct('idle');
        break;
      case 'dash': {
        // 앞 대시: 처음엔 힘껏 박차고 끝으로 갈수록 감속 · 백대시: 짧게 뒤로 뛰었다가 착지
        const s = this.def.stats;
        const fwd = this.walkDir > 0;
        const len = fwd ? DASH_FRAMES : BACKDASH_FRAMES;
        const k = this.t / len;
        const top = (fwd ? 6.2 + s.walk * 1.15 : 5.4 + s.walk * 0.9) * this.slowMul;
        const speed = top * (k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45) ** 1.4);
        this.vx = this.facing * this.walkDir * speed;
        if (this.t >= len) {
          this.vx = 0;
          this.toNeutral();
        }
        break;
      }
      case 'jumpsquat':
        if (this.t >= JUMP_SQUAT) {
          const s = this.def.stats;
          this.vy = s.jumpVy;
          this.vx = this.jumpDir * this.facing * s.jumpVx * this.slowMul;
          this.h = 0.01;
          this.setAct('air');
          world.emit({ type: 'jump', side: this.side, x: this.x });
        }
        break;
      case 'attack':
        this.progressMove(opp, world);
        break;
      default:
        break;
    }

    if (control) this.decide(world);
    else this.guarding = false;
    this.physics(world);
  }

  private progressMove(opp: Fighter, world: FighterWorld) {
    const d = this.moveDef;
    if (!d) {
      this.toNeutral();
      return;
    }
    const first = d.startup + 1;
    const activeEnd = d.startup + d.active;
    const total = activeEnd + d.recovery;

    // 발생 동안 앞으로 미끄러진다 (구르기 · 돌격 준비)
    if (d.startVx > 0 && this.t <= d.startup && !this.airborne) this.vx = this.facing * d.startVx;

    if (this.t === first) {
      world.emit({
        type: 'swing',
        side: this.side,
        move: d.id,
        x: this.x + this.facing * 40,
        y: this.h + 90,
      });
      if (d.selfVy > 0) {
        this.vy = d.selfVy;
        this.vx = this.facing * d.selfVx;
        this.h = Math.max(this.h, 0.01);
      }
      if (d.teleport) {
        const from = this.x;
        const side =
          d.teleport === 'behind'
            ? Math.sign(opp.x - this.x) || 1
            : -Math.sign(opp.x - this.x) || -1;
        this.x = world.clampX(opp.x + side * 74);
        this.facing = opp.x >= this.x ? 1 : -1;
        world.emit({ type: 'teleport', side: this.side, from, to: this.x, y: this.h + 80 });
      }
    }

    // 투사체 — 발생 프레임부터 gap 간격으로 count 발
    if (d.projectile) {
      const p = d.projectile;
      while (this.projSpawned < p.count && this.t >= first + this.projSpawned * p.gap) {
        world.spawnProjectile(this, p, this.projSpawned, opp);
        this.projSpawned++;
      }
    }

    // 붙잡는 기술이 빗나가면 바로 회수한다 (끝까지 달려가지 않게)
    if (d.lock && !this.connected && this.t === first + 16 && this.t < activeEnd) {
      this.t = activeEnd;
    }

    // 돌진 — 지속 동안 앞으로 (붙잡은 뒤 순간이동 베기 중에는 멈춘다)
    if (d.selfVx > 0 && d.selfVy === 0 && !this.airborne && !(d.blink && this.connected)) {
      if (this.t >= first && this.t <= activeEnd) this.vx = this.facing * d.selfVx;
      else if (this.t === activeEnd + 1) this.vx = 0;
    }

    // 다이브는 착지할 때까지 지속
    if (d.untilLand && this.t > activeEnd && this.airborne) this.t = activeEnd;
    // 공중으로 뜨는 기술은 착지해야 끝난다
    if (this.t > total && this.airborne) {
      this.t = total;
      return;
    }
    if (this.t > total) {
      this.toNeutral();
      return;
    }
    // 각성 중에는 회수가 두 배 빠르다
    if (this.buffT > 0 && this.t > activeEnd && this.t < total && !this.airborne) this.t++;
  }

  private decide(world: FighterWorld) {
    const bits = this.held;
    const grounded = !this.airborne;
    const dashing = this.act === 'dash';
    // 대시는 몇 프레임 뒤부터 공격 · 필살기 · 점프로 캔슬된다
    const dashFree = dashing && this.t >= DASH_CANCEL;
    const neutral =
      grounded &&
      (this.act === 'idle' ||
        this.act === 'walk' ||
        this.act === 'crouch' ||
        this.act === 'guard' ||
        dashFree);
    const airFree = this.act === 'air' && !this.move;
    const guardable =
      neutral || dashing || this.act === 'blockstun' || this.act === 'land' || airFree;
    this.guarding = (bits & IN.D) !== 0 && guardable;
    this.guardLow = this.guarding && (bits & IN.DOWN) !== 0 && grounded;

    // 버스트 — 맞거나 막는 중에 F
    if (
      this.bufF > 0 &&
      (this.act === 'hitstun' || this.act === 'blockstun') &&
      this.meter >= BURST_COST
    ) {
      this.bufF = 0;
      this.startMove('burst', world);
      return;
    }

    const d = this.moveDef;

    // 연계기 — 맞히거나 막힌 뒤 같은 버튼을 한 번 더 (볼트 스트레이트 → 썬더 어퍼)
    if (this.act === 'attack' && d && d.chain && this.connected && this.t > d.startup) {
      const buf = d.chain === 'A' ? this.bufA : this.bufS;
      if (buf > 0) {
        this.bufA = 0;
        this.bufS = 0;
        this.startMove('ex', world);
        return;
      }
    }

    // 캔슬 가능 상태
    let cancel = 0;
    if (this.act === 'attack' && d && this.connected && this.t > d.startup && grounded) {
      if (d.superLevel === 0 && d.id !== 'burst')
        cancel = d.cancel === 2 ? 2 : d.cancel === 1 ? 1 : 3;
    }
    const canGround = neutral || cancel > 0;

    // 초필살기 (F) — 3단계 가득이면 버스트 얼티밋
    if (this.bufF > 0 && grounded && canGround && this.meter >= SUPER_COST) {
      this.bufF = 0;
      this.startMove(this.meter >= ULT_COST ? 'ult' : 'super', world);
      return;
    }

    // 필살기 (↓→ + A / S)
    if (grounded && (neutral || cancel === 1 || cancel === 2) && (this.bufA > 0 || this.bufS > 0)) {
      if (this.qcf()) {
        const id = this.bufA > 0 ? 'sp1' : 'sp2';
        this.bufA = 0;
        this.bufS = 0;
        this.motion = [];
        this.startMove(id, world);
        return;
      }
    }

    // 기본기
    if (grounded && (neutral || cancel === 2)) {
      const down = (bits & IN.DOWN) !== 0;
      if (this.bufS > 0) {
        this.bufS = 0;
        this.startMove(down ? 'cKick' : 'kick', world);
        return;
      }
      if (this.bufA > 0 && (neutral || this.move === 'punch' || this.move === 'cPunch')) {
        this.bufA = 0;
        this.startMove(down ? 'cPunch' : 'punch', world);
        return;
      }
    }
    if (airFree) {
      // 공중 필살기 (↓→ + 버튼, 공중에서 쓸 수 있는 기술만)
      if ((this.bufA > 0 || this.bufS > 0) && this.qcf()) {
        const id = this.bufA > 0 ? 'sp1' : 'sp2';
        if (this.moves[id].airOk) {
          this.bufA = 0;
          this.bufS = 0;
          this.motion = [];
          this.startMove(id, world);
          return;
        }
      }
      if (this.bufS > 0) {
        this.bufS = 0;
        this.startMove('aKick', world);
        return;
      }
      if (this.bufA > 0) {
        this.bufA = 0;
        this.startMove('aPunch', world);
        return;
      }
    }

    if (!neutral && !(dashing && grounded)) return;

    // 가드 — 대시 중에도 바로 막을 수 있다
    if (this.guarding) {
      if (this.act !== 'guard') this.setAct('guard');
      this.vx = 0;
      return;
    }

    const fwd = this.facing > 0 ? IN.RIGHT : IN.LEFT;
    const back = this.facing > 0 ? IN.LEFT : IN.RIGHT;
    const dir = bits & fwd ? 1 : bits & back ? -1 : 0;

    if (dashing) {
      // 대시 점프 캔슬
      if (dashFree && bits & IN.UP) {
        this.jumpDir = dir;
        this.vx = 0;
        this.setAct('jumpsquat');
      }
      return;
    }

    // 대시 (→→ / ←←)
    if (this.bufDash > 0 && !(bits & IN.DOWN)) {
      this.walkDir = this.bufDashDir * this.facing > 0 ? 1 : -1;
      this.bufDash = 0;
      this.setAct('dash');
      if (this.walkDir < 0) this.invul = Math.max(this.invul, BACKDASH_INVUL);
      world.emit({ type: 'dash', side: this.side, x: this.x, dir: this.walkDir });
      return;
    }

    if (bits & IN.UP) {
      this.jumpDir = dir;
      this.vx = 0;
      this.setAct('jumpsquat');
      return;
    }
    if (bits & IN.DOWN) {
      if (this.act !== 'crouch') this.setAct('crouch');
      this.vx = 0;
      return;
    }
    if (dir !== 0) {
      const s = this.def.stats;
      if (this.act !== 'walk' || this.walkDir !== dir) this.setAct('walk');
      this.walkDir = dir;
      const walk = s.walk * this.slowMul;
      this.vx = this.facing * (dir > 0 ? walk * WALK_FWD : -walk * 0.8 * WALK_BACK);
      return;
    }
    if (this.act !== 'idle') this.setAct('idle');
    this.vx = 0;
  }

  private physics(world: FighterWorld) {
    if (this.act === 'jumpsquat') {
      this.vx = 0;
      return;
    }
    if (this.airborne) {
      this.vy -= GRAVITY;
      this.x += this.vx;
      this.h += this.vy;
      if (this.h <= 0) {
        this.h = 0;
        this.vy = 0;
        this.onLand(world);
      }
      return;
    }
    this.x += this.vx;
    if (
      this.act === 'hitstun' ||
      this.act === 'blockstun' ||
      this.act === 'ko' ||
      this.act === 'knockdown'
    ) {
      this.vx *= 0.86;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    } else if (this.act === 'attack') {
      const d = this.moveDef;
      const rushing = d && d.selfVx > 0 && this.isActive();
      if (!rushing) this.vx *= 0.72;
    }
  }

  private onLand(world: FighterWorld) {
    world.emit({ type: 'land', side: this.side, x: this.x });
    switch (this.act) {
      case 'air':
        this.vx = 0;
        this.landLag = LAND_LAG;
        this.setAct('land');
        break;
      case 'attack': {
        const d = this.moveDef;
        this.vx = 0;
        if (d && d.untilLand) {
          if (d.landProj) world.spawnProjectile(this, d.landProj, 0, this);
          this.t = d.startup + d.active + 1;
          return;
        }
        this.move = null;
        this.landLag = d && d.selfVy > 0 ? 9 : LAND_LAG;
        this.setAct('land');
        break;
      }
      case 'hitstun':
        if (this.bounce && this.hp > 0) {
          // 바닥에 부딪혀 한 번 튀어 오른다 — 이어서 때릴 수 있다
          this.bounce = false;
          this.vy = 7.5;
          this.h = 0.01;
          this.vx *= 0.5;
          break;
        }
        if (this.hardKD || this.hp <= 0) {
          this.vx *= 0.3;
          this.setAct('knockdown');
          this.combo = 0;
          this.comboDamage = 0;
          this.juggle = 0;
        } else {
          this.vx = 0;
          this.landLag = 8;
          this.combo = 0;
          this.comboDamage = 0;
          this.juggle = 0;
          this.move = null;
          this.setAct('land');
        }
        break;
      case 'blockstun':
        this.vx = 0;
        break;
      case 'ko':
        this.vx *= 0.4;
        break;
      default:
        break;
    }
  }
}
