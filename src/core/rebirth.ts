import { REBIRTH_BALANCE } from "../data/balance";
import { cloneAltarState } from "./altar";
import { cloneInventory } from "./inventory";
import { createDefaultProgress, updateRecordAt } from "./progression";
import { createInitialSimulation } from "./stage";
import { combatPowerEstimate, createRecommendedStatDistribution, emptyAllocation } from "./stats";
import type { ProgressState, RebirthRecord, SimulationState, StatAllocation } from "./types";

export function rebirthSimulation(input: SimulationState, occurredAt: number): SimulationState {
  const previousProgress = input.progress;
  if (!previousProgress.rebirth.canRebirth) {
    return input;
  }

  const nextCount = previousProgress.rebirth.count + 1;
  const reachedStage = previousProgress.currentStage;
  const reachedLevel = previousProgress.level;
  const combatPower = combatPowerEstimate(previousProgress);
  const nextProgress = createDefaultProgress(REBIRTH_BALANCE.resetStageId);

  nextProgress.classId = previousProgress.classId;
  nextProgress.statDistribution = createRecommendedStatDistribution(previousProgress.classId);
  nextProgress.gold = previousProgress.gold;
  nextProgress.inventory = cloneInventory(previousProgress.inventory);
  nextProgress.reroll = {
    countsByItemId: { ...previousProgress.reroll.countsByItemId },
  };
  nextProgress.shop = {
    nextOfferId: previousProgress.shop.nextOfferId,
    refreshedAt: previousProgress.shop.refreshedAt,
    offers: previousProgress.shop.offers.map((offer) => ({
      ...offer,
      item: {
        ...offer.item,
        options: offer.item.options.map((option) => ({ ...option })),
      },
    })),
  };
  nextProgress.altar = cloneAltarState(previousProgress.altar);
  nextProgress.rebirth = {
    canRebirth: false,
    count: nextCount,
    experienceMultiplier: calculateRebirthExperienceMultiplier(reachedLevel, combatPower, nextCount),
    permanentStats: calculatePermanentStats(nextCount),
  };
  nextProgress.records = {
    highestLevel: { ...previousProgress.records.highestLevel },
    dummyScore: { ...previousProgress.records.dummyScore },
    highestRebirthStage: { ...previousProgress.records.highestRebirthStage },
  };
  updateRecordAt(nextProgress.records.highestLevel, reachedLevel, occurredAt);
  updateRecordAt(nextProgress.records.highestRebirthStage, reachedStage, occurredAt);
  nextProgress.rebirthRecords = appendRebirthRecord(previousProgress.rebirthRecords, {
    run: nextCount,
    reachedStage,
    reachedLevel,
    at: occurredAt,
  });

  return createInitialSimulation(REBIRTH_BALANCE.resetStageId, nextProgress);
}

export function unlockRebirth(progress: ProgressState): ProgressState {
  // TODO(Phase 3E): Replace this temporary gate with the first boss Lucian defeat flag.
  return {
    ...progress,
    rebirth: {
      ...progress.rebirth,
      canRebirth: true,
    },
  };
}

export function calculateRebirthExperienceMultiplier(
  reachedLevel: number,
  combatPower: number,
  rebirthCount: number,
): number {
  return REBIRTH_BALANCE.baseExperienceMultiplier
    + reachedLevel / REBIRTH_BALANCE.levelMultiplierDivisor
    + combatPower / REBIRTH_BALANCE.combatPowerMultiplierDivisor
    + rebirthCount * REBIRTH_BALANCE.countMultiplierBonus;
}

export function calculatePermanentStats(rebirthCount: number): StatAllocation {
  if (rebirthCount <= 0) {
    return emptyAllocation();
  }

  return {
    str: rebirthCount * REBIRTH_BALANCE.permanentStrPerRebirth,
    grit: rebirthCount * REBIRTH_BALANCE.permanentGritPerRebirth,
    agi: rebirthCount * REBIRTH_BALANCE.permanentAgiPerRebirth,
  };
}

function appendRebirthRecord(records: RebirthRecord[], record: RebirthRecord): RebirthRecord[] {
  return [...records, record].slice(-REBIRTH_BALANCE.maxRecords);
}
