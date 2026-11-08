import { Assets, Container, Sprite, type Spritesheet } from "pixi.js";
import type { CharacterSnapshot } from "../game/types";
import { WARDEN_MANIFEST_PATH } from "./config";
import {
  assertAtlasFrames,
  frameForSnapshot,
  validateManifest,
  type WardenManifest,
} from "./manifest";

/** A transparent sprite view, independent of movement and action logic. */
export class WardenSprite extends Container {
  private readonly character: Sprite;

  constructor(
    private readonly manifest: WardenManifest,
    private readonly atlas: Spritesheet,
  ) {
    super();
    this.label = "Warden";
    this.character = new Sprite(
      atlas.textures[manifest.clips.walk.south.frames[0]],
    );
    this.character.label = "Approved Warden sprite";
    this.character.anchor.set(manifest.anchor.x, manifest.anchor.y);
    this.character.scale.set(manifest.scale);
    this.addChild(this.character);
  }

  update(snapshot: CharacterSnapshot): void {
    this.position.set(snapshot.position.x, snapshot.position.y);
    this.character.texture =
      this.atlas.textures[frameForSnapshot(this.manifest, snapshot)];
  }

  override destroy(): void {
    // Textures belong to Pixi's shared asset cache, not this individual view.
    super.destroy({ children: true });
  }
}

/**
 * No request is made while artwork is pending. Once enabled in config.ts,
 * invalid/failed assets reject with a useful error for the scene's status UI.
 */
export async function loadWardenAssets(): Promise<WardenSprite | null> {
  if (!WARDEN_MANIFEST_PATH) return null;

  const baseUrl = new URL(import.meta.env.BASE_URL, document.baseURI);
  const manifestUrl = new URL(WARDEN_MANIFEST_PATH, baseUrl);
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(
      `Warden manifest could not be loaded (HTTP ${response.status}).`,
    );
  }
  const manifest = validateManifest(await response.json());
  const atlas = await Assets.load<Spritesheet>(
    new URL(manifest.atlas, manifestUrl).href,
  );
  if (!atlas?.textures || typeof atlas.textures !== "object") {
    throw new Error(
      "Warden atlas must be a PixiJS spritesheet JSON with named frames.",
    );
  }
  assertAtlasFrames(manifest, atlas.textures);
  return new WardenSprite(manifest, atlas);
}
