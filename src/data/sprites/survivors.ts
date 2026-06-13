import type { ClassId } from "../../core/types";

// TODO(Rework 2): Replace these placeholders with the class spritesheets:
// assassin idle/walk, knight idle/walk, mage idle/walk, and mage projectile frames.
export interface SurvivorSkin {
  id: ClassId;
  name: string;
  idle: string[];
}

export const SURVIVOR_SKINS: SurvivorSkin[] = [
  {
    id: "assassin",
    name: "ASSASSIN",
    idle: [
      "...2222...",
      "..222222..",
      "..233332..",
      "..213312..",
      "...3333...",
      "..222224..",
      "..222244..",
      "..222224..",
      "...2..2..",
      "...2..2..",
    ],
  },
  {
    id: "knight",
    name: "KNIGHT",
    idle: [
      "...3333...",
      "..333333..",
      "..233332..",
      "..213312..",
      "..222222..",
      "..222224..",
      "..222244..",
      "..222224..",
      "...2..2..",
      "...2..2..",
    ],
  },
  {
    id: "mage",
    name: "MAGE",
    idle: [
      "...4444...",
      "..444444..",
      "..433334..",
      "..413314..",
      "...3333...",
      "..222222.4",
      "..22222244",
      "..222222.4",
      "...2..2..",
      "...2..2..",
    ],
  },
];

export const MAGE_PROJECTILE_FRAMES = [
  [
    "..4..",
    ".444.",
    "44444",
    ".444.",
    "..4..",
  ],
];
