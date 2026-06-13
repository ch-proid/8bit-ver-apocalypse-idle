import { STAGE_BALANCE, WAVE_BALANCE } from "./balance";
import { BOSS_BY_STAGE } from "./bosses";
import { MONSTERS } from "./monsters";
import type { BossId, ItemSlot } from "../core/types";

export interface PlatformDefinition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonsterSpawnDefinition {
  monsterId: keyof typeof MONSTERS;
  platformId: string;
  count: number;
}

export interface MonsterWaveDefinition {
  spawns: MonsterSpawnDefinition[];
}

export interface StageSpawnLayerDefinition {
  id: "lower" | "middle" | "upper";
  y: number;
  xRange: [number, number];
  platformIds: string[];
}

export interface StageDefinition {
  id: number;
  label: string;
  chapter: number;
  indexInChapter: number;
  isBoss: boolean;
  bossId?: BossId;
  platforms: PlatformDefinition[];
  spawnLayers: StageSpawnLayerDefinition[];
  spawns: MonsterSpawnDefinition[];
  waves: MonsterWaveDefinition[];
  goldPerMinute: number;
  experiencePerMinute: number;
  dropBias: Record<ItemSlot, number>;
}

const BASE_PLATFORMS: PlatformDefinition[] = [
  { id: "floor", x: 0, y: 137, width: 320, height: 7 },
  { id: "low-left", x: 31, y: 99, width: 86, height: 7 },
  { id: "mid-right", x: 230, y: 98, width: 62, height: 7 },
  { id: "high-mid", x: 136, y: 71, width: 63, height: 7 },
  { id: "high-left", x: 48, y: 43, width: 62, height: 7 },
  { id: "high-right", x: 188, y: 44, width: 94, height: 7 },
];

const BASE_SPAWN_LAYERS: StageSpawnLayerDefinition[] = [
  { id: "lower", y: 137, xRange: [0, 320], platformIds: ["floor"] },
  { id: "middle", y: 99, xRange: [31, 292], platformIds: ["low-left", "mid-right"] },
  { id: "upper", y: 44, xRange: [48, 282], platformIds: ["high-left", "high-mid", "high-right"] },
];

const BASE_WAVES: MonsterWaveDefinition[] = [
  { spawns: [{ monsterId: "wildDog", platformId: "floor", count: 2 }] },
  { spawns: [{ monsterId: "nobleWraith", platformId: "low-left", count: 2 }] },
  { spawns: [{ monsterId: "lesserImp", platformId: "mid-right", count: 2 }] },
];

const DROP_BIASES: Record<ItemSlot, Record<ItemSlot, number>> = {
  weapon: { weapon: 55, helmet: 15, armor: 15, accessory: 15 },
  helmet: { weapon: 15, helmet: 55, armor: 15, accessory: 15 },
  armor: { weapon: 15, helmet: 15, armor: 55, accessory: 15 },
  accessory: { weapon: 15, helmet: 15, armor: 15, accessory: 55 },
};

export const STAGE_1: StageDefinition = createStage(1);

export const STAGES: Record<number, StageDefinition> = Array.from(
  { length: STAGE_BALANCE.totalStages },
  (_, index) => createStage(index + 1),
).reduce((acc, stage) => {
  acc[stage.id] = stage;
  return acc;
}, {} as Record<number, StageDefinition>);

function createStage(id: number): StageDefinition {
  const chapter = Math.ceil(id / STAGE_BALANCE.stagesPerChapter);
  const indexInChapter = ((id - 1) % STAGE_BALANCE.stagesPerChapter) + 1;
  const boss = BOSS_BY_STAGE[id];
  const biasSlot = biasSlotForStage(indexInChapter);
  const waves = boss ? [] : scaleWaves(chapter);

  return {
    id,
    label: `${chapter}-${indexInChapter}`,
    chapter,
    indexInChapter,
    isBoss: Boolean(boss),
    bossId: boss?.id,
    goldPerMinute: 180 + id * 30,
    experiencePerMinute: 150 + id * 25,
    platforms: BASE_PLATFORMS.map((platform) => ({ ...platform })),
    spawnLayers: BASE_SPAWN_LAYERS.map((layer) => ({
      ...layer,
      xRange: [...layer.xRange],
      platformIds: [...layer.platformIds],
    })),
    spawns: waves.flatMap((wave) => wave.spawns.map((spawn) => ({ ...spawn }))),
    waves,
    dropBias: DROP_BIASES[biasSlot],
  };
}

function biasSlotForStage(indexInChapter: number): ItemSlot {
  if (indexInChapter <= 3) {
    return "weapon";
  }
  if (indexInChapter <= 5) {
    return "armor";
  }
  if (indexInChapter <= 7) {
    return "helmet";
  }
  return "accessory";
}

function scaleWaves(chapter: number): MonsterWaveDefinition[] {
  return BASE_WAVES.slice(0, WAVE_BALANCE.wavesPerStage).map((wave, waveIndex) => ({
    spawns: wave.spawns.flatMap((spawn) => distributeWaveSpawn(spawn, waveMonsterCount(spawn.count, chapter, waveIndex), waveIndex)),
  }));
}

function distributeWaveSpawn(
  spawn: MonsterSpawnDefinition,
  count: number,
  waveIndex: number,
): MonsterSpawnDefinition[] {
  return Array.from({ length: count }, (_, index) => {
    const layer = BASE_SPAWN_LAYERS[(waveIndex + index) % BASE_SPAWN_LAYERS.length];
    const platformId = layer.platformIds[(waveIndex + index) % layer.platformIds.length];
    return {
      monsterId: spawn.monsterId,
      platformId,
      count: 1,
    };
  });
}

function waveMonsterCount(baseCount: number, chapter: number, waveIndex: number): number {
  const chapterBonus = Math.floor((chapter - 1 + waveIndex) / 3);
  return Math.max(
    WAVE_BALANCE.minMonstersPerWave,
    Math.min(WAVE_BALANCE.maxMonstersPerWave, baseCount + chapterBonus),
  );
}
