import { openDB, type DBSchema } from "idb";
import type { ProgressState } from "../core/types";
import { PROGRESSION } from "../data/balance";
import { estimateOfflineHuntRates } from "../core/offline";
import { normalizeProgress } from "../core/progression";

const DB_NAME = "apocalypse-idle-save";
const STORE_NAME = "save";
const SAVE_KEY = "slot-1";

export interface SaveSnapshot {
  version: 7;
  progress: ProgressState;
  lastSavedAt: number;
}

type StoredSaveSnapshot = Partial<Omit<SaveSnapshot, "progress" | "version">> & {
  version?: number;
  progress?: Partial<ProgressState>;
};

interface SaveDb extends DBSchema {
  save: {
    key: string;
    value: StoredSaveSnapshot;
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
    version: 7,
    progress,
    lastSavedAt: Date.now(),
  }, SAVE_KEY);
}

export async function deleteSaveGame(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, SAVE_KEY);
}

export async function loadGame(): Promise<SaveSnapshot | undefined> {
  const db = await getDb();
  const snapshot = await db.get(STORE_NAME, SAVE_KEY);
  if (!snapshot) {
    return undefined;
  }

  return migrateSnapshot(snapshot);
}

export function calculateOfflineReward(snapshot: SaveSnapshot, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.min((now - snapshot.lastSavedAt) / 1000, PROGRESSION.offlineCapSeconds));
  const rates = estimateOfflineHuntRates(snapshot.progress);
  const minutes = elapsedSeconds / 60;

  return {
    elapsedSeconds,
    gold: Math.floor(rates.goldPerMinute * minutes),
    experience: Math.floor(rates.experiencePerMinute * minutes),
  };
}

function migrateSnapshot(snapshot: StoredSaveSnapshot): SaveSnapshot {
  return {
    version: 7,
    progress: normalizeProgress(snapshot.progress),
    lastSavedAt: snapshot.lastSavedAt ?? Date.now(),
  };
}
