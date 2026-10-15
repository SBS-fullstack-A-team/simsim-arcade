/**
 * 심심파이터즈 — 효과음 · 배경음악을 Web Audio API 로 직접 합성한다 (오디오 파일 없음).
 *
 * 브라우저는 사용자 동작 전에는 소리를 막으므로, 버튼을 누를 때 unlock() 으로 AudioContext 를 깨운다.
 * 오디오를 쓸 수 없는 환경이면 조용히 아무것도 하지 않는다.
 */

export type SfxName =
  | 'whoosh'
  | 'heavyWhoosh'
  | 'hit'
  | 'hitHeavy'
  | 'block'
  | 'guardCrush'
  | 'counter'
  | 'jump'
  | 'land'
  | 'fire'
  | 'volt'
  | 'steel'
  | 'sound'
  | 'slash'
  | 'poison'
  | 'ice'
  | 'light'
  | 'saw'
  | 'ghost'
  | 'gun'
  | 'teleport'
  | 'super'
  | 'ult'
  | 'explosion'
  | 'burst'
  | 'ko'
  | 'round'
  | 'fight'
  | 'win'
  | 'lose'
  | 'select'
  | 'confirm'
  | 'clash';

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const MUTE_KEY = 'simsim:simsim-fighters:muted:v1';

/** 스테이지별 배경음 (반음 단위, null = 쉼표) — 16분음표 16칸 */
const BGM: readonly {
  root: number;
  bpm: number;
  lead: (number | null)[];
  bass: (number | null)[];
}[] = [
  {
    root: 52,
    bpm: 150,
    lead: [12, null, 15, 12, 19, null, 18, 15, 12, null, 15, 17, 18, 17, 15, 14],
    bass: [0, 0, 12, 0, 0, 0, 12, 0, -4, -4, 8, -4, -2, -2, 10, -2],
  },
  {
    root: 57,
    bpm: 160,
    lead: [12, 12, 19, 12, 17, 12, 15, 14, 12, 12, 19, 12, 20, 19, 17, 15],
    bass: [0, 12, 0, 12, 0, 12, 0, 12, -3, 9, -3, 9, -5, 7, -5, 7],
  },
  {
    root: 50,
    bpm: 170,
    lead: [12, null, 13, 15, null, 13, 12, 10, 12, null, 13, 15, 17, 15, 13, 12],
    bass: [0, 0, 0, 12, 1, 1, 1, 13, 0, 0, 0, 12, -2, -2, -2, 10],
  },
  {
    root: 55,
    bpm: 140,
    lead: [12, null, 14, 15, 19, null, 15, 14, 12, null, 10, 12, 14, null, 12, 10],
    bass: [0, null, 0, 7, 0, null, 0, 7, -2, null, -2, 5, -4, null, -4, 3],
  },
];

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private lastPlay = new Map<SfxName, number>();
  private bgmTimer: number | null = null;
  private bgmTrack = -1;
  private bgmStep = 0;
  private bgmNext = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  get isMuted() {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // 저장 실패는 무시 (시크릿 모드 등)
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  /** 클릭·키 입력 안에서 호출 — AudioContext 생성/재개 */
  unlock() {
    if (!this.ctx) {
      const Ctor = getAudioContextCtor();
      if (!Ctor) return;
      try {
        const ctx = new Ctor();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.5;
        this.sfxBus.connect(this.master);
        this.bgmBus = ctx.createGain();
        this.bgmBus.gain.value = 0.11;
        this.bgmBus.connect(this.master);
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buf;
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  destroy() {
    this.stopBgm();
    if (this.ctx) void this.ctx.close().catch(() => undefined);
    this.ctx = null;
  }

  play(name: SfxName) {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const minGap: Partial<Record<SfxName, number>> = {
      hit: 0.035,
      block: 0.04,
      whoosh: 0.05,
      gun: 0.03,
      saw: 0.06,
    };
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < (minGap[name] ?? 0.02)) return;
    this.lastPlay.set(name, now);

    try {
      switch (name) {
        case 'whoosh':
          this.burst(0.1, 5000, 0.25, 'highpass', 1500);
          break;
        case 'heavyWhoosh':
          this.burst(0.18, 2600, 0.35, 'bandpass', 500);
          break;
        case 'hit':
          this.burst(0.08, 4200, 0.5);
          this.tone('square', 240, 90, 0.07, 0.12);
          break;
        case 'hitHeavy':
          this.burst(0.2, 3000, 0.7);
          this.tone('sawtooth', 150, 40, 0.2, 0.25);
          this.tone('sine', 80, 30, 0.25, 0.3);
          break;
        case 'block':
          this.tone('triangle', 1400, 1100, 0.08, 0.14);
          this.burst(0.06, 6000, 0.25, 'highpass', 2500);
          break;
        case 'guardCrush':
          this.burst(0.4, 5000, 0.6);
          [12, 7, 3, 0].forEach((s, i) => this.note(64 + s, now + i * 0.05, 0.12, 'square', 0.14));
          break;
        case 'counter':
          this.tone('square', 1800, 600, 0.12, 0.1);
          break;
        case 'jump':
          this.tone('square', 300, 620, 0.07, 0.04);
          break;
        case 'land':
          this.burst(0.06, 600, 0.2);
          break;
        case 'fire':
          this.burst(0.35, 2400, 0.4, 'bandpass', 700);
          this.tone('sawtooth', 260, 90, 0.3, 0.07);
          break;
        case 'volt':
          for (let i = 0; i < 4; i++)
            this.note(84 + ((i * 7) % 12), now + i * 0.03, 0.05, 'square', 0.08);
          this.burst(0.2, 8000, 0.3, 'highpass', 3000);
          break;
        case 'steel':
          this.tone('sawtooth', 120, 380, 0.25, 0.12);
          this.burst(0.3, 1800, 0.3, 'bandpass', 900);
          break;
        case 'sound':
          this.tone('sine', 110, 55, 0.4, 0.4);
          this.tone('square', 880, 440, 0.2, 0.06);
          break;
        case 'slash':
          this.burst(0.12, 7000, 0.4, 'highpass', 2500);
          this.tone('triangle', 1200, 400, 0.1, 0.06);
          break;
        case 'poison':
          this.tone('sine', 400, 200, 0.2, 0.1);
          this.burst(0.25, 1200, 0.2, 'bandpass', 600);
          break;
        case 'ice':
          this.tone('triangle', 2400, 1800, 0.25, 0.1);
          this.tone('sine', 3200, 3000, 0.3, 0.06);
          break;
        case 'light':
          this.tone('sawtooth', 1800, 400, 0.25, 0.08);
          break;
        case 'saw':
          this.tone('sawtooth', 90, 110, 0.25, 0.14);
          this.burst(0.25, 3000, 0.25, 'bandpass', 1500);
          break;
        case 'ghost':
          this.tone('sine', 600, 300, 0.5, 0.1);
          this.tone('sine', 610, 290, 0.5, 0.08);
          break;
        case 'gun':
          this.burst(0.08, 6000, 0.55);
          this.tone('square', 600, 80, 0.06, 0.12);
          break;
        case 'teleport':
          this.tone('sine', 200, 1600, 0.18, 0.1);
          break;
        case 'super':
          this.tone('sawtooth', 120, 900, 0.5, 0.12);
          [0, 7, 12, 19].forEach((s, i) =>
            this.note(64 + s, now + 0.1 + i * 0.05, 0.25, 'square', 0.1),
          );
          break;
        case 'ult':
          this.tone('sawtooth', 60, 1200, 1, 0.16);
          [0, 3, 7, 12, 15, 19, 24].forEach((s, i) =>
            this.note(60 + s, now + 0.1 + i * 0.06, 0.3, 'square', 0.1),
          );
          this.burst(1, 1200, 0.3, 'bandpass', 4000);
          break;
        case 'explosion':
          this.burst(1.2, 1200, 0.9);
          this.tone('sine', 90, 25, 1, 0.6);
          break;
        case 'burst':
          this.burst(0.5, 3000, 0.6, 'bandpass', 400);
          this.tone('sine', 300, 1200, 0.3, 0.12);
          break;
        case 'ko':
          this.burst(0.6, 2000, 0.6);
          this.tone('sawtooth', 300, 40, 0.8, 0.2);
          break;
        case 'round':
          [0, 7].forEach((s, i) => this.note(67 + s, now + i * 0.12, 0.18, 'square', 0.14));
          break;
        case 'fight':
          [0, 4, 7, 12].forEach((s, i) => this.note(67 + s, now + i * 0.05, 0.22, 'square', 0.16));
          this.burst(0.3, 3000, 0.3);
          break;
        case 'win':
          [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) =>
            this.note(64 + s, now + i * 0.1, 0.18, 'square', 0.12),
          );
          break;
        case 'lose':
          [7, 3, 0, -5].forEach((s, i) => this.note(60 + s, now + i * 0.26, 0.38, 'triangle', 0.2));
          break;
        case 'select':
          this.tone('square', 660, 990, 0.06, 0.07);
          break;
        case 'confirm':
          [0, 7, 12].forEach((s, i) => this.note(72 + s, now + i * 0.05, 0.12, 'square', 0.12));
          break;
        case 'clash':
          this.tone('triangle', 2200, 1600, 0.2, 0.14);
          this.burst(0.12, 6000, 0.3, 'highpass', 2000);
          break;
      }
    } catch {
      // 오디오 노드 생성 실패는 게임 진행에 영향 없도록 무시
    }
  }

  private tone(type: OscillatorType, from: number, to: number, dur: number, vol: number) {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(
    dur: number,
    cutoff: number,
    vol: number,
    type: BiquadFilterType = 'lowpass',
    endFreq = 80,
  ) {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }

  private note(
    midi: number,
    at: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    bus: GainNode | null = this.sfxBus,
  ) {
    const ctx = this.ctx;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = midiToHz(midi);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /* ---------------- 배경음 ---------------- */

  playBgm(track: number) {
    if (!this.ctx) return;
    if (this.bgmTimer !== null && this.bgmTrack === track) return;
    this.stopBgm();
    this.bgmTrack = track;
    this.bgmStep = 0;
    this.bgmNext = this.ctx.currentTime + 0.05;
    this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 50);
  }

  stopBgm() {
    if (this.bgmTimer !== null) window.clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  private scheduleBgm() {
    const ctx = this.ctx;
    const song = BGM[this.bgmTrack % BGM.length];
    if (!ctx || !song || ctx.state !== 'running') return;
    if (this.bgmNext < ctx.currentTime - 0.5) this.bgmNext = ctx.currentTime + 0.05;
    const stepDur = 60 / song.bpm / 4;
    try {
      while (this.bgmNext < ctx.currentTime + 0.2) {
        const i = this.bgmStep % 16;
        const lead = song.lead[i];
        const bass = song.bass[i];
        if (lead !== null && lead !== undefined) {
          this.note(song.root + lead, this.bgmNext, stepDur * 0.85, 'square', 0.3, this.bgmBus);
        }
        if (bass !== null && bass !== undefined) {
          this.note(
            song.root - 12 + bass,
            this.bgmNext,
            stepDur * 0.8,
            'sawtooth',
            0.4,
            this.bgmBus,
          );
        }
        if (i % 4 === 0) this.note(song.root - 24, this.bgmNext, 0.08, 'sine', 0.8, this.bgmBus);
        if (i % 8 === 4 && this.noise) {
          // 스네어
          const src = ctx.createBufferSource();
          src.buffer = this.noise;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.25, this.bgmNext);
          g.gain.exponentialRampToValueAtTime(0.001, this.bgmNext + 0.1);
          src.connect(g).connect(this.bgmBus as GainNode);
          src.start(this.bgmNext, Math.random() * 0.5);
          src.stop(this.bgmNext + 0.1);
        }
        this.bgmNext += stepDur;
        this.bgmStep += 1;
      }
    } catch {
      this.stopBgm();
    }
  }
}
