// 파일: exploration_system.js
// 역할: 2D 미궁 탐험의 핵심 로직 (이동, 충돌, 시야, 인카운터, 몬스터 AI)
import { generateBspDungeon } from './data/procedural_bsp.js';
import {
    createTacticalState,
    computeReachableTiles,
    computeRangeTiles,
    evaluateLineOfSight,
    pickNearestAttackableTarget,
    tileKey
} from './tactical_combat_system.js';

export class MapManager {
    constructor(player, gameCallbacks) {
        this.player = player;
        this.cb = gameCallbacks;
        this.gameData = player.gameData;
        
        this.currentMap = null;
        this.visitedTiles = []; 
        this.visibleTiles = []; 
        
        this.activeMonsters = []; 
        this.corpses = [];
        this.tacticalState = createTacticalState();
        this.ecoSnapshot = { predator: 0, prey: 0, scavenger: 0, spawnBias: 0 };
        this.isPlacingCampfire = false;
        this.isPlacingTorch = false;
        this.currentMode = "Labyrinth";
        this.collapse = {
            active: false,
            wave: 0,
            maxWaves: 0,
            movesUntilShift: 0,
            intermissionMoves: 0,
            anchorX: 0,
            anchorY: 0,
            barrierRadius: 9
        };
        this.partyRoleState = {
            guideHintCooldown: 0,
            magePulseCounter: 0,
            lastGuideHint: "",
            lastSeaGateLogAt: 0,
            guidePath: {
                tiles: [],
                ttl: 0,
                label: ""
            }
        };
        this.explorationAbilityCooldowns = {};
        this._fullVisibilityKey = null;
        this.fullVisibilityActive = false;
        this.rivalParties = [];
        this.rivalTick = 0;
        this.timeLimitForcedReturn = false;
    }

    resetRunState() {
        this.safeUnequipTorch(true);
        this.currentMap = null;
        this.currentMode = "Labyrinth";
        this.visitedTiles = [];
        this.visibleTiles = [];
        this.activeMonsters = [];
        this.corpses = [];
        this.tacticalState = createTacticalState();
        this.ecoSnapshot = { predator: 0, prey: 0, scavenger: 0, spawnBias: 0 };
        this.isPlacingCampfire = false;
        this.isPlacingTorch = false;
        this.collapse.active = false;
        this.collapse.wave = 0;
        this.player.currentMapId = null;
        this.player.x = 0;
        this.player.y = 0;
        this.player.pendingRiftStageIndex = null;
        this.player.currentRiftProgressKey = null;
        this.partyRoleState.guideHintCooldown = 0;
        this.partyRoleState.magePulseCounter = 0;
        this.partyRoleState.lastGuideHint = "";
        this.partyRoleState.lastSeaGateLogAt = 0;
        this.partyRoleState.guidePath = { tiles: [], ttl: 0, label: "" };
        this.explorationAbilityCooldowns = {};
        this._fullVisibilityKey = null;
        this.fullVisibilityActive = false;
        this.rivalParties = [];
        this.rivalTick = 0;
        this.timeLimitForcedReturn = false;
        if (this.player.explorationBuffs) {
            this.player.explorationBuffs.illumination = 0;
            this.player.explorationBuffs.reveal = 0;
            this.player.explorationBuffs.hunterSense = 0;
        }
    }

    getLayerTimeLimitHours(layer = this.player?.currentLayer) {
        return 0;
    }

    onWorldTimeAdvanced(payload = {}) {
        return;
    }

    forceReturnByTimeLimit() {
        if (this.timeLimitForcedReturn) return;
        this.timeLimitForcedReturn = true;

        const floor = Math.max(1, Number(this.player?.currentLayer || 1));
        this.cb.logMessage(`[시간 초과] ${floor}층 체류 한도를 초과했습니다. 차원 안정화 규칙에 따라 마을로 강제 귀환합니다.`);

        this.resetRunState();
        this.player.inCombat = false;
        this.player.currentMonster = null;
        this.player.playerTurn = false;
        this.player.position = "라비기온 (7-13구역)";
        this.player.timeRemaining = 0;

        this.cb.playMusic?.('bgm-city');
        this.cb.updateMenu?.(this.player);
        this.player.showStatus?.();
    }

    safeUnequipTorch(returnItem = true) {
        if (!this.player?.equippedTorch) return;
        if (returnItem && this.player.equippedTorchItem) {
            this.player.inventory = this.player.inventory || [];
            this.player.inventory.push(this.player.equippedTorchItem);
        }
        this.player.equippedTorch = false;
        this.player.equippedTorchItem = null;
    }

    logSeaGateMessage(message) {
        const now = Date.now();
        const lastLog = Number(this.partyRoleState?.lastSeaGateLogAt || 0);
        if ((now - lastLog) < 700) return;
        this.partyRoleState.lastSeaGateLogAt = now;
        this.cb.logMessage(message);
    }

    isWaterTile(x, y) {
        return this.currentMap?.grid?.[y]?.[x] === 3;
    }

    canTraverseSeaTile(x, y) {
        if (Number(this.player.currentLayer || 1) !== 6) return true;
        if (!this.isWaterTile(x, y)) return true;

        if (!this.player.shipUnlocked) {
            this.logSeaGateMessage("[대해 항해] 해상 이동에는 선박이 필요합니다.");
            return false;
        }
        if (!this.hasPartyTrait("항해사")) {
            this.logSeaGateMessage("[대해 항해] 해상 타일 이동에는 항해사 파티원이 필요합니다.");
            return false;
        }
        return true;
    }

    prepareSeaFloorRules() {
        if (Number(this.player.currentLayer || 1) !== 6) return;

        if (!this.player.shipUnlocked) {
            this.player.shipUnlocked = true;
            this.cb.logMessage("[대해 항해] 선착장에서 소형 선박을 확보했습니다.");
        }

        if (!this.player.seaIntroShown) {
            this.player.seaIntroShown = true;
            this.cb.logMessage("[대해 항해] 6층은 해역입니다. 항해사 파티원이 있어야 바다를 횡단할 수 있습니다.");
        }

        if (!this.hasPartyTrait("항해사")) {
            this.cb.logMessage("[대해 항해] 현재 파티에 항해사가 없어 섬 사이 바다 이동이 제한됩니다.");
        }
    }

    applyExplorationDamage(baseDamage = 0, options = {}) {
        const hasEquipped = (itemName) => Boolean(this.player?.hasEquippedItem?.(itemName));
        let multiplier = 1;

        if (hasEquipped("절망의 비 우의")) multiplier *= 0.76;
        if (hasEquipped("아이기스의 용갑")) multiplier *= 0.88;
        if (hasEquipped("심해 구명 내갑")) multiplier *= 0.9;
        if (hasEquipped("심연 역장 벨트")) multiplier *= 0.88;
        if (options?.type === "arcane" && hasEquipped("대현자의 군청 로브")) multiplier *= 0.82;
        if ((options?.source === "ambient_trap" || options?.source === "tactical_counter") && hasEquipped("창공 감시안")) multiplier *= 0.8;
        if (options?.isTurret && hasEquipped("수호자의 두 번째 방패")) multiplier *= 0.82;
        if (options?.type === "ice" && hasEquipped("극지 방패")) multiplier *= 0.68;
        if (options?.type === "fire" && hasEquipped("용암 방패")) {
            multiplier *= 0.72;
            const mpGain = Math.max(3, Math.floor(Number(baseDamage || 0) * 0.18));
            this.player.mp = Math.min(this.player.maxMp, Number(this.player.mp || 0) + mpGain);
            this.cb.logMessage(`[용암 방패] 화염 충격을 흡수해 MP +${mpGain}`);
        }

        const finalDamage = Math.max(1, Math.floor(Math.max(0, Number(baseDamage || 0)) * multiplier));
        this.player.hp = Math.max(1, Number(this.player.hp || 0) - finalDamage);
        this.cb.updateStatusBars?.(this.player);
        return finalDamage;
    }

    /**
     * 맵 진입
     */
    enterFloor(layerId) {
        // maps 또는 layers에서 맵 데이터 찾기 (호환성)
        const mapData = (this.gameData.maps && this.gameData.maps[layerId]) || 
                        (this.gameData.layers && this.gameData.layers[layerId]);
        if (!mapData) {
            this.cb.logMessage(`오류: ${layerId}층의 지도 데이터가 없습니다.`);
            return;
        }

        // 재진입 시 상태 유지
        if (this.currentMap && this.player.currentMapId == layerId) {
            this.cb.logMessage("탐험을 재개합니다.");
            this.updateVisibility();
            this.cb.initExplorationUI(this); 
            this.cb.updateExplorationUI(this);
            this.cb.playMusic('bgm-dungeon');
            return;
        }

        // --- 신규 진입 초기화 ---
        this.player.currentMapId = layerId;
        this.player.currentLayer = layerId; 
        this.player.timeRemaining = 0;
        this.currentMode = "Labyrinth";
        this.player.pendingRiftStageIndex = null;
        this.endDimensionCollapse(false);
        this.clearGuidePathOverlay();
        this._fullVisibilityKey = null;
        this.partyRoleState.guideHintCooldown = 0;
        this.partyRoleState.lastGuideHint = "";
        
        // 맵 생성 (복사본 사용)
        if (typeof mapData.generate === 'function') {
            const generated = mapData.generate();
            if (Array.isArray(generated)) {
                this.currentMap = {
                    ...mapData,
                    grid: generated
                };
            } else if (generated && Array.isArray(generated.grid)) {
                const mergedFixedEvents = [
                    ...(Array.isArray(mapData.fixedEvents) ? mapData.fixedEvents : []),
                    ...(Array.isArray(generated.fixedEvents) ? generated.fixedEvents : [])
                ];
                this.currentMap = {
                    ...mapData,
                    ...generated,
                    fixedEvents: mergedFixedEvents,
                    grid: generated.grid
                };
            } else {
                this.currentMap = {
                    ...mapData,
                    grid: JSON.parse(JSON.stringify(mapData.grid || []))
                };
            }
        } else if (mapData.procGen?.type === "bsp") {
            const layout = generateBspDungeon({
                width: mapData.width,
                height: mapData.height,
                ...mapData.procGen
            });
            this.currentMap = {
                ...mapData,
                grid: layout.grid,
                startPos: layout.startPos || mapData.startPos,
                spawnAnchors: layout.placements?.monsters || []
            };
        } else {
            this.currentMap = JSON.parse(JSON.stringify(mapData));
        }
        this.corpses = [];
        this.tacticalState = createTacticalState();

        // 벽이 아닌 모든 타일이 단일 연결 컴포넌트가 되도록 보정
        this.ensureMapConnectivity();

        // [중요] 랜덤 이벤트 위치 확정 및 고정
        if (this.currentMap.fixedEvents) {
            this.currentMap.fixedEvents = this.currentMap.fixedEvents.map(e => ({ ...e }));
            this.currentMap.fixedEvents.forEach(event => {
                const pos = this.resolveEventPosition(event);
                event.resolvedX = pos.x;
                event.resolvedY = pos.y;
            });
        }

        this.injectDynamicFloorEvents(layerId);
        this.ensureMandatoryFloorEvents(layerId);
        this.normalizeFixedEvents(layerId);

        // 배열 초기화
        this.visitedTiles = Array.from({ length: this.currentMap.height }, () => Array(this.currentMap.width).fill(false));
        this.visibleTiles = Array.from({ length: this.currentMap.height }, () => Array(this.currentMap.width).fill(false));

        // 플레이어 시작 위치 설정
        let startX = Math.floor(this.currentMap.width / 2);
        let startY = Math.floor(this.currentMap.height / 2);
        
        // 고정된 시작 포인트가 있다면 우선 사용
        const startEvent = this.currentMap.fixedEvents?.find(e => e.type === 'Start');
        if (startEvent) {
             startX = startEvent.resolvedX;
             startY = startEvent.resolvedY;
        } else if (this.currentMap.startPos) {
            startX = this.currentMap.startPos.x;
            startY = this.currentMap.startPos.y;
        }
        
        // 벽에 끼었다면 가까운 빈 땅 찾기
        if (this.isWall(startX, startY)) {
            const found = this.findNearestFloor(startX, startY);
            startX = found.x;
            startY = found.y;
        }
        this.player.x = startX;
        this.player.y = startY;
        this.player.labyrinthSteps = this.player.labyrinthSteps || 0;

        // [신규] 기존에 설치된 모닥불 복원
        const campfireKey = `layer_${layerId}`;
        const installedCampfire = this.player.campfires?.[campfireKey];
        if (installedCampfire && installedCampfire.x >= 0 && installedCampfire.x < this.currentMap.width &&
            installedCampfire.y >= 0 && installedCampfire.y < this.currentMap.height) {
            // 모닥불 위치가 유효한지 확인 (벽이 아닌지)
            if (!this.isWall(installedCampfire.x, installedCampfire.y)) {
                this.currentMap.grid[installedCampfire.y][installedCampfire.x] = 10; // CAMP 타일
                this.cb.logMessage(`이전에 설치한 모닥불을 발견했습니다. (${installedCampfire.x}, ${installedCampfire.y})`);
            } else {
                // 모닥불 위치가 벽이면 제거
                delete this.player.campfires[campfireKey];
                this.cb.logMessage("이전에 설치한 모닥불이 사라졌습니다.");
            }
        }

        // 기존 횃불 복원
        const torchKey = `layer_${layerId}`;
        if (!this.player.torches) this.player.torches = {};
        const installedTorches = this.player.torches?.[torchKey] || [];
        if (Array.isArray(installedTorches)) {
            this.player.torches[torchKey] = installedTorches.filter(t =>
                t.x >= 0 && t.x < this.currentMap.width &&
                t.y >= 0 && t.y < this.currentMap.height &&
                !this.isWall(t.x, t.y)
            );
        }

        if (Number(layerId || 0) === 6) {
            this.prepareSeaFloorRules();
        }

        // 몬스터 스폰
        this.spawnMapMonsters();
        this.spawnRivalParties();

        this.updateVisibility();
        this.cb.initExplorationUI(this);
        this.cb.updateExplorationUI(this);
        
        this.cb.logMessage(`[${this.currentMap.name}]에 진입했습니다. ${this.currentMap.description}`);
        this.cb.playMusic('bgm-dungeon');
    }

    enterRift(riftData) {
        if (!riftData || !Array.isArray(riftData.stages)) {
            this.cb.logMessage("오류: 유효하지 않은 균열 데이터입니다.");
            return;
        }

        const layerKey = String(this.player.currentLayer || 1);
        const riftName = String(riftData.name || "이름 없는 균열");
        const progressKey = `${layerKey}:${riftName}`;
        const mapId = `RIFT_${progressKey}`;

        if (this.currentMap && this.currentMap.isRiftMap && this.player.currentMapId === mapId) {
            this.cb.logMessage("균열 탐험을 재개합니다.");
            this.cb.initExplorationUI(this);
            this.cb.updateExplorationUI(this);
            this.cb.playMusic('bgm-dungeon');
            return;
        }

        this.endDimensionCollapse(false);
        this.currentMode = "Rift";
        this.player.currentMapId = mapId;
        this.player.position = "Rift";
        this.player.currentRift = riftData;
        this.player.pendingRiftStageIndex = null;
        this.player.currentRiftProgressKey = progressKey;
        this.partyRoleState.guideHintCooldown = 0;
        this.partyRoleState.magePulseCounter = 0;
        this.partyRoleState.lastGuideHint = "";
        this.clearGuidePathOverlay();
        if (!this.player.riftProgress) this.player.riftProgress = {};
        this.player.riftProgress[progressKey] = {
            clearedStages: [],
            cacheClaimed: [],
            completed: false
        };

        this.currentMap = this.buildRiftMap(riftData);
        this.currentMap.fixedEvents = (this.currentMap.fixedEvents || []).map(e => ({ ...e }));
        this.currentMap.fixedEvents.forEach(event => {
            const pos = this.resolveEventPosition(event);
            event.resolvedX = pos.x;
            event.resolvedY = pos.y;
        });

        this.activeMonsters = [];
        this.corpses = [];
        this.tacticalState = createTacticalState();
        this.visitedTiles = Array.from({ length: this.currentMap.height }, () => Array(this.currentMap.width).fill(false));
        this.visibleTiles = Array.from({ length: this.currentMap.height }, () => Array(this.currentMap.width).fill(false));

        const sx = this.currentMap.startPos?.x ?? 2;
        const sy = this.currentMap.startPos?.y ?? Math.floor(this.currentMap.height / 2);
        this.player.x = sx;
        this.player.y = sy;

        this.updateVisibility();
        this.cb.initExplorationUI(this);
        this.cb.updateExplorationUI(this);
        this.cb.logMessage(`[균열 진입] ${riftName} | 단계 ${riftData.stages.length}개`);
        this.cb.playMusic('bgm-dungeon');
    }

    buildRiftMap(riftData) {
        const stageCount = Math.max(1, Array.isArray(riftData.stages) ? riftData.stages.length : 1);
        const width = Math.max(21, stageCount * 6 + 9);
        const height = 17;
        const cy = Math.floor(height / 2);
        const grid = Array.from({ length: height }, () => Array(width).fill(0));
        const fixedEvents = [];

        for (let x = 1; x < width - 1; x++) {
            grid[cy][x] = 1;
            if (x % 3 === 0) {
                if (cy - 1 > 0) grid[cy - 1][x] = 1;
                if (cy + 1 < height - 1) grid[cy + 1][x] = 1;
            }
        }

        const step = Math.max(4, Math.floor((width - 8) / stageCount));
        const stageXs = [];
        for (let i = 0; i < stageCount; i++) {
            const x = Math.min(width - 5, 4 + (i * step));
            stageXs.push(x);
            grid[cy][x] = 1;
            fixedEvents.push({
                type: "RIFT_STAGE",
                stageIndex: i,
                x,
                y: cy,
                desc: riftData.stages?.[i]?.name || `단계 ${i + 1}`
            });

            if (i > 0) {
                const turretY = (i % 2 === 0) ? cy - 1 : cy + 1;
                if (turretY > 0 && turretY < height - 1) {
                    grid[turretY][x] = 1;
                    fixedEvents.push({
                        type: "RIFT_TURRET",
                        stageIndex: i,
                        x,
                        y: turretY,
                        desc: "자동 마력 포탑"
                    });
                }
            }
        }

        const cacheCandidates = stageXs.slice(0, Math.max(0, stageXs.length - 1));
        for (let i = 0; i < Math.min(2, cacheCandidates.length); i++) {
            const cx = cacheCandidates[i] + 2;
            if (cx < width - 2) {
                grid[cy][cx] = 1;
                fixedEvents.push({
                    type: "RIFT_CACHE",
                    x: cx,
                    y: cy,
                    desc: "균열 잔향이 모인 보급 파편"
                });
            }
        }

        const fortuneCount = Math.max(1, Math.min(3, Math.floor(stageCount / 2)));
        for (let i = 0; i < fortuneCount; i++) {
            const baseX = stageXs[Math.min(stageXs.length - 1, i)];
            const fx = Math.min(width - 3, Math.max(3, baseX + 1));
            const fy = (i % 2 === 0) ? (cy - 1) : (cy + 1);
            if (fy <= 0 || fy >= height - 1) continue;
            grid[fy][fx] = 1;
            fixedEvents.push({
                type: "RIFT_FORTUNE",
                id: `rift_fortune_${i}_${fx}_${fy}`,
                x: fx,
                y: fy,
                desc: "균열 기연 잔상이 응축되어 있습니다."
            });
        }

        const exitX = width - 4;
        grid[cy][exitX] = 1;
        fixedEvents.push({
            type: "RIFT_EXIT",
            x: exitX,
            y: cy,
            desc: "균열 핵 출구"
        });

        return {
            id: `rift_${String(riftData.name || "unknown").replace(/\s+/g, "_")}`,
            name: `${riftData.name || "균열"} 내부`,
            description: riftData.description || "균열 내부는 층마다 다른 몬스터와 기믹으로 구성됩니다.",
            width,
            height,
            grid,
            startPos: { x: 2, y: cy },
            spawnRate: 0,
            monsterDensity: 0,
            fixedEvents,
            isRiftMap: true
        };
    }

    getOccupiedEventSet() {
        const occupied = new Set();
        (this.currentMap?.fixedEvents || []).forEach((event) => {
            if (typeof event?.resolvedX === 'number' && typeof event?.resolvedY === 'number') {
                occupied.add(`${event.resolvedX},${event.resolvedY}`);
            }
        });
        return occupied;
    }

    getRandomUnoccupiedFloorPosition(occupiedSet, maxAttempts = 240) {
        for (let i = 0; i < maxAttempts; i++) {
            const pos = this.getRandomFloorTile();
            const key = `${pos.x},${pos.y}`;
            if (occupiedSet.has(key)) continue;
            if (Math.abs(this.player.x - pos.x) + Math.abs(this.player.y - pos.y) < 2) continue;
            occupiedSet.add(key);
            return pos;
        }
        return null;
    }

    injectDynamicFloorEvents(layerId) {
        if (!this.currentMap || this.currentMap.isRiftMap) return;
        this.currentMap.fixedEvents = Array.isArray(this.currentMap.fixedEvents) ? this.currentMap.fixedEvents : [];
        const occupied = this.getOccupiedEventSet();
        const layerNum = Math.max(1, Number(layerId) || 1);

        const addEvent = (event) => {
            if (!event) return;
            this.currentMap.fixedEvents.push(event);
        };

        const dynamicKinds = ["dynamic", "fortune", "traveler", "hazard", "ambush", "artifact"];
        const dynamicEventCount = 5 + Math.min(7, Math.floor(layerNum * 0.9));
        for (let i = 0; i < dynamicEventCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos) break;
            const kind = dynamicKinds[(layerNum + i) % dynamicKinds.length];
            const descByKind = {
                dynamic: "불안정한 현장의 흔적",
                fortune: "기연의 기척이 감지됩니다.",
                traveler: "누군가 남긴 생활 흔적이 보입니다.",
                hazard: "마력 함정의 잔광이 일렁입니다.",
                ambush: "매복 흔적이 주변을 둘러싸고 있습니다.",
                artifact: "알 수 없는 물체가 미세하게 진동합니다."
            };
            addEvent({
                type: "EVENT",
                eventKind: kind,
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: descByKind[kind] || "수상한 흔적"
            });
        }

        const settingsPool = Array.isArray(this.gameData?.settingsEvents) ? this.gameData.settingsEvents : [];
        const settingsEventCount = settingsPool.length > 0 ? Math.min(4, 1 + Math.floor(layerNum / 3), settingsPool.length) : 0;
        for (let i = 0; i < settingsEventCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos) break;
            const picked = settingsPool[(layerNum + i) % settingsPool.length];
            if (!picked) continue;
            addEvent({
                type: "EVENT",
                eventKind: "settings",
                settingsEvent: { ...picked },
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: picked.desc || "설정 기반 특수 이벤트"
            });
        }

        const curioCount = 2 + Math.floor(layerNum / 2);
        const curioIds = Object.keys(this.gameData?.curios || {});
        for (let i = 0; i < curioCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos || curioIds.length === 0) break;
            const curioId = curioIds[(layerNum + i) % curioIds.length];
            addEvent({
                type: "CURIO",
                id: curioId,
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: "기연 오브젝트"
            });
        }

        const monumentCount = layerNum >= 2 ? 1 + Math.floor(layerNum / 6) : 0;
        for (let i = 0; i < monumentCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos) break;
            addEvent({
                type: "MONUMENT",
                id: `dim_obelisk_${layerNum}_${i}`,
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: "차원 비석: 층의 기억이 새겨진 고대 비석"
            });
        }

        const riftCount = layerNum >= 2 ? 1 + Math.floor(layerNum / 5) : 0;
        for (let i = 0; i < riftCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos) break;
            addEvent({
                type: "RIFT",
                id: `rift_gate_${layerNum}_${i}`,
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: "불안정 균열 포탈"
            });
        }

        const turretCount = 2 + Math.floor(layerNum / 3);
        for (let i = 0; i < turretCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos) break;
            addEvent({
                type: "TURRET",
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: "마력 포탑이 자동 조준 중입니다."
            });
        }

        const orePool = this.getOrePoolForLayer(layerNum);
        const oreCount = 2 + Math.floor(layerNum / 2);
        for (let i = 0; i < oreCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos) break;
            if (orePool.length <= 0) break;
            const oreType = orePool[Math.floor(Math.random() * orePool.length)];
            addEvent({
                type: "ORE_VEIN",
                oreType,
                charges: 2 + Math.floor(Math.random() * 3),
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: `${oreType} 광맥 흔적`
            });
        }

        const hiddenCount = 2 + Math.floor(layerNum / 3);
        const hiddenReqPool = ["light", "sense", "rift", "terrain"];
        for (let i = 0; i < hiddenCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos) break;
            const req = hiddenReqPool[(layerNum + i) % hiddenReqPool.length];
            addEvent({
                type: "HIDDEN_RELIC",
                id: `hidden_${layerNum}_${i}_${pos.x}_${pos.y}`,
                hidden: true,
                discovered: false,
                requiredAbility: req,
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: "숨겨진 이질 파편"
            });
        }

        const npcPool = this.getDynamicNpcPool(layerNum);
        const npcCount = layerNum >= 5
            ? (7 + Math.floor(layerNum / 2))
            : (3 + Math.floor(layerNum / 2));
        for (let i = 0; i < npcCount; i++) {
            const pos = this.getRandomUnoccupiedFloorPosition(occupied);
            if (!pos) break;
            const npcEntry = npcPool[(layerNum + i) % npcPool.length];
            addEvent({
                type: "NPC",
                id: `field_npc_${layerNum}_${i}_${pos.x}_${pos.y}`,
                npcName: npcEntry.name,
                role: npcEntry.role,
                faction: npcEntry.faction,
                x: pos.x,
                y: pos.y,
                resolvedX: pos.x,
                resolvedY: pos.y,
                desc: npcEntry.desc
            });
        }

        if (this.player?.factionState?.flags?.black_market_hidden_gate) {
            const gatePos = this.getRandomUnoccupiedFloorPosition(occupied, 480);
            if (gatePos) {
                addEvent({
                    type: "EVENT",
                    eventKind: "traveler",
                    x: gatePos.x,
                    y: gatePos.y,
                    resolvedX: gatePos.x,
                    resolvedY: gatePos.y,
                    desc: "암시장 은닉 입구가 그림자 속에서 모습을 드러냅니다."
                });
            }
        }
    }

    getDynamicNpcPool(layerNum) {
        const basePool = [
            { role: "TRADER", faction: "중립", name: "유랑 상인", desc: "보급품을 판매하는 유랑 상인입니다." },
            { role: "HEALER", faction: "중립", name: "방랑 치료사", desc: "대가를 받고 응급 치료를 제공합니다." },
            { role: "SCOUT", faction: "중립", name: "길잡이 정찰자", desc: "근처 지형과 위험 지점을 알려줍니다." },
            { role: "SALVAGER", faction: "중립", name: "잔해 수거꾼", desc: "필드 잔해에서 유용한 물자를 찾습니다." }
        ];
        if (layerNum < 5) return basePool;

        return [
            ...basePool,
            { role: "CLAN_PATROL", faction: "클랜", name: "클랜 순찰대", desc: "클랜 단위 탐험대가 루트를 확보 중입니다." },
            { role: "CLAN_TRADER", faction: "클랜", name: "클랜 보급상", desc: "클랜 전용 물자를 거래합니다." },
            { role: "RAIDER", faction: "약탈자", name: "약탈자 무리", desc: "탐험가를 노리는 약탈자 무리입니다." },
            { role: "SMUGGLER", faction: "암시장", name: "암시장 밀수꾼", desc: "비밀 거래를 제안합니다." }
        ];
    }

    getOrePoolForLayer(layerNum) {
        const layer = Math.max(1, Number(layerNum || 1));
        if (layer <= 1) return ["구리 광석"];
        if (layer <= 2) return ["구리 광석", "철 광석"];
        if (layer <= 3) return ["구리 광석", "철 광석", "은 광석"];
        if (layer <= 4) return ["철 광석", "은 광석", "금 광석"];
        if (layer <= 5) return ["은 광석", "금 광석", "미스릴 광석"];
        if (layer <= 6) return ["금 광석", "미스릴 광석", "아다만타이트 광석"];
        if (layer <= 7) return ["미스릴 광석", "아다만타이트 광석", "오리할콤 광석"];
        if (layer <= 8) return ["아다만타이트 광석", "오리할콤 광석", "문스톤 광석"];
        if (layer <= 9) return ["오리할콤 광석", "문스톤 광석", "스타폴 광석"];
        return ["문스톤 광석", "스타폴 광석"];
    }

    ensureMandatoryFloorEvents(layerId) {
        if (!this.currentMap || this.currentMap.isRiftMap) return;
        this.currentMap.fixedEvents = Array.isArray(this.currentMap.fixedEvents) ? this.currentMap.fixedEvents : [];
        const events = this.currentMap.fixedEvents;
        const occupied = this.getOccupiedEventSet();
        const layerNum = Math.max(1, Number(layerId) || 1);

        const pickPosition = (preferredX, preferredY) => {
            const px = Math.max(1, Math.min(this.currentMap.width - 2, Math.floor(preferredX)));
            const py = Math.max(1, Math.min(this.currentMap.height - 2, Math.floor(preferredY)));
            const key = `${px},${py}`;
            if (!this.isWall(px, py) && !occupied.has(key)) {
                occupied.add(key);
                return { x: px, y: py };
            }
            const random = this.getRandomUnoccupiedFloorPosition(occupied, 420);
            if (random) return random;
            return this.findNearestFloor(px, py);
        };

        const portalEvents = events.filter((event) => event?.type === "PORTAL");
        if (portalEvents.length === 0) {
            const portalPos = pickPosition(this.currentMap.width - 6, Math.floor(this.currentMap.height / 2));
            events.push({
                type: "PORTAL",
                id: `auto_portal_${layerNum}`,
                targetLayer: layerNum >= 10 ? "Ending" : Math.max(2, layerNum + 1),
                x: portalPos.x,
                y: portalPos.y,
                resolvedX: portalPos.x,
                resolvedY: portalPos.y,
                desc: "상층으로 이어지는 차원 비석"
            });
        }

        if (layerNum === 2 && portalEvents.length < 2) {
            const secondaryPortal = pickPosition(Math.floor(this.currentMap.width * 0.18), Math.floor(this.currentMap.height * 0.8));
            events.push({
                type: "PORTAL",
                id: `auto_portal_${layerNum}_secondary`,
                targetLayer: 3,
                x: secondaryPortal.x,
                y: secondaryPortal.y,
                resolvedX: secondaryPortal.x,
                resolvedY: secondaryPortal.y,
                desc: "3층으로 이어지는 보조 차원 비석"
            });
        }

        const hasMonument = events.some((event) => event?.type === "MONUMENT");
        if (layerNum >= 2 && !hasMonument) {
            const monumentPos = pickPosition(Math.floor(this.currentMap.width / 2), Math.floor(this.currentMap.height / 2) - 2);
            events.push({
                type: "MONUMENT",
                id: `auto_monument_${layerNum}`,
                x: monumentPos.x,
                y: monumentPos.y,
                resolvedX: monumentPos.x,
                resolvedY: monumentPos.y,
                desc: "층의 흔적이 새겨진 차원 비석"
            });
        }
    }

    normalizeFixedEvents(layerId) {
        if (!this.currentMap || this.currentMap.isRiftMap) return;
        const layerNum = Math.max(1, Number(layerId) || 1);
        const events = Array.isArray(this.currentMap.fixedEvents) ? this.currentMap.fixedEvents : [];
        const occupied = new Set();
        const normalized = [];

        events.forEach((event, index) => {
            if (!event || typeof event !== "object") return;
            const clone = { ...event };
            let x = Number.isFinite(clone.resolvedX) ? clone.resolvedX : null;
            let y = Number.isFinite(clone.resolvedY) ? clone.resolvedY : null;
            if (x === null || y === null) {
                const resolved = this.resolveEventPosition(clone);
                x = resolved.x;
                y = resolved.y;
            }

            if (this.isWall(x, y)) {
                const nearest = this.findNearestFloor(x, y);
                x = nearest.x;
                y = nearest.y;
            }

            let key = `${x},${y}`;
            if (occupied.has(key)) {
                const relocated = this.getRandomUnoccupiedFloorPosition(occupied, 320) || this.findNearestFloor(x, y);
                x = relocated.x;
                y = relocated.y;
                key = `${x},${y}`;
            }
            occupied.add(key);

            clone.x = x;
            clone.y = y;
            clone.resolvedX = x;
            clone.resolvedY = y;
            if (clone.type === "PORTAL" && (clone.targetLayer === undefined || clone.targetLayer === null)) {
                clone.targetLayer = layerNum >= 10 ? "Ending" : Math.max(2, layerNum + 1);
            }
            if (!clone.id) clone.id = `${clone.type || "event"}_${layerNum}_${index}_${x}_${y}`;
            normalized.push(clone);
        });

        this.currentMap.fixedEvents = normalized;
    }

    getRiftProgressState() {
        const key = this.player.currentRiftProgressKey;
        if (!key) return null;
        if (!this.player.riftProgress) this.player.riftProgress = {};
        if (!this.player.riftProgress[key]) {
            this.player.riftProgress[key] = {
                clearedStages: [],
                cacheClaimed: [],
                completed: false
            };
        }
        return this.player.riftProgress[key];
    }

    isRiftStageCleared(stageIndex) {
        if (!this.currentMap?.isRiftMap) return false;
        const state = this.getRiftProgressState();
        if (!state) return false;
        return state.clearedStages.includes(stageIndex);
    }

    areAllRiftStagesCleared() {
        if (!this.currentMap?.isRiftMap || !this.player.currentRift) return false;
        const state = this.getRiftProgressState();
        if (!state) return false;
        const total = this.player.currentRift.stages?.length || 0;
        return total > 0 && state.clearedStages.length >= total;
    }

    getNextRiftStageIndex() {
        if (!this.currentMap?.isRiftMap || !this.player.currentRift) return null;
        const state = this.getRiftProgressState();
        if (!state) return null;
        const total = this.player.currentRift.stages?.length || 0;
        for (let i = 0; i < total; i++) {
            if (!state.clearedStages.includes(i)) return i;
        }
        return null;
    }

    markRiftStageCleared(stageIndex, options = {}) {
        if (!this.currentMap?.isRiftMap || !this.player.currentRift) return;
        const state = this.getRiftProgressState();
        if (!state) return;

        if (!state.clearedStages.includes(stageIndex)) {
            state.clearedStages.push(stageIndex);
            state.clearedStages.sort((a, b) => a - b);
            const stageName = this.player.currentRift.stages?.[stageIndex]?.name || `단계 ${stageIndex + 1}`;
            this.cb.logMessage(`[균열 진행] ${stageName} 클리어 (${state.clearedStages.length}/${this.player.currentRift.stages.length})`);
        }

        if (this.areAllRiftStagesCleared() && !state.completed) {
            state.completed = true;
            this.cb.logMessage(`[${this.player.currentRift.name}] 균열 정복 완료! 핵이 안정화되었습니다.`);
            this.player.addItem("균열석");
            this.cb.logMessage("출구가 활성화되었습니다. 출구 타일에서 상호작용해 귀환/다음 층 이동을 선택하세요.");
        }

        this.cb.updateExplorationUI(this);
        this.player.showStatus?.();
    }

    buildRiftStageCombatList(stage) {
        const stageMonsters = [];
        const rawMonsters = Array.isArray(stage?.monsters) ? stage.monsters : (stage?.monsters ? [stage.monsters] : []);
        rawMonsters.forEach(name => {
            if (typeof name === "string" && name.trim().length > 0) stageMonsters.push(name.trim());
        });
        if (stage?.boss && typeof stage.boss === "string" && stage.boss.trim().length > 0) {
            stageMonsters.push(stage.boss.trim());
        }

        const valid = [];
        const missing = [];
        stageMonsters.forEach(name => {
            if (this.gameData?.monsters?.[name]) valid.push(name);
            else missing.push(name);
        });

        if (valid.length === 0) {
            const fallback = this.getRiftFallbackMonsters();
            return { monsters: fallback, missing };
        }
        return { monsters: valid, missing };
    }

    getRiftFallbackMonsters() {
        const fromLayer = this.gameData?.layers?.[this.player.currentLayer]?.monsters || [];
        const sourceRaw = Array.isArray(fromLayer) && fromLayer.length > 0 ? fromLayer : ["고블린", "구울"];
        const source = sourceRaw.filter(name => this.gameData?.monsters?.[name]);
        if (source.length === 0) {
            const fallbackName = Object.keys(this.gameData?.monsters || {})[0];
            return fallbackName ? [fallbackName] : [];
        }
        const count = Math.min(3, Math.max(1, Math.floor(Math.random() * 2) + 1));
        const picks = [];
        for (let i = 0; i < count; i++) {
            picks.push(source[Math.floor(Math.random() * source.length)]);
        }
        return picks;
    }

    resolveRiftStageEventOnly(stage) {
        if (!stage) return;
        if (stage.event) {
            this.cb.logMessage(`[균열 이벤트] ${stage.event}`);
        }

        const roll = Math.random();
        if (roll < 0.5) {
            const gain = 80 + Math.floor(Math.random() * 141);
            this.player.magic_stones += gain;
            this.cb.logMessage(`균열 핵 조각을 회수했습니다. (마석 +${gain})`);
        } else if (roll < 0.8) {
            const itemPool = ["포션", "건조 식량", "마력결정체", "모닥불 키트"];
            const item = itemPool[Math.floor(Math.random() * itemPool.length)];
            this.player.addItem(item);
            this.cb.logMessage(`균열 잔해에서 ${item}(을)를 발견했습니다.`);
        } else {
            const dmg = 12 + Math.floor(Math.random() * 29);
            const finalDamage = this.applyExplorationDamage(dmg, { source: "rift_turbulence", type: "arcane" });
            this.cb.logMessage(`공간 난류로 ${finalDamage} 피해를 입었습니다.`);
        }
    }

    handleRiftExitEvent() {
        if (!this.currentMap?.isRiftMap) return;
        if (!this.areAllRiftStagesCleared()) {
            const total = this.player.currentRift?.stages?.length || 0;
            const cleared = this.getRiftProgressState()?.clearedStages?.length || 0;
            const nextStage = this.getNextRiftStageIndex();
            this.cb.logMessage(`균열의 핵이 잠겨 있습니다. 단계 ${cleared}/${total} 완료.`);
            if (nextStage !== null) {
                const stageName = this.player.currentRift?.stages?.[nextStage]?.name || `단계 ${nextStage + 1}`;
                this.cb.logMessage(`다음으로 [${stageName}]를 공략해야 출구가 열립니다.`);
            }
            return;
        }

        if (String(this.player.currentLayer) === "8") {
            const goNext = confirm("균열을 정복했습니다. 9층으로 이동하시겠습니까?\n취소를 누르면 8층으로 복귀합니다.");
            if (goNext) {
                this.player.currentRift = null;
                this.player.pendingRiftStageIndex = null;
                this.cb.showPortalChoice(this.player, 9, 8);
                return;
            }
            this.player.position = "Labyrinth";
            this.player.currentRift = null;
            this.player.pendingRiftStageIndex = null;
            this.player.currentMapId = null;
            this.enterFloor(8);
            return;
        }

        const goCity = confirm("균열을 정복했습니다. 도시로 귀환하시겠습니까?");
        if (goCity) {
            this.player.position = "라비기온 (7-13구역)";
            this.player.currentRift = null;
            this.player.pendingRiftStageIndex = null;
            this.player.currentMapId = null;
            this.cb.playMusic('bgm-city');
            this.cb.updateMenu(this.player);
            this.player.showStatus?.();
        }
    }

    /**
     * [신규] 베이스캠프 설치
     */
    createBaseCamp() {
        const x = this.player.x;
        const y = this.player.y;

        if (this.isWall(x, y)) {
            this.cb.logMessage("이곳에는 야영지를 설치할 수 없습니다.");
            return;
        }
        
        // 현재 타일을 베이스캠프(10)로 변경
        this.currentMap.grid[y][x] = 10; // TILE_TYPES.CAMP
        this.cb.logMessage("베이스캠프를 설치했습니다! 이제 이곳에서 [대기(Space)]하여 휴식을 취할 수 있습니다.");
        this.cb.updateExplorationUI(this);
    }

    spawnMapMonsters() {
        this.activeMonsters = [];
        const density = this.currentMap.monsterDensity || 0;
        const monsterTable = this.currentMap.monsterTable || ["고블린"];
        const blockedEventTiles = new Set(
            (this.currentMap.fixedEvents || [])
                .filter((event) => Number.isFinite(event?.resolvedX) && Number.isFinite(event?.resolvedY))
                .map((event) => `${event.resolvedX},${event.resolvedY}`)
        );

        if (density <= 0 || monsterTable.length === 0) return;

        const createMonsterEntity = (name, x, y, idSuffix) => {
            const monsterData = this.gameData?.monsters?.[name] || {};
            const maxHp = Math.max(30, Number(monsterData.hp || 100));
            return {
                id: `mon_${idSuffix}`,
                name,
                x,
                y,
                hp: maxHp,
                maxHp,
                aggro: false,
                aiState: "Patrol",
                faction: String(monsterData.faction || "중립")
            };
        };

        let created = 0;
        const anchors = Array.isArray(this.currentMap.spawnAnchors) ? this.currentMap.spawnAnchors : [];
        anchors.forEach((anchor, idx) => {
            const ax = Number(anchor?.x);
            const ay = Number(anchor?.y);
            if (!Number.isFinite(ax) || !Number.isFinite(ay)) return;
            if (ax < 0 || ay < 0 || ax >= this.currentMap.width || ay >= this.currentMap.height) return;
            if (this.isWall(ax, ay)) return;
            if (blockedEventTiles.has(`${ax},${ay}`)) return;
            if (this.getDistance(this.player.x, this.player.y, ax, ay) <= 3) return;
            if (this.getMonsterAt(ax, ay)) return;
            const tableForPos = this.getMonsterTableForPosition(ax, ay);
            const pickTable = tableForPos.length > 0 ? tableForPos : monsterTable;
            const mName = pickTable[Math.floor(Math.random() * pickTable.length)];
            this.activeMonsters.push(createMonsterEntity(mName, ax, ay, `anchor_${idx}`));
            created += 1;
        });

        for (let i = created; i < density; i++) {
            let mx;
            let my;
            for (let tryCount = 0; tryCount < 100; tryCount++) {
                mx = Math.floor(Math.random() * this.currentMap.width);
                my = Math.floor(Math.random() * this.currentMap.height);
                if (
                    !this.isWall(mx, my) &&
                    !blockedEventTiles.has(`${mx},${my}`) &&
                    this.getDistance(this.player.x, this.player.y, mx, my) > 5 &&
                    !this.getMonsterAt(mx, my)
                ) {
                    const tableForPos = this.getMonsterTableForPosition(mx, my);
                    const pickTable = tableForPos.length > 0 ? tableForPos : monsterTable;
                    const mName = pickTable[Math.floor(Math.random() * pickTable.length)];
                    this.activeMonsters.push(createMonsterEntity(mName, mx, my, i));
                    break;
                }
            }
        }

        if (this.player?.factionState?.flags?.kingdom_chaser_active) {
            const chaserName = this.resolveChaserMonsterName(monsterTable);
            const pos = this.getRandomFloorTile();
            if (!this.getMonsterAt(pos.x, pos.y)) {
                this.activeMonsters.push(createMonsterEntity(chaserName, pos.x, pos.y, `chaser_${Date.now()}`));
            }
        }
    }

    createRivalParty(x, y, index = 0) {
        const first = ["철검", "회색", "황혼", "붉은달", "푸른창", "검은닻", "은빛"];
        const second = ["원정대", "사냥단", "탐사조", "약탈조", "개척단", "구조대", "견습반"];
        const temperament = Math.random();
        const role = temperament < 0.3 ? "cooperative" : (temperament < 0.7 ? "opportunist" : "predatory");
        const teamSize = 2 + Math.floor(Math.random() * 4);
        const id = `rival_${Date.now()}_${index}`;
        return {
            id,
            name: `${first[Math.floor(Math.random() * first.length)]} ${second[Math.floor(Math.random() * second.length)]}`,
            x,
            y,
            teamSize,
            hpRate: 0.62 + (Math.random() * 0.38),
            lootCount: 0,
            role,
            helpBias: role === "cooperative" ? 0.62 : (role === "opportunist" ? 0.32 : 0.14),
            killStealBias: role === "opportunist" ? 0.58 : (role === "predatory" ? 0.46 : 0.2),
            tollBias: role === "predatory" ? 0.62 : 0.26,
            pkBias: role === "predatory" ? 0.56 : 0.16,
            moveCooldown: 0,
            pressureCooldown: 0,
            combatCooldown: 0,
            alive: true
        };
    }

    spawnRivalParties() {
        this.rivalParties = [];
        this.rivalTick = 0;
        if (!this.currentMap || this.currentMap.isRiftMap) return;
        const layer = Math.max(1, Number(this.player?.currentLayer || 1));
        const count = Math.max(2, Math.min(5, 2 + Math.floor(layer / 4) + Math.floor(Math.random() * 2)));
        for (let i = 0; i < count; i++) {
            let created = null;
            for (let tryCount = 0; tryCount < 80; tryCount++) {
                const tile = this.getRandomFloorTile();
                if (this.getDistance(tile.x, tile.y, this.player.x, this.player.y) <= 7) continue;
                if (this.getMonsterAt(tile.x, tile.y)) continue;
                if (this.getRivalAt(tile.x, tile.y)) continue;
                created = this.createRivalParty(tile.x, tile.y, i);
                break;
            }
            if (created) this.rivalParties.push(created);
        }
        if (this.rivalParties.length > 0) {
            this.cb.logMessage(`[탐험 정보] 경쟁 탐험가 파티 ${this.rivalParties.length}개가 같은 층에 진입했습니다. (팀 단위 활동 감지)`);
        }
    }

    getRivalAt(x, y) {
        return (this.rivalParties || []).find((r) => r && r.alive !== false && r.x === x && r.y === y) || null;
    }

    buildRivalLootBundle(rival) {
        const layer = Math.max(1, Number(this.player?.currentLayer || 1));
        const role = String(rival?.role || "opportunist");
        const teamSize = Math.max(1, Number(rival?.teamSize || 1));
        const roleMultiplier = role === "predatory" ? 1.2 : (role === "cooperative" ? 0.9 : 1.0);
        const teamMultiplier = 1 + (teamSize - 1) * 0.24;
        const magicStones = Math.max(30, Math.floor((70 + (layer * 18) + Math.random() * 90) * roleMultiplier * teamMultiplier));
        const gold = Math.max(80, Math.floor((180 + (layer * 35) + Math.random() * 240) * roleMultiplier * teamMultiplier));

        const supplyPool = ["건조 식량", "포션", "마력결정체", "횃불", "모닥불 키트", "붕대", "해독제"];
        const itemCount = 1 + Math.floor(Math.random() * Math.min(4, 1 + Math.floor(teamSize / 2)));
        const items = [];
        for (let i = 0; i < itemCount; i++) {
            items.push(supplyPool[Math.floor(Math.random() * supplyPool.length)]);
        }

        const equipTypeKeywords = /(투구|갑옷|장갑|각반|무기|부무기|검|창|방패|팔찌|반지|목걸이|귀걸이|벨트|부적|토큰|마도구|클로|둔기|활|가면)/;
        const numbersPool = Object.entries(this.gameData?.numbersItems || {})
            .filter(([itemName, data]) => Boolean(itemName) && equipTypeKeywords.test(String(data?.type || "")))
            .map(([itemName]) => itemName);
        const gearPool = Object.entries(this.gameData?.items || {})
            .filter(([itemName, data]) => Boolean(itemName) && equipTypeKeywords.test(String(data?.type || "")))
            .map(([itemName]) => itemName);
        const mergedPool = [...new Set([...numbersPool, ...gearPool])];
        const equipment = [];
        const equipmentDropChance = Math.min(0.72, 0.35 + (layer * 0.035) + (role === "predatory" ? 0.1 : 0));
        if (mergedPool.length > 0 && Math.random() < equipmentDropChance) {
            equipment.push(mergedPool[Math.floor(Math.random() * mergedPool.length)]);
        }
        if (mergedPool.length > 0 && Math.random() < (equipmentDropChance * 0.28)) {
            equipment.push(mergedPool[Math.floor(Math.random() * mergedPool.length)]);
        }

        return { gold, magicStones, items, equipment };
    }

    startRivalExplorerCombat(rival) {
        if (!rival) return;
        const role = String(rival.role || "opportunist");
        const teamSize = Math.max(1, Number(rival.teamSize || 1));
        const roleLabel = role === "cooperative" ? "협력형" : (role === "predatory" ? "약탈형" : "기회주의");
        const layer = Math.max(1, Number(this.player?.currentLayer || 1));
        const playerPower = Math.max(1, Number(this.player?.level || 1) + Math.floor(Number(this.player?.maxHp || 100) / 80));
        const roleScale = (role === "predatory" ? 1.18 : (role === "cooperative" ? 0.9 : 1.0)) * (1 + Math.min(0.55, (teamSize - 1) * 0.13));
        const grade = Math.max(2, Math.min(9, 10 - Math.floor((layer + playerPower * roleScale) / 2.2)));
        const maxHp = Math.max(90, Math.floor((this.player.maxHp * 0.68 + layer * 24) * roleScale));
        const atk = Math.max(16, Math.floor((this.player.currentStats?.["근력"] || 20) * (0.32 + roleScale * 0.2)));
        const def = Math.max(8, Math.floor((this.player.currentStats?.["물리 내성"] || 18) * (0.26 + roleScale * 0.16)));
        const mdef = Math.max(6, Math.floor((this.player.currentStats?.["항마력"] || 15) * (0.24 + roleScale * 0.15)));
        const loot = this.buildRivalLootBundle(rival);
        const baseName = `[탐험가] ${rival.name}`;
        const monsterName = this.gameData?.monsters?.[baseName] ? `${baseName}#${String(rival.id || Date.now()).slice(-4)}` : baseName;
        const encounterCount = Math.max(1, Math.min(3, Math.floor((teamSize + 1) / 2)));

        this.gameData.monsters = this.gameData.monsters || {};
        const battlePack = [];
        for (let i = 0; i < encounterCount; i++) {
            const unitScale = 0.82 + (i * 0.18);
            const unitName = encounterCount > 1 ? `${monsterName}-${i + 1}` : monsterName;
            this.gameData.monsters[unitName] = {
                name: unitName,
                hp: Math.max(70, Math.floor(maxHp * unitScale)),
                atk: Math.max(12, Math.floor(atk * unitScale)),
                def: Math.max(6, Math.floor(def * unitScale)),
                magic_def: Math.max(5, Math.floor(mdef * unitScale)),
                grade,
                faction: "약탈자",
                attacks: [
                    { name: "탐험가 연격", dmg: Math.max(8, Math.floor(atk * 0.9 * unitScale)), type: "physical" },
                    { name: "현장 전술", dmg: Math.max(7, Math.floor(atk * 0.8 * unitScale)), type: "physical", effect: "fear" }
                ],
                essences: [],
                drops: [],
                isRivalExplorer: true,
                rivalPartyId: rival.id,
                rivalPartyName: rival.name,
                rivalRole: role,
                rivalLoot: i === 0 ? loot : null
            };
            battlePack.push(unitName);
        }

        rival.alive = false;
        this.rivalParties = (this.rivalParties || []).filter((entry) => entry && entry.id !== rival.id);
        this.cb.logMessage(`[탐험가 결투] ${rival.name} (${roleLabel}, ${teamSize}인 팀)에게 결투를 걸었습니다.`);
        this.cb.logMessage("[탐험가 결투] 승리 시 소지품과 장비를 루팅할 수 있습니다.");
        this.cb.updateExplorationUI(this);
        this.player.startCombat(battlePack);
    }

    claimPendingRivalLoot() {
        const loot = this.player?.pendingRivalLoot;
        if (!loot || loot.collected) return null;

        const sourceNames = Array.isArray(loot.sourceNames) ? loot.sourceNames.filter(Boolean) : [];
        const title = sourceNames.length > 0 ? sourceNames.join(", ") : "탐험가";
        const goldGain = Math.max(0, Number(loot.gold || 0));
        const stoneGain = Math.max(0, Number(loot.magicStones || 0));
        const itemList = Array.isArray(loot.items) ? loot.items.filter(Boolean) : [];
        const equipList = Array.isArray(loot.equipment) ? loot.equipment.filter(Boolean) : [];

        if (goldGain > 0) this.player.gold += goldGain;
        if (stoneGain > 0) this.player.magic_stones += stoneGain;

        itemList.forEach((item) => this.player.addItem?.(item));
        equipList.forEach((item) => this.player.addItem?.(item));

        this.player.pendingRivalLoot = null;
        this.cb.logMessage(`[루팅 완료] ${title} 전리품 회수 완료. (스톤 ${goldGain.toLocaleString()}, 마석 ${stoneGain}, 아이템 ${itemList.length + equipList.length}개)`);
        this.player.showStatus?.();
        this.cb.updateExplorationUI?.(this);
        return {
            gold: goldGain,
            magicStones: stoneGain,
            items: itemList,
            equipment: equipList
        };
    }

    findNearestLootEventForRival(rival, maxDistance = 8) {
        if (!rival || !this.currentMap?.fixedEvents) return null;
        let best = null;
        const priority = {
            ITEM: 120,
            CURIO: 100,
            EVENT: 80
        };
        this.currentMap.fixedEvents.forEach((event) => {
            if (!event || !Number.isFinite(event.resolvedX) || !Number.isFinite(event.resolvedY)) return;
            if (!priority[event.type]) return;
            const dist = this.getDistance(rival.x, rival.y, event.resolvedX, event.resolvedY);
            if (dist > maxDistance) return;
            const score = (priority[event.type] || 0) - (dist * 4);
            if (!best || score > best.score) {
                best = { event, distance: dist, score };
            }
        });
        return best;
    }

    processRivalLootEvent(rival, event) {
        if (!rival || !event) return false;
        if (event.type === "ITEM" || event.type === "CURIO" || event.type === "EVENT") {
            rival.lootCount = Math.max(0, Number(rival.lootCount || 0) + 1);
            rival.combatCooldown = 2;
            const nearPlayer = this.getDistance(rival.x, rival.y, this.player.x, this.player.y) <= 7;
            if (nearPlayer) {
                this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 상자를 먼저 열어 전리품을 가져갔습니다. 빈 흔적만 남았습니다.`);
            }
            this.consumeFixedEvent(event, "");
            return true;
        }
        return false;
    }

    isTileBlockedForRival(x, y, rival = null) {
        if (x < 0 || y < 0 || x >= this.currentMap.width || y >= this.currentMap.height) return true;
        if (this.isWall(x, y)) return true;
        if (this.getMonsterAt(x, y)) return true;
        if (this.player?.x === x && this.player?.y === y) return true;
        const occupied = (this.rivalParties || []).some((r) => r && r !== rival && r.alive !== false && r.x === x && r.y === y);
        if (occupied) return true;
        return false;
    }

    stepRivalToward(rival, tx, ty) {
        if (!rival) return;
        const dx = Math.sign(tx - rival.x);
        const dy = Math.sign(ty - rival.y);
        const candidates = [];
        if (Math.abs(dx) >= Math.abs(dy)) {
            candidates.push([rival.x + dx, rival.y], [rival.x, rival.y + dy]);
        } else {
            candidates.push([rival.x, rival.y + dy], [rival.x + dx, rival.y]);
        }
        candidates.push([rival.x + dx, rival.y + dy]);
        for (let i = 0; i < candidates.length; i++) {
            const [nx, ny] = candidates[i];
            if (!this.isTileBlockedForRival(nx, ny, rival)) {
                rival.x = nx;
                rival.y = ny;
                return;
            }
        }
        if (Math.random() < 0.35) {
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            const pick = dirs[Math.floor(Math.random() * dirs.length)];
            const nx = rival.x + pick[0];
            const ny = rival.y + pick[1];
            if (!this.isTileBlockedForRival(nx, ny, rival)) {
                rival.x = nx;
                rival.y = ny;
            }
        }
    }

    tryRivalStealNearbyMonster(rival) {
        if (!rival || !Array.isArray(this.activeMonsters) || this.activeMonsters.length === 0) return false;
        const candidateIndex = this.activeMonsters.findIndex((monster) => {
            if (!monster) return false;
            const distToRival = this.getDistance(monster.x, monster.y, rival.x, rival.y);
            const distToPlayer = this.getDistance(monster.x, monster.y, this.player.x, this.player.y);
            return distToRival <= 2 && distToPlayer <= 2;
        });
        if (candidateIndex < 0) return false;
        if (Math.random() >= Number(rival.killStealBias || 0)) return false;

        const killed = this.activeMonsters.splice(candidateIndex, 1)[0];
        if (killed) {
            this.registerCorpse(killed, killed.x, killed.y);
            rival.lootCount = Math.max(0, Number(rival.lootCount || 0) + 1);
            this.cb.logMessage(`[경쟁자] ${rival.name}이(가) ${killed.name}에게 막타를 넣고 보상을 챙겼습니다.`);
            return true;
        }
        return false;
    }

    processRivalPressureOnPlayer() {
        const hpRate = Number(this.player.hp || 0) / Math.max(1, Number(this.player.maxHp || 1));
        if (hpRate > 0.2) return false;
        const nearby = (this.rivalParties || [])
            .filter((r) => r && r.alive !== false && this.getDistance(r.x, r.y, this.player.x, this.player.y) <= 2);
        if (nearby.length === 0) return false;
        const rival = nearby.sort((a, b) => Number((b.pkBias || 0) + (b.tollBias || 0)) - Number((a.pkBias || 0) + (a.tollBias || 0)))[0];
        if (!rival) return false;
        if (Number(rival.pressureCooldown || 0) > 0) {
            rival.pressureCooldown = Math.max(0, Number(rival.pressureCooldown || 0) - 1);
            return false;
        }
        rival.pressureCooldown = 5;

        const truthShieldActive = Number(this.player?.deceptionShieldUntil || 0) > Number(this.player?.worldTimeHours || 0);
        if (truthShieldActive) {
            this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 위협을 시도했지만 [어긋난 신뢰] 장막에 막혔습니다.`);
            return false;
        }

        const tollChance = Number(rival.tollBias || 0);
        if (Math.random() < tollChance) {
            const toll = 200 + Math.floor(Math.random() * 280);
            if (Number(this.player.gold || 0) >= toll) {
                this.player.gold -= toll;
                this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 빈사 상태를 보고 통행료 ${toll} 스톤을 요구했습니다. 강제로 지불했습니다.`);
            } else {
                const robbed = Math.min(Math.max(0, Number(this.player.gold || 0)), 90 + Math.floor(Math.random() * 140));
                this.player.gold = Math.max(0, Number(this.player.gold || 0) - robbed);
                this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 자금을 뒤져 ${robbed} 스톤을 빼앗았습니다.`);
            }
            this.player.showStatus?.();
            return true;
        }

        if (Math.random() < Number(rival.pkBias || 0)) {
            const damage = 18 + Math.floor(Math.random() * 26);
            const finalDamage = this.applyExplorationDamage(damage, { source: "rival_pk", type: "physical" });
            if (Math.random() < 0.42 && Array.isArray(this.player.inventory) && this.player.inventory.length > 0) {
                const idx = Math.floor(Math.random() * this.player.inventory.length);
                const stolen = this.player.inventory.splice(idx, 1)[0];
                this.cb.logMessage(`[경쟁자 PK] ${rival.name}이(가) 기습하여 ${finalDamage} 피해를 주고 ${stolen}(을)를 강탈했습니다.`);
            } else {
                this.cb.logMessage(`[경쟁자 PK] ${rival.name}이(가) 기습하여 ${finalDamage} 피해를 주고 도주했습니다.`);
            }
            this.player.applyCombatInjury?.({ damage: finalDamage, source: "경쟁자 기습" });
            this.player.showStatus?.();
            return true;
        }
        return false;
    }

    processRivalParties() {
        if (!Array.isArray(this.rivalParties) || this.rivalParties.length === 0) return;
        this.rivalTick = Math.max(0, Number(this.rivalTick || 0) + 1);
        this.rivalParties.forEach((rival) => {
            if (!rival || rival.alive === false) return;
            if (Number(rival.moveCooldown || 0) > 0) {
                rival.moveCooldown = Math.max(0, Number(rival.moveCooldown || 0) - 1);
                return;
            }
            rival.moveCooldown = 0;
            if (Number(rival.combatCooldown || 0) > 0) {
                rival.combatCooldown = Math.max(0, Number(rival.combatCooldown || 0) - 1);
            }

            const stealMonster = this.tryRivalStealNearbyMonster(rival);
            if (stealMonster) return;

            const targetLoot = this.findNearestLootEventForRival(rival, 7);
            if (targetLoot && Math.random() < 0.72) {
                this.stepRivalToward(rival, targetLoot.event.resolvedX, targetLoot.event.resolvedY);
                if (rival.x === targetLoot.event.resolvedX && rival.y === targetLoot.event.resolvedY) {
                    this.processRivalLootEvent(rival, targetLoot.event);
                }
                return;
            }

            if (Math.random() < 0.24) {
                this.stepRivalToward(rival, this.player.x, this.player.y);
            } else {
                const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                const pick = dirs[Math.floor(Math.random() * dirs.length)];
                const nx = rival.x + pick[0];
                const ny = rival.y + pick[1];
                if (!this.isTileBlockedForRival(nx, ny, rival)) {
                    rival.x = nx;
                    rival.y = ny;
                }
            }
        });

        this.rivalParties = this.rivalParties.filter((rival) => rival && rival.alive !== false);
        this.processRivalPressureOnPlayer();
    }

    getRivalCombatIntervention(monsterCount = 1) {
        const nearby = (this.rivalParties || [])
            .filter((r) => r && r.alive !== false && this.getDistance(r.x, r.y, this.player.x, this.player.y) <= 3);
        if (nearby.length === 0) return null;
        const rival = nearby[Math.floor(Math.random() * nearby.length)];
        if (!rival || Number(rival.combatCooldown || 0) > 0) return null;
        rival.combatCooldown = 4;

        if (Math.random() < Number(rival.helpBias || 0)) {
            const heal = 10 + Math.floor(Math.random() * 16);
            return {
                type: "assist",
                rivalName: rival.name,
                heal
            };
        }
        if (monsterCount > 1 && Math.random() < Number(rival.killStealBias || 0)) {
            return {
                type: "killsteal",
                rivalName: rival.name,
                removeCount: 1
            };
        }
        return null;
    }

    resolveChaserMonsterName(defaultPool = []) {
        const pool = Array.isArray(defaultPool) ? defaultPool : [];
        const keywords = ["기사", "근위", "헌터", "추격", "guardian", "knight"];
        const picked = pool.find((name) => keywords.some((kw) => String(name || "").toLowerCase().includes(String(kw).toLowerCase())));
        if (picked) return picked;
        return pool[0] || "종말의 기사";
    }

    movePlayerTactical(dx, dy) {
        const state = this.tacticalState;
        if (!state?.active) return false;
        if ((state.movePoints || 0) <= 0) {
            this.cb.logMessage("[전술] 이동 포인트가 없습니다. (Q: 턴 종료)");
            return false;
        }
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        if (newX < 0 || newY < 0 || newX >= this.currentMap.width || newY >= this.currentMap.height) return false;
        if (this.isWall(newX, newY)) return false;
        if (this.getMonsterAt(newX, newY)) {
            this.cb.logMessage("[전술] 적이 점유한 타일로 이동할 수 없습니다.");
            return false;
        }

        const key = tileKey(newX, newY);
        if (!state.moveTiles?.has(key)) {
            this.cb.logMessage("[전술] 현재 이동력으로 갈 수 없는 위치입니다.");
            return false;
        }

        this.player.x = newX;
        this.player.y = newY;
        state.movePoints = Math.max(0, Number(state.movePoints || 0) - 1);
        this.tickCorpses();
        this.updateVisibility();
        this.refreshTacticalOverlay();
        this.cb.updateExplorationUI(this);
        if ((state.movePoints || 0) <= 0 && (state.actionPoints || 0) <= 0) {
            this.endTacticalPlayerPhase();
        }
        return true;
    }

    movePlayer(dx, dy) {
        if (this.player.inCombat) return;
        if (this.isTacticalActive()) {
            this.movePlayerTactical(dx, dy);
            return;
        }

        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        if (newX < 0 || newX >= this.currentMap.width || newY < 0 || newY >= this.currentMap.height) {
            this.cb.logMessage("더 이상 나아갈 수 없습니다.");
            return;
        }

        if (this.collapse.active && !this.isInsideCollapseBarrier(newX, newY)) {
            this.cb.logMessage("차원 장막에 막혀 더 멀리 갈 수 없습니다.");
            return;
        }

        if (this.isWall(newX, newY)) {
            this.cb.logMessage("벽에 막혀있습니다.");
            return;
        }

        if (!this.canTraverseSeaTile(newX, newY)) {
            return;
        }

        const monster = this.getMonsterAt(newX, newY);
        if (monster) {
            this.cb.logMessage(`${monster.name}와(과) 마주쳤습니다!`);
            this.activeMonsters = this.activeMonsters.filter(m => m !== monster);
            this.player.startCombat(monster.name);
            return;
        }

        const moved = !(dx === 0 && dy === 0);
        this.player.x = newX;
        this.player.y = newY;

        if (moved && Number(this.player.currentLayer || 1) === 6 && this.isWaterTile(newX, newY)) {
            this.player.stamina = Math.max(0, Number(this.player.stamina || 0) - 2);
        }

        if (moved && typeof this.player.applyHungerFromMovement === 'function') {
            this.player.applyHungerFromMovement(1);
            this.player.checkBetrayal?.();
        } else if (!moved && typeof this.player.checkSatiety === 'function') {
            this.player.checkSatiety();
        }

        this.tickExplorationBuffs();
        this.tickExplorationAbilityCooldowns();
        this.tickGuidePathOverlay();
        this.applyPartyRolePassives(moved);
        this.tickCorpses();

        if (this.player?.livingWorld) {
            const eco = this.player.livingWorld.simulateTurn({
                currentLayer: this.player.currentLayer,
                localPredators: this.activeMonsters.length,
                localPrey: Math.max(0, (this.currentMap.monsterDensity || 0) - this.activeMonsters.length),
                corpseCount: (this.corpses || []).length
            });
            if (eco) {
                this.ecoSnapshot = eco;
                const baseRate = Number(this.currentMap.baseSpawnRate ?? this.currentMap.spawnRate ?? 0.005);
                this.currentMap.baseSpawnRate = baseRate;
                this.currentMap.spawnRate = Math.max(0.0008, baseRate * (1 + Number(eco.spawnBias || 0)));
            }
        }

        this.updateVisibility();

        const eventTriggered = this.checkEvents(newX, newY);
        if (!eventTriggered) {
            if (this.player.position === "Labyrinth") {
                const ambientTriggered = this.triggerAmbientLabyrinthEvent();
                if (!ambientTriggered) {
                    this.checkRandomEncounter();
                }
                this.checkRandomRiftEncounter();
            }
        }

        this.processMonsterTurn();
        this.processRivalParties();
        this.updateDimensionCollapseAfterMove();
        this.rollDimensionCollapseTrigger();

        this.cb.updateExplorationUI(this);
    }

    processMonsterTurn() {
        const px = this.player.x;
        const py = this.player.y;

        this.activeMonsters.forEach(mon => {
            const dist = this.getDistance(px, py, mon.x, mon.y);
            const corpseInfo = this.findNearestCorpse(mon.x, mon.y, 5);
            mon.aiState = this.player?.livingWorld?.decideMonsterState(mon, {
                playerDistance: dist,
                corpseDistance: corpseInfo?.distance ?? 999
            }) || (dist <= 5 ? "Battle" : "Patrol");

            if (mon.aiState === "Sleep") {
                mon.aggro = false;
                return;
            }

            if (mon.aiState === "Scavenge" && corpseInfo?.corpse) {
                mon.aggro = false;
                const dx = Math.sign(corpseInfo.corpse.x - mon.x);
                const dy = Math.sign(corpseInfo.corpse.y - mon.y);
                const nx = mon.x + (Math.abs(dx) >= Math.abs(dy) ? dx : 0);
                const ny = mon.y + (Math.abs(dy) > Math.abs(dx) ? dy : 0);
                if (!this.isBlocked(nx, ny) && !(nx === px && ny === py)) {
                    mon.x = nx;
                    mon.y = ny;
                }
                if (mon.x === corpseInfo.corpse.x && mon.y === corpseInfo.corpse.y) {
                    this.consumeCorpseAt(mon.x, mon.y, mon);
                }
                return;
            }

            if (dist <= 5 || mon.aiState === "Hungry" || mon.aiState === "Battle") {
                mon.aggro = true;
                const dx = Math.sign(px - mon.x);
                const dy = Math.sign(py - mon.y);
                let targetX = mon.x + (Math.abs(px - mon.x) >= Math.abs(py - mon.y) ? dx : 0);
                let targetY = mon.y + (Math.abs(px - mon.x) < Math.abs(py - mon.y) ? dy : 0);

                if (this.isBlocked(targetX, targetY)) {
                    if (targetX === mon.x) targetX += dx;
                    else targetY += dy;
                }

                if (!this.isBlocked(targetX, targetY)) {
                    if (targetX === px && targetY === py) {
                        this.cb.logMessage(`${mon.name}이(가) 기습했습니다!`);
                        this.activeMonsters = this.activeMonsters.filter(m => m !== mon);
                        this.player.startCombat(mon.name);
                        return;
                    }
                    mon.x = targetX;
                    mon.y = targetY;
                }
            } else {
                mon.aggro = false;
                if (Math.random() < 0.3) {
                    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
                    const nx = mon.x + dx;
                    const ny = mon.y + dy;
                    if (!this.isBlocked(nx, ny) && !(nx === px && ny === py)) {
                        mon.x = nx;
                        mon.y = ny;
                    }
                }
            }
        });
    }

    isBlocked(x, y) {
        if (x < 0 || x >= this.currentMap.width || y < 0 || y >= this.currentMap.height) return true;
        if (this.isWall(x, y)) return true;
        if (this.getMonsterAt(x, y)) return true;
        return false;
    }

    getMonsterAt(x, y) {
        return this.activeMonsters.find(m => m.x === x && m.y === y);
    }

    getDistance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    getCorpseAt(x, y) {
        return (this.corpses || []).find((c) => c.x === x && c.y === y) || null;
    }

    findNearestCorpse(x, y, maxDistance = 8) {
        let best = null;
        (this.corpses || []).forEach((corpse) => {
            const d = this.getDistance(x, y, corpse.x, corpse.y);
            if (d > maxDistance) return;
            if (!best || d < best.distance) {
                best = { corpse, distance: d };
            }
        });
        return best;
    }

    registerCorpse(monsterLike, x, y) {
        if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return null;
        const corpse = {
            id: `corpse_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
            name: monsterLike?.name || "시체",
            x: Number(x),
            y: Number(y),
            ttl: 12,
            maxTtl: 12,
            nutrition: Math.max(1, Math.floor(Number(monsterLike?.maxHp || 80) / 60))
        };
        this.corpses = this.corpses || [];
        this.corpses.push(corpse);
        this.player?.livingWorld?.onCorpseAdded?.(this.player.currentLayer, corpse.nutrition);
        return corpse;
    }

    tickCorpses() {
        const corpses = Array.isArray(this.corpses) ? this.corpses : [];
        if (corpses.length === 0) return;
        this.corpses = corpses.filter((corpse) => {
            corpse.ttl = Math.max(0, Number(corpse.ttl || 0) - 1);
            return corpse.ttl > 0;
        });
    }

    consumeCorpseAt(x, y, consumer = null) {
        if (!Array.isArray(this.corpses) || this.corpses.length === 0) return false;
        const idx = this.corpses.findIndex((corpse) => corpse.x === x && corpse.y === y);
        if (idx < 0) return false;
        const corpse = this.corpses[idx];
        this.corpses.splice(idx, 1);
        this.player?.livingWorld?.onCorpseConsumed?.(this.player.currentLayer, corpse.nutrition || 1);
        if (consumer) {
            const heal = Math.max(8, Math.floor((corpse.nutrition || 1) * 8));
            consumer.hp = Math.min(Number(consumer.maxHp || consumer.hp || 1), Number(consumer.hp || 1) + heal);
        }
        return true;
    }

    isTacticalActive() {
        return Boolean(this.tacticalState?.active);
    }

    getTacticalOverlayPayload() {
        return this.tacticalState || createTacticalState();
    }

    refreshTacticalOverlay() {
        if (!this.tacticalState?.active || !this.currentMap) return;
        const txState = this.tacticalState;
        txState.moveTiles = computeReachableTiles({
            width: this.currentMap.width,
            height: this.currentMap.height,
            startX: this.player.x,
            startY: this.player.y,
            movePoints: Math.max(0, Number(txState.movePoints || 0)),
            isBlocked: (x, y) => {
                if (x === this.player.x && y === this.player.y) return false;
                if (this.isWall(x, y)) return true;
                return Boolean(this.getMonsterAt(x, y));
            }
        });
        txState.attackTiles = computeRangeTiles({
            width: this.currentMap.width,
            height: this.currentMap.height,
            originX: this.player.x,
            originY: this.player.y,
            range: txState.attackRange || 3
        });

        const cover = new Set();
        (this.activeMonsters || []).forEach((monster) => {
            const los = this.evaluateTacticalLineOfSight(monster.x, monster.y);
            if (los.coverRate > 0) cover.add(tileKey(monster.x, monster.y));
        });
        txState.coverTiles = cover;
    }

    toggleTacticalMode(forceValue = null) {
        if (this.player.position !== "Labyrinth" || !this.currentMap) {
            this.cb.logMessage("전술 모드는 미궁 탐험 중에만 사용할 수 있습니다.");
            return false;
        }
        const nextActive = forceValue === null
            ? !this.tacticalState.active
            : Boolean(forceValue);

        if (nextActive) {
            this.tacticalState.active = true;
            this.tacticalState.phase = "player";
            this.tacticalState.maxMovePoints = 4;
            this.tacticalState.movePoints = 4;
            this.tacticalState.actionPoints = 1;
            this.tacticalState.attackRange = 3;
            this.refreshTacticalOverlay();
            this.cb.logMessage("[전술 모드] 격자 오버레이가 활성화되었습니다.");
        } else {
            this.tacticalState = createTacticalState();
            this.cb.logMessage("[전술 모드] 일반 탐험 모드로 복귀합니다.");
        }
        this.cb.updateExplorationUI(this);
        return nextActive;
    }

    evaluateTacticalLineOfSight(targetX, targetY) {
        return evaluateLineOfSight({
            fromX: this.player.x,
            fromY: this.player.y,
            toX: targetX,
            toY: targetY,
            isWall: (x, y) => this.isWall(x, y)
        });
    }

    performTacticalAttackAt(targetX, targetY) {
        if (!this.isTacticalActive()) return false;
        const txState = this.tacticalState;
        if ((txState.actionPoints || 0) <= 0) {
            this.cb.logMessage("[전술] 이번 턴에는 더 이상 행동할 수 없습니다.");
            return false;
        }

        const monster = this.getMonsterAt(targetX, targetY);
        if (!monster) {
            this.cb.logMessage("[전술] 공격 가능한 적이 없습니다.");
            return false;
        }
        const key = tileKey(targetX, targetY);
        if (!txState.attackTiles?.has(key)) {
            this.cb.logMessage("[전술] 사거리 밖의 대상입니다.");
            return false;
        }
        const los = this.evaluateTacticalLineOfSight(targetX, targetY);
        if (!los.hasLineOfSight) {
            this.cb.logMessage("[전술] 벽으로 시야가 차단되어 공격할 수 없습니다.");
            return false;
        }

        const base = 12 + Math.floor((this.player.currentStats?.["근력"] || 10) * 0.6);
        const coverPenalty = Math.floor(base * (los.coverRate || 0));
        const finalDamage = Math.max(1, base - coverPenalty);
        monster.hp = Math.max(0, Number(monster.hp || 1) - finalDamage);
        txState.actionPoints = Math.max(0, Number(txState.actionPoints || 0) - 1);
        this.cb.logMessage(`[전술] ${monster.name}에게 ${finalDamage} 피해${los.coverRate > 0 ? " (엄폐 적용)" : ""}`);

        if (monster.hp <= 0) {
            this.registerCorpse(monster, monster.x, monster.y);
            this.activeMonsters = this.activeMonsters.filter((m) => m !== monster);
            this.cb.logMessage(`[전술] ${monster.name} 처치.`);
        }

        this.endTacticalPlayerPhase();
        return true;
    }

    attackNearestTacticalTarget() {
        if (!this.isTacticalActive()) return false;
        const txState = this.tacticalState;
        const picked = pickNearestAttackableTarget({
            playerX: this.player.x,
            playerY: this.player.y,
            monsters: this.activeMonsters,
            attackRange: txState.attackRange || 3,
            hasRangeTile: (x, y) => txState.attackTiles?.has(tileKey(x, y)),
            evaluateLos: (x, y) => this.evaluateTacticalLineOfSight(x, y)
        });
        if (!picked?.monster) {
            this.cb.logMessage("[전술] 사거리/시야 내 대상이 없습니다.");
            return false;
        }
        return this.performTacticalAttackAt(picked.monster.x, picked.monster.y);
    }

    endTacticalPlayerPhase() {
        if (!this.isTacticalActive()) return;
        this.tacticalState.phase = "enemy";
        this.resolveTacticalEnemyPhase();
    }

    resolveTacticalEnemyPhase() {
        if (!this.isTacticalActive()) return;
        const px = this.player.x;
        const py = this.player.y;

        (this.activeMonsters || []).forEach((monster) => {
            const distance = this.getDistance(px, py, monster.x, monster.y);
            const corpseInfo = this.findNearestCorpse(monster.x, monster.y, 5);
            const decided = this.player.livingWorld?.decideMonsterState(monster, {
                playerDistance: distance,
                corpseDistance: corpseInfo?.distance ?? 999
            }) || (distance <= 5 ? "Battle" : "Patrol");
            monster.aiState = decided;

            if (monster.aiState === "Sleep") {
                return;
            }
            if (monster.aiState === "Scavenge" && corpseInfo?.corpse) {
                const stepX = Math.sign(corpseInfo.corpse.x - monster.x);
                const stepY = Math.sign(corpseInfo.corpse.y - monster.y);
                const nx = monster.x + (Math.abs(stepX) >= Math.abs(stepY) ? stepX : 0);
                const ny = monster.y + (Math.abs(stepY) > Math.abs(stepX) ? stepY : 0);
                if (!this.isBlocked(nx, ny) && !(nx === px && ny === py)) {
                    monster.x = nx;
                    monster.y = ny;
                }
                if (monster.x === corpseInfo.corpse.x && monster.y === corpseInfo.corpse.y) {
                    this.consumeCorpseAt(monster.x, monster.y, monster);
                }
                return;
            }

            if (distance <= 1) {
                const dmg = Math.max(4, Math.floor((Number(monster.maxHp || 40) / 16)));
                const finalDamage = this.applyExplorationDamage(dmg, { source: "tactical_counter", type: "physical" });
                this.cb.logMessage(`[전술] ${monster.name}의 반격! ${finalDamage} 피해`);
                return;
            }

            const dx = Math.sign(px - monster.x);
            const dy = Math.sign(py - monster.y);
            const nx = monster.x + (Math.abs(px - monster.x) >= Math.abs(py - monster.y) ? dx : 0);
            const ny = monster.y + (Math.abs(px - monster.x) < Math.abs(py - monster.y) ? dy : 0);
            if (!this.isBlocked(nx, ny) && !(nx === px && ny === py)) {
                monster.x = nx;
                monster.y = ny;
            }
        });

        this.tacticalState.phase = "player";
        this.tacticalState.movePoints = this.tacticalState.maxMovePoints;
        this.tacticalState.actionPoints = 1;
        this.refreshTacticalOverlay();
        this.cb.updateExplorationUI(this);
        this.player.showStatus?.();
    }

    getNearbyNpcFactions(radius = 5) {
        const events = this.currentMap?.fixedEvents || [];
        const factions = [];
        events.forEach((event) => {
            if (!event || event.type !== "NPC") return;
            const ex = Number(event.resolvedX);
            const ey = Number(event.resolvedY);
            if (!Number.isFinite(ex) || !Number.isFinite(ey)) return;
            if (this.getDistance(this.player.x, this.player.y, ex, ey) > radius) return;
            if (event.faction) factions.push(String(event.faction));
        });
        return [...new Set(factions)];
    }

    isInsideCollapseBarrier(x, y) {
        const d = Math.abs(x - this.collapse.anchorX) + Math.abs(y - this.collapse.anchorY);
        return d <= this.collapse.barrierRadius;
    }

    rollDimensionCollapseTrigger() {
        if (this.collapse.active || this.player.inCombat || this.player.position !== "Labyrinth") return;
        // 저층은 낮고 심층은 높은 확률
        const base = 0.0008 + (Math.max(1, Number(this.player.currentLayer)) * 0.00008);
        if (Math.random() < Math.min(0.004, base)) {
            this.startDimensionCollapse();
        }
    }

    startDimensionCollapse() {
        this.collapse.active = true;
        this.collapse.wave = 1;
        this.collapse.maxWaves = Math.floor(Math.random() * 9) + 7; // 7~15
        this.collapse.movesUntilShift = Math.floor(Math.random() * 5) + 5;
        this.collapse.intermissionMoves = 0;
        this.collapse.anchorX = this.player.x;
        this.collapse.anchorY = this.player.y;
        this.collapse.barrierRadius = 8;

        this.cb.logMessage("[차원붕괴] 공간이 찢어지기 시작합니다!");
        this.cb.logMessage(`[차원붕괴] 예측 웨이브: ${this.collapse.maxWaves} | 이동 제한 반경: ${this.collapse.barrierRadius}`);
    }

    endDimensionCollapse(log = true) {
        if (!this.collapse.active) return;
        this.collapse.active = false;
        this.collapse.wave = 0;
        this.collapse.maxWaves = 0;
        this.collapse.movesUntilShift = 0;
        this.collapse.intermissionMoves = 0;
        if (log) {
            this.cb.logMessage("[차원붕괴 종료] 공간 왜곡이 안정되었습니다.");
        }
    }

    updateDimensionCollapseAfterMove() {
        if (!this.collapse.active || this.player.inCombat) return;

        if (this.collapse.intermissionMoves > 0) {
            this.collapse.intermissionMoves -= 1;
            if (this.collapse.intermissionMoves === 0) {
                this.cb.logMessage(`[차원붕괴] 공백기가 끝났습니다. 다음 이동부터 ${this.collapse.wave}웨이브가 시작됩니다.`);
            }
            return;
        }

        this.collapse.movesUntilShift -= 1;
        if (this.collapse.movesUntilShift > 0) return;

        this.performCollapseShift();
    }

    performCollapseShift() {
        const newPos = this.getRandomFloorTile();
        this.player.x = newPos.x;
        this.player.y = newPos.y;
        this.collapse.anchorX = newPos.x;
        this.collapse.anchorY = newPos.y;
        this.collapse.movesUntilShift = Math.floor(Math.random() * 5) + 4;

        // 몬스터 재배치/증원
        const extra = 3 + Math.floor(this.collapse.wave / 2);
        this.spawnCollapseWaveMonsters(extra);

        // 환경 피해
        if (Math.random() < 0.35) {
            const dmg = 10 + this.collapse.wave * 2;
            const finalDamage = this.applyExplorationDamage(dmg, { source: "collapse_shift", type: "arcane" });
            this.player.cb?.logMessage(`[차원붕괴] 공간 파편에 휩쓸려 ${finalDamage} 피해를 입었습니다.`);
        }

        this.updateVisibility();
        this.cb.updateExplorationUI(this);
        this.player.showStatus?.();

        this.cb.logMessage(`[차원붕괴] ${this.collapse.wave}웨이브 이동 발생! 위치가 강제로 뒤틀렸습니다.`);
        this.collapse.wave += 1;

        if (this.collapse.wave > this.collapse.maxWaves) {
            this.endDimensionCollapse(true);
            return;
        }

        if (this.collapse.wave % 3 === 0) {
            this.collapse.intermissionMoves = 2 + Math.floor(Math.random() * 3);
            this.cb.logMessage(`[차원붕괴] 공백기 진입 (${this.collapse.intermissionMoves}턴).`);
        }
    }

    getCollapseMonsterPool() {
        const pools = [];
        const current = this.currentMap?.monsterTable || [];
        if (current.length) pools.push(...current);

        // 현재 층+상위층 몬스터를 섞어 난이도 상승
        const layerNum = Number(this.player.currentLayer) || 1;
        for (let l = layerNum; l <= Math.min(10, layerNum + 2); l++) {
            const m = this.gameData.layers?.[l]?.monsters || [];
            if (Array.isArray(m) && m.length) pools.push(...m);
        }
        if (pools.length === 0) pools.push("고블린");
        return [...new Set(pools)];
    }

    spawnCollapseWaveMonsters(extraCount) {
        const pool = this.getCollapseMonsterPool();
        for (let i = 0; i < extraCount; i++) {
            const pos = this.getRandomFloorTile();
            if (Math.abs(pos.x - this.player.x) + Math.abs(pos.y - this.player.y) < 3) continue;
            if (this.getMonsterAt(pos.x, pos.y)) continue;
            this.activeMonsters.push({
                id: `col_${Date.now()}_${i}`,
                name: pool[Math.floor(Math.random() * pool.length)],
                x: pos.x,
                y: pos.y,
                aggro: true
            });
        }
    }

    tickExplorationBuffs() {
        const buffs = this.player.explorationBuffs || (this.player.explorationBuffs = {});
        const ended = [];
        ["illumination", "reveal", "hunterSense"].forEach((key) => {
            if ((buffs[key] || 0) > 0) {
                buffs[key] -= 1;
                if (buffs[key] === 0) ended.push(key);
            }
        });

        if (ended.includes("illumination")) this.cb.logMessage("광휘 효과가 사라졌습니다.");
        if (ended.includes("reveal")) this.cb.logMessage("탐색 감응이 약해졌습니다.");
        if (ended.includes("hunterSense")) this.cb.logMessage("추적 감각이 안정화되었습니다.");
    }

    triggerAmbientLabyrinthEvent() {
        if (this.player.position !== "Labyrinth" || this.player.inCombat) return false;
        if (this.currentMap?.isRiftMap) return false;

        const layerNum = Math.max(1, Number(this.player.currentLayer) || 1);
        let chance = 0.16 + (layerNum * 0.009);
        if (this.collapse.active) chance += 0.03;
        const buffs = this.player.explorationBuffs || {};
        if ((buffs.hunterSense || 0) > 0) chance -= 0.015;
        chance = Math.min(0.34, Math.max(0.08, chance));
        if (Math.random() >= chance) return false;

        const eventRoll = Math.random();
        const regionalList = this.getMonsterTableForPosition(this.player.x, this.player.y);
        const monsterPool = regionalList.length > 0 ? regionalList : (this.currentMap.monsterTable || ["고블린"]);

        if (eventRoll < 0.18) {
            const squadNames = ["은빛 창 원정대", "검은닻 구조대", "황혼 정찰단", "붉은달 사냥단"];
            const picked = squadNames[Math.floor(Math.random() * squadNames.length)];
            if (Math.random() < 0.52) {
                const itemPool = ["건조 식량", "포션", "붕대", "횃불"];
                const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                this.player.addItem(item);
                this.cb.logMessage(`[현장 교신] ${picked}가 보급 상자를 전달했습니다. (${item})`);
            } else {
                const stoneGain = 60 + Math.floor(Math.random() * 141);
                this.player.magic_stones += stoneGain;
                this.cb.logMessage(`[현장 교신] ${picked}가 위험 구역 좌표를 공유했습니다. (마석 +${stoneGain})`);
            }
            this.player.showStatus?.();
            return true;
        }

        if (eventRoll < 0.44) {
            const groupSize = 2 + Math.floor(Math.random() * 3);
            const group = [];
            for (let i = 0; i < groupSize; i++) {
                group.push(monsterPool[Math.floor(Math.random() * monsterPool.length)]);
            }
            this.cb.logMessage(`[조우] 몬스터 무리(${groupSize}체)가 탐험로를 포위했습니다!`);
            this.player.startCombat(group);
            return true;
        }

        if (eventRoll < 0.66) {
            const hostile = Math.random() < 0.35;
            if (hostile) {
                const squadSize = 2 + Math.floor(Math.random() * 2);
                const duelGroup = [];
                for (let i = 0; i < squadSize; i++) {
                    duelGroup.push(monsterPool[Math.floor(Math.random() * monsterPool.length)]);
                }
                this.cb.logMessage(`[조우] 적대 탐험가 분대가 선공했습니다! (교전 ${squadSize}체)`);
                this.player.startCombat(duelGroup);
                return true;
            }

            const rewardRoll = Math.random();
            if (rewardRoll < 0.45) {
                this.player.gold += 300 + Math.floor(Math.random() * 801);
                this.cb.logMessage("[조우] 친절한 탐험가에게서 비상금을 지원받았습니다.");
            } else if (rewardRoll < 0.8) {
                const itemPool = ["건조 식량", "포션", "횃불", "마력결정체"];
                const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                this.player.addItem(item);
                this.cb.logMessage(`[조우] 다른 탐험가가 ${item}(을)를 건네주고 떠났습니다.`);
            } else {
                this.player.mp = Math.min(this.player.maxMp, this.player.mp + 20);
                this.cb.logMessage("[조우] 탐험가의 조언으로 이능 운용 효율이 잠시 상승합니다. (MP +20)");
            }
            this.player.showStatus?.();
            return true;
        }

        if (eventRoll < 0.84) {
            const cacheItemPool = ["식량", "모닥불 키트", "횃불", "붕대", "마나 포션"];
            const pick = cacheItemPool[Math.floor(Math.random() * cacheItemPool.length)];
            this.player.addItem(pick);
            this.cb.logMessage(`[필드 이벤트] 버려진 보급 상자를 발견했습니다. (${pick} 획득)`);
            if (Math.random() < 0.4) {
                const orePool = this.getOrePoolForLayer(layerNum);
                const ore = orePool[Math.floor(Math.random() * orePool.length)];
                this.player.inventory.push(ore);
                this.cb.logMessage(`[필드 이벤트] 보급 상자 아래에서 ${ore}을(를) 추가로 발견했습니다.`);
            }
            return true;
        }

        if (eventRoll < 0.93) {
            const hasRifts = Array.isArray(this.gameData.rifts?.[String(this.player.currentLayer)]) && this.gameData.rifts[String(this.player.currentLayer)].length > 0;
            if (hasRifts) {
                this.cb.logMessage("[필드 이벤트] 차원 흔들림이 감지됩니다. 근처에서 균열 반응이 강해졌습니다.");
                this.checkRandomRiftEncounter();
                return true;
            }
        }

        const trapDamage = 8 + Math.floor(Math.random() * (14 + layerNum * 2));
        const trapFinalDamage = this.applyExplorationDamage(trapDamage, { source: "ambient_trap", type: "arcane" });
        this.cb.logMessage(`[필드 이벤트] 원거리 마력포의 견제 사격! ${trapFinalDamage} 피해를 입었습니다.`);
        if (Math.random() < 0.35) this.player.applyDebuff?.("출혈");
        this.player.showStatus?.();
        return true;
    }

    checkRandomRiftEncounter() {
        if (this.player.position !== "Labyrinth") return;
        const rifts = this.gameData.rifts?.[String(this.player.currentLayer)] || [];
        if (!Array.isArray(rifts) || rifts.length === 0) return;
        if (Math.random() < 0.0025) {
            const rift = rifts[Math.floor(Math.random() * rifts.length)];
            this.cb.logMessage("[이상현상] 불안정한 균열이 눈앞에 열렸습니다.");
            this.cb.showRiftEntryModal(this.player, rift);
        }
    }

    hasPartyTrait(traitName) {
        const party = Array.isArray(this.player?.party) ? this.player.party : [];
        return party.some(member => String(member?.trait || "").trim() === traitName);
    }

    getPartyTraitCount(traitName) {
        const party = Array.isArray(this.player?.party) ? this.player.party : [];
        return party.filter(member => String(member?.trait || "").trim() === traitName).length;
    }

    getExplorationAbilityLabel(abilityKey) {
        const labels = {
            light: "주위 밝히기",
            sense: "정밀 탐지",
            rift: "균열 고정",
            terrain: "지형 공명",
            guide: "길잡이 예지",
            scout: "탐색꾼 수색"
        };
        return labels[abilityKey] || String(abilityKey || "이능");
    }

    getExplorationAbilityCooldownRemaining(abilityKey) {
        const key = String(abilityKey || "");
        if (!key) return 0;
        return Math.max(0, Number(this.explorationAbilityCooldowns?.[key] || 0));
    }

    getExplorationAbilityCooldown(ability) {
        const base = Math.max(1, Number(ability?.cooldown || 0));
        if (base <= 1) return 1;

        const mageCount = this.getPartyTraitCount("마법사");
        const traitControl = Math.max(0, Number(this.player.traitBonuses?.derived?.controlPower || 0));
        const mageReduction = Math.min(0.45, mageCount * 0.14);
        const traitReduction = Math.min(0.2, traitControl * 0.2);
        let finalCooldown = Math.ceil(base * (1 - mageReduction - traitReduction));

        if (ability?.key === "guide") {
            finalCooldown -= Math.min(1, this.getPartyTraitCount("인도자"));
        }
        if (ability?.key === "scout") {
            finalCooldown -= Math.min(1, this.getPartyTraitCount("탐색꾼"));
        }
        return Math.max(1, finalCooldown);
    }

    setExplorationAbilityCooldown(ability) {
        const key = String(ability?.key || "");
        if (!key) return 0;
        const cooldown = this.getExplorationAbilityCooldown(ability);
        this.explorationAbilityCooldowns = this.explorationAbilityCooldowns || {};
        this.explorationAbilityCooldowns[key] = Math.max(1, cooldown);
        return cooldown;
    }

    tickExplorationAbilityCooldowns() {
        if (!this.explorationAbilityCooldowns) this.explorationAbilityCooldowns = {};
        Object.keys(this.explorationAbilityCooldowns).forEach((key) => {
            const remain = Math.max(0, Number(this.explorationAbilityCooldowns[key] || 0) - 1);
            if (remain <= 0) {
                delete this.explorationAbilityCooldowns[key];
            } else {
                this.explorationAbilityCooldowns[key] = remain;
            }
        });
    }

    reduceExplorationAbilityCooldowns(amount = 1, preferredKey = null) {
        let remaining = Math.max(0, Math.floor(amount));
        if (remaining <= 0) return [];
        if (!this.explorationAbilityCooldowns) this.explorationAbilityCooldowns = {};

        const touched = new Set();
        while (remaining > 0) {
            let keyToReduce = null;
            if (preferredKey && this.getExplorationAbilityCooldownRemaining(preferredKey) > 0) {
                keyToReduce = preferredKey;
                preferredKey = null;
            } else {
                const candidates = Object.entries(this.explorationAbilityCooldowns)
                    .filter(([, value]) => Number(value) > 0)
                    .sort((a, b) => Number(b[1]) - Number(a[1]));
                if (candidates.length === 0) break;
                keyToReduce = candidates[0][0];
            }

            const next = Math.max(0, Number(this.explorationAbilityCooldowns[keyToReduce] || 0) - 1);
            if (next <= 0) delete this.explorationAbilityCooldowns[keyToReduce];
            else this.explorationAbilityCooldowns[keyToReduce] = next;

            touched.add(keyToReduce);
            remaining -= 1;
        }

        return [...touched];
    }

    clearGuidePathOverlay() {
        this.partyRoleState.guidePath = { tiles: [], ttl: 0, label: "" };
    }

    tickGuidePathOverlay() {
        const path = this.partyRoleState?.guidePath;
        if (!path || !Array.isArray(path.tiles) || path.tiles.length === 0) return;
        path.ttl = Math.max(0, Number(path.ttl || 0) - 1);
        if (path.ttl <= 0) {
            this.clearGuidePathOverlay();
        }
    }

    getGuidePathTiles() {
        const path = this.partyRoleState?.guidePath;
        if (!path || Number(path.ttl || 0) <= 0) return [];
        return Array.isArray(path.tiles) ? path.tiles : [];
    }

    setGuidePathOverlay(pathTiles = [], ttl = 0, label = "") {
        const normalized = Array.isArray(pathTiles)
            ? pathTiles.filter((tile) => Number.isFinite(tile?.x) && Number.isFinite(tile?.y))
            : [];
        if (normalized.length === 0 || ttl <= 0) {
            this.clearGuidePathOverlay();
            return;
        }
        this.partyRoleState.guidePath = {
            tiles: normalized,
            ttl: Math.max(1, Math.floor(ttl)),
            label: String(label || "")
        };
    }

    applyGuidePathVisibility() {
        const tiles = this.getGuidePathTiles();
        if (!tiles.length || !Array.isArray(this.visibleTiles) || !Array.isArray(this.visitedTiles)) return;
        const guideCount = this.getPartyTraitCount("인도자");
        const revealLimit = Math.max(8, 14 + (guideCount * 4));
        const slice = tiles.slice(0, revealLimit);

        slice.forEach((tile) => {
            const x = tile.x;
            const y = tile.y;
            if (x < 0 || y < 0 || y >= this.visibleTiles.length || x >= (this.visibleTiles[0]?.length || 0)) return;
            this.visibleTiles[y][x] = true;
            this.visitedTiles[y][x] = true;
        });
    }

    findNearestPathToFixedEvent(matchFn, maxDistance = Infinity) {
        if (!this.currentMap?.fixedEvents || typeof matchFn !== "function") return null;
        const width = Number(this.currentMap.width || 0);
        const height = Number(this.currentMap.height || 0);
        if (width <= 0 || height <= 0) return null;

        const startX = this.player.x;
        const startY = this.player.y;
        if (startX < 0 || startY < 0 || startX >= width || startY >= height) return null;

        const eventsByCoord = new Map();
        this.currentMap.fixedEvents.forEach((event) => {
            if (!event || !Number.isFinite(event.resolvedX) || !Number.isFinite(event.resolvedY)) return;
            if (!matchFn(event)) return;
            const x = event.resolvedX;
            const y = event.resolvedY;
            if (x < 0 || y < 0 || x >= width || y >= height) return;
            const key = `${x},${y}`;
            if (!eventsByCoord.has(key)) eventsByCoord.set(key, []);
            eventsByCoord.get(key).push(event);
        });
        if (eventsByCoord.size === 0) return null;

        const startKey = `${startX},${startY}`;
        if (eventsByCoord.has(startKey)) {
            return { event: eventsByCoord.get(startKey)[0], distance: 0, path: [] };
        }

        const visited = Array.from({ length: height }, () => Array(width).fill(false));
        const queue = [{ x: startX, y: startY, d: 0 }];
        const parent = new Map();
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        visited[startY][startX] = true;

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) break;
            if (current.d >= maxDistance) continue;

            for (const [dx, dy] of dirs) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                if (visited[ny][nx]) continue;
                if (this.isWall(nx, ny)) continue;

                const nextDistance = current.d + 1;
                if (nextDistance > maxDistance) continue;
                visited[ny][nx] = true;

                const key = `${nx},${ny}`;
                parent.set(key, `${current.x},${current.y}`);

                if (eventsByCoord.has(key)) {
                    const path = [];
                    let traceKey = key;
                    while (traceKey && traceKey !== startKey) {
                        const [tx, ty] = traceKey.split(",").map(Number);
                        path.push({ x: tx, y: ty });
                        traceKey = parent.get(traceKey);
                    }
                    path.reverse();
                    return {
                        event: eventsByCoord.get(key)[0],
                        distance: path.length,
                        path
                    };
                }

                queue.push({ x: nx, y: ny, d: nextDistance });
            }
        }

        return null;
    }

    findNearestFixedEvent(matchFn, maxDistance = Infinity) {
        if (!this.currentMap?.fixedEvents || typeof matchFn !== "function") return null;
        const px = this.player.x;
        const py = this.player.y;
        let best = null;

        this.currentMap.fixedEvents.forEach((event) => {
            if (!event || !Number.isFinite(event.resolvedX) || !Number.isFinite(event.resolvedY)) return;
            if (!matchFn(event)) return;
            const distance = Math.abs(event.resolvedX - px) + Math.abs(event.resolvedY - py);
            if (distance > maxDistance) return;
            if (!best || distance < best.distance) {
                best = { event, distance };
            }
        });

        return best;
    }

    getDirectionLabelTo(targetX, targetY) {
        const dx = targetX - this.player.x;
        const dy = targetY - this.player.y;
        if (dx === 0 && dy === 0) return "현재 위치";

        const vertical = dy < 0 ? "북" : (dy > 0 ? "남" : "");
        const horizontal = dx < 0 ? "서" : (dx > 0 ? "동" : "");
        return `${vertical}${horizontal}` || "현재 위치";
    }

    getPortalDirectionHint(maxDistance = 999) {
        const pathHint = this.findNearestPathToFixedEvent(
            event => event.type === "PORTAL" || event.type === "RIFT_EXIT" || event.type === "RIFT",
            maxDistance
        );
        if (pathHint) {
            const { event, distance, path } = pathHint;
            return {
                event,
                distance,
                path: Array.isArray(path) ? path : [],
                direction: this.getDirectionLabelTo(event.resolvedX, event.resolvedY)
            };
        }

        const nearest = this.findNearestFixedEvent(
            event => event.type === "PORTAL" || event.type === "RIFT_EXIT" || event.type === "RIFT",
            maxDistance
        );
        if (!nearest) return null;
        const { event, distance } = nearest;
        return {
            event,
            distance,
            path: [],
            direction: this.getDirectionLabelTo(event.resolvedX, event.resolvedY)
        };
    }

    applyPartyRolePassives(moved = true) {
        if (!moved || this.player.inCombat || !this.currentMap || this.player.position !== "Labyrinth") return;
        const buffs = this.player.explorationBuffs || (this.player.explorationBuffs = {});

        const scoutCount = this.getPartyTraitCount("탐색꾼");
        const mageCount = this.getPartyTraitCount("마법사");
        const priestCount = this.getPartyTraitCount("신관");
        const warriorCount = this.getPartyTraitCount("전사");

        if (scoutCount > 0) {
            this.player.rareDropTracker = this.player.rareDropTracker || {};
            const revealRadius = 5 + Math.min(4, scoutCount);
            const revealed = this.revealNearbyHiddenRelics(revealRadius, "(탐색꾼 추적)");
            if (revealed > 0) {
                this.player.rareDropTracker.scoutInsight = Math.min(12, Number(this.player.rareDropTracker.scoutInsight || 0) + 1);
                this.cb.logMessage(`[파티-탐색꾼] 은폐 흔적 ${revealed}개를 추가 탐지했습니다.`);
            }

            const itemFindChance = Math.min(0.2, 0.04 + scoutCount * 0.02);
            if (Math.random() < itemFindChance) {
                const scoutItemPool = ["건조 식량", "포션", "횃불", "붕대", "해독제"];
                const found = scoutItemPool[Math.floor(Math.random() * scoutItemPool.length)];
                this.player.addItem(found);
                this.player.rareDropTracker.scoutInsight = Math.min(12, Number(this.player.rareDropTracker.scoutInsight || 0) + 1);
                this.cb.logMessage(`[파티-탐색꾼] 주변 잔해에서 ${found}(을)를 찾아냈습니다.`);
                this.player.showStatus?.();
            }
        }

        if (mageCount > 0) {
            this.partyRoleState.magePulseCounter += 1;
            const threshold = Math.max(2, 7 - Math.min(4, mageCount));
            if (this.partyRoleState.magePulseCounter >= threshold) {
                this.partyRoleState.magePulseCounter = 0;
                const regen = 2 + mageCount;
                this.player.mp = Math.min(this.player.maxMp, this.player.mp + regen);
                buffs.illumination = Math.max(buffs.illumination || 0, 4);
                const cooled = this.reduceExplorationAbilityCooldowns(1 + Math.floor(mageCount / 2));
                if (cooled.length > 0) {
                    const labels = cooled.map((key) => this.getExplorationAbilityLabel(key)).join(", ");
                    this.cb.logMessage(`[파티-마법사] 마력 진동이 이능의 재사용 대기시간을 단축합니다. (${labels})`);
                }
                this.cb.logMessage(`[파티-마법사] 마력 진동을 안정화합니다. (MP +${regen})`);
                this.player.showStatus?.();
            }
        }

        if (priestCount > 0 && Array.isArray(this.player.debuffs) && this.player.debuffs.length > 0) {
            const cleanseChance = Math.min(0.3, 0.08 + priestCount * 0.05);
            if (Math.random() < cleanseChance) {
                const before = this.player.debuffs.length;
                this.player.debuffs = this.player.debuffs.filter((debuff) => {
                    return !/출혈|독|화상|저체온증|감전|기절|혼란/.test(String(debuff || ""));
                });
                if (this.player.debuffs.length < before) {
                    this.cb.logMessage("[파티-신관] 정화 기도로 상태 이상이 완화되었습니다.");
                    this.player.showStatus?.();
                }
            }
        }

        if (warriorCount > 0) {
            const suppressChance = Math.min(0.2, 0.04 + warriorCount * 0.03);
            if (Math.random() < suppressChance) {
                const nearby = this.activeMonsters.find((monster) =>
                    Math.abs(monster.x - this.player.x) + Math.abs(monster.y - this.player.y) <= 2
                );
                if (nearby) {
                    nearby.aggro = false;
                    this.cb.logMessage("[파티-전사] 위압으로 주변 몬스터의 움직임을 잠시 꺾었습니다.");
                }
            }
        }
    }

    getExplorationAbilityList() {
        const abilities = [];
        if (this.hasLightAptitude()) {
            abilities.push({ key: "light", label: "주위 밝히기", cost: 14, cooldown: 7, desc: "광휘를 확장해 시야를 크게 늘립니다." });
        }
        if (this.hasSenseAptitude()) {
            abilities.push({ key: "sense", label: "정밀 탐지", cost: 12, cooldown: 6, desc: "은폐 흔적과 함정 신호를 추적합니다." });
        }
        if (this.hasRiftAptitude()) {
            abilities.push({ key: "rift", label: "균열 고정", cost: 18, cooldown: 9, desc: "균열/붕괴 노이즈를 안정화합니다." });
        }
        if (this.hasTerrainAptitude()) {
            abilities.push({ key: "terrain", label: "지형 공명", cost: 15, cooldown: 7, desc: "지형의 결을 읽어 숨은 흔적을 해독합니다." });
        }

        if (this.hasPartyTrait("인도자")) {
            abilities.push({ key: "guide", label: "길잡이 예지", cost: 10, cooldown: 5, desc: "가장 가까운 차원 비석까지의 최단 경로를 지도에 표시합니다." });
        }
        if (this.hasPartyTrait("탐색꾼")) {
            abilities.push({ key: "scout", label: "탐색꾼 수색", cost: 9, cooldown: 6, desc: "보급품을 수색하고 희귀 드랍 추적 감각을 강화합니다." });
        }

        return abilities.map((ability) => ({
            ...ability,
            finalCost: this.getExplorationAbilityCost(ability),
            finalCooldown: this.getExplorationAbilityCooldown(ability),
            remainingCooldown: this.getExplorationAbilityCooldownRemaining(ability.key)
        }));
    }

    getExplorationAbilityCost(ability) {
        const base = Math.max(1, Number(ability?.cost || 0));
        const mageCount = this.getPartyTraitCount("마법사");
        const partyReduction = Math.min(0.35, mageCount * 0.05);
        const traitControl = Math.max(0, Number(this.player.traitBonuses?.derived?.controlPower || 0));
        const traitReduction = Math.min(0.25, traitControl * 0.35);
        const finalRate = Math.max(0.45, 1 - partyReduction - traitReduction);
        return Math.max(1, Math.floor(base * finalRate));
    }

    hasExplorationKeyword(keywords = []) {
        const names = [
            ...(this.player.essences || []),
            ...(this.player.essence_skills || []),
            ...(this.player.spells || [])
        ].map(v => String(v || ""));
        return names.some(name => keywords.some(keyword => name.includes(keyword)));
    }

    hasLightAptitude() {
        if (this.player.equippedTorch) return true;
        if ((this.player.explorationBuffs?.illumination || 0) > 0) return true;
        return this.hasExplorationKeyword(["빛", "광", "램프", "드라이즌", "원시 정령", "라망시스", "루멘"]);
    }

    hasSenseAptitude() {
        return this.hasExplorationKeyword(["추적", "탐색", "감지", "정찰", "체온색적", "수호자의 눈", "육감"]);
    }

    hasRiftAptitude() {
        return this.hasExplorationKeyword(["차원", "균열", "공허", "토성체", "정박"]);
    }

    hasTerrainAptitude() {
        return this.hasExplorationKeyword(["대지", "뿌리", "석화", "숲", "지형"]);
    }

    canSolveHiddenRequirement(requiredAbility) {
        switch (requiredAbility) {
            case "light":
                return this.hasLightAptitude();
            case "sense":
                return this.hasSenseAptitude();
            case "rift":
                return this.hasRiftAptitude();
            case "terrain":
                return this.hasTerrainAptitude();
            default:
                return true;
        }
    }

    getHiddenPiecePuzzleConfig(layer = this.player?.currentLayer || 1) {
        if (!this.currentMap) return null;
        const layerNum = Math.max(1, Number(layer || 1));
        const reqItems = ["정화의 횃불", "성수", "마력결정체", "감정 스크롤", "붕대"];
        const requiredItem = reqItems[layerNum % reqItems.length];
        const widthRange = Math.max(3, this.currentMap.width - 4);
        const heightRange = Math.max(3, this.currentMap.height - 4);
        const seedX = 2 + ((layerNum * 17) % widthRange);
        const seedY = 2 + ((layerNum * 23) % heightRange);
        const nearest = this.findNearestFloor(seedX, seedY);
        return {
            layer: layerNum,
            requiredItem,
            x: nearest.x,
            y: nearest.y
        };
    }

    tryResolveHiddenPieceByItem(itemName) {
        if (!itemName || this.player?.position !== "Labyrinth" || !this.currentMap) return { resolved: false };
        const cfg = this.getHiddenPiecePuzzleConfig(this.player.currentLayer);
        if (!cfg) return { resolved: false };

        this.player.hiddenPieceState = this.player.hiddenPieceState || {};
        const solvedKey = `L${cfg.layer}`;
        if (this.player.hiddenPieceState[solvedKey]) return { resolved: false };
        if (this.player.x !== cfg.x || this.player.y !== cfg.y) return { resolved: false };
        if (itemName !== cfg.requiredItem) return { resolved: false };

        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const wallTarget = dirs
            .map(([dx, dy]) => ({ x: cfg.x + dx, y: cfg.y + dy, dx, dy }))
            .find((pos) =>
                pos.x >= 1 &&
                pos.y >= 1 &&
                pos.x < this.currentMap.width - 1 &&
                pos.y < this.currentMap.height - 1 &&
                this.isWall(pos.x, pos.y)
            );
        if (!wallTarget) return { resolved: false };

        this.currentMap.grid[wallTarget.y][wallTarget.x] = 1;
        const deeperX = wallTarget.x + wallTarget.dx;
        const deeperY = wallTarget.y + wallTarget.dy;
        if (
            deeperX >= 1 &&
            deeperY >= 1 &&
            deeperX < this.currentMap.width - 1 &&
            deeperY < this.currentMap.height - 1
        ) {
            this.currentMap.grid[deeperY][deeperX] = 1;
        }

        const stashPool = ["감정 스크롤", "건조 식량", "마력결정체", "포션", "균열석"];
        const reward = stashPool[Math.floor(Math.random() * stashPool.length)];
        this.player.addItem(reward);
        const stoneBonus = 120 + Math.floor(Math.random() * 220);
        this.player.magic_stones += stoneBonus;
        this.player.hiddenPieceState[solvedKey] = true;

        this.cb.logMessage(`[히든 피스] 벽면 장치가 반응해 비밀 통로가 열렸습니다. (${reward}, 마석 +${stoneBonus})`);
        this.updateVisibility();
        this.cb.updateExplorationUI(this);
        return { resolved: true, consume: true };
    }

    revealNearbyHiddenRelics(radius = 4, reason = "") {
        if (!this.currentMap?.fixedEvents) return 0;
        const px = this.player.x;
        const py = this.player.y;
        let revealedCount = 0;
        this.currentMap.fixedEvents.forEach((event) => {
            if (event.type !== "HIDDEN_RELIC" || !event.hidden || event.discovered) return;
            const dist = Math.abs(px - event.resolvedX) + Math.abs(py - event.resolvedY);
            if (dist <= radius) {
                event.discovered = true;
                revealedCount += 1;
                this.cb.logMessage(`[탐색] 숨겨진 히든 피스를 발견했습니다. ${reason}`.trim());
            }
        });
        return revealedCount;
    }

    updateVisibility() {
        const layerNum = Math.max(1, Number(this.player.currentLayer || this.currentMap?.id || 1));
        const sight = this.player.currentStats?.["시각"] || 0;
        const awareness = this.player.currentStats?.["인지력"] || 0;
        const buffs = this.player.explorationBuffs || {};
        const scoutBonus = this.getPartyTraitCount("탐색꾼");
        const px = this.player.x;
        const py = this.player.y;
        const passiveRevealRadius = (buffs.reveal || 0) > 0 ? 16 : ((buffs.hunterSense || 0) > 0 ? 10 : 4);

        if (layerNum >= 2) {
            this.fullVisibilityActive = true;
            const visibilityKey = `${this.player.currentMapId || layerNum}:${this.currentMap?.width || 0}x${this.currentMap?.height || 0}`;
            if (this._fullVisibilityKey !== visibilityKey) {
                for (let y = 0; y < this.currentMap.height; y++) {
                    for (let x = 0; x < this.currentMap.width; x++) {
                        this.visibleTiles[y][x] = true;
                        this.visitedTiles[y][x] = true;
                    }
                }
                this._fullVisibilityKey = visibilityKey;
            } else if (this.visibleTiles?.[py]?.[px] !== undefined) {
                this.visibleTiles[py][px] = true;
                this.visitedTiles[py][px] = true;
            }
            this.applyGuidePathVisibility();
            this.revealNearbyHiddenRelics(passiveRevealRadius);
            return;
        }

        this.fullVisibilityActive = false;
        let radius = Math.max(2, Math.min(6, 2 + Math.floor((sight + awareness) / 80)));
        radius += Math.min(1, scoutBonus);
        if (this.player.equippedTorch) radius += 3;
        if ((buffs.illumination || 0) > 0) radius += 4;
        if (this.hasLightAptitude()) radius += 1;
        radius = Math.max(2, Math.min(12, radius));
        this.visibleTiles = this.visibleTiles.map(row => row.fill(false));

        for (let y = py - radius; y <= py + radius; y++) {
            for (let x = px - radius; x <= px + radius; x++) {
                if (x >= 0 && x < this.currentMap.width && y >= 0 && y < this.currentMap.height) {
                    this.visibleTiles[y][x] = true;
                    this.visitedTiles[y][x] = true;
                }
            }
        }

        // 횃불 반경 시야(반경 9칸)
        const torchKey = `layer_${this.player.currentLayer}`;
        const torches = this.player.torches?.[torchKey] || [];
        const torchRadius = 9;
        torches.forEach(t => {
            for (let y = t.y - torchRadius; y <= t.y + torchRadius; y++) {
                for (let x = t.x - torchRadius; x <= t.x + torchRadius; x++) {
                    if (x >= 0 && x < this.currentMap.width && y >= 0 && y < this.currentMap.height) {
                        const dist = Math.abs(t.x - x) + Math.abs(t.y - y);
                        if (dist <= torchRadius) {
                            this.visibleTiles[y][x] = true;
                            this.visitedTiles[y][x] = true;
                        }
                    }
                }
            }
        });

        this.applyGuidePathVisibility();
        this.revealNearbyHiddenRelics(passiveRevealRadius);
    }

    checkEvents(x, y) {
        // [신규] 베이스캠프 체크
        if (this.currentMap.grid[y][x] === 10) { 
             const campfireKey = `layer_${this.player.currentLayer}`;
             const installedCampfire = this.player.campfires?.[campfireKey];
             if (installedCampfire && installedCampfire.x === x && installedCampfire.y === y) {
                 this.cb.showInteractionPrompt({ desc: "[모닥불] 휴식/회수가 가능합니다." });
             } else {
                 this.cb.showInteractionPrompt({ desc: "베이스캠프입니다. 안전하게 휴식할 수 있습니다." });
             }
             return true;
        }

        const rival = this.getRivalAt(x, y);
        if (rival) {
            const roleLabel = rival.role === "cooperative" ? "협력형" : (rival.role === "opportunist" ? "기회주의" : "약탈형");
            const teamSize = Math.max(1, Number(rival.teamSize || 1));
            this.cb.showInteractionPrompt({ desc: `[경쟁자] ${rival.name} (${roleLabel}, ${teamSize}인 팀) - 접근 가능` });
            return true;
        }

        // [수정] 고정된 좌표(resolvedX/Y)와 비교
        const events = this.currentMap.fixedEvents || [];
        const event = events.find(e => e.resolvedX === x && e.resolvedY === y);

        if (event) {
            if (event.type === "HIDDEN_RELIC" && event.hidden && !event.discovered) {
                this.cb.hideInteractionPrompt();
                return false;
            }

            if (event.type === "RIFT_STAGE") {
                const stage = this.player.currentRift?.stages?.[event.stageIndex];
                const stageName = stage?.name || event.desc || "균열 단계";
                if (this.isRiftStageCleared(event.stageIndex)) {
                    this.cb.showInteractionPrompt({ desc: `[완료] ${stageName}` });
                } else {
                    const nextStage = this.getNextRiftStageIndex();
                    if (nextStage !== null && nextStage !== event.stageIndex) {
                        const requiredName = this.player.currentRift?.stages?.[nextStage]?.name || `단계 ${nextStage + 1}`;
                        this.cb.showInteractionPrompt({ desc: `[잠김] 먼저 ${requiredName}을(를) 공략해야 합니다.` });
                    } else {
                        this.cb.showInteractionPrompt({ desc: `[도전] ${stageName}` });
                    }
                }
            } else if (event.type === "RIFT_EXIT") {
                if (this.areAllRiftStagesCleared()) {
                    this.cb.showInteractionPrompt({ desc: "균열 출구가 안정화되었습니다. 상호작용으로 이동 가능합니다." });
                } else {
                    const total = this.player.currentRift?.stages?.length || 0;
                    const cleared = this.getRiftProgressState()?.clearedStages?.length || 0;
                    this.cb.showInteractionPrompt({ desc: `균열 정복 진행도 ${cleared}/${total}` });
                }
            } else if (event.type === "RIFT_FORTUNE") {
                this.cb.showInteractionPrompt({ desc: "[균열 기연] 차원 잔상이 공명하고 있습니다." });
            } else if (event.type === "TURRET") {
                this.cb.showInteractionPrompt({ desc: "[포탑] 자동 조준 중입니다. 상호작용으로 해제/회피 시도 가능" });
            } else if (event.type === "RIFT_TURRET") {
                this.cb.showInteractionPrompt({ desc: "[균열 포탑] 강력한 마력 방어장치가 활성화되어 있습니다." });
            } else if (event.type === "HIDDEN_RELIC") {
                const required = event.requiredAbility || "none";
                const reqLabelMap = { light: "광원/빛 이능", sense: "탐지 이능", rift: "균열 이능", terrain: "지형 이능" };
                const reqLabel = reqLabelMap[required] || "특수 능력";
                const solvable = this.canSolveHiddenRequirement(required);
                this.cb.showInteractionPrompt({ desc: solvable ? "[히든 피스] 봉인 해제 가능" : `[히든 피스] ${reqLabel}이 필요합니다.` });
            } else if (event.type === "ORE_VEIN") {
                const remain = Math.max(0, Number(event.charges || 0));
                this.cb.showInteractionPrompt({ desc: `[광맥] ${event.oreType || "미상 광석"} 채굴 가능 (잔여 ${remain}회)` });
            } else if (event.type === "Start") {
                this.cb.showInteractionPrompt({ desc: "[시작 지점] 경로 재정비가 가능합니다." });
            } else if (event.type === "MONUMENT") {
                this.cb.showInteractionPrompt({ desc: `[차원 비석] ${event.desc || "고대 비석이 진동하고 있습니다."}` });
            } else if (event.type === "CURIO") {
                this.cb.showInteractionPrompt({ desc: "[기연] 조사 가능한 오브젝트입니다." });
            } else if (event.type === "RIFT") {
                this.cb.showInteractionPrompt({ desc: "[균열] 진입 가능한 균열 포탈입니다." });
            } else if (event.type === "EVENT") {
                const descByKind = {
                    dynamic: "[현장 이벤트] 수상한 흔적이 남아 있습니다.",
                    fortune: "[기연] 희귀한 기회가 감지됩니다.",
                    traveler: "[현장 조우] 탐험 흔적이 남아 있습니다.",
                    hazard: "[경고] 마력 함정 반응이 감지됩니다.",
                    ambush: "[경계] 매복 신호가 포착됩니다.",
                    artifact: "[이상 신호] 고대 물체가 공명합니다.",
                    settings: "[특수 이벤트] 설정 기반 이상현상이 감지됩니다."
                };
                const settingsDesc = event.eventKind === "settings" ? (event.settingsEvent?.desc || event.desc || descByKind.settings) : null;
                this.cb.showInteractionPrompt({ desc: settingsDesc || descByKind[event.eventKind] || descByKind.dynamic });
            } else if (event.type === "NPC") {
                const npcName = event.npcName || "미상의 탐험가";
                const role = event.role || "중립";
                this.cb.showInteractionPrompt({ desc: `[NPC] ${npcName} (${role}) - 상호작용 가능` });
            } else {
                this.cb.showInteractionPrompt(event);
            }
            return true;
        }
        this.cb.hideInteractionPrompt();
        return false;
    }

    checkRandomEncounter() {
        let rate = this.currentMap.spawnRate || 0.005; 
        if (rate <= 0) return;

        // 스탯/종족 기반 조우율 보정
        const hearing = this.player.currentStats?.["청각"] || 0;
        const instinct = this.player.currentStats?.["육감"] || 0;
        const stealthBonus = Math.min(0.35, (hearing + instinct) / 2000);
        rate = Math.max(0.001, rate * (1 - stealthBonus));
        if (this.hasPartyTrait("탐색꾼")) rate *= 0.88;
        if (this.hasPartyTrait("인도자")) rate *= 0.92;
        if (this.hasPartyTrait("전사")) rate *= 0.95;
        if (Number(this.player.currentLayer || 0) === 6 && this.hasPartyTrait("항해사")) rate *= 0.78;
        if (this.player.isRace?.("beastkin")) {
            rate *= 0.85;
        }
        if (this.collapse.active) {
            rate *= 2.8;
        }

        if (Math.random() < rate) {
            const regionalList = this.getMonsterTableForPosition(this.player.x, this.player.y);
            const collapsePool = this.collapse.active ? this.getCollapseMonsterPool() : [];
            const monsterList = collapsePool.length > 0
                ? collapsePool
                : (regionalList.length > 0 ? regionalList : (this.currentMap.monsterTable || ["고블린"]));
            const monsterName = monsterList[Math.floor(Math.random() * monsterList.length)];
            this.cb.logMessage(`어둠 속에서 갑자기 ${monsterName}이(가) 덮쳐왔습니다!`);
            this.player.startCombat(monsterName); 
        }
    }

    interact() {
        if (this.isTacticalActive()) {
            this.attackNearestTacticalTarget();
            return;
        }
        const x = this.player.x;
        const y = this.player.y;
        const layer = this.player.currentLayer;
        const rival = this.getRivalAt(x, y);
        const events = this.currentMap.fixedEvents || [];
        const event = events.find(e => e.resolvedX === x && e.resolvedY === y);
        
        // [신규] 설치 모닥불 확인
        const campfireKey = `layer_${layer}`;
        const installedCampfire = this.player.campfires?.[campfireKey];
        if (installedCampfire && installedCampfire.x === x && installedCampfire.y === y) {
            const recover = confirm("모닥불입니다. 회수하시겠습니까?\n취소를 누르면 휴식합니다.");
            if (recover) this.recoverCampfireAtCurrentTile();
            else this.restAtCampfire();
            return;
        }

        // [신규] 베이스캠프 휴식
        if (this.currentMap.grid[y][x] === 10) {
            if (confirm("베이스캠프에서 휴식을 취하시겠습니까? (파티 전원 HP/MP/기력 완전 회복, 식량 1 소모)")) {
                if (this.player.inventory.includes("식량")) {
                    const idx = this.player.inventory.indexOf("식량");
                    this.player.inventory.splice(idx, 1);

                    this.restorePartyVitalsFull();
                    this.player.satiety = Math.min(100, (this.player.satiety || 0) + 20);
                    this.player.advanceWorldTime?.(8, "베이스캠프 휴식");
                    this.cb.logMessage("베이스캠프에서 따뜻한 식사를 하고 푹 쉬었습니다. (상태 완전 회복)");
                    this.player.showStatus();
                } else {
                    this.cb.logMessage("식량이 부족하여 제대로 휴식할 수 없습니다.");
                }
            }
            return;
        }

        if (rival) {
            const teamSize = Math.max(1, Number(rival.teamSize || 1));
            const duelChoice = confirm(`[경쟁 탐험가] ${rival.name}과(와) 결투를 시작하시겠습니까?\n확인: 결투 시작 / 취소: 교섭 시도`);
            if (duelChoice) {
                this.startRivalExplorerCombat(rival);
                return;
            }

            const truthShieldActive = Number(this.player?.deceptionShieldUntil || 0) > Number(this.player?.worldTimeHours || 0);
            if (truthShieldActive) {
                this.cb.logMessage(`[어긋난 신뢰] ${rival.name}의 협박/사기가 차단되었습니다.`);
                this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 눈치를 보고 물러납니다.`);
                this.player.showStatus?.();
                return;
            }

            const hpRate = Number(this.player.hp || 0) / Math.max(1, Number(this.player.maxHp || 1));
            if (hpRate <= 0.2 && Math.random() < Number((rival.tollBias || 0) + 0.1)) {
                const toll = 180 + Math.floor(Math.random() * 220);
                if (Number(this.player.gold || 0) >= toll) {
                    this.player.gold -= toll;
                    this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 통행료 ${toll} 스톤을 요구했습니다. 거절할 여력이 없어 지불했습니다.`);
                } else {
                    this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 빈사 상태를 비웃고 지나갔습니다.`);
                }
                this.player.showStatus?.();
                return;
            }

            if (rival.role === "cooperative" && Math.random() < 0.58) {
                const heal = Math.max(12, Math.floor(this.player.maxHp * 0.12));
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
                this.cb.logMessage(`[경쟁자] ${rival.name} (${teamSize}인 팀)이 응급 처치를 해주었습니다. (HP +${heal})`);
            } else if (rival.role === "opportunist" && Math.random() < 0.5) {
                const offerCost = 120 + Math.floor(Math.random() * 140);
                if (confirm(`[${rival.name}] 건조 식량을 ${offerCost} 스톤에 판매하겠다고 제안합니다. 구매하시겠습니까?`)) {
                    if (this.player.gold >= offerCost) {
                        this.player.gold -= offerCost;
                        this.player.addItem("건조 식량");
                        this.cb.logMessage(`[경쟁자 거래] 건조 식량을 구매했습니다. (${offerCost} 스톤)`);
                    } else {
                        this.cb.logMessage("스톤이 부족합니다.");
                    }
                } else {
                    this.cb.logMessage(`[경쟁자] ${rival.name}과(와)의 거래를 거절했습니다.`);
                }
            } else if (rival.role === "predatory" && Math.random() < 0.42) {
                const damage = 10 + Math.floor(Math.random() * 16);
                const finalDamage = this.applyExplorationDamage(damage, { source: "rival_quarrel", type: "physical" });
                this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 시비를 걸어 ${finalDamage} 피해를 입었습니다.`);
                this.player.applyCombatInjury?.({ damage: finalDamage, source: "경쟁자 시비" });
            } else {
                this.cb.logMessage(`[경쟁자] ${rival.name}이(가) 경계하며 지나갑니다.`);
            }
            this.player.showStatus?.();
            return;
        }

        if (event) {
            if (event.type === "Start") {
                this.cb.logMessage("[시작 지점] 장비와 경로를 점검했습니다.");
            } else if (event.type === "PORTAL") {
                this.cb.showPortalChoice(this.player, event.targetLayer, this.player.currentLayer);
            } else if (event.type === "CURIO") {
                const curioData = this.gameData.curios && this.gameData.curios[event.id];
                if (curioData) {
                    this.processCurioInteraction(curioData, event);
                } else {
                    this.cb.logMessage(`[${event.id}] 데이터를 찾을 수 없습니다.`);
                }
            } else if (event.type === "MONUMENT") {
                const boonRoll = Math.random();
                this.cb.logMessage(`[차원 비석] ${event.desc}`);
                if (boonRoll < 0.45) {
                    const gain = 80 + Math.floor(Math.random() * 220);
                    this.player.magic_stones += gain;
                    this.cb.logMessage(`[차원 비석] 잔류 마력을 회수했습니다. (마석 +${gain})`);
                } else if (boonRoll < 0.8) {
                    const hpGain = Math.max(12, Math.floor(this.player.maxHp * 0.1));
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + hpGain);
                    this.cb.logMessage(`[차원 비석] 체력이 안정화됩니다. (HP +${hpGain})`);
                } else {
                    this.player.explorationBuffs = this.player.explorationBuffs || {};
                    this.player.explorationBuffs.reveal = Math.max(this.player.explorationBuffs.reveal || 0, 8);
                    this.cb.logMessage("[차원 비석] 탐색 감응이 활성화됩니다. (은폐 흔적 탐지 강화)");
                }
                if (String(event.id || "").startsWith("dim_obelisk_")) {
                    this.consumeFixedEvent(event, "차원 비석의 잔광이 사라졌습니다.");
                }
                this.player.showStatus?.();
            } else if (event.type === "RIFT") {
                const riftData = this.gameData.rifts && this.gameData.rifts[String(this.player.currentLayer)];
                if(riftData && riftData.length > 0) {
                    const pick = riftData[Math.floor(Math.random() * riftData.length)];
                    this.cb.showRiftEntryModal(this.player, pick); 
                } else {
                    this.cb.logMessage("닫힌 균열입니다.");
                }
            } else if (event.type === "RIFT_STAGE") {
                if (this.isRiftStageCleared(event.stageIndex)) {
                    this.cb.logMessage("이미 정복한 균열 단계입니다.");
                    return;
                }

                const nextStage = this.getNextRiftStageIndex();
                if (nextStage !== null && event.stageIndex !== nextStage) {
                    const requiredStageName = this.player.currentRift?.stages?.[nextStage]?.name || `단계 ${nextStage + 1}`;
                    this.cb.logMessage(`균열 단계가 잠겨 있습니다. 먼저 [${requiredStageName}]부터 공략해야 합니다.`);
                    return;
                }

                const stage = this.player.currentRift?.stages?.[event.stageIndex];
                if (!stage) {
                    this.cb.logMessage("오류: 균열 단계 정보를 찾을 수 없습니다.");
                    return;
                }

                const stageName = stage.name || `단계 ${event.stageIndex + 1}`;
                this.cb.logMessage(`[균열 도전] ${stageName}`);
                if (stage.event) this.cb.logMessage(`[균열 메모] ${stage.event}`);

                const { monsters, missing } = this.buildRiftStageCombatList(stage);
                if (missing.length > 0) {
                    this.cb.logMessage(`[균열 보정] 누락된 몬스터 데이터(${missing.join(', ')})를 대체 몬스터로 변환했습니다.`);
                }

                if (Array.isArray(monsters) && monsters.length > 0) {
                    this.player.pendingRiftStageIndex = event.stageIndex;
                    this.player.startCombat(monsters);
                } else {
                    this.resolveRiftStageEventOnly(stage);
                    this.markRiftStageCleared(event.stageIndex);
                }
            } else if (event.type === "RIFT_EXIT") {
                this.handleRiftExitEvent();
            } else if (event.type === "RIFT_FORTUNE") {
                this.handleRiftFortuneEvent(event);
            } else if (event.type === "RIFT_CACHE") {
                const state = this.getRiftProgressState();
                if (!state) return;
                const cacheKey = `${event.resolvedX},${event.resolvedY}`;
                if (state.cacheClaimed.includes(cacheKey)) {
                    this.cb.logMessage("이미 회수한 균열 잔향입니다.");
                    return;
                }

                if (Math.random() < 0.7) {
                    const rewards = ["포션", "건조 식량", "마력결정체", "횃불", "모닥불 키트"];
                    const item = rewards[Math.floor(Math.random() * rewards.length)];
                    this.player.addItem(item);
                    this.cb.logMessage(`[균열 잔향] ${item}(을)를 획득했습니다.`);
                } else {
                    const gain = 120 + Math.floor(Math.random() * 251);
                    this.player.magic_stones += gain;
                    this.cb.logMessage(`[균열 잔향] 마석 ${gain}개를 회수했습니다.`);
                }

                state.cacheClaimed.push(cacheKey);
                this.consumeFixedEvent(event, "잔향이 소멸했습니다.");
                this.player.showStatus?.();
            } else if (event.type === "TURRET") {
                this.handleTurretEvent(event, false);
            } else if (event.type === "RIFT_TURRET") {
                this.handleTurretEvent(event, true);
            } else if (event.type === "HIDDEN_RELIC") {
                this.handleHiddenRelicEvent(event);
            } else if (event.type === "ORE_VEIN") {
                this.handleOreVeinEvent(event);
            } else if (event.type === "EVENT") {
                this.handleDynamicFieldEvent(event);
            } else if (event.type === "NPC") {
                this.handleFieldNpcEvent(event);
            } else {
                this.cb.logMessage("상호작용 가능한 이벤트가 아니거나 이미 소멸했습니다.");
            }
            return;
        }

        // 이벤트 타일이 아닐 때 모닥불 설치 선택지
        if (!this.player.inCombat && this.currentMap.grid[y][x] !== 0 && this.player.inventory.includes("모닥불 키트")) {
            const existingCampfire = this.player.campfires?.[campfireKey];
            if (existingCampfire) {
                this.cb.logMessage(`이 층에는 이미 모닥불이 설치되어 있습니다. (${existingCampfire.x}, ${existingCampfire.y})`);
                const replace = confirm("기존 모닥불을 제거하고 여기에 설치하시겠습니까?");
                if (replace) this.installCampfire(x, y, layer, { skipReplaceConfirm: true });
            } else {
                const action = confirm("모닥불을 설치하시겠습니까? (모닥불 키트 1개 소모)");
                if (action) this.installCampfire(x, y, layer, { skipReplaceConfirm: true });
            }
            return;
        }

        this.cb.logMessage("상호작용할 대상이 없습니다.");
    }

    handleRiftFortuneEvent(event) {
        if (!event) return;
        const layerNum = Math.max(1, Number(this.player.currentLayer) || 1);
        const roll = Math.random();
        const regionalList = this.getMonsterTableForPosition(this.player.x, this.player.y);
        const pool = regionalList.length > 0 ? regionalList : (this.currentMap.monsterTable || ["고블린"]);
        const numbersPool = Object.keys(this.gameData?.numbersItems || {});

        if (roll < 0.18) {
            const gain = 140 + (layerNum * 28) + Math.floor(Math.random() * 180);
            this.player.magic_stones += gain;
            this.cb.logMessage(`[균열 기연] 농축된 잔류 마력 핵을 획득했습니다. (마석 +${gain})`);
        } else if (roll < 0.33) {
            const itemPool = ["마력결정체", "포션", "건조 식량", "횃불", "모닥불 키트", "균열석"];
            const pick = itemPool[Math.floor(Math.random() * itemPool.length)];
            this.player.addItem(pick);
            this.cb.logMessage(`[균열 기연] 파편 보급품에서 ${pick}(을)를 회수했습니다.`);
        } else if (roll < 0.49) {
            const hpGain = Math.max(16, Math.floor(this.player.maxHp * 0.18));
            const mpGain = Math.max(12, Math.floor(this.player.maxMp * 0.16));
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + hpGain);
            this.player.mp = Math.min(this.player.maxMp, this.player.mp + mpGain);
            this.player.removeAllDebuffs?.();
            this.cb.logMessage(`[균열 기연] 차원 안정화 파동으로 회복합니다. (HP +${hpGain}, MP +${mpGain}, 정화)`);
        } else if (roll < 0.62) {
            this.player.explorationBuffs = this.player.explorationBuffs || {};
            this.player.explorationBuffs.reveal = Math.max(this.player.explorationBuffs.reveal || 0, 22);
            this.player.explorationBuffs.hunterSense = Math.max(this.player.explorationBuffs.hunterSense || 0, 18);
            this.player.criticalHitBoost = true;
            this.cb.logMessage("[균열 기연] 전투 감응이 각성됩니다. (탐색 강화 + 다음 공격 치명타 확률 증가)");
        } else if (roll < 0.76) {
            const essencePool = ["균열 정박자", "심층 정찰자", "루멘 와처", "장막 파쇄자"]
                .filter((essenceName) => Boolean(this.gameData?.essences?.[essenceName]));
            if (essencePool.length > 0 && Math.random() < 0.42) {
                const essence = essencePool[Math.floor(Math.random() * essencePool.length)];
                this.player.addEssence?.(essence);
                this.cb.logMessage(`[균열 기연] ${essence} 정수 잔향을 흡수했습니다.`);
            } else {
                const fallbackGain = 120 + Math.floor(Math.random() * 180);
                this.player.magic_stones += fallbackGain;
                this.cb.logMessage(`[균열 기연] 정수 공명에는 실패했지만 마석을 회수했습니다. (+${fallbackGain})`);
            }
        } else if (roll < 0.9) {
            const count = 1 + Math.floor(Math.random() * 2);
            const group = [];
            for (let i = 0; i < count; i++) {
                group.push(pool[Math.floor(Math.random() * pool.length)]);
            }
            this.cb.logMessage("[균열 기연] 공명이 역류해 적대 잔재가 실체화했습니다!");
            this.consumeFixedEvent(event, "균열 기연 잔상이 소멸했습니다.");
            this.player.startCombat(group);
            return;
        } else {
            const damage = 12 + Math.floor(Math.random() * (16 + layerNum));
            const finalDamage = this.applyExplorationDamage(damage, { source: "rift_fortune_backfire", type: "arcane" });
            this.cb.logMessage(`[균열 기연] 불안정 역류로 ${finalDamage} 피해를 입었습니다.`);
            if (numbersPool.length > 0 && Math.random() < 0.32) {
                const numberItem = numbersPool[Math.floor(Math.random() * numbersPool.length)];
                this.player.addItem(numberItem);
                this.cb.logMessage(`[균열 기연] 위험을 버틴 대가로 [${numberItem}] 넘버스를 획득했습니다.`);
            } else {
                const stoneGain = 180 + Math.floor(Math.random() * 240);
                this.player.magic_stones += stoneGain;
                this.cb.logMessage(`[균열 기연] 대신 파편 마력을 흡수했습니다. (마석 +${stoneGain})`);
            }
        }

        this.consumeFixedEvent(event, "균열 기연 잔상이 소멸했습니다.");
        this.updateVisibility();
        this.cb.updateExplorationUI(this);
        this.player.showStatus?.();
    }

    handleOreVeinEvent(event) {
        if (!event) return;
        const oreType = String(event.oreType || this.getOrePoolForLayer(this.player.currentLayer)[0] || "구리 광석");
        const remain = Math.max(0, Number(event.charges || 0));
        if (remain <= 0) {
            this.cb.logMessage("[광맥] 이미 채굴이 끝난 광맥입니다.");
            this.consumeFixedEvent(event, "광맥이 붕괴해 더는 채굴할 수 없습니다.");
            return;
        }

        const stats = this.player.currentStats || {};
        const miningPower = Number(stats["근력"] || 0) + Number(stats["지구력"] || 0) + Number(stats["인지력"] || 0);
        const skillBonus = Math.max(0, Math.floor(miningPower / 120));
        const baseYield = 1 + Math.floor(Math.random() * 2);
        const finalYield = Math.max(1, Math.min(6, baseYield + skillBonus));
        const fatigueCost = 4 + Math.floor(Math.random() * 5);
        const stoneBonus = 20 + Math.floor(Math.random() * (30 + Math.max(0, Number(this.player.currentLayer || 1) * 10)));

        for (let i = 0; i < finalYield; i++) {
            this.player.inventory.push(oreType);
        }
        this.player.magic_stones += stoneBonus;
        this.player.fatigue = Math.min(100, Number(this.player.fatigue || 0) + fatigueCost);
        this.player.advanceWorldTime?.(1, "광맥 채굴");

        event.charges = Math.max(0, remain - 1);
        this.cb.logMessage(`[채굴] ${oreType} x${finalYield} 채집 완료. (마석 +${stoneBonus}, 피로 +${fatigueCost}, 잔여 ${event.charges}회)`);
        if (Number(event.charges || 0) <= 0) {
            this.consumeFixedEvent(event, "광맥이 모두 소진되어 붕괴했습니다.");
        }
        this.player.showStatus?.();
    }

    handleTurretEvent(event, isRiftTurret = false) {
        if (!event) return;
        const stats = this.player.currentStats || {};
        const cognition = (stats["인지력"] || 0) + (stats["시각"] || 0) + (stats["민첩성"] || 0);
        let disarmChance = 0.24 + Math.min(0.4, cognition / 500);
        if (this.hasSenseAptitude()) disarmChance += 0.12;
        if (isRiftTurret && this.hasRiftAptitude()) disarmChance += 0.12;
        disarmChance = Math.max(0.1, Math.min(0.9, disarmChance));

        if (Math.random() < disarmChance) {
            const stoneGain = 70 + Math.floor(Math.random() * 121);
            this.player.magic_stones += stoneGain;
            this.cb.logMessage(`${isRiftTurret ? "[균열 포탑]" : "[포탑]"} 조준 코어를 해제했습니다. (마석 +${stoneGain})`);
            if (Math.random() < 0.35) {
                this.player.inventory.push("횃불");
                this.cb.logMessage("잔해에서 횃불을 회수했습니다.");
            }
            this.consumeFixedEvent(event, "포탑이 정지하며 기능을 멈췄습니다.");
            this.player.showStatus?.();
            return;
        }

        const baseDamage = isRiftTurret ? 30 : 20;
        const variance = isRiftTurret ? 24 : 16;
        const damage = baseDamage + Math.floor(Math.random() * variance);
        const finalDamage = this.applyExplorationDamage(damage, {
            source: isRiftTurret ? "rift_turret" : "turret",
            type: "arcane",
            isTurret: true
        });
        this.cb.logMessage(`${isRiftTurret ? "[균열 포탑]" : "[포탑]"} 회피 실패! ${finalDamage} 피해를 입었습니다.`);
        if (Math.random() < (isRiftTurret ? 0.45 : 0.28)) {
            this.player.applyDebuff?.("출혈");
        }
        this.player.showStatus?.();
    }

    handleDynamicFieldEvent(event) {
        if (!event) return;
        const layerNum = Math.max(1, Number(this.player.currentLayer) || 1);
        const roll = Math.random();
        const kind = String(event.eventKind || "dynamic");
        const regionalList = this.getMonsterTableForPosition(this.player.x, this.player.y);
        const pool = regionalList.length > 0 ? regionalList : (this.currentMap.monsterTable || ["고블린"]);

        if (kind === "settings") {
            const scenario = String(event.settingsEvent?.kind || "cache");
            const customDesc = event.settingsEvent?.desc || event.desc || "알 수 없는 이상 반응이 발생했습니다.";
            if (scenario === "horde") {
                const size = 3 + Math.floor(Math.random() * 4);
                const group = [];
                for (let i = 0; i < size; i++) {
                    group.push(pool[Math.floor(Math.random() * pool.length)]);
                }
                this.cb.logMessage(`[설정 이벤트] ${customDesc}`);
                this.cb.logMessage(`[설정 이벤트] 몬스터 무리(${size})와 전투가 시작됩니다.`);
                this.consumeFixedEvent(event, "특수 이벤트 흔적이 사라졌습니다.");
                this.player.startCombat(group);
                return;
            }

            if (scenario === "explorer") {
                this.cb.logMessage(`[설정 이벤트] ${customDesc}`);
                if (Math.random() < 0.45) {
                    const itemPool = ["건조 식량", "포션", "횃불", "마력결정체"];
                    const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                    this.player.addItem(item);
                    this.cb.logMessage(`[탐험가 조우] 물자 교환으로 ${item}(을)를 확보했습니다.`);
                } else {
                    const mpGain = 14 + Math.floor(Math.random() * 24);
                    this.player.mp = Math.min(this.player.maxMp, this.player.mp + mpGain);
                    this.cb.logMessage(`[탐험가 조우] 정보 공유로 MP가 ${mpGain} 회복되었습니다.`);
                }
                this.consumeFixedEvent(event, "특수 이벤트 흔적이 사라졌습니다.");
                this.player.showStatus?.();
                return;
            }

            if (scenario === "raider") {
                this.cb.logMessage(`[설정 이벤트] ${customDesc}`);
                if (Math.random() < 0.65) {
                    const enemy = pool[Math.floor(Math.random() * pool.length)];
                    const extra = pool[Math.floor(Math.random() * pool.length)];
                    this.consumeFixedEvent(event, "약탈자 흔적이 소멸했습니다.");
                    this.player.startCombat([enemy, extra]);
                    return;
                }
                const stole = 140 + Math.floor(Math.random() * 210);
                this.player.gold = Math.max(0, (this.player.gold || 0) - stole);
                this.cb.logMessage(`[약탈자] 기습을 허용했습니다. (스톤 -${stole})`);
                this.consumeFixedEvent(event, "약탈자 흔적이 소멸했습니다.");
                this.player.showStatus?.();
                return;
            }

            if (scenario === "collapse") {
                const damage = 20 + Math.floor(Math.random() * (16 + layerNum));
                const finalDamage = this.applyExplorationDamage(damage, { source: "settings_collapse", type: "arcane" });
                this.player.applyDebuff?.("출혈");
                if (Math.random() < 0.5) this.player.applyDebuff?.("감전(8)(2턴)");
                this.cb.logMessage(`[설정 이벤트] ${customDesc}`);
                this.cb.logMessage(`[차원 이상] 파동 충격으로 ${finalDamage} 피해를 입었습니다.`);
                this.consumeFixedEvent(event, "차원 파동이 가라앉았습니다.");
                this.player.showStatus?.();
                return;
            }

            const rewardRoll = Math.random();
            this.cb.logMessage(`[설정 이벤트] ${customDesc}`);
            if (rewardRoll < 0.55) {
                const gain = 180 + Math.floor(Math.random() * 240);
                this.player.gold += gain;
                this.cb.logMessage(`[은닉 보급품] 스톤 +${gain}`);
            } else {
                const itemPool = ["마력결정체", "포션", "모닥불 키트", "균열석"];
                const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                this.player.addItem(item);
                this.cb.logMessage(`[은닉 보급품] ${item}(을)를 확보했습니다.`);
            }
            this.consumeFixedEvent(event, "특수 이벤트 흔적이 사라졌습니다.");
            this.player.showStatus?.();
            return;
        }

        if (kind === "fortune") {
            if (roll < 0.42) {
                const gain = 260 + (layerNum * 25) + Math.floor(Math.random() * 340);
                this.player.gold += gain;
                this.cb.logMessage(`[기연] 숨겨진 비상금 보관함을 발견했습니다. (스톤 +${gain})`);
            } else if (roll < 0.8) {
                const itemPool = ["마력결정체", "모닥불 키트", "횃불", "포션", "균열석"];
                const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                this.player.addItem(item);
                this.cb.logMessage(`[기연] 행운의 잔재에서 ${item}(을)를 획득했습니다.`);
            } else {
                this.player.explorationBuffs = this.player.explorationBuffs || {};
                this.player.explorationBuffs.reveal = Math.max(this.player.explorationBuffs.reveal || 0, 14);
                this.player.explorationBuffs.hunterSense = Math.max(this.player.explorationBuffs.hunterSense || 0, 14);
                this.cb.logMessage("[기연] 감각이 증폭됩니다. (탐색/추적 강화)");
            }
        } else if (kind === "traveler") {
            if (roll < 0.35) {
                const mpGain = 16 + Math.floor(Math.random() * 24);
                this.player.mp = Math.min(this.player.maxMp, this.player.mp + mpGain);
                this.cb.logMessage(`[현장 조우] 다른 탐험가에게 조언을 받았습니다. (MP +${mpGain})`);
            } else if (roll < 0.7) {
                const heal = Math.max(10, Math.floor(this.player.maxHp * 0.12));
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
                this.cb.logMessage(`[현장 조우] 응급 처치를 받았습니다. (HP +${heal})`);
            } else {
                const itemPool = ["건조 식량", "붕대", "포션", "횃불"];
                const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                this.player.addItem(item);
                this.cb.logMessage(`[현장 조우] 생존 물자를 교환받았습니다. (${item})`);
            }
        } else if (kind === "ambush") {
            const size = 2 + Math.floor(Math.random() * 4);
            const group = [];
            for (let i = 0; i < size; i++) {
                group.push(pool[Math.floor(Math.random() * pool.length)]);
            }
            this.cb.logMessage(`[매복] 몬스터 무리(${size})가 포위했습니다!`);
            this.consumeFixedEvent(event, "매복 흔적이 사라졌습니다.");
            this.player.startCombat(group);
            return;
        } else if (kind === "hazard") {
            const pressure = 12 + Math.floor(Math.random() * (18 + layerNum));
            const finalDamage = this.applyExplorationDamage(pressure, { source: "field_hazard", type: "physical" });
            if (Math.random() < 0.35) this.player.applyDebuff?.("출혈");
            if (Math.random() < 0.22) this.player.applyDebuff?.("감전(8)(2턴)");
            this.cb.logMessage(`[함정 반응] 지형 함정이 폭주했습니다. (${finalDamage} 피해)`);
        } else if (kind === "artifact") {
            if (roll < 0.5) {
                const gain = 90 + Math.floor(Math.random() * 220);
                this.player.magic_stones += gain;
                this.cb.logMessage(`[고대 유물] 파편 핵에서 마석 ${gain}개를 추출했습니다.`);
            } else if (roll < 0.78) {
                const itemPool = ["마력결정체", "횃불", "포션"];
                const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                this.player.addItem(item);
                this.cb.logMessage(`[고대 유물] 유물 저장칸에서 ${item}(을)를 획득했습니다.`);
            } else {
                const enemy = pool[Math.floor(Math.random() * pool.length)];
                this.cb.logMessage("[고대 유물] 봉인체가 활성화되어 전투가 발생합니다!");
                this.consumeFixedEvent(event, "유물 반응이 사라졌습니다.");
                this.player.startCombat([enemy, enemy]);
                return;
            }
        } else {
            if (roll < 0.2) {
                const gain = 180 + (layerNum * 22) + Math.floor(Math.random() * 260);
                this.player.gold += gain;
                this.cb.logMessage(`[현장 이벤트] 오래된 비상금 주머니를 발견했습니다. (스톤 +${gain})`);
            } else if (roll < 0.43) {
                const itemPool = ["건조 식량", "포션", "마력결정체", "횃불", "모닥불 키트"];
                const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                this.player.addItem(item);
                this.cb.logMessage(`[현장 이벤트] 버려진 보급품에서 ${item}(을)를 확보했습니다.`);
            } else if (roll < 0.62) {
                const explorerHostile = Math.random() < 0.38;
                if (explorerHostile) {
                    const enemy = pool[Math.floor(Math.random() * pool.length)];
                    this.cb.logMessage("[현장 이벤트] 약탈 탐험가 무리가 기습했습니다!");
                    this.consumeFixedEvent(event, "현장 흔적이 소멸했습니다.");
                    this.player.startCombat([enemy]);
                    return;
                }
                const mpGain = 12 + Math.floor(Math.random() * 20);
                this.player.mp = Math.min(this.player.maxMp, this.player.mp + mpGain);
                this.cb.logMessage(`[현장 이벤트] 우호 탐험가의 지원을 받았습니다. (MP +${mpGain})`);
            } else if (roll < 0.82) {
                const size = 2 + Math.floor(Math.random() * 3);
                const group = [];
                for (let i = 0; i < size; i++) {
                    group.push(pool[Math.floor(Math.random() * pool.length)]);
                }
                this.cb.logMessage(`[현장 이벤트] 몬스터 무리(${size})가 매복하고 있었습니다!`);
                this.consumeFixedEvent(event, "현장 흔적이 소멸했습니다.");
                this.player.startCombat(group);
                return;
            } else {
                const pressure = 10 + Math.floor(Math.random() * (15 + layerNum));
                const finalDamage = this.applyExplorationDamage(pressure, { source: "field_wave", type: "arcane" });
                this.player.explorationBuffs = this.player.explorationBuffs || {};
                this.player.explorationBuffs.hunterSense = Math.max(this.player.explorationBuffs.hunterSense || 0, 10);
                this.cb.logMessage(`[현장 이벤트] 불안정한 파동이 터졌습니다. (${finalDamage} 피해) 감각이 예민해집니다.`);
            }
        }

        this.consumeFixedEvent(event, "현장 흔적이 사라졌습니다.");
        this.player.showStatus?.();
    }

    handleHiddenRelicEvent(event) {
        if (!event) return;
        if (event.hidden && !event.discovered) {
            this.cb.logMessage("아직은 아무것도 느껴지지 않습니다.");
            return;
        }

        const req = event.requiredAbility || "none";
        const reqLabelMap = {
            light: "광원/빛 이능",
            sense: "탐지 이능",
            rift: "균열/차원 이능",
            terrain: "지형/자연 이능"
        };
        if (!this.canSolveHiddenRequirement(req)) {
            const reqLabel = reqLabelMap[req] || "특수 능력";
            this.cb.logMessage(`[히든 피스] 봉인이 남아 있습니다. 필요 조건: ${reqLabel}`);
            this.player.hiddenFieldHints = this.player.hiddenFieldHints || {};
            this.player.hiddenFieldHints[event.id || `${event.resolvedX},${event.resolvedY}`] = req;
            return;
        }

        const rewardByReq = {
            light: ["횃불", "마력결정체", "포션"],
            sense: ["건조 식량", "횃불", "붕대"],
            rift: ["균열석", "마력결정체", "모닥불 키트"],
            terrain: ["식량", "모닥불 키트", "포션"]
        };
        const rewardPool = rewardByReq[req] || ["포션", "마력결정체"];
        const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];

        if (reward === "균열석") this.player.addItem("균열석");
        else this.player.addItem(reward);

        const stoneBonus = 90 + Math.floor(Math.random() * 171);
        this.player.magic_stones += stoneBonus;
        this.cb.logMessage(`[히든 피스] 봉인을 해제했습니다. ${reward} + 마석 ${stoneBonus} 획득.`);

        const essenceByReq = {
            light: "루멘 와처",
            sense: "심층 정찰자",
            rift: "균열 정박자",
            terrain: "탐식의 불씨"
        };
        const bonusEssence = essenceByReq[req];
        if (bonusEssence && Math.random() < 0.18 && this.gameData?.essences?.[bonusEssence]) {
            this.player.addEssence?.(bonusEssence);
            this.cb.logMessage(`[히든 피스] ${bonusEssence} 정수의 잔향을 흡수했습니다.`);
        }

        this.consumeFixedEvent(event, "히든 피스가 해제되어 흔적이 사라졌습니다.");
        this.player.showStatus?.();
    }

    handleFieldNpcEvent(event) {
        if (!event) return;
        const role = String(event.role || "TRADER").toUpperCase();
        const npcName = event.npcName || "미상의 탐험가";
        const currentAffinity = typeof this.player.getNpcAffinity === 'function'
            ? this.player.getNpcAffinity(npcName)
            : Number(this.player.npcAffinity?.[npcName] || 0);
        const affinityBonus = Math.max(0, currentAffinity) * 0.002;
        const discount = Math.min(0.25, 0.05 + affinityBonus);
        const service = (base) => Math.max(1, Math.floor(base * (1 - discount)));
        const gainAffinity = (amount, reason) => {
            if (typeof this.player.changeNpcAffinity === 'function') {
                this.player.changeNpcAffinity(npcName, amount, reason);
                return;
            }
            this.player.npcAffinity = this.player.npcAffinity || {};
            const cur = Number(this.player.npcAffinity[npcName] || 0);
            this.player.npcAffinity[npcName] = Math.max(-100, Math.min(100, cur + amount));
        };

        if (role === "RAIDER") {
            if (Math.random() < 0.72) {
                const regionalList = this.getMonsterTableForPosition(this.player.x, this.player.y);
                const pool = regionalList.length > 0 ? regionalList : (this.currentMap.monsterTable || ["고블린"]);
                const groupSize = 2 + Math.floor(Math.random() * 2);
                const group = [];
                for (let i = 0; i < groupSize; i++) {
                    group.push(pool[Math.floor(Math.random() * pool.length)]);
                }
                this.cb.logMessage(`[NPC:약탈자] ${npcName}이(가) 선공해 왔습니다!`);
                this.consumeFixedEvent(event, "약탈자 무리가 흩어졌습니다.");
                this.player.startCombat(group);
                return;
            }
            const stole = 120 + Math.floor(Math.random() * 220);
            this.player.gold = Math.max(0, this.player.gold - stole);
            this.cb.logMessage(`[NPC:약탈자] 소란 끝에 ${stole} 스톤을 잃었습니다.`);
            this.consumeFixedEvent(event, "약탈자 무리가 도주했습니다.");
            this.player.showStatus?.();
            return;
        }

        if (role === "TRADER" || role === "CLAN_TRADER" || role === "SMUGGLER") {
            const offeredItemPool = role === "SMUGGLER"
                ? ["모닥불 키트", "마력결정체", "횃불", "포션", "균열석"]
                : ["식량", "건조 식량", "포션", "횃불", "붕대"];
            const item = offeredItemPool[Math.floor(Math.random() * offeredItemPool.length)];
            const baseCost = role === "CLAN_TRADER" ? 820 : (role === "SMUGGLER" ? 980 : 640);
            const cost = service(baseCost);
            const willBuy = confirm(`[NPC:${npcName}] ${item} 거래 제안 (${cost} 스톤). 구매하시겠습니까?`);
            if (willBuy) {
                if (this.player.gold < cost) {
                    this.cb.logMessage("스톤이 부족하여 거래할 수 없습니다.");
                } else {
                    this.player.gold -= cost;
                    this.player.addItem(item);
                    this.cb.logMessage(`[NPC 거래] ${item} 구매 완료. (${cost} 스톤)`);
                    gainAffinity(2, "미궁 거래");
                }
            } else {
                this.cb.logMessage(`${npcName}과(와)의 거래를 보류했습니다.`);
            }
            this.player.showStatus?.();
            return;
        }

        if (role === "HEALER") {
            const baseCost = 700;
            const cost = service(baseCost);
            const healChoice = confirm(`[NPC:${npcName}] 응급치료 (${cost} 스톤, HP/MP 45% 회복). 진행하시겠습니까?`);
            if (!healChoice) {
                this.cb.logMessage("치료를 보류했습니다.");
                return;
            }
            if (this.player.gold < cost) {
                this.cb.logMessage("치료비가 부족합니다.");
                return;
            }
            this.player.gold -= cost;
            const hpGain = Math.floor(this.player.maxHp * 0.45);
            const mpGain = Math.floor(this.player.maxMp * 0.45);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + hpGain);
            this.player.mp = Math.min(this.player.maxMp, this.player.mp + mpGain);
            this.cb.logMessage(`[NPC 치료] HP +${hpGain}, MP +${mpGain}`);
            gainAffinity(2, "응급 치료");
            this.player.showStatus?.();
            return;
        }

        if (role === "SCOUT" || role === "CLAN_PATROL") {
            const revealRadius = role === "CLAN_PATROL" ? 10 : 7;
            const revealed = this.revealNearbyHiddenRelics(revealRadius, "(정찰 지원)");
            this.player.explorationBuffs = this.player.explorationBuffs || {};
            this.player.explorationBuffs.hunterSense = Math.max(this.player.explorationBuffs.hunterSense || 0, role === "CLAN_PATROL" ? 16 : 10);
            this.cb.logMessage(`[NPC 정찰] ${npcName}이(가) 주변 지형을 공유했습니다.`);
            if (revealed > 0) this.cb.logMessage(`[NPC 정찰] 숨겨진 흔적 ${revealed}개 발견.`);
            gainAffinity(1, "정찰 정보 교환");
            this.updateVisibility();
            this.cb.updateExplorationUI(this);
            this.player.showStatus?.();
            return;
        }

        if (role === "SALVAGER") {
            const roll = Math.random();
            if (roll < 0.5) {
                const item = ["마력결정체", "포션", "건조 식량"][Math.floor(Math.random() * 3)];
                this.player.addItem(item);
                this.cb.logMessage(`[NPC 수거꾼] ${item}(을)를 건네받았습니다.`);
            } else {
                const gain = 90 + Math.floor(Math.random() * 170);
                this.player.magic_stones += gain;
                this.cb.logMessage(`[NPC 수거꾼] 마석 ${gain}개를 교환받았습니다.`);
            }
            gainAffinity(1, "현장 교환");
            this.player.showStatus?.();
            return;
        }

        this.cb.logMessage(`${npcName}과(와) 짧은 정보를 교환했습니다.`);
    }

    useExplorationEssenceAbility(preferredAbility = null) {
        if (!this.currentMap) {
            this.cb.logMessage("탐험 중일 때만 이능을 사용할 수 있습니다.");
            return false;
        }
        if (this.player.inCombat) {
            this.cb.logMessage("전투 중에는 탐험 이능을 사용할 수 없습니다.");
            return false;
        }

        const buffs = this.player.explorationBuffs || (this.player.explorationBuffs = {});
        const abilities = this.getExplorationAbilityList();

        if (abilities.length === 0) {
            this.cb.logMessage("탐험에 활용 가능한 이능 정수가 없습니다.");
            return false;
        }

        let chosen = null;
        if (preferredAbility) {
            chosen = abilities.find((a) => a.key === preferredAbility) || null;
        }

        if (!chosen) {
            const nearbyHidden = (this.currentMap?.fixedEvents || []).find((e) =>
                e.type === "HIDDEN_RELIC" &&
                e.discovered &&
                Math.abs(e.resolvedX - this.player.x) + Math.abs(e.resolvedY - this.player.y) <= 3 &&
                this.canSolveHiddenRequirement(e.requiredAbility)
            );
            if (nearbyHidden) {
                chosen = abilities.find((a) => a.key === nearbyHidden.requiredAbility) || null;
            }
        }

        if (!chosen) {
            this.player.hiddenFieldHints = this.player.hiddenFieldHints || {};
            const cursor = this.player.hiddenFieldHints.abilityCursor || 0;
            chosen = abilities[cursor % abilities.length];
            this.player.hiddenFieldHints.abilityCursor = (cursor + 1) % abilities.length;
        }

        const remainingCooldown = Number(chosen.remainingCooldown ?? this.getExplorationAbilityCooldownRemaining(chosen.key));
        if (remainingCooldown > 0) {
            this.cb.logMessage(`[이능:${chosen.label}] 재사용 대기 중입니다. (${remainingCooldown}턴 남음)`);
            return false;
        }

        const finalCost = Number.isFinite(chosen.finalCost) ? chosen.finalCost : this.getExplorationAbilityCost(chosen);
        if ((this.player.mp || 0) < finalCost) {
            this.cb.logMessage(`MP가 부족합니다. (${chosen.label} MP ${finalCost} 필요)`);
            return false;
        }

        this.player.mp -= finalCost;
        if (chosen.key === "light") {
            buffs.illumination = Math.max(buffs.illumination || 0, 18);
            buffs.reveal = Math.max(buffs.reveal || 0, 8);
            const revealed = this.revealNearbyHiddenRelics(8, "(광휘 탐색)");
            this.cb.logMessage(`[이능:${chosen.label}] 주변이 환해졌습니다. (횃불 없이 시야 강화)`);
            if (revealed > 0) this.cb.logMessage(`[이능] 숨겨진 흔적 ${revealed}개를 추가 발견했습니다.`);
        } else if (chosen.key === "sense") {
            buffs.reveal = Math.max(buffs.reveal || 0, 20);
            buffs.hunterSense = Math.max(buffs.hunterSense || 0, 16);
            const revealed = this.revealNearbyHiddenRelics(10, "(정밀 탐지)");
            this.cb.logMessage(`[이능:${chosen.label}] 은폐 신호를 정밀 추적합니다.`);
            if (revealed > 0) this.cb.logMessage(`[이능] 숨겨진 흔적 ${revealed}개를 추가 발견했습니다.`);
        } else if (chosen.key === "rift") {
            buffs.hunterSense = Math.max(buffs.hunterSense || 0, 12);
            if (this.collapse.active) {
                this.collapse.movesUntilShift = Math.max(2, this.collapse.movesUntilShift + 2);
                this.cb.logMessage(`[이능:${chosen.label}] 차원붕괴 이동이 지연됩니다.`);
            } else {
                this.cb.logMessage(`[이능:${chosen.label}] 주변 차원 노이즈를 안정화했습니다.`);
            }

            const nearbyTurret = (this.currentMap?.fixedEvents || []).find((e) =>
                (e.type === "TURRET" || e.type === "RIFT_TURRET") &&
                Math.abs(e.resolvedX - this.player.x) + Math.abs(e.resolvedY - this.player.y) <= 2
            );
            if (nearbyTurret) {
                this.consumeFixedEvent(nearbyTurret, "균열 고정으로 포탑의 동력이 소멸했습니다.");
            }
        } else if (chosen.key === "terrain") {
            buffs.reveal = Math.max(buffs.reveal || 0, 12);
            const revealed = this.revealNearbyHiddenRelics(7, "(지형 공명)");
            this.cb.logMessage(`[이능:${chosen.label}] 지형의 공명을 읽어 은폐 구조를 해석합니다.`);
            if (revealed > 0) this.cb.logMessage(`[이능] 숨겨진 흔적 ${revealed}개를 추가 발견했습니다.`);
        } else if (chosen.key === "guide") {
            const hint = this.getPortalDirectionHint(320);
            if (hint) {
                const guideCount = this.getPartyTraitCount("인도자");
                buffs.reveal = Math.max(buffs.reveal || 0, 10);
                this.partyRoleState.guideHintCooldown = 1;
                const pathLength = Math.max(0, Number(hint.path?.length || hint.distance || 0));
                if (Array.isArray(hint.path) && hint.path.length > 0) {
                    const pathSlice = hint.path.slice(0, Math.min(60, hint.path.length));
                    this.setGuidePathOverlay(pathSlice, 10 + (guideCount * 2), "길잡이 예지");
                }
                this.cb.logMessage(`[이능:${chosen.label}] 차원 비석 최단 경로를 표시합니다. (${hint.direction}, ${pathLength}칸)`);
            } else {
                this.cb.logMessage(`[이능:${chosen.label}] 감지 가능한 차원 비석 반응이 없습니다.`);
            }
        } else if (chosen.key === "scout") {
            const revealed = this.revealNearbyHiddenRelics(9, "(탐색꾼 수색)");
            buffs.hunterSense = Math.max(buffs.hunterSense || 0, 14);
            const scoutCount = this.getPartyTraitCount("탐색꾼");
            this.player.rareDropTracker = this.player.rareDropTracker || {};
            const currentInsight = Number(this.player.rareDropTracker.scoutInsight || 0);
            this.player.rareDropTracker.scoutInsight = Math.min(12, currentInsight + 3 + scoutCount);
            const findChance = 0.7;
            if (Math.random() < findChance) {
                const loot = ["건조 식량", "포션", "횃불", "붕대", "모닥불 키트"];
                const item = loot[Math.floor(Math.random() * loot.length)];
                this.player.addItem(item);
                this.cb.logMessage(`[이능:${chosen.label}] 현장 수색으로 ${item}(을)를 확보했습니다.`);
            } else {
                this.cb.logMessage(`[이능:${chosen.label}] 수색 범위를 넓혔지만 즉시 회수품은 없었습니다.`);
            }
            this.cb.logMessage(`[이능:${chosen.label}] 희귀 드랍 추적 감각이 강화됩니다.`);
            if (revealed > 0) this.cb.logMessage(`[이능] 숨겨진 흔적 ${revealed}개를 추가 발견했습니다.`);
        }

        const appliedCooldown = this.setExplorationAbilityCooldown(chosen);
        this.cb.logMessage(`[이능:${chosen.label}] 재사용 대기 ${appliedCooldown}턴`);
        this.updateVisibility();
        this.cb.updateExplorationUI(this);
        this.player.showStatus?.();
        return true;
    }

    toggleTorchEquip() {
        if (!this.currentMap) {
            this.cb.logMessage("탐험 중일 때만 횃불을 장착할 수 있습니다.");
            return false;
        }
        if (this.player.equippedTorch) {
            this.safeUnequipTorch(true);
            this.cb.logMessage("횃불 장착을 해제했습니다.");
            this.updateVisibility();
            this.cb.updateExplorationUI(this);
            this.player.showStatus?.();
            return true;
        }

        const idx = this.player.inventory.indexOf("횃불");
        if (idx < 0) {
            this.cb.logMessage("장착할 횃불이 없습니다.");
            return false;
        }

        this.player.inventory.splice(idx, 1);
        this.player.equippedTorch = true;
        this.player.equippedTorchItem = "횃불";
        this.cb.logMessage("횃불을 장착했습니다. 미궁 시야가 확장됩니다.");
        this.updateVisibility();
        this.cb.updateExplorationUI(this);
        this.player.showStatus?.();
        return true;
    }

    recoverCampfireAtCurrentTile() {
        const layer = this.player.currentLayer;
        const campfireKey = `layer_${layer}`;
        const campfire = this.player.campfires?.[campfireKey];
        if (!campfire) {
            this.cb.logMessage("이 층에는 설치된 모닥불이 없습니다.");
            return false;
        }
        if (campfire.x !== this.player.x || campfire.y !== this.player.y) {
            this.cb.logMessage(`모닥불은 (${campfire.x}, ${campfire.y})에 설치되어 있습니다.`);
            return false;
        }

        const restoreTile = Number.isFinite(campfire.previousTile) && campfire.previousTile !== 0
            ? campfire.previousTile
            : 1;
        if (this.currentMap?.grid?.[campfire.y]?.[campfire.x] !== undefined) {
            this.currentMap.grid[campfire.y][campfire.x] = restoreTile;
        }
        delete this.player.campfires[campfireKey];
        this.player.inventory.push("모닥불 키트");
        this.cb.logMessage("모닥불을 해체하고 키트를 회수했습니다.");
        this.updateVisibility();
        this.cb.updateExplorationUI(this);
        this.player.showStatus?.();
        return true;
    }

    startCampfirePlacement() {
        if (this.player.position !== "Labyrinth" || !this.currentMap) {
            this.cb.logMessage("모닥불 설치는 미궁 탐험 중에만 가능합니다.");
            return false;
        }
        if (!this.player.inventory.includes("모닥불 키트")) {
            this.cb.logMessage("모닥불 키트가 없습니다.");
            return false;
        }
        this.isPlacingCampfire = true;
        this.isPlacingTorch = false;
        this.cb.logMessage("설치할 타일을 클릭하세요. (ESC로 취소)");
        this.cb.updateExplorationUI(this);
        return true;
    }

    cancelCampfirePlacement() {
        if (!this.isPlacingCampfire) return;
        this.isPlacingCampfire = false;
        this.cb.logMessage("모닥불 설치를 취소했습니다.");
        this.cb.updateExplorationUI(this);
    }

    placeCampfireAt(x, y) {
        if (!this.isPlacingCampfire) return;
        this.isPlacingCampfire = false;

        if (x < 0 || x >= this.currentMap.width || y < 0 || y >= this.currentMap.height) {
            this.cb.logMessage("설치할 수 없는 위치입니다.");
            this.cb.updateExplorationUI(this);
            return;
        }
        if (this.isWall(x, y)) {
            this.cb.logMessage("벽에는 모닥불을 설치할 수 없습니다.");
            this.cb.updateExplorationUI(this);
            return;
        }
        const event = (this.currentMap.fixedEvents || []).find(e => e.resolvedX === x && e.resolvedY === y);
        if (event) {
            this.cb.logMessage("이벤트/포탈 타일에는 모닥불을 설치할 수 없습니다.");
            this.cb.updateExplorationUI(this);
            return;
        }

        this.installCampfire(x, y, this.player.currentLayer, { skipReplaceConfirm: false });
        this.cb.updateExplorationUI(this);
    }

    startTorchPlacement() {
        if (this.player.position !== "Labyrinth" || !this.currentMap) {
            this.cb.logMessage("횃불 설치는 미궁 탐험 중에만 가능합니다.");
            return false;
        }
        if (!this.player.inventory.includes("횃불")) {
            this.cb.logMessage("횃불 아이템이 없습니다.");
            return false;
        }
        this.isPlacingTorch = true;
        this.isPlacingCampfire = false;
        this.cb.logMessage("설치할 타일을 클릭하세요. (횃불 반경 9칸 시야, ESC 취소)");
        this.cb.updateExplorationUI(this);
        return true;
    }

    cancelTorchPlacement() {
        if (!this.isPlacingTorch) return;
        this.isPlacingTorch = false;
        this.cb.logMessage("횃불 설치를 취소했습니다.");
        this.cb.updateExplorationUI(this);
    }

    placeTorchAt(x, y) {
        if (!this.isPlacingTorch) return;
        this.isPlacingTorch = false;

        if (x < 0 || x >= this.currentMap.width || y < 0 || y >= this.currentMap.height) {
            this.cb.logMessage("설치할 수 없는 위치입니다.");
            this.cb.updateExplorationUI(this);
            return;
        }
        if (this.isWall(x, y)) {
            this.cb.logMessage("벽에는 횃불을 설치할 수 없습니다.");
            this.cb.updateExplorationUI(this);
            return;
        }
        const event = (this.currentMap.fixedEvents || []).find(e => e.resolvedX === x && e.resolvedY === y);
        if (event) {
            this.cb.logMessage("이벤트/포탈 타일에는 횃불을 설치할 수 없습니다.");
            this.cb.updateExplorationUI(this);
            return;
        }

        const idx = this.player.inventory.indexOf("횃불");
        if (idx < 0) {
            this.cb.logMessage("횃불 아이템이 없습니다.");
            this.cb.updateExplorationUI(this);
            return;
        }

        this.player.inventory.splice(idx, 1);
        const torchKey = `layer_${this.player.currentLayer}`;
        this.player.torches = this.player.torches || {};
        this.player.torches[torchKey] = this.player.torches[torchKey] || [];

        const exists = this.player.torches[torchKey].some(t => t.x === x && t.y === y);
        if (!exists) {
            this.player.torches[torchKey].push({ x, y });
        }

        this.cb.logMessage(`횃불을 설치했습니다. (${x}, ${y}) 반경 9칸이 밝아집니다.`);
        this.updateVisibility();
        this.cb.updateExplorationUI(this);
        this.player.showStatus();
    }

    processCurioInteraction(curio, sourceEvent = null) {
        this.cb.logMessage(`[${curio.name}] ${curio.desc}`);
        if (!Array.isArray(curio.actions) || curio.actions.length === 0) return;

        const action = curio.actions[0];
        if (curio.reqItem && !this.player.inventory.includes(curio.reqItem)) {
            this.cb.logMessage(`필요한 아이템(${curio.reqItem})이 없어 상호작용할 수 없습니다.`);
            return;
        }

        const rewardGranted = this.resolveCurioAction(action);
        if (rewardGranted && sourceEvent) {
            this.consumeFixedEvent(sourceEvent, "보상을 회수하여 흔적이 사라졌습니다.");
        }
    }

    resolveCurioAction(action) {
        if (!action) return false;

        if (action.type === "randomResult") {
            const outcomes = Array.isArray(action.outcomes) ? action.outcomes : [];
            if (outcomes.length === 0) return false;
            const rand = Math.random();
            let cumulative = 0;
            for (const outcome of outcomes) {
                cumulative += Number(outcome?.chance || 0);
                if (rand < cumulative) {
                    return this.resolveCurioEffect(outcome.effect);
                }
            }
            return this.resolveCurioEffect(outcomes[outcomes.length - 1]?.effect);
        }

        if (action.type === "statCheck") {
            const statVal = this.player.currentStats?.[action.stat] || 0;
            return statVal >= (action.threshold || 0)
                ? this.resolveCurioEffect(action.success)
                : this.resolveCurioEffect(action.failure);
        }

        if (action.type === "useItem") {
            if (!this.player.inventory.includes(action.item)) {
                this.cb.logMessage(`필요한 아이템(${action.item})이 없어 상호작용할 수 없습니다.`);
                return false;
            }
            this.player.useItem(action.item);
            return this.resolveCurioEffect(action.success);
        }

        return this.resolveCurioEffect(action);
    }

    resolveCurioEffect(effect) {
        if (!effect) return false;

        if (effect.type === "randomResult") {
            const outcomes = Array.isArray(effect.outcomes) ? effect.outcomes : [];
            if (outcomes.length === 0) return false;
            const rand = Math.random();
            let cumulative = 0;
            for (const outcome of outcomes) {
                cumulative += Number(outcome?.chance || 0);
                if (rand < cumulative) {
                    return this.resolveCurioEffect(outcome.effect);
                }
            }
            return this.resolveCurioEffect(outcomes[outcomes.length - 1]?.effect);
        }

        if (effect.type === "statCheck") {
            const statVal = this.player.currentStats?.[effect.stat] || 0;
            return statVal >= (effect.threshold || 0)
                ? this.resolveCurioEffect(effect.success)
                : this.resolveCurioEffect(effect.failure);
        }

        if (effect.type === "useItem") {
            if (!this.player.inventory.includes(effect.item)) {
                this.cb.logMessage(`필요한 아이템(${effect.item})이 없어 상호작용할 수 없습니다.`);
                return false;
            }
            this.player.useItem(effect.item);
            return this.resolveCurioEffect(effect.success);
        }

        this.player.handleEventEffect(effect);
        return ["addItem", "gainGold", "gainMagicStones"].includes(effect.type);
    }

    consumeFixedEvent(event, message = "") {
        if (!event || !Array.isArray(this.currentMap?.fixedEvents)) return;
        const idx = this.currentMap.fixedEvents.findIndex(e =>
            e.resolvedX === event.resolvedX &&
            e.resolvedY === event.resolvedY &&
            e.type === event.type &&
            (event.id ? e.id === event.id : true)
        );
        if (idx < 0) return;

        this.currentMap.fixedEvents.splice(idx, 1);
        this.cb.hideInteractionPrompt?.();
        if (message) this.cb.logMessage(message);
        this.cb.updateExplorationUI(this);
    }

    /**
     * [신규] 모닥불 설치
     */
    installCampfire(x, y, layer, options = {}) {
        const { skipReplaceConfirm = false } = options;
        const campfireKey = `layer_${layer}`;
        
        // 이미 이 층에 모닥불이 설치되어 있는지 확인
        if (this.player.campfires?.[campfireKey]) {
            const existing = this.player.campfires[campfireKey];
            if (existing.x === x && existing.y === y) {
                this.cb.logMessage("이미 이 위치에 모닥불이 설치되어 있습니다.");
                return;
            }
            this.cb.logMessage(`이 층에는 이미 모닥불이 설치되어 있습니다. (${existing.x}, ${existing.y})`);
            const replace = skipReplaceConfirm ? true : confirm("기존 모닥불을 제거하고 여기에 설치하시겠습니까?");
            if (!replace) return;

            const previousTile = Number.isFinite(existing.previousTile) && existing.previousTile !== 0
                ? existing.previousTile
                : 1;
            if (this.currentMap?.grid?.[existing.y]?.[existing.x] !== undefined) {
                this.currentMap.grid[existing.y][existing.x] = previousTile;
            }
        }
        
        // 모닥불 키트 소모
        const itemIndex = this.player.inventory.indexOf("모닥불 키트");
        if (itemIndex > -1) {
            this.player.inventory.splice(itemIndex, 1);

            const originalTile = this.currentMap?.grid?.[y]?.[x];
            const previousTile = (Number.isFinite(originalTile) && originalTile !== 0 && originalTile !== 10)
                ? originalTile
                : 1;
            
            // 모닥불 위치 저장
            if (!this.player.campfires) this.player.campfires = {};
            this.player.campfires[campfireKey] = { x, y, layer, previousTile };
            
            // 맵에 모닥불 타일 표시 (타일 타입 10 = CAMP)
            this.currentMap.grid[y][x] = 10;
            
            this.cb.logMessage(`모닥불을 설치했습니다. (${x}, ${y}) 이곳에서 쉬면 체력과 마나를 회복할 수 있습니다.`);
            this.cb.updateExplorationUI(this);
            this.player.showStatus();
        } else {
            this.cb.logMessage("모닥불 키트가 없습니다.");
        }
    }

    /**
     * [신규] 모닥불에서 쉬기
     */
    restoreEntityVitals(entity) {
        if (!entity || typeof entity !== "object") return;

        if (typeof entity.calculateStats === "function") {
            entity.calculateStats();
        } else if (typeof entity.updateMaxStats === "function") {
            entity.updateMaxStats();
        }

        const maxHp = Number(entity.maxHp);
        const maxMp = Number(entity.maxMp);
        const maxStamina = Number(entity.maxStamina);

        if (typeof entity.hp === "number" && Number.isFinite(maxHp) && maxHp > 0) {
            entity.hp = maxHp;
        }
        if (typeof entity.mp === "number" && Number.isFinite(maxMp) && maxMp >= 0) {
            entity.mp = maxMp;
        }
        if (typeof entity.stamina === "number" && Number.isFinite(maxStamina) && maxStamina >= 0) {
            entity.stamina = maxStamina;
        }

        if (Array.isArray(entity.debuffs)) {
            const debuffsToRemove = ["출혈", "독", "화상"];
            entity.debuffs = entity.debuffs.filter(d => !debuffsToRemove.some(remove => String(d).includes(remove)));
        }
    }

    restorePartyVitalsFull() {
        this.restoreEntityVitals(this.player);
        const partyMembers = Array.isArray(this.player.party) ? this.player.party : [];
        partyMembers.forEach(member => this.restoreEntityVitals(member));
        this.player.fatigue = 0;
    }

    restAtCampfire() {
        if (this.player.inCombat) {
            this.cb.logMessage("전투 중에는 쉴 수 없습니다.");
            return;
        }
        
        const restChoice = confirm("모닥불에서 휴식을 취하시겠습니까? (파티 전원 HP/MP/기력 완전 회복, 식량 1 소모)");
        if (!restChoice) return;
        
        const rationPriority = [
            { item: "고급 식량", satiety: 35, label: "고급 식량" },
            { item: "건조 식량", satiety: 25, label: "건조 식량" },
            { item: "식량", satiety: 20, label: "식량" }
        ];
        const ration = rationPriority.find(r => this.player.inventory.includes(r.item));
        if (!ration) {
            this.cb.logMessage("식량이 부족하여 제대로 휴식할 수 없습니다. (식량/건조 식량/고급 식량 필요)");
            return;
        }

        const guardOptions = [
            { id: "player", label: "플레이어(직접)" },
            ...((this.player.party || [])
                .filter((member) => member && Number(member.hp || 0) > 0)
                .map((member, idx) => ({ id: `member_${idx}`, label: member.name, member })))
        ];
        const guardMenuText = guardOptions
            .map((entry, idx) => `${idx + 1}. ${entry.label}`)
            .join("\n");
        const guardInput = prompt(`불침번을 지정하세요.\n${guardMenuText}`, "1");
        if (guardInput === null) return;
        const guardIndex = Math.max(1, Math.min(guardOptions.length, parseInt(guardInput, 10) || 1)) - 1;
        const selectedGuard = guardOptions[guardIndex];
        
        // 식량 소모
        const itemIndex = this.player.inventory.indexOf(ration.item);
        this.player.inventory.splice(itemIndex, 1);

        // 플레이어/파티 완전 회복
        this.restorePartyVitalsFull();

        // 포만감 회복
        this.player.satiety = Math.min(100, (this.player.satiety || 0) + ration.satiety);
        this.player.advanceWorldTime?.(8, "모닥불 휴식");

        let disrupted = false;
        if (selectedGuard?.id === "player") {
            this.player.fatigue = Math.max(45, Number(this.player.fatigue || 0));
            this.cb.logMessage("플레이어가 직접 불침번을 섰습니다. 회복 후에도 피로가 남습니다.");
        } else if (selectedGuard?.member) {
            const guard = selectedGuard.member;
            this.player.ensureCompanionBehavior?.(guard);
            const loyalty = Number(guard.hiddenLoyalty || 50);
            const greed = Number(guard.personalityTags?.greed || 45);
            const fear = Number(guard.personalityTags?.fear || 45);
            const risk = Math.max(0, Math.min(0.82,
                ((62 - loyalty) / 110) +
                ((greed - 52) / 180) +
                ((fear - 56) / 190)
            ));

            if (Math.random() < risk) {
                disrupted = true;
                if (Math.random() < 0.58 && (this.player.inventory || []).length > 0) {
                    const stolenIdx = Math.floor(Math.random() * this.player.inventory.length);
                    const stolen = this.player.inventory.splice(stolenIdx, 1)[0];
                    if (Math.random() < 0.45) {
                        this.player.party = (this.player.party || []).filter((m) => m !== guard);
                        this.cb.logMessage(`[불침번 배신] ${guard.name}이(가) ${stolen}(을)를 훔쳐 달아났습니다.`);
                    } else {
                        this.cb.logMessage(`[불침번 사고] ${guard.name}이(가) ${stolen}(을)를 분실했습니다.`);
                    }
                } else {
                    const pool = this.getMonsterTableForPosition(this.player.x, this.player.y);
                    const monsterPool = pool.length > 0 ? pool : (this.currentMap?.monsterTable || ["고블린"]);
                    const ambushSize = 1 + Math.floor(Math.random() * 2);
                    const group = [];
                    for (let i = 0; i < ambushSize; i++) {
                        group.push(monsterPool[Math.floor(Math.random() * monsterPool.length)]);
                    }
                    this.cb.logMessage(`[불침번 실패] ${guard.name}의 경계가 무너져 적이 난입했습니다!`);
                    this.player.startCombat(group);
                }
            } else {
                this.player.changeCompanionLoyalty?.(guard, 1, "불침번 성공");
                this.cb.logMessage(`${guard.name}이(가) 불침번을 서서 안전하게 휴식을 마쳤습니다.`);
            }
        }

        if (!disrupted) {
            this.cb.logMessage(`모닥불 옆에서 ${ration.label}(을)를 먹고 휴식했습니다. (파티 전원 HP/MP/기력 회복, 포만감 +${ration.satiety})`);
        }
        this.player.showStatus();
    }

    isWall(x, y) { return this.currentMap.grid[y][x] === 0; }

    findNearestFloor(x, y) {
        const maxDist = 10;
        for (let d = 1; d <= maxDist; d++) {
            for (let dy = -d; dy <= d; dy++) {
                for (let dx = -d; dx <= d; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < this.currentMap.width && ny >= 0 && ny < this.currentMap.height) {
                        if (this.currentMap.grid[ny][nx] !== 0) return { x: nx, y: ny };
                    }
                }
            }
        }
        return { x: 0, y: 0 };
    }

    resolveCoord(val, max) {
        if (val === "center") return Math.floor(max / 2);
        if (val === "random_floor") {
            // 최초 생성 시에만 호출되어 값이 고정됨
            // 벽이 아닌 바닥 타일 중에서만 선택
            let attempts = 0;
            while (attempts < 100) {
                const coord = Math.floor(Math.random() * (max - 2)) + 1;
                // 실제로는 맵 생성 후에 확인해야 하지만, 여기서는 범위만 체크
                if (coord > 0 && coord < max - 1) return coord;
                attempts++;
            }
            return Math.floor(max / 2); // 실패 시 중앙 반환
        }
        if (typeof val === 'function') {
            // 함수형 좌표: width/height를 인자로 받아 좌표 계산
            return val(max);
        }
        // 숫자형 좌표는 그대로 반환
        if (typeof val === 'number') return val;
        // 기본값: 중앙
        return Math.floor(max / 2);
    }

    resolveEventPosition(event) {
        const isRandomX = event.x === "random_floor";
        const isRandomY = event.y === "random_floor";

        if (isRandomX || isRandomY) {
            return this.getRandomFloorTile();
        }

        const x = this.resolveCoord(event.x, this.currentMap.width);
        const y = this.resolveCoord(event.y, this.currentMap.height);
        if (!this.isWall(x, y)) return { x, y };
        return this.findNearestFloor(x, y);
    }

    getRandomFloorTile() {
        for (let i = 0; i < 300; i++) {
            const x = Math.floor(Math.random() * this.currentMap.width);
            const y = Math.floor(Math.random() * this.currentMap.height);
            if (!this.isWall(x, y)) return { x, y };
        }
        return this.findNearestFloor(Math.floor(this.currentMap.width / 2), Math.floor(this.currentMap.height / 2));
    }

    getMonsterTableForPosition(x, y) {
        const byRegion = this.currentMap.monsterTableByRegion;
        if (!byRegion) return [];

        const w = this.currentMap.width;
        const h = this.currentMap.height;
        const cx = Math.floor(w / 2);
        const cy = Math.floor(h / 2);
        const margin = Math.floor(Math.min(w, h) * 0.12);
        let region = "CENTER";

        if (x < cx - margin && y < cy - margin) region = "NW";
        else if (x >= cx + margin && y < cy - margin) region = "NE";
        else if (x < cx - margin && y >= cy + margin) region = "SW";
        else if (x >= cx + margin && y >= cy + margin) region = "SE";
        else if (x < cx - margin) region = "WEST";
        else if (x >= cx + margin) region = "EAST";
        else if (y < cy - margin) region = "NORTH";
        else if (y >= cy + margin) region = "SOUTH";

        return byRegion[region] || byRegion.CENTER || [];
    }

    ensureMapConnectivity() {
        const grid = this.currentMap?.grid;
        if (!grid || !Array.isArray(grid) || grid.length === 0) return;
        const h = this.currentMap.height;
        const w = this.currentMap.width;
        const walkable = (x, y) => x >= 0 && x < w && y >= 0 && y < h && grid[y][x] !== 0;
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

        let root = null;
        for (let y = 0; y < h && !root; y++) {
            for (let x = 0; x < w; x++) {
                if (walkable(x, y)) { root = { x, y }; break; }
            }
        }
        if (!root) return;

        const bfs = (start) => {
            const visited = Array.from({ length: h }, () => Array(w).fill(false));
            const q = [start];
            visited[start.y][start.x] = true;
            for (let qi = 0; qi < q.length; qi++) {
                const cur = q[qi];
                dirs.forEach(([dx, dy]) => {
                    const nx = cur.x + dx;
                    const ny = cur.y + dy;
                    if (walkable(nx, ny) && !visited[ny][nx]) {
                        visited[ny][nx] = true;
                        q.push({ x: nx, y: ny });
                    }
                });
            }
            return visited;
        };

        const carvePath = (a, b) => {
            let x = a.x;
            let y = a.y;
            while (x !== b.x) {
                x += Math.sign(b.x - x);
                grid[y][x] = grid[y][x] === 0 ? 1 : grid[y][x];
            }
            while (y !== b.y) {
                y += Math.sign(b.y - y);
                grid[y][x] = grid[y][x] === 0 ? 1 : grid[y][x];
            }
        };

        let visited = bfs(root);
        const visitedList = () => {
            const arr = [];
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (visited[y][x]) arr.push({ x, y });
            return arr;
        };

        for (let safety = 0; safety < 200; safety++) {
            let unvisited = null;
            for (let y = 0; y < h && !unvisited; y++) {
                for (let x = 0; x < w; x++) {
                    if (walkable(x, y) && !visited[y][x]) { unvisited = { x, y }; break; }
                }
            }
            if (!unvisited) break;

            let best = null;
            const vlist = visitedList();
            vlist.forEach(v => {
                const dist = Math.abs(v.x - unvisited.x) + Math.abs(v.y - unvisited.y);
                if (!best || dist < best.dist) best = { ...v, dist };
            });
            if (!best) break;

            carvePath(unvisited, best);
            visited = bfs(root);
        }
    }
}
