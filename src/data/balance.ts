export const TICK_RATE = 60;
export const FIXED_DELTA = 1 / TICK_RATE;

export const WORLD = {
  width: 320,
  height: 144,
  gravity: 820,
  terminalVelocity: 360,
  jumpVelocity: -315,
  platformSnapDistance: 4,
} as const;

export const PLAYER_BALANCE = {
  width: 8,
  height: 10,
  moveSpeed: 34,
  maxHp: 120,
  attack: 16,
  defense: 0,
  evasion: 1,
  hpRegen: 0,
  attackRange: 18,
  attackCooldown: 1.35,
} as const;

export const CLASS_BALANCE = {
  // TODO(Rework 2): Tune class passives once hit/evasion and damage-range combat work lands.
  defaultClassId: "knight",
  assassin: {
    growth: {
      attackPerLevel: 0.34,
      defensePerLevel: 0.08,
      hpPerLevel: 4,
      evasionPerLevel: 0.42,
      moveSpeedMultiplier: 1.14,
      attackCooldownMultiplier: 0.9,
      attackRange: 18,
    },
    passive: {
      critChanceCap: 100,
      baseCritChance: 15,
      critDamageBonus: 15,
    },
  },
  knight: {
    growth: {
      attackPerLevel: 0.24,
      defensePerLevel: 0.3,
      hpPerLevel: 12,
      evasionPerLevel: 0.08,
      moveSpeedMultiplier: 0.92,
      attackCooldownMultiplier: 1.12,
      attackRange: 16,
    },
    passive: {
      lowHpExecutionThreshold: 25,
      lowHpDamageBonusPercent: 35,
      defenseToAttackPercent: 8,
    },
  },
  mage: {
    growth: {
      attackPerLevel: 0.3,
      defensePerLevel: 0.05,
      hpPerLevel: 5,
      evasionPerLevel: 0.18,
      moveSpeedMultiplier: 1,
      attackCooldownMultiplier: 1.05,
      attackRange: 48,
    },
    passive: {
      dotHpPercent: 0.4,
      dotSeconds: 3,
      maxStacks: 5,
    },
  },
} as const;

export const MONSTER_BALANCE = {
  normalRespawnTimeMultiplier: 1.8,
  moveSpeedMultiplier: 0.55,
  autoAggroSeconds: 2.5,
  spawnInsetX: 4,
  spawnIntroSeconds: 0.4,
  hitSlowSeconds: 0.45,
  hitSlowMoveMultiplier: 0.45,
  respawnFadeSeconds: 0.22,
  hpBarWidth: 10,
  hpBarHeight: 1,
} as const;

export const MAGE_AI_BALANCE = {
  tooCloseDistance: 16,
  retreatDistance: 10,
  verticalRange: 1,
} as const;

export const PLAYER_NAVIGATION = {
  jumpReachHeight: 62,
  jumpLaunchTolerance: 5,
  platformEdgePadding: 2,
  routeStuckDistance: 2,
} as const;

export const WAVE_BALANCE = {
  wavesPerStage: 3,
  minMonstersPerWave: 3,
  maxMonstersPerWave: 4,
  chapterHpMultiplier: 0.18,
  chapterAttackMultiplier: 0.12,
  chapterRewardMultiplier: 0.1,
  offlineDpsEfficiency: 0.52,
  offlineExperienceMultiplier: 0.75,
  offlineMinimumWaveSeconds: 3.5,
  offlineMovementSecondsPerWave: 2.4,
} as const;

export const FLOATING_TEXT = {
  ttl: 0.75,
  riseSpeed: 18,
  maxCount: 50,
} as const;

export const PROGRESSION = {
  initialStageId: 1,
  offlineCapSeconds: 60 * 60 * 24,
} as const;

export const EXPERIENCE_CURVE = {
  // TODO(Phase 7): Reserve daily quest XP on top of this slow AFK-only baseline.
  baseNextExperience: 40000,
  firstKneeLevel: 40,
  secondKneeLevel: 80,
  earlyExponent: 1.25,
  midExponent: 1.7,
  lateExponent: 2.05,
  midSlope: 10,
  lateSlope: 240,
} as const;

export const STAT_GROWTH = {
  // TODO(Rework 2): Tune multiplicative point values after dodge and class passives enter combat.
  pointsPerLevel: 5,
  strAttackPercentPerPoint: 2,
  gritDefensePercentPerPoint: 2,
  gritHpPercentPerPoint: 1,
  agiEvasionPercentPerPoint: 2.5,
  autoPresets: {
    STR: { str: 5, grit: 0, agi: 0 },
    BAL: { str: 3, grit: 1, agi: 1 },
    GRIT: { str: 3, grit: 2, agi: 0 },
    AGI: { str: 3, grit: 0, agi: 2 },
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
  permanentStrPerRebirth: 1,
  permanentGritPerRebirth: 1,
  permanentAgiPerRebirth: 1,
} as const;

export const COMBAT_POWER = {
  // TODO(Phase 7): Tune after equipment, boss, and damage-reduction formulas are fixed.
  attackWeight: 10,
  defenseWeight: 4,
  hpWeight: 0.5,
  regenWeight: 20,
  evasionWeight: 2,
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
  // TODO(Phase 7): Current Stage 1 24h core sim is ~16,200 kills/day;
  // 0.0185% keeps regular equipment near 2-3 drops/day while preserving rarity weights.
  inventoryCapacity: 60,
  dropChance: 0.000185,
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
    upgradeWeight: 45,
    accuracyWeight: 1.5,
  },
  weaponDamage: {
    // TODO(Rework 2): Retune range width and accuracy after Chapter 1 miss-wall playtests.
    spreadByRarity: {
      common: 0.55,
      magic: 0.42,
      rare: 0.3,
      epic: 0.2,
      legendary: 0.12,
    },
    accuracyBase: 18,
    accuracyPerItemLevel: 2.2,
    accuracyPerRarityRank: 6,
  },
  weaponUpgrade: {
    // TODO(Rework 2): Tune gold sink against reroll/shop once weapon upgrade UI is formalized.
    baseCost: 70,
    costGrowth: 1.42,
    accuracyPerLevel: 8,
    damagePercentPerLevel: 4,
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

export const DAMAGE_FORMULA = {
  // TODO(Phase 7): Tune after 3D dummy scoring exists.
  unarmedStyleMultiplier: 0.75,
  unarmedMinDamage: 8,
  unarmedMaxDamage: 12,
  unarmedAccuracy: 24,
  critChanceCap: 75,
  attackSpeedCap: 100,
  lifeStealCap: 10,
  damageReductionCap: 50,
  defaultCritDamage: 1.2,
  variance: 0.05,
  defenseScale: 100,
  minimumDamage: 1,
  evasionK: 25,
  accuracyPenaltyThresholdRatio: 0.3,
  accuracyMaxPenalty: 0.6,
} as const;

export const MONSTER_COMBAT = {
  // TODO(Rework 2): Tune chapter hit/evasion values after weapon upgrade pacing is playable.
  accuracyByChapter: [9, 16, 24, 34, 46, 60],
  evasionByChapter: [6, 18, 34, 52, 74, 98],
  stageOneOffsets: {
    wildDog: { accuracy: -1, evasion: -2 },
    nobleWraith: { accuracy: 0, evasion: 1 },
    lesserImp: { accuracy: 2, evasion: 3 },
    lucianWraith: { accuracy: 1, evasion: 2 },
    marcelaSeed: { accuracy: 0, evasion: 0 },
  },
} as const;

export const ALTAR_BALANCE = {
  // TODO(Phase 7): Current Stage 1 24h core sim is ~16,200 blood/day;
  // 323 blood per elite challenge is ~50 altar charges/day at the present wave pace.
  bloodByKillType: {
    normal: 1,
    elite: 5,
    boss: 100,
  },
  stageBloodMultiplier: 0.05,
  eliteBloodCost: 323,
  eliteBloodCostGrowth: 1,
  eliteTimeLimitSeconds: 45,
  initialLevel: 1,
  levelExperienceBase: 100,
  levelExperienceGrowth: 1.28,
  eliteStats: {
    // TODO(Altar v2): Retune after real Chapter 1 elite sprites and reward pacing are playable.
    baseHp: 420,
    hpPerLevel: 0.24,
    baseAttack: 10,
    attackPerLevel: 0.12,
    baseDefense: 4,
    defensePerLevel: 0.08,
    baseAccuracy: 18,
    accuracyPerLevel: 1,
    baseEvasion: 6,
    evasionPerLevel: 0.5,
    baseGold: 520,
    goldPerLevel: 0.18,
    baseExperience: 260,
    experiencePerLevel: 0.18,
    baseAltarExperience: 28,
    altarExperiencePerLevel: 0.14,
    moveSpeed: 12,
    spawnOffsetX: 8,
    platformInsetX: 3,
    relicDropChance: 0.02,
  },
  relicGrades: {
    // TODO(Altar v2): Tune unlock levels and owned stat ranges after elite clear pacing is playable.
    common: {
      rank: 0,
      altarLevel: 1,
      rebirthCount: 0,
      dropWeight: 70,
      ownedStats: { atk: 1, hp: 6, def: 0.2 },
      variance: 0.08,
    },
    magic: {
      rank: 1,
      altarLevel: 3,
      rebirthCount: 0,
      dropWeight: 22,
      ownedStats: { atk: 2.2, hp: 13, def: 0.45 },
      variance: 0.1,
    },
    rare: {
      rank: 2,
      altarLevel: 6,
      rebirthCount: 0,
      dropWeight: 7,
      ownedStats: { atk: 4.2, hp: 26, def: 0.9 },
      variance: 0.12,
    },
    epic: {
      rank: 3,
      altarLevel: 10,
      rebirthCount: 1,
      dropWeight: 2,
      ownedStats: { atk: 7, hp: 44, def: 1.5 },
      variance: 0.14,
    },
    legendary: {
      rank: 4,
      altarLevel: 15,
      rebirthCount: 2,
      dropWeight: 0.5,
      ownedStats: { atk: 11, hp: 72, def: 2.5 },
      variance: 0.16,
    },
  },
  relicOwnedStatCapPerAltarLevel: 0.015,
  relicOwnedStatPerStarBonus: 0.12,
  duplicateRequirementsByCurrentStar: {
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 3,
    6: 4,
  },
  maxStars: 7,
  bossGateStar: 3,
} as const;

export const RELIC_BALANCE = {
  // TODO(Phase 7): Tune each build against Chapter 1 vertical slice.
  specterLord: {
    styleMultiplier: 1.05,
    maxSpecters: 4,
    fiveStarExtraSpecters: 2,
    specterTtlSeconds: 20,
    specterDamageMultiplier: 0.35,
    explosionDamage: 12,
  },
  bloodBerserker: {
    styleMultiplier: 0.72,
    cooldownMultiplier: 0.5,
    lifeSteal: 8,
    hpLeakPerSecondPercent: 1,
    threeStarAttackSpeedBonus: 25,
    fiveStarKillPauseSeconds: 3,
  },
  plagueDoctor: {
    styleMultiplier: 0,
    stackDamage: 6,
    directStackGain: 1,
    spreadStacks: 1,
    cloudHealPerSecond: 1.2,
  },
  martyr: {
    styleMultiplier: 1,
    selfDamagePercent: 2,
    damagePerMissingHpPercent: 1.5,
    lowHpThresholdPercent: 30,
    threeStarCritChanceBonus: 25,
  },
  executioner: {
    styleMultiplier: 1.15,
    cooldownMultiplier: 1.45,
    markPerHit: 1,
    markThreshold: 3,
    executeHpPercent: 35,
    bossExecuteHpPercent: 8,
  },
  kingsShadow: {
    styleMultiplier: 0.9,
    gaugePerHit: 25,
    overdriveThreshold: 100,
    overdriveSeconds: 4,
    overdriveStyleMultiplier: 1.6,
    overdriveKillBonusSeconds: 0.5,
    exhaustionSeconds: 2,
  },
} as const;

export const PHASE_3C_DEBUG = {
  // TODO(Phase 4): Remove this console-only verification path when formal altar UI lands.
  demoSeconds: 20,
  demoSeed: 3237998081,
} as const;

export const STANDARD_DUMMY = {
  // TODO(Phase 7): Tune dummy defense and duration after the first combat-score distribution pass.
  durationSeconds: 60,
  seed: 2882400001,
  hp: 1_000_000_000,
  defense: 20,
  damageReduction: 0,
  accuracy: 0,
  evasion: 0,
  warmupKillTriggers: 1,
} as const;

export const STAGE_BALANCE = {
  // TODO(Phase 7): Tune challenge limits and unlock pacing after Chapter 1 vertical slice playtests.
  chapters: 6,
  stagesPerChapter: 10,
  totalStages: 60,
  challengeTimeLimitSeconds: 45,
  recommendedHuntStageOffset: 1,
} as const;

export const BOSS_BALANCE = {
  // TODO(Phase 7): Tune all boss walls against the pacing table after full Chapter 1-6 playtests.
  common: {
    attackIntervalSeconds: 2.5,
    defenseDamageReduction: 0.25,
    accuracyBase: 14,
    evasionBase: 8,
    accuracyPerChapter: 8,
    evasionPerChapter: 12,
  },
  lucian: {
    stageId: 10,
    hp: 1600,
    attack: 12,
    defense: 12,
    experience: 220,
    gold: 180,
    summonIntervalSeconds: 15,
    summonCount: 2,
    rebirthSummonCountBonus: 1,
    maxSummons: 8,
    wraithHp: 130,
    wraithAttack: 4,
    wraithHealPercentPerSecond: 0.005,
    wraithExperience: 0,
    wraithGold: 0,
  },
  gravemaw: {
    healPercentPerSecond: 0.005,
    lowHpThreshold: 0.5,
    lowHpHealMultiplier: 2,
    rebirthHealMultiplier: 1.3,
  },
  marcela: {
    seedIntervalSeconds: 8,
    seedCount: 3,
    rebirthSeedCountBonus: 1,
    maxSeeds: 12,
    seedHp: 90,
    seedAttack: 0,
    seedGerminateSeconds: 4,
    dotDamagePerSecond: 4,
  },
  cardion: {
    enrageThreshold: 0.4,
    attackCooldownMultiplier: 0.5,
    damageMultiplier: 1.5,
    playerRegenMultiplier: 0.5,
  },
  azar: {
    markIntervalSeconds: 30,
    markDamageTakenBonus: 25,
    markAttackSpeedPenalty: 15,
    markHealPercent: 0.2,
    phaseTwoThreshold: 0.3,
    phaseTwoDefenseMultiplier: 0.5,
  },
  leonid: {
    phaseTwoThreshold: 0.5,
    telegraphDurationSeconds: 5,
    weakenDurationSeconds: 10,
    enrageDurationSeconds: 15,
    enrageDamageMultiplier: 2,
    weakenDamageTakenMultiplier: 2,
    altarCounterBloodCost: 30,
    telegraphPeriods: [
      { hpThreshold: 0.15, seconds: 20 },
      { hpThreshold: 0.3, seconds: 30 },
      { hpThreshold: 0.5, seconds: 45 },
    ],
  },
  bossStub: {
    hpMultiplierPerChapter: 1.45,
  },
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
