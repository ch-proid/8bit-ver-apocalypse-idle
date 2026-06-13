import { BOSS_BALANCE } from "./balance";
import type { BossId, SinId } from "../core/types";

export interface BossDefinition {
  id: BossId;
  stageId: number;
  chapter: number;
  sin: SinId;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  experience: number;
  gold: number;
  color: string;
  mechanic: "lucianWraiths" | "gravemawRegen" | "marcelaSeeds" | "cardionEnrage" | "azarMarks" | "leonidAltarCounter";
}

export const BOSS_DEFINITIONS: Record<BossId, BossDefinition> = {
  lucian: {
    id: "lucian",
    stageId: 10,
    chapter: 1,
    sin: "pride",
    name: "LUCIAN",
    maxHp: BOSS_BALANCE.lucian.hp,
    attack: BOSS_BALANCE.lucian.attack,
    defense: BOSS_BALANCE.lucian.defense,
    experience: BOSS_BALANCE.lucian.experience,
    gold: BOSS_BALANCE.lucian.gold,
    color: "#8f3f5d",
    mechanic: "lucianWraiths",
  },
  gravemaw: createBoss("gravemaw", 20, 2, "gluttony", "GRAVEMAW", "#72513f", "gravemawRegen"),
  marcela: createBoss("marcela", 30, 3, "grief", "MARCELA", "#5d7f58", "marcelaSeeds"),
  cardion: createBoss("cardion", 40, 4, "fanaticism", "CARDION", "#8d3439", "cardionEnrage"),
  azar: createBoss("azar", 50, 5, "abyss", "AZAR", "#4c466a", "azarMarks"),
  leonid: createBoss("leonid", 60, 6, "despair", "LEONID", "#d8e3c8", "leonidAltarCounter"),
};

export const BOSS_BY_STAGE: Record<number, BossDefinition> = Object.values(BOSS_DEFINITIONS).reduce(
  (acc, boss) => {
    acc[boss.stageId] = boss;
    return acc;
  },
  {} as Record<number, BossDefinition>,
);

function createBoss(
  id: BossId,
  stageId: number,
  chapter: number,
  sin: SinId,
  name: string,
  color: string,
  mechanic: BossDefinition["mechanic"],
): BossDefinition {
  return {
    id,
    stageId,
    chapter,
    sin,
    name,
    maxHp: Math.floor(BOSS_BALANCE.lucian.hp * Math.pow(BOSS_BALANCE.bossStub.hpMultiplierPerChapter, chapter - 1)),
    attack: BOSS_BALANCE.lucian.attack + chapter * 3,
    defense: BOSS_BALANCE.lucian.defense + chapter * 4,
    experience: BOSS_BALANCE.lucian.experience * chapter,
    gold: BOSS_BALANCE.lucian.gold * chapter,
    color,
    mechanic,
  };
}
