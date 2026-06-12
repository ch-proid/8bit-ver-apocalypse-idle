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
import { WORLD } from "../data/balance";
import { CHAPTER_PALETTES, PLACEHOLDER_COLORS } from "../data/palettes";
import type { FloatingText, Monster, SimulationState } from "../core/types";

const VIEW_WIDTH = 160;
const VIEW_HEIGHT = 144;

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
  private labels = new Map<string, Text>();
  private floating = new Map<string, Text>();

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      background: CHAPTER_PALETTES.bloodBanquet[0],
      antialias: false,
      resolution: 1,
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
    this.monsterTextures.clear();
    this.loadingMonsterAssets.clear();
    this.hpBars.clear();
    this.labels.clear();
    this.floating.clear();
  }

  render(simulation: SimulationState): void {
    if (!this.app) {
      return;
    }

    const cameraX = clamp(Math.round(simulation.world.player.position.x - VIEW_WIDTH / 2), 0, WORLD.width - VIEW_WIDTH);
    this.world.x = -cameraX;
    this.drawBackground(cameraX);
    this.drawPlatforms(simulation);
    this.drawPlayer(simulation);
    this.drawMonsters(simulation);
    this.drawFloatingTexts(simulation.world.floatingTexts);
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

  private drawBackground(cameraX: number): void {
    this.bg.clear();
    this.bg.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill(CHAPTER_PALETTES.bloodBanquet[0]);
    this.bg.rect(0, 0, VIEW_WIDTH, 44).fill(CHAPTER_PALETTES.bloodBanquet[1]);

    for (let x = -((cameraX / 3) % 36); x < VIEW_WIDTH + 36; x += 36) {
      this.bg.rect(x, 38, 14, 54).fill(CHAPTER_PALETTES.bloodBanquet[1]);
      this.bg.rect(x + 5, 28, 4, 10).fill(CHAPTER_PALETTES.bloodBanquet[2]);
    }

    for (let i = 0; i < 32; i += 1) {
      const px = (i * 37 - cameraX * 0.4) % VIEW_WIDTH;
      const py = 22 + ((i * 19) % 118);
      this.bg.rect(px, py, 1, 1).fill(i % 5 === 0 ? CHAPTER_PALETTES.bloodBanquet[4] : CHAPTER_PALETTES.bloodBanquet[2]);
    }
  }

  private drawPlatforms(simulation: SimulationState): void {
    this.platforms.clear();
    for (const platform of simulation.world.platforms) {
      this.platforms.rect(platform.x, platform.y, platform.width, platform.height).fill(PLACEHOLDER_COLORS.platform);
      this.platforms.rect(platform.x, platform.y, platform.width, 2).fill(PLACEHOLDER_COLORS.platformTop);
    }
  }

  private drawPlayer(simulation: SimulationState): void {
    const { player } = simulation.world;
    this.playerFallback.clear();

    if (this.playerSprite) {
      this.playerFallback.visible = false;
      this.playerSprite.visible = true;
      this.playerSprite.scale.x = player.direction > 0 ? 1 : -1;
      this.playerSprite.scale.y = 1;
      this.playerSprite.x = Math.round(
        player.direction > 0
          ? player.position.x - PLAYER_CHARACTER.padding.left
          : player.position.x + player.width + PLAYER_CHARACTER.padding.right,
      );
      this.playerSprite.y = Math.round(player.position.y - PLAYER_CHARACTER.padding.top);
      return;
    }

    this.playerFallback.visible = true;
    this.playerFallback.rect(player.position.x, player.position.y, player.width, player.height).fill(PLACEHOLDER_COLORS.player);
    this.playerFallback.rect(player.position.x + 2, player.position.y, player.width - 3, 4).fill(PLACEHOLDER_COLORS.playerAccent);
  }

  private drawMonsters(simulation: SimulationState): void {
    const aliveIds = new Set(simulation.world.monsters.map((monster) => monster.instanceId));

    for (const id of this.monsters.keys()) {
      if (!aliveIds.has(id)) {
        this.removeMonster(id);
      }
    }

    for (const monster of simulation.world.monsters) {
      this.drawMonster(monster);
    }
  }

  private drawMonster(monster: Monster): void {
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
    const label = getOrCreate(this.labels, monster.instanceId, () => {
      const item = new Text({
        text: monster.name,
        style: new TextStyle({
          fontFamily: "monospace",
          fontSize: 5,
          fill: "#d8e3c8",
          align: "center",
        }),
      });
      item.anchor.set(0.5, 0);
      this.world.addChild(item);
      return item;
    });

    const alpha = monster.alive ? 1 : Math.max(0.2, monster.fadeTimer / 0.22);
    graphic.clear();
    graphic.alpha = alpha;
    if (sprite && asset) {
      graphic.visible = false;
      sprite.visible = true;
      sprite.alpha = alpha;
      sprite.scale.x = monster.direction > 0 ? 1 : -1;
      sprite.scale.y = 1;
      sprite.x = Math.round(
        monster.direction > 0
          ? monster.position.x - asset.padding.left
          : monster.position.x + monster.width + asset.padding.right,
      );
      sprite.y = Math.round(monster.position.y - asset.padding.top);
    } else {
      this.monsterSprites.get(monster.instanceId)?.destroy();
      this.monsterSprites.delete(monster.instanceId);
      graphic.visible = true;
      graphic.rect(monster.position.x, monster.position.y + 2, monster.width, monster.height - 2).fill(monster.color as ColorSource);
      graphic.circle(monster.position.x + monster.width / 2, monster.position.y + 3, monster.width / 2).fill(monster.color as ColorSource);
      graphic.rect(monster.position.x + monster.width * 0.65, monster.position.y + 3, 1, 1).fill("#0a0e13");
    }

    hpBar.clear();
    hpBar.alpha = monster.alive ? 1 : 0;
    hpBar.rect(monster.position.x - 2, monster.position.y - 5, 18, 3).fill(PLACEHOLDER_COLORS.hpBack);
    hpBar.rect(monster.position.x - 2, monster.position.y - 5, 18 * (monster.hp / monster.maxHp), 3).fill(PLACEHOLDER_COLORS.hp);

    label.text = monster.alive ? monster.name : "";
    label.position.set(monster.position.x + monster.width / 2, monster.position.y + monster.height + 2);
    this.world.addChild(hpBar);
    this.world.addChild(label);
  }

  private drawFloatingTexts(texts: FloatingText[]): void {
    const ids = new Set(texts.map((text) => text.id));
    for (const id of this.floating.keys()) {
      if (!ids.has(id)) {
        const item = this.floating.get(id);
        item?.destroy();
        this.floating.delete(id);
      }
    }

    for (const text of texts) {
      const item = getOrCreate(this.floating, text.id, () => {
        const created = new Text({
          text: text.value,
          style: new TextStyle({
            fontFamily: "monospace",
            fontSize: 7,
            fill: text.color,
            fontWeight: "700",
          }),
        });
        created.anchor.set(0.5, 0.5);
        this.world.addChild(created);
        return created;
      });

      item.text = text.value;
      item.style.fill = text.color;
      item.alpha = Math.max(0, 1 - text.age / text.ttl);
      item.position.set(text.position.x, text.position.y);
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
    this.labels.get(id)?.destroy();
    this.monsters.delete(id);
    this.monsterSprites.delete(id);
    this.hpBars.delete(id);
    this.labels.delete(id);
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
