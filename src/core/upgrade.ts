import { EQUIPMENT_BALANCE } from "../data/balance";
import { calculateWeaponCombatStats } from "./equipment";
import { findItem } from "./inventory";
import { chance } from "./rng";
import type { EquipmentItem, ProgressState, RngState } from "./types";

export interface WeaponUpgradeResult {
  success: boolean;
  cost: number;
  upgradeLevel: number;
  failed?: boolean;
  downgraded?: boolean;
}

export function weaponUpgradeCost(item: EquipmentItem): number {
  return equipmentUpgradeCost(item);
}

export function equipmentUpgradeCost(item: EquipmentItem): number {
  if (item.upgradeLevel >= EQUIPMENT_BALANCE.enhancement.maxLevel) {
    return 0;
  }
  return Math.floor(
    EQUIPMENT_BALANCE.enhancement.baseGoldCost
      * Math.pow(EQUIPMENT_BALANCE.enhancement.costGrowth, Math.max(0, item.upgradeLevel)),
  );
}

export function upgradeWeapon(progress: ProgressState, itemId: string, rng?: RngState): WeaponUpgradeResult {
  return upgradeEquipment(progress, itemId, rng);
}

export function upgradeEquipment(progress: ProgressState, itemId: string, rng?: RngState): WeaponUpgradeResult {
  const found = findItem(progress, itemId);
  if (!found) {
    return { success: false, cost: 0, upgradeLevel: 0 };
  }

  if (found.item.upgradeLevel >= EQUIPMENT_BALANCE.enhancement.maxLevel) {
    return { success: false, cost: 0, upgradeLevel: found.item.upgradeLevel };
  }

  const cost = equipmentUpgradeCost(found.item);
  if (progress.gold < cost) {
    return { success: false, cost, upgradeLevel: found.item.upgradeLevel };
  }

  progress.gold -= cost;
  const failChance = equipmentUpgradeFailureChance(found.item);
  if (failChance > 0 && rng && chance(rng, failChance)) {
    found.item.upgradeLevel = Math.max(0, found.item.upgradeLevel - 1);
    refreshWeaponDerivedStats(found.item);
    return { success: false, cost, upgradeLevel: found.item.upgradeLevel, failed: true, downgraded: true };
  }

  applyWeaponUpgrade(found.item);
  return { success: true, cost, upgradeLevel: found.item.upgradeLevel, failed: false, downgraded: false };
}

export function applyWeaponUpgrade(item: EquipmentItem): EquipmentItem {
  item.upgradeLevel = Math.min(
    EQUIPMENT_BALANCE.enhancement.maxLevel,
    Math.max(0, Math.floor(item.upgradeLevel)) + 1,
  );
  refreshWeaponDerivedStats(item);
  return item;
}

export function equipmentUpgradeFailureChance(item: EquipmentItem): number {
  const targetLevel = Math.max(0, Math.floor(item.upgradeLevel)) + 1;
  if (targetLevel < EQUIPMENT_BALANCE.enhancement.failureStartLevel) {
    return 0;
  }

  return Math.min(
    EQUIPMENT_BALANCE.enhancement.failureMaxChance,
    EQUIPMENT_BALANCE.enhancement.failureStartChance
      + (targetLevel - EQUIPMENT_BALANCE.enhancement.failureStartLevel) * EQUIPMENT_BALANCE.enhancement.failureChanceStep,
  );
}

function refreshWeaponDerivedStats(item: EquipmentItem): void {
  if (item.slot !== "weapon") {
    return;
  }

  const stats = calculateWeaponCombatStats(item.slot, item.rarity, item.itemLevel, item.baseValue, item.upgradeLevel);
  item.minDmg = stats.minDmg;
  item.maxDmg = stats.maxDmg;
  item.accuracy = stats.accuracy;
}
