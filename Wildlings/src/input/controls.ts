import type { Action, Vector } from "../game/types";

interface ControlsOptions {
  joystick: HTMLElement;
  stick: HTMLElement;
  attack: HTMLButtonElement;
  dodge: HTMLButtonElement;
  onAction: (action: Action) => void;
}

const MOVE_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
]);
const ATTACK_CODES = new Set(["KeyJ", "Space"]);
const DODGE_CODES = new Set(["KeyK", "ShiftLeft", "ShiftRight"]);
const DEADZONE = 0.12;

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      ),
    )
  );
}

/** DOM input only. Movement and animation rules stay in the game controller. */
export class Controls {
  private readonly options: ControlsOptions;
  private readonly events = new AbortController();
  private readonly keys = new Set<string>();
  private readonly pointers: Record<Action, Set<number>> = {
    attack: new Set(),
    dodge: new Set(),
  };
  private readonly originalTouchActions: string[];
  private joystickPointer: number | null = null;
  private analog: Vector = { x: 0, y: 0 };

  constructor(options: ControlsOptions) {
    this.options = options;
    const { joystick, attack, dodge } = options;
    this.originalTouchActions = [joystick, attack, dodge].map((element) => {
      const previous = element.style.touchAction;
      element.style.touchAction = "none";
      return previous;
    });
    const signal = this.events.signal;

    joystick.addEventListener("pointerdown", this.onJoystickDown, { signal });
    joystick.addEventListener("pointermove", this.onJoystickMove, { signal });
    joystick.addEventListener("pointerup", this.onJoystickEnd, { signal });
    joystick.addEventListener("pointercancel", this.onJoystickEnd, { signal });
    joystick.addEventListener("lostpointercapture", this.onJoystickEnd, {
      signal,
    });

    this.bindButton(attack, "attack");
    this.bindButton(dodge, "dodge");
    window.addEventListener("keydown", this.onKeyDown, { signal });
    window.addEventListener("keyup", this.onKeyUp, { signal });
    window.addEventListener("blur", this.clear, { signal });
    document.addEventListener("visibilitychange", this.onVisibilityChange, {
      signal,
    });
  }

  /** Fresh vector, with analog strength retained and diagonal speed capped at 1. */
  movement(): Vector {
    const held = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code));
    let x =
      Number(held("KeyD", "ArrowRight")) - Number(held("KeyA", "ArrowLeft"));
    let y = Number(held("KeyS", "ArrowDown")) - Number(held("KeyW", "ArrowUp"));
    const keyboardLength = Math.hypot(x, y);
    if (keyboardLength > 1) {
      x /= keyboardLength;
      y /= keyboardLength;
    }
    x += this.analog.x;
    y += this.analog.y;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  clear = (): void => {
    this.keys.clear();
    this.resetJoystick();
    this.pointers.attack.clear();
    this.pointers.dodge.clear();
    this.syncButtons();
  };

  destroy(): void {
    this.clear();
    this.events.abort();
    [this.options.joystick, this.options.attack, this.options.dodge].forEach(
      (element, index) => {
        element.style.touchAction = this.originalTouchActions[index];
      },
    );
  }

  private onJoystickDown = (event: PointerEvent): void => {
    if (this.joystickPointer !== null || event.button !== 0) return;
    event.preventDefault();
    this.joystickPointer = event.pointerId;
    this.options.joystick.classList.add("is-active");
    this.options.joystick.setPointerCapture(event.pointerId);
    this.updateJoystick(event);
  };

  private onJoystickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.joystickPointer) return;
    event.preventDefault();
    this.updateJoystick(event);
  };

  private onJoystickEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.joystickPointer) this.resetJoystick();
  };

  private updateJoystick(event: PointerEvent): void {
    const bounds = this.options.joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.4);
    const dx = event.clientX - bounds.left - bounds.width / 2;
    const dy = event.clientY - bounds.top - bounds.height / 2;
    const distance = Math.hypot(dx, dy);
    const strength = Math.min(distance / radius, 1);
    const ux = distance > 0 ? dx / distance : 0;
    const uy = distance > 0 ? dy / distance : 0;
    const magnitude =
      strength <= DEADZONE ? 0 : (strength - DEADZONE) / (1 - DEADZONE);
    this.analog = { x: ux * magnitude, y: uy * magnitude };
    this.options.stick.style.transform = `translate(${ux * strength * radius}px, ${uy * strength * radius}px)`;
  }

  private resetJoystick(): void {
    const pointer = this.joystickPointer;
    this.joystickPointer = null;
    this.analog = { x: 0, y: 0 };
    this.options.stick.style.transform = "translate(0px, 0px)";
    this.options.joystick.classList.remove("is-active");
    if (pointer !== null && this.options.joystick.hasPointerCapture(pointer)) {
      this.options.joystick.releasePointerCapture(pointer);
    }
  }

  private bindButton(button: HTMLButtonElement, action: Action): void {
    const signal = this.events.signal;
    button.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || button.disabled) return;
        event.preventDefault();
        this.pointers[action].add(event.pointerId);
        button.setPointerCapture(event.pointerId);
        this.syncButtons();
        this.options.onAction(action);
      },
      { signal },
    );
    const release = (event: PointerEvent) => {
      this.pointers[action].delete(event.pointerId);
      this.syncButtons();
    };
    button.addEventListener("pointerup", release, { signal });
    button.addEventListener("pointercancel", release, { signal });
    button.addEventListener("lostpointercapture", release, { signal });
    // Pointer presses already fire on contact. Keyboard and assistive clicks
    // have detail 0 and still activate the native button once.
    button.addEventListener(
      "click",
      (event) => {
        if (event.detail === 0 && !button.disabled)
          this.options.onAction(action);
      },
      { signal },
    );
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (
      isEditable(event.target) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    // Let native focused buttons handle Space/Enter so their accessible click
    // does not also trigger the global Space-to-attack shortcut.
    if (
      event.code === "Space" &&
      event.target instanceof Element &&
      event.target.closest("button")
    )
      return;
    const movement = MOVE_CODES.has(event.code);
    const action = ATTACK_CODES.has(event.code)
      ? "attack"
      : DODGE_CODES.has(event.code)
        ? "dodge"
        : null;
    if (!movement && !action) return;
    event.preventDefault();
    if (event.repeat || this.keys.has(event.code)) return;
    this.keys.add(event.code);
    this.syncButtons();
    if (action) this.options.onAction(action);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    this.syncButtons();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.clear();
  };

  private syncButtons(): void {
    const keyboardAttack = [...ATTACK_CODES].some((code) =>
      this.keys.has(code),
    );
    const keyboardDodge = [...DODGE_CODES].some((code) => this.keys.has(code));
    this.options.attack.classList.toggle(
      "is-pressed",
      this.pointers.attack.size > 0 || keyboardAttack,
    );
    this.options.dodge.classList.toggle(
      "is-pressed",
      this.pointers.dodge.size > 0 || keyboardDodge,
    );
  }
}
