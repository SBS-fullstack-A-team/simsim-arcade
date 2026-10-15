/**
 * 심심파이터즈 — 게임 엔진
 * requestAnimationFrame 루프(60FPS 고정 스텝), 모드(아케이드 · 온라인) 진행, 카메라, 연출, 그리기를 맡는다.
 * 실제 대전 규칙은 FightSim(결정적 시뮬레이션)이 계산하고, 엔진은 그 결과를 화면과 소리로 보여 준다.
 */
import { AIController } from './ai';
import { CharacterRegistry, type CharId, type FxKind } from './characters';
import {
  ARCADE_LENGTH,
  GROUND_Y,
  MAX_SCORE,
  SCORE,
  STAGE_W,
  STALL_WARN,
  STEP,
  VIEW_H,
  VIEW_W,
  stageMultiplier,
} from './config';
import type { Fighter, SimEvent } from './fighter';
import { FxSystem, fxColor } from './fx';
import { InputManager, type InputKey } from './input';
import { NetplaySession } from './netplay';
import type { NetworkManager_WebRTC } from './network';
import { STAGES, StageRenderer, drawMoveFx, drawProjectile } from './render';
import { drawFighter, drawShadow } from './renderFighter';
import { FightSim } from './sim';
import type { SfxName, SoundManager } from './sound';
import { UIManager } from './ui';

export interface ScoreLine {
  label: string;
  value: number;
}

export interface ArcadeSummary {
  score: number;
  victory: boolean;
  charId: CharId;
  stagesCleared: number;
  lastOpponent: CharId | null;
  totalDamage: number;
  maxCombo: number;
  perfects: number;
  supers: number;
  breakdown: ScoreLine[];
}

export interface OnlineResult {
  youWon: boolean;
  draw: boolean;
  disconnected: boolean;
  you: CharId;
  rival: CharId;
}

export interface EngineCallbacks {
  onArcadeEnd: (s: ArcadeSummary) => void;
  onOnlineEnd: (r: OnlineResult) => void;
}

type Mode = 'idle' | 'arcade' | 'online';

const SFX_BY_FX: Record<FxKind, SfxName> = {
  fire: 'fire',
  shadow: 'slash',
  volt: 'volt',
  steel: 'steel',
  sound: 'sound',
  blood: 'slash',
  poison: 'poison',
  ice: 'ice',
  venom: 'slash',
  puppet: 'slash',
  light: 'light',
  rose: 'slash',
  saw: 'saw',
  ghost: 'ghost',
  bullet: 'gun',
  impact: 'whoosh',
  explosion: 'explosion',
};

interface ArcadeRun {
  player: CharId;
  opponents: CharId[];
  stage: number;
  /** 항목별 점수 */
  pts: {
    damage: number;
    rounds: number;
    perfect: number;
    superFinish: number;
    combo: number;
    allClear: number;
  };
  totalDamage: number;
  maxCombo: number;
  perfects: number;
  supers: number;
  ended: boolean;
}

export class FightEngine {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private mode: Mode = 'idle';
  private paused = false;

  private sim: FightSim;
  private stage: StageRenderer;
  private stageIdx = 0;
  private fx = new FxSystem();
  private ui = new UIManager();
  private input = new InputManager();
  private ai: AIController | null = null;
  private session: NetplaySession | null = null;
  private net: NetworkManager_WebRTC | null = null;
  private localSide: 0 | 1 = 0;
  private netUnsub: (() => void) | null = null;
  private run: ArcadeRun | null = null;
  /** 경기가 끝난 뒤 다음 단계까지 남은 시간 */
  private pending: { t: number; fn: () => void } | null = null;

  private camX = (STAGE_W - VIEW_W) / 2;
  private shakeAmt = 0;
  private zoom = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private sound: SoundManager,
    private cb: EngineCallbacks,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이 브라우저는 Canvas 를 지원하지 않아요.');
    this.ctx = ctx;
    this.resizeCanvas();
    this.stage = new StageRenderer(0, this.canvas.width / VIEW_W);
    this.sim = new FightSim('solaris', 'violet-cat');
    this.input.setEnabled(false);
    window.addEventListener('resize', this.onResize);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** 다른 캔버스로 옮겨 그린다 (크게 보기로 바뀌면 캔버스가 새로 만들어진다) */
  attach(canvas: HTMLCanvasElement) {
    if (canvas === this.canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.canvas = canvas;
    this.ctx = ctx;
    this.canvas.width = 0;
    this.resizeCanvas();
    this.stage = new StageRenderer(this.stageIdx, this.canvas.width / VIEW_W);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.input.destroy();
    this.endSession();
    this.sound.stopBgm();
  }

  /* ---------------- 외부 제어 ---------------- */

  /** 메뉴 뒤 배경 — 고른 캐릭터 둘이 서 있다 */
  preview(p1: CharId, p2: CharId) {
    if (this.mode !== 'idle') return;
    this.sim = new FightSim(p1, p2);
  }

  startArcade(player: CharId) {
    this.endSession();
    const others = CharacterRegistry.list.map((c) => c.id).filter((id) => id !== player);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j] as CharId, others[i] as CharId];
    }
    this.run = {
      player,
      opponents: others.slice(0, ARCADE_LENGTH),
      stage: 1,
      pts: { damage: 0, rounds: 0, perfect: 0, superFinish: 0, combo: 0, allClear: 0 },
      totalDamage: 0,
      maxCombo: 0,
      perfects: 0,
      supers: 0,
      ended: false,
    };
    this.mode = 'arcade';
    this.paused = false;
    this.startArcadeMatch();
  }

  startOnline(
    net: NetworkManager_WebRTC,
    side: 0 | 1,
    p1: CharId,
    p2: CharId,
    stage: number,
    matchId: number,
    delay: number,
  ) {
    this.endSession();
    this.run = null;
    this.net = net;
    this.localSide = side;
    this.sim = new FightSim(p1, p2);
    this.session = new NetplaySession(net, this.sim, side, matchId, delay);
    this.netUnsub = net.onStatus((s) => {
      if (s === 'closed' || s === 'failed') this.onDisconnect();
    });
    this.setStage(stage);
    this.ui.reset();
    this.ui.tags = side === 0 ? ['YOU', 'RIVAL'] : ['RIVAL', 'YOU'];
    this.ui.info = '';
    this.ui.warning = '';
    this.fx.clear();
    this.pending = null;
    this.mode = 'online';
    this.paused = false;
    this.input.setEnabled(true);
    this.input.clear();
    this.sound.playBgm(stage);
  }

  /** 진행 중인 판을 버리고 메뉴 배경으로 */
  idle() {
    this.endSession();
    this.mode = 'idle';
    this.paused = false;
    this.run = null;
    this.pending = null;
    this.ui.reset();
    this.ui.info = '';
    this.ui.warning = '';
    this.fx.clear();
    this.input.setEnabled(false);
    this.sound.stopBgm();
  }

  pause() {
    if (this.mode !== 'arcade') return;
    this.paused = true;
    this.input.setEnabled(false);
  }

  resume() {
    this.paused = false;
    this.last = 0;
    if (this.mode !== 'idle') this.input.setEnabled(true);
  }

  setVirtual(key: InputKey, down: boolean) {
    this.input.setVirtual(key, down);
  }

  /* ---------------- 아케이드 ---------------- */

  private startArcadeMatch() {
    const run = this.run;
    if (!run) return;
    const opp = run.opponents[run.stage - 1] as CharId;
    // 후반 상대일수록 체력이 조금 더 많다
    this.sim = new FightSim(run.player, opp, { hpScale2: 1 + (run.stage - 1) * 0.06 });
    this.ai = new AIController(run.stage);
    this.setStage(Math.floor(Math.random() * STAGES.length));
    this.ui.reset();
    this.ui.tags = ['YOU', `CPU Lv.${run.stage}`];
    this.ui.info = `ARCADE  ${run.stage} / ${ARCADE_LENGTH}   ·   ${this.arcadeScore().toLocaleString()}점`;
    this.ui.warning = '';
    this.fx.clear();
    this.pending = null;
    this.input.setEnabled(true);
    this.input.clear();
    this.sound.playBgm(this.stageIdx);
  }

  private arcadeScore() {
    const run = this.run;
    if (!run) return 0;
    const p = run.pts;
    const sum = p.damage + p.rounds + p.perfect + p.superFinish + p.combo + p.allClear;
    return Math.min(MAX_SCORE, Math.round(sum));
  }

  private arcadeEvent(e: SimEvent) {
    const run = this.run;
    if (!run || run.ended) return;
    const mult = stageMultiplier(run.stage);
    switch (e.type) {
      case 'ko':
        if (e.side === 1 && e.superFinish) run.pts.superFinish += SCORE.superFinish * mult;
        break;
      case 'roundEnd':
        if (e.winner === 0) {
          run.pts.rounds += (SCORE.roundWin + e.timeLeft * SCORE.timePerSec) * mult;
          if (e.perfect) {
            run.pts.perfect += SCORE.perfect * mult;
            run.perfects++;
          }
        }
        break;
      case 'matchEnd': {
        const me = this.sim.fighters[0];
        run.pts.damage += me.stats.damage * SCORE.damage * mult;
        run.pts.combo += me.stats.maxCombo * SCORE.comboPerHit * mult;
        run.totalDamage += me.stats.damage;
        run.maxCombo = Math.max(run.maxCombo, me.stats.maxCombo);
        run.supers += me.stats.supers;
        if (e.winner === 0) {
          if (run.stage >= ARCADE_LENGTH) {
            run.pts.allClear += SCORE.allClear;
            this.ui.showBanner('ALL CLEAR!', `${me.def.name} 아케이드 제패!`, '#ffd84a', 3.2, true);
            this.sound.play('win');
            this.later(3.4, () => this.finishArcade(true));
          } else {
            this.ui.showBanner('YOU WIN', 'NEXT CHALLENGER…', '#7ad8ff', 2.6, true);
            this.sound.play('win');
            this.later(2.8, () => {
              run.stage++;
              this.startArcadeMatch();
            });
          }
        } else {
          this.ui.showBanner(
            e.winner === 1 ? 'YOU LOSE' : 'DRAW',
            'GAME OVER',
            '#ff5a6a',
            2.6,
            true,
          );
          this.sound.play('lose');
          this.later(2.8, () => this.finishArcade(false));
        }
        this.ui.info = `ARCADE  ${run.stage} / ${ARCADE_LENGTH}   ·   ${this.arcadeScore().toLocaleString()}점`;
        break;
      }
      default:
        break;
    }
  }

  private finishArcade(victory: boolean) {
    const run = this.run;
    if (!run || run.ended) return;
    run.ended = true;
    const p = run.pts;
    const r = Math.round;
    this.input.setEnabled(false);
    this.sound.stopBgm();
    this.cb.onArcadeEnd({
      score: this.arcadeScore(),
      victory,
      charId: run.player,
      stagesCleared: victory ? ARCADE_LENGTH : run.stage - 1,
      lastOpponent: run.opponents[run.stage - 1] ?? null,
      totalDamage: run.totalDamage,
      maxCombo: run.maxCombo,
      perfects: run.perfects,
      supers: run.supers,
      breakdown: [
        { label: '준 피해', value: r(p.damage) },
        { label: '라운드 승리 · 남은 시간', value: r(p.rounds) },
        { label: '퍼펙트', value: r(p.perfect) },
        { label: '초필살기 피니시', value: r(p.superFinish) },
        { label: '최대 콤보', value: r(p.combo) },
        { label: '올 클리어', value: r(p.allClear) },
      ].filter((l) => l.value > 0),
    });
  }

  /* ---------------- 온라인 ---------------- */

  private onlineEvent(e: SimEvent) {
    if (e.type !== 'matchEnd') return;
    const youWon = e.winner === this.localSide;
    const draw = e.winner === -1;
    this.ui.showBanner(
      draw ? 'DRAW' : youWon ? 'YOU WIN' : 'YOU LOSE',
      '',
      youWon ? '#7ad8ff' : '#ff5a6a',
      2.6,
      true,
    );
    this.sound.play(youWon ? 'win' : 'lose');
    const [a, b] = this.sim.fighters;
    const you = this.localSide === 0 ? a.charId : b.charId;
    const rival = this.localSide === 0 ? b.charId : a.charId;
    this.later(2.8, () => {
      this.endSession();
      this.input.setEnabled(false);
      this.sound.stopBgm();
      this.cb.onOnlineEnd({ youWon, draw, disconnected: false, you, rival });
    });
  }

  private onDisconnect() {
    if (this.mode !== 'online') return;
    const [a, b] = this.sim.fighters;
    const you = this.localSide === 0 ? a.charId : b.charId;
    const rival = this.localSide === 0 ? b.charId : a.charId;
    this.endSession();
    this.pending = null;
    this.mode = 'idle';
    this.input.setEnabled(false);
    this.sound.stopBgm();
    this.cb.onOnlineEnd({ youWon: false, draw: false, disconnected: true, you, rival });
  }

  private endSession() {
    this.session?.destroy();
    this.session = null;
    this.netUnsub?.();
    this.netUnsub = null;
    this.net = null;
  }

  /* ---------------- 공통 ---------------- */

  private later(sec: number, fn: () => void) {
    this.pending = { t: sec, fn };
  }

  private setStage(i: number) {
    this.stageIdx = i % STAGES.length;
    this.stage = new StageRenderer(this.stageIdx, this.canvas.width / VIEW_W);
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (!this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        try {
          this.tick();
        } catch (err) {
          console.error('[simsim-fighters] step error', err);
        }
        this.acc -= STEP;
        steps++;
      }
      if (steps === 5) this.acc = 0;
      this.time += dt;
      this.fx.update(dt);
      this.ui.update(dt, this.sim);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
      if (this.pending) {
        this.pending.t -= dt;
        if (this.pending.t <= 0) {
          const fn = this.pending.fn;
          this.pending = null;
          fn();
        }
      }
    }
    try {
      this.draw(this.paused ? 0 : dt);
    } catch (err) {
      console.error('[simsim-fighters] draw error', err);
    }
  };

  /** 1/60초 한 번 */
  private tick() {
    if (this.mode === 'arcade') {
      const p1 = this.input.sample();
      const p2 = this.ai ? this.ai.think(this.sim, 1) : 0;
      this.sim.step([p1, p2]);
      this.handleEvents(this.sim.events);
    } else if (this.mode === 'online' && this.session) {
      this.session.tick(this.input.sample(), (events) => this.handleEvents(events));
      const s = this.session;
      this.ui.warning = s.stall > STALL_WARN ? '상대 입력을 기다리는 중…' : '';
      this.ui.info = `ONLINE  ·  PING ${this.netPing()}ms  ·  입력 지연 ${s.delay}F${s.desyncFixes ? `  ·  보정 ${s.desyncFixes}` : ''}`;
    }
  }

  private netPing() {
    return this.net ? this.net.ping : 0;
  }

  private handleEvents(events: readonly SimEvent[]) {
    for (const e of events) {
      this.ui.onEvent(e, this.sim);
      this.effectFor(e);
      if (this.mode === 'arcade') this.arcadeEvent(e);
      else if (this.mode === 'online') this.onlineEvent(e);
    }
  }

  private effectFor(e: SimEvent) {
    const sy = (y: number) => GROUND_Y - y;
    switch (e.type) {
      case 'hit': {
        if (e.blocked) {
          this.fx.block(e.x, sy(e.y));
          this.sound.play('block');
        } else {
          this.fx.hit(e.x, sy(e.y), e.fx, e.heavy || e.superLevel > 0, e.counter);
          this.sound.play(e.heavy ? 'hitHeavy' : 'hit');
          if (e.counter) this.sound.play('counter');
          if (e.heavy) this.shake(e.superLevel > 0 ? 7 : 5);
          if (e.superLevel === 3) this.shake(9);
        }
        break;
      }
      case 'guardCrush':
        this.fx.shards(e.x, sy(e.y), '#9ad8ff', 14, 380);
        this.fx.ring(e.x, sy(e.y), '#5ac8ff', 10, 500, 0.4, 6);
        this.sound.play('guardCrush');
        this.shake(9);
        break;
      case 'swing': {
        const f = this.sim.fighters[e.side];
        const d = f.moves[e.move];
        if (d.superLevel > 0 || e.move === 'burst') break;
        if (e.move === 'sp1' || e.move === 'sp2') {
          this.sound.play(SFX_BY_FX[d.fx]);
          const [light] = fxColor(d.fx);
          this.fx.flare(e.x, sy(e.y), light, 40, 0.15);
        } else {
          this.sound.play(
            e.move === 'kick' || e.move === 'cKick' || e.move === 'aKick'
              ? 'heavyWhoosh'
              : 'whoosh',
          );
        }
        break;
      }
      case 'projectile':
        if (e.fx === 'bullet') this.sound.play('gun');
        else if (e.fx !== 'explosion') this.sound.play(SFX_BY_FX[e.fx as FxKind] ?? 'whoosh');
        break;
      case 'teleport':
        this.fx.smoke(e.from, sy(e.y), 8, 'rgba(120,80,200,0.55)');
        this.fx.smoke(e.to, sy(e.y), 8, 'rgba(120,80,200,0.55)');
        this.sound.play('teleport');
        break;
      case 'burst':
        this.fx.ring(e.x, sy(e.y), '#ffffff', 20, 700, 0.45, 10);
        this.fx.ring(e.x, sy(e.y), '#9ad8ff', 10, 500, 0.5, 6);
        this.fx.spark(e.x, sy(e.y), '#cfeeff', 24, 900);
        this.sound.play('burst');
        this.shake(8);
        break;
      case 'super': {
        const f = this.sim.fighters[e.side];
        this.fx.flare(f.x, sy(f.h + 90), f.def.glow, e.ult ? 220 : 150, 0.6);
        this.fx.ring(f.x, sy(f.h + 90), f.def.color, 20, 600, 0.6, 8);
        this.sound.play(e.ult ? 'ult' : 'super');
        this.shake(e.ult ? 8 : 5);
        break;
      }
      case 'explosion':
        this.fx.explosion(e.x, sy(e.y));
        this.sound.play('explosion');
        this.shake(18);
        break;
      case 'clash':
        this.fx.spark(e.x, sy(e.y), '#ffffff', 14, 600);
        this.fx.ring(e.x, sy(e.y), '#ffe27a', 6, 300, 0.25, 4);
        this.sound.play('clash');
        break;
      case 'ko':
        this.sound.play('ko');
        this.shake(10);
        break;
      case 'round':
        this.sound.play('round');
        break;
      case 'fight':
        this.sound.play('fight');
        break;
      case 'jump':
        this.fx.smoke(e.x, GROUND_Y, 2);
        this.sound.play('jump');
        break;
      case 'land':
        this.fx.smoke(e.x, GROUND_Y, 3);
        break;
      default:
        break;
    }
  }

  private shake(n: number) {
    this.shakeAmt = Math.max(this.shakeAmt, n);
  }

  /* ---------------- 그리기 ---------------- */

  private onResize = () => {
    if (this.resizeCanvas())
      this.stage = new StageRenderer(this.stageIdx, this.canvas.width / VIEW_W);
  };

  private resizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(VIEW_W * dpr);
    const h = Math.round(VIEW_H * dpr);
    if (this.canvas.width === w && this.canvas.height === h) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    return true;
  }

  private draw(dt: number) {
    const ctx = this.ctx;
    const scale = this.canvas.width / VIEW_W;
    const sim = this.sim;
    const [a, b] = sim.fighters;

    // 카메라 — 두 캐릭터의 가운데, 초필살기 중에는 쓴 사람 쪽으로 살짝 당겨 확대
    let targetX = (a.x + b.x) / 2 - VIEW_W / 2;
    let targetZoom = 1;
    if (sim.freeze > 0 && sim.freezeSide >= 0) {
      const f = sim.fighters[sim.freezeSide as 0 | 1];
      targetX = f.x - VIEW_W / 2;
      targetZoom = sim.freezeUlt ? 1.16 : 1.1;
    }
    targetX = Math.max(0, Math.min(STAGE_W - VIEW_W, targetX));
    const k = Math.min(1, dt * 10);
    this.camX += (targetX - this.camX) * (dt > 0 ? k : 0);
    this.zoom += (targetZoom - this.zoom) * (dt > 0 ? Math.min(1, dt * 8) : 0);
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(VIEW_W / 2 + sx, GROUND_Y + sy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-VIEW_W / 2, -GROUND_Y);
    this.stage.draw(ctx, this.camX, this.time, dt);

    // 초필살기 — 배경을 어둡게
    if (sim.freeze > 0) {
      ctx.fillStyle = sim.freezeUlt ? 'rgba(20,0,10,0.72)' : 'rgba(0,0,10,0.6)';
      ctx.fillRect(-100, -100, VIEW_W + 200, VIEW_H + 200);
    }

    ctx.save();
    ctx.translate(-this.camX, 0);
    drawShadow(ctx, a);
    drawShadow(ctx, b);
    for (const p of sim.projectiles)
      if (p.fx === 'poison' && p.landed) drawProjectile(ctx, p, this.time);
    const order: Fighter[] = a.act === 'attack' && b.act !== 'attack' ? [b, a] : [a, b];
    for (const f of order) {
      drawMoveFx(ctx, f, this.time);
      drawFighter(ctx, f, this.time);
    }
    for (const p of sim.projectiles)
      if (!(p.fx === 'poison' && p.landed)) drawProjectile(ctx, p, this.time);
    this.fx.draw(ctx);
    ctx.restore();
    ctx.restore();

    this.stage.drawWeather(ctx, this.time);

    if (this.mode !== 'idle') this.ui.draw(ctx, sim, this.time);
    else this.drawIdle(ctx);
  }

  private drawIdle(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(5,3,10,0.35)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
