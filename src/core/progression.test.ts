import { describe, expect, it } from "vitest";
import { EXPERIENCE_CURVE, nextExperienceForLevel, PLAYER_BALANCE, REBIRTH_BALANCE, STAT_GROWTH } from "../data/balance";
import { PLAYER_CLASSES } from "../data/classes";
import { MONSTERS } from "../data/monsters";
import { createAltarEliteMonster } from "./elites";
import { createDefaultProgress, gainExperience, normalizeProgress } from "./progression";
import { canRebirth, rebirthSimulation } from "./rebirth";
import { rebirthStatMultiplier } from "./rebirthScaling";
import { createInitialSimulation, normalMonsterStatsForStage } from "./stage";
import {
  applyLevelStatPoints,
  combatPowerEstimate,
  calculatePlayerStats,
  createDefaultStatDistribution,
  createRecommendedStatDistribution,
  totalAllocatedPoints,
} from "./stats";

describe("phase 3A progression", () => {
  it("keeps the double-knee experience curve monotonic and steeper after each knee", () => {
    for (let level = 1; level < 120; level += 1) {
      expect(nextExperienceForLevel(level + 1)).toBeGreaterThan(nextExperienceForLevel(level));
    }

    const preFirstKneeDelta = nextExperienceForLevel(EXPERIENCE_CURVE.firstKneeLevel)
      - nextExperienceForLevel(EXPERIENCE_CURVE.firstKneeLevel - 1);
    const postFirstKneeDelta = nextExperienceForLevel(EXPERIENCE_CURVE.firstKneeLevel + 1)
      - nextExperienceForLevel(EXPERIENCE_CURVE.firstKneeLevel);
    const preSecondKneeDelta = nextExperienceForLevel(EXPERIENCE_CURVE.secondKneeLevel)
      - nextExperienceForLevel(EXPERIENCE_CURVE.secondKneeLevel - 1);
    const postSecondKneeDelta = nextExperienceForLevel(EXPERIENCE_CURVE.secondKneeLevel + 1)
      - nextExperienceForLevel(EXPERIENCE_CURVE.secondKneeLevel);

    expect(postFirstKneeDelta).toBeGreaterThan(preFirstKneeDelta);
    expect(postSecondKneeDelta).toBeGreaterThan(preSecondKneeDelta);
  });

  it("grants five stat points per level through the stat pipeline", () => {
    const state = createInitialSimulation(1);

    gainExperience(state.progress, state.world, nextExperienceForLevel(1));

    expect(state.progress.level).toBe(2);
    expect(totalAllocatedPoints(state.progress.statDistribution.assigned)).toBe(STAT_GROWTH.pointsPerLevel);
    expect(state.progress.statDistribution.assigned).toEqual({ str: 3, grit: 2, agi: 0 });
    expect(state.progress.statDistribution.unspentPoints).toBe(0);
    expect(state.world.player.attack).toBeGreaterThan(PLAYER_BALANCE.attack);
  });

  it("applies automatic presets and accumulates manual points", () => {
    const str = applyLevelStatPoints(createDefaultStatDistribution("STR"), STAT_GROWTH.pointsPerLevel);
    const bal = applyLevelStatPoints(createDefaultStatDistribution("BAL"), STAT_GROWTH.pointsPerLevel);
    const grit = applyLevelStatPoints(createDefaultStatDistribution("GRIT"), STAT_GROWTH.pointsPerLevel);
    const agi = applyLevelStatPoints(createDefaultStatDistribution("AGI"), STAT_GROWTH.pointsPerLevel);
    const manual = applyLevelStatPoints(createDefaultStatDistribution("MANUAL"), STAT_GROWTH.pointsPerLevel);

    expect(str.assigned).toEqual({ str: 5, grit: 0, agi: 0 });
    expect(bal.assigned).toEqual({ str: 3, grit: 1, agi: 1 });
    expect(grit.assigned).toEqual({ str: 3, grit: 2, agi: 0 });
    expect(agi.assigned).toEqual({ str: 3, grit: 0, agi: 2 });
    expect(manual.assigned).toEqual({ str: 0, grit: 0, agi: 0 });
    expect(manual.unspentPoints).toBe(STAT_GROWTH.pointsPerLevel);
  });

  it("applies class growth, hp differences, range, and evasion profile", () => {
    const assassin = progressForClass("assassin", 12);
    const knight = progressForClass("knight", 12);
    const mage = progressForClass("mage", 12);

    const assassinStats = calculatePlayerStats(assassin);
    const knightStats = calculatePlayerStats(knight);
    const mageStats = calculatePlayerStats(mage);

    expect(knightStats.maxHp).toBeGreaterThan(assassinStats.maxHp);
    expect(knightStats.maxHp).toBeGreaterThan(mageStats.maxHp);
    expect(assassinStats.evasion).toBeGreaterThan(knightStats.evasion);
    expect(mageStats.attackRange).toBeGreaterThan(knightStats.attackRange);
    expect(PLAYER_CLASSES.assassin.passive.key).toBe("assassinCrit");
    expect(PLAYER_CLASSES.knight.passive.key).toBe("knightExecution");
    expect(PLAYER_CLASSES.mage.passive.key).toBe("mageDot");
  });

  it("aggregates STR GRIT AGI multiplicatively into derived stats", () => {
    const progress = progressForClass("assassin", 1);
    progress.statDistribution = {
      assigned: { str: 10, grit: 10, agi: 10 },
      unspentPoints: 0,
      preset: "MANUAL",
    };

    const stats = calculatePlayerStats(progress);

    expect(stats.attack).toBeCloseTo(PLAYER_BALANCE.attack * 1.2, 2);
    expect(stats.maxHp).toBeCloseTo(PLAYER_BALANCE.maxHp * 1.1, 2);
    expect(stats.evasion).toBeCloseTo(PLAYER_BALANCE.evasion * 1.25, 2);
  });

  it("requires level 40 and stage 6-10 clear before rebirth", () => {
    const state = createInitialSimulation(1);
    state.progress.level = REBIRTH_BALANCE.requiredLevel - 1;
    state.progress.stageProgress.clearedStages[REBIRTH_BALANCE.requiredStageId] = true;

    expect(canRebirth(state.progress)).toBe(false);

    state.progress.level = REBIRTH_BALANCE.requiredLevel;
    expect(canRebirth(state.progress)).toBe(true);

    delete state.progress.stageProgress.clearedStages[REBIRTH_BALANCE.requiredStageId];
    delete state.progress.stageProgress.defeatedBossStages[REBIRTH_BALANCE.requiredStageId];
    expect(canRebirth(state.progress)).toBe(false);
  });

  it("makes higher stages the main experience accelerator", () => {
    const early = normalMonsterStatsForStage(1, MONSTERS.wildDog, 0);
    const late = normalMonsterStatsForStage(REBIRTH_BALANCE.requiredStageId, MONSTERS.wildDog, 0);

    expect(late.experience).toBeGreaterThan(early.experience);
    expect(late.experience / early.experience).toBeGreaterThan(5);
  });

  it("resets only stage progression on rebirth while preserving level stats resources and records", () => {
    const state = createInitialSimulation(1);
    state.progress.classId = "assassin";
    state.progress.gold = 500;
    state.progress.crystal = 12;
    state.progress.currentStage = REBIRTH_BALANCE.requiredStageId;
    state.progress.stageProgress.unlockedStage = REBIRTH_BALANCE.requiredStageId;
    state.progress.stageProgress.clearedStages[REBIRTH_BALANCE.requiredStageId] = true;
    state.progress.level = 43;
    state.progress.experience = 777;
    state.progress.nextExperience = nextExperienceForLevel(43);
    const distribution = applyLevelStatPoints(
      createDefaultStatDistribution("BAL"),
      STAT_GROWTH.pointsPerLevel * 4,
    );
    state.progress.statDistribution = distribution;

    expect(canRebirth(state.progress)).toBe(true);

    const reborn = rebirthSimulation(state, 123456);

    expect(reborn.progress.classId).toBe("assassin");
    expect(reborn.progress.gold).toBe(500);
    expect(reborn.progress.crystal).toBe(12);
    expect(reborn.progress.currentStage).toBe(1);
    expect(reborn.progress.stageProgress.unlockedStage).toBe(1);
    expect(reborn.progress.level).toBe(43);
    expect(reborn.progress.experience).toBe(777);
    expect(reborn.progress.nextExperience).toBe(nextExperienceForLevel(43));
    expect(reborn.progress.statDistribution).toEqual(distribution);
    expect(reborn.progress.rebirth.count).toBe(1);
    expect(reborn.progress.rebirth.multiplier).toBe(rebirthStatMultiplier(1));
    expect(reborn.progress.records.highestLevel).toEqual({ value: 43, updatedAt: 123456 });
    expect(reborn.progress.records.highestRebirthStage).toEqual({ value: REBIRTH_BALANCE.requiredStageId, updatedAt: 123456 });
    expect(reborn.progress.rebirthRecords).toEqual([
      { run: 1, reachedStage: REBIRTH_BALANCE.requiredStageId, reachedLevel: 43, at: 123456 },
    ]);
  });

  it("applies the rebirth multiplier to stats while leaving direct experience grants unmultiplied", () => {
    const state = createInitialSimulation(1);
    const baseStats = calculatePlayerStats(state.progress);
    const basePower = combatPowerEstimate(state.progress);

    state.progress.rebirth.count = 2;
    state.progress.rebirth.multiplier = rebirthStatMultiplier(2);
    const rebornStats = calculatePlayerStats(state.progress);

    gainExperience(state.progress, state.world, 10);

    expect(rebornStats.attack).toBeGreaterThan(baseStats.attack);
    expect(rebornStats.maxHp).toBeGreaterThan(baseStats.maxHp);
    expect(combatPowerEstimate(state.progress)).toBeGreaterThan(basePower);
    expect(state.progress.level).toBe(1);
    expect(state.progress.experience).toBe(10);
  });

  it("scales normal bosses and altar elites by rebirth count", () => {
    const normalBase = normalMonsterStatsForStage(1, MONSTERS.wildDog, 0);
    const normalReborn = normalMonsterStatsForStage(1, MONSTERS.wildDog, 3);

    expect(normalReborn.maxHp).toBeGreaterThan(normalBase.maxHp);
    expect(normalReborn.attack).toBeGreaterThan(normalBase.attack);
    expect(normalReborn.gold).toBeGreaterThan(normalBase.gold);
    expect(normalReborn.experience).toBeGreaterThan(normalBase.experience);

    const baseBoss = createInitialSimulation(10);
    const rebornBossProgress = createDefaultProgress(10);
    rebornBossProgress.rebirth.count = 3;
    const rebornBoss = createInitialSimulation(10, rebornBossProgress);
    expect(rebornBoss.world.monsters[0].maxHp).toBeGreaterThan(baseBoss.world.monsters[0].maxHp);
    expect(rebornBoss.world.monsters[0].attack).toBeGreaterThan(baseBoss.world.monsters[0].attack);
    expect(rebornBoss.world.monsters[0].gold).toBeGreaterThan(baseBoss.world.monsters[0].gold);
    expect(rebornBoss.world.monsters[0].experience).toBeGreaterThan(baseBoss.world.monsters[0].experience);

    const baseEliteState = createInitialSimulation(1);
    const rebornEliteState = createInitialSimulation(1);
    rebornEliteState.progress.rebirth.count = 3;
    const baseElite = createAltarEliteMonster(baseEliteState);
    const rebornElite = createAltarEliteMonster(rebornEliteState);
    expect(rebornElite.maxHp).toBeGreaterThan(baseElite.maxHp);
    expect(rebornElite.attack).toBeGreaterThan(baseElite.attack);
    expect(rebornElite.gold).toBeGreaterThan(baseElite.gold);
    expect(rebornElite.experience).toBeGreaterThan(baseElite.experience);
  });

  it("migrates missing class and old four-stat progression fields with current defaults", () => {
    const progress = normalizeProgress({
      gold: 25,
      level: 12,
      currentStage: 1,
      experience: 5,
      statDistribution: {
        assigned: { atk: 99, def: 99, hp: 99, reg: 99 } as never,
        unspentPoints: 2,
        preset: "ATK" as never,
      },
      rebirth: {
        count: 2,
        experienceMultiplier: 1.8,
        permanentStats: { str: 99, grit: 99, agi: 99 },
      } as never,
    });

    expect(progress.gold).toBe(25);
    expect(progress.crystal).toBe(0);
    expect(progress.classId).toBe("knight");
    expect(progress.nextExperience).toBe(nextExperienceForLevel(12));
    expect(progress.statDistribution).toEqual({
      assigned: { str: 0, grit: 0, agi: 0 },
      unspentPoints: 2,
      preset: "GRIT",
    });
    expect(progress.rebirth.multiplier).toBe(rebirthStatMultiplier(2));
    expect("experienceMultiplier" in progress.rebirth).toBe(false);
    expect("permanentStats" in progress.rebirth).toBe(false);
    expect(progress.records.highestLevel.value).toBe(12);
  });

  it("calculates a count-based permanent stat multiplier", () => {
    expect(rebirthStatMultiplier(0)).toBe(1);
    expect(rebirthStatMultiplier(1)).toBeGreaterThan(1);
    expect(rebirthStatMultiplier(2)).toBeGreaterThan(rebirthStatMultiplier(1));
  });
});

function progressForClass(classId: "assassin" | "knight" | "mage", level: number) {
  const progress = createDefaultProgress(1);
  progress.classId = classId;
  progress.level = level;
  progress.statDistribution = createRecommendedStatDistribution(classId);
  return progress;
}
