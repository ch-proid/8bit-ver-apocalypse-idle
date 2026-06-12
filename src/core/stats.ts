import { COMBAT_POWER, PLAYER_BALANCE, STAT_GROWTH } from "../data/balance";
import type { Player, ProgressState, StatAllocation, StatDistributionState, StatKey, StatPreset } from "./types";

export interface PlayerStats {
  attack: number;
  defense: number;
  maxHp: number;
  hpRegen: number;
}

export function emptyAllocation(): StatAllocation {
  return {
    atk: 0,
    def: 0,
    hp: 0,
    reg: 0,
  };
}

export function totalAllocatedPoints(allocation: StatAllocation): number {
  return allocation.atk + allocation.def + allocation.hp + allocation.reg;
}

export function createDefaultStatDistribution(preset: StatPreset = "ATK"): StatDistributionState {
  return {
    assigned: emptyAllocation(),
    unspentPoints: 0,
    preset,
  };
}

export function applyLevelStatPoints(distribution: StatDistributionState, points: number): StatDistributionState {
  if (points <= 0) {
    return cloneDistribution(distribution);
  }

  if (distribution.preset === "MANUAL") {
    return {
      ...cloneDistribution(distribution),
      unspentPoints: distribution.unspentPoints + points,
    };
  }

  const preset = STAT_GROWTH.autoPresets[distribution.preset];
  return {
    ...cloneDistribution(distribution),
    assigned: addAllocation(distribution.assigned, preset, points / STAT_GROWTH.pointsPerLevel),
  };
}

export function spendStatPoint(distribution: StatDistributionState, stat: StatKey): StatDistributionState {
  if (distribution.unspentPoints <= 0) {
    return cloneDistribution(distribution);
  }

  return {
    ...cloneDistribution(distribution),
    assigned: {
      ...distribution.assigned,
      [stat]: distribution.assigned[stat] + 1,
    },
    unspentPoints: distribution.unspentPoints - 1,
  };
}

export function setStatPreset(distribution: StatDistributionState, preset: StatPreset): StatDistributionState {
  return {
    ...cloneDistribution(distribution),
    preset,
  };
}

export function resetStatDistribution(preset: StatPreset = "ATK"): StatDistributionState {
  return createDefaultStatDistribution(preset);
}

export function calculatePlayerStats(progress: ProgressState): PlayerStats {
  const distributionStats = statsFromAllocation(progress.statDistribution.assigned);
  const permanentStats = statsFromAllocation(progress.rebirth.permanentStats);
  const equipmentStats = createEmptyStats();

  return {
    attack: PLAYER_BALANCE.attack + distributionStats.attack + permanentStats.attack + equipmentStats.attack,
    defense: PLAYER_BALANCE.defense + distributionStats.defense + permanentStats.defense + equipmentStats.defense,
    maxHp: PLAYER_BALANCE.maxHp + distributionStats.maxHp + permanentStats.maxHp + equipmentStats.maxHp,
    hpRegen: PLAYER_BALANCE.hpRegen + distributionStats.hpRegen + permanentStats.hpRegen + equipmentStats.hpRegen,
  };
}

export function applyPlayerStats(player: Player, progress: ProgressState): void {
  const stats = calculatePlayerStats(progress);
  const previousMaxHp = player.maxHp;

  player.attack = stats.attack;
  player.defense = stats.defense;
  player.maxHp = stats.maxHp;
  player.hpRegen = stats.hpRegen;

  if (stats.maxHp > previousMaxHp) {
    player.hp += stats.maxHp - previousMaxHp;
  }
  player.hp = Math.min(player.maxHp, Math.max(0, player.hp));
}

export function combatPowerEstimate(progress: ProgressState): number {
  const stats = calculatePlayerStats(progress);
  return Math.floor(
    stats.attack * COMBAT_POWER.attackWeight
    + stats.defense * COMBAT_POWER.defenseWeight
    + stats.maxHp * COMBAT_POWER.hpWeight
    + stats.hpRegen * COMBAT_POWER.regenWeight,
  );
}

function cloneDistribution(distribution: StatDistributionState): StatDistributionState {
  return {
    assigned: { ...distribution.assigned },
    unspentPoints: distribution.unspentPoints,
    preset: distribution.preset,
  };
}

function addAllocation(base: StatAllocation, add: StatAllocation, scale: number): StatAllocation {
  return {
    atk: base.atk + add.atk * scale,
    def: base.def + add.def * scale,
    hp: base.hp + add.hp * scale,
    reg: base.reg + add.reg * scale,
  };
}

function createEmptyStats(): PlayerStats {
  return {
    attack: 0,
    defense: 0,
    maxHp: 0,
    hpRegen: 0,
  };
}

function statsFromAllocation(allocation: StatAllocation): PlayerStats {
  return {
    attack: allocation.atk * STAT_GROWTH.attackPerPoint,
    defense: allocation.def * STAT_GROWTH.defensePerPoint,
    maxHp: allocation.hp * STAT_GROWTH.hpPerPoint,
    hpRegen: allocation.reg * STAT_GROWTH.regenPerPoint,
  };
}
