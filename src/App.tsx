import { useEffect, useState } from "react";
import { FIXED_DELTA } from "./data/balance";
import { FixedStepLoop } from "./runtime/gameLoop";
import { useGameStore } from "./store/gameStore";
import { GameCanvas } from "./ui/GameCanvas";
import { Hud } from "./ui/Hud";

const DEBUG_PANEL_ENABLED = import.meta.env.DEV || import.meta.env.DEBUG_PANEL === "true";

export default function App() {
  const hydrate = useGameStore((state) => state.hydrate);
  const saveNow = useGameStore((state) => state.saveNow);
  const hydrated = useGameStore((state) => state.hydrated);
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

  return (
    <main className="app-shell">
      <section className="console-shell" aria-label="Apocalypse Idle phase 2 prototype">
        <div className="bezel">
          <div className="bezel-top">
            <span>APOCALYPSE</span>
            <i className={hydrated ? "save-led on" : "save-led"} />
          </div>
          <div className="screen">
            <GameCanvas />
            <Hud debugOpen={DEBUG_PANEL_ENABLED && debugOpen} />
          </div>
        </div>
        <div className="deck">
          <button type="button">STAT</button>
          <button type="button">GEAR</button>
          <button type="button">ALTAR</button>
          {DEBUG_PANEL_ENABLED ? (
            <button type="button" className={debugOpen ? "is-active" : ""} onClick={() => setDebugOpen((value) => !value)}>
              DEBUG
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
