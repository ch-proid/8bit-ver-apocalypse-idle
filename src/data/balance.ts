export const TICK_RATE = 60;
export const FIXED_DELTA = 1 / TICK_RATE;

export const WORLD = {
  width: 480,
  height: 144,
  gravity: 820,
  terminalVelocity: 360,
  jumpVelocity: -315,
  platformSnapDistance: 4,
} as const;

export const PLAYER_BALANCE = {
  width: 8,
  height: 10,
  moveSpeed: 52,
  maxHp: 120,
  attack: 16,
  defense: 0,
  hpRegen: 0,
  attackRange: 18,
  attackCooldown: 0.55,
} as const;

export const MONSTER_BALANCE = {
  respawnFadeSeconds: 0.22,
  hpBarWidth: 18,
  hpBarHeight: 3,
} as const;

export const FLOATING_TEXT = {
  ttl: 0.75,
  riseSpeed: 18,
  maxCount: 50,
} as const;

export const PROGRESSION = {
  initialStageId: 1,
  offlineCapSeconds: 60 * 60 * 10,
} as const;

export const EXPERIENCE_CURVE = {
  // TODO(Phase 7): Tune against pacing target "Lucian at 40-60 minutes".
  baseNextExperience: 32,
  firstKneeLevel: 40,
  secondKneeLevel: 80,
  earlyExponent: 1.35,
  midExponent: 1.65,
  lateExponent: 1.95,
  midSlope: 8,
  lateSlope: 180,
} as const;

export const STAT_GROWTH = {
  // TODO(Phase 7): Tune point values after equipment and relic systems land.
  pointsPerLevel: 3,
  attackPerPoint: 1,
  defensePerPoint: 1,
  hpPerPoint: 8,
  regenPerPoint: 0.15,
  autoPresets: {
    ATK: { atk: 3, def: 0, hp: 0, reg: 0 },
    BAL: { atk: 1, def: 1, hp: 1, reg: 0 },
    VIT: { atk: 0, def: 1, hp: 2, reg: 0 },
  },
} as const;

export const REBIRTH_BALANCE = {
  // TODO(Phase 7): Tune so level 40 wall -> rebirth -> fast rerun -> level 80 wall feels clear.
  resetStageId: PROGRESSION.initialStageId,
  maxRecords: 30,
  baseExperienceMultiplier: 1,
  levelMultiplierDivisor: 220,
  combatPowerMultiplierDivisor: 2400,
  countMultiplierBonus: 0.04,
  permanentAttackPerRebirth: 1,
  permanentDefensePerRebirth: 1,
  permanentHpPerRebirth: 6,
  permanentRegenPerRebirth: 0.05,
} as const;

export const COMBAT_POWER = {
  // TODO(Phase 7): Tune after equipment, boss, and damage-reduction formulas are fixed.
  attackWeight: 10,
  defenseWeight: 4,
  hpWeight: 0.5,
  regenWeight: 20,
} as const;

export const DEBUG_GRANTS = {
  // TODO(Phase 4): Remove these temporary HUD validation buttons when formal UI arrives.
  gold: 100,
  experience: 200,
} as const;

export const RNG_BALANCE = {
  // TODO(Phase 7): Keep fixed for deterministic local simulation snapshots unless save migration requires a bump.
  defaultSeed: 305419896,
} as const;

export const EQUIPMENT_BALANCE = {
  // TODO(Phase 7): Tune after the first full Chapter 1 loot pacing pass.
  inventoryCapacity: 60,
  dropChance: 0.08,
  bossDropChance: 1,
  stagesPerChapter: 10,
  itemLevelPerStage: 1,
  slotBaseValues: {
    weapon: 3,
    helmet: 18,
    armor: 2,
    accessory: 0.2,
  },
  rarityMultipliers: {
    common: 1,
    magic: 1.35,
    rare: 1.8,
    epic: 2.4,
    legendary: 3.2,
  },
  rarityRanks: {
    common: 0,
    magic: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  },
  generalOptionLines: {
    common: 0,
    magic: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  },
  epicSinChance: 0.3,
  rarityWeightsByChapter: [
    { common: 60, magic: 25, rare: 10, epic: 4, legendary: 1 },
    { common: 52, magic: 27, rare: 13, epic: 6, legendary: 2 },
    { common: 45, magic: 28, rare: 16, epic: 8, legendary: 3 },
    { common: 38, magic: 29, rare: 19, epic: 10, legendary: 4 },
    { common: 32, magic: 29, rare: 22, epic: 12, legendary: 5 },
    { common: 26, magic: 29, rare: 25, epic: 14, legendary: 6 },
  ],
  itemValue: {
    levelWeight: 12,
    rarityWeight: 140,
    optionWeight: 35,
    sinOptionBonus: 220,
  },
} as const;

export const AFFIX_BALANCE = {
  // TODO(Phase 7): Wire combat-facing affixes into the 3C damage pipeline and retune ranges.
  general: {
    critChance: { min: 3, max: 9, cap: 75 },
    critDamage: { min: 10, max: 30 },
    attackSpeed: { min: 4, max: 12, cap: 100 },
    damageIncrease: { min: 5, max: 18 },
    finalDamage: { min: 2, max: 6 },
    defPenetration: { min: 4, max: 18 },
    lifeSteal: { min: 1, max: 4, cap: 10 },
    goldGain: { min: 5, max: 20 },
    damageReduction: { min: 3, max: 10, cap: 50 },
  },
  sin: {
    specterDamage: { min: 8, max: 24 },
    bloodLeech: { min: 2, max: 8 },
    plagueSpread: { min: 1, max: 3 },
    martyrPain: { min: 6, max: 18 },
    executionThreshold: { min: 1, max: 4 },
    despairBurst: { min: 1, max: 5 },
  },
} as const;

export const GOLD_BALANCE = {
  // TODO(Phase 7): Retune once real item economy and Chapter 1 shop pacing are playable.
  cubeResultLevelBonus: 1,
  rerollBaseCost: 80,
  rerollCostGrowth: 1.65,
  shopSlots: 6,
  shopRefreshGoldCost: 120,
  shopFreeRefreshSeconds: 60 * 20,
  shopItemPriceLevelWeight: 35,
  shopItemPriceRarityWeight: 220,
  shopSinOfferChance: 0.04,
} as const;

export const PHASE_3B_DEBUG = {
  // TODO(Phase 4): Remove this console-only verification path when formal gear UI lands.
  idleSeconds: 60,
  demoSeed: 9,
} as const;

export function nextExperienceForLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  const firstKneeCost = EXPERIENCE_CURVE.baseNextExperience
    * Math.pow(EXPERIENCE_CURVE.firstKneeLevel, EXPERIENCE_CURVE.earlyExponent);

  if (normalizedLevel <= EXPERIENCE_CURVE.firstKneeLevel) {
    return Math.floor(EXPERIENCE_CURVE.baseNextExperience * Math.pow(normalizedLevel, EXPERIENCE_CURVE.earlyExponent));
  }

  const midLevel = normalizedLevel - EXPERIENCE_CURVE.firstKneeLevel;
  const secondKneeCost = firstKneeCost
    + EXPERIENCE_CURVE.baseNextExperience
    * EXPERIENCE_CURVE.midSlope
    * Math.pow(EXPERIENCE_CURVE.secondKneeLevel - EXPERIENCE_CURVE.firstKneeLevel, EXPERIENCE_CURVE.midExponent);

  if (normalizedLevel <= EXPERIENCE_CURVE.secondKneeLevel) {
    return Math.floor(
      firstKneeCost
      + EXPERIENCE_CURVE.baseNextExperience * EXPERIENCE_CURVE.midSlope * Math.pow(midLevel, EXPERIENCE_CURVE.midExponent),
    );
  }

  const lateLevel = normalizedLevel - EXPERIENCE_CURVE.secondKneeLevel;
  return Math.floor(
    secondKneeCost
    + EXPERIENCE_CURVE.baseNextExperience * EXPERIENCE_CURVE.lateSlope * Math.pow(lateLevel, EXPERIENCE_CURVE.lateExponent),
  );
}
