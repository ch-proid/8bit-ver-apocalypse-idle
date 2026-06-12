import { FLOATING_TEXT, nextExperienceForLevel, PROGRESSION, REBIRTH_BALANCE, STAT_GROWTH } from "../data/balance";
import { cloneAltarState, createDefaultAltarState, normalizeAltarState } from "./altar";
import { calculateCombatAffixStats } from "./equipment";
import { createDefaultRerollState, createDefaultShopState, normalizeRerollState, normalizeShopState } from "./gold";
import { cloneInventory, createDefaultInventory, normalizeInventory } from "./inventory";
import { applyLevelStatPoints, applyPlayerStats, createDefaultStatDistribution, emptyAllocation } from "./stats";
import type { ProgressRecords, ProgressState, RebirthState, RecordEntry, WorldState } from "./types";

export function createDefaultProgress(stageId: number = PROGRESSION.initialStageId): ProgressState {
  return {
    gold: 0,
    experience: 0,
    level: 1,
    currentStage: stageId,
    nextExperience: nextExperienceForLevel(1),
    statDistribution: createDefaultStatDistribution(),
    inventory: createDefaultInventory(),
    reroll: createDefaultRerollState(),
    shop: createDefaultShopState(),
    altar: createDefaultAltarState(),
    rebirth: createDefaultRebirthState(),
    rebirthRecords: [],
    records: createDefaultRecords(),
  };
}

export function normalizeProgress(input?: Partial<ProgressState>): ProgressState {
  const defaults = createDefaultProgress(input?.currentStage ?? PROGRESSION.initialStageId);
  const rebirth = normalizeRebirth(input?.rebirth);
  const progress: ProgressState = {
    ...defaults,
    ...input,
    nextExperience: nextExperienceForLevel(input?.level ?? defaults.level),
    statDistribution: {
      ...defaults.statDistribution,
      ...input?.statDistribution,
      assigned: {
        ...defaults.statDistribution.assigned,
        ...input?.statDistribution?.assigned,
      },
    },
    inventory: normalizeInventory(input?.inventory),
    reroll: normalizeRerollState(input?.reroll),
    shop: normalizeShopState(input?.shop),
    altar: normalizeAltarState(input?.altar),
    rebirth,
    rebirthRecords: input?.rebirthRecords?.map((record) => ({ ...record })) ?? defaults.rebirthRecords,
    records: normalizeRecords(input?.records),
  };
  updateRecordAt(progress.records.highestLevel, progress.level, progress.records.highestLevel.updatedAt ?? 0);

  return progress;
}

export function cloneProgress(progress: ProgressState): ProgressState {
  return {
    ...progress,
    statDistribution: {
      assigned: { ...progress.statDistribution.assigned },
      unspentPoints: progress.statDistribution.unspentPoints,
      preset: progress.statDistribution.preset,
    },
    inventory: cloneInventory(progress.inventory),
    reroll: {
      countsByItemId: { ...progress.reroll.countsByItemId },
    },
    shop: {
      nextOfferId: progress.shop.nextOfferId,
      refreshedAt: progress.shop.refreshedAt,
      offers: progress.shop.offers.map((offer) => ({
        ...offer,
        item: {
          ...offer.item,
          options: offer.item.options.map((option) => ({ ...option })),
        },
      })),
    },
    altar: cloneAltarState(progress.altar),
    rebirth: {
      ...progress.rebirth,
      permanentStats: { ...progress.rebirth.permanentStats },
    },
    rebirthRecords: progress.rebirthRecords.map((record) => ({ ...record })),
    records: {
      highestLevel: { ...progress.records.highestLevel },
      dummyScore: { ...progress.records.dummyScore },
      highestRebirthStage: { ...progress.records.highestRebirthStage },
    },
  };
}

export function grantRewards(
  progress: ProgressState,
  world: WorldState,
  experience: number,
  gold: number,
): void {
  const affixes = calculateCombatAffixStats(progress.inventory.equipped);
  const actualGold = Math.max(0, Math.floor(gold * (1 + affixes.goldGain / 100)));
  progress.gold += actualGold;
  if (actualGold > 0) {
    addFloatingText(world, `+${actualGold}G`, world.player.position.x, world.player.position.y - 10, "#e0c04a");
  }

  gainExperience(progress, world, experience);
}

export function gainExperience(progress: ProgressState, world: WorldState, baseExperience: number): void {
  if (baseExperience <= 0) {
    return;
  }

  progress.experience += applyExperienceMultiplier(baseExperience, progress.rebirth.experienceMultiplier);

  while (progress.experience >= progress.nextExperience) {
    progress.experience -= progress.nextExperience;
    progress.level += 1;
    progress.statDistribution = applyLevelStatPoints(progress.statDistribution, STAT_GROWTH.pointsPerLevel);
    progress.nextExperience = nextExperienceForLevel(progress.level);
    updateRecord(progress.records.highestLevel, progress.level, world.elapsed);
    addFloatingText(world, `LV ${progress.level}`, world.player.position.x, world.player.position.y - 24, "#7da963");
  }

  applyPlayerStats(world.player, progress);
}

export function addFloatingText(
  world: WorldState,
  value: string,
  x: number,
  y: number,
  color: string,
): void {
  world.floatingTexts.push({
    id: `txt${world.nextEntityId++}`,
    position: { x, y },
    value,
    color,
    age: 0,
    ttl: FLOATING_TEXT.ttl,
  });

  if (world.floatingTexts.length > FLOATING_TEXT.maxCount) {
    world.floatingTexts.shift();
  }
}

export function createDefaultRebirthState(): RebirthState {
  return {
    canRebirth: false,
    count: 0,
    experienceMultiplier: REBIRTH_BALANCE.baseExperienceMultiplier,
    permanentStats: emptyAllocation(),
  };
}

export function createDefaultRecords(): ProgressRecords {
  return {
    highestLevel: createRecordEntry(1, null),
    dummyScore: createRecordEntry(0, null),
    highestRebirthStage: createRecordEntry(0, null),
  };
}

export function updateRecord(record: RecordEntry, value: number, elapsedSeconds: number): void {
  updateRecordAt(record, value, Math.floor(elapsedSeconds * 1000));
}

export function updateRecordAt(record: RecordEntry, value: number, updatedAt: number): void {
  if (value <= record.value) {
    return;
  }

  record.value = value;
  record.updatedAt = updatedAt;
}

function applyExperienceMultiplier(baseExperience: number, multiplier: number): number {
  return Math.max(0, Math.floor(baseExperience * multiplier));
}

function createRecordEntry(value: number, updatedAt: number | null): RecordEntry {
  return { value, updatedAt };
}

function normalizeRebirth(input?: Partial<RebirthState>): RebirthState {
  const defaults = createDefaultRebirthState();
  return {
    ...defaults,
    ...input,
    permanentStats: {
      ...defaults.permanentStats,
      ...input?.permanentStats,
    },
  };
}

function normalizeRecords(input?: Partial<ProgressRecords>): ProgressRecords {
  const defaults = createDefaultRecords();
  return {
    highestLevel: { ...defaults.highestLevel, ...input?.highestLevel },
    dummyScore: { ...defaults.dummyScore, ...input?.dummyScore },
    highestRebirthStage: { ...defaults.highestRebirthStage, ...input?.highestRebirthStage },
  };
}
