import { useEffect, useMemo, useState } from "react";
import { eliteSummonCost } from "./core/altar";
import type { ClassId } from "./core/types";
import { FIXED_DELTA } from "./data/balance";
import { SURVIVOR_SKINS } from "./data/sprites/survivors";
import { FixedStepLoop } from "./runtime/gameLoop";
import { useGameStore } from "./store/gameStore";
import { GameCanvas } from "./ui/GameCanvas";
import { Hud, type HudPanelId } from "./ui/Hud";
import { SurvivorSprite } from "./ui/SurvivorSprite";

const DEBUG_PANEL_ENABLED = import.meta.env.DEV;
const CLASS_STORAGE_KEY = "classId";
const CLASS_KR_LABELS: Record<ClassId, string> = {
  assassin: "암살자",
  knight: "기사",
  mage: "마법사",
};
const CLASS_STYLE_LINES: Record<ClassId, string> = {
  assassin: "치명·회피 성장",
  knight: "방어·체력 성장",
  mage: "원거리·도트 성장",
};
const CLASS_PASSIVE_LINES: Record<ClassId, string> = {
  assassin: "치명 상한 100% / 기본 치명 강화",
  knight: "저체력 추가 피해 / 방어력 공격 전환",
  mage: "공격 시 체력 비례 지속 피해",
};
const CLASS_RECOMMEND_LINES: Record<ClassId, string> = {
  assassin: "힘 3 / 민첩 2",
  knight: "힘 3 / 근성 2",
  mage: "힘 3 / 근성 2",
};

export default function App() {
  const hydrate = useGameStore((state) => state.hydrate);
  const saveNow = useGameStore((state) => state.saveNow);
  const hydrated = useGameStore((state) => state.hydrated);
  const progress = useGameStore((state) => state.simulation.progress);
  const setClassId = useGameStore((state) => state.setClassId);
  const [activePanel, setActivePanel] = useState<HudPanelId | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [dmgMode, setDmgMode] = useState(false);
  const [classSelectOpen, setClassSelectOpen] = useState(false);
  const [savedClassId, setSavedClassId] = useState<ClassId | null>(() => loadSavedClassId());
  const [selectedClassIndex, setSelectedClassIndex] = useState(() => {
    const storedClassId = loadSavedClassId();
    return Math.max(0, SURVIVOR_SKINS.findIndex((skin) => skin.id === storedClassId));
  });

  const bloodRequired = eliteSummonCost(progress.altar);
  const bloodIsFull = progress.altar.blood >= bloodRequired;
  const selectedClass = useMemo(
    () => SURVIVOR_SKINS[selectedClassIndex] ?? SURVIVOR_SKINS[0],
    [selectedClassIndex],
  );
  const currentClassId = progress.classId;

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
    if (hydrated && savedClassId) {
      setClassId(savedClassId);
    }
  }, [hydrated, savedClassId, setClassId]);

  useEffect(() => {
    if (hydrated && !savedClassId) {
      setClassSelectOpen(true);
    }
  }, [hydrated, savedClassId]);

  const togglePanel = (panel: HudPanelId) => {
    setDebugOpen(false);
    setClassSelectOpen(false);
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const toggleDebug = () => {
    setActivePanel(null);
    setClassSelectOpen(false);
    setDebugOpen((value) => !value);
  };

  const pickClass = () => {
    window.localStorage.setItem(CLASS_STORAGE_KEY, selectedClass.id);
    setSavedClassId(selectedClass.id);
    setClassId(selectedClass.id);
    setClassSelectOpen(false);
    setActivePanel(null);
  };

  return (
    <main className="app-shell">
      <section className="console" aria-label="Apocalypse Idle">
        <div className="bezel">
          <div className="bezel-top">
            <span className="silk">Apocalypse</span>
            <div className="led-wrap">
              <i className={bloodIsFull ? "led on" : "led"} aria-label="피 게이지" />
              <button
                type="button"
                id="dmg"
                className={dmgMode ? "dmg-sw on" : "dmg-sw"}
                onClick={() => setDmgMode((value) => !value)}
              >
                흑백
              </button>
            </div>
          </div>
          <div className="screen">
            <GameCanvas dmgMode={dmgMode} />
            <Hud
              activePanel={activePanel}
              currentClassId={currentClassId}
              debugOpen={DEBUG_PANEL_ENABLED && debugOpen}
              onOpenClassSelect={() => {
                setActivePanel(null);
                setDebugOpen(false);
                setClassSelectOpen(true);
              }}
            />
            {classSelectOpen ? (
              <ClassSelectPanel
                selectedClassIndex={selectedClassIndex}
                onSelect={setSelectedClassIndex}
                onPick={pickClass}
              />
            ) : null}
          </div>
        </div>

        <div className="deck">
          <div className="tab-btns">
            <TabButton active={activePanel === "stat"} label="스탯" onClick={() => togglePanel("stat")} />
            <TabButton active={activePanel === "gear"} label="장비" onClick={() => togglePanel("gear")} />
            <TabButton active={activePanel === "altar"} label="제단" onClick={() => togglePanel("altar")} />
            {DEBUG_PANEL_ENABLED ? (
              <TabButton active={debugOpen} label="개발" onClick={toggleDebug} />
            ) : null}
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

function ClassSelectPanel({
  selectedClassIndex,
  onSelect,
  onPick,
}: {
  selectedClassIndex: number;
  onSelect: (index: number) => void;
  onPick: () => void;
}) {
  const selectedClass = SURVIVOR_SKINS[selectedClassIndex] ?? SURVIVOR_SKINS[0];
  return (
    <section className="panel on survivor-panel" aria-label="직업 선택">
      <div className="win survivor-win">
        <span className="win-t">직업 선택</span>
        <div className="survivor-list">
          {SURVIVOR_SKINS.map((skin, index) => (
            <button
              key={skin.id}
              type="button"
              className={index === selectedClassIndex ? "skin-card on" : "skin-card"}
              onClick={() => onSelect(index)}
            >
              <SurvivorSprite skin={skin} scale={2} />
              <b className="kr">{CLASS_KR_LABELS[skin.id]}</b>
              <small className="kr">{CLASS_STYLE_LINES[skin.id]}</small>
            </button>
          ))}
        </div>
        <div className="class-brief">
          <div className="mi">
            <span>직업</span>
            <span className="dots" />
            <span className="v kr">{CLASS_KR_LABELS[selectedClass.id]}</span>
          </div>
          <div className="mi">
            <span>패시브</span>
            <span className="dots" />
            <span className="v thin kr">{CLASS_PASSIVE_LINES[selectedClass.id]}</span>
          </div>
          <div className="mi">
            <span>추천</span>
            <span className="dots" />
            <span className="v kr">{CLASS_RECOMMEND_LINES[selectedClass.id]}</span>
          </div>
        </div>
        <div className="mi survivor-name">
          <span className="cur">&#9654;</span>
          <span className="kr">{CLASS_KR_LABELS[selectedClass.id]}</span>
          <span className="dots" />
          <button type="button" className="inv-vid pick-btn" onClick={onPick}>선택</button>
        </div>
      </div>
    </section>
  );
}

function loadSavedClassId(): ClassId | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(CLASS_STORAGE_KEY);
  return SURVIVOR_SKINS.some((skin) => skin.id === value) ? value as ClassId : null;
}
