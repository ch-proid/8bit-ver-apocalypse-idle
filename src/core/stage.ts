import { MONSTER_BALANCE, MONSTER_COMBAT, PLAYER_BALANCE, PROGRESSION, RNG_BALANCE, WAVE_BALANCE } from "../data/balance";
import { BOSS_BY_STAGE } from "../data/bosses";
import { MONSTERS, type MonsterDefinition } from "../data/monsters";
import { STAGE_1, STAGES, type StageDefinition } from "../data/stages";
import { createBossCombatState, createBossMonster } from "./boss";
import { createDefaultClassCombatState } from "./class";
import { createDefaultProgress } from "./progression";
import { createDefaultRelicCombatState } from "./relics";
import { createRngState } from "./rng";
import { applyPlayerStats } from "./stats";
import type { Monster, Platform, ProgressState, SimulationState, WaveCycleState } from "./types";

export function createInitialSimulation(
  stageId: number = PROGRESSION.initialStageId,
  progressOverride?: ProgressState,
  seed: number = RNG_BALANCE.defaultSeed,
): SimulationState {
  const stage = STAGES[stageId] ?? STAGE_1;
  const platforms = stage.platforms.map((platform) => ({ ...platform }));
  const floor = getPlatformById(platforms, "floor") ?? platforms[0];
  const progress = progressOverride ?? createDefaultProgress(stage.id);
  progress.currentStage = stage.id;
  const wave = createInitialWaveState(stage);
  let nextEntityId = 1;
  const monsters = stage.isBoss
    ? createStageBossMonsters(stage, platforms)
    : createStageWaveMonsters(stage, platforms, wave, () => nextEntityId++);
  const player = {
    position: {
      x: 28,
      y: floor.y - PLAYER_BALANCE.height,
    },
    velocity: { x: 0, y: 0 },
    width: PLAYER_BALANCE.width,
    height: PLAYER_BALANCE.height,
    moveSpeed: PLAYER_BALANCE.moveSpeed,
    direction: 1 as const,
    platformId: floor.id,
    hp: PLAYER_BALANCE.maxHp,
    maxHp: PLAYER_BALANCE.maxHp,
    attack: PLAYER_BALANCE.attack,
    defense: PLAYER_BALANCE.defense,
    evasion: PLAYER_BALANCE.evasion,
    hpRegen: PLAYER_BALANCE.hpRegen,
    attackRange: PLAYER_BALANCE.attackRange,
    attackCooldown: PLAYER_BALANCE.attackCooldown,
    attackTimer: 0,
    state: "IDLE" as const,
    targetId: null,
    jumpLock: 0,
  };
  applyPlayerStats(player, progress);

  return {
    progress,
    world: {
      elapsed: 0,
      rng: createRngState(seed),
      relicCombat: createDefaultRelicCombatState(),
      classCombat: createDefaultClassCombatState(),
      boss: stage.bossId ? createBossCombatState(stage.bossId, stage.id) : null,
      wave,
      platforms,
      player,
      monsters,
      floatingTexts: [],
      nextEntityId,
    },
  };
}

function createStageBossMonsters(stage: StageDefinition, platforms: Platform[]): Monster[] {
  const boss = BOSS_BY_STAGE[stage.id];
  if (boss) {
    const floor = getPlatformById(platforms, "floor") ?? platforms[0];
    return [createBossMonster(boss.id, floor)];
  }

  return [];
}

export function createInitialWaveState(stage: StageDefinition): WaveCycleState | null {
  if (stage.isBoss || stage.waves.length <= 0) {
    return null;
  }

  return {
    enabled: true,
    currentWaveIndex: 0,
    cycle: 0,
    completedWaves: 0,
    totalKills: 0,
    totalWaves: stage.waves.length,
  };
}

export function createStageWaveMonsters(
  stage: StageDefinition,
  platforms: Platform[],
  wave: WaveCycleState | null,
  nextId: () => number,
): Monster[] {
  if (!wave?.enabled || stage.isBoss) {
    return [];
  }

  const waveDefinition = stage.waves[wave.currentWaveIndex] ?? stage.waves[0];
  if (!waveDefinition) {
    return [];
  }

  const monsters: Monster[] = [];
  let index = 0;

  for (const spawn of waveDefinition.spawns) {
    const definition = MONSTERS[spawn.monsterId];
    const platform = getPlatformById(platforms, spawn.platformId);
    if (!definition || !platform) {
      continue;
    }

    for (let i = 0; i < spawn.count; i += 1) {
      const gap = platform.width / (spawn.count + 1);
      const x = platform.x + gap * (i + 1) - definition.width / 2;
      const y = platform.y - definition.height;
      const stats = normalMonsterStatsForStage(stage.id, definition);
      monsters.push({
        instanceId: `w${wave.cycle}-${wave.currentWaveIndex}-${nextId()}`,
        monsterId: definition.id,
        name: definition.name,
        assetKey: definition.assetKey,
        position: { x, y },
        spawnPosition: { x, y },
        velocity: { x: definition.moveSpeed, y: 0 },
        platformId: platform.id,
        width: definition.width,
        height: definition.height,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        defense: 0,
        damageReduction: 0,
        accuracy: monsterAccuracyForStage(stage.id, spawn.monsterId),
        evasion: monsterEvasionForStage(stage.id, spawn.monsterId),
        attack: stats.attack,
        experience: stats.experience,
        gold: stats.gold,
        moveSpeed: definition.moveSpeed,
        respawnTime: definition.respawnTime,
        respawnTimer: 0,
        alive: true,
        direction: index % 2 === 0 ? 1 : -1,
        fadeTimer: 0,
        spawnInvulnTimer: MONSTER_BALANCE.spawnIntroSeconds,
        color: definition.color,
        role: "normal",
      });
      index += 1;
    }
  }

  return monsters;
}

export function normalMonsterStatsForStage(stageId: number, definition: MonsterDefinition): Pick<Monster, "maxHp" | "attack" | "experience" | "gold"> {
  const chapter = Math.max(1, STAGES[stageId]?.chapter ?? 1);
  const chapterSteps = chapter - 1;
  const hpScale = 1 + chapterSteps * WAVE_BALANCE.chapterHpMultiplier;
  const attackScale = 1 + chapterSteps * WAVE_BALANCE.chapterAttackMultiplier;
  const rewardScale = 1 + chapterSteps * WAVE_BALANCE.chapterRewardMultiplier;

  return {
    maxHp: Math.max(1, Math.round(definition.maxHp * hpScale)),
    attack: Math.max(0, Math.round(definition.attack * attackScale)),
    experience: Math.max(0, Math.round(definition.experience * rewardScale)),
    gold: Math.max(0, Math.round(definition.gold * rewardScale)),
  };
}

function monsterAccuracyForStage(stageId: number, monsterId: keyof typeof MONSTERS): number {
  const chapterIndex = chapterIndexForStage(stageId);
  const offset = monsterOffset(monsterId).accuracy;
  return MONSTER_COMBAT.accuracyByChapter[chapterIndex] + offset;
}

function monsterEvasionForStage(stageId: number, monsterId: keyof typeof MONSTERS): number {
  const chapterIndex = chapterIndexForStage(stageId);
  const offset = monsterOffset(monsterId).evasion;
  return MONSTER_COMBAT.evasionByChapter[chapterIndex] + offset;
}

function chapterIndexForStage(stageId: number): number {
  return Math.max(0, Math.min(MONSTER_COMBAT.evasionByChapter.length - 1, Math.ceil(stageId / 10) - 1));
}

function monsterOffset(monsterId: keyof typeof MONSTERS): { accuracy: number; evasion: number } {
  return MONSTER_COMBAT.stageOneOffsets[monsterId as keyof typeof MONSTER_COMBAT.stageOneOffsets] ?? { accuracy: 0, evasion: 0 };
}

export function getPlatformById(platforms: Platform[], id: string): Platform | undefined {
  return platforms.find((platform) => platform.id === id);
}

export function platformCenterX(platform: Platform): number {
  return platform.x + platform.width / 2;
}
