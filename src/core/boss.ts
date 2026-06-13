import { BOSS_BALANCE, MONSTER_BALANCE } from "../data/balance";
import { BOSS_DEFINITIONS } from "../data/bosses";
import { MONSTERS } from "../data/monsters";
import { addBlood } from "./altar";
import { rollBossDrop } from "./drop";
import { addItemToInventory } from "./inventory";
import { addFloatingText, grantRewards } from "./progression";
import { clearBossStage, continueAutoChallenge } from "./stageProgress";
import type { BossCombatState, BossId, Monster, Platform, ProgressState, SimulationState, WorldState } from "./types";

export function createBossCombatState(bossId: BossId, stageId: number): BossCombatState {
  const interval = bossId === "lucian" ? BOSS_BALANCE.lucian.summonIntervalSeconds : Number.POSITIVE_INFINITY;
  return {
    bossId,
    stageId,
    phase: 1,
    elapsed: 0,
    nextMechanicAt: interval,
    summonCount: 0,
    warningActive: false,
    altarCounterAvailable: bossId === "leonid",
    lastEvent: null,
  };
}

export function createBossMonster(bossId: BossId, platform: Platform): Monster {
  const definition = BOSS_DEFINITIONS[bossId];
  return {
    instanceId: `boss-${bossId}`,
    monsterId: bossId,
    name: definition.name,
    assetKey: `boss.${bossId}`,
    position: { x: platform.x + platform.width / 2 - 12, y: platform.y - 24 },
    spawnPosition: { x: platform.x + platform.width / 2 - 12, y: platform.y - 24 },
    velocity: { x: 0, y: 0 },
    platformId: platform.id,
    width: 24,
    height: 24,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    defense: definition.defense,
    damageReduction: 0,
    attack: definition.attack,
    experience: definition.experience,
    gold: definition.gold,
    moveSpeed: 0,
    respawnTime: 0,
    respawnTimer: 0,
    alive: true,
    direction: -1,
    fadeTimer: 0,
    color: definition.color,
    role: "boss",
    bossId,
  };
}

export function updateBossMechanics(state: SimulationState, dt: number): void {
  const bossState = state.world.boss;
  if (!bossState) {
    return;
  }

  bossState.elapsed += dt;
  if (bossState.bossId === "lucian") {
    updateLucian(state, bossState, dt);
    return;
  }

  // TODO(Phase 3E-2): Implement Gravemaw/Marcela/Cardion/Azar/Leonid mechanics.
}

export function resolveBossDefeat(state: SimulationState, boss: Monster): void {
  if (!boss.bossId) {
    return;
  }

  boss.alive = false;
  boss.fadeTimer = MONSTER_BALANCE.respawnFadeSeconds;
  grantRewards(state.progress, state.world, boss.experience, boss.gold);
  addBlood(state.progress.altar, "boss", state.progress.currentStage);
  const drop = rollBossDrop(state.progress, state.world.rng, boss.bossId);
  addItemToInventory(state.progress, drop);
  clearBossStage(state.progress, state.progress.currentStage);

  if (boss.bossId === "lucian") {
    state.progress.rebirth.canRebirth = true;
    state.progress.altar.bossDefeated.pride = true;
  }

  state.world.boss = null;
  addFloatingText(state.world, "BOSS DOWN", boss.position.x, boss.position.y - 18, "#e0c04a");
  continueAutoChallenge(state.progress);
}

export function isBossMonster(monster: Monster): boolean {
  return monster.role === "boss";
}

export function isBossSummon(monster: Monster): boolean {
  return monster.role === "bossSummon";
}

function updateLucian(state: SimulationState, bossState: BossCombatState, dt: number): void {
  healLucianFromWraiths(state.world, dt);
  if (bossState.elapsed + 0.0001 < bossState.nextMechanicAt) {
    return;
  }

  summonLucianWraiths(state, lucianSummonCount(state.progress));
  bossState.nextMechanicAt += BOSS_BALANCE.lucian.summonIntervalSeconds;
  bossState.summonCount += 1;
  bossState.lastEvent = "LUCIAN_WRAITHS";
}

function healLucianFromWraiths(world: WorldState, dt: number): void {
  const boss = world.monsters.find((monster) => monster.role === "boss" && monster.bossId === "lucian" && monster.alive);
  if (!boss) {
    return;
  }

  const aliveWraiths = world.monsters.filter((monster) => monster.role === "bossSummon" && monster.bossId === "lucian" && monster.alive).length;
  if (aliveWraiths <= 0) {
    return;
  }

  boss.hp = Math.min(
    boss.maxHp,
    boss.hp + boss.maxHp * BOSS_BALANCE.lucian.wraithHealPercentPerSecond * aliveWraiths * dt,
  );
}

function summonLucianWraiths(state: SimulationState, count: number): void {
  const existing = state.world.monsters.filter((monster) => monster.role === "bossSummon" && monster.bossId === "lucian" && monster.alive).length;
  const toSpawn = Math.max(0, Math.min(count, BOSS_BALANCE.lucian.maxSummons - existing));
  const definition = MONSTERS.lucianWraith;
  const boss = state.world.monsters.find((monster) => monster.role === "boss" && monster.bossId === "lucian");
  const platformId = boss?.platformId ?? "floor";
  const baseX = boss?.position.x ?? 120;
  const baseY = boss?.position.y ?? 106;

  for (let i = 0; i < toSpawn; i += 1) {
    const x = baseX - 18 + i * 18;
    const y = baseY + 8;
    state.world.monsters.push({
      instanceId: `lw${state.world.nextEntityId++}`,
      monsterId: definition.id,
      name: definition.name,
      assetKey: definition.assetKey,
      position: { x, y },
      spawnPosition: { x, y },
      velocity: { x: 0, y: 0 },
      platformId,
      width: definition.width,
      height: definition.height,
      hp: BOSS_BALANCE.lucian.wraithHp,
      maxHp: BOSS_BALANCE.lucian.wraithHp,
      defense: 0,
      damageReduction: 0,
      attack: BOSS_BALANCE.lucian.wraithAttack,
      experience: BOSS_BALANCE.lucian.wraithExperience,
      gold: BOSS_BALANCE.lucian.wraithGold,
      moveSpeed: definition.moveSpeed,
      respawnTime: 0,
      respawnTimer: 0,
      alive: true,
      direction: -1,
      fadeTimer: 0,
      color: definition.color,
      role: "bossSummon",
      bossId: "lucian",
    });
  }
}

function lucianSummonCount(progress: ProgressState): number {
  return BOSS_BALANCE.lucian.summonCount
    + (progress.rebirth.count > 0 ? BOSS_BALANCE.lucian.rebirthSummonCountBonus : 0);
}
