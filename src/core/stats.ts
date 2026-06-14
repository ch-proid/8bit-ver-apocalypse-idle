import { CLASS_BALANCE, COMBAT_POWER, PLAYER_BALANCE, STAT_GROWTH } from "../data/balance";
import { PLAYER_CLASSES } from "../data/classes";
import { calculateRelicOwnedStats } from "./altar";
import { calculateEquipmentStats } from "./equipment";
import { defaultClassId, getPlayerClass } from "./class";
import { rebirthStatMultiplier } from "./rebirthScaling";
import type {
  EquipmentStatAllocation,
  Player,
  ProgressState,
  StatAllocation,
  StatDistributionState,
  StatKey,
  StatPreset,
} from "./types";

export interface PlayerStats {
  attack: number;
  defense: number;
  maxHp: number;
  hpRegen: number;
  evasion: number;
  moveSpeed: number;
  attackCooldown: number;
  attackRange: number;
}

export function emptyAllocation(): StatAllocation {
  return {
    str: 0,
    grit: 0,
    agi: 0,
  };
}

export function totalAllocatedPoints(allocation: StatAllocation): number {
  return allocation.str + allocation.grit + allocation.agi;
}

export function createDefaultStatDistribution(preset?: StatPreset): StatDistributionState {
  const defaultPreset = preset ?? PLAYER_CLASSES[defaultClassId()].recommendedPreset;
  return {
    assigned: emptyAllocation(),
    unspentPoints: 0,
    preset: defaultPreset,
  };
}

export function createRecommendedStatDistribution(classId = defaultClassId()): StatDistributionState {
  return createDefaultStatDistribution(getPlayerClass(classId).recommendedPreset);
}

export function normalizeStatDistribution(
  input: Partial<StatDistributionState> | undefined,
  fallbackPreset: StatPreset = PLAYER_CLASSES[defaultClassId()].recommendedPreset,
): StatDistributionState {
  const preset = normalizePreset(input?.preset, fallbackPreset);
  const assigned = input?.assigned;
  return {
    assigned: {
      str: safeNumber(assigned?.str),
      grit: safeNumber(assigned?.grit),
      agi: safeNumber(assigned?.agi),
    },
    unspentPoints: Math.max(0, Math.floor(input?.unspentPoints ?? 0)),
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

export function resetStatDistribution(preset?: StatPreset): StatDistributionState {
  return createDefaultStatDistribution(preset);
}

export function calculatePlayerStats(progress: ProgressState): PlayerStats {
  const classDefinition = getPlayerClass(progress.classId);
  const levelSteps = Math.max(0, progress.level - 1);
  const statPoints = progress.statDistribution.assigned;
  const equipmentStats = calculateEquipmentStats(progress.inventory.equipped);
  const relicStats = calculateRelicOwnedStats(progress.altar);

  let attack = PLAYER_BALANCE.attack + classDefinition.growth.attackPerLevel * levelSteps;
  let defense = PLAYER_BALANCE.defense + classDefinition.growth.defensePerLevel * levelSteps;
  let maxHp = PLAYER_BALANCE.maxHp + classDefinition.growth.hpPerLevel * levelSteps;
  let hpRegen = PLAYER_BALANCE.hpRegen;
  let evasion = PLAYER_BALANCE.evasion + classDefinition.growth.evasionPerLevel * levelSteps;

  attack *= statMultiplier(statPoints.str, STAT_GROWTH.strAttackPercentPerPoint);
  defense *= statMultiplier(statPoints.grit, STAT_GROWTH.gritDefensePercentPerPoint);
  maxHp *= statMultiplier(statPoints.grit, STAT_GROWTH.gritHpPercentPerPoint);
  evasion *= statMultiplier(statPoints.agi, STAT_GROWTH.agiEvasionPercentPerPoint);

  if (progress.classId === "knight") {
    // TODO(Rework 2): Move this passive into the combat passive pipeline with execution damage.
    attack += defense * CLASS_BALANCE.knight.passive.defenseToAttackPercent / 100;
  }

  const withEquipment = applyEquipmentStats({ attack, defense, maxHp, hpRegen, evasion }, equipmentStats);
  const withRelics = applyEquipmentStats(withEquipment, relicStats);
  const withRebirth = applyRebirthMultiplier(withRelics, rebirthStatMultiplier(progress.rebirth.count));
  return {
    ...withRebirth,
    moveSpeed: roundTo(PLAYER_BALANCE.moveSpeed * classDefinition.growth.moveSpeedMultiplier, 2),
    attackCooldown: roundTo(PLAYER_BALANCE.attackCooldown * classDefinition.growth.attackCooldownMultiplier, 3),
    attackRange: classDefinition.growth.attackRange,
  };
}

export function strengthDamageMultiplier(progress: ProgressState): number {
  return statMultiplier(progress.statDistribution.assigned.str, STAT_GROWTH.strAttackPercentPerPoint);
}

export function applyPlayerStats(player: Player, progress: ProgressState): void {
  const stats = calculatePlayerStats(progress);
  const previousMaxHp = player.maxHp;

  player.attack = stats.attack;
  player.defense = stats.defense;
  player.maxHp = stats.maxHp;
  player.hpRegen = stats.hpRegen;
  player.evasion = stats.evasion;
  player.moveSpeed = stats.moveSpeed;
  player.attackCooldown = stats.attackCooldown;
  player.attackRange = stats.attackRange;

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
    + stats.hpRegen * COMBAT_POWER.regenWeight
    + stats.evasion * COMBAT_POWER.evasionWeight,
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
    str: base.str + add.str * scale,
    grit: base.grit + add.grit * scale,
    agi: base.agi + add.agi * scale,
  };
}

function applyEquipmentStats(
  stats: Pick<PlayerStats, "attack" | "defense" | "maxHp" | "hpRegen" | "evasion">,
  equipment: EquipmentStatAllocation,
): Pick<PlayerStats, "attack" | "defense" | "maxHp" | "hpRegen" | "evasion"> {
  const attackWithFlat = stats.attack + equipment.atk;
  return {
    attack: roundTo(attackWithFlat * (1 + equipment.atkPercent / 100), 2),
    defense: roundTo(stats.defense + equipment.def, 2),
    maxHp: roundTo(stats.maxHp + equipment.hp, 2),
    hpRegen: roundTo(stats.hpRegen + equipment.reg, 2),
    evasion: roundTo(stats.evasion + equipment.evasion, 2),
  };
}

function applyRebirthMultiplier(
  stats: Pick<PlayerStats, "attack" | "defense" | "maxHp" | "hpRegen" | "evasion">,
  multiplier: number,
): Pick<PlayerStats, "attack" | "defense" | "maxHp" | "hpRegen" | "evasion"> {
  return {
    attack: roundTo(stats.attack * multiplier, 2),
    defense: roundTo(stats.defense * multiplier, 2),
    maxHp: roundTo(stats.maxHp * multiplier, 2),
    hpRegen: roundTo(stats.hpRegen * multiplier, 2),
    evasion: roundTo(stats.evasion * multiplier, 2),
  };
}

function normalizePreset(value: unknown, fallbackPreset: StatPreset): StatPreset {
  return value === "STR" || value === "BAL" || value === "GRIT" || value === "AGI" || value === "MANUAL"
    ? value
    : fallbackPreset;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function statMultiplier(points: number, percentPerPoint: number): number {
  return 1 + Math.max(0, points) * percentPerPoint / 100;
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
