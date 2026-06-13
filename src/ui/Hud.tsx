import type { ReactNode } from "react";
import { summonRequirement } from "../core/altar";
import type { EquipmentItem, ItemRarity, ItemSlot, RelicId, StatKey } from "../core/types";
import { ITEM_SLOTS } from "../data/items";
import { RELIC_IDS, RELICS } from "../data/relics";
import { useGameStore } from "../store/gameStore";
import { DebugPanel } from "./DebugPanel";
import { formatNumber } from "./format";

export type HudPanelId = "stat" | "gear" | "altar";

interface HudProps {
  activePanel: HudPanelId | null;
  debugOpen: boolean;
}

export function Hud({ activePanel, debugOpen }: HudProps) {
  const progress = useGameStore((state) => state.simulation.progress);
  const player = useGameStore((state) => state.simulation.world.player);
  const expPercent = percent(progress.experience, progress.nextExperience);
  const bloodRequired = summonRequirement(progress.altar.summonCount);
  const bloodPercent = percent(progress.altar.blood, bloodRequired);

  return (
    <>
      <div className="top-hud" aria-label="Stage summary">
        <span>STAGE {progress.currentStage}</span>
        <span>LV {progress.level}</span>
        <span className="gold-text">G {formatNumber(progress.gold)}</span>
      </div>

      <GamePanel open={activePanel === "stat"} title="STAT">
        <div className="statbar">
          <span>LV {progress.level}</span>
          <span>CP {formatNumber(progress.records.dummyScore.value)}</span>
          <span className="gold-text">G {formatNumber(progress.gold)}</span>
        </div>
        <Win title="STATUS">
          <div className="menu-row">
            <span>EXP</span>
            <div className="gb-bar xp wide">
              <i style={{ width: `${expPercent}%` }} />
            </div>
            <span>{formatNumber(progress.experience)}/{formatNumber(progress.nextExperience)}</span>
          </div>
          <StatRow label="ATK" value={player.attack} />
          <StatRow label="DEF" value={player.defense} />
          <StatRow label="HP" value={player.maxHp} />
          <StatRow label="REG" value={player.hpRegen.toFixed(1)} />
          <div className="menu-row">
            <span>PT</span>
            <span className="dots" />
            <span>{progress.statDistribution.unspentPoints}</span>
            <span className="dim">{progress.statDistribution.preset}</span>
          </div>
        </Win>
        <Win title="REBIRTH">
          <div className="menu-row">
            <span className="blood-text">x{progress.rebirth.experienceMultiplier.toFixed(2)}</span>
            <span className="dots" />
            <span>RUN {progress.rebirth.count}</span>
          </div>
          <div className={progress.rebirth.canRebirth ? "inverse-video" : "inverse-video is-muted"}>
            REBIRTH
          </div>
        </Win>
        <Win title="RECORD">
          <StatRow label="LV" value={progress.records.highestLevel.value} />
          <StatRow label="CP" value={progress.records.dummyScore.value} />
          <StatRow label="RE" value={progress.records.highestRebirthStage.value} />
        </Win>
      </GamePanel>

      <GamePanel open={activePanel === "gear"} title="GEAR">
        <div className="statbar">
          <span>LV {progress.level}</span>
          <span>{progress.inventory.items.length}/{progress.inventory.capacity}</span>
          <span className="gold-text">G {formatNumber(progress.gold)}</span>
        </div>
        <Win title="EQUIP">
          <div className="slots">
            {ITEM_SLOTS.map((slot) => (
              <EquipmentSlot key={slot} slot={slot} item={progress.inventory.equipped[slot]} />
            ))}
          </div>
        </Win>
        <Win title="BAG">
          <div className="inventory-grid">
            {progress.inventory.items.slice(0, 24).map((item) => (
              <InventoryCell key={item.id} item={item} />
            ))}
            {Array.from({ length: Math.max(0, Math.min(24, progress.inventory.capacity) - Math.min(24, progress.inventory.items.length)) }).map((_, index) => (
              <span key={`empty-${index}`} className="inventory-cell empty" />
            ))}
          </div>
          <div className="menu-row compact">
            <span>CUBE</span>
            <span className="dots" />
            <span>SELL</span>
            <span className="dots" />
            <span>AUTO</span>
          </div>
        </Win>
        <Win title="SHOP">
          <div className="shop-grid">
            {progress.shop.offers.slice(0, 6).map((offer) => (
              <InventoryCell key={offer.id} item={offer.item} label={formatCompact(offer.price)} />
            ))}
          </div>
          <div className="menu-row compact">
            <span>RENEW</span>
            <span className="dots" />
            <span className="gold-text">G</span>
          </div>
        </Win>
      </GamePanel>

      <GamePanel open={activePanel === "altar"} title="ALTAR">
        <div className="statbar">
          <span className="blood-text">BLOOD</span>
          <span>{formatNumber(Math.floor(progress.altar.blood))}/{formatNumber(bloodRequired)}</span>
          <span>RITE {progress.altar.summonCount}</span>
        </div>
        <Win title="ALTAR">
          <div className="gb-bar blood wide tall">
            <i style={{ width: `${bloodPercent}%` }} />
          </div>
          <div className="panel-actions">
            <div className="inverse-video">SUMMON</div>
            <div className="inverse-video dark">PICK {progress.altar.pityProgress}/5</div>
          </div>
        </Win>
        <Win title="RELIC">
          <RelicSummary relicId={progress.altar.equippedRelicId} />
        </Win>
        <Win title={`CODEX ${Object.keys(progress.altar.owned).length}/6`}>
          <div className="relic-grid">
            {RELIC_IDS.map((relicId) => (
              <RelicCard
                key={relicId}
                relicId={relicId}
                stars={progress.altar.owned[relicId]?.stars ?? 0}
                equipped={progress.altar.equippedRelicId === relicId}
              />
            ))}
          </div>
        </Win>
      </GamePanel>

      <DebugPanel open={debugOpen} />
    </>
  );
}

function GamePanel({ open, title, children }: { open: boolean; title: string; children: ReactNode }) {
  return (
    <section className={open ? "game-panel on" : "game-panel"} aria-label={`${title} panel`} aria-hidden={!open}>
      {children}
    </section>
  );
}

function Win({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="win">
      <span className="win-title">{title}</span>
      {children}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="menu-row">
      <span>{label}</span>
      <span className="dots" />
      <span className="value">{typeof value === "number" ? formatNumber(value) : value}</span>
    </div>
  );
}

function EquipmentSlot({ slot, item }: { slot: ItemSlot; item: EquipmentItem | null }) {
  return (
    <div className={`slot ${item ? rarityClass(item.rarity) : ""}`}>
      <span>{slotIcon(slot)}</span>
      <small>{slotShort(slot)}</small>
    </div>
  );
}

function InventoryCell({ item, label }: { item: EquipmentItem; label?: string }) {
  return (
    <span className={`inventory-cell ${rarityClass(item.rarity)}`}>
      <b>{statShort(item.baseStat)}</b>
      {label ? <small>{label}</small> : null}
    </span>
  );
}

function RelicSummary({ relicId }: { relicId: RelicId | null }) {
  if (!relicId) {
    return (
      <>
        <div className="menu-row">
          <span className="kr">?</span>
          <span className="dots" />
          <span className="dim">NONE</span>
        </div>
        <p className="relic-copy">?</p>
      </>
    );
  }

  const relic = RELICS[relicId];
  return (
    <>
      <div className="menu-row">
        <span className="kr">{relic.name}</span>
        <span className="dots" />
        <span>{sinShort(relic.sin)}</span>
      </div>
      <p className="relic-copy">★3 ? / ★5 ?</p>
    </>
  );
}

function RelicCard({ relicId, stars, equipped }: { relicId: RelicId; stars: number; equipped: boolean }) {
  const relic = RELICS[relicId];
  return (
    <div className={`relic-card ${equipped ? "equipped" : ""} ${stars <= 0 ? "unknown" : ""}`}>
      <span className="kr">{stars > 0 ? relic.name : "?"}</span>
      <small>{stars > 0 ? starText(stars) : "?"}</small>
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
  return `rarity-${rarity}`;
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

function statShort(stat: StatKey): string {
  return stat.toUpperCase();
}

function sinShort(sin: string): string {
  return sin.slice(0, 3).toUpperCase();
}

function starText(stars: number): string {
  return `${"★".repeat(stars)}${"☆".repeat(5 - stars)}`;
}
