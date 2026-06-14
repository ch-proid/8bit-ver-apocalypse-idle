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
import { classCritProfile } from "../core/class";
import { clampCombatAffixes } from "../core/combat";
import { calculateCombatAffixStats } from "../core/equipment";
import { compareEquipmentCombatScore, createBuildSnapshot, type EquipmentScoreComparison } from "../core/sim";
import type { ClassId, EquipmentItem, EquipmentStatKey, ItemRarity, ItemSlot, ProgressState, RelicGrade, RelicId, StageFailureReport, StatKey } from "../core/types";
import { ALTAR_BALANCE, DAMAGE_FORMULA } from "../data/balance";
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
  str: "힘",
  grit: "근성",
  agi: "민첩",
};
const DEFAULT_NICKNAME = "생존자"; // TODO(Profile): replace when nickname storage exists.
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
const CLASS_PASSIVE_KR: Record<ClassId, string> = {
  assassin: "치명 상한 100% / 기본 치명 강화",
  knight: "저체력 추가 피해 / 방어력 공격 전환",
  mage: "공격 시 체력 비례 지속 피해",
};
const SLOT_KR_LABELS: Record<ItemSlot, string> = {
  weapon: "무기",
  helmet: "투구",
  armor: "갑옷",
  accessory: "반지",
};
const RARITY_KR_LABELS: Record<ItemRarity, string> = {
  common: "일반",
  magic: "마법",
  rare: "희귀",
  epic: "영웅",
  legendary: "전설",
};
const EQUIPMENT_STAT_KR_LABELS: Record<EquipmentStatKey, string> = {
  atk: "공격",
  def: "방어",
  hp: "체력",
  reg: "회복",
};
const AFFIX_KR_LABELS: Record<string, string> = {
  critChance: "치명확률",
  critDamage: "치명피해",
  attackSpeed: "공격속도",
  damageIncrease: "데미지증가",
  finalDamage: "최종피해",
  defPenetration: "방어관통",
  lifeSteal: "흡혈",
  goldGain: "골드획득",
  damageReduction: "피해감소",
  specterDamage: "망령피해",
  bloodLeech: "흡혈강화",
  plagueSpread: "역병전염",
  martyrPain: "순교고통",
  executionThreshold: "처형문턱",
  despairBurst: "절망폭주",
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
  const classCrit = classCritProfile(progress);
  const combatAffixes = clampCombatAffixes(
    calculateCombatAffixStats(progress.inventory.equipped),
    classCrit.critChanceCap,
  );
  const autoDistributionEnabled = progress.statDistribution.preset !== "MANUAL";
  const abilityRows = [
    { label: "체력", value: formatNumber(player.maxHp) },
    { label: "공격력", value: formatNumber(player.attack) },
    { label: "방어력", value: formatNumber(player.defense) },
    { label: "회피력", value: formatNumber(player.evasion) },
    { label: "치명확률", value: `${Math.min(classCrit.critChanceCap, combatAffixes.critChance + classCrit.critChanceBonus)}%` },
    { label: "치명피해", value: `${Math.round(DAMAGE_FORMULA.defaultCritDamage * 100 + combatAffixes.critDamage + classCrit.critDamageBonus)}%` },
    { label: "데미지증가", value: `${combatAffixes.damageIncrease}%` },
    { label: "공격속도", value: `${combatAffixes.attackSpeed}%` },
    { label: "최종피해", value: `${combatAffixes.finalDamage}%` },
    { label: "방어관통", value: formatNumber(combatAffixes.defPenetration) },
    { label: "흡혈", value: `${combatAffixes.lifeSteal}%` },
    { label: "골드획득", value: `${combatAffixes.goldGain}%` },
    { label: "피해감소", value: `${combatAffixes.damageReduction}%` },
    { label: "체력회복", value: formatNumber(player.hpRegen) },
    { label: "공격사거리", value: formatNumber(player.attackRange) },
    { label: "공격간격", value: `${player.attackCooldown.toFixed(2)}초` },
  ];
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
      <div className="lcd-hud" aria-label="전투 상태">
        <span className="char-status">
          <span className="char-face"><SurvivorSprite skin={skin} scale={0.5} /></span>
          <span className="char-level">레벨 {progress.level}</span>
          <span className="char-name kr">{DEFAULT_NICKNAME}</span>
        </span>
        <span className="stage-label">스테이지 {chapter}-{stageInChapter}</span>
        <IconValue type="gold" value={formatNumber(progress.gold)} />
      </div>
      <div className="lcd-exp" aria-label="경험치">
        <GbBar value={expPercent} tone="xp" />
        <b>{expPercent}%</b>
      </div>

      <Panel open={activePanel === "stat"} label="스탯">
        <div className="stat-profile">
          <button type="button" className="skin-mini" onClick={onOpenClassSelect} aria-label="직업 변경">
            <SurvivorSprite skin={skin} scale={1} />
          </button>
          <div className="profile-lines">
            <MenuItem label="레벨" value={progress.level} />
            <MenuItem label="닉네임" value={<span className="kr">{DEFAULT_NICKNAME}</span>} />
            <MenuItem label="전투력" value={formatNumber(progress.records.dummyScore.value)} />
            <MenuItem label="직업" value={<span className="kr">{CLASS_KR_LABELS[currentClassId]}</span>} />
            <MenuItem label="패시브" value={<span className="kr">{CLASS_PASSIVE_KR[currentClassId]}</span>} valueClassName="thin kr" />
          </div>
        </div>

        <Win title="스탯">
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
                    disabled={autoDistributionEnabled || progress.statDistribution.unspentPoints <= 0}
                    onClick={() => spendPoint(key)}
                    aria-label={`${STAT_LABELS[key]} 투자`}
                  >
                    +
                  </button>
                )}
              />
            ))}
          </div>

          <div className="preset-row">
            <span className="cur">&#9654;</span>
            <button
              type="button"
              className={autoDistributionEnabled ? "pbox auto on" : "pbox auto"}
              onClick={() => setPreset(autoDistributionEnabled ? "MANUAL" : classDef.recommendedPreset)}
            >
              자동분배 {autoDistributionEnabled ? "켜짐" : "꺼짐"}
            </button>
            <span className="dots" />
            <span>포인트 {progress.statDistribution.unspentPoints}</span>
          </div>
          <p className="tiny dim kr">추천식 {formatAllocation(classDef.recommendedAllocation)}</p>
        </Win>

        <Win title="능력치">
          <div className="ability-list">
            {abilityRows.map((row) => (
              <MenuItem key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </Win>

        <Win title="환생">
          <MenuItem label="경험 배율" value={`x${progress.rebirth.experienceMultiplier.toFixed(2)}`} valueClassName="bloodc" />
          <MenuItem label="환생 횟수" value={progress.rebirth.count} />
          <button
            type="button"
            className={progress.rebirth.canRebirth ? "inv-vid" : "inv-vid off"}
            disabled={!progress.rebirth.canRebirth}
            onClick={rebirthNow}
          >
            <span className="cur">&#9654;</span>환생
          </button>
        </Win>

        <Win title="기록">
          <MenuItem label="최고 레벨" value={progress.records.highestLevel.value} />
          <MenuItem label="최고 전투력" value={formatNumber(progress.records.dummyScore.value)} />
          <MenuItem label="환생 스테이지" value={progress.records.highestRebirthStage.value} />
        </Win>
      </Panel>

      <Panel open={activePanel === "gear"} label="장비">
        <div className="statbar rich">
          <span>가방 {progress.inventory.items.length}/{progress.inventory.capacity}</span>
          <IconValue type="gold" value={formatNumber(progress.gold)} />
          <span>전투력 {formatNumber(progress.records.dummyScore.value)}</span>
        </div>

        <Win title="착용">
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

        <Win title="장비 정보">
          <ItemDetail item={highlightedItem} />
          <div className="gear-actions wide">
            <button type="button" className="inv-vid off">옵션변경</button>
            <button type="button" className="inv-vid off">강화</button>
          </div>
        </Win>

        <Win title="가방">
          <div className="grid6">
            {progress.inventory.items.slice(0, 24).map((item) => (
              <ItemCell key={item.id} item={item} onCompare={openEquipmentPopup} />
            ))}
            {Array.from({ length: Math.max(0, 24 - Math.min(24, progress.inventory.items.length)) }).map((_, index) => (
              <span key={`empty-${index}`} className="cell off" />
            ))}
          </div>
          <div className="gear-actions">
            <button type="button" className="inv-vid off">합성</button>
            <button type="button" className="inv-vid off">판매</button>
            <button type="button" className="inv-vid" onClick={equipBestItems}>자동착용</button>
          </div>
        </Win>

        <Win title="상점">
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

      <Panel open={activePanel === "altar"} label="제단">
        <div className="statbar altar-status">
          <IconValue type="blood" value={`${formatNumber(Math.floor(progress.altar.blood))}/${formatNumber(bloodRequired)}`} />
          <GbBar value={bloodPercent} tone="blood" />
          <span>제단 {progress.altar.level}</span>
          <span>제단 경험 {altarExperiencePercent}%</span>
        </div>

        <Win title="제단">
          <MenuItem label="레벨" value={progress.altar.level} />
          <MenuItem label="제단 경험" value={`${formatNumber(progress.altar.experience)}/${formatNumber(altarNextExperience)}`}>
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
              <span className="cur">&#9654;</span>소환
            </button>
            <button
              type="button"
              className={progress.altar.experience >= altarNextExperience ? "inv-vid" : "inv-vid off"}
              disabled={progress.altar.experience < altarNextExperience}
              onClick={levelUpAltarNow}
            >
              레벨업
            </button>
          </div>
          <div className="elite-hint">
            <MenuItem label="엘리트" value={`체력 ${formatCompact(elitePreview.maxHp)} / 공격 ${formatCompact(elitePreview.attack)}`} />
            <MenuItem label="다음" value={`체력 ${formatCompact(nextElitePreview.maxHp)} / 골드 ${formatCompact(nextElitePreview.gold)}`} />
          </div>
        </Win>

        <Win title="유물">
          <RelicSummary relicId={progress.altar.equippedRelicId} instance={equippedRelic} />
          <div className="relic-owned">
            <MenuItem label="보유 공격" value={formatNumber(relicOwnedStats.atk)} />
            <MenuItem label="보유 체력" value={formatNumber(relicOwnedStats.hp)} />
            <MenuItem label="보유 방어" value={formatNumber(relicOwnedStats.def)} />
          </div>
        </Win>

        <Win title={`도감 ${ownedRelicStyleCount(progress.altar)}/6`}>
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
      aria-label={`${slotLabel(slot)} 비교`}
      disabled={!item}
      onClick={() => item ? onCompare(item) : undefined}
    >
      <span>{slotIcon(slot)}</span>
      <small>{item ? `+${item.upgradeLevel}` : slotLabel(slot)}</small>
    </button>
  );
}

function ItemCell({ item, label, onCompare }: { item: EquipmentItem; label?: ReactNode; onCompare: (item: EquipmentItem) => void }) {
  return (
    <button
      type="button"
      className={`cell ${rarityClass(item.rarity)}`}
      title={`${rarityLabel(item.rarity)} ${slotLabel(item.slot)}`}
      aria-label={`${rarityLabel(item.rarity)} ${slotLabel(item.slot)} 비교`}
      onClick={() => onCompare(item)}
    >
      <b>{statLabel(item.baseStat)}</b>
      {label ? <small>{label}</small> : null}
    </button>
  );
}

function ItemDetail({ item }: { item: EquipmentItem | null }) {
  if (!item) {
    return (
      <>
        <MenuItem label="선택" value="없음" />
        <p className="tiny dim kr">장비 칸을 눌러 비교</p>
      </>
    );
  }

  return (
    <div className="item-detail">
      <MenuItem label="종류" value={`${rarityLabel(item.rarity)} ${slotLabel(item.slot)}`} valueClassName={rarityClass(item.rarity)} />
      <MenuItem label="기본" value={`${statLabel(item.baseStat)} ${formatNumber(item.baseValue)}`} />
      <MenuItem label="피해" value={`${formatNumber(item.minDmg)}-${formatNumber(item.maxDmg)}`} />
      <MenuItem label="명중" value={formatNumber(item.accuracy)} />
      <MenuItem label="강화" value={`+${item.upgradeLevel}`} />
      <div className="option-list">
        {item.options.length > 0 ? item.options.map((option, index) => (
          <MenuItem
            key={`${option.key}-${index}`}
            label={option.sin ? "죄옵션" : `옵션${index + 1}`}
            value={`${affixLabel(option.key)} +${formatNumber(option.value)}`}
            valueClassName={option.sin ? "bloodc" : undefined}
          />
        )) : <MenuItem label="옵션" value="없음" />}
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
    <PopupFrame title="복귀 정산">
      <div className="return-seq">
        <MenuItem label="시간" value={formatDuration(reward.elapsedSeconds)} />
        <MenuItem label="골드" value={formatNumber(reward.gold)} valueClassName="goldc" />
        <MenuItem label="경험치" value={formatNumber(reward.experience)} />
        <MenuItem label="전리품" value="0" />
        <MenuItem label="피" value="0" valueClassName="bloodc" />
      </div>
      <p className="popup-voice kr">제단이 깨어났다.</p>
      <div className="popup-menu">
        <button type="button" className="inv-vid" onClick={onClaim}>
          <span className="cur">&#9654;</span>확인
        </button>
      </div>
    </PopupFrame>
  );
}

function ChallengeFailurePopup({ failure, onClose }: { failure: StageFailureReport; onClose: () => void }) {
  const line = failure.reason === "death" ? "버티지 못했다" : "화력이 부족하다";
  return (
    <PopupFrame title="도전 실패">
      <p className="popup-voice kr">{line}</p>
      <MenuItem label="스테이지" value={failure.stageId} />
      <MenuItem label="원인" value={failure.reason === "death" ? "사망" : "시간초과"} valueClassName="bloodc" />
      <div className="popup-menu two">
        <button type="button" className="inv-vid" onClick={onClose}>
          <span className="cur">&#9654;</span>추천 사냥터 {failure.recommendedStage}
        </button>
        <button type="button" className="inv-vid off" onClick={onClose}>
          유지
        </button>
      </div>
    </PopupFrame>
  );
}

function EquipmentComparePopup({ popup, onClose }: { popup: EquipmentPopupState; onClose: () => void }) {
  const { candidate, current, comparison } = popup;
  const deltaClass = comparison.delta >= 0 ? "goldc" : "bloodc";
  return (
    <PopupFrame title="장비 비교">
      <div className="compare-head">
        <MenuItem label="현재" value={current ? `${rarityLabel(current.rarity)} ${slotLabel(current.slot)}` : "없음"} />
        <MenuItem label="후보" value={`${rarityLabel(candidate.rarity)} ${slotLabel(candidate.slot)}`} valueClassName={rarityClass(candidate.rarity)} />
        <MenuItem label="전투력" value={`${signedNumber(comparison.delta)} / ${signedPercent(comparison.deltaPercent)}`} valueClassName={deltaClass} />
      </div>

      <div className="compare-lines">
        <CompareLine label="기본" current={current?.baseValue ?? 0} candidate={candidate.baseValue} />
        <CompareLine label="피해" current={current ? Math.round((current.minDmg + current.maxDmg) / 2) : 0} candidate={Math.round((candidate.minDmg + candidate.maxDmg) / 2)} />
        <CompareLine label="명중" current={current?.accuracy ?? 0} candidate={candidate.accuracy} />
        {candidate.options.length > 0 ? candidate.options.map((option, index) => {
          const currentValue = current?.options.find((entry) => entry.key === option.key && entry.sin === option.sin)?.value ?? 0;
          return (
            <CompareLine
              key={`${option.key}-${index}`}
              label={option.sin ? "죄옵션" : `옵션${index + 1}`}
              name={affixLabel(option.key)}
              current={currentValue}
              candidate={option.value}
              sin={option.sin}
            />
          );
        }) : <MenuItem label="옵션" value="없음" />}
      </div>

      <div className="popup-menu three">
        <button type="button" className="inv-vid" onClick={onClose}>
          <span className="cur">&#9654;</span>착용
        </button>
        <button type="button" className="inv-vid off" onClick={onClose}>옵션변경</button>
        <button type="button" className="inv-vid off" onClick={onClose}>판매</button>
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
        <MenuItem label="이름" value="없음" />
        <p className="tiny dim kr">유물을 장착하세요</p>
      </>
    );
  }

  const relic = RELICS[relicId];
  return (
    <>
      <MenuItem label="이름" value={<span className="kr">{RELIC_KR_LABELS[relicId]}</span>} />
      <MenuItem label="죄" value={<span className="kr">{SIN_KR_LABELS[relic.sin]}</span>} />
      <MenuItem label="등급" value={rarityLabel(instance.grade)} valueClassName={rarityClass(instance.grade)} />
      <MenuItem label="별" value={`${instance.stars}/${ALTAR_BALANCE.maxStars}`} />
      <p className="tiny kr"><span className="stars">{starText(instance.stars)}</span> / 다음 ?</p>
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
      <small className="sin">{ownedGrade ? rarityLabel(ownedGrade) : <span className="kr">{SIN_KR_LABELS[relic.sin]}</span>}</small>
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

function slotLabel(slot: ItemSlot): string {
  return SLOT_KR_LABELS[slot];
}

function statLabel(stat: EquipmentStatKey): string {
  return EQUIPMENT_STAT_KR_LABELS[stat];
}

function rarityLabel(rarity: RelicGrade): string {
  return RARITY_KR_LABELS[rarity];
}

function affixLabel(key: string): string {
  return AFFIX_KR_LABELS[key] ?? key;
}

function formatAllocation(allocation: Record<StatKey, number>): string {
  return `힘 ${allocation.str} / 근성 ${allocation.grit} / 민첩 ${allocation.agi}`;
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
