/**
 * 심심파이터즈 — 스테이지 배경 그리기 (기술 이펙트는 skillFx.ts)
 */
import { GROUND_Y, STAGE_W, VIEW_H, VIEW_W } from './config';

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
