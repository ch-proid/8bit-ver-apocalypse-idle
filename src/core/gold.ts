import { GOLD_BALANCE } from "../data/balance";
import { ITEM_SLOTS } from "../data/items";
import { calculateItemValue, generateEquipmentItem, nextRarity, rollGeneralOptions } from "./equipment";
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
      item: {
        ...offer.item,
        options: offer.item.options.map((option) => ({ ...option })),
      },
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
