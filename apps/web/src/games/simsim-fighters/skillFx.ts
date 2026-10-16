/**
 * 심심파이터즈 — 기술 이펙트 그리기 (투사체 · 근접 기술 궤적 · 초필살기 연출)
 *
 * 에너지 계열은 'lighter'(더하기) 합성으로 겹칠수록 밝게 빛나게 하고,
 * 모든 이펙트를 [넓고 옅은 빛 → 진한 색 → 하얀 심] 세 겹으로 그려 선명하게 만든다.
 * 그리기 전용 — 판정에는 영향이 없다. 흔들림은 시간으로만 계산한다 (Math.random 없음).
 */
import { GROUND_Y } from './config';
import type { Fighter } from './fighter';
import { fxColor } from './fx';
import type { Projectile } from './hitbox';

const TAU = Math.PI * 2;
const INK = '#170e22';

/* =========================================================
 * 도우미
 * ========================================================= */

/** 0~1 고정 난수 */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function rgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

/** 지금 경로를 세 겹(넓은 빛 · 색 · 하얀 심)으로 긋는다 */
function glowStroke(ctx: CanvasRenderingContext2D, color: string, width: number, core = '#ffffff') {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(color, 0.22);
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = core;
  ctx.lineWidth = Math.max(1, width * 0.35);
  ctx.stroke();
}

/** 둥근 빛 (가운데 하얗고 바깥으로 사라짐) */
function orb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba('#ffffff', a));
  g.addColorStop(0.25, rgba(color, a * 0.9));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** 지그재그 번개 (seed 가 같으면 같은 모양) */
function lightning(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  jag: number,
  color: string,
  width: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const n = 7;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    ctx.lineTo(
      x1 + (x2 - x1) * k + (hash(seed + i) - 0.5) * jag,
      y1 + (y2 - y1) * k + (hash(seed + i * 3.7) - 0.5) * jag,
    );
  }
  ctx.lineTo(x2, y2);
  glowStroke(ctx, color, width);
}

/** 불꽃 한 줄기 (아래가 넓고 위가 뾰족) */
function flame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sway: number,
  light: string,
  deep: string,
) {
  const g = ctx.createLinearGradient(0, y, 0, y - h);
  g.addColorStop(0, rgba('#fff6d0', 0.95));
  g.addColorStop(0.3, rgba(light, 0.9));
  g.addColorStop(0.7, rgba(deep, 0.75));
  g.addColorStop(1, rgba(deep, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.bezierCurveTo(x - w / 2, y - h * 0.5, x + sway - w * 0.2, y - h * 0.7, x + sway, y - h);
  ctx.bezierCurveTo(x + sway + w * 0.2, y - h * 0.7, x + w / 2, y - h * 0.5, x + w / 2, y);
  ctx.quadraticCurveTo(x, y + w * 0.25, x - w / 2, y);
  ctx.fill();
}

/** 장미 한 송이 */
function rose(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, open: number) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i++) {
    ctx.rotate(TAU / 5);
    ctx.fillStyle = i % 2 ? '#c8102e' : '#ff2a4a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5 * open, r * 0.5, r * 0.62 * open + 0.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#7a0018';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#ffb0c0';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0.4, 4.2);
  ctx.stroke();
  ctx.restore();
}

/** 가시 덩굴 줄기 (아래에서 위로 휘어 오른다) */
function vine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  bend: number,
  width: number,
) {
  ctx.lineCap = 'round';
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    pts.push([x + Math.sin(k * Math.PI) * bend, y - k * h]);
  }
  ctx.strokeStyle = '#123a1a';
  ctx.lineWidth = width + 2.5;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
  ctx.strokeStyle = '#2e8a3a';
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = '#6ad06a';
  ctx.lineWidth = Math.max(1, width * 0.3);
  ctx.stroke();
  // 가시
  ctx.fillStyle = '#d8f0c0';
  for (let i = 1; i < 8; i++) {
    const [px, py] = pts[i] as [number, number];
    const s = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(px, py - 2);
    ctx.lineTo(px + s * (width * 0.9 + 4), py - 4);
    ctx.lineTo(px, py + 2);
    ctx.fill();
  }
}

/* =========================================================
 * 투사체
 * ========================================================= */

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number) {
  const [light, deep] = fxColor(p.fx);
  const ready = p.age >= p.delay;
  const appear = Math.min(1, p.age / Math.max(1, p.delay));
  const fade = Math.min(1, (p.life - p.age) / 8);
  ctx.save();
  ctx.translate(p.x, GROUND_Y - p.y);
  ctx.globalAlpha = Math.max(0, fade);

  switch (p.look || p.fx) {
    case 'vortex':
      drawVortex(ctx, p, time, light, deep, ready, appear);
      break;
    case 'homunculus':
      if (p.landed) drawCloud(ctx, p, time, light, deep);
      else drawHomunculus(ctx, p, time, light, deep);
      break;
    case 'orbital':
      drawOrbital(ctx, p, time, light, deep, ready, appear);
      break;
    case 'cage':
      drawCage(ctx, p, time, ready, appear);
      break;
    case 'clone':
      drawClone(ctx, p, time, light, deep);
      break;
    case 'tracer':
    case 'bullet':
      drawBullet(ctx, p, light, deep);
      break;
    case 'buzzsaw':
    case 'saw':
      drawSaw(ctx, p, time, light, deep);
      break;
    case 'fire':
      drawFire(ctx, p, time, light, deep);
      break;
    case 'volt':
      drawVolt(ctx, p, time, light, deep);
      break;
    case 'steel':
      drawSteel(ctx, p, time, light, deep);
      break;
    case 'sound':
      drawSound(ctx, p, time, light, deep);
      break;
    case 'poison':
      if (p.landed) drawCloud(ctx, p, time, light, deep);
      else drawFlask(ctx, p, time, light, deep);
      break;
    case 'ice':
      drawIce(ctx, p, time, light, deep);
      break;
    case 'venom':
      drawClawWave(ctx, p, time, light, deep);
      break;
    case 'puppet':
      drawGiantPuppet(ctx, p, time, ready, appear);
      break;
    case 'light':
      drawLaser(ctx, p, time, light, deep);
      break;
    case 'rose':
      drawThorn(ctx, p, time, ready, appear);
      break;
    case 'ghost':
      drawGhost(ctx, p, time, light, deep, ready, appear);
      break;
    case 'shadow':
      orb(ctx, 0, 0, p.w / 2, deep);
      break;
    case 'explosion':
      drawExplosion(ctx, p, time);
      break;
    default:
      orb(ctx, 0, 0, p.w / 2, deep);
  }
  ctx.restore();
}

/* ---------------- 불 ---------------- */

function drawFire(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  const bottom = p.h / 2;
  ctx.globalCompositeOperation = 'lighter';
  if (p.vx === 0) {
    // 착지 대폭발 — 땅을 따라 퍼지는 충격파 고리 + 솟구치는 불기둥
    const k = Math.min(1, p.age / p.life);
    ctx.save();
    ctx.scale(1, 0.22);
    ctx.strokeStyle = rgba(light, 1 - k);
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(0, bottom / 0.22, p.w / 2, 0, TAU);
    ctx.stroke();
    ctx.restore();
    orb(ctx, 0, bottom - 20, p.w * 0.45, deep, 0.9 * (1 - k));
    for (let i = 0; i < 9; i++) {
      const x = (i / 8 - 0.5) * p.w * 0.8;
      const h = p.h * (0.6 + hash(i) * 0.9) * (1 - k * 0.6);
      flame(ctx, x, bottom, 26 + hash(i + 3) * 20, h, Math.sin(time * 18 + i) * 8, light, deep);
    }
    return;
  }
  // 땅을 타고 가는 화염파 — 여러 불꽃이 겹쳐 흔들린다
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * p.w * 0.9 - p.facing * i * 3;
    const h = p.h * (0.75 + 0.35 * Math.sin(time * 22 + i * 1.7));
    flame(ctx, x, bottom, p.w * 0.55, h, Math.sin(time * 16 + i) * 6, light, deep);
  }
  orb(ctx, 0, bottom - p.h * 0.3, p.w * 0.9, deep, 0.5);
  // 뒤로 흩날리는 불티
  ctx.fillStyle = rgba('#fff2a0', 0.9);
  for (let i = 0; i < 6; i++) {
    const k = (time * 2 + hash(i)) % 1;
    ctx.beginPath();
    ctx.arc(-p.facing * (p.w * 0.5 + k * 50), bottom - k * p.h, 2.2 * (1 - k), 0, TAU);
    ctx.fill();
  }
}

/* ---------------- 번개 ---------------- */

function drawVolt(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  ctx.globalCompositeOperation = 'lighter';
  const seed = Math.floor(time * 24) + p.id * 13;
  if (p.sky) {
    // 하늘에서 내리꽂는 번개 기둥 + 가지
    const top = -p.h / 2 - 300;
    const bot = p.h / 2;
    lightning(ctx, 0, top, 0, bot, seed, 34, deep, 7);
    lightning(ctx, 0, top * 0.4, 30 * (hash(seed) - 0.5) * 4, bot * 0.3, seed + 50, 22, light, 3);
    if (p.landed) orb(ctx, 0, bot, 60, deep, 0.9);
    return;
  }
  // 플라즈마 구체 — 빛나는 핵 + 둘레를 튀는 전기
  orb(ctx, 0, 0, p.w * 0.9, deep, 0.85);
  orb(ctx, 0, 0, p.w * 0.45, light, 1);
  for (let i = 0; i < 4; i++) {
    const a = hash(seed + i) * TAU;
    const r = p.w * (0.55 + hash(seed + i + 9) * 0.4);
    lightning(ctx, 0, 0, Math.cos(a) * r, Math.sin(a) * r, seed + i * 17, 10, light, 2);
  }
}

/* ---------------- 강철 (로켓 펀치 · 충격파) ---------------- */

function drawSteel(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  if (p.vx === 0) {
    // 착지 충격파 — 땅이 갈라지며 먼지 고리가 퍼진다
    const k = Math.min(1, p.age / p.life);
    const bottom = p.h / 2;
    ctx.save();
    ctx.scale(1, 0.25);
    ctx.strokeStyle = rgba('#e8e0d0', 0.9 * (1 - k));
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(0, bottom / 0.25, p.w / 2, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(0, bottom);
      ctx.lineTo(s * (20 + i * 22), bottom + 2);
      ctx.lineTo(s * (34 + i * 30), bottom - 4 + (i % 3) * 3);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    orb(ctx, 0, bottom - 10, p.w * 0.35, deep, 0.8 * (1 - k));
    return;
  }
  // 로켓 펀치 — 금속 주먹 + 뒤로 뿜는 불꽃
  ctx.scale(p.facing, 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    flame(
      ctx,
      -p.w / 2 - 6,
      0,
      p.h * 0.6,
      44 + i * 14 + Math.sin(time * 40 + i) * 6,
      0,
      light,
      deep,
    );
  }
  ctx.restore();
  // 불꽃은 뒤로 눕힌다
  const g = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
  g.addColorStop(0, '#f2f4f8');
  g.addColorStop(0.45, '#9aa4b0');
  g.addColorStop(1, '#4a525c');
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-p.w / 2, -p.h / 2, p.w * 0.85, p.h, 10);
  ctx.fill();
  ctx.stroke();
  // 손가락 마디
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(p.w * 0.12, -p.h / 2 + (p.h * i) / 4);
    ctx.lineTo(p.w * 0.35, -p.h / 2 + (p.h * i) / 4);
    ctx.stroke();
  }
  ctx.fillStyle = deep;
  ctx.fillRect(-p.w / 2 + 6, -p.h / 2, 7, p.h);
}

/* ---------------- 음파 ---------------- */

function drawSound(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  ctx.globalCompositeOperation = 'lighter';
  if (p.vx === 0) {
    // 드롭 더 베이스 — 박자마다 퍼지는 원형 충격파 + 이퀄라이저
    const k = p.age / p.life;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(1, p.w / 2 - i * 16), Math.max(1, p.h / 2 - i * 10), 0, 0, TAU);
      glowStroke(ctx, rgba(i % 2 ? deep : light, 1 - k), 6 - i * 1.5);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + time;
      const bar = 10 + Math.abs(Math.sin(time * 14 + i)) * 26;
      const r = p.w / 2;
      ctx.strokeStyle = rgba(i % 2 ? light : deep, 0.8 * (1 - k));
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * (p.h / p.w));
      ctx.lineTo(Math.cos(a) * (r + bar), Math.sin(a) * (r + bar) * (p.h / p.w));
      ctx.stroke();
    }
    return;
  }
  // 음파 — 겹친 반원 파동 + 음표
  ctx.scale(p.facing, 1);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(-i * 14, 0, p.w * 0.3 + i * 4, p.h / 2 - i * 5, 0, -1.25, 1.25);
    glowStroke(ctx, i % 2 ? deep : light, 4 - i * 0.6);
  }
  ctx.fillStyle = light;
  for (let i = 0; i < 2; i++) {
    const x = -24 - i * 22;
    const y = Math.sin(time * 10 + i * 2) * 14 - 8;
    ctx.beginPath();
    ctx.ellipse(x, y, 4.2, 3, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillRect(x + 3, y - 14, 1.8, 14);
  }
}

/* ---------------- 독 ---------------- */

function drawFlask(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  ctx.rotate(time * 9 * p.facing);
  // 유리병 몸통
  const g = ctx.createRadialGradient(-3, -2, 1, 0, 2, 13);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, light);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 3, 11, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,240,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(-3.5, -14, 7, 9, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(-4, -17, 8, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-4, -1, 2.5, 4, 0.5, 0, TAU);
  ctx.fill();
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  // 독구름 — 부풀었다 줄었다 하는 거품 덩어리 + 터지는 방울
  const n = p.w > 150 ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * p.w * 0.85 + Math.sin(time * 1.6 + i) * 8;
    const y = p.h * 0.1 - Math.abs(Math.sin(i * 1.3)) * p.h * 0.35 + Math.cos(time * 2 + i) * 5;
    const r = p.h * (0.32 + hash(i) * 0.2);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, rgba(light, 0.55));
    g.addColorStop(0.6, rgba(deep, 0.42));
    g.addColorStop(1, rgba(deep, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(light, 0.85);
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 6; i++) {
    const k = (time * 0.8 + hash(i + 4)) % 1;
    const x = (hash(i + 8) - 0.5) * p.w * 0.8;
    ctx.beginPath();
    ctx.arc(x, p.h * 0.3 - k * p.h, 2 + hash(i) * 3, 0, TAU);
    ctx.stroke();
  }
  // 해골 표시
  if (p.w > 150) {
    ctx.fillStyle = rgba('#203a10', 0.55);
    ctx.beginPath();
    ctx.arc(0, -10, 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(light, 0.8);
    ctx.beginPath();
    ctx.arc(-5, -12, 3.5, 0, TAU);
    ctx.arc(5, -12, 3.5, 0, TAU);
    ctx.fill();
  }
}

function drawHomunculus(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  // 걸어가는 독 호문쿨루스 — 출렁이는 젤리 몸 · 고글 · 짧은 팔다리
  const f = p.facing;
  ctx.scale(f, 1);
  const step = Math.sin(p.age * 0.35);
  const squash = 1 + Math.sin(p.age * 0.7) * 0.06;
  const bottom = p.h / 2;
  // 다리
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, bottom - 22);
  ctx.lineTo(-10 + step * 8, bottom - 2);
  ctx.moveTo(10, bottom - 22);
  ctx.lineTo(10 - step * 8, bottom - 2);
  ctx.stroke();
  ctx.strokeStyle = deep;
  ctx.lineWidth = 6;
  ctx.stroke();
  // 몸
  ctx.save();
  ctx.translate(0, bottom - 24);
  ctx.scale(1 / squash, squash);
  const g = ctx.createRadialGradient(-10, -34, 4, 0, -22, 40);
  g.addColorStop(0, '#f6ffc0');
  g.addColorStop(0.35, light);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.bezierCurveTo(-30, -30, -18, -56, 0, -56);
  ctx.bezierCurveTo(18, -56, 30, -30, 26, 0);
  ctx.quadraticCurveTo(0, 8, -26, 0);
  ctx.fill();
  ctx.stroke();
  // 몸속 거품
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 4; i++) {
    const k = (p.age * 0.02 + hash(i)) % 1;
    ctx.beginPath();
    ctx.arc(-12 + i * 8, -6 - k * 40, 2 + hash(i + 2) * 2, 0, TAU);
    ctx.fill();
  }
  // 고글
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(-20, -40, 40, 6);
  for (const x of [-7, 9]) {
    ctx.fillStyle = '#c8b070';
    ctx.beginPath();
    ctx.arc(x, -37, 8, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const lg = ctx.createRadialGradient(x - 2, -39, 1, x, -37, 6);
    lg.addColorStop(0, '#ffffff');
    lg.addColorStop(0.4, '#c0ff6a');
    lg.addColorStop(1, '#2a8a10');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(x, -37, 5.5, 0, TAU);
    ctx.fill();
  }
  // 입
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(2, -20, 7, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // 팔
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(22, -20);
  ctx.lineTo(34, -28 + step * 6);
  ctx.moveTo(-22, -20);
  ctx.lineTo(-32, -12 - step * 6);
  ctx.stroke();
  ctx.strokeStyle = light;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  // 머리 위 경고 깜빡임
  if (Math.sin(time * 12) > 0) {
    ctx.fillStyle = '#ffe02a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, bottom - 92);
  }
}

/* ---------------- 얼음 ---------------- */

function drawIce(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  // 빙결 검풍 — 초승달 칼바람 + 뒤로 흩어지는 얼음 결정
  ctx.scale(p.facing, 1);
  ctx.globalCompositeOperation = 'lighter';
  const h = p.h / 2;
  const g = ctx.createLinearGradient(-p.w, 0, p.w / 2, 0);
  g.addColorStop(0, rgba(deep, 0));
  g.addColorStop(0.6, rgba(deep, 0.7));
  g.addColorStop(1, rgba('#ffffff', 0.95));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(p.w / 2, 0);
  ctx.quadraticCurveTo(p.w * 0.2, -h * 1.1, -p.w * 0.5, -h);
  ctx.quadraticCurveTo(0, 0, -p.w * 0.5, h);
  ctx.quadraticCurveTo(p.w * 0.2, h * 1.1, p.w / 2, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-p.w * 0.45, -h * 0.95);
  ctx.quadraticCurveTo(p.w * 0.25, -h, p.w / 2, 0);
  ctx.quadraticCurveTo(p.w * 0.25, h, -p.w * 0.45, h * 0.95);
  glowStroke(ctx, light, 2.5);
  // 얼음 결정
  for (let i = 0; i < 5; i++) {
    const k = (time * 3 + hash(i)) % 1;
    const x = -p.w * 0.4 - k * 60;
    const y = (hash(i + 3) - 0.5) * p.h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 4 + i);
    ctx.fillStyle = rgba('#e8faff', 1 - k);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(2.5, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-2.5, 0);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------------- 맹독 손톱 · 분신 ---------------- */

function drawClawWave(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  // 세 갈래 손톱 자국이 날아간다
  ctx.scale(p.facing, 1);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-p.w * 0.4, i * 16 - 12);
    ctx.quadraticCurveTo(p.w * 0.25, i * 16 - 4, p.w * 0.45, i * 16 + 14);
    glowStroke(ctx, i === 0 ? deep : light, 4);
  }
  orb(ctx, p.w * 0.3, 0, p.w * 0.5, deep, 0.4 + Math.sin(time * 30) * 0.1);
}

function drawClone(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  // 그림자 분신 — 반투명 고양이 수인이 손톱을 세우고 덮친다 + 잔상
  ctx.scale(p.facing, 1);
  for (let t = 3; t >= 0; t--) {
    ctx.save();
    ctx.translate(-t * 16, 0);
    ctx.globalAlpha *= t === 0 ? 0.85 : 0.18 * (4 - t);
    const g = ctx.createLinearGradient(0, -50, 0, 50);
    g.addColorStop(0, rgba(light, 0.9));
    g.addColorStop(1, rgba(deep, 0.9));
    ctx.fillStyle = t === 0 ? g : deep;
    ctx.beginPath();
    // 몸 (앞으로 기운 덮치기 자세)
    ctx.moveTo(-26, 34);
    ctx.quadraticCurveTo(-18, 0, 0, -18);
    ctx.quadraticCurveTo(14, -30, 22, -26);
    ctx.lineTo(36, -12);
    ctx.quadraticCurveTo(16, 4, 10, 20);
    ctx.lineTo(24, 44);
    ctx.lineTo(4, 44);
    ctx.quadraticCurveTo(-6, 30, -26, 34);
    ctx.fill();
    // 머리 · 귀
    ctx.beginPath();
    ctx.arc(14, -36, 12, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -44);
    ctx.lineTo(4, -60);
    ctx.lineTo(14, -48);
    ctx.lineTo(22, -60);
    ctx.lineTo(24, -42);
    ctx.fill();
    // 꼬리
    ctx.strokeStyle = t === 0 ? deep : rgba(deep, 0.6);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-24, 30);
    ctx.quadraticCurveTo(-50, 20, -44, -10 + Math.sin(time * 10) * 6);
    ctx.stroke();
    ctx.restore();
  }
  // 빛나는 눈 · 손톱
  ctx.globalCompositeOperation = 'lighter';
  orb(ctx, 20, -38, 7, light, 1);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(30, -18 + i * 6);
    ctx.lineTo(48, -24 + i * 9);
    glowStroke(ctx, light, 2);
  }
}

/* ---------------- 인형 · 빛 · 장미 · 톱날 · 유령 · 탄환 ---------------- */

function drawGiantPuppet(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  ready: boolean,
  appear: number,
) {
  // 커튼 콜 — 실에 매달린 거대 인형이 떨어진다 (도착 전엔 그림자 경고)
  ctx.globalAlpha *= ready ? 1 : 0.35 + appear * 0.5;
  const w = p.w;
  const h = p.h;
  // 조종 실
  ctx.strokeStyle = 'rgba(255,210,225,0.6)';
  ctx.lineWidth = 1.2;
  for (const x of [-w * 0.25, 0, w * 0.25]) {
    ctx.beginPath();
    ctx.moveTo(x, -h * 0.5);
    ctx.lineTo(x * 0.6, -GROUND_Y);
    ctx.stroke();
  }
  // 드레스 몸
  const g = ctx.createLinearGradient(0, -h * 0.2, 0, h * 0.5);
  g.addColorStop(0, '#9a2a5a');
  g.addColorStop(1, '#3a0a20');
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, -h * 0.18);
  ctx.lineTo(w * 0.18, -h * 0.18);
  ctx.lineTo(w * 0.42, h * 0.48);
  ctx.quadraticCurveTo(0, h * 0.56, -w * 0.42, h * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 레이스 단
  ctx.fillStyle = '#f2e0c0';
  for (let i = 0; i < 9; i++) {
    const x = -w * 0.4 + (i * w * 0.8) / 8;
    ctx.beginPath();
    ctx.arc(x, h * 0.49, 8, 0, Math.PI);
    ctx.fill();
  }
  // 꿰맨 자국
  ctx.strokeStyle = '#ff4a7a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.16);
  ctx.lineTo(0, h * 0.4);
  for (let y = -h * 0.12; y < h * 0.38; y += 18) {
    ctx.moveTo(-8, y);
    ctx.lineTo(8, y + 6);
  }
  ctx.stroke();
  // 머리
  const hg = ctx.createRadialGradient(-w * 0.06, -h * 0.4, 4, 0, -h * 0.32, w * 0.28);
  hg.addColorStop(0, '#fff4ea');
  hg.addColorStop(1, '#c8b0a0');
  ctx.fillStyle = hg;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -h * 0.32, w * 0.26, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // 단추 눈 · 꿰맨 입
  for (const ex of [-1, 1]) {
    ctx.fillStyle = '#1a1020';
    ctx.beginPath();
    ctx.arc(ex * w * 0.1, -h * 0.35, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff4a7a';
    ctx.beginPath();
    ctx.arc(ex * w * 0.1 - 3, -h * 0.36, 2.2, 0, TAU);
    ctx.arc(ex * w * 0.1 + 3, -h * 0.34, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#ff4a7a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-30, -h * 0.22);
  ctx.quadraticCurveTo(0, -h * 0.19 + Math.sin(time * 6) * 3, 30, -h * 0.22);
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo(i * 9, -h * 0.25);
    ctx.lineTo(i * 9, -h * 0.19);
  }
  ctx.stroke();
}

function drawLaser(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  ctx.globalCompositeOperation = 'lighter';
  if (p.sky) {
    // 하늘에서 떨어지는 빛의 창
    const g = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
    g.addColorStop(0, rgba(deep, 0));
    g.addColorStop(0.7, rgba(deep, 0.8));
    g.addColorStop(1, rgba('#ffffff', 1));
    ctx.fillStyle = g;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-p.w * 0.12, -p.h / 2, p.w * 0.24, p.h);
    if (p.landed) orb(ctx, 0, p.h / 2, 50, deep, 0.8);
    return;
  }
  // 날개 레이저 — 하얀 심 + 초록 빛 + 앞쪽 섬광
  ctx.scale(p.facing, 1);
  ctx.beginPath();
  ctx.moveTo(-p.w / 2, 0);
  ctx.lineTo(p.w / 2, 0);
  glowStroke(ctx, deep, p.h * 0.6);
  orb(ctx, p.w / 2, 0, p.h * 1.8, light, 0.9);
  for (let i = 0; i < 3; i++) {
    const x = -p.w / 2 - ((time * 300 + i * 30) % 80);
    ctx.fillStyle = rgba(light, 0.6);
    ctx.fillRect(x, -1.5, 14, 3);
  }
}

function drawOrbital(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
  ready: boolean,
  appear: number,
) {
  const bottom = p.h / 2;
  if (!ready) {
    // 조준 — 땅에 표적 원 + 하늘에서 내려오는 가는 조준선
    ctx.save();
    ctx.translate(0, bottom);
    ctx.scale(1, 0.3);
    ctx.rotate(time * 3);
    ctx.strokeStyle = rgba(deep, 0.6 + appear * 0.4);
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 70 - appear * 30, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = rgba(light, 0.3 + appear * 0.5);
    ctx.lineWidth = 1.5 + appear * 2;
    ctx.beginPath();
    ctx.moveTo(0, -p.h);
    ctx.lineTo(0, bottom);
    ctx.stroke();
    return;
  }
  // 위성 레이저 — 굵은 빛기둥 + 둘레 고리 + 땅에 튀는 빛
  ctx.globalCompositeOperation = 'lighter';
  const w = p.w * (0.9 + Math.sin(time * 40) * 0.1);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, rgba(deep, 0));
  g.addColorStop(0.25, rgba(deep, 0.75));
  g.addColorStop(0.5, rgba('#ffffff', 1));
  g.addColorStop(0.75, rgba(deep, 0.75));
  g.addColorStop(1, rgba(deep, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -p.h, w, p.h + bottom);
  for (let i = 0; i < 5; i++) {
    const y = bottom - ((time * 500 + i * 120) % (p.h + bottom));
    ctx.save();
    ctx.translate(0, y);
    ctx.scale(1, 0.25);
    ctx.strokeStyle = rgba(light, 0.7);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.75, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  orb(ctx, 0, bottom, w * 1.4, deep, 0.9);
  ctx.fillStyle = rgba('#ffffff', 0.9);
  for (let i = 0; i < 8; i++) {
    const k = (time * 3 + hash(i)) % 1;
    const a = Math.PI + hash(i + 5) * Math.PI;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * k * 90, bottom + Math.sin(a) * k * 50, 3 * (1 - k), 0, TAU);
    ctx.fill();
  }
}

function drawThorn(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  ready: boolean,
  appear: number,
) {
  if (p.vx !== 0 && p.w <= 60) {
    // 장미 탄 — 빙글빙글 도는 장미
    ctx.rotate(time * 8);
    rose(ctx, 0, 0, p.w * 0.5, 1);
    return;
  }
  // 가시 덩굴 기둥 — 땅에서 솟아 끝에 장미가 핀다
  const rise = ready ? 1 : appear;
  const bottom = p.h / 2;
  const h = p.h * rise;
  vine(ctx, -6, bottom, h, 8 * Math.sin(time * 3), 7);
  vine(ctx, 8, bottom, h * 0.8, -10, 5);
  if (ready) rose(ctx, 2, bottom - h, 11, Math.min(1, (p.age - p.delay) / 6));
}

function drawCage(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  ready: boolean,
  appear: number,
) {
  // 로즈 프리즌 — 상대를 둘러싼 가시 덩굴 새장 (먼저 땅에 장미 문양이 핀다)
  const bottom = p.h / 2;
  if (!ready) {
    ctx.save();
    ctx.translate(0, bottom);
    ctx.scale(1, 0.3);
    ctx.fillStyle = rgba('#ff2a4a', 0.25 + appear * 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, p.w * 0.6, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      ctx.rotate(TAU / 8);
      rose(ctx, p.w * 0.5, 0, 9 * appear, appear);
    }
    ctx.restore();
    return;
  }
  const k = Math.min(1, (p.age - p.delay) / 8);
  const h = p.h * k;
  // 뒤쪽 덩굴
  for (let i = 0; i < 4; i++) {
    const x = (i / 3 - 0.5) * p.w * 0.7;
    vine(ctx, x, bottom, h * (0.85 + hash(i) * 0.2), (i % 2 ? 1 : -1) * 18, 5);
  }
  // 앞쪽 — 바깥에서 안쪽으로 휘는 덩굴
  vine(ctx, -p.w / 2, bottom, h, p.w * 0.35, 8);
  vine(ctx, p.w / 2, bottom, h, -p.w * 0.35, 8);
  // 꼭대기와 둘레에 피는 장미
  const bloom = Math.min(1, k * 1.2);
  rose(ctx, 0, bottom - h - 4, 14, bloom);
  rose(ctx, -p.w * 0.38, bottom - h * 0.5, 10, bloom);
  rose(ctx, p.w * 0.38, bottom - h * 0.55, 10, bloom);
  // 흩날리는 꽃잎
  for (let i = 0; i < 6; i++) {
    const t = (time * 0.8 + hash(i)) % 1;
    ctx.save();
    ctx.translate((hash(i + 2) - 0.5) * p.w * 1.2, bottom - h * (1 - t));
    ctx.rotate(time * 3 + i);
    ctx.fillStyle = rgba('#ff4a6a', 1 - t);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawSaw(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
) {
  // 회전 톱날 — 금속 원판 + 톱니 + 회전 잔상 + 불꽃
  const r = p.w / 2;
  const spin = time * 32 * (p.vx >= 0 ? 1 : -1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(light, 0.35);
  ctx.lineWidth = r * 0.25;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, spin, spin + 2.4);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.rotate(spin);
  const teeth = p.look === 'buzzsaw' ? 36 : 24;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * TAU;
    const a1 = ((i + 0.6) / teeth) * TAU;
    ctx.lineTo(Math.cos(a0) * (r - 7), Math.sin(a0) * (r - 7));
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#c8ccd8');
  g.addColorStop(1, '#6a7080');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // 구멍 · 바퀴살
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#4a4e5a';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
    ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffe0a0';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.1, 0, TAU);
  ctx.fill();
  ctx.restore();
  // 튀는 불꽃
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const k = (time * 5 + hash(i)) % 1;
    const a = Math.PI * 0.6 + hash(i + 3) * 0.8;
    ctx.strokeStyle = rgba(i % 2 ? '#fff0a0' : light, 1 - k);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a) * (r + 10 + k * 26), Math.sin(a) * (r + 10 + k * 26));
    ctx.stroke();
  }
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
  ready: boolean,
  appear: number,
) {
  if (p.h > 100) {
    // 망령의 손 — 땅에서 솟는 거대한 유령 손 (먼저 땅에 원)
    const bottom = p.h / 2;
    ctx.save();
    ctx.translate(0, bottom);
    ctx.scale(1, 0.3);
    ctx.fillStyle = rgba(deep, 0.35 + appear * 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (!ready) return;
    const k = Math.min(1, (p.age - p.delay) / 6);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, bottom, 0, bottom - p.h);
    g.addColorStop(0, rgba(deep, 0.9));
    g.addColorStop(1, rgba(light, 0.3));
    ctx.fillStyle = g;
    const top = bottom - p.h * k;
    ctx.beginPath();
    ctx.moveTo(-22, bottom);
    ctx.lineTo(-24, top + 50);
    for (let i = 0; i < 4; i++) {
      const x = -22 + i * 14;
      ctx.lineTo(x, top + 8 + (i === 1 || i === 2 ? 0 : 12));
      ctx.lineTo(x + 7, top + 40);
    }
    ctx.lineTo(28, top + 60);
    ctx.lineTo(24, bottom);
    ctx.closePath();
    ctx.fill();
    orb(ctx, 0, top + 40, 40, light, 0.6);
    return;
  }
  // 유령 구체 — 해골 모양 혼불 + 흐르는 꼬리
  ctx.globalCompositeOperation = 'lighter';
  const back = p.vx >= 0 ? -1 : 1;
  for (let i = 4; i >= 1; i--) {
    orb(ctx, back * i * 9, Math.sin(time * 8 + i) * 4, p.w * (0.5 - i * 0.07), deep, 0.35);
  }
  orb(ctx, 0, 0, p.w * 0.75, deep, 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(230,255,250,0.92)';
  ctx.beginPath();
  ctx.arc(0, -2, p.w * 0.26, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0a3a34';
  ctx.beginPath();
  ctx.arc(-4, -3, 3, 0, TAU);
  ctx.arc(4, -3, 3, 0, TAU);
  ctx.fill();
  ctx.fillRect(-3, 4, 6, 2);
}

function drawBullet(ctx: CanvasRenderingContext2D, p: Projectile, light: string, deep: string) {
  // 탄환 — 길게 빛나는 예광 꼬리 + 금빛 탄두
  const ang = Math.atan2(-p.vy, p.vx);
  ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';
  const len = p.look === 'tracer' ? 90 : 46;
  const g = ctx.createLinearGradient(-len, 0, 0, 0);
  g.addColorStop(0, rgba(deep, 0));
  g.addColorStop(1, rgba(light, 0.95));
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.lineWidth = p.h * 0.45;
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(0, 0);
  ctx.stroke();
  orb(ctx, 0, 0, p.h * 1.3, deep, 0.8);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffe08a';
  ctx.strokeStyle = '#6a3a0a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.w * 0.32, p.h * 0.28, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

function drawVortex(
  ctx: CanvasRenderingContext2D,
  p: Projectile,
  time: number,
  light: string,
  deep: string,
  ready: boolean,
  appear: number,
) {
  // 명계의 문 — 빙글빙글 도는 어둠의 소용돌이 + 빨려 들어가는 영혼
  const r = (p.w / 2) * (ready ? 1 : appear);
  const ry = (p.h / 2) * (ready ? 1 : appear);
  ctx.save();
  ctx.scale(1, ry / Math.max(1, r));
  // 바깥 빛
  ctx.globalCompositeOperation = 'lighter';
  orb(ctx, 0, 0, r * 1.5, deep, 0.6);
  ctx.globalCompositeOperation = 'source-over';
  // 소용돌이 팔
  for (let arm = 0; arm < 5; arm++) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const k = i / 24;
      const a = time * -5 + arm * (TAU / 5) + k * 4.2;
      const rr = r * (1 - k * 0.85);
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.strokeStyle = arm % 2 ? rgba(light, 0.85) : rgba(deep, 0.95);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // 사건의 지평선 (검은 핵)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.45);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.7, '#14062a');
  g.addColorStop(1, rgba(deep, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, TAU);
  ctx.fill();
  ctx.restore();
  // 빨려 들어가는 영혼
  for (let i = 0; i < 7; i++) {
    const k = (time * 0.9 + hash(i)) % 1;
    const a = hash(i + 7) * TAU + k * 5;
    const d = (1 - k) * r * 1.8;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d * 0.7;
    ctx.fillStyle = rgba('#e8e0ff', k * 0.9);
    ctx.beginPath();
    ctx.arc(x, y, 4 * (1 - k * 0.5), 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba('#1a0a30', k);
    ctx.fillRect(x - 2, y - 1.5, 1.4, 1.4);
    ctx.fillRect(x + 0.6, y - 1.5, 1.4, 1.4);
  }
}

function drawExplosion(ctx: CanvasRenderingContext2D, p: Projectile, time: number) {
  // 버스트 얼티밋 대폭발 — 하얀 섬광 → 주황 화구 → 퍼지는 고리
  const kk = Math.min(1, p.age / 16);
  const fade = Math.max(0, 1 - p.age / p.life);
  ctx.globalCompositeOperation = 'lighter';
  const R = 520 * kk + 40;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  g.addColorStop(0, rgba('#ffffff', 0.95 * fade));
  g.addColorStop(0.3, rgba('#ffdc78', 0.85 * fade));
  g.addColorStop(0.7, rgba('#ff5a1e', 0.5 * fade));
  g.addColorStop(1, 'rgba(255,40,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', fade);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.9 + Math.sin(time * 30) * 4, 0, TAU);
  ctx.stroke();
}

/* =========================================================
 * 근접 기술 이펙트
 * ========================================================= */

export function drawMoveFx(ctx: CanvasRenderingContext2D, f: Fighter, time: number) {
  const d = f.moveDef;
  if (!d) return;
  const [light, deep] = fxColor(d.fx);

  // 받아치기 자세 — 앞에 얼음 결계
  if (d.parry && f.act === 'attack' && f.t > d.startup && f.t <= d.startup + d.active) {
    const x = f.x + f.facing * 46;
    const y = GROUND_Y - f.h - 90;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.scale(f.facing, 1);
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 78, 0, -1.3, 1.3);
    glowStroke(ctx, deep, 3);
    for (let i = 0; i < 4; i++) {
      const yy = -60 + i * 40 + Math.sin(time * 6 + i) * 4;
      ctx.fillStyle = rgba('#e8faff', 0.8);
      ctx.beginPath();
      ctx.moveTo(14, yy - 6);
      ctx.lineTo(20, yy);
      ctx.lineTo(14, yy + 6);
      ctx.lineTo(8, yy);
      ctx.fill();
    }
    ctx.restore();
  }

  // 초필살기 고유 연출 (지속 동안)
  if (d.look && f.act === 'attack' && f.t > d.startup && f.t <= d.startup + d.active) {
    drawSuperLook(ctx, f, time, light, deep);
  }

  if (!d.box || !f.isActive()) return;
  const k = (f.t - d.startup) / Math.max(1, d.active);
  const cx = f.x + f.facing * d.box.x;
  const cy = GROUND_Y - (f.h + d.box.y);
  const w = d.box.w;
  const h = d.box.h;
  const big = d.superLevel > 0;
  ctx.save();
  ctx.globalAlpha = Math.max(0.2, 1 - k * 0.6);

  if (d.look === 'frostField' || d.look === 'overdrive') {
    ctx.restore();
    return;
  }

  // 멀리 던지는 사슬 · 인형 손도 빔처럼 이어서 그린다
  const longThrow = d.anim === 'throw' && d.box.x > 120;
  if (d.anim === 'beam' || longThrow || (big && w > 400)) {
    drawBeam(ctx, f, time, cx, cy, w, h, light, deep, k);
    ctx.restore();
    return;
  }

  ctx.globalCompositeOperation = 'lighter';
  switch (d.anim) {
    case 'spin':
      spinRing(ctx, f, cx, cy, w, h, light, deep, time);
      break;
    case 'upper':
      risingCrescent(ctx, f, cx, cy, w, h, light, deep, k);
      break;
    case 'rush':
    case 'dive':
      rushFx(ctx, f, cx, cy, w, h, light, deep, time);
      break;
    case 'punch':
    case 'cPunch':
    case 'aPunch':
    case 'shoot':
      thrust(ctx, f, cx, cy, w, h, light, deep, k);
      break;
    case 'stomp':
      stompFx(ctx, cx, GROUND_Y - f.h, w, light, deep, k);
      break;
    case 'grab':
      grabFx(ctx, cx, cy, h, light, deep, time);
      break;
    default:
      crescent(ctx, f, cx, cy, w, h, light, deep, k);
  }
  ctx.restore();
}

/** 초승달 베기 궤적 — 꼬리는 투명하고 앞끝은 하얗게 빛난다 */
function crescent(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  cx: number,
  cy: number,
  w: number,
  h: number,
  light: string,
  deep: string,
  k: number,
) {
  const r = Math.max(w, h) * 0.55;
  const ox = cx - f.facing * r * 0.45;
  const span = 2.5;
  const a0 = -1.25;
  const a1 = a0 + span * Math.min(1, 0.35 + k * 1.1);
  const thick = Math.max(8, h * 0.32);
  ctx.save();
  ctx.translate(ox, cy);
  ctx.scale(f.facing, 1);
  // 두께가 변하는 초승달 (안쪽 원을 앞으로 비켜서)
  ctx.beginPath();
  ctx.arc(0, 0, r, a0, a1);
  ctx.arc(-thick * 0.4, 0, r - thick, a1, a0, true);
  ctx.closePath();
  const g = ctx.createLinearGradient(
    Math.cos(a0) * r,
    Math.sin(a0) * r,
    Math.cos(a1) * r,
    Math.sin(a1) * r,
  );
  g.addColorStop(0, rgba(deep, 0));
  g.addColorStop(0.6, rgba(deep, 0.8));
  g.addColorStop(1, rgba(light, 1));
  ctx.fillStyle = g;
  ctx.fill();
  // 바깥 날 선
  ctx.beginPath();
  ctx.arc(0, 0, r, a0 + span * 0.35, a1);
  glowStroke(ctx, light, 2.2);
  // 끝 섬광
  orb(ctx, Math.cos(a1) * r, Math.sin(a1) * r, thick * 1.2, light, 0.9);
  ctx.restore();
}

/** 찌르기 · 주먹 — 앞으로 뻗는 빛 줄기 + 끝 별빛 */
function thrust(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  cx: number,
  cy: number,
  w: number,
  h: number,
  light: string,
  deep: string,
  k: number,
) {
  const tip = cx + (f.facing * w) / 2;
  const tail = cx - (f.facing * w) / 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(tail - f.facing * 10, cy + i * h * 0.25);
    ctx.lineTo(tip, cy + i * h * 0.05);
    glowStroke(ctx, i === 0 ? deep : rgba(light, 0.6), i === 0 ? 3 : 1.5);
  }
  const s = h * (0.9 + (1 - k) * 0.6);
  ctx.fillStyle = rgba('#ffffff', 0.95 * (1 - k * 0.5));
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const r = i % 2 ? s * 0.22 : s * 0.75;
    ctx.lineTo(tip + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.fill();
  orb(ctx, tip, cy, s, deep, 0.7);
}

/** 회전 — 몸을 둘러싸는 두 겹 회오리 고리 */
function spinRing(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  cx: number,
  cy: number,
  w: number,
  h: number,
  light: string,
  deep: string,
  time: number,
) {
  const rx = w / 2;
  const ry = Math.min(h / 2, rx * 0.35);
  for (let i = 0; i < 3; i++) {
    const a = time * 14 * f.facing + i * 2.1;
    ctx.beginPath();
    ctx.ellipse(cx, cy + (i - 1) * ry * 0.6, rx * (1 - i * 0.12), ry, 0, a, a + 3.6);
    glowStroke(ctx, i === 1 ? light : deep, 4 - i);
  }
  orb(ctx, cx, cy, rx * 0.6, deep, 0.25);
}

/** 올려치기 — 아래에서 위로 솟는 초승달 기둥 */
function risingCrescent(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  cx: number,
  cy: number,
  w: number,
  h: number,
  light: string,
  deep: string,
  k: number,
) {
  const g = ctx.createLinearGradient(0, cy + h / 2, 0, cy - h / 2);
  g.addColorStop(0, rgba(deep, 0.9));
  g.addColorStop(0.6, rgba(light, 0.6));
  g.addColorStop(1, rgba(light, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - (f.facing * w) / 2, cy + h / 2);
  ctx.quadraticCurveTo(cx + (f.facing * w) / 2, cy, cx, cy - h / 2 - 20);
  ctx.quadraticCurveTo(cx + f.facing * w * 0.1, cy, cx - (f.facing * w) / 3, cy + h / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - (f.facing * w) / 2, cy + h / 2);
  ctx.quadraticCurveTo(cx + (f.facing * w) / 2, cy, cx, cy - h / 2 - 20);
  glowStroke(ctx, light, 2.5);
  orb(ctx, cx, cy - h / 2, w * (0.6 + (1 - k) * 0.4), deep, 0.6);
}

/** 돌진 — 몸 앞의 충격파 원뿔 + 뒤로 흐르는 속도선 */
function rushFx(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  cx: number,
  cy: number,
  w: number,
  h: number,
  light: string,
  deep: string,
  time: number,
) {
  for (let i = 0; i < 7; i++) {
    const yy = cy - h / 2 + (i / 6) * h;
    const len = 50 + ((time * 1100 + i * 41) % 80);
    ctx.beginPath();
    ctx.moveTo(f.x - f.facing * 16, yy);
    ctx.lineTo(f.x - f.facing * (16 + len), yy);
    glowStroke(ctx, i % 2 ? deep : light, 1.6);
  }
  const front = cx + (f.facing * w) / 2;
  ctx.save();
  ctx.translate(front, cy);
  ctx.scale(f.facing, 1);
  ctx.beginPath();
  ctx.ellipse(-8, 0, 16, h * 0.55, 0, -1.4, 1.4);
  glowStroke(ctx, light, 3);
  ctx.restore();
  orb(ctx, cx, cy, Math.max(w, h) * 0.55, deep, 0.4);
}

function stompFx(
  ctx: CanvasRenderingContext2D,
  x: number,
  gy: number,
  w: number,
  light: string,
  deep: string,
  k: number,
) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(1, 0.25);
  ctx.beginPath();
  ctx.arc(0, 0, w * (0.4 + k), 0, TAU);
  glowStroke(ctx, light, 5);
  ctx.restore();
  orb(ctx, x, gy - 6, w * 0.6, deep, 0.6 * (1 - k));
}

function grabFx(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  h: number,
  light: string,
  deep: string,
  time: number,
) {
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.35 + i * 8, time * 6 + i, time * 6 + i + 2.2);
    glowStroke(ctx, i === 1 ? light : deep, 2.5);
  }
}

/** 빔 계열 근접 기술 (사슬 · 화염방사 · 산탄 · 레퀴엠) */
function drawBeam(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  time: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  light: string,
  deep: string,
  k: number,
) {
  const d = f.moveDef;
  if (!d) return;
  const x0 = f.x + f.facing * 30;
  const x1 = cx + (f.facing * w) / 2;
  switch (d.fx) {
    case 'shadow': {
      // 그림자 사슬 — 금속 고리 줄 + 끝 갈고리 + 어둠 안개
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      ctx.lineTo(x1, cy);
      glowStroke(ctx, deep, 6, light);
      ctx.globalCompositeOperation = 'source-over';
      const n = Math.max(2, Math.floor(Math.abs(x1 - x0) / 13));
      for (let i = 0; i < n; i++) {
        const px = x0 + ((x1 - x0) * i) / n;
        ctx.save();
        ctx.translate(px, cy + Math.sin(i * 0.8 + time * 20) * 2);
        ctx.rotate(i % 2 ? Math.PI / 2 : 0);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 4, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#b8b0c8';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x1, cy);
      ctx.scale(f.facing, 1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(-6, 8, 14, -1.6, 1.4);
      ctx.stroke();
      ctx.strokeStyle = '#d8d0e8';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'fire': {
      // 화염방사 — 퍼져 나가는 원뿔 모양 불꽃 덩어리
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const t = (time * 3 + i / 14) % 1;
        const px = x0 + (x1 - x0) * t;
        const r = h * (0.18 + t * 0.55);
        const py = cy + Math.sin(time * 25 + i * 2) * h * 0.15 * t;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, rgba('#fff6d0', 0.9 * (1 - t)));
        g.addColorStop(0.4, rgba(light, 0.7 * (1 - t * 0.5)));
        g.addColorStop(1, rgba(deep, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'bullet': {
      // 산탄 — 총구 섬광 + 부채꼴 탄 궤적
      ctx.globalCompositeOperation = 'lighter';
      orb(ctx, x0 + f.facing * 10, cy, 40 * (1 - k), light, 1);
      for (let i = 0; i < 9; i++) {
        const a = (i / 8 - 0.5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x0, cy);
        ctx.lineTo(x0 + f.facing * Math.cos(a) * w, cy + Math.sin(a) * w);
        glowStroke(ctx, rgba(deep, 1 - k), 1.4);
      }
      break;
    }
    case 'ghost': {
      // 스펙트럴 레퀴엠 — 굵은 영혼 광선 + 흘러가는 해골 + 물결치는 가장자리
      ctx.globalCompositeOperation = 'lighter';
      const l = Math.min(x0, x1);
      const bw = Math.abs(x1 - x0);
      const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
      g.addColorStop(0, rgba(deep, 0));
      g.addColorStop(0.3, rgba(deep, 0.8));
      g.addColorStop(0.5, rgba('#ffffff', 0.95));
      g.addColorStop(0.7, rgba(deep, 0.8));
      g.addColorStop(1, rgba(deep, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(l, cy - h / 2);
      for (let x = 0; x <= bw; x += 20) {
        ctx.lineTo(l + x, cy - h / 2 + Math.sin(x * 0.05 + time * 20) * 6);
      }
      for (let x = bw; x >= 0; x -= 20) {
        ctx.lineTo(l + x, cy + h / 2 + Math.sin(x * 0.05 - time * 20) * 6);
      }
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 6; i++) {
        const px = x0 + f.facing * ((time * 700 + i * 150) % bw);
        const py = cy + Math.sin(time * 6 + i) * h * 0.2;
        ctx.fillStyle = 'rgba(230,255,250,0.85)';
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#0a3a34';
        ctx.beginPath();
        ctx.arc(px - 4, py - 2, 3, 0, TAU);
        ctx.arc(px + 4, py - 2, 3, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'puppet': {
      // 인형의 손 — 손끝에서 뻗어 나가는 분홍 조종 실 다발
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const sag = Math.sin(time * 9 + i) * 10 + (i - 2) * 6;
        ctx.beginPath();
        ctx.moveTo(x0, cy - 20 + i * 4);
        ctx.quadraticCurveTo((x0 + x1) / 2, cy + sag, x1, cy - 6 + i * 3);
        glowStroke(ctx, light, 1.2, '#fff0f6');
      }
      orb(ctx, x1, cy, h * 0.6, deep, 0.7);
      break;
    }
    case 'rose': {
      // 스칼렛 크랙 — 땅을 스치는 채찍 균열 + 튀는 꽃잎
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      for (let i = 1; i <= 10; i++) {
        const px = x0 + ((x1 - x0) * i) / 10;
        ctx.lineTo(px, cy + (i % 2 ? -4 : 4));
      }
      glowStroke(ctx, deep, 3);
      for (let i = 0; i < 6; i++) {
        const t = (time * 2 + hash(i)) % 1;
        orb(ctx, x0 + (x1 - x0) * hash(i + 3), cy - t * 30, 6, light, 1 - t);
      }
      break;
    }
    default: {
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      ctx.lineTo(x1, cy);
      glowStroke(ctx, deep, Math.min(10, h * 0.3));
    }
  }
}

/** 초필살기 고유 연출 — 절대영도 · 블러드 문 · 오버드라이브 */
function drawSuperLook(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  time: number,
  light: string,
  deep: string,
) {
  const d = f.moveDef;
  if (!d) return;
  const k = (f.t - d.startup) / Math.max(1, d.active);
  ctx.save();
  if (d.look === 'frostField') {
    // 절대영도 — 화면 전체가 얼어붙는다 (땅에서 얼음 가시가 자라고 푸른 냉기가 덮인다)
    const W = 1200;
    ctx.fillStyle = rgba('#bfe8ff', 0.16 + Math.min(0.2, k * 0.4));
    ctx.fillRect(f.x - W / 2, 0, W, GROUND_Y + 80);
    const grow = Math.min(1, k * 2.2);
    for (let i = 0; i < 26; i++) {
      const x = f.x + (i / 25 - 0.5) * W;
      const h = (30 + hash(i) * 80) * grow;
      const g = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y - h);
      g.addColorStop(0, 'rgba(120,200,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0.95)');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(30,90,160,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 10 - hash(i + 3) * 8, GROUND_Y);
      ctx.lineTo(x + (hash(i + 5) - 0.5) * 10, GROUND_Y - h);
      ctx.lineTo(x + 10 + hash(i + 4) * 8, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 마지막 일격 직전 — 화면을 가르는 하얀 일섬
    if (k > 0.85) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(f.x - W / 2, GROUND_Y - 160);
      ctx.lineTo(f.x + W / 2, GROUND_Y - 60);
      glowStroke(ctx, deep, 6);
    }
  } else if (d.look === 'bloodMoon') {
    // 블러드 문 — 등 뒤에 떠오르는 붉은 달 + 묶인 상대 위로 교차하는 베기
    ctx.globalCompositeOperation = 'lighter';
    orb(ctx, f.x, GROUND_Y - 300, 120, '#ff1a3a', 0.55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(120,0,20,0.85)';
    ctx.beginPath();
    ctx.arc(f.x, GROUND_Y - 300, 56, 0, TAU);
    ctx.fill();
    if (f.connected) {
      ctx.globalCompositeOperation = 'lighter';
      const vx = f.x + f.facing * 74;
      const vy = GROUND_Y - f.h - 90;
      for (let i = 0; i < Math.min(4, f.moveHits); i++) {
        const a = (i * 0.9 + 0.4) * (i % 2 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(vx - Math.cos(a) * 70, vy - Math.sin(a) * 70);
        ctx.lineTo(vx + Math.cos(a) * 70, vy + Math.sin(a) * 70);
        glowStroke(ctx, deep, 4);
      }
    }
  } else if (d.look === 'overdrive') {
    // 오버드라이브 — 몸에서 터지는 번개 구체
    ctx.globalCompositeOperation = 'lighter';
    const cy = GROUND_Y - f.h - 100;
    orb(ctx, f.x, cy, 160 * (0.6 + k * 0.6), deep, 0.7 * (1 - k * 0.5));
    const seed = Math.floor(time * 24);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + hash(seed + i);
      lightning(
        ctx,
        f.x,
        cy,
        f.x + Math.cos(a) * 150,
        cy + Math.sin(a) * 120,
        seed + i * 11,
        26,
        i % 2 ? light : deep,
        3,
      );
    }
  }
  ctx.restore();
}
