import { MONSTER_BALANCE, MONSTER_COMBAT } from "./balance";

export interface MonsterDefinition {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  accuracy: number;
  evasion: number;
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
    accuracy: chapterAccuracy(1, "wildDog"),
    evasion: chapterEvasion(1, "wildDog"),
    experience: 8,
    gold: 5,
    moveSpeed: 18,
    respawnTime: normalRespawnSeconds(2.2),
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
    accuracy: chapterAccuracy(1, "nobleWraith"),
    evasion: chapterEvasion(1, "nobleWraith"),
    experience: 13,
    gold: 8,
    moveSpeed: 10,
    respawnTime: normalRespawnSeconds(3.1),
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
    accuracy: chapterAccuracy(1, "lesserImp"),
    evasion: chapterEvasion(1, "lesserImp"),
    experience: 18,
    gold: 12,
    moveSpeed: 16,
    respawnTime: normalRespawnSeconds(3.8),
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
    accuracy: chapterAccuracy(1, "lucianWraith"),
    evasion: chapterEvasion(1, "lucianWraith"),
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
    accuracy: chapterAccuracy(3, "marcelaSeed"),
    evasion: chapterEvasion(3, "marcelaSeed"),
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

function chapterAccuracy(chapter: number, key: keyof typeof MONSTER_COMBAT.stageOneOffsets): number {
  const base = MONSTER_COMBAT.accuracyByChapter[Math.max(0, Math.min(MONSTER_COMBAT.accuracyByChapter.length - 1, chapter - 1))];
  return base + MONSTER_COMBAT.stageOneOffsets[key].accuracy;
}

function normalRespawnSeconds(baseSeconds: number): number {
  return Math.round(baseSeconds * MONSTER_BALANCE.normalRespawnTimeMultiplier * 100) / 100;
}

function chapterEvasion(chapter: number, key: keyof typeof MONSTER_COMBAT.stageOneOffsets): number {
  const base = MONSTER_COMBAT.evasionByChapter[Math.max(0, Math.min(MONSTER_COMBAT.evasionByChapter.length - 1, chapter - 1))];
  return base + MONSTER_COMBAT.stageOneOffsets[key].evasion;
}
