import { describe, expect, it } from "vitest";
import { WardenController } from "../src/game/controller";
import type { Direction, Vector } from "../src/game/types";

const still = { x: 0, y: 0 };
function advance(
  controller: WardenController,
  seconds: number,
  movement: Vector = still,
): void {
  const steps = Math.round(seconds / 0.01);
  for (let step = 0; step < steps; step += 1) controller.update(0.01, movement);
}

describe("WardenController", () => {
  it("starts centered, returns detached snapshots, and resets completely", () => {
    const controller = new WardenController({ width: 800, height: 600 });
    const first = controller.snapshot();
    expect(first).toMatchObject({
      position: { x: 400, y: 300 },
      facing: "south",
      state: "idle",
    });
    first.position.x = 2;
    expect(controller.snapshot().position.x).toBe(400);
    controller.update(0.05, { x: 1, y: 0 });
    controller.requestAction("dodge");
    controller.reset();
    expect(controller.snapshot()).toEqual({
      ...first,
      position: { x: 400, y: 300 },
    });
  });

  it("normalizes diagonal speed while preserving analog strength", () => {
    const cardinal = new WardenController({ width: 800, height: 600 });
    const diagonal = new WardenController({ width: 800, height: 600 });
    const analog = new WardenController({ width: 800, height: 600 });
    advance(cardinal, 1, { x: 1, y: 0 });
    advance(diagonal, 1, { x: 1, y: 1 });
    advance(analog, 1, { x: 0.5, y: 0 });
    expect(cardinal.snapshot().position.x).toBeCloseTo(525);
    const position = diagonal.snapshot().position;
    expect(Math.hypot(position.x - 400, position.y - 300)).toBeCloseTo(125);
    expect(analog.snapshot().position.x).toBeCloseTo(462.5);
    expect(diagonal.snapshot().state).toBe("walk");
    diagonal.update(0.01, still);
    expect(diagonal.snapshot()).toMatchObject({
      state: "idle",
      facing: "south-east",
      progress: 0,
    });
  });

  it.each<[Vector, Direction]>([
    [{ x: 0, y: 1 }, "south"],
    [{ x: -1, y: 1 }, "south-west"],
    [{ x: -1, y: 0 }, "west"],
    [{ x: -1, y: -1 }, "north-west"],
    [{ x: 0, y: -1 }, "north"],
    [{ x: 1, y: -1 }, "north-east"],
    [{ x: 1, y: 0 }, "east"],
    [{ x: 1, y: 1 }, "south-east"],
  ])("maps movement %j to %s", (movement, facing) => {
    const controller = new WardenController({ width: 800, height: 600 });
    expect(controller.update(0, movement).facing).toBe(facing);
  });

  it("commits an attack, locks movement and facing, then recovers without queued actions", () => {
    const controller = new WardenController({ width: 800, height: 600 });
    controller.update(0, { x: 1, y: 0 });
    expect(controller.requestAction("attack")).toBe(true);
    expect(controller.requestAction("attack")).toBe(false);
    expect(controller.requestAction("dodge")).toBe(false);
    advance(controller, 0.21, { x: -1, y: 0 });
    expect(controller.snapshot()).toMatchObject({
      state: "attack",
      facing: "east",
      position: { x: 400, y: 300 },
    });
    expect(controller.snapshot().progress).toBeCloseTo(0.5);
    advance(controller, 0.21, { x: -1, y: 0 });
    expect(controller.snapshot()).toMatchObject({
      state: "walk",
      facing: "west",
    });
    advance(controller, 0.1, still);
    expect(controller.snapshot().state).toBe("idle");
    expect(controller.requestAction("dodge")).toBe(true);
  });

  it("dodges in the committed input direction at full speed and ignores mid-dodge steering", () => {
    const controller = new WardenController({ width: 800, height: 600 });
    controller.update(0, { x: 0.5, y: 0 });
    controller.requestAction("dodge");
    advance(controller, 0.15, { x: -1, y: 0 });
    expect(controller.snapshot()).toMatchObject({
      state: "dodge",
      facing: "east",
    });
    expect(controller.snapshot().position.x).toBeCloseTo(460);
    expect(controller.snapshot().progress).toBeCloseTo(0.5);
    advance(controller, 0.15, still);
    expect(controller.snapshot().state).toBe("idle");
    expect(controller.snapshot().position.x).toBeCloseTo(520);
    controller.requestAction("dodge");
    advance(controller, 0.3);
    expect(controller.snapshot().position.x).toBeCloseTo(640);
  });

  it("uses south as the default dodge direction", () => {
    const controller = new WardenController({ width: 800, height: 600 });
    controller.requestAction("dodge");
    advance(controller, 0.3);
    expect(controller.snapshot().position.y).toBeCloseTo(420);
    expect(controller.snapshot().position.x).toBeCloseTo(400);
  });

  it("clamps walking and dodging to ground bounds, preserves relative position on resize", () => {
    const controller = new WardenController({ width: 200, height: 120 });
    advance(controller, 2, { x: 1, y: -1 });
    expect(controller.snapshot().position).toEqual({ x: 172, y: 28 });
    controller.requestAction("dodge");
    advance(controller, 0.3, { x: 1, y: -1 });
    expect(controller.snapshot().position).toEqual({ x: 172, y: 28 });
    controller.resize({ width: 400, height: 240 });
    expect(controller.snapshot().position).toEqual({ x: 344, y: 56 });
    controller.resize({ width: 30, height: 20 });
    expect(controller.snapshot().position).toEqual({ x: 15, y: 10 });
  });

  it("caps resumed-frame delta, rejects invalid time and movement, and handles zero-sized scenes", () => {
    const controller = new WardenController({ width: 800, height: 600 });
    controller.update(30, { x: 1, y: 0 });
    expect(controller.snapshot().position.x).toBeCloseTo(406.25);
    controller.update(-3, { x: 1, y: 0 });
    controller.update(Number.NaN, { x: 1, y: 0 });
    controller.update(Number.POSITIVE_INFINITY, { x: 1, y: 0 });
    expect(controller.snapshot().position.x).toBeCloseTo(406.25);
    controller.update(0.05, { x: Number.NaN, y: 1 });
    expect(controller.snapshot().state).toBe("idle");
    controller.resize({ width: 0, height: 0 });
    expect(controller.snapshot().position).toEqual({ x: 0, y: 0 });
    controller.resize({ width: 300, height: 200 });
    expect(controller.snapshot().position).toEqual({ x: 150, y: 100 });
  });
});
