import type { ReactNode } from "react";
import {
  altarExperienceForLevel,
  eliteSummonCost,
  highestRelicGrade,
  ownedRelicStyleCount,
  relicStars,
} from "../core/altar";
import type { ClassId, EquipmentItem, EquipmentStatKey, ItemRarity, ItemSlot, RelicId, StatKey } from "../core/types";
import { ALTAR_BALANCE } from "../data/balance";
import { ITEM_SLOTS } from "../data/items";
import { RELIC_IDS, RELICS } from "../data/relics";
import { SURVIVOR_SKINS } from "../data/sprites/survivors";
import { useGameStore } from "../store/gameStore";
import { DebugPanel } from "./DebugPanel";
import { formatNumber } from "./format";
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

export function Hud({ activePanel, currentClassId, debugOpen, onOpenClassSelect }: HudProps) {
  const progress = useGameStore((state) => state.simulation.progress);
  const player = useGameStore((state) => state.simulation.world.player);
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
        <div className="statbar">
          <span>LV {progress.level}</span>
          <span>CP {formatNumber(progress.records.dummyScore.value)}</span>
          <IconValue type="gold" value={formatNumber(progress.gold)} />
        </div>

        <Win title="STATUS">
          <div className="status-grid">
            <button type="button" className="skin-mini" onClick={onOpenClassSelect} aria-label="CLASS">
              <SurvivorSprite skin={skin} scale={1} />
            </button>
            <div className="status-lines">
              <MenuItem label="EXP" value={`${formatNumber(progress.experience)}/${formatNumber(progress.nextExperience)}`}>
                <GbBar value={expPercent} tone="xp" />
              </MenuItem>
              {STAT_KEYS.map((key) => (
                <MenuItem
                  key={key}
                  label={STAT_LABELS[key]}
                  value={formatNumber(progress.statDistribution.assigned[key])}
                  action={(
                    <button
                      type="button"
                      className="pbox"
                      disabled={progress.statDistribution.unspentPoints <= 0}
                      onClick={() => spendPoint(key)}
                    >
                      +
                    </button>
                  )}
                />
              ))}
              <MenuItem label="ATK" value={formatNumber(player.attack)} />
              <MenuItem label="DEF" value={formatNumber(player.defense)} />
              <MenuItem label="HP" value={formatNumber(player.maxHp)} />
              <MenuItem label="EVA" value={formatNumber(player.evasion)} />
            </div>
          </div>
          <div className="preset-row">
            <span className="cur">&#9654;</span>
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
        <div className="statbar">
          <span>BAG {progress.inventory.items.length}/{progress.inventory.capacity}</span>
          <IconValue type="gold" value={formatNumber(progress.gold)} />
        </div>

        <Win title="EQUIP">
          <div className="slots">
            {ITEM_SLOTS.map((slot) => (
              <EquipmentSlot key={slot} slot={slot} item={progress.inventory.equipped[slot]} />
            ))}
          </div>
        </Win>

        <Win title="BAG">
          <div className="grid6">
            {progress.inventory.items.slice(0, 18).map((item) => (
              <ItemCell key={item.id} item={item} />
            ))}
            {Array.from({ length: Math.max(0, 18 - Math.min(18, progress.inventory.items.length)) }).map((_, index) => (
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
              <ItemCell key={offer.id} item={offer.item} label={<IconValue type="gold" value={formatCompact(offer.price)} compact />} />
            ))}
          </div>
        </Win>
      </Panel>

      <Panel open={activePanel === "altar"} label="ALTAR">
        <div className="statbar">
          <IconValue type="blood" value={`${formatNumber(Math.floor(progress.altar.blood))}/${formatNumber(bloodRequired)}`} />
          <span>ALV {progress.altar.level}</span>
        </div>

        <Win title="ALTAR">
          <MenuItem label="LV" value={progress.altar.level} />
          <MenuItem label="AXP" value={`${formatNumber(progress.altar.experience)}/${formatNumber(altarNextExperience)}`}>
            <GbBar value={altarExperiencePercent} tone="xp" />
          </MenuItem>
          <GbBar value={bloodPercent} tone="blood" tall />
          <div className="altar-actions">
            <button type="button" className="inv-vid" onClick={summonEliteNow}>
              <span className="cur">&#9654;</span>ELITE
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
        </Win>

        <Win title="RELIC">
          <RelicSummary relicId={progress.altar.equippedRelicId} stars={currentRelicStars(progress.altar.equippedRelicId)} />
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

      <DebugPanel open={debugOpen} />
    </>
  );

  function currentRelicStars(relicId: RelicId | null): number {
    return relicStars(progress.altar, relicId);
  }
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

function EquipmentSlot({ slot, item }: { slot: ItemSlot; item: EquipmentItem | null }) {
  return (
    <div className={item ? `slot ${rarityClass(item.rarity)}` : "slot off"}>
      <span>{slotIcon(slot)}</span>
      <small>{slotShort(slot)}</small>
    </div>
  );
}

function ItemCell({ item, label }: { item: EquipmentItem; label?: ReactNode }) {
  return (
    <span className={`cell ${rarityClass(item.rarity)}`} title={`${item.rarity} ${item.slot}`}>
      <b>{statShort(item.baseStat)}</b>
      {label ? <small>{label}</small> : null}
    </span>
  );
}

function RelicSummary({ relicId, stars }: { relicId: RelicId | null; stars: number }) {
  if (!relicId) {
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
      <MenuItem label="NAME" value={<span className="kr">{relic.name}</span>} />
      <MenuItem label="SIN" value={sinShort(relic.sin)} />
      <p className="tiny"><span className="stars">{starText(stars)}</span> / NEXT ?</p>
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
  return (
    <div className={equipped ? "relic on" : stars > 0 ? "relic" : "relic off"}>
      <span className="kr">{stars > 0 ? relic.name : "?"}</span>
      <small className="sin">{stars > 0 && grade ? grade.slice(0, 3).toUpperCase() : sinShort(relic.sin)}</small>
      <small className="st">{stars > 0 ? starText(stars) : "?".repeat(ALTAR_BALANCE.maxStars)}</small>
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

function sinShort(sin: string): string {
  return sin.slice(0, 3).toUpperCase();
}

function starText(stars: number): string {
  return `${"*".repeat(stars)}${"?".repeat(Math.max(0, ALTAR_BALANCE.maxStars - stars))}`;
}
