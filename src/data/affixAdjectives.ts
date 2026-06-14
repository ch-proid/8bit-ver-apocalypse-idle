import type { ItemRarity } from "../core/types";

export const LOW_RARITY_EQUIPMENT_ADJECTIVES = [
  "녹슨",
  "빛바랜",
  "금이 간",
  "무뎌진",
  "버려진",
  "해진",
  "그을린",
  "얼룩진",
  "메마른",
  "식어버린",
  "잊혀진",
  "헐거운",
  "닳아빠진",
  "이가 나간",
] as const;

export const MID_RARITY_EQUIPMENT_ADJECTIVES = [
  "저주받은",
  "굶주린",
  "피에 젖은",
  "비탄에 잠긴",
  "탐욕스러운",
  "속삭이는",
  "갈망하는",
  "일그러진",
  "흐느끼는",
  "메아리치는",
  "잠식된",
  "핏빛의",
  "차갑게 식은",
  "망령 들린",
  "부정한",
] as const;

export const LEGENDARY_EQUIPMENT_ADJECTIVES = [
  "심연에서 건진",
  "종말을 새긴",
  "신을 잊은",
  "별을 삼킨",
  "멸망을 부르는",
  "죄로 빚은",
  "영겁의",
  "왕을 베었던",
  "재앙의",
  "첫 어둠의",
  "끝을 보는",
] as const;

export const FUN_EQUIPMENT_ADJECTIVES = [
  "수상할 정도로 멀쩡한",
  "주인을 세 번 잃은",
  "중고로 구매한",
  "자꾸 뒤돌아보게 하는",
  "몸보다 머리가 큰",
  "부잣집 도련님의",
] as const;

export const FUN_EQUIPMENT_ADJECTIVE_CHANCE = 0.08;

export function equipmentAdjectivesForRarity(rarity: ItemRarity): readonly string[] {
  if (rarity === "common" || rarity === "magic") {
    return LOW_RARITY_EQUIPMENT_ADJECTIVES;
  }
  if (rarity === "legendary") {
    return LEGENDARY_EQUIPMENT_ADJECTIVES;
  }
  return MID_RARITY_EQUIPMENT_ADJECTIVES;
}
