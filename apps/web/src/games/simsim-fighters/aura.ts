/**
 * 심심파이터즈 — 캐릭터 고유 오라 (그리기 전용)
 *
 * 캐릭터마다 속성에 맞는 작은 입자가 몸 주변을 떠다녀 한눈에 누군지 알 수 있게 한다.
 *  불꽃 불티 · 그림자 연기 · 전기 스파크 · 증기 · 음표 · 핏빛 안개 · 독 거품 · 눈꽃 · 독 반짝이
 *  인형 실 · 빛 깃털 · 장미 꽃잎 · 톱날 불꽃 · 유령 혼불 · 화약 연기
 * 좌표: 발밑 (0,0), 위가 -y, 바라보는 쪽이 +x (호출 쪽에서 좌우 반전 · 크기 적용)
 * 입자 위치는 시간만으로 계산한다 (상태 없음 → 온라인 동기화 · 되감기에 영향 없음).
 */
import type { CharacterDef } from './characters';
import { TAU } from './paint';

export type AuraLayer = 'back' | 'front';

/** 0~1 고정 난수 */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const frac = (x: number) => x - Math.floor(x);

function rgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

/** 입자 하나의 수명 진행 (0 → 1 반복) 과 고정 난수 */
interface Seed {
  i: number;
  k: number;
  r1: number;
  r2: number;
  r3: number;
}

function seeds(n: number, time: number, speed: number, layer: AuraLayer): Seed[] {
  const out: Seed[] = [];
  for (let i = 0; i < n; i++) {
    if ((i % 2 === 0) !== (layer === 'back')) continue;
    const r1 = hash(i);
    const r2 = hash(i + 17.3);
    const r3 = hash(i + 41.9);
    out.push({ i, k: frac(time * speed * (0.7 + r3 * 0.6) + r1), r1, r2, r3 });
  }
  return out;
}

/** 수명 동안 서서히 나타났다 사라지는 투명도 */
const fade = (k: number) => Math.sin(k * Math.PI);

export function drawAura(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  time: number,
  layer: AuraLayer,
  power = 0.5,
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 발밑에 깔리는 고유색 빛 (뒤쪽 레이어)
  if (layer === 'back') {
    const pulse = 0.8 + Math.sin(time * 3) * 0.2;
    const g = ctx.createRadialGradient(0, -2, 2, 0, -2, 62);
    g.addColorStop(0, rgba(def.glow, 0.32 * power * pulse));
    g.addColorStop(1, rgba(def.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -2, 62, 13, 0, 0, TAU);
    ctx.fill();
  }

  const a = Math.min(1, 0.45 + power * 0.6);
  const N = Math.round(10 + power * 8);

  switch (def.fx) {
    case 'fire':
      // 불티 — 몸 주변에서 흔들리며 떠오른다
      for (const p of seeds(N, time, 0.7, layer)) {
        const x = (p.r1 - 0.5) * 80 + Math.sin(p.k * 9 + p.i) * 6;
        const y = -6 - p.k * 160;
        const r = (1.4 + p.r2 * 2.2) * (1 - p.k * 0.6);
        ctx.fillStyle = rgba(p.k < 0.4 ? '#fff2a0' : def.color, fade(p.k) * a);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 1.7, 0, 0, TAU);
        ctx.fill();
      }
      break;
    case 'shadow':
      // 그림자 연기 — 발밑에서 피어올라 뒤로 흩어진다 + 보랏빛 불씨
      for (const p of seeds(N, time, 0.4, layer)) {
        const x = (p.r1 - 0.6) * 70 - p.k * 26;
        const y = -4 - p.k * 120;
        const r = 6 + p.k * 14 * (0.6 + p.r2);
        ctx.fillStyle = rgba('#1a0a30', fade(p.k) * a * 0.55);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        if (p.i % 3 === 0) {
          ctx.fillStyle = rgba(def.glow, fade(p.k) * a);
          ctx.beginPath();
          ctx.arc(x + 6, y - 4, 1.6, 0, TAU);
          ctx.fill();
        }
      }
      break;
    case 'volt': {
      // 전기 스파크 — 몸 위를 튀는 지그재그 번개 (0.07초마다 모양이 바뀐다)
      const step = Math.floor(time / 0.07);
      const n = Math.round(2 + power * 3);
      for (let j = 0; j < n; j++) {
        const id = step * 7 + j * 13;
        if ((layer === 'back') !== (j % 2 === 0)) continue;
        if (hash(id) > 0.35 + power * 0.5) continue;
        const x0 = (hash(id + 1) - 0.5) * 70;
        const y0 = -20 - hash(id + 2) * 120;
        ctx.strokeStyle = rgba(j % 2 ? def.glow : def.color, a);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        let x = x0;
        let y = y0;
        for (let q = 0; q < 4; q++) {
          x += (hash(id + 3 + q) - 0.5) * 22;
          y += (hash(id + 9 + q) - 0.3) * 16;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', a * 0.8);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      break;
    }
    case 'steel':
      // 등 뒤 배기구 증기 + 가끔 튀는 주황 불똥
      for (const p of seeds(N - 4, time, 0.5, layer)) {
        if (layer === 'back') {
          const x = -30 - p.k * 30 + Math.sin(p.k * 6 + p.i) * 4;
          const y = -116 - p.k * 50 + (p.r1 - 0.5) * 10;
          ctx.fillStyle = rgba('#d8dce4', fade(p.k) * a * 0.4);
          ctx.beginPath();
          ctx.arc(x, y, 5 + p.k * 12, 0, TAU);
          ctx.fill();
        } else if (p.r2 < 0.4) {
          const x = (p.r1 - 0.5) * 60;
          const y = -40 - p.r3 * 60 + p.k * 50;
          ctx.fillStyle = rgba(def.glow, fade(p.k) * a);
          ctx.fillRect(x, y, 2.2, 2.2);
        }
      }
      break;
    case 'sound':
      // 음표 — 리듬에 맞춰 통통 튀며 떠오른다
      for (const p of seeds(N - 6, time, 0.35, layer)) {
        const x = (p.r1 - 0.5) * 100 + Math.sin(time * 6 + p.i) * 5;
        const y = -40 - p.k * 120 - Math.abs(Math.sin(time * 8 + p.i)) * 4;
        const col = rgba(p.i % 2 ? def.glow : def.color, fade(p.k) * a);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.3);
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.6, 2.6, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(3.2, 0);
        ctx.lineTo(3.2, -11);
        ctx.quadraticCurveTo(6, -8, 8, -7);
        ctx.stroke();
        ctx.restore();
      }
      break;
    case 'blood':
      // 핏빛 안개 + 손톱 끝에서 떨어지는 붉은 방울
      for (const p of seeds(N, time, 0.6, layer)) {
        if (p.i % 3 === 0) {
          const x = (p.r1 - 0.5) * 90;
          ctx.fillStyle = rgba('#5a0012', fade(p.k) * a * 0.4);
          ctx.beginPath();
          ctx.ellipse(x - p.k * 10, -8 - p.k * 20, 14 + p.k * 10, 6, 0, 0, TAU);
          ctx.fill();
        } else {
          const x = 20 + (p.r1 - 0.5) * 40;
          const y = -90 + p.k * 90;
          ctx.fillStyle = rgba(def.color, fade(p.k) * a);
          ctx.beginPath();
          ctx.ellipse(x, y, 1.6, 2.8, 0, 0, TAU);
          ctx.fill();
        }
      }
      break;
    case 'poison':
      // 독 거품 — 하이라이트가 있는 방울이 흔들리며 떠오르다 터진다
      for (const p of seeds(N - 2, time, 0.45, layer)) {
        const x = (p.r1 - 0.5) * 80 + Math.sin(p.k * 8 + p.i) * 5;
        const y = -10 - p.k * 140;
        const r = 2.4 + p.r2 * 3.6;
        ctx.strokeStyle = rgba(def.color, fade(p.k) * a);
        ctx.fillStyle = rgba(def.color, fade(p.k) * a * 0.25);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = rgba('#ffffff', fade(p.k) * a * 0.8);
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU);
        ctx.fill();
      }
      break;
    case 'ice':
      // 눈꽃 반짝임 + 발밑 냉기
      if (layer === 'back') {
        ctx.fillStyle = rgba('#d8f4ff', 0.22 * a);
        ctx.beginPath();
        ctx.ellipse(0, -4, 54, 9, 0, 0, TAU);
        ctx.fill();
      }
      for (const p of seeds(N, time, 0.3, layer)) {
        const x = (p.r1 - 0.5) * 100 + Math.sin(p.k * 5 + p.i) * 8;
        const y = -170 + p.k * 165;
        const r = 2 + p.r2 * 2.5;
        ctx.strokeStyle = rgba(p.i % 2 ? '#ffffff' : def.glow, fade(p.k) * a);
        ctx.lineWidth = 1.1;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time + p.i);
        ctx.beginPath();
        for (let q = 0; q < 3; q++) {
          const ang = (q / 3) * Math.PI;
          ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          ctx.lineTo(-Math.cos(ang) * r, -Math.sin(ang) * r);
        }
        ctx.stroke();
        ctx.restore();
      }
      break;
    case 'venom':
    case 'puppet':
    case 'light': {
      // 반짝이 별 (고양이: 독 반짝이 / 인형사: 분홍 실 반짝이 / 발키리: 빛 입자 + 깃털)
      const falling = def.fx === 'light';
      for (const p of seeds(N, time, falling ? 0.28 : 0.5, layer)) {
        const orbit = def.fx === 'venom' ? time * 1.6 + p.r1 * TAU : 0;
        const x = def.fx === 'venom' ? Math.cos(orbit) * (34 + p.r2 * 16) : (p.r1 - 0.5) * 110;
        const y =
          def.fx === 'venom'
            ? -80 + Math.sin(orbit) * 22 - p.k * 30
            : falling
              ? -180 + p.k * 175
              : -30 - p.k * 120;
        const col = rgba(p.i % 2 ? def.glow : def.color, fade(p.k) * a);
        if (falling && p.i % 3 === 0) {
          // 깃털
          ctx.save();
          ctx.translate(x + Math.sin(p.k * 6 + p.i) * 10, y);
          ctx.rotate(Math.sin(p.k * 5 + p.i) * 0.8);
          ctx.fillStyle = rgba('#ffffff', fade(p.k) * a * 0.9);
          ctx.beginPath();
          ctx.ellipse(0, 0, 2.2, 6.5, 0, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = rgba(def.color, fade(p.k) * a);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, -6.5);
          ctx.lineTo(0, 7);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        const r = (2.2 + p.r3 * 2.6) * (0.6 + 0.4 * Math.sin(time * 10 + p.i));
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.6);
        ctx.quadraticCurveTo(x, y, x + r * 1.6, y);
        ctx.quadraticCurveTo(x, y, x, y + r * 1.6);
        ctx.quadraticCurveTo(x, y, x - r * 1.6, y);
        ctx.quadraticCurveTo(x, y, x, y - r * 1.6);
        ctx.fill();
      }
      if (def.fx === 'puppet' && layer === 'back') {
        // 하늘에서 내려오는 가는 조종 실
        ctx.strokeStyle = rgba('#ffd0e0', 0.22 * a);
        ctx.lineWidth = 0.8;
        for (let q = 0; q < 3; q++) {
          const x = -30 + q * 26 + Math.sin(time * 1.5 + q) * 4;
          ctx.beginPath();
          ctx.moveTo(x, -260);
          ctx.lineTo(x + Math.sin(time + q) * 6, -120 + q * 10);
          ctx.stroke();
        }
      }
      break;
    }
    case 'rose':
      // 장미 꽃잎 — 빙글빙글 돌며 떨어진다
      for (const p of seeds(N - 2, time, 0.26, layer)) {
        const x = (p.r1 - 0.5) * 120 + Math.sin(p.k * 7 + p.i) * 12;
        const y = -180 + p.k * 178;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 2 + p.i);
        ctx.scale(1, 0.4 + Math.abs(Math.sin(time * 3 + p.i)) * 0.6);
        ctx.fillStyle = rgba(p.i % 3 ? def.color : '#8a0a20', fade(p.k) * a);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.quadraticCurveTo(5, -3, 0, 5);
        ctx.quadraticCurveTo(-5, -3, 0, -5);
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'saw': {
      // 톱날 불꽃 — 무기 쪽 낮은 곳에서 짧게 튄다
      for (const p of seeds(N, time, 1.4, layer)) {
        const ang = -0.4 - p.r1 * 2.2;
        const sp = 20 + p.r2 * 30;
        const x = 34 + Math.cos(ang) * sp * p.k;
        const y = -70 + Math.sin(ang) * sp * p.k + p.k * p.k * 30;
        ctx.strokeStyle = rgba(p.i % 2 ? '#fff0a0' : def.color, (1 - p.k) * a);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(ang) * 5, y - Math.sin(ang) * 5);
        ctx.stroke();
      }
      break;
    }
    case 'ghost':
      // 유령 혼불 — 몸 주위를 천천히 돈다 (뒤쪽 반은 뒤 레이어)
      for (let q = 0; q < 4; q++) {
        const ang = time * 1.2 + (q / 4) * TAU;
        const behind = Math.sin(ang) < 0;
        if (behind !== (layer === 'back')) continue;
        const x = Math.cos(ang) * 46;
        const y = -88 + Math.sin(ang) * 14 + Math.sin(time * 3 + q) * 6;
        const s = behind ? 0.75 : 1;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 12 * s);
        g.addColorStop(0, rgba('#ffffff', 0.85 * a));
        g.addColorStop(0.4, rgba(def.color, 0.6 * a));
        g.addColorStop(1, rgba(def.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y - 12 * s);
        ctx.quadraticCurveTo(x + 9 * s, y, x, y + 7 * s);
        ctx.quadraticCurveTo(x - 9 * s, y, x, y - 12 * s);
        ctx.fill();
        // 꼬리
        ctx.strokeStyle = rgba(def.color, 0.35 * a);
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(x, y + 4 * s);
        ctx.quadraticCurveTo(
          x - Math.cos(ang) * 8,
          y + 14 * s,
          x - Math.sin(ang + Math.PI / 2) * 14,
          y + 18 * s,
        );
        ctx.stroke();
      }
      break;
    case 'bullet':
      // 화약 연기 — 총구 쪽에서 가늘게 피어오른다 + 반짝이는 탄피
      for (const p of seeds(N - 4, time, 0.45, layer)) {
        if (p.i % 4 === 0) {
          const x = 10 + (p.r1 - 0.5) * 60;
          const y = -60 + p.k * 60 - Math.sin(p.k * Math.PI) * 20;
          ctx.fillStyle = rgba(def.glow, (1 - p.k) * a);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(time * 12 + p.i);
          ctx.fillRect(-1.2, -2.4, 2.4, 4.8);
          ctx.restore();
          continue;
        }
        const x = 30 + Math.sin(p.k * 6 + p.i) * 6 + (p.r1 - 0.5) * 20;
        const y = -96 - p.k * 70;
        ctx.fillStyle = rgba('#d8ccb8', fade(p.k) * a * 0.35);
        ctx.beginPath();
        ctx.arc(x, y, 3 + p.k * 9, 0, TAU);
        ctx.fill();
      }
      break;
    default:
      break;
  }
  ctx.restore();
}
