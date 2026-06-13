import { FIXED_DELTA, TICK_RATE } from "../src/data/balance";
import { createDefaultProgress } from "../src/core/progression";
import { createInitialSimulation } from "../src/core/stage";
import { clearStage, startStage } from "../src/core/stageProgress";
import { stepSimulation } from "../src/core/simulation";
import type { EquipmentItem, SimulationState } from "../src/core/types";

const progress = createDefaultProgress(1);
for (let stageId = 1; stageId <= 9; stageId += 1) {
  startStage(progress, stageId, "challenge");
  clearStage(progress, stageId);
}

const weak = runLucian(createBossProgress(0), 70);
const strong = runLucian(createBossProgress(320), 40);

console.table([
  {
    checkpoint: "1-1_TO_1-9_CLEAR",
    unlockedStage: progress.stageProgress.unlockedStage,
    canEnterLucian: startStage(progress, 10, "boss"),
  },
  {
    checkpoint: "LUCIAN_WEAK",
    rebirth: weak.progress.rebirth.canRebirth,
    prideGate: weak.progress.altar.bossDefeated.pride,
    wraiths: weak.world.monsters.filter((monster) => monster.role === "bossSummon" && monster.alive).length,
    bossHp: Math.floor(weak.world.monsters.find((monster) => monster.role === "boss")?.hp ?? 0),
  },
  {
    checkpoint: "LUCIAN_STRONG",
    rebirth: strong.progress.rebirth.canRebirth,
    prideGate: strong.progress.altar.bossDefeated.pride,
    bossDefeated: Boolean(strong.progress.stageProgress.defeatedBossStages[10]),
  },
]);

function createBossProgress(weaponAttack: number) {
  const bossProgress = createDefaultProgress(10);
  bossProgress.stageProgress.unlockedStage = 10;
  startStage(bossProgress, 10, "boss");
  if (weaponAttack > 0) {
    bossProgress.inventory.equipped.weapon = makeWeapon("phase3e-demo", weaponAttack);
  }
  return bossProgress;
}

function runLucian(progressForRun: ReturnType<typeof createDefaultProgress>, seconds: number): SimulationState {
  let state = createInitialSimulation(10, progressForRun, 20260613);
  for (let i = 0; i < seconds * TICK_RATE; i += 1) {
    state = stepSimulation(state, FIXED_DELTA);
  }
  return state;
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
