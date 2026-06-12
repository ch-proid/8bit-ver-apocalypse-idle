import { useGameStore } from "../store/gameStore";

export function Hud() {
  const progress = useGameStore((state) => state.simulation.progress);
  const player = useGameStore((state) => state.simulation.world.player);
  const addGold = useGameStore((state) => state.addGold);
  const offlineReward = useGameStore((state) => state.lastOfflineReward);
  const expPercent = Math.min(100, Math.floor((progress.experience / progress.nextExperience) * 100));

  return (
    <div className="ui-layer">
      <div className="top-hud">
        <span>STAGE {progress.currentStage}-1</span>
        <span>LV {progress.level}</span>
        <span>G {progress.gold}</span>
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
        <button type="button" onClick={() => addGold(100)}>
          +100G
        </button>
        <span>ATK {player.attack}</span>
        <span>몹을 자동 추적/공격 중</span>
      </div>

      {offlineReward ? (
        <div className="offline-note">
          AFK {Math.floor(offlineReward.elapsedSeconds)}s · +{offlineReward.gold}G · +{offlineReward.experience}EXP
        </div>
      ) : null}
    </div>
  );
}
