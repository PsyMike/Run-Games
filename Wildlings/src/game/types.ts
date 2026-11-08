export const DIRECTIONS = [
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east",
  "east",
  "south-east",
] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type AnimationState = "idle" | "walk" | "attack" | "dodge";
export type Action = "attack" | "dodge";
export interface Vector {
  x: number;
  y: number;
}
export interface Bounds {
  width: number;
  height: number;
}
export interface CharacterSnapshot {
  position: Vector;
  state: AnimationState;
  facing: Direction;
  /** Seconds since the current state began. Idle freezes the first walk frame. */
  elapsed: number;
  /** Normalized action/cycle progress, in [0, 1]. */
  progress: number;
}
export interface CharacterController {
  update(deltaSeconds: number, movement: Vector): CharacterSnapshot;
  requestAction(action: Action): boolean;
  resize(bounds: Bounds): void;
  reset(): void;
  snapshot(): CharacterSnapshot;
}
