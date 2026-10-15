import { ICE_SERVERS } from './config';
import type { CharId } from './characters';
import type { SimSnapshot } from './sim';

/** 두 브라우저가 DataChannel 로 주고받는 메시지 */
export type NetMessage =
  | { t: 'hello'; v: number }
  | { t: 'pick'; char: CharId | null; ready: boolean }
  | { t: 'start'; p1: CharId; p2: CharId; stage: number; match: number; delay: number }
  | { t: 'in'; m: number; f: number; b: number }
  | { t: 'sync'; m: number; f: number; h: number; s: SimSnapshot }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  | { t: 'leave' };

export type NetStatus =
  | 'idle'
  | 'creating'
  | 'waiting-answer'
  | 'answering'
  | 'connecting'
  | 'connected'
  | 'closed'
  | 'failed';

export const PROTOCOL_VERSION = 1;

/* ---------------- 연결 코드 (SDP) 인코딩 ---------------- */

const PREFIX_ZIP = 'SF1.';
const PREFIX_RAW = 'SF0.';

function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(b64: string) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** SDP 를 복사·붙여넣기 쉬운 짧은 문자열로 (가능하면 압축) */
export async function encodeSignal(desc: RTCSessionDescriptionInit): Promise<string> {
  const json = JSON.stringify({ type: desc.type, sdp: desc.sdp });
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const zipped = await pipeBytes(raw, new CompressionStream('deflate-raw'));
      return PREFIX_ZIP + toBase64(zipped);
    } catch {
      // 압축이 안 되면 그대로
    }
  }
  return PREFIX_RAW + toBase64(raw);
}

export async function decodeSignal(code: string): Promise<RTCSessionDescriptionInit> {
  const text = code.replace(/\s+/g, '');
  let bytes: Uint8Array;
  if (text.startsWith(PREFIX_ZIP)) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('이 브라우저는 압축된 코드를 풀 수 없어요. 최신 브라우저를 써 주세요.');
    }
    bytes = await pipeBytes(
      fromBase64(text.slice(PREFIX_ZIP.length)),
      new DecompressionStream('deflate-raw'),
    );
  } else if (text.startsWith(PREFIX_RAW)) {
    bytes = fromBase64(text.slice(PREFIX_RAW.length));
  } else {
    throw new Error('심심파이터즈 연결 코드가 아니에요. 코드를 다시 확인해 주세요.');
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as RTCSessionDescriptionInit;
  if (!parsed.type || !parsed.sdp) throw new Error('연결 코드가 손상되었어요.');
  return parsed;
}

/**
 * NetworkManager_WebRTC — 별도 게임 서버 없이 두 브라우저를 P2P 로 잇는다.
 *
 *  방장(host)  : createRoom() → 방 코드 공유 → 상대의 참가 코드를 acceptAnswer()
 *  참가자(guest): joinRoom(방 코드) → 참가 코드를 방장에게 전달
 *
 * 코드 교환(시그널링)은 사람이 메신저 등으로 복사·붙여넣기 한다.
 * 연결되면 RTCDataChannel 로 입력·상태 메시지를 실시간으로 주고받는다.
 * (공용 STUN 서버로 주소만 알아내며, 회사·학교처럼 막힌 네트워크에서는 연결이 안 될 수 있다)
 */
export class NetworkManager_WebRTC {
  readonly role: 'host' | 'guest';
  status: NetStatus = 'idle';
  /** 마지막 왕복 지연 (ms) */
  ping = 0;

  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private listeners = new Set<(m: NetMessage) => void>();
  private statusListeners = new Set<(s: NetStatus) => void>();
  private pingTimer: number | null = null;

  constructor(role: 'host' | 'guest') {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('이 브라우저는 WebRTC 를 지원하지 않아요.');
    }
    this.role = role;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.addEventListener('connectionstatechange', () => {
      const s = this.pc.connectionState;
      if (s === 'failed') this.setStatus('failed');
      else if (s === 'disconnected' || s === 'closed') {
        if (this.status === 'connected') this.setStatus('closed');
      }
    });
    if (role === 'guest') {
      this.pc.addEventListener('datachannel', (e) => this.bindChannel(e.channel));
    }
  }

  /** 방장 — 방 코드 만들기 */
  async createRoom(): Promise<string> {
    this.setStatus('creating');
    this.bindChannel(this.pc.createDataChannel('simsim-fighters', { ordered: true }));
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitIce();
    const local = this.pc.localDescription;
    if (!local) throw new Error('방 코드를 만들지 못했어요.');
    this.setStatus('waiting-answer');
    return encodeSignal(local);
  }

  /** 방장 — 참가자가 보낸 참가 코드 받기 */
  async acceptAnswer(code: string) {
    const desc = await decodeSignal(code);
    if (desc.type !== 'answer')
      throw new Error('참가 코드가 아니에요. 상대가 만든 "참가 코드"를 붙여 넣어 주세요.');
    this.setStatus('connecting');
    await this.pc.setRemoteDescription(desc);
  }

  /** 참가자 — 방 코드로 참가 코드 만들기 */
  async joinRoom(code: string): Promise<string> {
    const desc = await decodeSignal(code);
    if (desc.type !== 'offer')
      throw new Error('방 코드가 아니에요. 방장이 만든 "방 코드"를 붙여 넣어 주세요.');
    this.setStatus('answering');
    await this.pc.setRemoteDescription(desc);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitIce();
    const local = this.pc.localDescription;
    if (!local) throw new Error('참가 코드를 만들지 못했어요.');
    this.setStatus('connecting');
    return encodeSignal(local);
  }

  send(m: NetMessage) {
    if (!this.dc || this.dc.readyState !== 'open') return;
    try {
      this.dc.send(JSON.stringify(m));
    } catch {
      // 보내기 실패는 연결 상태 이벤트로 처리된다
    }
  }

  onMessage(fn: (m: NetMessage) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  onStatus(fn: (s: NetStatus) => void) {
    this.statusListeners.add(fn);
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  close() {
    this.send({ t: 'leave' });
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
    try {
      this.dc?.close();
      this.pc.close();
    } catch {
      // 이미 닫힘
    }
    this.setStatus('closed');
    this.listeners.clear();
    this.statusListeners.clear();
  }

  private bindChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.addEventListener('open', () => {
      this.setStatus('connected');
      this.send({ t: 'hello', v: PROTOCOL_VERSION });
      this.pingTimer = window.setInterval(
        () => this.send({ t: 'ping', ts: performance.now() }),
        1000,
      );
    });
    dc.addEventListener('close', () => {
      if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.status === 'connected') this.setStatus('closed');
    });
    dc.addEventListener('message', (e) => {
      let m: NetMessage;
      try {
        m = JSON.parse(String(e.data)) as NetMessage;
      } catch {
        return;
      }
      if (m.t === 'ping') {
        this.send({ t: 'pong', ts: m.ts });
        return;
      }
      if (m.t === 'pong') {
        this.ping = Math.round(performance.now() - m.ts);
        return;
      }
      if (m.t === 'leave') {
        this.setStatus('closed');
        return;
      }
      for (const fn of this.listeners) fn(m);
    });
  }

  /** ICE 후보를 다 모을 때까지 (최대 4초) 기다린다 — 코드 하나로 연결 정보를 다 담기 위해 */
  private waitIce() {
    if (this.pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        this.pc.removeEventListener('icegatheringstatechange', check);
        window.clearTimeout(timer);
        resolve();
      };
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') done();
      };
      const timer = window.setTimeout(done, 4000);
      this.pc.addEventListener('icegatheringstatechange', check);
    });
  }

  private setStatus(s: NetStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const fn of this.statusListeners) fn(s);
  }
}
