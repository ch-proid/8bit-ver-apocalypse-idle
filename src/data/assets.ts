import type { ClassId } from "../core/types";

export interface PixelSpriteAsset {
  path: string;
  width: number;
  height: number;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  padding: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export interface PlayerSpriteAsset extends PixelSpriteAsset {
  projectileFrameIndex?: number;
}

export interface StageMapAsset {
  backgroundPath: string;
  terrainPath?: string;
  width: number;
  height: number;
}

export const PLAYER_CLASS_ASSETS: Record<ClassId, PlayerSpriteAsset> = {
  assassin: {
    path: "/assets/classes/thief.png",
    width: 64,
    height: 32,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 2,
    padding: {
      left: 10,
      right: 10,
      top: 6,
      bottom: 7,
    },
  },
  knight: {
    path: "/assets/classes/knight.png",
    width: 64,
    height: 32,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 2,
    padding: {
      left: 9,
      right: 8,
      top: 5,
      bottom: 7,
    },
  },
  mage: {
    path: "/assets/classes/magician.png",
    width: 96,
    height: 32,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 2,
    projectileFrameIndex: 2,
    padding: {
      left: 9,
      right: 8,
      top: 6,
      bottom: 7,
    },
  },
} as const;

export const STAGE_MAP_ASSETS: Record<string, StageMapAsset> = {
  stage1: {
    backgroundPath: "/assets/map/Stage01/Stage01_map_bg.png",
    terrainPath: "/assets/map/Stage01/Stage01_map.png",
    width: 320,
    height: 144,
  },
  stage2: {
    backgroundPath: "/assets/map/Stage02/Stage02_map_bg.png",
    terrainPath: "/assets/map/Stage02/Stage02_map.png",
    width: 320,
    height: 144,
  },
  stage3: {
    backgroundPath: "/assets/map/Stage03/Stage03_map_bg.png",
    terrainPath: "/assets/map/Stage03/Stage03_map.png",
    width: 320,
    height: 144,
  },
  stage4: {
    backgroundPath: "/assets/map/Stage04/Stage04_map_bg.png",
    terrainPath: "/assets/map/Stage04/Stage04_map.png",
    width: 320,
    height: 144,
  },
  stage5: {
    backgroundPath: "/assets/map/Stage05/Stage05_map_bg.png",
    terrainPath: "/assets/map/Stage05/Stage05_map.png",
    width: 320,
    height: 144,
  },
} as const;

export function stageMapAssetForStage(stageId: number): StageMapAsset | null {
  const chapter = Math.max(1, Math.ceil(stageId / 10));
  return STAGE_MAP_ASSETS[`stage${chapter}`] ?? null;
}

export const MONSTER_ASSETS: Record<string, PixelSpriteAsset> = {
  "monster.stage1.wildDog": {
    path: "/assets/monsters/st1_helldog.png",
    width: 64,
    height: 32,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 2,
    padding: {
      left: 6,
      right: 11,
      top: 9,
      bottom: 9,
    },
  },
  "monster.stage1.nobleWraith": {
    path: "/assets/monsters/st1_fallen_human01.png",
    width: 64,
    height: 32,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 2,
    padding: {
      left: 12,
      right: 11,
      top: 7,
      bottom: 7,
    },
  },
  "monster.stage1.lesserImp": {
    path: "/assets/monsters/st1_imp01.png",
    width: 64,
    height: 32,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 2,
    padding: {
      left: 11,
      right: 10,
      top: 12,
      bottom: 10,
    },
  },
} as const;
