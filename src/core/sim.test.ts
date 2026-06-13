import { describe, expect, it } from "vitest";
import { RELIC_IDS } from "../data/relics";
import { createDefaultProgress } from "./progression";
import {
  calculateCombatScore,
  compareEquipmentCombatScore,
  createBuildSnapshot,
  simulateStandardDummy,
  updateDummyScoreRecord,
} from "./sim";
import { createInitialSimulation } from "./stage";
import type { EquipmentItem, ItemOption, RelicId } from "./types";

describe("phase 3D standard dummy simulation", () => {
  it("returns the same combat score for the same build snapshot", () => {
    const progress = createProgressWithRelic("executioner", 3);
    progress.inventory.equipped.weapon = makeWeapon("deterministic", 12, [
      { key: "damageIncrease", value: 15, sin: false },
      { key: "critChance", value: 20, sin: false },
    ]);
    const snapshot = createBuildSnapshot(progress);

    const runA = simulateStandardDummy(snapshot);
    const runB = simulateStandardDummy(snapshot);

    expect(runA).toEqual(runB);
    expect(runA.combatScore).toBeGreaterThan(0);
  });

  it("scores a stronger attack weapon higher than a weaker weapon", () => {
    const weak = createDefaultProgress(1);
    weak.inventory.equipped.weapon = makeWeapon("weak", 2);
    const strong = createDefaultProgress(1);
    strong.inventory.equipped.weapon = makeWeapon("strong", 30);

    expect(calculateCombatScore(createBuildSnapshot(strong))).toBeGreaterThan(
      calculateCombatScore(createBuildSnapshot(weak)),
    );
  });

  it("produces a valid and distinct score for each relic build", () => {
    const scores = RELIC_IDS.map((relicId) => ({
      relicId,
      score: calculateCombatScore(createBuildSnapshot(createProgressWithRelic(relicId, 5))),
    }));
    const uniqueScores = new Set(scores.map((item) => item.score));

    expect(scores.every((item) => item.score > 0)).toBe(true);
    expect(uniqueScores.size).toBe(RELIC_IDS.length);
  });

  it("produces deterministic but distinct dummy scores for the three classes", () => {
    const scores = (["assassin", "knight", "mage"] as const).map((classId) => {
      const progress = createDefaultProgress(1);
      progress.classId = classId;
      progress.inventory.equipped.weapon = makeWeapon(`${classId}-weapon`, 18);
      return calculateCombatScore(createBuildSnapshot(progress), { durationSeconds: 20 });
    });

    expect(scores.every((score) => score > 0)).toBe(true);
    expect(new Set(scores).size).toBe(3);
  });

  it("reports positive equipment comparison delta for a better candidate", () => {
    const progress = createDefaultProgress(1);
    progress.inventory.equipped.weapon = makeWeapon("current", 3);
    const comparison = compareEquipmentCombatScore(
      createBuildSnapshot(progress),
      makeWeapon("candidate", 25, [{ key: "damageIncrease", value: 20, sin: false }]),
    );

    expect(comparison.delta).toBeGreaterThan(0);
    expect(comparison.deltaPercent).toBeGreaterThan(0);
    expect(comparison.candidateScore).toBeGreaterThan(comparison.currentScore);
  });

  it("keeps build snapshots isolated from later progress mutations", () => {
    const progress = createProgressWithRelic("kingsShadow", 3);
    const snapshot = createBuildSnapshot(progress);
    const before = calculateCombatScore(snapshot);

    progress.inventory.equipped.weapon = makeWeapon("mutated", 100, [
      { key: "finalDamage", value: 50, sin: false },
    ]);
    progress.altar.equippedRelicId = "martyr";
    progress.altar.owned.martyr = { id: "martyr", stars: 5 };

    expect(calculateCombatScore(snapshot)).toBe(before);
  });

  it("updates dummy score record monotonically", () => {
    const state = createInitialSimulation(1);

    updateDummyScoreRecord(state.progress, state.world, 100);
    updateDummyScoreRecord(state.progress, state.world, 90);
    updateDummyScoreRecord(state.progress, state.world, 140);

    expect(state.progress.records.dummyScore.value).toBe(140);
  });
});

function createProgressWithRelic(relicId: RelicId, stars: number) {
  const progress = createDefaultProgress(1);
  progress.altar.owned[relicId] = { id: relicId, stars };
  progress.altar.equippedRelicId = relicId;
  return progress;
}

function makeWeapon(id: string, baseValue: number, options: ItemOption[] = []): EquipmentItem {
  return {
    id,
    slot: "weapon",
    rarity: "rare",
    itemLevel: 1,
    baseStat: "atk",
    baseValue,
    minDmg: Math.max(1, Math.floor(baseValue * 0.8)),
    maxDmg: Math.max(1, Math.ceil(baseValue * 1.2)),
    accuracy: 200,
    upgradeLevel: 0,
    options,
  };
}
