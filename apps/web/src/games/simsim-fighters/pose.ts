/**
 * 심심파이터즈 — 캐릭터 자세 (관절 리그용)
 * 기술마다 [준비 자세, 타격 자세] 두 장을 두고 발생 → 지속 → 후딜 프레임에 맞춰 보간한다.
 * 그리기 전용이라 판정에는 영향을 주지 않는다.
 */
import { BACKDASH_FRAMES, DASH_FRAMES, GETUP_FRAMES, JUMP_SQUAT } from './config';
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
  // 던지기 — 팔을 머리 뒤로 젖혔다가 앞으로 뿌린다
  throw: [
    P({
      hip: [-6, -66],
      lean: -0.22,
      head: 0.05,
      fHand: [-24, -34],
      bHand: [22, 2],
      fFoot: [26, 0],
      bFoot: [-24, 0],
    }),
    P({
      hip: [8, -62],
      lean: 0.32,
      fHand: [52, -8],
      bHand: [-18, 16],
      fFoot: [30, 0],
      bFoot: [-28, -3],
    }),
  ],
  // 회전 — 팔을 크게 벌리고 제자리에서 돈다 (지속 중 좌우로 휘돈다)
  spin: [
    P({ hip: [0, -60], lean: 0.25, fHand: [8, 14], bHand: [-6, 14] }),
    P({
      hip: [0, -58],
      lean: 0.12,
      head: -0.05,
      fHand: [46, -6],
      bHand: [-38, -6],
      fFoot: [30, 0],
      bFoot: [-30, 0],
    }),
  ],
  // 받아치기 — 낮게 자세를 잡고 칼끝을 앞으로
  parry: [
    P({ hip: [-4, -58], lean: 0.18, fHand: [18, 8], bHand: [12, 10], fFoot: [26, 0] }),
    P({
      hip: [-6, -54],
      lean: 0.24,
      head: 0.12,
      fHand: [26, 2],
      bHand: [16, 6],
      fFoot: [30, 0],
      bFoot: [-30, 0],
      weapon: -0.5,
    }),
  ],
  // 공중제비 차기 — 몸을 뒤로 젖히며 발끝을 머리 위로
  flip: [
    P({
      hip: [0, -48],
      lean: 0.3,
      fHand: [14, 20],
      bHand: [6, 20],
      fFoot: [22, 0],
      bFoot: [-20, 0],
    }),
    P({
      hip: [0, -80],
      lean: -0.9,
      head: -0.35,
      fHand: [-22, 12],
      bHand: [-30, 6],
      fFoot: [44, -112],
      bFoot: [-6, -34],
      spin: -0.5,
    }),
  ],
  // 조준 사격 — 팔을 곧게 뻗고 반동으로 살짝 젖힌다
  shoot: [
    P({ hip: [-2, -66], lean: 0, fHand: [34, -16], bHand: [28, -12] }),
    P({
      hip: [-4, -66],
      lean: -0.06,
      head: -0.04,
      fHand: [54, -14],
      bHand: [46, -10],
      fFoot: [22, 0],
      bFoot: [-26, 0],
    }),
  ],
  // 짓밟기 — 무릎을 높이 들었다가 내리찍는다
  stomp: [
    P({ hip: [0, -74], lean: -0.06, fFoot: [24, -46], fHand: [22, -16], bHand: [-10, -10] }),
    P({
      hip: [6, -56],
      lean: 0.28,
      fFoot: [40, 0],
      bFoot: [-26, 0],
      fHand: [30, 12],
      bHand: [-22, 8],
    }),
  ],
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
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
export const ease = (k: number) => 1 - (1 - clamp01(k)) ** 2;
/** 부드럽게 시작해 부드럽게 멈춘다 */
export const smooth = (k: number) => {
  const x = clamp01(k);
  return x * x * (3 - 2 * x);
};
/** 빠르게 뻗었다가 살짝 지나쳐서 돌아온다 (타격 순간의 탄력) */
export const snapBack = (k: number, over = 1.25) => {
  const x = clamp01(k) - 1;
  return 1 + (over + 1) * x * x * x + over * x * x;
};
/** 빠르게 뻗는다 (끝에서 급정거) */
export const snap = (k: number) => 1 - (1 - clamp01(k)) ** 3;

/** 캐릭터마다 같은 버튼이라도 동작을 다르게 (큰 무기는 주먹 대신 베기) */
export function animFor(def: CharacterDef, anim: AnimKey): AnimKey {
  if (anim === 'punch' && BLADES.includes(def.weapon)) return 'slash';
  if (anim === 'punch' && def.weapon === 'whip') return 'beam';
  return anim;
}

export function breathe(p: Pose, time: number, amt = 1.4): Pose {
  // 숨쉬기 — 골반이 먼저, 손은 살짝 늦게 따라온다 (겹침 동작)
  const b = Math.sin(time * 3.2) * amt;
  const lag = Math.sin(time * 3.2 - 0.7) * amt;
  return {
    ...p,
    hip: [p.hip[0], p.hip[1] + b],
    lean: p.lean + Math.sin(time * 3.2 - 0.3) * 0.012,
    fHand: [p.fHand[0], p.fHand[1] + lag * 0.7],
    bHand: [p.bHand[0], p.bHand[1] + lag * 0.5],
  };
}

/** 격투 자세 — 무릎을 굽혔다 폈다 하며 리듬을 타고, 손은 반 박자 늦게 흔들린다 */
function stance(time: number, side: number, quick: number): Pose {
  const w = time * (4.4 + quick * 0.8) + side * 1.7;
  const bob = (1 - Math.cos(w)) * 1.6;
  const lag = (1 - Math.cos(w - 0.8)) * 1.4;
  return {
    ...BASE,
    hip: [Math.sin(w * 0.5) * 0.8, BASE.hip[1] + bob],
    lean: BASE.lean + Math.sin(w - 0.4) * 0.018,
    head: Math.sin(w - 1.1) * 0.025,
    fHand: [BASE.fHand[0] + Math.sin(w * 0.5 + 0.6) * 1.2, BASE.fHand[1] + lag * 0.9],
    bHand: [BASE.bHand[0] - Math.sin(w * 0.5) * 1, BASE.bHand[1] + lag * 0.7],
  };
}

const DASH_FWD = P({
  hip: [8, -56],
  lean: 0.52,
  head: -0.3,
  fHand: [12, 14],
  bHand: [-22, 18],
  fFoot: [34, -6],
  bFoot: [-40, -4],
});
const DASH_BACK = P({
  hip: [-4, -70],
  lean: -0.2,
  head: 0.16,
  fHand: [20, -10],
  bHand: [14, -4],
  fFoot: [18, -10],
  bFoot: [-14, -16],
});

/** 지금 상태에 맞는 자세 */
export function poseFor(f: Fighter, time: number): Pose {
  const def = f.def;
  switch (f.act) {
    case 'idle':
      return stance(time, f.side, def.stats.speed < 0 ? 1 : 0);
    case 'intro':
      return breathe(POSE.idle, time + f.side);
    case 'walk': {
      // 걷기 — 뻗는 발이 들리고(무릎이 앞으로), 골반은 한 걸음마다 오르내리고, 팔은 다리와 반대로 흔든다
      const dir = f.walkDir;
      const ph = f.t * 0.24 * (def.stats.walk / 3.4) * dir;
      const s = Math.sin(ph);
      const c = Math.cos(ph);
      const stride = dir > 0 ? 16 : 12;
      return {
        ...POSE.idle,
        hip: [s * 1.5 * dir, -65 + Math.abs(s) * 2.6],
        lean: (dir > 0 ? 0.17 : 0.02) + Math.abs(c) * 0.025,
        head: dir > 0 ? -0.06 : 0.04,
        fFoot: [19 + s * stride, -Math.max(0, c) * 11],
        bFoot: [-19 - s * stride, -Math.max(0, -c) * 11],
        fHand: [23 - s * 5, -2 + Math.abs(c) * 2],
        bHand: [16 + s * 6, 2 + Math.abs(c) * 2],
      };
    }
    case 'dash': {
      const fwd = f.walkDir > 0;
      const k = f.t / (fwd ? DASH_FRAMES : BACKDASH_FRAMES);
      if (fwd) {
        // 앞 대시 — 몸을 낮게 숙이고 큰 보폭으로 달린다
        const ph = f.t * 0.95;
        const s = Math.sin(ph);
        const c = Math.cos(ph);
        const run: Pose = {
          ...DASH_FWD,
          hip: [DASH_FWD.hip[0], DASH_FWD.hip[1] + Math.abs(s) * 3],
          fFoot: [12 + s * 26, -Math.max(0, c) * 18],
          bFoot: [-14 - s * 26, -Math.max(0, -c) * 18],
          fHand: [12 - s * 10, 14],
          bHand: [-20 + s * 10, 18],
        };
        const enter = smooth(k / 0.2);
        const exit = smooth((k - 0.72) / 0.28);
        return lerpPose(lerpPose(POSE.idle, run, enter), POSE.idle, exit);
      }
      // 백대시 — 뒤로 살짝 뛰었다가 착지
      const arc = Math.sin(Math.min(1, k / 0.8) * Math.PI);
      const hop: Pose = {
        ...DASH_BACK,
        hip: [DASH_BACK.hip[0], -64 - arc * 12],
        fFoot: [18, -arc * 16],
        bFoot: [-14, -arc * 22],
      };
      return lerpPose(
        lerpPose(POSE.idle, hop, smooth(k / 0.15)),
        POSE.idle,
        smooth((k - 0.8) / 0.2),
      );
    }
    case 'crouch':
      return breathe(POSE.crouch, time, 0.8);
    case 'jumpsquat':
      // 도약 직전 — 깊게 웅크린다
      return lerpPose(POSE.idle, { ...POSE.crouch, lean: 0.2 }, snap(f.t / JUMP_SQUAT) * 0.85);
    case 'land': {
      // 착지 — 충격을 무릎으로 받고 일어선다
      const k = f.t / Math.max(1, f.landLag);
      return lerpPose({ ...POSE.crouch, lean: 0.24 }, POSE.idle, smooth(k) * 0.9);
    }
    case 'air': {
      // 오를 땐 몸을 펴고, 정점에선 무릎을 끌어올리고, 떨어질 땐 다리를 내린다
      const k = Math.max(-1, Math.min(1, f.vy / 12));
      const tuck = 1 - Math.abs(k);
      return {
        ...POSE.air,
        hip: [0, -72 + tuck * 3],
        lean: 0.05 - k * 0.12 + tuck * 0.12,
        head: -k * 0.08,
        fHand: [22 - tuck * 4, 2 - k * 8],
        bHand: [14 - tuck * 2, 8 - k * 10],
        fFoot: [16 + tuck * 6, -30 + k * 6 - tuck * 12],
        bFoot: [-12 + tuck * 6, -22 + k * 10 - tuck * 14],
      };
    }
    case 'guard': {
      // 가드 — 2~3프레임 만에 팔을 바짝 붙이고 몸을 움츠린다
      const p = f.guardLow ? POSE.cguard : POSE.guard;
      const start = f.guardLow ? POSE.crouch : POSE.idle;
      return breathe(lerpPose(start, p, snap(f.t / 3)), time, 0.5);
    }
    case 'blockstun': {
      // 막은 충격 — 처음 몇 프레임 뒤로 밀렸다가 원래 가드 자세로
      const p = f.guardLow ? POSE.cguard : POSE.guard;
      const kick = Math.max(0, 1 - f.t / 6);
      return {
        ...p,
        hip: [p.hip[0] - 3 - kick * 5, p.hip[1] + kick * 2],
        lean: p.lean - kick * 0.12,
        head: p.head + kick * 0.1,
        fHand: [p.fHand[0] - kick * 3, p.fHand[1] + kick * 2],
      };
    }
    case 'hitstun': {
      if (f.airborne) return { ...POSE.airHit, spin: -Math.min(0.9, f.juggle * 0.12) };
      // 맞은 순간 크게 젖혔다가 버티며 돌아온다
      const recoil = Math.max(0, 1 - f.t / 8);
      const deep: Pose = {
        ...POSE.hit,
        hip: [POSE.hit.hip[0] - 4, POSE.hit.hip[1] + 2],
        lean: POSE.hit.lean - 0.1,
        head: POSE.hit.head - 0.18,
      };
      const settle = smooth((f.t - 6) / Math.max(8, f.stun + 4)) * 0.45;
      return lerpPose(lerpPose(POSE.hit, deep, recoil * recoil), POSE.idle, settle);
    }
    case 'knockdown': {
      // 바닥에 떨어지며 한 번 튀어 오른다
      const bounce = f.t < 10 ? Math.sin((f.t / 10) * Math.PI) * 8 * (1 - f.t / 14) : 0;
      return { ...POSE.down, hip: [POSE.down.hip[0], POSE.down.hip[1] - bounce] };
    }
    case 'getup': {
      const k = f.t / GETUP_FRAMES;
      if (k < 0.6) return lerpPose(POSE.down, POSE.crouch, smooth(k / 0.6));
      return lerpPose(POSE.crouch, POSE.idle, smooth((k - 0.6) / 0.4));
    }
    case 'ko':
      return f.airborne ? { ...POSE.airHit, spin: -0.6 - f.t * 0.03 } : POSE.down;
    case 'win':
      return breathe(lerpPose(POSE.idle, POSE.win, snapBack(f.t / 16, 0.8)), time);
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
        // 준비 동작(힘 모으기) → 탄력 있게 뻗기
        const k = d.startup > 0 ? t / d.startup : 1;
        const wind = d.startup >= 6 ? 0.55 : 0.4;
        pose =
          k < wind
            ? lerpPose(base, pair[0], smooth(k / wind))
            : lerpPose(pair[0], pair[1], snapBack((k - wind) / (1 - wind), 0.9));
      } else if (t <= activeEnd) {
        // 타격 — 뻗은 자세에서 몸이 조금 더 따라 들어간다 (팔로 스루)
        const k = (t - d.startup) / Math.max(1, d.active);
        pose = { ...pair[1], lean: pair[1].lean + Math.sin(k * Math.PI) * 0.05 };
        if (d.anim === 'spin') {
          // 몸이 도는 것처럼 앞팔 · 뒷팔이 번갈아 앞으로 나온다
          const c = Math.cos(t * 0.9);
          pose = {
            ...pose,
            fHand: [42 * c, -6 + Math.sin(t * 0.9) * 4],
            bHand: [-38 * c, -6],
            lean: 0.04 * c,
          };
        } else if (d.hits > 2) {
          // 다단히트는 연타하듯 흔든다
          const w = Math.sin(t * 1.5) * 10;
          pose = {
            ...pose,
            fHand: [pose.fHand[0] + w, pose.fHand[1] - w * 0.6],
            bHand: [pose.bHand[0] - w, pose.bHand[1]],
          };
        }
      } else {
        // 회수 — 잠깐 버텼다가 부드럽게 자세로 돌아온다
        const k = (t - activeEnd) / Math.max(1, d.recovery);
        pose = lerpPose(pair[1], base, smooth((k - 0.12) / 0.88));
      }
      if (d.anim === 'upper' && f.airborne) pose = { ...pose, spin: Math.min(0.3, f.t * 0.02) };
      // 공중제비 — 떠 있는 동안 한 바퀴 뒤로 돈다
      if (d.anim === 'flip' && f.airborne) {
        const turn = Math.min(1, Math.max(0, (t - d.startup) / 22));
        pose = { ...pose, spin: -smooth(turn) * Math.PI * 2 };
      } else if (d.anim === 'flip') {
        pose = { ...pose, spin: 0 };
      }
      return pose;
    }
    default:
      return POSE.idle;
  }
}
