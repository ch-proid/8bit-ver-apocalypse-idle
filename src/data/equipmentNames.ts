import type { ClassId, EquipmentKind, ItemRarity, ItemSlot, WeaponType } from "../core/types";

export const EQUIPMENT_RARITY_NAME_PREFIX: Record<ItemRarity, string> = {
  common: "일반",
  magic: "마법",
  rare: "희귀",
  epic: "영웅",
  legendary: "전설",
};

export const EQUIPMENT_NAME_ADJECTIVES = [
  "낡은",
  "비뚤어진",
  "날카로운",
  "그을린",
  "묵직한",
  "수상한",
  "끈질긴",
  "불길한",
  "번쩍이는",
  "허세 가득한",
  "겁나 튼튼한",
  "잠 덜 깬",
] as const;

export const WEAPON_TYPES: readonly WeaponType[] = ["dagger", "sword", "greatsword", "staff"];

export const WEAPON_TYPE_CLASS_ALLOWLIST: Record<ClassId, readonly WeaponType[]> = {
  assassin: ["dagger"],
  knight: ["sword", "greatsword"],
  mage: ["staff"],
};

export const EQUIPMENT_SLOT_KIND_POOL: Record<ItemSlot, readonly EquipmentKind[]> = {
  weapon: WEAPON_TYPES,
  helmet: ["helmet", "hood", "hat", "cap"],
  armor: ["armor", "leather", "robe", "cuirass"],
  accessory: ["ring"],
};

export const EQUIPMENT_KIND_LABELS: Record<EquipmentKind, string> = {
  dagger: "단검",
  sword: "검",
  greatsword: "대검",
  staff: "지팡이",
  helmet: "헬멧",
  hood: "후드",
  hat: "모자",
  cap: "투구",
  armor: "갑옷",
  leather: "가죽옷",
  robe: "로브",
  cuirass: "흉갑",
  ring: "반지",
};

export const EQUIPMENT_SLOT_NAME_POOL: Record<ItemSlot, readonly string[]> = {
  weapon: WEAPON_TYPES.map((kind) => EQUIPMENT_KIND_LABELS[kind]),
  helmet: EQUIPMENT_SLOT_KIND_POOL.helmet.map((kind) => EQUIPMENT_KIND_LABELS[kind]),
  armor: EQUIPMENT_SLOT_KIND_POOL.armor.map((kind) => EQUIPMENT_KIND_LABELS[kind]),
  accessory: EQUIPMENT_SLOT_KIND_POOL.accessory.map((kind) => EQUIPMENT_KIND_LABELS[kind]),
};
