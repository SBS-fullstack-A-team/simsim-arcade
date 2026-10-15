/**
 * 심심파이터즈 — 스테이지 배경 · 투사체 · 기술 이펙트 그리기
 */
import { GROUND_Y, STAGE_W, VIEW_H, VIEW_W } from './config';
import type { Fighter } from './fighter';
import { fxColor } from './fx';
import type { Projectile } from './hitbox';

const TAU = Math.PI * 2;

export interface StageDef {
  name: string;
  sky: [string, string, string];
  ground: [string, string];
  accent: string;
  weather: 'embers' | 'rain' | 'petals' | 'motes';
}

export const STAGES: readonly StageDef[] = [
  {
    name: '달빛 고딕 대성당',
    sky: ['#070312', '#24103e', '#5a1a4a'],
    ground: ['#2a2030', '#140e1a'],
    accent: '#ff5a8a',
    weather: 'motes',
  },
  {
    name: '네온 시티 옥상',
    sky: ['#04061a', '#141a4a', '#4a1a6a'],
    ground: ['#1a1e2a', '#0a0c14'],
    accent: '#3affd0',
    weather: 'rain',
  },
  {
    name: '용암 투기장',
    sky: ['#120404', '#4a0e08', '#c8401a'],
    ground: ['#3a1a14', '#1a0a08'],
    accent: '#ff8a2a',
    weather: 'embers',
  },
  {
    name: '벚꽃 달밤 신사',
    sky: ['#0a0a24', '#2a2050', '#a85a8a'],
    ground: ['#3a2a30', '#1a1218'],
    accent: '#ffb0d0',
    weather: 'petals',
  },
];

/** 레이어별 시차 (카메라가 움직일 때 먼 배경은 덜 움직인다) */
const FAR = 0.3;
const MID = 0.62;

function layerW(par: number) {
  return Math.ceil(VIEW_W + (STAGE_W - VIEW_W) * par);
}

function makeCanvas(w: number, h: number, q: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * q);
  c.height = Math.ceil(h * q);
  const g = c.getContext('2d');
  if (g) g.setTransform(q, 0, 0, q, 0, 0);
  return { c, g };
}

/** 고정 시드 난수 (배경이 매번 같게) */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class StageRenderer {
  private far: HTMLCanvasElement;
  private mid: HTMLCanvasElement;
  private floor: HTMLCanvasElement;
  private q: number;
  readonly def: StageDef;
  private weather: { x: number; y: number; v: number; s: number; p: number }[] = [];

  constructor(index: number, q: number) {
    this.def = STAGES[index % STAGES.length] as StageDef;
    this.q = q;
    const fw = layerW(FAR);
    const mw = layerW(MID);
    const far = makeCanvas(fw, GROUND_Y, q);
    const mid = makeCanvas(mw, GROUND_Y + 10, q);
    const floor = makeCanvas(STAGE_W, VIEW_H - GROUND_Y + 40, q);
    if (far.g) this.paintFar(far.g, fw, index);
    if (mid.g) this.paintMid(mid.g, mw, index);
    if (floor.g) this.paintFloor(floor.g, index);
    this.far = far.c;
    this.mid = mid.c;
    this.floor = floor.c;
    const rnd = seeded(77 + index);
    for (let i = 0; i < 70; i++) {
      this.weather.push({
        x: rnd() * VIEW_W,
        y: rnd() * VIEW_H,
        v: 0.5 + rnd(),
        s: 1 + rnd() * 2.5,
        p: rnd() * TAU,
      });
    }
  }

  /** camX = 화면 왼쪽 끝의 월드 x */
  draw(ctx: CanvasRenderingContext2D, camX: number, time: number, dt: number) {
    const q = this.q;
    const fx = camX * FAR;
    const mx = camX * MID;
    ctx.drawImage(this.far, fx * q, 0, VIEW_W * q, GROUND_Y * q, 0, 0, VIEW_W, GROUND_Y);
    this.drawAnimatedFar(ctx, time);
    ctx.drawImage(
      this.mid,
      mx * q,
      0,
      VIEW_W * q,
      (GROUND_Y + 10) * q,
      0,
      0,
      VIEW_W,
      GROUND_Y + 10,
    );
    ctx.drawImage(
      this.floor,
      camX * q,
      0,
      VIEW_W * q,
      (VIEW_H - GROUND_Y + 40) * q,
      0,
      GROUND_Y - 20,
      VIEW_W,
      VIEW_H - GROUND_Y + 40,
    );
    this.updateWeather(dt);
  }

  /** 캐릭터 앞에 그리는 날씨 */
  drawWeather(ctx: CanvasRenderingContext2D, time: number) {
    const w = this.def.weather;
    ctx.save();
    for (const p of this.weather) {
      switch (w) {
        case 'rain':
          ctx.strokeStyle = 'rgba(160,200,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 4, p.y + 14 * p.v);
          ctx.stroke();
          break;
        case 'embers':
          ctx.fillStyle = `rgba(255,${120 + Math.round(p.v * 60)},40,${0.5 + Math.sin(time * 4 + p.p) * 0.3})`;
          ctx.fillRect(p.x, p.y, p.s, p.s);
          break;
        case 'petals':
          ctx.fillStyle = 'rgba(255,190,215,0.75)';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.s * 1.6, p.s * 0.8, time * p.v + p.p, 0, TAU);
          ctx.fill();
          break;
        case 'motes':
          ctx.fillStyle = `rgba(255,200,230,${0.25 + Math.sin(time * 2 + p.p) * 0.2})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * 0.8, 0, TAU);
          ctx.fill();
          break;
      }
    }
    ctx.restore();
  }

  private updateWeather(dt: number) {
    const w = this.def.weather;
    for (const p of this.weather) {
      if (w === 'rain') {
        p.y += 620 * p.v * dt;
        p.x -= 120 * dt;
      } else if (w === 'embers') {
        p.y -= 50 * p.v * dt;
        p.x += Math.sin(p.y * 0.02 + p.p) * 20 * dt;
      } else if (w === 'petals') {
        p.y += 40 * p.v * dt;
        p.x += (30 + Math.sin(p.y * 0.03 + p.p) * 40) * dt;
      } else {
        p.y -= 12 * p.v * dt;
        p.x += Math.sin(p.y * 0.01 + p.p) * 10 * dt;
      }
      if (p.y > VIEW_H) p.y -= VIEW_H + 20;
      if (p.y < -20) p.y += VIEW_H + 20;
      if (p.x > VIEW_W + 10) p.x -= VIEW_W + 20;
      if (p.x < -10) p.x += VIEW_W + 20;
    }
  }

  private drawAnimatedFar(ctx: CanvasRenderingContext2D, time: number) {
    const w = this.def.weather;
    if (w === 'rain' && Math.sin(time * 0.7) > 0.985) {
      // 번개
      ctx.fillStyle = 'rgba(200,220,255,0.12)';
      ctx.fillRect(0, 0, VIEW_W, GROUND_Y);
    }
  }

  private sky(g: CanvasRenderingContext2D, w: number) {
    const [a, b, c] = this.def.sky;
    const grad = g.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, a);
    grad.addColorStop(0.6, b);
    grad.addColorStop(1, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, GROUND_Y);
    const rnd = seeded(5);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 120; i++) {
      const s = rnd() * 1.6;
      g.fillRect(rnd() * w, rnd() * GROUND_Y * 0.6, s, s);
    }
  }

  private paintFar(g: CanvasRenderingContext2D, w: number, index: number) {
    this.sky(g, w);
    const rnd = seeded(index * 31 + 3);
    switch (index % STAGES.length) {
      case 0: {
        // 붉은 달 + 첨탑 실루엣
        const mx = w * 0.7;
        const glow = g.createRadialGradient(mx, 110, 10, mx, 110, 160);
        glow.addColorStop(0, 'rgba(255,120,160,0.6)');
        glow.addColorStop(1, 'rgba(255,60,120,0)');
        g.fillStyle = glow;
        g.fillRect(mx - 170, 0, 340, 300);
        g.fillStyle = '#ffd0dc';
        g.beginPath();
        g.arc(mx, 110, 54, 0, TAU);
        g.fill();
        g.fillStyle = '#12081e';
        for (let x = -20; x < w; x += 70 + rnd() * 60) {
          const h = 160 + rnd() * 160;
          g.fillRect(x, GROUND_Y - h, 40, h);
          g.beginPath();
          g.moveTo(x - 6, GROUND_Y - h);
          g.lineTo(x + 20, GROUND_Y - h - 60 - rnd() * 40);
          g.lineTo(x + 46, GROUND_Y - h);
          g.fill();
        }
        break;
      }
      case 1: {
        // 고층 빌딩 + 창문 불빛
        for (let layer = 0; layer < 2; layer++) {
          for (let x = -10; x < w; x += 50 + rnd() * 50) {
            const h = 140 + rnd() * 240 - layer * 60;
            const bw = 40 + rnd() * 40;
            g.fillStyle = layer === 0 ? '#0c1030' : '#141a40';
            g.fillRect(x, GROUND_Y - h, bw, h);
            for (let wy = GROUND_Y - h + 10; wy < GROUND_Y - 10; wy += 14) {
              for (let wx = x + 6; wx < x + bw - 6; wx += 10) {
                if (rnd() < 0.35) {
                  g.fillStyle = rnd() < 0.5 ? 'rgba(255,90,220,0.7)' : 'rgba(80,240,255,0.7)';
                  g.fillRect(wx, wy, 4, 6);
                }
              }
            }
          }
        }
        break;
      }
      case 2: {
        // 화산 + 용암 빛
        g.fillStyle = '#1a0604';
        g.beginPath();
        g.moveTo(w * 0.2, GROUND_Y);
        g.lineTo(w * 0.45, 140);
        g.lineTo(w * 0.55, 150);
        g.lineTo(w * 0.85, GROUND_Y);
        g.fill();
        const lava = g.createLinearGradient(0, 140, 0, GROUND_Y);
        lava.addColorStop(0, 'rgba(255,140,40,0.9)');
        lava.addColorStop(1, 'rgba(255,60,20,0)');
        g.strokeStyle = lava;
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(w * 0.5, 150);
        g.quadraticCurveTo(w * 0.52, 260, w * 0.46, GROUND_Y);
        g.stroke();
        g.fillStyle = 'rgba(255,120,40,0.35)';
        g.beginPath();
        g.ellipse(w * 0.5, 140, 80, 30, 0, 0, TAU);
        g.fill();
        break;
      }
      default: {
        // 큰 달 + 산 + 벚나무
        g.fillStyle = '#fff2f8';
        g.beginPath();
        g.arc(w * 0.3, 120, 70, 0, TAU);
        g.fill();
        g.fillStyle = '#1a1438';
        g.beginPath();
        g.moveTo(0, GROUND_Y);
        for (let x = 0; x <= w; x += 40)
          g.lineTo(x, GROUND_Y - 120 - Math.sin(x * 0.01) * 60 - rnd() * 20);
        g.lineTo(w, GROUND_Y);
        g.fill();
        break;
      }
    }
  }

  private paintMid(g: CanvasRenderingContext2D, w: number, index: number) {
    const rnd = seeded(index * 17 + 9);
    switch (index % STAGES.length) {
      case 0: {
        // 성당 기둥 + 스테인드글라스
        for (let x = 40; x < w; x += 220) {
          g.fillStyle = '#1e1428';
          g.fillRect(x, 60, 46, GROUND_Y - 50);
          g.fillStyle = '#2a1c38';
          g.fillRect(x + 6, 60, 8, GROUND_Y - 50);
          const gx = x + 110;
          g.save();
          g.beginPath();
          g.moveTo(gx - 40, 330);
          g.lineTo(gx - 40, 150);
          g.quadraticCurveTo(gx, 90, gx + 40, 150);
          g.lineTo(gx + 40, 330);
          g.closePath();
          g.fillStyle = '#100818';
          g.fill();
          g.clip();
          const cols = ['#ff3a6a', '#3a8aff', '#ffd04a', '#8a3aff'];
          for (let i = 0; i < 16; i++) {
            g.fillStyle = cols[i % 4] as string;
            g.globalAlpha = 0.55;
            g.fillRect(gx - 40 + (i % 4) * 20, 110 + Math.floor(i / 4) * 55, 18, 52);
          }
          g.globalAlpha = 1;
          g.restore();
        }
        break;
      }
      case 1: {
        // 옥상 난간 · 네온 간판
        for (let x = 30; x < w; x += 260 + rnd() * 80) {
          g.fillStyle = '#10142a';
          g.fillRect(x, GROUND_Y - 150, 120, 150);
          g.shadowColor = rnd() < 0.5 ? '#ff3ad8' : '#3affd0';
          g.shadowBlur = 16;
          g.strokeStyle = g.shadowColor;
          g.lineWidth = 4;
          g.strokeRect(x + 14, GROUND_Y - 130, 92, 40);
          g.font = 'bold 22px sans-serif';
          g.fillStyle = g.shadowColor;
          g.fillText(
            ['오락실', 'FIGHT', '24시', '심심'][Math.floor(rnd() * 4)] as string,
            x + 26,
            GROUND_Y - 102,
          );
          g.shadowBlur = 0;
        }
        g.fillStyle = '#1c2236';
        g.fillRect(0, GROUND_Y - 40, w, 8);
        for (let x = 0; x < w; x += 30) g.fillRect(x, GROUND_Y - 40, 4, 40);
        break;
      }
      case 2: {
        // 투기장 돌기둥 + 화로
        for (let x = 60; x < w; x += 240) {
          g.fillStyle = '#2a1410';
          g.fillRect(x, GROUND_Y - 260, 50, 260);
          g.fillStyle = '#3a1c14';
          g.fillRect(x - 8, GROUND_Y - 270, 66, 16);
          const fire = g.createRadialGradient(
            x + 25,
            GROUND_Y - 290,
            2,
            x + 25,
            GROUND_Y - 290,
            40,
          );
          fire.addColorStop(0, 'rgba(255,220,120,1)');
          fire.addColorStop(1, 'rgba(255,80,20,0)');
          g.fillStyle = fire;
          g.fillRect(x - 15, GROUND_Y - 330, 80, 80);
        }
        break;
      }
      default: {
        // 도리이 + 벚나무
        for (let x = 80; x < w; x += 360) {
          g.fillStyle = '#a8202a';
          g.fillRect(x, GROUND_Y - 220, 16, 220);
          g.fillRect(x + 140, GROUND_Y - 220, 16, 220);
          g.fillRect(x - 24, GROUND_Y - 236, 204, 18);
          g.fillRect(x - 6, GROUND_Y - 196, 168, 12);
          for (let i = 0; i < 26; i++) {
            g.fillStyle = `rgba(255,${170 + Math.floor(rnd() * 40)},${200 + Math.floor(rnd() * 30)},0.8)`;
            g.beginPath();
            g.arc(
              x + 230 + (rnd() - 0.5) * 120,
              GROUND_Y - 250 + (rnd() - 0.5) * 80,
              14 + rnd() * 18,
              0,
              TAU,
            );
            g.fill();
          }
          g.fillStyle = '#2a1418';
          g.fillRect(x + 224, GROUND_Y - 230, 12, 230);
        }
        break;
      }
    }
  }

  private paintFloor(g: CanvasRenderingContext2D, index: number) {
    const [a, b] = this.def.ground;
    const h = VIEW_H - GROUND_Y + 40;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);
    g.fillStyle = grad;
    g.fillRect(0, 20, STAGE_W, h);
    g.fillStyle = this.def.accent;
    g.globalAlpha = 0.5;
    g.fillRect(0, 20, STAGE_W, 2);
    g.globalAlpha = 1;
    const rnd = seeded(index + 101);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 1;
    // 원근감 있는 바닥 줄
    for (let x = -400; x < STAGE_W + 400; x += 80) {
      g.beginPath();
      g.moveTo(x, 22);
      g.lineTo(x + (x - STAGE_W / 2) * 0.5, h);
      g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(0, 22 + i * i * 7 + i * 6);
      g.lineTo(STAGE_W, 22 + i * i * 7 + i * 6);
      g.stroke();
    }
    if (index % STAGES.length === 2) {
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `rgba(255,${100 + Math.floor(rnd() * 80)},30,0.5)`;
        g.lineWidth = 2;
        g.beginPath();
        const x = rnd() * STAGE_W;
        g.moveTo(x, 30 + rnd() * 40);
        g.lineTo(x + 30 + rnd() * 40, 40 + rnd() * 40);
        g.stroke();
      }
    }
    if (index % STAGES.length === 1) {
      // 젖은 바닥에 비친 네온
      for (let i = 0; i < 20; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(255,60,220,0.12)' : 'rgba(60,255,220,0.12)';
        g.fillRect(rnd() * STAGE_W, 26 + rnd() * 30, 40 + rnd() * 60, 3);
      }
    }
  }
}

/* =========================================================
 * 투사체
 * ========================================================= */

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, time: number) {
  const x = p.x;
  const y = GROUND_Y - p.y;
  const [light, deep] = fxColor(p.fx);
  const f = p.facing;
  const ready = p.age >= p.delay;
  const k = Math.min(1, p.age / Math.max(1, p.delay));
  ctx.save();
  ctx.translate(x, y);
  switch (p.fx) {
    case 'fire': {
      // 땅을 타고 가는 불기둥
      for (let i = 0; i < 6; i++) {
        const fy = p.h / 2 - i * (p.h / 6);
        const w = p.w * (0.5 + Math.sin(time * 20 + i) * 0.15) * (1 - i * 0.1);
        ctx.fillStyle = i < 2 ? deep : i < 4 ? '#ff9a2a' : light;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(Math.sin(time * 14 + i) * 4, fy, w / 2, p.h / 7, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'volt': {
      ctx.shadowColor = deep;
      ctx.shadowBlur = 18;
      if (p.sky) {
        bolt(ctx, 0, -p.h / 2, 0, p.h / 2, light, 6);
        bolt(ctx, 0, -p.h / 2, 0, p.h / 2, deep, 3);
      } else {
        ctx.fillStyle = deep;
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 3, 0, TAU);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          const a = time * 12 + i * 2;
          bolt(ctx, 0, 0, Math.cos(a) * p.w, Math.sin(a) * p.w, light, 2);
        }
      }
      break;
    }
    case 'steel': {
      // 로켓 펀치
      ctx.scale(f, 1);
      ctx.fillStyle = '#ffb02a';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(-p.w / 2, -8);
      ctx.lineTo(-p.w / 2 - 30 - Math.random() * 14, 0);
      ctx.lineTo(-p.w / 2, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c8d0d8';
      ctx.beginPath();
      ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 8);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0e0812';
      ctx.stroke();
      ctx.fillStyle = '#ff8a2a';
      ctx.fillRect(p.w / 2 - 12, -p.h / 2 + 4, 6, p.h - 8);
      break;
    }
    case 'sound': {
      ctx.scale(f, 1);
      ctx.lineWidth = 5;
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = i % 2 ? deep : light;
        ctx.globalAlpha = 0.85 - i * 0.15;
        ctx.beginPath();
        ctx.ellipse(-i * 22, 0, p.w / 4 + i * 6, p.h / 2 - i * 8, 0, -1.2, 1.2);
        ctx.stroke();
      }
      break;
    }
    case 'poison': {
      if (p.landed) {
        for (let i = 0; i < 5; i++) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = i % 2 ? deep : light;
          ctx.beginPath();
          ctx.arc(
            Math.sin(time * 2 + i) * 30,
            Math.cos(time * 3 + i) * 10 - 10,
            24 + i * 3,
            0,
            TAU,
          );
          ctx.fill();
        }
      } else if (p.w > 80) {
        // 대연성 — 거대한 연금 화염 기둥
        const g = ctx.createLinearGradient(0, p.h / 2, 0, -p.h / 2);
        g.addColorStop(0, deep);
        g.addColorStop(0.6, light);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w / 2 + Math.sin(time * 18) * 6, p.h / 2, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.rotate(time * 10);
        ctx.fillStyle = 'rgba(220,255,220,0.5)';
        ctx.beginPath();
        ctx.arc(0, 2, 11, 0, TAU);
        ctx.fill();
        ctx.fillStyle = deep;
        ctx.fillRect(-8, 0, 16, 9);
        ctx.fillStyle = '#e8e8e0';
        ctx.fillRect(-3, -14, 6, 8);
      }
      break;
    }
    case 'ice': {
      ctx.scale(f, 1);
      ctx.shadowColor = deep;
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(200,240,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(p.w / 2, 0);
      ctx.quadraticCurveTo(-p.w / 2, -p.h / 2 - 10, -p.w / 2 - 10, -p.h / 2);
      ctx.quadraticCurveTo(0, 0, -p.w / 2 - 10, p.h / 2);
      ctx.quadraticCurveTo(-p.w / 2, p.h / 2 + 10, p.w / 2, 0);
      ctx.fill();
      break;
    }
    case 'venom': {
      ctx.scale(f, 1);
      ctx.strokeStyle = deep;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, -p.h / 2 + i * 6);
        ctx.quadraticCurveTo(0, i * 18, p.w / 2, p.h / 2 + i * 6);
        ctx.stroke();
      }
      ctx.strokeStyle = light;
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, -p.h / 2 + i * 6);
        ctx.quadraticCurveTo(0, i * 18, p.w / 2, p.h / 2 + i * 6);
        ctx.stroke();
      }
      break;
    }
    case 'puppet': {
      // 커튼 콜 — 거대 인형이 위에서 떨어진다
      ctx.globalAlpha = ready ? 1 : 0.4 + k * 0.6;
      ctx.fillStyle = '#6a1a3a';
      ctx.beginPath();
      ctx.ellipse(0, p.h * 0.1, p.w * 0.38, p.h * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0e0812';
      ctx.stroke();
      ctx.fillStyle = '#e8d8c8';
      ctx.beginPath();
      ctx.arc(0, -p.h * 0.32, p.w * 0.26, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0e0812';
      for (const ex of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(ex * p.w * 0.1, -p.h * 0.34, 9, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = '#ff4a7a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo(i * 8, -p.h * 0.24);
        ctx.lineTo(i * 8, -p.h * 0.2);
      }
      ctx.moveTo(-28, -p.h * 0.22);
      ctx.lineTo(28, -p.h * 0.22);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,220,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -p.h * 0.55);
      ctx.lineTo(0, -GROUND_Y);
      ctx.stroke();
      break;
    }
    case 'light': {
      ctx.shadowColor = deep;
      ctx.shadowBlur = 16;
      ctx.fillStyle = light;
      if (p.sky) {
        ctx.fillRect(-p.w / 4, -p.h / 2, p.w / 2, p.h);
        ctx.fillStyle = deep;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 4, p.w, p.h / 2);
        ctx.fillStyle = deep;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      break;
    }
    case 'rose': {
      if (p.vx === 0 || p.w > 60) {
        // 가시 기둥이 땅에서 솟는다
        const rise = ready ? 1 : k;
        ctx.translate(0, p.h / 2);
        ctx.fillStyle = '#2a8a3a';
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, 0);
        ctx.lineTo(0, -p.h * rise);
        ctx.lineTo(p.w / 2, 0);
        ctx.fill();
        ctx.fillStyle = deep;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc((i % 2 ? 1 : -1) * 10, -p.h * rise * (0.25 + i * 0.18), 9, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.rotate(time * 8);
        ctx.fillStyle = deep;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.ellipse(
            Math.cos((i / 5) * TAU) * 6,
            Math.sin((i / 5) * TAU) * 6,
            8,
            5,
            (i / 5) * TAU,
            0,
            TAU,
          );
          ctx.fill();
        }
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'saw': {
      ctx.rotate(time * 30 * f);
      ctx.fillStyle = '#c8ccd8';
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        const r = i % 2 ? p.w / 2 : p.w / 2 - 7;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0e0812';
      ctx.stroke();
      ctx.fillStyle = deep;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fill();
      break;
    }
    case 'ghost': {
      ctx.globalAlpha = ready ? 0.9 : 0.3 + k * 0.5;
      if (p.h > 100) {
        // 땅에서 솟는 망령의 손
        ctx.fillStyle = deep;
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, p.h / 2);
        ctx.quadraticCurveTo(-p.w / 2, -p.h / 3, -10, -p.h / 2);
        ctx.lineTo(0, -p.h / 2 - 14);
        ctx.lineTo(10, -p.h / 2);
        ctx.quadraticCurveTo(p.w / 2, -p.h / 3, p.w / 2, p.h / 2);
        ctx.fill();
        ctx.fillStyle = '#0e0812';
        ctx.fillRect(-14, -p.h / 4, 8, 10);
        ctx.fillRect(6, -p.h / 4, 8, 10);
      } else {
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, Math.PI, 0);
        for (let i = 0; i <= 4; i++)
          ctx.lineTo(
            p.w / 2 - (i * p.w) / 4,
            p.h / 2 + (i % 2 ? -6 : 0) + Math.sin(time * 10 + i) * 2,
          );
        ctx.fill();
        ctx.fillStyle = '#0e0812';
        ctx.beginPath();
        ctx.arc(-7, -4, 4, 0, TAU);
        ctx.arc(7, -4, 4, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'bullet': {
      ctx.scale(f, 1);
      ctx.fillStyle = light;
      ctx.shadowColor = deep;
      ctx.shadowBlur = 10;
      ctx.fillRect(-p.w / 2 - 30, -2, 30, 4);
      ctx.fillStyle = deep;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.w / 2, p.h / 2.6, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'explosion': {
      const kk = Math.min(1, p.age / 16);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 520 * kk + 40);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, 'rgba(255,220,120,0.85)');
      g.addColorStop(0.7, 'rgba(255,90,30,0.5)');
      g.addColorStop(1, 'rgba(255,40,20,0)');
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 520 * kk + 40, 0, TAU);
      ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(0, 0, p.w / 2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function bolt(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  w: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const n = 6;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    ctx.lineTo(
      x1 + (x2 - x1) * k + (Math.random() - 0.5) * 16,
      y1 + (y2 - y1) * k + (Math.random() - 0.5) * 16,
    );
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* =========================================================
 * 근접 기술 이펙트 (베기 궤적 · 빔 · 채찍)
 * ========================================================= */

export function drawMoveFx(ctx: CanvasRenderingContext2D, f: Fighter, time: number) {
  const d = f.moveDef;
  if (!d || !d.box || !f.isActive()) return;
  const [light, deep] = fxColor(d.fx);
  const k = (f.t - d.startup) / Math.max(1, d.active);
  const cx = f.x + f.facing * d.box.x;
  const cy = GROUND_Y - (f.h + d.box.y);
  const w = d.box.w;
  const h = d.box.h;
  const big = d.superLevel > 0;
  ctx.save();
  ctx.globalAlpha = Math.max(0.15, 1 - k * 0.7);

  if (d.anim === 'beam' || (big && w > 400)) {
    const x0 = f.x + f.facing * 30;
    const x1 = cx + (f.facing * w) / 2;
    const l = Math.min(x0, x1);
    const bw = Math.abs(x1 - x0);
    switch (d.fx) {
      case 'shadow': {
        // 그림자 사슬
        ctx.strokeStyle = '#8a80a0';
        ctx.lineWidth = 3;
        for (let x = 0; x < bw; x += 12) {
          const px = f.facing > 0 ? x0 + x : x0 - x;
          ctx.beginPath();
          ctx.ellipse(px, cy + Math.sin(x * 0.1 + time * 20) * 3, 6, 4, 0, 0, TAU);
          ctx.stroke();
        }
        if (big) sweepArc(ctx, f, cx, cy, w, h, deep, light, k);
        break;
      }
      case 'sound':
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i === 1 ? light : deep;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(l, cy - h / 2 + i * (h / 3), bw, h / 3);
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= bw; x += 8) {
          const px = l + x;
          const py = cy + Math.sin(x * 0.15 + time * 40) * h * 0.4;
          if (x === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        break;
      case 'fire': {
        for (let i = 0; i < 10; i++) {
          const kx = i / 10;
          ctx.fillStyle = i % 2 ? deep : light;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(
            x0 + (x1 - x0) * kx,
            cy + Math.sin(time * 30 + i) * 6,
            h * (0.25 + kx * 0.35),
            0,
            TAU,
          );
          ctx.fill();
        }
        break;
      }
      case 'rose':
      case 'puppet':
        // 채찍 · 인형 손은 캐릭터 그리기에서 처리
        break;
      case 'bullet': {
        // 산탄 — 부채꼴 섬광
        ctx.fillStyle = light;
        ctx.globalAlpha = 0.8 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(x0, cy);
        ctx.lineTo(x1, cy - h / 2);
        ctx.lineTo(x1, cy + h / 2);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'ghost': {
        const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
        g.addColorStop(0, 'rgba(74,255,224,0)');
        g.addColorStop(0.5, light);
        g.addColorStop(1, 'rgba(74,255,224,0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(l, cy - h / 2, bw, h);
        for (let i = 0; i < 6; i++) {
          const px = l + ((time * 600 + i * 160) % bw);
          ctx.fillStyle = deep;
          ctx.beginPath();
          ctx.arc(px, cy + Math.sin(time * 8 + i) * h * 0.3, 12, 0, TAU);
          ctx.fill();
        }
        break;
      }
      default:
        ctx.fillStyle = deep;
        ctx.fillRect(l, cy - h / 4, bw, h / 2);
        ctx.fillStyle = light;
        ctx.fillRect(l, cy - h / 8, bw, h / 4);
    }
    ctx.restore();
    return;
  }

  if (d.anim === 'upper') {
    const g = ctx.createLinearGradient(0, cy + h / 2, 0, cy - h / 2);
    g.addColorStop(0, deep);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (d.anim === 'rush' || d.anim === 'dive') {
    ctx.strokeStyle = light;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const yy = cy - h / 2 + (i / 5) * h;
      const len = 40 + ((time * 900 + i * 37) % 60);
      ctx.beginPath();
      ctx.moveTo(f.x - f.facing * 20, yy);
      ctx.lineTo(f.x - f.facing * (20 + len), yy);
      ctx.stroke();
    }
    ctx.fillStyle = deep;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (d.grab) {
    ctx.restore();
    return;
  }

  // 기본 — 초승달 모양 베기 궤적
  sweepArc(ctx, f, cx, cy, w, h, deep, light, k);
  ctx.restore();
}

function sweepArc(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  cx: number,
  cy: number,
  w: number,
  h: number,
  deep: string,
  light: string,
  k: number,
) {
  const r = Math.max(w, h) * 0.55;
  const ox = cx - f.facing * r * 0.4;
  const a0 = f.facing > 0 ? -1.2 : Math.PI + 1.2;
  const sweep = 2.4 * f.facing;
  const a1 = a0 + sweep * Math.min(1, 0.4 + k);
  ctx.lineCap = 'round';
  ctx.strokeStyle = deep;
  ctx.lineWidth = Math.max(6, h * 0.22);
  ctx.beginPath();
  ctx.arc(ox, cy, r, Math.min(a0, a1), Math.max(a0, a1));
  ctx.stroke();
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(2, h * 0.08);
  ctx.beginPath();
  ctx.arc(ox, cy, r, Math.min(a0, a1), Math.max(a0, a1));
  ctx.stroke();
}
