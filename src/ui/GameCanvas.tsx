import { useEffect, useRef } from "react";
import { PixiWorld } from "../render/PixiWorld";
import { useGameStore } from "../store/gameStore";

export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const pixi = new PixiWorld();
    let disposed = false;

    pixi.mount(host).then(() => {
      if (disposed) {
        pixi.destroy();
        return;
      }
      pixi.render(useGameStore.getState().simulation);
    });

    const unsubscribe = useGameStore.subscribe((state) => {
      pixi.render(state.simulation);
    });

    return () => {
      disposed = true;
      unsubscribe();
      pixi.destroy();
    };
  }, []);

  return <div className="game-canvas-host" ref={hostRef} />;
}
