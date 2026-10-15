/**
 * 심심파이터즈 — 캐릭터 겉모습 데이터 (의상 · 장갑 · 신발 · 어깨 장식)
 * 그리기에만 쓰이고 판정·능력치와는 상관없다.
 */
import type { CharId } from './characters';

export interface Look {
  /** 소매 — 긴 소매면 아래팔까지 옷 색, 반소매면 위팔만, 없으면 맨팔 */
  sleeve: 'long' | 'short' | 'none';
  /** 장갑 · 팔 보호대 색 (없으면 맨손) */
  glove: string | null;
  /** 아래팔을 덮는 비율 (0~1) */
  gloveLen: number;
  /** 하의 — 긴 바지 / 반바지 / 치마 */
  pants: 'long' | 'shorts' | 'skirt';
  /** 통 넓은 바지 (하카마) */
  wide?: boolean;
  /** 반바지·치마 아래 스타킹 색 (없으면 맨다리) */
  legwear?: string;
  /** 스타킹 줄무늬 색 */
  stripe?: string;
  boot: string;
  /** 정강이를 덮는 비율 (0~1) */
  bootLen: number;
  bootStyle: 'boot' | 'armored' | 'sneaker' | 'heel' | 'sandal';
  /** 어깨 장식 */
  pad: 'none' | 'front' | 'both';
  padColor: string;
  /** 소매 끝 · 바지 끝 장식 색 */
  cuff?: string;
}

export const LOOKS: Record<CharId, Look> = {
  solaris: {
    sleeve: 'none',
    glove: '#2a2026',
    gloveLen: 0.6,
    pants: 'long',
    boot: '#3a2a20',
    bootLen: 0.5,
    bootStyle: 'boot',
    pad: 'front',
    padColor: '#b8bcc8',
    cuff: '#ffb02e',
  },
  'shadow-crow': {
    sleeve: 'long',
    glove: '#1a1424',
    gloveLen: 0.45,
    pants: 'long',
    boot: '#120c1a',
    bootLen: 0.6,
    bootStyle: 'armored',
    pad: 'both',
    padColor: '#3a2e4a',
    cuff: '#8a5cff',
  },
  'bolt-master': {
    sleeve: 'short',
    glove: '#ffe02a',
    gloveLen: 0.55,
    pants: 'long',
    boot: '#20202a',
    bootLen: 0.35,
    bootStyle: 'sneaker',
    pad: 'front',
    padColor: '#2a3a4a',
    cuff: '#7af2ff',
  },
  'iron-giant': {
    sleeve: 'long',
    glove: null,
    gloveLen: 0,
    pants: 'long',
    boot: '#2a3038',
    bootLen: 0.45,
    bootStyle: 'armored',
    pad: 'both',
    padColor: '#6a7480',
  },
  'phantom-dj': {
    sleeve: 'long',
    glove: '#f2f2f2',
    gloveLen: 0.2,
    pants: 'long',
    boot: '#f2f2f2',
    bootLen: 0.3,
    bootStyle: 'sneaker',
    pad: 'none',
    padColor: '#ff3ad8',
    cuff: '#3affd0',
  },
  'blood-hound': {
    sleeve: 'long',
    glove: '#9a9aa4',
    gloveLen: 0.75,
    pants: 'long',
    boot: '#3a3038',
    bootLen: 0.6,
    bootStyle: 'armored',
    pad: 'both',
    padColor: '#8a8a94',
    cuff: '#e0203a',
  },
  'alchemist-z': {
    sleeve: 'long',
    glove: '#2a2a30',
    gloveLen: 0.5,
    pants: 'long',
    boot: '#2a2430',
    bootLen: 0.4,
    bootStyle: 'boot',
    pad: 'none',
    padColor: '#8a6a3a',
    cuff: '#7aff3a',
  },
  'frost-samurai': {
    sleeve: 'short',
    glove: '#1a2a40',
    gloveLen: 0.5,
    pants: 'long',
    wide: true,
    boot: '#e8f2ff',
    bootLen: 0.18,
    bootStyle: 'sandal',
    pad: 'front',
    padColor: '#1a3a6a',
    cuff: '#5ac8ff',
  },
  'violet-cat': {
    sleeve: 'none',
    glove: '#3a1a50',
    gloveLen: 0.55,
    pants: 'shorts',
    legwear: '#2a1438',
    boot: '#2a1438',
    bootLen: 0.6,
    bootStyle: 'boot',
    pad: 'none',
    padColor: '#d07aff',
    cuff: '#ff7af2',
  },
  'puppet-lilith': {
    sleeve: 'long',
    glove: '#f2f2ff',
    gloveLen: 0.35,
    pants: 'skirt',
    legwear: '#1a1020',
    stripe: '#ff4a7a',
    boot: '#1a1020',
    bootLen: 0.45,
    bootStyle: 'heel',
    pad: 'none',
    padColor: '#ff4a7a',
    cuff: '#f2f2ff',
  },
  'neon-valkyrie': {
    sleeve: 'long',
    glove: '#7a8aa0',
    gloveLen: 0.55,
    pants: 'long',
    boot: '#e8f0f8',
    bootLen: 0.65,
    bootStyle: 'armored',
    pad: 'both',
    padColor: '#e8f0f8',
    cuff: '#3affb0',
  },
  'scarlet-whip': {
    sleeve: 'none',
    glove: '#1a0a12',
    gloveLen: 0.85,
    pants: 'long',
    boot: '#1a0a12',
    bootLen: 0.65,
    bootStyle: 'heel',
    pad: 'none',
    padColor: '#ff2a4a',
    cuff: '#ff2a4a',
  },
  'chainsaw-bella': {
    sleeve: 'short',
    glove: '#141018',
    gloveLen: 0.3,
    pants: 'skirt',
    legwear: '#e8e8f0',
    stripe: '#141018',
    boot: '#141018',
    bootLen: 0.55,
    bootStyle: 'boot',
    pad: 'none',
    padColor: '#ff8a1a',
    cuff: '#ff8a1a',
  },
  'arcane-spectre': {
    sleeve: 'long',
    glove: null,
    gloveLen: 0,
    pants: 'skirt',
    legwear: '#1a1030',
    boot: '#1a1030',
    bootLen: 0.45,
    bootStyle: 'boot',
    pad: 'none',
    padColor: '#4affe0',
    cuff: '#ffd84a',
  },
  'gunslinger-rose': {
    sleeve: 'short',
    glove: '#6a3a1a',
    gloveLen: 0.4,
    pants: 'long',
    boot: '#5a3418',
    bootLen: 0.6,
    bootStyle: 'boot',
    pad: 'none',
    padColor: '#ffb02a',
    cuff: '#e8d8b0',
  },
};
