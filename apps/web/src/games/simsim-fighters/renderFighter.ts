/**
 * 심심파이터즈 — 캐릭터 그리기 (이미지 파일 없이 Canvas 로 직접 그린다)
 *
 * 관절 리그: 골반 · 몸통 기울기 · 손/발 목표 위치를 정하면 2관절 IK 로 팔꿈치 · 무릎을 계산한다.
 * 그 위에 셀 셰이딩 근육 팔다리, 캐릭터별 의상 · 얼굴 표정 · 머리카락 · 무기 · 등 장식을 얹는다.
 * 그리기 전용 — 판정 · 시뮬레이션에는 전혀 영향을 주지 않는다.
 */
import { GROUND_Y } from './config';
import type { AnimKey, CharId, CharacterDef, Palette } from './characters';
import type { Fighter } from './fighter';
import { LOOKS, type Look } from './looks';
import {
  INK,
  TAU,
  backTone,
  circle,
  fillStroke,
  hgrad,
  limb,
  line,
  poly,
  smoothPath,
  steel,
  tone,
  vgrad,
  type Paint,
} from './paint';
import {
  ATK,
  POSE,
  animFor,
  breathe,
  ease,
  lerp,
  lerpPose,
  poseFor,
  type Pose,
  type V,
} from './pose';

export { lerpPose, poseFor, type Pose };

type Fill = string | CanvasGradient;
export type Expr = 'normal' | 'shout' | 'pain' | 'ko';

export interface DrawState {
  time: number;
  /** 지금 기술 (무기 연출) */
  anim: AnimKey | null;
  /** 지속 프레임 진행 (0~1), 지속 중이 아니면 -1 */
  activeK: number;
  /** 채찍 · 인형 손이 닿는 거리 */
  reach: number;
  /** 하얗게 번쩍임 (피격) */
  flash: boolean;
  /** 초필살기 · 버스트 오라 */
  glow: boolean;
  /** 모든 색을 이 한 색으로 (잔상 실루엣) */
  tint?: string | null;
  expr?: Expr;
  /** 리리스의 인형으로 그리기 */
  puppet?: boolean;
}

const NO_STATE: DrawState = {
  time: 0,
  anim: null,
  activeK: -1,
  reach: 0,
  flash: false,
  glow: false,
};

/* =========================================================
 * 리그 계산
 * ========================================================= */

const T_LEN = 54;
const THIGH = 37;
const SHIN = 37;
const UPPER = 28;
const FORE = 27;
const HEAD_R = 13;

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
  fHip: V;
  bHip: V;
  fKnee: V;
  bKnee: V;
  fFoot: V;
  bFoot: V;
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

function buildRig(p: Pose): Rig {
  const hip = p.hip;
  const sx = Math.sin(p.lean);
  const sy = -Math.cos(p.lean);
  const neck: V = [hip[0] + sx * T_LEN, hip[1] + sy * T_LEN];
  const ha = p.lean + p.head;
  const head: V = [neck[0] + Math.sin(ha) * (HEAD_R + 5), neck[1] - Math.cos(ha) * (HEAD_R + 5)];
  const fSh: V = [neck[0] + 3, neck[1] + 5];
  const bSh: V = [neck[0] - 5, neck[1] + 6];
  const [fEl, fHand] = ik(fSh, [fSh[0] + p.fHand[0], fSh[1] + p.fHand[1]], UPPER, FORE, 1);
  const [bEl, bHand] = ik(bSh, [bSh[0] + p.bHand[0], bSh[1] + p.bHand[1]], UPPER, FORE, 1);
  const fHip: V = [hip[0] + 5, hip[1]];
  const bHip: V = [hip[0] - 5, hip[1]];
  const [fKnee, fFoot] = ik(fHip, p.fFoot, THIGH, SHIN, -1);
  const [bKnee, bFoot] = ik(bHip, p.bFoot, THIGH, SHIN, -1);
  return {
    hip,
    neck,
    head,
    fSh,
    bSh,
    fEl,
    bEl,
    fHand,
    bHand,
    fHip,
    bHip,
    fKnee,
    bKnee,
    fFoot,
    bFoot,
  };
}

const at = (a: V, b: V, k: number): V => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const ang = (a: V, b: V) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/* =========================================================
 * 체형별 굵기
 * ========================================================= */

interface Widths {
  ua: [number, number];
  fa: [number, number];
  th: [number, number];
  sh: [number, number];
  fist: [number, number];
  waist: number;
  chest: number;
}

function widths(def: CharacterDef, look: Look): Widths {
  if (def.body === 'robot') {
    return {
      ua: [18, 15],
      fa: [17, 19],
      th: [22, 18],
      sh: [18, 22],
      fist: [16, 15],
      waist: 36,
      chest: 56,
    };
  }
  const w: Widths =
    def.body === 'slim'
      ? {
          ua: [9, 7.5],
          fa: [8, 6.4],
          th: [14.5, 9.5],
          sh: [10.5, 6.5],
          fist: [9.5, 8.5],
          waist: 18,
          chest: 26,
        }
      : {
          ua: [12.5, 10],
          fa: [11, 8.5],
          th: [17, 12],
          sh: [13, 8.5],
          fist: [12, 11],
          waist: 26,
          chest: 39,
        };
  if (look.wide) {
    w.th = [21, 20];
    w.sh = [20, 17];
  }
  return w;
}

/* =========================================================
 * 캐릭터 한 명 그리기
 * ========================================================= */

interface Ctx {
  def: CharacterDef;
  look: Look;
  pal: Palette;
  st: DrawState;
  tint: string | null;
  male: boolean;
  robot: boolean;
  slim: boolean;
  w: Widths;
  r: Rig;
  pose: Pose;
  t: number;
  /** tone() 의 tint 반영 버전 */
  P: (c: string) => Paint;
}

/** 발밑 (0,0) 기준, 오른쪽을 바라보는 캐릭터를 그린다 (호출 쪽에서 좌우 반전 · 크기 적용) */
export function drawRig(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  pose: Pose,
  st: DrawState = NO_STATE,
) {
  const look = LOOKS[def.id];
  const tint = st.flash ? '#ffffff' : (st.tint ?? null);
  const c: Ctx = {
    def,
    look,
    pal: def.palette,
    st,
    tint,
    male: def.gender === 'M',
    robot: def.body === 'robot',
    slim: def.body === 'slim',
    w: widths(def, look),
    r: buildRig(pose),
    pose,
    t: st.time,
    P: (col: string) => tone(col, tint),
  };
  const r = c.r;

  ctx.save();
  if (pose.spin) {
    ctx.translate(r.hip[0], r.hip[1]);
    ctx.rotate(pose.spin);
    ctx.translate(-r.hip[0], -r.hip[1]);
  }
  if (st.glow && !tint) {
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = 16;
  }

  drawBack(ctx, c, true);
  drawArm(ctx, c, true);
  drawLeg(ctx, c, true);
  drawTorso(ctx, c);
  drawLeg(ctx, c, false);
  drawHipwear(ctx, c);
  drawHead(ctx, c);
  drawArm(ctx, c, false);
  drawBack(ctx, c, false);
  ctx.restore();
}

/* ---------------- 팔 ---------------- */

function drawArm(ctx: CanvasRenderingContext2D, c: Ctx, back: boolean) {
  const { r, look, pal, w } = c;
  const sh = back ? r.bSh : r.fSh;
  const el = back ? r.bEl : r.fEl;
  const hand = back ? r.bHand : r.fHand;
  const tn = (col: string) => (back ? backTone(c.P(col)) : c.P(col));
  const upper = look.sleeve === 'none' ? pal.skin : pal.top;
  const fore = look.sleeve === 'long' ? pal.top : pal.skin;
  const muscle = c.male && look.sleeve === 'none' && !c.robot ? 2.4 : 0;

  // 위팔
  limb(ctx, sh, el, w.ua[0], w.ua[1], tn(upper), muscle);
  if (look.sleeve === 'short') {
    const m = at(sh, el, 0.55);
    limb(ctx, sh, m, w.ua[0] + 3.5, w.ua[0] + 2.5, tn(pal.top));
    if (look.cuff) line(ctx, [at(sh, el, 0.5), at(sh, el, 0.56)], c.tint ?? look.cuff, w.ua[0] + 2);
  }
  if (c.robot) {
    circle(ctx, el[0], el[1], 7.5, tn(pal.trim).base);
    circle(ctx, el[0], el[1], 3, tn(pal.accent).base, 0);
  }

  // 아래팔
  limb(
    ctx,
    el,
    hand,
    w.fa[0],
    w.fa[1],
    tn(fore),
    c.male && look.sleeve !== 'long' && !c.robot ? 1.2 : 0,
  );
  if (look.sleeve === 'long' && look.cuff && !look.glove) {
    line(ctx, [at(el, hand, 0.82), at(el, hand, 0.9)], c.tint ?? look.cuff, w.fa[1] + 3);
  }
  if (look.glove) {
    const g0 = at(el, hand, 1 - look.gloveLen);
    limb(ctx, g0, hand, w.fa[1] + 3.5, w.fa[1] + 2.5, tn(look.glove));
    if (look.cuff) {
      const a = ang(el, hand);
      ctx.save();
      ctx.translate(g0[0], g0[1]);
      ctx.rotate(a);
      ctx.fillStyle = tn(look.cuff).base;
      ctx.fillRect(-1.5, -(w.fa[1] + 4.5) / 2, 3.5, w.fa[1] + 4.5);
      ctx.restore();
    }
  }

  drawFist(ctx, c, hand, ang(el, hand), back);

  // 어깨 장식
  if (look.pad === 'both' || (look.pad === 'front' && !back)) drawPad(ctx, c, sh, el, back);

  // 양손 무기
  const dual = ['claws', 'catClaw', 'pistols', 'gauntlet'];
  if (back && dual.includes(c.def.weapon)) {
    ctx.save();
    ctx.globalAlpha *= 0.9;
    drawWeapon(ctx, c, hand, ang(el, hand) + c.pose.weapon, true);
    ctx.restore();
  }
  if (!back) drawWeapon(ctx, c, hand, ang(el, hand) + c.pose.weapon, false);
}

function drawFist(ctx: CanvasRenderingContext2D, c: Ctx, hand: V, a: number, back: boolean) {
  if (c.def.weapon === 'gauntlet' || c.def.weapon === 'robotFist') return;
  const col = c.look.glove ?? c.pal.skin;
  const p = back ? backTone(c.P(col)) : c.P(col);
  const [fw, fh] = c.w.fist;
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.roundRect(-fw * 0.35, -fh / 2, fw, fh, fh * 0.38);
  fillStroke(ctx, p.base, 2.2);
  // 아래쪽 그늘 · 손가락 마디
  ctx.save();
  ctx.clip();
  ctx.fillStyle = p.shade;
  ctx.fillRect(-fw, fh * 0.1, fw * 2, fh);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    const y = -fh / 2 + (fh * i) / 4;
    ctx.moveTo(fw * 0.42, y);
    ctx.lineTo(fw * 0.62, y);
  }
  ctx.stroke();
  // 엄지
  ctx.beginPath();
  ctx.ellipse(fw * 0.1, -fh * 0.45, fw * 0.28, fh * 0.2, 0.3, 0, TAU);
  fillStroke(ctx, p.base, 1.6);
  ctx.restore();
}

function drawPad(ctx: CanvasRenderingContext2D, c: Ctx, sh: V, el: V, back: boolean) {
  const p = back ? backTone(c.P(c.look.padColor)) : c.P(c.look.padColor);
  const a = ang(sh, el);
  const big = (c.robot ? 1.35 : c.male ? 0.78 : 0.62) * 0.9;
  const o = at(sh, el, 0.12);
  ctx.save();
  ctx.translate(o[0] - 2, o[1]);
  ctx.rotate(a - Math.PI / 2);
  // 겹친 판 두 장
  for (let i = 1; i >= 0; i--) {
    ctx.beginPath();
    ctx.ellipse(0, 3 + i * 5, 13 * big, (9 - i) * big, 0, Math.PI, TAU);
    ctx.lineTo(13 * big, 3 + i * 5 + 2);
    ctx.quadraticCurveTo(0, 3 + i * 5 + 6 * big, -13 * big, 3 + i * 5 + 2);
    ctx.closePath();
    fillStroke(
      ctx,
      i === 0
        ? vgrad(
            ctx,
            -9 * big,
            8,
            [
              [0, p.light],
              [0.5, p.base],
              [1, p.shade],
            ],
            c.tint,
          )
        : p.shade,
      2,
    );
  }
  if (!c.tint) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-3 * big, -3 * big, 5 * big, 1.6, -0.2, 0, TAU);
    ctx.fill();
    circle(ctx, -8 * big, 2, 1.4, '#e8e8f0', 0);
    circle(ctx, 8 * big, 2, 1.4, '#e8e8f0', 0);
  }
  ctx.restore();
}

/* ---------------- 다리 ---------------- */

function drawLeg(ctx: CanvasRenderingContext2D, c: Ctx, back: boolean) {
  const { r, look, pal, w } = c;
  const hip = back ? r.bHip : r.fHip;
  const knee = back ? r.bKnee : r.fKnee;
  const foot = back ? r.bFoot : r.fFoot;
  const tn = (col: string) => (back ? backTone(c.P(col)) : c.P(col));
  const bare = look.legwear ?? pal.skin;
  const thighCol = look.pants === 'long' ? pal.bottom : bare;
  const shinCol = look.pants === 'long' ? pal.bottom : bare;
  const ankle: V = [foot[0], foot[1] - 4];

  limb(ctx, hip, knee, w.th[0], w.th[1], tn(thighCol), c.male && !c.robot ? 1.4 : 0);
  limb(ctx, knee, ankle, w.sh[0], w.sh[1], tn(shinCol), c.male && !c.robot ? 1.2 : 0.6);

  if (look.stripe && !c.tint && !c.st.puppet) {
    stripes(ctx, hip, knee, w.th[0], w.th[1], look.stripe, back);
    stripes(ctx, knee, ankle, w.sh[0], w.sh[1], look.stripe, back);
  }
  if (look.pants === 'shorts') {
    limb(ctx, hip, at(hip, knee, 0.36), w.th[0] + 3, w.th[0] + 2, tn(pal.bottom));
  }
  if (c.robot) {
    circle(ctx, knee[0], knee[1], 8, tn(pal.trim).base);
    line(ctx, [at(hip, knee, 0.25), at(knee, ankle, 0.4)], c.tint ?? '#2a3038', 3);
  }

  // 부츠
  const b0 = at(knee, ankle, 1 - look.bootLen);
  const bw = lerp(w.sh[0], w.sh[1], 1 - look.bootLen) + 3;
  const bp = tn(look.boot);
  if (look.bootStyle !== 'sandal') limb(ctx, b0, ankle, bw, w.sh[1] + 3.5, bp);
  else limb(ctx, b0, ankle, bw - 1, w.sh[1] + 2.5, tn('#f2f6ff'));
  if (look.bootStyle === 'armored') {
    // 무릎 보호대
    ctx.save();
    ctx.translate(knee[0], knee[1]);
    ctx.rotate(ang(knee, ankle) - Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-w.sh[0] * 0.55, -6);
    ctx.quadraticCurveTo(0, -12, w.sh[0] * 0.7, -5);
    ctx.lineTo(w.sh[0] * 0.55, 7);
    ctx.quadraticCurveTo(0, 10, -w.sh[0] * 0.5, 6);
    ctx.closePath();
    fillStroke(
      ctx,
      vgrad(
        ctx,
        -12,
        10,
        [
          [0, bp.light],
          [1, bp.shade],
        ],
        c.tint,
      ),
      2,
    );
    ctx.restore();
  }
  drawFoot(ctx, c, knee, foot, bp, back);
}

function stripes(
  ctx: CanvasRenderingContext2D,
  a: V,
  b: V,
  w1: number,
  w2: number,
  color: string,
  back: boolean,
) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  ctx.save();
  ctx.translate(a[0], a[1]);
  ctx.rotate(ang(a, b));
  ctx.beginPath();
  ctx.moveTo(0, -w1 / 2);
  ctx.lineTo(len, -w2 / 2);
  ctx.lineTo(len, w2 / 2);
  ctx.lineTo(0, w1 / 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = color;
  ctx.globalAlpha *= back ? 0.6 : 0.9;
  for (let x = 4; x < len; x += 8) ctx.fillRect(x, -w1, 3.5, w1 * 2);
  ctx.restore();
}

function drawFoot(
  ctx: CanvasRenderingContext2D,
  c: Ctx,
  knee: V,
  foot: V,
  bp: Paint,
  back: boolean,
) {
  const style = c.look.bootStyle;
  const tilt = (ang(knee, foot) - Math.PI / 2) * 0.55;
  const s = c.robot ? 1.3 : c.slim ? 0.85 : 1;
  ctx.save();
  ctx.translate(foot[0], foot[1]);
  ctx.rotate(-tilt);
  ctx.scale(s, s);
  if (style === 'sandal') {
    // 버선 + 나막신
    ctx.beginPath();
    ctx.moveTo(-7, -9);
    ctx.quadraticCurveTo(6, -10, 14, -3);
    ctx.lineTo(14, -1);
    ctx.lineTo(-7, -1);
    ctx.closePath();
    fillStroke(ctx, c.tint ?? (back ? '#c8d0e0' : '#f2f6ff'), 2);
    poly(
      ctx,
      [
        [-9, -1],
        [16, -1],
        [16, 2],
        [-9, 2],
      ],
      c.tint ?? (back ? '#4a2a14' : '#6a3a1a'),
      1.8,
    );
    line(
      ctx,
      [
        [2, -8],
        [10, -1],
      ],
      c.tint ?? '#1a2a40',
      1.6,
    );
  } else if (style === 'heel') {
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.quadraticCurveTo(4, -9, 13, -2);
    ctx.lineTo(13, 0);
    ctx.lineTo(2, -1);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    fillStroke(
      ctx,
      vgrad(
        ctx,
        -11,
        0,
        [
          [0, bp.light],
          [0.5, bp.base],
          [1, bp.shade],
        ],
        c.tint,
      ),
      2,
    );
    poly(
      ctx,
      [
        [-6, -5],
        [-3, -5],
        [-4, 1],
        [-6, 1],
      ],
      c.tint ?? (back ? '#4a2030' : '#ff2a4a'),
      1.5,
    );
  } else {
    const h = style === 'sneaker' ? 9 : 11;
    ctx.beginPath();
    ctx.moveTo(-7, -h);
    ctx.lineTo(3, -h + 1);
    ctx.quadraticCurveTo(15, -h + 4, 16, -2);
    ctx.lineTo(16, 0);
    ctx.lineTo(-8, 0);
    ctx.quadraticCurveTo(-9, -h * 0.5, -7, -h);
    ctx.closePath();
    fillStroke(
      ctx,
      vgrad(
        ctx,
        -h,
        0,
        [
          [0, bp.light],
          [0.45, bp.base],
          [1, bp.shade],
        ],
        c.tint,
      ),
      2,
    );
    // 밑창
    const sole = style === 'sneaker' ? '#f6f6f6' : style === 'armored' ? bp.deep : '#1a1214';
    poly(
      ctx,
      [
        [-8, -2.5],
        [16.5, -2.5],
        [16.5, 0.8],
        [-8, 0.8],
      ],
      c.tint ?? sole,
      1.6,
    );
    if (style === 'sneaker' && !c.tint) {
      line(
        ctx,
        [
          [-3, -6],
          [6, -4],
        ],
        c.pal.accent,
        2,
      );
      line(
        ctx,
        [
          [2, -h + 1.5],
          [7, -h + 3],
        ],
        '#ffffff',
        1.4,
      );
    }
    if (style === 'armored' && !c.tint) {
      line(
        ctx,
        [
          [4, -h + 1],
          [14, -3],
        ],
        bp.light,
        1.4,
      );
      line(
        ctx,
        [
          [-2, -h],
          [-2, -2.5],
        ],
        bp.deep,
        1.2,
      );
    }
    if (style === 'boot' && !c.tint) {
      line(
        ctx,
        [
          [-6, -h + 2],
          [4, -h + 3],
        ],
        bp.light,
        1.4,
      );
    }
  }
  ctx.restore();
}

/* ---------------- 몸통 · 의상 ---------------- */

function torsoPath(ctx: CanvasRenderingContext2D, W: number, C: number) {
  const T = T_LEN;
  ctx.beginPath();
  ctx.moveTo(-W, 2);
  ctx.bezierCurveTo(-W - 1, -T * 0.3, -C, -T * 0.42, -C, -T * 0.7);
  ctx.quadraticCurveTo(-C, -T - 2, -C * 0.4, -T - 1);
  ctx.lineTo(C * 0.4, -T - 1);
  ctx.quadraticCurveTo(C, -T - 2, C, -T * 0.7);
  ctx.bezierCurveTo(C, -T * 0.42, W + 1, -T * 0.3, W, 2);
  ctx.quadraticCurveTo(0, 6, -W, 2);
  ctx.closePath();
}

function drawTorso(ctx: CanvasRenderingContext2D, c: Ctx) {
  const { r, pose, pal, w } = c;
  const W = w.waist / 2;
  const C = w.chest / 2;
  const T = T_LEN;
  const top = c.P(pal.top);

  // 목
  const na = pose.lean + pose.head;
  const neckTop: V = [r.neck[0] + Math.sin(na) * 8, r.neck[1] - Math.cos(na) * 8];
  limb(
    ctx,
    r.neck,
    neckTop,
    c.robot ? 16 : c.slim ? 7.5 : 10,
    c.robot ? 14 : c.slim ? 7 : 9.5,
    c.P(c.robot ? '#3a424c' : pal.skin),
  );

  ctx.save();
  ctx.translate(r.hip[0], r.hip[1]);
  ctx.rotate(pose.lean);
  torsoPath(ctx, W, C);
  // 배꼽티 (바이올렛 캣) — 맨살 바탕
  const midriff = c.def.id === 'violet-cat';
  ctx.fillStyle = midriff ? c.P(pal.skin).base : top.base;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (midriff) {
    ctx.fillStyle = top.base;
    ctx.fillRect(-C - 4, -T - 6, C * 2 + 8, T * 0.58);
  }
  // 셀 셰이딩 — 뒤쪽 면 · 아래쪽
  ctx.fillStyle = top.shade;
  ctx.beginPath();
  ctx.moveTo(-C - 6, -T - 6);
  ctx.quadraticCurveTo(-C * 0.1, -T * 0.55, -W * 0.3, 8);
  ctx.lineTo(-C - 6, 8);
  ctx.closePath();
  ctx.fill();
  costume(ctx, c, W, C);
  // 앞쪽 가장자리 빛
  if (!c.tint) {
    ctx.strokeStyle = top.light;
    ctx.globalAlpha *= 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(C - 2, -T * 0.72);
    ctx.bezierCurveTo(C - 2, -T * 0.42, W - 1, -T * 0.3, W - 1, -2);
    ctx.stroke();
  }
  ctx.restore();
  torsoPath(ctx, W, C);
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  costumeOuter(ctx, c, C);
  ctx.restore();
}

/** 몸통 안쪽 의상 디테일 (몸통 모양으로 잘려 있다) — 좌표: 골반 (0,0), 위가 -y, 앞이 +x */
function costume(ctx: CanvasRenderingContext2D, c: Ctx, W: number, C: number) {
  const { pal, tint, t } = c;
  const T = T_LEN;
  const P = c.P;
  const glow = (col: string, blur: number) => {
    if (tint) return;
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
  };
  const noGlow = () => {
    ctx.shadowBlur = 0;
  };
  const belt = (col: string, buckle: string, y = -4, h = 7) => {
    const p = P(col);
    poly(
      ctx,
      [
        [-C - 4, y - h / 2],
        [C + 4, y - h / 2],
        [C + 4, y + h / 2],
        [-C - 4, y + h / 2],
      ],
      p.base,
      1.6,
    );
    ctx.fillStyle = p.light;
    ctx.fillRect(-C - 4, y - h / 2 + 1, C * 2 + 8, 1.2);
    ctx.beginPath();
    ctx.roundRect(C * 0.15, y - h / 2 - 1.5, 9, h + 3, 2);
    fillStroke(
      ctx,
      vgrad(
        ctx,
        y - h,
        y + h,
        [
          [0, '#ffffff'],
          [0.5, buckle],
          [1, tone(buckle).shade],
        ],
        tint,
      ),
      1.6,
    );
  };

  switch (c.def.id) {
    case 'solaris': {
      // 열린 재킷 안 검은 셔츠 · 흰 테두리 · 가슴 벨트
      poly(
        ctx,
        [
          [C * 0.05, -T - 2],
          [C * 0.7, -T - 2],
          [W * 0.75, 2],
          [W * 0.05, 2],
        ],
        P('#2a2230').base,
        0,
      );
      line(
        ctx,
        [
          [C * 0.05, -T - 2],
          [W * 0.05, 2],
        ],
        tint ?? pal.trim,
        2.4,
      );
      line(
        ctx,
        [
          [C * 0.7, -T - 2],
          [W * 0.75, 2],
        ],
        tint ?? pal.trim,
        2.4,
      );
      line(
        ctx,
        [
          [C * 0.15, -T * 0.66],
          [C * 0.45, -T * 0.6],
          [C * 0.62, -T * 0.66],
        ],
        tint ?? '#120c16',
        1.4,
      );
      const sp = P('#4a3020');
      poly(
        ctx,
        [
          [-C - 4, -T * 0.92],
          [-C - 4, -T * 0.8],
          [C + 4, -T * 0.18],
          [C + 4, -T * 0.3],
        ],
        sp.base,
        1.6,
      );
      for (const k of [0.3, 0.62]) {
        const x = lerp(-C, C, k);
        const y = lerp(-T * 0.86, -T * 0.24, k);
        ctx.beginPath();
        ctx.roundRect(x - 3, y - 4, 6, 8, 1.5);
        fillStroke(ctx, tint ?? '#c8ccd8', 1.2);
      }
      belt('#3a2a20', '#d8dce8');
      break;
    }
    case 'shadow-crow': {
      // 뼈 장식 갈비 · 보라 테두리 · 사슬 띠
      ctx.strokeStyle = tint ?? 'rgba(220,210,235,0.75)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 4; i++) {
        const y = -T * 0.78 + i * 7;
        ctx.beginPath();
        ctx.moveTo(-C * 0.2, y);
        ctx.quadraticCurveTo(C * 0.4, y - 4, C * 0.85, y + 3);
        ctx.stroke();
      }
      line(
        ctx,
        [
          [-C * 0.2, -T * 0.86],
          [-C * 0.2, -T * 0.3],
        ],
        tint ?? '#d8d0e8',
        3,
      );
      line(
        ctx,
        [
          [C * 0.9, -T],
          [W * 0.9, 2],
        ],
        tint ?? pal.accent,
        3,
      );
      ctx.strokeStyle = tint ?? '#8a8098';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) {
        const x = lerp(-C, C, i / 8);
        const y = lerp(-T * 0.2, -T * 0.55, i / 8);
        ctx.beginPath();
        ctx.ellipse(x, y, 3.4, 2.2, -0.4, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case 'bolt-master': {
      // 회로 무늬 슈트 · 가슴 코어
      glow(pal.trim, 6);
      ctx.strokeStyle = tint ?? pal.trim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-C * 0.6, -T * 0.9);
      ctx.lineTo(-C * 0.6, -T * 0.55);
      ctx.lineTo(-C * 0.1, -T * 0.42);
      ctx.lineTo(-C * 0.1, -T * 0.1);
      ctx.moveTo(C * 0.8, -T * 0.85);
      ctx.lineTo(C * 0.55, -T * 0.6);
      ctx.moveTo(C * 0.7, -T * 0.35);
      ctx.lineTo(C * 0.2, -T * 0.25);
      ctx.lineTo(C * 0.2, 0);
      ctx.stroke();
      noGlow();
      for (const [x, y] of [
        [-C * 0.6, -T * 0.9],
        [-C * 0.1, -T * 0.1],
        [C * 0.2, 0],
        [C * 0.7, -T * 0.35],
      ] as V[]) {
        circle(ctx, x, y, 1.8, tint ?? pal.trim, 0);
      }
      const pulse = 0.75 + Math.sin(t * 6) * 0.25;
      glow(pal.accent, 14 * pulse);
      circle(
        ctx,
        C * 0.3,
        -T * 0.68,
        6,
        vgrad(
          ctx,
          -T * 0.75,
          -T * 0.6,
          [
            [0, '#ffffff'],
            [1, pal.accent],
          ],
          tint,
        ),
        2,
      );
      noGlow();
      circle(ctx, C * 0.3, -T * 0.68, 2.4, tint ?? '#ffffff', 0);
      belt('#141820', pal.trim);
      break;
    }
    case 'iron-giant': {
      // 장갑판 · 리벳 · 원자로
      const plate = P(pal.trim);
      ctx.beginPath();
      ctx.roundRect(-C * 0.9, -T * 0.98, C * 1.8, T * 0.5, 6);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -T,
          -T * 0.45,
          [
            [0, plate.light],
            [0.6, plate.base],
            [1, plate.shade],
          ],
          tint,
        ),
        2,
      );
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.roundRect(-C * 0.75 + i * C * 0.55, -T * 0.42, C * 0.45, 9, 2);
        fillStroke(ctx, P('#4a525c').base, 1.6);
      }
      const pulse = 0.7 + Math.sin(t * 4) * 0.3;
      glow(pal.accent, 18 * pulse);
      if (tint) {
        circle(ctx, C * 0.15, -T * 0.72, 9, tint, 2.2);
      } else {
        const g = ctx.createRadialGradient(C * 0.15, -T * 0.72, 1, C * 0.15, -T * 0.72, 9);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, '#ffd08a');
        g.addColorStop(1, pal.accent);
        circle(ctx, C * 0.15, -T * 0.72, 9, g, 2.2);
      }
      noGlow();
      for (const [x, y] of [
        [-C * 0.78, -T * 0.9],
        [C * 0.78, -T * 0.9],
        [-C * 0.78, -T * 0.56],
        [C * 0.78, -T * 0.56],
      ] as V[]) {
        circle(ctx, x, y, 2, tint ?? '#e8eef4', 1);
      }
      ctx.fillStyle = tint ?? '#20262e';
      for (let i = 0; i < 4; i++) ctx.fillRect(-C * 0.4 + i * 7, -T * 0.2, 4, 10);
      break;
    }
    case 'phantom-dj': {
      // 지퍼 열린 봄버 재킷 · 네온 줄 · 금 목걸이
      poly(
        ctx,
        [
          [C * 0.1, -T - 2],
          [C * 0.62, -T - 2],
          [W * 0.6, 2],
          [W * 0.05, 2],
        ],
        P('#f2f2f2').base,
        0,
      );
      line(
        ctx,
        [
          [C * 0.1, -T - 2],
          [W * 0.05, 2],
        ],
        tint ?? '#c8c8d0',
        2,
      );
      ctx.fillStyle = tint ?? pal.accent;
      ctx.fillRect(-C * 0.7, -T, 4, T + 2);
      ctx.fillStyle = tint ?? pal.trim;
      ctx.fillRect(-C * 0.55, -T, 2, T + 2);
      ctx.strokeStyle = tint ?? '#ffd84a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(C * 0.12, -T + 1);
      ctx.quadraticCurveTo(C * 0.38, -T * 0.6, C * 0.62, -T + 1);
      ctx.stroke();
      circle(ctx, C * 0.38, -T * 0.66, 3, tint ?? '#ffd84a', 1.4);
      ctx.fillStyle = P(pal.top).shade;
      ctx.fillRect(-C - 4, -6, C * 2 + 8, 8);
      ctx.strokeStyle = tint ?? 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      for (let x = -C; x < C; x += 3) {
        ctx.beginPath();
        ctx.moveTo(x, -6);
        ctx.lineTo(x, 2);
        ctx.stroke();
      }
      break;
    }
    case 'blood-hound': {
      // 흠집 난 흉갑 · 붉은 천
      const m = P('#8a8a94');
      ctx.beginPath();
      ctx.moveTo(-C * 0.85, -T * 0.95);
      ctx.quadraticCurveTo(C * 0.2, -T * 1.08, C * 0.95, -T * 0.92);
      ctx.lineTo(C * 0.9, -T * 0.35);
      ctx.quadraticCurveTo(0, -T * 0.25, -C * 0.85, -T * 0.4);
      ctx.closePath();
      fillStroke(
        ctx,
        hgrad(
          ctx,
          -C,
          C,
          [
            [0, m.shade],
            [0.55, m.light],
            [0.75, '#ffffff'],
            [1, m.base],
          ],
          tint,
        ),
        2,
      );
      line(
        ctx,
        [
          [C * 0.25, -T],
          [C * 0.25, -T * 0.3],
        ],
        tint ?? m.deep,
        1.6,
      );
      ctx.strokeStyle = tint ?? 'rgba(40,10,20,0.7)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(C * 0.4 + i * 4, -T * 0.82 + i * 2);
        ctx.lineTo(C * 0.1 + i * 4, -T * 0.55 + i * 2);
        ctx.stroke();
      }
      poly(
        ctx,
        [
          [-C * 0.25, -T * 0.32],
          [C * 0.45, -T * 0.32],
          [C * 0.35, 4],
          [-C * 0.15, 4],
        ],
        P(pal.accent).base,
        1.8,
      );
      belt('#2a1a1a', '#a8a8b0', -T * 0.3, 6);
      break;
    }
    case 'alchemist-z': {
      // 실험 가운 · 녹색 넥타이 · 주머니
      poly(
        ctx,
        [
          [C * 0.12, -T - 2],
          [C * 0.62, -T - 2],
          [C * 0.45, -T * 0.45],
          [C * 0.25, -T * 0.45],
        ],
        P('#3a3448').base,
        0,
      );
      poly(
        ctx,
        [
          [C * 0.36, -T * 0.92],
          [C * 0.44, -T * 0.92],
          [C * 0.48, -T * 0.55],
          [C * 0.4, -T * 0.48],
          [C * 0.32, -T * 0.55],
        ],
        P(pal.accent).base,
        1.2,
      );
      line(
        ctx,
        [
          [C * 0.12, -T - 2],
          [C * 0.3, -T * 0.4],
          [C * 0.2, 2],
        ],
        tint ?? '#b8b8b0',
        1.8,
      );
      line(
        ctx,
        [
          [C * 0.62, -T - 2],
          [C * 0.48, -T * 0.4],
        ],
        tint ?? '#b8b8b0',
        1.8,
      );
      for (let i = 0; i < 3; i++)
        circle(ctx, C * 0.28, -T * 0.3 + i * 8, 1.6, tint ?? '#8a8a80', 1);
      poly(
        ctx,
        [
          [-C * 0.75, -T * 0.72],
          [-C * 0.2, -T * 0.72],
          [-C * 0.22, -T * 0.55],
          [-C * 0.73, -T * 0.55],
        ],
        P('#d8d8d0').base,
        1.4,
      );
      line(
        ctx,
        [
          [-C * 0.6, -T * 0.82],
          [-C * 0.6, -T * 0.68],
        ],
        tint ?? '#2a6aff',
        2,
      );
      line(
        ctx,
        [
          [-C * 0.45, -T * 0.84],
          [-C * 0.45, -T * 0.68],
        ],
        tint ?? '#ff3a3a',
        2,
      );
      const vials = ['#7aff3a', '#ff5a3a', '#3ac8ff'];
      for (let i = 0; i < 3; i++) {
        const x = -C * 0.6 + i * 7;
        ctx.beginPath();
        ctx.roundRect(x, -T * 0.16, 5, 10, 2);
        fillStroke(ctx, tint ?? (vials[i] as string), 1.2);
      }
      break;
    }
    case 'frost-samurai': {
      // 기모노 깃 (V자로 겹침) · 가문 문양
      const navy = P(pal.trim);
      poly(
        ctx,
        [
          [-C * 0.3, -T - 2],
          [C * 0.15, -T - 2],
          [C * 0.75, -T * 0.25],
          [C * 0.55, -T * 0.25],
        ],
        navy.base,
        1.4,
      );
      poly(
        ctx,
        [
          [C * 0.95, -T - 2],
          [C * 0.5, -T - 2],
          [C * 0.1, -T * 0.42],
          [C * 0.3, -T * 0.42],
        ],
        P('#c8d8ec').base,
        1.4,
      );
      ctx.strokeStyle = tint ?? 'rgba(26,42,64,0.35)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-C * 0.8 + i * 6, -T * 0.6);
        ctx.quadraticCurveTo(-C * 0.5 + i * 6, -T * 0.3, -C * 0.6 + i * 6, -T * 0.05);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(-C * 0.45, -T * 0.78);
      ctx.strokeStyle = tint ?? pal.accent;
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -5);
        ctx.moveTo(0, -3);
        ctx.lineTo(1.6, -4.4);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'violet-cat': {
      // 털 장식 크롭탑 · 배 근육선
      ctx.fillStyle = tint ?? pal.trim;
      ctx.beginPath();
      const y = -T + T * 0.58;
      ctx.moveTo(-C - 4, y - 3);
      let k = 0;
      for (let x = -C - 4; x <= C + 4; x += 4) {
        ctx.lineTo(x + 2, y + (k % 2 === 0 ? 4 : 1.5));
        k++;
      }
      ctx.lineTo(C + 4, y - 3);
      ctx.closePath();
      ctx.fill();
      line(
        ctx,
        [
          [C * 0.25, y + 8],
          [C * 0.25, -4],
        ],
        tint ?? 'rgba(160,90,90,0.5)',
        1,
      );
      circle(ctx, C * 0.25, -8, 1.2, tint ?? 'rgba(120,60,60,0.6)', 0);
      line(
        ctx,
        [
          [-C * 0.5, -T * 0.92],
          [C * 0.6, -T * 0.6],
        ],
        tint ?? pal.accent,
        2.2,
      );
      belt('#2a1438', '#ffd84a', -2, 6);
      break;
    }
    case 'puppet-lilith': {
      // 코르셋 끈 · 리본
      if (c.st.puppet) {
        // 인형 — 꿰맨 자국
        ctx.strokeStyle = tint ?? '#f2e0c0';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(C * 0.2, -T);
        ctx.lineTo(C * 0.2, 0);
        for (let yy = -T + 4; yy < 0; yy += 6) {
          ctx.moveTo(C * 0.2 - 3, yy);
          ctx.lineTo(C * 0.2 + 3, yy + 2);
        }
        ctx.stroke();
        break;
      }
      const p = P('#3a0a20');
      poly(
        ctx,
        [
          [-C * 0.5, -T * 0.6],
          [C * 0.75, -T * 0.6],
          [W * 0.85, 0],
          [-W * 0.6, 0],
        ],
        p.base,
        1.6,
      );
      ctx.strokeStyle = tint ?? pal.trim;
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 4; i++) {
        const yy = -T * 0.54 + i * 7;
        ctx.beginPath();
        ctx.moveTo(C * 0.05, yy);
        ctx.lineTo(C * 0.45, yy + 5);
        ctx.moveTo(C * 0.45, yy);
        ctx.lineTo(C * 0.05, yy + 5);
        ctx.stroke();
      }
      poly(
        ctx,
        [
          [C * 0.25, -T * 0.82],
          [C * 0.75, -T * 0.92],
          [C * 0.75, -T * 0.7],
        ],
        P(pal.accent).base,
        1.4,
      );
      poly(
        ctx,
        [
          [C * 0.25, -T * 0.82],
          [-C * 0.2, -T * 0.92],
          [-C * 0.2, -T * 0.7],
        ],
        P(pal.accent).base,
        1.4,
      );
      circle(ctx, C * 0.25, -T * 0.82, 2.6, P(pal.accent).shade, 1.2);
      break;
    }
    case 'neon-valkyrie': {
      // 흉갑 · 네온 라인 · 가슴 보석
      const m = P(pal.top);
      ctx.beginPath();
      ctx.moveTo(-C * 0.8, -T * 0.96);
      ctx.quadraticCurveTo(C * 0.2, -T * 1.06, C * 0.95, -T * 0.94);
      ctx.lineTo(C * 0.7, -T * 0.5);
      ctx.quadraticCurveTo(0, -T * 0.42, -C * 0.7, -T * 0.52);
      ctx.closePath();
      fillStroke(
        ctx,
        hgrad(
          ctx,
          -C,
          C,
          [
            [0, m.shade],
            [0.6, '#ffffff'],
            [1, m.base],
          ],
          tint,
        ),
        2,
      );
      glow(pal.accent, 8);
      line(
        ctx,
        [
          [-C * 0.6, -T * 0.55],
          [C * 0.6, -T * 0.55],
        ],
        tint ?? pal.accent,
        1.8,
      );
      line(
        ctx,
        [
          [C * 0.15, -T * 0.45],
          [C * 0.15, 0],
        ],
        tint ?? pal.accent,
        1.6,
      );
      poly(
        ctx,
        [
          [C * 0.15, -T * 0.86],
          [C * 0.3, -T * 0.76],
          [C * 0.15, -T * 0.66],
          [0, -T * 0.76],
        ],
        tint ?? pal.accent,
        1.4,
      );
      noGlow();
      belt('#7a8aa0', pal.accent, -3, 6);
      break;
    }
    case 'scarlet-whip': {
      // 코르셋 · 붉은 끈 · 가슴 장미
      const p = P('#2a0a16');
      poly(
        ctx,
        [
          [-C * 0.9, -T * 0.72],
          [C * 0.95, -T * 0.78],
          [W, 2],
          [-W, 2],
        ],
        p.base,
        1.6,
      );
      ctx.strokeStyle = tint ?? pal.accent;
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 5; i++) {
        const yy = -T * 0.66 + i * 7;
        ctx.beginPath();
        ctx.moveTo(C * 0.05, yy);
        ctx.lineTo(C * 0.4, yy + 5);
        ctx.moveTo(C * 0.4, yy);
        ctx.lineTo(C * 0.05, yy + 5);
        ctx.stroke();
      }
      rose(ctx, -C * 0.35, -T * 0.72, 5, tint, pal.accent);
      line(
        ctx,
        [
          [-C - 4, -T * 0.72],
          [C + 4, -T * 0.78],
        ],
        tint ?? pal.accent,
        1.6,
      );
      break;
    }
    case 'chainsaw-bella': {
      // 민소매 · 멜빵 · 해골 · 안전핀
      line(
        ctx,
        [
          [-C * 0.3, -T - 2],
          [-C * 0.1, 2],
        ],
        tint ?? pal.accent,
        3,
      );
      line(
        ctx,
        [
          [C * 0.65, -T - 2],
          [C * 0.55, 2],
        ],
        tint ?? pal.accent,
        3,
      );
      ctx.save();
      ctx.translate(C * 0.2, -T * 0.6);
      circle(ctx, 0, 0, 5, tint ?? '#e8e8f0', 1.2);
      ctx.fillStyle = tint ?? INK;
      ctx.fillRect(-2.6, -1.5, 2, 2);
      ctx.fillRect(0.6, -1.5, 2, 2);
      ctx.fillRect(-1.6, 3, 3.2, 3);
      ctx.restore();
      line(
        ctx,
        [
          [-C * 0.7, -T * 0.42],
          [-C * 0.45, -T * 0.32],
        ],
        tint ?? '#d8d8e0',
        1.4,
      );
      circle(ctx, -C * 0.72, -T * 0.43, 1.4, tint ?? '#d8d8e0', 0);
      break;
    }
    case 'arcane-spectre': {
      // 마법 로브 · 별 단추 · 유령 브로치
      line(
        ctx,
        [
          [C * 0.2, -T - 2],
          [C * 0.3, 2],
        ],
        tint ?? pal.trim,
        1.6,
      );
      for (let i = 0; i < 3; i++) star(ctx, C * 0.38, -T * 0.72 + i * 12, 3, tint ?? pal.trim);
      ctx.save();
      ctx.translate(-C * 0.35, -T * 0.78);
      glow(pal.accent, 8);
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, Math.PI, 0);
      ctx.lineTo(4.5, 5);
      ctx.lineTo(1.5, 3);
      ctx.lineTo(-1.5, 5);
      ctx.lineTo(-4.5, 3);
      ctx.closePath();
      fillStroke(ctx, tint ?? pal.accent, 1.2);
      noGlow();
      ctx.restore();
      belt('#4a3a6a', pal.trim, -3, 5);
      break;
    }
    case 'gunslinger-rose': {
      // 조끼 아래 흰 셔츠 · 탄띠
      poly(
        ctx,
        [
          [C * 0.08, -T - 2],
          [C * 0.62, -T - 2],
          [W * 0.6, 2],
          [W * 0.1, 2],
        ],
        P(pal.trim).base,
        0,
      );
      line(
        ctx,
        [
          [C * 0.08, -T - 2],
          [W * 0.1, 2],
        ],
        tint ?? INK,
        1.4,
      );
      line(
        ctx,
        [
          [C * 0.62, -T - 2],
          [W * 0.6, 2],
        ],
        tint ?? INK,
        1.4,
      );
      const bp = P('#4a2a14');
      poly(
        ctx,
        [
          [-C - 4, -T * 0.95],
          [-C - 4, -T * 0.82],
          [C + 4, -T * 0.08],
          [C + 4, -T * 0.22],
        ],
        bp.base,
        1.4,
      );
      for (let i = 0; i < 6; i++) {
        const k = 0.1 + i * 0.15;
        const x = lerp(-C, C, k);
        const yy = lerp(-T * 0.9, -T * 0.16, k);
        ctx.beginPath();
        ctx.roundRect(x - 1.6, yy - 6, 3.2, 7, 1.4);
        fillStroke(ctx, tint ?? '#e8b040', 1);
      }
      belt('#4a2a14', '#e8d8b0');
      break;
    }
    default:
      break;
  }
  noGlow();
}

/** 몸통 밖으로 튀어나오는 장식 (옷깃 · 방울 · 레이스) */
function costumeOuter(ctx: CanvasRenderingContext2D, c: Ctx, C: number) {
  const { pal, tint } = c;
  const T = T_LEN;
  if (c.st.puppet) return;
  switch (c.def.id) {
    case 'phantom-dj':
      poly(
        ctx,
        [
          [-C * 0.6, -T - 1],
          [-C * 0.8, -T - 8],
          [C * 0.1, -T - 4],
          [C * 0.15, -T - 1],
        ],
        c.P(pal.top).shade,
        1.8,
      );
      break;
    case 'violet-cat':
      line(
        ctx,
        [
          [-C * 0.5, -T - 1],
          [C * 0.6, -T - 1],
        ],
        tint ?? pal.accent,
        3,
      );
      circle(
        ctx,
        C * 0.2,
        -T + 3,
        3.4,
        vgrad(
          ctx,
          -T,
          -T + 6,
          [
            [0, '#fff6a0'],
            [1, '#e8a020'],
          ],
          tint,
        ),
        1.4,
      );
      break;
    case 'puppet-lilith':
    case 'scarlet-whip':
    case 'arcane-spectre': {
      // 높은 깃 · 레이스
      const col =
        c.def.id === 'puppet-lilith' ? pal.trim : c.def.id === 'scarlet-whip' ? '#2a0a16' : pal.top;
      ctx.beginPath();
      ctx.moveTo(-C * 0.7, -T);
      for (let i = 0; i <= 6; i++) {
        const x = lerp(-C * 0.7, C * 0.7, i / 6);
        ctx.lineTo(x, -T - (i % 2 === 0 ? 9 : 5));
      }
      ctx.lineTo(C * 0.7, -T + 2);
      ctx.lineTo(-C * 0.7, -T + 2);
      ctx.closePath();
      fillStroke(ctx, c.P(col).base, 1.6);
      break;
    }
    case 'alchemist-z':
      poly(
        ctx,
        [
          [-C * 0.5, -T - 1],
          [-C * 0.7, -T - 9],
          [C * 0.05, -T - 3],
        ],
        c.P(pal.top).light,
        1.6,
      );
      poly(
        ctx,
        [
          [C * 0.65, -T - 1],
          [C * 0.85, -T - 8],
          [C * 0.3, -T - 3],
        ],
        c.P(pal.top).base,
        1.6,
      );
      break;
    case 'blood-hound':
    case 'neon-valkyrie': {
      const p = c.P(c.def.id === 'blood-hound' ? '#8a8a94' : pal.top);
      ctx.beginPath();
      ctx.moveTo(-C * 0.55, -T + 2);
      ctx.quadraticCurveTo(0, -T - 10, C * 0.65, -T + 2);
      ctx.closePath();
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -T - 10,
          -T + 2,
          [
            [0, p.light],
            [1, p.shade],
          ],
          tint,
        ),
        1.8,
      );
      break;
    }
    default:
      break;
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  fillStroke(ctx, fill, 1);
}

function rose(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tint: string | null,
  col: string,
) {
  const p = tone(col, tint);
  circle(ctx, x, y, r, p.base, 1.4);
  ctx.strokeStyle = tint ?? p.deep;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0.4, 4.6);
  ctx.moveTo(x + r * 0.25, y);
  ctx.arc(x, y, r * 0.25, 0, 5);
  ctx.stroke();
}

/* ---------------- 허리 아래 의상 (치마 · 코트 자락 · 띠) ---------------- */

function drawHipwear(ctx: CanvasRenderingContext2D, c: Ctx) {
  const { r, pose, pal, tint, t, w } = c;
  if (c.st.puppet) return;
  const W = w.waist / 2;
  const sway = Math.sin(t * 3) * 2;
  const flare = Math.max(0, Math.abs(r.fFoot[0] - r.bFoot[0]) - 30) * 0.15;
  ctx.save();
  ctx.translate(r.hip[0], r.hip[1]);
  ctx.rotate(pose.lean * 0.6);
  const P = c.P;
  switch (c.def.id) {
    case 'solaris':
      poly(
        ctx,
        [
          [-W - 2, 0],
          [-W + 4, 0],
          [-W - 2 + sway, 26],
          [-W - 10 + sway, 22],
        ],
        P(pal.top).shade,
        1.8,
      );
      break;
    case 'gunslinger-rose': {
      // 권총집
      ctx.save();
      ctx.translate(-W * 0.6, 4);
      ctx.rotate(0.15);
      ctx.beginPath();
      ctx.roundRect(-5, 0, 10, 20, 3);
      fillStroke(ctx, P('#4a2a14').base, 1.6);
      poly(
        ctx,
        [
          [-2, -6],
          [3, -6],
          [3, 2],
          [-2, 2],
        ],
        tint ?? '#3a3a44',
        1.2,
      );
      ctx.restore();
      break;
    }
    case 'shadow-crow': {
      // 너덜너덜한 로브 앞자락
      const p = P(pal.top);
      poly(
        ctx,
        [
          [-W, 0],
          [W + 2, 0],
          [W + 6 + flare, 30],
          [W - 2, 24],
          [W - 6 + sway, 38],
          [-2, 26],
          [-W - 4 + sway, 34],
        ],
        vgrad(
          ctx,
          0,
          38,
          [
            [0, p.base],
            [1, p.deep],
          ],
          tint,
        ),
        2,
      );
      line(
        ctx,
        [
          [W + 2, 0],
          [W + 6 + flare, 30],
        ],
        tint ?? pal.accent,
        1.6,
      );
      break;
    }
    case 'alchemist-z': {
      // 가운 자락
      const p = P(pal.top);
      poly(
        ctx,
        [
          [-W - 3, -2],
          [W + 4, -2],
          [W + 10 + flare, 34],
          [W * 0.2, 38],
          [-W - 8 + sway, 36],
        ],
        vgrad(
          ctx,
          0,
          38,
          [
            [0, p.base],
            [1, p.shade],
          ],
          tint,
        ),
        2,
      );
      line(
        ctx,
        [
          [W * 0.4, -2],
          [W * 0.2, 38],
        ],
        tint ?? '#b8b8b0',
        1.4,
      );
      break;
    }
    case 'blood-hound': {
      const p = P(pal.accent);
      poly(
        ctx,
        [
          [-W * 0.4, 0],
          [W * 0.8, 0],
          [W * 0.7 + sway, 32],
          [W * 0.15, 28],
          [-W * 0.3 + sway, 34],
        ],
        vgrad(
          ctx,
          0,
          34,
          [
            [0, p.base],
            [1, p.shade],
          ],
          tint,
        ),
        1.8,
      );
      break;
    }
    case 'frost-samurai': {
      // 오비 (허리띠) 매듭
      const p = P(pal.trim);
      poly(
        ctx,
        [
          [-W - 3, -8],
          [W + 3, -8],
          [W + 3, 3],
          [-W - 3, 3],
        ],
        p.base,
        1.8,
      );
      line(
        ctx,
        [
          [-W - 3, -3],
          [W + 3, -3],
        ],
        tint ?? pal.accent,
        1.4,
      );
      poly(
        ctx,
        [
          [-W, 0],
          [-W - 8, 20 + sway],
          [-W - 2, 22 + sway],
          [-W + 4, 2],
        ],
        p.shade,
        1.4,
      );
      break;
    }
    case 'iron-giant': {
      const p = P(pal.trim);
      for (const x of [-W * 0.95, W * 0.15]) {
        ctx.beginPath();
        ctx.roundRect(x, -2, W * 0.8, 18, 3);
        fillStroke(
          ctx,
          vgrad(
            ctx,
            -2,
            16,
            [
              [0, p.light],
              [1, p.shade],
            ],
            tint,
          ),
          2,
        );
      }
      break;
    }
    case 'neon-valkyrie': {
      // 판 치마 (갑옷)
      const p = P(pal.top);
      for (let i = 0; i < 3; i++) {
        const x = -W - 2 + i * W * 0.75;
        ctx.beginPath();
        ctx.moveTo(x, -1);
        ctx.lineTo(x + W * 0.8, -1);
        ctx.lineTo(x + W * 0.9 + flare, 20);
        ctx.lineTo(x - 1, 18);
        ctx.closePath();
        fillStroke(
          ctx,
          vgrad(
            ctx,
            0,
            20,
            [
              [0, p.light],
              [1, p.shade],
            ],
            tint,
          ),
          1.6,
        );
      }
      line(
        ctx,
        [
          [-W, 16],
          [W * 1.6, 16],
        ],
        tint ?? pal.accent,
        1.2,
      );
      break;
    }
    case 'puppet-lilith':
    case 'chainsaw-bella':
    case 'arcane-spectre': {
      // 치마
      const len = c.def.id === 'arcane-spectre' ? 34 : c.def.id === 'puppet-lilith' ? 24 : 20;
      const p = P(pal.bottom);
      const ragged = c.def.id === 'arcane-spectre';
      const hem = (l: number) => {
        ctx.beginPath();
        ctx.moveTo(-W - 1, -2);
        ctx.lineTo(W + 1, -2);
        ctx.quadraticCurveTo(W + 8 + flare, l * 0.6, W + 12 + flare, l);
        const n = 7;
        for (let i = 1; i <= n; i++) {
          const x = lerp(W + 12 + flare, -W - 12 - flare * 0.5 + sway, i / n);
          const y = l + (i % 2 === 0 ? 0 : ragged ? 8 : 3);
          ctx.lineTo(x, y);
        }
        ctx.quadraticCurveTo(-W - 8, l * 0.6, -W - 1, -2);
        ctx.closePath();
      };
      if (c.def.id === 'puppet-lilith') {
        hem(len + 5);
        fillStroke(ctx, tint ?? pal.trim, 1.6);
      }
      hem(len);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -2,
          len,
          [
            [0, p.light],
            [0.4, p.base],
            [1, p.shade],
          ],
          tint,
        ),
        2,
      );
      if (!tint) {
        ctx.strokeStyle = p.deep;
        ctx.lineWidth = 1.1;
        for (let i = 1; i < 5; i++) {
          const x = lerp(-W, W, i / 5);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x * 1.5 + flare * (i / 5), len - 1);
          ctx.stroke();
        }
        if (c.def.id === 'chainsaw-bella')
          line(
            ctx,
            [
              [-W - 6, len - 4],
              [W + 9 + flare, len - 4],
            ],
            pal.accent,
            2,
          );
        if (ragged)
          for (let i = 0; i < 3; i++) star(ctx, lerp(-W, W + 6, i / 2), len - 8, 2.4, pal.trim);
      }
      break;
    }
    case 'bolt-master':
    case 'phantom-dj': {
      // 체인 · 네온 허리 장식
      ctx.strokeStyle = tint ?? (c.def.id === 'phantom-dj' ? '#d8d8e0' : pal.trim);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-W * 0.6, 0);
      ctx.quadraticCurveTo(-W * 0.2, 14, W * 0.5, 2);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/* ---------------- 머리 ---------------- */

function facePath(ctx: CanvasRenderingContext2D, male: boolean) {
  const pts: V[] = male
    ? [
        [-12, 4],
        [-13, -6],
        [-9, -13],
        [0, -15],
        [8, -13],
        [12, -7],
        [12.5, -2],
        [14.5, 2],
        [12.6, 4.2],
        [12.6, 7],
        [11, 10.5],
        [5, 12.5],
        [-3, 10.5],
        [-8, 8],
      ]
    : [
        [-12, 4],
        [-13, -6],
        [-9, -13],
        [0, -15],
        [8, -13],
        [12, -7],
        [12, -2],
        [13.6, 2],
        [12, 4],
        [11.6, 6.6],
        [8.5, 10.4],
        [3, 11.2],
        [-4, 9.4],
        [-8, 7],
      ];
  smoothPath(ctx, pts);
}

function drawHead(ctx: CanvasRenderingContext2D, c: Ctx) {
  const { r, pose, pal, tint } = c;
  const [hx, hy] = r.head;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(pose.lean + pose.head);

  hairBack(ctx, c);

  if (c.robot) {
    robotHead(ctx, c);
    ctx.restore();
    return;
  }

  const skin = c.P(pal.skin);
  facePath(ctx, c.male);
  ctx.fillStyle = skin.base;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // 얼굴 그늘 (뒤쪽 · 턱 아래)
  ctx.fillStyle = skin.shade;
  ctx.beginPath();
  ctx.ellipse(-9, 2, 9, 16, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(-14, 9, 30, 6);
  if (!c.male && !tint) {
    ctx.fillStyle = 'rgba(255,110,130,0.28)';
    ctx.beginPath();
    ctx.ellipse(7, 4.5, 3.5, 2, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  facePath(ctx, c.male);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // 귀
  ctx.beginPath();
  ctx.ellipse(-2.5, 1, 3, 4, 0.2, 0, TAU);
  fillStroke(ctx, skin.base, 1.6);
  line(
    ctx,
    [
      [-2.5, -1.5],
      [-1.5, 2.5],
    ],
    tint ?? skin.deep,
    1,
  );

  if (c.st.puppet) puppetFace(ctx, tint);
  else face(ctx, c);
  hairFront(ctx, c);
  ctx.restore();
}

/** 눈 · 눈썹 · 코 · 입 (표정) */
function face(ctx: CanvasRenderingContext2D, c: Ctx) {
  const { pal, tint, male } = c;
  const expr = c.st.expr ?? 'normal';
  const visor = ['mohawk', 'headphones', 'helmet'].includes(c.def.hair);
  const hood = c.def.hair === 'hood';
  const cat = c.def.id === 'violet-cat';

  // 코
  line(
    ctx,
    [
      [12.8, -0.5],
      [14.3, 2.6],
      [12.3, 3.4],
    ],
    tint ?? 'rgba(14,8,18,0.7)',
    1.2,
  );

  if (!visor && !hood) {
    const ex = 6.6;
    const ey = -2;
    if (expr === 'pain') {
      line(
        ctx,
        [
          [ex - 3, ey - 2],
          [ex + 2, ey],
          [ex - 3, ey + 2],
        ],
        tint ?? INK,
        1.8,
      );
    } else if (expr === 'ko') {
      line(
        ctx,
        [
          [ex - 3, ey - 3],
          [ex + 3, ey + 3],
        ],
        tint ?? INK,
        1.8,
      );
      line(
        ctx,
        [
          [ex + 3, ey - 3],
          [ex - 3, ey + 3],
        ],
        tint ?? INK,
        1.8,
      );
    } else {
      const ew = male ? 6.2 : 7.2;
      const eh = male ? 3.4 : 4.6;
      ctx.beginPath();
      ctx.moveTo(ex - ew / 2, ey + 0.4);
      ctx.quadraticCurveTo(ex, ey - eh, ex + ew / 2, ey - 0.6);
      ctx.quadraticCurveTo(ex, ey + eh * 0.55, ex - ew / 2, ey + 0.4);
      ctx.closePath();
      ctx.fillStyle = tint ?? '#fbf8ff';
      ctx.fill();
      ctx.save();
      ctx.clip();
      const ir = male ? 2.2 : 2.7;
      circle(ctx, ex + 1.2, ey - 0.3, ir, tint ?? pal.eye, 0);
      if (cat) {
        ctx.fillStyle = tint ?? INK;
        ctx.fillRect(ex + 0.8, ey - 2.8, 0.9, 5);
      } else {
        circle(ctx, ex + 1.4, ey - 0.3, ir * 0.48, tint ?? INK, 0);
      }
      circle(ctx, ex + 0.4, ey - 1.4, 0.9, tint ?? '#ffffff', 0);
      ctx.restore();
      // 윗눈꺼풀 (속눈썹)
      ctx.strokeStyle = tint ?? INK;
      ctx.lineWidth = male ? 1.6 : 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - ew / 2 - 0.4, ey + 0.4);
      ctx.quadraticCurveTo(ex, ey - eh - 0.2, ex + ew / 2 + 0.4, ey - 0.8);
      if (!male) ctx.lineTo(ex + ew / 2 + 2, ey - 2.4);
      ctx.stroke();
    }
    // 눈썹 — 앞쪽이 내려간 매서운 눈썹
    const fierce = expr === 'shout' ? 1.6 : expr === 'pain' ? -1.6 : 0;
    const light = ['#f2f2f2', '#e8e8f0', '#f2f2ff', '#a8a8b8', '#ffe8a0'].includes(pal.hair);
    ctx.strokeStyle = tint ?? (light ? '#6a6a78' : pal.hair);
    ctx.lineWidth = male ? 2.6 : 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(2.4, -7 - fierce * 0.4);
    ctx.quadraticCurveTo(6.5, -9 + (male ? 0.4 : -0.8), 10.6, -5.6 + fierce);
    ctx.stroke();
  }

  // 입
  const mx = 11.2;
  const my = 7.2;
  if (expr === 'shout' || expr === 'ko') {
    ctx.beginPath();
    ctx.moveTo(mx - 3.5, my - 1.2);
    ctx.lineTo(mx + 1.4, my - 1.6);
    ctx.lineTo(mx + 0.6, my + 2.6);
    ctx.quadraticCurveTo(mx - 2, my + 3.2, mx - 3.5, my - 1.2);
    ctx.closePath();
    fillStroke(ctx, tint ?? '#5a0a1a', 1.2);
    ctx.fillStyle = tint ?? '#ffffff';
    ctx.fillRect(mx - 3, my - 1.4, 4, 1.2);
    if (cat && !tint)
      poly(
        ctx,
        [
          [mx - 1, my - 0.4],
          [mx, my - 0.4],
          [mx - 0.5, my + 1.4],
        ],
        '#ffffff',
        0,
      );
  } else if (expr === 'pain') {
    line(
      ctx,
      [
        [mx - 3.4, my],
        [mx - 2, my - 1],
        [mx - 0.6, my],
        [mx + 0.8, my - 1],
      ],
      tint ?? INK,
      1.3,
    );
  } else {
    line(
      ctx,
      [
        [mx - 3.2, my + 0.2],
        [mx + 0.8, my - 0.4],
      ],
      tint ?? INK,
      1.3,
    );
    if (cat && !tint)
      poly(
        ctx,
        [
          [mx - 1.2, my],
          [mx - 0.2, my],
          [mx - 0.7, my + 1.5],
        ],
        '#ffffff',
        0,
      );
  }
}

function puppetFace(ctx: CanvasRenderingContext2D, tint: string | null) {
  // 단추 눈 · 꿰맨 입
  for (const x of [3.5, 9.5]) {
    circle(ctx, x, -2, 3.2, tint ?? '#1a1020', 1.2);
    if (!tint) {
      circle(ctx, x - 0.9, -2.6, 0.7, '#5a4a5a', 0);
      circle(ctx, x + 0.9, -1.4, 0.7, '#5a4a5a', 0);
    }
  }
  line(
    ctx,
    [
      [2, 7],
      [12, 6],
    ],
    tint ?? '#ff2a5a',
    1.4,
  );
  ctx.strokeStyle = tint ?? '#ff2a5a';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let x = 3; x < 12; x += 2.4) {
    ctx.moveTo(x, 4.8);
    ctx.lineTo(x + 0.6, 8.4);
  }
  ctx.stroke();
}

function robotHead(ctx: CanvasRenderingContext2D, c: Ctx) {
  const { pal, tint, t } = c;
  const m = c.P(pal.skin);
  ctx.beginPath();
  ctx.moveTo(-13, 10);
  ctx.lineTo(-14, -8);
  ctx.quadraticCurveTo(-12, -17, 0, -17);
  ctx.quadraticCurveTo(13, -17, 15, -8);
  ctx.lineTo(16, 4);
  ctx.lineTo(11, 12);
  ctx.lineTo(-6, 13);
  ctx.closePath();
  fillStroke(
    ctx,
    vgrad(
      ctx,
      -17,
      13,
      [
        [0, m.light],
        [0.5, m.base],
        [1, m.shade],
      ],
      tint,
    ),
    2.4,
  );
  // 이마 판 · 턱 판
  poly(
    ctx,
    [
      [-10, -15],
      [12, -15],
      [14, -10],
      [-11, -10],
    ],
    c.P(pal.trim).base,
    1.6,
  );
  poly(
    ctx,
    [
      [2, 6],
      [15, 4],
      [11, 12],
      [2, 12],
    ],
    c.P(pal.hair).base,
    1.6,
  );
  ctx.fillStyle = tint ?? INK;
  for (let i = 0; i < 3; i++) ctx.fillRect(4 + i * 3, 7.5, 1.6, 3.2);
  // 바이저
  poly(
    ctx,
    [
      [-2, -7],
      [16, -7],
      [16, 1],
      [-2, 1],
    ],
    tint ?? '#0a0608',
    1.6,
  );
  if (!tint) {
    ctx.shadowColor = pal.eye;
    ctx.shadowBlur = 10;
    const scan = Math.sin(t * 2) * 3;
    ctx.fillStyle = pal.eye;
    ctx.fillRect(4 + scan, -5, 9, 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(5 + scan, -4.6, 3, 1.2);
  }
  // 귀 볼트 · 안테나
  circle(ctx, -6, -1, 4.5, c.P(pal.trim).base, 1.8);
  circle(ctx, -6, -1, 1.6, tint ?? pal.accent, 0);
  line(
    ctx,
    [
      [-8, -16],
      [-12, -27],
    ],
    tint ?? pal.trim,
    2.2,
  );
  circle(ctx, -12, -28, 2.6, tint ?? pal.accent, 1.4);
}

function hairGrad(ctx: CanvasRenderingContext2D, c: Ctx, y0: number, y1: number): Fill {
  const p = c.P(c.pal.hair);
  return vgrad(
    ctx,
    y0,
    y1,
    [
      [0, p.light],
      [0.45, p.base],
      [1, p.shade],
    ],
    c.tint,
  );
}

function shine(ctx: CanvasRenderingContext2D, c: Ctx, pts: readonly V[], width = 1.6) {
  if (c.tint) return;
  ctx.save();
  ctx.globalAlpha *= 0.75;
  line(ctx, pts, tone(c.pal.hair).light, width);
  ctx.restore();
}

function hairBack(ctx: CanvasRenderingContext2D, c: Ctx) {
  const { pal, t } = c;
  const sway = Math.sin(t * 2.4) * 3;
  const hg = hairGrad(ctx, c, -16, 40);
  switch (c.def.hair) {
    case 'spiky':
      // 길게 휘날리는 뒷머리
      poly(
        ctx,
        [
          [-6, -12],
          [-22, -8],
          [-34, 2 + sway],
          [-24, 2],
          [-38, 14 + sway],
          [-22, 9],
          [-30, 24 + sway],
          [-14, 12],
          [-8, 6],
        ],
        hg,
      );
      shine(ctx, c, [
        [-12, -6],
        [-26, 0 + sway],
      ]);
      break;
    case 'wild':
      poly(
        ctx,
        [
          [-4, -14],
          [-20, -8],
          [-26, 10 + sway],
          [-18, 6],
          [-24, 26 + sway],
          [-12, 14],
          [-14, 34 + sway],
          [-4, 16],
          [0, 8],
        ],
        hg,
      );
      shine(ctx, c, [
        [-12, -6],
        [-18, 10 + sway],
      ]);
      break;
    case 'twinTails':
      for (const s of [0, 1]) {
        ctx.save();
        ctx.translate(-8 + s * 3, -11);
        ctx.rotate(0.35 + s * 0.12 + Math.sin(t * 2.4 + s) * 0.06);
        smoothPath(ctx, [
          [0, -3],
          [-9, 4],
          [-15, 22],
          [-12, 40],
          [-4, 52],
          [-2, 36],
          [4, 18],
          [5, 4],
        ]);
        fillStroke(ctx, hairGrad(ctx, c, -3, 52), 2.2);
        shine(ctx, c, [
          [-6, 8],
          [-10, 26],
        ]);
        poly(
          ctx,
          [
            [-2, -4],
            [-10, -10],
            [-8, 2],
          ],
          c.tint ?? pal.accent,
          1.6,
        );
        poly(
          ctx,
          [
            [-2, -4],
            [6, -10],
            [5, 2],
          ],
          c.tint ?? pal.accent,
          1.6,
        );
        ctx.restore();
      }
      break;
    case 'longRose':
      smoothPath(ctx, [
        [4, -15],
        [-10, -14],
        [-16, 0],
        [-17, 22 + sway],
        [-12, 42 + sway],
        [-2, 46 + sway],
        [-4, 30],
        [0, 10],
        [-2, 0],
      ]);
      fillStroke(ctx, hairGrad(ctx, c, -15, 46), 2.2);
      shine(ctx, c, [
        [-10, -2],
        [-12, 20 + sway],
        [-8, 36 + sway],
      ]);
      break;
    case 'cowboy':
      smoothPath(ctx, [
        [-10, -6],
        [-18, 2],
        [-20, 18 + sway],
        [-14, 30 + sway],
        [-10, 22],
        [-8, 6],
      ]);
      fillStroke(ctx, hairGrad(ctx, c, -6, 30), 2);
      break;
    case 'helmet':
      smoothPath(ctx, [
        [-10, -8],
        [-20, 4],
        [-24, 22 + sway],
        [-14, 32 + sway],
        [-10, 18],
        [-4, 6],
      ]);
      fillStroke(ctx, hairGrad(ctx, c, -8, 32), 2);
      shine(ctx, c, [
        [-14, 2],
        [-18, 18 + sway],
      ]);
      break;
    case 'hood': {
      const hp = c.P(pal.top);
      smoothPath(ctx, [
        [-14, -14],
        [-24, -4],
        [-26, 14],
        [-14, 18],
        [10, 16],
        [16, -8],
        [6, -20],
      ]);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -20,
          18,
          [
            [0, hp.base],
            [1, hp.deep],
          ],
          c.tint,
        ),
        2.4,
      );
      break;
    }
    case 'witchHat':
      smoothPath(ctx, [
        [-8, -10],
        [-18, 0],
        [-20, 20 + sway],
        [-12, 30 + sway],
        [-6, 14],
        [0, 4],
      ]);
      fillStroke(ctx, hairGrad(ctx, c, -10, 30), 2);
      break;
    case 'goggles':
      smoothPath(ctx, [
        [-4, -16],
        [-16, -14],
        [-22, -4],
        [-18, 8],
        [-8, 8],
      ]);
      fillStroke(ctx, hg, 2);
      break;
    default:
      break;
  }
}

function hairFront(ctx: CanvasRenderingContext2D, c: Ctx) {
  const { pal, tint, t } = c;
  const hg = hairGrad(ctx, c, -24, 4);
  switch (c.def.hair) {
    case 'spiky': {
      poly(
        ctx,
        [
          [-13, 3],
          [-15, -7],
          [-11, -12],
          [-15, -19],
          [-5, -16],
          [-3, -25],
          [3, -16],
          [10, -22],
          [9, -14],
          [17, -14],
          [12, -8],
          [5, -10],
          [-2, -7],
          [-7, -2],
        ],
        hg,
      );
      shine(ctx, c, [
        [-6, -12],
        [2, -14],
        [8, -12],
      ]);
      // 머리띠 + 휘날리는 끈
      const band = c.P(pal.top);
      poly(
        ctx,
        [
          [-13, -9],
          [13.5, -7],
          [13, -3],
          [-13, -5],
        ],
        band.base,
        1.8,
      );
      const w1 = Math.sin(t * 7) * 4;
      const w2 = Math.sin(t * 7 + 1) * 6;
      ctx.beginPath();
      ctx.moveTo(-13, -8);
      ctx.quadraticCurveTo(-24, -6 + w1, -34, 0 + w2);
      ctx.lineTo(-33, 4 + w2);
      ctx.quadraticCurveTo(-24, -1 + w1, -13, -4);
      ctx.closePath();
      fillStroke(ctx, band.shade, 1.8);
      break;
    }
    case 'hood': {
      // 후드 테두리 · 그림자 속 얼굴 · 해골 가면
      ctx.save();
      facePath(ctx, true);
      ctx.clip();
      ctx.fillStyle = tint ?? 'rgba(6,2,12,0.82)';
      ctx.fillRect(-16, -18, 34, 20);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.quadraticCurveTo(14, -16, -2, -18);
      ctx.quadraticCurveTo(-18, -18, -17, 0);
      ctx.lineTo(-17, 14);
      ctx.lineTo(-10, 14);
      ctx.quadraticCurveTo(-12, -10, 0, -12);
      ctx.quadraticCurveTo(11, -11, 11, 2);
      ctx.closePath();
      const hp = c.P(pal.top);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -18,
          14,
          [
            [0, hp.light],
            [0.4, hp.base],
            [1, hp.shade],
          ],
          tint,
        ),
        2.2,
      );
      poly(
        ctx,
        [
          [4, 2],
          [14, 1],
          [13, 9],
          [6, 12],
          [3, 8],
        ],
        tint ?? '#d8d0e0',
        1.6,
      );
      ctx.fillStyle = tint ?? INK;
      for (let i = 0; i < 3; i++) ctx.fillRect(6 + i * 2.5, 5.5, 1.2, 4);
      if (!tint) {
        ctx.shadowColor = pal.eye;
        ctx.shadowBlur = 10;
      }
      poly(
        ctx,
        [
          [4, -4],
          [11, -3],
          [10, -1],
          [5, -1.5],
        ],
        tint ?? pal.eye,
        0,
      );
      ctx.shadowBlur = 0;
      break;
    }
    case 'mohawk': {
      // 옆머리 밀고 · 닭벼슬 · 고글
      ctx.save();
      facePath(ctx, true);
      ctx.clip();
      ctx.fillStyle = tint ?? 'rgba(30,40,50,0.45)';
      ctx.fillRect(-16, -18, 30, 10);
      ctx.restore();
      if (!tint) {
        ctx.shadowColor = pal.hair;
        ctx.shadowBlur = 8;
      }
      poly(
        ctx,
        [
          [-12, -9],
          [-12, -18],
          [-6, -14],
          [-5, -26],
          [0, -16],
          [3, -28],
          [6, -15],
          [11, -24],
          [10, -12],
          [14, -14],
          [11, -8],
        ],
        hg,
      );
      ctx.shadowBlur = 0;
      shine(ctx, c, [
        [-3, -15],
        [2, -20],
      ]);
      ctx.beginPath();
      ctx.roundRect(1, -6, 16, 6, 2);
      fillStroke(
        ctx,
        hgrad(
          ctx,
          1,
          17,
          [
            [0, tone(pal.accent).shade],
            [0.6, pal.accent],
            [1, '#ffffff'],
          ],
          tint,
        ),
        1.8,
      );
      line(
        ctx,
        [
          [1, -3],
          [-12, -4],
        ],
        tint ?? INK,
        2,
      );
      circle(ctx, -3, 2, 2.6, tint ?? pal.trim, 1.2);
      break;
    }
    case 'headphones': {
      // 짧은 머리 · 큰 헤드폰 · 선글라스
      smoothPath(ctx, [
        [-13, 0],
        [-13, -10],
        [-6, -17],
        [6, -17],
        [13, -11],
        [13, -6],
        [2, -9],
        [-6, -6],
      ]);
      fillStroke(ctx, hg, 2);
      const ac = c.P(pal.accent);
      ctx.beginPath();
      ctx.arc(-1, -2, 16, Math.PI * 1.02, Math.PI * 1.98);
      ctx.strokeStyle = tint ?? INK;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = ac.base;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-4, 1, 7, 8.5, 0, 0, TAU);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -8,
          10,
          [
            [0, ac.light],
            [0.5, ac.base],
            [1, ac.shade],
          ],
          tint,
        ),
        2.2,
      );
      if (!tint) {
        ctx.shadowColor = pal.trim;
        ctx.shadowBlur = 8;
      }
      circle(ctx, -4, 1, 3.6, tint ?? pal.trim, 1.2);
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(2, -5);
      ctx.lineTo(15, -5);
      ctx.lineTo(14, 0);
      ctx.lineTo(4, 0);
      ctx.closePath();
      fillStroke(
        ctx,
        hgrad(
          ctx,
          2,
          15,
          [
            [0, '#0a0610'],
            [0.7, '#2a1a40'],
            [1, pal.trim],
          ],
          tint,
        ),
        1.6,
      );
      break;
    }
    case 'wild': {
      poly(
        ctx,
        [
          [-13, 2],
          [-16, -10],
          [-8, -17],
          [2, -18],
          [10, -16],
          [16, -9],
          [11, -10],
          [13, -3],
          [6, -9],
          [2, -4],
          [-3, -9],
          [-6, -2],
        ],
        hg,
      );
      shine(ctx, c, [
        [-8, -12],
        [2, -15],
        [10, -12],
      ]);
      // 철 가면 (입)
      poly(
        ctx,
        [
          [5, 3],
          [14, 2],
          [13.5, 10],
          [7, 12],
          [4, 9],
        ],
        hgrad(
          ctx,
          4,
          14,
          [
            [0, '#6a6a74'],
            [1, '#d8d8e0'],
          ],
          tint,
        ),
        1.8,
      );
      ctx.fillStyle = tint ?? INK;
      for (let i = 0; i < 3; i++) ctx.fillRect(7, 5 + i * 2.2, 6, 0.9);
      break;
    }
    case 'goggles': {
      smoothPath(ctx, [
        [-14, 2],
        [-17, -10],
        [-12, -19],
        [-2, -22],
        [8, -21],
        [16, -14],
        [16, -7],
        [10, -9],
        [4, -8],
        [-4, -6],
      ]);
      fillStroke(ctx, hg, 2.2);
      shine(ctx, c, [
        [-8, -15],
        [4, -17],
      ]);
      line(
        ctx,
        [
          [-14, -5],
          [14, -4],
        ],
        tint ?? '#3a2a1a',
        3,
      );
      ctx.beginPath();
      ctx.ellipse(8, -3, 5.5, 4.8, 0, 0, TAU);
      fillStroke(ctx, tint ?? '#8a6a3a', 2);
      if (!tint) {
        ctx.shadowColor = pal.accent;
        ctx.shadowBlur = 10;
      }
      circle(ctx, 8, -3, 3.6, tint ?? pal.accent, 1.2);
      ctx.shadowBlur = 0;
      if (!tint) circle(ctx, 6.6, -4.4, 1.1, '#ffffff', 0);
      break;
    }
    case 'topknot': {
      smoothPath(ctx, [
        [-13, 3],
        [-14, -9],
        [-7, -16],
        [4, -16],
        [12, -12],
        [13, -6],
        [6, -9],
        [-2, -8],
        [-8, -3],
      ]);
      fillStroke(ctx, hg, 2);
      shine(ctx, c, [
        [-6, -13],
        [4, -14],
      ]);
      circle(ctx, -6, -19, 5.5, hg, 2);
      line(
        ctx,
        [
          [-10, -18],
          [-2, -20],
        ],
        tint ?? pal.accent,
        1.8,
      );
      ctx.beginPath();
      ctx.moveTo(8, -10);
      ctx.quadraticCurveTo(14, -2, 11, 6 + Math.sin(t * 3) * 1.5);
      ctx.strokeStyle = tint ?? pal.hair;
      ctx.lineWidth = 2;
      ctx.stroke();
      poly(
        ctx,
        [
          [-13, -9],
          [13, -8],
          [13, -5],
          [-13, -6],
        ],
        c.P(pal.accent).base,
        1.4,
      );
      break;
    }
    case 'catEars': {
      smoothPath(ctx, [
        [-13, 6],
        [-15, -8],
        [-8, -16],
        [4, -16],
        [12, -11],
        [14, -2],
        [11, -6],
        [8, -2],
        [6, -7],
        [2, -5],
        [-1, -9],
        [-6, -4],
      ]);
      fillStroke(ctx, hg, 2);
      shine(ctx, c, [
        [-8, -12],
        [2, -14],
      ]);
      const ear = (x: number, tilt: number) => {
        ctx.save();
        ctx.translate(x, -14);
        ctx.rotate(tilt + Math.sin(t * 3 + x) * 0.05);
        poly(
          ctx,
          [
            [-6, 2],
            [0, -15],
            [6, 2],
          ],
          hg,
          2,
        );
        poly(
          ctx,
          [
            [-3, 0],
            [0, -9],
            [3, 0],
          ],
          tint ?? pal.trim,
          0,
        );
        ctx.restore();
      };
      ear(-7, -0.35);
      ear(5, 0.2);
      break;
    }
    case 'twinTails':
      smoothPath(ctx, [
        [-13, 4],
        [-14, -9],
        [-7, -16],
        [5, -16],
        [12, -11],
        [13, -2],
        [10, -5],
        [7, -5],
        [4, -7],
        [0, -5],
        [-4, -8],
        [-8, -3],
      ]);
      fillStroke(ctx, hg, 2);
      shine(ctx, c, [
        [-6, -13],
        [5, -14],
      ]);
      break;
    case 'helmet': {
      // 날개 투구 · 네온 바이저
      const m = c.P(pal.top);
      ctx.beginPath();
      ctx.moveTo(-14, 6);
      ctx.lineTo(-15, -6);
      ctx.quadraticCurveTo(-12, -18, 1, -18);
      ctx.quadraticCurveTo(14, -17, 15, -6);
      ctx.lineTo(15, -1);
      ctx.lineTo(4, -1);
      ctx.lineTo(1, 6);
      ctx.closePath();
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -18,
          6,
          [
            [0, '#ffffff'],
            [0.5, m.base],
            [1, m.shade],
          ],
          tint,
        ),
        2.2,
      );
      if (!tint) {
        ctx.shadowColor = pal.accent;
        ctx.shadowBlur = 10;
      }
      poly(
        ctx,
        [
          [3, -7],
          [16, -6],
          [15, -2],
          [3, -2],
        ],
        tint ?? pal.accent,
        1.4,
      );
      ctx.shadowBlur = 0;
      const trim = c.P(pal.trim);
      for (let i = 0; i < 3; i++) {
        poly(
          ctx,
          [
            [-8, -12 + i * 3],
            [-22 - i * 4, -24 + i * 4],
            [-18 - i * 4, -16 + i * 4],
            [-10, -9 + i * 3],
          ],
          i === 0 ? (tint ?? '#ffffff') : trim.light,
          1.4,
        );
      }
      break;
    }
    case 'longRose':
      smoothPath(ctx, [
        [-13, 6],
        [-15, -8],
        [-8, -16],
        [4, -16],
        [13, -10],
        [15, 0],
        [12, -3],
        [8, -8],
        [0, -9],
        [-6, -4],
      ]);
      fillStroke(ctx, hg, 2);
      shine(ctx, c, [
        [-8, -12],
        [4, -14],
        [11, -8],
      ]);
      rose(ctx, -9, -11, 4.5, tint, pal.accent);
      poly(
        ctx,
        [
          [-13, -9],
          [-17, -13],
          [-12, -12],
        ],
        tint ?? pal.trim,
        1.2,
      );
      break;
    case 'bob': {
      // 일자 앞머리 단발 · 머리핀 · 반창고
      smoothPath(ctx, [
        [-14, 10],
        [-16, -6],
        [-9, -16],
        [4, -17],
        [13, -12],
        [14, -4],
        [12, -5],
        [12, 4],
        [10, -5],
        [4, -5],
        [-2, -5],
        [-6, 2],
        [-8, 12],
      ]);
      fillStroke(ctx, hg, 2);
      shine(ctx, c, [
        [-10, -10],
        [2, -15],
      ]);
      line(
        ctx,
        [
          [-4, -12],
          [2, -9],
        ],
        tint ?? pal.accent,
        2.4,
      );
      if (!tint && !c.st.puppet) {
        poly(
          ctx,
          [
            [5, 3],
            [10, 2],
            [10, 5],
            [5, 6],
          ],
          '#f2d8c8',
          1,
        );
        line(
          ctx,
          [
            [7.5, 2.4],
            [7.5, 5.6],
          ],
          '#c8a898',
          0.8,
        );
      }
      break;
    }
    case 'witchHat': {
      smoothPath(ctx, [
        [-13, 4],
        [-14, -8],
        [-6, -15],
        [6, -15],
        [13, -9],
        [13, -2],
        [8, -6],
        [2, -6],
        [-4, -5],
      ]);
      fillStroke(ctx, hg, 2);
      const hat = c.P(pal.top);
      const tip = Math.sin(t * 2) * 4;
      poly(
        ctx,
        [
          [-12, -13],
          [-4 + tip, -46],
          [-22 + tip, -52],
          [-14 + tip, -42],
          [13, -13],
        ],
        vgrad(
          ctx,
          -52,
          -13,
          [
            [0, hat.light],
            [1, hat.shade],
          ],
          tint,
        ),
        2.2,
      );
      ctx.beginPath();
      ctx.ellipse(0, -13, 25, 5.5, -0.04, 0, TAU);
      fillStroke(ctx, hat.base, 2.2);
      poly(
        ctx,
        [
          [-11, -16],
          [12, -16],
          [12.5, -12.5],
          [-11.5, -12.5],
        ],
        tint ?? pal.trim,
        1.4,
      );
      if (!tint) {
        ctx.shadowColor = pal.accent;
        ctx.shadowBlur = 8;
      }
      circle(ctx, -3 + tip * 0.3, -24, 2.2, tint ?? pal.accent, 0);
      circle(ctx, 3 + tip * 0.3, -24, 2.2, tint ?? pal.accent, 0);
      ctx.shadowBlur = 0;
      line(
        ctx,
        [
          [-3 + tip * 0.3, -19.5],
          [tip * 0.3, -18],
          [3 + tip * 0.3, -19.5],
        ],
        tint ?? pal.accent,
        1.2,
      );
      break;
    }
    case 'cowboy': {
      smoothPath(ctx, [
        [-13, 4],
        [-14, -8],
        [-4, -13],
        [8, -12],
        [13, -6],
        [12, 0],
        [7, -5],
        [0, -6],
        [-6, -3],
      ]);
      fillStroke(ctx, hg, 2);
      const hat = c.P('#7a4a24');
      ctx.beginPath();
      ctx.moveTo(-26, -9);
      ctx.quadraticCurveTo(0, -16, 26, -11);
      ctx.quadraticCurveTo(28, -7, 22, -8);
      ctx.quadraticCurveTo(0, -11, -22, -5);
      ctx.quadraticCurveTo(-28, -5, -26, -9);
      ctx.closePath();
      fillStroke(ctx, hat.base, 2.2);
      ctx.beginPath();
      ctx.moveTo(-11, -12);
      ctx.quadraticCurveTo(-12, -28, -4, -26);
      ctx.quadraticCurveTo(0, -22, 4, -26);
      ctx.quadraticCurveTo(12, -28, 11, -13);
      ctx.closePath();
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -28,
          -12,
          [
            [0, hat.light],
            [1, hat.shade],
          ],
          tint,
        ),
        2.2,
      );
      poly(
        ctx,
        [
          [-11, -16],
          [11, -16.5],
          [11, -13],
          [-11, -12.5],
        ],
        tint ?? pal.accent,
        1.2,
      );
      star(ctx, 2, -14.5, 2.2, tint ?? '#e8d8b0');
      break;
    }
    default:
      break;
  }
}

/* ---------------- 무기 ---------------- */

function drawWeapon(ctx: CanvasRenderingContext2D, c: Ctx, hand: V, a: number, back: boolean) {
  const { pal, tint, t, st, def } = c;
  if (c.st.puppet) return;
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(a);
  const glow = (col: string, blur: number) => {
    if (tint) return;
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
  };
  switch (def.weapon) {
    case 'greatsword': {
      // 손잡이 · 코등이 · 넓은 칼날 · 룬 · 불꽃
      poly(
        ctx,
        [
          [-14, -4],
          [-14, 4],
          [6, 4],
          [6, -4],
        ],
        tint ?? '#2a1a14',
        2,
      );
      ctx.strokeStyle = tint ?? '#5a3a24';
      ctx.lineWidth = 1.2;
      for (let x = -12; x < 5; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, -4);
        ctx.lineTo(x + 3, 4);
        ctx.stroke();
      }
      circle(ctx, -15, 0, 3.6, tint ?? pal.accent, 1.6);
      poly(
        ctx,
        [
          [5, -14],
          [11, -14],
          [13, -6],
          [13, 6],
          [11, 14],
          [5, 14],
        ],
        vgrad(
          ctx,
          -14,
          14,
          [
            [0, '#ffe08a'],
            [0.5, pal.accent],
            [1, '#8a4a10'],
          ],
          tint,
        ),
        2,
      );
      glow(def.glow, 8);
      poly(
        ctx,
        [
          [13, -9],
          [96, -8],
          [120, 0],
          [96, 8],
          [13, 9],
        ],
        steel(ctx, -9, 9, tint),
        2.4,
      );
      ctx.shadowBlur = 0;
      line(
        ctx,
        [
          [16, 0],
          [104, 0],
        ],
        tint ?? 'rgba(90,96,110,0.8)',
        1.4,
      );
      if (!tint) {
        ctx.fillStyle = def.color;
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 0.6 + Math.sin(t * 6 + i) * 0.3;
          ctx.fillRect(24 + i * 16, -4, 8, 2);
          ctx.fillRect(28 + i * 16, -6, 2, 6);
        }
        ctx.globalAlpha = 1;
        const fg = ctx.createLinearGradient(0, -24, 0, -6);
        fg.addColorStop(0, 'rgba(255,240,140,0)');
        fg.addColorStop(0.5, 'rgba(255,170,40,0.85)');
        fg.addColorStop(1, 'rgba(255,60,20,0.9)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(16, -8);
        for (let i = 0; i <= 9; i++)
          ctx.lineTo(16 + i * 11, -16 - Math.abs(Math.sin(t * 13 + i * 1.7)) * 10);
        ctx.lineTo(116, -3);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'scythe': {
      // 감긴 자루 · 해골 장식 · 휘어진 날
      line(
        ctx,
        [
          [-44, 0],
          [100, 0],
        ],
        tint ?? INK,
        7,
      );
      line(
        ctx,
        [
          [-44, 0],
          [100, 0],
        ],
        tint ?? '#2a2030',
        4.4,
      );
      ctx.strokeStyle = tint ?? pal.accent;
      ctx.lineWidth = 2;
      for (const x of [-30, 40, 80]) {
        ctx.beginPath();
        ctx.moveTo(x, -3);
        ctx.lineTo(x + 4, 3);
        ctx.stroke();
      }
      glow(def.glow, 14);
      ctx.beginPath();
      ctx.moveTo(96, -3);
      ctx.bezierCurveTo(84, -50, 40, -66, 6, -56);
      ctx.quadraticCurveTo(40, -48, 68, -26);
      ctx.quadraticCurveTo(88, -10, 100, 4);
      ctx.closePath();
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -64,
          4,
          [
            [0, '#ffffff'],
            [0.3, '#d8d0e8'],
            [0.75, '#8a80a0'],
            [1, '#3a3048'],
          ],
          tint,
        ),
        2.4,
      );
      ctx.shadowBlur = 0;
      line(
        ctx,
        [
          [20, -55],
          [70, -38],
          [94, -10],
        ],
        tint ?? 'rgba(255,255,255,0.8)',
        1.2,
      );
      circle(ctx, 100, 0, 6.5, tint ?? '#d8d0e8', 2);
      ctx.fillStyle = tint ?? INK;
      ctx.fillRect(97, -2, 2, 2);
      ctx.fillRect(101, -2, 2, 2);
      break;
    }
    case 'gauntlet': {
      // 기계 건틀릿 · 코일 · 전기
      const g = c.P('#2a3a4a');
      const s = back ? 0.92 : 1;
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.roundRect(-10, -10, 22, 20, 6);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -10,
          10,
          [
            [0, g.light],
            [0.5, g.base],
            [1, g.deep],
          ],
          tint,
        ),
        2.2,
      );
      glow(pal.accent, 14 + Math.sin(t * 12) * 4);
      ctx.beginPath();
      ctx.roundRect(4, -11, 12, 22, 5);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -11,
          11,
          [
            [0, '#ffffff'],
            [0.5, pal.accent],
            [1, tone(pal.accent).shade],
          ],
          tint,
        ),
        2,
      );
      ctx.shadowBlur = 0;
      ctx.strokeStyle = tint ?? INK;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(8, -6 + i * 6);
        ctx.lineTo(15, -6 + i * 6);
        ctx.stroke();
      }
      if (!tint) {
        for (const x of [-6, 0]) {
          ctx.strokeStyle = def.color;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.ellipse(x, 0, 2, 10.5, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a2 = t * 11 + i * 2.1;
          ctx.moveTo(14 + Math.cos(a2) * 6, Math.sin(a2) * 10);
          ctx.lineTo(18 + Math.cos(a2 + 0.6) * 14, Math.sin(a2 + 0.3) * 18);
          ctx.lineTo(16 + Math.cos(a2 + 1) * 20, Math.sin(a2 + 0.8) * 14);
        }
        ctx.stroke();
      }
      break;
    }
    case 'robotFist': {
      const m = c.P(pal.trim);
      ctx.beginPath();
      ctx.roundRect(-6, -14, 28, 28, 6);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -14,
          14,
          [
            [0, m.light],
            [0.5, m.base],
            [1, m.shade],
          ],
          tint,
        ),
        2.4,
      );
      ctx.strokeStyle = tint ?? INK;
      ctx.lineWidth = 1.4;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(14, -14 + i * 7);
        ctx.lineTo(22, -14 + i * 7);
        ctx.stroke();
      }
      poly(
        ctx,
        [
          [-8, -16],
          [2, -16],
          [2, 16],
          [-8, 16],
        ],
        c.P(pal.accent).base,
        1.8,
      );
      circle(ctx, 4, -8, 2, tint ?? '#e8eef4', 1);
      circle(ctx, 4, 8, 2, tint ?? '#e8eef4', 1);
      break;
    }
    case 'claws':
    case 'catClaw': {
      const long = def.weapon === 'claws';
      const len = long ? 40 : 22;
      if (long) {
        ctx.beginPath();
        ctx.roundRect(-4, -8, 14, 16, 3);
        fillStroke(ctx, c.P('#6a6a74').base, 1.8);
      }
      for (const dy of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(6, dy - 2);
        ctx.quadraticCurveTo(len * 0.55, dy - 6, len, dy - 3);
        ctx.quadraticCurveTo(len * 0.55, dy + 1, 6, dy + 2);
        ctx.closePath();
        fillStroke(
          ctx,
          long
            ? steel(ctx, dy - 6, dy + 2, tint)
            : vgrad(
                ctx,
                dy - 6,
                dy + 2,
                [
                  [0, '#ffffff'],
                  [0.5, pal.accent],
                  [1, tone(pal.accent).deep],
                ],
                tint,
              ),
          1.6,
        );
      }
      if (!long && !tint) {
        // 맹독 방울
        const drip = (t * 2) % 1;
        ctx.fillStyle = def.glow;
        ctx.globalAlpha *= 1 - drip;
        ctx.beginPath();
        ctx.arc(len - 2, 4 + drip * 10, 1.6, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'flask': {
      ctx.rotate(-a - 0.25);
      const flaskPath = () => {
        ctx.beginPath();
        ctx.moveTo(-2.5, -18);
        ctx.lineTo(2.5, -18);
        ctx.lineTo(2.5, -10);
        ctx.arc(0, -1, 9, -Math.PI / 2 + 0.3, Math.PI * 1.5 - 0.3);
        ctx.closePath();
      };
      flaskPath();
      ctx.fillStyle = tint ?? 'rgba(220,255,220,0.35)';
      ctx.fill();
      ctx.save();
      ctx.clip();
      glow(pal.accent, 12);
      ctx.fillStyle = tint ?? pal.accent;
      ctx.fillRect(-10, -3 + Math.sin(t * 5) * 1.2, 20, 14);
      ctx.shadowBlur = 0;
      if (!tint) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 3; i++) {
          const by = 6 - ((t * 14 + i * 5) % 12);
          ctx.beginPath();
          ctx.arc(-3 + i * 3, by, 1.2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      flaskPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      poly(
        ctx,
        [
          [-3.5, -22],
          [3.5, -22],
          [3, -17],
          [-3, -17],
        ],
        tint ?? '#a87a4a',
        1.4,
      );
      if (!tint)
        line(
          ctx,
          [
            [-5, -6],
            [-6, 2],
          ],
          'rgba(255,255,255,0.8)',
          1.4,
        );
      break;
    }
    case 'katana': {
      // 칼자루 감김 · 코등이 · 칼날 물결무늬
      poly(
        ctx,
        [
          [-16, -3.4],
          [-16, 3.4],
          [6, 3.4],
          [6, -3.4],
        ],
        tint ?? '#1a2a40',
        2,
      );
      ctx.fillStyle = tint ?? '#e8f2ff';
      for (let x = -14; x < 5; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 2.5, -3);
        ctx.lineTo(x + 5, 0);
        ctx.lineTo(x + 2.5, 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(7.5, 0, 2.6, 7.5, 0, 0, TAU);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -7.5,
          7.5,
          [
            [0, '#ffe08a'],
            [1, '#8a6a20'],
          ],
          tint,
        ),
        1.8,
      );
      glow(def.glow, 10);
      ctx.beginPath();
      ctx.moveTo(10, -3);
      ctx.quadraticCurveTo(60, -9, 104, -10);
      ctx.lineTo(98, -4);
      ctx.quadraticCurveTo(58, 1, 10, 3);
      ctx.closePath();
      fillStroke(ctx, steel(ctx, -10, 3, tint, '#e8f6ff'), 1.8);
      ctx.shadowBlur = 0;
      if (!tint) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(14, -1);
        for (let x = 14; x < 96; x += 6)
          ctx.quadraticCurveTo(x + 3, -3.5 - (x / 100) * 5, x + 6, -1.5 - (x / 100) * 5);
        ctx.stroke();
      }
      break;
    }
    case 'strings': {
      ctx.rotate(-a);
      ctx.strokeStyle = tint ?? 'rgba(255,220,235,0.65)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 2.5, 0);
        ctx.quadraticCurveTo(-20 + i * 4, -50, -36 + i * 6, -96 + Math.sin(t * 3 + i) * 4);
        ctx.stroke();
      }
      ctx.strokeStyle = tint ?? pal.accent;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(3, -2, 2.4, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'lance': {
      const s2 = c.P(pal.trim);
      line(
        ctx,
        [
          [-36, 0],
          [72, 0],
        ],
        tint ?? INK,
        7,
      );
      line(
        ctx,
        [
          [-36, 0],
          [72, 0],
        ],
        s2.light,
        4.2,
      );
      for (const x of [-20, 30])
        poly(
          ctx,
          [
            [x, -4],
            [x + 8, -4],
            [x + 8, 4],
            [x, 4],
          ],
          s2.shade,
          1.4,
        );
      glow(pal.accent, 16);
      ctx.beginPath();
      ctx.moveTo(66, -8);
      ctx.lineTo(112, 0);
      ctx.lineTo(66, 8);
      ctx.lineTo(72, 0);
      ctx.closePath();
      fillStroke(
        ctx,
        hgrad(
          ctx,
          66,
          112,
          [
            [0, pal.accent],
            [0.6, '#ffffff'],
            [1, pal.accent],
          ],
          tint,
        ),
        1.6,
      );
      ctx.shadowBlur = 0;
      poly(
        ctx,
        [
          [62, -12],
          [70, -3],
          [70, 3],
          [62, 12],
          [66, 0],
        ],
        s2.base,
        1.4,
      );
      break;
    }
    case 'whip': {
      // 손잡이 + 가시 채찍 (공격 중에는 쭉 뻗는다)
      ctx.beginPath();
      ctx.roundRect(-4, -3, 14, 6, 2);
      fillStroke(ctx, tint ?? '#1a0a12', 1.6);
      circle(ctx, -5, 0, 3, tint ?? pal.accent, 1.2);
      const active =
        st.activeK >= 0 && (st.anim === 'beam' || st.anim === 'kick' || st.anim === 'cKick');
      const len = active ? Math.max(60, st.reach) : 50;
      ctx.rotate(-a);
      const dirA = active ? a * 0.15 : a;
      const ex = Math.cos(dirA) * len;
      const ey = active ? Math.sin(dirA) * len * 0.25 : 34 + Math.sin(t * 3) * 4;
      const cy = active ? -18 - Math.sin(Math.max(0, st.activeK) * Math.PI) * 10 : 24;
      const sx = 8 * Math.cos(a);
      const sy = 8 * Math.sin(a);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(ex * 0.5, cy, ex, ey);
      ctx.strokeStyle = tint ?? INK;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = tint ?? pal.accent;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.fillStyle = tint ?? pal.trim;
      for (let i = 1; i < 9; i++) {
        const k = i / 9;
        const qx = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * ex * 0.5 + k * k * ex;
        const qy = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * cy + k * k * ey;
        ctx.beginPath();
        ctx.moveTo(qx - 2, qy);
        ctx.lineTo(qx, qy - 4);
        ctx.lineTo(qx + 2, qy);
        ctx.closePath();
        ctx.fill();
      }
      if (active && !tint) rose(ctx, ex, ey, 3.5, null, pal.accent);
      break;
    }
    case 'chainsaw': {
      // 엔진 몸체 · 경고 줄무늬 · 톱날 체인
      const bp = c.P(pal.accent);
      ctx.beginPath();
      ctx.roundRect(-10, -12, 30, 24, 5);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -12,
          12,
          [
            [0, bp.light],
            [0.5, bp.base],
            [1, bp.shade],
          ],
          tint,
        ),
        2.2,
      );
      if (!tint) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-8, 4, 26, 6);
        ctx.clip();
        ctx.fillStyle = INK;
        for (let x = -10; x < 22; x += 6) {
          ctx.beginPath();
          ctx.moveTo(x, 10);
          ctx.lineTo(x + 3, 4);
          ctx.lineTo(x + 6, 4);
          ctx.lineTo(x + 3, 10);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(-4, -14, 7, Math.PI, 0);
      ctx.strokeStyle = tint ?? INK;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(18, -7, 74, 14, 7);
      fillStroke(ctx, steel(ctx, -7, 7, tint), 2.2);
      ctx.fillStyle = tint ?? INK;
      const off = (t * 160) % 9;
      for (let x = 20; x < 90; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x + off, -7);
        ctx.lineTo(x + off + 3, -11);
        ctx.lineTo(x + off + 5, -7);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - off + 9, 7);
        ctx.lineTo(x - off + 6, 11);
        ctx.lineTo(x - off + 4, 7);
        ctx.fill();
      }
      if (!tint)
        line(
          ctx,
          [
            [22, -2],
            [86, -2],
          ],
          'rgba(255,255,255,0.6)',
          1.2,
        );
      break;
    }
    case 'staff': {
      // 꼬인 지팡이 · 초승달 · 영혼 구슬
      line(
        ctx,
        [
          [-40, 0],
          [54, 0],
        ],
        tint ?? INK,
        6.4,
      );
      line(
        ctx,
        [
          [-40, 0],
          [54, 0],
        ],
        tint ?? '#4a3a6a',
        4,
      );
      ctx.strokeStyle = tint ?? pal.trim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = -38; x < 52; x += 2) ctx.lineTo(x, Math.sin(x * 0.4) * 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(62, 0, 14, -2.2, 2.2);
      ctx.arc(66, 0, 10, 2, -2, true);
      ctx.closePath();
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -14,
          14,
          [
            [0, '#fff6c0'],
            [1, pal.trim],
          ],
          tint,
        ),
        1.8,
      );
      glow(pal.accent, 16);
      const pr = 6.5 + Math.sin(t * 5) * 0.8;
      if (tint) {
        circle(ctx, 62, 0, pr, tint, 1.6);
      } else {
        const g = ctx.createRadialGradient(60, -2, 1, 62, 0, pr);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, pal.accent);
        circle(ctx, 62, 0, pr, g, 1.6);
      }
      ctx.shadowBlur = 0;
      break;
    }
    case 'pistols': {
      // 리볼버 — 나무 손잡이 · 실린더 · 총열
      const m = c.P('#5a5a66');
      ctx.beginPath();
      ctx.moveTo(-3, 1);
      ctx.lineTo(6, 1);
      ctx.lineTo(8, 12);
      ctx.quadraticCurveTo(2, 14, -3, 12);
      ctx.closePath();
      fillStroke(ctx, tint ?? '#8a5a2a', 1.8);
      ctx.beginPath();
      ctx.roundRect(2, -6, 12, 9, 3);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -6,
          3,
          [
            [0, m.light],
            [1, m.shade],
          ],
          tint,
        ),
        1.8,
      );
      ctx.strokeStyle = tint ?? INK;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(5, -6);
      ctx.lineTo(5, 3);
      ctx.moveTo(9, -6);
      ctx.lineTo(9, 3);
      ctx.stroke();
      poly(
        ctx,
        [
          [13, -5],
          [32, -5],
          [32, -1],
          [13, -1],
        ],
        steel(ctx, -5, -1, tint),
        1.6,
      );
      poly(
        ctx,
        [
          [30, -7],
          [32, -7],
          [32, -5],
          [30, -5],
        ],
        tint ?? '#3a3a44',
        1,
      );
      line(
        ctx,
        [
          [1, -6],
          [-1, -9],
        ],
        tint ?? INK,
        1.6,
      );
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/* ---------------- 등 장식 ---------------- */

function drawBack(ctx: CanvasRenderingContext2D, c: Ctx, behind: boolean) {
  const { r, pose, pal, tint, t } = c;
  if (c.st.puppet) return;
  const n = r.neck;
  const h = r.hip;
  const sway = Math.sin(t * 3) * 4;
  const P = c.P;
  if (!behind) {
    if (c.def.back === 'poncho') {
      // 판초 — 몸 앞을 덮는다
      ctx.save();
      ctx.translate(n[0], n[1]);
      ctx.rotate(pose.lean);
      const pp = P(pal.accent);
      ctx.beginPath();
      ctx.moveTo(-17, 3);
      ctx.quadraticCurveTo(0, -3, 19, 3);
      ctx.lineTo(23, 26);
      ctx.lineTo(4, 34);
      ctx.lineTo(-18, 26);
      ctx.closePath();
      fillStroke(
        ctx,
        vgrad(
          ctx,
          0,
          34,
          [
            [0, pp.light],
            [0.5, pp.base],
            [1, pp.shade],
          ],
          tint,
        ),
        2.2,
      );
      if (!tint) {
        ctx.save();
        ctx.clip();
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i % 2 ? '#c8401a' : '#6a3a1a';
          ctx.beginPath();
          ctx.moveTo(-20, 14 + i * 5);
          let k = 0;
          for (let x = -20; x < 26; x += 6) {
            ctx.lineTo(x + 3, 14 + i * 5 + (k % 2 === 0 ? -3 : 3));
            k++;
          }
          ctx.lineTo(26, 18 + i * 5);
          ctx.lineTo(-20, 18 + i * 5);
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = pal.trim;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let x = -16; x < 22; x += 3) {
          const yy = x < 4 ? 26 + ((x + 18) / 22) * 8 : 34 - ((x - 4) / 19) * 8;
          ctx.moveTo(x, yy);
          ctx.lineTo(x, yy + 4);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (c.def.back === 'scarf') {
      ctx.save();
      ctx.translate(n[0], n[1]);
      ctx.rotate(pose.lean);
      ctx.beginPath();
      ctx.ellipse(1, 1, 9, 5, 0, 0, TAU);
      fillStroke(ctx, P(pal.accent).base, 2);
      ctx.restore();
    }
    return;
  }
  switch (c.def.back) {
    case 'chains': {
      ctx.strokeStyle = tint ?? '#9a90a8';
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        for (let k = 0; k < 8; k++) {
          const x = h[0] - 6 - k * 5 - i * 5;
          const y = h[1] + 2 + k * 3.6 + Math.sin(t * 3 + k * 0.6 + i) * 2;
          ctx.beginPath();
          ctx.ellipse(x, y, 3, 2, k % 2 ? 0.6 : -0.6, 0, TAU);
          ctx.stroke();
        }
      }
      break;
    }
    case 'speakers': {
      for (const dy of [0, 20]) {
        ctx.save();
        ctx.translate(n[0] - 24, n[1] + 8 + dy);
        ctx.rotate(pose.lean);
        ctx.beginPath();
        ctx.roundRect(-11, -10, 22, 20, 3);
        fillStroke(
          ctx,
          vgrad(
            ctx,
            -10,
            10,
            [
              [0, '#3a2a50'],
              [1, '#120a1a'],
            ],
            tint,
          ),
          2,
        );
        const pulse = 4.5 + Math.abs(Math.sin(t * 8 + dy)) * 2.5;
        if (!tint) {
          ctx.shadowColor = pal.accent;
          ctx.shadowBlur = 8;
        }
        circle(ctx, 0, 0, pulse + 2, tint ?? '#1a1024', 1.4);
        circle(ctx, 0, 0, pulse, tint ?? pal.accent, 0);
        ctx.shadowBlur = 0;
        circle(ctx, 0, 0, 2, tint ?? pal.trim, 0);
        ctx.restore();
      }
      break;
    }
    case 'tatteredCape':
    case 'ghostCape':
    case 'cape': {
      const ghost = c.def.back === 'ghostCape';
      const p = P(ghost ? pal.top : pal.accent);
      const w1 = Math.sin(t * 3.2) * 5;
      const w2 = Math.sin(t * 3.2 + 1.3) * 7;
      ctx.save();
      if (ghost) ctx.globalAlpha *= 0.9;
      ctx.beginPath();
      ctx.moveTo(n[0] - 4, n[1] + 1);
      ctx.lineTo(n[0] + 8, n[1] + 1);
      ctx.quadraticCurveTo(h[0] - 4, h[1] - 8, h[0] - 8 + w1, h[1] + 36);
      const pts: V[] = [
        [h[0] - 16 + w1, h[1] + 26],
        [h[0] - 22 + w2, h[1] + 42],
        [h[0] - 30 + w2, h[1] + 24],
        [h[0] - 40 + w2, h[1] + 36],
        [h[0] - 44 + w2, h[1] + 14],
      ];
      for (const q of pts) ctx.lineTo(q[0], q[1]);
      ctx.quadraticCurveTo(n[0] - 28, n[1] + 14, n[0] - 4, n[1] + 1);
      ctx.closePath();
      fillStroke(
        ctx,
        vgrad(
          ctx,
          n[1],
          h[1] + 40,
          [
            [0, p.base],
            [0.6, p.shade],
            [1, p.deep],
          ],
          tint,
        ),
        2.2,
      );
      if (!tint) {
        ctx.strokeStyle = ghost ? pal.accent : '#1a0a10';
        ctx.globalAlpha *= 0.6;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(n[0] - 6, n[1] + 6);
        ctx.quadraticCurveTo(h[0] - 18, h[1] - 4, h[0] - 26 + w2, h[1] + 30);
        ctx.stroke();
      }
      ctx.restore();
      if (ghost && !tint) {
        for (let i = 0; i < 3; i++) {
          const gx = h[0] - 50 - i * 12 + Math.sin(t * 2 + i) * 6;
          const gy = h[1] - 24 - i * 18 + Math.cos(t * 2.4 + i) * 6;
          ctx.save();
          ctx.globalAlpha *= 0.65;
          ctx.shadowColor = pal.accent;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(gx, gy, 6.5, Math.PI, 0);
          ctx.lineTo(gx + 6.5, gy + 7);
          ctx.lineTo(gx + 2, gy + 4);
          ctx.lineTo(gx - 2, gy + 7);
          ctx.lineTo(gx - 6.5, gy + 4);
          ctx.closePath();
          ctx.fillStyle = pal.accent;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = INK;
          ctx.fillRect(gx - 3, gy - 2, 2, 2.4);
          ctx.fillRect(gx + 1, gy - 2, 2, 2.4);
          ctx.restore();
        }
      }
      break;
    }
    case 'tank': {
      ctx.save();
      ctx.translate(n[0] - 22, n[1] + 16);
      ctx.rotate(pose.lean);
      ctx.beginPath();
      ctx.roundRect(-11, -18, 22, 44, 9);
      fillStroke(
        ctx,
        vgrad(
          ctx,
          -18,
          26,
          [
            [0, '#8a7a5a'],
            [1, '#3a2e20'],
          ],
          tint,
        ),
        2.2,
      );
      ctx.beginPath();
      ctx.roundRect(-6.5, -10, 13, 30, 6);
      ctx.fillStyle = tint ?? 'rgba(20,40,10,0.8)';
      ctx.fill();
      if (!tint) {
        ctx.shadowColor = pal.accent;
        ctx.shadowBlur = 10;
      }
      const lvl = 6 + Math.sin(t * 3) * 2;
      ctx.fillStyle = tint ?? pal.accent;
      ctx.fillRect(-5, -8 + lvl, 10, 26 - lvl);
      ctx.shadowBlur = 0;
      for (const y of [-14, 22])
        poly(
          ctx,
          [
            [-12, y],
            [12, y],
            [12, y + 3],
            [-12, y + 3],
          ],
          tint ?? '#c8a060',
          1.2,
        );
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(n[0] - 22, n[1] - 2);
      ctx.quadraticCurveTo(n[0] - 4, n[1] - 16, r.fHand[0], r.fHand[1]);
      ctx.strokeStyle = tint ?? INK;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = tint ?? '#5a5040';
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'tail': {
      ctx.beginPath();
      ctx.moveTo(h[0] - 6, h[1] + 2);
      ctx.bezierCurveTo(
        h[0] - 42,
        h[1] + 12,
        h[0] - 48 + sway * 2,
        h[1] - 40,
        h[0] - 30 + sway * 3,
        h[1] - 56,
      );
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = tint ?? pal.hair;
      ctx.lineWidth = 8;
      ctx.stroke();
      if (!tint) {
        ctx.save();
        ctx.strokeStyle = tone(pal.hair).light;
        ctx.lineWidth = 2;
        ctx.globalAlpha *= 0.6;
        ctx.stroke();
        ctx.restore();
      }
      circle(ctx, h[0] - 30 + sway * 3, h[1] - 56, 6, tint ?? pal.trim, 2);
      break;
    }
    case 'wings': {
      ctx.save();
      ctx.translate(n[0] - 6, n[1] + 6);
      const flap = Math.sin(t * 3) * 0.12;
      for (const k of [0.75, 1]) {
        ctx.save();
        ctx.rotate(-0.42 - flap * k);
        ctx.globalAlpha *= k === 1 ? 0.95 : 0.6;
        if (!tint) {
          ctx.shadowColor = pal.accent;
          ctx.shadowBlur = 14;
        }
        for (let i = 0; i < 6; i++) {
          const len = 30 + i * 9;
          ctx.save();
          ctx.rotate(-0.15 + i * 0.16);
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.quadraticCurveTo(-len * 0.6, -10, -len, -3);
          ctx.quadraticCurveTo(-len * 0.6, 6, 0, 3);
          ctx.closePath();
          ctx.fillStyle = tint ?? (i % 2 ? pal.accent : '#e8fff6');
          ctx.fill();
          ctx.restore();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      ctx.restore();
      break;
    }
    case 'thorns': {
      ctx.strokeStyle = tint ?? '#2a6a34';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(n[0] - 10, n[1] + 4);
      ctx.bezierCurveTo(n[0] - 38, n[1] - 14, n[0] - 34, h[1] - 10, h[0] - 22, h[1] + 12);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const k = i / 6;
        const x = lerp(n[0] - 30, h[0] - 22, k);
        const y = lerp(n[1] - 4, h[1] + 8, k);
        poly(
          ctx,
          [
            [x, y],
            [x - 5, y - 3],
            [x - 1, y + 2],
          ],
          tint ?? '#2a6a34',
          0,
        );
      }
      for (let i = 0; i < 3; i++) {
        rose(
          ctx,
          lerp(n[0] - 30, h[0] - 22, 0.2 + i * 0.3),
          lerp(n[1] - 4, h[1] + 8, 0.2 + i * 0.3),
          4.5,
          tint,
          pal.accent,
        );
      }
      break;
    }
    case 'scarf': {
      for (const [len, off] of [
        [60, 0],
        [48, 1.4],
      ] as [number, number][]) {
        const wave = (k: number) => Math.sin(t * 6 - k * 3 + off) * 7 * k;
        const steps = 6;
        const top: V[] = [];
        const bot: V[] = [];
        for (let i = 0; i <= steps; i++) {
          const k = i / steps;
          const x = n[0] - 2 - k * len;
          const y = n[1] + 2 + k * 10 + wave(k) + off * 4;
          top.push([x, y - 3.2]);
          bot.push([x, y + 3.2]);
        }
        ctx.beginPath();
        top.forEach((q, i) => (i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])));
        for (let i = bot.length - 1; i >= 0; i--) {
          const q = bot[i] as V;
          ctx.lineTo(q[0], q[1]);
        }
        ctx.closePath();
        const sp = P(pal.accent);
        fillStroke(ctx, off ? sp.shade : sp.base, 2);
      }
      break;
    }
    default:
      break;
  }
}

/* ---------------- 인형 (마리오네트 리리스) ---------------- */

let puppetDef: CharacterDef | null = null;
function puppetLook(owner: CharacterDef): CharacterDef {
  if (puppetDef) return puppetDef;
  puppetDef = {
    ...owner,
    gender: 'F',
    body: 'normal',
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
  return puppetDef;
}

const PUPPET_IDLE: Pose = {
  ...POSE.idle,
  lean: 0.15,
  fHand: [20, 26],
  bHand: [10, 30],
  fFoot: [8, 10],
  bFoot: [-8, 12],
};

function drawPuppet(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  f: Fighter | null,
  time: number,
  tint: string | null,
) {
  const d = f ? f.moveDef : null;
  const s = 1.24;
  let px = -66;
  let py = -30 + Math.sin(time * 2.2) * 5;
  let pose: Pose = PUPPET_IDLE;
  // 공격할 때는 인형이 앞으로 뛰쳐나간다
  if (f && f.act === 'attack' && d && d.box && f.move !== 'punch') {
    const k =
      f.t <= d.startup
        ? f.t / Math.max(1, d.startup)
        : f.t <= d.startup + d.active
          ? 1
          : 1 - (f.t - d.startup - d.active) / Math.max(1, d.recovery);
    px = lerp(px, d.box.x - 80, ease(k));
    py = lerp(py, -d.box.y + 100, ease(k));
    pose = lerpPose(pose, { ...ATK.punch[1], fHand: [70, -6], lean: 0.4 }, ease(k));
    if (f.isActive()) pose = { ...pose, fHand: [70 + Math.sin(f.t * 1.4) * 10, -6] };
  }
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(s, s);
  ctx.globalAlpha *= 0.96;
  const expr: Expr = f && f.act === 'attack' ? 'shout' : 'normal';
  drawRig(ctx, puppetLook(def), pose, { ...NO_STATE, time, puppet: true, tint, expr });
  ctx.restore();
  // 조종 실
  if (!tint) {
    ctx.strokeStyle = 'rgba(255,200,220,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 4, py - 118 * s);
    ctx.lineTo(18, -120);
    ctx.moveTo(px + 18, py - 70 * s);
    ctx.lineTo(24, -96);
    ctx.stroke();
  }
}

/* =========================================================
 * 화면에 캐릭터 그리기
 * ========================================================= */

function exprFor(f: Fighter): Expr {
  if (f.act === 'ko' || f.act === 'knockdown') return 'ko';
  if (f.act === 'hitstun' || f.act === 'blockstun') return 'pain';
  if (f.act === 'attack' || f.act === 'win') return 'shout';
  return 'normal';
}

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
    expr: exprFor(f),
  };
  const pose = poseFor(f, time);

  // 돌진 잔상 — 캐릭터 색 실루엣
  if (afterimage && d && d.selfVx > 0 && f.isActive()) {
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      ctx.globalAlpha = 0.14 * (4 - i);
      ctx.translate(f.x - f.facing * d.selfVx * i * 2.2, gy);
      ctx.scale(f.facing * s, s);
      drawRig(ctx, def, pose, {
        ...st,
        flash: false,
        glow: false,
        tint: i === 1 ? def.glow : def.color,
      });
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(f.x, gy);
  ctx.scale(f.facing * s, s);
  if (def.back === 'puppet') drawPuppet(ctx, def, f, time, st.flash ? '#ffffff' : null);
  drawRig(ctx, def, pose, st);
  ctx.restore();
}

/** 땅 그림자 */
export function drawShadow(ctx: CanvasRenderingContext2D, f: Fighter) {
  const k = Math.max(0.3, 1 - f.h / 300);
  const rx = 40 * f.def.scale * k;
  const g = ctx.createRadialGradient(f.x, GROUND_Y + 2, 2, f.x, GROUND_Y + 2, rx);
  g.addColorStop(0, `rgba(0,0,0,${0.5 * k})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(f.x, GROUND_Y + 2, rx, 8 * k, 0, 0, TAU);
  ctx.fill();
}

/** 캐릭터 선택 · 컷인 — 정해진 자세로 그린다 */
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
  if (def.back === 'puppet') drawPuppet(ctx, def, null, time, null);
  drawRig(ctx, def, pose, {
    ...NO_STATE,
    time,
    glow: kind === 'super',
    expr: kind === 'idle' ? 'normal' : 'shout',
  });
  ctx.restore();
}

/** 체력 바 아이콘 — 한 번 그려 둔 그림을 다시 쓴다 (매 프레임 다시 그리지 않게) */
const iconCache = new Map<CharId, HTMLCanvasElement>();
export function portraitIcon(def: CharacterDef): HTMLCanvasElement | null {
  const hit = iconCache.get(def.id);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d');
  if (!g) return null;
  // 얼굴이 가운데 오도록 크게
  drawPortrait(g, def, 60, 64 + 142 * 1.2, 1.2 / def.scale, 0.4, 'idle');
  iconCache.set(def.id, cv);
  return cv;
}
