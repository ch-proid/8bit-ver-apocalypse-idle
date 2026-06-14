import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  altarChargeProgress,
  altarExperienceForLevel,
  altarMaxStoredCharges,
  altarStoredCharges,
  bestRelicInstance,
  calculateRelicOwnedStats,
  eliteSummonCost,
  ownedRelicStyleCount,
  relicDuplicateRequirementForNextStar,
} from "../core/altar";
import { altarElitePreview } from "../core/elites";
import { classCritProfile } from "../core/class";
import { clampCombatAffixes } from "../core/combat";
import { calculateCombatAffixStats, calculateEquipmentStats, enhancedBaseValue, equipmentDisplayName } from "../core/equipment";
import { canRefreshShop, reawakeningCost, shopRefreshRemainingSeconds } from "../core/gold";
import { canRebirth } from "../core/rebirth";
import { compareEquipmentCombatScore, createBuildSnapshot, type EquipmentScoreComparison } from "../core/sim";
import { combatPowerEstimate } from "../core/stats";
import { equipmentUpgradeCost, equipmentUpgradeFailureChance } from "../core/upgrade";
import type { ClassId, EquipmentItem, EquipmentStatKey, ItemOption, ItemRarity, ItemSlot, ProgressState, RelicGrade, RelicId, RelicInstance, StageFailureReport, StatKey } from "../core/types";
import { AFFIX_BALANCE, ALTAR_BALANCE, DAMAGE_FORMULA, EQUIPMENT_BALANCE, REBIRTH_BALANCE } from "../data/balance";
import { equipmentIconFor } from "../data/equipmentIcons";
import { ITEM_SLOTS } from "../data/items";
import { PLAYER_CLASSES } from "../data/classes";
import { RELIC_GRADES, RELIC_IDS, RELICS } from "../data/relics";
import { SURVIVOR_SKINS } from "../data/sprites/survivors";
import { useGameStore } from "../store/gameStore";
import { DebugPanel } from "./DebugPanel";
import { formatDuration, formatNumber } from "./format";
import { SurvivorSprite } from "./SurvivorSprite";

export type HudPanelId = "stat" | "gear" | "shop" | "altar" | "rebirth";

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
const RELIC_DESC_KR: Record<RelicId, string> = {
  specterLord: "처치한 적을 망령으로 부려 함께 싸웁니다.",
  bloodBerserker: "빠른 연타와 흡혈로 피를 대가로 전투합니다.",
  plagueDoctor: "역병을 퍼뜨려 적 무리를 천천히 무너뜨립니다.",
  martyr: "자기 체력을 깎아 잃은 체력만큼 피해를 키웁니다.",
  executioner: "표식을 쌓아 임계점에서 처형 피해를 냅니다.",
  kingsShadow: "게이지를 모아 폭주 상태로 광역 난무합니다.",
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
  itemId: string;
}

interface RelicPopupState {
  relicId: RelicId;
  grade: RelicGrade;
}

interface EquipmentEntry {
  item: EquipmentItem;
  location: "inventory" | "equipped" | "shop";
  offerId?: string;
  price?: number;
}

export function Hud({ activePanel, currentClassId, debugOpen, onOpenClassSelect }: HudProps) {
  const progress = useGameStore((state) => state.simulation.progress);
  const player = useGameStore((state) => state.simulation.world.player);
  const world = useGameStore((state) => state.simulation.world);
  const offlineReward = useGameStore((state) => state.lastOfflineReward);
  const spendPoint = useGameStore((state) => state.spendStatPoint);
  const setPreset = useGameStore((state) => state.setStatPreset);
  const equipOrUnequipItem = useGameStore((state) => state.equipOrUnequipItem);
  const upgradeEquipmentItem = useGameStore((state) => state.upgradeEquipmentItem);
  const reawakenEquipmentItem = useGameStore((state) => state.reawakenEquipmentItem);
  const sellEquipmentItem = useGameStore((state) => state.sellEquipmentItem);
  const disassembleEquipmentItems = useGameStore((state) => state.disassembleEquipmentItems);
  const refreshShopNow = useGameStore((state) => state.refreshShopNow);
  const buyShopOfferNow = useGameStore((state) => state.buyShopOfferNow);
  const summonEliteNow = useGameStore((state) => state.summonEliteNow);
  const levelUpAltarNow = useGameStore((state) => state.levelUpAltarNow);
  const awakenRelicNow = useGameStore((state) => state.awakenRelicNow);
  const rebirthNow = useGameStore((state) => state.rebirthNow);
  const expPercent = percent(progress.experience, progress.nextExperience);
  const bloodRequired = eliteSummonCost(progress.altar);
  const altarNextExperience = altarExperienceForLevel(progress.altar.level);
  const altarCharges = altarStoredCharges(progress.altar);
  const altarMaxCharges = altarMaxStoredCharges(progress.altar);
  const altarChargePercent = altarChargeProgress(progress.altar);
  const nextAltarMaxCharges = altarMaxStoredCharges({ level: progress.altar.level + 1 });
  const altarExperiencePercent = percent(progress.altar.experience, altarNextExperience);
  const chapter = Math.ceil(progress.currentStage / 10);
  const stageInChapter = ((progress.currentStage - 1) % 10) + 1;
  const skin = SURVIVOR_SKINS.find((entry) => entry.id === currentClassId) ?? SURVIVOR_SKINS[0];
  const classDef = PLAYER_CLASSES[currentClassId];
  const classCrit = classCritProfile(progress);
  const equipmentStats = calculateEquipmentStats(progress.inventory.equipped);
  const relicOwnedStats = calculateRelicOwnedStats(progress.altar);
  const directStatBonus = {
    atk: equipmentStats.atk + relicOwnedStats.atk,
    def: equipmentStats.def + relicOwnedStats.def,
    hp: equipmentStats.hp + relicOwnedStats.hp,
    reg: equipmentStats.reg + relicOwnedStats.reg,
  };
  const combatAffixes = clampCombatAffixes(
    calculateCombatAffixStats(progress.inventory.equipped),
    classCrit.critChanceCap,
  );
  const combatPower = combatPowerEstimate(progress);
  const rebirthUnlocked = canRebirth(progress);
  const rebirthStageCleared = Boolean(
    progress.stageProgress.clearedStages[REBIRTH_BALANCE.requiredStageId]
      || progress.stageProgress.defeatedBossStages[REBIRTH_BALANCE.requiredStageId],
  );
  const rebirthConditionLabel = rebirthUnlocked
    ? "달성"
    : `6-10 ${rebirthStageCleared ? "완료" : "미완"} / LV ${progress.level}/${REBIRTH_BALANCE.requiredLevel}`;
  const autoDistributionEnabled = progress.statDistribution.preset !== "MANUAL";
  const critChanceBase = Math.min(classCrit.critChanceCap, classCrit.critChanceBonus);
  const critChanceTotal = Math.min(classCrit.critChanceCap, combatAffixes.critChance + classCrit.critChanceBonus);
  const critDamageBase = Math.round(DAMAGE_FORMULA.defaultCritDamage * 100 + classCrit.critDamageBonus);
  const experienceGainBonus = Math.max(0, Math.round((progress.rebirth.experienceMultiplier - 1) * 100));
  const abilityRows = [
    { label: "체력", value: <SplitValue base={player.maxHp - directStatBonus.hp} extra={directStatBonus.hp} /> },
    { label: "공격력", value: <SplitValue base={player.attack - directStatBonus.atk} extra={directStatBonus.atk} /> },
    { label: "방어력", value: <SplitValue base={player.defense - directStatBonus.def} extra={directStatBonus.def} /> },
    { label: "회피력", value: <SplitValue base={player.evasion} /> },
    { label: "치명확률%", value: <SplitValue base={critChanceBase} extra={critChanceTotal - critChanceBase} suffix="%" /> },
    { label: "치명피해%", value: <SplitValue base={critDamageBase} extra={combatAffixes.critDamage} suffix="%" /> },
    { label: "데미지증가%", value: <SplitValue base={0} extra={combatAffixes.damageIncrease} suffix="%" /> },
    { label: "공격속도%", value: <SplitValue base={0} extra={combatAffixes.attackSpeed} suffix="%" /> },
    { label: "경험치획득%", value: <SplitValue base={100} extra={experienceGainBonus} suffix="%" /> },
    { label: "최종피해%", value: <SplitValue base={0} extra={combatAffixes.finalDamage} suffix="%" /> },
    { label: "방어관통", value: <SplitValue base={0} extra={combatAffixes.defPenetration} /> },
    { label: "흡혈%", value: <SplitValue base={0} extra={combatAffixes.lifeSteal} suffix="%" /> },
    { label: "골드획득%", value: <SplitValue base={0} extra={combatAffixes.goldGain} suffix="%" /> },
    { label: "피해감소%", value: <SplitValue base={0} extra={combatAffixes.damageReduction} suffix="%" /> },
    { label: "체력회복", value: <SplitValue base={player.hpRegen - directStatBonus.reg} extra={directStatBonus.reg} /> },
  ];
  const elitePreview = altarElitePreview(progress.altar.level, progress.rebirth.count);
  const nextElitePreview = altarElitePreview(progress.altar.level + 1, progress.rebirth.count);
  const hasRelicOwnedStats = relicOwnedStats.atk > 0 || relicOwnedStats.hp > 0 || relicOwnedStats.def > 0 || relicOwnedStats.reg > 0;
  const equippedRelic = bestRelicInstance(progress.altar, progress.altar.equippedRelicId);
  const [equipmentPopup, setEquipmentPopup] = useState<EquipmentPopupState | null>(null);
  const [relicPopup, setRelicPopup] = useState<RelicPopupState | null>(null);
  const [disassembleMode, setDisassembleMode] = useState(false);
  const [selectedDisassembleIds, setSelectedDisassembleIds] = useState<string[]>([]);
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
  const gearItems = useMemo(() => progress.inventory.items.slice(0, 24), [progress.inventory.items]);
  const shopCanRefresh = canRefreshShop(progress, world.elapsed);
  const shopRefreshRemain = shopRefreshRemainingSeconds(progress, world.elapsed);
  const upgradeItemIds = useMemo(() => {
    if (activePanel !== "gear" || gearItems.length <= 0) {
      return new Set<string>();
    }
    const snapshot = createBuildSnapshot(progress);
    return new Set(
      gearItems
        .filter((item) => compareEquipmentCombatScore(snapshot, item, { durationSeconds: 8 }).delta > 0)
        .map((item) => item.id),
    );
  }, [activePanel, gearItems, progress]);
  const popupEntry = equipmentPopup ? findEquipmentEntry(progress, equipmentPopup.itemId) : null;
  const popupRelic = relicPopup ? progress.altar.owned[relicPopup.relicId]?.[relicPopup.grade] ?? null : null;

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
    setEquipmentPopup({ itemId: item.id });
  }

  function toggleDisassembleItem(itemId: string): void {
    setSelectedDisassembleIds((ids) => (
      ids.includes(itemId) ? ids.filter((id) => id !== itemId) : [...ids, itemId]
    ));
  }

  function handleDisassembleButton(): void {
    if (!disassembleMode) {
      setDisassembleMode(true);
      setSelectedDisassembleIds([]);
      return;
    }
    if (selectedDisassembleIds.length > 0) {
      disassembleEquipmentItems(selectedDisassembleIds);
    }
    setSelectedDisassembleIds([]);
    setDisassembleMode(false);
  }

  function selectBulkDisassembleItems(): void {
    const ids = progress.inventory.items
      .filter((item) => !item.locked && item.rarity !== "legendary")
      .map((item) => item.id);
    setDisassembleMode(true);
    setSelectedDisassembleIds(ids);
  }

  useEffect(() => {
    if (activePanel === "shop" && progress.shop.offers.length <= 0) {
      refreshShopNow();
    }
  }, [activePanel, progress.shop.offers.length, refreshShopNow]);

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
      <AltarBall
        charges={altarCharges}
        maxCharges={altarMaxCharges}
        fill={altarChargePercent}
        disabled={altarCharges <= 0 || Boolean(world.altarElite)}
        onClick={summonEliteNow}
      />

      <Panel open={activePanel === "stat"} label="스탯">
        <div className="stat-profile">
          <button type="button" className="skin-mini" onClick={onOpenClassSelect} aria-label="직업 변경">
            <SurvivorSprite skin={skin} scale={1} />
          </button>
          <div className="profile-lines">
            <MenuItem label="레벨" value={progress.level} />
            <MenuItem label="닉네임" value={<span className="kr">{DEFAULT_NICKNAME}</span>} />
            <MenuItem label="전투력" value={formatNumber(combatPower)} />
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
                value={<SplitValue base={progress.statDistribution.assigned[key]} extra={progress.rebirth.permanentStats[key]} />}
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

        <Win title="유물 능력치">
          {hasRelicOwnedStats ? (
            <div className="ability-list">
              {relicOwnedStats.atk > 0 ? <MenuItem label="공격력" value={<BonusValue value={relicOwnedStats.atk} />} /> : null}
              {relicOwnedStats.hp > 0 ? <MenuItem label="체력" value={<BonusValue value={relicOwnedStats.hp} />} /> : null}
              {relicOwnedStats.def > 0 ? <MenuItem label="방어력" value={<BonusValue value={relicOwnedStats.def} />} /> : null}
              {relicOwnedStats.reg > 0 ? <MenuItem label="체력회복" value={<BonusValue value={relicOwnedStats.reg} />} /> : null}
            </div>
          ) : (
            <p className="empty-note kr">유물을 착용하고 있지 않습니다</p>
          )}
        </Win>

      </Panel>

      <Panel open={activePanel === "rebirth"} label="환생">
        <div className="statbar rich">
          <span>환생 {progress.rebirth.count}회</span>
          <span className="bloodc">x{progress.rebirth.experienceMultiplier.toFixed(2)}</span>
        </div>

        <Win title="환생">
          <MenuItem label="환생 횟수" value={`${progress.rebirth.count}회`} />
          <MenuItem label="현재 배율" value={`x${progress.rebirth.experienceMultiplier.toFixed(2)}`} valueClassName="bloodc" />
          <MenuItem label="영구 스탯" value={`힘 +${progress.rebirth.permanentStats.str} / 근성 +${progress.rebirth.permanentStats.grit} / 민첩 +${progress.rebirth.permanentStats.agi}`} />
          <MenuItem
            label="해금 조건"
            value={rebirthConditionLabel}
            valueClassName={rebirthUnlocked ? "goldc kr" : "bloodc kr"}
          />
          <button
            type="button"
            className={rebirthUnlocked ? "inv-vid" : "inv-vid off"}
            disabled={!rebirthUnlocked}
            onClick={rebirthNow}
          >
            <span className="cur">&#9654;</span>환생하기
          </button>
        </Win>

        <Win title="개인 기록">
          <MenuItem label="최고 레벨" value={progress.records.highestLevel.value} />
          <MenuItem label="최고 전투력" value={formatNumber(combatPower)} />
          <MenuItem label="환생 횟수" value={`${progress.rebirth.count}회`} />
        </Win>
      </Panel>

      <Panel open={activePanel === "gear"} label="장비">
        <div className="statbar rich">
          <span>가방 {progress.inventory.items.length}/{progress.inventory.capacity}</span>
          <span className="crystal-val">◆ {formatNumber(progress.crystal)}</span>
          <IconValue type="gold" value={formatNumber(progress.gold)} />
        </div>

        <Win title="착용">
          <div className="slots">
            {ITEM_SLOTS.map((slot) => (
              <EquipmentSlot
                key={slot}
                slot={slot}
                item={progress.inventory.equipped[slot]}
                classId={currentClassId}
                onCompare={openEquipmentPopup}
              />
            ))}
          </div>
        </Win>

        <Win title="가방">
          <div className="grid6">
            {gearItems.map((item) => (
              <ItemCell
                key={item.id}
                item={item}
                classId={currentClassId}
                isUpgrade={upgradeItemIds.has(item.id)}
                selectionMode={disassembleMode}
                selected={selectedDisassembleIds.includes(item.id)}
                onToggleSelect={toggleDisassembleItem}
                onCompare={openEquipmentPopup}
              />
            ))}
            {Array.from({ length: Math.max(0, 24 - Math.min(24, progress.inventory.items.length)) }).map((_, index) => (
              <span key={`empty-${index}`} className="cell off" />
            ))}
          </div>
          <div className="gear-actions wide">
            <button type="button" className="inv-vid" onClick={handleDisassembleButton}>
              <span className="cur">&#9654;</span>{disassembleMode ? selectedDisassembleIds.length > 0 ? `분해 실행 ${selectedDisassembleIds.length}` : "분해 취소" : "분해"}
            </button>
            <button type="button" className="inv-vid off" onClick={selectBulkDisassembleItems}>
              일괄 분해
            </button>
          </div>
          {disassembleMode ? <p className="tiny dim kr">분해할 장비를 선택하세요. 장착/잠금 장비는 제외됩니다.</p> : null}
        </Win>
      </Panel>

      <Panel open={activePanel === "shop"} label="상점">
        <div className="statbar rich">
          <span>상점</span>
          <IconValue type="gold" value={formatNumber(progress.gold)} />
          <span>다음 {shopCanRefresh ? "가능" : formatDuration(shopRefreshRemain)}</span>
        </div>

        <Win title="떠돌이 상인">
          <p className="merchant-line kr">오늘 물건은 여섯 칸뿐이오. 마음에 들면 바로 챙기시오.</p>
          <div className="shop">
            {progress.shop.offers.slice(0, 6).map((offer) => (
              <ItemCell
                key={offer.id}
                item={offer.item}
                classId={currentClassId}
                label={<IconValue type="gold" value={formatCompact(offer.price)} compact />}
                isUpgrade={false}
                selectionMode={false}
                selected={false}
                onToggleSelect={toggleDisassembleItem}
                onCompare={openEquipmentPopup}
              />
            ))}
            {Array.from({ length: Math.max(0, 6 - Math.min(6, progress.shop.offers.length)) }).map((_, index) => (
              <span key={`shop-empty-${index}`} className="cell off" />
            ))}
          </div>
          <div className="gear-actions wide">
            <button
              type="button"
              className={shopCanRefresh ? "inv-vid" : "inv-vid off"}
              disabled={!shopCanRefresh}
              onClick={refreshShopNow}
            >
              <span className="cur">&#9654;</span>무료 갱신
            </button>
            <button type="button" className="inv-vid off" disabled>
              광고 리롤
            </button>
          </div>
          <p className="tiny dim kr">무료 갱신은 하루 2회. 광고 리롤은 추후 연결 예정입니다.</p>
        </Win>
      </Panel>

      <Panel open={activePanel === "altar"} label="제단">
        <Win title="제단 정보">
          <MenuItem label="레벨" value={progress.altar.level} />
          <MenuItem label="보유 상한" value={`${altarMaxCharges}개 / 다음 ${nextAltarMaxCharges}개`} />
          <MenuItem label="1충전 비용" value={formatNumber(bloodRequired)} />
          <MenuItem label="제단 경험" value={`${formatNumber(progress.altar.experience)}/${formatNumber(altarNextExperience)}`}>
            <GbBar value={altarExperiencePercent} tone="xp" />
          </MenuItem>
          <div className="altar-actions single">
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
            <MenuItem label="다음 레벨" value={`체력 ${formatCompact(nextElitePreview.maxHp)} / 골드 ${formatCompact(nextElitePreview.gold)}`} />
          </div>
        </Win>

        <Win title="유물">
          <RelicSummary relicId={progress.altar.equippedRelicId} instance={equippedRelic} />
          <div className="relic-owned-block">
            <span className="section-label kr">보유 효과</span>
            {hasRelicOwnedStats ? (
              <div className="relic-owned">
                {relicOwnedStats.atk > 0 ? <MenuItem label="공격력" value={<BonusValue value={relicOwnedStats.atk} />} /> : null}
                {relicOwnedStats.hp > 0 ? <MenuItem label="체력" value={<BonusValue value={relicOwnedStats.hp} />} /> : null}
                {relicOwnedStats.def > 0 ? <MenuItem label="방어력" value={<BonusValue value={relicOwnedStats.def} />} /> : null}
                {relicOwnedStats.reg > 0 ? <MenuItem label="체력회복" value={<BonusValue value={relicOwnedStats.reg} />} /> : null}
              </div>
            ) : (
              <p className="empty-note kr">보유 효과가 없습니다</p>
            )}
          </div>
        </Win>

        <Win title={`유물창 ${ownedRelicStyleCount(progress.altar)}/6`}>
          <div className="relics relic-book">
            {RELIC_IDS.flatMap((relicId) => RELIC_GRADES.map((grade) => {
              const instance = progress.altar.owned[relicId]?.[grade] ?? null;
              const equipped = equippedRelic?.id === relicId && equippedRelic.grade === grade;
              return (
                <RelicCard
                  key={`${relicId}-${grade}`}
                  relicId={relicId}
                  grade={grade}
                  instance={instance}
                  equipped={equipped}
                  onOpen={() => setRelicPopup({ relicId, grade })}
                />
              );
            }))}
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

      {equipmentPopup && popupEntry ? (
        <EquipmentInfoPopup
          entry={popupEntry}
          progress={progress}
          currentClassId={currentClassId}
          onClose={() => setEquipmentPopup(null)}
          onEquipToggle={(itemId) => {
            equipOrUnequipItem(itemId);
            setEquipmentPopup(null);
          }}
          onUpgrade={(itemId) => upgradeEquipmentItem(itemId)}
          onSell={(itemId) => {
            sellEquipmentItem(itemId);
            setEquipmentPopup(null);
          }}
          onBuy={(offerId) => {
            buyShopOfferNow(offerId);
            setEquipmentPopup(null);
          }}
          onReawaken={(itemId, selectedLines) => reawakenEquipmentItem(itemId, selectedLines)}
        />
      ) : null}

      {relicPopup ? (
        <RelicInfoPopup
          relicId={relicPopup.relicId}
          grade={relicPopup.grade}
          instance={popupRelic}
          onAwaken={() => awakenRelicNow(relicPopup.relicId, relicPopup.grade)}
          onClose={() => setRelicPopup(null)}
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

function SplitValue({ base, extra = 0, suffix = "" }: { base: number; extra?: number; suffix?: string }) {
  const safeBase = Math.max(0, base);
  const safeExtra = Math.max(0, extra);
  return (
    <span className="split-value">
      <span>{formatNumber(safeBase)}{suffix}</span>
      {safeExtra > 0 ? <span className="bonus">+{formatNumber(safeExtra)}{suffix}</span> : null}
    </span>
  );
}

function BonusValue({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span className="split-value">
      <span className="bonus">+{formatNumber(value)}{suffix}</span>
    </span>
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

function AltarBall({
  charges,
  maxCharges,
  fill,
  disabled,
  onClick,
}: {
  charges: number;
  maxCharges: number;
  fill: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const style = { "--fill": `${Math.max(0, Math.min(100, fill))}%` } as CSSProperties;
  return (
    <div className="altar-ball-wrap">
      <button
        type="button"
        className={disabled ? "altar-ball off" : "altar-ball"}
        style={style}
        disabled={disabled}
        onClick={onClick}
        aria-label={`제단 소환 ${charges}/${maxCharges}`}
      >
        <span>{charges}</span>
        <small>{maxCharges}</small>
      </button>
      <IconValue type="blood" value={`${charges}/${maxCharges}`} compact />
    </div>
  );
}

function EquipmentSlot({
  slot,
  item,
  classId,
  onCompare,
}: {
  slot: ItemSlot;
  item: EquipmentItem | null;
  classId: ClassId;
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
      <img className="equip-icon" src={equipmentIconFor(classId, slot)} alt="" />
      <small>{item ? `+${item.upgradeLevel}` : slotLabel(slot)}</small>
    </button>
  );
}

function ItemCell({
  item,
  classId,
  label,
  isUpgrade,
  selectionMode,
  selected,
  onToggleSelect,
  onCompare,
}: {
  item: EquipmentItem;
  classId: ClassId;
  label?: ReactNode;
  isUpgrade: boolean;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (itemId: string) => void;
  onCompare: (item: EquipmentItem) => void;
}) {
  return (
    <button
      type="button"
      className={`cell ${rarityClass(item.rarity)}${isUpgrade ? " upgrade" : ""}${selected ? " selected" : ""}`}
      title={`${rarityLabel(item.rarity)} ${slotLabel(item.slot)}`}
      aria-label={`${rarityLabel(item.rarity)} ${slotLabel(item.slot)} 정보`}
      onClick={() => selectionMode ? onToggleSelect(item.id) : onCompare(item)}
    >
      {selectionMode ? <i className="checkmark">{selected ? "✓" : ""}</i> : null}
      <img className="equip-icon" src={equipmentIconFor(classId, item.slot)} alt="" />
      <b>+{item.upgradeLevel}</b>
      {label ? <small>{label}</small> : null}
    </button>
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

function EquipmentInfoPopup({
  entry,
  progress,
  currentClassId,
  onClose,
  onEquipToggle,
  onUpgrade,
  onSell,
  onBuy,
  onReawaken,
}: {
  entry: EquipmentEntry;
  progress: ProgressState;
  currentClassId: ClassId;
  onClose: () => void;
  onEquipToggle: (itemId: string) => void;
  onUpgrade: (itemId: string) => void;
  onSell: (itemId: string) => void;
  onBuy: (offerId: string) => void;
  onReawaken: (itemId: string, selectedGeneralLineIndexes?: number[]) => void;
}) {
  const [selectedReawakenLines, setSelectedReawakenLines] = useState<number[]>([]);
  const candidate = entry.item;
  const current = progress.inventory.equipped[candidate.slot];
  const comparison = compareEquipmentCombatScore(createBuildSnapshot(progress), candidate, { durationSeconds: 8 });
  const deltaClass = comparison.delta >= 0 ? "goldc" : "bloodc";
  const generalOptionCount = candidate.options.filter((option) => !option.sin).length;
  const reawakenSelectedCount = selectedReawakenLines.length > 0 ? selectedReawakenLines.length : generalOptionCount;
  const reawakenCostValue = reawakeningCost(candidate, reawakenSelectedCount);
  const upgradeCostValue = equipmentUpgradeCost(candidate);
  const failChance = equipmentUpgradeFailureChance(candidate);
  const canMutate = entry.location !== "shop";
  const canUpgrade = canMutate && upgradeCostValue > 0 && progress.gold >= upgradeCostValue;
  const canReawaken = canMutate
    && generalOptionCount > 0
    && progress.gold >= reawakenCostValue.gold
    && progress.crystal >= reawakenCostValue.crystal;
  const canSell = entry.location === "inventory";
  const canBuy = entry.location === "shop" && Boolean(entry.offerId) && progress.gold >= (entry.price ?? Number.POSITIVE_INFINITY);
  let generalIndex = -1;

  function toggleLine(index: number): void {
    setSelectedReawakenLines((lines) => (
      lines.includes(index) ? lines.filter((line) => line !== index) : [...lines, index].sort((a, b) => a - b)
    ));
  }

  return (
    <PopupFrame title="장비 정보">
      <div className="equipment-info-head">
        <img className="equip-icon big" src={equipmentIconFor(currentClassId, candidate.slot)} alt="" />
        <div>
          <MenuItem label="이름" value={equipmentName(candidate)} valueClassName={rarityClass(candidate.rarity)} />
          <MenuItem label="위치" value={entry.location === "equipped" ? "장착중" : entry.location === "inventory" ? "가방" : "상점"} />
          {entry.location === "shop" ? <MenuItem label="가격" value={<IconValue type="gold" value={formatNumber(entry.price ?? 0)} compact />} /> : null}
        </div>
      </div>

      <div className="compare-head">
        <MenuItem label="현재" value={current ? `${rarityLabel(current.rarity)} ${slotLabel(current.slot)}` : "없음"} />
        <MenuItem label="선택" value={`${rarityLabel(candidate.rarity)} ${slotLabel(candidate.slot)}`} valueClassName={rarityClass(candidate.rarity)} />
        <MenuItem label="전투력" value={`${signedNumber(comparison.delta)} / ${signedPercent(comparison.deltaPercent)}`} valueClassName={deltaClass} />
      </div>

      <div className="compare-lines">
        <CompareLine label="기본" name={statLabel(candidate.baseStat)} current={current ? enhancedBaseValue(current) : 0} candidate={enhancedBaseValue(candidate)} />
        <CompareLine label="피해" current={current ? Math.round((current.minDmg + current.maxDmg) / 2) : 0} candidate={Math.round((candidate.minDmg + candidate.maxDmg) / 2)} />
        <CompareLine label="명중" current={current?.accuracy ?? 0} candidate={candidate.accuracy} />
        <MenuItem label="강화" value={`+${candidate.upgradeLevel}/${EQUIPMENT_BALANCE.enhancement.maxLevel}`} />
        {candidate.options.length > 0 ? candidate.options.map((option, index) => {
          if (!option.sin) {
            generalIndex += 1;
          }
          const lineIndex = generalIndex;
          const currentValue = current?.options.find((entry) => entry.key === option.key && entry.sin === option.sin)?.value ?? 0;
          const capped = isOptionAtMax(option);
          const line = (
            <CompareLine
              label={option.sin ? "죄옵션" : `옵션${lineIndex + 1}`}
              name={affixLabel(option.key)}
              current={currentValue}
              candidate={option.value}
              sin={option.sin}
              capped={capped}
            />
          );
          return option.sin ? (
            <div key={`${option.key}-${index}`} className={capped ? "option-row static capped" : "option-row static"}>
              <span className="sin-lock">SIN</span>
              {line}
            </div>
          ) : (
            <button
              key={`${option.key}-${index}`}
              type="button"
              className={`${selectedReawakenLines.includes(lineIndex) ? "option-row selectable selected" : "option-row selectable"}${capped ? " capped" : ""}`}
              onClick={() => toggleLine(lineIndex)}
              aria-label={`옵션 ${lineIndex + 1} 재각성 선택`}
            >
              {line}
            </button>
          );
        }) : <MenuItem label="옵션" value="없음" />}
      </div>

      <div className="cost-lines">
        <MenuItem label="강화 비용" value={upgradeCostValue > 0 ? `${formatNumber(upgradeCostValue)}G / 실패 ${Math.round(failChance * 100)}%` : "최대"} />
        <MenuItem label="재각성 비용" value={`${formatNumber(reawakenCostValue.gold)}G / ◆${formatNumber(reawakenCostValue.crystal)}`} />
      </div>

      <div className="popup-menu four">
        <button
          type="button"
          className={entry.location === "shop" ? canBuy ? "inv-vid" : "inv-vid off" : canMutate ? "inv-vid" : "inv-vid off"}
          disabled={entry.location === "shop" ? !canBuy : !canMutate}
          onClick={() => entry.location === "shop" && entry.offerId ? onBuy(entry.offerId) : onEquipToggle(candidate.id)}
        >
          <span className="cur">&#9654;</span>{entry.location === "shop" ? "구매" : entry.location === "equipped" ? "해제" : "장착"}
        </button>
        <button type="button" className={canUpgrade ? "inv-vid" : "inv-vid off"} disabled={!canUpgrade} onClick={() => onUpgrade(candidate.id)}>강화</button>
        <button type="button" className={canSell ? "inv-vid" : "inv-vid off"} disabled={!canSell} onClick={() => onSell(candidate.id)}>판매</button>
        <button
          type="button"
          className={canReawaken ? "inv-vid" : "inv-vid off"}
          disabled={!canReawaken}
          onClick={() => onReawaken(candidate.id, selectedReawakenLines.length > 0 ? selectedReawakenLines : undefined)}
        >
          재각성
        </button>
      </div>
      <button type="button" className="popup-close" onClick={onClose}>닫기</button>
    </PopupFrame>
  );
}

function CompareLine({
  label,
  name,
  current,
  candidate,
  sin = false,
  capped = false,
}: {
  label: string;
  name?: string;
  current: number;
  candidate: number;
  sin?: boolean;
  capped?: boolean;
}) {
  const direction = candidate > current ? "up" : candidate < current ? "down" : "same";
  const valueClassName = capped ? "capc" : direction === "up" ? "goldc" : direction === "down" ? "bloodc" : "";
  return (
    <span className={sin ? "mi compare-line sin-line" : "mi compare-line"}>
      <span>{label}</span>
      <span className="dots" />
      <span className="compare-name">{name ?? ""}</span>
      {direction !== "same" ? <span className={`compare-marker ${direction}`} aria-hidden="true" /> : null}
      <span className={valueClassName ? `v ${valueClassName}` : "v"}>{formatNumber(current)}→{formatNumber(candidate)}</span>
    </span>
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
      <div className="relic-summary">
        <div className="relic-name-line empty kr">유물 없음</div>
        <p className="tiny dim kr">유물을 장착하세요</p>
      </div>
    );
  }

  const relic = RELICS[relicId];
  return (
    <div className="relic-summary">
      <div className="relic-name-line kr">
        <span className="sin-prefix">{SIN_KR_LABELS[relic.sin]}의</span>
        <span>{RELIC_KR_LABELS[relicId]}</span>
      </div>
      <MenuItem label="등급" value={rarityLabel(instance.grade)} valueClassName={rarityClass(instance.grade)} />
      <MenuItem label="별" value={<StarIcons stars={instance.stars} />} />
      <p className="tiny kr">{RELIC_DESC_KR[relicId]}</p>
    </div>
  );
}

function RelicCard({
  relicId,
  grade,
  instance,
  equipped,
  onOpen,
}: {
  relicId: RelicId;
  grade: RelicGrade;
  instance: RelicInstance | null;
  equipped: boolean;
  onOpen: () => void;
}) {
  const relic = RELICS[relicId];
  const stars = instance?.stars ?? 0;
  const required = instance && stars < ALTAR_BALANCE.maxStars ? relicDuplicateRequirementForNextStar(stars) : 0;
  return (
    <button type="button" className={`relic ${rarityClass(grade)}${equipped ? " on" : ""}${instance ? "" : " off"}`} onClick={onOpen}>
      <span className="kr">{instance ? RELIC_KR_LABELS[relicId] : "?"}</span>
      <small className="sin">{rarityLabel(grade)} / <span className="kr">{SIN_KR_LABELS[relic.sin]}</span></small>
      <StarIcons stars={stars} dim={!instance} />
      <small className="st">{instance && required > 0 ? `${instance.duplicateProgress}/${required}` : instance ? "MAX" : "0/?"}</small>
    </button>
  );
}

function RelicInfoPopup({
  relicId,
  grade,
  instance,
  onAwaken,
  onClose,
}: {
  relicId: RelicId;
  grade: RelicGrade;
  instance: RelicInstance | null;
  onAwaken: () => void;
  onClose: () => void;
}) {
  const relic = RELICS[relicId];
  const stars = instance?.stars ?? 0;
  const required = instance && stars < ALTAR_BALANCE.maxStars ? relicDuplicateRequirementForNextStar(stars) : 0;
  const duplicateProgress = instance?.duplicateProgress ?? 0;
  const canAwaken = Boolean(instance && required > 0 && duplicateProgress >= required);

  return (
    <PopupFrame title="유물 정보">
      <MenuItem label="이름" value={<span className="kr">{RELIC_KR_LABELS[relicId]}</span>} />
      <MenuItem label="죄" value={<span className="kr">{SIN_KR_LABELS[relic.sin]}</span>} />
      <MenuItem label="등급" value={rarityLabel(grade)} valueClassName={rarityClass(grade)} />
      <MenuItem label="별" value={<StarIcons stars={stars} dim={!instance} />} />
      <MenuItem label="공격" value={instance ? formatNumber(instance.ownedStats.atk) : "?"} />
      <MenuItem label="체력" value={instance ? formatNumber(instance.ownedStats.hp) : "?"} />
      <MenuItem label="방어" value={instance ? formatNumber(instance.ownedStats.def) : "?"} />
      <p className="popup-voice kr">{RELIC_DESC_KR[relicId]}</p>
      <div className="popup-menu two">
        <button
          type="button"
          className={canAwaken ? "inv-vid" : "inv-vid off"}
          disabled={!canAwaken}
          onClick={onAwaken}
        >
          <span className="cur">&#9654;</span>{stars >= ALTAR_BALANCE.maxStars ? "최대 각성" : `각성 ${duplicateProgress}/${required || "?"}`}
        </button>
        <button type="button" className="inv-vid off" onClick={onClose}>닫기</button>
      </div>
    </PopupFrame>
  );
}

function StarIcons({ stars, dim = false }: { stars: number; dim?: boolean }) {
  return (
    <span className={dim ? "star-icons dim" : "star-icons"}>
      {Array.from({ length: ALTAR_BALANCE.maxStars }).map((_, index) => (
        index < stars
          ? <img key={index} src="/assets/icons/star.png" alt="" />
          : <i key={index} />
      ))}
    </span>
  );
}

function findEquipmentEntry(progress: ProgressState, itemId: string): EquipmentEntry | null {
  const inventoryItem = progress.inventory.items.find((item) => item.id === itemId);
  if (inventoryItem) {
    return { item: inventoryItem, location: "inventory" };
  }

  for (const item of Object.values(progress.inventory.equipped)) {
    if (item?.id === itemId) {
      return { item, location: "equipped" };
    }
  }

  const offer = progress.shop.offers.find((entry) => entry.item.id === itemId);
  return offer ? { item: offer.item, location: "shop", offerId: offer.id, price: offer.price } : null;
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

function equipmentName(item: EquipmentItem): string {
  return `${equipmentDisplayName(item)} +${item.upgradeLevel}`;
}

function affixLabel(key: string): string {
  return AFFIX_KR_LABELS[key] ?? key;
}

function isOptionAtMax(option: ItemOption): boolean {
  if (option.sin) {
    const range = AFFIX_BALANCE.sin[option.key as keyof typeof AFFIX_BALANCE.sin];
    return Boolean(range && option.value >= range.max);
  }

  const range = AFFIX_BALANCE.general[option.key as keyof typeof AFFIX_BALANCE.general];
  return Boolean(range && option.value >= range.max);
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
