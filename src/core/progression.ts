import { DROP_REWARD_BALANCE, FLOATING_TEXT, nextExperienceForLevel, PROGRESSION, STAT_GROWTH } from "../data/balance";
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
  normalizeStatDistribution,
} from "./stats";
import { rebirthStatMultiplier } from "./rebirthScaling";
import type { DropIconKind, ProgressRecords, ProgressState, RebirthState, RecordEntry, WorldState } from "./types";

export function createDefaultProgress(stageId: number = PROGRESSION.initialStageId): ProgressState {
  const classId = normalizeClassId(undefined);
  return {
    gold: 0,
    crystal: 0,
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
    crystal: Math.max(0, Math.floor(input?.crystal ?? defaults.crystal)),
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
    crystal: progress.crystal,
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
    rebirth: { ...progress.rebirth },
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
  const actualExperience = Math.max(0, Math.floor(experience * (1 + affixes.experienceGain / 100)));
  progress.gold += actualGold;

  gainExperience(progress, world, actualExperience);
}

export function gainExperience(progress: ProgressState, world: WorldState, baseExperience: number): void {
  if (baseExperience <= 0) {
    return;
  }

  progress.experience += Math.max(0, Math.floor(baseExperience));

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
    ttl: dropIconTtl(kind),
  });

  if (world.dropIcons.length > DROP_REWARD_BALANCE.maxIcons) {
    world.dropIcons.shift();
  }
}

function dropIconTtl(kind: DropIconKind): number {
  const rareBonus = kind === "ability" || kind === "weapon" || kind === "helmet" || kind === "armor" || kind === "accessory"
    ? DROP_REWARD_BALANCE.rareIconSettleBonusSeconds
    : 0;
  return DROP_REWARD_BALANCE.iconLaunchSeconds
    + DROP_REWARD_BALANCE.iconSettleSeconds
    + DROP_REWARD_BALANCE.iconPickupFadeSeconds
    + rareBonus;
}

export function createDefaultRebirthState(): RebirthState {
  return {
    canRebirth: false,
    count: 0,
    multiplier: rebirthStatMultiplier(0),
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

function createRecordEntry(value: number, updatedAt: number | null): RecordEntry {
  return { value, updatedAt };
}

function normalizeRebirth(input?: Partial<RebirthState>): RebirthState {
  const defaults = createDefaultRebirthState();
  const legacy = input as (Partial<RebirthState> & {
    experienceMultiplier?: number;
    permanentStats?: unknown;
  }) | undefined;
  const count = Math.max(0, Math.floor(input?.count ?? defaults.count));
  const multiplier = rebirthStatMultiplier(count);

  return {
    canRebirth: Boolean(legacy?.canRebirth ?? defaults.canRebirth),
    count,
    // Legacy saves may still carry experienceMultiplier/permanentStats. The new loop derives a single
    // permanent stat multiplier from count, so those fields are intentionally ignored during migration.
    multiplier,
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
