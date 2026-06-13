import { FLOATING_TEXT, MONSTER_BALANCE } from "../data/balance";
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
import { addItemToInventory } from "./inventory";
import { applyGravity, jump, moveAndCollide } from "./physics";
import { addFloatingText, cloneProgress, grantRewards } from "./progression";
import {
  applyRelicAfterHit,
  applyRelicBeforeAttack,
  applyRelicOnKill,
  applyRelicPassiveDamage,
  cloneRelicCombatState,
  relicDamageHooks,
  updateRelicCombat,
} from "./relics";
import { cloneRngState } from "./rng";
import { addBlood } from "./altar";
import { createInitialWaveState, createStageWaveMonsters, getPlatformById, platformCenterX } from "./stage";
import { clearStage, continueAutoChallenge, failStageChallenge, tickStageChallenge } from "./stageProgress";
import type { ClassId, Monster, SimulationState } from "./types";

export function stepSimulation(input: SimulationState, dt: number): SimulationState {
  const { world, progress } = input;
  world.elapsed += dt;
  world.player.attackTimer = Math.max(0, world.player.attackTimer - dt);
  world.player.jumpLock = Math.max(0, world.player.jumpLock - dt);
  world.player.hp = Math.min(world.player.maxHp, world.player.hp + world.player.hpRegen * bossPlayerRegenMultiplier(world) * dt);
  updateRelicCombat(progress, world, dt);
  updateBossMechanics(input, dt);
  tickStageProgress(input, dt);

  updateMonsters(world.monsters, world.platforms, world.player, dt, Boolean(world.wave?.enabled));
  updatePlayerAi(input, dt);
  advanceWaveIfCleared(input);
  updateFloatingTexts(input, dt);

  return {
    progress: cloneProgress(progress),
    world: {
      ...world,
      rng: cloneRngState(world.rng),
      relicCombat: cloneRelicCombatState(world.relicCombat),
      classCombat: cloneClassCombatState(world.classCombat),
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
  const target = currentTarget && canTargetMonster(progress.classId, player, currentTarget)
    ? currentTarget
    : findNearestMonster(world.monsters, player, progress.classId);

  if (!target) {
    player.state = "IDLE";
    patrolPlayer(state, dt);
    return;
  }

  player.targetId = target.instanceId;
  const passiveResult = applyRelicPassiveDamage(progress, world, target, dt);
  const classPassiveResult = applyClassPassiveDamage(progress, world, target, dt);
  if (passiveResult.extraDamage + classPassiveResult.extraDamage > 0) {
    target.aggro = true;
    target.aggroDelayTimer = 0;
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

  if (distance <= player.attackRange && (player.platformId === target.platformId || progress.classId === "mage")) {
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
        target.aggro = true;
        target.aggroDelayTimer = 0;
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

  player.state = "MOVE";
  const targetCenter = target.position.x + target.width / 2;
  let desiredX = targetCenter;

  if (targetPlatform && playerPlatform && targetPlatform.id !== playerPlatform.id) {
    desiredX = platformCenterX(targetPlatform);

    if (targetPlatform.y < playerPlatform.y && Math.abs(player.position.x - desiredX) < 26) {
      jump(player);
    }

    if (targetPlatform.y > playerPlatform.y) {
      desiredX = getPlatformExitTarget(playerPlatform, player, desiredX);
    }
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

function getPlatformExitTarget(
  platform: NonNullable<ReturnType<typeof getPlatformById>>,
  player: SimulationState["world"]["player"],
  targetX: number,
): number {
  const platformCenter = platformCenterX(platform);

  if (targetX >= platformCenter) {
    return platform.x + platform.width + player.width + 8;
  }

  return platform.x - player.width - 8;
}

function findNearestMonster(
  monsters: Monster[],
  player: SimulationState["world"]["player"],
  classId: ClassId,
): Monster | null {
  let best: Monster | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const x = player.position.x;
  const y = player.position.y;

  for (const monster of monsters) {
    if (!monster.alive || !canTargetMonster(classId, player, monster)) {
      continue;
    }
    const rolePriority = monster.role === "bossSummon" ? 0 : monster.role === "boss" ? 1 : 2;
    const score = rolePriority * 100000 + Math.abs(monster.position.x - x) + Math.abs(monster.position.y - y) * 1.8;
    if (score < bestScore) {
      best = monster;
      bestScore = score;
    }
  }

  return best;
}

function canTargetMonster(classId: ClassId, player: SimulationState["world"]["player"], monster: Monster): boolean {
  if (monster.platformId === player.platformId) {
    return true;
  }

  return classId === "mage" && distanceBetween(player, monster) <= player.attackRange;
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

    const platform = getPlatformById(platforms, monster.platformId);
    if (!platform) {
      continue;
    }

    if (!monster.aggro && monster.aggroDelayTimer > 0) {
      monster.aggroDelayTimer = Math.max(0, monster.aggroDelayTimer - dt);
      monster.aggro = monster.aggroDelayTimer <= 0;
    }

    if (monster.aggro) {
      const playerPlatform = getPlatformById(platforms, player.platformId);
      if (playerPlatform && monster.platformId !== player.platformId) {
        const exitX = platformExitX(platform, player);
        const monsterCenter = monster.position.x + monster.width / 2;
        const delta = exitX - monsterCenter;
        if (Math.abs(delta) <= MONSTER_BALANCE.platformTransferEdgeThreshold) {
          transferMonsterToPlatform(monster, playerPlatform, player);
          continue;
        }
        monster.direction = delta > 0 ? 1 : -1;
      } else {
        const playerCenter = player.position.x + player.width / 2;
        const monsterCenter = monster.position.x + monster.width / 2;
        const delta = playerCenter - monsterCenter;
        if (Math.abs(delta) > 1) {
          monster.direction = delta > 0 ? 1 : -1;
        }
      }
    }

    monster.position.x += monster.direction * monster.moveSpeed * dt;
    const minX = platform.x + 3;
    const maxX = platform.x + platform.width - monster.width - 3;
    if (monster.position.x <= minX) {
      monster.position.x = minX;
      if (monster.aggro && monster.platformId !== player.platformId) {
        const playerPlatform = getPlatformById(platforms, player.platformId);
        if (playerPlatform) {
          transferMonsterToPlatform(monster, playerPlatform, player);
        }
      } else {
        monster.direction = 1;
      }
    } else if (monster.position.x >= maxX) {
      monster.position.x = maxX;
      if (monster.aggro && monster.platformId !== player.platformId) {
        const playerPlatform = getPlatformById(platforms, player.platformId);
        if (playerPlatform) {
          transferMonsterToPlatform(monster, playerPlatform, player);
        }
      } else {
        monster.direction = -1;
      }
    }
  }
}

function platformExitX(platform: NonNullable<ReturnType<typeof getPlatformById>>, player: SimulationState["world"]["player"]): number {
  const playerCenter = player.position.x + player.width / 2;
  return clamp(playerCenter, platform.x, platform.x + platform.width);
}

function transferMonsterToPlatform(
  monster: Monster,
  platform: NonNullable<ReturnType<typeof getPlatformById>>,
  player: SimulationState["world"]["player"],
): void {
  const minX = platform.x + 3;
  const maxX = platform.x + platform.width - monster.width - 3;
  monster.platformId = platform.id;
  monster.position.x = clamp(monster.position.x, minX, maxX);
  monster.position.y = platform.y - monster.height;
  const playerCenter = player.position.x + player.width / 2;
  const monsterCenter = monster.position.x + monster.width / 2;
  const delta = playerCenter - monsterCenter;
  if (Math.abs(delta) > 1) {
    monster.direction = delta > 0 ? 1 : -1;
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
  monster.aggro = false;
  monster.aggroDelayTimer = 0;
  const stage = STAGES[state.progress.currentStage];
  if (stage && monster.role === "normal") {
    addFloatingText(state.world, "+BLOOD", monster.position.x, monster.position.y - 12, "#c0303a");
  }
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

  killMonster(state, monster);
  grantRewards(state.progress, state.world, monster.experience, monster.gold);
  addBlood(state.progress.altar, "normal", state.progress.currentStage);
  applyRelicOnKill(state.progress, state.world, monster);
  grantDrop(state);
  if (state.world.wave) {
    state.world.wave.totalKills += 1;
  }
  advanceWaveIfCleared(state);
}

function grantDrop(state: SimulationState): void {
  const item = rollMonsterDrop(state.progress, state.world.rng);
  if (!item) {
    return;
  }

  const result = addItemToInventory(state.progress, item);
  addFloatingText(
    state.world,
    result.kept ? "ITEM" : `+${result.soldGold}G`,
    state.world.player.position.x,
    state.world.player.position.y - 18,
    "#e0c04a",
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
