import { DIRECTIONS } from "./types";
import type {
  Action,
  AnimationState,
  Bounds,
  CharacterController,
  CharacterSnapshot,
  Direction,
  Vector,
} from "./types";

export const WARDEN_TIMING = {
  walkCycle: 0.64,
  attack: 0.42,
  dodge: 0.3,
} as const;

const WALK_SPEED = 125;
const DODGE_SPEED = 400;
const EDGE_PADDING = 28;
const MAX_DELTA = 0.05;

/** Keep analog strength, but cap diagonals and reject malformed input. */
function movementVector(value: Vector): Vector {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y))
    return { x: 0, y: 0 };
  const magnitude = Math.hypot(value.x, value.y);
  if (magnitude <= 0.001) return { x: 0, y: 0 };
  const divisor = Math.max(1, magnitude);
  return { x: value.x / divisor, y: value.y / divisor };
}

function directionOf(vector: Vector): Direction {
  const sector = Math.round(Math.atan2(-vector.x, vector.y) / (Math.PI / 4));
  return DIRECTIONS[(sector + DIRECTIONS.length) % DIRECTIONS.length];
}

function facingVector(direction: Direction): Vector {
  const angle = DIRECTIONS.indexOf(direction) * (Math.PI / 4);
  return { x: -Math.sin(angle), y: Math.cos(angle) };
}

function safeBounds(bounds: Bounds): Bounds {
  return {
    width: Number.isFinite(bounds.width) ? Math.max(0, bounds.width) : 0,
    height: Number.isFinite(bounds.height) ? Math.max(0, bounds.height) : 0,
  };
}

/**
 * Pure movement/state logic: actions are committed and input is never queued.
 * A capped timestep avoids teleporting after a hidden tab resumes. The renderer
 * samples progress from this clock, so its frames stay aligned with movement.
 */
export class WardenController implements CharacterController {
  private bounds: Bounds;
  private position: Vector;
  private state: AnimationState = "idle";
  private facing: Direction = "south";
  private elapsed = 0;
  private latestMovement: Vector = { x: 0, y: 0 };
  private dodgeVector: Vector = { x: 0, y: 1 };

  constructor(bounds: Bounds) {
    this.bounds = safeBounds(bounds);
    this.position = { x: this.bounds.width / 2, y: this.bounds.height / 2 };
  }

  requestAction(action: Action): boolean {
    if (this.state === "attack" || this.state === "dodge") return false;
    if (action === "dodge") {
      const magnitude = Math.hypot(
        this.latestMovement.x,
        this.latestMovement.y,
      );
      this.dodgeVector =
        magnitude > 0
          ? {
              x: this.latestMovement.x / magnitude,
              y: this.latestMovement.y / magnitude,
            }
          : facingVector(this.facing);
      this.facing = directionOf(this.dodgeVector);
    }
    this.state = action;
    this.elapsed = 0;
    return true;
  }

  update(deltaSeconds: number, movement: Vector): CharacterSnapshot {
    let delta = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(MAX_DELTA, deltaSeconds))
      : 0;
    this.latestMovement = movementVector(movement);

    if (this.state === "attack" || this.state === "dodge") {
      const duration = WARDEN_TIMING[this.state];
      const actionDelta = Math.min(delta, Math.max(0, duration - this.elapsed));
      if (this.state === "dodge")
        this.move(this.dodgeVector, DODGE_SPEED, actionDelta);
      this.elapsed += actionDelta;
      delta -= actionDelta;
      if (this.elapsed + 1e-9 < duration) return this.snapshot();
      this.state = "idle";
      this.elapsed = 0;
    }

    const moving = this.latestMovement.x !== 0 || this.latestMovement.y !== 0;
    const nextState = moving ? "walk" : "idle";
    if (nextState !== this.state) this.elapsed = 0;
    this.state = nextState;
    if (moving) {
      this.facing = directionOf(this.latestMovement);
      this.elapsed += delta;
      this.move(this.latestMovement, WALK_SPEED, delta);
    } else {
      this.elapsed = 0;
    }
    return this.snapshot();
  }

  resize(bounds: Bounds): void {
    const next = safeBounds(bounds);
    this.position.x =
      (this.bounds.width > 0 ? this.position.x / this.bounds.width : 0.5) *
      next.width;
    this.position.y =
      (this.bounds.height > 0 ? this.position.y / this.bounds.height : 0.5) *
      next.height;
    this.bounds = next;
    this.clampPosition();
  }

  reset(): void {
    this.position = { x: this.bounds.width / 2, y: this.bounds.height / 2 };
    this.state = "idle";
    this.facing = "south";
    this.elapsed = 0;
    this.latestMovement = { x: 0, y: 0 };
    this.dodgeVector = { x: 0, y: 1 };
  }

  snapshot(): CharacterSnapshot {
    let progress = 0;
    if (this.state === "walk")
      progress =
        (this.elapsed % WARDEN_TIMING.walkCycle) / WARDEN_TIMING.walkCycle;
    if (this.state === "attack" || this.state === "dodge") {
      progress = Math.min(1, this.elapsed / WARDEN_TIMING[this.state]);
    }
    return {
      position: { ...this.position },
      state: this.state,
      facing: this.facing,
      elapsed: this.elapsed,
      progress,
    };
  }

  private move(vector: Vector, speed: number, delta: number): void {
    this.position.x += vector.x * speed * delta;
    this.position.y += vector.y * speed * delta;
    this.clampPosition();
  }

  private clampPosition(): void {
    const paddingX = Math.min(EDGE_PADDING, this.bounds.width / 2);
    const paddingY = Math.min(EDGE_PADDING, this.bounds.height / 2);
    this.position.x = Math.max(
      paddingX,
      Math.min(this.bounds.width - paddingX, this.position.x),
    );
    this.position.y = Math.max(
      paddingY,
      Math.min(this.bounds.height - paddingY, this.position.y),
    );
  }
}
