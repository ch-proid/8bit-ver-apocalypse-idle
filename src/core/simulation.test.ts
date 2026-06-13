import { describe, expect, it } from "vitest";
import { FIXED_DELTA, MONSTER_BALANCE, nextExperienceForLevel } from "../data/balance";
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

  it("accumulates combat progress without rapid early leveling", () => {
    let state = createInitialSimulation(1);

    for (let i = 0; i < 60 * 90; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.progress.level).toBe(1);
    expect(state.progress.experience).toBeGreaterThan(0);
    expect(state.progress.experience).toBeLessThan(state.progress.nextExperience);
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

  it("keeps newly spawned monsters still and invulnerable until their intro ends", () => {
    let state = createInitialSimulation(1);
    const monster = state.world.monsters[0];
    const startX = monster.position.x;
    const startHp = monster.hp;

    state.world.player.platformId = monster.platformId;
    state.world.player.position.x = monster.position.x;
    state.world.player.position.y = monster.position.y;
    state.world.player.attackRange = 999;
    state.world.player.attackCooldown = 0.01;
    state.world.player.attackTimer = 0;

    expect(monster.spawnInvulnTimer).toBe(MONSTER_BALANCE.spawnIntroSeconds);
    state = stepSimulation(state, FIXED_DELTA);

    expect(state.world.monsters[0].position.x).toBe(startX);
    expect(state.world.monsters[0].hp).toBe(startHp);
    expect(state.world.monsters[0].spawnInvulnTimer).toBeLessThan(MONSTER_BALANCE.spawnIntroSeconds);

    state.world.player.attackRange = 0;
    for (let i = 0; i < 60; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }
    state.world.player.attackTimer = 0;
    state.world.player.attackRange = 999;
    state.world.player.platformId = state.world.monsters[0].platformId;
    state.world.player.position.x = state.world.monsters[0].position.x;
    state.world.player.position.y = state.world.monsters[0].position.y;
    state = stepSimulation(state, FIXED_DELTA);

    expect(state.world.monsters[0].spawnInvulnTimer).toBe(0);
    expect(state.world.monsters[0].hp).toBeLessThan(startHp);
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

  it("chases the player after being hit while unhit monsters keep patrolling", () => {
    let unhit = createInitialSimulation(1);
    unhit.world.player.position.x = 20;
    unhit.world.player.attackRange = 0;
    unhit.world.player.moveSpeed = 0;
    unhit.world.monsters[0].spawnInvulnTimer = 0;
    unhit.world.monsters[0].aggro = false;
    unhit.world.monsters[0].position.x = 100;
    unhit.world.monsters[0].direction = 1;
    unhit = stepSimulation(unhit, FIXED_DELTA);
    expect(unhit.world.monsters[0].position.x).toBeGreaterThan(100);

    let aggro = createInitialSimulation(1);
    aggro.world.player.position.x = 20;
    aggro.world.player.attackRange = 0;
    aggro.world.player.moveSpeed = 0;
    aggro.world.monsters[0].spawnInvulnTimer = 0;
    aggro.world.monsters[0].aggro = true;
    aggro.world.monsters[0].position.x = 100;
    aggro.world.monsters[0].direction = 1;
    aggro = stepSimulation(aggro, FIXED_DELTA);
    expect(aggro.world.monsters[0].position.x).toBeLessThan(100);

    let hit = createInitialSimulation(1);
    const target = hit.world.monsters[0];
    target.spawnInvulnTimer = 0;
    target.evasion = 0;
    target.hp = target.maxHp * 10;
    target.maxHp = target.hp;
    hit.world.player.platformId = target.platformId;
    hit.world.player.position.x = target.position.x;
    hit.world.player.position.y = target.position.y;
    hit.world.player.attackRange = 999;
    hit.world.player.attackTimer = 0;
    hit = stepSimulation(hit, FIXED_DELTA);
    expect(hit.world.monsters[0].aggro).toBe(true);
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
    low.world.player.attackCooldown = 10;
    high.world.player.attack = 999;
    high.world.player.attackCooldown = 0.05;
    high.world.player.attackRange = 999;

    for (let i = 0; i < 60 * 60; i += 1) {
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

  it("keeps blocked offline experience near one level over twelve hours", () => {
    const progress = createInitialSimulation(1).progress;
    const rates = estimateOfflineHuntRates(progress);
    const twelveHourExperience = rates.experiencePerMinute * 60 * 12;
    const nextLevel = nextExperienceForLevel(progress.level);

    expect(twelveHourExperience).toBeGreaterThan(nextLevel * 0.75);
    expect(twelveHourExperience).toBeLessThan(nextLevel * 1.25);
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
