import { MONSTERS } from "./monsters";

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

export interface StageDefinition {
  id: number;
  label: string;
  platforms: PlatformDefinition[];
  spawns: MonsterSpawnDefinition[];
  goldPerMinute: number;
  experiencePerMinute: number;
}

export const STAGE_1: StageDefinition = {
  id: 1,
  label: "1-1",
  goldPerMinute: 210,
  experiencePerMinute: 180,
  platforms: [
    { id: "floor", x: 0, y: 130, width: 480, height: 10 },
    { id: "low-left", x: 42, y: 101, width: 112, height: 6 },
    { id: "mid-right", x: 256, y: 83, width: 122, height: 6 },
    { id: "high-mid", x: 158, y: 58, width: 86, height: 6 },
  ],
  spawns: [
    { monsterId: "wildDog", platformId: "floor", count: 3 },
    { monsterId: "nobleWraith", platformId: "low-left", count: 2 },
    { monsterId: "lesserImp", platformId: "mid-right", count: 2 },
  ],
};

export const STAGES: Record<number, StageDefinition> = {
  1: STAGE_1,
};
