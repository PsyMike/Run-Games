import {
  DIRECTIONS,
  type CharacterSnapshot,
  type Direction,
} from "../game/types";

export const CLIP_STATES = ["walk", "attack", "dodge"] as const;
export type ClipState = (typeof CLIP_STATES)[number];

export interface SpriteClip {
  frames: string[];
  /** Walk playback rate; action clips use normalized controller progress. */
  fps: number;
  /** Walk must loop; attack and dodge must be one-shot. */
  loop: boolean;
}

export interface WardenManifest {
  schemaVersion: 1;
  /** PixiJS spritesheet JSON URL, resolved relative to this manifest. */
  atlas: string;
  /** The same normalized foot pivot is used for every frame. */
  anchor: { x: number; y: number };
  scale: number;
  clips: Record<ClipState, Record<Direction, SpriteClip>>;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Warden manifest: ${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function number(
  value: unknown,
  path: string,
  minimum: number,
  maximum = Infinity,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Warden manifest: ${path} must be a finite number between ${minimum} and ${maximum}.`,
    );
  }
  return value;
}

/** Validate external JSON at the asset boundary, before touching the renderer. */
export function validateManifest(value: unknown): WardenManifest {
  const root = record(value, "root");
  if (root.schemaVersion !== 1) {
    throw new Error("Warden manifest: schemaVersion must be 1.");
  }
  if (typeof root.atlas !== "string" || !root.atlas.trim()) {
    throw new Error(
      "Warden manifest: atlas must be a nonempty spritesheet URL.",
    );
  }
  const anchor = record(root.anchor, "anchor");
  const scale = number(root.scale, "scale", Number.MIN_VALUE);
  const sourceClips = record(root.clips, "clips");
  const clips = {} as WardenManifest["clips"];

  for (const state of CLIP_STATES) {
    const directions = record(sourceClips[state], `clips.${state}`);
    clips[state] = {} as Record<Direction, SpriteClip>;
    for (const direction of DIRECTIONS) {
      const path = `clips.${state}.${direction}`;
      const clip = record(directions[direction], path);
      if (
        !Array.isArray(clip.frames) ||
        clip.frames.length === 0 ||
        !clip.frames.every(
          (frame) => typeof frame === "string" && frame.trim().length > 0,
        )
      ) {
        throw new Error(
          `Warden manifest: ${path}.frames must contain at least one nonempty frame name.`,
        );
      }
      if (clip.loop !== (state === "walk")) {
        throw new Error(
          `Warden manifest: ${path}.loop must be ${state === "walk"} for ${state}.`,
        );
      }
      clips[state][direction] = {
        frames: [...clip.frames] as string[],
        fps: number(clip.fps, `${path}.fps`, Number.MIN_VALUE, 120),
        loop: clip.loop,
      };
    }
  }

  return {
    schemaVersion: 1,
    atlas: root.atlas.trim(),
    anchor: {
      x: number(anchor.x, "anchor.x", 0, 1),
      y: number(anchor.y, "anchor.y", 0, 1),
    },
    scale,
    clips,
  };
}

/** Fail immediately for incomplete atlases, rather than showing invisible frames. */
export function assertAtlasFrames(
  manifest: WardenManifest,
  textures: Readonly<Record<string, unknown>>,
): void {
  const missing = new Set<string>();
  for (const state of CLIP_STATES) {
    for (const direction of DIRECTIONS) {
      for (const frame of manifest.clips[state][direction].frames) {
        if (!Object.hasOwn(textures, frame) || textures[frame] == null)
          missing.add(frame);
      }
    }
  }
  if (missing.size) {
    throw new Error(
      `Warden atlas is missing ${missing.size} frame(s): ${[...missing].slice(0, 8).join(", ")}.`,
    );
  }
}

/** Controller time/progress drives playback independently of refresh rate. No mirroring. */
export function frameForSnapshot(
  manifest: WardenManifest,
  snapshot: CharacterSnapshot,
): string {
  const state = snapshot.state === "idle" ? "walk" : snapshot.state;
  const clip = manifest.clips[state][snapshot.facing];
  if (snapshot.state === "idle") return clip.frames[0];
  if (state === "attack" || state === "dodge") {
    // Always traverse the entire one-shot clip within the controller's action
    // clock, even when the author's FPS/frame count imply a different duration.
    const progress = Number.isFinite(snapshot.progress)
      ? Math.max(0, Math.min(1, snapshot.progress))
      : 0;
    return clip.frames[
      Math.min(
        Math.floor(progress * clip.frames.length),
        clip.frames.length - 1,
      )
    ];
  }
  const elapsed = Number.isFinite(snapshot.elapsed)
    ? Math.max(0, snapshot.elapsed)
    : 0;
  return clip.frames[Math.floor(elapsed * clip.fps) % clip.frames.length];
}
