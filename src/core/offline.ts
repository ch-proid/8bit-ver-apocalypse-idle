import { DROP_REWARD_BALANCE, WAVE_BALANCE } from "../data/balance";
import { MONSTERS } from "../data/monsters";
import { STAGES } from "../data/stages";
import { bloodForKill } from "./altar";
import { calculatePlayerStats } from "./stats";
import { normalMonsterStatsForStage } from "./stage";
import type { ProgressState } from "./types";

export interface OfflineHuntRates {
  stageId: number;
  killsPerMinute: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  crystalPerMinute: number;
  bloodPerMinute: number;
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
  let cycleBlood = 0;

  for (const wave of stage.waves) {
    let waveHp = 0;
    let waveKills = 0;
    for (const spawn of wave.spawns) {
      const definition = MONSTERS[spawn.monsterId];
      if (!definition) {
        continue;
      }

      const stats = normalMonsterStatsForStage(stage.id, definition, progress.rebirth.count);
      waveHp += stats.maxHp * spawn.count;
      waveKills += spawn.count;
      cycleGold += stats.gold * spawn.count;
      cycleExperience += stats.experience * spawn.count;
      cycleBlood += bloodForKill("normal", stage.id) * spawn.count;
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
    goldPerMinute: cycleGold * cyclesPerMinute * DROP_REWARD_BALANCE.goldChance,
    experiencePerMinute: cycleExperience * cyclesPerMinute * WAVE_BALANCE.offlineExperienceMultiplier,
    crystalPerMinute: cycleKills * cyclesPerMinute * WAVE_BALANCE.offlineCrystalPerKill,
    bloodPerMinute: cycleBlood * cyclesPerMinute * DROP_REWARD_BALANCE.bloodChance,
    cycleSeconds,
  };
}

function emptyRates(stageId: number): OfflineHuntRates {
  return {
    stageId,
    killsPerMinute: 0,
    goldPerMinute: 0,
    experiencePerMinute: 0,
    crystalPerMinute: 0,
    bloodPerMinute: 0,
    cycleSeconds: 0,
  };
}
