import { describe, expect, it } from "vitest";
import { FIXED_DELTA } from "../data/balance";
import { estimateOfflineHuntRates } from "./offline";
import { createInitialSimulation } from "./stage";
import { startStage } from "./stageProgress";
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

  it("advances waves only after the current wave is wiped out", () => {
    let state = createInitialSimulation(1);
    expect(state.world.wave?.currentWaveIndex).toBe(0);
    expect(state.world.monsters).toHaveLength(2);

    state.world.monsters[0].alive = false;
    state = stepSimulation(state, FIXED_DELTA);
    expect(state.world.wave?.currentWaveIndex).toBe(0);
    expect(state.world.monsters).toHaveLength(2);

    state.world.monsters.forEach((monster) => {
      monster.alive = false;
    });
    state = stepSimulation(state, FIXED_DELTA);

    expect(state.world.wave?.currentWaveIndex).toBe(1);
    expect(state.world.wave?.completedWaves).toBe(1);
    expect(state.world.monsters).toHaveLength(2);
    expect(state.world.monsters.every((monster) => monster.alive)).toBe(true);
  });

  it("restarts the wave cycle after all hunt waves are cleared", () => {
    let state = createInitialSimulation(1);
    const totalWaves = state.world.wave?.totalWaves ?? 0;

    for (let wave = 0; wave < totalWaves; wave += 1) {
      state.world.monsters.forEach((monster) => {
        monster.alive = false;
      });
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.world.wave?.cycle).toBe(1);
    expect(state.world.wave?.currentWaveIndex).toBe(0);
    expect(state.world.monsters.every((monster) => monster.alive)).toBe(true);
  });

  it("clears challenge stages only after all waves are defeated", () => {
    let state = createInitialSimulation(1);
    startStage(state.progress, 1, "challenge");
    const totalWaves = state.world.wave?.totalWaves ?? 0;

    for (let wave = 0; wave < totalWaves - 1; wave += 1) {
      state.world.monsters.forEach((monster) => {
        monster.alive = false;
      });
      state = stepSimulation(state, FIXED_DELTA);
      expect(state.progress.stageProgress.clearedStages[1]).toBeUndefined();
    }

    state.world.monsters.forEach((monster) => {
      monster.alive = false;
    });
    state = stepSimulation(state, FIXED_DELTA);

    expect(state.progress.stageProgress.clearedStages[1]).toBe(true);
    expect(state.progress.stageProgress.mode).toBe("hunt");
  });

  it("scales wave kill pace with player damage", () => {
    let low = createInitialSimulation(1);
    let high = createInitialSimulation(1);
    low.world.player.attack = 1;
    low.world.player.attackCooldown = 2;
    high.world.player.attack = 999;
    high.world.player.attackCooldown = 0.05;
    high.world.player.attackRange = 999;

    for (let i = 0; i < 60 * 20; i += 1) {
      low = stepSimulation(low, FIXED_DELTA);
      high = stepSimulation(high, FIXED_DELTA);
    }

    expect(high.world.wave?.totalKills ?? 0).toBeGreaterThan(low.world.wave?.totalKills ?? 0);
  });

  it("links offline rates to the current build hunt speed estimate", () => {
    const low = createInitialSimulation(1).progress;
    const high = createInitialSimulation(1).progress;
    high.statDistribution.assigned.str = 80;

    const lowRates = estimateOfflineHuntRates(low);
    const highRates = estimateOfflineHuntRates(high);

    expect(highRates.killsPerMinute).toBeGreaterThan(lowRates.killsPerMinute);
    expect(highRates.goldPerMinute).toBeGreaterThan(lowRates.goldPerMinute);
    expect(highRates.experiencePerMinute).toBeGreaterThan(lowRates.experiencePerMinute);
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
