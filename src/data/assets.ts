export const PLAYER_CHARACTER = {
  path: "/assets/knight.png",
  width: 32,
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
} as const;

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
