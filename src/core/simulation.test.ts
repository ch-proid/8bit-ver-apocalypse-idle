import { describe, expect, it } from "vitest";
import { ALTAR_BALANCE, FIXED_DELTA, MAGE_AI_BALANCE, MONSTER_BALANCE, nextExperienceForLevel } from "../data/balance";
import { STAGES } from "../data/stages";
import { altarEliteStatsForLevel, eliteSummonCost, levelUpAltar } from "./altar";
import { startAltarEliteEncounter } from "./elites";
import { estimateOfflineHuntRates } from "./offline";
import { createInitialSimulation } from "./stage";
import { startStage } from "./stageProgress";
import { stepSimulation } from "./simulation";

describe("phase 2 simulation", () => {
  it("keeps Pixi-free core combat running and grants rewards", () => {
    let state = createInitialSimulation(1);

    for (let i = 0; i < 60 * 20; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.progress.gold).toBeGreaterThan(0);
    expect(state.progress.experience).toBeGreaterThanOrEqual(0);
    expect(state.progress.level).toBeGreaterThanOrEqual(1);
  });

  it("accumulates combat progress without rapid early leveling", () => {
    let state = createInitialSimulation(1);

    for (let i = 0; i < 60 * 90; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.progress.level).toBe(1);
    expect(state.progress.experience).toBeGreaterThan(0);
    expect(state.progress.experience).toBeLessThan(state.progress.nextExperience);
  });

  it("keeps the entire simulation deterministic for identical initial state", () => {
    let runA = createInitialSimulation(1);
    let runB = createInitialSimulation(1);

    for (let i = 0; i < 60 * 30; i += 1) {
      runA = stepSimulation(runA, FIXED_DELTA);
      runB = stepSimulation(runB, FIXED_DELTA);
    }

    expect(runA).toEqual(runB);
  });

  it("uses deterministic icon events for kill rewards without reward floating text", () => {
    let state = createInitialSimulation(1);
    const target = state.world.monsters[0];
    state.world.monsters = [target];
    state.world.wave = null;
    state.world.rewardRng.seed = 31;
    state.world.player.hp = state.world.player.maxHp / 2;
    state.world.player.attack = 9999;
    state.world.player.attackRange = 999;
    state.world.player.attackTimer = 0;
    target.hp = 1;
    target.maxHp = 1;
    target.evasion = 0;
    target.spawnInvulnTimer = 0;
    target.platformId = state.world.player.platformId;
    target.position.x = state.world.player.position.x + 4;
    target.position.y = state.world.player.position.y;

    state = stepSimulation(state, FIXED_DELTA);

    expect(state.world.floatingTexts.every((text) => /^\d+$/.test(text.value))).toBe(true);
    expect(state.world.dropIcons.map((icon) => icon.kind)).toEqual(expect.arrayContaining(["gold", "blood", "heal"]));
    expect(state.progress.gold).toBeGreaterThan(0);
    expect(state.progress.altar.blood).toBeGreaterThan(0);
    expect(state.world.player.hp).toBeGreaterThan(state.world.player.maxHp / 2);
  });

  it("runs altar elite challenge combat, grants rewards on kill, and stores altar experience", () => {
    let state = createInitialSimulation(1);
    const startGold = state.progress.gold;
    const startExperience = state.progress.experience;
    state.progress.altar.blood = eliteSummonCost(state.progress.altar);
    expect(startAltarEliteEncounter(state)).toBe(true);
    expect(state.progress.altar.blood).toBe(0);
    expect(state.world.altarElite?.level).toBe(1);

    state.world.player.attack = 99999;
    state.world.player.attackRange = 999;
    state.world.player.attackCooldown = 0.01;
    const elite = state.world.monsters.find((monster) => monster.role === "elite");
    if (!elite) {
      throw new Error("elite challenge did not spawn");
    }
    elite.spawnInvulnTimer = 0;
    elite.evasion = 0;
    elite.maxHp = 1;
    elite.hp = 1;

    for (let i = 0; i < 10; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.world.altarElite).toBeNull();
    expect(state.world.monsters.some((monster) => monster.role === "elite")).toBe(false);
    expect(state.progress.gold).toBeGreaterThan(startGold);
    expect(state.progress.experience).toBeGreaterThan(startExperience);
    expect(state.progress.altar.experience).toBeGreaterThan(0);
  });

  it("fails altar elite challenges on timeout after spending blood", () => {
    let state = createInitialSimulation(1);
    state.progress.altar.blood = eliteSummonCost(state.progress.altar);
    const spent = state.progress.altar.blood;
    expect(startAltarEliteEncounter(state)).toBe(true);
    expect(state.progress.altar.blood).toBeLessThan(spent);
    state.world.player.attack = 0;
    state.world.player.attackRange = 0;

    for (let i = 0; i < (ALTAR_BALANCE.eliteTimeLimitSeconds + 1) * 60; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.world.altarElite).toBeNull();
    expect(state.world.monsters.some((monster) => monster.role === "elite")).toBe(false);
    expect(state.progress.altar.experience).toBe(0);
  });

  it("manual altar level-up strengthens future elite challenges", () => {
    const state = createInitialSimulation(1);
    const levelOne = altarEliteStatsForLevel(state.progress.altar.level);
    state.progress.altar.experience = 999999;
    expect(levelUpAltar(state.progress.altar)).toBe(true);
    const levelTwo = altarEliteStatsForLevel(state.progress.altar.level);

    expect(state.progress.altar.level).toBe(2);
    expect(levelTwo.maxHp).toBeGreaterThan(levelOne.maxHp);
    expect(levelTwo.gold).toBeGreaterThan(levelOne.gold);
  });

  it("keeps altar elite challenge simulations deterministic for identical seeds", () => {
    let runA = createInitialSimulation(1, undefined, 9090);
    let runB = createInitialSimulation(1, undefined, 9090);
    runA.progress.altar.blood = eliteSummonCost(runA.progress.altar);
    runB.progress.altar.blood = eliteSummonCost(runB.progress.altar);
    expect(startAltarEliteEncounter(runA)).toBe(true);
    expect(startAltarEliteEncounter(runB)).toBe(true);

    for (let i = 0; i < 60 * 20; i += 1) {
      runA = stepSimulation(runA, FIXED_DELTA);
      runB = stepSimulation(runB, FIXED_DELTA);
    }

    expect(runA).toEqual(runB);
  });

  it("keeps newly spawned monsters still and invulnerable until their intro ends", () => {
    let state = createInitialSimulation(1);
    const monster = state.world.monsters[0];
    const startX = monster.position.x;
    const startHp = monster.hp;

    state.world.player.platformId = monster.platformId;
    state.world.player.position.x = monster.position.x;
    state.world.player.position.y = monster.position.y;
    state.world.player.attackRange = 999;
    state.world.player.attackCooldown = 0.01;
    state.world.player.attackTimer = 0;

    expect(monster.spawnInvulnTimer).toBe(MONSTER_BALANCE.spawnIntroSeconds);
    state = stepSimulation(state, FIXED_DELTA);

    expect(state.world.monsters[0].position.x).toBe(startX);
    expect(state.world.monsters[0].hp).toBe(startHp);
    expect(state.world.monsters[0].spawnInvulnTimer).toBeLessThan(MONSTER_BALANCE.spawnIntroSeconds);

    state.world.player.attackRange = 0;
    for (let i = 0; i < 60; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }
    state.world.player.attackTimer = 0;
    state.world.player.attackRange = 999;
    state.world.player.platformId = state.world.monsters[0].platformId;
    state.world.player.position.x = state.world.monsters[0].position.x;
    state.world.player.position.y = state.world.monsters[0].position.y;
    state = stepSimulation(state, FIXED_DELTA);

    expect(state.world.monsters[0].spawnInvulnTimer).toBe(0);
    expect(state.world.monsters[0].hp).toBeLessThan(startHp);
  });

  it("spawns each wave across lower, middle, and upper map layers", () => {
    const state = createInitialSimulation(1);
    const stage = STAGES[1];
    const platformToLayer = new Map(
      stage.spawnLayers.flatMap((layer) => layer.platformIds.map((platformId) => [platformId, layer.id] as const)),
    );
    const spawnedLayers = new Set(state.world.monsters.map((monster) => platformToLayer.get(monster.platformId)));

    expect(state.world.monsters).toHaveLength(3);
    expect(spawnedLayers).toEqual(new Set(["lower", "middle", "upper"]));
  });

  it("advances waves only after the current wave is wiped out", () => {
    let state = createInitialSimulation(1);
    const waveSize = state.world.monsters.length;
    expect(state.world.wave?.currentWaveIndex).toBe(0);
    expect(state.world.monsters).toHaveLength(waveSize);

    state.world.monsters[0].alive = false;
    state = stepSimulation(state, FIXED_DELTA);
    expect(state.world.wave?.currentWaveIndex).toBe(0);
    expect(state.world.monsters).toHaveLength(waveSize);

    state.world.monsters.forEach((monster) => {
      monster.alive = false;
    });
    state = stepSimulation(state, FIXED_DELTA);

    expect(state.world.wave?.currentWaveIndex).toBe(1);
    expect(state.world.wave?.completedWaves).toBe(1);
    expect(state.world.monsters).toHaveLength(waveSize);
    expect(state.world.monsters.every((monster) => monster.alive)).toBe(true);
  });

  it("chases the player after being hit while unhit monsters keep patrolling", () => {
    let unhit = createInitialSimulation(1);
    unhit.world.player.position.x = 20;
    unhit.world.player.attackRange = 0;
    unhit.world.player.moveSpeed = 0;
    unhit.world.monsters[0].spawnInvulnTimer = 0;
    unhit.world.monsters[0].aggro = false;
    unhit.world.monsters[0].aggroDelayTimer = 999;
    unhit.world.monsters[0].position.x = 100;
    unhit.world.monsters[0].direction = 1;
    unhit = stepSimulation(unhit, FIXED_DELTA);
    expect(unhit.world.monsters[0].position.x).toBeGreaterThan(100);

    let aggro = createInitialSimulation(1);
    aggro.world.player.position.x = 20;
    aggro.world.player.attackRange = 0;
    aggro.world.player.moveSpeed = 0;
    aggro.world.monsters[0].spawnInvulnTimer = 0;
    aggro.world.monsters[0].aggro = true;
    aggro.world.monsters[0].aggroDelayTimer = 0;
    aggro.world.monsters[0].position.x = 100;
    aggro.world.monsters[0].direction = 1;
    aggro = stepSimulation(aggro, FIXED_DELTA);
    expect(aggro.world.monsters[0].position.x).toBeLessThan(100);

    let hit = createInitialSimulation(1);
    const target = hit.world.monsters[0];
    target.spawnInvulnTimer = 0;
    target.evasion = 0;
    target.hp = target.maxHp * 10;
    target.maxHp = target.hp;
    hit.world.player.platformId = target.platformId;
    hit.world.player.position.x = target.position.x;
    hit.world.player.position.y = target.position.y;
    hit.world.player.attackRange = 999;
    hit.world.player.attackTimer = 0;
    hit = stepSimulation(hit, FIXED_DELTA);
    expect(hit.world.monsters[0].aggro).toBe(true);
  });

  it("slows monsters after hits and clears the slow timer deterministically", () => {
    let hit = createInitialSimulation(1);
    const target = isolateSamePlatformTarget(hit, 0);
    target.evasion = 0;
    target.maxHp = 9999;
    target.hp = target.maxHp;
    hit.world.player.attackRange = 999;
    hit.world.player.attackTimer = 0;
    hit = stepSimulation(hit, FIXED_DELTA);
    expect(hit.world.monsters[0].hitSlowTimer).toBe(MONSTER_BALANCE.hitSlowSeconds);

    let slowed = createInitialSimulation(1);
    const slowedTarget = isolateSamePlatformTarget(slowed, 72);
    slowed.world.player.attackRange = 0;
    slowed.world.player.moveSpeed = 0;
    slowedTarget.moveSpeed = 30;
    slowedTarget.hitSlowTimer = MONSTER_BALANCE.hitSlowSeconds;
    slowedTarget.direction = 1;
    slowed = stepSimulation(slowed, FIXED_DELTA);
    const slowedDelta = slowed.world.monsters[0].position.x - 72;

    let normal = createInitialSimulation(1);
    const normalTarget = isolateSamePlatformTarget(normal, 72);
    normal.world.player.attackRange = 0;
    normal.world.player.moveSpeed = 0;
    normalTarget.moveSpeed = 30;
    normalTarget.direction = 1;
    normal = stepSimulation(normal, FIXED_DELTA);
    const normalDelta = normal.world.monsters[0].position.x - 72;
    expect(slowedDelta).toBeCloseTo(normalDelta * MONSTER_BALANCE.hitSlowMoveMultiplier, 5);

    for (let i = 0; i < 60; i += 1) {
      slowed = stepSimulation(slowed, FIXED_DELTA);
    }
    expect(slowed.world.monsters[0].hitSlowTimer).toBe(0);
  });

  it("keeps untouched off-platform monsters on their own platform after auto-aggro", () => {
    let state = createInitialSimulation(1);
    const offPlatform = state.world.monsters.find((monster) => monster.platformId !== state.world.player.platformId);

    if (!offPlatform) {
      throw new Error("test stage needs an off-platform monster and a player floor platform");
    }

    state.world.monsters.forEach((monster) => {
      if (monster.instanceId !== offPlatform.instanceId) {
        monster.alive = false;
      }
    });
    offPlatform.spawnInvulnTimer = 0;
    offPlatform.aggro = false;
    offPlatform.aggroDelayTimer = MONSTER_BALANCE.autoAggroSeconds;
    const originalPlatformId = offPlatform.platformId;
    const originalY = offPlatform.position.y;
    state.world.player.attackRange = 0;
    state.world.player.moveSpeed = 0;
    const playerPlatformId = state.world.player.platformId;

    for (let i = 0; i < 60 * 30; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    const moved = state.world.monsters.find((monster) => monster.instanceId === offPlatform.instanceId);
    expect(state.world.player.platformId).toBe(playerPlatformId);
    expect(moved?.aggro).toBe(true);
    expect(moved?.platformId).toBe(originalPlatformId);
    expect(moved?.position.y).toBe(originalY);
  });

  it("lets mage attack off-platform monsters in range while melee waits for same-platform contact", () => {
    let melee = createInitialSimulation(1);
    const meleeTarget = isolateOffPlatformTarget(melee);
    melee.world.player.attackRange = 999;
    melee.world.player.attackTimer = 0;
    const meleeHp = meleeTarget.hp;
    melee = stepSimulation(melee, FIXED_DELTA);
    expect(melee.world.monsters.find((monster) => monster.instanceId === meleeTarget.instanceId)?.hp).toBe(meleeHp);

    let mage = createInitialSimulation(1);
    mage.progress.classId = "mage";
    const mageTarget = isolateOffPlatformTarget(mage);
    mage.world.player.attack = 999;
    mage.world.player.attackRange = 999;
    mage.world.player.attackTimer = 0;
    mage = stepSimulation(mage, FIXED_DELTA);
    expect(mage.world.monsters.find((monster) => monster.instanceId === mageTarget.instanceId)?.hp).toBeLessThan(mageTarget.hp);
  });

  it("limits mage vertical shots to the current and next upper layer", () => {
    let midShot = createInitialSimulation(1);
    midShot.progress.classId = "mage";
    const midTarget = isolatePlatformTarget(midShot, "low-left", 40);
    midShot.world.player.attack = 999;
    midShot.world.player.attackRange = 60;
    midShot.world.player.attackTimer = 0;
    const midStartHp = midTarget.hp;
    midShot = stepSimulation(midShot, FIXED_DELTA);
    expect(midShot.world.player.platformId).toBe("floor");
    expect(midShot.world.monsters.find((monster) => monster.instanceId === midTarget.instanceId)?.hp).toBeLessThan(midStartHp);

    let highShot = createInitialSimulation(1);
    highShot.progress.classId = "mage";
    const highTarget = isolatePlatformTarget(highShot, "high-left", 52);
    highTarget.maxHp = 999999;
    highTarget.hp = highTarget.maxHp;
    highShot.world.player.attack = 999;
    highShot.world.player.attackCooldown = 0.05;
    highShot.world.player.attackRange = 999;
    highShot.world.player.attackTimer = 0;
    const highStartHp = highTarget.hp;
    highShot = stepSimulation(highShot, FIXED_DELTA);
    expect(highShot.world.monsters.find((monster) => monster.instanceId === highTarget.instanceId)?.hp).toBe(highStartHp);

    for (let i = 0; i < 60 * 30; i += 1) {
      highShot = stepSimulation(highShot, FIXED_DELTA);
    }

    expect(highShot.world.player.platformId).toBe("low-left");
    expect(highShot.world.monsters.find((monster) => monster.instanceId === highTarget.instanceId)?.hp).toBeLessThan(highStartHp);
  });

  it("makes mage fire in range, retreat when too close, and shoot at map edges", () => {
    let mage = createInitialSimulation(1);
    mage.progress.classId = "mage";
    const mageTarget = isolateSamePlatformTarget(mage, mage.world.player.position.x + 42);
    mageTarget.evasion = 0;
    mageTarget.maxHp = 9999;
    mageTarget.hp = mageTarget.maxHp;
    mage.world.player.attackRange = 60;
    mage.world.player.attackTimer = 0;
    const mageStartX = mage.world.player.position.x;
    const mageStartHp = mageTarget.hp;
    mage = stepSimulation(mage, FIXED_DELTA);
    expect(mage.world.player.position.x).toBe(mageStartX);
    expect(mage.world.monsters[0].hp).toBeLessThan(mageStartHp);

    let closeFight = createInitialSimulation(1);
    closeFight.progress.classId = "mage";
    const closeTarget = isolateSamePlatformTarget(closeFight, closeFight.world.player.position.x + MAGE_AI_BALANCE.tooCloseDistance / 2);
    closeTarget.evasion = 0;
    closeTarget.maxHp = 9999;
    closeTarget.hp = closeTarget.maxHp;
    closeFight.world.player.attackRange = 60;
    closeFight.world.player.attackTimer = 0;
    const closeStartX = closeFight.world.player.position.x;
    const closeStartHp = closeTarget.hp;
    closeFight = stepSimulation(closeFight, FIXED_DELTA);
    expect(closeFight.world.player.position.x).toBeLessThan(closeStartX);
    expect(closeFight.world.monsters[0].hp).toBe(closeStartHp);

    let edgeFight = createInitialSimulation(1);
    edgeFight.progress.classId = "mage";
    const edgePlatform = edgeFight.world.platforms.find((platform) => platform.id === edgeFight.world.player.platformId);
    if (!edgePlatform) {
      throw new Error("test stage is missing player platform");
    }
    edgeFight.world.player.position.x = edgePlatform.x + MAGE_AI_BALANCE.retreatDistance - 1;
    const edgeTarget = isolateSamePlatformTarget(edgeFight, edgeFight.world.player.position.x + MAGE_AI_BALANCE.tooCloseDistance / 2);
    edgeTarget.evasion = 0;
    edgeTarget.maxHp = 9999;
    edgeTarget.hp = edgeTarget.maxHp;
    edgeFight.world.player.attackRange = 60;
    edgeFight.world.player.attackTimer = 0;
    const edgeStartX = edgeFight.world.player.position.x;
    const edgeStartHp = edgeTarget.hp;
    edgeFight = stepSimulation(edgeFight, FIXED_DELTA);
    expect(edgeFight.world.player.position.x).toBe(edgeStartX);
    expect(edgeFight.world.monsters[0].hp).toBeLessThan(edgeStartHp);

    let retreat = createInitialSimulation(1);
    retreat.progress.classId = "mage";
    const retreatTarget = isolateSamePlatformTarget(retreat, retreat.world.player.position.x + MAGE_AI_BALANCE.tooCloseDistance / 2);
    retreatTarget.evasion = 0;
    retreat.world.player.attackRange = 1;
    retreat.world.player.attackTimer = 0;
    const retreatStartX = retreat.world.player.position.x;
    retreat = stepSimulation(retreat, FIXED_DELTA);
    expect(retreat.world.player.position.x).toBeLessThan(retreatStartX);

    let knight = createInitialSimulation(1);
    knight.progress.classId = "knight";
    isolateSamePlatformTarget(knight, knight.world.player.position.x + 64);
    knight.world.player.attackRange = 1;
    const knightStartX = knight.world.player.position.x;
    knight = stepSimulation(knight, FIXED_DELTA);
    expect(knight.world.player.position.x).toBeGreaterThan(knightStartX);
  });

  it("moves melee characters to off-platform targets instead of teleporting monsters", () => {
    let state = createInitialSimulation(1);
    const target = state.world.monsters.find((monster) => monster.platformId !== state.world.player.platformId);

    if (!target) {
      throw new Error("test stage needs an off-platform monster");
    }

    const targetPlatformId = target.platformId;
    const targetStartY = target.position.y;
    state.world.player.attack = 999;
    state.world.player.attackCooldown = 0.05;
    state.world.monsters.forEach((monster) => {
      monster.spawnInvulnTimer = 0;
      monster.evasion = 0;
      if (monster.instanceId !== target.instanceId) {
        monster.alive = false;
      } else {
        monster.maxHp = 999999;
        monster.hp = monster.maxHp;
      }
    });
    const targetStartHp = target.hp;

    for (let i = 0; i < 60 * 30; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    const movedTarget = state.world.monsters.find((monster) => monster.instanceId === target.instanceId);
    expect(movedTarget?.platformId).toBe(targetPlatformId);
    expect(movedTarget?.position.y).toBe(targetStartY);
    expect(state.world.player.platformId).toBe(targetPlatformId);
    expect(movedTarget?.hp ?? 0).toBeLessThan(targetStartHp);
  });

  it("restarts the wave cycle after all hunt waves are cleared", () => {
    let state = createInitialSimulation(1);
    const totalWaves = state.world.wave?.totalWaves ?? 0;

    for (let wave = 0; wave < totalWaves; wave += 1) {
      state.world.monsters.forEach((monster) => {
        monster.alive = false;
      });
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.world.wave?.cycle).toBe(1);
    expect(state.world.wave?.currentWaveIndex).toBe(0);
    expect(state.world.monsters.every((monster) => monster.alive)).toBe(true);
  });

  it("clears challenge stages only after all waves are defeated", () => {
    let state = createInitialSimulation(1);
    startStage(state.progress, 1, "challenge");
    const totalWaves = state.world.wave?.totalWaves ?? 0;

    for (let wave = 0; wave < totalWaves - 1; wave += 1) {
      state.world.monsters.forEach((monster) => {
        monster.alive = false;
      });
      state = stepSimulation(state, FIXED_DELTA);
      expect(state.progress.stageProgress.clearedStages[1]).toBeUndefined();
    }

    state.world.monsters.forEach((monster) => {
      monster.alive = false;
    });
    state = stepSimulation(state, FIXED_DELTA);

    expect(state.progress.stageProgress.clearedStages[1]).toBe(true);
    expect(state.progress.stageProgress.mode).toBe("hunt");
  });

  it("scales wave kill pace with player damage", () => {
    let low = createInitialSimulation(1);
    let high = createInitialSimulation(1);
    low.world.player.attack = 1;
    low.world.player.attackCooldown = 10;
    high.world.player.attack = 999;
    high.world.player.attackCooldown = 0.05;
    high.world.player.attackRange = 999;

    for (let i = 0; i < 60 * 60; i += 1) {
      low = stepSimulation(low, FIXED_DELTA);
      high = stepSimulation(high, FIXED_DELTA);
    }

    expect(high.world.wave?.totalKills ?? 0).toBeGreaterThan(low.world.wave?.totalKills ?? 0);
  });

  it("allows high-damage melee to clear a full distributed wave cycle", () => {
    let state = createInitialSimulation(1);
    state.world.player.attack = 999;
    state.world.player.attackCooldown = 0.05;

    for (let i = 0; i < 60 * 120; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.world.wave?.cycle ?? 0).toBeGreaterThan(0);
    expect(state.world.wave?.totalKills ?? 0).toBeGreaterThanOrEqual(9);
  });

  it("allows mage to clear distributed waves with vertical range and partial climbing", () => {
    let state = createInitialSimulation(1);
    state.progress.classId = "mage";
    state.world.player.attack = 999;
    state.world.player.attackCooldown = 0.05;
    state.world.player.attackRange = 80;

    for (let i = 0; i < 60 * 120; i += 1) {
      state = stepSimulation(state, FIXED_DELTA);
    }

    expect(state.world.wave?.cycle ?? 0).toBeGreaterThan(0);
    expect(state.world.wave?.totalKills ?? 0).toBeGreaterThanOrEqual(9);
  });

  it("links offline rates to the current build hunt speed estimate", () => {
    const low = createInitialSimulation(1).progress;
    const high = createInitialSimulation(1).progress;
    high.statDistribution.assigned.str = 80;

    const lowRates = estimateOfflineHuntRates(low);
    const highRates = estimateOfflineHuntRates(high);

    expect(highRates.killsPerMinute).toBeGreaterThan(lowRates.killsPerMinute);
    expect(highRates.goldPerMinute).toBeGreaterThan(lowRates.goldPerMinute);
    expect(highRates.experiencePerMinute).toBeGreaterThan(lowRates.experiencePerMinute);
  });

  it("keeps blocked offline experience near one level over twelve hours", () => {
    const progress = createInitialSimulation(1).progress;
    const rates = estimateOfflineHuntRates(progress);
    const twelveHourExperience = rates.experiencePerMinute * 60 * 12;
    const nextLevel = nextExperienceForLevel(progress.level);

    expect(twelveHourExperience).toBeGreaterThan(nextLevel * 0.75);
    expect(twelveHourExperience).toBeLessThan(nextLevel * 1.25);
  });

});

function isolateOffPlatformTarget(state: ReturnType<typeof createInitialSimulation>) {
  const target = state.world.monsters.find((monster) => monster.platformId !== state.world.player.platformId);
  if (!target) {
    throw new Error("test stage is missing an off-platform target");
  }

  state.world.monsters.forEach((monster) => {
    if (monster.instanceId !== target.instanceId) {
      monster.alive = false;
    }
  });
  target.spawnInvulnTimer = 0;
  target.aggro = false;
  target.aggroDelayTimer = 999;
  target.evasion = 0;
  target.maxHp = target.hp * 10;
  target.hp = target.maxHp;
  return { ...target };
}

function isolateSamePlatformTarget(state: ReturnType<typeof createInitialSimulation>, x: number) {
  const target = state.world.monsters[0];
  const platform = state.world.platforms.find((item) => item.id === state.world.player.platformId);
  if (!target || !platform) {
    throw new Error("test stage is missing a target and player platform");
  }

  state.world.monsters.forEach((monster) => {
    if (monster.instanceId !== target.instanceId) {
      monster.alive = false;
    }
  });
  target.platformId = state.world.player.platformId;
  target.position.x = x;
  target.position.y = platform.y - target.height;
  target.spawnPosition = { ...target.position };
  target.spawnInvulnTimer = 0;
  target.hitSlowTimer = 0;
  target.aggro = false;
  target.aggroDelayTimer = 999;
  target.moveSpeed = 0;
  return target;
}

function isolatePlatformTarget(state: ReturnType<typeof createInitialSimulation>, platformId: string, x: number) {
  const target = state.world.monsters[0];
  const platform = state.world.platforms.find((item) => item.id === platformId);
  if (!target || !platform) {
    throw new Error("test stage is missing a target and requested platform");
  }

  state.world.monsters.forEach((monster) => {
    if (monster.instanceId !== target.instanceId) {
      monster.alive = false;
    }
  });
  target.platformId = platform.id;
  target.position.x = x;
  target.position.y = platform.y - target.height;
  target.spawnPosition = { ...target.position };
  target.spawnInvulnTimer = 0;
  target.hitSlowTimer = 0;
  target.aggro = false;
  target.aggroDelayTimer = 999;
  target.evasion = 0;
  target.maxHp = 9999;
  target.hp = target.maxHp;
  target.moveSpeed = 0;
  return target;
}
