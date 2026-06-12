import { EQUIPMENT_BALANCE } from "../data/balance";
import { chance } from "./rng";
import { generateEquipmentItem, rollRarityForStage } from "./equipment";
import { createItemId } from "./inventory";
import type { EquipmentItem, ProgressState, RngState } from "./types";

export function rollMonsterDrop(progress: ProgressState, rng: RngState): EquipmentItem | null {
  if (!chance(rng, EQUIPMENT_BALANCE.dropChance)) {
    return null;
  }

  return generateEquipmentItem({
    id: createItemId(progress.inventory),
    rng,
    stageId: progress.currentStage,
  });
}

export function rollGuaranteedDrop(progress: ProgressState, rng: RngState): EquipmentItem {
  return generateEquipmentItem({
    id: createItemId(progress.inventory),
    rng,
    stageId: progress.currentStage,
  });
}

export function sampleRarity(progress: ProgressState, rng: RngState) {
  return rollRarityForStage(rng, progress.currentStage);
}
