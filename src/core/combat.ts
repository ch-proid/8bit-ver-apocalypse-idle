import { DAMAGE_FORMULA } from "../data/balance";
import { calculateCombatAffixStats } from "./equipment";
import { nextRandom } from "./rng";
import { relicDamageHooks } from "./relics";
import type { CombatAffixStats, Monster, Player, ProgressState, RngState, WorldState } from "./types";

export interface DamageInput {
  attack: number;
  defenderDefense: number;
  defenderDamageReduction: number;
  styleMultiplier: number;
  affixes: CombatAffixStats;
  rng: RngState;
  damageIncreaseBonus?: number;
  finalDamageBonus?: number;
  critChanceBonus?: number;
  forceCritical?: boolean;
  forceVarianceRoll?: number;
}

export interface DamageResult {
  raw: number;
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
  const affixes = calculateCombatAffixStats(progress.inventory.equipped);
  const hooks = relicDamageHooks(progress, world, player);
  const result = calculateDamage({
    attack: player.attack,
    defenderDefense: monsterDefense(monster),
    defenderDamageReduction: 0,
    styleMultiplier: hooks.styleMultiplier,
    affixes,
    rng: world.rng,
    damageIncreaseBonus: hooks.damageIncreaseBonus,
    critChanceBonus: hooks.critChanceBonus,
  });
  const damage = hooks.allowZeroDirectDamage ? 0 : result.finalDamage;

  monster.hp = Math.max(0, monster.hp - damage);
  return {
    ...result,
    finalDamage: damage,
  };
}

export function calculateDamage(input: DamageInput): DamageResult {
  const affixes = clampCombatAffixes(input.affixes);
  const raw = input.attack * input.styleMultiplier;
  const afterDamageIncrease = raw * (1 + (affixes.damageIncrease + (input.damageIncreaseBonus ?? 0)) / 100);
  const penetration = affixes.defPenetration;
  const effectiveDefense = Math.max(0, input.defenderDefense - penetration);
  const afterDefense = afterDamageIncrease
    * (1 - effectiveDefense / (effectiveDefense + DAMAGE_FORMULA.defenseScale));
  const critical = input.forceCritical ?? rollCritical(input.rng, affixes.critChance + (input.critChanceBonus ?? 0));
  const critMultiplier = DAMAGE_FORMULA.defaultCritDamage + affixes.critDamage / 100;
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
    raw,
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

export function clampCombatAffixes(affixes: CombatAffixStats): CombatAffixStats {
  return {
    critChance: clamp(affixes.critChance, 0, DAMAGE_FORMULA.critChanceCap),
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

function rollCritical(rng: RngState, chancePercent: number): boolean {
  const chance = clamp(chancePercent, 0, DAMAGE_FORMULA.critChanceCap);
  return nextRandom(rng) < chance / 100;
}

function monsterDefense(_monster: Monster): number {
  // TODO(Phase 3E): Boss and elite monsters will expose defense/damageReduction data.
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
