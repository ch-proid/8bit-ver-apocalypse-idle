import type { GeneralAffixKey, ItemSlot, SinAffixKey } from "../core/types";
import { EQUIPMENT_BALANCE } from "./balance";

export type GeneralAffixTier = "surplus" | "main" | "rare" | "ultraRare";

export interface GeneralAffixDefinition {
  key: GeneralAffixKey;
  allowedSlots: ItemSlot[];
  tier: GeneralAffixTier;
}

export interface SinAffixDefinition {
  key: SinAffixKey;
  allowedSlots: ItemSlot[];
}

export const GENERAL_AFFIX_TIER_WEIGHTS = EQUIPMENT_BALANCE.generalAffixTierWeights;

export const GENERAL_AFFIXES: Record<GeneralAffixKey, GeneralAffixDefinition> = {
  attackFlat: { key: "attackFlat", allowedSlots: ["weapon", "accessory"], tier: "main" },
  attackPercent: { key: "attackPercent", allowedSlots: ["weapon", "accessory"], tier: "rare" },
  defenseFlat: { key: "defenseFlat", allowedSlots: ["helmet", "armor"], tier: "surplus" },
  hpFlat: { key: "hpFlat", allowedSlots: ["helmet", "armor", "accessory"], tier: "surplus" },
  hpRegen: { key: "hpRegen", allowedSlots: ["armor", "accessory"], tier: "surplus" },
  accuracy: { key: "accuracy", allowedSlots: ["weapon", "accessory"], tier: "surplus" },
  evasion: { key: "evasion", allowedSlots: ["helmet", "armor", "accessory"], tier: "surplus" },
  moveSpeed: { key: "moveSpeed", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "main" },
  strFlat: { key: "strFlat", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "main" },
  gritFlat: { key: "gritFlat", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "main" },
  agiFlat: { key: "agiFlat", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "main" },
  strPercent: { key: "strPercent", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "ultraRare" },
  gritPercent: { key: "gritPercent", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "ultraRare" },
  agiPercent: { key: "agiPercent", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "ultraRare" },
  critChance: { key: "critChance", allowedSlots: ["weapon", "accessory"], tier: "rare" },
  critDamage: { key: "critDamage", allowedSlots: ["weapon", "accessory"], tier: "ultraRare" },
  attackSpeed: { key: "attackSpeed", allowedSlots: ["weapon", "accessory"], tier: "rare" },
  damageIncrease: { key: "damageIncrease", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "rare" },
  finalDamage: { key: "finalDamage", allowedSlots: ["weapon", "accessory"], tier: "ultraRare" },
  additionalDamage: { key: "additionalDamage", allowedSlots: ["weapon", "helmet", "armor", "accessory"], tier: "main" },
  defPenetration: { key: "defPenetration", allowedSlots: ["weapon"], tier: "main" },
  defPenetrationPercent: { key: "defPenetrationPercent", allowedSlots: ["weapon"], tier: "rare" },
  lifeSteal: { key: "lifeSteal", allowedSlots: ["weapon", "armor", "accessory"], tier: "main" },
  goldGain: { key: "goldGain", allowedSlots: ["helmet", "armor", "accessory"], tier: "main" },
  experienceGain: { key: "experienceGain", allowedSlots: ["helmet", "armor", "accessory"], tier: "ultraRare" },
  damageReduction: { key: "damageReduction", allowedSlots: ["armor"], tier: "surplus" },
};

export const SIN_AFFIXES: Record<SinAffixKey, SinAffixDefinition> = {
  specterDamage: { key: "specterDamage", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  bloodLeech: { key: "bloodLeech", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  plagueSpread: { key: "plagueSpread", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  martyrPain: { key: "martyrPain", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  executionThreshold: { key: "executionThreshold", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
  despairBurst: { key: "despairBurst", allowedSlots: ["weapon", "helmet", "armor", "accessory"] },
};
