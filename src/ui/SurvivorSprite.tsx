import type { SurvivorSkin } from "../data/sprites/survivors";

export function SurvivorSprite({ skin, scale = 2 }: { skin: SurvivorSkin; scale?: number }) {
  const frameX = skin.previewFrame * skin.frameWidth * scale;

  return (
    <span
      className="survivor-sprite"
      style={{
        width: `${skin.frameWidth * scale}px`,
        height: `${skin.frameHeight * scale}px`,
        backgroundImage: `url(${skin.path})`,
        backgroundSize: `${skin.sheetWidth * scale}px ${skin.sheetHeight * scale}px`,
        backgroundPosition: `-${frameX}px 0`,
      }}
      aria-hidden="true"
    />
  );
}
