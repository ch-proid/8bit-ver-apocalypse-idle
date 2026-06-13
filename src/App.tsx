import { useEffect, useMemo, useState } from "react";
import { summonRequirement } from "./core/altar";
import { FIXED_DELTA } from "./data/balance";
import { SURVIVOR_SKINS } from "./data/sprites/survivors";
import { FixedStepLoop } from "./runtime/gameLoop";
import { useGameStore } from "./store/gameStore";
import { GameCanvas } from "./ui/GameCanvas";
import { Hud, type HudPanelId } from "./ui/Hud";
import { SurvivorSprite } from "./ui/SurvivorSprite";

const DEBUG_PANEL_ENABLED = import.meta.env.DEV;
const SKIN_STORAGE_KEY = "skinId";

export default function App() {
  const hydrate = useGameStore((state) => state.hydrate);
  const saveNow = useGameStore((state) => state.saveNow);
  const hydrated = useGameStore((state) => state.hydrated);
  const progress = useGameStore((state) => state.simulation.progress);
  const startCurrentChallenge = useGameStore((state) => state.startCurrentChallenge);
  const [activePanel, setActivePanel] = useState<HudPanelId | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [dmgMode, setDmgMode] = useState(false);
  const [skinSelectOpen, setSkinSelectOpen] = useState(false);
  const [skinId, setSkinId] = useState<string | null>(() => loadSavedSkinId());
  const [selectedSkinIndex, setSelectedSkinIndex] = useState(() => {
    const savedSkinId = loadSavedSkinId();
    return Math.max(0, SURVIVOR_SKINS.findIndex((skin) => skin.id === savedSkinId));
  });

  const bloodRequired = summonRequirement(progress.altar.summonCount);
  const bloodIsFull = progress.altar.blood >= bloodRequired;
  const selectedSkin = useMemo(
    () => SURVIVOR_SKINS[selectedSkinIndex] ?? SURVIVOR_SKINS[0],
    [selectedSkinIndex],
  );
  const currentSkinId = skinId ?? selectedSkin.id;

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

  useEffect(() => {
    if (hydrated && !skinId) {
      setSkinSelectOpen(true);
    }
  }, [hydrated, skinId]);

  const togglePanel = (panel: HudPanelId) => {
    setDebugOpen(false);
    setSkinSelectOpen(false);
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const openAltarPanel = () => {
    setDebugOpen(false);
    setSkinSelectOpen(false);
    setActivePanel((current) => (current === "altar" ? current : "altar"));
  };

  const toggleDebug = () => {
    setActivePanel(null);
    setSkinSelectOpen(false);
    setDebugOpen((value) => !value);
  };

  const pickSkin = () => {
    window.localStorage.setItem(SKIN_STORAGE_KEY, selectedSkin.id);
    setSkinId(selectedSkin.id);
    setSkinSelectOpen(false);
    setActivePanel(null);
  };

  return (
    <main className="app-shell">
      <section className="console" aria-label="Apocalypse Idle">
        <div className="bezel">
          <div className="bezel-top">
            <span className="silk">Apocalypse</span>
            <div className="led-wrap">
              <i className={bloodIsFull ? "led on" : "led"} aria-label="Blood gauge" />
              <button
                type="button"
                id="dmg"
                className={dmgMode ? "dmg-sw on" : "dmg-sw"}
                onClick={() => setDmgMode((value) => !value)}
              >
                DMG
              </button>
            </div>
          </div>
          <div className="screen">
            <GameCanvas dmgMode={dmgMode} />
            <Hud
              activePanel={activePanel}
              currentSkinId={currentSkinId}
              debugOpen={DEBUG_PANEL_ENABLED && debugOpen}
              onOpenSkinSelect={() => {
                setActivePanel(null);
                setDebugOpen(false);
                setSkinSelectOpen(true);
              }}
            />
            {skinSelectOpen ? (
              <SurvivorSelectPanel
                selectedSkinIndex={selectedSkinIndex}
                onSelect={setSelectedSkinIndex}
                onPick={pickSkin}
              />
            ) : null}
          </div>
        </div>

        <div className="deck">
          <div className="tab-btns">
            <TabButton active={activePanel === "stat"} label="STAT" onClick={() => togglePanel("stat")} />
            <TabButton active={activePanel === "gear"} label="GEAR" onClick={() => togglePanel("gear")} />
            <TabButton active={activePanel === "altar"} label="ALTAR" onClick={() => togglePanel("altar")} />
            {DEBUG_PANEL_ENABLED ? (
              <TabButton active={debugOpen} label="DEBUG" onClick={toggleDebug} />
            ) : null}
          </div>
          <div className="pills">
            <PillButton label="SELECT" onClick={openAltarPanel} />
            <PillButton label="START" onClick={startCurrentChallenge} />
          </div>
          <div className="grille" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
        </div>
      </section>
    </main>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <div className={active ? "pbtn on" : "pbtn"}>
      <button type="button" aria-label={label} onClick={onClick} />
      <span>{label}</span>
    </div>
  );
}

function PillButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="pill">
      <button type="button" aria-label={label} onClick={onClick} />
      <span>{label}</span>
    </div>
  );
}

function SurvivorSelectPanel({
  selectedSkinIndex,
  onSelect,
  onPick,
}: {
  selectedSkinIndex: number;
  onSelect: (index: number) => void;
  onPick: () => void;
}) {
  const selectedSkin = SURVIVOR_SKINS[selectedSkinIndex] ?? SURVIVOR_SKINS[0];

  return (
    <section className="panel on survivor-panel" aria-label="Survivor select">
      <div className="win survivor-win">
        <span className="win-t">SURVIVOR</span>
        <div className="survivor-list">
          {SURVIVOR_SKINS.map((skin, index) => (
            <button
              key={skin.id}
              type="button"
              className={index === selectedSkinIndex ? "skin-card on" : "skin-card"}
              onClick={() => onSelect(index)}
            >
              <SurvivorSprite rows={skin.idle} scale={3} />
            </button>
          ))}
        </div>
        <div className="mi survivor-name">
          <span className="cur">&#9654;</span>
          <span className="kr">{selectedSkin.name}</span>
          <span className="dots" />
          <button type="button" className="inv-vid pick-btn" onClick={onPick}>PICK</button>
        </div>
      </div>
    </section>
  );
}

function loadSavedSkinId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(SKIN_STORAGE_KEY);
  return SURVIVOR_SKINS.some((skin) => skin.id === value) ? value : null;
}
