// 파일: ui_exploration.js
// 역할: 2D 맵 렌더링 및 입력 제어, 카메라 이동 (플레이어 고정, 맵 이동 방식)

import { hideModal, showModal } from './ui_core.js';
import { createExplorationPixiRenderer } from './ui_exploration_pixi.js';

const TILE_TYPES = {
    WALL: 0,
    FLOOR: 1,
    FOREST: 2,
    WATER: 3,
    LAVA: 4,
    ICE: 5,
    PORTAL: 9,
    CAMP: 10
};

const MAP_MARKERS = {
    MONSTER: "M",
    RIVAL: "V",
    START: "S",
    PORTAL: "P",
    RIFT: "R",
    RIFT_STAGE: "R",
    RIFT_STAGE_CLEARED: "C",
    RIFT_EXIT: "X",
    RIFT_CACHE: "B",
    RIFT_FORTUNE: "F",
    TURRET: "T",
    RIFT_TURRET: "U",
    NPC: "N",
    NPC_HOSTILE: "H",
    MONUMENT: "O",
    ORE: "G",
    EVENT: "E",
    ITEM: "I",
    CAMPFIRE: "C",
    TORCH: "L"
};

let mapManagerInstance = null;
let pixiRenderer = null;

const TILE_SIZE = 40;
const TILE_GAP = 1;
const TILE_TOTAL_SIZE = TILE_SIZE + TILE_GAP;
const MOVE_INPUT_COOLDOWN_MS = 165;
const HOLD_MOVE_INTERVAL_MS = 72;
const EMPTY_SET = new Set();
const EMPTY_MAP = new Map();

let lastMoveInputAt = 0;
let heldDirection = null;
let holdMoveTimer = null;

function ensurePixiRenderer(mapManager) {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || typeof window === 'undefined' || !window.PIXI) return false;
    if (!pixiRenderer) {
        pixiRenderer = createExplorationPixiRenderer(mapContainer);
    }
    if (!pixiRenderer) return false;
    pixiRenderer.attach(mapManager);
    return true;
}

function applyTileMarker(tileEl, marker, title = "") {
    if (!tileEl) return;
    tileEl.textContent = String(marker || "").toUpperCase();
    if (title) tileEl.title = title;
}

function isAbilityModalOpen() {
    const modal = document.getElementById('exploration-ability-screen');
    return Boolean(modal && !modal.classList.contains('hidden'));
}

function isRivalLootModalOpen() {
    const modal = document.getElementById('rival-loot-screen');
    return Boolean(modal && !modal.classList.contains('hidden'));
}

function closeExplorationAbilityModal() {
    const modal = document.getElementById('exploration-ability-screen');
    if (!modal) return;
    hideModal('#exploration-ability-screen');
}

function closeRivalLootModal() {
    const modal = document.getElementById('rival-loot-screen');
    if (!modal) return;
    hideModal('#rival-loot-screen');
}

function openRivalLootModal(mgr) {
    if (!mgr) return;
    const modal = document.getElementById('rival-loot-screen');
    const title = document.getElementById('rival-loot-title');
    const desc = document.getElementById('rival-loot-desc');
    const list = document.getElementById('rival-loot-list');
    const takeBtn = document.getElementById('rival-loot-take');
    const closeBtn = document.getElementById('rival-loot-close');
    if (!modal || !title || !desc || !list) return;

    const loot = mgr.player?.pendingRivalLoot;
    if (!loot || loot.collected) {
        desc.textContent = "회수할 전리품이 없습니다.";
        list.innerHTML = `<p class="modal-empty-text">현재 전리품 없음</p>`;
        if (takeBtn) takeBtn.disabled = true;
        showModal('#rival-loot-screen');
        if (closeBtn) closeBtn.onclick = () => closeRivalLootModal();
        return;
    }

    const sourceNames = Array.isArray(loot.sourceNames) ? loot.sourceNames.filter(Boolean) : [];
    const goldGain = Math.max(0, Number(loot.gold || 0));
    const stoneGain = Math.max(0, Number(loot.magicStones || 0));
    const items = Array.isArray(loot.items) ? loot.items.filter(Boolean) : [];
    const equipment = Array.isArray(loot.equipment) ? loot.equipment.filter(Boolean) : [];

    title.innerHTML = `<i class="icon-inventory"></i> 루팅`;
    desc.textContent = `${sourceNames.length > 0 ? sourceNames.join(", ") : "탐험가"}의 전리품입니다. [L] 또는 버튼으로 회수할 수 있습니다.`;
    list.innerHTML = `
        <div class="status-inline-grid">
            <div class="status-inline-card"><b>스톤</b><span>${goldGain.toLocaleString()}</span></div>
            <div class="status-inline-card"><b>마석</b><span>${stoneGain}</span></div>
            <div class="status-inline-card"><b>일반 아이템</b><span>${items.length}개</span></div>
            <div class="status-inline-card"><b>장비</b><span>${equipment.length}개</span></div>
        </div>
        <div class="modal-card-grid">
            ${items.length > 0 ? `<div class="modal-info-card"><h4>아이템</h4><p>${items.join(", ")}</p></div>` : ""}
            ${equipment.length > 0 ? `<div class="modal-info-card"><h4>장비</h4><p>${equipment.join(", ")}</p></div>` : ""}
        </div>
    `;

    if (takeBtn) {
        takeBtn.disabled = false;
        takeBtn.onclick = () => {
            mgr.claimPendingRivalLoot?.();
            closeRivalLootModal();
        };
    }
    if (closeBtn) closeBtn.onclick = () => closeRivalLootModal();
    showModal('#rival-loot-screen');
}

function openExplorationAbilityModal(mgr) {
    if (!mgr) return;
    const modal = document.getElementById('exploration-ability-screen');
    const list = document.getElementById('exploration-ability-list');
    const desc = document.getElementById('exploration-ability-desc');
    const closeBtn = document.getElementById('exploration-ability-close');

    if (!modal || !list || !desc) {
        mgr.useExplorationEssenceAbility?.();
        return;
    }

    const abilities = typeof mgr.getExplorationAbilityList === 'function'
        ? mgr.getExplorationAbilityList()
        : [];

    if (!Array.isArray(abilities) || abilities.length === 0) {
        list.innerHTML = `<p class="modal-empty-text">사용 가능한 탐험 이능이 없습니다.</p>`;
    } else {
        list.innerHTML = '';
        abilities.forEach((ability) => {
            const card = document.createElement('div');
            card.className = 'modal-info-card exploration-ability-card';
            const finalCost = Number(ability.finalCost || ability.cost || 0);
            const currentMp = Number(mgr.player?.mp || 0);
            const baseCooldown = Number(ability.finalCooldown || ability.cooldown || 0);
            const remainingCooldown = Number(ability.remainingCooldown || 0);
            const canUse = currentMp >= finalCost && remainingCooldown <= 0;
            const cooldownText = remainingCooldown > 0
                ? `재사용 ${remainingCooldown}턴`
                : `재사용 ${baseCooldown}턴`;
            card.innerHTML = `
                <h4>${ability.label}</h4>
                <p class="card-meta">키: ${String(ability.key || '').toUpperCase()} | MP ${finalCost} | ${cooldownText}</p>
                <p>${ability.desc || "탐험 지원 이능"}</p>
            `;

            const useBtn = document.createElement('button');
            useBtn.type = 'button';
            useBtn.className = 'modal-close-btn';
            if (remainingCooldown > 0) useBtn.textContent = `쿨다운 ${remainingCooldown}`;
            else useBtn.textContent = currentMp >= finalCost ? '사용' : 'MP 부족';
            useBtn.disabled = !canUse;
            useBtn.onclick = () => {
                const used = mgr.useExplorationEssenceAbility?.(ability.key);
                if (used) {
                    closeExplorationAbilityModal();
                }
            };

            card.appendChild(useBtn);
            list.appendChild(card);
        });
    }

    desc.textContent = `보유 MP ${mgr.player?.mp || 0} | 이능 키 E | 마법사 파티원은 재사용 대기시간을 단축합니다.`;
    showModal('#exploration-ability-screen');

    if (closeBtn) {
        closeBtn.onclick = () => closeExplorationAbilityModal();
    }
}

function startHoldMoveLoop() {
    if (holdMoveTimer) return;
    holdMoveTimer = window.setInterval(() => {
        if (!mapManagerInstance || !heldDirection) return;
        tryMoveWithCooldown(mapManagerInstance, heldDirection.dx, heldDirection.dy);
    }, HOLD_MOVE_INTERVAL_MS);
}

function stopHoldMoveLoop() {
    heldDirection = null;
    if (!holdMoveTimer) return;
    clearInterval(holdMoveTimer);
    holdMoveTimer = null;
}

function setHeldDirection(dx, dy) {
    heldDirection = { dx, dy };
    startHoldMoveLoop();
}

function clearHeldDirectionByKey(key) {
    if (!heldDirection) return;
    const map = {
        ArrowUp: { dx: 0, dy: -1 }, w: { dx: 0, dy: -1 }, W: { dx: 0, dy: -1 },
        ArrowDown: { dx: 0, dy: 1 }, s: { dx: 0, dy: 1 }, S: { dx: 0, dy: 1 },
        ArrowLeft: { dx: -1, dy: 0 }, a: { dx: -1, dy: 0 }, A: { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 }, d: { dx: 1, dy: 0 }, D: { dx: 1, dy: 0 }
    };
    const direction = map[key];
    if (!direction) return;
    if (direction.dx === heldDirection.dx && direction.dy === heldDirection.dy) {
        stopHoldMoveLoop();
    }
}

export function initExplorationUI(mapManager) {
    mapManagerInstance = mapManager;
    lastMoveInputAt = 0;
    stopHoldMoveLoop();
    closeExplorationAbilityModal();
    closeRivalLootModal();

    const gridEl = document.getElementById('map-grid');
    const mapContainer = document.getElementById('map-container');
    const playerFixed = document.getElementById('player-fixed');
    const map = mapManager.currentMap;
    if (!gridEl || !map || !mapContainer) return;

    const floorId = mapManager.player.currentLayer || map.id || 1;
    applyFloorAtmosphere(floorId, mapContainer);

    const usePixi = ensurePixiRenderer(mapManager);
    if (usePixi) {
        mapContainer.classList.add('use-pixi-engine');
        gridEl.style.display = 'none';
        if (playerFixed) playerFixed.style.display = 'none';
        mapManager._tileCache = null;
        mapManager._tileCacheKey = null;
        mapManager._renderSnapshot = null;
    } else {
        mapContainer.classList.remove('use-pixi-engine');
        gridEl.style.display = '';
        if (playerFixed) playerFixed.style.display = '';
    }

    if (!usePixi) {
        gridEl.style.gridTemplateColumns = `repeat(${map.width}, var(--tile-size))`;
        gridEl.innerHTML = '';
        const tileCache = Array.from({ length: map.height }, () => Array(map.width).fill(null));

        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const tile = document.createElement('div');
                tile.id = `tile-${x}-${y}`;
                tile.classList.add('tile');

                const type = map.grid[y][x];
                if (type === TILE_TYPES.WALL) tile.classList.add('wall');
                else if (type === TILE_TYPES.FLOOR) tile.classList.add('floor');
                else if (type === TILE_TYPES.FOREST) tile.classList.add('floor', 'terrain-forest');
                else if (type === TILE_TYPES.WATER) tile.classList.add('floor', 'terrain-water');
                else if (type === TILE_TYPES.LAVA) tile.classList.add('floor', 'terrain-lava');
                else if (type === TILE_TYPES.ICE) tile.classList.add('floor', 'terrain-ice');
                else if (type === TILE_TYPES.CAMP) {
                    tile.classList.add('floor', 'campfire');
                    applyTileMarker(tile, MAP_MARKERS.CAMPFIRE, '모닥불 - 쉬기 가능');
                }

                tile.onclick = () => {
                    if (mapManager.isPlacingCampfire) {
                        mapManager.placeCampfireAt(x, y);
                    } else if (mapManager.isPlacingTorch) {
                        mapManager.placeTorchAt(x, y);
                    } else if (mapManager.tacticalState?.active) {
                        mapManager.performTacticalAttackAt?.(x, y);
                    }
                };

                tileCache[y][x] = tile;
                gridEl.appendChild(tile);
            }
        }
        mapManager._tileCache = tileCache;
        mapManager._tileCacheKey = `${map.id || mapManager.player.currentLayer}:${map.width}x${map.height}`;
        mapManager._renderSnapshot = null;
    }

    setupControls(mapManager);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleWindowBlur);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    document.getElementById('menu')?.classList.add('hidden');
    document.getElementById('exploration-screen')?.classList.remove('hidden');
}

function applyFloorAtmosphere(floorId, mapContainer) {
    if (!mapContainer) return;

    mapContainer.classList.remove('floor-1', 'floor-2', 'floor-3', 'floor-4', 'floor-5',
        'floor-6', 'floor-7', 'floor-8', 'floor-9', 'floor-10');
    mapContainer.classList.add(`floor-${floorId}`);

    const root = document.documentElement;
    const bgVar = `--floor-${floorId}-bg`;
    const defaultBg = '#000';
    const bgColor = getComputedStyle(root).getPropertyValue(bgVar).trim() || defaultBg;
    mapContainer.style.backgroundColor = bgColor;
}

function getEventRenderSignature(event, mapManager) {
    if (!event) return "";
    if (event.type === 'RIFT_STAGE') {
        const cleared = typeof mapManager.isRiftStageCleared === 'function' && mapManager.isRiftStageCleared(event.stageIndex);
        return `RIFT_STAGE:${event.stageIndex}:${cleared ? 1 : 0}`;
    }
    if (event.type === 'NPC') {
        return `NPC:${String(event.role || '').toUpperCase()}`;
    }
    return `${event.type}:${event.id || ''}:${event.eventKind || ''}`;
}

function addSetDiffKeys(prevSet, nextSet, targetSet) {
    const prev = prevSet || EMPTY_SET;
    const next = nextSet || EMPTY_SET;
    next.forEach((key) => {
        if (!prev.has(key)) targetSet.add(key);
    });
    prev.forEach((key) => {
        if (!next.has(key)) targetSet.add(key);
    });
}

function addMapDiffKeys(prevMap, nextMap, targetSet) {
    const prev = prevMap || EMPTY_MAP;
    const next = nextMap || EMPTY_MAP;
    next.forEach((value, key) => {
        if (prev.get(key) !== value) targetSet.add(key);
    });
    prev.forEach((_, key) => {
        if (!next.has(key)) targetSet.add(key);
    });
}

function parseTileKey(key) {
    const [sx, sy] = String(key || "").split(',');
    const x = Number(sx);
    const y = Number(sy);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

function renderExplorationTile(mapManager, tileEl, x, y, ctx) {
    if (!tileEl) return;
    const {
        map,
        px,
        py,
        monsterMap,
        rivalMap,
        eventMap,
        campfire,
        torchSet,
        guidePathSet
    } = ctx;
    const tileKey = `${x},${y}`;
    const isVisible = Boolean(mapManager.visibleTiles?.[y]?.[x]);
    const isVisited = Boolean(mapManager.visitedTiles?.[y]?.[x]);

    tileEl.classList.remove(
        'player', 'fog', 'portal', 'event', 'monster', 'monster-aggro', 'rift', 'rift-stage-cleared',
        'rift-exit', 'rift-cache', 'monument', 'item', 'campfire', 'campfire-placement-target', 'torch',
        'terrain-forest', 'terrain-water', 'terrain-lava', 'terrain-ice', 'turret', 'rift-turret',
        'hidden-relic', 'hidden-relic-locked', 'npc', 'npc-hostile', 'start', 'guide-path', 'corpse',
        'rival-party',
        'tactical-move', 'tactical-attack', 'tactical-cover',
        'is-visible', 'is-visited', 'is-hidden'
    );
    tileEl.title = '';
    tileEl.style.backgroundColor = '';
    tileEl.style.color = '';
    tileEl.style.opacity = '1';

    if (map.grid[y][x] === TILE_TYPES.CAMP) {
        tileEl.classList.add('campfire');
        applyTileMarker(tileEl, MAP_MARKERS.CAMPFIRE, '모닥불 - 쉬기 가능');
    } else {
        setTileIcon(tileEl, map.grid[y][x]);
    }

    if (isVisible) {
        tileEl.classList.add('is-visible');
        tileEl.style.opacity = "1";

        if (x === px && y === py) {
            tileEl.classList.add('player');
            tileEl.style.backgroundColor = "rgba(106, 171, 125, 0.2)";
            tileEl.style.color = "var(--color-text-primary)";
            applyTileMarker(tileEl, '◆', '현재 위치');
        } else {
            const monster = monsterMap.get(tileKey);
            if (monster) {
                tileEl.classList.add(monster.aggro ? 'monster-aggro' : 'monster');
                applyTileMarker(tileEl, MAP_MARKERS.MONSTER, monster.name || '몬스터');
            } else {
                const rival = rivalMap.get(tileKey) || null;
                if (rival) {
                    tileEl.classList.add('rival-party');
                    const teamSize = Math.max(1, Number(rival.teamSize || 1));
                    applyTileMarker(tileEl, MAP_MARKERS.RIVAL, `${rival.name || '경쟁자'} (${teamSize}인 경쟁 파티)`);
                } else {
                    const event = eventMap.get(tileKey) || null;
                    if (event) {
                    if (event.type === 'Start') {
                        tileEl.classList.add('start');
                        applyTileMarker(tileEl, MAP_MARKERS.START, '시작 지점');
                    } else if (event.type === 'PORTAL') {
                        tileEl.classList.add('portal');
                        applyTileMarker(tileEl, MAP_MARKERS.PORTAL, '차원 비석');
                    } else if (event.type === 'RIFT') {
                        tileEl.classList.add('rift');
                        applyTileMarker(tileEl, MAP_MARKERS.RIFT, '균열');
                    } else if (event.type === 'RIFT_STAGE') {
                        const cleared = typeof mapManager.isRiftStageCleared === 'function' && mapManager.isRiftStageCleared(event.stageIndex);
                        tileEl.classList.add(cleared ? 'rift-stage-cleared' : 'rift');
                        applyTileMarker(tileEl, cleared ? MAP_MARKERS.RIFT_STAGE_CLEARED : MAP_MARKERS.RIFT_STAGE, cleared ? '완료된 균열 단계' : '균열 단계');
                    } else if (event.type === 'RIFT_EXIT') {
                        tileEl.classList.add('rift-exit');
                        applyTileMarker(tileEl, MAP_MARKERS.RIFT_EXIT, '균열 출구');
                    } else if (event.type === 'RIFT_CACHE') {
                        tileEl.classList.add('rift-cache');
                        applyTileMarker(tileEl, MAP_MARKERS.RIFT_CACHE, '균열 잔향');
                    } else if (event.type === 'RIFT_FORTUNE') {
                        tileEl.classList.add('rift');
                        applyTileMarker(tileEl, MAP_MARKERS.RIFT_FORTUNE, '균열 기연');
                    } else if (event.type === 'TURRET') {
                        tileEl.classList.add('turret');
                        applyTileMarker(tileEl, MAP_MARKERS.TURRET, '자동 포탑');
                    } else if (event.type === 'RIFT_TURRET') {
                        tileEl.classList.add('rift-turret');
                        applyTileMarker(tileEl, MAP_MARKERS.RIFT_TURRET, '균열 포탑');
                    } else if (event.type === 'NPC') {
                        const isHostile = String(event.role || '').toUpperCase() === 'RAIDER';
                        tileEl.classList.add(isHostile ? 'npc-hostile' : 'npc');
                        applyTileMarker(tileEl, isHostile ? MAP_MARKERS.NPC_HOSTILE : MAP_MARKERS.NPC, `${event.npcName || '탐험가'} (${event.role || '중립'})`);
                    } else if (event.type === 'MONUMENT') {
                        tileEl.classList.add('monument');
                        applyTileMarker(tileEl, MAP_MARKERS.MONUMENT, '차원 비석');
                    } else if (event.type === 'CURIO' || event.type === 'EVENT') {
                        tileEl.classList.add('event');
                        applyTileMarker(tileEl, MAP_MARKERS.EVENT, '현장 이벤트');
                    } else if (event.type === 'ORE_VEIN') {
                        tileEl.classList.add('item');
                        applyTileMarker(tileEl, MAP_MARKERS.ORE, `${event.oreType || '광맥'} 채굴 지점`);
                    } else if (event.type === 'ITEM') {
                        tileEl.classList.add('item');
                        applyTileMarker(tileEl, MAP_MARKERS.ITEM, '아이템');
                    } else {
                        tileEl.classList.add('event');
                        applyTileMarker(tileEl, MAP_MARKERS.EVENT, `${event.type || '이벤트'} 상호작용`);
                    }
                }
                }

                if (campfire && campfire.x === x && campfire.y === y) {
                    tileEl.classList.add('campfire');
                    applyTileMarker(tileEl, MAP_MARKERS.CAMPFIRE, '모닥불 - 쉬기 가능');
                }

                if (torchSet.has(tileKey)) {
                    tileEl.classList.add('torch');
                    applyTileMarker(tileEl, MAP_MARKERS.TORCH, '설치된 횃불');
                }

                if (guidePathSet.has(tileKey)) {
                    tileEl.classList.add('guide-path');
                    if (!tileEl.textContent) {
                        applyTileMarker(tileEl, '·', '인도자 최단 경로');
                    } else if (!tileEl.title) {
                        tileEl.title = '인도자 최단 경로';
                    }
                }

                const corpse = typeof mapManager.getCorpseAt === 'function'
                    ? mapManager.getCorpseAt(x, y)
                    : null;
                if (corpse && !monster && !rivalMap.get(tileKey) && !eventMap.get(tileKey)) {
                    tileEl.classList.add('corpse');
                    applyTileMarker(tileEl, '☠', `${corpse.name || '시체'} 흔적`);
                }
            }
        }

        if (mapManager.tacticalState?.active) {
            if (mapManager.tacticalState.moveTiles?.has(tileKey)) {
                tileEl.classList.add('tactical-move');
            }
            if (mapManager.tacticalState.attackTiles?.has(tileKey)) {
                tileEl.classList.add('tactical-attack');
            }
            if (mapManager.tacticalState.coverTiles?.has(tileKey)) {
                tileEl.classList.add('tactical-cover');
            }
        }

        if (mapManager.isPlacingCampfire && !mapManager.isWall(x, y)) {
            tileEl.classList.add('campfire-placement-target');
            tileEl.title = '클릭해서 모닥불 설치';
        }
        if (mapManager.isPlacingTorch && !mapManager.isWall(x, y)) {
            tileEl.classList.add('campfire-placement-target');
            tileEl.title = '클릭해서 횃불 설치';
        }
    } else if (isVisited) {
        tileEl.classList.add('is-visited');
        tileEl.style.opacity = "0.3";
    } else {
        tileEl.classList.add('fog', 'is-hidden');
        tileEl.textContent = '';
        tileEl.style.opacity = "1";
        tileEl.style.backgroundColor = "var(--color-tile-fog)";
    }
}

export function updateExplorationUI(mapManager) {
    const map = mapManager.currentMap;
    if (!map) return;
    mapManager.player?.cb?.updateStatusBars?.(mapManager.player);
    const pendingLoot = mapManager.player?.pendingRivalLoot;
    const pendingLootStamp = Number(pendingLoot?.createdAt || 0);
    if (!pendingLoot) {
        mapManager._lastLootModalStamp = 0;
    } else if (
        pendingLootStamp > 0 &&
        Number(mapManager._lastLootModalStamp || 0) !== pendingLootStamp &&
        !isRivalLootModalOpen()
    ) {
        mapManager._lastLootModalStamp = pendingLootStamp;
        openRivalLootModal(mapManager);
    }
    const px = mapManager.player.x;
    const py = mapManager.player.y;
    const monsters = mapManager.activeMonsters || [];
    const guidePathTiles = typeof mapManager.getGuidePathTiles === 'function'
        ? mapManager.getGuidePathTiles()
        : [];
    const guidePathSet = new Set((guidePathTiles || []).map((tile) => `${tile.x},${tile.y}`));
    const floorId = mapManager.player.currentLayer || map.id || 1;
    const mapContainer = document.getElementById('map-container');
    const layerKey = `layer_${mapManager.player.currentLayer}`;
    const campfire = mapManager.player.campfires?.[layerKey] || null;
    const torches = mapManager.player.torches?.[layerKey] || [];
    const torchSet = new Set((Array.isArray(torches) ? torches : []).map((t) => `${t.x},${t.y}`));

    if (mapContainer) applyFloorAtmosphere(floorId, mapContainer);

    if (pixiRenderer?.active) {
        pixiRenderer.attach(mapManager);
        pixiRenderer.render(mapManager);
        return;
    }

    const monsterMap = new Map();
    const monsterSignatureMap = new Map();
    monsters.forEach((monster) => {
        if (!monster || !Number.isFinite(monster.x) || !Number.isFinite(monster.y)) return;
        const key = `${monster.x},${monster.y}`;
        monsterMap.set(key, monster);
        monsterSignatureMap.set(key, `${monster.name || 'M'}:${monster.aggro ? 1 : 0}`);
    });

    const rivalMap = new Map();
    const rivalSignatureMap = new Map();
    (mapManager.rivalParties || []).forEach((rival) => {
        if (!rival || rival.alive === false) return;
        if (!Number.isFinite(rival.x) || !Number.isFinite(rival.y)) return;
        const key = `${rival.x},${rival.y}`;
        rivalMap.set(key, rival);
        rivalSignatureMap.set(key, `${rival.name || 'R'}:${rival.role || 'opportunist'}:${rival.lootCount || 0}:${Number(rival.teamSize || 1)}`);
    });

    const eventPriority = {
        Start: 220,
        PORTAL: 210,
        RIFT_EXIT: 205,
        RIFT_STAGE: 200,
        RIFT: 190,
        RIFT_FORTUNE: 188,
        MONUMENT: 185,
        TURRET: 180,
        RIFT_TURRET: 175,
        NPC: 170,
        CURIO: 165,
        ORE_VEIN: 162,
        ITEM: 160,
        EVENT: 150,
        RIFT_CACHE: 140
    };
    const eventMap = new Map();
    const eventSignatureMap = new Map();
    (map.fixedEvents || []).forEach((event) => {
        if (!event || !Number.isFinite(event.resolvedX) || !Number.isFinite(event.resolvedY)) return;
        if (event.type === 'HIDDEN_RELIC') return;
        const key = `${event.resolvedX},${event.resolvedY}`;
        const existing = eventMap.get(key);
        const score = eventPriority[event.type] || 100;
        const existingScore = existing ? (eventPriority[existing.type] || 100) : -1;
        if (!existing || score >= existingScore) {
            eventMap.set(key, event);
        }
    });
    eventMap.forEach((event, key) => {
        eventSignatureMap.set(key, getEventRenderSignature(event, mapManager));
    });

    const corpseSignatureMap = new Map();
    (mapManager.corpses || []).forEach((corpse) => {
        if (!corpse || !Number.isFinite(corpse.x) || !Number.isFinite(corpse.y)) return;
        const key = `${corpse.x},${corpse.y}`;
        corpseSignatureMap.set(key, `${corpse.name || "corpse"}:${corpse.ttl || 0}`);
    });

    const tacticalMoveSet = mapManager.tacticalState?.active
        ? new Set([...(mapManager.tacticalState.moveTiles || [])])
        : EMPTY_SET;
    const tacticalAttackSet = mapManager.tacticalState?.active
        ? new Set([...(mapManager.tacticalState.attackTiles || [])])
        : EMPTY_SET;
    const tacticalCoverSet = mapManager.tacticalState?.active
        ? new Set([...(mapManager.tacticalState.coverTiles || [])])
        : EMPTY_SET;

    let tileCache = mapManager._tileCache;
    const cacheKey = `${map.id || mapManager.player.currentLayer}:${map.width}x${map.height}`;
    if (
        !Array.isArray(tileCache) ||
        tileCache.length !== map.height ||
        mapManager._tileCacheKey !== cacheKey
    ) {
        tileCache = Array.from({ length: map.height }, () => Array(map.width).fill(null));
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                tileCache[y][x] = document.getElementById(`tile-${x}-${y}`);
            }
        }
        mapManager._tileCache = tileCache;
        mapManager._tileCacheKey = cacheKey;
    }

    const context = {
        map,
        px,
        py,
        monsterMap,
        rivalMap,
        eventMap,
        campfire,
        torchSet,
        guidePathSet
    };

    const fastMode = Boolean(mapManager.fullVisibilityActive) &&
        floorId >= 2 &&
        !mapManager.isPlacingCampfire &&
        !mapManager.isPlacingTorch;
    const prevSnapshot = mapManager._renderSnapshot || null;
    const nextSnapshot = {
        cacheKey,
        fastMode,
        playerKey: `${px},${py}`,
        monsterSignatureMap,
        rivalSignatureMap,
        eventSignatureMap,
        corpseSignatureMap,
        guidePathSet,
        torchSet,
        tacticalMoveSet,
        tacticalAttackSet,
        tacticalCoverSet,
        campfireKey: campfire ? `${campfire.x},${campfire.y}` : ""
    };

    if (!fastMode || !prevSnapshot || prevSnapshot.cacheKey !== cacheKey || !prevSnapshot.fastMode) {
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const tileEl = tileCache?.[y]?.[x];
                renderExplorationTile(mapManager, tileEl, x, y, context);
            }
        }
    } else {
        const changed = new Set();
        changed.add(prevSnapshot.playerKey);
        changed.add(nextSnapshot.playerKey);
        if (prevSnapshot.campfireKey) changed.add(prevSnapshot.campfireKey);
        if (nextSnapshot.campfireKey) changed.add(nextSnapshot.campfireKey);

        addMapDiffKeys(prevSnapshot.monsterSignatureMap, nextSnapshot.monsterSignatureMap, changed);
        addMapDiffKeys(prevSnapshot.rivalSignatureMap, nextSnapshot.rivalSignatureMap, changed);
        addMapDiffKeys(prevSnapshot.eventSignatureMap, nextSnapshot.eventSignatureMap, changed);
        addMapDiffKeys(prevSnapshot.corpseSignatureMap, nextSnapshot.corpseSignatureMap, changed);
        addSetDiffKeys(prevSnapshot.guidePathSet, nextSnapshot.guidePathSet, changed);
        addSetDiffKeys(prevSnapshot.torchSet, nextSnapshot.torchSet, changed);
        addSetDiffKeys(prevSnapshot.tacticalMoveSet, nextSnapshot.tacticalMoveSet, changed);
        addSetDiffKeys(prevSnapshot.tacticalAttackSet, nextSnapshot.tacticalAttackSet, changed);
        addSetDiffKeys(prevSnapshot.tacticalCoverSet, nextSnapshot.tacticalCoverSet, changed);

        changed.forEach((key) => {
            const pos = parseTileKey(key);
            if (!pos) return;
            if (pos.x < 0 || pos.x >= map.width || pos.y < 0 || pos.y >= map.height) return;
            const tileEl = tileCache?.[pos.y]?.[pos.x];
            renderExplorationTile(mapManager, tileEl, pos.x, pos.y, context);
        });
    }

    mapManager._renderSnapshot = nextSnapshot;
    centerMapOnPlayer(px, py);
}

function centerMapOnPlayer(px, py) {
    const gridEl = document.getElementById('map-grid');
    if (!gridEl) return;

    const tx = - (px * TILE_TOTAL_SIZE) - (TILE_SIZE / 2);
    const ty = - (py * TILE_TOTAL_SIZE) - (TILE_SIZE / 2);
    gridEl.style.transform = `translate(${tx}px, ${ty}px)`;
}

function setTileIcon(el, type) {
    if (!el) return;
    if (type === TILE_TYPES.FOREST) {
        el.classList.add('terrain-forest');
        el.textContent = '';
    } else if (type === TILE_TYPES.WATER) {
        el.classList.add('terrain-water');
        el.textContent = '';
    } else if (type === TILE_TYPES.LAVA) {
        el.classList.add('terrain-lava');
        el.textContent = '';
    } else if (type === TILE_TYPES.ICE) {
        el.classList.add('terrain-ice');
        el.textContent = '';
    } else if (type === TILE_TYPES.CAMP) {
        el.classList.add('campfire');
        applyTileMarker(el, MAP_MARKERS.CAMPFIRE, '모닥불 - 쉬기 가능');
    } else if (!el.classList.contains('monster') && !el.classList.contains('portal')) {
        el.textContent = '';
    }
}

function setupControls(mgr) {
    const btnInventory = document.getElementById('btn-inventory');
    const btnAbility = document.getElementById('btn-ability');
    const btnTactical = document.getElementById('btn-tactical');
    const btnInteract = document.getElementById('interaction-btn');

    if (btnInventory) btnInventory.onclick = () => mgr.player?.cb?.showInventory?.(mgr.player);
    if (btnAbility) btnAbility.onclick = () => openExplorationAbilityModal(mgr);
    if (btnTactical) btnTactical.onclick = () => mgr.toggleTacticalMode?.();
    if (btnInteract) btnInteract.onclick = () => mgr.interact();
}

function tryMoveWithCooldown(mgr, dx, dy) {
    if (!mgr) return;

    const now = performance.now();
    if (now - lastMoveInputAt < MOVE_INPUT_COOLDOWN_MS) return;

    lastMoveInputAt = now;
    mgr.movePlayer(dx, dy);
}

function handleMovementKeyDown(e, dx, dy) {
    e.preventDefault();
    setHeldDirection(dx, dy);
    tryMoveWithCooldown(mapManagerInstance, dx, dy);
}

function handleKeyDown(e) {
    if (!mapManagerInstance) return;
    if (document.getElementById('exploration-screen')?.classList.contains('hidden')) return;

    if (isRivalLootModalOpen()) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeRivalLootModal();
        } else if (e.key === 'l' || e.key === 'L' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            mapManagerInstance.claimPendingRivalLoot?.();
            closeRivalLootModal();
        }
        return;
    }

    if (isAbilityModalOpen()) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeExplorationAbilityModal();
        }
        return;
    }

    if ((mapManagerInstance.isPlacingCampfire || mapManagerInstance.isPlacingTorch) && !["Escape", "i", "I", "e", "E"].includes(e.key)) {
        return;
    }

    switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
            handleMovementKeyDown(e, 0, -1);
            break;
        case "ArrowDown":
        case "s":
        case "S":
            handleMovementKeyDown(e, 0, 1);
            break;
        case "ArrowLeft":
        case "a":
        case "A":
            handleMovementKeyDown(e, -1, 0);
            break;
        case "ArrowRight":
        case "d":
        case "D":
            handleMovementKeyDown(e, 1, 0);
            break;
        case " ":
        case "Enter":
            e.preventDefault();
            if (mapManagerInstance.tacticalState?.active) {
                mapManagerInstance.attackNearestTacticalTarget?.();
            } else {
                mapManagerInstance.interact();
            }
            break;
        case "i":
        case "I":
            mapManagerInstance.player?.cb?.showInventory?.(mapManagerInstance.player);
            break;
        case "e":
        case "E":
            e.preventDefault();
            openExplorationAbilityModal(mapManagerInstance);
            break;
        case "l":
        case "L":
            e.preventDefault();
            openRivalLootModal(mapManagerInstance);
            break;
        case "c":
        case "C":
            mapManagerInstance.startCampfirePlacement?.();
            break;
        case "v":
        case "V":
            mapManagerInstance.recoverCampfireAtCurrentTile?.();
            break;
        case "t":
        case "T":
            mapManagerInstance.startTorchPlacement?.();
            break;
        case "f":
        case "F":
            mapManagerInstance.toggleTorchEquip?.();
            break;
        case "g":
        case "G":
            e.preventDefault();
            mapManagerInstance.toggleTacticalMode?.();
            break;
        case "q":
        case "Q":
            e.preventDefault();
            mapManagerInstance.endTacticalPlayerPhase?.();
            break;
        case "Escape":
            mapManagerInstance.cancelCampfirePlacement?.();
            mapManagerInstance.cancelTorchPlacement?.();
            closeExplorationAbilityModal();
            closeRivalLootModal();
            break;
    }
}

function handleKeyUp(e) {
    clearHeldDirectionByKey(e.key);
}

function handleWindowBlur() {
    stopHoldMoveLoop();
}

export function showInteractionPrompt(event) {
    const prompt = document.getElementById('interaction-prompt');
    const desc = document.getElementById('interaction-desc');
    if (prompt && desc) {
        prompt.classList.remove('hidden');
        desc.textContent = event.desc || "무언가 발견했습니다.";
    }
}

export function hideInteractionPrompt() {
    const prompt = document.getElementById('interaction-prompt');
    if (prompt) prompt.classList.add('hidden');
}

export function spawnExplorationHitVfx(x, y) {
    if (!pixiRenderer?.active) return;
    if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return;
    pixiRenderer.spawnVfxHit(Number(x), Number(y));
}

export function showRivalLootModal() {
    if (!mapManagerInstance) return;
    openRivalLootModal(mapManagerInstance);
}
