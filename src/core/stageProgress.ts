import { STAGE_BALANCE } from "../data/balance";
import { STAGES } from "../data/stages";
import type { ChallengeFailureReason, ProgressState, StageMode, StageProgressState } from "./types";

export function createDefaultStageProgress(initialStageId = 1): StageProgressState {
  return {
    unlockedStage: initialStageId,
    currentHuntingStage: initialStageId,
    clearedStages: {},
    defeatedBossStages: {},
    mode: "hunt",
    autoChallenge: false,
    challengeTimer: 0,
    lastFailure: null,
  };
}

export function normalizeStageProgress(input?: Partial<StageProgressState>, initialStageId = 1): StageProgressState {
  const defaults = createDefaultStageProgress(initialStageId);
  return {
    unlockedStage: input?.unlockedStage ?? defaults.unlockedStage,
    currentHuntingStage: input?.currentHuntingStage ?? defaults.currentHuntingStage,
    clearedStages: { ...input?.clearedStages },
    defeatedBossStages: { ...input?.defeatedBossStages },
    mode: input?.mode ?? defaults.mode,
    autoChallenge: input?.autoChallenge ?? defaults.autoChallenge,
    challengeTimer: input?.challengeTimer ?? defaults.challengeTimer,
    lastFailure: input?.lastFailure ? { ...input.lastFailure } : defaults.lastFailure,
  };
}

export function cloneStageProgress(progress: StageProgressState): StageProgressState {
  return {
    unlockedStage: progress.unlockedStage,
    currentHuntingStage: progress.currentHuntingStage,
    clearedStages: { ...progress.clearedStages },
    defeatedBossStages: { ...progress.defeatedBossStages },
    mode: progress.mode,
    autoChallenge: progress.autoChallenge,
    challengeTimer: progress.challengeTimer,
    lastFailure: progress.lastFailure ? { ...progress.lastFailure } : null,
  };
}

export function startStage(progress: ProgressState, stageId: number, mode: StageMode): boolean {
  if (stageId > progress.stageProgress.unlockedStage || !STAGES[stageId]) {
    return false;
  }

  progress.currentStage = stageId;
  progress.stageProgress.mode = mode;
  progress.stageProgress.challengeTimer = 0;
  progress.stageProgress.lastFailure = null;
  if (mode === "hunt") {
    progress.stageProgress.currentHuntingStage = stageId;
  }
  return true;
}

export function clearStage(progress: ProgressState, stageId: number): void {
  progress.stageProgress.clearedStages[stageId] = true;
  progress.stageProgress.currentHuntingStage = stageId;
  progress.stageProgress.unlockedStage = Math.min(
    STAGE_BALANCE.totalStages,
    Math.max(progress.stageProgress.unlockedStage, stageId + 1),
  );
  progress.stageProgress.challengeTimer = 0;
  progress.stageProgress.lastFailure = null;
}

export function clearBossStage(progress: ProgressState, stageId: number): void {
  progress.stageProgress.defeatedBossStages[stageId] = true;
  clearStage(progress, stageId);
}

export function failStageChallenge(
  progress: ProgressState,
  stageId: number,
  reason: ChallengeFailureReason,
): void {
  progress.stageProgress.lastFailure = {
    stageId,
    reason,
    recommendedStage: recommendedHuntingStage(stageId),
  };
  progress.stageProgress.mode = "hunt";
  progress.stageProgress.currentHuntingStage = recommendedHuntingStage(stageId);
  progress.stageProgress.challengeTimer = 0;
}

export function tickStageChallenge(progress: ProgressState, dt: number): void {
  if (progress.stageProgress.mode !== "challenge" && progress.stageProgress.mode !== "boss") {
    return;
  }

  progress.stageProgress.challengeTimer += dt;
  if (progress.stageProgress.challengeTimer > STAGE_BALANCE.challengeTimeLimitSeconds) {
    failStageChallenge(progress, progress.currentStage, "timeout");
  }
}

export function continueAutoChallenge(progress: ProgressState): void {
  if (!progress.stageProgress.autoChallenge) {
    progress.stageProgress.mode = "hunt";
    return;
  }

  const nextStageId = Math.min(progress.stageProgress.unlockedStage, progress.currentStage + 1);
  const nextStage = STAGES[nextStageId];
  if (!nextStage || nextStageId === progress.currentStage) {
    progress.stageProgress.mode = "hunt";
    return;
  }

  startStage(progress, nextStageId, nextStage.isBoss ? "boss" : "challenge");
}

export function recommendedHuntingStage(stageId: number): number {
  return Math.max(1, stageId - STAGE_BALANCE.recommendedHuntStageOffset);
}
