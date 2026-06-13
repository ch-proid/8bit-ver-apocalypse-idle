import { useEffect, useState } from "react";
import { FIXED_DELTA } from "./data/balance";
import { FixedStepLoop } from "./runtime/gameLoop";
import { useGameStore } from "./store/gameStore";
import { GameCanvas } from "./ui/GameCanvas";
import { Hud, type HudPanelId } from "./ui/Hud";

const DEBUG_PANEL_ENABLED = import.meta.env.DEV || import.meta.env.DEBUG_PANEL === "true";

export default function App() {
  const hydrate = useGameStore((state) => state.hydrate);
  const saveNow = useGameStore((state) => state.saveNow);
  const hydrated = useGameStore((state) => state.hydrated);
  const [activePanel, setActivePanel] = useState<HudPanelId | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const loop = new FixedStepLoop(FIXED_DELTA, (dt) => {
      if (dt > 0) {
        useGameStore.getState().tick(dt);
      }
    });
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void saveNow();
    }, 5000);
    return () => window.clearInterval(id);
  }, [saveNow]);

  const togglePanel = (panel: HudPanelId) => {
    setDebugOpen(false);
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const toggleDebug = () => {
    setActivePanel(null);
    setDebugOpen((value) => !value);
  };

  return (
    <main className="app-shell">
      <section className="console-shell" aria-label="Apocalypse Idle phase 2 prototype">
        <div className="bezel">
          <div className="bezel-top">
            <span>APOCALYPSE</span>
            <i className={hydrated ? "save-led on" : "save-led"} />
          </div>
          <div className="screen">
            <Hud activePanel={activePanel} debugOpen={DEBUG_PANEL_ENABLED && debugOpen} />
            <GameCanvas />
          </div>
        </div>
        <div className="deck">
          <button type="button" className={activePanel === "stat" ? "is-active" : ""} onClick={() => togglePanel("stat")}>
            STAT
          </button>
          <button type="button" className={activePanel === "gear" ? "is-active" : ""} onClick={() => togglePanel("gear")}>
            GEAR
          </button>
          <button type="button" className={activePanel === "altar" ? "is-active" : ""} onClick={() => togglePanel("altar")}>
            ALTAR
          </button>
          {DEBUG_PANEL_ENABLED ? (
            <button type="button" className={debugOpen ? "is-active" : ""} onClick={toggleDebug}>
              DEBUG
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
