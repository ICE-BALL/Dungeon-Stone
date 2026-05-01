// 파일: ui_exploration_pixi.js
// 역할: Pixi.js 기반 탐험 렌더러 (레이어 분리, 뷰포트 컬링, 오브젝트 풀링)

const TILE_SIZE = 40;
const CULLING_PADDING = 2;

const TILE = {
    WALL: 0,
    FLOOR: 1,
    FOREST: 2,
    WATER: 3,
    LAVA: 4,
    ICE: 5,
    CAMP: 10
};

const EVENT_PRIORITY = {
    Start: 220,
    PORTAL: 210,
    RIFT_EXIT: 205,
    RIFT_STAGE: 200,
    RIFT: 190,
    MONUMENT: 185,
    TURRET: 180,
    RIFT_TURRET: 175,
    NPC: 170,
    CURIO: 165,
    ITEM: 160,
    EVENT: 150,
    RIFT_CACHE: 140
};

function keyOf(x, y) {
    return `${x},${y}`;
}

function parseKey(key) {
    const [sx, sy] = String(key || "").split(",");
    const x = Number(sx);
    const y = Number(sy);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function hasPixi() {
    return typeof window !== "undefined" && Boolean(window.PIXI);
}

function makeRectTexture(app, color, alpha = 1) {
    const PIXI = window.PIXI;
    const g = new PIXI.Graphics();
    g.beginFill(color, alpha);
    g.drawRect(0, 0, TILE_SIZE - 1, TILE_SIZE - 1);
    g.endFill();
    const tx = app.renderer.generateTexture(g);
    g.destroy(true);
    return tx;
}

function makeCircleTexture(app, color, radius = 9, alpha = 1) {
    const PIXI = window.PIXI;
    const size = Math.max(20, radius * 3);
    const g = new PIXI.Graphics();
    g.beginFill(color, alpha);
    g.drawCircle(size / 2, size / 2, radius);
    g.endFill();
    const tx = app.renderer.generateTexture(g);
    g.destroy(true);
    return tx;
}

function pickTileTexture(textures, tileType, visible, visited) {
    if (!visible && !visited) return textures.hidden;
    if (!visible && visited) return textures.visited;
    switch (tileType) {
        case TILE.WALL: return textures.wall;
        case TILE.FOREST: return textures.forest;
        case TILE.WATER: return textures.water;
        case TILE.LAVA: return textures.lava;
        case TILE.ICE: return textures.ice;
        case TILE.CAMP: return textures.camp;
        default: return textures.floor;
    }
}

export class ExplorationPixiRenderer {
    constructor(mapContainer) {
        this.container = mapContainer;
        this.app = null;
        this.world = null;
        this.backgroundLayer = null;
        this.objectLayer = null;
        this.overlayLayer = null;
        this.entityLayer = null;
        this.vfxLayer = null;
        this.uiLayer = null;
        this.textures = null;
        this.active = false;
        this.mapManager = null;
        this.playerSprite = null;
        this.time = 0;
        this.torchSprites = [];
        this.effects = [];
        this.pools = {
            tile: [],
            marker: [],
            entity: [],
            overlay: [],
            vfx: []
        };
        this.boundPointerDown = (event) => this.handlePointerDown(event);
    }

    init() {
        if (!hasPixi() || !this.container) return false;
        if (this.app) return true;
        const PIXI = window.PIXI;

        this.app = new PIXI.Application({
            width: this.container.clientWidth || 960,
            height: this.container.clientHeight || 560,
            backgroundAlpha: 0,
            antialias: false,
            autoDensity: true,
            resolution: Math.max(1, (window.devicePixelRatio || 1))
        });

        this.container.appendChild(this.app.view);
        this.container.classList.add('use-pixi-engine');

        this.world = new PIXI.Container();
        this.backgroundLayer = new PIXI.Container();
        this.objectLayer = new PIXI.Container();
        this.overlayLayer = new PIXI.Container();
        this.entityLayer = new PIXI.Container();
        this.vfxLayer = new PIXI.Container();
        this.uiLayer = new PIXI.Container();

        this.entityLayer.sortableChildren = true;

        this.world.addChild(this.backgroundLayer);
        this.world.addChild(this.objectLayer);
        this.world.addChild(this.overlayLayer);
        this.world.addChild(this.entityLayer);
        this.world.addChild(this.vfxLayer);
        this.app.stage.addChild(this.world);
        this.app.stage.addChild(this.uiLayer);

        this.textures = {
            floor: makeRectTexture(this.app, 0x2b323d),
            wall: makeRectTexture(this.app, 0x4a5366),
            forest: makeRectTexture(this.app, 0x2a5b34),
            water: makeRectTexture(this.app, 0x235b82),
            lava: makeRectTexture(this.app, 0x7f3a1b),
            ice: makeRectTexture(this.app, 0x3c6f8f),
            camp: makeRectTexture(this.app, 0x6a4f2a),
            hidden: makeRectTexture(this.app, 0x05070a),
            visited: makeRectTexture(this.app, 0x181e27),
            player: makeCircleTexture(this.app, 0x6ad68f, 10, 0.95),
            monster: makeCircleTexture(this.app, 0xe26a6a, 8, 0.95),
            rival: makeCircleTexture(this.app, 0xffb36b, 8, 0.95),
            event: makeCircleTexture(this.app, 0xf2d479, 7, 0.9),
            portal: makeCircleTexture(this.app, 0x8cc3ff, 8, 0.9),
            npc: makeCircleTexture(this.app, 0x7fd9ff, 7, 0.9),
            campfire: makeCircleTexture(this.app, 0xffba5f, 7, 0.9),
            torch: makeCircleTexture(this.app, 0xffdf95, 5, 0.95),
            corpse: makeCircleTexture(this.app, 0x9f8f83, 6, 0.85),
            guide: makeCircleTexture(this.app, 0x7fd6a8, 4, 0.8),
            tacticalMove: makeRectTexture(this.app, 0x4fd483, 0.16),
            tacticalAttack: makeRectTexture(this.app, 0xe56d6d, 0.18),
            tacticalCover: makeRectTexture(this.app, 0x5ea5d7, 0.16),
            vfxHit: makeCircleTexture(this.app, 0xffc56e, 10, 0.95)
        };

        this.app.view.addEventListener('pointerdown', this.boundPointerDown);
        window.addEventListener('resize', () => this.resize());
        this.app.ticker.add((delta) => this.tick(delta));
        this.resize();
        this.active = true;
        return true;
    }

    resize() {
        if (!this.app || !this.container) return;
        const w = Math.max(320, this.container.clientWidth || 960);
        const h = Math.max(260, this.container.clientHeight || 560);
        this.app.renderer.resize(w, h);
    }

    attach(mapManager) {
        this.mapManager = mapManager;
    }

    destroy() {
        if (!this.app) return;
        try {
            this.app.view.removeEventListener('pointerdown', this.boundPointerDown);
            this.app.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (_) {}
        this.app = null;
        this.active = false;
        this.playerSprite = null;
        this.effects = [];
        this.torchSprites = [];
        if (this.container) {
            this.container.classList.remove('use-pixi-engine');
        }
    }

    recycleLayer(layer, poolKey) {
        const pool = this.pools[poolKey];
        if (!layer || !Array.isArray(pool)) return;
        while (layer.children.length > 0) {
            const child = layer.removeChildAt(layer.children.length - 1);
            child.visible = false;
            pool.push(child);
        }
    }

    claimSprite(poolKey, texture, anchorCentered = false) {
        const PIXI = window.PIXI;
        const pool = this.pools[poolKey] || [];
        const sprite = pool.length > 0 ? pool.pop() : new PIXI.Sprite(texture);
        sprite.texture = texture;
        sprite.visible = true;
        sprite.alpha = 1;
        sprite.rotation = 0;
        sprite.scale.set(1, 1);
        sprite.tint = 0xffffff;
        if (anchorCentered) sprite.anchor.set(0.5, 0.5);
        else sprite.anchor.set(0, 0);
        return sprite;
    }

    buildEventMap(map) {
        const eventMap = new Map();
        (map?.fixedEvents || []).forEach((event) => {
            if (!event || !Number.isFinite(event.resolvedX) || !Number.isFinite(event.resolvedY)) return;
            if (event.type === "HIDDEN_RELIC" && event.hidden && !event.discovered) return;
            const key = keyOf(event.resolvedX, event.resolvedY);
            const existing = eventMap.get(key);
            const score = EVENT_PRIORITY[event.type] || 100;
            const prevScore = existing ? (EVENT_PRIORITY[existing.type] || 100) : -1;
            if (!existing || score >= prevScore) eventMap.set(key, event);
        });
        return eventMap;
    }

    buildCorpseMap(mapManager) {
        const corpses = Array.isArray(mapManager?.corpses) ? mapManager.corpses : [];
        const out = new Map();
        corpses.forEach((corpse) => {
            if (!corpse || !Number.isFinite(corpse.x) || !Number.isFinite(corpse.y)) return;
            const key = keyOf(corpse.x, corpse.y);
            if (!out.has(key)) out.set(key, corpse);
        });
        return out;
    }

    getViewBounds(map, worldX, worldY) {
        const screenW = this.app?.renderer?.width || 960;
        const screenH = this.app?.renderer?.height || 560;
        const minX = clamp(Math.floor((-worldX) / TILE_SIZE) - CULLING_PADDING, 0, map.width - 1);
        const maxX = clamp(Math.floor((screenW - worldX) / TILE_SIZE) + CULLING_PADDING, 0, map.width - 1);
        const minY = clamp(Math.floor((-worldY) / TILE_SIZE) - CULLING_PADDING, 0, map.height - 1);
        const maxY = clamp(Math.floor((screenH - worldY) / TILE_SIZE) + CULLING_PADDING, 0, map.height - 1);
        return { minX, maxX, minY, maxY };
    }

    pickEventTexture(event) {
        if (!event) return this.textures.event;
        if (event.type === "PORTAL" || event.type === "RIFT_EXIT") return this.textures.portal;
        if (event.type === "NPC") return this.textures.npc;
        if (event.type === "MONUMENT") return this.textures.portal;
        return this.textures.event;
    }

    renderTacticalOverlay(mapManager, bounds) {
        const tactical = mapManager?.tacticalState;
        if (!tactical?.active) return;
        const renderSet = (setRef, texture) => {
            (setRef || []).forEach((tile) => {
                const point = typeof tile === "string" ? parseKey(tile) : tile;
                if (!point) return;
                if (point.x < bounds.minX || point.x > bounds.maxX || point.y < bounds.minY || point.y > bounds.maxY) return;
                const s = this.claimSprite("overlay", texture, false);
                s.x = point.x * TILE_SIZE;
                s.y = point.y * TILE_SIZE;
                this.overlayLayer.addChild(s);
            });
        };
        renderSet(tactical.moveTiles, this.textures.tacticalMove);
        renderSet(tactical.attackTiles, this.textures.tacticalAttack);
        renderSet(tactical.coverTiles, this.textures.tacticalCover);
    }

    render(mapManager) {
        if (!this.active || !this.app || !mapManager?.currentMap) return;
        this.mapManager = mapManager;
        const map = mapManager.currentMap;
        const px = Number(mapManager.player?.x || 0);
        const py = Number(mapManager.player?.y || 0);
        const playerWorldX = (px + 0.5) * TILE_SIZE;
        const playerWorldY = (py + 0.5) * TILE_SIZE;
        const screenW = this.app.renderer.width;
        const screenH = this.app.renderer.height;

        this.world.x = (screenW * 0.5) - playerWorldX;
        this.world.y = (screenH * 0.5) - playerWorldY;

        const bounds = this.getViewBounds(map, this.world.x, this.world.y);
        const eventMap = this.buildEventMap(map);
        const corpseMap = this.buildCorpseMap(mapManager);
        const monsters = Array.isArray(mapManager.activeMonsters) ? mapManager.activeMonsters : [];
        const rivals = Array.isArray(mapManager.rivalParties) ? mapManager.rivalParties : [];
        const monsterMap = new Map();
        monsters.forEach((m) => {
            if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
            monsterMap.set(keyOf(m.x, m.y), m);
        });

        const layerKey = `layer_${mapManager.player?.currentLayer}`;
        const campfire = mapManager.player?.campfires?.[layerKey] || null;
        const torches = Array.isArray(mapManager.player?.torches?.[layerKey]) ? mapManager.player.torches[layerKey] : [];
        const torchSet = new Set(torches.map((t) => keyOf(t.x, t.y)));
        const guidePath = typeof mapManager.getGuidePathTiles === "function" ? mapManager.getGuidePathTiles() : [];
        const guideSet = new Set((guidePath || []).map((p) => keyOf(p.x, p.y)));

        this.recycleLayer(this.backgroundLayer, "tile");
        this.recycleLayer(this.objectLayer, "marker");
        this.recycleLayer(this.entityLayer, "entity");
        this.recycleLayer(this.overlayLayer, "overlay");
        this.torchSprites = [];

        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const visible = Boolean(mapManager.visibleTiles?.[y]?.[x]);
                const visited = Boolean(mapManager.visitedTiles?.[y]?.[x]);
                const tileType = map.grid?.[y]?.[x];
                const tileTexture = pickTileTexture(this.textures, tileType, visible, visited);
                const tile = this.claimSprite("tile", tileTexture, false);
                tile.x = x * TILE_SIZE;
                tile.y = y * TILE_SIZE;
                this.backgroundLayer.addChild(tile);

                if (!visible) continue;
                const key = keyOf(x, y);
                const event = eventMap.get(key);
                const corpse = corpseMap.get(key);
                const isCamp = campfire && campfire.x === x && campfire.y === y;
                const hasTorch = torchSet.has(key);
                const isGuide = guideSet.has(key);

                if (event) {
                    const marker = this.claimSprite("marker", this.pickEventTexture(event), true);
                    marker.x = (x * TILE_SIZE) + (TILE_SIZE * 0.5);
                    marker.y = (y * TILE_SIZE) + (TILE_SIZE * 0.5);
                    this.objectLayer.addChild(marker);
                } else if (corpse) {
                    const marker = this.claimSprite("marker", this.textures.corpse, true);
                    marker.x = (x * TILE_SIZE) + (TILE_SIZE * 0.5);
                    marker.y = (y * TILE_SIZE) + (TILE_SIZE * 0.5);
                    marker.alpha = clamp((corpse.ttl || 0) / (corpse.maxTtl || 1), 0.2, 0.9);
                    this.objectLayer.addChild(marker);
                }

                if (isCamp) {
                    const camp = this.claimSprite("marker", this.textures.campfire, true);
                    camp.x = (x * TILE_SIZE) + (TILE_SIZE * 0.5);
                    camp.y = (y * TILE_SIZE) + (TILE_SIZE * 0.5);
                    this.objectLayer.addChild(camp);
                }
                if (hasTorch) {
                    const torch = this.claimSprite("marker", this.textures.torch, true);
                    torch.x = (x * TILE_SIZE) + (TILE_SIZE * 0.75);
                    torch.y = (y * TILE_SIZE) + (TILE_SIZE * 0.3);
                    this.objectLayer.addChild(torch);
                    this.torchSprites.push(torch);
                }
                if (isGuide) {
                    const guide = this.claimSprite("marker", this.textures.guide, true);
                    guide.x = (x * TILE_SIZE) + (TILE_SIZE * 0.5);
                    guide.y = (y * TILE_SIZE) + (TILE_SIZE * 0.5);
                    this.objectLayer.addChild(guide);
                }
            }
        }

        monsters.forEach((monster) => {
            if (!monster || !Number.isFinite(monster.x) || !Number.isFinite(monster.y)) return;
            if (monster.x < bounds.minX || monster.x > bounds.maxX || monster.y < bounds.minY || monster.y > bounds.maxY) return;
            const sprite = this.claimSprite("entity", this.textures.monster, true);
            sprite.x = (monster.x * TILE_SIZE) + (TILE_SIZE * 0.5);
            sprite.y = (monster.y * TILE_SIZE) + (TILE_SIZE * 0.56);
            sprite.zIndex = sprite.y;
            if (monster.aggro) {
                sprite.tint = 0xff7a7a;
                sprite.scale.set(1.05, 1.05);
            }
            this.entityLayer.addChild(sprite);
        });

        rivals.forEach((rival) => {
            if (!rival || rival.alive === false || !Number.isFinite(rival.x) || !Number.isFinite(rival.y)) return;
            if (rival.x < bounds.minX || rival.x > bounds.maxX || rival.y < bounds.minY || rival.y > bounds.maxY) return;
            if (!mapManager.visibleTiles?.[rival.y]?.[rival.x]) return;
            const sprite = this.claimSprite("entity", this.textures.rival, true);
            sprite.x = (rival.x * TILE_SIZE) + (TILE_SIZE * 0.5);
            sprite.y = (rival.y * TILE_SIZE) + (TILE_SIZE * 0.56);
            sprite.zIndex = sprite.y + 0.05;
            if (rival.role === "cooperative") sprite.tint = 0x8fd6ff;
            else if (rival.role === "predatory") sprite.tint = 0xff7878;
            this.entityLayer.addChild(sprite);
        });

        this.playerSprite = this.claimSprite("entity", this.textures.player, true);
        this.playerSprite.x = playerWorldX;
        this.playerSprite.y = playerWorldY + 2;
        this.playerSprite.zIndex = this.playerSprite.y + 0.2;
        this.entityLayer.addChild(this.playerSprite);
        this.entityLayer.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        this.renderTacticalOverlay(mapManager, bounds);
    }

    spawnVfxHit(x, y) {
        if (!this.active || !this.vfxLayer) return;
        const sprite = this.claimSprite("vfx", this.textures.vfxHit, true);
        sprite.x = (x * TILE_SIZE) + (TILE_SIZE * 0.5);
        sprite.y = (y * TILE_SIZE) + (TILE_SIZE * 0.5);
        sprite.alpha = 0.95;
        this.vfxLayer.addChild(sprite);
        this.effects.push({
            sprite,
            life: 0,
            maxLife: 18
        });
    }

    updateVfx() {
        if (!Array.isArray(this.effects) || this.effects.length === 0) return;
        const alive = [];
        this.effects.forEach((fx) => {
            fx.life += 1;
            const t = clamp(fx.life / Math.max(1, fx.maxLife), 0, 1);
            fx.sprite.alpha = 1 - t;
            const scale = 1 + (t * 0.9);
            fx.sprite.scale.set(scale, scale);
            if (fx.life >= fx.maxLife) {
                this.vfxLayer.removeChild(fx.sprite);
                fx.sprite.visible = false;
                this.pools.vfx.push(fx.sprite);
            } else {
                alive.push(fx);
            }
        });
        this.effects = alive;
    }

    tick(delta) {
        if (!this.active) return;
        this.time += (Number(delta) || 1) * 0.045;
        if (this.playerSprite) {
            const pulse = 1 + (Math.sin(this.time * 1.7) * 0.045);
            this.playerSprite.scale.set(pulse, pulse);
        }
        this.torchSprites.forEach((sprite, idx) => {
            const wave = Math.sin((this.time * 5.4) + (idx * 0.9));
            sprite.alpha = 0.62 + (wave * 0.24);
        });
        this.updateVfx();
    }

    handlePointerDown(event) {
        if (!this.mapManager || !this.app || !this.world) return;
        const rect = this.app.view.getBoundingClientRect();
        const sx = event.clientX - rect.left;
        const sy = event.clientY - rect.top;
        const wx = (sx - this.world.x) / TILE_SIZE;
        const wy = (sy - this.world.y) / TILE_SIZE;
        const tx = Math.floor(wx);
        const ty = Math.floor(wy);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
        if (tx < 0 || ty < 0 || tx >= this.mapManager.currentMap.width || ty >= this.mapManager.currentMap.height) return;

        if (this.mapManager.isPlacingCampfire) {
            this.mapManager.placeCampfireAt?.(tx, ty);
        } else if (this.mapManager.isPlacingTorch) {
            this.mapManager.placeTorchAt?.(tx, ty);
        } else if (this.mapManager.tacticalState?.active) {
            this.mapManager.performTacticalAttackAt?.(tx, ty);
        }
    }
}

export function createExplorationPixiRenderer(mapContainer) {
    if (!hasPixi()) return null;
    const renderer = new ExplorationPixiRenderer(mapContainer);
    return renderer.init() ? renderer : null;
}
