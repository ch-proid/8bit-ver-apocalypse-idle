import { describe, expect, it } from "vitest";
import { EXPERIENCE_CURVE, nextExperienceForLevel, PLAYER_BALANCE, STAT_GROWTH } from "../data/balance";
import { createDefaultProgress, gainExperience, normalizeProgress } from "./progression";
import { calculateRebirthExperienceMultiplier, rebirthSimulation } from "./rebirth";
import { createInitialSimulation } from "./stage";
import {
  applyLevelStatPoints,
  createDefaultStatDistribution,
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

  it("grants three stat points per level through the stat pipeline", () => {
    const state = createInitialSimulation(1);

    gainExperience(state.progress, state.world, nextExperienceForLevel(1));

    expect(state.progress.level).toBe(2);
    expect(totalAllocatedPoints(state.progress.statDistribution.assigned)).toBe(STAT_GROWTH.pointsPerLevel);
    expect(state.progress.statDistribution.unspentPoints).toBe(0);
    expect(state.world.player.attack).toBeGreaterThan(PLAYER_BALANCE.attack);
  });

  it("applies automatic presets and accumulates manual points", () => {
    const atk = applyLevelStatPoints(createDefaultStatDistribution("ATK"), STAT_GROWTH.pointsPerLevel);
    const bal = applyLevelStatPoints(createDefaultStatDistribution("BAL"), STAT_GROWTH.pointsPerLevel);
    const vit = applyLevelStatPoints(createDefaultStatDistribution("VIT"), STAT_GROWTH.pointsPerLevel);
    const manual = applyLevelStatPoints(createDefaultStatDistribution("MANUAL"), STAT_GROWTH.pointsPerLevel);

    expect(atk.assigned).toEqual({ atk: 3, def: 0, hp: 0, reg: 0 });
    expect(bal.assigned).toEqual({ atk: 1, def: 1, hp: 1, reg: 0 });
    expect(vit.assigned).toEqual({ atk: 0, def: 1, hp: 2, reg: 0 });
    expect(manual.assigned).toEqual({ atk: 0, def: 0, hp: 0, reg: 0 });
    expect(manual.unspentPoints).toBe(STAT_GROWTH.pointsPerLevel);
  });

  it("resets run progression on rebirth while preserving gold and records", () => {
    const state = createInitialSimulation(1);
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

    expect(reborn.progress.gold).toBe(500);
    expect(reborn.progress.currentStage).toBe(1);
    expect(reborn.progress.level).toBe(1);
    expect(reborn.progress.experience).toBe(0);
    expect(reborn.progress.statDistribution).toEqual(createDefaultStatDistribution("ATK"));
    expect(reborn.progress.rebirth.count).toBe(1);
    expect(reborn.progress.rebirth.experienceMultiplier).toBeGreaterThan(1);
    expect(reborn.progress.rebirth.permanentStats.atk).toBeGreaterThan(0);
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

  it("migrates missing progression fields with current defaults", () => {
    const progress = normalizeProgress({
      gold: 25,
      level: 12,
      currentStage: 1,
      experience: 5,
    });

    expect(progress.gold).toBe(25);
    expect(progress.nextExperience).toBe(nextExperienceForLevel(12));
    expect(progress.statDistribution).toEqual(createDefaultStatDistribution("ATK"));
    expect(progress.rebirth.experienceMultiplier).toBe(1);
    expect(progress.records.highestLevel.value).toBe(12);
  });

  it("calculates a rebirth multiplier from level, power, and run count", () => {
    expect(calculateRebirthExperienceMultiplier(40, 300, 1)).toBeGreaterThan(1);
  });
});
