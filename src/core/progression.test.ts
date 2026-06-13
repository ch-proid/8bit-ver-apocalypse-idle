import { describe, expect, it } from "vitest";
import { EXPERIENCE_CURVE, nextExperienceForLevel, PLAYER_BALANCE, STAT_GROWTH } from "../data/balance";
import { PLAYER_CLASSES } from "../data/classes";
import { createDefaultProgress, gainExperience, normalizeProgress } from "./progression";
import { calculateRebirthExperienceMultiplier, rebirthSimulation } from "./rebirth";
import { createInitialSimulation } from "./stage";
import {
  applyLevelStatPoints,
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

  it("resets run progression on rebirth while preserving gold records and class choice", () => {
    const state = createInitialSimulation(1);
    state.progress.classId = "assassin";
    state.progress.gold = 500;
    state.progress.currentStage = 6;
    state.progress.level = 43;
    state.progress.experience = 777;
    state.progress.nextExperience = nextExperienceForLevel(43);
    state.progress.statDistribution = applyLevelStatPoints(
      createDefaultStatDistribution("BAL"),
      STAT_GROWTH.pointsPerLevel * 4,
    );
    state.progress.rebirth.canRebirth = true;

    const reborn = rebirthSimulation(state, 123456);

    expect(reborn.progress.classId).toBe("assassin");
    expect(reborn.progress.gold).toBe(500);
    expect(reborn.progress.currentStage).toBe(1);
    expect(reborn.progress.level).toBe(1);
    expect(reborn.progress.experience).toBe(0);
    expect(reborn.progress.statDistribution).toEqual(createRecommendedStatDistribution("assassin"));
    expect(reborn.progress.rebirth.count).toBe(1);
    expect(reborn.progress.rebirth.experienceMultiplier).toBeGreaterThan(1);
    expect(reborn.progress.rebirth.permanentStats.str).toBeGreaterThan(0);
    expect(reborn.progress.records.highestLevel).toEqual({ value: 43, updatedAt: 123456 });
    expect(reborn.progress.records.highestRebirthStage).toEqual({ value: 6, updatedAt: 123456 });
    expect(reborn.progress.rebirthRecords).toEqual([
      { run: 1, reachedStage: 6, reachedLevel: 43, at: 123456 },
    ]);
  });

  it("applies permanent experience multiplier after rebirth", () => {
    const state = createInitialSimulation(1);
    state.progress.rebirth.experienceMultiplier = 2;

    gainExperience(state.progress, state.world, 10);

    expect(state.progress.level).toBe(1);
    expect(state.progress.experience).toBe(20);
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
    });

    expect(progress.gold).toBe(25);
    expect(progress.classId).toBe("knight");
    expect(progress.nextExperience).toBe(nextExperienceForLevel(12));
    expect(progress.statDistribution).toEqual({
      assigned: { str: 0, grit: 0, agi: 0 },
      unspentPoints: 2,
      preset: "GRIT",
    });
    expect(progress.rebirth.experienceMultiplier).toBe(1);
    expect(progress.records.highestLevel.value).toBe(12);
  });

  it("calculates a rebirth multiplier from level, power, and run count", () => {
    expect(calculateRebirthExperienceMultiplier(40, 300, 1)).toBeGreaterThan(1);
  });
});

function progressForClass(classId: "assassin" | "knight" | "mage", level: number) {
  const progress = createDefaultProgress(1);
  progress.classId = classId;
  progress.level = level;
  progress.statDistribution = createRecommendedStatDistribution(classId);
  return progress;
}
