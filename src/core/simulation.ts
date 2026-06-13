import { DROP_REWARD_BALANCE, FLOATING_TEXT, MAGE_AI_BALANCE, MONSTER_BALANCE, PLAYER_NAVIGATION } from "../data/balance";
import { DROP_ICON_FOR_EQUIPMENT_SLOT } from "../data/dropIcons";
import { STAGES } from "../data/stages";
import { applyClassAfterHit, applyClassPassiveDamage, cloneClassCombatState } from "./class";
import {
  applyBossKillEffects,
  bossDamageTakenMultiplier,
  bossPlayerAttackCooldownMultiplier,
  bossPlayerRegenMultiplier,
  createBossCombatState,
  createBossMonster,
  isBossMonster,
  isBossSummon,
  resolveBossDefeat,
  updateBossMechanics,
} from "./boss";
import { clampCombatAffixes, dealPlayerDamage, distanceBetween, effectiveAttackCooldown } from "./combat";
import { rollMonsterDrop } from "./drop";
import { calculateCombatAffixStats } from "./equipment";
import { resolveAltarEliteDefeat, updateAltarEliteEncounter } from "./elites";
import { addItemToInventory } from "./inventory";
import { applyGravity, jump, moveAndCollide } from "./physics";
import { addDropIcon, addFloatingText, cloneProgress, gainExperience, grantRewards } from "./progression";
import {
  applyRelicAfterHit,
  applyRelicBeforeAttack,
  applyRelicOnKill,
  applyRelicPassiveDamage,
  cloneRelicCombatState,
  relicDamageHooks,
  updateRelicCombat,
} from "./relics";
import { chance, cloneRngState } from "./rng";
import { addBlood } from "./altar";
import { createInitialWaveState, createStageWaveMonsters, getPlatformById, platformCenterX } from "./stage";
import { clearStage, continueAutoChallenge, failStageChallenge, tickStageChallenge } from "./stageProgress";
import type { ClassId, Monster, Platform, Player, SimulationState } from "./types";

export function stepSimulation(input: SimulationState, dt: number): SimulationState {
  const { world, progress } = input;
  world.elapsed += dt;
  world.player.attackTimer = Math.max(0, world.player.attackTimer - dt);
  world.player.jumpLock = Math.max(0, world.player.jumpLock - dt);
  world.player.hp = Math.min(world.player.maxHp, world.player.hp + world.player.hpRegen * bossPlayerRegenMultiplier(world) * dt);
  updateRelicCombat(progress, world, dt);
  updateBossMechanics(input, dt);
  updateAltarEliteEncounter(input, dt);
  tickStageProgress(input, dt);

  updateMonsters(world.monsters, world.platforms, world.player, dt, Boolean(world.wave?.enabled));
  updatePlayerAi(input, dt);
  advanceWaveIfCleared(input);
  updateFloatingTexts(input, dt);
  updateDropIcons(input, dt);

  return {
    progress: cloneProgress(progress),
    world: {
      ...world,
      rng: cloneRngState(world.rng),
      rewardRng: cloneRngState(world.rewardRng),
      relicCombat: cloneRelicCombatState(world.relicCombat),
      classCombat: cloneClassCombatState(world.classCombat),
      altarElite: world.altarElite ? { ...world.altarElite } : null,
      boss: world.boss ? { ...world.boss } : null,
      wave: world.wave ? { ...world.wave } : null,
      player: {
        ...world.player,
        position: { ...world.player.position },
        velocity: { ...world.player.velocity },
      },
      monsters: world.monsters.map((monster) => ({
        ...monster,
        position: { ...monster.position },
        spawnPosition: { ...monster.spawnPosition },
        velocity: { ...monster.velocity },
      })),
      floatingTexts: world.floatingTexts.map((text) => ({
        ...text,
        position: { ...text.position },
      })),
      dropIcons: world.dropIcons.map((icon) => ({
        ...icon,
        position: { ...icon.position },
      })),
    },
  };
}

function updatePlayerAi(state: SimulationState, dt: number): void {
  const { world, progress } = state;
  const player = world.player;
  const aliveMonsters = world.monsters.filter((monster) => monster.alive);
  const hasPrioritySummon = aliveMonsters.some((monster) => monster.role === "bossSummon");
  const currentTarget = hasPrioritySummon
    ? null
    : aliveMonsters.find((monster) => monster.instanceId === player.targetId);
  const target = currentTarget
    ? currentTarget
    : findNearestMonster(world.monsters, player, progress.classId, world.platforms);

  if (!target) {
    player.state = "IDLE";
    patrolPlayer(state, dt);
    return;
  }

  player.targetId = target.instanceId;
  const passiveResult = applyRelicPassiveDamage(progress, world, target, dt);
  const classPassiveResult = applyClassPassiveDamage(progress, world, target, dt);
  if (passiveResult.extraDamage + classPassiveResult.extraDamage > 0) {
    markMonsterHit(target);
  }
  if (target.hp <= 0) {
    const passiveDamage = passiveResult.extraDamage + classPassiveResult.extraDamage;
    if (passiveDamage > 0) {
      addFloatingText(world, `${Math.floor(passiveDamage)}`, target.position.x + target.width / 2, target.position.y - 2, "#d8e3c8");
    }
    resolveMonsterDeath(state, target);
    return;
  }

  const targetPlatform = getPlatformById(world.platforms, target.platformId);
  const playerPlatform = getPlatformById(world.platforms, player.platformId);
  const distance = distanceBetween(player, target);

  if (progress.classId === "mage" && shouldMageRetreat(player, target, world.platforms)) {
    player.state = "MOVE";
    if (retreatMage(player, target, world.platforms, dt)) {
      applyGravity(player, dt);
      moveAndCollide(player, world.platforms, dt);
      return;
    }
  }

  if (distance <= player.attackRange && canAttackMonster(progress.classId, player, target, world.platforms)) {
    player.state = "ATTACK";
    player.velocity.x = 0;

    if (target.spawnInvulnTimer > 0) {
      applyGravity(player, dt);
      moveAndCollide(player, world.platforms, dt);
      return;
    }

    if (player.attackTimer <= 0) {
      applyRelicBeforeAttack(progress, world);
      const damageResult = dealPlayerDamage(player, target, progress, world);
      const relicResult = applyRelicAfterHit(progress, world, target, damageResult.finalDamage);
      const classResult = applyClassAfterHit(progress, world, target, damageResult.finalDamage);
      let totalDamage = damageResult.finalDamage + relicResult.extraDamage + classResult.extraDamage;
      const bossMultiplier = bossDamageTakenMultiplier(world, target);
      if (bossMultiplier > 1 && totalDamage > 0) {
        const extraBossDamage = Math.floor(totalDamage * (bossMultiplier - 1));
        target.hp = Math.max(0, target.hp - extraBossDamage);
        totalDamage += extraBossDamage;
      }
      const combatAffixes = calculateCombatAffixStats(progress.inventory.equipped);
      const lifeSteal = clampCombatAffixes(combatAffixes).lifeSteal;
      if (lifeSteal > 0 && totalDamage > 0) {
        player.hp = Math.min(player.maxHp, player.hp + totalDamage * lifeSteal / 100);
      }
      if (totalDamage > 0) {
        markMonsterHit(target);
      }
      addFloatingText(world, `${totalDamage}`, target.position.x + target.width / 2, target.position.y - 2, "#d8e3c8");
      const hooks = relicDamageHooks(progress, world, player);
      player.attackTimer = effectiveAttackCooldown(
        player.attackCooldown,
        combatAffixes,
        hooks.cooldownMultiplier * bossPlayerAttackCooldownMultiplier(world),
      );

      if (target.hp <= 0) {
        resolveMonsterDeath(state, target);
      }
    }

    applyGravity(player, dt);
    moveAndCollide(player, world.platforms, dt);
    return;
  }

  if (progress.classId === "mage" && moveMageTowardRange(player, target, world.platforms, dt)) {
    applyGravity(player, dt);
    moveAndCollide(player, world.platforms, dt);
    return;
  }

  player.state = "MOVE";
  const targetCenter = target.position.x + target.width / 2;
  let desiredX = targetCenter;

  if (targetPlatform && playerPlatform && targetPlatform.id !== playerPlatform.id) {
    movePlayerTowardPlatform(player, targetPlatform, world.platforms);
    applyGravity(player, dt);
    moveAndCollide(player, world.platforms, dt);
    return;
  }

  movePlayerToward(player, desiredX);
  applyGravity(player, dt);
  moveAndCollide(player, world.platforms, dt);
}

function patrolPlayer(state: SimulationState, dt: number): void {
  const player = state.world.player;
  const platform = getPlatformById(state.world.platforms, player.platformId);
  if (!platform) {
    return;
  }

  const nextX = player.position.x + player.direction * player.moveSpeed * dt;
  if (nextX < platform.x + 4 || nextX + player.width > platform.x + platform.width - 4) {
    player.direction *= -1;
  }

  player.velocity.x = player.direction * player.moveSpeed;
  applyGravity(player, dt);
  moveAndCollide(player, state.world.platforms, dt);
}

function movePlayerToward(player: SimulationState["world"]["player"], desiredX: number): void {
  const center = player.position.x + player.width / 2;
  const delta = desiredX - center;
  if (Math.abs(delta) < 2) {
    player.velocity.x = 0;
    return;
  }

  player.direction = delta > 0 ? 1 : -1;
  player.velocity.x = player.direction * player.moveSpeed;
}

function movePlayerTowardPlatform(player: Player, targetPlatform: Platform, platforms: Platform[]): boolean {
  const currentPlatform = getPlatformById(platforms, player.platformId);
  if (!currentPlatform) {
    player.velocity.x = 0;
    return false;
  }

  if (currentPlatform.id === targetPlatform.id) {
    movePlayerToward(player, platformCenterX(targetPlatform));
    return true;
  }

  const nextPlatform = nextPlatformToward(platforms, currentPlatform.id, targetPlatform.id);
  if (!nextPlatform) {
    player.velocity.x = 0;
    return false;
  }

  if (nextPlatform.y < currentPlatform.y) {
    const launchX = jumpLaunchCenterX(currentPlatform, nextPlatform, player);
    const airborne = Math.abs(player.velocity.y) > 0.001 || player.position.y + player.height < currentPlatform.y - 1;
    const desiredX = airborne ? platformCenterX(nextPlatform) : launchX;
    movePlayerToward(player, desiredX);

    if (!airborne && Math.abs(player.position.x + player.width / 2 - launchX) <= PLAYER_NAVIGATION.jumpLaunchTolerance) {
      jump(player);
    }
    return true;
  }

  if (nextPlatform.y > currentPlatform.y) {
    movePlayerToward(player, platformExitTarget(currentPlatform, player, platformCenterX(nextPlatform)));
    return true;
  }

  movePlayerToward(player, platformCenterX(nextPlatform));
  return true;
}

function nextPlatformToward(platforms: Platform[], fromId: string, targetId: string): Platform | null {
  const route = platformRoute(platforms, fromId, targetId);
  if (route.length < 2) {
    return null;
  }

  return getPlatformById(platforms, route[1]) ?? null;
}

function platformRouteDistance(platforms: Platform[], fromId: string, targetId: string): number {
  if (fromId === targetId) {
    return 0;
  }

  const route = platformRoute(platforms, fromId, targetId);
  return route.length > 0 ? route.length - 1 : Number.POSITIVE_INFINITY;
}

function platformRoute(platforms: Platform[], fromId: string, targetId: string): string[] {
  if (fromId === targetId) {
    return [fromId];
  }

  const queue: string[][] = [[fromId]];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const route = queue.shift() ?? [];
    const currentId = route[route.length - 1];
    const current = getPlatformById(platforms, currentId);
    if (!current) {
      continue;
    }

    for (const adjacentId of current.adjacentPlatformIds) {
      if (visited.has(adjacentId)) {
        continue;
      }
      const adjacent = getPlatformById(platforms, adjacentId);
      if (!adjacent || !canTraversePlatformEdge(current, adjacent)) {
        continue;
      }

      const nextRoute = [...route, adjacentId];
      if (adjacentId === targetId) {
        return nextRoute;
      }

      visited.add(adjacentId);
      queue.push(nextRoute);
    }
  }

  return [];
}

function canTraversePlatformEdge(from: Platform, to: Platform): boolean {
  if (to.y < from.y) {
    return from.y - to.y <= PLAYER_NAVIGATION.jumpReachHeight;
  }

  return true;
}

function jumpLaunchCenterX(from: Platform, to: Platform, player: Player): number {
  const padding = PLAYER_NAVIGATION.platformEdgePadding;
  const fromMin = from.x + player.width / 2 + padding;
  const fromMax = from.x + from.width - player.width / 2 - padding;
  const toMin = to.x + player.width / 2;
  const toMax = to.x + to.width - player.width / 2;
  const overlapMin = Math.max(fromMin, toMin);
  const overlapMax = Math.min(fromMax, toMax);

  if (overlapMin <= overlapMax) {
    return (overlapMin + overlapMax) / 2;
  }

  return platformCenterX(to) < platformCenterX(from) ? fromMin : fromMax;
}

function platformExitTarget(platform: Platform, player: Player, targetX: number): number {
  const platformCenter = platformCenterX(platform);

  if (targetX >= platformCenter) {
    return platform.x + platform.width + player.width + 8;
  }

  return platform.x - player.width - 8;
}

function moveMageTowardRange(
  player: SimulationState["world"]["player"],
  target: Monster,
  platforms: SimulationState["world"]["platforms"],
  dt: number,
): boolean {
  player.state = "MOVE";
  const horizontalDistance = Math.abs((target.position.x + target.width / 2) - (player.position.x + player.width / 2));

  if (distanceBetween(player, target) <= player.attackRange && canAttackMonster("mage", player, target, platforms)) {
    player.state = "ATTACK";
    player.velocity.x = 0;
    return true;
  }

  if (target.platformId === player.platformId && horizontalDistance < MAGE_AI_BALANCE.tooCloseDistance) {
    return retreatMage(player, target, platforms, dt);
  }

  if (target.platformId !== player.platformId) {
    const targetPlatform = getPlatformById(platforms, target.platformId);
    if (targetPlatform) {
      movePlayerTowardPlatform(player, targetPlatform, platforms);
    } else {
      player.velocity.x = 0;
    }
    return true;
  }

  movePlayerToward(player, target.position.x + target.width / 2);
  return true;
}

function shouldMageRetreat(
  player: SimulationState["world"]["player"],
  target: Monster,
  platforms: SimulationState["world"]["platforms"],
): boolean {
  if (target.platformId !== player.platformId) {
    return false;
  }

  const platform = getPlatformById(platforms, player.platformId);
  if (!platform) {
    return false;
  }

  const horizontalDistance = Math.abs((target.position.x + target.width / 2) - (player.position.x + player.width / 2));
  return horizontalDistance < MAGE_AI_BALANCE.tooCloseDistance;
}

function retreatMage(
  player: SimulationState["world"]["player"],
  target: Monster,
  platforms: SimulationState["world"]["platforms"],
  dt: number,
): boolean {
  const platform = getPlatformById(platforms, player.platformId);
  if (!platform) {
    return false;
  }

  const playerCenter = player.position.x + player.width / 2;
  const targetCenter = target.position.x + target.width / 2;
  const direction = playerCenter >= targetCenter ? 1 : -1;
  const minX = platform.x + MAGE_AI_BALANCE.retreatDistance;
  const maxX = platform.x + platform.width - player.width - MAGE_AI_BALANCE.retreatDistance;
  const projectedX = player.position.x + direction * player.moveSpeed * dt;

  if (projectedX < minX || projectedX > maxX) {
    player.velocity.x = 0;
    return false;
  }

  player.direction = direction;
  player.velocity.x = direction * player.moveSpeed;
  return true;
}

function markMonsterHit(monster: Monster): void {
  monster.aggro = true;
  monster.aggroDelayTimer = 0;
  monster.hitSlowTimer = MONSTER_BALANCE.hitSlowSeconds;
}

function findNearestMonster(
  monsters: Monster[],
  player: SimulationState["world"]["player"],
  classId: ClassId,
  platforms: SimulationState["world"]["platforms"],
): Monster | null {
  let best: Monster | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const x = player.position.x;
  const y = player.position.y;

  for (const monster of monsters) {
    if (!monster.alive) {
      continue;
    }
    const routeDistance = platformRouteDistance(platforms, player.platformId, monster.platformId);
    if (routeDistance === Number.POSITIVE_INFINITY) {
      continue;
    }
    const rolePriority = monster.role === "bossSummon" ? 0 : monster.role === "elite" ? 1 : monster.role === "boss" ? 2 : 3;
    const samePlatformPriority = monster.platformId === player.platformId ? 0 : 1;
    const mageAttackPriority = classId === "mage" && canAttackMonster(classId, player, monster, platforms) ? 0 : 1;
    const platformPriority = samePlatformPriority * 1000 + mageAttackPriority * 100 + routeDistance * 10;
    const score = rolePriority * 100000 + platformPriority * 1000 + Math.abs(monster.position.x - x) + Math.abs(monster.position.y - y) * 1.8;
    if (score < bestScore) {
      best = monster;
      bestScore = score;
    }
  }

  return best;
}

function canAttackMonster(
  classId: ClassId,
  player: SimulationState["world"]["player"],
  monster: Monster,
  platforms: SimulationState["world"]["platforms"],
): boolean {
  if (monster.platformId === player.platformId) {
    return true;
  }

  if (classId !== "mage") {
    return false;
  }

  const playerPlatform = getPlatformById(platforms, player.platformId);
  const monsterPlatform = getPlatformById(platforms, monster.platformId);
  if (!playerPlatform || !monsterPlatform) {
    return false;
  }

  const layerDelta = monsterPlatform.layer - playerPlatform.layer;
  return layerDelta >= 0 && layerDelta <= MAGE_AI_BALANCE.verticalRange;
}

function updateMonsters(
  monsters: Monster[],
  platforms: SimulationState["world"]["platforms"],
  player: SimulationState["world"]["player"],
  dt: number,
  waveCycleEnabled: boolean,
): void {
  for (const monster of monsters) {
    if (!monster.alive) {
      monster.respawnTimer -= dt;
      monster.fadeTimer = Math.max(0, monster.fadeTimer - dt);
      if (!waveCycleEnabled && monster.role === "normal" && monster.respawnTimer <= 0) {
        respawnMonster(monster);
      }
      continue;
    }

    if (monster.spawnInvulnTimer > 0) {
      monster.spawnInvulnTimer = Math.max(0, monster.spawnInvulnTimer - dt);
      continue;
    }
    monster.hitSlowTimer = Math.max(0, monster.hitSlowTimer - dt);

    const platform = getPlatformById(platforms, monster.platformId);
    if (!platform) {
      continue;
    }

    if (!monster.aggro && monster.aggroDelayTimer > 0) {
      monster.aggroDelayTimer = Math.max(0, monster.aggroDelayTimer - dt);
      monster.aggro = monster.aggroDelayTimer <= 0;
    }

    if (monster.aggro) {
      if (monster.platformId === player.platformId) {
        const playerCenter = player.position.x + player.width / 2;
        const monsterCenter = monster.position.x + monster.width / 2;
        const delta = playerCenter - monsterCenter;
        if (Math.abs(delta) > 1) {
          monster.direction = delta > 0 ? 1 : -1;
        }
      }
    }

    const slowMultiplier = monster.hitSlowTimer > 0 ? MONSTER_BALANCE.hitSlowMoveMultiplier : 1;
    monster.position.x += monster.direction * monster.moveSpeed * slowMultiplier * dt;
    const minX = platform.x + 3;
    const maxX = platform.x + platform.width - monster.width - 3;
    if (monster.position.x <= minX) {
      monster.position.x = minX;
      monster.direction = 1;
    } else if (monster.position.x >= maxX) {
      monster.position.x = maxX;
      monster.direction = -1;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function killMonster(state: SimulationState, monster: Monster): void {
  monster.alive = false;
  monster.respawnTimer = monster.respawnTime;
  monster.fadeTimer = MONSTER_BALANCE.respawnFadeSeconds;
  monster.spawnInvulnTimer = 0;
  monster.hitSlowTimer = 0;
  monster.aggro = false;
  monster.aggroDelayTimer = 0;
}

function resolveMonsterDeath(state: SimulationState, monster: Monster): void {
  applyBossKillEffects(state, monster);

  if (isBossSummon(monster)) {
    killMonster(state, monster);
    return;
  }

  if (isBossMonster(monster)) {
    resolveBossDefeat(state, monster);
    return;
  }

  if (monster.role === "elite") {
    applyRelicOnKill(state.progress, state.world, monster);
    resolveAltarEliteDefeat(state, monster);
    return;
  }

  killMonster(state, monster);
  gainExperience(state.progress, state.world, monster.experience);
  applyRelicOnKill(state.progress, state.world, monster);
  grantDrop(state);
  grantProbabilisticKillRewards(state, monster);
  if (state.world.wave) {
    state.world.wave.totalKills += 1;
  }
  advanceWaveIfCleared(state);
}

function grantProbabilisticKillRewards(state: SimulationState, monster: Monster): void {
  const x = monster.position.x + monster.width / 2;
  const y = monster.position.y - 6;

  if (chance(state.world.rewardRng, DROP_REWARD_BALANCE.goldChance)) {
    grantRewards(state.progress, state.world, 0, monster.gold);
    addDropIcon(state.world, "gold", x, y);
  }

  if (chance(state.world.rewardRng, DROP_REWARD_BALANCE.bloodChance)) {
    addBlood(state.progress.altar, "normal", state.progress.currentStage);
    addDropIcon(state.world, "blood", x, y);
  }

  if (chance(state.world.rewardRng, DROP_REWARD_BALANCE.healChance) && state.world.player.hp < state.world.player.maxHp) {
    const healAmount = Math.max(1, Math.floor(state.world.player.maxHp * DROP_REWARD_BALANCE.healMaxHpPercent / 100));
    state.world.player.hp = Math.min(state.world.player.maxHp, state.world.player.hp + healAmount);
    addDropIcon(state.world, "heal", x, y);
  }
}

function grantDrop(state: SimulationState): void {
  const item = rollMonsterDrop(state.progress, state.world.rng);
  if (!item) {
    return;
  }

  const result = addItemToInventory(state.progress, item);
  void result;
  addDropIcon(
    state.world,
    DROP_ICON_FOR_EQUIPMENT_SLOT[item.slot],
    state.world.player.position.x + state.world.player.width / 2,
    state.world.player.position.y - 8,
  );
}

function tickStageProgress(state: SimulationState, dt: number): void {
  if (state.progress.stageProgress.mode !== "challenge" && state.progress.stageProgress.mode !== "boss") {
    return;
  }

  if (state.world.player.hp <= 0) {
    failStageChallenge(state.progress, state.progress.currentStage, "death");
    return;
  }

  tickStageChallenge(state.progress, dt);
}

function advanceWaveIfCleared(state: SimulationState): void {
  const wave = state.world.wave;
  if (!wave?.enabled) {
    return;
  }

  if (state.world.altarElite) {
    return;
  }

  const hasAliveNormal = state.world.monsters.some((item) => item.role === "normal" && item.alive);
  if (hasAliveNormal) {
    return;
  }

  const stage = STAGES[state.progress.currentStage];
  if (!stage || stage.isBoss) {
    return;
  }

  const completedStageId = stage.id;
  const isFinalWave = wave.currentWaveIndex >= wave.totalWaves - 1;
  wave.completedWaves += 1;

  if (state.progress.stageProgress.mode === "challenge" && isFinalWave) {
    clearStage(state.progress, completedStageId);
    continueAutoChallenge(state.progress);
  }

  const nextStage = STAGES[state.progress.currentStage];
  if (!nextStage) {
    state.world.wave = null;
    state.world.monsters = [];
    state.world.player.targetId = null;
    return;
  }

  if (nextStage.isBoss && nextStage.bossId) {
    const floor = getPlatformById(state.world.platforms, "floor") ?? state.world.platforms[0];
    state.world.wave = null;
    state.world.boss = createBossCombatState(nextStage.bossId, nextStage.id);
    state.world.monsters = [createBossMonster(nextStage.bossId, floor)];
    state.world.player.targetId = null;
    return;
  }

  if (state.progress.currentStage !== completedStageId) {
    state.world.wave = createInitialWaveState(nextStage);
    state.world.boss = null;
  } else if (isFinalWave) {
    wave.cycle += 1;
    wave.currentWaveIndex = 0;
  } else {
    wave.currentWaveIndex += 1;
  }

  state.world.monsters = createStageWaveMonsters(
    nextStage,
    state.world.platforms,
    state.world.wave,
    () => state.world.nextEntityId++,
    state.world.rng,
  );
  state.world.player.targetId = null;
}

function respawnMonster(monster: Monster): void {
  monster.alive = true;
  monster.hp = monster.maxHp;
  monster.position.x = monster.spawnPosition.x;
  monster.position.y = monster.spawnPosition.y;
  monster.direction *= -1;
  monster.fadeTimer = 0;
  monster.spawnInvulnTimer = MONSTER_BALANCE.spawnIntroSeconds;
  monster.hitSlowTimer = 0;
  monster.aggro = false;
  monster.aggroDelayTimer = MONSTER_BALANCE.autoAggroSeconds;
}

function updateFloatingTexts(state: SimulationState, dt: number): void {
  for (const text of state.world.floatingTexts) {
    text.age += dt;
    text.position.y -= FLOATING_TEXT.riseSpeed * dt;
  }

  state.world.floatingTexts = state.world.floatingTexts.filter((text) => text.age <= text.ttl);
}

function updateDropIcons(state: SimulationState, dt: number): void {
  for (const icon of state.world.dropIcons) {
    icon.age += dt;
    icon.position.y -= DROP_REWARD_BALANCE.iconRiseSpeed * dt;
  }

  state.world.dropIcons = state.world.dropIcons.filter((icon) => icon.age <= icon.ttl);
}
