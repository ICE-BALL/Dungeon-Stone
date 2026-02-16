// 파일: exploration_system.js
// 역할: 2D 미궁 탐험의 핵심 로직 (이동, 충돌, 시야, 인카운터, 몬스터 AI)

export class MapManager {
    constructor(player, gameCallbacks) {
        this.player = player;
        this.cb = gameCallbacks;
        this.gameData = player.gameData;
        
        this.currentMap = null;
        this.visitedTiles = []; 
        this.visibleTiles = []; 
        
        this.activeMonsters = []; 
        this.isPlacingCampfire = false;
        this.isPlacingTorch = false;
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
    }

    resetRunState() {
        this.currentMap = null;
        this.visitedTiles = [];
        this.visibleTiles = [];
        this.activeMonsters = [];
        this.isPlacingCampfire = false;
        this.isPlacingTorch = false;
        this.collapse.active = false;
        this.collapse.wave = 0;
        this.player.currentMapId = null;
        this.player.x = 0;
        this.player.y = 0;
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
            this.cb.initExplorationUI(this); 
            this.cb.updateExplorationUI(this);
            this.cb.playMusic('bgm-dungeon');
            return;
        }

        // --- 신규 진입 초기화 ---
        this.player.currentMapId = layerId;
        this.player.currentLayer = layerId; 
        this.endDimensionCollapse(false);
        
        // 맵 생성 (복사본 사용)
        if (typeof mapData.generate === 'function') {
            this.currentMap = {
                ...mapData,
                grid: mapData.generate() 
            };
        } else {
            this.currentMap = JSON.parse(JSON.stringify(mapData));
        }

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

        // 몬스터 스폰
        this.spawnMapMonsters();

        this.updateVisibility();
        this.cb.initExplorationUI(this);
        this.cb.updateExplorationUI(this);
        
        this.cb.logMessage(`[${this.currentMap.name}]에 진입했습니다. ${this.currentMap.description}`);
        this.cb.playMusic('bgm-dungeon');
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

        if (density <= 0 || monsterTable.length === 0) return;

        for (let i = 0; i < density; i++) {
            let mx, my;
            for (let tryCount = 0; tryCount < 100; tryCount++) {
                mx = Math.floor(Math.random() * this.currentMap.width);
                my = Math.floor(Math.random() * this.currentMap.height);
                if (!this.isWall(mx, my) && this.getDistance(this.player.x, this.player.y, mx, my) > 5 && !this.getMonsterAt(mx, my)) {
                    const tableForPos = this.getMonsterTableForPosition(mx, my);
                    const pickTable = tableForPos.length > 0 ? tableForPos : monsterTable;
                    const mName = pickTable[Math.floor(Math.random() * pickTable.length)];
                    this.activeMonsters.push({
                        id: `mon_${i}`,
                        name: mName,
                        x: mx,
                        y: my,
                        aggro: false 
                    });
                    break;
                }
            }
        }
    }

    movePlayer(dx, dy) {
        if (this.player.inCombat) return;

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

        if (moved && typeof this.player.applyHungerFromMovement === 'function') {
            this.player.applyHungerFromMovement(1);
        } else if (!moved && typeof this.player.checkSatiety === 'function') {
            this.player.checkSatiety();
        }

        this.updateVisibility();

        const eventTriggered = this.checkEvents(newX, newY);
        if (!eventTriggered) {
            this.checkRandomEncounter();
            this.checkRandomRiftEncounter();
        }

        this.processMonsterTurn();
        this.updateDimensionCollapseAfterMove();
        this.rollDimensionCollapseTrigger();

        this.cb.updateExplorationUI(this);
    }

    processMonsterTurn() {
        const px = this.player.x;
        const py = this.player.y;

        this.activeMonsters.forEach(mon => {
            const dist = this.getDistance(px, py, mon.x, mon.y);
            if (dist <= 5) {
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
                    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
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
            this.player.cb?.logMessage(`[차원붕괴] 공간 파편에 휩쓸려 ${dmg} 피해를 입었습니다.`);
            this.player.hp = Math.max(1, this.player.hp - dmg);
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

    checkRandomRiftEncounter() {
        const rifts = this.gameData.rifts?.[String(this.player.currentLayer)] || [];
        if (!Array.isArray(rifts) || rifts.length === 0) return;
        if (Math.random() < 0.0025) {
            const rift = rifts[Math.floor(Math.random() * rifts.length)];
            this.cb.logMessage("[이상현상] 불안정한 균열이 눈앞에 열렸습니다.");
            this.cb.showRiftEntryModal(this.player, rift);
        }
    }

    updateVisibility() {
        const sight = this.player.currentStats?.["시각"] || 0;
        const awareness = this.player.currentStats?.["인지력"] || 0;
        const radius = Math.max(2, Math.min(6, 2 + Math.floor((sight + awareness) / 80))); 
        const px = this.player.x;
        const py = this.player.y;
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
    }

    checkEvents(x, y) {
        // [신규] 베이스캠프 체크
        if (this.currentMap.grid[y][x] === 10) { 
             this.cb.showInteractionPrompt({ desc: "베이스캠프입니다. 안전하게 휴식할 수 있습니다." });
             return true;
        }

        // [수정] 고정된 좌표(resolvedX/Y)와 비교
        const events = this.currentMap.fixedEvents || [];
        const event = events.find(e => e.resolvedX === x && e.resolvedY === y);

        if (event) {
            this.cb.showInteractionPrompt(event);
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
        if (this.player.race === "Beastman") {
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
        const x = this.player.x;
        const y = this.player.y;
        const layer = this.player.currentLayer;
        const events = this.currentMap.fixedEvents || [];
        const event = events.find(e => e.resolvedX === x && e.resolvedY === y);
        
        // [신규] 모닥불 설치 확인
        const campfireKey = `layer_${layer}`;
        const installedCampfire = this.player.campfires?.[campfireKey];
        if (installedCampfire && installedCampfire.x === x && installedCampfire.y === y) {
            // 모닥불에서 쉬기
            this.restAtCampfire();
            return;
        }
        
        // 이벤트 타일이 아닐 때만 모닥불 설치 선택지를 우선 제공
        if (!event && !this.player.inCombat && this.currentMap.grid[y][x] !== 0) {
            // 모닥불 키트가 있는지 확인
            if (this.player.inventory.includes("모닥불 키트")) {
                const campfireKey = `layer_${layer}`;
                const existingCampfire = this.player.campfires?.[campfireKey];
                if (existingCampfire) {
                    this.cb.logMessage(`이 층에는 이미 모닥불이 설치되어 있습니다. (${existingCampfire.x}, ${existingCampfire.y})`);
                    const replace = confirm("기존 모닥불을 제거하고 여기에 설치하시겠습니까?");
                    if (replace) {
                        this.installCampfire(x, y, layer, { skipReplaceConfirm: true });
                    }
                } else {
                    const action = confirm("모닥불을 설치하시겠습니까? (모닥불 키트 1개 소모)");
                    if (action) {
                        this.installCampfire(x, y, layer, { skipReplaceConfirm: true });
                    }
                }
                return;
            }
        }
        
        // [신규] 베이스캠프 휴식
        if (this.currentMap.grid[y][x] === 10) {
            if (confirm("베이스캠프에서 휴식을 취하시겠습니까? (모든 체력/마나 회복, 식량 1 소모)")) {
                if (this.player.inventory.includes("식량")) {
                    const idx = this.player.inventory.indexOf("식량");
                    this.player.inventory.splice(idx, 1);
                    
                    this.player.hp = this.player.maxHp;
                    this.player.mp = this.player.maxMp;
                    this.player.stamina = this.player.maxStamina;
                    this.player.fatigue = 0;
                    this.player.party.forEach(p => {
                        p.hp = p.maxHp;
                        p.mp = p.maxMp;
                    });
                    this.cb.logMessage("베이스캠프에서 따뜻한 식사를 하고 푹 쉬었습니다. (상태 완전 회복)");
                    this.player.showStatus();
                } else {
                    this.cb.logMessage("식량이 부족하여 제대로 휴식할 수 없습니다.");
                }
            }
            return;
        }

        if (event) {
            if (event.type === "PORTAL") {
                this.cb.showPortalChoice(this.player, event.targetLayer, this.player.currentLayer);
            } else if (event.type === "CURIO") {
                const curioData = this.gameData.curios && this.gameData.curios[event.id];
                if (curioData) {
                    this.processCurioInteraction(curioData);
                } else {
                    this.cb.logMessage(`[${event.id}] 데이터를 찾을 수 없습니다.`);
                }
            } else if (event.type === "MONUMENT") {
                this.cb.logMessage(`[기념비] ${event.desc}`);
            } else if (event.type === "RIFT") {
                const riftData = this.gameData.rifts && this.gameData.rifts[String(this.player.currentLayer)];
                if(riftData && riftData.length > 0) {
                    const pick = riftData[Math.floor(Math.random() * riftData.length)];
                    this.cb.showRiftEntryModal(this.player, pick); 
                } else {
                    this.cb.logMessage("닫힌 균열입니다.");
                }
            }
        } else {
            this.cb.logMessage("상호작용할 대상이 없습니다.");
        }
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

    processCurioInteraction(curio) {
        this.cb.logMessage(`[${curio.name}] ${curio.desc}`);
        if (curio.actions && curio.actions.length > 0) {
            const action = curio.actions[0];
            if (curio.reqItem && !this.player.inventory.includes(curio.reqItem)) {
                this.cb.logMessage(`필요한 아이템(${curio.reqItem})이 없어 상호작용할 수 없습니다.`);
                return;
            }
            if (action.type === "randomResult") {
                const rand = Math.random();
                let cumulative = 0;
                for (const outcome of action.outcomes) {
                    cumulative += outcome.chance;
                    if (rand < cumulative) {
                        this.player.handleEventEffect(outcome.effect);
                        break;
                    }
                }
            } else if (action.type === "statCheck") {
                 const statVal = this.player.currentStats[action.stat] || 0;
                 if (statVal >= action.threshold) this.player.handleEventEffect(action.success);
                 else this.player.handleEventEffect(action.failure);
            } else if (action.type === "useItem") {
                this.player.useItem(action.item);
                if(action.success) this.player.handleEventEffect(action.success);
            }
        }
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
            this.cb.logMessage(`이 층에는 이미 모닥불이 설치되어 있습니다. (${existing.x}, ${existing.y})`);
            const replace = skipReplaceConfirm ? true : confirm("기존 모닥불을 제거하고 여기에 설치하시겠습니까?");
            if (!replace) return;
        }
        
        // 모닥불 키트 소모
        const itemIndex = this.player.inventory.indexOf("모닥불 키트");
        if (itemIndex > -1) {
            this.player.inventory.splice(itemIndex, 1);
            
            // 모닥불 위치 저장
            if (!this.player.campfires) this.player.campfires = {};
            this.player.campfires[campfireKey] = { x, y, layer };
            
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
    restAtCampfire() {
        if (this.player.inCombat) {
            this.cb.logMessage("전투 중에는 쉴 수 없습니다.");
            return;
        }
        
        const restChoice = confirm("모닥불에서 휴식을 취하시겠습니까? (체력과 마나 회복, 식량 1 소모)");
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
        
        // 식량 소모
        const itemIndex = this.player.inventory.indexOf(ration.item);
        this.player.inventory.splice(itemIndex, 1);
        
        // 체력 회복 (최대치의 80% 회복)
        const healAmount = Math.floor(this.player.maxHp * 0.8);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
        
        // 마나 회복 (최대치의 80% 회복)
        const mpRestore = Math.floor(this.player.maxMp * 0.8);
        this.player.mp = Math.min(this.player.maxMp, this.player.mp + mpRestore);
        
        // 스태미나 회복
        this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + 50);
        
        // 피로도 감소
        this.player.fatigue = Math.max(0, this.player.fatigue - 30);
        
        // 포만감 회복
        this.player.satiety = Math.min(100, (this.player.satiety || 0) + ration.satiety);
        
        // 디버프 일부 제거 (출혈, 독 등)
        if (this.player.debuffs && Array.isArray(this.player.debuffs)) {
            const debuffsToRemove = ["출혈", "독", "화상"];
            this.player.debuffs = this.player.debuffs.filter(d => !debuffsToRemove.some(remove => d.includes(remove)));
        }
        
        // 파티원도 회복
        if (this.player.party && Array.isArray(this.player.party)) {
            this.player.party.forEach(p => {
                if (p && typeof p.hp === 'number') {
                    p.hp = Math.min(p.maxHp || 100, p.hp + Math.floor((p.maxHp || 100) * 0.6));
                }
                if (p && typeof p.mp === 'number') {
                    p.mp = Math.min(p.maxMp || 100, p.mp + Math.floor((p.maxMp || 100) * 0.6));
                }
            });
        }
        
        this.cb.logMessage(`모닥불 옆에서 ${ration.label}(을)를 먹고 휴식했습니다. (체력/마나 회복, 포만감 +${ration.satiety})`);
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
