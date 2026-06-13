import { FIXED_DELTA, STANDARD_DUMMY, TICK_RATE } from "../data/balance";
import { cloneOwnedRelics } from "./altar";
import { applyClassAfterHit, applyClassPassiveDamage } from "./class";
import { calculateCombatAffixStats, cloneEquipped, cloneItem } from "./equipment";
import { createDefaultProgress, updateRecord } from "./progression";
import { createInitialSimulation } from "./stage";
import {
  applyRelicAfterHit,
  applyRelicBeforeAttack,
  applyRelicOnKill,
  applyRelicPassiveDamage,
  relicDamageHooks,
  updateRelicCombat,
} from "./relics";
import { clampCombatAffixes, dealPlayerDamage, effectiveAttackCooldown } from "./combat";
import type {
  ClassId,
  EquippedItems,
  EquipmentItem,
  Monster,
  OwnedRelics,
  ProgressState,
  RelicId,
  SimulationState,
  StatAllocation,
  StatDistributionState,
  WorldState,
} from "./types";

export interface BuildSnapshot {
  classId: ClassId;
  statDistribution: StatDistributionState;
  permanentStats: StatAllocation;
  equipped: EquippedItems;
  equippedRelicId: RelicId | null;
  ownedRelics: OwnedRelics;
}

export interface DummySimulationOptions {
  seed?: number;
  durationSeconds?: number;
}

export interface DummySimulationResult {
  combatScore: number;
  totalDamage: number;
  ticks: number;
}

export interface EquipmentScoreComparison {
  currentScore: number;
  candidateScore: number;
  delta: number;
  deltaPercent: number;
}

export function createBuildSnapshot(progress: ProgressState): BuildSnapshot {
  return {
    classId: progress.classId,
    statDistribution: cloneStatDistribution(progress.statDistribution),
    permanentStats: { ...progress.rebirth.permanentStats },
    equipped: cloneEquipped(progress.inventory.equipped),
    equippedRelicId: progress.altar.equippedRelicId,
    ownedRelics: cloneOwnedRelics(progress.altar.owned),
  };
}

export function simulateStandardDummy(
  snapshot: BuildSnapshot,
  options: DummySimulationOptions = {},
): DummySimulationResult {
  const durationSeconds = options.durationSeconds ?? STANDARD_DUMMY.durationSeconds;
  const ticks = Math.floor(durationSeconds * TICK_RATE);
  const simulation = createDummySimulation(snapshot, options.seed ?? STANDARD_DUMMY.seed);
  const dummy = simulation.world.monsters[0];
  let totalDamage = 0;

  warmupKillTriggeredRelics(simulation);

  for (let i = 0; i < ticks; i += 1) {
    totalDamage += stepDummyCombat(simulation, dummy, FIXED_DELTA);
  }

  return {
    combatScore: Math.max(0, Math.floor(totalDamage)),
    totalDamage,
    ticks,
  };
}

export function calculateCombatScore(snapshot: BuildSnapshot, options: DummySimulationOptions = {}): number {
  return simulateStandardDummy(snapshot, options).combatScore;
}

export function compareEquipmentCombatScore(
  snapshot: BuildSnapshot,
  candidate: EquipmentItem,
  options: DummySimulationOptions = {},
): EquipmentScoreComparison {
  const currentScore = calculateCombatScore(snapshot, options);
  const candidateSnapshot = cloneBuildSnapshot(snapshot);
  candidateSnapshot.equipped[candidate.slot] = cloneItem(candidate);
  const candidateScore = calculateCombatScore(candidateSnapshot, options);
  const delta = candidateScore - currentScore;

  return {
    currentScore,
    candidateScore,
    delta,
    deltaPercent: currentScore > 0 ? delta / currentScore * 100 : 0,
  };
}

export function updateDummyScoreRecord(progress: ProgressState, world: WorldState, score: number): void {
  updateRecord(progress.records.dummyScore, score, world.elapsed);
}

function createDummySimulation(snapshot: BuildSnapshot, seed: number): SimulationState {
  const progress = createProgressFromSnapshot(snapshot);
  const simulation = createInitialSimulation(1, progress, seed);
  const player = simulation.world.player;
  player.position.x = 40;
  player.position.y = 100;
  player.velocity.x = 0;
  player.velocity.y = 0;
  player.attackTimer = 0;
  player.hp = player.maxHp;
  simulation.world.monsters = [createDummyMonster()];
  simulation.world.wave = null;
  return simulation;
}

function createProgressFromSnapshot(snapshot: BuildSnapshot): ProgressState {
  const progress = createDefaultProgress(1);
  progress.classId = snapshot.classId;
  progress.statDistribution = cloneStatDistribution(snapshot.statDistribution);
  progress.rebirth.permanentStats = { ...snapshot.permanentStats };
  progress.inventory.equipped = cloneEquipped(snapshot.equipped);
  progress.altar.owned = cloneOwnedRelics(snapshot.ownedRelics);
  progress.altar.equippedRelicId = snapshot.equippedRelicId && progress.altar.owned[snapshot.equippedRelicId]
    ? snapshot.equippedRelicId
    : null;
  return progress;
}

function stepDummyCombat(simulation: SimulationState, dummy: Monster, dt: number): number {
  const { progress, world } = simulation;
  const player = world.player;
  let totalDamage = 0;

  world.elapsed += dt;
  player.attackTimer = Math.max(0, player.attackTimer - dt);
  player.hp = Math.min(player.maxHp, player.hp + player.hpRegen * dt);
  updateRelicCombat(progress, world, dt);

  const passiveResult = applyRelicPassiveDamage(progress, world, dummy, dt);
  const classPassiveResult = applyClassPassiveDamage(progress, world, dummy, dt);
  totalDamage += passiveResult.extraDamage + classPassiveResult.extraDamage;

  if (player.attackTimer <= 0) {
    applyRelicBeforeAttack(progress, world);
    const damageResult = dealPlayerDamage(player, dummy, progress, world);
    const relicResult = applyRelicAfterHit(progress, world, dummy, damageResult.finalDamage);
    const classResult = applyClassAfterHit(progress, world, dummy, damageResult.finalDamage);
    const hitDamage = damageResult.finalDamage + relicResult.extraDamage + classResult.extraDamage;
    totalDamage += hitDamage;
    applyLifeSteal(progress, world, hitDamage);
    const hooks = relicDamageHooks(progress, world, player);
    player.attackTimer = effectiveAttackCooldown(
      player.attackCooldown,
      calculateCombatAffixStats(progress.inventory.equipped),
      hooks.cooldownMultiplier,
    );
  }

  return totalDamage;
}

function applyLifeSteal(progress: ProgressState, world: WorldState, damage: number): void {
  const lifeSteal = clampCombatAffixes(calculateCombatAffixStats(progress.inventory.equipped)).lifeSteal;
  if (lifeSteal <= 0 || damage <= 0) {
    return;
  }

  world.player.hp = Math.min(world.player.maxHp, world.player.hp + damage * lifeSteal / 100);
}

function warmupKillTriggeredRelics(simulation: SimulationState): void {
  if (simulation.progress.altar.equippedRelicId !== "specterLord") {
    return;
  }

  for (let i = 0; i < STANDARD_DUMMY.warmupKillTriggers; i += 1) {
    applyRelicOnKill(simulation.progress, simulation.world, simulation.world.monsters[0]);
  }
}

function cloneBuildSnapshot(snapshot: BuildSnapshot): BuildSnapshot {
  return {
    classId: snapshot.classId,
    statDistribution: cloneStatDistribution(snapshot.statDistribution),
    permanentStats: { ...snapshot.permanentStats },
    equipped: cloneEquipped(snapshot.equipped),
    equippedRelicId: snapshot.equippedRelicId,
    ownedRelics: cloneOwnedRelics(snapshot.ownedRelics),
  };
}

function cloneStatDistribution(distribution: StatDistributionState): StatDistributionState {
  return {
    assigned: { ...distribution.assigned },
    unspentPoints: distribution.unspentPoints,
    preset: distribution.preset,
  };
}

function createDummyMonster(): Monster {
  return {
    instanceId: "standardDummy",
    monsterId: "standardDummy",
    name: "STANDARD DUMMY",
    assetKey: "dummy.standard",
    position: { x: 50, y: 100 },
    spawnPosition: { x: 50, y: 100 },
    velocity: { x: 0, y: 0 },
    platformId: "floor",
    width: 16,
    height: 24,
    hp: STANDARD_DUMMY.hp,
    maxHp: STANDARD_DUMMY.hp,
    defense: STANDARD_DUMMY.defense,
    damageReduction: STANDARD_DUMMY.damageReduction,
    accuracy: STANDARD_DUMMY.accuracy,
    evasion: STANDARD_DUMMY.evasion,
    attack: 0,
    experience: 0,
    gold: 0,
    moveSpeed: 0,
    respawnTime: 0,
    respawnTimer: 0,
    alive: true,
    direction: 1,
    fadeTimer: 0,
    spawnInvulnTimer: 0,
    hitSlowTimer: 0,
    aggro: false,
    aggroDelayTimer: 0,
    color: "#d8e3c8",
    role: "normal",
  };
}
