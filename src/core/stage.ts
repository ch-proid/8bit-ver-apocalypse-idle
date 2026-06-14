import { MONSTER_BALANCE, MONSTER_COMBAT, PLAYER_BALANCE, PROGRESSION, RNG_BALANCE, WAVE_BALANCE } from "../data/balance";
import { BOSS_BY_STAGE } from "../data/bosses";
import { MONSTERS, type MonsterDefinition } from "../data/monsters";
import { STAGE_1, STAGES, type StageDefinition } from "../data/stages";
import { createBossCombatState, createBossMonster } from "./boss";
import { createDefaultClassCombatState } from "./class";
import { createDefaultProgress } from "./progression";
import {
  rebirthEnemyAttackMultiplier,
  rebirthEnemyExperienceMultiplier,
  rebirthEnemyHpMultiplier,
  rebirthEnemyRewardMultiplier,
} from "./rebirthScaling";
import { createDefaultRelicCombatState } from "./relics";
import { createRngState, nextRandom } from "./rng";
import { applyPlayerStats } from "./stats";
import type { Monster, Platform, ProgressState, RngState, SimulationState, WaveCycleState } from "./types";

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
  const rng = createRngState(seed);
  const rewardRng = createRngState(seed ^ 0x9e3779b9);
  let nextEntityId = 1;
  const monsters = stage.isBoss
    ? createStageBossMonsters(stage, platforms, progress.rebirth.count)
    : createStageWaveMonsters(stage, platforms, wave, () => nextEntityId++, rng, progress.rebirth.count);
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
      rng,
      rewardRng,
      relicCombat: createDefaultRelicCombatState(),
      classCombat: createDefaultClassCombatState(),
      altarElite: null,
      boss: stage.bossId ? createBossCombatState(stage.bossId, stage.id) : null,
      wave,
      platforms,
      player,
      monsters,
      floatingTexts: [],
      dropIcons: [],
      nextEntityId,
    },
  };
}

function createStageBossMonsters(stage: StageDefinition, platforms: Platform[], rebirthCount: number): Monster[] {
  const boss = BOSS_BY_STAGE[stage.id];
  if (boss) {
    const floor = getPlatformById(platforms, "floor") ?? platforms[0];
    return [createBossMonster(boss.id, floor, rebirthCount)];
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
  rng: RngState,
  rebirthCount = 0,
): Monster[] {
  if (!wave?.enabled || stage.isBoss) {
    return [];
  }

  const waveDefinition = stage.waves[wave.currentWaveIndex] ?? stage.waves[0];
  if (!waveDefinition) {
    return [];
  }

  const monsters: Monster[] = [];
  let spawnIndex = 0;

  for (const spawn of waveDefinition.spawns) {
    const definition = MONSTERS[spawn.monsterId];
    const platform = getPlatformById(platforms, spawn.platformId);
    if (!definition || !platform) {
      continue;
    }

    for (let i = 0; i < spawn.count; i += 1) {
      const x = spawnXOnPlatform(platform, definition, rng);
      const y = platform.y - definition.height;
      const stats = normalMonsterStatsForStage(stage.id, definition, rebirthCount);
      monsters.push({
        instanceId: `w${wave.cycle}-${wave.currentWaveIndex}-${nextId()}`,
        monsterId: definition.id,
        name: definition.name,
        assetKey: definition.assetKey,
        position: { x, y },
        spawnPosition: { x, y },
        velocity: { x: normalMonsterMoveSpeed(definition), y: 0 },
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
        moveSpeed: normalMonsterMoveSpeed(definition),
        respawnTime: definition.respawnTime,
        respawnTimer: 0,
        alive: true,
        direction: spawnIndex % 2 === 0 ? 1 : -1,
        fadeTimer: 0,
        spawnInvulnTimer: MONSTER_BALANCE.spawnIntroSeconds,
        hitSlowTimer: 0,
        aggro: false,
        aggroDelayTimer: MONSTER_BALANCE.autoAggroSeconds,
        color: definition.color,
        role: "normal",
      });
      spawnIndex += 1;
    }
  }

  return monsters;
}

function normalMonsterMoveSpeed(definition: MonsterDefinition): number {
  return Math.round(definition.moveSpeed * MONSTER_BALANCE.moveSpeedMultiplier * 100) / 100;
}

function spawnXOnPlatform(platform: Platform, definition: MonsterDefinition, rng: RngState): number {
  const minX = platform.x + MONSTER_BALANCE.spawnInsetX;
  const maxX = platform.x + platform.width - definition.width - MONSTER_BALANCE.spawnInsetX;
  if (maxX <= minX) {
    return platform.x + platform.width / 2 - definition.width / 2;
  }

  return Math.round((minX + nextRandom(rng) * (maxX - minX)) * 100) / 100;
}

export function normalMonsterStatsForStage(stageId: number, definition: MonsterDefinition, rebirthCount = 0): Pick<Monster, "maxHp" | "attack" | "experience" | "gold"> {
  const chapter = Math.max(1, STAGES[stageId]?.chapter ?? 1);
  const chapterSteps = chapter - 1;
  const stageSteps = Math.max(0, stageId - 1);
  const hpScale = 1 + chapterSteps * WAVE_BALANCE.chapterHpMultiplier;
  const attackScale = 1 + chapterSteps * WAVE_BALANCE.chapterAttackMultiplier;
  const goldScale = (1 + chapterSteps * WAVE_BALANCE.chapterRewardMultiplier + stageSteps * WAVE_BALANCE.stageGoldMultiplier)
    * rebirthEnemyRewardMultiplier(rebirthCount);
  const experienceScale = (1 + stageSteps * WAVE_BALANCE.stageExperienceMultiplier)
    * rebirthEnemyExperienceMultiplier(rebirthCount);

  return {
    maxHp: Math.max(1, Math.round(definition.maxHp * hpScale * rebirthEnemyHpMultiplier(rebirthCount))),
    attack: Math.max(0, Math.round(definition.attack * attackScale * rebirthEnemyAttackMultiplier(rebirthCount))),
    experience: Math.max(0, Math.round(definition.experience * experienceScale)),
    gold: Math.max(0, Math.round(definition.gold * goldScale)),
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
