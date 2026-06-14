import { EQUIPMENT_BALANCE, GOLD_BALANCE } from "../data/balance";
import { ITEM_SLOTS } from "../data/items";
import { calculateItemValue, cloneItem, generateEquipmentItem, nextRarity, rollGeneralOptions, rollWeightedGeneralOption } from "./equipment";
import { addItemToInventory, createItemId, findItem } from "./inventory";
import { chance, pickOne } from "./rng";
import type { EquipmentItem, ItemRarity, ProgressState, RerollState, RngState, ShopOffer, ShopState } from "./types";

export function createDefaultRerollState(): RerollState {
  return {
    countsByItemId: {},
  };
}

export function normalizeRerollState(input?: Partial<RerollState>): RerollState {
  return {
    countsByItemId: { ...input?.countsByItemId },
  };
}

export function createDefaultShopState(): ShopState {
  return {
    nextOfferId: 1,
    refreshedAt: 0,
    offers: [],
  };
}

export function normalizeShopState(input?: Partial<ShopState>): ShopState {
  return {
    nextOfferId: input?.nextOfferId ?? 1,
    refreshedAt: input?.refreshedAt ?? 0,
    offers: input?.offers?.map((offer) => ({
      ...offer,
      item: cloneItem(offer.item),
    })) ?? [],
  };
}

export function cubeSynthesize(progress: ProgressState, rarity: ItemRarity, rng: RngState): EquipmentItem | null {
  const resultRarity = nextRarity(rarity);
  if (!resultRarity) {
    return null;
  }

  const candidates = progress.inventory.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.rarity === rarity)
    .sort((a, b) => calculateItemValue(a.item) - calculateItemValue(b.item));

  if (candidates.length < 3) {
    return null;
  }

  const consumed = candidates.slice(0, 3);
  const consumedIndexes = new Set(consumed.map(({ index }) => index));
  const itemLevel = Math.max(...consumed.map(({ item }) => item.itemLevel)) + GOLD_BALANCE.cubeResultLevelBonus;
  progress.inventory.items = progress.inventory.items.filter((_, index) => !consumedIndexes.has(index));

  const result = generateEquipmentItem({
    id: createItemId(progress.inventory),
    rng,
    stageId: progress.currentStage,
    rarity: resultRarity,
    slot: pickOne(rng, ITEM_SLOTS),
    itemLevel,
  });
  addItemToInventory(progress, result);
  return result;
}

export function rerollItemOptions(progress: ProgressState, itemId: string, rng: RngState): { success: boolean; cost: number } {
  const found = findItem(progress, itemId);
  if (!found) {
    return { success: false, cost: 0 };
  }

  const count = progress.reroll.countsByItemId[itemId] ?? 0;
  const cost = rerollCost(count);
  if (progress.gold < cost) {
    return { success: false, cost };
  }

  progress.gold -= cost;
  progress.reroll.countsByItemId[itemId] = count + 1;

  const sinOptions = found.item.options.filter((option) => option.sin).map((option) => ({ ...option }));
  const generalOptions = rollGeneralOptions(rng, found.item.slot, found.item.rarity);
  found.item.options = [...generalOptions, ...sinOptions];

  return { success: true, cost };
}

export interface ReawakenCost {
  gold: number;
  crystal: number;
}

export interface ReawakenResult extends ReawakenCost {
  success: boolean;
  rerolledLines: number[];
}

export function reawakenItemOptions(
  progress: ProgressState,
  itemId: string,
  rng: RngState,
  selectedGeneralLineIndexes?: number[],
): ReawakenResult {
  const found = findItem(progress, itemId);
  if (!found) {
    return { success: false, gold: 0, crystal: 0, rerolledLines: [] };
  }

  const generalOptions = found.item.options.filter((option) => !option.sin);
  if (generalOptions.length <= 0) {
    return { success: false, gold: 0, crystal: 0, rerolledLines: [] };
  }

  const selected = normalizeSelectedLines(selectedGeneralLineIndexes, generalOptions.length);
  const cost = reawakeningCost(found.item, selected.length);
  if (progress.gold < cost.gold || progress.crystal < cost.crystal) {
    return { success: false, ...cost, rerolledLines: selected };
  }

  progress.gold -= cost.gold;
  progress.crystal -= cost.crystal;

  let generalCursor = 0;
  const selectedSet = new Set(selected);
  found.item.options = found.item.options.map((option) => {
    if (option.sin) {
      return { ...option };
    }
    const index = generalCursor;
    generalCursor += 1;
    return selectedSet.has(index)
      ? rollWeightedGeneralOption(rng, found.item.slot)
      : { ...option };
  });

  return { success: true, ...cost, rerolledLines: selected };
}

export function reawakeningCost(item: EquipmentItem, selectedLineCount?: number): ReawakenCost {
  const generalLineCount = Math.max(0, item.options.filter((option) => !option.sin).length);
  if (generalLineCount <= 0) {
    return { gold: 0, crystal: 0 };
  }

  const selected = Math.max(1, Math.min(generalLineCount, Math.floor(selectedLineCount ?? generalLineCount)));
  const multiplier = 1 + (generalLineCount - selected) * EQUIPMENT_BALANCE.reawakening.pinpointCostStep;
  const rarityMultiplier = 1 + EQUIPMENT_BALANCE.rarityRanks[item.rarity] * 0.35;
  const levelMultiplier = 1 + Math.max(0, item.itemLevel - 1) * 0.03;
  return {
    gold: Math.floor(EQUIPMENT_BALANCE.reawakening.baseGoldCost * multiplier * rarityMultiplier * levelMultiplier),
    crystal: Math.max(1, Math.ceil(EQUIPMENT_BALANCE.reawakening.baseCrystalCost * multiplier * rarityMultiplier)),
  };
}

export function refreshShop(progress: ProgressState, rng: RngState, elapsedSeconds: number, paid: boolean): boolean {
  if (paid) {
    if (progress.gold < GOLD_BALANCE.shopRefreshGoldCost) {
      return false;
    }
    progress.gold -= GOLD_BALANCE.shopRefreshGoldCost;
  }

  const offers: ShopOffer[] = [];
  for (let i = 0; i < GOLD_BALANCE.shopSlots; i += 1) {
    const item = generateEquipmentItem({
      id: createItemId(progress.inventory),
      rng,
      stageId: progress.currentStage,
      forceSin: i === 0 && shouldForceSinOffer(rng),
    });
    offers.push({
      id: createOfferId(progress.shop),
      item,
      price: shopPrice(item),
    });
  }

  progress.shop.offers = offers;
  progress.shop.refreshedAt = elapsedSeconds;
  return true;
}

export function buyShopOffer(progress: ProgressState, offerId: string): boolean {
  const offerIndex = progress.shop.offers.findIndex((offer) => offer.id === offerId);
  if (offerIndex < 0) {
    return false;
  }

  const offer = progress.shop.offers[offerIndex];
  if (progress.gold < offer.price) {
    return false;
  }

  progress.gold -= offer.price;
  progress.shop.offers.splice(offerIndex, 1);
  addItemToInventory(progress, offer.item);
  return true;
}

export function rerollCost(previousRerolls: number): number {
  return Math.floor(GOLD_BALANCE.rerollBaseCost * Math.pow(GOLD_BALANCE.rerollCostGrowth, previousRerolls));
}

function normalizeSelectedLines(selected: number[] | undefined, total: number): number[] {
  if (!selected || selected.length <= 0) {
    return Array.from({ length: total }, (_, index) => index);
  }

  const normalized = Array.from(new Set(
    selected
      .map((index) => Math.floor(index))
      .filter((index) => index >= 0 && index < total),
  )).sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : Array.from({ length: total }, (_, index) => index);
}

export function shopPrice(item: EquipmentItem): number {
  return Math.floor(
    item.itemLevel * GOLD_BALANCE.shopItemPriceLevelWeight
    + GOLD_BALANCE.shopItemPriceRarityWeight * (item.options.length + 1),
  );
}

function createOfferId(shop: ShopState): string {
  const id = `shop${shop.nextOfferId}`;
  shop.nextOfferId += 1;
  return id;
}

function shouldForceSinOffer(rng: RngState): boolean {
  return chance(rng, GOLD_BALANCE.shopSinOfferChance);
}
