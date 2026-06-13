import { EQUIPMENT_BALANCE } from "../data/balance";
import { calculateWeaponCombatStats } from "./equipment";
import { findItem } from "./inventory";
import type { EquipmentItem, ProgressState } from "./types";

export interface WeaponUpgradeResult {
  success: boolean;
  cost: number;
  upgradeLevel: number;
}

export function weaponUpgradeCost(item: EquipmentItem): number {
  if (item.slot !== "weapon") {
    return 0;
  }

  return Math.floor(
    EQUIPMENT_BALANCE.weaponUpgrade.baseCost
      * Math.pow(EQUIPMENT_BALANCE.weaponUpgrade.costGrowth, Math.max(0, item.upgradeLevel)),
  );
}

export function upgradeWeapon(progress: ProgressState, itemId: string): WeaponUpgradeResult {
  const found = findItem(progress, itemId);
  if (!found || found.item.slot !== "weapon") {
    return { success: false, cost: 0, upgradeLevel: 0 };
  }

  const cost = weaponUpgradeCost(found.item);
  if (progress.gold < cost) {
    return { success: false, cost, upgradeLevel: found.item.upgradeLevel };
  }

  progress.gold -= cost;
  applyWeaponUpgrade(found.item);
  return { success: true, cost, upgradeLevel: found.item.upgradeLevel };
}

export function applyWeaponUpgrade(item: EquipmentItem): EquipmentItem {
  if (item.slot !== "weapon") {
    return item;
  }

  item.upgradeLevel = Math.max(0, Math.floor(item.upgradeLevel)) + 1;
  const stats = calculateWeaponCombatStats(item.slot, item.rarity, item.itemLevel, item.baseValue, item.upgradeLevel);
  item.minDmg = stats.minDmg;
  item.maxDmg = stats.maxDmg;
  item.accuracy = stats.accuracy;
  return item;
}
