import { REBIRTH_BALANCE } from "../data/balance";

export function rebirthStatMultiplier(rebirthCount: number): number {
  return REBIRTH_BALANCE.baseStatMultiplier
    + Math.max(0, rebirthCount) * REBIRTH_BALANCE.statMultiplierPerRebirth;
}

export function rebirthEnemyHpMultiplier(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * REBIRTH_BALANCE.enemyHpMultiplierPerRebirth;
}

export function rebirthEnemyAttackMultiplier(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * REBIRTH_BALANCE.enemyAttackMultiplierPerRebirth;
}

export function rebirthEnemyDefenseMultiplier(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * REBIRTH_BALANCE.enemyDefenseMultiplierPerRebirth;
}

export function rebirthEnemyRewardMultiplier(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * REBIRTH_BALANCE.enemyRewardMultiplierPerRebirth;
}

export function rebirthEnemyExperienceMultiplier(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * REBIRTH_BALANCE.enemyExperienceMultiplierPerRebirth;
}
