import { describe, expect, it } from "vitest";
import { GENERAL_AFFIXES } from "../data/affixes";
import { EQUIPMENT_BALANCE, FIXED_DELTA, GOLD_BALANCE, PLAYER_BALANCE } from "../data/balance";
import {
  calculateCombatAffixStats,
  calculateEquipmentStats,
  canClassEquipItem,
  equipmentBaseStatRows,
  equipmentDisplayName,
  generateEquipmentItem,
  rarityWeightsForStage,
} from "./equipment";
import { equipmentDropChance } from "./drop";
import { buyShopOffer, canRefreshShop, cubeSynthesize, refreshShop, reawakenItemOptions, reawakeningCost, rerollItemOptions, shopRefreshRemainingSeconds } from "./gold";
import { addItemToInventory, disassembleItems, equipItem, setAutoSell } from "./inventory";
import { createDefaultProgress } from "./progression";
import { createRngState } from "./rng";
import { createInitialSimulation } from "./stage";
import { stepSimulation } from "./simulation";
import { equipmentUpgradeFailureChance, upgradeEquipment, upgradeWeapon, weaponUpgradeCost } from "./upgrade";
import type { EquipmentItem, GeneralAffixKey, ItemRarity, ItemSlot, ProgressState } from "./types";

describe("phase 3B equipment, drops, and gold", () => {
  it("rolls option line counts by rarity and always gives legendary a SIN option", () => {
    const rng = createRngState(11);
    const cases: Array<[ItemRarity, number]> = [
      ["common", 0],
      ["magic", 1],
      ["rare", 2],
      ["legendary", 5],
    ];

    for (const [rarity, totalOptions] of cases) {
      const item = generateEquipmentItem({ id: rarity, rng, stageId: 1, rarity, slot: "weapon" });
      expect(item.options).toHaveLength(totalOptions);
    }

    const legendary = generateEquipmentItem({ id: "legendary", rng, stageId: 1, rarity: "legendary", slot: "weapon" });
    expect(legendary.options.filter((option) => option.sin)).toHaveLength(1);
  });

  it("gives epic items SIN options at about the configured 30 percent rate", () => {
    const rng = createRngState(42);
    let sinCount = 0;

    for (let i = 0; i < 1000; i += 1) {
      const item = generateEquipmentItem({ id: `epic${i}`, rng, stageId: 1, rarity: "epic", slot: "weapon" });
      if (item.options.some((option) => option.sin)) {
        sinCount += 1;
      }
    }

    expect(sinCount / 1000).toBeGreaterThan(0.25);
    expect(sinCount / 1000).toBeLessThan(0.35);
  });

  it("keeps general affixes inside each slot restriction", () => {
    const rng = createRngState(77);
    const slots: ItemSlot[] = ["weapon", "helmet", "armor", "accessory"];

    for (const slot of slots) {
      for (let i = 0; i < 50; i += 1) {
        const item = generateEquipmentItem({ id: `${slot}${i}`, rng, stageId: 1, rarity: "legendary", slot });
        for (const option of item.options.filter((line) => !line.sin)) {
          const key = option.key as GeneralAffixKey;
          expect(GENERAL_AFFIXES[key].allowedSlots).toContain(slot);
        }
      }
    }
  });

  it("approximates chapter one rarity weights with a fixed seed", () => {
    const rng = createRngState(123);
    const counts: Record<ItemRarity, number> = {
      common: 0,
      magic: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };

    for (let i = 0; i < 5000; i += 1) {
      const item = generateEquipmentItem({ id: `drop${i}`, rng, stageId: 1 });
      counts[item.rarity] += 1;
    }

    expect(counts.common / 5000).toBeGreaterThan(0.74);
    expect(counts.common / 5000).toBeLessThan(0.82);
    expect(counts.magic / 5000).toBeGreaterThan(0.14);
    expect(counts.magic / 5000).toBeLessThan(0.2);
    expect(counts.rare / 5000).toBeGreaterThan(0.025);
    expect(counts.rare / 5000).toBeLessThan(0.055);
  });

  it("generates and preserves deterministic Korean equipment names", () => {
    const rng = createRngState(2026);
    const item = generateEquipmentItem({
      id: "named",
      rng,
      stageId: 3,
      rarity: "rare",
      slot: "armor",
      kind: "robe",
    });

    expect(item.name).toMatch(/^희귀의 .+ 로브$/);
    expect(equipmentDisplayName({ ...item, name: undefined })).toBe("희귀의 로브");
    expect(equipmentDisplayName(item)).toBe(item.name);
  });

  it("uses the revised base stat package for each equipment slot", () => {
    const rng = createRngState(208);
    const weapon = generateEquipmentItem({ id: "base-weapon", rng, stageId: 1, rarity: "rare", slot: "weapon", itemLevel: 5, kind: "dagger" });
    const helmet = generateEquipmentItem({ id: "base-helmet", rng, stageId: 1, rarity: "rare", slot: "helmet", itemLevel: 5 });
    const armor = generateEquipmentItem({ id: "base-armor", rng, stageId: 1, rarity: "rare", slot: "armor", itemLevel: 5 });
    const ring = generateEquipmentItem({ id: "base-ring", rng, stageId: 1, rarity: "rare", slot: "accessory", itemLevel: 5 });
    const equipped = { weapon, helmet, armor, accessory: ring };
    const directStats = calculateEquipmentStats(equipped);
    const combatStats = calculateCombatAffixStats(equipped);

    expect(equipmentBaseStatRows(weapon).map((row) => row.key)).toEqual(["atk", "accuracy"]);
    expect(equipmentBaseStatRows(helmet).map((row) => row.key)).toEqual(["def"]);
    expect(equipmentBaseStatRows(armor).map((row) => row.key)).toEqual(["hp", "reg"]);
    expect(equipmentBaseStatRows(ring).map((row) => row.key)).toEqual(["atk", "critChance"]);
    expect(directStats.atk).toBeGreaterThan(0);
    expect(directStats.def).toBeGreaterThan(0);
    expect(directStats.hp).toBeGreaterThan(0);
    expect(directStats.reg).toBeGreaterThan(0);
    expect(combatStats.critChance).toBeGreaterThan(0);
  });

  it("drops every weapon type but only equips the current class allowlist", () => {
    const rng = createRngState(209);
    const dagger = generateEquipmentItem({ id: "dagger", rng, stageId: 1, rarity: "rare", slot: "weapon", kind: "dagger" });
    const sword = generateEquipmentItem({ id: "sword", rng, stageId: 1, rarity: "rare", slot: "weapon", kind: "sword" });
    const greatsword = generateEquipmentItem({ id: "greatsword", rng, stageId: 1, rarity: "rare", slot: "weapon", kind: "greatsword" });
    const staff = generateEquipmentItem({ id: "staff", rng, stageId: 1, rarity: "rare", slot: "weapon", kind: "staff" });
    const state = createInitialSimulation(1);
    state.progress.classId = "assassin";
    state.progress.inventory.items = [staff, dagger];

    expect(canClassEquipItem("assassin", dagger)).toBe(true);
    expect(canClassEquipItem("assassin", staff)).toBe(false);
    expect(canClassEquipItem("knight", sword)).toBe(true);
    expect(canClassEquipItem("knight", greatsword)).toBe(true);
    expect(canClassEquipItem("mage", staff)).toBe(true);
    expect(equipItem(state.progress, state.world.player, staff.id)).toBe(false);
    expect(state.progress.inventory.items.some((item) => item.id === staff.id)).toBe(true);
  });

  it("refreshes shop twice per day and buys deterministic offers", () => {
    const progress = createProgressWithGold(100000);
    const rng = createRngState(334);

    expect(refreshShop(progress, rng, 0, false)).toBe(true);
    expect(progress.shop.offers).toHaveLength(GOLD_BALANCE.shopSlots);
    expect(progress.shop.offers.every((offer) => Boolean(offer.item.name))).toBe(true);
    expect(canRefreshShop(progress, GOLD_BALANCE.shopFreeRefreshSeconds - 1)).toBe(false);
    expect(shopRefreshRemainingSeconds(progress, GOLD_BALANCE.shopFreeRefreshSeconds - 1)).toBe(1);
    expect(refreshShop(progress, rng, GOLD_BALANCE.shopFreeRefreshSeconds - 1, false)).toBe(false);
    expect(refreshShop(progress, rng, GOLD_BALANCE.shopFreeRefreshSeconds, false)).toBe(true);

    const offer = progress.shop.offers[0];
    const bought = buyShopOffer(progress, offer.id);

    expect(bought).toBe(true);
    expect(progress.inventory.items.some((item) => item.id === offer.item.id)).toBe(true);
    expect(progress.shop.offers.some((entry) => entry.id === offer.id)).toBe(false);
  });

  it("raises equipment drop chance and high-rarity relative weights with stage and rebirth", () => {
    const early = createDefaultProgress();
    const late = createDefaultProgress();
    late.currentStage = 60;
    late.rebirth.count = 4;

    const earlyWeights = rarityWeightsForStage(1, 0);
    const lateWeights = rarityWeightsForStage(late.currentStage, late.rebirth.count);
    const highShare = (weights: Record<ItemRarity, number>) => (
      (weights.rare + weights.epic + weights.legendary)
      / Object.values(weights).reduce((sum, value) => sum + value, 0)
    );

    expect(equipmentDropChance(late)).toBeGreaterThan(equipmentDropChance(early));
    expect(equipmentDropChance(late)).toBeLessThanOrEqual(EQUIPMENT_BALANCE.dropChance.max);
    expect(highShare(lateWeights)).toBeGreaterThan(highShare(earlyWeights));
    expect(lateWeights.legendary / lateWeights.common).toBeGreaterThan(earlyWeights.legendary / earlyWeights.common);
  });

  it("cubes three items of one rarity into one higher-rarity item", () => {
    const progress = createProgressWithGold(0);
    const rng = createRngState(5);
    progress.inventory.items = [
      makeItem("a", "common"),
      makeItem("b", "common"),
      makeItem("c", "common"),
    ];

    const result = cubeSynthesize(progress, "common", rng);

    expect(result?.rarity).toBe("magic");
    expect(progress.inventory.items).toHaveLength(1);
    expect(progress.inventory.items[0].rarity).toBe("magic");
  });

  it("rerolls only general options and preserves SIN options", () => {
    const progress = createProgressWithGold(1000);
    const rng = createRngState(99);
    const item = generateEquipmentItem({
      id: "sin-item",
      rng,
      stageId: 1,
      rarity: "legendary",
      slot: "weapon",
    });
    const sinBefore = item.options.filter((option) => option.sin);
    progress.inventory.items.push(item);

    const result = rerollItemOptions(progress, item.id, rng);
    const rerolled = progress.inventory.items[0];

    expect(result).toEqual({ success: true, cost: GOLD_BALANCE.rerollBaseCost });
    expect(rerolled.options.filter((option) => option.sin)).toEqual(sinBefore);
    expect(rerolled.options.filter((option) => !option.sin)).toHaveLength(4);
    expect(progress.reroll.countsByItemId[item.id]).toBe(1);
  });

  it("auto-sells configured rarities and sells the lowest-value item when full", () => {
    const progress = createProgressWithGold(0);
    const low = makeItem("low", "common");
    const high = makeItem("high", "rare");
    const incoming = makeItem("incoming", "magic");
    progress.inventory.capacity = 2;
    progress.inventory.items = [low, high];

    const overflow = addItemToInventory(progress, incoming);

    expect(overflow.kept).toBe(true);
    expect(progress.inventory.items.map((item) => item.id).sort()).toEqual(["high", "incoming"]);
    expect(progress.gold).toBeGreaterThan(0);

    setAutoSell(progress, "common", true);
    const autoSold = addItemToInventory(progress, makeItem("auto", "common"));
    expect(autoSold.kept).toBe(false);
    expect(progress.inventory.items.map((item) => item.id).sort()).toEqual(["high", "incoming"]);
  });

  it("updates player stats immediately when equipment changes", () => {
    const state = createInitialSimulation(1);
    const item = generateEquipmentItem({
      id: "weapon",
      rng: state.world.rng,
      stageId: 1,
      rarity: "rare",
      slot: "weapon",
      itemLevel: 3,
      kind: "sword",
    });
    state.progress.inventory.items.push(item);

    const equipped = equipItem(state.progress, state.world.player, item.id);

    expect(equipped).toBe(true);
    expect(state.world.player.attack).toBeGreaterThan(PLAYER_BALANCE.attack);
  });

  it("upgrades the same weapon cumulatively with higher accuracy and damage range", () => {
    const progress = createProgressWithGold(10000);
    const weapon = generateEquipmentItem({
      id: "upgrade",
      rng: createRngState(90),
      stageId: 10,
      rarity: "rare",
      slot: "weapon",
      itemLevel: 10,
    });
    progress.inventory.items.push(weapon);
    const beforeCost = weaponUpgradeCost(weapon);
    const before = { min: weapon.minDmg, max: weapon.maxDmg, accuracy: weapon.accuracy };

    const result = upgradeWeapon(progress, weapon.id);

    expect(result.success).toBe(true);
    expect(result.cost).toBe(beforeCost);
    expect(weapon.upgradeLevel).toBe(1);
    expect(weapon.minDmg).toBeGreaterThanOrEqual(before.min);
    expect(weapon.maxDmg).toBeGreaterThan(before.max);
    expect(weapon.accuracy).toBeGreaterThan(before.accuracy);
    expect(progress.gold).toBe(10000 - beforeCost);
  });

  it("upgrades equipment to 15 max and can downgrade on high-level failure without destroying it", () => {
    const progress = createProgressWithGold(100000);
    const armor = generateEquipmentItem({
      id: "armor-upgrade",
      rng: createRngState(12),
      stageId: 4,
      rarity: "rare",
      slot: "armor",
      itemLevel: 4,
    });
    armor.upgradeLevel = 9;
    progress.inventory.items.push(armor);

    const failChance = equipmentUpgradeFailureChance(armor);
    const result = upgradeEquipment(progress, armor.id, createRngState(1972));

    expect(failChance).toBe(EQUIPMENT_BALANCE.enhancement.failureStartChance);
    expect(result.failed).toBe(true);
    expect(result.downgraded).toBe(true);
    expect(armor.upgradeLevel).toBe(8);

    armor.upgradeLevel = EQUIPMENT_BALANCE.enhancement.maxLevel;
    const capped = upgradeEquipment(progress, armor.id, createRngState(1));
    expect(capped.success).toBe(false);
    expect(armor.upgradeLevel).toBe(EQUIPMENT_BALANCE.enhancement.maxLevel);
  });

  it("reawakens selected general options with gold and crystal while preserving SIN lines", () => {
    const progress = createProgressWithGold(10000);
    progress.crystal = 100;
    const rng = createRngState(99);
    const item = generateEquipmentItem({
      id: "reawaken",
      rng,
      stageId: 1,
      rarity: "legendary",
      slot: "weapon",
    });
    progress.inventory.items.push(item);
    const sinBefore = item.options.filter((option) => option.sin);
    const generalBefore = item.options.filter((option) => !option.sin).map((option) => ({ ...option }));
    const allCost = reawakeningCost(item, generalBefore.length);
    const pinpointCost = reawakeningCost(item, 1);

    const result = reawakenItemOptions(progress, item.id, rng, [0]);
    const generalAfter = item.options.filter((option) => !option.sin);

    expect(pinpointCost.gold).toBeGreaterThan(allCost.gold);
    expect(pinpointCost.crystal).toBeGreaterThan(allCost.crystal);
    expect(result.success).toBe(true);
    expect(progress.gold).toBe(10000 - pinpointCost.gold);
    expect(progress.crystal).toBe(100 - pinpointCost.crystal);
    expect(item.options.filter((option) => option.sin)).toEqual(sinBefore);
    expect(generalAfter).toHaveLength(generalBefore.length);
    expect(generalAfter[1]).toEqual(generalBefore[1]);
  });

  it("disassembles selected unlocked inventory items into crystal and skips locked items", () => {
    const progress = createProgressWithGold(0);
    const common = makeItem("dust-common", "common");
    const rare = makeItem("dust-rare", "rare");
    const locked = makeItem("locked", "legendary");
    locked.locked = true;
    progress.inventory.items = [common, rare, locked];

    const result = disassembleItems(progress, [common.id, rare.id, locked.id]);

    expect(result.itemIds.sort()).toEqual([common.id, rare.id].sort());
    expect(result.crystal).toBe(
      EQUIPMENT_BALANCE.disassembleCrystalByRarity.common
        + EQUIPMENT_BALANCE.disassembleCrystalByRarity.rare,
    );
    expect(progress.crystal).toBe(result.crystal);
    expect(progress.inventory.items.map((item) => item.id)).toEqual([locked.id]);
  });

  it("keeps inventory drops deterministic for the same seed over idle simulation", () => {
    let runA = createInitialSimulation(1, undefined, 39);
    let runB = createInitialSimulation(1, undefined, 39);
    runA.world.player.attack = 999;
    runA.world.player.attackCooldown = 0.05;
    runB.world.player.attack = 999;
    runB.world.player.attackCooldown = 0.05;

    for (let i = 0; i < 60 * 300; i += 1) {
      runA = stepSimulation(runA, FIXED_DELTA);
      runB = stepSimulation(runB, FIXED_DELTA);
    }

    expect(runA.progress.inventory.items.length).toBeGreaterThan(0);
    expect(runA.progress.inventory.items).toEqual(runB.progress.inventory.items);
  });
});

function createProgressWithGold(gold: number): ProgressState {
  const progress = createDefaultProgress(1);
  progress.gold = gold;
  return progress;
}

function makeItem(id: string, rarity: ItemRarity): EquipmentItem {
  const rng = createRngState(id.length + rarity.length);
  return generateEquipmentItem({
    id,
    rng,
    stageId: 1,
    rarity,
    slot: "weapon",
    itemLevel: 1,
  });
}
