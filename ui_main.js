// 파일: ui_main.js
// 역할: 게임의 메인 흐름(비전투) UI 함수 (종족 선택, 도시, 2D 탐험 전환)
// [수정] (v9) updateMenu: 전투 종료 후 탐험 화면 복귀 시 맵 상태 유지

import {
    logMessage,
    addButton,
    showModal,
    hideModal,
    updateStatusBars
} from './ui_core.js';

const CITY_NAME = "라프도니아";
const LABIGION_DISTRICT = "라비기온 (7-13구역)";
const LABIGION_BOARD_SIZE = { width: 1280, height: 820 };
const STATUS_PANEL_ID = "status-panel";
const LOG_PANEL_ID = "log-panel";
const STATUS_TOGGLE_ID = "toggle-status-panel";
const LOG_TOGGLE_ID = "toggle-log-panel";

const LABIGION_NODE_LAYOUT = {
    "차원 광장": { x: 640, y: 150, type: "portal" },
    "탐험가 길드 지부": { x: 440, y: 260, type: "guild" },
    "라비기온 중앙 도서관": { x: 285, y: 260, type: "library" },
    "상점가": { x: 815, y: 285, type: "shop" },
    "대신전 (삼신교)": { x: 300, y: 470, type: "temple" },
    "여관": { x: 915, y: 445, type: "inn" },
    "대장간": { x: 520, y: 520, type: "forge" },
    "주점": { x: 730, y: 520, type: "tavern" },
    "환전소": { x: 465, y: 410, type: "exchange" },
    "훈련장": { x: 625, y: 650, type: "training" },
    "공용 승강장": { x: 640, y: 755, type: "travel" },
    "행정청": { x: 870, y: 625, type: "admin" },
    "마탑": { x: 1025, y: 210, type: "tower" }
};

const DISTRICT_LAYOUT = {
    "황도 카르논 (1구역)": { x: 640, y: 52, type: "district" },
    "컴멜비 (2-5구역)": { x: 1175, y: 105, type: "district" },
    "노움트리 (6구역)": { x: 1090, y: 495, type: "district" },
    "비프론 (14구역)": { x: 175, y: 590, type: "district" }
};

const LABIGION_CONNECTIONS = [
    ["차원 광장", "탐험가 길드 지부"],
    ["차원 광장", "상점가"],
    ["탐험가 길드 지부", "대장간"],
    ["탐험가 길드 지부", "환전소"],
    ["상점가", "여관"],
    ["상점가", "주점"],
    ["환전소", "대신전 (삼신교)"],
    ["대장간", "주점"],
    ["주점", "훈련장"],
    ["대장간", "훈련장"],
    ["라비기온 중앙 도서관", "차원 광장"],
    ["훈련장", "공용 승강장"],
    ["공용 승강장", "비프론 (14구역)"],
    ["공용 승강장", "노움트리 (6구역)"],
    ["공용 승강장", "컴멜비 (2-5구역)"],
    ["공용 승강장", "황도 카르논 (1구역)"],
    ["행정청", "공용 승강장"],
    ["행정청", "여관"],
    ["행정청", "마탑"]
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getCityData(player) {
    return player.cb?.gameData?.cities?.[CITY_NAME] || {};
}

let panelToggleInitialized = false;

function setPanelToggleLabel(panelId, toggleId) {
    const panel = document.getElementById(panelId);
    const toggle = document.getElementById(toggleId);
    if (!panel || !toggle) return;
    const collapsed = panel.classList.contains('collapsed');
    const isStatus = panelId === STATUS_PANEL_ID;
    toggle.textContent = collapsed
        ? (isStatus ? "상태 펼치기" : "로그 펼치기")
        : (isStatus ? "상태 접기" : "로그 접기");
    toggle.setAttribute('aria-expanded', String(!collapsed));
}

function initPanelToggles() {
    if (panelToggleInitialized) return;
    const statusPanel = document.getElementById(STATUS_PANEL_ID);
    const logPanel = document.getElementById(LOG_PANEL_ID);
    const statusToggle = document.getElementById(STATUS_TOGGLE_ID);
    const logToggle = document.getElementById(LOG_TOGGLE_ID);
    if (!statusPanel || !logPanel || !statusToggle || !logToggle) return;

    statusToggle.addEventListener('click', () => {
        statusPanel.classList.toggle('collapsed');
        setPanelToggleLabel(STATUS_PANEL_ID, STATUS_TOGGLE_ID);
    });
    logToggle.addEventListener('click', () => {
        logPanel.classList.toggle('collapsed');
        setPanelToggleLabel(LOG_PANEL_ID, LOG_TOGGLE_ID);
    });

    setPanelToggleLabel(STATUS_PANEL_ID, STATUS_TOGGLE_ID);
    setPanelToggleLabel(LOG_PANEL_ID, LOG_TOGGLE_ID);
    panelToggleInitialized = true;
}

function applyCityMapLayout(isCityMap) {
    const mainGame = document.getElementById('main-game');
    const statusPanel = document.getElementById(STATUS_PANEL_ID);
    const logPanel = document.getElementById(LOG_PANEL_ID);
    if (!mainGame || !statusPanel || !logPanel) return;

    mainGame.classList.toggle('city-map-layout', isCityMap);

    if (isCityMap && !mainGame.dataset.cityMapPanelPreset) {
        statusPanel.classList.add('collapsed');
        logPanel.classList.add('collapsed');
        mainGame.dataset.cityMapPanelPreset = "1";
    }

    setPanelToggleLabel(STATUS_PANEL_ID, STATUS_TOGGLE_ID);
    setPanelToggleLabel(LOG_PANEL_ID, LOG_TOGGLE_ID);
}

function revealStatusPanel() {
    const statusPanel = document.getElementById(STATUS_PANEL_ID);
    if (!statusPanel) return;
    statusPanel.classList.remove('collapsed');
    setPanelToggleLabel(STATUS_PANEL_ID, STATUS_TOGGLE_ID);
}

function startLabyrinthRun(player) {
    let layerOne = player.cb.gameData?.layers?.[1] || player.cb.gameData?.maps?.[1];
    if (!layerOne) {
        layerOne = { time_limit: 168, name: "수정동굴" };
    }

    player.mapManager?.resetRunState?.();

    player.position = "Labyrinth";
    player.currentLayer = 1;
    player.daysInLabyrinth = 1;
    player.explorationCount = 0;
    player.timeRemaining = layerOne.time_limit || 168;

    logMessage(`1층 ${layerOne.name}로 진입합니다.`);
    player.questManager?.checkProgress('REACH', '1층', 1);

    updateMenu(player);
    player.showStatus();
}

function renderCityTextMenu(player, menu) {
    menu.classList.remove('city-map-menu');
    menu.innerHTML = '';

    addButton(menu, "라비기온 인터랙티브 맵으로 돌아가기", () => {
        player.position = LABIGION_DISTRICT;
        updateMenu(player);
    });
    addButton(menu, "도시 구역 이동", () => player.cb?.showCityDistricts(player));
    addButton(menu, "현재 구역 활동", () => player.cb?.showCityLocations(player));
    addButton(menu, "미궁 진입 (1층)", () => startLabyrinthRun(player));

    const hr = document.createElement('hr');
    hr.style.borderColor = "var(--color-border)";
    menu.appendChild(hr);
    addButton(menu, "인벤토리", () => showInventory(player));
    addButton(menu, "캐릭터 상태", () => showCharacterStatus(player));
    addButton(menu, "정수 확인", () => showEssences(player));
    addButton(menu, "마법/스킬", () => showSpells(player));
    addButton(menu, "파티원 정보", () => player.cb?.showParty(player));
    addButton(menu, "임무 일지", () => player.cb?.showQuestLog(player));
    addButton(menu, "상태 보기", () => {
        revealStatusPanel();
        player.showStatus();
    });
}

function buildLabigionNodes(player) {
    const cityData = getCityData(player);
    const locations = cityData?.[LABIGION_DISTRICT]?.locations || {};
    const nodes = [];
    let fallbackIndex = 0;

    Object.keys(locations).forEach((name) => {
        const preset = LABIGION_NODE_LAYOUT[name];
        const fallbackX = 220 + (fallbackIndex % 4) * 210;
        const fallbackY = 240 + Math.floor(fallbackIndex / 4) * 160;
        const x = preset?.x ?? fallbackX;
        const y = preset?.y ?? fallbackY;
        const type = preset?.type || "location";
        fallbackIndex++;

        let actionType = "location";
        let actionLabel = `${name} 방문`;
        if (name === "차원 광장") {
            actionType = "labyrinth";
            actionLabel = "미궁 진입";
        } else if (name === "공용 승강장") {
            actionType = "districtMenu";
            actionLabel = "도시 구역 이동";
        } else if (name === "행정청") {
            actionType = "admin";
            actionLabel = "행정청 방문";
        }

        nodes.push({
            id: `loc-${name}`,
            name,
            label: name,
            desc: locations[name]?.desc || "설명이 준비되지 않았습니다.",
            x,
            y,
            type,
            actionType,
            actionLabel
        });
    });

    Object.keys(cityData)
        .filter((districtName) => districtName !== LABIGION_DISTRICT)
        .forEach((districtName, idx) => {
            const preset = DISTRICT_LAYOUT[districtName];
            const x = preset?.x ?? (1020 + (idx % 2) * 100);
            const y = preset?.y ?? (180 + idx * 130);
            nodes.push({
                id: `district-${districtName}`,
                name: districtName,
                label: districtName,
                desc: cityData[districtName]?.desc || "구역 설명이 준비되지 않았습니다.",
                x,
                y,
                type: "district",
                actionType: "districtMove",
                actionLabel: "해당 구역으로 이동"
            });
        });

    nodes.push({
        id: "action-current-location",
        name: "현재 구역 활동",
        label: "현재 구역 활동",
        desc: `${player.position}에서 가능한 활동 장소를 바로 확인합니다.`,
        x: 1035,
        y: 700,
        type: "utility",
        actionType: "currentLocation",
        actionLabel: "구역 활동 보기"
    });

    return nodes;
}

function tryMoveToDistrict(player, districtName) {
    if (districtName.includes("1구역") && (player.specialStats?.['명성']?.value || 0) < 50) {
        logMessage("명성이 부족하여 황도 카르논에 입장할 수 없습니다. (요구 명성: 50)");
        return false;
    }
    player.position = districtName;
    logMessage(`${districtName}(으)로 이동했습니다.`);
    player.questManager?.checkProgress('REACH', districtName, 1);
    return true;
}

function leaveCityMapMode() {
    document.getElementById('menu')?.classList.remove('city-map-menu');
}

function activateCityMapNode(player, node) {
    if (!node) return;
    leaveCityMapMode();

    switch (node.actionType) {
        case "labyrinth":
            startLabyrinthRun(player);
            break;
        case "districtMenu":
            player.position = LABIGION_DISTRICT;
            player.cb?.showCityDistricts(player);
            break;
        case "districtMove":
            if (tryMoveToDistrict(player, node.name)) {
                player.cb?.showCityLocations(player);
            }
            break;
        case "currentLocation":
            player.cb?.showCityLocations(player);
            break;
        case "admin":
            player.position = LABIGION_DISTRICT;
            logMessage("행정청 업무는 순차적으로 확장 예정입니다. 현재는 방문 기록만 남깁니다.");
            break;
        case "location":
        default:
            player.position = LABIGION_DISTRICT;
            player.cb?.handleCityAction(player, node.name);
            break;
    }
}

function addCityConnection(board, from, to, style = "main") {
    if (!from || !to) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt((dx * dx) + (dy * dy));
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const line = document.createElement('div');
    line.className = `city-map-link ${style}`;
    line.style.left = `${from.x}px`;
    line.style.top = `${from.y}px`;
    line.style.width = `${distance}px`;
    line.style.transform = `translateY(-50%) rotate(${angle}deg)`;
    board.appendChild(line);
}

function renderCityMapMenu(player, menu) {
    const cityData = getCityData(player);
    const labigion = cityData?.[LABIGION_DISTRICT];
    if (!labigion?.locations) {
        renderCityTextMenu(player, menu);
        return;
    }

    menu.classList.add('city-map-menu');
    menu.innerHTML = '';

    const shell = document.createElement('section');
    shell.className = 'city-map-shell';
    menu.appendChild(shell);

    const header = document.createElement('header');
    header.className = 'city-map-header';
    header.innerHTML = `
        <h3>라비기온 인터랙티브 지도</h3>
        <p>노드를 선택한 뒤 오른쪽 패널의 버튼으로 이벤트를 진행하세요. 드래그로 이동, 휠로 확대/축소, Shift+드래그(또는 우클릭 드래그)로 회전할 수 있습니다.</p>
    `;
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'city-map-body';
    shell.appendChild(body);

    const viewport = document.createElement('div');
    viewport.className = 'city-map-viewport';
    body.appendChild(viewport);

    const camera = document.createElement('div');
    camera.className = 'city-map-camera';
    viewport.appendChild(camera);

    const board = document.createElement('div');
    board.className = 'city-map-board';
    board.style.width = `${LABIGION_BOARD_SIZE.width}px`;
    board.style.height = `${LABIGION_BOARD_SIZE.height}px`;
    camera.appendChild(board);

    const infoPanel = document.createElement('aside');
    infoPanel.className = 'city-map-info-panel';
    body.appendChild(infoPanel);

    const infoCurrent = document.createElement('p');
    infoCurrent.className = 'city-map-current';
    infoCurrent.textContent = `현재 위치: ${player.position || LABIGION_DISTRICT}`;
    infoPanel.appendChild(infoCurrent);

    const infoTitle = document.createElement('h4');
    infoTitle.className = 'city-map-info-title';
    infoPanel.appendChild(infoTitle);

    const infoDesc = document.createElement('p');
    infoDesc.className = 'city-map-info-desc';
    infoPanel.appendChild(infoDesc);

    const actionButton = document.createElement('button');
    actionButton.className = 'city-map-go-btn';
    infoPanel.appendChild(actionButton);

    const cameraInfo = document.createElement('p');
    cameraInfo.className = 'city-map-camera-readout';
    infoPanel.appendChild(cameraInfo);

    const cameraControls = document.createElement('div');
    cameraControls.className = 'city-map-camera-controls';
    infoPanel.appendChild(cameraControls);

    const controls = [
        { label: "확대", run: (state) => { state.zoom = clamp(state.zoom + 0.08, 0.62, 1.65); } },
        { label: "축소", run: (state) => { state.zoom = clamp(state.zoom - 0.08, 0.62, 1.65); } },
        { label: "좌회전", run: (state) => { state.rotation -= 10; } },
        { label: "우회전", run: (state) => { state.rotation += 10; } },
        {
            label: "원위치",
            run: (state) => {
                state.panX = 0;
                state.panY = 0;
                state.zoom = 1;
                state.rotation = 0;
                state.tiltX = 0;
                state.tiltY = 0;
            }
        }
    ];

    const quickActions = document.createElement('div');
    quickActions.className = 'city-map-quick-actions';
    shell.appendChild(quickActions);

    const quickButtons = [
        ["인벤토리", () => showInventory(player)],
        ["캐릭터 상태", () => showCharacterStatus(player)],
        ["정수 확인", () => showEssences(player)],
        ["마법/스킬", () => showSpells(player)],
        ["파티원 정보", () => player.cb?.showParty(player)],
        ["임무 일지", () => player.cb?.showQuestLog(player)],
        ["상태 보기", () => {
            revealStatusPanel();
            player.showStatus();
        }],
        ["도시 텍스트 메뉴", () => renderCityTextMenu(player, menu)]
    ];
    quickButtons.forEach(([label, handler]) => {
        const btn = addButton(quickActions, label, handler);
        btn.classList.add('city-map-quick-btn');
    });

    const nodes = buildLabigionNodes(player);
    if (nodes.length === 0) {
        renderCityTextMenu(player, menu);
        return;
    }

    const nodeMap = new Map();
    const nodeButtonMap = new Map();
    nodes.forEach((node) => nodeMap.set(node.name, node));

    LABIGION_CONNECTIONS.forEach(([fromName, toName]) => {
        const from = nodeMap.get(fromName);
        const to = nodeMap.get(toName);
        const style = (from?.type === "district" || to?.type === "district") ? "district" : "main";
        addCityConnection(board, from, to, style);
    });

    let selectedNode = nodes.find((node) => node.name === player.position) || nodes[0];
    let cameraState = {
        panX: 0,
        panY: 0,
        zoom: 1,
        rotation: 0,
        tiltX: 0,
        tiltY: 0
    };

    function applyCameraTransform() {
        camera.style.transform =
            `translate(calc(-50% + ${cameraState.panX}px), calc(-50% + ${cameraState.panY}px)) ` +
            `rotateX(${cameraState.tiltX.toFixed(2)}deg) rotateY(${cameraState.tiltY.toFixed(2)}deg) ` +
            `rotateZ(${cameraState.rotation.toFixed(2)}deg) scale(${cameraState.zoom.toFixed(3)})`;
        cameraInfo.textContent =
            `줌 ${Math.round(cameraState.zoom * 100)}% | 회전 ${Math.round(cameraState.rotation)}deg`;
    }

    function setSelectedNode(node) {
        if (!node) return;
        selectedNode = node;

        nodeButtonMap.forEach((btn, nodeId) => {
            btn.classList.toggle('active', nodeId === selectedNode.id);
        });

        infoTitle.textContent = node.label;
        infoDesc.textContent = node.desc;
        actionButton.textContent = node.actionLabel || "이동";
    }

    nodes.forEach((node) => {
        const nodeButton = document.createElement('button');
        nodeButton.type = 'button';
        nodeButton.className = `city-map-node node-${node.type}`;
        nodeButton.style.left = `${node.x}px`;
        nodeButton.style.top = `${node.y}px`;
        nodeButton.innerHTML = `
            <span class="city-map-node-label">${node.label}</span>
            <span class="city-map-node-type">${node.actionLabel || "이동"}</span>
        `;
        nodeButton.addEventListener('mouseenter', () => setSelectedNode(node));
        nodeButton.addEventListener('focus', () => setSelectedNode(node));
        nodeButton.addEventListener('click', () => setSelectedNode(node));
        board.appendChild(nodeButton);
        nodeButtonMap.set(node.id, nodeButton);
    });

    actionButton.onclick = () => activateCityMapNode(player, selectedNode);

    controls.forEach((control) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = control.label;
        btn.className = 'city-map-control-btn';
        btn.onclick = () => {
            control.run(cameraState);
            applyCameraTransform();
        };
        cameraControls.appendChild(btn);
    });

    let dragState = null;

    function resetTilt() {
        if (dragState) return;
        cameraState.tiltX = 0;
        cameraState.tiltY = 0;
        applyCameraTransform();
    }

    function finishDrag(event) {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        viewport.releasePointerCapture?.(dragState.pointerId);
        viewport.classList.remove('is-panning', 'is-rotating');
        dragState = null;
    }

    viewport.addEventListener('contextmenu', (event) => event.preventDefault());
    viewport.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 && event.button !== 2) return;
        event.preventDefault();
        dragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            basePanX: cameraState.panX,
            basePanY: cameraState.panY,
            baseRotation: cameraState.rotation,
            mode: (event.button === 2 || event.shiftKey) ? 'rotate' : 'pan'
        };
        viewport.classList.toggle('is-panning', dragState.mode === 'pan');
        viewport.classList.toggle('is-rotating', dragState.mode === 'rotate');
        viewport.setPointerCapture?.(event.pointerId);
    });

    viewport.addEventListener('pointermove', (event) => {
        if (dragState && dragState.pointerId === event.pointerId) {
            const dx = event.clientX - dragState.startX;
            const dy = event.clientY - dragState.startY;
            if (dragState.mode === 'pan') {
                cameraState.panX = dragState.basePanX + dx;
                cameraState.panY = dragState.basePanY + dy;
            } else {
                cameraState.rotation = dragState.baseRotation + (dx * 0.18);
                cameraState.panY = dragState.basePanY + (dy * 0.18);
            }
            applyCameraTransform();
            return;
        }

        const rect = viewport.getBoundingClientRect();
        const nx = ((event.clientX - rect.left) / rect.width) - 0.5;
        const ny = ((event.clientY - rect.top) / rect.height) - 0.5;
        cameraState.tiltY = clamp(nx * 14, -8, 8);
        cameraState.tiltX = clamp(-ny * 10, -6, 6);
        applyCameraTransform();
    });

    viewport.addEventListener('pointerup', finishDrag);
    viewport.addEventListener('pointercancel', finishDrag);
    viewport.addEventListener('pointerleave', resetTilt);

    viewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        cameraState.zoom = clamp(cameraState.zoom - (event.deltaY * 0.0011), 0.62, 1.65);
        applyCameraTransform();
    }, { passive: false });

    setSelectedNode(selectedNode);
    applyCameraTransform();
}

// (initRaceSelection 함수 생략 - 기존과 동일)
export function initRaceSelection(player) {
    const raceSelectionDiv = document.getElementById('race-selection');
    const racesListDiv = document.getElementById('races-list');
    const mainGameDiv = document.getElementById('main-game');

    if (raceSelectionDiv && racesListDiv && mainGameDiv) {
        raceSelectionDiv.style.display = 'block';
        mainGameDiv.classList.add('hidden');
        mainGameDiv.style.display = 'none';

        racesListDiv.innerHTML = '';
        const races = player.cb?.gameData?.races || {};
        
        Object.keys(races).forEach(race => {
            addButton(racesListDiv, `${race} - ${races[race].description}`, () => {
                player.chooseRace(race);
                raceSelectionDiv.style.display = 'none';
                mainGameDiv.classList.remove('hidden');
                mainGameDiv.style.display = 'grid'; 
                logMessage("던전 앤 스톤의 세계에 온 것을 환영합니다. 도시에서 탐험을 준비하세요.");
                if (player.cb && player.cb.playMusic) player.cb.playMusic('bgm-city');
                updateMenu(player); 
                player.showStatus(); 
            });
        });
    } else {
        console.error("Race selection elements not found!");
    }
}


/**
 * 플레이어 위치에 따라 메인 메뉴 갱신
 * @param {Player} player - 플레이어 객체
 */
export function updateMenu(player) {
    const menu = document.getElementById('menu');
    const combatScreen = document.getElementById('combat-screen');
    const explorationScreen = document.getElementById('exploration-screen');
    const mainGameDiv = document.getElementById('main-game'); 

    if (!menu || !combatScreen || !explorationScreen || !mainGameDiv) return;
    initPanelToggles();

    // 1. BGM 재생
    if (player.cb && player.cb.playMusic) {
        if (player.position === "Labyrinth" || player.position === "Rift") {
            player.cb.playMusic('bgm-dungeon');
        } else { 
            player.cb.playMusic('bgm-city');
        }
    }

    // 2. 화면 초기화 (일단 모두 숨김)
    menu.classList.add('hidden');
    menu.classList.remove('city-map-menu');
    combatScreen.classList.add('hidden');
    explorationScreen.classList.add('hidden');
    mainGameDiv.style.display = 'grid';
    applyCityMapLayout(false);

    updateStatusBars(player); 

    // ---------------------------------------------------------
    // Case A: 균열(Rift) - 기존 텍스트 방식
    // ---------------------------------------------------------
    if (player.position === "Rift") {
        menu.classList.remove('hidden'); 
        menu.innerHTML = '';
        // (균열 로직 - 기존 코드와 동일)
        if (!player.currentRift || !player.currentRift.stages) {
            logMessage("오류: 유효하지 않은 균열입니다.");
            player.position = "라비기온 (7-13구역)"; 
            updateMenu(player);
            return;
        }
        const stage = player.currentRift.stages[player.currentRiftStage];
        if (!stage) {
            logMessage(`[${player.currentRift.name}] 균열 탐사가 완료되었습니다.`);
            player.position = "라비기온 (7-13구역)"; 
            player.currentRift = null;
            updateMenu(player);
            return;
        }
        logMessage(`현재 위치: [${player.currentRift.name}] 균열 - ${stage.name}`);
        addButton(menu, `균열 탐사: ${stage.name} 진입`, () => {
            logMessage(`[${stage.name}]으로 진입합니다...`);
            if (stage.event) {
                logMessage(`[균열 이벤트] ${stage.event}`);
            }
            let monstersToSpawn = [];
            if (stage.monsters) monstersToSpawn = monstersToSpawn.concat(stage.monsters);
            if (stage.boss) {
                if (Array.isArray(stage.boss)) monstersToSpawn = monstersToSpawn.concat(stage.boss);
                else monstersToSpawn.push(stage.boss);
            }
            if (monstersToSpawn.length > 0) player.startCombat(monstersToSpawn);
            else {
                // 이벤트 전용 스테이지: 리스크/보상 부여
                const gain = 30 + Math.floor(Math.random() * 71); // 30~100
                player.magic_stones += gain;
                if (Math.random() < 0.35) {
                    const dmg = 15 + Math.floor(Math.random() * 26); // 15~40
                    player.hp = Math.max(1, player.hp - dmg);
                    logMessage(`균열의 난류로 ${dmg} 피해를 입었다.`);
                }
                logMessage(`균열의 핵 조각을 회수했다. (마석 +${gain})`);
                player.currentRiftStage++;
                updateMenu(player);
                player.showStatus();
            }
        });
        addButton(menu, "균열 포기 (도시로 귀환)", () => {
            if (confirm("균열 탐사를 포기하시겠습니까?")) {
                player.position = "라비기온 (7-13구역)";
                player.currentRift = null;
                updateMenu(player);
            }
        });
    }

    // ---------------------------------------------------------
    // Case B: 미궁(Labyrinth) - 2D 탐험 모드
    // ---------------------------------------------------------
    else if (player.position === "Labyrinth") {
        explorationScreen.classList.remove('hidden'); // 맵 표시
        
        if (player.mapManager) {
            // [핵심] enterFloor를 호출하면, 내부적으로
            // 새로운 층이면 맵 생성, 기존 층이면 UI 갱신만 수행함.
            player.mapManager.enterFloor(player.currentLayer);
        } else {
            logMessage("오류: MapManager가 초기화되지 않았습니다.");
            player.position = "라비기온 (7-13구역)";
            updateMenu(player);
        }
    }

    // ---------------------------------------------------------
    // Case C: 도시(City)
    // ---------------------------------------------------------
    else {
        menu.classList.remove('hidden');
        if (player.position === LABIGION_DISTRICT) {
            applyCityMapLayout(true);
            renderCityMapMenu(player, menu);
        } else {
            renderCityTextMenu(player, menu);
        }
    }
}

// (showPortalChoice, showRiftEntryModal, showInventory 등 기존 함수들 생략 없이 포함 - 이전 답변과 동일)
// ... (showPortalChoice, showRiftEntryModal, showInventory, showEssences, showSpells 코드 유지) ...
export function showPortalChoice(player, nextLayer, currentLayer = null) {
    // 모달 방식으로 변경
    const modal = document.getElementById('portal-choice-screen');
    if (!modal) {
        // 모달이 없으면 기존 방식 사용
        const menu = document.getElementById('menu');
        const explorationScreen = document.getElementById('exploration-screen');
        if (!menu) return;
        if(explorationScreen) explorationScreen.classList.add('hidden');
        menu.classList.remove('hidden');
        menu.innerHTML = ''; 

        const nextLayerData = player.cb.gameData?.layers?.[nextLayer] || player.cb.gameData?.maps?.[nextLayer];
        const layerName = nextLayerData ? nextLayerData.name : (nextLayer === "Ending" ? "심연의 끝" : nextLayer === "City" ? "도시" : `${nextLayer}층`);

        // 1층에서 나가기 옵션
        if (currentLayer === 1 && nextLayer === 2) {
            logMessage(`[차원 비석] 발견!`);
            addButton(menu, "도시로 나간다", () => {
                exitLabyrinth(player);
            });
            addButton(menu, `2층으로 이동한다`, () => {
                handlePortalTransition(player, nextLayer, layerName);
            });
            addButton(menu, "머무른다 (현재 층 탐색)", () => {
                logMessage("현재 층에 머무르기로 했다.");
                if(explorationScreen) explorationScreen.classList.remove('hidden');
                menu.classList.add('hidden');
            });
            return;
        }

        logMessage(`[차원 비석] ${layerName}(으)로 이동하시겠습니까?`);

        // 다른 층에서 내려가기 옵션 추가
        if (currentLayer && currentLayer > 1) {
            const prevLayer = currentLayer - 1;
            const prevLayerData = player.cb.gameData?.layers?.[prevLayer] || player.cb.gameData?.maps?.[prevLayer];
            const prevLayerName = prevLayerData ? prevLayerData.name : `${prevLayer}층`;
            addButton(menu, `아래 층으로 이동한다 (${prevLayerName})`, () => {
                handlePortalTransition(player, prevLayer, prevLayerName);
            });
        }

        addButton(menu, `이동한다 (${layerName})`, () => {
            handlePortalTransition(player, nextLayer, layerName);
        });

        addButton(menu, "머무른다 (현재 층 탐색)", () => {
            logMessage("현재 층에 머무르기로 했다.");
            if(explorationScreen) explorationScreen.classList.remove('hidden');
            menu.classList.add('hidden');
        });
        return;
    }

    // 모달 UI 사용
    const title = document.getElementById('portal-choice-title');
    const desc = document.getElementById('portal-choice-desc');
    const buttonList = document.getElementById('portal-choice-buttons');

    const nextLayerData = player.cb.gameData?.layers?.[nextLayer] || player.cb.gameData?.maps?.[nextLayer];
    const currentLayerData = currentLayer ? (player.cb.gameData?.layers?.[currentLayer] || player.cb.gameData?.maps?.[currentLayer]) : null;
    const layerName = nextLayerData ? nextLayerData.name : (nextLayer === "Ending" ? "심연의 끝" : nextLayer === "City" ? "도시" : `${nextLayer}층`);
    const currentLayerName = currentLayerData ? currentLayerData.name : (currentLayer ? `${currentLayer}층` : "현재 층");
    const layerDesc = nextLayerData ? (nextLayerData.description || "") : "";

    buttonList.innerHTML = '';
    title.innerHTML = `<i class="icon-map"></i> [차원 비석] 발견`;
    
    // 1층에서 나가기 옵션
    if (currentLayer === 1 && nextLayer === 2) {
        desc.innerHTML = `
            <p><strong>현재 위치:</strong> ${currentLayerName}</p>
            <p style="margin-top: 15px;">차원 비석을 발견했습니다. 어디로 이동하시겠습니까?</p>
        `;
        
        addButton(buttonList, "도시로 나간다", () => {
            hideModal('#portal-choice-screen');
            exitLabyrinth(player);
        });
        
        addButton(buttonList, `2층으로 이동한다`, () => {
            hideModal('#portal-choice-screen');
            handlePortalTransition(player, nextLayer, layerName);
        });
        
        addButton(buttonList, "머무른다 (현재 층 탐색)", () => {
            logMessage("현재 층에 머무르기로 했다.");
            hideModal('#portal-choice-screen');
        });
    } else {
        desc.innerHTML = `
            <p><strong>현재 위치:</strong> ${currentLayerName}</p>
            <p><strong>목적지:</strong> ${layerName}</p>
            ${layerDesc ? `<p style="font-style: italic; color: var(--color-text-secondary); margin-top: 10px;">${layerDesc}</p>` : ''}
            <p style="margin-top: 15px;">다음 층으로 이동하시겠습니까?</p>
        `;

        // 다른 층에서 내려가기 옵션 추가
        if (currentLayer && currentLayer > 1) {
            const prevLayer = currentLayer - 1;
            const prevLayerData = player.cb.gameData?.layers?.[prevLayer] || player.cb.gameData?.maps?.[prevLayer];
            const prevLayerName = prevLayerData ? prevLayerData.name : `${prevLayer}층`;
            addButton(buttonList, `아래 층으로 이동한다 (${prevLayerName})`, () => {
                hideModal('#portal-choice-screen');
                handlePortalTransition(player, prevLayer, prevLayerName);
            });
        }

        addButton(buttonList, `이동한다 (${layerName})`, () => {
            hideModal('#portal-choice-screen');
            handlePortalTransition(player, nextLayer, layerName);
        });

        addButton(buttonList, "머무른다 (현재 층 탐색)", () => {
            logMessage("현재 층에 머무르기로 했다.");
            hideModal('#portal-choice-screen');
        });
    }

    showModal('#portal-choice-screen');
}

/**
 * [신규] 미궁에서 나가기 (1층 차원 비석에서만)
 */
function exitLabyrinth(player) {
    if (player.position !== "Labyrinth") {
        logMessage("미궁에 있지 않습니다.");
        return;
    }
    
    if (player.currentLayer !== 1) {
        logMessage("1층에서만 도시로 나갈 수 있습니다.");
        return;
    }
    
    if (confirm("도시로 돌아가시겠습니까?")) {
        player.position = "라비기온 (7-13구역)";
        player.mapManager?.resetRunState?.();
        logMessage("도시로 돌아왔습니다.");
        player.cb?.playMusic?.('bgm-city');
        player.cb?.updateMenu?.(player);
        player.showStatus();
    }
}

function handlePortalTransition(player, nextLayer, layerName) {
    if (nextLayer === "Ending") {
        alert("축하합니다! 게임 클리어!");
        location.reload();
        return;
    }
    
    player.position = "Labyrinth";
    player.currentLayer = nextLayer;
    // currentMapId를 미리 덮어쓰면 재진입으로 오인되어 맵 전환이 막힐 수 있음
    player.currentMapId = null;
    player.daysInLabyrinth = 1; 
    
    const nextData = player.cb.gameData?.layers?.[nextLayer] || player.cb.gameData?.maps?.[nextLayer];
    player.timeRemaining = nextData ? (nextData.time_limit || 168) : 168;

    logMessage(`${layerName}(으)로 진입합니다.`);
    player.questManager?.checkProgress('REACH', `${nextLayer}층`, 1);

    // [중요] updateMenu를 호출하여 새로운 층의 맵이 표시되도록 함
    updateMenu(player); 
    player.showStatus();
}

export function showRiftEntryModal(player, rift) {
    const modal = document.getElementById('rift-choice-screen');
    const title = document.getElementById('rift-choice-title');
    const desc = document.getElementById('rift-choice-desc');
    const buttonList = document.getElementById('rift-choice-buttons');

    if (!modal) return;

    buttonList.innerHTML = '';
    title.innerHTML = `<i class="icon-combat"></i> [${rift.name}] 균열 발견!`;
    desc.textContent = rift.description || "불안정한 차원의 틈새를 발견했습니다.";

    addButton(buttonList, "입장한다", () => {
        player.position = "Rift"; 
        player.currentRift = rift; 
        player.currentRiftStage = 0; 
        logMessage(`[${rift.name}] 균열 속으로 진입합니다...`);
        hideModal('#rift-choice-screen');
        updateMenu(player); 
        player.showStatus();
    });

    addButton(buttonList, "입장하지 않는다", () => {
        logMessage("균열을 무시하고 탐색을 계속합니다.");
        hideModal('#rift-choice-screen');
    });
    showModal('#rift-choice-screen');
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

export function showCharacterStatus(player) {
    const modal = document.getElementById('character-status-screen');
    const content = document.getElementById('character-status-content');
    const closeButton = document.getElementById('character-status-close');
    if (!modal || !content) return;

    const slotOrder = [
        { key: '투구', className: 'slot-helmet' },
        { key: '갑옷', className: 'slot-chest' },
        { key: '장갑', className: 'slot-gloves' },
        { key: '각반', className: 'slot-legs' },
        { key: '무기', className: 'slot-weapon' },
        { key: '부무기', className: 'slot-offhand' }
    ];

    const equipment = player.equipment || {};
    const occupied = slotOrder.filter((slot) => Boolean(equipment[slot.key])).length;
    const slotBadges = slotOrder.map((slot) => {
        const item = equipment[slot.key];
        const isEquipped = Boolean(item);
        return `
            <div class="paperdoll-slot ${slot.className} ${isEquipped ? 'equipped' : 'empty'}">
                <span class="slot-name">${slot.key}</span>
                <span class="slot-item">${isEquipped ? escapeHtml(item) : '비어 있음'}</span>
            </div>
        `;
    }).join('');

    const slotCards = slotOrder.map((slot) => {
        const item = equipment[slot.key];
        const isEquipped = Boolean(item);
        return `
            <div class="character-slot-card ${isEquipped ? 'equipped' : 'empty'}">
                <div class="slot-card-name">${slot.key}</div>
                <div class="slot-card-item">${isEquipped ? escapeHtml(item) : '장착 안됨'}</div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div class="character-status-layout">
            <div class="paperdoll-wrap">
                <div class="paperdoll-stage">
                    <div class="paperdoll-figure" aria-hidden="true">
                        <span class="figure-part head"></span>
                        <span class="figure-part torso"></span>
                        <span class="figure-part arm left"></span>
                        <span class="figure-part arm right"></span>
                        <span class="figure-part leg left"></span>
                        <span class="figure-part leg right"></span>
                    </div>
                    ${slotBadges}
                </div>
                <p class="character-summary">장착 장비 ${occupied}/6</p>
            </div>
            <div class="character-slot-list">
                ${slotCards}
            </div>
        </div>
    `;

    showModal('#character-status-screen');
    if (closeButton) {
        closeButton.onclick = () => hideModal('#character-status-screen');
    }
}

function normalizeEquipmentSlot(type) {
    if (!type) return null;
    if (['검', '창', '횃불'].includes(type)) return '무기';
    if (['방패', '시계'].includes(type)) return '부무기';
    if (['부츠'].includes(type)) return '각반';
    return type;
}

function getInventoryItemMeta(player, itemName, count) {
    const itemData =
        player.cb?.gameData?.items?.[itemName] ||
        player.cb?.gameData?.numbersItems?.[itemName] ||
        player.cb?.gameData?.shopItems?.[itemName] ||
        player.cb?.gameData?.materials?.[itemName] ||
        { desc: "정보 없음" };

    const functionalData =
        player.cb?.gameData?.items?.[itemName] ||
        player.cb?.gameData?.numbersItems?.[itemName];

    const equipSlot = normalizeEquipmentSlot(itemData.type);
    const isEquipment = Boolean(equipSlot && player.equipment?.hasOwnProperty(equipSlot));
    const isUsable = Boolean(functionalData && typeof functionalData.effect === 'function' && (!itemData.type || ['소모품', '설치품', '도구'].includes(itemData.type)));
    const isMaterial = Boolean(player.cb?.gameData?.materials?.[itemName]);

    let category = 'misc';
    if (isEquipment) category = 'equipment';
    else if (isUsable) category = 'consumable';
    else if (isMaterial || itemData.type === '재료') category = 'material';

    return {
        name: itemName,
        count,
        itemData,
        functionalData,
        equipSlot,
        isEquipment,
        isUsable,
        isMaterial,
        category
    };
}

export function showInventory(player) {
    const inventoryScreenDiv = document.getElementById('inventory-screen');
    const inventoryListDiv = document.getElementById('inventory-list');
    const backButton = inventoryScreenDiv ? inventoryScreenDiv.querySelector('.modal-close-btn') : null;
    if (!inventoryScreenDiv) return;
    const modalContent = inventoryScreenDiv.querySelector('.modal-content');
    if (modalContent) modalContent.classList.add('inventory-rpg-modal');

    const itemCounts = (player.inventory || []).reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});
    const itemEntries = Object.entries(itemCounts)
        .map(([itemName, count]) => getInventoryItemMeta(player, itemName, count))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const slotOrder = ['투구', '갑옷', '장갑', '각반', '무기', '부무기'];
    const equippedCount = slotOrder.reduce((count, slot) => count + (player.equipment?.[slot] ? 1 : 0), 0);

    inventoryListDiv.innerHTML = `
        <div class="inventory-rpg-layout">
            <section class="inventory-equip-panel">
                <div class="inv-panel-head">
                    <h3>장비 슬롯</h3>
                    <span>${equippedCount}/6 장착</span>
                </div>
                <div class="inv-equip-grid" id="inv-equip-grid"></div>
            </section>
            <section class="inventory-bag-panel">
                <div class="inv-panel-head">
                    <h3>가방</h3>
                    <span>총 ${itemEntries.reduce((sum, item) => sum + item.count, 0)}개</span>
                </div>
                <div class="inv-filter-tabs" id="inv-filter-tabs">
                    <button type="button" class="inv-filter-btn active" data-filter="all">전체</button>
                    <button type="button" class="inv-filter-btn" data-filter="equipment">장비</button>
                    <button type="button" class="inv-filter-btn" data-filter="consumable">소모품</button>
                    <button type="button" class="inv-filter-btn" data-filter="material">재료</button>
                    <button type="button" class="inv-filter-btn" data-filter="misc">기타</button>
                </div>
                <div class="inv-item-grid" id="inv-item-grid"></div>
            </section>
            <aside class="inventory-detail-panel" id="inv-detail-panel">
                <div class="inv-panel-head">
                    <h3>아이템 정보</h3>
                </div>
                <div class="inv-detail-body" id="inv-detail-body">
                    <p class="inv-empty-guide">아이템을 선택하면 상세 정보와 행동 버튼이 표시됩니다.</p>
                </div>
            </aside>
        </div>
    `;

    const equipGrid = document.getElementById('inv-equip-grid');
    const itemGrid = document.getElementById('inv-item-grid');
    const detailBody = document.getElementById('inv-detail-body');
    const filterTabs = document.getElementById('inv-filter-tabs');

    let selectedItemName = null;
    let currentFilter = 'all';

    function renderEquipmentSlots() {
        if (!equipGrid) return;
        equipGrid.innerHTML = '';
        slotOrder.forEach((slot) => {
            const equippedItem = player.equipment?.[slot];
            const slotBtn = document.createElement('button');
            slotBtn.type = 'button';
            slotBtn.className = `inv-equip-slot ${equippedItem ? 'equipped' : 'empty'}`;
            slotBtn.innerHTML = `
                <span class="slot-label">${slot}</span>
                <span class="slot-item">${equippedItem ? escapeHtml(equippedItem) : '비어 있음'}</span>
            `;
            if (equippedItem) {
                slotBtn.onclick = () => {
                    player.unequipItem(slot);
                    showInventory(player);
                };
            } else {
                slotBtn.disabled = true;
            }
            equipGrid.appendChild(slotBtn);
        });
    }

    function getVisibleItems() {
        if (currentFilter === 'all') return itemEntries;
        return itemEntries.filter((item) => item.category === currentFilter);
    }

    function renderDetail(meta) {
        if (!detailBody) return;
        if (!meta) {
            detailBody.innerHTML = `<p class="inv-empty-guide">아이템을 선택하면 상세 정보와 행동 버튼이 표시됩니다.</p>`;
            return;
        }

        const equippedBySlot = meta.isEquipment ? player.equipment?.[meta.equipSlot] === meta.name : false;
        const typeLabel = meta.itemData?.type || '미분류';
        const tierLabel = meta.itemData?.tier ? `${meta.itemData.tier}티어` : '일반';
        const canAct = meta.isUsable || meta.isEquipment;
        const actionLabel = meta.isEquipment
            ? (equippedBySlot ? '장착 해제' : '장착')
            : (meta.isUsable ? '사용' : '사용 불가');

        detailBody.innerHTML = `
            <h4 class="inv-detail-title">${escapeHtml(meta.name)}</h4>
            <p class="inv-detail-line"><b>수량:</b> ${meta.count}개</p>
            <p class="inv-detail-line"><b>종류:</b> ${escapeHtml(typeLabel)}</p>
            <p class="inv-detail-line"><b>등급:</b> ${escapeHtml(tierLabel)}</p>
            ${meta.equipSlot ? `<p class="inv-detail-line"><b>장착 부위:</b> ${meta.equipSlot}</p>` : ''}
            <p class="inv-detail-desc">${escapeHtml(meta.itemData?.desc || '설명이 없습니다.')}</p>
            <button type="button" class="inv-detail-action" ${canAct ? '' : 'disabled'}>${actionLabel}</button>
        `;

        const actionButton = detailBody.querySelector('.inv-detail-action');
        if (!actionButton || !canAct) return;

        actionButton.onclick = () => {
            if (meta.isUsable && !meta.isEquipment) {
                hideModal('#inventory-screen');
                player.useItem(meta.name);
                return;
            }

            if (meta.isEquipment && meta.equipSlot) {
                if (equippedBySlot) {
                    player.unequipItem(meta.equipSlot);
                } else {
                    const originalSlot = meta.itemData?.type || meta.equipSlot;
                    if (originalSlot === meta.equipSlot) {
                        player.equipItem(meta.name);
                    } else {
                        player.unequipItem(meta.equipSlot);
                        player.equipment[meta.equipSlot] = meta.name;
                        const index = player.inventory.indexOf(meta.name);
                        if (index > -1) player.inventory.splice(index, 1);
                        player.cb?.logMessage?.(`${meta.name}을(를) ${meta.equipSlot} 부위에 장착했다.`);
                        player.cb?.playSfx?.('sfx-event');
                        player.calculateStats?.();
                        player.showStatus?.();
                    }
                }
                showInventory(player);
            }
        };
    }

    function renderItemGrid() {
        if (!itemGrid) return;
        itemGrid.innerHTML = '';

        const visibleItems = getVisibleItems();
        if (visibleItems.length === 0) {
            itemGrid.innerHTML = `<p class="inv-empty-guide">해당 분류에 아이템이 없습니다.</p>`;
            renderDetail(null);
            return;
        }

        visibleItems.forEach((meta) => {
            const isSelected = selectedItemName === meta.name;
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `inv-item-card ${meta.category} ${isSelected ? 'selected' : ''}`;
            card.innerHTML = `
                <span class="inv-item-name">${escapeHtml(meta.name)}</span>
                <span class="inv-item-meta">${escapeHtml(meta.itemData?.type || '미분류')}</span>
                <span class="inv-item-count">x${meta.count}</span>
            `;
            card.onclick = () => {
                selectedItemName = meta.name;
                renderItemGrid();
                renderDetail(meta);
            };
            itemGrid.appendChild(card);
        });

        const selectedMeta = visibleItems.find((item) => item.name === selectedItemName) || visibleItems[0];
        selectedItemName = selectedMeta.name;
        renderDetail(selectedMeta);
    }

    filterTabs?.querySelectorAll('.inv-filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter || 'all';
            filterTabs.querySelectorAll('.inv-filter-btn').forEach((node) => node.classList.remove('active'));
            btn.classList.add('active');
            selectedItemName = null;
            renderItemGrid();
        });
    });

    renderEquipmentSlots();
    renderItemGrid();

    showModal('#inventory-screen');
    if (backButton) {
        backButton.onclick = () => hideModal('#inventory-screen');
    }
}

export function showEssences(player) {
    const essencesScreenDiv = document.getElementById('essences-screen');
    const essencesListDiv = document.getElementById('essences-list');
    const backButton = essencesScreenDiv ? essencesScreenDiv.querySelector('.modal-close-btn') : null;
    if (!essencesScreenDiv) return;

    let maxEssences = player.level * 3;
    if (player.essences?.includes("디아몬트")) maxEssences -= 1;
    essencesListDiv.innerHTML = `
        <div class="modal-grid-head">
            <h3>보유 정수</h3>
            <span>${player.essences.length}/${maxEssences}</span>
        </div>
        <div class="modal-card-grid" id="essence-card-grid"></div>
    `;

    const grid = document.getElementById('essence-card-grid');
    if (!grid) return;

    if (player.essences.length === 0) {
        grid.innerHTML = `<p class="modal-empty-text">흡수한 정수가 없습니다.</p>`;
    } else {
        player.essences.forEach(essenceName => {
            const essence = player.cb?.gameData?.essences?.[essenceName];
            const passiveList = essence?.passive ? (Array.isArray(essence.passive) ? essence.passive : [essence.passive]) : [];
            const activeList = essence?.active ? (Array.isArray(essence.active) ? essence.active : [essence.active]) : [];

            const card = document.createElement('article');
            card.className = 'modal-info-card essence-card';
            card.innerHTML = `
                <h4>${escapeHtml(essenceName)} 정수</h4>
                <p class="card-meta">등급: ${escapeHtml(essence?.grade || '?')}</p>
                <p>${escapeHtml(essence?.desc || "고유한 능력이 깃든 정수입니다.")}</p>
                ${essence?.stats ? `<p><b>스탯:</b> ${Object.entries(essence.stats).map(([k, v]) => `${escapeHtml(k)} ${v >= 0 ? '+' : ''}${v}`).join(', ')}</p>` : ''}
                ${passiveList.length ? `<p><b>패시브:</b> ${passiveList.map(p => `${escapeHtml(p.name)} (${escapeHtml(p.desc || '')})`).join(' / ')}</p>` : ''}
                ${activeList.length ? `<p><b>액티브:</b> ${activeList.map(a => `${escapeHtml(a.name)} (MP ${a.mp_cost || 0})`).join(' / ')}</p>` : ''}
            `;
            grid.appendChild(card);
        });
    }

    showModal('#essences-screen'); 
    backButton.onclick = () => { hideModal('#essences-screen'); };
}

export function showSpells(player) {
    const spellsScreenDiv = document.getElementById('spells-screen');
    const spellsListDiv = document.getElementById('spells-list');
    const backButton = spellsScreenDiv ? spellsScreenDiv.querySelector('.modal-close-btn') : null;
    if (!spellsScreenDiv) return;

    spellsListDiv.innerHTML = `
        <div class="modal-grid-head">
            <h3>마법 / 스킬</h3>
            <span>마법 ${player.spells.length} | 정수 스킬 ${player.essence_skills.length}</span>
        </div>
        <section class="modal-grid-section">
            <h4>마법 목록</h4>
            <div class="modal-card-grid" id="spell-card-grid"></div>
        </section>
        <section class="modal-grid-section">
            <h4>정수 스킬 목록</h4>
            <div class="modal-card-grid" id="essence-skill-grid"></div>
        </section>
    `;

    const spellGrid = document.getElementById('spell-card-grid');
    const skillGrid = document.getElementById('essence-skill-grid');
    if (!spellGrid || !skillGrid) return;

    if (player.spells.length > 0) {
        player.spells.forEach(spellName => {
            const spell = player.cb?.gameData?.magic?.[spellName];
            const card = document.createElement('article');
            card.className = 'modal-info-card spell-card';
            if (spell) {
                card.innerHTML = `
                    <h4>${escapeHtml(spellName)}</h4>
                    <p class="card-meta">${spell.grade}등급 | MP ${spell.mp_cost}</p>
                    <p>${escapeHtml(spell.desc || '')}</p>
                `;
            } else {
                card.innerHTML = `<h4>${escapeHtml(spellName)}</h4><p>(데이터 오류: 상세 정보 없음)</p>`;
            }
            spellGrid.appendChild(card);
        });
    } else {
        spellGrid.innerHTML = `<p class="modal-empty-text">배운 마법이 없습니다.</p>`;
    }

    if (player.essence_skills.length > 0) {
        player.essence_skills.forEach(skillName => {
            let skillDesc = "(상세 정보 없음)";
            let mpCost = 0;
            for (const key of player.essences) {
                const ess = player.cb?.gameData?.essences?.[key];
                if (ess && ess.active) {
                    const actives = Array.isArray(ess.active) ? ess.active : [ess.active];
                    const foundSkill = actives.find(s => s.name === skillName);
                    if (foundSkill) {
                        skillDesc = foundSkill.desc || skillDesc;
                        mpCost = foundSkill.mp_cost || 0;
                        break;
                    }
                }
            }
            const card = document.createElement('article');
            card.className = 'modal-info-card skill-card';
            card.innerHTML = `
                <h4>${escapeHtml(skillName)}</h4>
                <p class="card-meta">MP ${mpCost}</p>
                <p>${escapeHtml(skillDesc)}</p>
            `;
            skillGrid.appendChild(card);
        });
    } else {
        skillGrid.innerHTML = `<p class="modal-empty-text">배운 정수 스킬이 없습니다.</p>`;
    }

    showModal('#spells-screen');
    backButton.onclick = () => { hideModal('#spells-screen'); };
}
