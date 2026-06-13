export const GAMEBOY_SCREEN_WIDTH = 160;
export const GAMEBOY_SCREEN_HEIGHT = 144;

export const PIXI_RENDER_OPTIONS = {
  resolution: 1,
} as const;

export const STEPPED_MOTION = {
  stepPx: 2,
  updateRateHz: 8,
  floatingTextStepPx: 1,
  floatingTextUpdateRateHz: 30,
} as const;

export const RENDER_CLOCK = {
  displayEpsilon: 0.000001,
} as const;

export const BACKGROUND_RENDER = {
  pixelStep: 1,
  skyBandHeight: 44,
  columnParallaxDivisor: 3,
  columnSpacing: 36,
  columnY: 38,
  columnWidth: 14,
  columnHeight: 54,
  columnCapX: 5,
  columnCapY: 28,
  columnCapWidth: 4,
  columnCapHeight: 10,
  starParallax: 0.4,
  speckCount: 32,
  speckSpacingX: 37,
  speckSpacingY: 19,
  speckY: 22,
  speckRangeY: 118,
  brightSpeckEvery: 5,
  speckSize: 1,
} as const;

export const PLATFORM_RENDER = {
  topLineHeight: 2,
} as const;

export const PLAYER_FALLBACK_RENDER = {
  accentOffsetX: 2,
  accentWidthInset: 3,
  accentHeight: 4,
} as const;

export const MONSTER_FALLBACK_RENDER = {
  deathMinAlpha: 0.2,
  bodyOffsetY: 2,
  eyeOffsetXRatio: 0.65,
  eyeOffsetY: 3,
  eyeSize: 1,
} as const;

export const HP_BAR_RENDER = {
  offsetX: -2,
  offsetY: -5,
} as const;

export const FLOATING_TEXT_RENDER = {
  fontFamily: "monospace",
  fontSize: 7,
  fontWeight: "700",
  anchor: 0.5,
  stackOffsetY: -7,
} as const;
