import type { ItemRarity, ItemSlot } from "../core/types";

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

export const EQUIPMENT_SLOT_NAME_POOL: Record<ItemSlot, readonly string[]> = {
  weapon: ["검", "단검", "지팡이", "도끼"],
  helmet: ["헬멧", "후드", "모자", "투구"],
  armor: ["갑옷", "가죽옷", "로브", "흉갑"],
  accessory: ["반지", "부적", "목걸이", "인장"],
};
