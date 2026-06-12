import { DEBUG_GRANTS } from "../data/balance";
import { RELIC_IDS } from "../data/relics";
import { useGameStore } from "../store/gameStore";

export function Hud() {
  const progress = useGameStore((state) => state.simulation.progress);
  const player = useGameStore((state) => state.simulation.world.player);
  const addGold = useGameStore((state) => state.addGold);
  const addExperience = useGameStore((state) => state.addExperience);
  const setStatPreset = useGameStore((state) => state.setStatPreset);
  const spendStatPoint = useGameStore((state) => state.spendStatPoint);
  const unlockRebirthForDebug = useGameStore((state) => state.unlockRebirthForDebug);
  const rebirthNow = useGameStore((state) => state.rebirthNow);
  const logPhase3ADemo = useGameStore((state) => state.logPhase3ADemo);
  const equipBestItems = useGameStore((state) => state.equipBestItems);
  const logPhase3BDemo = useGameStore((state) => state.logPhase3BDemo);
  const summonRelicForDebug = useGameStore((state) => state.summonRelicForDebug);
  const equipRelicForDebug = useGameStore((state) => state.equipRelicForDebug);
  const logPhase3CDemo = useGameStore((state) => state.logPhase3CDemo);
  const offlineReward = useGameStore((state) => state.lastOfflineReward);
  const expPercent = Math.min(100, Math.floor((progress.experience / progress.nextExperience) * 100));
  const distribution = progress.statDistribution;

  return (
    <div className="ui-layer">
      <div className="top-hud">
        <span>STAGE {progress.currentStage}-1</span>
        <span>LV {progress.level}</span>
        <span>G {progress.gold}</span>
      </div>

      <div className="phase3-panel">
        <span>RB {progress.rebirth.count}</span>
        <span>EXP x{progress.rebirth.experienceMultiplier.toFixed(2)}</span>
        <span>PT {distribution.unspentPoints}</span>
        <span>BLD {Math.floor(progress.altar.blood)}</span>
      </div>

      <div className="bar-row">
        <span>EXP</span>
        <div className="gb-bar xp">
          <i style={{ width: `${expPercent}%` }} />
        </div>
        <span>{progress.experience}/{progress.nextExperience}</span>
      </div>

      <div className="bar-row">
        <span>HP</span>
        <div className="gb-bar hp">
          <i style={{ width: `${Math.floor((player.hp / player.maxHp) * 100)}%` }} />
        </div>
        <span>{player.state}</span>
      </div>

      <div className="bottom-panel">
        <button type="button" onClick={() => addGold(DEBUG_GRANTS.gold)}>
          +{DEBUG_GRANTS.gold}G
        </button>
        <button type="button" onClick={() => addExperience(DEBUG_GRANTS.experience)}>
          +EXP
        </button>
        <button type="button" onClick={unlockRebirthForDebug}>
          GATE
        </button>
        <button type="button" onClick={rebirthNow} disabled={!progress.rebirth.canRebirth}>
          RB
        </button>
        <button type="button" onClick={logPhase3ADemo}>
          LOG
        </button>
        <button type="button" onClick={logPhase3BDemo}>
          LOG3B
        </button>
        <button type="button" onClick={summonRelicForDebug}>
          SUM
        </button>
        <button type="button" onClick={logPhase3CDemo}>
          LOG3C
        </button>
      </div>

      <div className="phase3-panel stat-panel">
        <span>ATK {player.attack}</span>
        <span>DEF {player.defense}</span>
        <span>HP {player.maxHp}</span>
        <span>REG {player.hpRegen.toFixed(1)}</span>
      </div>

      <div className="phase3-panel button-panel">
        <button type="button" onClick={() => setStatPreset("ATK")}>
          ATK
        </button>
        <button type="button" onClick={() => setStatPreset("BAL")}>
          BAL
        </button>
        <button type="button" onClick={() => setStatPreset("VIT")}>
          VIT
        </button>
        <button type="button" onClick={() => setStatPreset("MANUAL")}>
          MAN
        </button>
        <button type="button" onClick={() => spendStatPoint("atk")}>
          +A
        </button>
        <button type="button" onClick={equipBestItems}>
          EQUIP
        </button>
        <span>{distribution.preset}</span>
      </div>

      <div className="phase3-panel button-panel">
        <span>RELIC {progress.altar.equippedRelicId ?? "NONE"}</span>
        {RELIC_IDS.map((relicId) => (
          <button key={relicId} type="button" onClick={() => equipRelicForDebug(relicId)}>
            {relicId.slice(0, 3).toUpperCase()}
          </button>
        ))}
      </div>

      {offlineReward ? (
        <div className="offline-note">
          AFK {Math.floor(offlineReward.elapsedSeconds)}s · +{offlineReward.gold}G · +{offlineReward.experience}EXP
        </div>
      ) : null}
    </div>
  );
}
