import type { RngState } from "./types";

const UINT32_MAX_PLUS_ONE = 4294967296;
const LCG_A = 1664525;
const LCG_C = 1013904223;

export function createRngState(seed: number): RngState {
  return {
    seed: seed >>> 0,
  };
}

export function cloneRngState(rng: RngState): RngState {
  return {
    seed: rng.seed >>> 0,
  };
}

export function nextRandom(rng: RngState): number {
  rng.seed = (Math.imul(rng.seed, LCG_A) + LCG_C) >>> 0;
  return rng.seed / UINT32_MAX_PLUS_ONE;
}

export function randomInt(rng: RngState, minInclusive: number, maxInclusive: number): number {
  const min = Math.ceil(minInclusive);
  const max = Math.floor(maxInclusive);
  return min + Math.floor(nextRandom(rng) * (max - min + 1));
}

export function chance(rng: RngState, probability: number): boolean {
  return nextRandom(rng) < probability;
}

export function pickOne<T>(rng: RngState, values: T[]): T {
  return values[randomInt(rng, 0, values.length - 1)];
}

export function pickWeighted<T extends string>(rng: RngState, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = nextRandom(rng) * total;

  for (const [value, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) {
      return value;
    }
  }

  return entries[entries.length - 1][0];
}
