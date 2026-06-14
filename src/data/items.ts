import type { EquipmentStatKey, ItemRarity, ItemSlot } from "../core/types";

export const ITEM_SLOTS: ItemSlot[] = ["weapon", "helmet", "armor", "accessory"];
export const ITEM_RARITIES: ItemRarity[] = ["common", "magic", "rare", "epic", "legendary"];

export const ITEM_SLOT_BASE_STAT: Record<ItemSlot, EquipmentStatKey> = {
  weapon: "atk",
  helmet: "def",
  armor: "hp",
  accessory: "atk",
};

export const NEXT_RARITY: Partial<Record<ItemRarity, ItemRarity>> = {
  common: "magic",
  magic: "rare",
  rare: "epic",
  epic: "legendary",
};
