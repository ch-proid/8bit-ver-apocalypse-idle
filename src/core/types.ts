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
  rebirth: RebirthState;
  rebirthRecords: RebirthRecord[];
  records: ProgressRecords;
}

export interface WorldState {
  elapsed: number;
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
