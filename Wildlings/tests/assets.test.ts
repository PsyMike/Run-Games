import { describe, expect, it } from "vitest";
import { DIRECTIONS, type CharacterSnapshot } from "../src/game/types";
import {
  assertAtlasFrames,
  CLIP_STATES,
  frameForSnapshot,
  validateManifest,
  type WardenManifest,
} from "../src/assets/manifest";

function source(): WardenManifest {
  const clips = {} as WardenManifest["clips"];
  for (const state of CLIP_STATES) {
    clips[state] = {} as WardenManifest["clips"]["walk"];
    for (const direction of DIRECTIONS) {
      clips[state][direction] = {
        frames: [
          `${state}/${direction}/0`,
          `${state}/${direction}/1`,
          `${state}/${direction}/2`,
        ],
        fps: 10,
        loop: state === "walk",
      };
    }
  }
  return {
    schemaVersion: 1,
    atlas: "warden.atlas.json",
    anchor: { x: 0.5, y: 0.9 },
    scale: 1,
    clips,
  };
}

function snapshot(changes: Partial<CharacterSnapshot> = {}): CharacterSnapshot {
  return {
    position: { x: 0, y: 0 },
    state: "walk",
    facing: "south",
    elapsed: 0,
    progress: 0,
    ...changes,
  };
}

describe("Warden manifest", () => {
  it("accepts and copies a complete eight-direction transparent sprite contract", () => {
    const original = source();
    const parsed = validateManifest(original);
    expect(parsed).toEqual(original);
    original.clips.walk.south.frames[0] = "changed";
    expect(parsed.clips.walk.south.frames[0]).toBe("walk/south/0");
  });

  it("rejects missing directional art instead of silently mirroring it", () => {
    const invalid = source();
    delete (invalid.clips.attack as Partial<typeof invalid.clips.attack>)[
      "north-east"
    ];
    expect(() => validateManifest(invalid)).toThrow("clips.attack.north-east");
  });

  it.each([
    [
      "schema version",
      (value: WardenManifest) => {
        Object.assign(value, { schemaVersion: 2 });
      },
      "schemaVersion",
    ],
    [
      "empty frames",
      (value: WardenManifest) => {
        value.clips.walk.south.frames = [];
      },
      "frames",
    ],
    [
      "invalid fps",
      (value: WardenManifest) => {
        value.clips.dodge.east.fps = NaN;
      },
      "fps",
    ],
    [
      "zero scale",
      (value: WardenManifest) => {
        value.scale = 0;
      },
      "scale",
    ],
    [
      "bad foot pivot",
      (value: WardenManifest) => {
        value.anchor.y = 4;
      },
      "anchor.y",
    ],
    [
      "looping attack",
      (value: WardenManifest) => {
        value.clips.attack.south.loop = true;
      },
      "loop must be false",
    ],
    [
      "non-looping walk",
      (value: WardenManifest) => {
        value.clips.walk.south.loop = false;
      },
      "loop must be true",
    ],
  ] as const)("rejects %s with a diagnostic", (_name, change, message) => {
    const invalid = source();
    change(invalid);
    expect(() => validateManifest(invalid)).toThrow(message);
  });

  it("checks every referenced frame and reports missing atlas entries", () => {
    const manifest = source();
    const textures: Record<string, object> = {};
    for (const state of CLIP_STATES) {
      for (const direction of DIRECTIONS) {
        for (const frame of manifest.clips[state][direction].frames)
          textures[frame] = {};
      }
    }
    expect(() => assertAtlasFrames(manifest, textures)).not.toThrow();
    delete textures["dodge/north-west/2"];
    expect(() => assertAtlasFrames(manifest, textures)).toThrow(
      "dodge/north-west/2",
    );
  });
});

describe("controller-driven frame selection", () => {
  it("loops walking, uses directional art, and freezes idle on the first walk frame", () => {
    const manifest = source();
    expect(
      frameForSnapshot(
        manifest,
        snapshot({ elapsed: 0.41, facing: "north-east" }),
      ),
    ).toBe("walk/north-east/1");
    expect(
      frameForSnapshot(
        manifest,
        snapshot({ state: "idle", elapsed: 99, facing: "west" }),
      ),
    ).toBe("walk/west/0");
  });

  it("holds the final attack and dodge frames instead of wrapping", () => {
    const manifest = source();
    expect(
      frameForSnapshot(
        manifest,
        snapshot({ state: "attack", elapsed: 0, progress: 1 }),
      ),
    ).toBe("attack/south/2");
    expect(
      frameForSnapshot(
        manifest,
        snapshot({ state: "dodge", elapsed: 99, progress: 5, facing: "north" }),
      ),
    ).toBe("dodge/north/2");
  });

  it("fits the complete action clip to controller progress regardless of authoring FPS", () => {
    const manifest = source();
    manifest.clips.attack.south.fps = 1;
    expect(
      frameForSnapshot(
        manifest,
        snapshot({ state: "attack", elapsed: 0.2, progress: 0.5 }),
      ),
    ).toBe("attack/south/1");
    expect(
      frameForSnapshot(
        manifest,
        snapshot({ state: "attack", elapsed: 0.4, progress: 0.99 }),
      ),
    ).toBe("attack/south/2");
    expect(
      frameForSnapshot(
        manifest,
        snapshot({ state: "dodge", elapsed: 99, progress: 0 }),
      ),
    ).toBe("dodge/south/0");
  });

  it("contains invalid or negative state time at the first frame", () => {
    const manifest = source();
    expect(frameForSnapshot(manifest, snapshot({ elapsed: -1 }))).toBe(
      "walk/south/0",
    );
    expect(frameForSnapshot(manifest, snapshot({ elapsed: Infinity }))).toBe(
      "walk/south/0",
    );
    expect(
      frameForSnapshot(manifest, snapshot({ state: "attack", progress: -1 })),
    ).toBe("attack/south/0");
    expect(
      frameForSnapshot(manifest, snapshot({ state: "dodge", progress: NaN })),
    ).toBe("dodge/south/0");
  });
});
