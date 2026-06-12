import { nextExperienceForLevel, PLAYER_BALANCE } from "../data/balance";
import { MONSTERS } from "../data/monsters";
import { STAGE_1, STAGES, type StageDefinition } from "../data/stages";
import type { Monster, Platform, SimulationState } from "./types";

export function createInitialSimulation(stageId = 1): SimulationState {
  const stage = STAGES[stageId] ?? STAGE_1;
  const platforms = stage.platforms.map((platform) => ({ ...platform }));
  const floor = getPlatformById(platforms, "floor") ?? platforms[0];

  return {
    progress: {
      gold: 0,
      experience: 0,
      level: 1,
      currentStage: stage.id,
      nextExperience: nextExperienceForLevel(1),
    },
    world: {
      elapsed: 0,
      platforms,
      player: {
        position: {
          x: 28,
          y: floor.y - PLAYER_BALANCE.height,
        },
        velocity: { x: 0, y: 0 },
        width: PLAYER_BALANCE.width,
        height: PLAYER_BALANCE.height,
        moveSpeed: PLAYER_BALANCE.moveSpeed,
        direction: 1,
        platformId: floor.id,
        hp: PLAYER_BALANCE.maxHp,
        maxHp: PLAYER_BALANCE.maxHp,
        attack: PLAYER_BALANCE.attack,
        attackRange: PLAYER_BALANCE.attackRange,
        attackCooldown: PLAYER_BALANCE.attackCooldown,
        attackTimer: 0,
        state: "IDLE",
        targetId: null,
        jumpLock: 0,
      },
      monsters: createStageMonsters(stage, platforms),
      floatingTexts: [],
      nextEntityId: 1,
    },
  };
}

function createStageMonsters(stage: StageDefinition, platforms: Platform[]): Monster[] {
  const monsters: Monster[] = [];
  let index = 0;

  for (const spawn of stage.spawns) {
    const definition = MONSTERS[spawn.monsterId];
    const platform = getPlatformById(platforms, spawn.platformId);
    if (!definition || !platform) {
      continue;
    }

    for (let i = 0; i < spawn.count; i += 1) {
      const gap = platform.width / (spawn.count + 1);
      const x = platform.x + gap * (i + 1) - definition.width / 2;
      const y = platform.y - definition.height;
      monsters.push({
        instanceId: `m${index}`,
        monsterId: definition.id,
        name: definition.name,
        assetKey: definition.assetKey,
        position: { x, y },
        spawnPosition: { x, y },
        velocity: { x: definition.moveSpeed, y: 0 },
        platformId: platform.id,
        width: definition.width,
        height: definition.height,
        hp: definition.maxHp,
        maxHp: definition.maxHp,
        attack: definition.attack,
        experience: definition.experience,
        gold: definition.gold,
        moveSpeed: definition.moveSpeed,
        respawnTime: definition.respawnTime,
        respawnTimer: 0,
        alive: true,
        direction: index % 2 === 0 ? 1 : -1,
        fadeTimer: 0,
        color: definition.color,
      });
      index += 1;
    }
  }

  return monsters;
}

export function getPlatformById(platforms: Platform[], id: string): Platform | undefined {
  return platforms.find((platform) => platform.id === id);
}

export function platformCenterX(platform: Platform): number {
  return platform.x + platform.width / 2;
}
