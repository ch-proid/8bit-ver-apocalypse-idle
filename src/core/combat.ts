import type { Monster, Player } from "./types";

export function distanceBetween(player: Player, monster: Monster): number {
  const px = player.position.x + player.width / 2;
  const py = player.position.y + player.height / 2;
  const mx = monster.position.x + monster.width / 2;
  const my = monster.position.y + monster.height / 2;
  return Math.hypot(px - mx, py - my);
}

export function dealPlayerDamage(player: Player, monster: Monster): number {
  const damage = Math.max(1, Math.round(player.attack));
  monster.hp = Math.max(0, monster.hp - damage);
  return damage;
}
