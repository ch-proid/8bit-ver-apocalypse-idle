import type { ClassId, ItemSlot } from "../core/types";

export const EQUIPMENT_ICON_BY_CLASS: Record<ClassId, Record<ItemSlot, string>> = {
  assassin: {
    weapon: "/assets/icons/shotsward.png",
    helmet: "/assets/icons/thief_helmet.png",
    armor: "/assets/icons/thief_armor.gif",
    accessory: "/assets/icons/ring.png",
  },
  knight: {
    weapon: "/assets/icons/Sward.png",
    helmet: "/assets/icons/kinght_helmet.png",
    armor: "/assets/icons/knight_armor.png",
    accessory: "/assets/icons/ring.png",
  },
  mage: {
    weapon: "/assets/icons/wand.png",
    helmet: "/assets/icons/magician_helmet.png",
    armor: "/assets/icons/magician_armor.gif",
    accessory: "/assets/icons/ring.png",
  },
} as const;

export function equipmentIconFor(classId: ClassId, slot: ItemSlot): string {
  return EQUIPMENT_ICON_BY_CLASS[classId][slot];
}
