import { nextExperienceForLevel, PLAYER_BALANCE } from "../data/balance";
import type { ProgressState, WorldState } from "./types";

export function grantRewards(
  progress: ProgressState,
  world: WorldState,
  experience: number,
  gold: number,
): void {
  progress.gold += gold;
  progress.experience += experience;
  addFloatingText(world, `+${gold}G`, world.player.position.x, world.player.position.y - 10, "#e0c04a");

  while (progress.experience >= progress.nextExperience) {
    progress.experience -= progress.nextExperience;
    progress.level += 1;
    progress.nextExperience = nextExperienceForLevel(progress.level);
    world.player.attack += PLAYER_BALANCE.levelAtkGain;
    world.player.maxHp += PLAYER_BALANCE.levelHpGain;
    world.player.hp = world.player.maxHp;
    addFloatingText(world, `LV ${progress.level}`, world.player.position.x, world.player.position.y - 24, "#7da963");
  }
}

export function addFloatingText(
  world: WorldState,
  value: string,
  x: number,
  y: number,
  color: string,
): void {
  world.floatingTexts.push({
    id: `txt${world.nextEntityId++}`,
    position: { x, y },
    value,
    color,
    age: 0,
    ttl: 0.75,
  });

  if (world.floatingTexts.length > 50) {
    world.floatingTexts.shift();
  }
}
