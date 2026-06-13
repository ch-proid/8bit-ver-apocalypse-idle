import { ALTAR_BALANCE } from "../data/balance";
import { RELIC_GRADES, RELIC_IDS, RELICS } from "../data/relics";
import { chance, nextRandom, pickOne, pickWeighted } from "./rng";
import type {
  AltarState,
  EquipmentStatAllocation,
  KillType,
  OwnedRelics,
  RelicGrade,
  RelicId,
  RelicInstance,
  RelicOwnedStats,
  RngState,
  SinId,
} from "./types";

export interface RelicDrop {
  id: RelicId;
  grade: RelicGrade;
  ownedStats: RelicOwnedStats;
}

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
    owned: normalizeOwnedRelics(input?.owned),
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
    owned: cloneOwnedRelics(altar.owned),
    equippedRelicId: altar.equippedRelicId,
    bossDefeated: { ...altar.bossDefeated },
  };
}

export function cloneOwnedRelics(owned: OwnedRelics): OwnedRelics {
  const cloned: OwnedRelics = {};
  for (const relicId of RELIC_IDS) {
    const grades = owned[relicId];
    if (!grades) {
      continue;
    }
    cloned[relicId] = {};
    for (const grade of RELIC_GRADES) {
      const instance = grades[grade];
      if (instance) {
        cloned[relicId]![grade] = cloneRelicInstance(instance);
      }
    }
  }
  return cloned;
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

export function rollEliteRelicDrop(altar: AltarState, rebirthCount: number, rng: RngState): RelicDrop | null {
  if (!chance(rng, ALTAR_BALANCE.eliteStats.relicDropChance)) {
    return null;
  }

  const grade = rollUnlockedRelicGrade(altar, rebirthCount, rng);
  return {
    id: pickOne(rng, RELIC_IDS),
    grade,
    ownedStats: rollRelicOwnedStats(grade, altar.level, rng),
  };
}

export function unlockedRelicGrades(altar: AltarState, rebirthCount: number): RelicGrade[] {
  const unlocked = RELIC_GRADES.filter((grade) => {
    const rule = ALTAR_BALANCE.relicGrades[grade];
    return altar.level >= rule.altarLevel && rebirthCount >= rule.rebirthCount;
  });
  return unlocked.length > 0 ? unlocked : ["common"];
}

export function grantRelic(
  altar: AltarState,
  relicId: RelicId,
  grade: RelicGrade = "common",
  ownedStats: RelicOwnedStats = baseRelicOwnedStats(grade, altar.level),
): RelicInstance {
  const gradeMap = altar.owned[relicId] ?? {};
  altar.owned[relicId] = gradeMap;

  const current = gradeMap[grade];
  if (!current) {
    const instance = createRelicInstance(relicId, grade, ownedStats);
    gradeMap[grade] = instance;
    return instance;
  }

  addRelicDuplicate(altar, current);
  return current;
}

export function setRelicStarsForDebug(altar: AltarState, relicId: RelicId, stars: number, grade: RelicGrade = "common"): void {
  const safeStars = Math.max(0, Math.min(ALTAR_BALANCE.maxStars, Math.floor(stars)));
  if (safeStars <= 0) {
    const gradeMap = altar.owned[relicId];
    delete gradeMap?.[grade];
    if (gradeMap && Object.keys(gradeMap).length <= 0) {
      delete altar.owned[relicId];
    }
    if (!hasOwnedRelic(altar, relicId) && altar.equippedRelicId === relicId) {
      altar.equippedRelicId = null;
    }
    return;
  }

  const gradeMap = altar.owned[relicId] ?? {};
  altar.owned[relicId] = gradeMap;
  gradeMap[grade] = createRelicInstance(relicId, grade, baseRelicOwnedStats(grade, altar.level), safeStars, 0);
}

export function equipRelic(altar: AltarState, relicId: RelicId): boolean {
  if (!hasOwnedRelic(altar, relicId)) {
    return false;
  }

  altar.equippedRelicId = relicId;
  return true;
}

export function relicStars(altar: AltarState, relicId: RelicId | null): number {
  if (!relicId) {
    return 0;
  }

  return bestRelicInstance(altar, relicId)?.stars ?? 0;
}

export function bestRelicInstance(altar: AltarState, relicId: RelicId | null): RelicInstance | null {
  if (!relicId) {
    return null;
  }

  const instances = relicInstancesForStyle(altar, relicId);
  let best: RelicInstance | null = null;
  for (const instance of instances) {
    if (
      !best
      || instance.stars > best.stars
      || (instance.stars === best.stars && relicGradeRank(instance.grade) > relicGradeRank(best.grade))
    ) {
      best = instance;
    }
  }
  return best;
}

export function highestRelicGrade(altar: AltarState, relicId: RelicId | null): RelicGrade | null {
  if (!relicId) {
    return null;
  }

  const instances = relicInstancesForStyle(altar, relicId);
  let grade: RelicGrade | null = null;
  for (const instance of instances) {
    if (!grade || relicGradeRank(instance.grade) > relicGradeRank(grade)) {
      grade = instance.grade;
    }
  }
  return grade;
}

export function ownedRelicStyleCount(altar: AltarState): number {
  return RELIC_IDS.filter((relicId) => hasOwnedRelic(altar, relicId)).length;
}

export function calculateRelicOwnedStats(altar: AltarState): EquipmentStatAllocation {
  const total = { atk: 0, hp: 0, def: 0, reg: 0 };
  for (const relicId of RELIC_IDS) {
    for (const instance of relicInstancesForStyle(altar, relicId)) {
      const starMultiplier = 1 + Math.max(0, instance.stars - 1) * ALTAR_BALANCE.relicOwnedStatPerStarBonus;
      total.atk += instance.ownedStats.atk * starMultiplier;
      total.hp += instance.ownedStats.hp * starMultiplier;
      total.def += instance.ownedStats.def * starMultiplier;
    }
  }
  return {
    atk: roundTo(total.atk, 2),
    hp: roundTo(total.hp, 2),
    def: roundTo(total.def, 2),
    reg: 0,
  };
}

export function relicGradeRank(grade: RelicGrade): number {
  return ALTAR_BALANCE.relicGrades[grade].rank;
}

function addRelicDuplicate(altar: AltarState, current: RelicInstance): void {
  if (current.stars >= ALTAR_BALANCE.maxStars) {
    promoteRelicDuplicate(altar, current);
    return;
  }

  current.duplicateProgress += 1;
  while (current.stars < ALTAR_BALANCE.maxStars) {
    const required = duplicateRequirementForNextStar(current.stars);
    if (current.duplicateProgress < required) {
      return;
    }

    const nextStars = current.stars + 1;
    if (nextStars >= ALTAR_BALANCE.bossGateStar && !isBossGateOpen(altar, current.id)) {
      current.duplicateProgress = Math.min(current.duplicateProgress, required);
      return;
    }

    current.duplicateProgress -= required;
    current.stars = nextStars;
  }
}

function promoteRelicDuplicate(altar: AltarState, current: RelicInstance): void {
  const nextGrade = nextRelicGrade(current.grade);
  if (!nextGrade) {
    return;
  }

  grantRelic(altar, current.id, nextGrade, baseRelicOwnedStats(nextGrade, altar.level));
}

function duplicateRequirementForNextStar(stars: number): number {
  const table = ALTAR_BALANCE.duplicateRequirementsByCurrentStar as Record<number, number>;
  return table[Math.max(1, Math.min(ALTAR_BALANCE.maxStars - 1, Math.floor(stars)))] ?? 1;
}

function rollUnlockedRelicGrade(altar: AltarState, rebirthCount: number, rng: RngState): RelicGrade {
  const weights = unlockedRelicGrades(altar, rebirthCount).reduce((acc, grade) => {
    acc[grade] = ALTAR_BALANCE.relicGrades[grade].dropWeight;
    return acc;
  }, {} as Record<RelicGrade, number>);
  return pickWeighted(rng, weights);
}

export function rollRelicOwnedStats(grade: RelicGrade, altarLevel: number, rng: RngState): RelicOwnedStats {
  const base = baseRelicOwnedStats(grade, altarLevel);
  const variance = ALTAR_BALANCE.relicGrades[grade].variance;
  return {
    atk: rollStat(base.atk, variance, rng),
    hp: rollStat(base.hp, variance, rng),
    def: rollStat(base.def, variance, rng),
  };
}

function baseRelicOwnedStats(grade: RelicGrade, altarLevel: number): RelicOwnedStats {
  const rule = ALTAR_BALANCE.relicGrades[grade];
  const capMultiplier = 1 + Math.max(0, altarLevel - rule.altarLevel) * ALTAR_BALANCE.relicOwnedStatCapPerAltarLevel;
  return {
    atk: roundTo(rule.ownedStats.atk * capMultiplier, 2),
    hp: roundTo(rule.ownedStats.hp * capMultiplier, 2),
    def: roundTo(rule.ownedStats.def * capMultiplier, 2),
  };
}

function rollStat(base: number, variance: number, rng: RngState): number {
  const min = base * Math.max(0, 1 - variance);
  const max = base;
  return roundTo(min + nextRandom(rng) * (max - min), 2);
}

function createRelicInstance(
  relicId: RelicId,
  grade: RelicGrade,
  ownedStats: RelicOwnedStats,
  stars = 1,
  duplicateProgress = 0,
): RelicInstance {
  return {
    id: relicId,
    grade,
    stars: Math.max(1, Math.min(ALTAR_BALANCE.maxStars, Math.floor(stars))),
    duplicateProgress: Math.max(0, Math.floor(duplicateProgress)),
    ownedStats: { ...ownedStats },
  };
}

function cloneRelicInstance(instance: RelicInstance): RelicInstance {
  return {
    ...instance,
    ownedStats: { ...instance.ownedStats },
  };
}

function normalizeOwnedRelics(input: unknown): OwnedRelics {
  const result: OwnedRelics = {};
  if (!input || typeof input !== "object") {
    return result;
  }

  const source = input as Record<string, unknown>;
  for (const relicId of RELIC_IDS) {
    const entry = source[relicId];
    if (!entry || typeof entry !== "object") {
      continue;
    }

    if (isLegacyRelicInstance(entry)) {
      result[relicId] = {
        common: createRelicInstance(
          relicId,
          "common",
          baseRelicOwnedStats("common", ALTAR_BALANCE.initialLevel),
          entry.stars,
          0,
        ),
      };
      continue;
    }

    const gradeMap: Partial<Record<RelicGrade, RelicInstance>> = {};
    const sourceGrades = entry as Record<string, unknown>;
    for (const grade of RELIC_GRADES) {
      const instance = sourceGrades[grade];
      if (instance && typeof instance === "object") {
        gradeMap[grade] = normalizeRelicInstance(relicId, grade, instance as Partial<RelicInstance>);
      }
    }
    if (Object.keys(gradeMap).length > 0) {
      result[relicId] = gradeMap;
    }
  }
  return result;
}

function normalizeRelicInstance(relicId: RelicId, fallbackGrade: RelicGrade, input: Partial<RelicInstance>): RelicInstance {
  const grade = RELIC_GRADES.includes(input.grade as RelicGrade) ? input.grade as RelicGrade : fallbackGrade;
  const fallbackStats = baseRelicOwnedStats(grade, ALTAR_BALANCE.initialLevel);
  const stats = input.ownedStats;
  return createRelicInstance(
    relicId,
    grade,
    {
      atk: safeNumber(stats?.atk, fallbackStats.atk),
      hp: safeNumber(stats?.hp, fallbackStats.hp),
      def: safeNumber(stats?.def, fallbackStats.def),
    },
    safeNumber(input.stars, 1),
    safeNumber(input.duplicateProgress, 0),
  );
}

function isLegacyRelicInstance(input: object): input is { stars: number } {
  return "stars" in input && !("grade" in input);
}

function relicInstancesForStyle(altar: AltarState, relicId: RelicId): RelicInstance[] {
  const grades = altar.owned[relicId];
  if (!grades) {
    return [];
  }
  return RELIC_GRADES.flatMap((grade) => {
    const instance = grades[grade];
    return instance ? [instance] : [];
  });
}

function hasOwnedRelic(altar: AltarState, relicId: RelicId): boolean {
  return relicInstancesForStyle(altar, relicId).length > 0;
}

function nextRelicGrade(grade: RelicGrade): RelicGrade | null {
  const index = RELIC_GRADES.indexOf(grade);
  return index >= 0 && index < RELIC_GRADES.length - 1 ? RELIC_GRADES[index + 1] : null;
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

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
