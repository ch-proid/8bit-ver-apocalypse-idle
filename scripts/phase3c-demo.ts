import { FIXED_DELTA, PHASE_3C_DEBUG, TICK_RATE } from "../src/data/balance";
import { RELIC_IDS } from "../src/data/relics";
import { equipRelic, grantRelic } from "../src/core/altar";
import { relicDebugSnapshot } from "../src/core/relics";
import { createInitialSimulation } from "../src/core/stage";
import { stepSimulation } from "../src/core/simulation";

const rows = RELIC_IDS.map((relicId) => {
  let demo = createInitialSimulation(1, undefined, PHASE_3C_DEBUG.demoSeed);
  grantRelic(demo.progress.altar, relicId);
  equipRelic(demo.progress.altar, relicId);

  for (let i = 0; i < PHASE_3C_DEBUG.demoSeconds * TICK_RATE; i += 1) {
    demo = stepSimulation(demo, FIXED_DELTA);
  }

  return {
    build: relicId,
    gold: demo.progress.gold,
    blood: Math.floor(demo.progress.altar.blood),
    ...relicDebugSnapshot(demo.progress, demo.world),
  };
});

console.table(rows);
