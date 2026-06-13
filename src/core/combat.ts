import { CLASS_BALANCE, DAMAGE_FORMULA, PLAYER_BALANCE } from "../data/balance";
import { classCritProfile, classDamageIncreaseBonus, getPlayerClass } from "./class";
import { calculateCombatAffixStats, normalizeEquipmentItem } from "./equipment";
import { nextRandom } from "./rng";
import { relicDamageHooks } from "./relics";
import { strengthDamageMultiplier } from "./stats";
import type { CombatAffixStats, Monster, Player, ProgressState, RngState, WorldState } from "./types";

export interface DamageInput {
  attack: number;
  minDamage?: number;
  maxDamage?: number;
  strengthMultiplier?: number;
  weaponAccuracy?: number;
  defenderEvasion?: number;
  defenderDefense: number;
  defenderDamageReduction: number;
  styleMultiplier: number;
  affixes: CombatAffixStats;
  rng: RngState;
  damageIncreaseBonus?: number;
  finalDamageBonus?: number;
  critChanceBonus?: number;
  critDamageBonus?: number;
  critChanceCap?: number;
  forceCritical?: boolean;
  forceCriticalRoll?: number;
  forceDamageRoll?: number;
  forceVarianceRoll?: number;
}

export interface DamageResult {
  baseDamage: number;
  afterStrength: number;
  raw: number;
  accuracyDelta: number;
  accuracyMultiplier: number;
  missed: boolean;
  afterAccuracy: number;
  afterDamageIncrease: number;
  effectiveDefense: number;
  afterDefense: number;
  critical: boolean;
  afterCritical: number;
  afterFinalDamage: number;
  afterDamageReduction: number;
  varianceMultiplier: number;
  finalDamage: number;
}

export function distanceBetween(player: Player, monster: Monster): number {
  const px = player.position.x + player.width / 2;
  const py = player.position.y + player.height / 2;
  const mx = monster.position.x + monster.width / 2;
  const my = monster.position.y + monster.height / 2;
  return Math.hypot(px - mx, py - my);
}

export function dealPlayerDamage(
  player: Player,
  monster: Monster,
  progress: ProgressState,
  world: WorldState,
): DamageResult {
  if (monster.spawnInvulnTimer > 0) {
    return zeroDamageResult(monster);
  }

  const affixes = calculateCombatAffixStats(progress.inventory.equipped);
  const hooks = relicDamageHooks(progress, world, player);
  const classCrit = classCritProfile(progress);
  const weaponProfile = playerWeaponDamageProfile(progress, player);
  const result = calculateDamage({
    attack: player.attack,
    minDamage: weaponProfile.minDamage,
    maxDamage: weaponProfile.maxDamage,
    strengthMultiplier: strengthDamageMultiplier(progress),
    weaponAccuracy: weaponProfile.accuracy,
    defenderEvasion: monster.evasion,
    defenderDefense: monsterDefense(monster),
    defenderDamageReduction: monster.damageReduction,
    styleMultiplier: hooks.styleMultiplier,
    affixes,
    rng: world.rng,
    damageIncreaseBonus: hooks.damageIncreaseBonus + classDamageIncreaseBonus(progress, player, monster),
    critChanceBonus: hooks.critChanceBonus + classCrit.critChanceBonus,
    critDamageBonus: classCrit.critDamageBonus,
    critChanceCap: classCrit.critChanceCap,
  });
  const damage = hooks.allowZeroDirectDamage ? 0 : result.finalDamage;

  monster.hp = Math.max(0, monster.hp - damage);
  return {
    ...result,
    finalDamage: damage,
  };
}

export function calculateDamage(input: DamageInput): DamageResult {
  const critChanceCap = input.critChanceCap ?? DAMAGE_FORMULA.critChanceCap;
  const affixes = clampCombatAffixes(input.affixes, critChanceCap);
  const baseDamage = rollDamageRange(input);
  const afterStrength = baseDamage * (input.strengthMultiplier ?? 1);
  const raw = afterStrength * input.styleMultiplier;
  const accuracy = accuracyMultiplier(input.weaponAccuracy, input.defenderEvasion);
  const afterAccuracy = raw * accuracy.multiplier;
  if (accuracy.missed) {
    return {
      baseDamage,
      afterStrength,
      raw,
      accuracyDelta: accuracy.delta,
      accuracyMultiplier: accuracy.multiplier,
      missed: true,
      afterAccuracy,
      afterDamageIncrease: 0,
      effectiveDefense: Math.max(0, input.defenderDefense - affixes.defPenetration),
      afterDefense: 0,
      critical: false,
      afterCritical: 0,
      afterFinalDamage: 0,
      afterDamageReduction: 0,
      varianceMultiplier: 1,
      finalDamage: 0,
    };
  }

  const afterDamageIncrease = afterAccuracy * (1 + (affixes.damageIncrease + (input.damageIncreaseBonus ?? 0)) / 100);
  const penetration = affixes.defPenetration;
  const effectiveDefense = Math.max(0, input.defenderDefense - penetration);
  const afterDefense = afterDamageIncrease
    * (1 - effectiveDefense / (effectiveDefense + DAMAGE_FORMULA.defenseScale));
  const critical = input.forceCritical ?? rollCritical(
    input.rng,
    affixes.critChance + (input.critChanceBonus ?? 0),
    critChanceCap,
    input.forceCriticalRoll,
  );
  const critMultiplier = DAMAGE_FORMULA.defaultCritDamage + (affixes.critDamage + (input.critDamageBonus ?? 0)) / 100;
  const afterCritical = critical ? afterDefense * critMultiplier : afterDefense;
  const afterFinalDamage = afterCritical * (1 + (affixes.finalDamage + (input.finalDamageBonus ?? 0)) / 100);
  const defenderReduction = Math.min(DAMAGE_FORMULA.damageReductionCap, Math.max(0, input.defenderDamageReduction));
  const afterDamageReduction = afterFinalDamage * (1 - defenderReduction / 100);
  const varianceMultiplier = varianceFromRoll(input.forceVarianceRoll ?? nextRandom(input.rng));
  const finalDamage = Math.max(
    DAMAGE_FORMULA.minimumDamage,
    Math.floor(afterDamageReduction * varianceMultiplier),
  );

  return {
    baseDamage,
    afterStrength,
    raw,
    accuracyDelta: accuracy.delta,
    accuracyMultiplier: accuracy.multiplier,
    missed: false,
    afterAccuracy,
    afterDamageIncrease,
    effectiveDefense,
    afterDefense,
    critical,
    afterCritical,
    afterFinalDamage,
    afterDamageReduction,
    varianceMultiplier,
    finalDamage,
  };
}

export function clampCombatAffixes(
  affixes: CombatAffixStats,
  critChanceCap: number = DAMAGE_FORMULA.critChanceCap,
): CombatAffixStats {
  return {
    critChance: clamp(affixes.critChance, 0, critChanceCap),
    critDamage: Math.max(0, affixes.critDamage),
    attackSpeed: clamp(affixes.attackSpeed, 0, DAMAGE_FORMULA.attackSpeedCap),
    damageIncrease: Math.max(0, affixes.damageIncrease),
    finalDamage: Math.max(0, affixes.finalDamage),
    defPenetration: Math.max(0, affixes.defPenetration),
    lifeSteal: clamp(affixes.lifeSteal, 0, DAMAGE_FORMULA.lifeStealCap),
    goldGain: Math.max(0, affixes.goldGain),
    damageReduction: clamp(affixes.damageReduction, 0, DAMAGE_FORMULA.damageReductionCap),
  };
}

export function effectiveAttackCooldown(baseCooldown: number, affixes: CombatAffixStats, cooldownMultiplier: number): number {
  const clamped = clampCombatAffixes(affixes);
  return baseCooldown * cooldownMultiplier / (1 + clamped.attackSpeed / 100);
}

export function varianceFromRoll(roll: number): number {
  return 1 - DAMAGE_FORMULA.variance + roll * DAMAGE_FORMULA.variance * 2;
}

export function playerEvasionChance(playerEvasion: number, attackerAccuracy: number): number {
  const evasion = Math.max(0, playerEvasion);
  const accuracy = Math.max(0, attackerAccuracy);
  return evasion / (evasion + accuracy + DAMAGE_FORMULA.evasionK);
}

export function rollPlayerEvasion(player: Player, attackerAccuracy: number, rng: RngState): boolean {
  return nextRandom(rng) < playerEvasionChance(player.evasion, attackerAccuracy);
}

export function accuracyMultiplier(
  weaponAccuracy: number = DAMAGE_FORMULA.unarmedAccuracy,
  defenderEvasion: number = 0,
): { delta: number; multiplier: number; missed: boolean } {
  const delta = weaponAccuracy - defenderEvasion;
  if (delta >= 0) {
    return { delta, multiplier: 1, missed: false };
  }

  const threshold = Math.max(1, defenderEvasion * DAMAGE_FORMULA.accuracyPenaltyThresholdRatio);
  if (delta < -threshold) {
    return { delta, multiplier: 0, missed: true };
  }

  const penaltyRatio = Math.min(1, Math.max(0, -delta / threshold));
  return {
    delta,
    multiplier: 1 - penaltyRatio * DAMAGE_FORMULA.accuracyMaxPenalty,
    missed: false,
  };
}

function rollCritical(rng: RngState, chancePercent: number, critChanceCap: number, forcedRoll?: number): boolean {
  const chance = clamp(chancePercent, 0, critChanceCap);
  return (forcedRoll ?? nextRandom(rng)) < chance / 100;
}

function rollDamageRange(input: DamageInput): number {
  const min = Math.max(0, Math.floor(input.minDamage ?? input.attack));
  const max = Math.max(min, Math.floor(input.maxDamage ?? input.attack));
  if (max <= min) {
    return min;
  }

  const roll = input.forceDamageRoll ?? nextRandom(input.rng);
  return min + Math.floor(clamp(roll, 0, 0.999999) * (max - min + 1));
}

function playerWeaponDamageProfile(progress: ProgressState, player: Player): { minDamage: number; maxDamage: number; accuracy: number } {
  const weapon = progress.inventory.equipped.weapon
    ? normalizeEquipmentItem(progress.inventory.equipped.weapon)
    : null;
  const intrinsic = intrinsicClassDamage(progress);
  const knightDefenseBonus = progress.classId === "knight"
    ? player.defense * CLASS_BALANCE.knight.passive.defenseToAttackPercent / 100
    : 0;

  if (!weapon) {
    return {
      minDamage: DAMAGE_FORMULA.unarmedMinDamage + intrinsic + knightDefenseBonus,
      maxDamage: DAMAGE_FORMULA.unarmedMaxDamage + intrinsic + knightDefenseBonus,
      accuracy: DAMAGE_FORMULA.unarmedAccuracy,
    };
  }

  return {
    minDamage: weapon.minDmg + intrinsic + knightDefenseBonus,
    maxDamage: weapon.maxDmg + intrinsic + knightDefenseBonus,
    accuracy: weapon.accuracy,
  };
}

function zeroDamageResult(monster: Monster): DamageResult {
  return {
    baseDamage: 0,
    afterStrength: 0,
    raw: 0,
    accuracyDelta: 0 - monster.evasion,
    accuracyMultiplier: 0,
    missed: true,
    afterAccuracy: 0,
    afterDamageIncrease: 0,
    effectiveDefense: monsterDefense(monster),
    afterDefense: 0,
    critical: false,
    afterCritical: 0,
    afterFinalDamage: 0,
    afterDamageReduction: 0,
    varianceMultiplier: 1,
    finalDamage: 0,
  };
}

function intrinsicClassDamage(progress: ProgressState): number {
  const levelSteps = Math.max(0, progress.level - 1);
  return PLAYER_BALANCE.attack + getPlayerClass(progress.classId).growth.attackPerLevel * levelSteps;
}

function monsterDefense(_monster: Monster): number {
  // TODO(Phase 3E): Boss and elite monsters will expose tuned defense data.
  return _monster.defense;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
