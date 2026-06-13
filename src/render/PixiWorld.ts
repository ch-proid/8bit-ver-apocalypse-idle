import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type ColorSource,
} from "pixi.js";
import { MONSTER_ASSETS, PLAYER_CLASS_ASSETS, STAGE_MAP_ASSETS, type PixelSpriteAsset, type PlayerSpriteAsset } from "../data/assets";
import {
  DROP_ICON_FRAMES,
  DROP_ICON_SHEETS,
  type DropIconId,
  type DropIconFrame,
  type DropIconSheetId,
} from "../data/dropIcons";
import { DROP_REWARD_BALANCE, MONSTER_BALANCE, WORLD } from "../data/balance";
import { CHAPTER_PALETTES, PLACEHOLDER_COLORS } from "../data/palettes";
import type { ClassId, DropIconEvent, DropIconKind, FloatingText, Monster, Platform, SimulationState } from "../core/types";
import {
  BACKGROUND_RENDER,
  DROP_ICON_RENDER,
  FLOATING_TEXT_RENDER,
  GAMEBOY_SCREEN_HEIGHT,
  GAMEBOY_SCREEN_WIDTH,
  HP_BAR_RENDER,
  MONSTER_FALLBACK_RENDER,
  MONSTER_TRANSITION_RENDER,
  PIXI_RENDER_OPTIONS,
  PLAYER_HP_BAR_RENDER,
  PLAYER_FALLBACK_RENDER,
  PLATFORM_RENDER,
  PROJECTILE_RENDER,
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

interface MonsterRenderState {
  wasAlive: boolean;
}

interface RenderProjectile {
  id: string;
  startTime: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  sprite: Sprite;
}

export interface RenderOptions {
  dmgMode?: boolean;
}

export class PixiWorld {
  private app: Application | null = null;
  private world = new Container();
  private bg = new Graphics();
  private projectileLayer = new Container();
  private dropIconLayer = new Container();
  private stageBackgroundSprite: Sprite | null = null;
  private stageTerrainSprite: Sprite | null = null;
  private platforms = new Graphics();
  private playerFallback = new Graphics();
  private playerHpBar = new Graphics();
  private playerSprite: Sprite | null = null;
  private playerClassId: ClassId | null = null;
  private loadingPlayerClassId: ClassId | null = null;
  private playerAsset: PlayerSpriteAsset | null = null;
  private playerFrames: Texture[] = [];
  private mageProjectileTexture: Texture | null = null;
  private monsters = new Map<string, Graphics>();
  private monsterSprites = new Map<string, Sprite>();
  private monsterTextures = new Map<string, Texture>();
  private monsterFrames = new Map<string, Texture[]>();
  private loadingMonsterAssets = new Set<string>();
  private hpBars = new Map<string, Graphics>();
  private floating = new Map<string, Text>();
  private dropIcons = new Map<string, Sprite>();
  private dropIconTextures = new Map<DropIconId, Texture>();
  private loadingDropIcons = false;
  private projectiles = new Map<string, RenderProjectile>();
  private monsterDisplays = new Map<string, EntityDisplay>();
  private monsterRenderStates = new Map<string, MonsterRenderState>();
  private floatingDisplays = new Map<string, FloatingDisplay>();
  private playerDisplay: EntityDisplay | null = null;
  private cameraDisplayX = 0;
  private nextEntityDisplayAt = 0;
  private nextFloatingDisplayAt = 0;
  private lastSimulationElapsed = 0;
  private lastPlayerAttackTimer = 0;
  private nextProjectileId = 1;
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
    this.world.addChild(this.projectileLayer);
    this.world.addChild(this.playerHpBar);
    this.world.addChild(this.dropIconLayer);

    void this.loadStageMap(app);
    void this.loadDropIcons(app);
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
    this.stageBackgroundSprite = null;
    this.stageTerrainSprite = null;
    this.playerSprite = null;
    this.playerClassId = null;
    this.loadingPlayerClassId = null;
    this.playerAsset = null;
    this.playerFrames = [];
    this.mageProjectileTexture = null;
    this.monsters.clear();
    this.monsterSprites.clear();
    this.monsterDisplays.clear();
    this.monsterRenderStates.clear();
    this.monsterTextures.clear();
    this.monsterFrames.clear();
    this.loadingMonsterAssets.clear();
    this.hpBars.clear();
    this.floating.clear();
    this.dropIcons.clear();
    this.dropIconTextures.clear();
    this.loadingDropIcons = false;
    this.projectiles.clear();
    this.floatingDisplays.clear();
    this.playerDisplay = null;
  }

  render(simulation: SimulationState, options: RenderOptions = {}): void {
    if (!this.app) {
      return;
    }

    this.updateDisplayState(simulation);
    this.requestPlayerSprite(simulation.progress.classId);

    const dmgMode = options.dmgMode === true;
    const cameraX = this.cameraDisplayX;
    this.world.x = -cameraX;
    this.drawBackground(cameraX, dmgMode);
    this.drawStageMap(dmgMode);
    this.drawPlatforms(simulation, dmgMode);
    this.drawPlayer(simulation, dmgMode);
    this.drawPlayerHpBar(simulation, dmgMode);
    this.drawMonsters(simulation, dmgMode);
    this.maybeLaunchMageProjectile(simulation);
    this.drawProjectiles(simulation, dmgMode);
    this.drawDropIcons(simulation);
    this.drawFloatingTexts(simulation.world.floatingTexts, dmgMode);
    this.lastPlayerAttackTimer = simulation.world.player.attackTimer;
  }

  private requestPlayerSprite(classId: ClassId): void {
    const app = this.app;
    if (!app || this.playerClassId === classId || this.loadingPlayerClassId === classId) {
      return;
    }

    void this.loadPlayerSprite(app, classId);
  }

  private async loadPlayerSprite(app: Application, classId: ClassId): Promise<void> {
    const asset = PLAYER_CLASS_ASSETS[classId];
    this.loadingPlayerClassId = classId;
    try {
      const playerTexture = await Assets.load<Texture>(asset.path);
      if (this.app !== app || this.loadingPlayerClassId !== classId) {
        return;
      }

      this.playerSprite?.destroy();
      this.playerFrames = createSpriteFrames(playerTexture, asset);
      this.mageProjectileTexture = asset.projectileFrameIndex !== undefined
        ? createFrameTexture(playerTexture, asset, asset.projectileFrameIndex)
        : null;
      this.playerAsset = asset;
      this.playerClassId = classId;
      this.playerSprite = new Sprite(this.playerFrames[0] ?? playerTexture);
      this.playerSprite.roundPixels = true;
      this.world.addChild(this.playerSprite);
    } catch {
      this.playerSprite = null;
      this.playerClassId = null;
      this.playerAsset = null;
      this.mageProjectileTexture = null;
    } finally {
      if (this.loadingPlayerClassId === classId) {
        this.loadingPlayerClassId = null;
      }
    }
  }

  private async loadStageMap(app: Application): Promise<void> {
    try {
      const [backgroundTexture, terrainTexture] = await Promise.all([
        Assets.load<Texture>(STAGE_MAP_ASSETS.stage1.backgroundPath),
        Assets.load<Texture>(STAGE_MAP_ASSETS.stage1.terrainPath),
      ]);
      if (this.app !== app) {
        return;
      }

      this.stageBackgroundSprite = new Sprite(backgroundTexture);
      this.stageTerrainSprite = new Sprite(terrainTexture);
      this.stageBackgroundSprite.roundPixels = true;
      this.stageTerrainSprite.roundPixels = true;
      this.world.addChildAt(this.stageBackgroundSprite, 0);
      this.world.addChildAt(this.stageTerrainSprite, 2);
    } catch {
      this.stageBackgroundSprite = null;
      this.stageTerrainSprite = null;
    }
  }

  private async loadDropIcons(app: Application): Promise<void> {
    if (this.loadingDropIcons || this.dropIconTextures.size > 0) {
      return;
    }

    this.loadingDropIcons = true;
    try {
      const sheets = await Promise.all(
        Object.entries(DROP_ICON_SHEETS).map(async ([id, sheet]) => {
          const texture = await Assets.load<Texture>(sheet.path);
          return [id as DropIconSheetId, texture] as const;
        }),
      );
      if (this.app !== app) {
        return;
      }

      const sheetTextures = new Map<DropIconSheetId, Texture>(sheets);
      for (const [iconId, frame] of Object.entries(DROP_ICON_FRAMES) as Array<[DropIconId, DropIconFrame]>) {
        const sheet = DROP_ICON_SHEETS[frame.sheet];
        const sheetTexture = sheetTextures.get(frame.sheet);
        if (!sheetTexture) {
          continue;
        }
        const x = frame.frameIndex % sheet.columns * sheet.frameSize;
        const y = Math.floor(frame.frameIndex / sheet.columns) * sheet.frameSize;
        this.dropIconTextures.set(iconId, new Texture({
          source: sheetTexture.source,
          frame: new Rectangle(x, y, sheet.frameSize, sheet.frameSize),
        }));
      }
    } catch {
      this.dropIconTextures.clear();
    } finally {
      this.loadingDropIcons = false;
    }
  }

  private drawBackground(cameraX: number, dmgMode: boolean): void {
    const palette = dmgMode ? CHAPTER_PALETTES.dmg : CHAPTER_PALETTES.bloodBanquet;
    this.bg.clear();
    if (this.stageBackgroundSprite) {
      this.bg.rect(0, 0, GAMEBOY_SCREEN_WIDTH, GAMEBOY_SCREEN_HEIGHT).fill(palette[0]);
      return;
    }

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

  private drawStageMap(dmgMode: boolean): void {
    const colors = renderColors(dmgMode);
    if (this.stageBackgroundSprite) {
      this.stageBackgroundSprite.visible = true;
      this.stageBackgroundSprite.x = 0;
      this.stageBackgroundSprite.y = 0;
      this.stageBackgroundSprite.tint = colors.mapTint;
    }
    if (this.stageTerrainSprite) {
      this.stageTerrainSprite.visible = true;
      this.stageTerrainSprite.x = 0;
      this.stageTerrainSprite.y = 0;
      this.stageTerrainSprite.tint = colors.mapTint;
    }
  }

  private drawPlatforms(simulation: SimulationState, dmgMode: boolean): void {
    const colors = renderColors(dmgMode);
    this.platforms.clear();
    if (this.stageTerrainSprite) {
      this.platforms.visible = false;
      return;
    }

    this.platforms.visible = true;
    for (const platform of simulation.world.platforms) {
      this.platforms.rect(platform.x, platform.y, platform.width, platform.height).fill(colors.platform);
      this.platforms.rect(platform.x, platform.y, platform.width, PLATFORM_RENDER.topLineHeight).fill(colors.platformTop);
    }
  }

  private drawPlayer(simulation: SimulationState, dmgMode: boolean): void {
    const { player } = simulation.world;
    const colors = renderColors(dmgMode);
    const display = this.playerDisplay ?? toEntityDisplay(player.position.x, player.position.y, player.direction, this.walkFrame);
    const asset = this.playerClassId === simulation.progress.classId ? this.playerAsset : null;
    this.playerFallback.clear();

    if (this.playerSprite && asset) {
      this.playerFallback.visible = false;
      this.playerSprite.visible = true;
      this.playerSprite.texture = this.playerFrames[display.walkFrame] ?? this.playerFrames[0] ?? this.playerSprite.texture;
      this.playerSprite.tint = colors.spriteTint;
      this.playerSprite.scale.x = display.direction > 0 ? 1 : -1;
      this.playerSprite.scale.y = 1;
      this.playerSprite.x = Math.round(playerSpriteX(display.x, player.width, display.direction, asset));
      this.playerSprite.y = Math.round(
        display.y + player.height + asset.padding.bottom - spriteFrameHeight(asset),
      );
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

  private drawPlayerHpBar(simulation: SimulationState, dmgMode: boolean): void {
    const { player } = simulation.world;
    const colors = renderColors(dmgMode);
    const hpPercent = clamp(player.hp / Math.max(1, player.maxHp), 0, 1);
    this.playerHpBar.clear();

    if (PLAYER_HP_BAR_RENDER.hideWhenFull && hpPercent >= 1) {
      this.playerHpBar.alpha = 0;
      return;
    }

    const display = this.playerDisplay ?? toEntityDisplay(player.position.x, player.position.y, player.direction, this.walkFrame);
    const x = Math.round(display.x + player.width / 2 - PLAYER_HP_BAR_RENDER.width / 2);
    const asset = this.playerClassId === simulation.progress.classId ? this.playerAsset : null;
    const spriteTop = asset
      ? display.y + player.height + asset.padding.bottom - spriteFrameHeight(asset)
      : display.y;
    const y = Math.round(spriteTop + PLAYER_HP_BAR_RENDER.offsetY);
    this.playerHpBar.alpha = 1;
    this.playerHpBar
      .rect(x, y, PLAYER_HP_BAR_RENDER.width, PLAYER_HP_BAR_RENDER.height)
      .fill(colors.hpBack);
    this.playerHpBar
      .rect(x, y, Math.round(PLAYER_HP_BAR_RENDER.width * hpPercent), PLAYER_HP_BAR_RENDER.height)
      .fill(colors.hp);
    this.world.addChild(this.playerHpBar);
  }

  private drawMonsters(simulation: SimulationState, dmgMode: boolean): void {
    const aliveIds = new Set(simulation.world.monsters.map((monster) => monster.instanceId));

    for (const id of this.monsters.keys()) {
      if (!aliveIds.has(id)) {
        this.removeMonster(id);
      }
    }

    for (const monster of simulation.world.monsters) {
      this.drawMonster(monster, simulation.world.elapsed, dmgMode);
    }
  }

  private drawMonster(monster: Monster, elapsed: number, dmgMode: boolean): void {
    const colors = renderColors(dmgMode);
    const asset = MONSTER_ASSETS[monster.assetKey];
    if (asset) {
      this.loadMonsterTexture(monster.assetKey, asset);
    }

    this.updateMonsterRenderState(monster);
    const alpha = this.monsterAlpha(monster);
    if (alpha <= 0) {
      this.removeMonsterVisuals(monster.instanceId);
      return;
    }

    const graphic = getOrCreate(this.monsters, monster.instanceId, () => {
      const item = new Graphics();
      this.world.addChild(item);
      return item;
    });
    const texture = asset ? this.monsterTextures.get(monster.assetKey) : undefined;
    const frames = asset ? this.monsterFrames.get(monster.assetKey) : undefined;
    const display = this.monsterDisplays.get(monster.instanceId)
      ?? toEntityDisplay(monster.position.x, monster.position.y, monster.direction, this.walkFrame);
    const currentTexture = frames?.[display.walkFrame] ?? texture;
    const monsterTint = monster.spawnInvulnTimer > 0 ? MONSTER_TRANSITION_RENDER.spawnSilhouetteTint : colors.spriteTint;
    const fallbackColor = monster.spawnInvulnTimer > 0
      ? MONSTER_TRANSITION_RENDER.spawnSilhouetteTint
      : (dmgMode ? colors.monster : monster.color);
    const sprite = asset && currentTexture
      ? getOrCreate(this.monsterSprites, monster.instanceId, () => {
        const item = new Sprite(currentTexture);
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

    graphic.clear();
    graphic.alpha = alpha;
    if (sprite && asset) {
      graphic.visible = false;
      sprite.visible = true;
      sprite.texture = currentTexture ?? sprite.texture;
      sprite.alpha = alpha;
      sprite.tint = monsterTint;
      sprite.scale.x = display.direction > 0 ? 1 : -1;
      sprite.scale.y = 1;
      sprite.x = Math.round(
        display.direction > 0
          ? display.x - asset.padding.left
          : display.x + monster.width + asset.padding.right,
      );
      sprite.y = Math.round(display.y + monster.height + asset.padding.bottom - spriteFrameHeight(asset));
    } else {
      this.monsterSprites.get(monster.instanceId)?.destroy();
      this.monsterSprites.delete(monster.instanceId);
      graphic.visible = true;
      graphic.rect(
        display.x,
        display.y + MONSTER_FALLBACK_RENDER.bodyOffsetY,
        monster.width,
        monster.height - MONSTER_FALLBACK_RENDER.bodyOffsetY,
      ).fill(fallbackColor as ColorSource);
      graphic.circle(
        display.x + monster.width / 2,
        display.y + MONSTER_FALLBACK_RENDER.eyeOffsetY,
        monster.width / 2,
      ).fill(fallbackColor as ColorSource);
      graphic.rect(
        display.x + monster.width * MONSTER_FALLBACK_RENDER.eyeOffsetXRatio,
        display.y + MONSTER_FALLBACK_RENDER.eyeOffsetY,
        MONSTER_FALLBACK_RENDER.eyeSize,
        MONSTER_FALLBACK_RENDER.eyeSize,
      ).fill(colors.hpBack);
    }

    hpBar.clear();
    if (monster.alive && monster.spawnInvulnTimer <= 0 && monster.hp < monster.maxHp) {
      hpBar.alpha = alpha;
      hpBar.rect(
        display.x + HP_BAR_RENDER.offsetX,
        display.y + HP_BAR_RENDER.offsetY,
        MONSTER_BALANCE.hpBarWidth,
        MONSTER_BALANCE.hpBarHeight,
      ).fill(colors.hpBack);
      hpBar.rect(
        display.x + HP_BAR_RENDER.offsetX,
        display.y + HP_BAR_RENDER.offsetY,
        MONSTER_BALANCE.hpBarWidth * clamp(monster.hp / monster.maxHp, 0, 1),
        MONSTER_BALANCE.hpBarHeight,
      ).fill(colors.hp);
    } else {
      hpBar.alpha = 0;
    }

    this.world.addChild(hpBar);
  }

  private updateMonsterRenderState(monster: Monster): MonsterRenderState {
    const existing = this.monsterRenderStates.get(monster.instanceId);
    if (!existing) {
      const initialState: MonsterRenderState = {
        wasAlive: monster.alive,
      };
      this.monsterRenderStates.set(monster.instanceId, initialState);
      return initialState;
    }

    if (!monster.alive) {
      existing.wasAlive = false;
      return existing;
    }

    if (!existing.wasAlive) {
      existing.wasAlive = true;
    }
    return existing;
  }

  private monsterAlpha(monster: Monster): number {
    if (!monster.alive) {
      return Math.max(
        MONSTER_TRANSITION_RENDER.deathMinAlpha,
        monster.fadeTimer / MONSTER_BALANCE.respawnFadeSeconds,
      );
    }

    return 1;
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
          resolution: FLOATING_TEXT_RENDER.resolution,
          roundPixels: true,
          textureStyle: {
            scaleMode: "nearest",
          },
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
      item.roundPixels = true;
      item.resolution = FLOATING_TEXT_RENDER.resolution;
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

  private drawDropIcons(simulation: SimulationState): void {
    const ids = new Set(simulation.world.dropIcons.map((icon) => icon.id));

    for (const id of this.dropIcons.keys()) {
      if (!ids.has(id)) {
        const item = this.dropIcons.get(id);
        item?.destroy();
        this.dropIcons.delete(id);
      }
    }

    if (this.dropIconTextures.size <= 0) {
      return;
    }

    const stackedCounts = new Map<string, number>();
    for (const icon of simulation.world.dropIcons) {
      const texture = this.dropIconTextures.get(icon.kind);
      if (!texture) {
        continue;
      }

      const item = getOrCreate(this.dropIcons, icon.id, () => {
        const created = new Sprite(texture);
        created.roundPixels = true;
        created.scale.set(DROP_ICON_RENDER.scale);
        this.dropIconLayer.addChild(created);
        return created;
      });

      item.texture = texture;
      item.tint = 0xffffff;
      const frameSize = dropIconFrameSize(icon.kind);
      const rawDisplay = dropIconDisplay(icon, simulation, frameSize);
      const display = {
        x: quantize(rawDisplay.x, STEPPED_MOTION.floatingTextStepPx),
        y: quantize(rawDisplay.y, STEPPED_MOTION.floatingTextStepPx),
      };
      const stackKey = `${display.x}:${display.y}`;
      const stackIndex = stackedCounts.get(stackKey) ?? 0;
      stackedCounts.set(stackKey, stackIndex + 1);
      item.alpha = dropIconAlpha(icon);
      item.position.set(
        Math.round(display.x + DROP_ICON_RENDER.offsetX),
        Math.round(display.y + DROP_ICON_RENDER.offsetY + stackIndex * DROP_ICON_RENDER.stackOffsetY),
      );
      item.visible = true;
    }

    this.world.addChild(this.dropIconLayer);
  }

  private maybeLaunchMageProjectile(simulation: SimulationState): void {
    const { player, monsters } = simulation.world;
    if (
      simulation.progress.classId !== "mage"
      || !this.mageProjectileTexture
      || player.state !== "ATTACK"
      || !player.targetId
      || player.attackTimer <= this.lastPlayerAttackTimer + RENDER_CLOCK.displayEpsilon
    ) {
      return;
    }

    const target = monsters.find((monster) => monster.instanceId === player.targetId && monster.alive);
    if (!target) {
      return;
    }

    const playerDisplay = this.playerDisplay ?? toEntityDisplay(player.position.x, player.position.y, player.direction, this.walkFrame);
    const targetDisplay = this.monsterDisplays.get(target.instanceId)
      ?? toEntityDisplay(target.position.x, target.position.y, target.direction, this.walkFrame);
    const sprite = new Sprite(this.mageProjectileTexture);
    sprite.roundPixels = true;
    this.projectileLayer.addChild(sprite);

    const id = `proj${this.nextProjectileId++}`;
    this.projectiles.set(id, {
      id,
      startTime: simulation.world.elapsed,
      startX: playerDisplay.x + player.width / 2,
      startY: playerDisplay.y + player.height / 2 + PROJECTILE_RENDER.originYOffset,
      endX: targetDisplay.x + target.width / 2,
      endY: targetDisplay.y + target.height / 2,
      sprite,
    });
  }

  private drawProjectiles(simulation: SimulationState, dmgMode: boolean): void {
    const colors = renderColors(dmgMode);
    this.world.addChild(this.projectileLayer);

    for (const [id, projectile] of this.projectiles) {
      const age = simulation.world.elapsed - projectile.startTime;
      const progress = Math.max(0, Math.min(1, age / PROJECTILE_RENDER.durationSeconds));
      if (progress >= 1) {
        projectile.sprite.destroy();
        this.projectiles.delete(id);
        continue;
      }

      const x = quantize(
        projectile.startX + (projectile.endX - projectile.startX) * progress,
        PROJECTILE_RENDER.stepPx,
      );
      const y = quantize(
        projectile.startY + (projectile.endY - projectile.startY) * progress,
        PROJECTILE_RENDER.stepPx,
      );
      projectile.sprite.visible = true;
      projectile.sprite.tint = colors.spriteTint;
      projectile.sprite.alpha = 1;
      projectile.sprite.x = Math.round(x - 16);
      projectile.sprite.y = Math.round(y - 16);
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
        const loadedTexture = texture as Texture;
        this.monsterTextures.set(assetKey, loadedTexture);
        this.monsterFrames.set(assetKey, createSpriteFrames(loadedTexture, asset));
      })
      .catch(() => {
        this.monsterTextures.delete(assetKey);
        this.monsterFrames.delete(assetKey);
      })
      .finally(() => {
        this.loadingMonsterAssets.delete(assetKey);
      });
  }

  private removeMonster(id: string): void {
    this.removeMonsterVisuals(id);
    this.monsterRenderStates.delete(id);
  }

  private removeMonsterVisuals(id: string): void {
    destroyPixiItem(this.monsters.get(id));
    destroyPixiItem(this.monsterSprites.get(id));
    destroyPixiItem(this.hpBars.get(id));
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

function destroyPixiItem(item: Graphics | Sprite | undefined): void {
  if (!item) {
    return;
  }
  item.parent?.removeChild(item);
  item.destroy();
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

function createSpriteFrames(texture: Texture, asset: PixelSpriteAsset): Texture[] {
  const frameCount = asset.frameCount ?? 1;
  const frameWidth = asset.frameWidth ?? asset.width;
  const frameHeight = asset.frameHeight ?? asset.height;
  if (frameCount <= 1) {
    return [texture];
  }

  return Array.from({ length: frameCount }, (_, index) => createFrameTexture(texture, asset, index));
}

function createFrameTexture(texture: Texture, asset: PixelSpriteAsset, index: number): Texture {
  const frameWidth = asset.frameWidth ?? asset.width;
  const frameHeight = asset.frameHeight ?? asset.height;
  return new Texture({
    source: texture.source,
    frame: new Rectangle(index * frameWidth, 0, frameWidth, frameHeight),
  });
}

function spriteFrameHeight(asset: PixelSpriteAsset): number {
  return asset.frameHeight ?? asset.height;
}

function playerSpriteX(x: number, width: number, direction: -1 | 1, asset: PlayerSpriteAsset): number {
  const frameWidth = asset.frameWidth ?? asset.width;
  const visibleWidth = frameWidth - asset.padding.left - asset.padding.right;
  const localCenterX = asset.padding.left + visibleWidth / 2;
  const worldCenterX = x + width / 2;
  return direction > 0 ? worldCenterX - localCenterX : worldCenterX + localCenterX;
}

function dropIconFrameSize(kind: DropIconKind): number {
  const frame = DROP_ICON_FRAMES[kind];
  return DROP_ICON_SHEETS[frame.sheet].frameSize;
}

function dropIconDisplay(icon: DropIconEvent, simulation: SimulationState, frameSize: number): { x: number; y: number } {
  const landingY = dropIconLandingY(icon, simulation.world.platforms, frameSize);
  const launchSeconds = DROP_REWARD_BALANCE.iconLaunchSeconds;
  const launchProgress = clamp(icon.age / launchSeconds, 0, 1);
  const drift = dropIconDrift(icon.id) * DROP_REWARD_BALANCE.iconHorizontalDriftPx * launchProgress;

  if (icon.age >= launchSeconds) {
    return {
      x: icon.position.x + drift,
      y: landingY,
    };
  }

  return {
    x: icon.position.x + drift,
    y: icon.position.y
      + (landingY - icon.position.y) * launchProgress
      - Math.sin(Math.PI * launchProgress) * DROP_REWARD_BALANCE.iconHopHeightPx,
  };
}

function dropIconLandingY(icon: DropIconEvent, platforms: Platform[], frameSize: number): number {
  const x = icon.position.x;
  const landingPlatform = platforms
    .filter((platform) => x >= platform.x - frameSize && x <= platform.x + platform.width + frameSize && platform.y >= icon.position.y)
    .sort((a, b) => a.y - b.y)[0];
  return (landingPlatform?.y ?? GAMEBOY_SCREEN_HEIGHT) - frameSize;
}

function dropIconDrift(id: string): -1 | 1 {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % 2;
  }
  return hash === 0 ? -1 : 1;
}

function dropIconAlpha(icon: DropIconEvent): number {
  const pickupFadeSeconds = DROP_REWARD_BALANCE.iconPickupFadeSeconds;
  const pickupStart = Math.max(0, icon.ttl - pickupFadeSeconds);
  if (icon.age >= pickupStart) {
    return clamp(1 - (icon.age - pickupStart) / pickupFadeSeconds, 0, 1);
  }

  if (isRareDropIcon(icon.kind) && icon.age > DROP_REWARD_BALANCE.iconLaunchSeconds) {
    return Math.floor(icon.age * 8) % 2 === 0 ? 1 : 0.82;
  }

  return 1;
}

function isRareDropIcon(kind: DropIconKind): boolean {
  return kind === "ability" || kind === "weapon" || kind === "helmet" || kind === "armor" || kind === "accessory";
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
      exp: CHAPTER_PALETTES.dmg[3],
      expText: CHAPTER_PALETTES.dmg[4],
      floatingText: CHAPTER_PALETTES.dmg[4],
      spriteTint: 0xe0f8d0,
      mapTint: 0xe0f8d0,
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
    exp: PLACEHOLDER_COLORS.playerAccent,
    expText: PLACEHOLDER_COLORS.gold,
    floatingText: PLACEHOLDER_COLORS.gold,
    spriteTint: 0xffffff,
    mapTint: 0xffffff,
  };
}
