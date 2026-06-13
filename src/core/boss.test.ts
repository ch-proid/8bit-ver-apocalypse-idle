import { describe, expect, it } from "vitest";
import { BOSS_BALANCE, FIXED_DELTA, TICK_RATE } from "../data/balance";
import { BOSS_DEFINITIONS } from "../data/bosses";
import { STAGES } from "../data/stages";
import { rollSlotForStage } from "./drop";
import { createDefaultProgress } from "./progression";
import { createRngState } from "./rng";
import { calculateCombatScore, createBuildSnapshot } from "./sim";
import { createInitialSimulation } from "./stage";
import { clearStage, startStage } from "./stageProgress";
import { stepSimulation } from "./simulation";
import { updateBossMechanics } from "./boss";
import type { EquipmentItem, ItemSlot, ProgressState, SimulationState } from "./types";

describe("phase 3E stages and Lucian boss", () => {
  it("defines sixty stages and marks every tenth stage as a boss", () => {
    expect(Object.keys(STAGES)).toHaveLength(60);
    for (let stageId = 10; stageId <= 60; stageId += 10) {
      expect(STAGES[stageId].isBoss).toBe(true);
      expect(STAGES[stageId].bossId).toBeDefined();
    }
    expect(Object.keys(BOSS_DEFINITIONS)).toHaveLength(6);
    expect(BOSS_DEFINITIONS.gravemaw.mechanic).toBe("stub");
    expect(BOSS_DEFINITIONS.leonid.mechanic).toBe("stub");
  });

  it("unlocks stages through challenge clears up to Lucian", () => {
    const progress = createDefaultProgress(1);

    for (let stageId = 1; stageId <= 9; stageId += 1) {
      expect(startStage(progress, stageId, "challenge")).toBe(true);
      clearStage(progress, stageId);
    }

    expect(progress.stageProgress.unlockedStage).toBe(10);
    expect(startStage(progress, 10, "boss")).toBe(true);
  });

  it("biases hunting-stage drops toward the configured slot", () => {
    const progress = createDefaultProgress(1);
    progress.stageProgress.currentHuntingStage = 1;
    const rng = createRngState(321);
    const counts: Record<ItemSlot, number> = {
      weapon: 0,
      helmet: 0,
      armor: 0,
      accessory: 0,
    };

    for (let i = 0; i < 1000; i += 1) {
      counts[rollSlotForStage(progress, rng)] += 1;
    }

    expect(counts.weapon).toBeGreaterThan(480);
    expect(counts.weapon).toBeGreaterThan(counts.armor);
    expect(counts.weapon).toBeGreaterThan(counts.accessory);
  });

  it("summons Lucian wraiths every fifteen seconds and heals while they live", () => {
    const state = createLucianState(0);
    const boss = bossMonster(state);
    boss.hp -= 300;

    advanceBossOnly(state, BOSS_BALANCE.lucian.summonIntervalSeconds);
    const wraiths = state.world.monsters.filter((monster) => monster.role === "bossSummon" && monster.alive);
    const damagedHp = boss.hp;

    expect(wraiths).toHaveLength(BOSS_BALANCE.lucian.summonCount);
    advanceBossOnly(state, 1);
    expect(boss.hp).toBeGreaterThan(damagedHp);
  });

  it("retargets to Lucian summons before the boss", () => {
    let state = createLucianState(0);
    advanceBossOnly(state, BOSS_BALANCE.lucian.summonIntervalSeconds);

    state = stepSimulation(state, FIXED_DELTA);

    const target = state.world.monsters.find((monster) => monster.instanceId === state.world.player.targetId);
    expect(target?.role).toBe("bossSummon");
  });

  it("blocks weak DPS but lets strong DPS kill Lucian and unlock rebirth plus pride gate", () => {
    let weak = createLucianState(0, 10);
    for (let i = 0; i < TICK_RATE * 70; i += 1) {
      weak = stepSimulation(weak, FIXED_DELTA);
    }
    expect(weak.progress.rebirth.canRebirth).toBe(false);

    let strong = createLucianState(320, 10);
    for (let i = 0; i < TICK_RATE * 40; i += 1) {
      strong = stepSimulation(strong, FIXED_DELTA);
    }

    expect(strong.progress.rebirth.canRebirth).toBe(true);
    expect(strong.progress.altar.bossDefeated.pride).toBe(true);
    expect(strong.progress.stageProgress.defeatedBossStages[10]).toBe(true);
  });

  it("keeps boss-inclusive simulations deterministic", () => {
    let runA = createLucianState(80, 77);
    let runB = createLucianState(80, 77);

    for (let i = 0; i < TICK_RATE * 30; i += 1) {
      runA = stepSimulation(runA, FIXED_DELTA);
      runB = stepSimulation(runB, FIXED_DELTA);
    }

    expect(runA.world).toEqual(runB.world);
    expect(runA.progress).toEqual(runB.progress);
  });

  it("does not change standard dummy score determinism", () => {
    const snapshot = createBuildSnapshot(createDefaultProgress(1));

    expect(calculateCombatScore(snapshot)).toBe(calculateCombatScore(snapshot));
  });
});

function createLucianState(weaponAttack: number, seed = 1): SimulationState {
  const progress = createDefaultProgress(10);
  progress.stageProgress.unlockedStage = 10;
  startStage(progress, 10, "boss");
  if (weaponAttack > 0) {
    progress.inventory.equipped.weapon = makeWeapon("boss-test", weaponAttack);
  }
  return createInitialSimulation(10, progress, seed);
}

function advanceBossOnly(state: SimulationState, seconds: number): void {
  for (let i = 0; i < seconds * TICK_RATE; i += 1) {
    updateBossMechanics(state, FIXED_DELTA);
  }
}

function bossMonster(state: SimulationState) {
  const boss = state.world.monsters.find((monster) => monster.role === "boss");
  if (!boss) {
    throw new Error("boss not found");
  }
  return boss;
}

function makeWeapon(id: string, baseValue: number): EquipmentItem {
  return {
    id,
    slot: "weapon",
    rarity: "legendary",
    itemLevel: 10,
    baseStat: "atk",
    baseValue,
    options: [
      { key: "damageIncrease", value: 30, sin: false },
      { key: "attackSpeed", value: 50, sin: false },
    ],
  };
}
