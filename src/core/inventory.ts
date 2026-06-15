import { EQUIPMENT_BALANCE } from "../data/balance";
import { ITEM_RARITIES } from "../data/items";
import { calculateItemValue, canClassEquipItem, cloneEquipped, cloneItem } from "./equipment";
import { applyPlayerStats } from "./stats";
import type {
  AutoSellSettings,
  EquipmentItem,
  EquippedItems,
  InventoryState,
  ItemRarity,
  Player,
  ProgressState,
} from "./types";

export function createDefaultInventory(): InventoryState {
  return {
    capacity: EQUIPMENT_BALANCE.inventoryCapacity,
    nextItemId: 1,
    items: [],
    equipped: createEmptyEquipped(),
    autoSell: createDefaultAutoSellSettings(),
  };
}

export function normalizeInventory(input?: Partial<InventoryState>): InventoryState {
  const defaults = createDefaultInventory();
  return {
    capacity: normalizeInventoryCapacity(input?.capacity),
    nextItemId: input?.nextItemId ?? defaults.nextItemId,
    items: input?.items?.map(cloneItem) ?? defaults.items,
    equipped: normalizeEquipped(input?.equipped),
    autoSell: {
      ...defaults.autoSell,
      ...input?.autoSell,
      legendary: false,
    },
  };
}

export function inventoryExpansionCost(inventory: Pick<InventoryState, "capacity">): number {
  const config = EQUIPMENT_BALANCE.inventoryExpansion;
  const capacity = normalizeInventoryCapacity(inventory.capacity);
  if (capacity >= config.maxCapacity) {
    return 0;
  }

  const expansionCount = Math.max(
    0,
    Math.floor((capacity - EQUIPMENT_BALANCE.inventoryCapacity) / config.step),
  );
  return Math.floor(config.baseCost * Math.pow(config.costGrowth, expansionCount));
}

export function expandInventory(progress: ProgressState): boolean {
  const config = EQUIPMENT_BALANCE.inventoryExpansion;
  const cost = inventoryExpansionCost(progress.inventory);
  if (cost <= 0 || progress.gold < cost) {
    return false;
  }

  progress.gold -= cost;
  progress.inventory.capacity = Math.min(
    config.maxCapacity,
    normalizeInventoryCapacity(progress.inventory.capacity) + config.step,
  );
  return true;
}

export function createEmptyEquipped(): EquippedItems {
  return {
    weapon: null,
    helmet: null,
    armor: null,
    accessory: null,
  };
}

export function createItemId(inventory: InventoryState): string {
  const id = `itm${inventory.nextItemId}`;
  inventory.nextItemId += 1;
  return id;
}

export function addItemToInventory(progress: ProgressState, item: EquipmentItem): { kept: boolean; soldGold: number } {
  if (shouldAutoSell(progress.inventory.autoSell, item.rarity)) {
    const soldGold = calculateItemValue(item);
    progress.gold += soldGold;
    return { kept: false, soldGold };
  }

  if (progress.inventory.items.length < progress.inventory.capacity) {
    progress.inventory.items.push(cloneItem(item));
    return { kept: true, soldGold: 0 };
  }

  return addWithOverflowSale(progress, item);
}

export function equipItem(progress: ProgressState, player: Player, itemId: string): boolean {
  const index = progress.inventory.items.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return false;
  }

  if (!canClassEquipItem(progress.classId, progress.inventory.items[index])) {
    return false;
  }

  const [item] = progress.inventory.items.splice(index, 1);
  const previous = progress.inventory.equipped[item.slot];
  progress.inventory.equipped[item.slot] = item;

  if (previous) {
    progress.inventory.items.push(previous);
  }

  applyPlayerStats(player, progress);
  return true;
}

export function unequipItem(progress: ProgressState, player: Player, slot: keyof EquippedItems): boolean {
  const item = progress.inventory.equipped[slot];
  if (!item || progress.inventory.items.length >= progress.inventory.capacity) {
    return false;
  }

  progress.inventory.equipped[slot] = null;
  progress.inventory.items.push(item);
  applyPlayerStats(player, progress);
  return true;
}

export function sellInventoryItems(progress: ProgressState, predicate: (item: EquipmentItem) => boolean): number {
  let gold = 0;
  const kept: EquipmentItem[] = [];

  for (const item of progress.inventory.items) {
    if (predicate(item)) {
      gold += calculateItemValue(item);
    } else {
      kept.push(item);
    }
  }

  progress.inventory.items = kept;
  progress.gold += gold;
  return gold;
}

export function sellItem(progress: ProgressState, itemId: string): number {
  const index = progress.inventory.items.findIndex((item) => item.id === itemId);
  if (index < 0 || progress.inventory.items[index].locked) {
    return 0;
  }

  const [item] = progress.inventory.items.splice(index, 1);
  const gold = calculateItemValue(item);
  progress.gold += gold;
  return gold;
}

export function disassembleItems(progress: ProgressState, itemIds: string[]): { crystal: number; itemIds: string[] } {
  const selected = new Set(itemIds);
  const disassembledIds: string[] = [];
  const kept: EquipmentItem[] = [];
  let crystal = 0;

  for (const item of progress.inventory.items) {
    if (selected.has(item.id) && !item.locked) {
      crystal += EQUIPMENT_BALANCE.disassembleCrystalByRarity[item.rarity];
      disassembledIds.push(item.id);
    } else {
      kept.push(item);
    }
  }

  progress.inventory.items = kept;
  progress.crystal += crystal;
  return { crystal, itemIds: disassembledIds };
}

export function sellByRarity(progress: ProgressState, rarity: ItemRarity): number {
  if (rarity === "legendary") {
    return 0;
  }

  return sellInventoryItems(progress, (item) => item.rarity === rarity);
}

export function sellAllUnlocked(progress: ProgressState): number {
  return sellInventoryItems(progress, (item) => item.rarity !== "legendary");
}

export function setAutoSell(progress: ProgressState, rarity: ItemRarity, enabled: boolean): void {
  progress.inventory.autoSell[rarity] = rarity === "legendary" ? false : enabled;
}

export function findItem(progress: ProgressState, itemId: string): { item: EquipmentItem; location: "inventory" | "equipped" } | null {
  const inventoryItem = progress.inventory.items.find((item) => item.id === itemId);
  if (inventoryItem) {
    return { item: inventoryItem, location: "inventory" };
  }

  for (const item of Object.values(progress.inventory.equipped)) {
    if (item?.id === itemId) {
      return { item, location: "equipped" };
    }
  }

  return null;
}

export function cloneInventory(inventory: InventoryState): InventoryState {
  return {
    capacity: inventory.capacity,
    nextItemId: inventory.nextItemId,
    items: inventory.items.map(cloneItem),
    equipped: cloneEquipped(inventory.equipped),
    autoSell: { ...inventory.autoSell },
  };
}

export function bestInventoryItemForSlot(progress: ProgressState, slot: keyof EquippedItems): EquipmentItem | null {
  let best: EquipmentItem | null = null;
  let bestValue = -1;

  for (const item of progress.inventory.items) {
    if (item.slot !== slot) {
      continue;
    }
    if (!canClassEquipItem(progress.classId, item)) {
      continue;
    }
    const value = calculateItemValue(item);
    if (value > bestValue) {
      best = item;
      bestValue = value;
    }
  }

  return best;
}

function addWithOverflowSale(progress: ProgressState, incoming: EquipmentItem): { kept: boolean; soldGold: number } {
  let lowestIndex = -1;
  let lowestValue = calculateItemValue(incoming);

  for (let i = 0; i < progress.inventory.items.length; i += 1) {
    const value = calculateItemValue(progress.inventory.items[i]);
    if (value < lowestValue) {
      lowestIndex = i;
      lowestValue = value;
    }
  }

  if (lowestIndex < 0) {
    progress.gold += lowestValue;
    return { kept: false, soldGold: lowestValue };
  }

  const [sold] = progress.inventory.items.splice(lowestIndex, 1, cloneItem(incoming));
  const soldGold = calculateItemValue(sold);
  progress.gold += soldGold;
  return { kept: true, soldGold };
}

function shouldAutoSell(settings: AutoSellSettings, rarity: ItemRarity): boolean {
  return rarity !== "legendary" && settings[rarity];
}

function normalizeInventoryCapacity(capacity?: number): number {
  const config = EQUIPMENT_BALANCE.inventoryExpansion;
  return Math.max(
    EQUIPMENT_BALANCE.inventoryCapacity,
    Math.min(config.maxCapacity, Math.floor(capacity ?? EQUIPMENT_BALANCE.inventoryCapacity)),
  );
}

function createDefaultAutoSellSettings(): AutoSellSettings {
  return ITEM_RARITIES.reduce((settings, rarity) => {
    settings[rarity] = false;
    return settings;
  }, {} as AutoSellSettings);
}

function normalizeEquipped(input?: Partial<EquippedItems>): EquippedItems {
  const defaults = createEmptyEquipped();
  return {
    weapon: input?.weapon ? cloneItem(input.weapon) : defaults.weapon,
    helmet: input?.helmet ? cloneItem(input.helmet) : defaults.helmet,
    armor: input?.armor ? cloneItem(input.armor) : defaults.armor,
    accessory: input?.accessory ? cloneItem(input.accessory) : defaults.accessory,
  };
}
