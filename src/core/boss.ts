import { BOSS_BALANCE, MONSTER_BALANCE } from "../data/balance";
import { BOSS_DEFINITIONS } from "../data/bosses";
import { MONSTERS } from "../data/monsters";
import { addBlood } from "./altar";
import { rollPlayerEvasion } from "./combat";
import { rollBossDrop } from "./drop";
import { addItemToInventory } from "./inventory";
import { addFloatingText, grantRewards } from "./progression";
import { clearBossStage, continueAutoChallenge } from "./stageProgress";
import type { BossCombatState, BossId, Monster, Platform, ProgressState, SimulationState, WorldState } from "./types";

export function createBossCombatState(bossId: BossId, stageId: number): BossCombatState {
  const interval = initialMechanicInterval(bossId);
  return {
    bossId,
    stageId,
    phase: 1,
    elapsed: 0,
    nextMechanicAt: interval,
    nextAttackAt: BOSS_BALANCE.common.attackIntervalSeconds,
    summonCount: 0,
    warningActive: false,
    altarCounterAvailable: bossId === "leonid",
    isEnraged: false,
    isWeakened: false,
    isTelegraphing: false,
    telegraphTimer: 0,
    weakenTimer: 0,
    enrageTimer: 0,
    playerMarked: false,
    markTimer: 0,
    permanentMark: false,
    germinatedSummons: 0,
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
    accuracy: bossAccuracy(definition.chapter),
    evasion: bossEvasion(definition.chapter),
    attack: definition.attack,
    experience: definition.experience,
    gold: definition.gold,
    moveSpeed: 0,
    respawnTime: 0,
    respawnTimer: 0,
    alive: true,
    direction: -1,
    fadeTimer: 0,
    spawnInvulnTimer: 0,
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
  tickBossTimers(bossState, dt);

  switch (bossState.bossId) {
    case "lucian":
      updateLucian(state, bossState, dt);
      return;
    case "gravemaw":
      updateGravemaw(state, bossState, dt);
      return;
    case "marcela":
      updateMarcela(state, bossState, dt);
      return;
    case "cardion":
      updateCardion(state, bossState);
      updateBossAttack(state, bossState, dt, cardionDamageMultiplier(bossState), cardionCooldownMultiplier(bossState));
      return;
    case "azar":
      updateAzar(state, bossState, dt);
      updateBossAttack(state, bossState, dt, azarDamageMultiplier(bossState), 1);
      return;
    case "leonid":
      updateLeonid(state, bossState, dt);
      updateBossAttack(state, bossState, dt, leonidDamageMultiplier(bossState), 1);
      return;
  }
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

  const definition = BOSS_DEFINITIONS[boss.bossId];
  state.progress.altar.bossDefeated[definition.sin] = true;

  if (boss.bossId === "lucian") {
    state.progress.rebirth.canRebirth = true;
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

export function bossPlayerRegenMultiplier(world: WorldState): number {
  const bossState = world.boss;
  if (bossState?.bossId === "cardion" && bossState.isEnraged) {
    return BOSS_BALANCE.cardion.playerRegenMultiplier;
  }

  return 1;
}

export function bossPlayerAttackCooldownMultiplier(world: WorldState): number {
  const bossState = world.boss;
  if (bossState?.bossId === "azar" && bossState.playerMarked) {
    return 1 / (1 - BOSS_BALANCE.azar.markAttackSpeedPenalty / 100);
  }

  return 1;
}

export function bossDamageTakenMultiplier(world: WorldState, monster: Monster): number {
  const bossState = world.boss;
  if (bossState?.bossId === "leonid" && monster.role === "boss" && monster.bossId === "leonid" && bossState.isWeakened) {
    return BOSS_BALANCE.leonid.weakenDamageTakenMultiplier;
  }

  return 1;
}

export function applyBossKillEffects(state: SimulationState, monster: Monster): void {
  const bossState = state.world.boss;
  if (bossState?.bossId !== "azar" || !bossState.playerMarked) {
    return;
  }

  bossState.playerMarked = bossState.permanentMark;
  bossState.markTimer = bossState.permanentMark ? Number.POSITIVE_INFINITY : 0;
  state.world.player.hp = Math.min(
    state.world.player.maxHp,
    state.world.player.hp + state.world.player.maxHp * BOSS_BALANCE.azar.markHealPercent,
  );
  bossState.lastEvent = monster.role === "boss" ? "AZAR_MARK_CLEARED_ON_BOSS" : "AZAR_MARK_CLEARED";
}

export function triggerAltarCounter(state: SimulationState): boolean {
  const bossState = state.world.boss;
  if (!bossState || bossState.bossId !== "leonid" || !bossState.isTelegraphing) {
    return false;
  }
  if (state.progress.altar.blood < BOSS_BALANCE.leonid.altarCounterBloodCost) {
    return false;
  }

  state.progress.altar.blood -= BOSS_BALANCE.leonid.altarCounterBloodCost;
  bossState.isTelegraphing = false;
  bossState.warningActive = false;
  bossState.telegraphTimer = 0;
  bossState.isWeakened = true;
  bossState.weakenTimer = BOSS_BALANCE.leonid.weakenDurationSeconds;
  bossState.nextMechanicAt = bossState.elapsed + leonidTelegraphPeriod(state);
  bossState.lastEvent = "LEONID_COUNTER_SUCCESS";
  return true;
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

function updateGravemaw(state: SimulationState, bossState: BossCombatState, dt: number): void {
  const boss = findAliveBoss(state.world, "gravemaw");
  if (!boss) {
    return;
  }

  const lowHpMultiplier = boss.hp <= boss.maxHp * BOSS_BALANCE.gravemaw.lowHpThreshold
    ? BOSS_BALANCE.gravemaw.lowHpHealMultiplier
    : 1;
  const rebirthMultiplier = state.progress.rebirth.count > 0 ? BOSS_BALANCE.gravemaw.rebirthHealMultiplier : 1;
  const heal = boss.maxHp * BOSS_BALANCE.gravemaw.healPercentPerSecond * lowHpMultiplier * rebirthMultiplier * dt;
  boss.hp = Math.min(boss.maxHp, boss.hp + heal);
  bossState.phase = lowHpMultiplier > 1 ? 2 : 1;
  bossState.lastEvent = lowHpMultiplier > 1 ? "GRAVEMAW_REGEN_FAST" : "GRAVEMAW_REGEN";
}

function updateMarcela(state: SimulationState, bossState: BossCombatState, dt: number): void {
  updateMarcelaSeeds(state, bossState, dt);
  if (bossState.elapsed + 0.0001 < bossState.nextMechanicAt) {
    return;
  }

  summonMarcelaSeeds(state, marcelaSeedCount(state.progress));
  bossState.nextMechanicAt += BOSS_BALANCE.marcela.seedIntervalSeconds;
  bossState.summonCount += 1;
  bossState.lastEvent = "MARCELA_SEEDS";
}

function updateCardion(state: SimulationState, bossState: BossCombatState): void {
  const boss = findAliveBoss(state.world, "cardion");
  if (!boss) {
    return;
  }

  const shouldEnrage = boss.hp <= boss.maxHp * BOSS_BALANCE.cardion.enrageThreshold;
  if (shouldEnrage && !bossState.isEnraged) {
    bossState.isEnraged = true;
    bossState.phase = 2;
    bossState.lastEvent = "CARDION_ENRAGE";
  }
}

function updateAzar(state: SimulationState, bossState: BossCombatState, dt: number): void {
  const boss = findAliveBoss(state.world, "azar");
  if (!boss) {
    return;
  }

  if (boss.hp <= boss.maxHp * BOSS_BALANCE.azar.phaseTwoThreshold) {
    bossState.phase = 2;
    bossState.permanentMark = true;
    bossState.playerMarked = true;
    bossState.markTimer = Number.POSITIVE_INFINITY;
    boss.defense = Math.floor(BOSS_DEFINITIONS.azar.defense * BOSS_BALANCE.azar.phaseTwoDefenseMultiplier);
    bossState.lastEvent = "AZAR_PHASE_TWO";
    return;
  }

  if (bossState.playerMarked && !bossState.permanentMark) {
    bossState.markTimer = Math.max(0, bossState.markTimer - dt);
    if (bossState.markTimer <= 0) {
      bossState.playerMarked = false;
      bossState.lastEvent = "AZAR_MARK_EXPIRED";
    }
  }

  if (bossState.elapsed + 0.0001 < bossState.nextMechanicAt || bossState.playerMarked) {
    return;
  }

  bossState.playerMarked = true;
  bossState.markTimer = BOSS_BALANCE.azar.markIntervalSeconds;
  bossState.nextMechanicAt += BOSS_BALANCE.azar.markIntervalSeconds;
  bossState.lastEvent = "AZAR_MARK";
}

function updateLeonid(state: SimulationState, bossState: BossCombatState, _dt: number): void {
  const boss = findAliveBoss(state.world, "leonid");
  if (!boss) {
    return;
  }

  const phaseTwo = boss.hp <= boss.maxHp * BOSS_BALANCE.leonid.phaseTwoThreshold;
  if (!phaseTwo) {
    return;
  }

  bossState.phase = 2;
  if (bossState.nextMechanicAt === Number.POSITIVE_INFINITY && !bossState.isTelegraphing) {
    startLeonidTelegraph(bossState);
    return;
  }

  if (bossState.isTelegraphing && bossState.telegraphTimer <= 0.0001) {
    bossState.isTelegraphing = false;
    bossState.warningActive = false;
    bossState.isEnraged = true;
    bossState.enrageTimer = BOSS_BALANCE.leonid.enrageDurationSeconds;
    bossState.nextMechanicAt = bossState.elapsed + leonidTelegraphPeriod(state);
    bossState.lastEvent = "LEONID_COUNTER_MISSED";
    return;
  }

  if (!bossState.isTelegraphing && !bossState.isEnraged && !bossState.isWeakened && bossState.elapsed + 0.0001 >= bossState.nextMechanicAt) {
    startLeonidTelegraph(bossState);
  }
}

function updateBossAttack(
  state: SimulationState,
  bossState: BossCombatState,
  _dt: number,
  damageMultiplier: number,
  cooldownMultiplier: number,
): void {
  const boss = findAliveBoss(state.world, bossState.bossId);
  if (!boss || bossState.elapsed + 0.0001 < bossState.nextAttackAt) {
    return;
  }

  const markedMultiplier = bossState.bossId === "azar" && bossState.playerMarked
    ? 1 + BOSS_BALANCE.azar.markDamageTakenBonus / 100
    : 1;
  if (rollPlayerEvasion(state.world.player, boss.accuracy, state.world.rng)) {
    bossState.nextAttackAt += BOSS_BALANCE.common.attackIntervalSeconds * cooldownMultiplier;
    bossState.lastEvent = `${bossState.bossId.toUpperCase()}_MISS`;
    return;
  }

  const rawDamage = boss.attack * damageMultiplier * markedMultiplier;
  const mitigatedDamage = Math.max(1, Math.floor(rawDamage - state.world.player.defense * BOSS_BALANCE.common.defenseDamageReduction));
  state.world.player.hp = Math.max(0, state.world.player.hp - mitigatedDamage);
  bossState.nextAttackAt += BOSS_BALANCE.common.attackIntervalSeconds * cooldownMultiplier;
  bossState.lastEvent = `${bossState.bossId.toUpperCase()}_HIT`;
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
      accuracy: definition.accuracy,
      evasion: definition.evasion,
      attack: BOSS_BALANCE.lucian.wraithAttack,
      experience: BOSS_BALANCE.lucian.wraithExperience,
      gold: BOSS_BALANCE.lucian.wraithGold,
      moveSpeed: definition.moveSpeed,
      respawnTime: 0,
      respawnTimer: 0,
      alive: true,
      direction: -1,
      fadeTimer: 0,
      spawnInvulnTimer: 0,
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

function updateMarcelaSeeds(state: SimulationState, bossState: BossCombatState, dt: number): void {
  for (const seed of state.world.monsters) {
    if (seed.role !== "bossSummon" || seed.bossId !== "marcela" || !seed.alive) {
      continue;
    }

    seed.respawnTimer += dt;
    if (seed.respawnTimer < BOSS_BALANCE.marcela.seedGerminateSeconds) {
      continue;
    }

    if (seed.fadeTimer === 0) {
      bossState.germinatedSummons += 1;
      seed.fadeTimer = 1;
      seed.color = "#9bcf63";
      bossState.lastEvent = "MARCELA_SEED_GERMINATED";
    }
    state.world.player.hp = Math.max(
      0,
      state.world.player.hp - BOSS_BALANCE.marcela.dotDamagePerSecond * dt,
    );
  }
}

function summonMarcelaSeeds(state: SimulationState, count: number): void {
  const existing = state.world.monsters.filter((monster) => monster.role === "bossSummon" && monster.bossId === "marcela" && monster.alive).length;
  const toSpawn = Math.max(0, Math.min(count, BOSS_BALANCE.marcela.maxSeeds - existing));
  const definition = MONSTERS.marcelaSeed;
  const boss = findAliveBoss(state.world, "marcela");
  const platformId = boss?.platformId ?? "floor";
  const baseX = boss?.position.x ?? 120;
  const baseY = boss?.position.y ?? 106;

  for (let i = 0; i < toSpawn; i += 1) {
    const x = baseX - 18 + i * 12;
    const y = baseY + 14;
    state.world.monsters.push({
      instanceId: `ms${state.world.nextEntityId++}`,
      monsterId: definition.id,
      name: definition.name,
      assetKey: definition.assetKey,
      position: { x, y },
      spawnPosition: { x, y },
      velocity: { x: 0, y: 0 },
      platformId,
      width: definition.width,
      height: definition.height,
      hp: BOSS_BALANCE.marcela.seedHp,
      maxHp: BOSS_BALANCE.marcela.seedHp,
      defense: 0,
      damageReduction: 0,
      accuracy: definition.accuracy,
      evasion: definition.evasion,
      attack: BOSS_BALANCE.marcela.seedAttack,
      experience: 0,
      gold: 0,
      moveSpeed: definition.moveSpeed,
      respawnTime: 0,
      respawnTimer: 0,
      alive: true,
      direction: -1,
      fadeTimer: 0,
      spawnInvulnTimer: 0,
      color: definition.color,
      role: "bossSummon",
      bossId: "marcela",
    });
  }
}

function marcelaSeedCount(progress: ProgressState): number {
  return BOSS_BALANCE.marcela.seedCount
    + (progress.rebirth.count > 0 ? BOSS_BALANCE.marcela.rebirthSeedCountBonus : 0);
}

function tickBossTimers(bossState: BossCombatState, dt: number): void {
  if (bossState.isTelegraphing) {
    bossState.telegraphTimer = Math.max(0, bossState.telegraphTimer - dt);
  }
  if (bossState.isWeakened) {
    bossState.weakenTimer = Math.max(0, bossState.weakenTimer - dt);
    if (bossState.weakenTimer <= 0) {
      bossState.isWeakened = false;
      bossState.lastEvent = "BOSS_WEAKEN_END";
    }
  }
  if (bossState.isEnraged && bossState.bossId === "leonid") {
    bossState.enrageTimer = Math.max(0, bossState.enrageTimer - dt);
    if (bossState.enrageTimer <= 0) {
      bossState.isEnraged = false;
      bossState.lastEvent = "LEONID_ENRAGE_END";
    }
  }
}

function initialMechanicInterval(bossId: BossId): number {
  switch (bossId) {
    case "lucian":
      return BOSS_BALANCE.lucian.summonIntervalSeconds;
    case "marcela":
      return BOSS_BALANCE.marcela.seedIntervalSeconds;
    case "azar":
      return BOSS_BALANCE.azar.markIntervalSeconds;
    case "leonid":
      return Number.POSITIVE_INFINITY;
    case "gravemaw":
    case "cardion":
      return Number.POSITIVE_INFINITY;
  }
}

function cardionDamageMultiplier(bossState: BossCombatState): number {
  return bossState.isEnraged ? BOSS_BALANCE.cardion.damageMultiplier : 1;
}

function cardionCooldownMultiplier(bossState: BossCombatState): number {
  return bossState.isEnraged ? BOSS_BALANCE.cardion.attackCooldownMultiplier : 1;
}

function azarDamageMultiplier(_bossState: BossCombatState): number {
  return 1;
}

function leonidDamageMultiplier(bossState: BossCombatState): number {
  return bossState.isEnraged ? BOSS_BALANCE.leonid.enrageDamageMultiplier : 1;
}

function startLeonidTelegraph(bossState: BossCombatState): void {
  bossState.isTelegraphing = true;
  bossState.warningActive = true;
  bossState.telegraphTimer = BOSS_BALANCE.leonid.telegraphDurationSeconds;
  bossState.lastEvent = "LEONID_TELEGRAPH";
}

function leonidTelegraphPeriod(state: SimulationState): number {
  const boss = findAliveBoss(state.world, "leonid");
  const hpRatio = boss ? boss.hp / boss.maxHp : 1;
  const entry = BOSS_BALANCE.leonid.telegraphPeriods.find((item) => hpRatio <= item.hpThreshold);
  return entry?.seconds ?? BOSS_BALANCE.leonid.telegraphPeriods[BOSS_BALANCE.leonid.telegraphPeriods.length - 1].seconds;
}

function findAliveBoss(world: WorldState, bossId: BossId): Monster | undefined {
  return world.monsters.find((monster) => monster.role === "boss" && monster.bossId === bossId && monster.alive);
}

function bossAccuracy(chapter: number): number {
  return BOSS_BALANCE.common.accuracyBase + Math.max(0, chapter - 1) * BOSS_BALANCE.common.accuracyPerChapter;
}

function bossEvasion(chapter: number): number {
  return BOSS_BALANCE.common.evasionBase + Math.max(0, chapter - 1) * BOSS_BALANCE.common.evasionPerChapter;
}
