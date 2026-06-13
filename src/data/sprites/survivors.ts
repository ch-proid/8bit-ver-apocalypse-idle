import type { ClassId } from "../../core/types";
import { PLAYER_CLASS_ASSETS } from "../assets";

export interface SurvivorSkin {
  id: ClassId;
  name: string;
  path: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  previewFrame: number;
}

export const SURVIVOR_SKINS: SurvivorSkin[] = [
  createSkin("assassin", "ASSASSIN"),
  createSkin("knight", "KNIGHT"),
  createSkin("mage", "MAGE"),
];

function createSkin(id: ClassId, name: string): SurvivorSkin {
  const asset = PLAYER_CLASS_ASSETS[id];
  return {
    id,
    name,
    path: asset.path,
    sheetWidth: asset.width,
    sheetHeight: asset.height,
    frameWidth: asset.frameWidth ?? asset.width,
    frameHeight: asset.frameHeight ?? asset.height,
    previewFrame: 0,
  };
}
