/**
 * 심심파이터즈 — 타격 이펙트 (파티클 · 링 · 섬광 · 베기 궤적)
 * 화면 연출 전용이라 시뮬레이션과 상관없이 Math.random 을 써도 된다.
 * 좌표: x = 월드, y = 화면 (GROUND_Y 기준으로 변환한 값)
 */
import type { FxKind } from './characters';

const TAU = Math.PI * 2;

/** 이펙트 색 [밝은 색, 진한 색] */
export const FX_COLORS: Record<FxKind, [string, string]> = {
  fire: ['#ffe07a', '#ff5a1f'],
  shadow: ['#d8c0ff', '#6a2aff'],
  volt: ['#fff36a', '#28e0ff'],
  steel: ['#ffffff', '#ff8a2a'],
  sound: ['#3affd0', '#ff3ad8'],
  blood: ['#ffb0ba', '#e0203a'],
  poison: ['#e0ff6a', '#4ad81a'],
  ice: ['#ffffff', '#5ac8ff'],
  venom: ['#ff9af6', '#b04aff'],
  puppet: ['#ffe0ea', '#ff4a7a'],
  light: ['#ffffff', '#3affb0'],
  rose: ['#ffc0cc', '#ff2a4a'],
  saw: ['#fff0b0', '#ff8a1a'],
  ghost: ['#d0fff8', '#4affe0'],
  bullet: ['#fff6c8', '#ffb02a'],
  impact: ['#ffffff', '#ffd84a'],
  explosion: ['#ffffff', '#ff8a2a'],
};

export function fxColor(kind: string): [string, string] {
  return FX_COLORS[kind as FxKind] ?? FX_COLORS.impact;
}

type PartKind =
  'spark' | 'dot' | 'ring' | 'flare' | 'star' | 'shard' | 'smoke' | 'shield' | 'petal';

interface Part {
  kind: PartKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  rot: number;
  spin: number;
  width: number;
}

const MAX_PARTS = 700;

export class FxSystem {
  private parts: Part[] = [];

  clear() {
    this.parts = [];
  }

  private add(p: Partial<Part> & Pick<Part, 'kind' | 'x' | 'y' | 'color'>) {
    if (this.parts.length >= MAX_PARTS) this.parts.shift();
    const life = p.life ?? 0.4;
    this.parts.push({
      vx: 0,
      vy: 0,
      g: 0,
      size: 4,
      grow: 0,
      rot: 0,
      spin: 0,
      width: 3,
      ...p,
      life,
      max: life,
    });
  }

  spark(x: number, y: number, color: string, n: number, speed: number, life = 0.3, width = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.add({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        color,
        life: life * (0.6 + Math.random() * 0.6),
        size: 10 + Math.random() * 12,
        width,
      });
    }
  }

  dots(
    x: number,
    y: number,
    color: string,
    n: number,
    speed: number,
    g = 600,
    size = 4,
    life = 0.6,
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = speed * (0.3 + Math.random() * 0.9);
      this.add({
        kind: 'dot',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - speed * 0.3,
        g,
        color,
        life: life * (0.6 + Math.random() * 0.7),
        size: size * (0.6 + Math.random() * 0.8),
      });
    }
  }

  ring(x: number, y: number, color: string, size: number, grow: number, life = 0.35, width = 4) {
    this.add({ kind: 'ring', x, y, color, size, grow, life, width });
  }

  flare(x: number, y: number, color: string, size: number, life = 0.18) {
    this.add({ kind: 'flare', x, y, color, size, life });
  }

  star(x: number, y: number, color: string, size: number, life = 0.16) {
    this.add({ kind: 'star', x, y, color, size, life, rot: Math.random() * TAU });
  }

  shield(x: number, y: number, color: string, size: number) {
    this.add({ kind: 'shield', x, y, color, size, life: 0.22 });
  }

  smoke(x: number, y: number, n: number, color = 'rgba(200,190,210,0.5)') {
    for (let i = 0; i < n; i++) {
      this.add({
        kind: 'smoke',
        x: x + (Math.random() - 0.5) * 30,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        color,
        size: 8 + Math.random() * 8,
        grow: 30,
        life: 0.5 + Math.random() * 0.3,
      });
    }
  }

  shards(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = speed * (0.5 + Math.random() * 0.8);
      this.add({
        kind: 'shard',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        g: 900,
        color,
        size: 4 + Math.random() * 6,
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 20,
        life: 0.7,
      });
    }
  }

  petals(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      this.add({
        kind: 'petal',
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: -Math.random() * 220,
        g: 260,
        color,
        size: 4 + Math.random() * 3,
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 12,
        life: 0.9 + Math.random() * 0.5,
      });
    }
  }

  /** 맞았을 때 — 기술 속성 색으로 별 모양 섬광 + 불꽃 */
  hit(x: number, y: number, kind: string, heavy: boolean, counter: boolean) {
    const [light, deep] = fxColor(kind);
    const big = heavy ? 1.5 : 1;
    this.flare(x, y, light, 46 * big);
    this.star(x, y, '#ffffff', 34 * big);
    this.star(x, y, deep, 52 * big, 0.2);
    this.ring(x, y, deep, 10, 380 * big, 0.28, heavy ? 6 : 4);
    this.spark(x, y, light, heavy ? 16 : 9, 620 * big);
    if (counter) {
      this.ring(x, y, '#ff3a3a', 20, 520, 0.4, 7);
      this.spark(x, y, '#ff6a3a', 12, 820);
    }
    switch (kind) {
      case 'fire':
      case 'explosion':
        this.dots(x, y, deep, heavy ? 14 : 8, 260, -200, 6, 0.5);
        break;
      case 'ice':
        this.shards(x, y, '#d8f4ff', heavy ? 10 : 6, 300);
        break;
      case 'blood':
      case 'venom':
      case 'poison':
        this.dots(x, y, deep, heavy ? 14 : 8, 300, 700, 4, 0.6);
        break;
      case 'rose':
        this.petals(x, y, deep, heavy ? 12 : 6);
        break;
      case 'volt':
        this.spark(x, y, '#ffffff', 8, 900, 0.18, 2);
        break;
      case 'saw':
      case 'steel':
      case 'bullet':
        this.spark(x, y, '#ffe8a0', heavy ? 14 : 8, 800, 0.25, 2);
        break;
      default:
        break;
    }
  }

  /** 가드 — 육각 방패 */
  block(x: number, y: number) {
    this.shield(x, y, '#9ad8ff', 30);
    this.spark(x, y, '#cfeeff', 6, 420, 0.2, 2);
  }

  /** 화면 전체 대폭발 */
  explosion(x: number, y: number) {
    this.flare(x, y, '#ffffff', 420, 0.5);
    for (let i = 0; i < 4; i++)
      this.ring(
        x,
        y,
        i % 2 ? '#ff8a2a' : '#ffe07a',
        20 + i * 30,
        900 + i * 300,
        0.7 + i * 0.1,
        10 - i * 2,
      );
    this.dots(x, y, '#ffb02a', 40, 700, -60, 10, 1);
    this.spark(x, y, '#ffffff', 40, 1400, 0.5, 4);
    this.smoke(x, y + 40, 16, 'rgba(60,40,40,0.6)');
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += p.spin * dt;
      if (p.kind === 'spark') {
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max);
      switch (p.kind) {
        case 'spark': {
          const len = Math.hypot(p.vx, p.vy) * 0.03 + p.size * 0.4;
          const a = Math.atan2(p.vy, p.vx);
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width * k + 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
          ctx.stroke();
          break;
        }
        case 'dot':
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, TAU);
          ctx.fill();
          break;
        case 'ring':
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.width * k + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0, p.size), 0, TAU);
          ctx.stroke();
          break;
        case 'flare': {
          ctx.globalAlpha = k * 0.9;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
          break;
        }
        case 'star': {
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          const s = p.size * (1.2 - k * 0.4);
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = p.rot + (i / 16) * TAU;
            const r = i % 2 === 0 ? s : s * 0.22;
            const px = p.x + Math.cos(a) * r;
            const py = p.y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'shard':
          ctx.globalAlpha = k;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.5, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        case 'smoke':
          ctx.globalAlpha = k * 0.7;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
          break;
        case 'shield': {
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4;
          ctx.fillStyle = 'rgba(150,210,255,0.25)';
          const s = p.size * (1.3 - k * 0.3);
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + Math.PI / 6;
            const px = p.x + Math.cos(a) * s * 0.7;
            const py = p.y + Math.sin(a) * s;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'petal':
          ctx.globalAlpha = Math.min(1, k * 1.5);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
      }
    }
    ctx.restore();
  }
}
