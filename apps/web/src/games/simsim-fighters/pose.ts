/**
 * 심심파이터즈 — 캐릭터 자세 (관절 리그용)
 * 기술마다 [준비 자세, 타격 자세] 두 장을 두고 발생 → 지속 → 후딜 프레임에 맞춰 보간한다.
 * 그리기 전용이라 판정에는 영향을 주지 않는다.
 */
import { GETUP_FRAMES } from './config';
import type { AnimKey, CharacterDef, WeaponKind } from './characters';
import type { Fighter } from './fighter';

export type V = [number, number];

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

const BASE: Pose = {
  hip: [0, -66],
  lean: 0.1,
  head: 0,
  fHand: [24, -2],
  bHand: [17, 2],
  fFoot: [21, 0],
  bFoot: [-21, 0],
  weapon: 0,
  spin: 0,
};
export const P = (o: Partial<Pose>): Pose => ({ ...BASE, ...o });

export const POSE = {
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
export const ATK: Record<AnimKey, [Pose, Pose]> = {
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

export function lerp(a: number, b: number, k: number) {
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
export const ease = (k: number) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 2;

/** 캐릭터마다 같은 버튼이라도 동작을 다르게 (큰 무기는 주먹 대신 베기) */
export function animFor(def: CharacterDef, anim: AnimKey): AnimKey {
  if (anim === 'punch' && BLADES.includes(def.weapon)) return 'slash';
  if (anim === 'punch' && def.weapon === 'whip') return 'beam';
  return anim;
}

export function breathe(p: Pose, time: number, amt = 1.4): Pose {
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
        lean: 0.1 * f.walkDir + 0.06,
        fFoot: [19 + s * 15, -Math.max(0, c) * 8],
        bFoot: [-19 - s * 15, -Math.max(0, -c) * 8],
        fHand: [24 - s * 4, -2 + s * 2],
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
