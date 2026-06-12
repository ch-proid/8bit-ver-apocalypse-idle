import { ALTAR_BALANCE } from "../data/balance";
import { RELIC_IDS, RELICS } from "../data/relics";
import { pickWeighted } from "./rng";
import type { AltarState, KillType, RelicId, RngState, SinId } from "./types";

export function createDefaultAltarState(): AltarState {
  return {
    blood: 0,
    summonCount: 0,
    pityProgress: 0,
    targetedSummons: 0,
    owned: {},
    equippedRelicId: null,
    bossDefeated: createDefaultBossFlags(),
  };
}

export function normalizeAltarState(input?: Partial<AltarState>): AltarState {
  const defaults = createDefaultAltarState();
  return {
    blood: input?.blood ?? defaults.blood,
    summonCount: input?.summonCount ?? defaults.summonCount,
    pityProgress: input?.pityProgress ?? defaults.pityProgress,
    targetedSummons: input?.targetedSummons ?? defaults.targetedSummons,
    owned: { ...input?.owned },
    equippedRelicId: input?.equippedRelicId ?? defaults.equippedRelicId,
    bossDefeated: {
      ...defaults.bossDefeated,
      ...input?.bossDefeated,
    },
  };
}

export function cloneAltarState(altar: AltarState): AltarState {
  return {
    blood: altar.blood,
    summonCount: altar.summonCount,
    pityProgress: altar.pityProgress,
    targetedSummons: altar.targetedSummons,
    owned: Object.fromEntries(
      Object.entries(altar.owned).map(([id, relic]) => [id, relic ? { ...relic } : relic]),
    ) as AltarState["owned"],
    equippedRelicId: altar.equippedRelicId,
    bossDefeated: { ...altar.bossDefeated },
  };
}

export function bloodForKill(killType: KillType, stageId: number): number {
  return ALTAR_BALANCE.bloodByKillType[killType] * (1 + Math.max(0, stageId - 1) * ALTAR_BALANCE.stageBloodMultiplier);
}

export function addBlood(altar: AltarState, killType: KillType, stageId: number): number {
  const amount = bloodForKill(killType, stageId);
  altar.blood += amount;
  return amount;
}

export function summonRequirement(summonCount: number): number {
  return Math.floor(ALTAR_BALANCE.baseSummonBlood * Math.pow(ALTAR_BALANCE.summonGrowth, summonCount));
}

export function canSummon(altar: AltarState): boolean {
  return altar.blood >= summonRequirement(altar.summonCount);
}

export function summonRelic(altar: AltarState, rng: RngState, target?: RelicId): RelicId | null {
  const required = summonRequirement(altar.summonCount);
  if (altar.blood < required) {
    return null;
  }

  let relicId: RelicId;
  if (target && altar.targetedSummons > 0) {
    relicId = target;
    altar.targetedSummons -= 1;
  } else {
    relicId = rollRelicId(altar, rng);
  }

  altar.blood -= required;
  altar.summonCount += 1;
  altar.pityProgress += 1;
  if (altar.pityProgress >= ALTAR_BALANCE.pityEverySummons) {
    altar.pityProgress = 0;
    altar.targetedSummons += 1;
  }

  grantRelic(altar, relicId);
  if (!altar.equippedRelicId) {
    altar.equippedRelicId = relicId;
  }

  return relicId;
}

export function grantRelic(altar: AltarState, relicId: RelicId): void {
  const current = altar.owned[relicId];
  if (!current) {
    altar.owned[relicId] = { id: relicId, stars: 1 };
    return;
  }

  const nextStars = current.stars + 1;
  if (nextStars >= ALTAR_BALANCE.bossGateStar && !isBossGateOpen(altar, relicId)) {
    // TODO(Phase 3E): Replace bossDefeated flags with actual chapter boss defeat progression.
    current.stars = ALTAR_BALANCE.bossGateStar - 1;
    return;
  }

  current.stars = Math.min(ALTAR_BALANCE.maxStars, nextStars);
}

export function equipRelic(altar: AltarState, relicId: RelicId): boolean {
  if (!altar.owned[relicId]) {
    return false;
  }

  altar.equippedRelicId = relicId;
  return true;
}

export function relicStars(altar: AltarState, relicId: RelicId | null): number {
  if (!relicId) {
    return 0;
  }

  return altar.owned[relicId]?.stars ?? 0;
}

function rollRelicId(altar: AltarState, rng: RngState): RelicId {
  const weights = RELIC_IDS.reduce((acc, relicId) => {
    acc[relicId] = altar.owned[relicId] ? 1 : ALTAR_BALANCE.unownedWeightMultiplier;
    return acc;
  }, {} as Record<RelicId, number>);
  return pickWeighted(rng, weights);
}

function isBossGateOpen(altar: AltarState, relicId: RelicId): boolean {
  return altar.bossDefeated[RELICS[relicId].sin];
}

function createDefaultBossFlags(): Record<SinId, boolean> {
  return {
    pride: false,
    gluttony: false,
    grief: false,
    fanaticism: false,
    abyss: false,
    despair: false,
  };
}
