import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { GameProps } from '@simsim/shared';
import { CharacterRegistry, type CharId, type CharacterDef } from './characters';
import { CONTROLS, TIPS, inputDelayFor } from './config';
import { FightEngine, type ArcadeSummary, type OnlineResult } from './engine';
import type { InputKey } from './input';
import {
  NetworkManager_WebRTC,
  PROTOCOL_VERSION,
  type NetMessage,
  type NetStatus,
} from './network';
import { STAGES } from './render';
import { drawPortrait } from './renderFighter';
import { SoundManager } from './sound';
import styles from './SimsimFighters.module.css';

type SelectMode = 'arcade' | 'online';

type Screen =
  | { name: 'menu' }
  | { name: 'select'; mode: SelectMode }
  | { name: 'lobby' }
  | { name: 'playing'; mode: SelectMode }
  | { name: 'arcadeResult'; summary: ArcadeSummary }
  | { name: 'onlineResult'; result: OnlineResult };

const CHARS = CharacterRegistry.list;
const COLS = 5;
const BIG_KEY = 'simsim:simsim-fighters:big:v1';

function detectTouch() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  } catch {
    return false;
  }
}

function loadBig() {
  try {
    return localStorage.getItem(BIG_KEY) !== '0';
  } catch {
    return true;
  }
}

const STATUS_TEXT: Record<NetStatus, string> = {
  idle: '대기 중',
  creating: '방 코드를 만드는 중… (몇 초 걸려요)',
  'waiting-answer': '방 코드를 상대에게 보내고, 상대의 참가 코드를 붙여 넣어 주세요',
  answering: '참가 코드를 만드는 중… (몇 초 걸려요)',
  connecting: '연결하는 중… 상대가 코드를 붙여 넣으면 이어져요',
  connected: '연결 완료!',
  closed: '연결이 끊어졌어요',
  failed: '연결에 실패했어요 (네트워크가 P2P 연결을 막고 있을 수 있어요)',
};

/**
 * 심심파이터즈 — Canvas 로 그리는 2D 대전 격투 게임.
 *  - 아케이드 모드: AI 6명을 연달아 이기는 1인 플레이. 끝나면 onFinish(점수) 를 한 번 호출한다.
 *  - 온라인 대전: WebRTC DataChannel 로 친구와 1:1 (점수 등록 없음)
 * 닉네임 입력·점수 등록·랭킹은 GamePage 의 공통 결과창이 처리한다.
 */
export default function SimsimFighters({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FightEngine | null>(null);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const [sound] = useState(() => new SoundManager());
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [engineError, setEngineError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [muted, setMuted] = useState(() => sound.isMuted);
  const [touch, setTouch] = useState(detectTouch);
  const [big, setBig] = useState(loadBig);
  const [arcadeDone, setArcadeDone] = useState(false);

  // 온라인
  const netRef = useRef<NetworkManager_WebRTC | null>(null);
  const [netStatus, setNetStatus] = useState<NetStatus>('idle');
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [pasteCode, setPasteCode] = useState('');
  const [netError, setNetError] = useState('');
  const [copied, setCopied] = useState('');
  const [myReady, setMyReady] = useState(false);
  const [rival, setRival] = useState<{ char: CharId | null; ready: boolean }>({
    char: null,
    ready: false,
  });
  /** 메시지 콜백에서 최신 값을 읽기 위한 사본 */
  const live = useRef({
    myChar: 'solaris' as CharId,
    myReady: false,
    rivalChar: null as CharId | null,
    rivalReady: false,
    match: 0,
  });

  const setCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  }, []);

  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  useEffect(() => () => sound.destroy(), [sound]);

  // 엔진 만들기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: FightEngine;
    try {
      engine = new FightEngine(canvas, sound, {
        onArcadeEnd: (summary) => {
          setScreen({ name: 'arcadeResult', summary });
          setArcadeDone(true);
          // onFinish 는 한 판에 한 번만
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinishRef.current(summary.score);
          }
        },
        onOnlineEnd: (result) => {
          live.current.myReady = false;
          live.current.rivalReady = false;
          setMyReady(false);
          setRival((r) => ({ ...r, ready: false }));
          setScreen({ name: 'onlineResult', result });
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '게임을 시작하지 못했어요.';
      queueMicrotask(() => setEngineError(message));
      return;
    }
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [sound]);

  // 나갈 때 연결 정리
  useEffect(
    () => () => {
      netRef.current?.close();
      netRef.current = null;
    },
    [],
  );

  const selected = CHARS[cursor] as CharacterDef;

  /* ---------------- 화면 전환 ---------------- */

  function click() {
    sound.unlock();
    sound.play('select');
  }

  function openSelect(mode: SelectMode) {
    click();
    setScreen({ name: 'select', mode });
  }

  function moveCursor(i: number) {
    const n = (i + CHARS.length) % CHARS.length;
    setCursor(n);
    sound.play('select');
    const c = CHARS[n] as CharacterDef;
    live.current.myChar = c.id;
    engineRef.current?.preview(
      c.id,
      live.current.rivalChar ?? (CHARS[(n + 7) % CHARS.length] as CharacterDef).id,
    );
  }

  function startArcade() {
    if (finishedRef.current) return;
    sound.unlock();
    sound.play('confirm');
    engineRef.current?.startArcade(selected.id);
    setPaused(false);
    setScreen({ name: 'playing', mode: 'arcade' });
  }

  function backToMenu() {
    click();
    engineRef.current?.idle();
    setPaused(false);
    setConfirmLeave(false);
    setScreen({ name: 'menu' });
  }

  /* ---------------- 일시정지 (아케이드) ---------------- */

  function pause() {
    if (screen.name !== 'playing') return;
    if (screen.mode === 'arcade') {
      engineRef.current?.pause();
      sound.suspend();
    }
    setPaused(true);
  }

  function resume() {
    engineRef.current?.resume();
    sound.resume();
    setPaused(false);
    setConfirmLeave(false);
  }

  function toggleMute() {
    sound.unlock();
    sound.setMuted(!muted);
    setMuted(!muted);
  }

  function toggleBig() {
    const next = !big;
    setBig(next);
    try {
      localStorage.setItem(BIG_KEY, next ? '1' : '0');
    } catch {
      // 저장 실패는 무시
    }
  }

  /* ---------------- 온라인 ---------------- */

  const handleMessage = useCallback((m: NetMessage) => {
    const net = netRef.current;
    if (!net) return;
    switch (m.t) {
      case 'hello':
        if (m.v !== PROTOCOL_VERSION)
          setNetError('상대와 게임 버전이 달라요. 둘 다 페이지를 새로 고쳐 주세요.');
        break;
      case 'pick':
        live.current.rivalChar = m.char;
        live.current.rivalReady = m.ready;
        setRival({ char: m.char, ready: m.ready });
        if (net.role === 'host') tryHostStart();
        break;
      case 'start':
        if (net.role !== 'guest') break;
        live.current.match = m.match;
        engineRef.current?.startOnline(net, 1, m.p1, m.p2, m.stage, m.match, m.delay);
        setPaused(false);
        setScreen({ name: 'playing', mode: 'online' });
        break;
      default:
        break;
    }
    // tryHostStart 는 ref 와 setter 만 쓰므로 처음 만든 콜백을 계속 써도 된다
  }, []);

  /** 방장 — 둘 다 준비되면 경기 시작 */
  function tryHostStart() {
    const net = netRef.current;
    const l = live.current;
    if (!net || net.role !== 'host' || !l.myReady || !l.rivalReady || !l.rivalChar) return;
    l.match += 1;
    const stage = Math.floor(Math.random() * STAGES.length);
    // 지금 핑에 맞춰 입력 지연을 정하고 상대에게도 알려 준다
    const delay = inputDelayFor(net.ping);
    net.send({ t: 'start', p1: l.myChar, p2: l.rivalChar, stage, match: l.match, delay });
    engineRef.current?.startOnline(net, 0, l.myChar, l.rivalChar, stage, l.match, delay);
    setPaused(false);
    setScreen({ name: 'playing', mode: 'online' });
  }

  function newNet(r: 'host' | 'guest') {
    netRef.current?.close();
    let net: NetworkManager_WebRTC;
    try {
      net = new NetworkManager_WebRTC(r);
    } catch (err) {
      setNetError(err instanceof Error ? err.message : '연결을 준비하지 못했어요.');
      return null;
    }
    netRef.current = net;
    setRole(r);
    setNetError('');
    setRoomCode('');
    setAnswerCode('');
    setPasteCode('');
    setCopied('');
    live.current = {
      ...live.current,
      myReady: false,
      rivalChar: null,
      rivalReady: false,
      match: 0,
    };
    setMyReady(false);
    setRival({ char: null, ready: false });
    net.onMessage(handleMessage);
    net.onStatus((s) => {
      if (netRef.current !== net) return;
      setNetStatus(s);
      if (s === 'connected') {
        sound.play('confirm');
        setScreen({ name: 'select', mode: 'online' });
        net.send({ t: 'pick', char: live.current.myChar, ready: false });
      }
    });
    setNetStatus(net.status);
    return net;
  }

  async function createRoom() {
    click();
    const net = newNet('host');
    if (!net) return;
    try {
      const code = await net.createRoom();
      if (netRef.current === net) setRoomCode(code);
    } catch (err) {
      setNetError(err instanceof Error ? err.message : '방 코드를 만들지 못했어요.');
    }
  }

  async function acceptAnswer() {
    click();
    const net = netRef.current;
    if (!net || net.role !== 'host') return;
    try {
      await net.acceptAnswer(pasteCode);
      setNetError('');
    } catch (err) {
      setNetError(err instanceof Error ? err.message : '참가 코드를 읽지 못했어요.');
    }
  }

  async function joinRoom() {
    click();
    const net = newNet('guest');
    if (!net) return;
    try {
      const code = await net.joinRoom(pasteCode);
      if (netRef.current === net) {
        setAnswerCode(code);
        setPasteCode('');
      }
    } catch (err) {
      setNetError(err instanceof Error ? err.message : '방 코드를 읽지 못했어요.');
    }
  }

  function leaveOnline() {
    click();
    netRef.current?.close();
    netRef.current = null;
    setRole(null);
    setNetStatus('idle');
    setRoomCode('');
    setAnswerCode('');
    setPasteCode('');
    engineRef.current?.idle();
    setPaused(false);
    setConfirmLeave(false);
    setScreen({ name: 'menu' });
  }

  function toggleReady() {
    const net = netRef.current;
    if (!net || net.status !== 'connected') return;
    const next = !myReady;
    sound.unlock();
    sound.play(next ? 'confirm' : 'select');
    live.current.myReady = next;
    live.current.myChar = selected.id;
    setMyReady(next);
    net.send({ t: 'pick', char: selected.id, ready: next });
    if (next) tryHostStart();
  }

  function pickOnline(i: number) {
    if (myReady) return;
    moveCursor(i);
    const c = CHARS[(i + CHARS.length) % CHARS.length] as CharacterDef;
    netRef.current?.send({ t: 'pick', char: c.id, ready: false });
  }

  function rematch() {
    click();
    engineRef.current?.idle();
    setScreen({ name: 'select', mode: 'online' });
    netRef.current?.send({ t: 'pick', char: live.current.myChar, ready: false });
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied('');
      setNetError('복사하지 못했어요. 코드 칸을 눌러 직접 복사해 주세요.');
    }
  }

  function pad(key: InputKey, down: boolean) {
    engineRef.current?.setVirtual(key, down);
  }

  /* ---------------- 키보드 ---------------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (screen.name === 'select') {
        const online = screen.mode === 'online';
        const go = (n: number) => (online ? pickOnline(n) : moveCursor(n));
        if (e.key === 'ArrowRight') go(cursor + 1);
        else if (e.key === 'ArrowLeft') go(cursor - 1);
        else if (e.key === 'ArrowDown') go(cursor + COLS);
        else if (e.key === 'ArrowUp') go(cursor - COLS);
        else if (e.key === 'Enter') {
          if (online) toggleReady();
          else startArcade();
        } else if (e.key === 'Escape') {
          if (online) leaveOnline();
          else backToMenu();
        } else return;
        e.preventDefault();
      } else if (
        screen.name === 'playing' &&
        !e.repeat &&
        (e.code === 'Escape' || e.code === 'KeyP')
      ) {
        e.preventDefault();
        if (confirmLeave) setConfirmLeave(false);
        else if (paused) resume();
        else pause();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // 다른 탭·창으로 가면 아케이드는 자동 일시정지
  useEffect(() => {
    if (screen.name !== 'playing' || screen.mode !== 'arcade' || paused) return;
    function onVisibility() {
      if (document.visibilityState === 'hidden') pause();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', pause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', pause);
    };
  });

  const playing = screen.name === 'playing';
  const bigOn = big && playing;

  useEffect(() => {
    if (!bigOn) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [bigOn]);

  const grow = !playing && !engineError;

  /* ---------------- 화면 ---------------- */

  const stageEl = (
    <div className={`${styles.stage} ${grow ? styles.stageGrow : ''}`}>
      <canvas ref={setCanvas} className={styles.canvas} aria-label="심심파이터즈 게임 화면" />

      {playing && (
        <div className={styles.topButtons}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={(e) => {
              e.currentTarget.blur();
              toggleMute();
            }}
            aria-label={muted ? '소리 켜기' : '소리 끄기'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={(e) => {
              e.currentTarget.blur();
              pause();
            }}
            aria-label="설정"
          >
            ⚙
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={(e) => {
              e.currentTarget.blur();
              toggleBig();
            }}
            aria-label={big ? '작게 보기' : '크게 보기'}
          >
            {big ? '🗗' : '⛶'}
          </button>
        </div>
      )}

      {engineError && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <p>{engineError}</p>
          </div>
        </div>
      )}

      {screen.name === 'menu' && !engineError && (
        <div className={styles.overlay}>
          <div className={`${styles.panel} ${styles.menuPanel}`}>
            <h2 className={styles.logo}>
              SIMSIM <span>FIGHTERS</span>
            </h2>
            <p className={styles.subtitle}>
              심심파이터즈 — 15인의 파이터, 텐션 게이지, 초필살기 컷인! 한 판 붙자!
            </p>
            <div className={styles.modeList}>
              <button
                type="button"
                className={styles.modeBtn}
                onClick={() => openSelect('arcade')}
                disabled={arcadeDone}
              >
                <strong>🕹 아케이드 모드</strong>
                <span>
                  {arcadeDone
                    ? '이번 판은 끝났어요 — 결과창에서 다시 하기'
                    : 'AI 6명을 연달아 쓰러뜨려라 · 랭킹 등록'}
                </span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${styles.modeOnline}`}
                onClick={() => {
                  click();
                  setScreen({ name: 'lobby' });
                }}
              >
                <strong>🌐 온라인 대전</strong>
                <span>방을 만들고 친구와 실시간 1:1 (WebRTC)</span>
              </button>
            </div>
            <div className={styles.howtoGrid}>
              <ul className={styles.controls}>
                {CONTROLS.map((c) => (
                  <li key={c.keys}>
                    <kbd>{c.keys}</kbd>
                    <span>{c.action}</span>
                  </li>
                ))}
              </ul>
              <ul className={styles.tips}>
                {TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
            <label className={styles.touchToggle}>
              <input type="checkbox" checked={touch} onChange={(e) => setTouch(e.target.checked)} />
              화면 터치 버튼 보이기
            </label>
          </div>
        </div>
      )}

      {screen.name === 'select' && (
        <div className={styles.overlay}>
          <div className={`${styles.panel} ${styles.selectPanel}`}>
            <h2 className={styles.panelTitle}>
              {screen.mode === 'arcade'
                ? '🕹 캐릭터 선택 — 아케이드'
                : '🌐 캐릭터 선택 — 온라인 대전'}
            </h2>
            <div className={styles.selectBody}>
              <div className={styles.charGrid} role="list" aria-label="캐릭터 15종">
                {CHARS.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    role="listitem"
                    className={`${styles.charCard} ${cursor === i ? styles.charCardOn : ''} ${rival.char === c.id && screen.mode === 'online' ? styles.charCardRival : ''}`}
                    style={{ ['--char-color' as string]: c.color }}
                    onClick={() => (screen.mode === 'online' ? pickOnline(i) : moveCursor(i))}
                    onDoubleClick={() => (screen.mode === 'arcade' ? startArcade() : undefined)}
                    aria-label={c.name}
                  >
                    <CharPortrait def={c} active={cursor === i} />
                    <span className={styles.charName}>{c.name}</span>
                    <span className={styles.charGender}>{c.gender === 'M' ? '♂' : '♀'}</span>
                  </button>
                ))}
              </div>
              <div
                className={styles.charInfo}
                style={{ ['--char-color' as string]: selected.color }}
              >
                <p className={styles.charEn}>{selected.en}</p>
                <h3 className={styles.charTitle}>{selected.name}</h3>
                <p className={styles.charDesc}>{selected.title}</p>
                <p className={styles.charStyle}>{selected.style}</p>
                <StatBars def={selected} />
                <dl className={styles.moveList}>
                  <dt>↓→ + A</dt>
                  <dd>{selected.sp1.name}</dd>
                  <dt>↓→ + S</dt>
                  <dd>{selected.sp2.name}</dd>
                  <dt>F</dt>
                  <dd>{selected.superArt.name}</dd>
                </dl>
              </div>
            </div>

            {screen.mode === 'arcade' ? (
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.startBtn}
                  onClick={startArcade}
                  disabled={arcadeDone}
                >
                  ⚔ {selected.name}(으)로 출격
                </button>
                <button type="button" className={styles.subBtn} onClick={backToMenu}>
                  뒤로
                </button>
              </div>
            ) : (
              <>
                <p className={styles.rivalLine}>
                  상대:{' '}
                  {rival.char ? (
                    <strong>
                      {CharacterRegistry.get(rival.char).name}{' '}
                      {rival.ready ? '✅ 준비 완료' : '— 고르는 중…'}
                    </strong>
                  ) : (
                    '고르는 중…'
                  )}
                  {role === 'host' ? ' · 둘 다 준비되면 바로 시작해요' : ' · 방장이 시작해요'}
                </p>
                <div className={styles.row}>
                  <button
                    type="button"
                    className={myReady ? styles.subBtn : styles.startBtn}
                    onClick={toggleReady}
                    disabled={netStatus !== 'connected'}
                  >
                    {myReady ? '준비 취소' : `✅ ${selected.name} 준비 완료`}
                  </button>
                  <button type="button" className={styles.dangerBtn} onClick={leaveOnline}>
                    연결 끊고 나가기
                  </button>
                </div>
                {netStatus !== 'connected' && (
                  <p className={styles.error}>{STATUS_TEXT[netStatus]}</p>
                )}
              </>
            )}
            <p className={styles.hint}>방향키로 고르고 Enter · 캐릭터를 두 번 누르면 바로 시작</p>
          </div>
        </div>
      )}

      {screen.name === 'lobby' && (
        <div className={styles.overlay}>
          <div className={`${styles.panel} ${styles.lobbyPanel}`}>
            <h2 className={styles.panelTitle}>🌐 온라인 대전</h2>
            <p className={styles.panelText}>
              게임 서버 없이 두 브라우저를 직접 연결해요 (WebRTC). 아래 코드를 메신저로 주고받으면
              연결돼요.
            </p>
            <div className={styles.lobbyCols}>
              <section className={`${styles.lobbyBox} ${role === 'host' ? styles.lobbyBoxOn : ''}`}>
                <h3>① 방 만들기 (방장)</h3>
                <button
                  type="button"
                  className={styles.startBtn}
                  onClick={createRoom}
                  disabled={netStatus === 'creating'}
                >
                  🏠 방 코드 만들기
                </button>
                {role === 'host' && roomCode && (
                  <>
                    <label className={styles.codeLabel}>
                      방 코드 — 상대에게 보내 주세요
                      <textarea
                        className={styles.code}
                        readOnly
                        value={roomCode}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.subBtn}
                      onClick={() => copy(roomCode, 'room')}
                    >
                      {copied === 'room' ? '✔ 복사됨' : '📋 방 코드 복사'}
                    </button>
                    <label className={styles.codeLabel}>
                      상대가 보낸 참가 코드 붙여넣기
                      <textarea
                        className={styles.code}
                        value={pasteCode}
                        onChange={(e) => setPasteCode(e.target.value)}
                        placeholder="SF1.…"
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.startBtn}
                      onClick={acceptAnswer}
                      disabled={!pasteCode.trim()}
                    >
                      🔗 연결하기
                    </button>
                  </>
                )}
              </section>
              <section
                className={`${styles.lobbyBox} ${role === 'guest' ? styles.lobbyBoxOn : ''}`}
              >
                <h3>② 방 참가하기</h3>
                {!(role === 'guest' && answerCode) ? (
                  <>
                    <label className={styles.codeLabel}>
                      방장이 보낸 방 코드 붙여넣기
                      <textarea
                        className={styles.code}
                        value={role === 'host' ? '' : pasteCode}
                        onChange={(e) => {
                          if (role === 'host') {
                            netRef.current?.close();
                            netRef.current = null;
                            setRole(null);
                            setRoomCode('');
                          }
                          setPasteCode(e.target.value);
                        }}
                        placeholder="SF1.…"
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.startBtn}
                      onClick={joinRoom}
                      disabled={!pasteCode.trim() || role === 'host'}
                    >
                      🚪 참가 코드 만들기
                    </button>
                  </>
                ) : (
                  <>
                    <label className={styles.codeLabel}>
                      참가 코드 — 방장에게 보내 주세요
                      <textarea
                        className={styles.code}
                        readOnly
                        value={answerCode}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.subBtn}
                      onClick={() => copy(answerCode, 'answer')}
                    >
                      {copied === 'answer' ? '✔ 복사됨' : '📋 참가 코드 복사'}
                    </button>
                    <p className={styles.hint}>방장이 이 코드를 붙여 넣으면 자동으로 연결돼요</p>
                  </>
                )}
              </section>
            </div>
            {role && <p className={styles.status}>상태: {STATUS_TEXT[netStatus]}</p>}
            {netError && <p className={styles.error}>{netError}</p>}
            <p className={styles.hint}>
              같은 와이파이·일반 가정용 인터넷에서 잘 연결돼요. 회사·학교처럼 막힌 네트워크에서는
              연결되지 않을 수 있어요.
            </p>
            <button type="button" className={styles.subBtn} onClick={leaveOnline}>
              뒤로
            </button>
          </div>
        </div>
      )}

      {playing && paused && (
        <div className={styles.overlay}>
          <div className={`${styles.panel} ${styles.compact}`}>
            {confirmLeave ? (
              <>
                <h2 className={styles.panelTitle}>
                  {screen.mode === 'online' ? '대전에서 나갈까요?' : '게임 홈으로 갈까요?'}
                </h2>
                <p className={styles.panelText}>
                  {screen.mode === 'online'
                    ? '연결이 끊어지고 상대에게도 알려져요.'
                    : '지금 판은 저장되지 않고, 점수도 랭킹에 등록되지 않아요.'}
                </p>
                <div className={styles.row}>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={screen.mode === 'online' ? leaveOnline : backToMenu}
                  >
                    나가기
                  </button>
                  <button
                    type="button"
                    className={styles.subBtn}
                    onClick={() => setConfirmLeave(false)}
                  >
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.panelTitle}>
                  ⚙ {screen.mode === 'online' ? '설정' : '일시정지'}
                </h2>
                {screen.mode === 'online' && (
                  <p className={styles.panelText}>온라인 대전은 멈추지 않아요!</p>
                )}
                <div className={styles.menuList}>
                  <button type="button" className={styles.startBtn} onClick={resume}>
                    ▶ 계속하기
                  </button>
                  <button type="button" className={styles.subBtn} onClick={toggleMute}>
                    {muted ? '🔇 소리 켜기' : '🔊 소리 끄기'}
                  </button>
                  <button type="button" className={styles.subBtn} onClick={() => setTouch(!touch)}>
                    {touch ? '🎮 터치 버튼 숨기기' : '🎮 터치 버튼 보이기'}
                  </button>
                  <button
                    type="button"
                    className={styles.subBtn}
                    onClick={() => setConfirmLeave(true)}
                  >
                    {screen.mode === 'online' ? '🚪 대전 나가기' : '🏠 게임 홈으로'}
                  </button>
                </div>
                <p className={styles.hint}>Esc 또는 P 로도 닫을 수 있어요</p>
              </>
            )}
          </div>
        </div>
      )}

      {screen.name === 'arcadeResult' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              {screen.summary.victory ? '🏆 ALL CLEAR!' : '💀 GAME OVER'}
            </h2>
            <p className={styles.bigScore}>{screen.summary.score.toLocaleString()}점</p>
            <dl className={styles.summary}>
              <dt>사용 캐릭터</dt>
              <dd>{CharacterRegistry.get(screen.summary.charId).name}</dd>
              <dt>이긴 상대</dt>
              <dd>{screen.summary.stagesCleared}명</dd>
              <dt>준 피해</dt>
              <dd>{screen.summary.totalDamage.toLocaleString()}</dd>
              <dt>최대 콤보</dt>
              <dd>{screen.summary.maxCombo}</dd>
              <dt>퍼펙트</dt>
              <dd>{screen.summary.perfects}회</dd>
              <dt>초필살기</dt>
              <dd>{screen.summary.supers}회</dd>
            </dl>
            <dl className={styles.breakdown}>
              {screen.summary.breakdown.map((b) => (
                <div key={b.label} className={styles.breakdownRow}>
                  <dt>{b.label}</dt>
                  <dd>+{b.value.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.hint}>결과창에서 닉네임을 입력하면 랭킹에 등록돼요</p>
            <button type="button" className={styles.subBtn} onClick={backToMenu}>
              게임 홈으로 (온라인 대전은 계속 할 수 있어요)
            </button>
          </div>
        </div>
      )}

      {screen.name === 'onlineResult' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>
              {screen.result.disconnected
                ? '🔌 연결 끊김'
                : screen.result.draw
                  ? '🤝 DRAW'
                  : screen.result.youWon
                    ? '🏆 YOU WIN!'
                    : '💥 YOU LOSE'}
            </h2>
            <p className={styles.panelText}>
              {CharacterRegistry.get(screen.result.you).name} vs{' '}
              {CharacterRegistry.get(screen.result.rival).name}
            </p>
            <p className={styles.hint}>온라인 대전은 랭킹에 등록되지 않는 친선전이에요</p>
            <div className={styles.row}>
              {!screen.result.disconnected && netStatus === 'connected' && (
                <button type="button" className={styles.startBtn} onClick={rematch}>
                  🔁 재대결 (캐릭터 다시 고르기)
                </button>
              )}
              <button type="button" className={styles.subBtn} onClick={leaveOnline}>
                {netStatus === 'connected' ? '연결 끊고 나가기' : '게임 홈으로'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const padEl = playing && touch && !paused && <TouchPad onPad={pad} />;

  return (
    <div className={styles.root}>
      {bigOn ? (
        createPortal(
          <div className={`${styles.bigWrap} ${touch ? styles.bigTouch : ''}`}>
            {stageEl}
            {padEl}
          </div>,
          document.body,
        )
      ) : (
        <>
          {stageEl}
          {padEl}
        </>
      )}
      {bigOn && (
        <div className={styles.bigPlaceholder}>🥊 크게 보기로 플레이 중이에요 (🗗 로 작게 보기)</div>
      )}
    </div>
  );
}

/** 능력치 막대 */
function StatBars({ def }: { def: CharacterDef }) {
  const s = def.stats;
  const rows: [string, number][] = [
    ['체력', (s.hp - 880) / 320],
    ['공격', (s.power - 0.85) / 0.45],
    ['속도', (s.walk - 2.2) / 2.4],
    ['리치', (s.reach - 0.85) / 0.8],
  ];
  return (
    <ul className={styles.stats}>
      {rows.map(([label, v]) => (
        <li key={label}>
          <span>{label}</span>
          <i style={{ width: `${Math.round(Math.max(0.12, Math.min(1, v)) * 100)}%` }} />
        </li>
      ))}
    </ul>
  );
}

/** 캐릭터 선택 카드 — 고른 캐릭터만 움직인다 */
function CharPortrait({ def, active }: { def: CharacterDef; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const s = (canvas.width / 96) * (0.62 / def.scale);
      drawPortrait(
        ctx,
        def,
        canvas.width / 2 + 2,
        canvas.height + 30 * s,
        s,
        t,
        active && t % 4 > 2.8 ? 'win' : 'idle',
      );
      if (active) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [def, active]);
  return <canvas ref={ref} width={96} height={96} className={styles.portrait} aria-hidden />;
}

/** 휴대폰용 화면 버튼 — 누르고 있는 동안 키를 누른 것과 같다 */
function TouchPad({ onPad }: { onPad: (k: InputKey, down: boolean) => void }) {
  const bind = (key: InputKey) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // 일부 브라우저는 캡처를 지원하지 않는다
      }
      onPad(key, true);
    },
    onPointerUp: () => onPad(key, false),
    onPointerCancel: () => onPad(key, false),
    onLostPointerCapture: () => onPad(key, false),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
  return (
    <div className={styles.pad} aria-label="터치 조작">
      <div className={styles.padMove}>
        <span />
        <button type="button" className={styles.padBtn} {...bind('UP')} aria-label="점프">
          ▲
        </button>
        <span />
        <button type="button" className={styles.padBtn} {...bind('LEFT')} aria-label="왼쪽">
          ◀
        </button>
        <button type="button" className={styles.padBtn} {...bind('DOWN')} aria-label="숙이기">
          ▼
        </button>
        <button type="button" className={styles.padBtn} {...bind('RIGHT')} aria-label="오른쪽">
          ▶
        </button>
      </div>
      <div className={styles.padActions}>
        <button type="button" className={`${styles.padBtn} ${styles.padA}`} {...bind('A')}>
          A<small>주먹</small>
        </button>
        <button type="button" className={`${styles.padBtn} ${styles.padS}`} {...bind('S')}>
          S<small>발차기</small>
        </button>
        <button type="button" className={`${styles.padBtn} ${styles.padD}`} {...bind('D')}>
          D<small>방어</small>
        </button>
        <button type="button" className={`${styles.padBtn} ${styles.padF}`} {...bind('F')}>
          F<small>필살</small>
        </button>
      </div>
    </div>
  );
}
