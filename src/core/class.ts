import { CLASS_BALANCE } from "../data/balance";
import { PLAYER_CLASSES } from "../data/classes";
import type { ClassId } from "./types";

export function defaultClassId(): ClassId {
  return CLASS_BALANCE.defaultClassId as ClassId;
}

export function normalizeClassId(value: unknown): ClassId {
  return typeof value === "string" && value in PLAYER_CLASSES
    ? value as ClassId
    : defaultClassId();
}

export function getPlayerClass(classId: ClassId) {
  return PLAYER_CLASSES[classId] ?? PLAYER_CLASSES[defaultClassId()];
}
