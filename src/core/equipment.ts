import { GENERAL_AFFIXES, SIN_AFFIXES } from "../data/affixes";
import { AFFIX_BALANCE, EQUIPMENT_BALANCE } from "../data/balance";
import {
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_NAME_ADJECTIVES_BY_RARITY,
  EQUIPMENT_RARITY_NAME_PREFIX,
  EQUIPMENT_SLOT_KIND_POOL,
  FUN_EQUIPMENT_ADJECTIVE_CHANCE,
  FUN_EQUIPMENT_ADJECTIVES,
  WEAPON_TYPE_CLASS_ALLOWLIST,
  WEAPON_TYPES,
} from "../data/equipmentNames";
import { ITEM_RARITIES, ITEM_SLOT_BASE_STAT, ITEM_SLOTS } from "../data/items";
import { chance, pickOne, pickWeighted, randomInt } from "./rng";
import type {
  ClassId,
  CombatAffixStats,
  EquipmentBaseStatKey,
  EquipmentBaseStats,
  EquipmentKind,
  EquipmentItem,
  EquipmentStatAllocation,
  EquipmentStatKey,
  EquippedItems,
  GeneralAffixKey,
  ItemOption,
  ItemRarity,
  ItemSlot,
  RngState,
  SinAffixKey,
  SinAffixStats,
  WeaponType,
} from "./types";

export interface GenerateEquipmentInput {
  id: string;
  rng: RngState;
  stageId: number;
  rebirthCount?: number;
  slot?: ItemSlot;
  rarity?: ItemRarity;
  itemLevel?: number;
  kind?: EquipmentKind;
  weaponType?: WeaponType;
  forceSin?: boolean;
}

export function generateEquipmentItem(input: GenerateEquipmentInput): EquipmentItem {
  const slot = input.slot ?? pickOne(input.rng, ITEM_SLOTS);
  const rarity = input.rarity ?? rollRarityForStage(input.rng, input.stageId, input.rebirthCount ?? 0);
  const itemLevel = input.itemLevel ?? itemLevelForStage(input.stageId);
  const kind = normalizeEquipmentKind(slot, input.kind ?? input.weaponType ?? pickOne(input.rng, EQUIPMENT_SLOT_KIND_POOL[slot]));
  const weaponType = slot === "weapon" ? normalizeWeaponType({ slot, kind, weaponType: input.weaponType }) : undefined;
  const baseStats = calculateBaseStats(slot, rarity, itemLevel);
  const baseStat = ITEM_SLOT_BASE_STAT[slot];
  const baseValue = baseStats[baseStat] ?? calculateBaseValue(slot, rarity, itemLevel);
  const options = rollGeneralOptions(input.rng, slot, rarity);

  if (shouldAttachSinOption(input.rng, rarity, input.forceSin)) {
    options.push(rollSinOption(input.rng, slot));
  }
  const weaponStats = calculateWeaponCombatStats(slot, rarity, itemLevel, baseValue, 0);

  return {
    id: input.id,
    name: rollEquipmentName(input.rng, rarity, kind),
    slot,
    kind,
    weaponType,
    rarity,
    itemLevel,
    baseStat,
    baseValue,
    baseStats,
    ...weaponStats,
    options,
  };
}

export function rollRarityForStage(rng: RngState, stageId: number, rebirthCount = 0): ItemRarity {
  return pickWeighted(rng, rarityWeightsForStage(stageId, rebirthCount));
}

export function rarityWeightsForStage(stageId: number, rebirthCount = 0): Record<ItemRarity, number> {
  const chapterIndex = Math.min(
    EQUIPMENT_BALANCE.rarityWeightsByChapter.length - 1,
    Math.max(0, Math.ceil(stageId / EQUIPMENT_BALANCE.stagesPerChapter) - 1),
  );
  const baseWeights = EQUIPMENT_BALANCE.rarityWeightsByChapter[chapterIndex] as Record<ItemRarity, number>;
  const rebirthMultipliers = EQUIPMENT_BALANCE.rarityRebirthWeightMultiplierPerCount as Record<ItemRarity, number>;
  return ITEM_RARITIES.reduce((weights, rarity) => {
    if (!isEquipmentRarityUnlocked(rarity, rebirthCount)) {
      weights[rarity] = 0;
      return weights;
    }
    const multiplier = Math.max(0.25, 1 + Math.max(0, rebirthCount) * rebirthMultipliers[rarity]);
    weights[rarity] = baseWeights[rarity] * multiplier;
    return weights;
  }, {} as Record<ItemRarity, number>);
}

export function unlockedEquipmentRarities(rebirthCount = 0): ItemRarity[] {
  return ITEM_RARITIES.filter((rarity) => isEquipmentRarityUnlocked(rarity, rebirthCount));
}

export function isEquipmentRarityUnlocked(rarity: ItemRarity, rebirthCount = 0): boolean {
  return Math.max(0, rebirthCount) >= EQUIPMENT_BALANCE.rarityRebirthGate[rarity];
}

export function itemLevelForStage(stageId: number): number {
  return Math.max(1, Math.floor(stageId * EQUIPMENT_BALANCE.itemLevelPerStage));
}

export function rollGeneralOptions(rng: RngState, slot: ItemSlot, rarity: ItemRarity): ItemOption[] {
  const count = EQUIPMENT_BALANCE.generalOptionLines[rarity];
  const weights = generalAffixWeightsForSlot(slot);
  const options: ItemOption[] = [];

  for (let i = 0; i < count; i += 1) {
    const key = pickWeighted(rng, weights);
    options.push({
      key,
      value: rollAffixValue(rng, key),
      sin: false,
    });
  }

  return options;
}

export function rollWeightedGeneralOption(rng: RngState, slot: ItemSlot): ItemOption {
  const key = pickWeighted(rng, generalAffixWeightsForSlot(slot));
  return {
    key,
    value: rollAffixValue(rng, key),
    sin: false,
  };
}

export function rollSinOption(rng: RngState, slot: ItemSlot): ItemOption {
  const key = pickOne(rng, sinAffixesForSlot(slot));
  return {
    key,
    value: rollSinAffixValue(rng, key),
    sin: true,
  };
}

export function calculateEquipmentStats(equipped: EquippedItems): EquipmentStatAllocation {
  const stats = createEmptyEquipmentStats();

  for (const item of Object.values(equipped)) {
    if (!item) {
      continue;
    }
    const baseStats = enhancedBaseStats(item);
    stats.atk += baseStats.atk ?? 0;
    stats.def += baseStats.def ?? 0;
    stats.hp += baseStats.hp ?? 0;
    stats.reg += baseStats.reg ?? 0;
    for (const option of item.options) {
      if (!option.sin) {
        applyGeneralStatOption(stats, option);
      }
    }
  }

  return stats;
}

export function calculateCombatAffixStats(equipped: EquippedItems): CombatAffixStats {
  const stats = createEmptyCombatAffixStats();

  for (const item of Object.values(equipped)) {
    if (!item) {
      continue;
    }
    const baseStats = enhancedBaseStats(item);
    stats.critChance += baseStats.critChance ?? 0;
    for (const option of item.options) {
      if (option.sin || !(option.key in stats)) {
        continue;
      }
      stats[option.key as keyof CombatAffixStats] += option.value;
    }
  }

  return stats;
}

export function calculateSinAffixStats(equipped: EquippedItems): SinAffixStats {
  const stats = createEmptySinAffixStats();

  for (const item of Object.values(equipped)) {
    if (!item) {
      continue;
    }
    for (const option of item.options) {
      if (!option.sin || !(option.key in stats)) {
        continue;
      }
      stats[option.key as keyof SinAffixStats] += option.value;
    }
  }

  return stats;
}

export function calculateItemValue(item: EquipmentItem): number {
  const normalized = normalizeEquipmentItem(item);
  const sinBonus = item.options.some((option) => option.sin) ? EQUIPMENT_BALANCE.itemValue.sinOptionBonus : 0;
  const combatValue = normalized.upgradeLevel * EQUIPMENT_BALANCE.itemValue.upgradeWeight
    + (normalized.slot === "weapon" ? normalized.accuracy * EQUIPMENT_BALANCE.itemValue.accuracyWeight : 0);
  return Math.floor(
    normalized.itemLevel * EQUIPMENT_BALANCE.itemValue.levelWeight
    + EQUIPMENT_BALANCE.rarityRanks[normalized.rarity] * EQUIPMENT_BALANCE.itemValue.rarityWeight
    + normalized.options.length * EQUIPMENT_BALANCE.itemValue.optionWeight
    + sinBonus
    + normalized.baseValue
    + combatValue,
  );
}

export function cloneItem(item: EquipmentItem): EquipmentItem {
  const normalized = normalizeEquipmentItem(item);
  return {
    ...normalized,
    options: normalized.options.map((option) => ({ ...option })),
  };
}

export function normalizeEquipmentItem(item: EquipmentItem): EquipmentItem {
  const upgradeLevel = Math.max(
    0,
    Math.min(EQUIPMENT_BALANCE.enhancement.maxLevel, Math.floor((item as Partial<EquipmentItem>).upgradeLevel ?? 0)),
  );
  const raw = item as Partial<EquipmentItem>;
  const kind = normalizeEquipmentKind(item.slot, raw.kind ?? raw.weaponType ?? inferKindFromName(item));
  const weaponType = item.slot === "weapon" ? normalizeWeaponType({ slot: item.slot, kind, weaponType: raw.weaponType }) : undefined;
  const baseStat = normalizeBaseStat(item.slot, raw.baseStat);
  const fallbackBaseStats = calculateBaseStats(item.slot, item.rarity, item.itemLevel);
  const fallbackBaseValue = fallbackBaseStats[baseStat] ?? calculateBaseValue(item.slot, item.rarity, item.itemLevel);
  const baseValue = safeNumber(raw.baseValue, fallbackBaseValue);
  const derived = calculateWeaponCombatStats(item.slot, item.rarity, item.itemLevel, baseValue, upgradeLevel);
  const baseStats = normalizeBaseStats({ ...item, baseValue }, derived.accuracy);
  return {
    ...item,
    name: normalizeEquipmentName({ ...item, kind }),
    kind,
    weaponType,
    baseStat,
    baseValue,
    baseStats,
    minDmg: safeNumber(raw.minDmg, derived.minDmg),
    maxDmg: Math.max(safeNumber(raw.maxDmg, derived.maxDmg), safeNumber(raw.minDmg, derived.minDmg)),
    accuracy: safeNumber(raw.accuracy, derived.accuracy),
    upgradeLevel,
    locked: Boolean(raw.locked),
    options: item.options?.map((option) => ({ ...option })) ?? [],
  };
}

export function equipmentDisplayName(item: EquipmentItem): string {
  return normalizeEquipmentName(item);
}

export function enhancedBaseValue(item: EquipmentItem): number {
  const normalized = normalizeEquipmentItem(item);
  const value = enhancedBaseStats(normalized)[normalized.baseStat] ?? normalized.baseValue;
  return normalized.baseStat === "reg" ? roundTo(value, 2) : Math.max(1, roundTo(value, 2));
}

export function enhancedBaseStats(item: EquipmentItem): EquipmentBaseStats {
  const normalized = normalizeEquipmentItem(item);
  const stats = normalizeBaseStats(normalized, normalized.accuracy);
  const enhanced: EquipmentBaseStats = {};

  for (const [key, value] of Object.entries(stats) as Array<[EquipmentBaseStatKey, number]>) {
    if (key === "accuracy") {
      enhanced.accuracy = normalized.accuracy;
      continue;
    }
    const scaled = value + enhancementFlatBonus(normalized, key);
    if (normalized.upgradeLevel > 0) {
      enhanced[key] = Math.max(key === "reg" ? 0 : 1, Math.round(scaled));
      continue;
    }
    enhanced[key] = key === "reg" || key === "critChance"
      ? roundTo(scaled, 2)
      : Math.max(1, roundTo(scaled, 2));
  }

  return enhanced;
}

export function equipmentBaseStatRows(item: EquipmentItem): Array<{ key: EquipmentBaseStatKey; value: number }> {
  const stats = enhancedBaseStats(item);
  return (["atk", "def", "hp", "reg", "accuracy", "critChance"] as EquipmentBaseStatKey[])
    .filter((key) => (stats[key] ?? 0) > 0)
    .map((key) => ({ key, value: stats[key] ?? 0 }));
}

export function canClassEquipItem(classId: ClassId, item: EquipmentItem): boolean {
  const normalized = normalizeEquipmentItem(item);
  if (normalized.slot !== "weapon") {
    return true;
  }
  return Boolean(normalized.weaponType && WEAPON_TYPE_CLASS_ALLOWLIST[classId].includes(normalized.weaponType));
}

export function equipmentKindLabel(item: EquipmentItem): string {
  const normalized = normalizeEquipmentItem(item);
  return EQUIPMENT_KIND_LABELS[normalized.kind ?? fallbackKindForSlot(normalized.slot)];
}

export function calculateWeaponCombatStats(
  slot: ItemSlot,
  rarity: ItemRarity,
  itemLevel: number,
  baseValue: number,
  upgradeLevel: number,
): Pick<EquipmentItem, "minDmg" | "maxDmg" | "accuracy" | "upgradeLevel"> {
  if (slot !== "weapon") {
    return {
      minDmg: 0,
      maxDmg: 0,
      accuracy: 0,
      upgradeLevel,
    };
  }

  const rank = EQUIPMENT_BALANCE.rarityRanks[rarity];
  const spread = EQUIPMENT_BALANCE.weaponDamage.spreadByRarity[rarity];
  const upgradeDamageBonus = upgradeLevel * EQUIPMENT_BALANCE.weaponUpgrade.damageFlatPerLevelByRarity[rarity];
  const midpoint = Math.max(1, baseValue + upgradeDamageBonus);
  return {
    minDmg: Math.max(1, Math.floor(midpoint * (1 - spread))),
    maxDmg: Math.max(1, Math.ceil(midpoint * (1 + spread))),
    accuracy: Math.round(
      EQUIPMENT_BALANCE.weaponDamage.accuracyBase
        + itemLevel * EQUIPMENT_BALANCE.weaponDamage.accuracyPerItemLevel
        + rank * EQUIPMENT_BALANCE.weaponDamage.accuracyPerRarityRank
        + upgradeLevel * EQUIPMENT_BALANCE.weaponUpgrade.accuracyPerLevel,
    ),
    upgradeLevel,
  };
}

export function cloneEquipped(equipped: EquippedItems): EquippedItems {
  return {
    weapon: equipped.weapon ? cloneItem(equipped.weapon) : null,
    helmet: equipped.helmet ? cloneItem(equipped.helmet) : null,
    armor: equipped.armor ? cloneItem(equipped.armor) : null,
    accessory: equipped.accessory ? cloneItem(equipped.accessory) : null,
  };
}

export function nextRarity(rarity: ItemRarity): ItemRarity | null {
  const index = ITEM_RARITIES.indexOf(rarity);
  if (index < 0 || index >= ITEM_RARITIES.length - 1) {
    return null;
  }

  return ITEM_RARITIES[index + 1];
}

export function hasSinOption(item: EquipmentItem): boolean {
  return item.options.some((option) => option.sin);
}

function shouldAttachSinOption(rng: RngState, rarity: ItemRarity, forceSin?: boolean): boolean {
  if (forceSin) {
    return true;
  }
  if (rarity === "legendary") {
    return true;
  }
  if (rarity === "epic") {
    return chance(rng, EQUIPMENT_BALANCE.epicSinChance);
  }

  return false;
}

function calculateBaseValue(slot: ItemSlot, rarity: ItemRarity, itemLevel: number): number {
  const raw = EQUIPMENT_BALANCE.slotBaseValues[slot] * itemLevel * EQUIPMENT_BALANCE.rarityMultipliers[rarity];
  return slot === "accessory" ? roundTo(raw, 2) : Math.max(1, Math.floor(raw));
}

function rollEquipmentName(rng: RngState, rarity: ItemRarity, kind: EquipmentKind): string {
  const adjectivePool = rarity !== "common" && rarity !== "magic" && chance(rng, FUN_EQUIPMENT_ADJECTIVE_CHANCE)
    ? FUN_EQUIPMENT_ADJECTIVES
    : EQUIPMENT_NAME_ADJECTIVES_BY_RARITY[rarity];
  const adjective = pickOne(rng, adjectivePool);
  return `${EQUIPMENT_RARITY_NAME_PREFIX[rarity]}의 ${adjective} ${EQUIPMENT_KIND_LABELS[kind]}`;
}

function normalizeEquipmentName(item: EquipmentItem): string {
  const rawName = (item as Partial<EquipmentItem>).name;
  if (typeof rawName === "string" && rawName.trim().length > 0) {
    return rawName;
  }

  const fallbackKind = item.kind ?? fallbackKindForSlot(item.slot);
  return `${EQUIPMENT_RARITY_NAME_PREFIX[item.rarity]}의 ${EQUIPMENT_KIND_LABELS[fallbackKind]}`;
}

function calculateBaseStats(slot: ItemSlot, rarity: ItemRarity, itemLevel: number): EquipmentBaseStats {
  const config = EQUIPMENT_BALANCE.slotBaseStats[slot] as EquipmentBaseStats;
  const multiplier = itemLevel * EQUIPMENT_BALANCE.rarityMultipliers[rarity];
  const stats: EquipmentBaseStats = {};

  for (const [key, value] of Object.entries(config) as Array<[EquipmentBaseStatKey, number]>) {
    const raw = value * multiplier;
    stats[key] = key === "reg" || key === "critChance" ? roundTo(raw, 2) : Math.max(1, Math.floor(raw));
  }

  return stats;
}

function normalizeBaseStats(item: EquipmentItem, fallbackAccuracy: number): EquipmentBaseStats {
  const generated = calculateBaseStats(item.slot, item.rarity, item.itemLevel);
  const rawStats = (item as Partial<EquipmentItem>).baseStats;
  const stats: EquipmentBaseStats = { ...generated };

  if (rawStats) {
    for (const key of ["atk", "def", "hp", "reg", "critChance"] as EquipmentBaseStatKey[]) {
      const value = rawStats[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        stats[key] = value;
      }
    }
  }

  if (item.slot === "weapon") {
    stats.accuracy = safeNumber(rawStats?.accuracy, fallbackAccuracy);
  }

  return stats;
}

function enhancementFlatBonus(item: EquipmentItem, key: EquipmentBaseStatKey): number {
  if (item.upgradeLevel <= 0) {
    return 0;
  }
  const byRarity = EQUIPMENT_BALANCE.enhancement.baseStatFlatPerLevel[item.rarity];
  const bySlot = byRarity[item.slot] as Partial<Record<EquipmentBaseStatKey, number>>;
  return Math.max(0, item.upgradeLevel) * (bySlot[key] ?? 0);
}

function normalizeBaseStat(slot: ItemSlot, value: EquipmentStatKey | undefined): EquipmentStatKey {
  if (value === "atk" || value === "def" || value === "hp" || value === "reg") {
    return value;
  }
  return ITEM_SLOT_BASE_STAT[slot];
}

function normalizeEquipmentKind(slot: ItemSlot, value: EquipmentKind | WeaponType | undefined): EquipmentKind {
  const allowed = EQUIPMENT_SLOT_KIND_POOL[slot];
  return allowed.includes(value as EquipmentKind) ? value as EquipmentKind : fallbackKindForSlot(slot);
}

function normalizeWeaponType(input: { slot: ItemSlot; kind?: EquipmentKind; weaponType?: WeaponType }): WeaponType | undefined {
  if (input.slot !== "weapon") {
    return undefined;
  }
  if (WEAPON_TYPES.includes(input.weaponType as WeaponType)) {
    return input.weaponType;
  }
  return WEAPON_TYPES.includes(input.kind as WeaponType) ? input.kind as WeaponType : "sword";
}

function fallbackKindForSlot(slot: ItemSlot): EquipmentKind {
  return EQUIPMENT_SLOT_KIND_POOL[slot][0];
}

function inferKindFromName(item: EquipmentItem): EquipmentKind | undefined {
  const rawName = (item as Partial<EquipmentItem>).name ?? "";
  const labels = (Object.entries(EQUIPMENT_KIND_LABELS) as Array<[EquipmentKind, string]>)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [kind, label] of labels) {
    if (rawName.includes(label)) {
      return kind;
    }
  }
  return undefined;
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function generalAffixesForSlot(slot: ItemSlot): GeneralAffixKey[] {
  return Object.values(GENERAL_AFFIXES)
    .filter((affix) => affix.allowedSlots.includes(slot))
    .map((affix) => affix.key);
}

export function generalAffixWeightsForSlot(slot: ItemSlot): Record<GeneralAffixKey, number> {
  return generalAffixesForSlot(slot).reduce((weights, key) => {
    weights[key] = generalAffixWeight(key);
    return weights;
  }, {} as Record<GeneralAffixKey, number>);
}

export function generalAffixWeight(key: GeneralAffixKey): number {
  const tier = EQUIPMENT_BALANCE.generalAffixTiers[key];
  return EQUIPMENT_BALANCE.generalAffixTierWeights[tier];
}

function sinAffixesForSlot(slot: ItemSlot): SinAffixKey[] {
  return Object.values(SIN_AFFIXES)
    .filter((affix) => affix.allowedSlots.includes(slot))
    .map((affix) => affix.key);
}

function rollAffixValue(rng: RngState, key: GeneralAffixKey): number {
  const range = AFFIX_BALANCE.general[key];
  return randomInt(rng, range.min, range.max);
}

function rollSinAffixValue(rng: RngState, key: SinAffixKey): number {
  const range = AFFIX_BALANCE.sin[key];
  return randomInt(rng, range.min, range.max);
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function createEmptyCombatAffixStats(): CombatAffixStats {
  return {
    critChance: 0,
    critDamage: 0,
    attackSpeed: 0,
    damageIncrease: 0,
    finalDamage: 0,
    additionalDamage: 0,
    defPenetration: 0,
    lifeSteal: 0,
    goldGain: 0,
    experienceGain: 0,
    damageReduction: 0,
  };
}

function createEmptyEquipmentStats(): EquipmentStatAllocation {
  return {
    atk: 0,
    atkPercent: 0,
    def: 0,
    hp: 0,
    reg: 0,
    accuracy: 0,
    evasion: 0,
  };
}

function applyGeneralStatOption(stats: EquipmentStatAllocation, option: ItemOption): void {
  switch (option.key) {
    case "attackFlat":
      stats.atk += option.value;
      break;
    case "attackPercent":
      stats.atkPercent += option.value;
      break;
    case "defenseFlat":
      stats.def += option.value;
      break;
    case "hpFlat":
      stats.hp += option.value;
      break;
    case "hpRegen":
      stats.reg += option.value;
      break;
    case "accuracy":
      stats.accuracy += option.value;
      break;
    case "evasion":
      stats.evasion += option.value;
      break;
    default:
      break;
  }
}

function createEmptySinAffixStats(): SinAffixStats {
  return {
    specterDamage: 0,
    bloodLeech: 0,
    plagueSpread: 0,
    martyrPain: 0,
    executionThreshold: 0,
    despairBurst: 0,
  };
}
