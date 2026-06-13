import { ALTAR_BALANCE } from "../data/balance";
import { RELIC_IDS, RELICS } from "../data/relics";
import { chance, pickOne } from "./rng";
import type { AltarState, KillType, RelicId, RngState, SinId } from "./types";

export function createDefaultAltarState(): AltarState {
  return {
    blood: 0,
    level: ALTAR_BALANCE.initialLevel,
    experience: 0,
    owned: {},
    equippedRelicId: null,
    bossDefeated: createDefaultBossFlags(),
  };
}

export function normalizeAltarState(input?: Partial<AltarState>): AltarState {
  const defaults = createDefaultAltarState();
  return {
    blood: Math.max(0, input?.blood ?? defaults.blood),
    level: Math.max(1, Math.floor(input?.level ?? defaults.level)),
    experience: Math.max(0, input?.experience ?? defaults.experience),
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
    level: altar.level,
    experience: altar.experience,
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

export function eliteSummonCost(altar: AltarState): number {
  return Math.floor(ALTAR_BALANCE.eliteBloodCost * Math.pow(ALTAR_BALANCE.eliteBloodCostGrowth, altar.level - 1));
}

export function canSummonElite(altar: AltarState): boolean {
  return altar.blood >= eliteSummonCost(altar);
}

export function spendBloodForElite(altar: AltarState): boolean {
  const required = eliteSummonCost(altar);
  if (altar.blood < required) {
    return false;
  }

  altar.blood -= required;
  return true;
}

export function altarExperienceForLevel(level: number): number {
  return Math.floor(ALTAR_BALANCE.levelExperienceBase * Math.pow(Math.max(1, level), ALTAR_BALANCE.levelExperienceGrowth));
}

export function addAltarExperience(altar: AltarState, amount: number): void {
  altar.experience += Math.max(0, Math.floor(amount));
}

export function canLevelUpAltar(altar: AltarState): boolean {
  return altar.experience >= altarExperienceForLevel(altar.level);
}

export function levelUpAltar(altar: AltarState): boolean {
  const required = altarExperienceForLevel(altar.level);
  if (altar.experience < required) {
    return false;
  }

  altar.experience -= required;
  altar.level += 1;
  return true;
}

export function altarEliteStatsForLevel(level: number): {
  maxHp: number;
  attack: number;
  gold: number;
  experience: number;
  altarExperience: number;
} {
  const safeLevel = Math.max(1, Math.floor(level));
  const steps = safeLevel - 1;
  const stats = ALTAR_BALANCE.eliteStats;
  return {
    maxHp: Math.max(1, Math.round(stats.baseHp * (1 + steps * stats.hpPerLevel))),
    attack: Math.max(0, Math.round(stats.baseAttack * (1 + steps * stats.attackPerLevel))),
    gold: Math.max(0, Math.round(stats.baseGold * (1 + steps * stats.goldPerLevel))),
    experience: Math.max(0, Math.round(stats.baseExperience * (1 + steps * stats.experiencePerLevel))),
    altarExperience: Math.max(0, Math.round(stats.baseAltarExperience * (1 + steps * stats.altarExperiencePerLevel))),
  };
}

export function rollEliteRelicDrop(rng: RngState): RelicId | null {
  if (!chance(rng, ALTAR_BALANCE.eliteStats.relicDropChance)) {
    return null;
  }

  return pickOne(rng, RELIC_IDS);
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
