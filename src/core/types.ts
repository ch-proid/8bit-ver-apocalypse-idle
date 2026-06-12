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
export type StatKey = "atk" | "def" | "hp" | "reg";
export type StatPreset = "ATK" | "BAL" | "VIT" | "MANUAL";
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

export interface StatAllocation {
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
  baseStat: StatKey;
  baseValue: number;
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
  attack: number;
  experience: number;
  gold: number;
  moveSpeed: number;
  respawnTime: number;
  respawnTimer: number;
  alive: boolean;
  direction: -1 | 1;
  fadeTimer: number;
  color: string;
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
  currentStage: number;
  nextExperience: number;
  statDistribution: StatDistributionState;
  inventory: InventoryState;
  reroll: RerollState;
  shop: ShopState;
  rebirth: RebirthState;
  rebirthRecords: RebirthRecord[];
  records: ProgressRecords;
}

export interface WorldState {
  elapsed: number;
  rng: RngState;
  platforms: Platform[];
  player: Player;
  monsters: Monster[];
  floatingTexts: FloatingText[];
  nextEntityId: number;
}

export interface SimulationState {
  world: WorldState;
  progress: ProgressState;
}
