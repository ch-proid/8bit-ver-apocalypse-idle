export interface Vec2 {
  x: number;
  y: number;
}

export interface Platform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PlayerAiState = "IDLE" | "MOVE" | "ATTACK";
export type ClassId = "assassin" | "knight" | "mage";
export type StatKey = "str" | "grit" | "agi";
export type EquipmentStatKey = "atk" | "def" | "hp" | "reg";
export type StatPreset = "STR" | "BAL" | "GRIT" | "AGI" | "MANUAL";
export type ItemSlot = "weapon" | "helmet" | "armor" | "accessory";
export type ItemRarity = "common" | "magic" | "rare" | "epic" | "legendary";
export type GeneralAffixKey =
  | "critChance"
  | "critDamage"
  | "attackSpeed"
  | "damageIncrease"
  | "finalDamage"
  | "defPenetration"
  | "lifeSteal"
  | "goldGain"
  | "damageReduction";
export type SinAffixKey =
  | "specterDamage"
  | "bloodLeech"
  | "plagueSpread"
  | "martyrPain"
  | "executionThreshold"
  | "despairBurst";
export type ItemAffixKey = GeneralAffixKey | SinAffixKey;
export type SinId = "pride" | "gluttony" | "grief" | "fanaticism" | "abyss" | "despair";
export type BossId = "lucian" | "gravemaw" | "marcela" | "cardion" | "azar" | "leonid";
export type RelicId =
  | "specterLord"
  | "bloodBerserker"
  | "plagueDoctor"
  | "martyr"
  | "executioner"
  | "kingsShadow";
export type KillType = "normal" | "elite" | "boss";
export type StageMode = "hunt" | "challenge" | "boss";
export type ChallengeFailureReason = "timeout" | "death";
export type MonsterRole = "normal" | "boss" | "bossSummon";

export interface StatAllocation {
  str: number;
  grit: number;
  agi: number;
}

export interface EquipmentStatAllocation {
  atk: number;
  def: number;
  hp: number;
  reg: number;
}

export interface StatDistributionState {
  assigned: StatAllocation;
  unspentPoints: number;
  preset: StatPreset;
}

export interface RecordEntry {
  value: number;
  updatedAt: number | null;
}

export interface ProgressRecords {
  highestLevel: RecordEntry;
  dummyScore: RecordEntry;
  highestRebirthStage: RecordEntry;
}

export interface StageFailureReport {
  stageId: number;
  reason: ChallengeFailureReason;
  recommendedStage: number;
}

export interface StageProgressState {
  unlockedStage: number;
  currentHuntingStage: number;
  clearedStages: Record<number, true>;
  defeatedBossStages: Record<number, true>;
  mode: StageMode;
  autoChallenge: boolean;
  challengeTimer: number;
  lastFailure: StageFailureReport | null;
}

export interface WaveCycleState {
  enabled: boolean;
  currentWaveIndex: number;
  cycle: number;
  completedWaves: number;
  totalKills: number;
  totalWaves: number;
}

export interface RebirthRecord {
  run: number;
  reachedStage: number;
  reachedLevel: number;
  at: number;
}

export interface RebirthState {
  canRebirth: boolean;
  count: number;
  experienceMultiplier: number;
  permanentStats: StatAllocation;
}

export interface ItemOption {
  key: ItemAffixKey;
  value: number;
  sin: boolean;
}

export interface EquipmentItem {
  id: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  itemLevel: number;
  baseStat: EquipmentStatKey;
  baseValue: number;
  minDmg: number;
  maxDmg: number;
  accuracy: number;
  upgradeLevel: number;
  options: ItemOption[];
}

export type EquippedItems = Record<ItemSlot, EquipmentItem | null>;
export type AutoSellSettings = Record<ItemRarity, boolean>;

export interface InventoryState {
  capacity: number;
  nextItemId: number;
  items: EquipmentItem[];
  equipped: EquippedItems;
  autoSell: AutoSellSettings;
}

export interface RerollState {
  countsByItemId: Record<string, number>;
}

export interface ShopOffer {
  id: string;
  item: EquipmentItem;
  price: number;
}

export interface ShopState {
  nextOfferId: number;
  refreshedAt: number;
  offers: ShopOffer[];
}

export interface RngState {
  seed: number;
}

export interface CombatAffixStats {
  critChance: number;
  critDamage: number;
  attackSpeed: number;
  damageIncrease: number;
  finalDamage: number;
  defPenetration: number;
  lifeSteal: number;
  goldGain: number;
  damageReduction: number;
}

export interface SinAffixStats {
  specterDamage: number;
  bloodLeech: number;
  plagueSpread: number;
  martyrPain: number;
  executionThreshold: number;
  despairBurst: number;
}

export interface RelicInstance {
  id: RelicId;
  stars: number;
}

export type OwnedRelics = Partial<Record<RelicId, RelicInstance>>;
export type BossDefeatedFlags = Record<SinId, boolean>;

export interface AltarState {
  blood: number;
  summonCount: number;
  pityProgress: number;
  targetedSummons: number;
  owned: OwnedRelics;
  equippedRelicId: RelicId | null;
  bossDefeated: BossDefeatedFlags;
}

export interface SpecterEntity {
  id: string;
  ttl: number;
  damageMultiplier: number;
}

export interface RelicCombatState {
  specters: SpecterEntity[];
  plagueStacks: Record<string, number>;
  plagueClouds: number;
  executionMarks: Record<string, number>;
  overdriveGauge: number;
  overdriveTimer: number;
  exhaustionTimer: number;
  isOverdrive: boolean;
  bloodLeakPauseTimer: number;
  lastTriggered: string | null;
}

export interface ClassCombatState {
  mageDots: Record<string, { stacks: number; ttl: number }>;
  lastTriggered: string | null;
}

export interface Player {
  position: Vec2;
  velocity: Vec2;
  width: number;
  height: number;
  moveSpeed: number;
  direction: -1 | 1;
  platformId: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  evasion: number;
  hpRegen: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  state: PlayerAiState;
  targetId: string | null;
  jumpLock: number;
}

export interface Monster {
  instanceId: string;
  monsterId: string;
  name: string;
  assetKey: string;
  position: Vec2;
  spawnPosition: Vec2;
  velocity: Vec2;
  platformId: string;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  defense: number;
  damageReduction: number;
  accuracy: number;
  evasion: number;
  attack: number;
  experience: number;
  gold: number;
  moveSpeed: number;
  respawnTime: number;
  respawnTimer: number;
  alive: boolean;
  direction: -1 | 1;
  fadeTimer: number;
  spawnInvulnTimer: number;
  aggro: boolean;
  color: string;
  role: MonsterRole;
  bossId?: BossId;
}

export interface FloatingText {
  id: string;
  position: Vec2;
  value: string;
  color: string;
  age: number;
  ttl: number;
}

export interface ProgressState {
  gold: number;
  experience: number;
  level: number;
  classId: ClassId;
  currentStage: number;
  nextExperience: number;
  statDistribution: StatDistributionState;
  inventory: InventoryState;
  reroll: RerollState;
  shop: ShopState;
  stageProgress: StageProgressState;
  altar: AltarState;
  rebirth: RebirthState;
  rebirthRecords: RebirthRecord[];
  records: ProgressRecords;
}

export interface WorldState {
  elapsed: number;
  rng: RngState;
  relicCombat: RelicCombatState;
  classCombat: ClassCombatState;
  boss: BossCombatState | null;
  wave: WaveCycleState | null;
  platforms: Platform[];
  player: Player;
  monsters: Monster[];
  floatingTexts: FloatingText[];
  nextEntityId: number;
}

export interface BossCombatState {
  bossId: BossId;
  stageId: number;
  phase: number;
  elapsed: number;
  nextMechanicAt: number;
  nextAttackAt: number;
  summonCount: number;
  warningActive: boolean;
  altarCounterAvailable: boolean;
  isEnraged: boolean;
  isWeakened: boolean;
  isTelegraphing: boolean;
  telegraphTimer: number;
  weakenTimer: number;
  enrageTimer: number;
  playerMarked: boolean;
  markTimer: number;
  permanentMark: boolean;
  germinatedSummons: number;
  lastEvent: string | null;
}

export interface SimulationState {
  world: WorldState;
  progress: ProgressState;
}
