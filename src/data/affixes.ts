import type { GeneralAffixKey, ItemSlot, SinAffixKey } from "../core/types";

export interface GeneralAffixDefinition {
  key: GeneralAffixKey;
  allowedSlots: ItemSlot[];
}

export interface SinAffixDefinition {
  key: SinAffixKey;
  allowedSlots: ItemSlot[];
}

export const GENERAL_AFFIXES: Record<GeneralAffixKey, GeneralAffixDefinition> = {
  attackFlat: { key: "attackFlat", allowedSlots: ["weapon", "accessory"] },
  attackPercent: { key: "attackPercent", allowedSlots: ["weapon", "accessory"] },
  defenseFlat: { key: "defenseFlat", allowedSlots: ["helmet", "armor"] },
  hpFlat: { key: "hpFlat", allowedSlots: ["helmet", "armor", "accessory"] },
  hpRegen: { key: "hpRegen", allowedSlots: ["armor", "accessory"] },
  accuracy: { key: "accuracy", allowedSlots: ["weapon", "accessory"] },
  evasion: { key: "evasion", allowedSlots: ["helmet", "armor", "accessory"] },
  critChance: { key: "critChance", allowedSlots: ["weapon", "accessory"] },
  critDamage: { key: "critDamage", allowedSlots: ["weapon", "accessory"] },
  attackSpeed: { key: "attackSpeed", allowedSlots: ["weapon", "accessory"] },
  damageIncrease: { key: "damageIncrease", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  finalDamage: { key: "finalDamage", allowedSlots: ["weapon", "accessory"] },
  additionalDamage: { key: "additionalDamage", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  defPenetration: { key: "defPenetration", allowedSlots: ["weapon"] },
  lifeSteal: { key: "lifeSteal", allowedSlots: ["weapon", "armor", "accessory"] },
  goldGain: { key: "goldGain", allowedSlots: ["helmet", "armor", "accessory"] },
  experienceGain: { key: "experienceGain", allowedSlots: ["helmet", "armor", "accessory"] },
  damageReduction: { key: "damageReduction", allowedSlots: ["armor"] },
};

export const SIN_AFFIXES: Record<SinAffixKey, SinAffixDefinition> = {
  specterDamage: { key: "specterDamage", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  bloodLeech: { key: "bloodLeech", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  plagueSpread: { key: "plagueSpread", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  martyrPain: { key: "martyrPain", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  executionThreshold: { key: "executionThreshold", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  despairBurst: { key: "despairBurst", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
};
