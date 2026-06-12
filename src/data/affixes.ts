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
  critChance: { key: "critChance", allowedSlots: ["weapon", "accessory"] },
  critDamage: { key: "critDamage", allowedSlots: ["weapon", "accessory"] },
  attackSpeed: { key: "attackSpeed", allowedSlots: ["weapon", "accessory"] },
  damageIncrease: { key: "damageIncrease", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  finalDamage: { key: "finalDamage", allowedSlots: ["weapon", "accessory"] },
  defPenetration: { key: "defPenetration", allowedSlots: ["weapon"] },
  lifeSteal: { key: "lifeSteal", allowedSlots: ["weapon", "armor", "accessory"] },
  goldGain: { key: "goldGain", allowedSlots: ["helmet", "armor", "accessory"] },
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
