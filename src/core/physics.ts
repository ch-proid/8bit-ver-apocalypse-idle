import { WORLD } from "../data/balance";
import type { Platform, Player } from "./types";

export function applyGravity(player: Player, dt: number): void {
  player.velocity.y = Math.min(player.velocity.y + WORLD.gravity * dt, WORLD.terminalVelocity);
}

export function moveAndCollide(player: Player, platforms: Platform[], dt: number): void {
  const previousBottom = player.position.y + player.height;

  player.position.x += player.velocity.x * dt;
  player.position.y += player.velocity.y * dt;
  player.position.x = clamp(player.position.x, 0, WORLD.width - player.width);

  if (player.velocity.y >= 0) {
    for (const platform of platforms) {
      const nextBottom = player.position.y + player.height;
      const horizontalOverlap =
        player.position.x + player.width > platform.x &&
        player.position.x < platform.x + platform.width;

      if (
        horizontalOverlap &&
        previousBottom <= platform.y + WORLD.platformSnapDistance &&
        nextBottom >= platform.y &&
        nextBottom <= platform.y + platform.height + WORLD.platformSnapDistance
      ) {
        player.position.y = platform.y - player.height;
        player.velocity.y = 0;
        player.platformId = platform.id;
        break;
      }
    }
  }
}

export function jump(player: Player): void {
  if (player.jumpLock <= 0 && Math.abs(player.velocity.y) < 0.001) {
    player.velocity.y = WORLD.jumpVelocity;
    player.jumpLock = 0.35;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
