import { create } from "zustand";
import { EXPERIENCE_CURVE, nextExperienceForLevel, PROGRESSION } from "../data/balance";
import { gainExperience } from "../core/progression";
import { calculateRebirthExperienceMultiplier, rebirthSimulation, unlockRebirth } from "../core/rebirth";
import { createInitialSimulation } from "../core/stage";
import { stepSimulation } from "../core/simulation";
import { applyPlayerStats, combatPowerEstimate, setStatPreset as setStatDistributionPreset, spendStatPoint } from "../core/stats";
import type { SimulationState, StatKey, StatPreset } from "../core/types";
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
    progress: {
      ...simulation.progress,
      statDistribution: {
        assigned: { ...simulation.progress.statDistribution.assigned },
        unspentPoints: simulation.progress.statDistribution.unspentPoints,
        preset: simulation.progress.statDistribution.preset,
      },
      rebirth: {
        ...simulation.progress.rebirth,
        permanentStats: { ...simulation.progress.rebirth.permanentStats },
      },
      rebirthRecords: simulation.progress.rebirthRecords.map((record) => ({ ...record })),
      records: {
        highestLevel: { ...simulation.progress.records.highestLevel },
        dummyScore: { ...simulation.progress.records.dummyScore },
        highestRebirthStage: { ...simulation.progress.records.highestRebirthStage },
      },
    },
    world: {
      ...simulation.world,
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
