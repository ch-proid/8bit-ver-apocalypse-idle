import { REBIRTH_BALANCE } from "../data/balance";
import { cloneProgress, updateRecordAt } from "./progression";
import { rebirthStatMultiplier } from "./rebirthScaling";
import { createInitialSimulation } from "./stage";
import { createDefaultStageProgress } from "./stageProgress";
import type { ProgressState, RebirthRecord, SimulationState } from "./types";

export function rebirthSimulation(input: SimulationState, occurredAt: number, ignoreGate = false): SimulationState {
  const previousProgress = input.progress;
  if (!ignoreGate && !canRebirth(previousProgress)) {
    return input;
  }

  const nextCount = previousProgress.rebirth.count + 1;
  const reachedStage = previousProgress.currentStage;
  const reachedLevel = previousProgress.level;
  const nextProgress = cloneProgress(previousProgress);
  nextProgress.currentStage = REBIRTH_BALANCE.resetStageId;
  nextProgress.stageProgress = createDefaultStageProgress(REBIRTH_BALANCE.resetStageId);
  nextProgress.rebirth = {
    canRebirth: false,
    count: nextCount,
    multiplier: rebirthStatMultiplier(nextCount),
  };
  updateRecordAt(nextProgress.records.highestLevel, reachedLevel, occurredAt);
  updateRecordAt(nextProgress.records.highestRebirthStage, reachedStage, occurredAt);
  nextProgress.rebirthRecords = appendRebirthRecord(previousProgress.rebirthRecords, {
    run: nextCount,
    reachedStage,
    reachedLevel,
    at: occurredAt,
  });

  return createInitialSimulation(REBIRTH_BALANCE.resetStageId, nextProgress);
}

export function canRebirth(progress: ProgressState): boolean {
  return progress.level >= REBIRTH_BALANCE.requiredLevel
    && Boolean(progress.stageProgress.clearedStages[REBIRTH_BALANCE.requiredStageId]
      || progress.stageProgress.defeatedBossStages[REBIRTH_BALANCE.requiredStageId]);
}

export function unlockRebirth(progress: ProgressState): ProgressState {
  // Debug-only override marker kept for save compatibility; normal rebirth gates use canRebirth().
  return {
    ...progress,
    rebirth: {
      ...progress.rebirth,
      canRebirth: true,
    },
  };
}

function appendRebirthRecord(records: RebirthRecord[], record: RebirthRecord): RebirthRecord[] {
  return [...records, record].slice(-REBIRTH_BALANCE.maxRecords);
}
