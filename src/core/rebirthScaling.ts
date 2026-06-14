import { REBIRTH_BALANCE } from "../data/balance";

export function rebirthEnemyHpMultiplier(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * REBIRTH_BALANCE.enemyHpMultiplierPerRebirth;
}

export function rebirthEnemyAttackMultiplier(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * REBIRTH_BALANCE.enemyAttackMultiplierPerRebirth;
}

export function rebirthEnemyDefenseMultiplier(rebirthCount: number): number {
  return 1 + Math.max(0, rebirthCount) * REBIRTH_BALANCE.enemyDefenseMultiplierPerRebirth;
}
