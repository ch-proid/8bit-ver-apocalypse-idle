import { FLOATING_TEXT, MONSTER_BALANCE } from "../data/balance";
import { STAGES } from "../data/stages";
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
import { getPlatformById, platformCenterX } from "./stage";
import type { Monster, SimulationState } from "./types";

export function stepSimulation(input: SimulationState, dt: number): SimulationState {
  const { world, progress } = input;
  world.elapsed += dt;
  world.player.attackTimer = Math.max(0, world.player.attackTimer - dt);
  world.player.jumpLock = Math.max(0, world.player.jumpLock - dt);
  world.player.hp = Math.min(world.player.maxHp, world.player.hp + world.player.hpRegen * dt);
  updateRelicCombat(progress, world, dt);

  updateMonsters(world.monsters, world.platforms, dt);
  updatePlayerAi(input, dt);
  updateFloatingTexts(input, dt);

  return {
    progress: cloneProgress(progress),
    world: {
      ...world,
      rng: cloneRngState(world.rng),
      relicCombat: cloneRelicCombatState(world.relicCombat),
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
  const currentTarget = aliveMonsters.find((monster) => monster.instanceId === player.targetId);
  const target = currentTarget ?? findNearestMonster(world.monsters, player.position.x, player.position.y);

  if (!target) {
    player.state = "IDLE";
    patrolPlayer(state, dt);
    return;
  }

  player.targetId = target.instanceId;
  const passiveResult = applyRelicPassiveDamage(progress, world, target, dt);
  if (target.hp <= 0) {
    if (passiveResult.extraDamage > 0) {
      addFloatingText(world, `${Math.floor(passiveResult.extraDamage)}`, target.position.x + target.width / 2, target.position.y - 2, "#d8e3c8");
    }
    resolveMonsterDeath(state, target);
    return;
  }

  const targetPlatform = getPlatformById(world.platforms, target.platformId);
  const playerPlatform = getPlatformById(world.platforms, player.platformId);
  const distance = distanceBetween(player, target);

  if (distance <= player.attackRange && player.platformId === target.platformId) {
    player.state = "ATTACK";
    player.velocity.x = 0;

    if (player.attackTimer <= 0) {
      applyRelicBeforeAttack(progress, world);
      const damageResult = dealPlayerDamage(player, target, progress, world);
      const relicResult = applyRelicAfterHit(progress, world, target, damageResult.finalDamage);
      const totalDamage = damageResult.finalDamage + relicResult.extraDamage;
      const combatAffixes = calculateCombatAffixStats(progress.inventory.equipped);
      const lifeSteal = clampCombatAffixes(combatAffixes).lifeSteal;
      if (lifeSteal > 0 && totalDamage > 0) {
        player.hp = Math.min(player.maxHp, player.hp + totalDamage * lifeSteal / 100);
      }
      addFloatingText(world, `${totalDamage}`, target.position.x + target.width / 2, target.position.y - 2, "#d8e3c8");
      const hooks = relicDamageHooks(progress, world, player);
      player.attackTimer = effectiveAttackCooldown(
        player.attackCooldown,
        combatAffixes,
        hooks.cooldownMultiplier,
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

function findNearestMonster(monsters: Monster[], x: number, y: number): Monster | null {
  let best: Monster | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const monster of monsters) {
    if (!monster.alive) {
      continue;
    }
    const score = Math.abs(monster.position.x - x) + Math.abs(monster.position.y - y) * 1.8;
    if (score < bestScore) {
      best = monster;
      bestScore = score;
    }
  }

  return best;
}

function updateMonsters(monsters: Monster[], platforms: SimulationState["world"]["platforms"], dt: number): void {
  for (const monster of monsters) {
    if (!monster.alive) {
      monster.respawnTimer -= dt;
      monster.fadeTimer = Math.max(0, monster.fadeTimer - dt);
      if (monster.respawnTimer <= 0) {
        respawnMonster(monster);
      }
      continue;
    }

    const platform = getPlatformById(platforms, monster.platformId);
    if (!platform) {
      continue;
    }

    monster.position.x += monster.direction * monster.moveSpeed * dt;
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

function killMonster(state: SimulationState, monster: Monster): void {
  monster.alive = false;
  monster.respawnTimer = monster.respawnTime;
  monster.fadeTimer = MONSTER_BALANCE.respawnFadeSeconds;
  const stage = STAGES[state.progress.currentStage];
  if (stage) {
    addFloatingText(state.world, "+BLOOD", monster.position.x, monster.position.y - 12, "#c0303a");
  }
}

function resolveMonsterDeath(state: SimulationState, monster: Monster): void {
  killMonster(state, monster);
  grantRewards(state.progress, state.world, monster.experience, monster.gold);
  addBlood(state.progress.altar, "normal", state.progress.currentStage);
  applyRelicOnKill(state.progress, state.world, monster);
  grantDrop(state);
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

function respawnMonster(monster: Monster): void {
  monster.alive = true;
  monster.hp = monster.maxHp;
  monster.position.x = monster.spawnPosition.x;
  monster.position.y = monster.spawnPosition.y;
  monster.direction *= -1;
  monster.fadeTimer = 0;
}

function updateFloatingTexts(state: SimulationState, dt: number): void {
  for (const text of state.world.floatingTexts) {
    text.age += dt;
    text.position.y -= FLOATING_TEXT.riseSpeed * dt;
  }

  state.world.floatingTexts = state.world.floatingTexts.filter((text) => text.age <= text.ttl);
}
