import { GENERAL_AFFIXES, SIN_AFFIXES } from "../data/affixes";
import { AFFIX_BALANCE, EQUIPMENT_BALANCE } from "../data/balance";
import { ITEM_RARITIES, ITEM_SLOT_BASE_STAT, ITEM_SLOTS } from "../data/items";
import { chance, pickOne, pickWeighted, randomInt } from "./rng";
import type {
  EquipmentItem,
  EquippedItems,
  GeneralAffixKey,
  ItemOption,
  ItemRarity,
  ItemSlot,
  RngState,
  SinAffixKey,
  CombatAffixStats,
  SinAffixStats,
  EquipmentStatAllocation,
} from "./types";

export interface GenerateEquipmentInput {
  id: string;
  rng: RngState;
  stageId: number;
  slot?: ItemSlot;
  rarity?: ItemRarity;
  itemLevel?: number;
  forceSin?: boolean;
}

export function generateEquipmentItem(input: GenerateEquipmentInput): EquipmentItem {
  const slot = input.slot ?? pickOne(input.rng, ITEM_SLOTS);
  const rarity = input.rarity ?? rollRarityForStage(input.rng, input.stageId);
  const itemLevel = input.itemLevel ?? itemLevelForStage(input.stageId);
  const baseStat = ITEM_SLOT_BASE_STAT[slot];
  const baseValue = calculateBaseValue(slot, rarity, itemLevel);
  const options = rollGeneralOptions(input.rng, slot, rarity);

  if (shouldAttachSinOption(input.rng, rarity, input.forceSin)) {
    options.push(rollSinOption(input.rng, slot));
  }
  const weaponStats = calculateWeaponCombatStats(slot, rarity, itemLevel, baseValue, 0);

  return {
    id: input.id,
    slot,
    rarity,
    itemLevel,
    baseStat,
    baseValue,
    ...weaponStats,
    options,
  };
}

export function rollRarityForStage(rng: RngState, stageId: number): ItemRarity {
  const chapterIndex = Math.min(
    EQUIPMENT_BALANCE.rarityWeightsByChapter.length - 1,
    Math.max(0, Math.ceil(stageId / EQUIPMENT_BALANCE.stagesPerChapter) - 1),
  );
  return pickWeighted(rng, EQUIPMENT_BALANCE.rarityWeightsByChapter[chapterIndex] as Record<ItemRarity, number>);
}

export function itemLevelForStage(stageId: number): number {
  return Math.max(1, Math.floor(stageId * EQUIPMENT_BALANCE.itemLevelPerStage));
}

export function rollGeneralOptions(rng: RngState, slot: ItemSlot, rarity: ItemRarity): ItemOption[] {
  const count = EQUIPMENT_BALANCE.generalOptionLines[rarity];
  const allowed = generalAffixesForSlot(slot);
  const options: ItemOption[] = [];

  for (let i = 0; i < count; i += 1) {
    const key = pickOne(rng, allowed);
    options.push({
      key,
      value: rollAffixValue(rng, key),
      sin: false,
    });
  }

  return options;
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
  const stats: EquipmentStatAllocation = { atk: 0, def: 0, hp: 0, reg: 0 };

  for (const item of Object.values(equipped)) {
    if (!item) {
      continue;
    }
    stats[item.baseStat] += item.baseValue;
  }

  return stats;
}

export function calculateCombatAffixStats(equipped: EquippedItems): CombatAffixStats {
  const stats = createEmptyCombatAffixStats();

  for (const item of Object.values(equipped)) {
    if (!item) {
      continue;
    }
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
  const combatValue = normalized.slot === "weapon"
    ? normalized.upgradeLevel * EQUIPMENT_BALANCE.itemValue.upgradeWeight
      + normalized.accuracy * EQUIPMENT_BALANCE.itemValue.accuracyWeight
    : 0;
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
  const upgradeLevel = Math.max(0, Math.floor((item as Partial<EquipmentItem>).upgradeLevel ?? 0));
  const derived = calculateWeaponCombatStats(item.slot, item.rarity, item.itemLevel, item.baseValue, upgradeLevel);
  const raw = item as Partial<EquipmentItem>;
  return {
    ...item,
    minDmg: safeNumber(raw.minDmg, derived.minDmg),
    maxDmg: Math.max(safeNumber(raw.maxDmg, derived.maxDmg), safeNumber(raw.minDmg, derived.minDmg)),
    accuracy: safeNumber(raw.accuracy, derived.accuracy),
    upgradeLevel,
    options: item.options?.map((option) => ({ ...option })) ?? [],
  };
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
  const upgradeDamageMultiplier = 1 + upgradeLevel * EQUIPMENT_BALANCE.weaponUpgrade.damagePercentPerLevel / 100;
  const midpoint = Math.max(1, baseValue) * upgradeDamageMultiplier;
  return {
    minDmg: Math.max(1, Math.floor(midpoint * (1 - spread))),
    maxDmg: Math.max(1, Math.ceil(midpoint * (1 + spread))),
    accuracy: roundTo(
      EQUIPMENT_BALANCE.weaponDamage.accuracyBase
        + itemLevel * EQUIPMENT_BALANCE.weaponDamage.accuracyPerItemLevel
        + rank * EQUIPMENT_BALANCE.weaponDamage.accuracyPerRarityRank
        + upgradeLevel * EQUIPMENT_BALANCE.weaponUpgrade.accuracyPerLevel,
      2,
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

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function generalAffixesForSlot(slot: ItemSlot): GeneralAffixKey[] {
  return Object.values(GENERAL_AFFIXES)
    .filter((affix) => affix.allowedSlots.includes(slot))
    .map((affix) => affix.key);
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
    defPenetration: 0,
    lifeSteal: 0,
    goldGain: 0,
    damageReduction: 0,
  };
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
