import { openDB, type DBSchema } from "idb";
import { STAGES } from "../data/stages";
import type { ProgressState } from "../core/types";
import { PROGRESSION } from "../data/balance";

const DB_NAME = "apocalypse-idle-save";
const STORE_NAME = "save";
const SAVE_KEY = "slot-1";

export interface SaveSnapshot {
  version: 1;
  progress: ProgressState;
  lastSavedAt: number;
}

interface SaveDb extends DBSchema {
  save: {
    key: string;
    value: SaveSnapshot;
  };
}

async function getDb() {
  return openDB<SaveDb>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveGame(progress: ProgressState): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, {
    version: 1,
    progress,
    lastSavedAt: Date.now(),
  }, SAVE_KEY);
}

export async function loadGame(): Promise<SaveSnapshot | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, SAVE_KEY);
}

export function calculateOfflineReward(snapshot: SaveSnapshot, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.min((now - snapshot.lastSavedAt) / 1000, PROGRESSION.offlineCapSeconds));
  const stage = STAGES[snapshot.progress.currentStage];
  const minutes = elapsedSeconds / 60;

  return {
    elapsedSeconds,
    gold: Math.floor((stage?.goldPerMinute ?? 0) * minutes),
    experience: Math.floor((stage?.experiencePerMinute ?? 0) * minutes),
  };
}
