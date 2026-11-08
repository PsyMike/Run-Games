import { Application, Container, Graphics } from "pixi.js";
import { loadWardenAssets } from "../assets/warden";
import { WardenController } from "./controller";
import { DIRECTIONS } from "./types";
import type { Action, CharacterSnapshot, Vector } from "./types";

export async function createScene(
  host: HTMLElement,
  onUpdate: (snapshot: CharacterSnapshot) => void,
) {
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    width: host.clientWidth,
    height: host.clientHeight,
    preference: "webgl",
  });
  host.prepend(app.canvas);
  app.canvas.setAttribute("aria-hidden", "true");
  const world = new Container();
  const ground = new Graphics();
  const debug = new Graphics();
  const marker = new Graphics();
  const controller = new WardenController({
    width: host.clientWidth,
    height: host.clientHeight,
  });
  app.stage.addChild(world);
  world.addChild(ground, debug, marker);
  let assetError: string | null = null;
  const sprite = await loadWardenAssets().catch((error: unknown) => {
    assetError = error instanceof Error ? error.message : String(error);
    return null;
  });
  if (sprite) {
    world.addChild(sprite);
    marker.visible = false;
  }
  let movement: () => Vector = () => ({ x: 0, y: 0 });
  let paused = false;
  let destroyed = false;

  function paintGround(width: number, height: number) {
    ground.clear();
    // Neutral ground marks are scene decoration, never stand-in character art.
    const grid = 48;
    for (let x = (width % grid) / 2; x < width; x += grid) {
      for (let y = (height % grid) / 2; y < height; y += grid) {
        ground.circle(x, y, 0.9).fill({ color: 0x8b9182, alpha: 0.3 });
      }
    }
    ground
      .ellipse(
        width * 0.5,
        height * 0.53,
        Math.min(width * 0.28, 170),
        Math.min(height * 0.24, 95),
      )
      .stroke({ color: 0x9ba28f, alpha: 0.27, width: 1 });
    ground
      .ellipse(
        width * 0.5,
        height * 0.53,
        Math.min(width * 0.28, 170) + 7,
        Math.min(height * 0.24, 95) + 5,
      )
      .stroke({ color: 0x9ba28f, alpha: 0.15, width: 1 });
    const margin = 20;
    for (const [x, y, dx, dy] of [
      [margin, margin, 1, 1],
      [width - margin, margin, -1, 1],
      [margin, height - margin, 1, -1],
      [width - margin, height - margin, -1, -1],
    ]) {
      ground
        .moveTo(x + dx * 10, y)
        .lineTo(x, y)
        .lineTo(x, y + dy * 10)
        .stroke({ color: 0x9da28f, alpha: 0.55, width: 1 });
    }
  }

  function render(snapshot: CharacterSnapshot) {
    if (destroyed) return;
    const color =
      snapshot.state === "attack"
        ? 0x9b4e3c
        : snapshot.state === "dodge"
          ? 0x3c6474
          : 0x52634b;
    const angle =
      Math.PI / 2 + (DIRECTIONS.indexOf(snapshot.facing) * Math.PI) / 4;
    marker.position.set(snapshot.position.x, snapshot.position.y);
    marker
      .clear()
      .circle(0, 0, 16)
      .fill({ color: 0xf5f4e9, alpha: 0.75 })
      .stroke({ color, width: 1.5 });
    marker.circle(0, 0, 5).stroke({ color, width: 1 });
    marker
      .moveTo(-23, 0)
      .lineTo(-19, 0)
      .moveTo(19, 0)
      .lineTo(23, 0)
      .moveTo(0, -23)
      .lineTo(0, -19)
      .moveTo(0, 19)
      .lineTo(0, 23)
      .stroke({ color, width: 1 });
    marker
      .poly([
        Math.cos(angle) * 26,
        Math.sin(angle) * 26,
        Math.cos(angle - 0.2) * 20,
        Math.sin(angle - 0.2) * 20,
        Math.cos(angle + 0.2) * 20,
        Math.sin(angle + 0.2) * 20,
      ])
      .fill(color);
    debug.clear();
    if (snapshot.state === "attack" || snapshot.state === "dodge") {
      debug
        .arc(
          snapshot.position.x,
          snapshot.position.y,
          30,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * snapshot.progress,
        )
        .stroke({ color, width: 2, alpha: 0.6 });
    }
    sprite?.update(snapshot);
    onUpdate(snapshot);
  }

  const resize = new ResizeObserver(() => {
    if (destroyed) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    app.renderer.resize(width, height);
    controller.resize({ width, height });
    paintGround(width, height);
    render(controller.snapshot());
  });
  resize.observe(host);
  paintGround(host.clientWidth, host.clientHeight);
  render(controller.snapshot());
  app.ticker.add((ticker) => {
    if (!paused) render(controller.update(ticker.deltaMS / 1000, movement()));
  });

  return {
    hasArtwork: !!sprite,
    assetError,
    setMovement(source: () => Vector) {
      movement = source;
    },
    requestAction(action: Action) {
      if (paused || destroyed) return false;
      controller.update(0, movement());
      const accepted = controller.requestAction(action);
      if (accepted) render(controller.snapshot());
      return accepted;
    },
    snapshot() {
      return controller.snapshot();
    },
    reset() {
      if (destroyed) return;
      controller.reset();
      render(controller.snapshot());
    },
    setPaused(value: boolean) {
      if (destroyed) return;
      paused = value;
      render(controller.snapshot());
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resize.disconnect();
      app.destroy(true, { children: true });
    },
  };
}
