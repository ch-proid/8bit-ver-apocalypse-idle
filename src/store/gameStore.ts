import { create } from "zustand";
import { RELIC_IDS } from "../data/relics";
import { EXPERIENCE_CURVE, FIXED_DELTA, nextExperienceForLevel, PHASE_3B_DEBUG, PHASE_3C_DEBUG, PROGRESSION, TICK_RATE } from "../data/balance";
import { equipRelic, grantRelic, summonRelic, summonRequirement } from "../core/altar";
import { calculateItemValue } from "../core/equipment";
import { bestInventoryItemForSlot, equipItem } from "../core/inventory";
import { cloneProgress, gainExperience } from "../core/progression";
import { cloneRelicCombatState, relicDebugSnapshot } from "../core/relics";
import { calculateRebirthExperienceMultiplier, rebirthSimulation, unlockRebirth } from "../core/rebirth";
import { cloneRngState } from "../core/rng";
import { createInitialSimulation } from "../core/stage";
import { stepSimulation } from "../core/simulation";
import { applyPlayerStats, combatPowerEstimate, setStatPreset as setStatDistributionPreset, spendStatPoint } from "../core/stats";
import type { ItemSlot, RelicId, SimulationState, StatKey, StatPreset } from "../core/types";
import { calculateOfflineReward, loadGame, saveGame } from "../save/saveGame";

interface GameStore {
  simulation: SimulationState;
  hydrated: boolean;
  lastOfflineReward: { elapsedSeconds: number; gold: number; experience: number } | null;
  tick: (dt: number) => void;
  addGold: (amount: number) => void;
  addExperience: (amount: number) => void;
  setStatPreset: (preset: StatPreset) => void;
  spendStatPoint: (stat: StatKey) => void;
  unlockRebirthForDebug: () => void;
  rebirthNow: () => void;
  logPhase3ADemo: () => void;
  equipBestItems: () => void;
  logPhase3BDemo: () => void;
  summonRelicForDebug: () => void;
  equipRelicForDebug: (relicId: RelicId) => void;
  logPhase3CDemo: () => void;
  hydrate: () => Promise<void>;
  saveNow: () => Promise<void>;
}

const initialSimulation = createInitialSimulation(PROGRESSION.initialStageId);

export const useGameStore = create<GameStore>((set, get) => ({
  simulation: initialSimulation,
  hydrated: false,
  lastOfflineReward: null,

  tick: (dt: number) => {
    if (dt <= 0) {
      return;
    }
    set((state) => ({
      simulation: stepSimulation(state.simulation, dt),
    }));
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
    const nextMultiplier = calculateRebirthExperienceMultiplier(wallLevel, combatPower, progress.rebirth.count + 1);
    console.table([
      { checkpoint: `LV ${wallLevel - 1}`, nextExp: nextExperienceForLevel(wallLevel - 1), effectiveNextAfterRebirth: null },
      { checkpoint: `LV ${wallLevel} WALL`, nextExp: nextExperienceForLevel(wallLevel), effectiveNextAfterRebirth: null },
      { checkpoint: `LV ${wallLevel + 1} WALL+`, nextExp: nextExperienceForLevel(wallLevel + 1), effectiveNextAfterRebirth: null },
      {
        checkpoint: "REBIRTH PREVIEW",
        nextExp: nextExperienceForLevel(1),
        effectiveNextAfterRebirth: Math.ceil(nextExperienceForLevel(1) / nextMultiplier),
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

  summonRelicForDebug: () => {
    set((state) => {
      const simulation = cloneSimulation(state.simulation);
      const required = summonRequirement(simulation.progress.altar.summonCount);
      if (simulation.progress.altar.blood < required) {
        simulation.progress.altar.blood = required;
      }
      summonRelic(simulation.progress.altar, simulation.world.rng);
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
    };
    const simulation = createInitialSimulation(progress.currentStage, progress);
    gainExperience(simulation.progress, simulation.world, reward.experience);

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
      relicCombat: cloneRelicCombatState(simulation.world.relicCombat),
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
