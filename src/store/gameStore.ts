import { create } from "zustand";
import { BOSS_BY_STAGE } from "../data/bosses";
import { ITEM_RARITIES, ITEM_SLOTS } from "../data/items";
import { RELIC_IDS } from "../data/relics";
import { RELICS } from "../data/relics";
import { STAGES } from "../data/stages";
import { ALTAR_BALANCE, EXPERIENCE_CURVE, FIXED_DELTA, nextExperienceForLevel, PHASE_3B_DEBUG, PHASE_3C_DEBUG, PROGRESSION, STANDARD_DUMMY, STAT_GROWTH, TICK_RATE } from "../data/balance";
import { addAltarBlood, altarBloodCapacity, altarStoredCharges, awakenRelic, eliteSummonCost, equipRelic, grantRelic, levelUpAltar, setRelicStarsForDebug } from "../core/altar";
import { triggerAltarCounter } from "../core/boss";
import { cloneClassCombatState } from "../core/class";
import { calculateItemValue, generateEquipmentItem } from "../core/equipment";
import { startAltarEliteEncounter } from "../core/elites";
import { buyShopOffer, reawakenItemOptions, refreshShop } from "../core/gold";
import { addItemToInventory, bestInventoryItemForSlot, createItemId, disassembleItems, equipItem, findItem, sellItem, unequipItem } from "../core/inventory";
import { cloneProgress, gainExperience, updateRecordAt } from "../core/progression";
import { cloneRelicCombatState, relicDebugSnapshot } from "../core/relics";
import { rebirthSimulation, unlockRebirth } from "../core/rebirth";
import { rebirthStatMultiplier } from "../core/rebirthScaling";
import { cloneRngState, createRngState } from "../core/rng";
import { compareEquipmentCombatScore, createBuildSnapshot, simulateStandardDummy, updateDummyScoreRecord } from "../core/sim";
import { createInitialSimulation } from "../core/stage";
import { clearBossStage, clearStage, startStage } from "../core/stageProgress";
import { stepSimulation } from "../core/simulation";
import { accuracyMultiplier } from "../core/combat";
import { applyWeaponUpgrade, equipmentUpgradeCost, upgradeEquipment, upgradeWeapon, weaponUpgradeCost } from "../core/upgrade";
import {
  applyLevelStatPoints,
  applyPlayerStats,
  combatPowerEstimate,
  createRecommendedStatDistribution,
  setStatPreset as setStatDistributionPreset,
  spendStatPoint,
} from "../core/stats";
import type { ClassId, ItemRarity, ItemSlot, RelicId, SimulationState, SinId, StageMode, StatKey, StatPreset } from "../core/types";
import { calculateOfflineReward, deleteSaveGame, loadGame, saveGame, type OfflineReward } from "../save/saveGame";

export type DebugSpeed = 1 | 4 | 16;

interface GameStore {
  simulation: SimulationState;
  hydrated: boolean;
  debugSpeed: DebugSpeed;
  debugLog: string;
  lastOfflineReward: OfflineReward | null;
  tick: (dt: number) => void;
  addGold: (amount: number) => void;
  addExperience: (amount: number) => void;
  setClassId: (classId: ClassId) => void;
  setStatPreset: (preset: StatPreset) => void;
  spendStatPoint: (stat: StatKey) => void;
  equipOrUnequipItem: (itemId: string) => void;
  upgradeEquipmentItem: (itemId: string) => void;
  reawakenEquipmentItem: (itemId: string, selectedGeneralLineIndexes?: number[]) => void;
  sellEquipmentItem: (itemId: string) => void;
  disassembleEquipmentItems: (itemIds: string[]) => void;
  refreshShopNow: () => void;
  buyShopOfferNow: (offerId: string) => void;
  unlockRebirthForDebug: () => void;
  rebirthNow: () => void;
  logPhase3ADemo: () => void;
  equipBestItems: () => void;
  logPhase3BDemo: () => void;
  summonEliteForDebug: () => void;
  summonEliteNow: () => void;
  levelUpAltarNow: () => void;
  awakenRelicNow: (relicId: RelicId, grade: ItemRarity) => void;
  equipRelicForDebug: (relicId: RelicId) => void;
  logPhase3CDemo: () => void;
  logPhase3DDemo: () => void;
  logRework2Demo: () => void;
  setDebugSpeed: (speed: DebugSpeed) => void;
  debugJumpToStage: (stageId: number, mode?: StageMode) => void;
  debugClearCurrentStage: () => void;
  debugSetGold: (amount: number) => void;
  debugGrantLevels: (amount: number) => void;
  debugSetLevel: (level: number) => void;
  debugGrantStatPoints: (amount: number) => void;
  debugRebirthNow: (ignoreGate: boolean) => void;
  debugGenerateItem: (slot: ItemSlot, rarity: ItemRarity) => void;
  debugFillInventory: (rarity: ItemRarity) => void;
  debugUpgradeEquippedWeapon: () => void;
  debugGrantRelic: (relicId: RelicId) => void;
  debugSetRelicStars: (relicId: RelicId, stars: number) => void;
  debugFillBlood: () => void;
  debugToggleBossGate: (sinId: SinId) => void;
  debugTriggerAltarCounter: () => void;
  startCurrentChallenge: () => void;
  debugResetGame: () => Promise<void>;
  debugDumpSaveJson: () => void;
  hydrate: () => Promise<void>;
  saveNow: () => Promise<void>;
}

const initialSimulation = createInitialSimulation(PROGRESSION.initialStageId);

export const useGameStore = create<GameStore>((set, get) => ({
  simulation: initialSimulation,
  hydrated: false,
  debugSpeed: 1,
  debugLog: "",
  lastOfflineReward: null,

  tick: (dt: number) => {
    if (dt <= 0) {
      return;
    }
    set((state) => {
      let simulation = state.simulation;
      for (let i = 0; i < state.debugSpeed; i += 1) {
        simulation = stepSimulation(simulation, dt);
      }
      return { simulation };
    });
  },

  addGold: (amount: number) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        progress: {
          ...state.simulation.progress,
          gold: state.simulation.progress.gold + amount,
        },
      },
    }));
  },

  addExperience: (amount: number) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      gainExperience(simulation.progress, simulation.world, amount);
      return { simulation };
    });
  },

  setClassId: (classId: ClassId) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      simulation.progress.classId = classId;
      simulation.progress.statDistribution = createRecommendedStatDistribution(classId);
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  setStatPreset: (preset: StatPreset) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      simulation.progress.statDistribution = setStatDistributionPreset(simulation.progress.statDistribution, preset);
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  spendStatPoint: (stat: StatKey) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      simulation.progress.statDistribution = spendStatPoint(simulation.progress.statDistribution, stat);
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  equipOrUnequipItem: (itemId: string) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const found = findItem(simulation.progress, itemId);
      if (!found) {
        return state;
      }
      if (found.location === "equipped") {
        unequipItem(simulation.progress, simulation.world.player, found.item.slot);
      } else {
        equipItem(simulation.progress, simulation.world.player, itemId);
      }
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  upgradeEquipmentItem: (itemId: string) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const found = findItem(simulation.progress, itemId);
      if (!found || equipmentUpgradeCost(found.item) <= 0) {
        return state;
      }
      upgradeEquipment(simulation.progress, itemId, simulation.world.rng);
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  reawakenEquipmentItem: (itemId: string, selectedGeneralLineIndexes?: number[]) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      reawakenItemOptions(simulation.progress, itemId, simulation.world.rng, selectedGeneralLineIndexes);
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  sellEquipmentItem: (itemId: string) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      sellItem(simulation.progress, itemId);
      return { simulation };
    });
  },

  disassembleEquipmentItems: (itemIds: string[]) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      disassembleItems(simulation.progress, itemIds);
      return { simulation };
    });
  },

  refreshShopNow: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      refreshShop(simulation.progress, simulation.world.rng, simulation.world.elapsed, false);
      return { simulation };
    });
  },

  buyShopOfferNow: (offerId: string) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      buyShopOffer(simulation.progress, offerId);
      return { simulation };
    });
  },

  unlockRebirthForDebug: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      simulation.progress = unlockRebirth(simulation.progress);
      return { simulation };
    });
  },

  rebirthNow: () => {
    set((state) => ({
      simulation: rebirthSimulation(cloneSimulation(state.simulation), Date.now()),
    }));
  },

  logPhase3ADemo: () => {
    const { progress } = get().simulation;
    const combatPower = combatPowerEstimate(progress);
    const wallLevel = EXPERIENCE_CURVE.firstKneeLevel;
    const nextMultiplier = rebirthStatMultiplier(progress.rebirth.count + 1);
    console.table([
      { checkpoint: `LV ${wallLevel - 1}`, nextExp: nextExperienceForLevel(wallLevel - 1), currentPower: combatPower, nextRebirthStatMultiplier: null },
      { checkpoint: `LV ${wallLevel} WALL`, nextExp: nextExperienceForLevel(wallLevel), currentPower: combatPower, nextRebirthStatMultiplier: null },
      { checkpoint: `LV ${wallLevel + 1} WALL+`, nextExp: nextExperienceForLevel(wallLevel + 1), currentPower: combatPower, nextRebirthStatMultiplier: null },
      {
        checkpoint: "REBIRTH PREVIEW",
        nextExp: nextExperienceForLevel(1),
        currentPower: combatPower,
        nextRebirthStatMultiplier: nextMultiplier,
      },
    ]);
  },

  equipBestItems: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      equipBestBySlot(simulation);
      return { simulation };
    });
  },

  logPhase3BDemo: () => {
    const source = get().simulation;
    let demo = createInitialSimulation(
      source.progress.currentStage,
      cloneProgress(source.progress),
      PHASE_3B_DEBUG.demoSeed,
    );
    const before = {
      atk: demo.world.player.attack,
      def: demo.world.player.defense,
      hp: demo.world.player.maxHp,
      reg: demo.world.player.hpRegen,
      eva: demo.world.player.evasion,
      items: demo.progress.inventory.items.length,
    };

    for (let i = 0; i < PHASE_3B_DEBUG.idleSeconds * TICK_RATE; i += 1) {
      demo = stepSimulation(demo, FIXED_DELTA);
    }

    equipBestBySlot(demo);
    const after = {
      atk: demo.world.player.attack,
      def: demo.world.player.defense,
      hp: demo.world.player.maxHp,
      reg: demo.world.player.hpRegen,
      eva: demo.world.player.evasion,
      items: demo.progress.inventory.items.length,
    };

    console.table([
      { checkpoint: "BEFORE", ...before },
      { checkpoint: "AFTER_60S_EQUIP", ...after },
    ]);
    console.table(demo.progress.inventory.items.map((item) => ({
      id: item.id,
      slot: item.slot,
      rarity: item.rarity,
      level: item.itemLevel,
      value: calculateItemValue(item),
      options: item.options.map((option) => `${option.sin ? "SIN:" : ""}${option.key}+${option.value}`).join(" "),
    })));

    set({ simulation: demo });
  },

  summonEliteForDebug: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      if (altarStoredCharges(simulation.progress.altar) <= 0) {
        simulation.progress.altar.blood = eliteSummonCost(simulation.progress.altar);
      }
      startAltarEliteEncounter(simulation);
      return { simulation };
    });
  },

  summonEliteNow: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      if (altarStoredCharges(simulation.progress.altar) <= 0) {
        return state;
      }
      startAltarEliteEncounter(simulation);
      return { simulation };
    });
  },

  levelUpAltarNow: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      levelUpAltar(simulation.progress.altar);
      return { simulation };
    });
  },

  awakenRelicNow: (relicId: RelicId, grade: ItemRarity) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      awakenRelic(simulation.progress.altar, relicId, grade);
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  equipRelicForDebug: (relicId: RelicId) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      if (!simulation.progress.altar.owned[relicId]) {
        grantRelic(simulation.progress.altar, relicId);
      }
      equipRelic(simulation.progress.altar, relicId);
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  logPhase3CDemo: () => {
    const rows = RELIC_IDS.map((relicId) => {
      let demo = createInitialSimulation(
        get().simulation.progress.currentStage,
        cloneProgress(get().simulation.progress),
        PHASE_3C_DEBUG.demoSeed,
      );
      grantRelic(demo.progress.altar, relicId);
      equipRelic(demo.progress.altar, relicId);
      applyPlayerStats(demo.world.player, demo.progress);

      for (let i = 0; i < PHASE_3C_DEBUG.demoSeconds * TICK_RATE; i += 1) {
        demo = stepSimulation(demo, FIXED_DELTA);
      }

      return {
        build: relicId,
        gold: demo.progress.gold,
        blood: Math.floor(demo.progress.altar.blood),
        ...relicDebugSnapshot(demo.progress, demo.world),
      };
    });
    console.table(rows);
  },

  logPhase3DDemo: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const snapshot = createBuildSnapshot(simulation.progress);
      const result = simulateStandardDummy(snapshot);
      const candidate = simulation.progress.inventory.items[0] ?? generateEquipmentItem({
        id: "phase3d-demo-weapon",
        rng: createRngState(STANDARD_DUMMY.seed),
        stageId: simulation.progress.currentStage,
        rarity: "rare",
        slot: "weapon",
        itemLevel: simulation.progress.currentStage + 4,
      });
      const comparison = compareEquipmentCombatScore(snapshot, candidate);
      updateDummyScoreRecord(simulation.progress, simulation.world, result.combatScore);

      console.table([
        {
          checkpoint: "CURRENT BUILD",
          combatScore: result.combatScore,
          record: simulation.progress.records.dummyScore.value,
          ticks: result.ticks,
        },
        {
          checkpoint: "CANDIDATE EQUIP",
          item: `${candidate.rarity} ${candidate.slot}`,
          combatScore: comparison.candidateScore,
          delta: comparison.delta,
          deltaPercent: `${comparison.deltaPercent.toFixed(2)}%`,
        },
      ]);
      return { simulation };
    });
  },

  logRework2Demo: () => {
    const base = cloneProgress(get().simulation.progress);
    const stage50 = createInitialSimulation(50, base, STANDARD_DUMMY.seed);
    const target = stage50.world.monsters[0];
    const weapon = stage50.progress.inventory.equipped.weapon ?? generateEquipmentItem({
      id: "rework2-demo-weapon",
      rng: createRngState(STANDARD_DUMMY.seed),
      stageId: 1,
      rarity: "common",
      slot: "weapon",
      itemLevel: 1,
    });
    const beforeHit = accuracyMultiplier(weapon.accuracy, target.evasion);
    const upgraded = { ...weapon, options: weapon.options.map((option) => ({ ...option })) };
    for (let i = 0; i < 6; i += 1) {
      applyWeaponUpgrade(upgraded);
    }
    const afterHit = accuracyMultiplier(upgraded.accuracy, target.evasion);
    const classRows = (["assassin", "knight", "mage"] as ClassId[]).map((classId) => {
      const progress = cloneProgress(get().simulation.progress);
      progress.classId = classId;
      return {
        classId,
        combatScore: simulateStandardDummy(createBuildSnapshot(progress), { durationSeconds: 12 }).combatScore,
      };
    });

    console.table([
      {
        checkpoint: "HIGH_STAGE_WEAK_WEAPON",
        stage: 50,
        weaponAcc: weapon.accuracy,
        monsterEva: target.evasion,
        missed: beforeHit.missed,
        hitMultiplier: beforeHit.multiplier.toFixed(2),
      },
      {
        checkpoint: "AFTER_UPGRADE_PREVIEW",
        stage: 50,
        weaponAcc: upgraded.accuracy,
        monsterEva: target.evasion,
        missed: afterHit.missed,
        hitMultiplier: afterHit.multiplier.toFixed(2),
      },
    ]);
    console.table(classRows);
  },

  setDebugSpeed: (speed: DebugSpeed) => {
    set({ debugSpeed: speed });
  },

  debugJumpToStage: (stageId: number, mode?: StageMode) => {
    set((state) => ({
      simulation: rebuildSimulationAtStage(state.simulation, stageId, mode),
    }));
  },

  debugClearCurrentStage: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const stageId = simulation.progress.currentStage;
      if (BOSS_BY_STAGE[stageId]) {
        clearBossStage(simulation.progress, stageId);
      } else {
        clearStage(simulation.progress, stageId);
      }
      return { simulation };
    });
  },

  debugSetGold: (amount: number) => {
    set((state) => ({
      simulation: {
        ...state.simulation,
        progress: {
          ...state.simulation.progress,
          gold: Math.max(0, Math.floor(amount)),
        },
      },
    }));
  },

  debugGrantLevels: (amount: number) => {
    get().debugSetLevel(get().simulation.progress.level + Math.floor(amount));
  },

  debugSetLevel: (level: number) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const nextLevel = Math.max(1, Math.floor(level));
      const currentLevel = simulation.progress.level;
      simulation.progress.level = nextLevel;
      simulation.progress.experience = 0;
      simulation.progress.nextExperience = nextExperienceForLevel(nextLevel);
      if (nextLevel > currentLevel) {
        simulation.progress.statDistribution = applyLevelStatPoints(
          simulation.progress.statDistribution,
          (nextLevel - currentLevel) * STAT_GROWTH.pointsPerLevel,
        );
        updateRecordAt(simulation.progress.records.highestLevel, nextLevel, Date.now());
      }
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  debugGrantStatPoints: (amount: number) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      simulation.progress.statDistribution.unspentPoints = Math.max(
        0,
        simulation.progress.statDistribution.unspentPoints + Math.floor(amount),
      );
      return { simulation };
    });
  },

  debugRebirthNow: (ignoreGate: boolean) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      return {
        simulation: rebirthSimulation(simulation, Date.now(), ignoreGate),
      };
    });
  },

  debugGenerateItem: (slot: ItemSlot, rarity: ItemRarity) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const item = generateEquipmentItem({
        id: createItemId(simulation.progress.inventory),
        rng: simulation.world.rng,
        stageId: simulation.progress.currentStage,
        slot,
        rarity,
      });
      addItemToInventory(simulation.progress, item);
      return { simulation };
    });
  },

  debugFillInventory: (rarity: ItemRarity) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const previousAutoSell = { ...simulation.progress.inventory.autoSell };
      for (const itemRarity of ITEM_RARITIES) {
        simulation.progress.inventory.autoSell[itemRarity] = false;
      }
      while (simulation.progress.inventory.items.length < simulation.progress.inventory.capacity) {
        const item = generateEquipmentItem({
          id: createItemId(simulation.progress.inventory),
          rng: simulation.world.rng,
          stageId: simulation.progress.currentStage,
          slot: ITEM_SLOTS[simulation.progress.inventory.items.length % ITEM_SLOTS.length],
          rarity,
        });
        addItemToInventory(simulation.progress, item);
      }
      simulation.progress.inventory.autoSell = previousAutoSell;
      return { simulation };
    });
  },

  debugUpgradeEquippedWeapon: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      let weapon = simulation.progress.inventory.equipped.weapon;
      if (!weapon) {
        const item = generateEquipmentItem({
          id: createItemId(simulation.progress.inventory),
          rng: simulation.world.rng,
          stageId: simulation.progress.currentStage,
          slot: "weapon",
          rarity: "rare",
        });
        addItemToInventory(simulation.progress, item);
        equipItem(simulation.progress, simulation.world.player, item.id);
        weapon = simulation.progress.inventory.equipped.weapon;
      }
      if (weapon) {
        const cost = weaponUpgradeCost(weapon);
        simulation.progress.gold = Math.max(simulation.progress.gold, cost);
        upgradeWeapon(simulation.progress, weapon.id);
        applyPlayerStats(simulation.world.player, simulation.progress);
      }
      return { simulation };
    });
  },

  debugGrantRelic: (relicId: RelicId) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      grantRelic(simulation.progress.altar, relicId);
      equipRelic(simulation.progress.altar, relicId);
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  debugSetRelicStars: (relicId: RelicId, stars: number) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const nextStars = Math.max(0, Math.min(ALTAR_BALANCE.maxStars, Math.floor(stars)));
      setRelicStarsForDebug(simulation.progress.altar, relicId, nextStars);
      if (nextStars > 0) {
        equipRelic(simulation.progress.altar, relicId);
      }
      applyPlayerStats(simulation.world.player, simulation.progress);
      return { simulation };
    });
  },

  debugFillBlood: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      simulation.progress.altar.blood = altarBloodCapacity(simulation.progress.altar);
      return { simulation };
    });
  },

  debugToggleBossGate: (sinId: SinId) => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      simulation.progress.altar.bossDefeated[sinId] = !simulation.progress.altar.bossDefeated[sinId];
      return { simulation };
    });
  },

  debugTriggerAltarCounter: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      triggerAltarCounter(simulation);
      return { simulation };
    });
  },

  startCurrentChallenge: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const stageId = simulation.progress.currentStage;
      const stage = STAGES[stageId];
      startStage(simulation.progress, stageId, stage?.isBoss ? "boss" : "challenge");
      return {
        simulation: createInitialSimulation(stageId, simulation.progress, simulation.world.rng.seed),
      };
    });
  },

  debugResetGame: async () => {
    await deleteSaveGame();
    set({
      simulation: createInitialSimulation(PROGRESSION.initialStageId),
      lastOfflineReward: null,
      debugLog: "SAVE CLEARED",
    });
  },

  debugDumpSaveJson: () => {
    const dump = JSON.stringify(get().simulation.progress, null, 2);
    console.log(dump);
    set({ debugLog: dump });
  },

  hydrate: async () => {
    const save = await loadGame();
    if (!save) {
      set({ hydrated: true });
      return;
    }

    const reward = calculateOfflineReward(save);
    const progress = {
      ...save.progress,
      gold: save.progress.gold + reward.gold,
      crystal: save.progress.crystal + reward.crystal,
    };
    const simulation = createInitialSimulation(progress.currentStage, progress);
    gainExperience(simulation.progress, simulation.world, reward.experience);
    addAltarBlood(simulation.progress.altar, reward.blood);

    set({
      hydrated: true,
      lastOfflineReward: reward.elapsedSeconds > 1 ? reward : null,
      simulation,
    });
  },

  saveNow: async () => {
    await saveGame(get().simulation.progress);
  },
}));

function cloneSimulation(simulation: SimulationState): SimulationState {
  return {
    progress: cloneProgress(simulation.progress),
    world: {
      ...simulation.world,
      rng: cloneRngState(simulation.world.rng),
      rewardRng: cloneRngState(simulation.world.rewardRng),
      relicCombat: cloneRelicCombatState(simulation.world.relicCombat),
      classCombat: cloneClassCombatState(simulation.world.classCombat),
      altarElite: simulation.world.altarElite ? { ...simulation.world.altarElite } : null,
      boss: simulation.world.boss ? { ...simulation.world.boss } : null,
      wave: simulation.world.wave ? { ...simulation.world.wave } : null,
      platforms: simulation.world.platforms.map((platform) => ({ ...platform })),
      player: {
        ...simulation.world.player,
        position: { ...simulation.world.player.position },
        velocity: { ...simulation.world.player.velocity },
      },
      monsters: simulation.world.monsters.map((monster) => ({
        ...monster,
        position: { ...monster.position },
        spawnPosition: { ...monster.spawnPosition },
        velocity: { ...monster.velocity },
      })),
      floatingTexts: simulation.world.floatingTexts.map((text) => ({
        ...text,
        position: { ...text.position },
      })),
      dropIcons: simulation.world.dropIcons.map((icon) => ({
        ...icon,
        position: { ...icon.position },
      })),
    },
  };
}

function equipBestBySlot(simulation: SimulationState): void {
  const slots: ItemSlot[] = ["weapon", "helmet", "armor", "accessory"];
  for (const slot of slots) {
    const item = bestInventoryItemForSlot(simulation.progress, slot);
    if (item) {
      equipItem(simulation.progress, simulation.world.player, item.id);
    }
  }
}

function rebuildSimulationAtStage(simulation: SimulationState, stageId: number, mode?: StageMode): SimulationState {
  const nextStageId = clampStageId(stageId);
  const progress = cloneProgress(simulation.progress);
  const stage = STAGES[nextStageId];
  progress.stageProgress.unlockedStage = Math.max(progress.stageProgress.unlockedStage, nextStageId);
  startStage(progress, nextStageId, mode ?? (stage.isBoss ? "boss" : "hunt"));
  return createInitialSimulation(nextStageId, progress, simulation.world.rng.seed);
}

function clampStageId(stageId: number): number {
  const safeStageId = Math.max(PROGRESSION.initialStageId, Math.min(Object.keys(STAGES).length, Math.floor(stageId)));
  return STAGES[safeStageId] ? safeStageId : PROGRESSION.initialStageId;
}
