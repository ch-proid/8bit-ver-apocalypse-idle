import { EQUIPMENT_BALANCE } from "../data/balance";
import { STAGES } from "../data/stages";
import { chance, pickWeighted } from "./rng";
import { generateEquipmentItem, rollRarityForStage } from "./equipment";
import { createItemId } from "./inventory";
import type { BossId, EquipmentItem, ItemSlot, ProgressState, RngState } from "./types";

export function rollMonsterDrop(progress: ProgressState, rng: RngState): EquipmentItem | null {
  if (!chance(rng, equipmentDropChance(progress))) {
    return null;
  }

  return generateEquipmentItem({
    id: createItemId(progress.inventory),
    rng,
    stageId: progress.currentStage,
    rebirthCount: progress.rebirth.count,
    slot: rollSlotForStage(progress, rng),
  });
}

export function rollGuaranteedDrop(progress: ProgressState, rng: RngState): EquipmentItem {
  return generateEquipmentItem({
    id: createItemId(progress.inventory),
    rng,
    stageId: progress.currentStage,
    rebirthCount: progress.rebirth.count,
    slot: rollSlotForStage(progress, rng),
  });
}

export function rollBossDrop(progress: ProgressState, rng: RngState, _bossId: BossId): EquipmentItem {
  return generateEquipmentItem({
    id: createItemId(progress.inventory),
    rng,
    stageId: progress.currentStage,
    rebirthCount: progress.rebirth.count,
    slot: rollSlotForStage(progress, rng),
    forceSin: true,
  });
}

export function sampleRarity(progress: ProgressState, rng: RngState) {
  return rollRarityForStage(rng, progress.currentStage, progress.rebirth.count);
}

export function rollSlotForStage(progress: ProgressState, rng: RngState): ItemSlot {
  const stage = STAGES[progress.stageProgress.currentHuntingStage] ?? STAGES[progress.currentStage];
  return pickWeighted(rng, stage.dropBias);
}

export function equipmentDropChance(progress: ProgressState): number {
  const chapter = Math.max(1, Math.ceil(progress.currentStage / EQUIPMENT_BALANCE.stagesPerChapter));
  const config = EQUIPMENT_BALANCE.dropChance;
  return Math.min(
    config.max,
    config.base
      + Math.max(0, chapter - 1) * config.perChapter
      + Math.max(0, progress.rebirth.count) * config.perRebirth,
  );
}
