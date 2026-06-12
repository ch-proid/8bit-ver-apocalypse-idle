import { STANDARD_DUMMY } from "../src/data/balance";
import { generateEquipmentItem } from "../src/core/equipment";
import { createDefaultProgress } from "../src/core/progression";
import { createRngState } from "../src/core/rng";
import { compareEquipmentCombatScore, createBuildSnapshot, simulateStandardDummy } from "../src/core/sim";

const progress = createDefaultProgress(1);
const snapshot = createBuildSnapshot(progress);
const result = simulateStandardDummy(snapshot);
const candidate = generateEquipmentItem({
  id: "phase3d-demo-weapon",
  rng: createRngState(STANDARD_DUMMY.seed),
  stageId: 1,
  rarity: "rare",
  slot: "weapon",
  itemLevel: 5,
});
const comparison = compareEquipmentCombatScore(snapshot, candidate);

console.table([
  {
    checkpoint: "CURRENT BUILD",
    combatScore: result.combatScore,
    ticks: result.ticks,
  },
  {
    checkpoint: "CANDIDATE EQUIP",
    item: `${candidate.rarity} ${candidate.slot}`,
    combatScore: comparison.candidateScore,
    delta: comparison.delta,
    deltaPercent: `${comparison.deltaPercent.toFixed(2)}%`,
  },
]);
