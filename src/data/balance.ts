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
  attackRange: 18,
  attackCooldown: 0.55,
  levelAtkGain: 3,
  levelHpGain: 12,
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
  baseNextExperience: 32,
  offlineCapSeconds: 60 * 60 * 10,
} as const;

export function nextExperienceForLevel(level: number): number {
  return Math.floor(PROGRESSION.baseNextExperience * Math.pow(level, 1.5));
}
