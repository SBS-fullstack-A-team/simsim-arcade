/**
 * 심심파이터즈 — UIManager
 * 체력 바 · 타이머 · 라운드 표시 · 텐션 게이지 · 가드 게이지 · 콤보 카운터 · 배너 · 초필살기 컷인
 */
import {
  BURST_COST,
  GUARD_MAX,
  METER_BAR,
  METER_MAX,
  ROUNDS_TO_WIN,
  VIEW_H,
  VIEW_W,
} from './config';
import type { Fighter, SimEvent } from './fighter';
import { drawPortrait, portraitIcon } from './renderFighter';
import type { FightSim } from './sim';

const TAU = Math.PI * 2;
const FONT = '"Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif';

interface Banner {
  text: string;
  sub: string;
  color: string;
  t: number;
  dur: number;
  big: boolean;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  color: string;
  t: number;
  dur: number;
  size: number;
}

interface ComboPop {
  n: number;
  dmg: number;
  t: number;
}

export class UIManager {
  /** 체력 바 뒤에서 천천히 줄어드는 붉은 잔상 */
  private trail: [number, number] = [1, 1];
  private combo: [ComboPop | null, ComboPop | null] = [null, null];
  private banner: Banner | null = null;
  private popups: Popup[] = [];
  private flashA = 0;
  private flashColor = '#ffffff';
  /** 이름표 (P1 / CPU / YOU / RIVAL) */
  tags: [string, string] = ['P1', 'CPU'];
  /** 화면 위 가운데 안내 (아케이드 단계 · 온라인 지연) */
  info = '';
  /** 화면 아래 가운데 경고 (상대 응답 대기 등) */
  warning = '';

  reset() {
    this.trail = [1, 1];
    this.combo = [null, null];
    this.banner = null;
    this.popups = [];
    this.flashA = 0;
  }

  showBanner(text: string, sub = '', color = '#ffe27a', dur = 1.4, big = true) {
    this.banner = { text, sub, color, t: 0, dur, big };
  }

  flash(color: string, a: number) {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  }

  popup(text: string, x: number, y: number, color: string, size = 22, dur = 0.8) {
    this.popups.push({ text, x, y, color, t: 0, dur, size });
    if (this.popups.length > 12) this.popups.shift();
  }

  /** 시뮬레이션 이벤트 → 화면 표시 */
  onEvent(e: SimEvent, sim: FightSim) {
    switch (e.type) {
      case 'round': {
        const [a, b] = sim.fighters;
        const final = a.roundWins === ROUNDS_TO_WIN - 1 && b.roundWins === ROUNDS_TO_WIN - 1;
        this.showBanner(final ? 'FINAL ROUND' : `ROUND ${e.round}`, '', '#ffe27a', 1, true);
        break;
      }
      case 'fight':
        this.showBanner('FIGHT!', '', '#ff5a3a', 0.8, true);
        break;
      case 'ko': {
        const both = sim.fighters.every((f) => f.hp <= 0);
        this.showBanner(both ? 'DOUBLE K.O.' : 'K.O.', '', '#ff2a3a', 2, true);
        this.flash('#ffffff', 0.7);
        break;
      }
      case 'timeover':
        this.showBanner('TIME OVER', '', '#ffb02a', 2, true);
        break;
      case 'roundEnd':
        if (e.perfect) this.popup('PERFECT!', VIEW_W / 2, 210, '#ffe27a', 46, 1.6);
        break;
      case 'hit': {
        const att = e.side === 0 ? 1 : 0;
        if (!e.blocked && e.combo >= 2) {
          const prev = this.combo[att];
          this.combo[att] = {
            n: e.combo,
            dmg: (prev && prev.t < 1.2 ? prev.dmg : 0) + e.damage,
            t: 0,
          };
        } else if (!e.blocked) {
          this.combo[att] = { n: 1, dmg: e.damage, t: 2 };
        }
        if (e.counter) this.popup('COUNTER', att === 0 ? 150 : VIEW_W - 150, 150, '#ff4a3a', 24);
        break;
      }
      case 'guardCrush':
        this.popup('GUARD CRUSH!', e.side === 0 ? 160 : VIEW_W - 160, 180, '#5ac8ff', 26, 1);
        break;
      case 'burst':
        this.popup('BURST!', e.side === 0 ? 150 : VIEW_W - 150, 200, '#ffffff', 34, 1);
        this.flash('#9ad8ff', 0.4);
        break;
      case 'super':
        this.flash(sim.fighters[e.side].def.glow, e.ult ? 0.5 : 0.3);
        break;
      case 'explosion':
        this.flash('#ffffff', 0.95);
        break;
      default:
        break;
    }
  }

  update(dt: number, sim: FightSim) {
    sim.fighters.forEach((f, i) => {
      const r = f.hp / f.maxHp;
      const tr = this.trail[i] as number;
      // 콤보가 끝나야 잔상이 줄어든다
      if (f.act !== 'hitstun' || tr < r) this.trail[i] = tr > r ? Math.max(r, tr - dt * 0.6) : r;
    });
    for (const c of this.combo) if (c) c.t += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.dur);
    this.flashA = Math.max(0, this.flashA - dt * 2.4);
  }

  /* ---------------- 그리기 ---------------- */

  draw(ctx: CanvasRenderingContext2D, sim: FightSim, time: number) {
    const [a, b] = sim.fighters;
    this.drawHpBar(ctx, a, 0, time);
    this.drawHpBar(ctx, b, 1, time);
    this.drawTimer(ctx, sim);
    this.drawMeter(ctx, a, 0, time);
    this.drawMeter(ctx, b, 1, time);
    this.drawCombos(ctx);
    this.drawPopups(ctx);
    if (sim.freeze > 0 && sim.freezeSide >= 0) this.drawCutin(ctx, sim, time);
    this.drawBanner(ctx);
    if (this.info) {
      ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(this.info, VIEW_W / 2, 92);
    }
    if (this.warning) {
      ctx.font = `800 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(VIEW_W / 2 - 160, VIEW_H / 2 - 18, 320, 36);
      ctx.fillStyle = '#ffd84a';
      ctx.fillText(this.warning, VIEW_W / 2, VIEW_H / 2 + 6);
    }
    if (this.flashA > 0) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  private drawHpBar(ctx: CanvasRenderingContext2D, f: Fighter, side: 0 | 1, time: number) {
    const W = 372;
    const H = 22;
    const y = 24;
    const x0 = side === 0 ? 66 : VIEW_W - 66 - W;
    const slant = 10;
    const ratio = f.hp / f.maxHp;
    const trail = this.trail[side];

    const shape = (x: number, w: number) => {
      ctx.beginPath();
      if (side === 0) {
        ctx.moveTo(x + slant, y);
        ctx.lineTo(x + w + slant, y);
        ctx.lineTo(x + w, y + H);
        ctx.lineTo(x, y + H);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w - slant, y + H);
        ctx.lineTo(x - slant, y + H);
      }
      ctx.closePath();
    };

    // 바탕
    shape(x0 - 3, W + 6);
    ctx.fillStyle = '#0e0812';
    ctx.fill();
    shape(x0, W);
    ctx.fillStyle = '#3a1020';
    ctx.fill();
    // 붉은 잔상 — 가운데 쪽부터 줄어든다
    const tw = W * trail;
    const tx = side === 0 ? x0 + W - tw : x0;
    shape(tx, tw);
    ctx.fillStyle = '#ff2a3a';
    ctx.fill();
    // 체력
    const hw = W * ratio;
    const hx = side === 0 ? x0 + W - hw : x0;
    if (hw > 0) {
      shape(hx, hw);
      const g = ctx.createLinearGradient(0, y, 0, y + H);
      const low = ratio < 0.25;
      g.addColorStop(0, low ? '#ffb0a0' : '#fff6a0');
      g.addColorStop(0.5, low ? (Math.sin(time * 10) > 0 ? '#ff4a2a' : '#ff8a2a') : '#ffc82a');
      g.addColorStop(1, low ? '#c81a1a' : '#e07a10');
      ctx.fillStyle = g;
      ctx.fill();
    }
    shape(x0, W);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f2e6ff';
    ctx.stroke();

    // 얼굴 아이콘
    const ix = side === 0 ? 34 : VIEW_W - 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ix, 36, 26, 0, TAU);
    ctx.fillStyle = '#1a1028';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = f.def.color;
    ctx.stroke();
    ctx.clip();
    ctx.translate(ix, 0);
    ctx.scale(side === 0 ? 1 : -1, 1);
    // 아이콘은 한 번 그려 둔 그림을 다시 쓴다
    const icon = portraitIcon(f.def);
    if (icon) ctx.drawImage(icon, -26, 10, 52, 52);
    ctx.restore();

    // 이름
    ctx.font = `900 15px ${FONT}`;
    ctx.textAlign = side === 0 ? 'left' : 'right';
    const nx = side === 0 ? x0 + 4 : x0 + W - 4;
    ctx.fillStyle = '#0e0812';
    ctx.fillText(`${f.def.name}`, nx + 1, y + H + 19);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${f.def.name}`, nx, y + H + 18);
    ctx.font = `800 11px ${FONT}`;
    ctx.fillStyle = side === 0 ? '#7ad8ff' : '#ff8a9a';
    const tag = this.tags[side];
    const nameW = ctx.measureText(f.def.name).width * (15 / 11);
    ctx.fillText(tag, side === 0 ? nx + nameW + 10 : nx - nameW - 10, y + H + 17);

    // 가드 게이지
    const gw = 150;
    const gx = side === 0 ? x0 + W - gw : x0;
    const gy = y + H + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(gx, gy, gw, 5);
    const gr = Math.max(0, f.guardHp / GUARD_MAX);
    ctx.fillStyle = gr < 0.3 ? (Math.sin(time * 14) > 0 ? '#ff5a3a' : '#5ac8ff') : '#5ac8ff';
    const gww = gw * gr;
    ctx.fillRect(side === 0 ? gx + gw - gww : gx, gy, gww, 5);

    // 라운드 승리 표시
    for (let i = 0; i < ROUNDS_TO_WIN; i++) {
      const rx = side === 0 ? VIEW_W / 2 - 52 - i * 18 : VIEW_W / 2 + 52 + i * 18;
      ctx.save();
      ctx.translate(rx, 62);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i < f.roundWins ? '#ffd84a' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }

  private drawTimer(ctx: CanvasRenderingContext2D, sim: FightSim) {
    const x = VIEW_W / 2;
    ctx.fillStyle = '#0e0812';
    ctx.beginPath();
    ctx.moveTo(x - 30, 16);
    ctx.lineTo(x + 30, 16);
    ctx.lineTo(x + 24, 56);
    ctx.lineTo(x - 24, 56);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#f2e6ff';
    ctx.stroke();
    const sec = Math.ceil(sim.timer / 60);
    ctx.font = `900 30px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = sec <= 10 ? '#ff4a3a' : '#ffffff';
    ctx.fillText(String(sec).padStart(2, '0'), x, 48);
  }

  private drawMeter(ctx: CanvasRenderingContext2D, f: Fighter, side: 0 | 1, time: number) {
    const W = 270;
    const H = 14;
    const y = VIEW_H - 30;
    const x0 = side === 0 ? 24 : VIEW_W - 24 - W;
    const bars = Math.floor(f.meter / METER_BAR);
    const seg = W / 3;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x0 - 3, y - 3, W + 6, H + 6);
    for (let i = 0; i < 3; i++) {
      const fill = Math.max(0, Math.min(1, (f.meter - i * METER_BAR) / METER_BAR));
      const sx = side === 0 ? x0 + i * seg : x0 + W - (i + 1) * seg;
      ctx.fillStyle = '#1a1028';
      ctx.fillRect(sx + 1, y, seg - 2, H);
      if (fill > 0) {
        const full = fill >= 1;
        const pulse = full ? 0.75 + Math.sin(time * 8 + i) * 0.25 : 1;
        const g = ctx.createLinearGradient(0, y, 0, y + H);
        g.addColorStop(0, full ? '#ffffff' : '#8af2ff');
        g.addColorStop(1, full ? f.def.color : '#2a8aff');
        ctx.globalAlpha = pulse;
        ctx.fillStyle = g;
        const fw = (seg - 2) * fill;
        ctx.fillRect(side === 0 ? sx + 1 : sx + 1 + (seg - 2) - fw, y, fw, H);
        ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = '#f2e6ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y, W, H);

    ctx.font = `900 italic 16px ${FONT}`;
    ctx.textAlign = side === 0 ? 'left' : 'right';
    const lx = side === 0 ? x0 : x0 + W;
    ctx.fillStyle = bars >= 3 ? '#ffd84a' : '#9ad8ff';
    const label = bars >= 3 ? 'MAX  ULTIMATE' : `TENSION Lv.${bars}`;
    ctx.fillText(label, lx, y - 7);
    if (f.meter >= BURST_COST) {
      ctx.font = `800 11px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = side === 0 ? 'right' : 'left';
      ctx.fillText('BURST OK', side === 0 ? x0 + W : x0, y - 7);
    }
    if (f.meter >= METER_MAX) {
      ctx.globalAlpha = 0.3 + Math.sin(time * 10) * 0.2;
      ctx.fillStyle = f.def.glow;
      ctx.fillRect(x0, y, W, H);
      ctx.globalAlpha = 1;
    }
  }

  private drawCombos(ctx: CanvasRenderingContext2D) {
    this.combo.forEach((c, side) => {
      if (!c || c.n < 2 || c.t > 1.4) return;
      const x = side === 0 ? 40 : VIEW_W - 40;
      const pop = c.t < 0.12 ? 1 + (0.12 - c.t) * 3 : 1;
      const alpha = c.t > 1 ? 1 - (c.t - 1) / 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, 190);
      ctx.scale(pop, pop);
      ctx.textAlign = side === 0 ? 'left' : 'right';
      ctx.font = `900 italic 54px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#0e0812';
      ctx.strokeText(String(c.n), 0, 0);
      const g = ctx.createLinearGradient(0, -46, 0, 0);
      g.addColorStop(0, '#fff6a0');
      g.addColorStop(1, '#ff5a1f');
      ctx.fillStyle = g;
      ctx.fillText(String(c.n), 0, 0);
      ctx.font = `900 italic 22px ${FONT}`;
      ctx.strokeText('COMBO!', 0, 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('COMBO!', 0, 26);
      ctx.font = `800 13px ${FONT}`;
      ctx.fillStyle = '#ffd0a0';
      ctx.fillText(`${c.dmg} DAMAGE`, 0, 44);
      ctx.restore();
    });
  }

  private drawPopups(ctx: CanvasRenderingContext2D) {
    for (const p of this.popups) {
      const k = p.t / p.dur;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.translate(p.x, p.y - k * 20);
      const s = k < 0.1 ? 1 + (0.1 - k) * 4 : 1;
      ctx.scale(s, s);
      ctx.font = `900 italic ${p.size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#0e0812';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  private drawBanner(ctx: CanvasRenderingContext2D) {
    const b = this.banner;
    if (!b) return;
    const k = b.t / b.dur;
    const inK = Math.min(1, b.t / 0.12);
    const outK = k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, outK);
    // 띠
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, VIEW_H / 2 - 58, VIEW_W * inK, 104);
    ctx.translate(VIEW_W / 2, VIEW_H / 2 + 14);
    const s = (b.big ? 1 : 0.6) * (1 + (1 - inK) * 0.8);
    ctx.scale(s, s);
    ctx.font = `900 italic 84px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0e0812';
    ctx.strokeText(b.text, 0, 0);
    const g = ctx.createLinearGradient(0, -70, 0, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, b.color);
    ctx.fillStyle = g;
    ctx.fillText(b.text, 0, 0);
    if (b.sub) {
      ctx.font = `800 22px ${FONT}`;
      ctx.lineWidth = 5;
      ctx.strokeText(b.sub, 0, 34);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(b.sub, 0, 34);
    }
    ctx.restore();
  }

  /** 초필살기 컷인 — 화면을 가로지르는 띠에 캐릭터 일러스트 + 기술 이름 */
  private drawCutin(ctx: CanvasRenderingContext2D, sim: FightSim, time: number) {
    const f = sim.fighters[sim.freezeSide as 0 | 1];
    const def = f.def;
    const ult = sim.freezeUlt;
    const p = 1 - sim.freeze / Math.max(1, sim.freezeTotal);
    const slideIn = Math.min(1, p / 0.18);
    const slideOut = p > 0.82 ? (p - 0.82) / 0.18 : 0;
    const dir = f.side === 0 ? 1 : -1;
    const off = (1 - slideIn) * -VIEW_W * dir + slideOut * VIEW_W * dir;
    const cy = VIEW_H / 2 - 10;
    const bh = ult ? 210 : 170;

    ctx.save();
    ctx.translate(off, 0);
    // 띠
    ctx.beginPath();
    ctx.moveTo(-40, cy - bh / 2 + 24);
    ctx.lineTo(VIEW_W + 40, cy - bh / 2 - 24);
    ctx.lineTo(VIEW_W + 40, cy + bh / 2 - 24);
    ctx.lineTo(-40, cy + bh / 2 + 24);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
    g.addColorStop(0, def.glow);
    g.addColorStop(0.5, def.color);
    g.addColorStop(1, '#0e0812');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = ult ? '#ffd84a' : '#ffffff';
    ctx.stroke();
    ctx.save();
    ctx.clip();
    // 집중선
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const yy = cy - bh / 2 - 30 + ((i * 37 + time * 900) % (bh + 60));
      const x = ((i * 113) % VIEW_W) - ((time * 2400 * dir) % VIEW_W);
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + 160 * dir, yy);
      ctx.stroke();
    }
    // 캐릭터 일러스트
    const px = f.side === 0 ? 200 : VIEW_W - 200;
    ctx.save();
    ctx.translate(px, 0);
    ctx.scale(dir, 1);
    drawPortrait(ctx, def, 0, cy + 330, 2.4 / def.scale, time, 'super');
    ctx.restore();
    ctx.restore();

    // 기술 이름
    const tx = f.side === 0 ? VIEW_W - 40 : 40;
    ctx.textAlign = f.side === 0 ? 'right' : 'left';
    ctx.font = `900 italic ${ult ? 26 : 20}px ${FONT}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0e0812';
    const label = ult ? 'BURST ULTIMATE' : 'SUPER ART';
    ctx.strokeText(label, tx, cy - 26);
    ctx.fillStyle = ult ? '#ffd84a' : '#ffffff';
    ctx.fillText(label, tx, cy - 26);
    const name = (ult ? f.moves.ult : f.moves.super).name;
    ctx.font = `900 italic ${ult ? 44 : 38}px ${FONT}`;
    ctx.lineWidth = 8;
    ctx.strokeText(name, tx, cy + 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, tx, cy + 22);
    ctx.font = `800 16px ${FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeText(def.en, tx, cy + 48);
    ctx.fillStyle = def.glow;
    ctx.fillText(def.en, tx, cy + 48);
    ctx.restore();
  }
}
