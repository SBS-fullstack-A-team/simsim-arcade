/**
 * 심심파이터즈 — 캐릭터 그리기 도구 (셀 셰이딩 · 근육 테이퍼 팔다리 · 부드러운 도형)
 *
 * 빛은 항상 "앞쪽 위"에서 온다고 보고, 반대쪽 면에 어두운 색을, 빛 받는 쪽 가장자리에 밝은 선을 넣는다.
 * tint 를 주면 모든 색이 그 한 색으로 바뀐다 (피격 섬광 · 잔상 실루엣).
 */
import type { V } from './pose';

export const INK = '#0e0812';
export const TAU = Math.PI * 2;

/** 빛 방향 (앞쪽 위) */
const LX = 0.45;
const LY = -0.89;

export interface Paint {
  base: string;
  shade: string;
  light: string;
  deep: string;
}

const cache = new Map<string, Paint>();

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgb(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

/** 기본색 → 그림자색(보랏빛으로 어둡게) · 하이라이트색 */
export function tone(color: string, tint: string | null = null): Paint {
  if (tint) return { base: tint, shade: tint, light: tint, deep: tint };
  const hit = cache.get(color);
  if (hit) return hit;
  const [r, g, b] = hexRgb(color);
  const p: Paint = {
    base: color,
    shade: rgb(r * 0.62 + 22 * 0.38, g * 0.6 + 10 * 0.4, b * 0.66 + 46 * 0.34),
    deep: rgb(r * 0.38 + 14 * 0.62, g * 0.36 + 6 * 0.64, b * 0.42 + 30 * 0.58),
    light: rgb(r + (255 - r) * 0.42, g + (255 - g) * 0.42, b + (255 - b) * 0.42),
  };
  cache.set(color, p);
  return p;
}

/** 뒤쪽 팔다리용 — 전체를 한 단계 어둡게 */
export function backTone(p: Paint): Paint {
  return { base: p.shade, shade: p.deep, light: p.base, deep: p.deep };
}

const at2 = (a: V, b: V, k: number): V => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

/** 양 끝이 둥근 테이퍼 팔다리 경로 */
function capsulePath(ctx: CanvasRenderingContext2D, a: V, b: V, r1: number, r2: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 0.001;
  const nx = -dy / len;
  const ny = dx / len;
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * r1, a[1] + ny * r1);
  ctx.lineTo(b[0] + nx * r2, b[1] + ny * r2);
  ctx.arc(b[0], b[1], r2, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(a[0] - nx * r1, a[1] - ny * r1);
  ctx.arc(a[0], a[1], r1, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  return { nx, ny, ux: dx / len, uy: dy / len };
}

/**
 * 근육 팔다리 — w1(시작 굵기) → w2(끝 굵기)로 가늘어지고, 그늘 · 하이라이트 · 외곽선이 들어간다.
 * bulge 를 주면 가운데가 불룩하다 (이두 · 종아리).
 */
export function limb(
  ctx: CanvasRenderingContext2D,
  a: V,
  b: V,
  w1: number,
  w2: number,
  p: Paint,
  bulge = 0,
) {
  const r1 = w1 / 2;
  const r2 = w2 / 2;
  const { nx, ny, ux, uy } = capsulePath(ctx, a, b, r1, r2);
  ctx.fillStyle = p.base;
  ctx.fill();

  // 불룩한 근육
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const mx = (a[0] + b[0]) / 2 - ux * 2;
  const my = (a[1] + b[1]) / 2 - uy * 2;
  if (bulge > 0) {
    ctx.beginPath();
    ctx.ellipse(mx, my, len * 0.34, (r1 + r2) / 2 + bulge, Math.atan2(uy, ux), 0, TAU);
    ctx.fillStyle = p.base;
    ctx.fill();
  }

  // 입체 음영 — 빛 받는 쪽에서 그늘 쪽으로 원통처럼 (반대편 가장자리엔 반사광)
  const side = nx * LX + ny * LY > 0 ? -1 : 1;
  const sx = nx * side;
  const sy = ny * side;
  if (p.light !== p.base) {
    const R = Math.max(r1, r2) + Math.max(0, bulge) + 1;
    const g = ctx.createLinearGradient(mx - sx * R, my - sy * R, mx + sx * R, my + sy * R);
    g.addColorStop(0, p.light);
    g.addColorStop(0.24, p.base);
    g.addColorStop(0.5, p.base);
    g.addColorStop(0.72, p.shade);
    g.addColorStop(0.9, p.deep);
    g.addColorStop(1, p.shade);
    ctx.fillStyle = g;
    capsulePath(ctx, a, b, r1, r2);
    ctx.fill();
    if (bulge > 0) {
      ctx.beginPath();
      ctx.ellipse(mx, my, len * 0.34, (r1 + r2) / 2 + bulge, Math.atan2(uy, ux), 0, TAU);
      ctx.fill();
    }
    // 반짝이는 하이라이트 (빛 받는 쪽 가장자리 안쪽)
    ctx.save();
    ctx.globalAlpha *= 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, (r1 + r2) * 0.1);
    ctx.lineCap = 'round';
    const h0 = at2(a, b, 0.18);
    const h1 = at2(a, b, 0.78);
    ctx.beginPath();
    ctx.moveTo(h0[0] - sx * r1 * 0.5, h0[1] - sy * r1 * 0.5);
    ctx.lineTo(h1[0] - sx * r2 * 0.5, h1[1] - sy * r2 * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // 외곽선
  capsulePath(ctx, a, b, r1, r2);
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (bulge > 0) {
    ctx.beginPath();
    ctx.ellipse(mx, my, len * 0.34, (r1 + r2) / 2 + bulge, Math.atan2(uy, ux), 0, TAU);
    ctx.stroke();
    // 근육 사이 선
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx + ux * len * 0.12 - sx * 1, my + uy * len * 0.12 - sy * 1);
    ctx.lineTo(mx + ux * len * 0.32, my + uy * len * 0.32);
    ctx.stroke();
    ctx.globalAlpha /= 0.5;
  }
}

/** 점들을 부드러운 곡선으로 잇는 닫힌 경로 (머리카락 · 천) */
export function smoothPath(ctx: CanvasRenderingContext2D, pts: readonly V[]) {
  const n = pts.length;
  ctx.beginPath();
  if (n < 3) return;
  const mid = (i: number): V => {
    const p = pts[i % n] as V;
    const q = pts[(i + 1) % n] as V;
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const m0 = mid(0);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n] as V;
    const m = mid(i);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

/** 현재 경로를 칠하고 외곽선 */
export function fillStroke(
  ctx: CanvasRenderingContext2D,
  fill: string | CanvasGradient,
  width = 2.4,
) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
}

export function poly(
  ctx: CanvasRenderingContext2D,
  pts: readonly V[],
  fill: string | CanvasGradient,
  width = 2.4,
) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  ctx.closePath();
  if (width > 0) fillStroke(ctx, fill, width);
  else {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

export function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string | CanvasGradient,
  width = 2,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (width > 0) fillStroke(ctx, fill, width);
  else {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

export function line(
  ctx: CanvasRenderingContext2D,
  pts: readonly V[],
  color: string,
  width: number,
) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** 세로 그라디언트 (tint 가 있으면 단색) */
export function vgrad(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: readonly [number, string][],
  tint: string | null,
): string | CanvasGradient {
  if (tint) return tint;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
}

/** 가로 그라디언트 (tint 가 있으면 단색) */
export function hgrad(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  stops: readonly [number, string][],
  tint: string | null,
): string | CanvasGradient {
  if (tint) return tint;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
}

/** 금속 칼날 질감 (위 밝게 · 가운데 날 선 · 아래 어둡게) */
export function steel(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  tint: string | null,
  hue = '#c8ccd8',
) {
  const p = tone(hue);
  return vgrad(
    ctx,
    y0,
    y1,
    [
      [0, '#ffffff'],
      [0.35, p.light],
      [0.5, p.base],
      [0.52, p.shade],
      [1, p.deep],
    ],
    tint,
  );
}
