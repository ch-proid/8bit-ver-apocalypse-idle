import { PIXEL_FONT } from "./config";

let fontLoadPromise: Promise<void> | null = null;

export function loadPixelFont(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined" || !document.fonts) {
    return Promise.resolve();
  }

  if (document.fonts.check(`7px "${PIXEL_FONT.family}"`)) {
    return Promise.resolve();
  }

  fontLoadPromise ??= new FontFace(
    PIXEL_FONT.family,
    `url("${PIXEL_FONT.path}") format("woff2")`,
    { weight: "400" },
  )
    .load()
    .then((fontFace) => {
      document.fonts.add(fontFace);
      return document.fonts.ready.then(() => undefined);
    })
    .catch(() => undefined);

  return fontLoadPromise;
}
