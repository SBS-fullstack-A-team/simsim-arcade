/**
 * 심심파이터즈 — 캐릭터 그리기 (이미지 파일 없이 Canvas 로 직접 그린다)
 *
 * 관절 리그: 골반 · 몸통 기울기 · 손/발 목표 위치를 정하면 2관절 IK 로 팔꿈치·무릎을 계산한다.
 * 기술마다 [준비 자세, 타격 자세] 두 장을 두고 발생 → 지속 → 후딜 프레임에 맞춰 보간한다.
 * 캐릭터마다 머리 모양 · 무기 · 등 장식 · 체형 · 색만 다르게 얹는다.
 */
import { GETUP_FRAMES, GROUND_Y } from './config';
import type { AnimKey, CharacterDef, Palette, WeaponKind } from './characters';
import type { Fighter } from './fighter';

type V = [number, number];

export interface Pose {
  /** 골반 위치 (발밑 기준, y 는 음수가 위) */
  hip: V;
  /** 몸통 기울기 (+ 앞으로) */
  lean: number;
  head: number;
  /** 손 — 어깨 기준 위치 */
  fHand: V;
  bHand: V;
  /** 발 — 발밑 기준 위치 */
  fFoot: V;
  bFoot: V;
  /** 무기 각도 보정 */
  weapon: number;
  /** 몸 전체 회전 (골반 중심) */
  spin: number;
}

const INK = '#0e0812';
const TAU = Math.PI * 2;

const BASE: Pose = {
  hip: [0, -66],
  lean: 0.08,
  head: 0,
  fHand: [24, 12],
  bHand: [18, 16],
  fFoot: [17, 0],
  bFoot: [-17, 0],
  weapon: 0,
  spin: 0,
};
const P = (o: Partial<Pose>): Pose => ({ ...BASE, ...o });

const POSE = {
  idle: BASE,
  crouch: P({
    hip: [2, -40],
    lean: 0.34,
    fHand: [26, 4],
    bHand: [18, 8],
    fFoot: [24, 0],
    bFoot: [-22, 0],
  }),
  air: P({
    hip: [0, -72],
    lean: 0.05,
    fHand: [22, 2],
    bHand: [14, 8],
    fFoot: [16, -30],
    bFoot: [-12, -22],
  }),
  guard: P({
    hip: [-3, -64],
    lean: -0.05,
    head: 0.12,
    fHand: [16, -6],
    bHand: [13, -2],
    fFoot: [16, 0],
    bFoot: [-21, 0],
  }),
  cguard: P({
    hip: [-2, -40],
    lean: 0.22,
    head: 0.1,
    fHand: [15, -8],
    bHand: [12, -4],
    fFoot: [22, 0],
    bFoot: [-22, 0],
  }),
  hit: P({
    hip: [-6, -62],
    lean: -0.42,
    head: -0.35,
    fHand: [-4, 26],
    bHand: [-18, 22],
    fFoot: [16, 0],
    bFoot: [-22, 0],
  }),
  airHit: P({
    hip: [0, -66],
    lean: -0.6,
    head: -0.4,
    fHand: [10, -22],
    bHand: [-20, -14],
    fFoot: [26, -30],
    bFoot: [8, -10],
  }),
  down: P({
    hip: [-8, -10],
    lean: -1.5,
    head: -0.2,
    fHand: [-14, 8],
    bHand: [-26, 6],
    fFoot: [42, -6],
    bFoot: [36, -2],
  }),
  win: P({
    hip: [0, -68],
    lean: -0.05,
    head: -0.12,
    fHand: [6, -56],
    bHand: [8, 24],
    fFoot: [16, 0],
    bFoot: [-16, 0],
    weapon: -1.2,
  }),
  superPose: P({
    hip: [0, -62],
    lean: -0.12,
    head: -0.15,
    fHand: [34, -34],
    bHand: [-28, -26],
    fFoot: [26, 0],
    bFoot: [-26, 0],
    weapon: -0.8,
  }),
  burst: P({
    hip: [0, -72],
    lean: -0.15,
    head: -0.3,
    fHand: [34, -14],
    bHand: [-34, -14],
    fFoot: [24, -4],
    bFoot: [-24, -4],
  }),
};

/** 기술 애니메이션 — [준비, 타격] */
const ATK: Record<AnimKey, [Pose, Pose]> = {
  punch: [
    P({ hip: [-2, -65], lean: 0, fHand: [4, 12], bHand: [20, 8] }),
    P({
      hip: [8, -63],
      lean: 0.24,
      fHand: [58, -6],
      bHand: [4, 22],
      fFoot: [26, 0],
      bFoot: [-22, 0],
    }),
  ],
  kick: [
    P({ hip: [-2, -68], lean: -0.1, fFoot: [22, -40], bFoot: [-14, 0] }),
    P({
      hip: [-6, -72],
      lean: -0.32,
      fFoot: [74, -84],
      bFoot: [-14, 0],
      fHand: [14, 2],
      bHand: [-14, 10],
    }),
  ],
  cPunch: [
    P({ ...POSE.crouch, fHand: [10, 6] }),
    P({ ...POSE.crouch, lean: 0.42, fHand: [56, 2], bHand: [10, 12] }),
  ],
  cKick: [
    P({
      hip: [0, -36],
      lean: 0.4,
      fFoot: [22, 0],
      bFoot: [-22, 0],
      fHand: [26, 26],
      bHand: [18, 30],
    }),
    P({
      hip: [-8, -28],
      lean: 0.55,
      fFoot: [88, -4],
      bFoot: [-24, 0],
      fHand: [24, 30],
      bHand: [10, 32],
    }),
  ],
  aPunch: [
    P({ ...POSE.air, fHand: [8, 0] }),
    P({ ...POSE.air, lean: 0.3, fHand: [44, 34], bHand: [4, 8] }),
  ],
  aKick: [
    P({ ...POSE.air, fFoot: [20, -30] }),
    P({ ...POSE.air, lean: -0.18, fFoot: [62, -14], bFoot: [-14, -32] }),
  ],
  cast: [
    P({ hip: [-4, -64], lean: -0.1, fHand: [8, -4], bHand: [4, 0] }),
    P({
      hip: [6, -62],
      lean: 0.18,
      fHand: [50, -6],
      bHand: [42, -2],
      fFoot: [26, 0],
      bFoot: [-24, 0],
    }),
  ],
  beam: [
    P({ hip: [-4, -64], lean: -0.1, fHand: [8, -4], bHand: [4, 0] }),
    P({
      hip: [4, -64],
      lean: 0.1,
      fHand: [56, -4],
      bHand: [48, 0],
      fFoot: [22, 0],
      bFoot: [-26, 0],
    }),
  ],
  rush: [
    P({
      hip: [-8, -56],
      lean: 0.3,
      fHand: [6, 16],
      bHand: [-14, 16],
      fFoot: [24, 0],
      bFoot: [-30, 0],
    }),
    P({
      hip: [10, -58],
      lean: 0.55,
      fHand: [56, 6],
      bHand: [-22, 22],
      fFoot: [34, 0],
      bFoot: [-34, -6],
    }),
  ],
  upper: [
    P({
      hip: [0, -44],
      lean: 0.3,
      fHand: [16, 22],
      bHand: [8, 20],
      fFoot: [22, 0],
      bFoot: [-20, 0],
    }),
    P({
      hip: [0, -76],
      lean: -0.1,
      head: -0.2,
      fHand: [18, -56],
      bHand: [-12, 22],
      fFoot: [12, -26],
      bFoot: [-6, 0],
      weapon: -1,
    }),
  ],
  dive: [
    P({ ...POSE.air, lean: 0.2 }),
    P({
      hip: [0, -66],
      lean: 0.7,
      fHand: [44, 34],
      bHand: [36, 38],
      fFoot: [-24, -34],
      bFoot: [-32, -24],
    }),
  ],
  slash: [
    P({ hip: [-4, -66], lean: -0.15, fHand: [-14, -40], bHand: [-6, -34], weapon: -0.6 }),
    P({
      hip: [8, -60],
      lean: 0.35,
      fHand: [46, 24],
      bHand: [30, 26],
      fFoot: [28, 0],
      bFoot: [-24, 0],
      weapon: 0.3,
    }),
  ],
  grab: [
    P({ hip: [2, -64], lean: 0.2, fHand: [40, -2], bHand: [34, 4] }),
    P({ hip: [0, -70], lean: -0.15, head: -0.2, fHand: [26, -50], bHand: [20, -46] }),
  ],
  super: [P({ hip: [0, -60], lean: 0.2, fHand: [10, 10], bHand: [-6, 12] }), POSE.superPose],
  burst: [POSE.burst, POSE.burst],
};

const BLADES: readonly WeaponKind[] = [
  'greatsword',
  'scythe',
  'katana',
  'chainsaw',
  'lance',
  'staff',
];

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}
function lerpV(a: V, b: V, k: number): V {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}
export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    hip: lerpV(a.hip, b.hip, k),
    lean: lerp(a.lean, b.lean, k),
    head: lerp(a.head, b.head, k),
    fHand: lerpV(a.fHand, b.fHand, k),
    bHand: lerpV(a.bHand, b.bHand, k),
    fFoot: lerpV(a.fFoot, b.fFoot, k),
    bFoot: lerpV(a.bFoot, b.bFoot, k),
    weapon: lerp(a.weapon, b.weapon, k),
    spin: lerp(a.spin, b.spin, k),
  };
}
const ease = (k: number) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 2;

/** 캐릭터마다 같은 버튼이라도 동작을 다르게 (큰 무기는 주먹 대신 베기) */
function animFor(def: CharacterDef, anim: AnimKey): AnimKey {
  if (anim === 'punch' && BLADES.includes(def.weapon)) return 'slash';
  if (anim === 'punch' && def.weapon === 'whip') return 'beam';
  return anim;
}

function breathe(p: Pose, time: number, amt = 1.4): Pose {
  const b = Math.sin(time * 3.2) * amt;
  return { ...p, hip: [p.hip[0], p.hip[1] + b], fHand: [p.fHand[0], p.fHand[1] + b * 0.6] };
}

/** 지금 상태에 맞는 자세 */
export function poseFor(f: Fighter, time: number): Pose {
  const def = f.def;
  switch (f.act) {
    case 'idle':
    case 'intro':
      return breathe(POSE.idle, time + f.side);
    case 'walk': {
      const ph = f.t * 0.2 * (def.stats.walk / 3.4) * f.walkDir;
      const s = Math.sin(ph);
      const c = Math.cos(ph);
      return {
        ...POSE.idle,
        hip: [0, -66 + Math.abs(s) * 2],
        lean: 0.1 * f.walkDir + 0.04,
        fFoot: [17 + s * 15, -Math.max(0, c) * 8],
        bFoot: [-17 - s * 15, -Math.max(0, -c) * 8],
        fHand: [24 - s * 4, 12],
      };
    }
    case 'crouch':
      return breathe(POSE.crouch, time, 0.8);
    case 'jumpsquat':
    case 'land':
      return lerpPose(POSE.idle, POSE.crouch, 0.7);
    case 'air': {
      const k = Math.max(-1, Math.min(1, f.vy / 12));
      return { ...POSE.air, lean: 0.05 - k * 0.12, fFoot: [16, -30 + k * 6] };
    }
    case 'guard':
      return f.guardLow ? POSE.cguard : POSE.guard;
    case 'blockstun': {
      const p = f.guardLow ? POSE.cguard : POSE.guard;
      return { ...p, hip: [p.hip[0] - 3, p.hip[1]] };
    }
    case 'hitstun':
      if (f.airborne) return { ...POSE.airHit, spin: -Math.min(0.9, f.juggle * 0.12) };
      return POSE.hit;
    case 'knockdown':
      return POSE.down;
    case 'getup':
      return lerpPose(POSE.down, POSE.crouch, ease(f.t / GETUP_FRAMES));
    case 'ko':
      return f.airborne ? { ...POSE.airHit, spin: -0.6 - f.t * 0.03 } : POSE.down;
    case 'win':
      return breathe(lerpPose(POSE.idle, POSE.win, ease(f.t / 16)), time);
    case 'attack': {
      const d = f.moveDef;
      if (!d) return POSE.idle;
      const pair = ATK[animFor(def, d.anim)];
      const base =
        d.id === 'cPunch' || d.id === 'cKick'
          ? POSE.crouch
          : f.airborne || d.air
            ? POSE.air
            : POSE.idle;
      const t = f.t;
      const activeEnd = d.startup + d.active;
      let pose: Pose;
      if (t <= d.startup) {
        const k = d.startup > 0 ? t / d.startup : 1;
        pose =
          k < 0.7
            ? lerpPose(base, pair[0], ease(k / 0.7))
            : lerpPose(pair[0], pair[1], ease((k - 0.7) / 0.3));
      } else if (t <= activeEnd) {
        pose = pair[1];
        // 다단히트는 연타하듯 흔든다
        if (d.hits > 2) {
          const w = Math.sin(t * 1.5) * 10;
          pose = {
            ...pose,
            fHand: [pose.fHand[0] + w, pose.fHand[1] - w * 0.6],
            bHand: [pose.bHand[0] - w, pose.bHand[1]],
          };
        }
      } else {
        pose = lerpPose(pair[1], base, ease((t - activeEnd) / Math.max(1, d.recovery)));
      }
      if (d.anim === 'upper' && f.airborne) pose = { ...pose, spin: Math.min(0.3, f.t * 0.02) };
      return pose;
    }
    default:
      return POSE.idle;
  }
}

/* =========================================================
 * 리그 계산
 * ========================================================= */

interface Rig {
  hip: V;
  neck: V;
  head: V;
  fSh: V;
  bSh: V;
  fEl: V;
  bEl: V;
  fHand: V;
  bHand: V;
  fKnee: V;
  bKnee: V;
  fFoot: V;
  bFoot: V;
  headR: number;
}

function ik(a: V, target: V, l1: number, l2: number, bend: number): [V, V] {
  const dx = target[0] - a[0];
  const dy = target[1] - a[1];
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  let end: V = target;
  if (d > max) {
    end = [a[0] + (dx / d) * max, a[1] + (dy / d) * max];
    d = max;
  }
  d = Math.max(d, Math.abs(l1 - l2) + 0.01);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = (end[0] - a[0]) / d;
  const uy = (end[1] - a[1]) / d;
  const mid: V = [a[0] + ux * along, a[1] + uy * along];
  const joint: V = [mid[0] - uy * h * bend, mid[1] + ux * h * bend];
  return [joint, end];
}

function buildRig(p: Pose, bulky: boolean): Rig {
  const T = 52;
  const TH = bulky ? 37 : 36;
  const SH = 36;
  const UA = 27;
  const FA = 27;
  const hip = p.hip;
  const sx = Math.sin(p.lean);
  const sy = -Math.cos(p.lean);
  const neck: V = [hip[0] + sx * T, hip[1] + sy * T];
  const headR = 15;
  const ha = p.lean + p.head;
  const head: V = [neck[0] + Math.sin(ha) * (headR + 4), neck[1] - Math.cos(ha) * (headR + 4)];
  const fSh: V = [neck[0] + 3, neck[1] + 4];
  const bSh: V = [neck[0] - 4, neck[1] + 5];
  const [fEl, fHand] = ik(fSh, [fSh[0] + p.fHand[0], fSh[1] + p.fHand[1]], UA, FA, 1);
  const [bEl, bHand] = ik(bSh, [bSh[0] + p.bHand[0], bSh[1] + p.bHand[1]], UA, FA, 1);
  const fHip: V = [hip[0] + 4, hip[1]];
  const bHip: V = [hip[0] - 4, hip[1]];
  const [fKnee, fFoot] = ik(fHip, p.fFoot, TH, SH, -1);
  const [bKnee, bFoot] = ik(bHip, p.bFoot, TH, SH, -1);
  return { hip, neck, head, fSh, bSh, fEl, bEl, fHand, bHand, fKnee, bKnee, fFoot, bFoot, headR };
}

/* =========================================================
 * 그리기 도우미
 * ========================================================= */

function seg(ctx: CanvasRenderingContext2D, a: V, b: V, w: number, color: string) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 4;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: V, r: number, color: string, outline = true) {
  ctx.beginPath();
  ctx.arc(p[0], p[1], r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

function poly(ctx: CanvasRenderingContext2D, pts: readonly V[], fill: string, stroke = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** 색을 어둡게 (뒤쪽 팔다리) */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

const angle = (a: V, b: V) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/* =========================================================
 * 캐릭터 한 명 그리기
 * ========================================================= */

export interface DrawState {
  time: number;
  /** 지금 기술 (무기 연출) */
  anim: AnimKey | null;
  /** 지속 프레임 진행 (0~1), 지속 중이 아니면 -1 */
  activeK: number;
  /** 채찍 · 인형 손이 닿는 거리 */
  reach: number;
  /** 하얗게 번쩍임 */
  flash: boolean;
  glow: boolean;
}

const NO_STATE: DrawState = {
  time: 0,
  anim: null,
  activeK: -1,
  reach: 0,
  flash: false,
  glow: false,
};

const WHITE: Palette = {
  skin: '#ffffff',
  hair: '#ffffff',
  top: '#ffffff',
  bottom: '#ffffff',
  accent: '#ffffff',
  trim: '#ffffff',
  eye: '#ffffff',
  shoe: '#ffffff',
};

/** 발밑 (0,0) 기준, 오른쪽을 바라보는 캐릭터를 그린다 (호출 쪽에서 좌우 반전·크기 적용) */
export function drawRig(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  pose: Pose,
  st: DrawState = NO_STATE,
) {
  const pal = st.flash ? WHITE : def.palette;
  const robot = def.body === 'robot';
  const bulky = def.body === 'bulky' || robot;
  const slim = def.body === 'slim';
  const r = buildRig(pose, bulky);
  const t = st.time;

  ctx.save();
  if (pose.spin) {
    ctx.translate(r.hip[0], r.hip[1]);
    ctx.rotate(pose.spin);
    ctx.translate(-r.hip[0], -r.hip[1]);
  }
  if (st.glow) {
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = 18;
  }

  const armW = robot ? 15 : slim ? 8.5 : bulky ? 13 : 10.5;
  const foreW = robot ? 17 : slim ? 8 : bulky ? 12 : 10;
  const thighW = robot ? 18 : slim ? 12 : 14.5;
  const shinW = robot ? 16 : slim ? 10.5 : 12.5;

  // 1) 등 장식 (몸 뒤)
  drawBack(ctx, def, r, pose, pal, t, true);

  // 2) 뒤 팔
  const backTone = st.flash ? '#ffffff' : shade(pal.top, 0.7);
  const backSkin = st.flash ? '#ffffff' : shade(pal.skin, 0.75);
  seg(ctx, r.bSh, r.bEl, armW, backTone);
  seg(ctx, r.bEl, r.bHand, foreW, robot ? shade(pal.skin, 0.75) : backSkin);
  drawHand(ctx, def, r.bHand, robot, true, pal);
  if (
    def.weapon === 'claws' ||
    def.weapon === 'catClaw' ||
    def.weapon === 'pistols' ||
    def.weapon === 'gauntlet'
  ) {
    drawWeapon(ctx, def, r.bHand, angle(r.bEl, r.bHand) + pose.weapon, pal, st, true);
  }

  // 3) 뒤 다리
  const backLeg = st.flash ? '#ffffff' : shade(pal.bottom, 0.72);
  seg(ctx, [r.hip[0] - 4, r.hip[1]], r.bKnee, thighW, backLeg);
  seg(ctx, r.bKnee, r.bFoot, shinW, backLeg);
  drawShoe(ctx, r.bFoot, st.flash ? '#ffffff' : shade(pal.shoe, 0.8), robot);

  // 4) 몸통
  drawTorso(ctx, def, r, pose, pal, slim, robot, bulky);

  // 5) 앞 다리
  seg(ctx, [r.hip[0] + 4, r.hip[1]], r.fKnee, thighW, pal.bottom);
  seg(ctx, r.fKnee, r.fFoot, shinW, pal.bottom);
  if (robot) dot(ctx, r.fKnee, 7, pal.trim);
  drawShoe(ctx, r.fFoot, pal.shoe, robot);

  // 6) 머리
  drawHead(ctx, def, r, pose, pal, t);

  // 7) 앞 팔 + 무기
  seg(ctx, r.fSh, r.fEl, armW, pal.top);
  if (robot) dot(ctx, r.fEl, 7, pal.trim);
  seg(ctx, r.fEl, r.fHand, foreW, robot ? pal.skin : pal.skin);
  drawHand(ctx, def, r.fHand, robot, false, pal);
  drawWeapon(ctx, def, r.fHand, angle(r.fEl, r.fHand) + pose.weapon, pal, st, false);

  // 8) 앞쪽 장식
  drawBack(ctx, def, r, pose, pal, t, false);
  ctx.restore();
}

function drawShoe(ctx: CanvasRenderingContext2D, p: V, color: string, robot: boolean) {
  ctx.beginPath();
  if (robot) ctx.rect(p[0] - 10, p[1] - 8, 24, 10);
  else ctx.ellipse(p[0] + 4, p[1] - 3, 10, 5.5, 0, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  p: V,
  robot: boolean,
  back: boolean,
  pal: Palette,
) {
  const big = def.weapon === 'robotFist' || def.weapon === 'gauntlet';
  const c = def.weapon === 'gauntlet' ? pal.accent : robot ? pal.trim : pal.skin;
  dot(ctx, p, big ? 9.5 : robot ? 8 : 6, back ? shade(c, 0.78) : c);
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  r: Rig,
  pose: Pose,
  pal: Palette,
  slim: boolean,
  robot: boolean,
  bulky: boolean,
) {
  const waist = robot ? 34 : slim ? 20 : bulky ? 32 : 25;
  const chest = robot ? 48 : slim ? 26 : bulky ? 42 : 34;
  const px = Math.cos(pose.lean);
  const py = Math.sin(pose.lean);
  const h = r.hip;
  const n = r.neck;
  const pts: V[] = [
    [h[0] - px * waist * 0.5, h[1] - py * waist * 0.5],
    [h[0] + px * waist * 0.5, h[1] + py * waist * 0.5],
    [n[0] + px * chest * 0.5, n[1] + py * chest * 0.5 + 4],
    [n[0] + px * chest * 0.32, n[1] + py * chest * 0.32 - 2],
    [n[0] - px * chest * 0.32, n[1] - py * chest * 0.32 - 2],
    [n[0] - px * chest * 0.5, n[1] - py * chest * 0.5 + 4],
  ];
  poly(ctx, pts, pal.top);
  // 허리띠 · 장식 줄
  const bx = lerp(h[0], n[0], 0.12);
  const by = lerp(h[1], n[1], 0.12);
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(pose.lean);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(-waist * 0.55, -3, waist * 1.1, 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-waist * 0.55, -3, waist * 1.1, 6);
  if (robot) {
    // 가슴 원자로
    ctx.beginPath();
    ctx.arc(4, -30, 8, 0, TAU);
    ctx.fillStyle = pal.accent;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.trim;
    ctx.fillRect(-18, -48, 36, 6);
  } else {
    // 옷깃
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-chest * 0.2, -46);
    ctx.lineTo(3, -30);
    ctx.lineTo(chest * 0.24, -46);
    ctx.stroke();
  }
  if (def.id === 'alchemist-z') {
    // 실험 가운 자락
    ctx.fillStyle = pal.top;
    ctx.beginPath();
    ctx.moveTo(-waist * 0.55, 0);
    ctx.lineTo(-waist * 0.9, 26);
    ctx.lineTo(waist * 0.2, 22);
    ctx.lineTo(waist * 0.55, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (slim && def.id !== 'neon-valkyrie') {
    // 짧은 치마 · 코트 자락
    ctx.fillStyle = pal.bottom;
    ctx.beginPath();
    ctx.moveTo(-waist * 0.6, 0);
    ctx.lineTo(-waist * 0.95, 16);
    ctx.lineTo(waist * 0.95, 16);
    ctx.lineTo(waist * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-waist * 0.9, 14);
    ctx.lineTo(waist * 0.9, 14);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- 머리 ---------------- */

function drawHead(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  r: Rig,
  pose: Pose,
  pal: Palette,
  t: number,
) {
  const [hx, hy] = r.head;
  const R = r.headR;
  const a = pose.lean + pose.head;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a);

  // 머리 뒤에 그리는 머리카락
  hairBack(ctx, def, R, pal, t);

  if (def.hair === 'robot') {
    ctx.beginPath();
    ctx.roundRect(-R - 2, -R - 2, R * 2 + 6, R * 2 + 2, 6);
    ctx.fillStyle = pal.skin;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(-2, -5, R + 4, 8);
    ctx.fillStyle = pal.eye;
    ctx.fillRect(2 + Math.sin(t * 2) * 2, -3.5, 10, 4.5);
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -R - 2);
    ctx.lineTo(-10, -R - 12);
    ctx.stroke();
    dot(ctx, [-10, -R - 13], 3, pal.accent);
    ctx.restore();
    return;
  }

  // 얼굴
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = pal.skin;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // 눈 (옆모습)
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(7, -2, 3.2, 4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.eye;
  ctx.beginPath();
  ctx.ellipse(7.8, -2.2, 1.8, 2.6, 0, 0, TAU);
  ctx.fill();
  // 입
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(6, 7);
  ctx.lineTo(12, 6);
  ctx.stroke();

  hairFront(ctx, def, R, pal, t);
  ctx.restore();
}

function hairBack(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  R: number,
  pal: Palette,
  t: number,
) {
  const sway = Math.sin(t * 2.4) * 3;
  switch (def.hair) {
    case 'wild':
      poly(
        ctx,
        [
          [-4, -R],
          [-R - 16, -6],
          [-R - 22, 18 + sway],
          [-R - 6, 10],
          [-R - 12, 30 + sway],
          [-2, 12],
        ],
        pal.hair,
      );
      break;
    case 'twinTails':
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(-6, -R * 0.6 + s * 2);
        ctx.rotate(0.5 + s * 0.15 + sway * 0.02);
        poly(
          ctx,
          [
            [0, 0],
            [-10, 12],
            [-14, 40],
            [-4, 50],
            [4, 20],
          ],
          pal.hair,
        );
        ctx.restore();
      }
      break;
    case 'longRose':
      poly(
        ctx,
        [
          [2, -R],
          [-R - 8, -4],
          [-R - 10, 34 + sway],
          [-6, 42 + sway],
          [-2, 10],
        ],
        pal.hair,
      );
      break;
    case 'cowboy':
      poly(
        ctx,
        [
          [-R + 2, -2],
          [-R - 12, 10],
          [-R - 10, 32 + sway],
          [-R + 2, 18],
        ],
        pal.hair,
      );
      break;
    case 'helmet':
      poly(
        ctx,
        [
          [-R + 2, -4],
          [-R - 14, 12 + sway],
          [-R - 6, 26 + sway],
          [-4, 10],
        ],
        pal.hair,
      );
      break;
    case 'hood':
      poly(
        ctx,
        [
          [-R - 4, -R + 2],
          [-R - 16, 14],
          [-R + 4, 16],
          [R, -4],
          [R - 2, -R],
        ],
        shade(pal.top, 0.85),
      );
      break;
    default:
      break;
  }
}

function hairFront(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  R: number,
  pal: Palette,
  t: number,
) {
  switch (def.hair) {
    case 'spiky': {
      poly(
        ctx,
        [
          [-R - 2, 2],
          [-R - 12, -8],
          [-R + 2, -12],
          [-R - 6, -24],
          [-4, -R - 2],
          [0, -R - 14],
          [6, -R - 2],
          [R + 2, -R - 6],
          [R + 2, -6],
          [-2, -6],
        ],
        pal.hair,
      );
      ctx.fillStyle = pal.top;
      ctx.fillRect(-R, -10, R * 2, 5);
      // 휘날리는 머리띠
      ctx.strokeStyle = pal.top;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-R, -8);
      ctx.quadraticCurveTo(-R - 14, -4 + Math.sin(t * 6) * 4, -R - 26, 2 + Math.sin(t * 6 + 1) * 6);
      ctx.stroke();
      break;
    }
    case 'hood':
      ctx.beginPath();
      ctx.arc(0, 0, R + 4, Math.PI * 0.95, Math.PI * 2.2);
      ctx.lineTo(R * 0.3, 4);
      ctx.closePath();
      ctx.fillStyle = shade(def.palette.top, 0.9);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      // 그림자 속 눈빛
      ctx.fillStyle = '#05020a';
      ctx.beginPath();
      ctx.ellipse(6, 1, 8, 8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = pal.eye;
      ctx.shadowColor = pal.eye;
      ctx.shadowBlur = 8;
      ctx.fillRect(6, -1, 6, 2.6);
      ctx.shadowBlur = 0;
      break;
    case 'mohawk':
      poly(
        ctx,
        [
          [-10, -R + 2],
          [-6, -R - 14],
          [-1, -R - 2],
          [3, -R - 16],
          [7, -R - 2],
          [11, -R - 12],
          [12, -R + 4],
        ],
        pal.hair,
      );
      ctx.fillStyle = pal.accent;
      ctx.fillRect(2, -5, 14, 5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(2, -5, 14, 5);
      break;
    case 'headphones':
      poly(
        ctx,
        [
          [-R, -2],
          [-R + 2, -R + 2],
          [4, -R - 4],
          [R, -R + 4],
          [R - 2, -6],
          [-2, -8],
        ],
        pal.hair,
      );
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -2, R + 3, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      dot(ctx, [-3, 2], 7, pal.accent);
      dot(ctx, [-3, 2], 3.5, pal.trim, false);
      ctx.fillStyle = INK;
      ctx.fillRect(3, -5, 13, 5);
      break;
    case 'wild':
      poly(
        ctx,
        [
          [-R, 0],
          [-R - 4, -12],
          [-6, -R - 6],
          [6, -R - 2],
          [R + 4, -R + 2],
          [R, -6],
          [4, -10],
          [-4, -4],
        ],
        pal.hair,
      );
      // 얼굴 가리개
      ctx.fillStyle = pal.trim;
      ctx.fillRect(2, 3, 13, 7);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(2, 3, 13, 7);
      break;
    case 'goggles':
      poly(
        ctx,
        [
          [-R - 4, 0],
          [-R - 8, -14],
          [-8, -R - 8],
          [4, -R - 10],
          [R + 6, -R - 2],
          [R, -8],
          [-4, -8],
        ],
        pal.hair,
      );
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-R, -6);
      ctx.lineTo(R, -6);
      ctx.stroke();
      dot(ctx, [8, -5], 5.5, pal.accent);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(7, -8, 2, 3);
      break;
    case 'topknot':
      poly(
        ctx,
        [
          [-R, 2],
          [-R - 2, -10],
          [-4, -R - 2],
          [8, -R - 1],
          [R + 1, -8],
          [2, -8],
        ],
        pal.hair,
      );
      dot(ctx, [-6, -R - 6], 6, pal.hair);
      ctx.fillStyle = pal.accent;
      ctx.fillRect(-R, -9, R * 2, 4);
      break;
    case 'catEars':
      poly(
        ctx,
        [
          [-R, 4],
          [-R - 2, -10],
          [-6, -R - 2],
          [8, -R],
          [R + 2, -6],
          [R - 2, 0],
          [4, -6],
          [-4, -2],
        ],
        pal.hair,
      );
      poly(
        ctx,
        [
          [-10, -R + 2],
          [-12, -R - 14],
          [-1, -R],
        ],
        pal.hair,
      );
      poly(
        ctx,
        [
          [2, -R],
          [8, -R - 14],
          [12, -R + 2],
        ],
        pal.hair,
      );
      poly(
        ctx,
        [
          [4, -R],
          [8, -R - 9],
          [10, -R + 1],
        ],
        pal.trim,
        false,
      );
      break;
    case 'twinTails':
      poly(
        ctx,
        [
          [-R, 2],
          [-R - 2, -10],
          [-4, -R - 2],
          [8, -R],
          [R + 2, -6],
          [R, -2],
          [4, -7],
          [-4, -4],
        ],
        pal.hair,
      );
      poly(
        ctx,
        [
          [-10, -R],
          [-18, -R - 8],
          [-16, -R + 4],
        ],
        pal.accent,
      );
      poly(
        ctx,
        [
          [-10, -R],
          [-2, -R - 8],
          [-4, -R + 4],
        ],
        pal.accent,
      );
      break;
    case 'helmet':
      ctx.beginPath();
      ctx.arc(0, -2, R + 3, Math.PI * 0.95, Math.PI * 2.05);
      ctx.closePath();
      ctx.fillStyle = pal.top;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = pal.accent;
      ctx.fillRect(0, -6, 16, 4);
      // 날개 장식
      poly(
        ctx,
        [
          [-6, -R],
          [-24, -R - 14],
          [-20, -R - 4],
          [-28, -R - 6],
          [-10, -R + 4],
        ],
        pal.trim,
      );
      break;
    case 'longRose':
      poly(
        ctx,
        [
          [-R, 4],
          [-R - 2, -10],
          [-4, -R - 2],
          [8, -R],
          [R + 2, -4],
          [R - 2, 2],
          [4, -6],
          [-4, -2],
        ],
        pal.hair,
      );
      dot(ctx, [-8, -R + 2], 5, pal.accent);
      dot(ctx, [-8, -R + 2], 2.5, shade(pal.accent, 0.6), false);
      break;
    case 'bob':
      poly(
        ctx,
        [
          [-R - 2, 10],
          [-R - 3, -8],
          [-6, -R - 3],
          [8, -R - 1],
          [R + 3, -6],
          [R + 2, 4],
          [10, -6],
          [2, -4],
          [-6, 10],
        ],
        pal.hair,
      );
      break;
    case 'witchHat': {
      poly(
        ctx,
        [
          [-R, 2],
          [-R - 2, -8],
          [0, -R],
          [R, -6],
          [R, 0],
          [4, -6],
        ],
        pal.hair,
      );
      ctx.fillStyle = pal.top;
      ctx.beginPath();
      ctx.ellipse(0, -R + 2, R + 12, 5, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      const tip = Math.sin(t * 2) * 4;
      poly(
        ctx,
        [
          [-R + 2, -R + 1],
          [-6 + tip, -R - 34],
          [-20 + tip, -R - 40],
          [R - 2, -R + 1],
        ],
        pal.top,
      );
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(-2, -R - 10, 2.5, 0, TAU);
      ctx.arc(5, -R - 10, 2.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = pal.trim;
      ctx.fillRect(-R + 4, -R - 3, R * 2 - 8, 3);
      break;
    }
    case 'cowboy':
      poly(
        ctx,
        [
          [-R, 2],
          [-R - 2, -8],
          [0, -R],
          [R, -6],
          [R, 0],
          [4, -6],
        ],
        pal.hair,
      );
      ctx.fillStyle = '#7a4a24';
      ctx.beginPath();
      ctx.ellipse(0, -R + 3, R + 13, 5, -0.05, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      poly(
        ctx,
        [
          [-R + 2, -R + 2],
          [-R + 4, -R - 14],
          [0, -R - 10],
          [R - 4, -R - 14],
          [R - 2, -R + 2],
        ],
        '#7a4a24',
      );
      ctx.fillStyle = pal.accent;
      ctx.fillRect(-R + 3, -R - 2, R * 2 - 6, 3);
      break;
    default:
      break;
  }
}

/* ---------------- 등 장식 ---------------- */

function drawBack(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  r: Rig,
  pose: Pose,
  pal: Palette,
  t: number,
  behind: boolean,
) {
  const n = r.neck;
  const h = r.hip;
  const sway = Math.sin(t * 3) * 4;
  if (behind) {
    switch (def.back) {
      case 'chains':
        ctx.strokeStyle = '#8a8098';
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const x = h[0] - 8 - k * 5 - i * 4;
            const y = h[1] + 4 + k * 4 + Math.sin(t * 3 + k + i) * 2;
            ctx.moveTo(x + 3, y);
            ctx.arc(x, y, 3, 0, TAU);
          }
          ctx.stroke();
        }
        break;
      case 'speakers':
        for (const dy of [0, 18]) {
          ctx.save();
          ctx.translate(n[0] - 22, n[1] + 8 + dy);
          ctx.fillStyle = '#1a1424';
          ctx.fillRect(-10, -9, 20, 18);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2;
          ctx.strokeRect(-10, -9, 20, 18);
          const pulse = 4 + Math.abs(Math.sin(t * 8 + dy)) * 2.5;
          dot(ctx, [0, 0], pulse, pal.accent, false);
          dot(ctx, [0, 0], 2, pal.trim, false);
          ctx.restore();
        }
        break;
      case 'tatteredCape':
      case 'ghostCape': {
        const c = def.back === 'ghostCape' ? shade(pal.top, 0.8) : pal.accent;
        ctx.globalAlpha = def.back === 'ghostCape' ? 0.85 : 1;
        poly(
          ctx,
          [
            [n[0] - 6, n[1] + 2],
            [n[0] + 6, n[1] + 2],
            [h[0] - 14, h[1] + 30 + sway],
            [h[0] - 22, h[1] + 20 + sway],
            [h[0] - 30, h[1] + 36 + sway],
            [h[0] - 40, h[1] + 18 + sway],
            [h[0] - 44, h[1] + 30 + sway],
          ],
          c,
        );
        ctx.globalAlpha = 1;
        if (def.back === 'ghostCape') {
          for (let i = 0; i < 2; i++) {
            const gx = h[0] - 46 - i * 14 + Math.sin(t * 2 + i) * 6;
            const gy = h[1] - 20 - i * 16 + Math.cos(t * 2.4 + i) * 6;
            ctx.globalAlpha = 0.6;
            dot(ctx, [gx, gy], 7, pal.accent, false);
            ctx.fillStyle = INK;
            ctx.fillRect(gx - 3, gy - 2, 2, 2);
            ctx.fillRect(gx + 1, gy - 2, 2, 2);
            ctx.globalAlpha = 1;
          }
        }
        break;
      }
      case 'tank': {
        ctx.save();
        ctx.translate(n[0] - 20, n[1] + 16);
        ctx.rotate(pose.lean);
        ctx.beginPath();
        ctx.roundRect(-10, -16, 20, 40, 8);
        ctx.fillStyle = '#5a4a3a';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(-6, -8 + Math.sin(t * 4) * 2, 12, 26, 5);
        ctx.fillStyle = pal.accent;
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#3a3428';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(n[0] - 20, n[1] + 2);
        ctx.quadraticCurveTo(n[0] - 6, n[1] - 12, r.fHand[0], r.fHand[1]);
        ctx.stroke();
        break;
      }
      case 'tail': {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(h[0] - 6, h[1]);
          ctx.bezierCurveTo(
            h[0] - 40,
            h[1] + 10,
            h[0] - 46 + sway * 2,
            h[1] - 40,
            h[0] - 30 + sway * 3,
            h[1] - 54,
          );
        };
        path();
        ctx.stroke();
        ctx.strokeStyle = pal.hair;
        ctx.lineWidth = 6;
        path();
        ctx.stroke();
        break;
      }
      case 'wings': {
        ctx.save();
        ctx.translate(n[0] - 6, n[1] + 6);
        const flap = Math.sin(t * 3) * 0.12;
        for (const k of [1, 0.7]) {
          ctx.save();
          ctx.rotate(-0.4 - flap * k);
          ctx.globalAlpha = 0.55 + k * 0.3;
          ctx.shadowColor = pal.accent;
          ctx.shadowBlur = 12;
          for (let i = 0; i < 4; i++) {
            poly(
              ctx,
              [
                [0, 0],
                [-34 - i * 12, -44 + i * 14],
                [-26 - i * 12, -30 + i * 16],
              ],
              i % 2 ? pal.accent : pal.top,
              false,
            );
          }
          ctx.shadowBlur = 0;
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        break;
      }
      case 'thorns':
        ctx.strokeStyle = def.palette.trim;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(n[0] - 10, n[1] + 4);
        ctx.bezierCurveTo(n[0] - 34, n[1] - 10, n[0] - 30, h[1] - 10, h[0] - 20, h[1] + 10);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const k = 0.25 + i * 0.25;
          dot(ctx, [lerp(n[0] - 26, h[0] - 20, k), lerp(n[1], h[1], k)], 4.5, pal.accent);
        }
        break;
      case 'scarf': {
        const wave = (k: number) => Math.sin(t * 6 - k * 3) * 6 * k;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(n[0] - 2, n[1] + 2);
          ctx.quadraticCurveTo(n[0] - 26, n[1] + wave(0.5), n[0] - 52, n[1] + 8 + wave(1));
        };
        path();
        ctx.stroke();
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 6;
        path();
        ctx.stroke();
        break;
      }
      default:
        break;
    }
    return;
  }
  // 몸 앞쪽에 겹치는 장식
  if (def.back === 'poncho') {
    const px = Math.cos(pose.lean);
    const py = Math.sin(pose.lean);
    poly(
      ctx,
      [
        [n[0] - px * 20, n[1] - py * 20 + 4],
        [n[0] + px * 20, n[1] + py * 20 + 4],
        [lerp(n[0], h[0], 0.55) + px * 18, lerp(n[1], h[1], 0.55) + 4],
        [lerp(n[0], h[0], 0.62), lerp(n[1], h[1], 0.62) + 8],
        [lerp(n[0], h[0], 0.55) - px * 18, lerp(n[1], h[1], 0.55) + 4],
      ],
      pal.accent,
    );
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(n[0] - px * 14, n[1] + 12);
    ctx.lineTo(n[0] + px * 14, n[1] + 12);
    ctx.stroke();
  }
  if (def.back === 'scarf') {
    dot(ctx, [n[0] + 2, n[1] + 2], 7, pal.accent);
  }
}

/* ---------------- 무기 ---------------- */

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  hand: V,
  ang: number,
  pal: Palette,
  st: DrawState,
  back: boolean,
) {
  const t = st.time;
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(ang);
  if (back) ctx.globalAlpha = 0.85;
  switch (def.weapon) {
    case 'greatsword': {
      poly(
        ctx,
        [
          [-10, -4],
          [-10, 4],
          [6, 4],
          [6, -4],
        ],
        '#3a2a20',
      );
      poly(
        ctx,
        [
          [6, -12],
          [6, 12],
          [12, 12],
          [12, -12],
        ],
        pal.accent,
      );
      ctx.shadowColor = def.glow;
      ctx.shadowBlur = 10;
      poly(
        ctx,
        [
          [12, -8],
          [104, -6],
          [118, 0],
          [104, 6],
          [12, 8],
        ],
        '#c8ccd8',
      );
      ctx.shadowBlur = 0;
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.6 + Math.sin(t * 12) * 0.2;
      ctx.beginPath();
      ctx.moveTo(14, -8);
      for (let i = 0; i <= 8; i++) ctx.lineTo(14 + i * 12, -8 - 6 - Math.sin(t * 14 + i) * 5);
      ctx.lineTo(110, -6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'scythe': {
      seg(ctx, [-40, 0], [96, 0], 4, '#2a2030');
      ctx.shadowColor = def.glow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(92, -2);
      ctx.quadraticCurveTo(70, -58, 18, -52);
      ctx.quadraticCurveTo(64, -40, 98, 4);
      ctx.closePath();
      ctx.fillStyle = '#d8d0e8';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'gauntlet': {
      ctx.shadowColor = def.glow;
      ctx.shadowBlur = 14;
      dot(ctx, [2, 0], 11, pal.accent);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = t * 9 + i * 2.1;
        ctx.moveTo(2 + Math.cos(a) * 10, Math.sin(a) * 10);
        ctx.lineTo(2 + Math.cos(a) * 18, Math.sin(a + 0.4) * 18);
      }
      ctx.stroke();
      break;
    }
    case 'robotFist':
      ctx.beginPath();
      ctx.roundRect(-4, -12, 24, 24, 5);
      ctx.fillStyle = pal.trim;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = pal.accent;
      ctx.fillRect(14, -10, 4, 20);
      break;
    case 'claws':
    case 'catClaw': {
      const len = def.weapon === 'claws' ? 34 : 18;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      for (const dy of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(4, dy);
        ctx.quadraticCurveTo(len * 0.6, dy - 4, len, dy - 2);
        ctx.stroke();
      }
      ctx.strokeStyle = def.weapon === 'claws' ? '#e8e8f0' : pal.accent;
      ctx.lineWidth = 2.2;
      for (const dy of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(4, dy);
        ctx.quadraticCurveTo(len * 0.6, dy - 4, len, dy - 2);
        ctx.stroke();
      }
      break;
    }
    case 'flask': {
      ctx.rotate(-ang - 0.3);
      ctx.beginPath();
      ctx.moveTo(-3, -14);
      ctx.lineTo(3, -14);
      ctx.lineTo(3, -8);
      ctx.lineTo(9, 2);
      ctx.lineTo(-9, 2);
      ctx.lineTo(-3, -8);
      ctx.closePath();
      ctx.fillStyle = 'rgba(200,255,200,0.4)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = pal.accent;
      ctx.shadowColor = pal.accent;
      ctx.shadowBlur = 10;
      ctx.fillRect(-7, -4, 14, 5);
      ctx.shadowBlur = 0;
      break;
    }
    case 'katana':
      poly(
        ctx,
        [
          [-8, -3],
          [-8, 3],
          [6, 3],
          [6, -3],
        ],
        '#1a2a40',
      );
      dot(ctx, [7, 0], 4.5, '#c8a040');
      ctx.shadowColor = def.glow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(10, -2.5);
      ctx.quadraticCurveTo(56, -8, 96, -8);
      ctx.quadraticCurveTo(58, 2, 10, 2.5);
      ctx.closePath();
      ctx.fillStyle = '#e8f6ff';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    case 'strings': {
      ctx.rotate(-ang);
      ctx.strokeStyle = 'rgba(255,220,235,0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 3, 0);
        ctx.lineTo(-30 + i * 6, -90 + Math.sin(t * 3 + i) * 4);
        ctx.stroke();
      }
      break;
    }
    case 'lance': {
      seg(ctx, [-30, 0], [70, 0], 4, pal.trim);
      ctx.shadowColor = pal.accent;
      ctx.shadowBlur = 14;
      poly(
        ctx,
        [
          [70, -7],
          [104, 0],
          [70, 7],
        ],
        pal.accent,
        false,
      );
      ctx.shadowBlur = 0;
      break;
    }
    case 'whip': {
      const active =
        st.activeK >= 0 && (st.anim === 'beam' || st.anim === 'kick' || st.anim === 'cKick');
      const len = active ? Math.max(60, st.reach) : 46;
      ctx.rotate(-ang);
      const dirA = active ? ang * 0.2 : ang;
      const ex = Math.cos(dirA) * len;
      const ey = active ? Math.sin(dirA) * len * 0.3 : 34 + Math.sin(t * 3) * 4;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(ex * 0.5, active ? -20 : 22, ex, ey);
      ctx.stroke();
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(ex * 0.5, active ? -20 : 22, ex, ey);
      ctx.stroke();
      // 가시
      ctx.fillStyle = pal.trim;
      for (let i = 1; i < 6; i++) {
        const k = i / 6;
        const qx = 2 * (1 - k) * k * ex * 0.5 + k * k * ex;
        const qy = 2 * (1 - k) * k * (active ? -20 : 22) + k * k * ey;
        ctx.fillRect(qx - 1.5, qy - 3, 3, 3);
      }
      break;
    }
    case 'chainsaw': {
      ctx.beginPath();
      ctx.roundRect(-8, -10, 26, 20, 4);
      ctx.fillStyle = pal.accent;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(16, -6, 64, 12, 6);
      ctx.fillStyle = '#c8ccd8';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      const off = (t * 120) % 8;
      for (let x = 18; x < 78; x += 8) {
        ctx.fillRect(x + off - 4, -8, 3, 3);
        ctx.fillRect(x - off + 4, 5, 3, 3);
      }
      break;
    }
    case 'staff': {
      seg(ctx, [-34, 0], [52, 0], 3.5, '#4a3a6a');
      ctx.shadowColor = pal.accent;
      ctx.shadowBlur = 14;
      dot(ctx, [58, 0], 7 + Math.sin(t * 5), pal.accent);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(58, 0, 11, -1.2, 1.2);
      ctx.stroke();
      break;
    }
    case 'pistols':
      ctx.beginPath();
      ctx.moveTo(-2, -5);
      ctx.lineTo(24, -5);
      ctx.lineTo(24, 1);
      ctx.lineTo(6, 1);
      ctx.lineTo(4, 9);
      ctx.lineTo(-3, 9);
      ctx.closePath();
      ctx.fillStyle = '#3a3a44';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = pal.accent;
      ctx.fillRect(2, -4, 6, 3);
      break;
    default:
      break;
  }
  ctx.restore();
}

/* ---------------- 인형 (마리오네트 리리스) ---------------- */

function drawPuppet(ctx: CanvasRenderingContext2D, def: CharacterDef, f: Fighter, time: number) {
  const d = f.moveDef;
  const s = 1.12;
  let px = -46;
  let py = -16 + Math.sin(time * 2.2) * 5;
  let pose: Pose = {
    ...POSE.idle,
    lean: 0.15,
    fHand: [20, 26],
    bHand: [10, 30],
    fFoot: [8, 10],
    bFoot: [-8, 12],
  };
  // 공격할 때는 인형이 앞으로 뛰쳐나간다
  if (f.act === 'attack' && d && d.box && f.move !== 'punch') {
    const total = d.startup + d.active + d.recovery;
    const k =
      f.t <= d.startup
        ? f.t / Math.max(1, d.startup)
        : f.t <= d.startup + d.active
          ? 1
          : 1 - (f.t - d.startup - d.active) / Math.max(1, d.recovery);
    const tx = d.box.x - 80;
    const ty = -d.box.y + 100;
    px = lerp(px, tx, ease(k));
    py = lerp(py, ty, ease(k));
    pose = lerpPose(pose, { ...ATK.punch[1], fHand: [70, -6], lean: 0.4 }, ease(k));
    if (total > 0 && f.isActive()) pose = { ...pose, fHand: [70 + Math.sin(f.t * 1.4) * 10, -6] };
  }
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.95;
  drawRig(ctx, puppetLook(def), pose, { ...NO_STATE, time });
  ctx.restore();
  // 조종 실
  ctx.strokeStyle = 'rgba(255,200,220,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px - 4, py - 118 * s);
  ctx.lineTo(18, -120);
  ctx.moveTo(px + 18, py - 70 * s);
  ctx.lineTo(24, -96);
  ctx.stroke();
}

let puppetCache: CharacterDef | null = null;
function puppetLook(owner: CharacterDef): CharacterDef {
  if (puppetCache) return puppetCache;
  puppetCache = {
    ...owner,
    id: 'puppet-lilith',
    body: 'bulky',
    hair: 'bob',
    weapon: 'claws',
    back: 'none',
    palette: {
      skin: '#e8d8c8',
      hair: '#3a2030',
      top: '#6a1a3a',
      bottom: '#3a1028',
      accent: '#ff4a7a',
      trim: '#f2e0c0',
      eye: '#ff2a5a',
      shoe: '#2a1020',
    },
  };
  return puppetCache;
}

/* =========================================================
 * 화면에 캐릭터 그리기
 * ========================================================= */

/** 월드 좌표의 Fighter 를 그린다 (카메라 변환은 호출 쪽에서) */
export function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  time: number,
  afterimage = true,
) {
  const def = f.def;
  const s = def.scale;
  const gy = GROUND_Y - f.h;
  const d = f.moveDef;
  const active = f.isActive() && d ? (f.t - d.startup) / Math.max(1, d.active) : -1;
  const st: DrawState = {
    time,
    anim: d ? animFor(def, d.anim) : null,
    activeK: active,
    reach: d && d.box ? (d.box.x + d.box.w / 2) / s : 0,
    flash: f.flash > 0 && f.flash % 2 === 0,
    glow: !!d && (d.superLevel > 0 || d.id === 'burst'),
  };
  const pose = poseFor(f, time);

  // 돌진 잔상
  if (afterimage && d && d.selfVx > 0 && f.isActive()) {
    for (let i = 2; i >= 1; i--) {
      ctx.save();
      ctx.globalAlpha = 0.18 * (3 - i);
      ctx.translate(f.x - f.facing * d.selfVx * i * 2.4, gy);
      ctx.scale(f.facing * s, s);
      drawRig(ctx, def, pose, { ...st, flash: false, glow: false });
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(f.x, gy);
  ctx.scale(f.facing * s, s);
  if (def.back === 'puppet') drawPuppet(ctx, def, f, time);
  drawRig(ctx, def, pose, st);
  ctx.restore();
}

/** 땅 그림자 */
export function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter) {
  const k = Math.max(0.3, 1 - f.h / 300);
  ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`;
  ctx.beginPath();
  ctx.ellipse(f.x, GROUND_Y + 2, 34 * f.def.scale * k, 7 * k, 0, 0, TAU);
  ctx.fill();
}

/** 캐릭터 선택 · 컷인용 — 정해진 자세로 그린다 */
export function drawPortrait(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  x: number,
  y: number,
  scale: number,
  time: number,
  kind: 'idle' | 'super' | 'win' = 'idle',
) {
  const pose =
    kind === 'super'
      ? POSE.superPose
      : kind === 'win'
        ? breathe(POSE.win, time)
        : breathe(POSE.idle, time);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * def.scale, scale * def.scale);
  if (def.back === 'puppet') {
    ctx.save();
    ctx.translate(-46, -16 + Math.sin(time * 2.2) * 5);
    ctx.scale(1.12, 1.12);
    drawRig(
      ctx,
      puppetLook(def),
      {
        ...POSE.idle,
        lean: 0.15,
        fHand: [20, 26],
        bHand: [10, 30],
        fFoot: [8, 10],
        bFoot: [-8, 12],
      },
      { ...NO_STATE, time },
    );
    ctx.restore();
  }
  drawRig(ctx, def, pose, { ...NO_STATE, time, glow: kind === 'super' });
  ctx.restore();
}
