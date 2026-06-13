export function SurvivorSprite({ rows, scale = 2 }: { rows: string[]; scale?: number }) {
  const pixels = rows.flatMap((row, y) => [...row].map((char, x) => ({ char, x, y })));

  return (
    <span
      className="survivor-sprite"
      style={{
        gridTemplateColumns: `repeat(${rows[0]?.length ?? 1}, ${scale}px)`,
        gridAutoRows: `${scale}px`,
      }}
      aria-hidden="true"
    >
      {pixels.map((pixel) => (
        <i key={`${pixel.x}-${pixel.y}`} className={pixel.char === "." ? "p0" : `p${pixel.char}`} />
      ))}
    </span>
  );
}
