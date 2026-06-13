import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  altarExperienceForLevel,
  bestRelicInstance,
  calculateRelicOwnedStats,
  eliteSummonCost,
  highestRelicGrade,
  ownedRelicStyleCount,
  relicStars,
} from "../core/altar";
import { altarElitePreview } from "../core/elites";
import { compareEquipmentCombatScore, createBuildSnapshot, type EquipmentScoreComparison } from "../core/sim";
import type { ClassId, EquipmentItem, EquipmentStatKey, ItemRarity, ItemSlot, ProgressState, RelicGrade, RelicId, StageFailureReport, StatKey } from "../core/types";
import { ALTAR_BALANCE } from "../data/balance";
import { ITEM_SLOTS } from "../data/items";
import { PLAYER_CLASSES } from "../data/classes";
import { RELIC_GRADES, RELIC_IDS, RELICS } from "../data/relics";
import { SURVIVOR_SKINS } from "../data/sprites/survivors";
import { useGameStore } from "../store/gameStore";
import { DebugPanel } from "./DebugPanel";
import { formatDuration, formatNumber } from "./format";
import { SurvivorSprite } from "./SurvivorSprite";

export type HudPanelId = "stat" | "gear" | "altar";

interface HudProps {
  activePanel: HudPanelId | null;
  currentClassId: ClassId;
  debugOpen: boolean;
  onOpenClassSelect: () => void;
}

const STAT_KEYS: StatKey[] = ["str", "grit", "agi"];
const STAT_LABELS: Record<StatKey, string> = {
  str: "STR",
  grit: "GRIT",
  agi: "AGI",
};
const DEFAULT_NICKNAME = "SURVIVOR"; // TODO(Profile): replace when nickname storage exists.
const CLASS_KR_LABELS: Record<ClassId, string> = {
  assassin: "암살자",
  knight: "기사",
  mage: "마법사",
};
const RELIC_KR_LABELS: Record<RelicId, string> = {
  specterLord: "망령 군주",
  bloodBerserker: "피의 광전사",
  plagueDoctor: "역병 의사",
  martyr: "순교자",
  executioner: "처형자",
  kingsShadow: "왕의 그림자",
};
const SIN_KR_LABELS: Record<string, string> = {
  pride: "오만",
  gluttony: "탐식",
  grief: "비탄",
  fanaticism: "광신",
  abyss: "심연",
  despair: "절망",
};

interface EquipmentPopupState {
  candidate: EquipmentItem;
  current: EquipmentItem | null;
  comparison: EquipmentScoreComparison;
}

export function Hud({ activePanel, currentClassId, debugOpen, onOpenClassSelect }: HudProps) {
  const progress = useGameStore((state) => state.simulation.progress);
  const player = useGameStore((state) => state.simulation.world.player);
  const world = useGameStore((state) => state.simulation.world);
  const offlineReward = useGameStore((state) => state.lastOfflineReward);
  const spendPoint = useGameStore((state) => state.spendStatPoint);
  const setPreset = useGameStore((state) => state.setStatPreset);
  const equipBestItems = useGameStore((state) => state.equipBestItems);
  const summonEliteNow = useGameStore((state) => state.summonEliteNow);
  const levelUpAltarNow = useGameStore((state) => state.levelUpAltarNow);
  const rebirthNow = useGameStore((state) => state.rebirthNow);
  const expPercent = percent(progress.experience, progress.nextExperience);
  const bloodRequired = eliteSummonCost(progress.altar);
  const altarNextExperience = altarExperienceForLevel(progress.altar.level);
  const bloodPercent = percent(progress.altar.blood, bloodRequired);
  const altarExperiencePercent = percent(progress.altar.experience, altarNextExperience);
  const chapter = Math.ceil(progress.currentStage / 10);
  const stageInChapter = ((progress.currentStage - 1) % 10) + 1;
  const skin = SURVIVOR_SKINS.find((entry) => entry.id === currentClassId) ?? SURVIVOR_SKINS[0];
  const classDef = PLAYER_CLASSES[currentClassId];
  const highlightedItem = progress.inventory.equipped.weapon
    ?? progress.inventory.equipped.armor
    ?? progress.inventory.equipped.helmet
    ?? progress.inventory.equipped.accessory
    ?? progress.inventory.items[0]
    ?? null;
  const elitePreview = altarElitePreview(progress.altar.level);
  const nextElitePreview = altarElitePreview(progress.altar.level + 1);
  const relicOwnedStats = calculateRelicOwnedStats(progress.altar);
  const equippedRelic = bestRelicInstance(progress.altar, progress.altar.equippedRelicId);
  const [equipmentPopup, setEquipmentPopup] = useState<EquipmentPopupState | null>(null);
  const [dismissedFailureKey, setDismissedFailureKey] = useState<string | null>(null);
  const [claimedOfflineKey, setClaimedOfflineKey] = useState<string | null>(null);
  const [voiceLine, setVoiceLine] = useState<string | null>(null);
  const [flashKind, setFlashKind] = useState<string | null>(null);
  const previousFx = useRef({
    initialized: false,
    altarEliteActive: false,
    legendaryItems: 0,
    highRelics: 0,
  });
  const failure = progress.stageProgress.lastFailure;
  const failureKey = failure ? `${failure.stageId}:${failure.reason}:${failure.recommendedStage}` : null;
  const offlineKey = offlineReward
    ? `${Math.floor(offlineReward.elapsedSeconds)}:${offlineReward.gold}:${offlineReward.experience}`
    : null;
  const showFailurePopup = Boolean(failure && failureKey !== dismissedFailureKey);
  const showOfflinePopup = Boolean(offlineReward && offlineKey !== claimedOfflineKey);
  const isOverdrive = world.relicCombat.isOverdrive;
  const isTelegraphing = Boolean(world.boss?.isTelegraphing);

  useEffect(() => {
    if (!flashKind) {
      return;
    }

    const timeoutId = window.setTimeout(() => setFlashKind(null), 620);
    return () => window.clearTimeout(timeoutId);
  }, [flashKind]);

  useEffect(() => {
    if (!voiceLine) {
      return;
    }

    const timeoutId = window.setTimeout(() => setVoiceLine(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [voiceLine]);

  useEffect(() => {
    const altarEliteActive = Boolean(world.altarElite);
    const legendaryItems = countLegendaryItems(progress);
    const highRelics = countHighGradeRelics(progress);
    const previous = previousFx.current;

    if (!previous.initialized) {
      previousFx.current = { initialized: true, altarEliteActive, legendaryItems, highRelics };
      return;
    }

    if (!previous.altarEliteActive && altarEliteActive) {
      triggerFlash("altar", "제단이 깨어났다.");
    } else if (previous.altarEliteActive && !altarEliteActive) {
      triggerFlash("reward", "엘리트가 쓰러졌다.");
    }

    if (legendaryItems > previous.legendaryItems) {
      triggerFlash("legendary", "전리품이 빛난다.");
    }

    if (highRelics > previous.highRelics) {
      triggerFlash("relic", "유물이 응답했다.");
    }

    previousFx.current = { initialized: true, altarEliteActive, legendaryItems, highRelics };
  }, [progress, world.altarElite]);

  function triggerFlash(kind: string, line: string): void {
    setFlashKind(kind);
    setVoiceLine(line);
  }

  function openEquipmentPopup(item: EquipmentItem): void {
    setEquipmentPopup({
      candidate: item,
      current: progress.inventory.equipped[item.slot],
      comparison: compareEquipmentCombatScore(createBuildSnapshot(progress), item),
    });
  }

  return (
    <>
      <div className="lcd-hud" aria-label="Stage summary">
        <span className="char-status">
          <span className="char-face"><SurvivorSprite skin={skin} scale={0.5} /></span>
          <span className="char-level">LV {progress.level}</span>
          <span className="char-name kr">{DEFAULT_NICKNAME}</span>
        </span>
        <span className="stage-label">STAGE {chapter}-{stageInChapter}</span>
        <IconValue type="gold" value={formatNumber(progress.gold)} />
      </div>
      <div className="lcd-exp" aria-label="Experience">
        <GbBar value={expPercent} tone="xp" />
        <b>{expPercent}%</b>
      </div>

      <Panel open={activePanel === "stat"} label="STAT">
        <div className="statbar rich">
          <span className="mini-class">
            <SurvivorSprite skin={skin} scale={0.45} />
            <b>{classDef.label}</b>
          </span>
          <span>LV {progress.level}</span>
          <span>CP {formatNumber(progress.records.dummyScore.value)}</span>
          <IconValue type="gold" value={formatNumber(progress.gold)} />
        </div>

        <Win title="STATUS">
          <div className="status-head">
            <button type="button" className="skin-mini" onClick={onOpenClassSelect} aria-label="CLASS">
              <SurvivorSprite skin={skin} scale={1} />
            </button>
            <div className="status-lines">
              <MenuItem label="CLASS" value={<span className="kr">{CLASS_KR_LABELS[currentClassId]}</span>} />
              <MenuItem label="PASS" value={classDef.passive.description} valueClassName="thin" />
              <MenuItem label="EXP" value={`${expPercent}%`}>
                <GbBar value={expPercent} tone="xp" />
              </MenuItem>
            </div>
          </div>

          <div className="stat-rows">
            {STAT_KEYS.map((key) => (
              <MenuItem
                key={key}
                label={STAT_LABELS[key]}
                value={formatNumber(progress.statDistribution.assigned[key])}
                action={(
                  <button
                    type="button"
                    className="pbox add"
                    disabled={progress.statDistribution.unspentPoints <= 0}
                    onClick={() => spendPoint(key)}
                    aria-label={`ADD ${STAT_LABELS[key]}`}
                  >
                    +
                  </button>
                )}
              />
            ))}
          </div>

          <div className="derived-grid">
            <MenuItem label="ATK" value={formatNumber(player.attack)} />
            <MenuItem label="DEF" value={formatNumber(player.defense)} />
            <MenuItem label="EVA" value={formatNumber(player.evasion)} />
            <MenuItem label="HP" value={formatNumber(player.maxHp)} />
          </div>

          <div className="preset-row">
            <span className="cur">&#9654;</span>
            <button
              type="button"
              className="pbox rec"
              onClick={() => setPreset(classDef.recommendedPreset)}
            >
              REC
            </button>
            {(["STR", "BAL", "GRIT", "AGI", "MANUAL"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={progress.statDistribution.preset === preset ? "pbox on" : "pbox"}
                onClick={() => setPreset(preset)}
              >
                {preset === "MANUAL" ? "MAN" : preset === "GRIT" ? "GRT" : preset}
              </button>
            ))}
            <span className="dots" />
            <span>PT {progress.statDistribution.unspentPoints}</span>
          </div>
        </Win>

        <Win title="REBIRTH">
          <MenuItem label="MULT" value={`x${progress.rebirth.experienceMultiplier.toFixed(2)}`} valueClassName="bloodc" />
          <MenuItem label="RUN" value={progress.rebirth.count} />
          <button
            type="button"
            className={progress.rebirth.canRebirth ? "inv-vid" : "inv-vid off"}
            disabled={!progress.rebirth.canRebirth}
            onClick={rebirthNow}
          >
            <span className="cur">&#9654;</span>REBIRTH
          </button>
        </Win>

        <Win title="RECORD">
          <MenuItem label="LV" value={progress.records.highestLevel.value} />
          <MenuItem label="CP" value={formatNumber(progress.records.dummyScore.value)} />
          <MenuItem label="RE" value={progress.records.highestRebirthStage.value} />
        </Win>
      </Panel>

      <Panel open={activePanel === "gear"} label="GEAR">
        <div className="statbar rich">
          <span>BAG {progress.inventory.items.length}/{progress.inventory.capacity}</span>
          <IconValue type="gold" value={formatNumber(progress.gold)} />
          <span>CP {formatNumber(progress.records.dummyScore.value)}</span>
        </div>

        <Win title="EQUIP">
          <div className="slots">
            {ITEM_SLOTS.map((slot) => (
              <EquipmentSlot
                key={slot}
                slot={slot}
                item={progress.inventory.equipped[slot]}
                onCompare={openEquipmentPopup}
              />
            ))}
          </div>
        </Win>

        <Win title="ITEM">
          <ItemDetail item={highlightedItem} />
          <div className="gear-actions wide">
            <button type="button" className="inv-vid off">REROLL</button>
            <button type="button" className="inv-vid off">UPG</button>
          </div>
        </Win>

        <Win title="BAG">
          <div className="grid6">
            {progress.inventory.items.slice(0, 24).map((item) => (
              <ItemCell key={item.id} item={item} onCompare={openEquipmentPopup} />
            ))}
            {Array.from({ length: Math.max(0, 24 - Math.min(24, progress.inventory.items.length)) }).map((_, index) => (
              <span key={`empty-${index}`} className="cell off" />
            ))}
          </div>
          <div className="gear-actions">
            <button type="button" className="inv-vid off">CUBE</button>
            <button type="button" className="inv-vid off">SELL</button>
            <button type="button" className="inv-vid" onClick={equipBestItems}>AUTO</button>
          </div>
        </Win>

        <Win title="SHOP">
          <div className="shop">
            {progress.shop.offers.slice(0, 6).map((offer) => (
              <ItemCell
                key={offer.id}
                item={offer.item}
                label={<IconValue type="gold" value={formatCompact(offer.price)} compact />}
                onCompare={openEquipmentPopup}
              />
            ))}
          </div>
        </Win>
      </Panel>

      <Panel open={activePanel === "altar"} label="ALTAR">
        <div className="statbar altar-status">
          <IconValue type="blood" value={`${formatNumber(Math.floor(progress.altar.blood))}/${formatNumber(bloodRequired)}`} />
          <GbBar value={bloodPercent} tone="blood" />
          <span>ALV {progress.altar.level}</span>
          <span>AXP {altarExperiencePercent}%</span>
        </div>

        <Win title="ALTAR">
          <MenuItem label="LV" value={progress.altar.level} />
          <MenuItem label="AXP" value={`${formatNumber(progress.altar.experience)}/${formatNumber(altarNextExperience)}`}>
            <GbBar value={altarExperiencePercent} tone="xp" />
          </MenuItem>
          <GbBar value={bloodPercent} tone="blood" tall />
          <div className="altar-actions">
            <button
              type="button"
              className={progress.altar.blood >= bloodRequired ? "inv-vid" : "inv-vid off"}
              disabled={progress.altar.blood < bloodRequired}
              onClick={summonEliteNow}
            >
              <span className="cur">&#9654;</span>SUMMON
            </button>
            <button
              type="button"
              className={progress.altar.experience >= altarNextExperience ? "inv-vid" : "inv-vid off"}
              disabled={progress.altar.experience < altarNextExperience}
              onClick={levelUpAltarNow}
            >
              LV UP
            </button>
          </div>
          <div className="elite-hint">
            <MenuItem label="ELITE" value={`HP ${formatCompact(elitePreview.maxHp)} / ATK ${formatCompact(elitePreview.attack)}`} />
            <MenuItem label="NEXT" value={`HP ${formatCompact(nextElitePreview.maxHp)} / G ${formatCompact(nextElitePreview.gold)}`} />
          </div>
        </Win>

        <Win title="RELIC">
          <RelicSummary relicId={progress.altar.equippedRelicId} instance={equippedRelic} />
          <div className="relic-owned">
            <MenuItem label="O-ATK" value={formatNumber(relicOwnedStats.atk)} />
            <MenuItem label="O-HP" value={formatNumber(relicOwnedStats.hp)} />
            <MenuItem label="O-DEF" value={formatNumber(relicOwnedStats.def)} />
          </div>
        </Win>

        <Win title={`CODEX ${ownedRelicStyleCount(progress.altar)}/6`}>
          <div className="relics">
            {RELIC_IDS.map((relicId) => (
              <RelicCard
                key={relicId}
                relicId={relicId}
                stars={relicStars(progress.altar, relicId)}
                grade={highestRelicGrade(progress.altar, relicId)}
                equipped={progress.altar.equippedRelicId === relicId}
              />
            ))}
          </div>
        </Win>
      </Panel>

      <VisualEffects
        flashKind={flashKind}
        voiceLine={voiceLine}
        overdrive={isOverdrive}
        telegraph={isTelegraphing}
      />

      {showOfflinePopup && offlineReward && offlineKey ? (
        <OfflineRewardPopup
          reward={offlineReward}
          onClaim={() => setClaimedOfflineKey(offlineKey)}
        />
      ) : null}

      {showFailurePopup && failure && failureKey ? (
        <ChallengeFailurePopup
          failure={failure}
          onClose={() => setDismissedFailureKey(failureKey)}
        />
      ) : null}

      {equipmentPopup ? (
        <EquipmentComparePopup
          popup={equipmentPopup}
          onClose={() => setEquipmentPopup(null)}
        />
      ) : null}

      <DebugPanel open={debugOpen} />
    </>
  );
}

function Panel({ open, label, children }: { open: boolean; label: string; children: ReactNode }) {
  return (
    <section className={open ? "panel on" : "panel"} aria-label={`${label} panel`} aria-hidden={!open}>
      {children}
    </section>
  );
}

function Win({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="win">
      <span className="win-t">{title}</span>
      {children}
    </section>
  );
}

function MenuItem({
  label,
  value,
  children,
  action,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="mi">
      <span>{label}</span>
      {children ? <span className="mi-fill">{children}</span> : <span className="dots" />}
      <span className={valueClassName ? `v ${valueClassName}` : "v"}>{value}</span>
      {action}
    </div>
  );
}

function GbBar({ value, tone, tall = false }: { value: number; tone: "xp" | "blood"; tall?: boolean }) {
  return (
    <span className={tall ? `gb-bar ${tone} tall` : `gb-bar ${tone}`}>
      <i style={{ width: `${value}%` }} />
    </span>
  );
}

function IconValue({ type, value, compact = false }: { type: "gold" | "blood"; value: ReactNode; compact?: boolean }) {
  return (
    <span className={compact ? `ico-val ${type} compact` : `ico-val ${type}`}>
      <i aria-hidden="true" />
      <span>{value}</span>
    </span>
  );
}

function EquipmentSlot({
  slot,
  item,
  onCompare,
}: {
  slot: ItemSlot;
  item: EquipmentItem | null;
  onCompare: (item: EquipmentItem) => void;
}) {
  return (
    <button
      type="button"
      className={item ? `slot ${rarityClass(item.rarity)}` : "slot off"}
      aria-label={`${slotShort(slot)} COMPARE`}
      disabled={!item}
      onClick={() => item ? onCompare(item) : undefined}
    >
      <span>{slotIcon(slot)}</span>
      <small>{item ? `+${item.upgradeLevel}` : slotShort(slot)}</small>
    </button>
  );
}

function ItemCell({ item, label, onCompare }: { item: EquipmentItem; label?: ReactNode; onCompare: (item: EquipmentItem) => void }) {
  return (
    <button
      type="button"
      className={`cell ${rarityClass(item.rarity)}`}
      title={`${item.rarity} ${item.slot}`}
      aria-label={`${item.rarity} ${item.slot} COMPARE`}
      onClick={() => onCompare(item)}
    >
      <b>{statShort(item.baseStat)}</b>
      {label ? <small>{label}</small> : null}
    </button>
  );
}

function ItemDetail({ item }: { item: EquipmentItem | null }) {
  if (!item) {
    return (
      <>
        <MenuItem label="SEL" value="NONE" />
        <p className="tiny dim">CELL TAP / COMPARE 4C</p>
      </>
    );
  }

  return (
    <div className="item-detail">
      <MenuItem label="TYPE" value={`${item.rarity.toUpperCase()} ${slotShort(item.slot)}`} valueClassName={rarityClass(item.rarity)} />
      <MenuItem label="BASE" value={`${statShort(item.baseStat)} ${formatNumber(item.baseValue)}`} />
      <MenuItem label="DMG" value={`${formatNumber(item.minDmg)}-${formatNumber(item.maxDmg)}`} />
      <MenuItem label="ACC" value={formatNumber(item.accuracy)} />
      <MenuItem label="UPG" value={`+${item.upgradeLevel}`} />
      <div className="option-list">
        {item.options.length > 0 ? item.options.map((option, index) => (
          <MenuItem
            key={`${option.key}-${index}`}
            label={option.sin ? "SIN" : `OP${index + 1}`}
            value={`${affixShort(option.key)} +${formatNumber(option.value)}`}
            valueClassName={option.sin ? "bloodc" : undefined}
          />
        )) : <MenuItem label="OP" value="NONE" />}
      </div>
    </div>
  );
}

function VisualEffects({
  flashKind,
  voiceLine,
  overdrive,
  telegraph,
}: {
  flashKind: string | null;
  voiceLine: string | null;
  overdrive: boolean;
  telegraph: boolean;
}) {
  if (!flashKind && !voiceLine && !overdrive && !telegraph) {
    return null;
  }

  return (
    <div className="visual-fx" aria-hidden="true">
      {overdrive ? <i className="state-fx overdrive" /> : null}
      {telegraph ? <i className="state-fx telegraph" /> : null}
      {flashKind ? <i className={`flash-fx ${flashKind}`} /> : null}
      {voiceLine ? <div className="voice-line kr">{voiceLine}</div> : null}
    </div>
  );
}

function OfflineRewardPopup({
  reward,
  onClaim,
}: {
  reward: { elapsedSeconds: number; gold: number; experience: number };
  onClaim: () => void;
}) {
  return (
    <PopupFrame title="RETURN">
      <div className="return-seq">
        <MenuItem label="TIME" value={formatDuration(reward.elapsedSeconds)} />
        <MenuItem label="G" value={formatNumber(reward.gold)} valueClassName="goldc" />
        <MenuItem label="EXP" value={formatNumber(reward.experience)} />
        <MenuItem label="LOOT" value="0" />
        <MenuItem label="BLOOD" value="0" valueClassName="bloodc" />
      </div>
      <p className="popup-voice kr">제단이 깨어났다.</p>
      <div className="popup-menu">
        <button type="button" className="inv-vid" onClick={onClaim}>
          <span className="cur">&#9654;</span>CLAIM
        </button>
      </div>
    </PopupFrame>
  );
}

function ChallengeFailurePopup({ failure, onClose }: { failure: StageFailureReport; onClose: () => void }) {
  const line = failure.reason === "death" ? "버티지 못했다" : "화력이 부족하다";
  return (
    <PopupFrame title="FAILED">
      <p className="popup-voice kr">{line}</p>
      <MenuItem label="STAGE" value={failure.stageId} />
      <MenuItem label="CAUSE" value={failure.reason.toUpperCase()} valueClassName="bloodc" />
      <div className="popup-menu two">
        <button type="button" className="inv-vid" onClick={onClose}>
          <span className="cur">&#9654;</span>HUNT {failure.recommendedStage}
        </button>
        <button type="button" className="inv-vid off" onClick={onClose}>
          STAY
        </button>
      </div>
    </PopupFrame>
  );
}

function EquipmentComparePopup({ popup, onClose }: { popup: EquipmentPopupState; onClose: () => void }) {
  const { candidate, current, comparison } = popup;
  const deltaClass = comparison.delta >= 0 ? "goldc" : "bloodc";
  return (
    <PopupFrame title="COMPARE">
      <div className="compare-head">
        <MenuItem label="CUR" value={current ? `${current.rarity.toUpperCase()} ${slotShort(current.slot)}` : "NONE"} />
        <MenuItem label="NEW" value={`${candidate.rarity.toUpperCase()} ${slotShort(candidate.slot)}`} valueClassName={rarityClass(candidate.rarity)} />
        <MenuItem label="CP" value={`${signedNumber(comparison.delta)} / ${signedPercent(comparison.deltaPercent)}`} valueClassName={deltaClass} />
      </div>

      <div className="compare-lines">
        <CompareLine label="BASE" current={current?.baseValue ?? 0} candidate={candidate.baseValue} />
        <CompareLine label="DMG" current={current ? Math.round((current.minDmg + current.maxDmg) / 2) : 0} candidate={Math.round((candidate.minDmg + candidate.maxDmg) / 2)} />
        <CompareLine label="ACC" current={current?.accuracy ?? 0} candidate={candidate.accuracy} />
        {candidate.options.length > 0 ? candidate.options.map((option, index) => {
          const currentValue = current?.options.find((entry) => entry.key === option.key && entry.sin === option.sin)?.value ?? 0;
          return (
            <CompareLine
              key={`${option.key}-${index}`}
              label={option.sin ? "SIN" : `OP${index + 1}`}
              name={affixShort(option.key)}
              current={currentValue}
              candidate={option.value}
              sin={option.sin}
            />
          );
        }) : <MenuItem label="OP" value="NONE" />}
      </div>

      <div className="popup-menu three">
        <button type="button" className="inv-vid" onClick={onClose}>
          <span className="cur">&#9654;</span>EQUIP
        </button>
        <button type="button" className="inv-vid off" onClick={onClose}>REROLL</button>
        <button type="button" className="inv-vid off" onClick={onClose}>SELL</button>
      </div>
    </PopupFrame>
  );
}

function CompareLine({
  label,
  name,
  current,
  candidate,
  sin = false,
}: {
  label: string;
  name?: string;
  current: number;
  candidate: number;
  sin?: boolean;
}) {
  const direction = candidate > current ? "▲" : candidate < current ? "▼" : "=";
  const valueClassName = sin ? "bloodc" : candidate >= current ? "goldc" : "bloodc";
  return (
    <div className={sin ? "mi compare-line sin-line" : "mi compare-line"}>
      <span>{label}</span>
      <span className="dots" />
      <span className="compare-name">{name ?? ""}</span>
      <span className={valueClassName}>{direction}</span>
      <span className="v">{formatNumber(current)}→{formatNumber(candidate)}</span>
    </div>
  );
}

function PopupFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="popup-layer" role="dialog" aria-label={title}>
      <section className="gb-popup win">
        <span className="win-t">{title}</span>
        {children}
      </section>
    </div>
  );
}

function RelicSummary({ relicId, instance }: { relicId: RelicId | null; instance: ReturnType<typeof bestRelicInstance> }) {
  if (!relicId || !instance) {
    return (
      <>
        <MenuItem label="NAME" value="NONE" />
        <p className="tiny dim">NO RELIC / PICK ONE</p>
      </>
    );
  }

  const relic = RELICS[relicId];
  return (
    <>
      <MenuItem label="NAME" value={<span className="kr">{RELIC_KR_LABELS[relicId]}</span>} />
      <MenuItem label="SIN" value={<span className="kr">{SIN_KR_LABELS[relic.sin]}</span>} />
      <MenuItem label="GRADE" value={gradeShort(instance.grade)} valueClassName={rarityClass(instance.grade)} />
      <MenuItem label="STAR" value={`${instance.stars}/${ALTAR_BALANCE.maxStars}`} />
      <p className="tiny"><span className="stars">{starText(instance.stars)}</span> / NEXT ?</p>
    </>
  );
}

function RelicCard({
  relicId,
  stars,
  grade,
  equipped,
}: {
  relicId: RelicId;
  stars: number;
  grade: ItemRarity | null;
  equipped: boolean;
}) {
  const relic = RELICS[relicId];
  const ownedGrade = stars > 0 ? grade : null;
  return (
    <div className={equipped ? "relic on" : stars > 0 ? "relic" : "relic off"}>
      <span className="kr">{stars > 0 ? RELIC_KR_LABELS[relicId] : "?"}</span>
      <small className="sin">{ownedGrade ? gradeShort(ownedGrade) : <span className="kr">{SIN_KR_LABELS[relic.sin]}</span>}</small>
      <small className="st">{stars > 0 ? `${stars}/${ALTAR_BALANCE.maxStars}` : "?".repeat(ALTAR_BALANCE.maxStars)}</small>
      <span className="grade-ladder">
        {RELIC_GRADES.map((entry) => (
          <i key={entry} className={ownedGrade && ALTAR_BALANCE.relicGrades[entry].rank <= ALTAR_BALANCE.relicGrades[ownedGrade].rank ? rarityClass(entry) : "off"} />
        ))}
      </span>
    </div>
  );
}

function percent(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.floor((value / max) * 100)));
}

function formatCompact(value: number): string {
  if (value >= 1000) {
    return `${Math.floor(value / 100) / 10}K`;
  }
  return String(Math.floor(value));
}

function rarityClass(rarity: ItemRarity): string {
  return `r-${rarity}`;
}

function slotIcon(slot: ItemSlot): string {
  return {
    weapon: "W",
    helmet: "H",
    armor: "A",
    accessory: "R",
  }[slot];
}

function slotShort(slot: ItemSlot): string {
  return {
    weapon: "WPN",
    helmet: "HLM",
    armor: "ARM",
    accessory: "ACC",
  }[slot];
}

function statShort(stat: EquipmentStatKey): string {
  return stat.toUpperCase();
}

function gradeShort(grade: RelicGrade): string {
  return grade.slice(0, 3).toUpperCase();
}

function affixShort(key: string): string {
  return key
    .replace("Chance", "CH")
    .replace("Damage", "DMG")
    .replace("Increase", "INC")
    .replace("defPenetration", "PEN")
    .replace("attackSpeed", "ASPD")
    .replace("damageReduction", "DR")
    .replace("lifeSteal", "LIFE")
    .replace("goldGain", "GOLD")
    .replace("specter", "SPC")
    .replace("plague", "PLG")
    .replace("martyr", "MTR")
    .replace("execution", "EXE")
    .replace("despair", "DSP");
}

function countLegendaryItems(progress: ProgressState): number {
  return [
    ...progress.inventory.items,
    ...Object.values(progress.inventory.equipped).filter((item): item is EquipmentItem => Boolean(item)),
  ].filter((item) => item.rarity === "legendary").length;
}

function countHighGradeRelics(progress: ProgressState): number {
  let count = 0;
  for (const styleRelics of Object.values(progress.altar.owned)) {
    if (!styleRelics) {
      continue;
    }
    for (const instance of Object.values(styleRelics)) {
      if (!instance) {
        continue;
      }
      if (ALTAR_BALANCE.relicGrades[instance.grade].rank >= ALTAR_BALANCE.relicGrades.epic.rank) {
        count += 1;
      }
    }
  }
  return count;
}

function signedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
}

function signedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

function starText(stars: number): string {
  return `${"*".repeat(stars)}${"?".repeat(Math.max(0, ALTAR_BALANCE.maxStars - stars))}`;
}
