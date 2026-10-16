/**
 * 심심파이터즈 — 캐릭터 15종 정의와 기술 데이터 (CharacterRegistry)
 *
 * 모든 기술은 MoveDef 하나의 형식으로 표현한다.
 *  - 발생(startup) → 지속(active) → 후딜(recovery) 프레임
 *  - box: 공격 판정 (캐릭터 발밑 기준, x 는 바라보는 쪽 방향 중심 거리, y 는 중심 높이)
 *  - projectile: 발생 프레임에 생기는 투사체 (원거리기 · 낙하 공격 · 기둥 공격)
 */

export type Level = 'high' | 'mid' | 'low' | 'overhead' | 'unblockable';

export type FxKind =
  | 'fire'
  | 'shadow'
  | 'volt'
  | 'steel'
  | 'sound'
  | 'blood'
  | 'poison'
  | 'ice'
  | 'venom'
  | 'puppet'
  | 'light'
  | 'rose'
  | 'saw'
  | 'ghost'
  | 'bullet'
  | 'impact'
  | 'explosion';

export type AnimKey =
  | 'punch'
  | 'kick'
  | 'cPunch'
  | 'cKick'
  | 'aPunch'
  | 'aKick'
  | 'cast'
  | 'beam'
  | 'rush'
  | 'upper'
  | 'dive'
  | 'slash'
  | 'grab'
  | 'super'
  | 'burst'
  | 'throw'
  | 'spin'
  | 'parry'
  | 'flip'
  | 'shoot'
  | 'stomp';

export type MoveId =
  | 'punch'
  | 'kick'
  | 'cPunch'
  | 'cKick'
  | 'aPunch'
  | 'aKick'
  | 'sp1'
  | 'sp2'
  | 'super'
  | 'ult'
  | 'burst'
  | 'ex';

/** 판정 상자 — x: 바라보는 쪽으로 중심까지 거리, y: 땅에서 중심까지 높이 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjSpec {
  fx: FxKind;
  /** 생기는 위치 (바라보는 쪽 거리, 높이) */
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  w: number;
  h: number;
  life: number;
  damage: number;
  hits: number;
  interval: number;
  level: Level;
  hitstun: number;
  blockstun: number;
  push: number;
  launch: number;
  knockdown: boolean;
  /** 여러 발 — gap 프레임 간격으로 count 발 */
  count: number;
  gap: number;
  /** 하늘에서 떨어지는 공격 — 내 앞쪽으로 spread 간격으로 늘어선다 */
  sky: boolean;
  spread: number;
  /** 땅에서 솟는 기둥 — i 번째 발이 step 만큼 더 앞에 생긴다 */
  step: number;
  /** 상대 머리 위를 노린다 (sky 와 함께) */
  aim: boolean;
  /** 투사체끼리 부딪쳐도 사라지지 않는다 */
  pierce: boolean;
  /** 생긴 뒤 이 프레임이 지나야 맞는다 */
  delay: number;
  /** 땅에 닿으면 그 자리에 이 프레임만큼 남는다 (독구름) */
  linger: number;
  /** 상대 높이를 따라가는 정도 */
  homing: number;
  /** 부메랑 — 수명 절반에 멈췄다가 주인 쪽으로 되돌아온다 */
  boomerang: boolean;
  /** 위아래로 출렁이며 날아가는 폭 (음파) */
  wave: number;
  /** 매 프레임 커지는 폭 · 높이 (화염파 · 충격파) */
  growW: number;
  growH: number;
  /** 맞으면 지속 피해 (총량) · 둔화 프레임 */
  dot: number;
  slow: number;
  /** 그리기 모양 (기본은 속성 모양) — vortex · homunculus · orbital · cage · clone · tracer */
  look: ProjLook;
  /** 상대가 서 있는 자리에 생긴다 (땅에서 솟는 감옥 · 위성 레이저) */
  atOpp: boolean;
  /** 상대 양옆에서 번갈아 나타나 상대 쪽으로 덮친다 (분신) */
  flank: boolean;
  /** 상대를 따라 좌우로 움직이는 속도 */
  trackX: number;
  /** 상대를 중심으로 빨아들이는 힘 (블랙홀) */
  suck: number;
  /** 준 피해의 이 비율만큼 주인 체력 회복 */
  drain: number;
  /** 처음 맞히거나 수명이 다하면 그 자리에서 독구름으로 터진다 */
  explode: boolean;
  /** 여러 발을 부채꼴로 (라디안, 전체 벌어지는 각) */
  fan: number;
  /** 맞으면 이 프레임 동안 그 자리에 묶인다 (가시 감옥) */
  freeze: number;
}

export type ProjLook =
  '' | 'vortex' | 'homunculus' | 'orbital' | 'cage' | 'clone' | 'tracer' | 'buzzsaw';

export interface MoveDef {
  id: MoveId;
  name: string;
  anim: AnimKey;
  fx: FxKind;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** 지속 중 최대 타수와 간격 */
  hits: number;
  interval: number;
  box: Box | null;
  level: Level;
  hitstun: number;
  blockstun: number;
  /** 맞은 쪽이 밀려나는 속도 (음수면 끌려온다) */
  push: number;
  /** 맞으면 이 속도로 떠오른다 (0 = 서서 경직) */
  launch: number;
  knockdown: boolean;
  hitstop: number;
  /** 맞혔을 때 오르는 텐션 */
  meter: number;
  /** 가드했을 때 깎이는 체력 비율 */
  chip: number;
  /** 0: 캔슬 불가 · 1: 필살기·초필살기로 캔슬 · 2: 발차기·필살기로 캔슬 (주먹) */
  cancel: 0 | 1 | 2;
  /** 지속 중 앞으로 움직이는 속도 */
  selfVx: number;
  /** 발생 순간 뛰어오르는 속도 (공중 기술) */
  selfVy: number;
  /** 시작부터 이 프레임 동안 무적 */
  invul: number;
  projectile: ProjSpec | null;
  teleport: 'behind' | 'front' | null;
  grab: boolean;
  /** 지속이 착지할 때까지 이어진다 (다이브) */
  untilLand: boolean;
  /** 공중에서 쓰는 기술 */
  air: boolean;
  /** 1: 초필살기 · 3: 버스트 얼티밋 */
  superLevel: 0 | 1 | 3;
  /** 슈퍼아머 — 발생 ~ 지속 동안 이 타수까지는 맞아도 멈추지 않는다 (피해는 절반) */
  armor: number;
  /** 받아치기 자세 — 지속 동안 공격을 받으면 흘리고 연계기(ex)로 반격 */
  parry: boolean;
  /** 맞히면 이 버튼으로 연계기(ex)가 이어진다 */
  chain: '' | 'A' | 'S';
  /** 준 피해의 이 비율만큼 체력 회복 (흡혈) */
  drain: number;
  /** 맞으면 지속 피해 (총량, 3초 동안 나눠서) */
  dot: number;
  /** 맞으면 이 프레임 동안 둔화 (걷기 · 점프 · 대시가 느려진다) */
  slow: number;
  /** 다운될 때 바닥에서 한 번 튀어 올라 추가타를 넣을 수 있다 */
  bounce: boolean;
  /** 발생 동안 앞으로 미끄러지는 속도 (구르기 · 돌격 준비) */
  startVx: number;
  /** 지속 동안 상대 몸을 통과한다 (등 뒤로 빠지는 돌진) */
  passThrough: boolean;
  /** 공중에서도 쓸 수 있는 필살기 (투사체는 비스듬히 아래로) */
  airOk: boolean;
  /** 다이브가 착지하는 순간 생기는 투사체 (충격파 · 폭발) */
  landProj: ProjSpec | null;
  /** 맞힌 상대 붙잡기 — hold: 그 자리에 묶기 · carry: 들고 날아오르기 (기술이 끝나면 풀린다) */
  lock: '' | 'hold' | 'carry';
  /** 묶인 상대 양옆을 번갈아 순간이동하며 벤다 */
  blink: boolean;
  /** 맞힌 순간 이 속도로 뛰어오른다 (잡아서 하늘로) */
  hitVy: number;
  /** 각성 — 이 프레임 동안 강화 상태 (이동 · 회수 빨라지고 피해 증가) */
  install: number;
  /** 맞으면 이 프레임 동안 얼어붙는다 */
  freeze: number;
  /** 근접 기술 이펙트 모양 */
  look: '' | 'frostField' | 'bloodMoon' | 'overdrive';
}

export type NormalId = 'punch' | 'kick' | 'cPunch' | 'cKick' | 'aPunch' | 'aKick';
type MoveSpec = Partial<MoveDef> & Pick<MoveDef, 'name' | 'anim'>;

export type HairStyle =
  | 'spiky'
  | 'hood'
  | 'mohawk'
  | 'robot'
  | 'headphones'
  | 'wild'
  | 'goggles'
  | 'topknot'
  | 'catEars'
  | 'twinTails'
  | 'helmet'
  | 'longRose'
  | 'bob'
  | 'witchHat'
  | 'cowboy';

export type WeaponKind =
  | 'greatsword'
  | 'scythe'
  | 'gauntlet'
  | 'robotFist'
  | 'none'
  | 'claws'
  | 'flask'
  | 'katana'
  | 'catClaw'
  | 'strings'
  | 'lance'
  | 'whip'
  | 'chainsaw'
  | 'staff'
  | 'pistols';

export type BackKind =
  | 'none'
  | 'cape'
  | 'chains'
  | 'speakers'
  | 'tatteredCape'
  | 'tank'
  | 'scarf'
  | 'tail'
  | 'puppet'
  | 'wings'
  | 'thorns'
  | 'ghostCape'
  | 'poncho';

export type BodyKind = 'normal' | 'bulky' | 'slim' | 'robot';

export interface Palette {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  accent: string;
  trim: string;
  eye: string;
  shoe: string;
}

export interface CharStats {
  hp: number;
  /** 앞으로 걷는 속도 (px/프레임) */
  walk: number;
  jumpVy: number;
  jumpVx: number;
  /** 공격력 배율 */
  power: number;
  /** 발생 프레임 보정 (음수 = 더 빠름) */
  speed: number;
  /** 기본기 사거리 배율 */
  reach: number;
  /** 받는 피해 배율 (낮을수록 단단함) */
  defense: number;
}

export type CharId =
  | 'solaris'
  | 'shadow-crow'
  | 'bolt-master'
  | 'iron-giant'
  | 'phantom-dj'
  | 'blood-hound'
  | 'alchemist-z'
  | 'frost-samurai'
  | 'violet-cat'
  | 'puppet-lilith'
  | 'neon-valkyrie'
  | 'scarlet-whip'
  | 'chainsaw-bella'
  | 'arcane-spectre'
  | 'gunslinger-rose';

export interface CharacterDef {
  id: CharId;
  name: string;
  en: string;
  gender: 'M' | 'F';
  /** 한 줄 소개 */
  title: string;
  /** 성능 분류 */
  style: string;
  color: string;
  glow: string;
  fx: FxKind;
  palette: Palette;
  body: BodyKind;
  scale: number;
  hair: HairStyle;
  weapon: WeaponKind;
  back: BackKind;
  stats: CharStats;
  sp1: MoveSpec;
  sp2: MoveSpec;
  superArt: MoveSpec;
  /** 연계기 — 연타 연계(chain) 의 2단 · 받아치기(parry) 성공 시 반격 */
  followup?: MoveSpec;
  /** 캐릭터 고유 기본기 (이름 · 동작 · 판정 덮어쓰기) */
  normals?: Partial<Record<NormalId, Partial<MoveDef>>>;
  quote: string;
}

/* =========================================================
 * 기술 만들기 도우미
 * ========================================================= */

const BASE_MOVE: MoveDef = {
  id: 'punch',
  name: '',
  anim: 'punch',
  fx: 'impact',
  startup: 5,
  active: 3,
  recovery: 9,
  damage: 40,
  hits: 1,
  interval: 4,
  box: null,
  level: 'mid',
  hitstun: 15,
  blockstun: 10,
  push: 4,
  launch: 0,
  knockdown: false,
  hitstop: 6,
  meter: 5,
  chip: 0.1,
  cancel: 0,
  selfVx: 0,
  selfVy: 0,
  invul: 0,
  projectile: null,
  teleport: null,
  grab: false,
  untilLand: false,
  air: false,
  superLevel: 0,
  armor: 0,
  parry: false,
  chain: '',
  drain: 0,
  dot: 0,
  slow: 0,
  bounce: false,
  startVx: 0,
  passThrough: false,
  airOk: false,
  landProj: null,
  lock: '',
  blink: false,
  hitVy: 0,
  install: 0,
  freeze: 0,
  look: '',
};

const BASE_PROJ: ProjSpec = {
  fx: 'impact',
  x: 50,
  y: 95,
  vx: 8,
  vy: 0,
  gravity: 0,
  w: 40,
  h: 40,
  life: 90,
  damage: 70,
  hits: 1,
  interval: 6,
  level: 'mid',
  hitstun: 20,
  blockstun: 14,
  push: 5,
  launch: 0,
  knockdown: false,
  count: 1,
  gap: 0,
  sky: false,
  spread: 0,
  step: 0,
  aim: false,
  pierce: false,
  delay: 0,
  linger: 0,
  homing: 0,
  boomerang: false,
  wave: 0,
  growW: 0,
  growH: 0,
  dot: 0,
  slow: 0,
  look: '',
  atOpp: false,
  flank: false,
  trackX: 0,
  suck: 0,
  drain: 0,
  explode: false,
  fan: 0,
  freeze: 0,
};

const proj = (o: Partial<ProjSpec>): ProjSpec => ({ ...BASE_PROJ, ...o });

/* =========================================================
 * 캐릭터 15종
 * ========================================================= */

const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'solaris',
    name: '솔라리스',
    en: 'SOLARIS',
    gender: 'M',
    title: '대검에 태양의 불꽃을 두른 떠돌이 전사',
    style: '대검 · 화염 폭발',
    color: '#ff5a1f',
    glow: '#ffc04a',
    fx: 'fire',
    palette: {
      skin: '#e8b48a',
      hair: '#a8a8b8',
      top: '#b8261a',
      bottom: '#2a2230',
      accent: '#ffb02e',
      trim: '#f2e2c0',
      eye: '#ff3a1a',
      shoe: '#3a2a20',
    },
    body: 'normal',
    scale: 1.04,
    hair: 'spiky',
    weapon: 'greatsword',
    back: 'none',
    stats: {
      hp: 1020,
      walk: 3.2,
      jumpVy: 14.4,
      jumpVx: 4.2,
      power: 1.1,
      speed: 0,
      reach: 1.2,
      defense: 1,
    },
    normals: {
      punch: { name: '대검 가로베기', damage: 46, box: { x: 64, y: 110, w: 78, h: 40 } },
      kick: { name: '화염 앞차기', fx: 'fire', damage: 74 },
      cKick: { name: '대검 쓸기', damage: 66, box: { x: 78, y: 16, w: 104, h: 30 } },
      aKick: { name: '불꽃 내려찍기', damage: 70, box: { x: 46, y: 30, w: 80, h: 56 } },
    },
    sp1: {
      name: '솔라 웨이브',
      anim: 'slash',
      fx: 'fire',
      startup: 13,
      active: 2,
      recovery: 24,
      projectile: proj({
        fx: 'fire',
        x: 64,
        y: 34,
        vx: 6.5,
        w: 34,
        h: 54,
        growW: 0.3,
        growH: 1.1,
        life: 74,
        damage: 96,
        hits: 2,
        interval: 12,
        hitstun: 22,
      }),
    },
    sp2: {
      name: '볼캐닉 라이즈',
      anim: 'upper',
      fx: 'fire',
      startup: 4,
      active: 12,
      recovery: 26,
      damage: 120,
      hits: 3,
      interval: 4,
      invul: 9,
      selfVy: 13,
      selfVx: 3,
      launch: 13,
      knockdown: true,
      box: { x: 34, y: 130, w: 70, h: 130 },
    },
    superArt: {
      name: '선폴 디바인',
      anim: 'dive',
      fx: 'fire',
      startup: 8,
      active: 40,
      recovery: 26,
      damage: 110,
      selfVy: 15,
      selfVx: 6.5,
      untilLand: true,
      // 내리찍기에 맞으면 그 자리에 묶여 착지 폭발까지 맞는다
      hitstun: 44,
      push: 0,
      level: 'overhead',
      box: { x: 30, y: 30, w: 100, h: 100 },
      landProj: proj({
        fx: 'fire',
        x: 0,
        y: 64,
        vx: 0,
        w: 150,
        h: 130,
        growW: 7,
        growH: 0.6,
        life: 24,
        damage: 230,
        hits: 3,
        interval: 5,
        pierce: true,
        knockdown: true,
        launch: 12,
      }),
    },
    quote: '불꽃은 꺼지지 않는다. 다음 상대를 데려와라.',
  },
  {
    id: 'shadow-crow',
    name: '섀도우 크로우',
    en: 'SHADOW CROW',
    gender: 'M',
    title: '그림자 사슬과 대낫으로 영혼을 거두는 사신',
    style: '긴 리치 · 흡혈 · 순간이동',
    color: '#7a4cff',
    glow: '#c0a0ff',
    fx: 'shadow',
    palette: {
      skin: '#b8b0c8',
      hair: '#1a1424',
      top: '#241a36',
      bottom: '#16101f',
      accent: '#8a5cff',
      trim: '#c8c0d8',
      eye: '#b07aff',
      shoe: '#100a18',
    },
    body: 'normal',
    scale: 1.06,
    hair: 'hood',
    weapon: 'scythe',
    back: 'chains',
    stats: {
      hp: 1000,
      walk: 3,
      jumpVy: 14.6,
      jumpVx: 4,
      power: 1,
      speed: 1,
      reach: 1.4,
      defense: 1,
    },
    normals: {
      punch: { name: '낫 걸기', damage: 40 },
      kick: { name: '그림자 무릎', fx: 'shadow' },
      cKick: { name: '사신의 낫 쓸기', damage: 66, box: { x: 96, y: 16, w: 130, h: 30 } },
    },
    sp1: {
      name: '그림자 사슬',
      anim: 'throw',
      fx: 'shadow',
      startup: 14,
      active: 6,
      recovery: 24,
      damage: 75,
      push: -11,
      hitstun: 30,
      slow: 90,
      box: { x: 180, y: 92, w: 300, h: 30 },
    },
    sp2: {
      name: '사신의 강림',
      anim: 'slash',
      fx: 'shadow',
      startup: 18,
      active: 5,
      recovery: 22,
      damage: 95,
      teleport: 'behind',
      knockdown: true,
      level: 'overhead',
      box: { x: 50, y: 90, w: 100, h: 140 },
    },
    superArt: {
      name: '명계의 문',
      anim: 'cast',
      fx: 'shadow',
      startup: 12,
      active: 4,
      recovery: 34,
      projectile: proj({
        fx: 'shadow',
        look: 'vortex',
        x: 210,
        y: 100,
        vx: 1.6,
        w: 130,
        h: 170,
        life: 80,
        delay: 8,
        suck: 3.2,
        drain: 0.5,
        damage: 300,
        hits: 8,
        interval: 8,
        pierce: true,
        knockdown: true,
        launch: 11,
        hitstun: 20,
      }),
    },
    quote: '네 영혼은… 내 낫에 걸리기엔 너무 가볍군.',
  },
  {
    id: 'bolt-master',
    name: '볼트 마스터',
    en: 'BOLT MASTER',
    gender: 'M',
    title: '온몸에 뇌격을 두른 사이버펑크 격투가',
    style: '러시 · 연계 · 관통 돌진',
    color: '#28e0ff',
    glow: '#fff36a',
    fx: 'volt',
    palette: {
      skin: '#d8a078',
      hair: '#2ae8ff',
      top: '#1a2a3a',
      bottom: '#20202a',
      accent: '#ffe02a',
      trim: '#7af2ff',
      eye: '#7af2ff',
      shoe: '#ffe02a',
    },
    body: 'normal',
    scale: 1,
    hair: 'mohawk',
    weapon: 'gauntlet',
    back: 'none',
    stats: {
      hp: 980,
      walk: 4,
      jumpVy: 14.8,
      jumpVx: 4.6,
      power: 0.95,
      speed: -1,
      reach: 1,
      defense: 1,
    },
    normals: {
      punch: { name: '원투 잽', hits: 2, interval: 3, damage: 44 },
      kick: { name: '볼트 니킥', startVx: 3.5, damage: 68 },
      aPunch: { name: '전격 팔꿈치', fx: 'volt' },
    },
    sp1: {
      name: '볼트 스트레이트',
      anim: 'rush',
      fx: 'volt',
      startup: 7,
      active: 6,
      recovery: 20,
      damage: 72,
      selfVx: 10,
      chain: 'A',
      box: { x: 42, y: 100, w: 70, h: 60 },
    },
    followup: {
      name: '썬더 어퍼 (A 연타)',
      anim: 'upper',
      fx: 'volt',
      startup: 3,
      active: 8,
      recovery: 20,
      damage: 84,
      hits: 2,
      interval: 4,
      selfVy: 10,
      selfVx: 4,
      startVx: 8,
      launch: 13,
      knockdown: true,
      box: { x: 50, y: 120, w: 96, h: 130 },
    },
    sp2: {
      name: '라이트닝 블링크',
      anim: 'rush',
      fx: 'volt',
      startup: 5,
      active: 10,
      recovery: 16,
      damage: 70,
      selfVx: 21,
      invul: 13,
      passThrough: true,
      hitstun: 24,
      box: { x: 0, y: 90, w: 60, h: 120 },
    },
    superArt: {
      name: '오버드라이브',
      anim: 'super',
      fx: 'volt',
      look: 'overdrive',
      startup: 8,
      active: 10,
      recovery: 20,
      damage: 160,
      hits: 3,
      interval: 3,
      launch: 10,
      knockdown: true,
      install: 420,
      push: 2,
      box: { x: 0, y: 100, w: 300, h: 230 },
    },
    quote: '전압이 부족했나? 다음엔 감전 주의 표지판이라도 세워 둬.',
  },
  {
    id: 'iron-giant',
    name: '아이언 자이언트',
    en: 'IRON GIANT',
    gender: 'M',
    title: '묵직한 중장갑으로 상대를 붙잡아 내리꽂는 거대 로봇',
    style: '슈퍼아머 · 잡기 · 맷집',
    color: '#9aa4b0',
    glow: '#ff8a2a',
    fx: 'steel',
    palette: {
      skin: '#7a8490',
      hair: '#4a525c',
      top: '#5a6470',
      bottom: '#3a424c',
      accent: '#ff8a2a',
      trim: '#c8d0d8',
      eye: '#ff4a2a',
      shoe: '#2a3038',
    },
    body: 'robot',
    scale: 1.28,
    hair: 'robot',
    weapon: 'robotFist',
    back: 'none',
    stats: {
      hp: 1180,
      walk: 2.3,
      jumpVy: 13,
      jumpVx: 3.4,
      power: 1.25,
      speed: 2,
      reach: 1.15,
      defense: 0.85,
    },
    normals: {
      punch: { name: '해머 훅', damage: 52 },
      kick: { name: '철갑 짓밟기', anim: 'stomp', armor: 1, damage: 84 },
      cKick: { name: '진각 쓸기', damage: 72 },
    },
    sp1: {
      name: '로켓 펀치',
      anim: 'punch',
      fx: 'steel',
      startup: 16,
      active: 2,
      recovery: 28,
      armor: 1,
      projectile: proj({
        fx: 'steel',
        y: 105,
        vx: 8.5,
        w: 62,
        h: 42,
        damage: 110,
        knockdown: true,
        launch: 6,
      }),
    },
    sp2: {
      name: '기가 슬램',
      anim: 'grab',
      fx: 'steel',
      startup: 6,
      active: 3,
      recovery: 34,
      damage: 180,
      grab: true,
      level: 'unblockable',
      knockdown: true,
      launch: 9,
      bounce: true,
      hitstop: 14,
      box: { x: 60, y: 90, w: 96, h: 150 },
    },
    superArt: {
      name: '타이탄 드롭',
      anim: 'grab',
      fx: 'steel',
      startup: 14,
      active: 4,
      recovery: 30,
      damage: 130,
      startVx: 11,
      armor: 4,
      grab: true,
      level: 'unblockable',
      lock: 'carry',
      hitVy: 17,
      untilLand: true,
      hitstun: 60,
      hitstop: 16,
      box: { x: 74, y: 90, w: 130, h: 160 },
      landProj: proj({
        fx: 'steel',
        x: 30,
        y: 50,
        vx: 0,
        w: 200,
        h: 100,
        growW: 9,
        growH: 0.5,
        life: 22,
        damage: 270,
        hits: 1,
        pierce: true,
        knockdown: true,
        launch: 13,
      }),
    },
    quote: '분석 완료. 상대의 강도: 철판 한 장보다 약함.',
  },
  {
    id: 'phantom-dj',
    name: '팬텀 디제이',
    en: 'PHANTOM DJ',
    gender: 'M',
    title: '음파 레이저와 비트로 무대를 지배하는 댄서',
    style: '음파 · 리듬 · 브레이크댄스',
    color: '#ff3ad8',
    glow: '#3affd0',
    fx: 'sound',
    palette: {
      skin: '#a8724e',
      hair: '#141018',
      top: '#2a1a40',
      bottom: '#181424',
      accent: '#ff3ad8',
      trim: '#3affd0',
      eye: '#3affd0',
      shoe: '#f2f2f2',
    },
    body: 'normal',
    scale: 1,
    hair: 'headphones',
    weapon: 'none',
    back: 'speakers',
    stats: {
      hp: 980,
      walk: 3.8,
      jumpVy: 15,
      jumpVx: 4.4,
      power: 0.95,
      speed: -1,
      reach: 1.05,
      defense: 1,
    },
    normals: {
      punch: { name: '비트 잽', damage: 36 },
      kick: { name: '윈드밀 킥', anim: 'spin', hits: 2, interval: 4, damage: 72 },
      cKick: { name: '헤드스핀 스윕', damage: 60 },
    },
    sp1: {
      name: '사운드 웨이브',
      anim: 'cast',
      fx: 'sound',
      startup: 12,
      active: 2,
      recovery: 22,
      projectile: proj({
        fx: 'sound',
        x: 50,
        y: 96,
        vx: 7,
        w: 46,
        h: 56,
        wave: 30,
        life: 110,
        damage: 84,
        hits: 3,
        interval: 8,
        hitstun: 16,
      }),
    },
    sp2: {
      name: '비트 스핀',
      anim: 'spin',
      fx: 'sound',
      startup: 7,
      active: 22,
      recovery: 18,
      damage: 96,
      hits: 4,
      interval: 5,
      selfVx: 5,
      level: 'low',
      box: { x: 10, y: 40, w: 140, h: 80 },
    },
    superArt: {
      name: '드롭 더 베이스',
      anim: 'super',
      fx: 'sound',
      startup: 10,
      active: 50,
      recovery: 30,
      projectile: proj({
        fx: 'sound',
        x: 0,
        y: 90,
        vx: 0,
        w: 60,
        h: 70,
        growW: 16,
        growH: 4,
        life: 34,
        damage: 80,
        count: 4,
        gap: 12,
        pierce: true,
        push: 1,
        hitstun: 28,
      }),
    },
    quote: '비트에 못 따라오면 무대에서 내려가야지. 다음 곡!',
  },
  {
    id: 'blood-hound',
    name: '블러드 하운드',
    en: 'BLOOD HOUND',
    gender: 'M',
    title: '양손 리트랙터블 클로를 휘두르는 광기의 기사',
    style: '출혈 · 돌진 · 압박',
    color: '#e0203a',
    glow: '#ff8a9a',
    fx: 'blood',
    palette: {
      skin: '#d8c0b0',
      hair: '#e8e8f0',
      top: '#3a1018',
      bottom: '#1a1418',
      accent: '#e0203a',
      trim: '#a8a8b0',
      eye: '#ff203a',
      shoe: '#20181a',
    },
    body: 'normal',
    scale: 1.02,
    hair: 'wild',
    weapon: 'claws',
    back: 'tatteredCape',
    stats: {
      hp: 990,
      walk: 4.1,
      jumpVy: 14.8,
      jumpVx: 4.8,
      power: 1,
      speed: -1,
      reach: 0.95,
      defense: 1,
    },
    normals: {
      punch: { name: '클로 스와이프', hits: 2, interval: 3, damage: 42, dot: 12 },
      kick: { name: '하운드 킥' },
      cPunch: { name: '발톱 할퀴기', dot: 10 },
    },
    sp1: {
      name: '클로 렌드',
      anim: 'rush',
      fx: 'blood',
      startup: 9,
      active: 10,
      recovery: 22,
      damage: 90,
      hits: 2,
      interval: 5,
      selfVx: 13,
      dot: 60,
      box: { x: 46, y: 95, w: 70, h: 90 },
    },
    sp2: {
      name: '페럴 리프',
      anim: 'dive',
      fx: 'blood',
      startup: 6,
      active: 40,
      recovery: 14,
      damage: 100,
      selfVy: 11,
      selfVx: 7,
      untilLand: true,
      level: 'overhead',
      knockdown: true,
      dot: 40,
      box: { x: 30, y: 40, w: 80, h: 70 },
    },
    superArt: {
      name: '블러드 문 헌트',
      anim: 'rush',
      fx: 'blood',
      look: 'bloodMoon',
      startup: 7,
      active: 40,
      recovery: 26,
      damage: 310,
      hits: 8,
      interval: 5,
      selfVx: 14,
      lock: 'hold',
      blink: true,
      knockdown: true,
      launch: 12,
      dot: 90,
      box: { x: 46, y: 90, w: 96, h: 140 },
    },
    quote: '피 냄새가 나는군… 아직 사냥은 끝나지 않았다!',
  },
  {
    id: 'alchemist-z',
    name: '알케미스트 Z',
    en: 'ALCHEMIST Z',
    gender: 'M',
    title: '독병과 연금술 화염을 뿌리는 매드 사이언티스트',
    style: '설치 · 독 · 화염',
    color: '#7aff3a',
    glow: '#e0ff6a',
    fx: 'poison',
    palette: {
      skin: '#e0c0a0',
      hair: '#f2f2f2',
      top: '#e8e8e0',
      bottom: '#3a3448',
      accent: '#7aff3a',
      trim: '#8a6a3a',
      eye: '#7aff3a',
      shoe: '#2a2430',
    },
    body: 'normal',
    scale: 1,
    hair: 'goggles',
    weapon: 'flask',
    back: 'tank',
    stats: {
      hp: 990,
      walk: 3,
      jumpVy: 14.2,
      jumpVx: 4,
      power: 0.95,
      speed: 1,
      reach: 1,
      defense: 1,
    },
    normals: {
      punch: { name: '플라스크 휘두르기' },
      kick: { name: '약품 발차기' },
      cPunch: { name: '산성 튀기기', dot: 14 },
    },
    sp1: {
      name: '맹독 플라스크',
      anim: 'throw',
      fx: 'poison',
      startup: 12,
      active: 2,
      recovery: 22,
      projectile: proj({
        fx: 'poison',
        x: 30,
        y: 130,
        vx: 6,
        vy: 9,
        gravity: 0.45,
        w: 34,
        h: 34,
        life: 120,
        linger: 110,
        damage: 64,
        hits: 4,
        interval: 18,
        hitstun: 18,
        push: 1,
        dot: 40,
      }),
    },
    sp2: {
      name: '연금 화염방사',
      anim: 'beam',
      fx: 'fire',
      startup: 10,
      active: 22,
      recovery: 20,
      damage: 105,
      hits: 5,
      interval: 4,
      hitstun: 14,
      box: { x: 140, y: 88, w: 220, h: 54 },
    },
    superArt: {
      name: '호문쿨루스',
      anim: 'throw',
      fx: 'poison',
      startup: 10,
      active: 4,
      recovery: 30,
      projectile: proj({
        fx: 'poison',
        look: 'homunculus',
        x: 60,
        y: 44,
        vx: 2.6,
        w: 64,
        h: 88,
        life: 260,
        linger: 120,
        explode: true,
        pierce: true,
        damage: 300,
        hits: 6,
        interval: 14,
        hitstun: 24,
        launch: 6,
        dot: 70,
      }),
    },
    quote: '흥미로운 실험이었어. 결과: 내 공식이 옳았다!',
  },
  {
    id: 'frost-samurai',
    name: '프로스트 사무라이',
    en: 'FROST SAMURAI',
    gender: 'M',
    title: '발도술과 빙결 검풍을 쏘는 고고한 검객',
    style: '받아치기 · 빙결 · 일격',
    color: '#5ac8ff',
    glow: '#e8faff',
    fx: 'ice',
    palette: {
      skin: '#e8c8a8',
      hair: '#1a2a40',
      top: '#e8f2ff',
      bottom: '#1a3a6a',
      accent: '#5ac8ff',
      trim: '#1a2a40',
      eye: '#5ac8ff',
      shoe: '#2a3a50',
    },
    body: 'normal',
    scale: 1.02,
    hair: 'topknot',
    weapon: 'katana',
    back: 'scarf',
    stats: {
      hp: 1000,
      walk: 3.4,
      jumpVy: 14.6,
      jumpVx: 4.2,
      power: 1.05,
      speed: 0,
      reach: 1.25,
      defense: 1,
    },
    normals: {
      punch: { name: '발도 베기', damage: 42 },
      kick: { name: '칼집 치기', damage: 70 },
      cKick: { name: '하단 베기', slow: 40 },
    },
    sp1: {
      name: '빙결 검풍',
      anim: 'slash',
      fx: 'ice',
      startup: 12,
      active: 2,
      recovery: 22,
      projectile: proj({
        fx: 'ice',
        y: 80,
        vx: 9.5,
        w: 42,
        h: 80,
        damage: 80,
        slow: 150,
      }),
    },
    sp2: {
      name: '설화 받아치기',
      anim: 'parry',
      fx: 'ice',
      startup: 2,
      active: 22,
      recovery: 20,
      parry: true,
    },
    followup: {
      name: '설화 일섬 (받아치기 성공)',
      anim: 'rush',
      fx: 'ice',
      startup: 2,
      active: 6,
      recovery: 18,
      damage: 150,
      selfVx: 18,
      invul: 16,
      passThrough: true,
      knockdown: true,
      slow: 150,
      hitstop: 16,
      box: { x: 30, y: 90, w: 100, h: 110 },
    },
    superArt: {
      name: '절대영도',
      anim: 'parry',
      fx: 'ice',
      look: 'frostField',
      startup: 10,
      active: 52,
      recovery: 26,
      damage: 340,
      hits: 2,
      interval: 46,
      freeze: 48,
      knockdown: true,
      launch: 12,
      slow: 240,
      hitstop: 18,
      box: { x: 0, y: 120, w: 1100, h: 300 },
    },
    quote: '칼집에서 칼을 뽑는 순간, 승부는 이미 끝나 있었다.',
  },
  {
    id: 'violet-cat',
    name: '바이올렛 캣',
    en: 'VIOLET CAT',
    gender: 'F',
    title: '맹독 고양이 손톱을 휘두르는 날렵한 수인',
    style: '초고속 · 등 뒤 기습 · 맹독',
    color: '#b04aff',
    glow: '#ff7af2',
    fx: 'venom',
    palette: {
      skin: '#f0c8b0',
      hair: '#6a2aa8',
      top: '#2a1438',
      bottom: '#4a1a6a',
      accent: '#d07aff',
      trim: '#ff7af2',
      eye: '#ffe02a',
      shoe: '#2a1438',
    },
    body: 'slim',
    scale: 0.95,
    hair: 'catEars',
    weapon: 'catClaw',
    back: 'tail',
    stats: {
      hp: 920,
      walk: 4.5,
      jumpVy: 15.6,
      jumpVx: 5,
      power: 0.9,
      speed: -2,
      reach: 0.9,
      defense: 1.04,
    },
    normals: {
      punch: { name: '냥냥 펀치', hits: 2, interval: 2, damage: 38 },
      kick: { name: '꼬리 채찍', anim: 'spin', damage: 60, dot: 10 },
      aKick: { name: '고양이 드롭', damage: 64 },
    },
    sp1: {
      name: '섀도우 스텝',
      anim: 'rush',
      fx: 'venom',
      startup: 6,
      active: 9,
      recovery: 16,
      damage: 54,
      selfVx: 18,
      invul: 12,
      passThrough: true,
      dot: 50,
      box: { x: 0, y: 70, w: 70, h: 90 },
    },
    sp2: {
      name: '캣 플립',
      anim: 'flip',
      fx: 'venom',
      startup: 4,
      active: 9,
      recovery: 18,
      damage: 98,
      invul: 7,
      selfVy: 10.5,
      selfVx: -3.5,
      launch: 12,
      knockdown: true,
      box: { x: 26, y: 120, w: 70, h: 110 },
    },
    superArt: {
      name: '나인 라이브즈',
      anim: 'super',
      fx: 'venom',
      startup: 8,
      active: 36,
      recovery: 26,
      projectile: proj({
        fx: 'venom',
        look: 'clone',
        flank: true,
        x: 170,
        y: 80,
        vx: 15,
        w: 70,
        h: 100,
        life: 22,
        damage: 34,
        count: 9,
        gap: 4,
        pierce: true,
        hitstun: 22,
        launch: 4,
        dot: 10,
      }),
    },
    quote: '냐하~ 발톱 자국은 기념으로 남겨 줄게♪',
  },
  {
    id: 'puppet-lilith',
    name: '마리오네트 리리스',
    en: 'PUPPET LILITH',
    gender: 'F',
    title: '거대한 기괴 인형을 조종하는 듀얼 캐릭터',
    style: '원격 잡기 · 듀얼 조종',
    color: '#ff4a7a',
    glow: '#ffd0e0',
    fx: 'puppet',
    palette: {
      skin: '#f8e0d8',
      hair: '#f2f2ff',
      top: '#1a1020',
      bottom: '#3a0a20',
      accent: '#ff4a7a',
      trim: '#f2f2ff',
      eye: '#ff4a7a',
      shoe: '#1a1020',
    },
    body: 'slim',
    scale: 0.94,
    hair: 'twinTails',
    weapon: 'strings',
    back: 'puppet',
    stats: {
      hp: 1000,
      walk: 2.9,
      jumpVy: 14.2,
      jumpVx: 4,
      power: 1,
      speed: 1,
      reach: 1.5,
      defense: 1,
    },
    normals: {
      punch: { name: '인형 할퀴기' },
      kick: { name: '인형 박치기', damage: 72 },
      cKick: { name: '실 걸기', slow: 50 },
    },
    sp1: {
      name: '인형의 손',
      anim: 'throw',
      fx: 'puppet',
      startup: 15,
      active: 6,
      recovery: 24,
      damage: 110,
      grab: true,
      level: 'unblockable',
      push: -12,
      hitstun: 30,
      slow: 120,
      box: { x: 200, y: 92, w: 260, h: 80 },
    },
    sp2: {
      name: '꼭두각시 무도회',
      anim: 'cast',
      fx: 'puppet',
      startup: 7,
      active: 16,
      recovery: 22,
      damage: 100,
      hits: 3,
      interval: 5,
      invul: 7,
      launch: 11,
      knockdown: true,
      box: { x: 60, y: 160, w: 150, h: 150 },
    },
    superArt: {
      name: '커튼 콜',
      anim: 'super',
      fx: 'puppet',
      startup: 12,
      active: 30,
      recovery: 30,
      projectile: proj({
        fx: 'puppet',
        sky: true,
        aim: true,
        x: 0,
        y: 0,
        vx: 0,
        vy: -14,
        w: 230,
        h: 270,
        life: 50,
        delay: 8,
        damage: 320,
        hits: 4,
        interval: 6,
        pierce: true,
        knockdown: true,
        launch: 10,
      }),
    },
    quote: '내 인형이 당신을 마음에 들어 해. 새 친구가 되어 줄래?',
  },
  {
    id: 'neon-valkyrie',
    name: '네온 발키리',
    en: 'NEON VALKYRIE',
    gender: 'F',
    title: '천사 날개에서 레이저 포격을 쏟아붓는 사이버 여전사',
    style: '공중 포격 · 대공',
    color: '#3affb0',
    glow: '#e8fff6',
    fx: 'light',
    palette: {
      skin: '#f0d0b8',
      hair: '#ffe8a0',
      top: '#e8f0f8',
      bottom: '#2a3a4a',
      accent: '#3affb0',
      trim: '#7a8aa0',
      eye: '#3affb0',
      shoe: '#e8f0f8',
    },
    body: 'slim',
    scale: 1,
    hair: 'helmet',
    weapon: 'lance',
    back: 'wings',
    stats: {
      hp: 990,
      walk: 3.6,
      jumpVy: 15.4,
      jumpVx: 4.6,
      power: 1,
      speed: 0,
      reach: 1.1,
      defense: 1,
    },
    normals: {
      punch: { name: '랜스 찌르기', anim: 'rush', damage: 42 },
      aKick: { name: '랜스 낙하', damage: 72, box: { x: 30, y: 20, w: 70, h: 70 } },
    },
    sp1: {
      name: '윙 레이저 (공중 가능)',
      anim: 'cast',
      fx: 'light',
      startup: 12,
      active: 8,
      recovery: 20,
      airOk: true,
      projectile: proj({
        fx: 'light',
        x: 40,
        y: 120,
        vx: 15,
        w: 84,
        h: 18,
        damage: 40,
        count: 2,
        gap: 6,
        hitstun: 16,
      }),
    },
    sp2: {
      name: '발키리 어센션',
      anim: 'upper',
      fx: 'light',
      startup: 4,
      active: 14,
      recovery: 24,
      damage: 105,
      invul: 8,
      selfVy: 14,
      selfVx: 5,
      launch: 12,
      knockdown: true,
      box: { x: 40, y: 120, w: 80, h: 130 },
    },
    superArt: {
      name: '오비탈 저지먼트',
      anim: 'super',
      fx: 'light',
      startup: 10,
      active: 6,
      recovery: 30,
      projectile: proj({
        fx: 'light',
        look: 'orbital',
        atOpp: true,
        x: 0,
        y: 300,
        vx: 0,
        w: 96,
        h: 600,
        life: 100,
        delay: 22,
        trackX: 2.6,
        damage: 330,
        hits: 10,
        interval: 7,
        pierce: true,
        knockdown: true,
        launch: 9,
        hitstun: 22,
      }),
    },
    quote: '전장의 심판은 끝났다. 발할라는 아직 너를 원하지 않아.',
  },
  {
    id: 'scarlet-whip',
    name: '스칼렛 윕',
    en: 'SCARLET WHIP',
    gender: 'F',
    title: '채찍과 장미 가시 탄막을 다루는 가시 여왕',
    style: '초장거리 · 가시 덩굴',
    color: '#ff2a4a',
    glow: '#ffb0c0',
    fx: 'rose',
    palette: {
      skin: '#f2d4c4',
      hair: '#a8102a',
      top: '#1a0a12',
      bottom: '#6a0a1a',
      accent: '#ff2a4a',
      trim: '#2a8a3a',
      eye: '#ff2a4a',
      shoe: '#1a0a12',
    },
    body: 'slim',
    scale: 1,
    hair: 'longRose',
    weapon: 'whip',
    back: 'thorns',
    stats: {
      hp: 980,
      walk: 3.2,
      jumpVy: 14.4,
      jumpVx: 4.2,
      power: 0.95,
      speed: 0,
      reach: 1.6,
      defense: 1,
    },
    normals: {
      punch: { name: '채찍 스냅', damage: 36 },
      kick: { name: '하이힐 킥' },
      cKick: { name: '발목 휘감기', slow: 40 },
    },
    sp1: {
      name: '가시 덩굴',
      anim: 'cast',
      fx: 'rose',
      startup: 12,
      active: 20,
      recovery: 22,
      projectile: proj({
        fx: 'rose',
        x: 70,
        y: 46,
        vx: 0,
        w: 50,
        h: 92,
        life: 22,
        delay: 5,
        step: 72,
        damage: 40,
        count: 4,
        gap: 5,
        pierce: true,
        launch: 5,
        dot: 20,
      }),
    },
    sp2: {
      name: '스칼렛 크랙',
      anim: 'beam',
      fx: 'rose',
      startup: 13,
      active: 5,
      recovery: 24,
      damage: 95,
      level: 'low',
      knockdown: true,
      box: { x: 220, y: 20, w: 380, h: 34 },
    },
    superArt: {
      name: '로즈 프리즌',
      anim: 'cast',
      fx: 'rose',
      startup: 10,
      active: 6,
      recovery: 30,
      projectile: proj({
        fx: 'rose',
        look: 'cage',
        atOpp: true,
        x: 0,
        y: 100,
        vx: 0,
        w: 140,
        h: 200,
        life: 64,
        delay: 16,
        freeze: 12,
        damage: 310,
        hits: 6,
        interval: 7,
        pierce: true,
        knockdown: true,
        launch: 11,
        slow: 200,
        dot: 60,
      }),
    },
    quote: '아름다운 장미에는 가시가 있는 법. 몰랐니?',
  },
  {
    id: 'chainsaw-bella',
    name: '체인소 벨라',
    en: 'CHAINSAW BELLA',
    gender: 'F',
    title: '전기톱과 고속 회전 톱날을 휘두르는 고스룩 소녀',
    style: '다단히트 · 부메랑 · 아머',
    color: '#ff8a1a',
    glow: '#ffe0a0',
    fx: 'saw',
    palette: {
      skin: '#f8e4dc',
      hair: '#141018',
      top: '#141018',
      bottom: '#4a1030',
      accent: '#ff8a1a',
      trim: '#e8e8f0',
      eye: '#ff4a8a',
      shoe: '#141018',
    },
    body: 'slim',
    scale: 0.92,
    hair: 'bob',
    weapon: 'chainsaw',
    back: 'none',
    stats: {
      hp: 960,
      walk: 3.3,
      jumpVy: 14.4,
      jumpVx: 4.2,
      power: 1.05,
      speed: 1,
      reach: 1.05,
      defense: 1,
    },
    normals: {
      punch: { name: '톱날 긋기', hits: 2, interval: 3, damage: 44 },
      kick: { name: '부츠 스탬프', anim: 'stomp', damage: 72 },
      cPunch: { name: '하단 톱질', hits: 2, interval: 3 },
    },
    sp1: {
      name: '부메랑 톱날',
      anim: 'throw',
      fx: 'saw',
      startup: 13,
      active: 2,
      recovery: 24,
      projectile: proj({
        fx: 'saw',
        y: 76,
        vx: 10,
        w: 52,
        h: 52,
        life: 76,
        boomerang: true,
        pierce: true,
        damage: 104,
        hits: 4,
        interval: 8,
        hitstun: 14,
      }),
    },
    sp2: {
      name: '그라인드 어퍼',
      anim: 'upper',
      fx: 'saw',
      startup: 7,
      active: 14,
      recovery: 24,
      damage: 130,
      hits: 5,
      interval: 3,
      armor: 1,
      selfVy: 10,
      selfVx: 3,
      launch: 11,
      knockdown: true,
      box: { x: 36, y: 120, w: 80, h: 130 },
    },
    superArt: {
      name: '메가 버즈소',
      anim: 'throw',
      fx: 'saw',
      startup: 10,
      active: 4,
      recovery: 30,
      armor: 2,
      projectile: proj({
        fx: 'saw',
        look: 'buzzsaw',
        x: 70,
        y: 84,
        vx: 9,
        w: 136,
        h: 136,
        life: 110,
        boomerang: true,
        pierce: true,
        damage: 340,
        hits: 14,
        interval: 5,
        hitstun: 18,
        knockdown: true,
        launch: 9,
      }),
    },
    quote: '부릉부릉~ 다음엔 좀 더 단단한 장난감을 가져와.',
  },
  {
    id: 'arcane-spectre',
    name: '아케인 스펙터',
    en: 'ARCANE SPECTRE',
    gender: 'F',
    title: '유령 모자를 쓴 사악한 마법 소녀',
    style: '유도 · 소환 · 영혼 흡수',
    color: '#4affe0',
    glow: '#b0fff2',
    fx: 'ghost',
    palette: {
      skin: '#e0e8f0',
      hair: '#3a2a6a',
      top: '#2a1a4a',
      bottom: '#1a1030',
      accent: '#4affe0',
      trim: '#ffd84a',
      eye: '#4affe0',
      shoe: '#1a1030',
    },
    body: 'slim',
    scale: 0.96,
    hair: 'witchHat',
    weapon: 'staff',
    back: 'ghostCape',
    stats: {
      hp: 980,
      walk: 3.1,
      jumpVy: 14.6,
      jumpVx: 4.2,
      power: 0.95,
      speed: 0,
      reach: 1.1,
      defense: 1,
    },
    normals: {
      punch: { name: '지팡이 찌르기' },
      kick: { name: '유령 발차기', fx: 'ghost' },
      cPunch: { name: '혼불 튕기기', slow: 30 },
    },
    sp1: {
      name: '유령 구체 (공중 가능)',
      anim: 'cast',
      fx: 'ghost',
      startup: 12,
      active: 2,
      recovery: 22,
      airOk: true,
      projectile: proj({
        fx: 'ghost',
        y: 110,
        vx: 4.5,
        w: 46,
        h: 46,
        life: 130,
        homing: 0.28,
        damage: 80,
        hits: 2,
        interval: 10,
      }),
    },
    sp2: {
      name: '망령의 손아귀',
      anim: 'cast',
      fx: 'ghost',
      startup: 10,
      active: 4,
      recovery: 26,
      projectile: proj({
        fx: 'ghost',
        x: 230,
        y: 80,
        vx: 0,
        w: 86,
        h: 160,
        life: 26,
        delay: 12,
        damage: 100,
        launch: 11,
        knockdown: true,
        pierce: true,
        slow: 120,
      }),
    },
    superArt: {
      name: '스펙트럴 레퀴엠',
      anim: 'beam',
      fx: 'ghost',
      startup: 12,
      active: 32,
      recovery: 30,
      damage: 300,
      hits: 10,
      interval: 3,
      drain: 0.35,
      knockdown: true,
      box: { x: 460, y: 100, w: 900, h: 96 },
    },
    quote: '후후… 네 그림자는 오늘부터 내 컬렉션이야.',
  },
  {
    id: 'gunslinger-rose',
    name: '건슬링어 로즈',
    en: 'GUNSLINGER ROSE',
    gender: 'F',
    title: '쌍권총과 산탄총을 고속 사격하는 바운티 헌터',
    style: '원거리 속사 · 구르기',
    color: '#ffb02a',
    glow: '#fff0b0',
    fx: 'bullet',
    palette: {
      skin: '#e8b890',
      hair: '#c8401a',
      top: '#6a3a1a',
      bottom: '#2a3a5a',
      accent: '#ffb02a',
      trim: '#e8d8b0',
      eye: '#2ae0a0',
      shoe: '#4a2a14',
    },
    body: 'slim',
    scale: 1,
    hair: 'cowboy',
    weapon: 'pistols',
    back: 'poncho',
    stats: {
      hp: 970,
      walk: 3.6,
      jumpVy: 14.6,
      jumpVx: 4.4,
      power: 0.95,
      speed: -1,
      reach: 1,
      defense: 1,
    },
    normals: {
      punch: {
        name: '권총 사격',
        anim: 'shoot',
        damage: 0,
        box: null,
        projectile: proj({
          fx: 'bullet',
          x: 52,
          y: 112,
          vx: 20,
          w: 22,
          h: 10,
          life: 13,
          damage: 32,
          hitstun: 15,
          blockstun: 10,
          push: 3,
        }),
      },
      kick: { name: '박차 킥' },
    },
    sp1: {
      name: '퀵 드로우 (공중 가능)',
      anim: 'shoot',
      fx: 'bullet',
      startup: 9,
      active: 10,
      recovery: 18,
      airOk: true,
      projectile: proj({
        fx: 'bullet',
        x: 60,
        y: 108,
        vx: 22,
        w: 28,
        h: 12,
        damage: 54,
        count: 3,
        gap: 4,
        hitstun: 14,
        push: 3,
      }),
    },
    sp2: {
      name: '컴뱃 롤 샷건',
      anim: 'shoot',
      fx: 'bullet',
      startup: 14,
      active: 4,
      recovery: 24,
      damage: 115,
      startVx: 9,
      invul: 11,
      knockdown: true,
      push: 10,
      hitstop: 12,
      box: { x: 100, y: 96, w: 150, h: 96 },
    },
    superArt: {
      name: '불릿 스톰',
      anim: 'shoot',
      fx: 'bullet',
      startup: 9,
      active: 34,
      recovery: 26,
      projectile: proj({
        fx: 'bullet',
        look: 'tracer',
        x: 60,
        y: 104,
        vx: 26,
        w: 34,
        h: 18,
        damage: 24,
        count: 15,
        gap: 2,
        fan: 0.7,
        pierce: true,
        hitstun: 20,
        push: 2,
      }),
    },
    quote: '현상금은 내 거야. 다음 수배서 가져와, 보안관.',
  },
];

/* =========================================================
 * 기본기 (주먹·발차기) — 캐릭터 능력치로 만든다
 * ========================================================= */

/** 공통 기본기에 캐릭터 고유 기본기(이름 · 동작 · 판정)를 덮어쓴다 — 판정 상자는 캐릭터 크기에 맞춘다 */
function buildNormals(c: CharacterDef): Record<NormalId, MoveDef> {
  const base = commonNormals(c);
  const over = c.normals;
  if (!over) return base;
  const s = c.scale;
  for (const id of Object.keys(over) as NormalId[]) {
    const o = over[id];
    if (!o) continue;
    const box = o.box ? { x: o.box.x * s, y: o.box.y * s, w: o.box.w * s, h: o.box.h * s } : o.box;
    base[id] = { ...base[id], ...o, ...(o.box !== undefined ? { box } : {}), id };
  }
  return base;
}

function commonNormals(c: CharacterDef): Record<NormalId, MoveDef> {
  const s = c.scale;
  const r = c.stats.reach;
  const p = c.stats.power;
  const sp = c.stats.speed;
  const fast = (n: number) => Math.max(3, n + sp);
  const base = { ...BASE_MOVE, fx: c.fx };
  return {
    punch: {
      ...base,
      id: 'punch',
      name: '주먹',
      anim: 'punch',
      startup: fast(5),
      active: 3,
      recovery: 9 + Math.max(0, sp),
      damage: Math.round(38 * p),
      box: { x: (24 + 22 * r) * s, y: 112 * s, w: 44 * r * s, h: 28 * s },
      level: 'high',
      hitstun: 15,
      blockstun: 10,
      push: 3.5,
      hitstop: 6,
      meter: 5,
      cancel: 2,
    },
    kick: {
      ...base,
      id: 'kick',
      name: '발차기',
      anim: 'kick',
      startup: fast(8),
      active: 4,
      recovery: 15 + Math.max(0, sp),
      damage: Math.round(70 * p),
      box: { x: (30 + 36 * r) * s, y: 82 * s, w: 72 * r * s, h: 36 * s },
      level: 'mid',
      hitstun: 19,
      blockstun: 13,
      push: 6,
      hitstop: 9,
      meter: 8,
      cancel: 1,
    },
    cPunch: {
      ...base,
      id: 'cPunch',
      name: '앉아 주먹',
      anim: 'cPunch',
      startup: fast(5),
      active: 3,
      recovery: 9,
      damage: Math.round(32 * p),
      box: { x: (24 + 22 * r) * s, y: 66 * s, w: 46 * r * s, h: 26 * s },
      level: 'mid',
      hitstun: 14,
      blockstun: 9,
      push: 3,
      hitstop: 6,
      meter: 4,
      cancel: 2,
    },
    cKick: {
      ...base,
      id: 'cKick',
      name: '다리 걸기',
      anim: 'cKick',
      startup: fast(9),
      active: 4,
      recovery: 20,
      damage: Math.round(62 * p),
      box: { x: (30 + 40 * r) * s, y: 14 * s, w: 80 * r * s, h: 28 * s },
      level: 'low',
      hitstun: 20,
      blockstun: 12,
      push: 4,
      knockdown: true,
      launch: 4,
      hitstop: 8,
      meter: 8,
      cancel: 1,
    },
    aPunch: {
      ...base,
      id: 'aPunch',
      name: '공중 주먹',
      anim: 'aPunch',
      startup: fast(4),
      active: 6,
      recovery: 8,
      damage: Math.round(40 * p),
      box: { x: (22 + 24 * r) * s, y: 62 * s, w: 50 * r * s, h: 42 * s },
      level: 'overhead',
      hitstun: 16,
      blockstun: 10,
      push: 3,
      hitstop: 6,
      meter: 5,
      cancel: 1,
      air: true,
    },
    aKick: {
      ...base,
      id: 'aKick',
      name: '공중 발차기',
      anim: 'aKick',
      startup: fast(6),
      active: 8,
      recovery: 10,
      damage: Math.round(62 * p),
      box: { x: (26 + 30 * r) * s, y: 34 * s, w: 64 * r * s, h: 46 * s },
      level: 'overhead',
      hitstun: 19,
      blockstun: 12,
      push: 4,
      hitstop: 8,
      meter: 7,
      cancel: 1,
      air: true,
    },
  };
}

function buildSpecial(
  c: CharacterDef,
  id: 'sp1' | 'sp2' | 'ex',
  src: CharacterDef['sp1'],
): MoveDef {
  return {
    ...BASE_MOVE,
    fx: c.fx,
    hitstun: 22,
    blockstun: 16,
    push: 6,
    hitstop: 10,
    meter: 12,
    chip: 0.12,
    damage: 90,
    ...src,
    id,
    cancel: 0,
    superLevel: 0,
  };
}

function buildSuper(c: CharacterDef, ult: boolean): MoveDef {
  const src = c.superArt;
  const m: MoveDef = {
    ...BASE_MOVE,
    fx: c.fx,
    hitstun: 26,
    blockstun: 18,
    push: 6,
    hitstop: 8,
    meter: 0,
    chip: 0.2,
    damage: 280,
    ...src,
    id: ult ? 'ult' : 'super',
    cancel: 0,
    superLevel: ult ? 3 : 1,
    // 초필살기는 발생할 때까지 무적
    invul: Math.max(src.invul ?? 0, (src.startup ?? 8) + 4),
  };
  if (!ult) return m;
  const scale = 1.6;
  return {
    ...m,
    name: `${m.name} · 얼티밋`,
    damage: Math.round(m.damage * scale),
    box: m.box ? { ...m.box, w: m.box.w * 1.2, h: m.box.h * 1.15 } : null,
    projectile: m.projectile
      ? {
          ...m.projectile,
          damage: Math.round(m.projectile.damage * scale),
          w: m.projectile.w * 1.2,
          h: m.projectile.h * 1.1,
        }
      : null,
    landProj: m.landProj
      ? { ...m.landProj, damage: Math.round(m.landProj.damage * scale), w: m.landProj.w * 1.2 }
      : null,
    install: Math.round(m.install * 1.4),
  };
}

/** 버스트 — 몸 주변을 폭발시켜 상대를 날려 보낸다 (콤보 탈출) */
const BURST_MOVE: MoveDef = {
  ...BASE_MOVE,
  id: 'burst',
  name: '버스트',
  anim: 'burst',
  fx: 'explosion',
  startup: 6,
  active: 6,
  recovery: 22,
  damage: 30,
  box: { x: 0, y: 80, w: 300, h: 260 },
  level: 'unblockable',
  launch: 12,
  knockdown: true,
  push: 9,
  hitstop: 12,
  invul: 34,
  meter: 0,
};

/** 버스트 얼티밋이 맞으면 이어지는 화면 전체 대폭발 */
export const ULT_EXPLOSION: ProjSpec = proj({
  fx: 'explosion',
  x: 0,
  y: 120,
  vx: 0,
  w: 980,
  h: 560,
  life: 44,
  delay: 10,
  damage: 140,
  level: 'unblockable',
  launch: 16,
  knockdown: true,
  pierce: true,
  push: 7,
});

export type MoveSet = Record<MoveId, MoveDef>;

/**
 * 템포 보정 — 모든 기술의 발생 · 후딜을 줄여 공방을 빠르게 한다.
 * 가드 경직도 조금 줄여 막은 쪽이 더 빨리 반격할 수 있게 한다 (피격 경직은 그대로 → 콤보 유지).
 * 초필살기 · 버스트는 컷인 연출이 있으니 발생은 그대로 두고 후딜만 줄인다.
 */
function quicken(m: MoveDef): MoveDef {
  const big = m.superLevel > 0 || m.id === 'burst';
  return {
    ...m,
    startup: big ? m.startup : Math.max(2, Math.round(m.startup * 0.8)),
    recovery: Math.max(4, Math.round(m.recovery * (big ? 0.85 : 0.76))),
    blockstun: Math.max(6, Math.round(m.blockstun * 0.88)),
  };
}

/**
 * CharacterRegistry — 캐릭터 정의와 기술표를 한곳에서 꺼내 쓴다.
 * 기술표는 처음 요청할 때 한 번만 만들어 둔다.
 */
export class CharacterRegistry {
  private static moveCache = new Map<CharId, MoveSet>();

  static readonly list: readonly CharacterDef[] = CHARACTERS;

  static get(id: CharId): CharacterDef {
    const def = CHARACTERS.find((c) => c.id === id);
    return def ?? (CHARACTERS[0] as CharacterDef);
  }

  static has(id: string): id is CharId {
    return CHARACTERS.some((c) => c.id === id);
  }

  static moves(id: CharId): MoveSet {
    const cached = this.moveCache.get(id);
    if (cached) return cached;
    const c = this.get(id);
    const raw: MoveSet = {
      ...buildNormals(c),
      sp1: buildSpecial(c, 'sp1', c.sp1),
      sp2: buildSpecial(c, 'sp2', c.sp2),
      super: buildSuper(c, false),
      ult: buildSuper(c, true),
      burst: BURST_MOVE,
      ex: buildSpecial(c, 'ex', c.followup ?? { name: '', anim: 'punch' }),
    };
    const set = Object.fromEntries(Object.entries(raw).map(([k, m]) => [k, quicken(m)])) as MoveSet;
    this.moveCache.set(id, set);
    return set;
  }
}
