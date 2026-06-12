export const PLAYER_CHARACTER = {
  path: "/assets/Character.png",
  width: 16,
  height: 16,
  padding: {
    left: 4,
    right: 4,
    top: 3,
    bottom: 3,
  },
} as const;

export interface PixelSpriteAsset {
  path: string;
  width: number;
  height: number;
  padding: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export const MONSTER_ASSETS: Record<string, PixelSpriteAsset> = {
  "monster.stage1.wildDog": {
    path: "/assets/monsters/st1_monster01.png",
    width: 12,
    height: 12,
    padding: {
      left: 3,
      right: 1,
      top: 4,
      bottom: 1,
    },
  },
  "monster.stage1.nobleWraith": {
    path: "/assets/monsters/st1_monster03.png",
    width: 12,
    height: 12,
    padding: {
      left: 1,
      right: 1,
      top: 0,
      bottom: 0,
    },
  },
  "monster.stage1.lesserImp": {
    path: "/assets/monsters/st1_monster02.png",
    width: 12,
    height: 12,
    padding: {
      left: 3,
      right: 2,
      top: 2,
      bottom: 1,
    },
  },
} as const;
