import { IN } from './config';

/** 화면 터치 버튼 · 키 이름 */
export type InputKey = keyof typeof IN;

const KEY_MAP: Record<string, number> = {
  ArrowLeft: IN.LEFT,
  ArrowRight: IN.RIGHT,
  ArrowUp: IN.UP,
  ArrowDown: IN.DOWN,
  KeyA: IN.A,
  KeyS: IN.S,
  KeyD: IN.D,
  KeyF: IN.F,
};

/**
 * InputManager — 키보드와 화면 터치 버튼을 입력 비트(IN.*)로 모은다.
 * 매 프레임 sample() 로 지금 눌린 키를 읽는다. "막 누름" 판정은 Fighter 가 이전 프레임과 비교한다.
 * 아주 짧게 눌렀다 뗀 키도 놓치지 않도록, 다음 sample() 까지는 눌린 것으로 친다.
 */
export class InputManager {
  private held = 0;
  /** 이번 프레임 사이에 한 번이라도 눌린 키 */
  private tapped = 0;
  private virtual = 0;
  private enabled = true;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  /** 게임 중일 때만 방향키 스크롤 등 브라우저 기본 동작을 막는다 */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.clear();
  }

  sample(): number {
    const bits = this.held | this.tapped | this.virtual;
    this.tapped = 0;
    // 좌우를 동시에 누르면 둘 다 뗀 것으로
    if (bits & IN.LEFT && bits & IN.RIGHT) return bits & ~(IN.LEFT | IN.RIGHT);
    return bits;
  }

  setVirtual(key: InputKey, down: boolean) {
    const bit = IN[key];
    if (down) {
      this.virtual |= bit;
      this.tapped |= bit;
    } else {
      this.virtual &= ~bit;
    }
  }

  clear = () => {
    this.held = 0;
    this.tapped = 0;
    this.virtual = 0;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const bit = KEY_MAP[e.code];
    if (!bit) return;
    e.preventDefault();
    this.held |= bit;
    this.tapped |= bit;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const bit = KEY_MAP[e.code];
    if (!bit) return;
    this.held &= ~bit;
  };
}
