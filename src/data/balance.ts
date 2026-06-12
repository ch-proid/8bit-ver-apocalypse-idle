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
