import { describe, expect, it } from "vitest";
import { GENERAL_AFFIXES } from "../data/affixes";
import { FIXED_DELTA, GOLD_BALANCE, PLAYER_BALANCE } from "../data/balance";
import { generateEquipmentItem } from "./equipment";
import { cubeSynthesize, rerollItemOptions } from "./gold";
import { addItemToInventory, equipItem, setAutoSell } from "./inventory";
import { createDefaultProgress } from "./progression";
import { createRngState } from "./rng";
import { createInitialSimulation } from "./stage";
import { stepSimulation } from "./simulation";
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

    expect(counts.common / 5000).toBeGreaterThan(0.56);
    expect(counts.common / 5000).toBeLessThan(0.64);
    expect(counts.magic / 5000).toBeGreaterThan(0.22);
    expect(counts.magic / 5000).toBeLessThan(0.28);
    expect(counts.rare / 5000).toBeGreaterThan(0.08);
    expect(counts.rare / 5000).toBeLessThan(0.12);
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
    });
    state.progress.inventory.items.push(item);

    const equipped = equipItem(state.progress, state.world.player, item.id);

    expect(equipped).toBe(true);
    expect(state.world.player.attack).toBeGreaterThan(PLAYER_BALANCE.attack);
  });

  it("keeps inventory drops deterministic for the same seed over idle simulation", () => {
    let runA = createInitialSimulation(1, undefined, 20240613);
    let runB = createInitialSimulation(1, undefined, 20240613);

    for (let i = 0; i < 60 * 60; i += 1) {
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
