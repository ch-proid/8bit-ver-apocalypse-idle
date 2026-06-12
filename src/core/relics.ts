import { DAMAGE_FORMULA, RELIC_BALANCE } from "../data/balance";
import { calculateSinAffixStats } from "./equipment";
import { relicStars } from "./altar";
import type { Monster, Player, ProgressState, RelicCombatState, RelicId, SpecterEntity, WorldState } from "./types";

export interface RelicDamageHooks {
  styleMultiplier: number;
  cooldownMultiplier: number;
  damageIncreaseBonus: number;
  critChanceBonus: number;
  allowZeroDirectDamage: boolean;
}

export interface RelicHitResult {
  extraDamage: number;
  channel: "none" | "plague" | "execute" | "specter";
}

export function createDefaultRelicCombatState(): RelicCombatState {
  return {
    specters: [],
    plagueStacks: {},
    plagueClouds: 0,
    executionMarks: {},
    overdriveGauge: 0,
    overdriveTimer: 0,
    exhaustionTimer: 0,
    isOverdrive: false,
    bloodLeakPauseTimer: 0,
    lastTriggered: null,
  };
}

export function cloneRelicCombatState(state: RelicCombatState): RelicCombatState {
  return {
    specters: state.specters.map((specter) => ({ ...specter })),
    plagueStacks: { ...state.plagueStacks },
    plagueClouds: state.plagueClouds,
    executionMarks: { ...state.executionMarks },
    overdriveGauge: state.overdriveGauge,
    overdriveTimer: state.overdriveTimer,
    exhaustionTimer: state.exhaustionTimer,
    isOverdrive: state.isOverdrive,
    bloodLeakPauseTimer: state.bloodLeakPauseTimer,
    lastTriggered: state.lastTriggered,
  };
}

export function relicDamageHooks(progress: ProgressState, world: WorldState, player: Player): RelicDamageHooks {
  const relicId = progress.altar.equippedRelicId;
  const stars = relicStars(progress.altar, relicId);
  const sin = calculateSinAffixStats(progress.inventory.equipped);

  if (!relicId || stars <= 0) {
    return baseHooks(DAMAGE_FORMULA.unarmedStyleMultiplier);
  }

  if (relicId === "specterLord") {
    return baseHooks(RELIC_BALANCE.specterLord.styleMultiplier * (1 + sin.specterDamage / 100));
  }

  if (relicId === "bloodBerserker") {
    const threeStarSpeed = stars >= 3 && world.relicCombat.bloodLeakPauseTimer <= 0
      ? 1 + RELIC_BALANCE.bloodBerserker.threeStarAttackSpeedBonus / 100
      : 1;
    return {
      ...baseHooks(RELIC_BALANCE.bloodBerserker.styleMultiplier),
      cooldownMultiplier: RELIC_BALANCE.bloodBerserker.cooldownMultiplier / threeStarSpeed,
    };
  }

  if (relicId === "plagueDoctor") {
    return {
      ...baseHooks(RELIC_BALANCE.plagueDoctor.styleMultiplier),
      allowZeroDirectDamage: true,
    };
  }

  if (relicId === "martyr") {
    const missingHpPercent = player.maxHp <= 0 ? 0 : ((player.maxHp - player.hp) / player.maxHp) * 100;
    const lowHpCrit = stars >= 3 && player.hp / player.maxHp * 100 <= RELIC_BALANCE.martyr.lowHpThresholdPercent
      ? RELIC_BALANCE.martyr.threeStarCritChanceBonus
      : 0;
    return {
      ...baseHooks(RELIC_BALANCE.martyr.styleMultiplier),
      damageIncreaseBonus: missingHpPercent * RELIC_BALANCE.martyr.damagePerMissingHpPercent + sin.martyrPain,
      critChanceBonus: lowHpCrit,
    };
  }

  if (relicId === "executioner") {
    return {
      ...baseHooks(RELIC_BALANCE.executioner.styleMultiplier),
      cooldownMultiplier: RELIC_BALANCE.executioner.cooldownMultiplier,
    };
  }

  if (relicId === "kingsShadow") {
    const overdriveBonus = world.relicCombat.isOverdrive ? RELIC_BALANCE.kingsShadow.overdriveStyleMultiplier : 1;
    return baseHooks(RELIC_BALANCE.kingsShadow.styleMultiplier * overdriveBonus);
  }

  return baseHooks(DAMAGE_FORMULA.unarmedStyleMultiplier);
}

export function updateRelicCombat(progress: ProgressState, world: WorldState, dt: number): void {
  const relicId = progress.altar.equippedRelicId;
  world.relicCombat.specters = world.relicCombat.specters
    .map((specter) => ({ ...specter, ttl: Math.max(0, specter.ttl - dt) }))
    .filter((specter) => specter.ttl > 0);
  world.relicCombat.bloodLeakPauseTimer = Math.max(0, world.relicCombat.bloodLeakPauseTimer - dt);

  if (world.relicCombat.overdriveTimer > 0) {
    world.relicCombat.overdriveTimer = Math.max(0, world.relicCombat.overdriveTimer - dt);
    world.relicCombat.isOverdrive = world.relicCombat.overdriveTimer > 0;
    if (!world.relicCombat.isOverdrive && relicId === "kingsShadow" && relicStars(progress.altar, relicId) < 5) {
      world.relicCombat.exhaustionTimer = RELIC_BALANCE.kingsShadow.exhaustionSeconds;
    }
  } else {
    world.relicCombat.isOverdrive = false;
  }
  world.relicCombat.exhaustionTimer = Math.max(0, world.relicCombat.exhaustionTimer - dt);

  if (relicId === "bloodBerserker" && world.relicCombat.bloodLeakPauseTimer <= 0) {
    const leak = world.player.maxHp * RELIC_BALANCE.bloodBerserker.hpLeakPerSecondPercent / 100 * dt;
    world.player.hp = Math.max(1, world.player.hp - leak);
  }

  if (relicId === "plagueDoctor" && relicStars(progress.altar, relicId) >= 5 && world.relicCombat.plagueClouds > 0) {
    world.player.hp = Math.min(
      world.player.maxHp,
      world.player.hp + RELIC_BALANCE.plagueDoctor.cloudHealPerSecond * world.relicCombat.plagueClouds * dt,
    );
  }
}

export function applyRelicBeforeAttack(progress: ProgressState, world: WorldState): void {
  const relicId = progress.altar.equippedRelicId;
  if (relicId !== "martyr") {
    return;
  }

  const selfDamage = world.player.maxHp * RELIC_BALANCE.martyr.selfDamagePercent / 100;
  const stars = relicStars(progress.altar, relicId);
  const minHp = stars >= 5 ? 1 : 0;
  world.player.hp = Math.max(minHp, world.player.hp - selfDamage);
}

export function applyRelicAfterHit(
  progress: ProgressState,
  world: WorldState,
  monster: Monster,
  normalDamage: number,
): RelicHitResult {
  const relicId = progress.altar.equippedRelicId;
  const stars = relicStars(progress.altar, relicId);
  const sin = calculateSinAffixStats(progress.inventory.equipped);

  if (!relicId || stars <= 0) {
    return { extraDamage: 0, channel: "none" };
  }

  if (relicId === "bloodBerserker") {
    const leechPercent = Math.min(
      DAMAGE_FORMULA.lifeStealCap,
      RELIC_BALANCE.bloodBerserker.lifeSteal + sin.bloodLeech,
    );
    world.player.hp = Math.min(world.player.maxHp, world.player.hp + normalDamage * leechPercent / 100);
    world.relicCombat.lastTriggered = "BLOOD";
    return { extraDamage: 0, channel: "none" };
  }

  if (relicId === "plagueDoctor") {
    const current = world.relicCombat.plagueStacks[monster.instanceId] ?? 0;
    const nextStacks = current + RELIC_BALANCE.plagueDoctor.directStackGain;
    world.relicCombat.plagueStacks[monster.instanceId] = nextStacks;
    const extraDamage = Math.floor(
      nextStacks * RELIC_BALANCE.plagueDoctor.stackDamage * (1 + sin.plagueSpread / 100),
    );
    monster.hp = Math.max(0, monster.hp - extraDamage);
    world.relicCombat.lastTriggered = "PLAGUE";
    return { extraDamage, channel: "plague" };
  }

  if (relicId === "executioner") {
    const current = world.relicCombat.executionMarks[monster.instanceId] ?? 0;
    const threshold = Math.max(1, RELIC_BALANCE.executioner.markThreshold - sin.executionThreshold);
    const nextMarks = current + RELIC_BALANCE.executioner.markPerHit;
    world.relicCombat.executionMarks[monster.instanceId] = nextMarks;
    if (nextMarks >= threshold) {
      world.relicCombat.executionMarks[monster.instanceId] = 0;
      // Separate percentage-damage channel: execution intentionally bypasses the normal formula.
      const extraDamage = Math.floor(monster.maxHp * RELIC_BALANCE.executioner.executeHpPercent / 100);
      monster.hp = Math.max(0, monster.hp - extraDamage);
      world.relicCombat.lastTriggered = "EXECUTE";
      return { extraDamage, channel: "execute" };
    }
  }

  if (relicId === "kingsShadow" && world.relicCombat.exhaustionTimer <= 0) {
    world.relicCombat.overdriveGauge += RELIC_BALANCE.kingsShadow.gaugePerHit + sin.despairBurst;
    if (world.relicCombat.overdriveGauge >= RELIC_BALANCE.kingsShadow.overdriveThreshold) {
      world.relicCombat.overdriveGauge = 0;
      world.relicCombat.overdriveTimer = RELIC_BALANCE.kingsShadow.overdriveSeconds + sin.despairBurst * 0.1;
      world.relicCombat.isOverdrive = true;
      world.relicCombat.lastTriggered = "OVERDRIVE";
    }
  }

  return { extraDamage: 0, channel: "none" };
}

export function applyRelicPassiveDamage(
  progress: ProgressState,
  world: WorldState,
  monster: Monster,
  dt: number,
): RelicHitResult {
  const relicId = progress.altar.equippedRelicId;
  const stars = relicStars(progress.altar, relicId);
  if (relicId !== "specterLord" || stars <= 0 || world.relicCombat.specters.length <= 0 || !monster.alive) {
    return { extraDamage: 0, channel: "none" };
  }

  const totalMultiplier = world.relicCombat.specters.reduce((sum, specter) => sum + specter.damageMultiplier, 0);
  const extraDamage = world.player.attack * totalMultiplier * dt;
  monster.hp = Math.max(0, monster.hp - extraDamage);
  world.relicCombat.lastTriggered = "SPECTER_HIT";
  return { extraDamage, channel: "specter" };
}

export function applyRelicOnKill(progress: ProgressState, world: WorldState, monster: Monster): void {
  const relicId = progress.altar.equippedRelicId;
  const stars = relicStars(progress.altar, relicId);
  const sin = calculateSinAffixStats(progress.inventory.equipped);

  if (!relicId || stars <= 0) {
    return;
  }

  if (relicId === "specterLord") {
    const cap = RELIC_BALANCE.specterLord.maxSpecters
      + (stars >= 5 ? RELIC_BALANCE.specterLord.fiveStarExtraSpecters : 0)
      + Math.floor(sin.specterDamage / 25);
    if (world.relicCombat.specters.length < cap) {
      world.relicCombat.specters.push(createSpecter(world, sin.specterDamage));
      world.relicCombat.lastTriggered = "SPECTER";
    }
  }

  if (relicId === "bloodBerserker" && stars >= 5) {
    world.relicCombat.bloodLeakPauseTimer = RELIC_BALANCE.bloodBerserker.fiveStarKillPauseSeconds;
  }

  if (relicId === "plagueDoctor") {
    world.relicCombat.plagueClouds += 1;
    delete world.relicCombat.plagueStacks[monster.instanceId];
    world.relicCombat.lastTriggered = "CLOUD";
  }

  if (relicId === "executioner" && stars >= 3) {
    for (const other of world.monsters) {
      if (other.alive && other.instanceId !== monster.instanceId) {
        world.relicCombat.executionMarks[other.instanceId] = (world.relicCombat.executionMarks[other.instanceId] ?? 0) + 1;
      }
    }
  }

  if (relicId === "kingsShadow" && world.relicCombat.isOverdrive && stars >= 3) {
    world.relicCombat.overdriveTimer += RELIC_BALANCE.kingsShadow.overdriveKillBonusSeconds;
  }
}

export function relicDebugSnapshot(progress: ProgressState, world: WorldState): Record<string, string | number | boolean | null> {
  return {
    relic: progress.altar.equippedRelicId,
    stars: relicStars(progress.altar, progress.altar.equippedRelicId),
    lastTriggered: world.relicCombat.lastTriggered,
    specters: world.relicCombat.specters.length,
    plagueStacks: Object.values(world.relicCombat.plagueStacks).reduce((sum, value) => sum + value, 0),
    executionMarks: Object.values(world.relicCombat.executionMarks).reduce((sum, value) => sum + value, 0),
    overdriveGauge: world.relicCombat.overdriveGauge,
    isOverdrive: world.relicCombat.isOverdrive,
  };
}

function baseHooks(styleMultiplier: number): RelicDamageHooks {
  return {
    styleMultiplier,
    cooldownMultiplier: 1,
    damageIncreaseBonus: 0,
    critChanceBonus: 0,
    allowZeroDirectDamage: false,
  };
}

function createSpecter(world: WorldState, sinSpecterDamage: number): SpecterEntity {
  return {
    id: `sp${world.nextEntityId++}`,
    ttl: RELIC_BALANCE.specterLord.specterTtlSeconds,
    damageMultiplier: RELIC_BALANCE.specterLord.specterDamageMultiplier * (1 + sinSpecterDamage / 100),
  };
}
