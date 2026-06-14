import { ALTAR_BALANCE, MONSTER_BALANCE } from "../data/balance";
import { ALTAR_ELITE } from "../data/elites";
import {
  addAltarExperience,
  altarEliteStatsForLevel,
  eliteSummonCost,
  grantRelic,
  rollEliteRelicDrop,
  spendBloodForElite,
} from "./altar";
import { addDropIcon, grantRewards } from "./progression";
import { rebirthEnemyAttackMultiplier, rebirthEnemyDefenseMultiplier, rebirthEnemyHpMultiplier } from "./rebirthScaling";
import { getPlatformById, platformCenterX } from "./stage";
import { applyPlayerStats } from "./stats";
import type { Monster, Platform, SimulationState } from "./types";

export function startAltarEliteEncounter(state: SimulationState): boolean {
  if (state.world.altarElite || state.world.monsters.some((monster) => monster.role === "elite" && monster.alive)) {
    return false;
  }

  if (!spendBloodForElite(state.progress.altar)) {
    return false;
  }

  const elite = createAltarEliteMonster(state);
  state.world.monsters = state.world.monsters.filter((monster) => monster.role !== "elite");
  state.world.monsters.push(elite);
  state.world.altarElite = {
    instanceId: elite.instanceId,
    level: state.progress.altar.level,
    timer: ALTAR_BALANCE.eliteTimeLimitSeconds,
    timeLimit: ALTAR_BALANCE.eliteTimeLimitSeconds,
  };
  state.world.player.targetId = elite.instanceId;
  return true;
}

export function createAltarEliteMonster(state: SimulationState): Monster {
  const platform = getPlatformById(state.world.platforms, state.world.player.platformId)
    ?? getPlatformById(state.world.platforms, "floor")
    ?? state.world.platforms[0];
  if (!platform) {
    throw new Error("altar elite requires at least one platform");
  }
  const level = state.progress.altar.level;
  const stats = altarEliteStatsForLevel(level);
  const maxHp = Math.max(1, Math.round(stats.maxHp * rebirthEnemyHpMultiplier(state.progress.rebirth.count)));
  const attack = Math.max(0, Math.round(stats.attack * rebirthEnemyAttackMultiplier(state.progress.rebirth.count)));
  const x = spawnXNearPlayer(platform, state.world.player.position.x, ALTAR_ELITE.width);
  const y = platform.y - ALTAR_ELITE.height;

  return {
    instanceId: `elite-${state.world.nextEntityId++}`,
    monsterId: ALTAR_ELITE.id,
    name: ALTAR_ELITE.name,
    assetKey: ALTAR_ELITE.assetKey,
    position: { x, y },
    spawnPosition: { x, y },
    velocity: { x: 0, y: 0 },
    platformId: platform.id,
    width: ALTAR_ELITE.width,
    height: ALTAR_ELITE.height,
    hp: maxHp,
    maxHp,
    defense: eliteDefenseForLevel(level, state.progress.rebirth.count),
    damageReduction: 0,
    accuracy: eliteAccuracyForLevel(level),
    evasion: eliteEvasionForLevel(level),
    attack,
    experience: stats.experience,
    gold: stats.gold,
    moveSpeed: ALTAR_BALANCE.eliteStats.moveSpeed,
    respawnTime: 0,
    respawnTimer: 0,
    alive: true,
    direction: x > platformCenterX(platform) ? -1 : 1,
    fadeTimer: 0,
    spawnInvulnTimer: MONSTER_BALANCE.spawnIntroSeconds,
    hitSlowTimer: 0,
    aggro: true,
    aggroDelayTimer: 0,
    color: ALTAR_ELITE.color,
    role: "elite",
  };
}

export function updateAltarEliteEncounter(state: SimulationState, dt: number): void {
  const encounter = state.world.altarElite;
  if (!encounter) {
    return;
  }

  const elite = state.world.monsters.find((monster) => monster.instanceId === encounter.instanceId);
  if (!elite || !elite.alive) {
    return;
  }

  encounter.timer = Math.max(0, encounter.timer - dt);
  if (encounter.timer > 0) {
    return;
  }

  removeAltarElite(state, encounter.instanceId);
}

export function resolveAltarEliteDefeat(state: SimulationState, monster: Monster): void {
  const level = state.world.altarElite?.level ?? state.progress.altar.level;
  const rewards = altarEliteStatsForLevel(level);
  grantRewards(state.progress, state.world, rewards.experience, rewards.gold);
  if (rewards.gold > 0) {
    addDropIcon(state.world, "gold", monster.position.x + monster.width / 2, monster.position.y - 4);
  }
  addAltarExperience(state.progress.altar, rewards.altarExperience);

  const relicDrop = rollEliteRelicDrop(state.progress.altar, state.progress.rebirth.count, state.world.rng);
  if (relicDrop) {
    grantRelic(state.progress.altar, relicDrop.id, relicDrop.grade, relicDrop.ownedStats);
    if (!state.progress.altar.equippedRelicId) {
      state.progress.altar.equippedRelicId = relicDrop.id;
    }
    applyPlayerStats(state.world.player, state.progress);
    addDropIcon(state.world, "ability", monster.position.x + monster.width / 2, monster.position.y - 10);
  }

  removeAltarElite(state, monster.instanceId);
}

export function altarElitePreview(level: number, rebirthCount = 0): ReturnType<typeof altarEliteStatsForLevel> & { cost: number } {
  const stats = altarEliteStatsForLevel(level);
  return {
    ...stats,
    maxHp: Math.max(1, Math.round(stats.maxHp * rebirthEnemyHpMultiplier(rebirthCount))),
    attack: Math.max(0, Math.round(stats.attack * rebirthEnemyAttackMultiplier(rebirthCount))),
    cost: eliteSummonCost({
      blood: 0,
      level,
      experience: 0,
      owned: {},
      equippedRelicId: null,
      bossDefeated: {
        pride: false,
        gluttony: false,
        grief: false,
        fanaticism: false,
        abyss: false,
        despair: false,
      },
    }),
  };
}

function removeAltarElite(state: SimulationState, instanceId: string): void {
  state.world.monsters = state.world.monsters.filter((monster) => monster.instanceId !== instanceId);
  if (state.world.player.targetId === instanceId) {
    state.world.player.targetId = null;
  }
  if (state.world.altarElite?.instanceId === instanceId) {
    state.world.altarElite = null;
  }
}

function spawnXNearPlayer(platform: Platform, playerX: number, eliteWidth: number): number {
  const platformCenter = platformCenterX(platform);
  const offset = ALTAR_BALANCE.eliteStats.spawnOffsetX;
  const inset = ALTAR_BALANCE.eliteStats.platformInsetX;
  const preferred = playerX < platformCenter ? platform.x + platform.width - eliteWidth - offset : platform.x + offset;
  return Math.max(platform.x + inset, Math.min(platform.x + platform.width - eliteWidth - inset, preferred));
}

function eliteDefenseForLevel(level: number, rebirthCount = 0): number {
  const steps = Math.max(0, level - 1);
  return Math.round(ALTAR_BALANCE.eliteStats.baseDefense * (1 + steps * ALTAR_BALANCE.eliteStats.defensePerLevel) * rebirthEnemyDefenseMultiplier(rebirthCount));
}

function eliteAccuracyForLevel(level: number): number {
  const steps = Math.max(0, level - 1);
  return Math.round(ALTAR_BALANCE.eliteStats.baseAccuracy + steps * ALTAR_BALANCE.eliteStats.accuracyPerLevel);
}

function eliteEvasionForLevel(level: number): number {
  const steps = Math.max(0, level - 1);
  return Math.round(ALTAR_BALANCE.eliteStats.baseEvasion + steps * ALTAR_BALANCE.eliteStats.evasionPerLevel);
}
