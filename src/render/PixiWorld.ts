import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  type ColorSource,
  type Texture,
} from "pixi.js";
import { MONSTER_ASSETS, PLAYER_CHARACTER, type PixelSpriteAsset } from "../data/assets";
import { MONSTER_BALANCE, WORLD } from "../data/balance";
import { CHAPTER_PALETTES, PLACEHOLDER_COLORS } from "../data/palettes";
import type { FloatingText, Monster, SimulationState } from "../core/types";
import {
  BACKGROUND_RENDER,
  FLOATING_TEXT_RENDER,
  GAMEBOY_SCREEN_HEIGHT,
  GAMEBOY_SCREEN_WIDTH,
  HP_BAR_RENDER,
  MONSTER_FALLBACK_RENDER,
  PIXI_RENDER_OPTIONS,
  PLAYER_FALLBACK_RENDER,
  PLATFORM_RENDER,
  RENDER_CLOCK,
  STEPPED_MOTION,
} from "./config";

const ENTITY_DISPLAY_INTERVAL = 1 / STEPPED_MOTION.updateRateHz;
const FLOATING_TEXT_DISPLAY_INTERVAL = 1 / STEPPED_MOTION.floatingTextUpdateRateHz;

interface EntityDisplay {
  x: number;
  y: number;
  direction: -1 | 1;
  walkFrame: 0 | 1;
}

interface FloatingDisplay {
  x: number;
  y: number;
}

export interface RenderOptions {
  dmgMode?: boolean;
}

export class PixiWorld {
  private app: Application | null = null;
  private world = new Container();
  private bg = new Graphics();
  private platforms = new Graphics();
  private playerFallback = new Graphics();
  private playerSprite: Sprite | null = null;
  private monsters = new Map<string, Graphics>();
  private monsterSprites = new Map<string, Sprite>();
  private monsterTextures = new Map<string, Texture>();
  private loadingMonsterAssets = new Set<string>();
  private hpBars = new Map<string, Graphics>();
  private floating = new Map<string, Text>();
  private monsterDisplays = new Map<string, EntityDisplay>();
  private floatingDisplays = new Map<string, FloatingDisplay>();
  private playerDisplay: EntityDisplay | null = null;
  private cameraDisplayX = 0;
  private nextEntityDisplayAt = 0;
  private nextFloatingDisplayAt = 0;
  private lastSimulationElapsed = 0;
  private walkFrame: 0 | 1 = 0;

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      width: GAMEBOY_SCREEN_WIDTH,
      height: GAMEBOY_SCREEN_HEIGHT,
      background: CHAPTER_PALETTES.bloodBanquet[0],
      antialias: false,
      resolution: PIXI_RENDER_OPTIONS.resolution,
      autoDensity: false,
      roundPixels: true,
    });

    this.app = app;
    app.canvas.className = "pixi-canvas";
    host.appendChild(app.canvas);
    app.stage.addChild(this.bg);
    app.stage.addChild(this.world);
    this.world.addChild(this.platforms);
    this.world.addChild(this.playerFallback);

    void this.loadPlayerSprite(app);
  }

  destroy(): void {
    const app = this.app;
    this.app = null;
    if (app) {
      try {
        app.destroy(true, { children: true });
      } catch {
        app.canvas.remove();
      }
    }
    this.playerSprite = null;
    this.monsters.clear();
    this.monsterSprites.clear();
    this.monsterDisplays.clear();
    this.monsterTextures.clear();
    this.loadingMonsterAssets.clear();
    this.hpBars.clear();
    this.floating.clear();
    this.floatingDisplays.clear();
    this.playerDisplay = null;
  }

  render(simulation: SimulationState, options: RenderOptions = {}): void {
    if (!this.app) {
      return;
    }

    this.updateDisplayState(simulation);

    const dmgMode = options.dmgMode === true;
    const cameraX = this.cameraDisplayX;
    this.world.x = -cameraX;
    this.drawBackground(cameraX, dmgMode);
    this.drawPlatforms(simulation, dmgMode);
    this.drawPlayer(simulation, dmgMode);
    this.drawMonsters(simulation, dmgMode);
    this.drawFloatingTexts(simulation.world.floatingTexts, dmgMode);
  }

  private async loadPlayerSprite(app: Application): Promise<void> {
    try {
      const playerTexture = await Assets.load(PLAYER_CHARACTER.path);
      if (this.app !== app) {
        return;
      }

      this.playerSprite = new Sprite(playerTexture);
      this.playerSprite.roundPixels = true;
      this.world.addChild(this.playerSprite);
    } catch {
      this.playerSprite = null;
    }
  }

  private drawBackground(cameraX: number, dmgMode: boolean): void {
    const palette = dmgMode ? CHAPTER_PALETTES.dmg : CHAPTER_PALETTES.bloodBanquet;
    this.bg.clear();
    this.bg.rect(0, 0, GAMEBOY_SCREEN_WIDTH, GAMEBOY_SCREEN_HEIGHT).fill(palette[0]);
    this.bg.rect(0, 0, GAMEBOY_SCREEN_WIDTH, BACKGROUND_RENDER.skyBandHeight).fill(palette[1]);

    const parallaxCameraX = quantize(cameraX / BACKGROUND_RENDER.columnParallaxDivisor, BACKGROUND_RENDER.pixelStep);
    const starCameraX = quantize(cameraX * BACKGROUND_RENDER.starParallax, BACKGROUND_RENDER.pixelStep);

    for (
      let x = -(parallaxCameraX % BACKGROUND_RENDER.columnSpacing);
      x < GAMEBOY_SCREEN_WIDTH + BACKGROUND_RENDER.columnSpacing;
      x += BACKGROUND_RENDER.columnSpacing
    ) {
      this.bg.rect(
        x,
        BACKGROUND_RENDER.columnY,
        BACKGROUND_RENDER.columnWidth,
        BACKGROUND_RENDER.columnHeight,
      ).fill(palette[1]);
      this.bg.rect(
        x + BACKGROUND_RENDER.columnCapX,
        BACKGROUND_RENDER.columnCapY,
        BACKGROUND_RENDER.columnCapWidth,
        BACKGROUND_RENDER.columnCapHeight,
      ).fill(palette[2]);
    }

    for (let i = 0; i < BACKGROUND_RENDER.speckCount; i += 1) {
      const px = (i * BACKGROUND_RENDER.speckSpacingX - starCameraX) % GAMEBOY_SCREEN_WIDTH;
      const py = BACKGROUND_RENDER.speckY + ((i * BACKGROUND_RENDER.speckSpacingY) % BACKGROUND_RENDER.speckRangeY);
      this.bg.rect(px, py, BACKGROUND_RENDER.speckSize, BACKGROUND_RENDER.speckSize).fill(
        i % BACKGROUND_RENDER.brightSpeckEvery === 0
          ? palette[4]
          : palette[2],
      );
    }
  }

  private drawPlatforms(simulation: SimulationState, dmgMode: boolean): void {
    const colors = renderColors(dmgMode);
    this.platforms.clear();
    for (const platform of simulation.world.platforms) {
      this.platforms.rect(platform.x, platform.y, platform.width, platform.height).fill(colors.platform);
      this.platforms.rect(platform.x, platform.y, platform.width, PLATFORM_RENDER.topLineHeight).fill(colors.platformTop);
    }
  }

  private drawPlayer(simulation: SimulationState, dmgMode: boolean): void {
    const { player } = simulation.world;
    const colors = renderColors(dmgMode);
    const display = this.playerDisplay ?? toEntityDisplay(player.position.x, player.position.y, player.direction, this.walkFrame);
    this.playerFallback.clear();

    if (this.playerSprite) {
      this.playerFallback.visible = false;
      this.playerSprite.visible = true;
      this.playerSprite.tint = colors.spriteTint;
      this.playerSprite.scale.x = display.direction > 0 ? 1 : -1;
      this.playerSprite.scale.y = 1;
      this.playerSprite.x = Math.round(
        display.direction > 0
          ? display.x - PLAYER_CHARACTER.padding.left
          : display.x + player.width + PLAYER_CHARACTER.padding.right,
      );
      this.playerSprite.y = Math.round(display.y - PLAYER_CHARACTER.padding.top);
      return;
    }

    this.playerFallback.visible = true;
    this.playerFallback.rect(display.x, display.y, player.width, player.height).fill(colors.player);
    this.playerFallback.rect(
      display.x + PLAYER_FALLBACK_RENDER.accentOffsetX,
      display.y,
      player.width - PLAYER_FALLBACK_RENDER.accentWidthInset,
      PLAYER_FALLBACK_RENDER.accentHeight,
    ).fill(colors.playerAccent);
  }

  private drawMonsters(simulation: SimulationState, dmgMode: boolean): void {
    const aliveIds = new Set(simulation.world.monsters.map((monster) => monster.instanceId));

    for (const id of this.monsters.keys()) {
      if (!aliveIds.has(id)) {
        this.removeMonster(id);
      }
    }

    for (const monster of simulation.world.monsters) {
      this.drawMonster(monster, dmgMode);
    }
  }

  private drawMonster(monster: Monster, dmgMode: boolean): void {
    const colors = renderColors(dmgMode);
    const asset = MONSTER_ASSETS[monster.assetKey];
    if (asset) {
      this.loadMonsterTexture(monster.assetKey, asset);
    }

    const graphic = getOrCreate(this.monsters, monster.instanceId, () => {
      const item = new Graphics();
      this.world.addChild(item);
      return item;
    });
    const texture = asset ? this.monsterTextures.get(monster.assetKey) : undefined;
    const sprite = asset && texture
      ? getOrCreate(this.monsterSprites, monster.instanceId, () => {
        const item = new Sprite(texture);
        item.roundPixels = true;
        this.world.addChild(item);
        return item;
      })
      : undefined;
    const hpBar = getOrCreate(this.hpBars, monster.instanceId, () => {
      const item = new Graphics();
      this.world.addChild(item);
      return item;
    });

    const alpha = monster.alive
      ? 1
      : Math.max(MONSTER_FALLBACK_RENDER.deathMinAlpha, monster.fadeTimer / MONSTER_BALANCE.respawnFadeSeconds);
    const display = this.monsterDisplays.get(monster.instanceId)
      ?? toEntityDisplay(monster.position.x, monster.position.y, monster.direction, this.walkFrame);
    graphic.clear();
    graphic.alpha = alpha;
    if (sprite && asset) {
      graphic.visible = false;
      sprite.visible = true;
      sprite.alpha = alpha;
      sprite.tint = colors.spriteTint;
      sprite.scale.x = display.direction > 0 ? 1 : -1;
      sprite.scale.y = 1;
      sprite.x = Math.round(
        display.direction > 0
          ? display.x - asset.padding.left
          : display.x + monster.width + asset.padding.right,
      );
      sprite.y = Math.round(display.y - asset.padding.top);
    } else {
      this.monsterSprites.get(monster.instanceId)?.destroy();
      this.monsterSprites.delete(monster.instanceId);
      graphic.visible = true;
      graphic.rect(
        display.x,
        display.y + MONSTER_FALLBACK_RENDER.bodyOffsetY,
        monster.width,
        monster.height - MONSTER_FALLBACK_RENDER.bodyOffsetY,
      ).fill((dmgMode ? colors.monster : monster.color) as ColorSource);
      graphic.circle(
        display.x + monster.width / 2,
        display.y + MONSTER_FALLBACK_RENDER.eyeOffsetY,
        monster.width / 2,
      ).fill((dmgMode ? colors.monster : monster.color) as ColorSource);
      graphic.rect(
        display.x + monster.width * MONSTER_FALLBACK_RENDER.eyeOffsetXRatio,
        display.y + MONSTER_FALLBACK_RENDER.eyeOffsetY,
        MONSTER_FALLBACK_RENDER.eyeSize,
        MONSTER_FALLBACK_RENDER.eyeSize,
      ).fill(colors.hpBack);
    }

    hpBar.clear();
    hpBar.alpha = monster.alive ? 1 : 0;
    hpBar.rect(
      display.x + HP_BAR_RENDER.offsetX,
      display.y + HP_BAR_RENDER.offsetY,
      MONSTER_BALANCE.hpBarWidth,
      MONSTER_BALANCE.hpBarHeight,
    ).fill(colors.hpBack);
    hpBar.rect(
      display.x + HP_BAR_RENDER.offsetX,
      display.y + HP_BAR_RENDER.offsetY,
      MONSTER_BALANCE.hpBarWidth * (monster.hp / monster.maxHp),
      MONSTER_BALANCE.hpBarHeight,
    ).fill(colors.hp);

    this.world.addChild(hpBar);
  }

  private drawFloatingTexts(texts: FloatingText[], dmgMode: boolean): void {
    const colors = renderColors(dmgMode);
    const ids = new Set(texts.map((text) => text.id));
    for (const id of this.floating.keys()) {
      if (!ids.has(id)) {
        const item = this.floating.get(id);
        item?.destroy();
        this.floating.delete(id);
      }
    }

    const stackedCounts = new Map<string, number>();

    for (const text of texts) {
      const item = getOrCreate(this.floating, text.id, () => {
        const created = new Text({
          text: text.value,
          style: new TextStyle({
            fontFamily: FLOATING_TEXT_RENDER.fontFamily,
            fontSize: FLOATING_TEXT_RENDER.fontSize,
            fill: dmgMode ? colors.floatingText : text.color,
            fontWeight: FLOATING_TEXT_RENDER.fontWeight,
          }),
        });
        created.anchor.set(FLOATING_TEXT_RENDER.anchor, FLOATING_TEXT_RENDER.anchor);
        this.world.addChild(created);
        return created;
      });

      item.text = text.value;
      item.style.fill = dmgMode ? colors.floatingText : text.color;
      item.alpha = Math.max(0, 1 - text.age / text.ttl);
      const display = this.floatingDisplays.get(text.id)
        ?? { x: quantize(text.position.x, STEPPED_MOTION.floatingTextStepPx), y: quantize(text.position.y, STEPPED_MOTION.floatingTextStepPx) };
      const stackKey = `${display.x}:${display.y}`;
      const stackIndex = stackedCounts.get(stackKey) ?? 0;
      stackedCounts.set(stackKey, stackIndex + 1);
      item.position.set(display.x, display.y + stackIndex * FLOATING_TEXT_RENDER.stackOffsetY);
    }
  }

  private updateDisplayState(simulation: SimulationState): void {
    const elapsed = simulation.world.elapsed;
    const resetClock = elapsed < this.lastSimulationElapsed;

    if (resetClock) {
      this.nextEntityDisplayAt = 0;
      this.nextFloatingDisplayAt = 0;
      this.monsterDisplays.clear();
      this.floatingDisplays.clear();
      this.playerDisplay = null;
    }

    if (!this.playerDisplay || elapsed + RENDER_CLOCK.displayEpsilon >= this.nextEntityDisplayAt) {
      this.walkFrame = this.walkFrame === 0 ? 1 : 0;
      this.updateEntityDisplays(simulation);
      this.nextEntityDisplayAt = elapsed + ENTITY_DISPLAY_INTERVAL;
    }

    if (elapsed + RENDER_CLOCK.displayEpsilon >= this.nextFloatingDisplayAt) {
      this.updateFloatingDisplays(simulation.world.floatingTexts);
      this.nextFloatingDisplayAt = elapsed + FLOATING_TEXT_DISPLAY_INTERVAL;
    } else {
      this.ensureNewFloatingDisplays(simulation.world.floatingTexts);
    }

    this.lastSimulationElapsed = elapsed;
  }

  private updateEntityDisplays(simulation: SimulationState): void {
    const player = simulation.world.player;
    const cameraX = clamp(
      player.position.x - GAMEBOY_SCREEN_WIDTH / 2,
      0,
      WORLD.width - GAMEBOY_SCREEN_WIDTH,
    );
    this.cameraDisplayX = quantize(cameraX, STEPPED_MOTION.stepPx);
    this.playerDisplay = toEntityDisplay(player.position.x, player.position.y, player.direction, this.walkFrame);

    const liveIds = new Set(simulation.world.monsters.map((monster) => monster.instanceId));
    for (const id of this.monsterDisplays.keys()) {
      if (!liveIds.has(id)) {
        this.monsterDisplays.delete(id);
      }
    }

    for (const monster of simulation.world.monsters) {
      this.monsterDisplays.set(
        monster.instanceId,
        toEntityDisplay(monster.position.x, monster.position.y, monster.direction, this.walkFrame),
      );
    }
  }

  private updateFloatingDisplays(texts: FloatingText[]): void {
    const liveIds = new Set(texts.map((text) => text.id));
    for (const id of this.floatingDisplays.keys()) {
      if (!liveIds.has(id)) {
        this.floatingDisplays.delete(id);
      }
    }

    for (const text of texts) {
      this.floatingDisplays.set(text.id, {
        x: quantize(text.position.x, STEPPED_MOTION.floatingTextStepPx),
        y: quantize(text.position.y, STEPPED_MOTION.floatingTextStepPx),
      });
    }
  }

  private ensureNewFloatingDisplays(texts: FloatingText[]): void {
    for (const text of texts) {
      if (!this.floatingDisplays.has(text.id)) {
        this.floatingDisplays.set(text.id, {
          x: quantize(text.position.x, STEPPED_MOTION.floatingTextStepPx),
          y: quantize(text.position.y, STEPPED_MOTION.floatingTextStepPx),
        });
      }
    }
  }

  private loadMonsterTexture(assetKey: string, asset: PixelSpriteAsset): void {
    if (this.monsterTextures.has(assetKey) || this.loadingMonsterAssets.has(assetKey)) {
      return;
    }

    this.loadingMonsterAssets.add(assetKey);
    void Assets.load(asset.path)
      .then((texture) => {
        this.monsterTextures.set(assetKey, texture as Texture);
      })
      .catch(() => {
        this.monsterTextures.delete(assetKey);
      })
      .finally(() => {
        this.loadingMonsterAssets.delete(assetKey);
      });
  }

  private removeMonster(id: string): void {
    this.monsters.get(id)?.destroy();
    this.monsterSprites.get(id)?.destroy();
    this.hpBars.get(id)?.destroy();
    this.monsters.delete(id);
    this.monsterSprites.delete(id);
    this.monsterDisplays.delete(id);
    this.hpBars.delete(id);
  }
}

function getOrCreate<T>(map: Map<string, T>, key: string, create: () => T): T {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const item = create();
  map.set(key, item);
  return item;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function toEntityDisplay(x: number, y: number, direction: -1 | 1, walkFrame: 0 | 1): EntityDisplay {
  return {
    x: quantize(x, STEPPED_MOTION.stepPx),
    y: quantize(y, STEPPED_MOTION.stepPx),
    direction,
    walkFrame,
  };
}

function renderColors(dmgMode: boolean) {
  if (dmgMode) {
    return {
      platform: CHAPTER_PALETTES.dmg[1],
      platformTop: CHAPTER_PALETTES.dmg[2],
      player: CHAPTER_PALETTES.dmg[4],
      playerAccent: CHAPTER_PALETTES.dmg[3],
      monster: CHAPTER_PALETTES.dmg[4],
      hp: CHAPTER_PALETTES.dmg[3],
      hpBack: CHAPTER_PALETTES.dmg[0],
      floatingText: CHAPTER_PALETTES.dmg[4],
      spriteTint: 0xe0f8d0,
    };
  }

  return {
    platform: PLACEHOLDER_COLORS.platform,
    platformTop: PLACEHOLDER_COLORS.platformTop,
    player: PLACEHOLDER_COLORS.player,
    playerAccent: PLACEHOLDER_COLORS.playerAccent,
    monster: PLACEHOLDER_COLORS.monster,
    hp: PLACEHOLDER_COLORS.hp,
    hpBack: PLACEHOLDER_COLORS.hpBack,
    floatingText: PLACEHOLDER_COLORS.gold,
    spriteTint: 0xffffff,
  };
}
