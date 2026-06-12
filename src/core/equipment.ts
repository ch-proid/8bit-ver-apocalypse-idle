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
  StatAllocation,
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

  return {
    id: input.id,
    slot,
    rarity,
    itemLevel,
    baseStat,
    baseValue,
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

export function calculateEquipmentStats(equipped: EquippedItems): StatAllocation {
  const stats: StatAllocation = { atk: 0, def: 0, hp: 0, reg: 0 };

  for (const item of Object.values(equipped)) {
    if (!item) {
      continue;
    }
    stats[item.baseStat] += item.baseValue;
    // TODO(Phase 3C): Apply combat-facing affixes through the formal damage pipeline, not here.
  }

  return stats;
}

export function calculateItemValue(item: EquipmentItem): number {
  const sinBonus = item.options.some((option) => option.sin) ? EQUIPMENT_BALANCE.itemValue.sinOptionBonus : 0;
  return Math.floor(
    item.itemLevel * EQUIPMENT_BALANCE.itemValue.levelWeight
    + EQUIPMENT_BALANCE.rarityRanks[item.rarity] * EQUIPMENT_BALANCE.itemValue.rarityWeight
    + item.options.length * EQUIPMENT_BALANCE.itemValue.optionWeight
    + sinBonus
    + item.baseValue,
  );
}

export function cloneItem(item: EquipmentItem): EquipmentItem {
  return {
    ...item,
    options: item.options.map((option) => ({ ...option })),
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
