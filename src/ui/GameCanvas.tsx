import { useEffect, useRef } from "react";
import { PixiWorld } from "../render/PixiWorld";
import { useGameStore } from "../store/gameStore";

export function GameCanvas({ dmgMode }: { dmgMode: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dmgModeRef = useRef(dmgMode);

  useEffect(() => {
    dmgModeRef.current = dmgMode;
  }, [dmgMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const pixi = new PixiWorld();
    let disposed = false;
    let frameId = 0;

    const renderFrame = () => {
      if (disposed) {
        return;
      }

      pixi.render(useGameStore.getState().simulation, { dmgMode: dmgModeRef.current });
      frameId = window.requestAnimationFrame(renderFrame);
    };

    pixi.mount(host).then(() => {
      if (disposed) {
        pixi.destroy();
        return;
      }
      renderFrame();
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      pixi.destroy();
    };
  }, []);

  return <div className="game" ref={hostRef} />;
}
