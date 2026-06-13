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
import {
  applyBossKillEffects,
  bossDamageTakenMultiplier,
  bossPlayerRegenMultiplier,
  resolveBossDefeat,
  triggerAltarCounter,
  updateBossMechanics,
} from "./boss";
import type { BossId, EquipmentItem, ItemSlot, ProgressState, SimulationState, Monster } from "./types";

describe("phase 3E stages and Lucian boss", () => {
  it("defines sixty stages and marks every tenth stage as a boss", () => {
    expect(Object.keys(STAGES)).toHaveLength(60);
    for (let stageId = 10; stageId <= 60; stageId += 10) {
      expect(STAGES[stageId].isBoss).toBe(true);
      expect(STAGES[stageId].bossId).toBeDefined();
    }
    expect(Object.keys(BOSS_DEFINITIONS)).toHaveLength(6);
    expect(BOSS_DEFINITIONS.gravemaw.mechanic).toBe("gravemawRegen");
    expect(BOSS_DEFINITIONS.leonid.mechanic).toBe("leonidAltarCounter");
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

describe("phase 3E-2 boss mechanics", () => {
  it("doubles Gravemaw regeneration below fifty percent hp", () => {
    const state = createBossState(20);
    const boss = bossMonster(state);
    boss.hp = boss.maxHp * 0.75;
    const normalStart = boss.hp;
    advanceBossOnly(state, 1);
    const normalHeal = boss.hp - normalStart;

    boss.hp = boss.maxHp * 0.49;
    const lowStart = boss.hp;
    advanceBossOnly(state, 1);
    const lowHeal = boss.hp - lowStart;

    expect(lowHeal).toBeGreaterThan(normalHeal * 1.9);
    expect(state.world.boss?.phase).toBe(2);
  });

  it("spawns Marcela seeds and germinates uncleared seeds into global damage", () => {
    const state = createBossState(30);
    state.world.player.hp = state.world.player.maxHp;

    advanceBossOnly(state, BOSS_BALANCE.marcela.seedIntervalSeconds);
    expect(bossSummons(state, "marcela")).toHaveLength(BOSS_BALANCE.marcela.seedCount);

    advanceBossOnly(state, BOSS_BALANCE.marcela.seedGerminateSeconds + 1);
    expect(state.world.boss?.germinatedSummons).toBeGreaterThan(0);
    expect(state.world.player.hp).toBeLessThan(state.world.player.maxHp);
  });

  it("enrages Cardion below forty percent hp and halves player recovery", () => {
    const state = createBossState(40);
    const boss = bossMonster(state);
    boss.hp = boss.maxHp * 0.39;

    updateBossMechanics(state, FIXED_DELTA);

    expect(state.world.boss?.isEnraged).toBe(true);
    expect(state.world.boss?.phase).toBe(2);
    expect(bossPlayerRegenMultiplier(state.world)).toBe(BOSS_BALANCE.cardion.playerRegenMultiplier);
  });

  it("applies Azar marks, clears them on kill, and lowers defense in phase two", () => {
    const marked = createBossState(50);
    marked.world.player.hp = marked.world.player.maxHp / 2;
    advanceBossOnly(marked, BOSS_BALANCE.azar.markIntervalSeconds);
    expect(marked.world.boss?.playerMarked).toBe(true);
    const hpBeforeClear = marked.world.player.hp;

    applyBossKillEffects(marked, bossMonster(marked));
    expect(marked.world.boss?.playerMarked).toBe(false);
    expect(marked.world.player.hp).toBeGreaterThan(hpBeforeClear);

    const phaseTwo = createBossState(50);
    const boss = bossMonster(phaseTwo);
    boss.hp = boss.maxHp * 0.29;
    updateBossMechanics(phaseTwo, FIXED_DELTA);

    expect(phaseTwo.world.boss?.phase).toBe(2);
    expect(phaseTwo.world.boss?.permanentMark).toBe(true);
    expect(phaseTwo.world.boss?.playerMarked).toBe(true);
    expect(boss.defense).toBe(Math.floor(BOSS_DEFINITIONS.azar.defense * BOSS_BALANCE.azar.phaseTwoDefenseMultiplier));
  });

  it("runs Leonid telegraph success path by consuming blood and weakening the boss", () => {
    const state = createBossState(60);
    const boss = bossMonster(state);
    state.progress.altar.blood = BOSS_BALANCE.leonid.altarCounterBloodCost;
    boss.hp = boss.maxHp * 0.49;

    updateBossMechanics(state, FIXED_DELTA);
    expect(state.world.boss?.isTelegraphing).toBe(true);
    expect(state.world.boss?.telegraphTimer).toBe(BOSS_BALANCE.leonid.telegraphDurationSeconds);

    expect(triggerAltarCounter(state)).toBe(true);
    expect(state.progress.altar.blood).toBe(0);
    expect(state.world.boss?.isWeakened).toBe(true);
    expect(bossDamageTakenMultiplier(state.world, boss)).toBe(BOSS_BALANCE.leonid.weakenDamageTakenMultiplier);
  });

  it("runs Leonid telegraph failure path and shortens the next period by hp threshold", () => {
    const mid = createBossState(60);
    const midBoss = bossMonster(mid);
    midBoss.hp = midBoss.maxHp * 0.49;
    updateBossMechanics(mid, FIXED_DELTA);
    advanceBossOnly(mid, BOSS_BALANCE.leonid.telegraphDurationSeconds);

    expect(mid.world.boss?.isEnraged).toBe(true);
    expect(mid.world.boss?.enrageTimer).toBe(BOSS_BALANCE.leonid.enrageDurationSeconds);
    expect(mid.world.boss?.nextMechanicAt).toBeCloseTo(mid.world.boss!.elapsed + 45, 5);

    const low = createBossState(60);
    const lowBoss = bossMonster(low);
    lowBoss.hp = lowBoss.maxHp * 0.29;
    updateBossMechanics(low, FIXED_DELTA);
    advanceBossOnly(low, BOSS_BALANCE.leonid.telegraphDurationSeconds);
    expect(low.world.boss?.nextMechanicAt).toBeCloseTo(low.world.boss!.elapsed + 30, 5);

    const critical = createBossState(60);
    const criticalBoss = bossMonster(critical);
    criticalBoss.hp = criticalBoss.maxHp * 0.14;
    updateBossMechanics(critical, FIXED_DELTA);
    advanceBossOnly(critical, BOSS_BALANCE.leonid.telegraphDurationSeconds);
    expect(critical.world.boss?.nextMechanicAt).toBeCloseTo(critical.world.boss!.elapsed + 20, 5);
  });

  it("opens the matching relic boss gate when each boss dies", () => {
    const pairs: Array<[number, keyof ProgressState["altar"]["bossDefeated"]]> = [
      [10, "pride"],
      [20, "gluttony"],
      [30, "grief"],
      [40, "fanaticism"],
      [50, "abyss"],
      [60, "despair"],
    ];

    for (const [stageId, sin] of pairs) {
      const state = createBossState(stageId);
      resolveBossDefeat(state, bossMonster(state));
      expect(state.progress.altar.bossDefeated[sin]).toBe(true);
    }
  });

  it("keeps every new boss fight deterministic and leaves dummy score deterministic", () => {
    for (const stageId of [20, 30, 40, 50, 60]) {
      let runA = createBossState(stageId, 120, 2026);
      let runB = createBossState(stageId, 120, 2026);

      for (let i = 0; i < TICK_RATE * 30; i += 1) {
        runA = stepSimulation(runA, FIXED_DELTA);
        runB = stepSimulation(runB, FIXED_DELTA);
      }

      expect(runA.world).toEqual(runB.world);
      expect(runA.progress).toEqual(runB.progress);
    }

    const snapshot = createBuildSnapshot(createDefaultProgress(1));
    expect(calculateCombatScore(snapshot)).toBe(calculateCombatScore(snapshot));
  });
});

function createLucianState(weaponAttack: number, seed = 1): SimulationState {
  return createBossState(10, weaponAttack, seed);
}

function createBossState(stageId: number, weaponAttack = 0, seed = 1): SimulationState {
  const progress = createDefaultProgress(stageId);
  progress.stageProgress.unlockedStage = stageId;
  startStage(progress, stageId, "boss");
  if (weaponAttack > 0) {
    progress.inventory.equipped.weapon = makeWeapon("boss-test", weaponAttack);
  }
  return createInitialSimulation(stageId, progress, seed);
}

function advanceBossOnly(state: SimulationState, seconds: number): void {
  for (let i = 0; i < Math.floor(seconds * TICK_RATE); i += 1) {
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

function bossSummons(state: SimulationState, bossId: BossId): Monster[] {
  return state.world.monsters.filter((monster) => monster.role === "bossSummon" && monster.bossId === bossId && monster.alive);
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
