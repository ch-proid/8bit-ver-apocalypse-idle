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
    name: "RED WOLF",
    maxHp: 34,
    attack: 4,
    experience: 8,
    gold: 5,
    moveSpeed: 18,
    respawnTime: 2.2,
    width: 15,
    height: 14,
    assetKey: "monster.stage1.wildDog",
    color: "#8a2630",
  },
  nobleWraith: {
    id: "nobleWraith",
    name: "FALLEN NOBLE",
    maxHp: 52,
    attack: 6,
    experience: 13,
    gold: 8,
    moveSpeed: 10,
    respawnTime: 3.1,
    width: 9,
    height: 18,
    assetKey: "monster.stage1.nobleWraith",
    color: "#7d334a",
  },
  lesserImp: {
    id: "lesserImp",
    name: "LESSER IMP",
    maxHp: 76,
    attack: 8,
    experience: 18,
    gold: 12,
    moveSpeed: 16,
    respawnTime: 3.8,
    width: 11,
    height: 10,
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
    width: 9,
    height: 18,
    assetKey: "monster.stage1.nobleWraith",
    color: "#7d334a",
  },
  marcelaSeed: {
    id: "marcelaSeed",
    name: "MARCELA SEED",
    maxHp: 90,
    attack: 0,
    experience: 0,
    gold: 0,
    moveSpeed: 0,
    respawnTime: 0,
    width: 8,
    height: 8,
    assetKey: "monster.boss.marcelaSeed",
    color: "#6fa85a",
  },
};
