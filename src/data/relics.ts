import type { RelicGrade, RelicId, SinId } from "../core/types";

export interface RelicDefinition {
  id: RelicId;
  sin: SinId;
  name: string;
}

export const RELIC_IDS: RelicId[] = [
  "specterLord",
  "bloodBerserker",
  "plagueDoctor",
  "martyr",
  "executioner",
  "kingsShadow",
];

export const RELIC_GRADES: RelicGrade[] = ["common", "magic", "rare", "epic", "legendary"];

export const RELICS: Record<RelicId, RelicDefinition> = {
  specterLord: { id: "specterLord", sin: "pride", name: "망령 군주" },
  bloodBerserker: { id: "bloodBerserker", sin: "gluttony", name: "피의 광전사" },
  plagueDoctor: { id: "plagueDoctor", sin: "grief", name: "역병 의사" },
  martyr: { id: "martyr", sin: "fanaticism", name: "순교자" },
  executioner: { id: "executioner", sin: "abyss", name: "처형자" },
  kingsShadow: { id: "kingsShadow", sin: "despair", name: "왕의 그림자" },
};
