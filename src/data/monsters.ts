export interface MonsterDefinition {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  experience: number;
  gold: number;
  moveSpeed: number;
  respawnTime: number;
  width: number;
  height: number;
  assetKey: string;
  color: string;
}

export const MONSTERS: Record<string, MonsterDefinition> = {
  wildDog: {
    id: "wildDog",
    name: "들개",
    maxHp: 34,
    attack: 4,
    experience: 8,
    gold: 5,
    moveSpeed: 18,
    respawnTime: 2.2,
    width: 8,
    height: 7,
    assetKey: "monster.stage1.wildDog",
    color: "#8a2630",
  },
  nobleWraith: {
    id: "nobleWraith",
    name: "귀족의 망령",
    maxHp: 52,
    attack: 6,
    experience: 13,
    gold: 8,
    moveSpeed: 10,
    respawnTime: 3.1,
    width: 10,
    height: 12,
    assetKey: "monster.stage1.nobleWraith",
    color: "#7d334a",
  },
  lesserImp: {
    id: "lesserImp",
    name: "하급 임프",
    maxHp: 76,
    attack: 8,
    experience: 18,
    gold: 12,
    moveSpeed: 16,
    respawnTime: 3.8,
    width: 7,
    height: 9,
    assetKey: "monster.stage1.lesserImp",
    color: "#9e1f37",
  },
  lucianWraith: {
    id: "lucianWraith",
    name: "LUCIAN WRAITH",
    maxHp: 130,
    attack: 4,
    experience: 0,
    gold: 0,
    moveSpeed: 0,
    respawnTime: 0,
    width: 10,
    height: 12,
    assetKey: "monster.stage1.nobleWraith",
    color: "#7d334a",
  },
};
