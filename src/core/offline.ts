import { WAVE_BALANCE } from "../data/balance";
import { MONSTERS } from "../data/monsters";
import { STAGES } from "../data/stages";
import { calculatePlayerStats } from "./stats";
import { normalMonsterStatsForStage } from "./stage";
import type { ProgressState } from "./types";

export interface OfflineHuntRates {
  stageId: number;
  killsPerMinute: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  cycleSeconds: number;
}

export function estimateOfflineHuntRates(progress: ProgressState): OfflineHuntRates {
  const stageId = progress.stageProgress.currentHuntingStage || progress.currentStage;
  const stage = STAGES[stageId] ?? STAGES[progress.currentStage];
  if (!stage || stage.isBoss || stage.waves.length <= 0) {
    return emptyRates(stageId);
  }

  const playerStats = calculatePlayerStats(progress);
  // TODO(Phase 7): Replace this coarse DPS estimate with sampled deterministic combat once full pacing data exists.
  const estimatedDps = Math.max(
    1,
    playerStats.attack / Math.max(0.1, playerStats.attackCooldown) * WAVE_BALANCE.offlineDpsEfficiency,
  );
  let cycleSeconds = 0;
  let cycleKills = 0;
  let cycleGold = 0;
  let cycleExperience = 0;

  for (const wave of stage.waves) {
    let waveHp = 0;
    let waveKills = 0;
    for (const spawn of wave.spawns) {
      const definition = MONSTERS[spawn.monsterId];
      if (!definition) {
        continue;
      }

      const stats = normalMonsterStatsForStage(stage.id, definition);
      waveHp += stats.maxHp * spawn.count;
      waveKills += spawn.count;
      cycleGold += stats.gold * spawn.count;
      cycleExperience += stats.experience * spawn.count;
    }

    cycleKills += waveKills;
    cycleSeconds += Math.max(
      WAVE_BALANCE.offlineMinimumWaveSeconds,
      waveHp / estimatedDps + WAVE_BALANCE.offlineMovementSecondsPerWave,
    );
  }

  if (cycleSeconds <= 0 || cycleKills <= 0) {
    return emptyRates(stage.id);
  }

  const cyclesPerMinute = 60 / cycleSeconds;
  return {
    stageId: stage.id,
    killsPerMinute: cycleKills * cyclesPerMinute,
    goldPerMinute: cycleGold * cyclesPerMinute,
    experiencePerMinute: cycleExperience * cyclesPerMinute,
    cycleSeconds,
  };
}

function emptyRates(stageId: number): OfflineHuntRates {
  return {
    stageId,
    killsPerMinute: 0,
    goldPerMinute: 0,
    experiencePerMinute: 0,
    cycleSeconds: 0,
  };
}
