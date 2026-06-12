import { describe, expect, it } from "vitest";
import { FIXED_DELTA } from "../data/balance";
import { createInitialSimulation } from "./stage";
import { stepSimulation } from "./simulation";

describe("phase 2 simulation", () => {
  it("keeps Pixi-free core combat running and grants rewards", () => {
    let state = createInitialSimulation(1);

    for (let i = 0; i < 60 * 20; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.progress.gold).toBeGreaterThan(0);
    expect(state.progress.experience).toBeGreaterThanOrEqual(0);
    expect(state.progress.level).toBeGreaterThanOrEqual(1);
  });

  it("levels up from repeated automatic combat", () => {
    let state = createInitialSimulation(1);

    for (let i = 0; i < 60 * 90; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.progress.level).toBeGreaterThan(1);
    expect(state.world.player.attack).toBeGreaterThan(16);
  });

  it("keeps the entire simulation deterministic for identical initial state", () => {
    let runA = createInitialSimulation(1);
    let runB = createInitialSimulation(1);

    for (let i = 0; i < 60 * 30; i += 1) {
      runA = stepSimulation(runA, FIXED_DELTA);
      runB = stepSimulation(runB, FIXED_DELTA);
    }

    expect(runA).toEqual(runB);
  });

  it("walks completely off an elevated platform instead of stopping on the edge", () => {
    let state = createInitialSimulation(1);
    const platform = state.world.platforms.find((item) => item.id === "low-left");
    const floorMonster = state.world.monsters.find((monster) => monster.platformId === "floor");

    if (!platform || !floorMonster) {
      throw new Error("test stage is missing required platform or floor monster");
    }

    state.world.player.platformId = platform.id;
    state.world.player.position.x = platform.x + platform.width - state.world.player.width - 2;
    state.world.player.position.y = platform.y - state.world.player.height;
    state.world.player.velocity.x = 0;
    state.world.player.velocity.y = 0;
    state.world.player.targetId = floorMonster.instanceId;

    for (let i = 0; i < 60 * 2; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.world.player.position.y).toBeGreaterThan(platform.y - state.world.player.height + 6);
  });
});
