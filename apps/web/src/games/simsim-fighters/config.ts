/**
 * 심심파이터즈 — 게임 규칙 수치 · 조작 안내
 * 시뮬레이션은 60FPS 고정 프레임 단위로 계산한다 (속도 = px/프레임, 시간 = 프레임).
 */

export const GAME_ID = 'simsim-fighters';

/** 논리 해상도 (16:9) */
export const VIEW_W = 960;
export const VIEW_H = 540;
/** 스테이지(월드) 가로 길이 — 카메라가 두 캐릭터의 가운데를 따라간다 */
export const STAGE_W = 1600;
/** 벽에서 캐릭터 중심까지 최소 거리 */
export const WALL = 36;
/** 화면에서 땅의 높이 */
export const GROUND_Y = 478;
/** 두 캐릭터가 벌어질 수 있는 최대 거리 (한 화면 안에 둘 다 보이게) */
export const MAX_SEP = VIEW_W - 120;
/** 라운드 시작 위치 (스테이지 가운데에서 좌우로) */
export const START_GAP = 190;

export const STEP = 1 / 60;
export const ROUND_FRAMES = 99 * 60;
export const ROUNDS_TO_WIN = 2;
/** 무승부가 이어질 때 최대 라운드 — 넘으면 준 피해량으로 승부 */
export const MAX_ROUNDS = 9;
export const INTRO_FRAMES = 112;
/** 인트로 중 "FIGHT!" 를 외치는 프레임 */
export const FIGHT_CALL_FRAME = 64;
export const KO_FRAMES = 176;

export const GRAVITY = 0.66;
export const JUMP_SQUAT = 3;
export const LAND_LAG = 3;
/** 걷기 속도 배율 (앞 · 뒤) */
export const WALK_FWD = 1.18;
export const WALK_BACK = 0.95;

/* ---------------- 대시 (같은 방향키 두 번 연타) ---------------- */
/** 첫 번째 탭 뒤 두 번째 탭을 기다리는 프레임 */
export const DASH_WINDOW = 12;
/** 앞 대시 · 백대시 길이 (프레임) */
export const DASH_FRAMES = 16;
export const BACKDASH_FRAMES = 15;
/** 이 프레임부터 대시를 공격 · 점프로 캔슬할 수 있다 (가드는 언제든) */
export const DASH_CANCEL = 4;
/** 백대시 시작 무적 프레임 */
export const BACKDASH_INVUL = 5;

/* ---------------- 상태 이상 ---------------- */
/** 지속 피해(출혈 · 맹독)가 이어지는 프레임 · 깎이는 간격 */
export const DOT_FRAMES = 180;
export const DOT_TICK = 15;

/* ---------------- 텐션(필살기) 게이지 ---------------- */
export const METER_BAR = 100;
export const METER_MAX = 300;
/** F — 1단계 이상: 초필살기 (Super Art) */
export const SUPER_COST = 100;
/** F (피격·가드 경직 중) — 2단계: 버스트 (콤보 탈출) */
export const BURST_COST = 200;
/** F — 3단계 가득: 버스트 얼티밋 */
export const ULT_COST = 300;
/** 시간이 흐르기만 해도 조금씩 차오르는 양 (프레임당) */
export const METER_PASSIVE = 0.025;

/** 가드 게이지 — 막을 때마다 깎이고 0 이 되면 가드 크래시 */
export const GUARD_MAX = 100;
export const GUARD_REGEN = 0.22;
export const GUARD_CRUSH_STUN = 52;

/** 초필살기 컷인 동안 화면이 멈추는 프레임 */
export const SUPER_FREEZE = 50;
export const ULT_FREEZE = 78;
/** 공중 콤보 최대 타수 — 넘으면 착지할 때까지 맞지 않는다 */
export const JUGGLE_LIMIT = 7;
export const KNOCKDOWN_FRAMES = 36;
export const GETUP_FRAMES = 18;

/** 입력 비트 */
export const IN = {
  LEFT: 1,
  RIGHT: 2,
  UP: 4,
  DOWN: 8,
  A: 16,
  S: 32,
  D: 64,
  F: 128,
} as const;

/* ---------------- 온라인 (WebRTC) ---------------- */
/** 입력 지연 프레임 — 상대 입력이 도착할 시간을 번다 (핑에 맞춰 이 범위에서 정한다) */
export const INPUT_DELAY = 3;
export const INPUT_DELAY_MAX = 10;

/** 왕복 지연(ms)에 맞는 입력 지연 프레임 — 편도 지연 + 여유 2프레임 */
export function inputDelayFor(rttMs: number) {
  const oneWay = Math.max(0, rttMs) / 2;
  return Math.max(INPUT_DELAY - 1, Math.min(INPUT_DELAY_MAX, Math.ceil(oneWay / (1000 / 60)) + 2));
}
/** 이 간격(프레임)마다 방장이 상태를 보내 어긋남을 바로잡는다 */
export const SYNC_INTERVAL = 90;
/** 이 시간(프레임) 넘게 상대 입력이 안 오면 "응답 대기" 표시 */
export const STALL_WARN = 45;
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/* ---------------- 아케이드 점수 ---------------- */
export const ARCADE_LENGTH = 6;
export const MAX_SCORE = 500_000;
export const SCORE = {
  /** 준 피해 1 당 */
  damage: 1,
  roundWin: 1500,
  perfect: 3000,
  /** 이긴 라운드의 남은 시간 1초 당 */
  timePerSec: 30,
  /** 초필살기로 KO */
  superFinish: 2000,
  /** 한 경기의 최대 콤보 1타 당 */
  comboPerHit: 150,
  allClear: 20000,
} as const;
/** n 번째 상대일수록 점수 배율이 오른다 */
export const stageMultiplier = (stage: number) => 1 + 0.25 * (stage - 1);

export const CONTROLS: readonly { keys: string; action: string }[] = [
  { keys: '← →', action: '이동 (뒤로 걸으며 거리 조절)' },
  { keys: '→→ / ←←', action: '대시 · 백대시 (같은 방향키 빠르게 두 번)' },
  { keys: '↑', action: '점프 (←/→ 와 함께 대각선)' },
  { keys: '↓', action: '숙이기' },
  { keys: 'A', action: '주먹 — 빠른 약공격, 발차기·필살기로 캔슬' },
  { keys: 'S', action: '발차기 — 중거리 강공격 (↓+S 다리 걸기)' },
  { keys: 'D', action: '방어 — 서서 막기 / ↓+D 앉아 막기' },
  { keys: 'F', action: '초필살기 (게이지 1단계) · 3단계면 버스트 얼티밋' },
  { keys: '↓ → + A', action: '필살기 1 (원거리 · 고유기)' },
  { keys: '↓ → + S', action: '필살기 2 (돌진 · 대공 · 잡기)' },
  { keys: '피격 중 F', action: '버스트 (게이지 2단계) — 콤보 탈출' },
];

export const TIPS: readonly string[] = [
  '캐릭터마다 고유 능력이 달라요 — 슈퍼아머 · 받아치기 · 연계 · 출혈 · 빙결 · 흡혈 · 공중 필살기',
  '초필살기는 15명 모두 달라요 — 블랙홀 · 각성 · 시간 정지 · 분신 · 위성 레이저 · 가시 감옥 …',
  '주황빛으로 빛나는 동안엔 슈퍼아머! 잡기나 초필살기로 끊어 내세요',
  '방향키를 빠르게 두 번 누르면 대시! 대시 중에도 바로 공격 · 가드할 수 있어요',
  '공중 공격은 서서 막고, 다리 걸기(↓+S)는 앉아서 막아야 해요',
  '막을 때마다 가드 게이지가 깎여요. 다 깎이면 가드 크래시!',
  '주먹 → 발차기 → 필살기 → 초필살기 순서로 캔슬하면 콤보가 이어져요',
  '맞추고, 맞고, 막을 때마다 텐션 게이지가 차올라요',
  '아케이드 모드는 상대 6명을 연달아 이겨야 해요. 한 번 지면 끝!',
];
