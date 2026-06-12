import { create } from "zustand";
import { createInitialSimulation } from "../core/stage";
import { stepSimulation } from "../core/simulation";
import type { ProgressState, SimulationState } from "../core/types";
import { calculateOfflineReward, loadGame, saveGame } from "../save/saveGame";

interface GameStore {
  simulation: SimulationState;
  hydrated: boolean;
  lastOfflineReward: { elapsedSeconds: number; gold: number; experience: number } | null;
  tick: (dt: number) => void;
  addGold: (amount: number) => void;
  hydrate: () => Promise<void>;
  saveNow: () => Promise<void>;
}

const initialSimulation = createInitialSimulation(1);

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

  hydrate: async () => {
    const save = await loadGame();
    if (!save) {
      set({ hydrated: true });
      return;
    }

    const reward = calculateOfflineReward(save);
    const simulation = createInitialSimulation(save.progress.currentStage);
    const progress: ProgressState = {
      ...save.progress,
      gold: save.progress.gold + reward.gold,
      experience: save.progress.experience + reward.experience,
    };

    set({
      hydrated: true,
      lastOfflineReward: reward.elapsedSeconds > 1 ? reward : null,
      simulation: {
        ...simulation,
        progress,
      },
    });
  },

  saveNow: async () => {
    await saveGame(get().simulation.progress);
  },
}));
