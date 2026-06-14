import { useState } from "react";
import type { ReactNode } from "react";
import { ITEM_RARITIES, ITEM_SLOTS } from "../data/items";
import { RELIC_IDS, RELICS } from "../data/relics";
import { DEBUG_GRANTS } from "../data/balance";
import { CLASS_IDS, PLAYER_CLASSES } from "../data/classes";
import { useGameStore, type DebugSpeed } from "../store/gameStore";
import type { BossCombatState, ClassId, ItemRarity, ItemSlot, RelicId, SinId } from "../core/types";
import { formatDuration, formatNumber } from "./format";

const BOSS_STAGE_IDS = [10, 20, 30, 40, 50, 60];
const SPEEDS: DebugSpeed[] = [1, 4, 16];
const SIN_IDS: SinId[] = ["pride", "gluttony", "grief", "fanaticism", "abyss", "despair"];

interface DebugPanelProps {
  open: boolean;
}

export function DebugPanel({ open }: DebugPanelProps) {
  const progress = useGameStore((state) => state.simulation.progress);
  const bossState = useGameStore((state) => state.simulation.world.boss);
  const debugSpeed = useGameStore((state) => state.debugSpeed);
  const debugLog = useGameStore((state) => state.debugLog);
  const offlineReward = useGameStore((state) => state.lastOfflineReward);
  const addGold = useGameStore((state) => state.addGold);
  const addExperience = useGameStore((state) => state.addExperience);
  const saveNow = useGameStore((state) => state.saveNow);
  const setDebugSpeed = useGameStore((state) => state.setDebugSpeed);
  const debugJumpToStage = useGameStore((state) => state.debugJumpToStage);
  const debugClearCurrentStage = useGameStore((state) => state.debugClearCurrentStage);
  const debugSetGold = useGameStore((state) => state.debugSetGold);
  const debugGrantLevels = useGameStore((state) => state.debugGrantLevels);
  const debugSetLevel = useGameStore((state) => state.debugSetLevel);
  const debugGrantStatPoints = useGameStore((state) => state.debugGrantStatPoints);
  const debugRebirthNow = useGameStore((state) => state.debugRebirthNow);
  const debugGenerateItem = useGameStore((state) => state.debugGenerateItem);
  const debugFillInventory = useGameStore((state) => state.debugFillInventory);
  const debugUpgradeEquippedWeapon = useGameStore((state) => state.debugUpgradeEquippedWeapon);
  const debugGrantRelic = useGameStore((state) => state.debugGrantRelic);
  const debugSetRelicStars = useGameStore((state) => state.debugSetRelicStars);
  const debugFillBlood = useGameStore((state) => state.debugFillBlood);
  const debugToggleBossGate = useGameStore((state) => state.debugToggleBossGate);
  const debugTriggerAltarCounter = useGameStore((state) => state.debugTriggerAltarCounter);
  const debugResetGame = useGameStore((state) => state.debugResetGame);
  const debugDumpSaveJson = useGameStore((state) => state.debugDumpSaveJson);
  const logPhase3ADemo = useGameStore((state) => state.logPhase3ADemo);
  const logPhase3BDemo = useGameStore((state) => state.logPhase3BDemo);
  const logPhase3CDemo = useGameStore((state) => state.logPhase3CDemo);
  const logPhase3DDemo = useGameStore((state) => state.logPhase3DDemo);
  const logRework2Demo = useGameStore((state) => state.logRework2Demo);
  const equipBestItems = useGameStore((state) => state.equipBestItems);
  const summonEliteForDebug = useGameStore((state) => state.summonEliteForDebug);
  const setClassId = useGameStore((state) => state.setClassId);
  const setStatPreset = useGameStore((state) => state.setStatPreset);
  const spendStatPoint = useGameStore((state) => state.spendStatPoint);

  const [stageInput, setStageInput] = useState(String(progress.currentStage));
  const [chapterInput, setChapterInput] = useState("1");
  const [chapterStageInput, setChapterStageInput] = useState("1");
  const [amountInput, setAmountInput] = useState(String(DEBUG_GRANTS.gold));
  const [slot, setSlot] = useState<ItemSlot>("weapon");
  const [rarity, setRarity] = useState<ItemRarity>("rare");
  const [relicId, setRelicId] = useState<RelicId>("specterLord");
  const [relicStars, setRelicStars] = useState("3");
  const [ignoreGate, setIgnoreGate] = useState(true);

  if (!open) {
    return null;
  }

  const amount = Math.max(0, Math.floor(Number(amountInput) || 0));
  const targetStage = Math.max(1, Math.min(60, Math.floor(Number(stageInput) || 1)));
  const chapterStage = Math.max(
    1,
    Math.min(60, (Math.max(1, Math.min(6, Math.floor(Number(chapterInput) || 1))) - 1) * 10
      + Math.max(1, Math.min(10, Math.floor(Number(chapterStageInput) || 1)))),
  );

  return (
    <section className="debug-panel" aria-label="Debug tools">
      <div className="debug-header">
        <strong>DEBUG</strong>
        <span>ST {progress.currentStage} / UNL {progress.stageProgress.unlockedStage}</span>
        <span>ALV {progress.altar.level}</span>
        <span>SPD x{debugSpeed}</span>
        <span>{bossStatusLabel(bossState)}</span>
        {offlineReward ? (
          <span>
            AFK {formatDuration(offlineReward.elapsedSeconds)}
            {" "}+{formatNumber(offlineReward.gold)}G
            {" "}+{formatNumber(offlineReward.crystal)}C
            {" "}+{formatNumber(offlineReward.blood)}B
          </span>
        ) : null}
      </div>

      <DebugSection title="Progress">
        <label>
          ST
          <input value={stageInput} onChange={(event) => setStageInput(event.target.value)} inputMode="numeric" />
        </label>
        <button type="button" onClick={() => debugJumpToStage(targetStage)}>
          JUMP
        </button>
        <button type="button" onClick={() => debugJumpToStage(Math.max(1, progress.currentStage - 1))}>
          PREV
        </button>
        <button type="button" onClick={() => debugJumpToStage(Math.min(60, progress.currentStage + 1))}>
          NEXT
        </button>
        <button type="button" onClick={debugClearCurrentStage}>
          CLEAR
        </button>
        <label>
          C
          <input value={chapterInput} onChange={(event) => setChapterInput(event.target.value)} inputMode="numeric" />
        </label>
        <label>
          S
          <input value={chapterStageInput} onChange={(event) => setChapterStageInput(event.target.value)} inputMode="numeric" />
        </label>
        <button type="button" onClick={() => debugJumpToStage(chapterStage)}>
          C/S
        </button>
        {BOSS_STAGE_IDS.map((stageId) => (
          <button key={stageId} type="button" onClick={() => debugJumpToStage(stageId, "boss")}>
            B{stageId / 10}
          </button>
        ))}
      </DebugSection>

      <DebugSection title="Growth">
        <label>
          AMT
          <input value={amountInput} onChange={(event) => setAmountInput(event.target.value)} inputMode="numeric" />
        </label>
        <button type="button" onClick={() => addGold(amount)}>
          +G
        </button>
        <button type="button" onClick={() => debugSetGold(amount)}>
          SET G
        </button>
        <button type="button" onClick={() => addExperience(amount)}>
          +EXP
        </button>
        <button type="button" onClick={() => debugGrantLevels(amount)}>
          +LV
        </button>
        <button type="button" onClick={() => debugSetLevel(amount)}>
          SET LV
        </button>
        <button type="button" onClick={() => debugGrantStatPoints(amount)}>
          +PT
        </button>
        <select value={progress.classId} onChange={(event) => setClassId(event.target.value as ClassId)}>
          {CLASS_IDS.map((classId) => (
            <option key={classId} value={classId}>{PLAYER_CLASSES[classId].label}</option>
          ))}
        </select>
        <button type="button" onClick={() => setStatPreset("STR")}>
          STR
        </button>
        <button type="button" onClick={() => setStatPreset("BAL")}>
          BAL
        </button>
        <button type="button" onClick={() => setStatPreset("GRIT")}>
          GRT
        </button>
        <button type="button" onClick={() => setStatPreset("AGI")}>
          AGI
        </button>
        <button type="button" onClick={() => setStatPreset("MANUAL")}>
          MAN
        </button>
        <button type="button" onClick={() => spendStatPoint("str")}>
          +S
        </button>
        <button type="button" onClick={() => spendStatPoint("grit")}>
          +GRT
        </button>
        <button type="button" onClick={() => spendStatPoint("agi")}>
          +AGI
        </button>
        <label className="debug-check">
          <input type="checkbox" checked={ignoreGate} onChange={(event) => setIgnoreGate(event.target.checked)} />
          IGNORE
        </label>
        <button type="button" onClick={() => debugRebirthNow(ignoreGate)}>
          RB
        </button>
      </DebugSection>

      <DebugSection title="Items / Relics">
        <select value={slot} onChange={(event) => setSlot(event.target.value as ItemSlot)}>
          {ITEM_SLOTS.map((itemSlot) => (
            <option key={itemSlot} value={itemSlot}>{itemSlot}</option>
          ))}
        </select>
        <select value={rarity} onChange={(event) => setRarity(event.target.value as ItemRarity)}>
          {ITEM_RARITIES.map((itemRarity) => (
            <option key={itemRarity} value={itemRarity}>{itemRarity}</option>
          ))}
        </select>
        <button type="button" onClick={() => debugGenerateItem(slot, rarity)}>
          ITEM
        </button>
        <button type="button" onClick={() => debugFillInventory(rarity)}>
          FILL
        </button>
        <button type="button" onClick={equipBestItems}>
          EQUIP
        </button>
        <button type="button" onClick={debugUpgradeEquippedWeapon}>
          WPN+
        </button>
        <select value={relicId} onChange={(event) => setRelicId(event.target.value as RelicId)}>
          {RELIC_IDS.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <button type="button" onClick={() => debugGrantRelic(relicId)}>
          RELIC
        </button>
        <button type="button" onClick={summonEliteForDebug}>
          ELITE
        </button>
        <label>
          STAR
          <input value={relicStars} onChange={(event) => setRelicStars(event.target.value)} inputMode="numeric" />
        </label>
        <button type="button" onClick={() => debugSetRelicStars(relicId, Number(relicStars))}>
          SET
        </button>
        <button type="button" onClick={debugFillBlood}>
          BLOOD
        </button>
        <button type="button" onClick={debugTriggerAltarCounter}>
          CTR
        </button>
      </DebugSection>

      <DebugSection title="Boss Gates">
        {SIN_IDS.map((sinId) => (
          <button
            key={sinId}
            type="button"
            className={progress.altar.bossDefeated[sinId] ? "is-on" : ""}
            onClick={() => debugToggleBossGate(sinId)}
          >
            {sinLabel(sinId)}
          </button>
        ))}
      </DebugSection>

      <DebugSection title="State / Speed">
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={debugSpeed === speed ? "is-on" : ""}
            onClick={() => setDebugSpeed(speed)}
          >
            x{speed}
          </button>
        ))}
        <button type="button" onClick={() => void saveNow()}>
          SAVE
        </button>
        <button type="button" onClick={debugDumpSaveJson}>
          DUMP
        </button>
        <button type="button" onClick={logPhase3ADemo}>
          LOG3A
        </button>
        <button type="button" onClick={logPhase3BDemo}>
          LOG3B
        </button>
        <button type="button" onClick={logPhase3CDemo}>
          LOG3C
        </button>
        <button type="button" onClick={logPhase3DDemo}>
          CP
        </button>
        <button type="button" onClick={logRework2Demo}>
          R2
        </button>
        <button type="button" className="danger" onClick={() => void debugResetGame()}>
          RESET
        </button>
      </DebugSection>

      <textarea readOnly value={debugLog} aria-label="Save JSON dump" />
    </section>
  );
}

function DebugSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="debug-section">
      <legend>{title}</legend>
      <div className="debug-grid">{children}</div>
    </fieldset>
  );
}

function sinLabel(sinId: SinId): string {
  const relic = RELIC_IDS.find((id) => RELICS[id].sin === sinId);
  return relic ? sinId.slice(0, 3).toUpperCase() : sinId;
}

function bossStatusLabel(boss: BossCombatState | null): string {
  if (!boss) {
    return "BOSS NONE";
  }
  if (boss.isTelegraphing) {
    return `TEL ${boss.telegraphTimer.toFixed(1)}`;
  }
  if (boss.isWeakened) {
    return `WEAK ${boss.weakenTimer.toFixed(1)}`;
  }
  if (boss.isEnraged) {
    return `ENR ${boss.enrageTimer.toFixed(1)}`;
  }
  if (boss.playerMarked) {
    return "MARK";
  }
  return boss.lastEvent ?? boss.bossId.toUpperCase();
}
