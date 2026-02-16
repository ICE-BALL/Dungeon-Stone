// 파일: ui_exploration.js
// 역할: 2D 맵 렌더링 및 입력 제어, 카메라 이동 (플레이어 고정, 맵 이동 방식)

const TILE_TYPES = {
    WALL: 0,
    FLOOR: 1,
    FOREST: 2,
    WATER: 3,
    LAVA: 4,
    ICE: 5,
    PORTAL: 9,
    CAMP: 10 // [신규] 베이스캠프 타일 타입
};

let mapManagerInstance = null;

// 타일 크기 상수 (CSS 변수와 동기화)
const TILE_SIZE = 40; // CSS의 --tile-size와 일치
const TILE_GAP = 1; // CSS의 --tile-gap과 일치
const TILE_TOTAL_SIZE = TILE_SIZE + TILE_GAP; // 실제 타일 간 거리

// UI 초기화 (맵 진입 시 1회)
export function initExplorationUI(mapManager) {
    mapManagerInstance = mapManager;
    const gridEl = document.getElementById('map-grid');
    const mapContainer = document.getElementById('map-container');
    const map = mapManager.currentMap;
    const floorId = mapManager.player.currentLayer || map.id || 1;

    // 층별 분위기 적용
    applyFloorAtmosphere(floorId, mapContainer);

    // CSS 변수 사용 (타일 크기 통일)
    gridEl.style.gridTemplateColumns = `repeat(${map.width}, var(--tile-size))`; 
    gridEl.innerHTML = '';

    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const tile = document.createElement('div');
            tile.id = `tile-${x}-${y}`;
            tile.classList.add('tile');
            
            const type = map.grid[y][x];
            if (type === TILE_TYPES.WALL) tile.classList.add('wall');
            else if (type === TILE_TYPES.FLOOR) tile.classList.add('floor');
            else if (type === TILE_TYPES.FOREST) { tile.classList.add('floor', 'terrain-forest'); }
            else if (type === TILE_TYPES.WATER) { tile.classList.add('floor', 'terrain-water'); }
            else if (type === TILE_TYPES.LAVA) { tile.classList.add('floor', 'terrain-lava'); }
            else if (type === TILE_TYPES.ICE) { tile.classList.add('floor', 'terrain-ice'); }
            else if (type === TILE_TYPES.CAMP) { 
                tile.classList.add('floor', 'campfire'); 
                tile.textContent = '';
                tile.style.color = '#ff6b35';
                tile.title = '모닥불 - 쉬기 가능';
            }
            tile.onclick = () => {
                if (mapManager.isPlacingCampfire) {
                    mapManager.placeCampfireAt(x, y);
                } else if (mapManager.isPlacingTorch) {
                    mapManager.placeTorchAt(x, y);
                }
            };
            
            gridEl.appendChild(tile);
        }
    }

    setupControls(mapManager);
    document.removeEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyDown);

    // 화면 전환
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('exploration-screen').classList.remove('hidden');
}

// 층별 분위기 적용 함수
function applyFloorAtmosphere(floorId, mapContainer) {
    if (!mapContainer) return;
    
    // 기존 층 클래스 제거
    mapContainer.classList.remove('floor-1', 'floor-2', 'floor-3', 'floor-4', 'floor-5', 
                                   'floor-6', 'floor-7', 'floor-8', 'floor-9', 'floor-10');
    
    // 새 층 클래스 추가
    mapContainer.classList.add(`floor-${floorId}`);
    
    // CSS 변수로 배경색 설정
    const root = document.documentElement;
    const bgVar = `--floor-${floorId}-bg`;
    const wallVar = `--floor-${floorId}-wall`;
    const floorVar = `--floor-${floorId}-floor`;
    
    // 기본값 설정 (CSS 변수가 없을 경우)
    const defaultBg = '#000';
    const defaultWall = '#444';
    const defaultFloor = '#222';
    
    // 맵 컨테이너 배경색 설정
    const bgColor = getComputedStyle(root).getPropertyValue(bgVar).trim() || defaultBg;
    mapContainer.style.backgroundColor = bgColor;
}

// 맵 업데이트 (이동 시마다)
export function updateExplorationUI(mapManager) {
    const map = mapManager.currentMap;
    const px = mapManager.player.x;
    const py = mapManager.player.y;
    const monsters = mapManager.activeMonsters;
    const floorId = mapManager.player.currentLayer || map.id || 1;
    const mapContainer = document.getElementById('map-container');
    
    // 층별 분위기 적용 (층이 바뀌었을 수 있으므로)
    if (mapContainer) {
        applyFloorAtmosphere(floorId, mapContainer);
    }

    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const tileEl = document.getElementById(`tile-${x}-${y}`);
            if (!tileEl) continue;

            const isVisible = mapManager.visibleTiles[y][x];
            const isVisited = mapManager.visitedTiles[y][x];

            // 클래스 및 내용 초기화
            tileEl.classList.remove('player', 'fog', 'portal', 'event', 'monster', 'monster-aggro', 'rift', 'monument', 'item', 'campfire-placement-target', 'torch', 'terrain-forest', 'terrain-water', 'terrain-lava', 'terrain-ice');
            
            // 맵 그리드 변경사항 반영 (베이스캠프, 모닥불 등)
            if (map.grid[y][x] === TILE_TYPES.CAMP) {
                tileEl.textContent = '';
                tileEl.style.color = '#ff6b35';
                tileEl.classList.add('campfire');
                tileEl.title = '모닥불 - 쉬기 가능';
            } else {
                setTileIcon(tileEl, map.grid[y][x]); 
            }
            
            if (isVisible) {
                tileEl.style.opacity = "1";
                tileEl.style.backgroundColor = ""; // 배경색 초기화
                
                // 플레이어 위치 표시 (정확히 타일 단위로)
                if (x === px && y === py) {
                    // 플레이어는 고정 아바타로 표시되므로 타일에는 표시하지 않음
                    // 하지만 타일 배경색으로 강조 가능
                    tileEl.style.backgroundColor = "rgba(106, 171, 125, 0.2)"; // 플레이어 타일 강조
                }
                
                // 몬스터 표시 (플레이어와 같은 타일이 아닐 때만)
                if (x !== px || y !== py) {
                    const monster = monsters.find(m => m.x === x && m.y === y);
                    if (monster) {
                        tileEl.classList.add(monster.aggro ? 'monster-aggro' : 'monster');
                        tileEl.textContent = '◆';
                    }
                    // 랜드마크/이벤트 표시 (몬스터와 플레이어 없을 때)
                    else {
                         // [수정] 랜덤 위치 고정 좌표(resolvedX/Y) 사용 - 정확히 타일 단위로
                         const event = map.fixedEvents?.find(e => e.resolvedX === x && e.resolvedY === y);
                         
                        if (event) {
                            if(event.type === 'PORTAL') { tileEl.classList.add('portal'); tileEl.textContent = '◎'; }
                            else if (event.type === 'RIFT') { tileEl.classList.add('rift'); tileEl.textContent = '✸'; }
                            else if (event.type === 'MONUMENT') { tileEl.classList.add('monument'); tileEl.textContent = '▣'; }
                            else if (event.type === 'CURIO' || event.type === 'EVENT') { tileEl.classList.add('event'); tileEl.textContent = '✦'; }
                            else if (event.type === 'ITEM') { tileEl.classList.add('item'); tileEl.textContent = '✚'; }
                        }
                        
                        // [신규] 설치된 모닥불 표시
                        const campfireKey = `layer_${mapManager.player.currentLayer}`;
                        const campfire = mapManager.player.campfires?.[campfireKey];
                        if (campfire && campfire.x === x && campfire.y === y) {
                            tileEl.classList.add('campfire');
                            tileEl.textContent = '';
                            tileEl.style.color = '#ff6b35';
                            tileEl.title = '모닥불 - 쉬기 가능';
                        }

                        const torchKey = `layer_${mapManager.player.currentLayer}`;
                        const torches = mapManager.player.torches?.[torchKey] || [];
                        if (torches.some(t => t.x === x && t.y === y)) {
                            tileEl.classList.add('torch');
                            tileEl.title = '설치된 횃불';
                        }
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
                tileEl.style.opacity = "0.3";
                // 방문했지만 시야 밖이면 몬스터/이벤트는 안 보임
            } else {
                tileEl.classList.add('fog');
                tileEl.textContent = '';
                tileEl.style.opacity = "1";
                tileEl.style.backgroundColor = "var(--color-tile-fog)";
            }
        }
    }

    // 맵 전체를 이동시켜 플레이어를 중앙에 맞춤
    centerMapOnPlayer(px, py);
}

function centerMapOnPlayer(px, py) {
    const gridEl = document.getElementById('map-grid');
    
    // 타일 크기와 간격을 고려한 정확한 계산
    // 타일 간 실제 거리 = 타일 크기 + 간격
    // 플레이어가 (px, py) 타일에 있으면, 그 타일의 중앙을 화면 중앙에 맞춰야 함
    const tx = - (px * TILE_TOTAL_SIZE) - (TILE_SIZE / 2);
    const ty = - (py * TILE_TOTAL_SIZE) - (TILE_SIZE / 2);

    gridEl.style.transform = `translate(${tx}px, ${ty}px)`;
}

function setTileIcon(el, type) {
    const TILE_TYPES = { FOREST: 2, WATER: 3, LAVA: 4, ICE: 5, CAMP: 10 };
    if (type === TILE_TYPES.FOREST) { el.classList.add('terrain-forest'); el.textContent = ''; }
    else if (type === TILE_TYPES.WATER) { el.classList.add('terrain-water'); el.textContent = ''; }
    else if (type === TILE_TYPES.LAVA) { el.classList.add('terrain-lava'); el.textContent = ''; }
    else if (type === TILE_TYPES.ICE) { el.classList.add('terrain-ice'); el.textContent = ''; }
    else if (type === TILE_TYPES.CAMP) {
        el.textContent = '';
        el.style.color = '#ff6b35';
        el.classList.add('campfire');
        el.title = '모닥불 - 쉬기 가능';
    }
    else if (!el.classList.contains('monster') && !el.classList.contains('portal')) el.textContent = '';
}

function setupControls(mgr) {
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnWait = document.getElementById('btn-wait');
    const btnInventory = document.getElementById('btn-inventory');
    const btnInteract = document.getElementById('interaction-btn');

    if(btnUp) btnUp.onclick = () => mgr.movePlayer(0, -1);
    if(btnDown) btnDown.onclick = () => mgr.movePlayer(0, 1);
    if(btnLeft) btnLeft.onclick = () => mgr.movePlayer(-1, 0);
    if(btnRight) btnRight.onclick = () => mgr.movePlayer(1, 0);
    if(btnWait) btnWait.onclick = () => mgr.movePlayer(0, 0);
    if(btnInventory) btnInventory.onclick = () => mgr.player?.cb?.showInventory?.(mgr.player);
    if(btnInteract) btnInteract.onclick = () => mgr.interact();
}

function handleKeyDown(e) {
    if (!mapManagerInstance) return;
    if (document.getElementById('exploration-screen').classList.contains('hidden')) return;

    if ((mapManagerInstance.isPlacingCampfire || mapManagerInstance.isPlacingTorch) && !["Escape", "i", "I"].includes(e.key)) {
        return;
    }

    switch(e.key) {
        case "ArrowUp": case "w": case "W": mapManagerInstance.movePlayer(0, -1); break;
        case "ArrowDown": case "s": case "S": mapManagerInstance.movePlayer(0, 1); break;
        case "ArrowLeft": case "a": case "A": mapManagerInstance.movePlayer(-1, 0); break;
        case "ArrowRight": case "d": case "D": mapManagerInstance.movePlayer(1, 0); break;
        case " ": case "Enter": mapManagerInstance.interact(); break;
        case "i": case "I":
            mapManagerInstance.player?.cb?.showInventory?.(mapManagerInstance.player);
            break;
        case "Escape":
            mapManagerInstance.cancelCampfirePlacement?.();
            mapManagerInstance.cancelTorchPlacement?.();
            break;
    }
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
