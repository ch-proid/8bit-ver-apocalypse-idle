import type { ClassId, StatAllocation, StatPreset } from "../core/types";
import { CLASS_BALANCE } from "./balance";

export interface PlayerClassDefinition {
  id: ClassId;
  label: string;
  growth: {
    attackPerLevel: number;
    defensePerLevel: number;
    hpPerLevel: number;
    evasionPerLevel: number;
    moveSpeedMultiplier: number;
    attackCooldownMultiplier: number;
    attackRange: number;
  };
  passive: {
    key: "assassinCrit" | "knightExecution" | "mageDot";
    description: string;
  };
  recommendedPreset: StatPreset;
  recommendedAllocation: StatAllocation;
}

export const CLASS_IDS: ClassId[] = ["assassin", "knight", "mage"];

export const PLAYER_CLASSES: Record<ClassId, PlayerClassDefinition> = {
  assassin: {
    id: "assassin",
    label: "ASSASSIN",
    growth: CLASS_BALANCE.assassin.growth,
    passive: {
      key: "assassinCrit",
      description: "CRIT CAP 100 / BASE CRIT 15 / CRIT DMG +15",
    },
    recommendedPreset: "AGI",
    recommendedAllocation: { str: 3, grit: 0, agi: 2 },
  },
  knight: {
    id: "knight",
    label: "KNIGHT",
    growth: CLASS_BALANCE.knight.growth,
    passive: {
      key: "knightExecution",
      description: "LOW HP EXEC / DEF TO ATK",
    },
    recommendedPreset: "GRIT",
    recommendedAllocation: { str: 3, grit: 2, agi: 0 },
  },
  mage: {
    id: "mage",
    label: "MAGE",
    growth: CLASS_BALANCE.mage.growth,
    passive: {
      key: "mageDot",
      description: "HP DOT STACK",
    },
    recommendedPreset: "GRIT",
    recommendedAllocation: { str: 3, grit: 2, agi: 0 },
  },
};
