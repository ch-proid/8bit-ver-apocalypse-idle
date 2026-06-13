import { CLASS_BALANCE, DAMAGE_FORMULA } from "../data/balance";
import { PLAYER_CLASSES } from "../data/classes";
import type { ClassCombatState, ClassId, Monster, Player, ProgressState, WorldState } from "./types";

export function defaultClassId(): ClassId {
  return CLASS_BALANCE.defaultClassId as ClassId;
}

export function normalizeClassId(value: unknown): ClassId {
  return typeof value === "string" && value in PLAYER_CLASSES
    ? value as ClassId
    : defaultClassId();
}

export function getPlayerClass(classId: ClassId) {
  return PLAYER_CLASSES[classId] ?? PLAYER_CLASSES[defaultClassId()];
}

export function createDefaultClassCombatState(): ClassCombatState {
  return {
    mageDots: {},
    lastTriggered: null,
  };
}

export function cloneClassCombatState(state: ClassCombatState): ClassCombatState {
  return {
    mageDots: Object.fromEntries(
      Object.entries(state.mageDots).map(([id, dot]) => [id, { ...dot }]),
    ),
    lastTriggered: state.lastTriggered,
  };
}

export function classCritProfile(progress: ProgressState): {
  critChanceCap: number;
  critChanceBonus: number;
  critDamageBonus: number;
} {
  if (progress.classId !== "assassin") {
    return {
      critChanceCap: DAMAGE_FORMULA.critChanceCap,
      critChanceBonus: 0,
      critDamageBonus: 0,
    };
  }

  return {
    critChanceCap: CLASS_BALANCE.assassin.passive.critChanceCap,
    critChanceBonus: CLASS_BALANCE.assassin.passive.baseCritChance,
    critDamageBonus: CLASS_BALANCE.assassin.passive.critDamageBonus,
  };
}

export function classDamageIncreaseBonus(progress: ProgressState, _player: Player, monster: Monster): number {
  if (progress.classId !== "knight") {
    return 0;
  }

  const hpPercent = monster.maxHp > 0 ? monster.hp / monster.maxHp * 100 : 100;
  if (hpPercent > CLASS_BALANCE.knight.passive.lowHpExecutionThreshold) {
    return 0;
  }

  // Knight's defense-to-attack conversion is applied in stats.ts. This is the low-HP execution damage hook.
  return CLASS_BALANCE.knight.passive.lowHpDamageBonusPercent;
}

export function applyClassAfterHit(
  progress: ProgressState,
  world: WorldState,
  monster: Monster,
  dealtDamage: number,
): { extraDamage: number; channel: "none" | "mageDot" } {
  if (progress.classId !== "mage" || dealtDamage <= 0 || !monster.alive) {
    return { extraDamage: 0, channel: "none" };
  }

  const current = world.classCombat.mageDots[monster.instanceId] ?? { stacks: 0, ttl: 0 };
  world.classCombat.mageDots[monster.instanceId] = {
    stacks: Math.min(CLASS_BALANCE.mage.passive.maxStacks, current.stacks + 1),
    ttl: CLASS_BALANCE.mage.passive.dotSeconds,
  };
  world.classCombat.lastTriggered = "MAGE_DOT_APPLIED";
  return { extraDamage: 0, channel: "mageDot" };
}

export function applyClassPassiveDamage(
  progress: ProgressState,
  world: WorldState,
  monster: Monster,
  dt: number,
): { extraDamage: number; channel: "none" | "mageDot" } {
  if (progress.classId !== "mage") {
    return { extraDamage: 0, channel: "none" };
  }

  const dot = world.classCombat.mageDots[monster.instanceId];
  if (!dot || dot.stacks <= 0 || dot.ttl <= 0 || !monster.alive) {
    delete world.classCombat.mageDots[monster.instanceId];
    return { extraDamage: 0, channel: "none" };
  }

  dot.ttl = Math.max(0, dot.ttl - dt);
  const damage = monster.maxHp * (CLASS_BALANCE.mage.passive.dotHpPercent / 100) * dot.stacks * dt;
  monster.hp = Math.max(0, monster.hp - damage);
  if (dot.ttl <= 0) {
    delete world.classCombat.mageDots[monster.instanceId];
  }
  world.classCombat.lastTriggered = "MAGE_DOT_TICK";
  return { extraDamage: damage, channel: "mageDot" };
}
