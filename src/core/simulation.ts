import { FLOATING_TEXT, MONSTER_BALANCE } from "../data/balance";
import { STAGES } from "../data/stages";
import { dealPlayerDamage, distanceBetween } from "./combat";
import { applyGravity, jump, moveAndCollide } from "./physics";
import { addFloatingText, grantRewards } from "./progression";
import { getPlatformById, platformCenterX } from "./stage";
import type { Monster, SimulationState } from "./types";

export function stepSimulation(input: SimulationState, dt: number): SimulationState {
  const { world, progress } = input;
  world.elapsed += dt;
  world.player.attackTimer = Math.max(0, world.player.attackTimer - dt);
  world.player.jumpLock = Math.max(0, world.player.jumpLock - dt);

  updateMonsters(world.monsters, world.platforms, dt);
  updatePlayerAi(input, dt);
  updateFloatingTexts(input, dt);

  return {
    progress: { ...progress },
    world: {
      ...world,
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
  const targetPlatform = getPlatformById(world.platforms, target.platformId);
  const playerPlatform = getPlatformById(world.platforms, player.platformId);
  const distance = distanceBetween(player, target);

  if (distance <= player.attackRange && player.platformId === target.platformId) {
    player.state = "ATTACK";
    player.velocity.x = 0;

    if (player.attackTimer <= 0) {
      const damage = dealPlayerDamage(player, target);
      addFloatingText(world, `${damage}`, target.position.x + target.width / 2, target.position.y - 2, "#d8e3c8");
      player.attackTimer = player.attackCooldown;

      if (target.hp <= 0) {
        killMonster(state, target);
        grantRewards(progress, world, target.experience, target.gold);
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
