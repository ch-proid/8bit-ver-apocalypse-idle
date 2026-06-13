import { useGameStore } from "../store/gameStore";
import { DebugPanel } from "./DebugPanel";

interface HudProps {
  debugOpen: boolean;
}

export function Hud({ debugOpen }: HudProps) {
  const progress = useGameStore((state) => state.simulation.progress);
  const player = useGameStore((state) => state.simulation.world.player);
  const offlineReward = useGameStore((state) => state.lastOfflineReward);
  const expPercent = Math.min(100, Math.floor((progress.experience / progress.nextExperience) * 100));
  const distribution = progress.statDistribution;

  return (
    <div className="ui-layer">
      <div className="top-hud">
        <span>STAGE {progress.currentStage}</span>
        <span>UNL {progress.stageProgress.unlockedStage}</span>
        <span>LV {progress.level}</span>
        <span>G {progress.gold}</span>
      </div>

      <div className="phase3-panel">
        <span>RB {progress.rebirth.count}</span>
        <span>EXP x{progress.rebirth.experienceMultiplier.toFixed(2)}</span>
        <span>PT {distribution.unspentPoints}</span>
        <span>BLD {Math.floor(progress.altar.blood)}</span>
        <span>CP {progress.records.dummyScore.value}</span>
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

      <div className="phase3-panel stat-panel">
        <span>ATK {player.attack}</span>
        <span>DEF {player.defense}</span>
        <span>HP {player.maxHp}</span>
        <span>REG {player.hpRegen.toFixed(1)}</span>
      </div>

      <div className="phase3-panel">
        <span>PRESET {distribution.preset}</span>
        <span>RELIC {progress.altar.equippedRelicId ?? "NONE"}</span>
      </div>

      <DebugPanel open={debugOpen} />

      {offlineReward ? (
        <div className="offline-note">
          AFK {Math.floor(offlineReward.elapsedSeconds)}s · +{offlineReward.gold}G · +{offlineReward.experience}EXP
        </div>
      ) : null}
    </div>
  );
}
