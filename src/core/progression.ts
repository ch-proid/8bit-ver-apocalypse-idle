import { DROP_REWARD_BALANCE, FLOATING_TEXT, nextExperienceForLevel, PROGRESSION, REBIRTH_BALANCE, STAT_GROWTH } from "../data/balance";
import { cloneAltarState, createDefaultAltarState, normalizeAltarState } from "./altar";
import { getPlayerClass, normalizeClassId } from "./class";
import { calculateCombatAffixStats, cloneItem } from "./equipment";
import { createDefaultRerollState, createDefaultShopState, normalizeRerollState, normalizeShopState } from "./gold";
import { cloneInventory, createDefaultInventory, normalizeInventory } from "./inventory";
import { cloneStageProgress, createDefaultStageProgress, normalizeStageProgress } from "./stageProgress";
import {
  applyLevelStatPoints,
  applyPlayerStats,
  createRecommendedStatDistribution,
  emptyAllocation,
  normalizeStatDistribution,
} from "./stats";
import type { DropIconKind, ProgressRecords, ProgressState, RebirthState, RecordEntry, WorldState } from "./types";

export function createDefaultProgress(stageId: number = PROGRESSION.initialStageId): ProgressState {
  const classId = normalizeClassId(undefined);
  return {
    gold: 0,
    experience: 0,
    level: 1,
    classId,
    currentStage: stageId,
    nextExperience: nextExperienceForLevel(1),
    statDistribution: createRecommendedStatDistribution(classId),
    inventory: createDefaultInventory(),
    reroll: createDefaultRerollState(),
    shop: createDefaultShopState(),
    stageProgress: createDefaultStageProgress(stageId),
    altar: createDefaultAltarState(),
    rebirth: createDefaultRebirthState(),
    rebirthRecords: [],
    records: createDefaultRecords(),
  };
}

export function normalizeProgress(input?: Partial<ProgressState>): ProgressState {
  const defaults = createDefaultProgress(input?.currentStage ?? PROGRESSION.initialStageId);
  const rebirth = normalizeRebirth(input?.rebirth);
  const classId = normalizeClassId(input?.classId);
  const progress: ProgressState = {
    ...defaults,
    ...input,
    classId,
    nextExperience: nextExperienceForLevel(input?.level ?? defaults.level),
    statDistribution: normalizeStatDistribution(input?.statDistribution, getPlayerClass(classId).recommendedPreset),
    inventory: normalizeInventory(input?.inventory),
    reroll: normalizeRerollState(input?.reroll),
    shop: normalizeShopState(input?.shop),
    stageProgress: normalizeStageProgress(input?.stageProgress, input?.currentStage ?? defaults.currentStage),
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
        item: cloneItem(offer.item),
      })),
    },
    stageProgress: cloneStageProgress(progress.stageProgress),
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

export function addDropIcon(
  world: WorldState,
  kind: DropIconKind,
  x: number,
  y: number,
): void {
  world.dropIcons.push({
    id: `drop${world.nextEntityId++}`,
    kind,
    position: { x, y },
    age: 0,
    ttl: DROP_REWARD_BALANCE.iconTtl,
  });

  if (world.dropIcons.length > DROP_REWARD_BALANCE.maxIcons) {
    world.dropIcons.shift();
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
    permanentStats: normalizePermanentStats(input?.permanentStats, defaults.permanentStats),
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

function normalizePermanentStats(
  input: Partial<ReturnType<typeof emptyAllocation>> | undefined,
  defaults: ReturnType<typeof emptyAllocation>,
) {
  return {
    str: Math.max(0, input?.str ?? defaults.str),
    grit: Math.max(0, input?.grit ?? defaults.grit),
    agi: Math.max(0, input?.agi ?? defaults.agi),
  };
}
