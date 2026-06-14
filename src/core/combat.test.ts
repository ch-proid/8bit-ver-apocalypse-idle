import { describe, expect, it } from "vitest";
import { RELIC_IDS } from "../data/relics";
import { ALTAR_BALANCE, DAMAGE_FORMULA, FIXED_DELTA, RELIC_BALANCE, TICK_RATE } from "../data/balance";
import {
  addAltarBlood,
  addBlood,
  addAltarExperience,
  altarEliteStatsForLevel,
  altarExperienceForLevel,
  altarMaxStoredCharges,
  altarStoredCharges,
  awakenRelic,
  canLevelUpAltar,
  calculateRelicOwnedStats,
  createDefaultAltarState,
  eliteSummonCost,
  equipRelic,
  grantRelic,
  levelUpAltar,
  relicStars,
  rollRelicOwnedStats,
  setRelicStarsForDebug,
  spendBloodForElite,
  unlockedRelicGrades,
} from "./altar";
import {
  calculateDamage,
  clampCombatAffixes,
  dealPlayerDamage,
  effectiveAttackCooldown,
  accuracyMultiplier,
  playerEvasionChance,
} from "./combat";
import {
  applyRelicAfterHit,
  applyRelicBeforeAttack,
  applyRelicOnKill,
  relicDebugSnapshot,
  relicDamageHooks,
} from "./relics";
import { createRngState } from "./rng";
import { createInitialSimulation } from "./stage";
import { stepSimulation } from "./simulation";
import { calculatePlayerStats } from "./stats";
import type { CombatAffixStats, Monster, RelicId, SimulationState } from "./types";

interface RelicDuelSignature {
  relic: RelicId;
  totalDamage: number;
  style: number;
  playerHp: number;
  executionTriggered: boolean;
  specters: number;
  plagueStacks: number;
  executionMarks: number;
  overdriveGauge: number;
  isOverdrive: boolean;
}

describe("phase 3C damage formula, altar, and relic builds", () => {
  it("locks the Bible damage formula order with step-by-step expected values", () => {
    const rng = createRngState(1);
    const result = calculateDamage({
      attack: 100,
      minDamage: 100,
      maxDamage: 100,
      strengthMultiplier: 1,
      weaponAccuracy: 40,
      defenderEvasion: 0,
      styleMultiplier: 1.2,
      defenderDefense: 40,
      defenderDamageReduction: 25,
      affixes: {
        ...emptyCombatAffixes(),
        critChance: 100,
        critDamage: 50,
        damageIncrease: 20,
        finalDamage: 10,
        defPenetration: 10,
      },
      rng,
      forceCritical: true,
      forceVarianceRoll: 0.5,
    });

    expect(result.baseDamage).toBe(100);
    expect(result.afterStrength).toBe(100);
    expect(result.raw).toBeCloseTo(120);
    expect(result.missed).toBe(false);
    expect(result.afterAccuracy).toBeCloseTo(120);
    expect(result.afterDamageIncrease).toBeCloseTo(144);
    expect(result.effectiveDefense).toBeCloseTo(30);
    expect(result.afterDefense).toBeCloseTo(110.769, 3);
    expect(result.critical).toBe(true);
    expect(result.afterCritical).toBeCloseTo(188.308, 3);
    expect(result.afterFinalDamage).toBeCloseTo(207.138, 3);
    expect(result.afterDamageReduction).toBeCloseTo(155.354, 3);
    expect(result.varianceMultiplier).toBeCloseTo(1);
    expect(result.finalDamage).toBe(155);
  });

  it("rolls weapon damage range before strength and style multipliers", () => {
    const base = {
      attack: 0,
      minDamage: 10,
      maxDamage: 20,
      strengthMultiplier: 1.5,
      weaponAccuracy: 100,
      defenderEvasion: 0,
      styleMultiplier: 2,
      defenderDefense: 0,
      defenderDamageReduction: 0,
      affixes: emptyCombatAffixes(),
      rng: createRngState(10),
      forceCritical: false,
      forceVarianceRoll: 0.5,
    };

    const low = calculateDamage({ ...base, forceDamageRoll: 0 });
    const high = calculateDamage({ ...base, forceDamageRoll: 1 });

    expect(low.baseDamage).toBe(10);
    expect(low.raw).toBe(30);
    expect(high.baseDamage).toBe(20);
    expect(high.raw).toBe(60);
  });

  it("applies outgoing hit zones and incoming evasion chance", () => {
    expect(accuracyMultiplier(100, 100)).toEqual({ delta: 0, multiplier: 1, missed: false });

    const penalty = accuracyMultiplier(85, 100);
    expect(penalty.missed).toBe(false);
    expect(penalty.multiplier).toBeCloseTo(0.7);

    const miss = accuracyMultiplier(69, 100);
    expect(miss.missed).toBe(true);
    expect(miss.multiplier).toBe(0);
    expect(playerEvasionChance(25, 50)).toBeCloseTo(0.25);
  });

  it("lets class-specific crit caps extend the formula without moving relic hooks", () => {
    const affixes = { ...emptyCombatAffixes(), critChance: 100 };
    const defaultCap = calculateDamage({
      attack: 50,
      styleMultiplier: 1,
      defenderDefense: 0,
      defenderDamageReduction: 0,
      affixes,
      rng: createRngState(1),
      forceCriticalRoll: 0.9,
      forceVarianceRoll: 0.5,
    });
    const assassinCap = calculateDamage({
      attack: 50,
      styleMultiplier: 1,
      defenderDefense: 0,
      defenderDamageReduction: 0,
      affixes,
      rng: createRngState(1),
      critChanceCap: 100,
      critDamageBonus: 15,
      forceCriticalRoll: 0.9,
      forceVarianceRoll: 0.5,
    });

    expect(defaultCap.critical).toBe(false);
    expect(assassinCap.critical).toBe(true);
    expect(assassinCap.afterCritical).toBeCloseTo(67.5);
  });

  it("supports critical off, penetration, final damage, damage reduction, and variance bounds", () => {
    const base = {
      attack: 80,
      weaponAccuracy: 100,
      defenderEvasion: 0,
      styleMultiplier: 1,
      defenderDefense: 30,
      defenderDamageReduction: 10,
      affixes: {
        ...emptyCombatAffixes(),
        damageIncrease: 25,
        finalDamage: 20,
        defPenetration: 15,
      },
      rng: createRngState(2),
      forceCritical: false,
    };
    const low = calculateDamage({ ...base, forceVarianceRoll: 0 });
    const high = calculateDamage({ ...base, forceVarianceRoll: 1 });

    expect(low.critical).toBe(false);
    expect(low.effectiveDefense).toBe(15);
    expect(low.varianceMultiplier).toBeCloseTo(1 - DAMAGE_FORMULA.variance);
    expect(high.varianceMultiplier).toBeCloseTo(1 + DAMAGE_FORMULA.variance);
    expect(high.finalDamage).toBeGreaterThan(low.finalDamage);
  });

  it("clamps combat affix caps and attack-speed cooldown", () => {
    const clamped = clampCombatAffixes({
      critChance: 400,
      critDamage: 10,
      attackSpeed: 300,
      damageIncrease: 1,
      finalDamage: 1,
      defPenetration: 1,
      lifeSteal: 99,
      goldGain: 5,
      damageReduction: 99,
    });

    expect(clamped.critChance).toBe(DAMAGE_FORMULA.critChanceCap);
    expect(clamped.attackSpeed).toBe(DAMAGE_FORMULA.attackSpeedCap);
    expect(clamped.lifeSteal).toBe(DAMAGE_FORMULA.lifeStealCap);
    expect(clamped.damageReduction).toBe(DAMAGE_FORMULA.damageReductionCap);
    expect(effectiveAttackCooldown(1, clamped, 1)).toBeCloseTo(0.5);
  });

  it("accumulates blood, spends elite challenge cost, levels altar manually, and gates 3-star upgrades", () => {
    const altar = createDefaultAltarState();

    addBlood(altar, "normal", 1);
    addBlood(altar, "elite", 1);
    addBlood(altar, "boss", 1);
    expect(altar.blood).toBe(106);

    altar.blood = eliteSummonCost(altar);
    expect(altarStoredCharges(altar)).toBe(1);
    expect(spendBloodForElite(altar)).toBe(true);
    expect(altar.blood).toBe(0);

    const levelOneStats = altarEliteStatsForLevel(altar.level);
    addAltarExperience(altar, altarExperienceForLevel(altar.level) - 1);
    expect(canLevelUpAltar(altar)).toBe(false);
    addAltarExperience(altar, 1);
    expect(canLevelUpAltar(altar)).toBe(true);
    expect(levelUpAltar(altar)).toBe(true);
    expect(altar.level).toBe(2);
    expect(altar.experience).toBe(0);
    expect(altarEliteStatsForLevel(altar.level).maxHp).toBeGreaterThan(levelOneStats.maxHp);

    const gated = createDefaultAltarState();
    grantRelic(gated, "specterLord");
    grantRelic(gated, "specterLord");
    grantRelic(gated, "specterLord");
    expect(relicStars(gated, "specterLord")).toBe(2);
    gated.bossDefeated.pride = true;
    grantRelic(gated, "specterLord");
    expect(relicStars(gated, "specterLord")).toBe(3);
  });

  it("stores multiple altar charges with level-based caps and discards overflow", () => {
    const altar = createDefaultAltarState();
    const chargeCost = eliteSummonCost(altar);

    expect(altarMaxStoredCharges(altar)).toBe(ALTAR_BALANCE.storedCharges.levelOne);
    addAltarBlood(altar, chargeCost * (ALTAR_BALANCE.storedCharges.levelOne + 3));

    expect(altarStoredCharges(altar)).toBe(ALTAR_BALANCE.storedCharges.levelOne);
    expect(altar.blood).toBe(chargeCost * ALTAR_BALANCE.storedCharges.levelOne);

    altar.level = ALTAR_BALANCE.storedCharges.maxLevel;
    expect(altarMaxStoredCharges(altar)).toBe(ALTAR_BALANCE.storedCharges.maxCharges);
  });

  it("separates equipped style effects from owned relic stat bonuses", () => {
    const state = createInitialSimulation(1);
    const baseline = calculatePlayerStats(state.progress);

    grantRelic(state.progress.altar, "specterLord", "common", { atk: 2, hp: 10, def: 1 });
    grantRelic(state.progress.altar, "martyr", "magic", { atk: 4, hp: 20, def: 2 });
    equipRelic(state.progress.altar, "specterLord");

    const ownedStats = calculateRelicOwnedStats(state.progress.altar);
    const withRelics = calculatePlayerStats(state.progress);

    expect(ownedStats).toEqual({ atk: 6, hp: 30, def: 3, reg: 0 });
    expect(withRelics.attack).toBeCloseTo(baseline.attack + ownedStats.atk);
    expect(withRelics.maxHp).toBeCloseTo(baseline.maxHp + ownedStats.hp);
    expect(withRelics.defense).toBeCloseTo(baseline.defense + ownedStats.def);
  });

  it("rolls deterministic same-grade relic stat variance and raises future caps with altar level", () => {
    const lowA = rollRelicOwnedStats("rare", 6, createRngState(100));
    const lowB = rollRelicOwnedStats("rare", 6, createRngState(101));
    const high = rollRelicOwnedStats("rare", 16, createRngState(100));

    expect(lowA).toEqual(rollRelicOwnedStats("rare", 6, createRngState(100)));
    expect(lowA).not.toEqual(lowB);
    expect(high.atk).toBeGreaterThan(lowA.atk);
    expect(high.hp).toBeGreaterThan(lowA.hp);
  });

  it("uses altar level and rebirth count to unlock relic grades", () => {
    const altar = createDefaultAltarState();

    expect(unlockedRelicGrades(altar, 0)).toEqual(["common"]);
    altar.level = ALTAR_BALANCE.relicGrades.rare.altarLevel;
    expect(unlockedRelicGrades(altar, 0)).toEqual(["common", "magic", "rare"]);
    altar.level = ALTAR_BALANCE.relicGrades.epic.altarLevel;
    expect(unlockedRelicGrades(altar, 0)).not.toContain("epic");
    expect(unlockedRelicGrades(altar, 1)).toContain("epic");
  });

  it("uses rising duplicate requirements through 7 stars and promotes overflow to the next grade", () => {
    const altar = createDefaultAltarState();
    altar.bossDefeated.pride = true;

    setRelicStarsForDebug(altar, "specterLord", 3);
    grantRelic(altar, "specterLord");
    expect(relicStars(altar, "specterLord")).toBe(3);
    grantRelic(altar, "specterLord");
    expect(relicStars(altar, "specterLord")).toBe(4);

    setRelicStarsForDebug(altar, "specterLord", ALTAR_BALANCE.maxStars);
    grantRelic(altar, "specterLord");

    expect(altar.owned.specterLord?.common?.stars).toBe(ALTAR_BALANCE.maxStars);
    expect(altar.owned.specterLord?.magic?.stars).toBe(1);
  });

  it("allows manual relic awakening from stored duplicate progress without bypassing boss gates", () => {
    const altar = createDefaultAltarState();

    setRelicStarsForDebug(altar, "specterLord", 2);
    grantRelic(altar, "specterLord");

    expect(altar.owned.specterLord?.common?.duplicateProgress).toBe(1);
    expect(awakenRelic(altar, "specterLord", "common")).toBe(false);
    expect(relicStars(altar, "specterLord")).toBe(2);

    altar.bossDefeated.pride = true;
    expect(awakenRelic(altar, "specterLord", "common")).toBe(true);
    expect(relicStars(altar, "specterLord")).toBe(3);
  });

  it("applies each of the six relic build rules through deterministic combat state", () => {
    const signatures = RELIC_IDS.map((relicId) => runRelicDuel(relicId));
    const unique = new Set(signatures.map((entry) => JSON.stringify(entry)));

    expect(unique.size).toBe(RELIC_IDS.length);
    expect(signatures.find((entry) => entry.relic === "specterLord")?.specters).toBe(1);
    expect(signatures.find((entry) => entry.relic === "bloodBerserker")?.playerHp).toBeGreaterThan(60);
    expect(signatures.find((entry) => entry.relic === "plagueDoctor")?.plagueStacks).toBeGreaterThan(0);
    expect(signatures.find((entry) => entry.relic === "martyr")?.playerHp).toBeLessThan(60);
    expect(signatures.find((entry) => entry.relic === "executioner")?.executionTriggered).toBe(true);
    expect(signatures.find((entry) => entry.relic === "kingsShadow")?.isOverdrive).toBe(true);
  });

  it("declares execution percentage damage as a separate channel that bypasses the normal formula", () => {
    const state = createRelicState("executioner");
    const monster = prepareTarget(state, 1000);
    let normalDamage = 0;
    let executeDamage = 0;

    for (let i = 0; i < RELIC_BALANCE.executioner.markThreshold; i += 1) {
      const result = dealPlayerDamage(state.world.player, monster, state.progress, state.world);
      normalDamage += result.finalDamage;
      const relicResult = applyRelicAfterHit(state.progress, state.world, monster, result.finalDamage);
      executeDamage += relicResult.extraDamage;
      if (i < RELIC_BALANCE.executioner.markThreshold - 1) {
        expect(relicResult.channel).not.toBe("execute");
      } else {
        expect(relicResult.channel).toBe("execute");
      }
    }

    expect(executeDamage).toBe(Math.floor(monster.maxHp * RELIC_BALANCE.executioner.executeHpPercent / 100));
    expect(executeDamage).toBeGreaterThan(normalDamage);
  });

  it("keeps relic-equipped simulations deterministic for identical seeds", () => {
    let runA = createRelicState("plagueDoctor", 20260613);
    let runB = createRelicState("plagueDoctor", 20260613);

    for (let i = 0; i < TICK_RATE * 30; i += 1) {
      runA = stepSimulation(runA, FIXED_DELTA);
      runB = stepSimulation(runB, FIXED_DELTA);
    }

    expect(runA.world).toEqual(runB.world);
    expect(runA.progress).toEqual(runB.progress);
  });
});

function runRelicDuel(relicId: RelicId): RelicDuelSignature {
  const state = createRelicState(relicId);
  const monster = prepareTarget(state, 500);
  let totalDamage = 0;
  let executionTriggered = false;

  for (let i = 0; i < 5; i += 1) {
    applyRelicBeforeAttack(state.progress, state.world);
    const damage = dealPlayerDamage(state.world.player, monster, state.progress, state.world);
    const relic = applyRelicAfterHit(state.progress, state.world, monster, damage.finalDamage);
    totalDamage += damage.finalDamage + relic.extraDamage;
    executionTriggered = executionTriggered || relic.channel === "execute";
  }

  if (relicId === "specterLord") {
    monster.hp = 0;
    applyRelicOnKill(state.progress, state.world, monster);
  }

  const hooks = relicDamageHooks(state.progress, state.world, state.world.player);
  const snapshot = relicDebugSnapshot(state.progress, state.world);
  return {
    relic: relicId,
    totalDamage,
    style: hooks.styleMultiplier,
    playerHp: Math.round(state.world.player.hp * 100) / 100,
    executionTriggered,
    specters: Number(snapshot.specters),
    plagueStacks: Number(snapshot.plagueStacks),
    executionMarks: Number(snapshot.executionMarks),
    overdriveGauge: Number(snapshot.overdriveGauge),
    isOverdrive: Boolean(snapshot.isOverdrive),
  };
}

function createRelicState(relicId: RelicId, seed = 1234): SimulationState {
  const state = createInitialSimulation(1, undefined, seed);
  grantRelic(state.progress.altar, relicId);
  equipRelic(state.progress.altar, relicId);
  state.world.player.hp = 60;
  return state;
}

function prepareTarget(state: SimulationState, hp: number): Monster {
  const monster = state.world.monsters[0];
  monster.hp = hp;
  monster.maxHp = hp;
  monster.alive = true;
  monster.spawnInvulnTimer = 0;
  monster.platformId = state.world.player.platformId;
  monster.position.x = state.world.player.position.x + state.world.player.attackRange - monster.width;
  monster.position.y = state.world.player.position.y;
  return monster;
}

function emptyCombatAffixes(): CombatAffixStats {
  return {
    critChance: 0,
    critDamage: 0,
    attackSpeed: 0,
    damageIncrease: 0,
    finalDamage: 0,
    defPenetration: 0,
    lifeSteal: 0,
    goldGain: 0,
    damageReduction: 0,
  };
}
