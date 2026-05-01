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
const RACE_HOMELAND_DISTRICT = "종족 영지";
const LABIGION_BOARD_SIZE = { width: 1280, height: 820 };
const STATUS_PANEL_ID = "status-panel";
const LOG_PANEL_ID = "log-panel";
const STATUS_TOGGLE_ID = "toggle-status-panel";
const LOG_TOGGLE_ID = "toggle-log-panel";
const LABYRINTH_OPEN_PERIOD_DAYS = 3;

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

const DISTRICT_LOCATION_LAYOUTS = {
    "라비기온 (7-13구역)": LABIGION_NODE_LAYOUT,
    "황도 카르논 (1구역)": {
        "왕궁": { x: 640, y: 165, type: "palace" },
        "천공 경매장": { x: 895, y: 315, type: "auction" },
        "영광의 궁": { x: 405, y: 315, type: "hall" },
        "모즐란 본청": { x: 640, y: 520, type: "security" }
    },
    "컴멜비 (2-5구역)": {
        "알미너스 중앙 거래소": { x: 640, y: 205, type: "market" },
        "알미너스 은행": { x: 420, y: 345, type: "bank" },
        "고급 여관": { x: 870, y: 345, type: "inn" },
        "다과점": { x: 470, y: 525, type: "cafe" },
        "제과점": { x: 810, y: 525, type: "bakery" }
    },
    "노움트리 (6구역)": {
        "키아르비스": { x: 640, y: 200, type: "resort" },
        "온천": { x: 420, y: 360, type: "hotspring" },
        "승마장": { x: 860, y: 360, type: "riding" },
        "농장/목장": { x: 640, y: 560, type: "farm" }
    },
    "비프론 (14구역)": {
        "배급소": { x: 420, y: 280, type: "supply" },
        "깡패 점거 여관/주점": { x: 870, y: 340, type: "gang" },
        "하수도 비밀 통로": { x: 640, y: 540, type: "secret" }
    },
    "종족 영지": {
        "종족 성소 의식장": { x: 640, y: 190, type: "sanctum" },
        "개인 영지": { x: 430, y: 380, type: "homestead" },
        "귀환 차원문": { x: 860, y: 380, type: "portal" }
    }
};

const DISTRICT_LAYOUT = {
    "황도 카르논 (1구역)": { x: 640, y: 52, type: "district" },
    "컴멜비 (2-5구역)": { x: 1175, y: 105, type: "district" },
    "노움트리 (6구역)": { x: 1090, y: 495, type: "district" },
    "비프론 (14구역)": { x: 175, y: 590, type: "district" },
    "종족 영지": { x: 1060, y: 700, type: "district" }
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
    ["공용 승강장", "종족 영지"],
    ["행정청", "공용 승강장"],
    ["행정청", "여관"],
    ["행정청", "마탑"]
];

const DISTRICT_CONNECTIONS = {
    "황도 카르논 (1구역)": [
        ["왕궁", "천공 경매장"],
        ["왕궁", "영광의 궁"],
        ["왕궁", "모즐란 본청"]
    ],
    "컴멜비 (2-5구역)": [
        ["알미너스 중앙 거래소", "알미너스 은행"],
        ["알미너스 중앙 거래소", "고급 여관"],
        ["알미너스 은행", "다과점"],
        ["고급 여관", "제과점"]
    ],
    "노움트리 (6구역)": [
        ["키아르비스", "온천"],
        ["키아르비스", "승마장"],
        ["온천", "농장/목장"],
        ["승마장", "농장/목장"]
    ],
    "비프론 (14구역)": [
        ["배급소", "깡패 점거 여관/주점"],
        ["배급소", "하수도 비밀 통로"],
        ["깡패 점거 여관/주점", "하수도 비밀 통로"]
    ],
    "종족 영지": [
        ["종족 성소 의식장", "개인 영지"],
        ["종족 성소 의식장", "귀환 차원문"]
    ]
};

const cityMapSelectionState = {
    selectedByDistrict: {},
    lockedByDistrict: {}
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getRaceHomelandDistrictData(player) {
    const raceName = player?.race || "미정";
    const mentorName = player?.raceStory?.mentor || `${raceName} 종족 인도자`;
    return {
        desc: `${raceName} 종족 전용 거점. 종족 서사 의식과 영지 운영을 담당합니다.`,
        locations: {
            "종족 성소 의식장": {
                desc: `${mentorName}와 대화하며 종족 서사를 진행합니다.`
            },
            "개인 영지": {
                desc: "그리드 배치로 영지를 꾸미고 생산/휴식을 관리합니다."
            },
            "귀환 차원문": {
                desc: `${LABIGION_DISTRICT}(으)로 복귀하는 차원문입니다.`
            }
        }
    };
}

function getCityData(player) {
    const base = player.cb?.gameData?.cities?.[CITY_NAME] || {};
    const raceDistrict = getRaceHomelandDistrictData(player);
    const existing = base[RACE_HOMELAND_DISTRICT] || {};
    return {
        ...base,
        [RACE_HOMELAND_DISTRICT]: {
            ...raceDistrict,
            ...existing,
            locations: {
                ...(raceDistrict.locations || {}),
                ...(existing.locations || {})
            }
        }
    };
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

function getAbsoluteWorldDay(player) {
    const eco = player?.economyState || {};
    const year = Math.max(1, Number(eco.year || 1));
    const month = Math.max(1, Number(eco.month || 1));
    const day = Math.max(1, Number(eco.day || 1));
    const daysPerMonth = Math.max(1, Number(eco.daysPerMonth || 25));
    const monthsPerYear = Math.max(1, Number(eco.monthsPerYear || 13));
    return (((year - 1) * monthsPerYear + (month - 1)) * daysPerMonth) + day;
}

function getLabyrinthOpenState(player) {
    return { isOpen: true, remainDays: 0 };
}

function getLayerStayLimitHours(layer) {
    return 0;
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
    player.timeRemaining = 0;

    logMessage(`1층 ${layerOne.name}로 진입합니다. (체류 제한 없음)`);
    player.questManager?.checkProgress('REACH', '1층', 1);

    updateMenu(player);
    player.showStatus();
}

function renderCityTextMenu(player, menu) {
    menu.classList.remove('city-map-menu');
    menu.classList.remove('city-detail-menu');
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
    addButton(menu, "특성 그래프", () => showTraitGraph(player));
    addButton(menu, "스킬 특성 그래프", () => showSkillGraph(player));
    addButton(menu, "정수 확인", () => showEssences(player));
    addButton(menu, "마법/스킬", () => showSpells(player));
    addButton(menu, "파티원 정보", () => player.cb?.showParty(player));
    addButton(menu, "임무 일지", () => player.cb?.showQuestLog(player));
    addButton(menu, "상태 보기", () => {
        revealStatusPanel();
        player.showStatus();
    });
}

function getCurrentCityDistrict(player) {
    const cityData = getCityData(player);
    if (cityData?.[player.position]) return player.position;
    return LABIGION_DISTRICT;
}

function getDistrictConnectionsForRender(currentDistrict, nodes) {
    const nodeNames = new Set(nodes.map((n) => n.name));
    const base = currentDistrict === LABIGION_DISTRICT
        ? LABIGION_CONNECTIONS
        : (DISTRICT_CONNECTIONS[currentDistrict] || []);
    const filtered = base.filter(([from, to]) => nodeNames.has(from) && nodeNames.has(to));
    if (filtered.length > 0) return filtered;

    const locationNames = nodes.filter((n) => n.actionType === "location").map((n) => n.name);
    const fallback = [];
    for (let i = 0; i < locationNames.length - 1; i++) {
        fallback.push([locationNames[i], locationNames[i + 1]]);
    }
    return fallback;
}

function buildDistrictNodes(player, currentDistrict) {
    const cityData = getCityData(player);
    const districtData = cityData?.[currentDistrict] || {};
    const locations = districtData?.locations || {};
    const districtLayout = DISTRICT_LOCATION_LAYOUTS[currentDistrict] || {};
    const nodes = [];
    let fallbackIndex = 0;

    Object.keys(locations).forEach((name) => {
        const preset = districtLayout[name];
        const fallbackX = 220 + (fallbackIndex % 4) * 210;
        const fallbackY = 240 + Math.floor(fallbackIndex / 4) * 160;
        const x = preset?.x ?? fallbackX;
        const y = preset?.y ?? fallbackY;
        const type = preset?.type || "location";
        fallbackIndex++;

        let actionType = "location";
        let actionLabel = `${name} 방문`;
        if (currentDistrict === LABIGION_DISTRICT && name === "차원 광장") {
            actionType = "labyrinth";
            actionLabel = "미궁 진입";
        } else if (currentDistrict === LABIGION_DISTRICT && name === "공용 승강장") {
            actionType = "districtMenu";
            actionLabel = "도시 구역 이동";
        } else if (currentDistrict === LABIGION_DISTRICT && name === "행정청") {
            actionType = "admin";
            actionLabel = "행정청 방문";
        } else if (currentDistrict === RACE_HOMELAND_DISTRICT && name === "종족 성소 의식장") {
            actionType = "race_story";
            actionLabel = "종족 서사 진행";
        } else if (currentDistrict === RACE_HOMELAND_DISTRICT && name === "개인 영지") {
            actionType = "homestead";
            actionLabel = "영지 관리";
        } else if (currentDistrict === RACE_HOMELAND_DISTRICT && name === "귀환 차원문") {
            actionType = "returnHomeDistrict";
            actionLabel = `${LABIGION_DISTRICT} 귀환`;
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
            actionLabel,
            district: currentDistrict
        });
    });

    const extraLocations = (typeof player.getHomeDistrictExtraLocations === "function")
        ? player.getHomeDistrictExtraLocations()
        : [];
    extraLocations.forEach((entry, index) => {
        if (!entry?.name) return;
        const preset = districtLayout[entry.name];
        const fallbackX = 180 + ((fallbackIndex + index) % 4) * 220;
        const fallbackY = 620 + Math.floor((fallbackIndex + index) / 4) * 110;
        const x = preset?.x ?? fallbackX;
        const y = preset?.y ?? fallbackY;
        nodes.push({
            id: `extra-${entry.actionType || "location"}-${entry.name}`,
            name: entry.name,
            label: entry.name,
            desc: entry.desc || "특수 거점 활동",
            x,
            y,
            type: entry.type || "utility",
            actionType: entry.actionType || "location",
            actionLabel: entry.actionLabel || `${entry.name} 방문`,
            district: currentDistrict
        });
    });

    Object.keys(cityData)
        .filter((districtName) => districtName !== currentDistrict)
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
                actionLabel: "해당 구역으로 이동",
                district: districtName
            });
        });

    if (currentDistrict === LABIGION_DISTRICT) {
        nodes.push({
            id: "action-current-location",
            name: "현재 구역 활동",
            label: "현재 구역 활동",
            desc: `${currentDistrict}에서 가능한 활동 장소를 바로 확인합니다.`,
            x: 1035,
            y: 700,
            type: "utility",
            actionType: "currentLocation",
            actionLabel: "구역 활동 보기",
            district: currentDistrict
        });
    }

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
    const nodeDistrict = node.district || getCurrentCityDistrict(player);

    switch (node.actionType) {
        case "labyrinth":
            startLabyrinthRun(player);
            break;
        case "districtMenu":
            player.position = LABIGION_DISTRICT;
            logMessage("이동할 구역 노드를 지도에서 직접 선택하세요.");
            player.cb?.updateMenu?.(player);
            break;
        case "districtMove":
            if (tryMoveToDistrict(player, node.name)) player.cb?.updateMenu?.(player);
            break;
        case "currentLocation":
            player.position = nodeDistrict;
            player.cb?.showCityLocations(player);
            break;
        case "race_story":
            player.position = nodeDistrict;
            player.cb?.handleCityAction(player, "종족 성소");
            break;
        case "homestead":
            player.position = nodeDistrict;
            player.cb?.handleCityAction(player, "개인 영지");
            break;
        case "returnHomeDistrict":
            player.position = LABIGION_DISTRICT;
            logMessage(`종족 영지에서 ${player.position}(으)로 귀환했습니다.`);
            player.cb?.updateMenu?.(player);
            break;
        case "admin":
            player.position = nodeDistrict;
            logMessage("행정청 업무는 순차적으로 확장 예정입니다. 현재는 방문 기록만 남깁니다.");
            break;
        case "location":
        default:
            player.position = nodeDistrict;
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
    const currentDistrict = getCurrentCityDistrict(player);
    const districtData = cityData?.[currentDistrict];
    if (!districtData?.locations) {
        renderCityTextMenu(player, menu);
        return;
    }

    menu.classList.remove('city-detail-menu');
    menu.classList.add('city-map-menu');
    menu.innerHTML = '';

    const shell = document.createElement('section');
    shell.className = 'city-map-shell';
    menu.appendChild(shell);

    const header = document.createElement('header');
    header.className = 'city-map-header';
    header.innerHTML = `
        <h3>${currentDistrict} 인터랙티브 지도</h3>
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
    infoCurrent.textContent = `현재 위치: ${currentDistrict}`;
    infoPanel.appendChild(infoCurrent);

    const infoTitle = document.createElement('h4');
    infoTitle.className = 'city-map-info-title';
    infoPanel.appendChild(infoTitle);

    const infoDesc = document.createElement('p');
    infoDesc.className = 'city-map-info-desc';
    infoPanel.appendChild(infoDesc);

    const infoSelectMode = document.createElement('p');
    infoSelectMode.className = 'city-map-select-mode';
    infoPanel.appendChild(infoSelectMode);

    const unlockSelectionButton = document.createElement('button');
    unlockSelectionButton.type = 'button';
    unlockSelectionButton.className = 'city-map-control-btn';
    infoPanel.appendChild(unlockSelectionButton);

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
        ["특성 그래프", () => showTraitGraph(player)],
        ["스킬 특성 그래프", () => showSkillGraph(player)],
        ["정수 확인", () => showEssences(player)],
        ["마법/스킬", () => showSpells(player)],
        ["파티원 정보", () => player.cb?.showParty(player)],
        ["임무 일지", () => player.cb?.showQuestLog(player)],
        ["상태 보기", () => {
            revealStatusPanel();
            player.showStatus();
        }]
    ];
    quickButtons.forEach(([label, handler]) => {
        const btn = addButton(quickActions, label, handler);
        btn.classList.add('city-map-quick-btn');
    });

    const nodes = buildDistrictNodes(player, currentDistrict);
    if (nodes.length === 0) {
        renderCityTextMenu(player, menu);
        return;
    }

    const nodeMap = new Map();
    const nodeButtonMap = new Map();
    nodes.forEach((node) => nodeMap.set(node.name, node));

    const connections = getDistrictConnectionsForRender(currentDistrict, nodes);
    connections.forEach(([fromName, toName]) => {
        const from = nodeMap.get(fromName);
        const to = nodeMap.get(toName);
        const style = (from?.type === "district" || to?.type === "district") ? "district" : "main";
        addCityConnection(board, from, to, style);
    });

    const rememberedId = cityMapSelectionState.selectedByDistrict[currentDistrict];
    let selectedNode = nodes.find((node) => node.id === rememberedId)
        || nodes.find((node) => node.name === player.position)
        || nodes[0];
    let selectedNodeLocked = Boolean(cityMapSelectionState.lockedByDistrict[currentDistrict] && selectedNode);
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

    function setSelectedNode(node, lockSelection = false, force = false) {
        if (!node) return;
        if (selectedNodeLocked && !lockSelection && !force) return;
        selectedNode = node;
        if (lockSelection) selectedNodeLocked = true;

        nodeButtonMap.forEach((btn, nodeId) => {
            btn.classList.toggle('active', nodeId === selectedNode.id);
        });

        cityMapSelectionState.selectedByDistrict[currentDistrict] = selectedNode.id;
        cityMapSelectionState.lockedByDistrict[currentDistrict] = selectedNodeLocked;

        infoTitle.textContent = node.label;
        infoDesc.textContent = node.desc;
        actionButton.textContent = node.actionLabel || "이동";
        infoSelectMode.textContent = selectedNodeLocked
            ? "선택 고정됨: 마우스를 올려도 변경되지 않습니다."
            : "미리보기 모드: 마우스를 올리면 선택이 바뀝니다. 클릭하면 선택이 고정됩니다.";
        unlockSelectionButton.textContent = selectedNodeLocked ? "선택 고정 해제" : "선택 고정 중 아님";
        unlockSelectionButton.disabled = !selectedNodeLocked;
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
        nodeButton.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });
        nodeButton.addEventListener('mouseenter', () => setSelectedNode(node));
        nodeButton.addEventListener('focus', () => setSelectedNode(node));
        nodeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            setSelectedNode(node, true, true);
        });
        board.appendChild(nodeButton);
        nodeButtonMap.set(node.id, nodeButton);
    });

    unlockSelectionButton.onclick = () => {
        selectedNodeLocked = false;
        cityMapSelectionState.lockedByDistrict[currentDistrict] = false;
        setSelectedNode(selectedNode, false, true);
    };

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
        const onNode = (event.target instanceof Element) && event.target.closest('.city-map-node');
        if (onNode) return;
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

    setSelectedNode(selectedNode, false, true);
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
        
        // [Phase 3] RACE_DEFINITIONS 사용
        const raceDefinitions = player.cb?.raceDefinitions?.() || {};
        const races = player.cb?.gameData?.races || {};
        
        // 우선 RACE_DEFINITIONS 우선 사용
        const racesToUse = Object.keys(raceDefinitions).length > 0 ? raceDefinitions : races;
        
        Object.keys(racesToUse).forEach(raceId => {
            const raceData = racesToUse[raceId];
            const raceName = raceData.name || raceData.displayName || raceId;
            const raceDesc = raceData.description || '종족';
            
            addButton(racesListDiv, `${raceName} - ${raceDesc}`, () => {
                player.chooseRace(raceId);
                raceSelectionDiv.style.display = 'none';
                mainGameDiv.classList.remove('hidden');
                mainGameDiv.style.display = 'grid'; 
                logMessage(`던전 앤 스톤의 세계에 온 것을 환영합니다. ${player.position}에서 여정을 시작합니다.`);
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
    const gameContainer = document.getElementById('game-container');

    if (!menu || !combatScreen || !explorationScreen || !mainGameDiv) return;
    initPanelToggles();
    gameContainer?.classList.remove('effect-flash', 'effect-shake', 'effect-boss-hit');

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
    menu.classList.remove('city-detail-menu');
    menu.style.display = '';
    combatScreen.classList.add('hidden');
    explorationScreen.classList.add('hidden');
    mainGameDiv.style.display = 'grid';
    applyCityMapLayout(false);

    updateStatusBars(player); 

    // ---------------------------------------------------------
    // Case A: 균열(Rift) - 탐험 맵 방식
    // ---------------------------------------------------------
    if (player.position === "Rift") {
        explorationScreen.classList.remove('hidden');
        if (!player.currentRift || !Array.isArray(player.currentRift.stages)) {
            logMessage("오류: 유효하지 않은 균열 데이터입니다.");
            player.position = "라비기온 (7-13구역)";
            player.currentRift = null;
            updateMenu(player);
            return;
        }

        if (player.mapManager && typeof player.mapManager.enterRift === 'function') {
            player.mapManager.enterRift(player.currentRift);
        } else {
            logMessage("오류: 균열 맵 매니저가 초기화되지 않았습니다.");
            player.position = "라비기온 (7-13구역)";
            player.currentRift = null;
            updateMenu(player);
        }
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
        const cityData = getCityData(player);
        if (player.position === LABIGION_DISTRICT || cityData?.[player.position]) {
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
    
    player.timeRemaining = 0;

    logMessage(`${layerName}(으)로 진입합니다. (체류 제한 없음)`);
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
        player.pendingRiftStageIndex = null;
        player.currentMapId = null;
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

function formatTraitGrant(node) {
    const stats = Object.entries(node?.grants?.stats || {})
        .slice(0, 4)
        .map(([stat, value]) => `${stat} ${value > 0 ? "+" : ""}${value}`)
        .join(", ");
    const derived = Object.entries(node?.grants?.derived || {})
        .filter(([, value]) => Number(value) > 0)
        .slice(0, 3)
        .map(([key, value]) => `${key} +${(Number(value) * 100).toFixed(1)}%`)
        .join(", ");
    if (stats && derived) return `${stats} | ${derived}`;
    return stats || derived || "보너스 없음";
}

function formatSkillGrant(node) {
    const componentKeyLabel = {
        shape: "형식",
        element: "속성",
        baseDamage: "기반 피해",
        baseCost: "기반 소모",
        baseCooldown: "기반 쿨타임",
        targets: "추가 대상",
        powerRate: "위력 보정",
        costRate: "소모 보정",
        cooldownRate: "쿨타임 보정",
        controlChance: "제어 확률",
        critRate: "치명 보정",
        lifeSteal: "흡수율",
        shieldRate: "보호막 전환"
    };
    const percentKeys = new Set(["powerRate", "costRate", "cooldownRate", "controlChance", "critRate", "lifeSteal", "shieldRate"]);
    const components = Object.entries(node?.grants?.component || {})
        .slice(0, 6)
        .map(([key, value]) => {
            if (value === undefined || value === null) return null;
            const label = componentKeyLabel[key] || key;
            if (typeof value === "number") {
                if (percentKeys.has(key)) return `${label} ${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
                return `${label} ${value >= 0 ? "+" : ""}${value}`;
            }
            return `${label}: ${value}`;
        })
        .filter(Boolean)
        .join(", ");

    const derived = Object.entries(node?.grants?.derived || {})
        .slice(0, 5)
        .map(([key, value]) => {
            if (!Number.isFinite(Number(value))) return null;
            return `${key} ${Number(value) >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(1)}%`;
        })
        .filter(Boolean)
        .join(", ");

    if (components && derived) return `${components} | ${derived}`;
    return components || derived || "보너스 없음";
}

export function showSkillGraph(player) {
    const modal = document.getElementById('skill-graph-screen');
    const boardHost = document.getElementById('skill-graph-board-wrap');
    const detailHost = document.getElementById('skill-graph-detail');
    const pointHost = document.getElementById('skill-graph-point');
    const closeButton = document.getElementById('skill-graph-close');
    if (!modal || !boardHost || !detailHost || !pointHost) return;

    const payload = (typeof player.getSkillGraphPayload === "function")
        ? player.getSkillGraphPayload()
        : null;
    if (!payload) {
        logMessage("스킬 특성 그래프 데이터가 아직 준비되지 않았습니다.");
        return;
    }

    let selectedId = payload.nodes.find((node) => node.canPurchase)?.id || payload.nodes.find((node) => !node.autoUnlock)?.id || payload.nodes[0]?.id;
    let suppressNodeClick = false;
    const workbench = {
        coreId: null,
        elementId: null,
        behaviorIds: [],
        utilityIds: [],
        sigilId: null
    };

    let dragGhost = null;
    let dragSourceId = null;

    const removeDragGhost = () => {
        if (!dragGhost) return;
        dragGhost.remove();
        dragGhost = null;
    };

    const createDragGhost = (label = "") => {
        removeDragGhost();
        const ghost = document.createElement('div');
        ghost.className = 'skill-drag-ghost';
        ghost.textContent = label || "노드";
        document.body.appendChild(ghost);
        dragGhost = ghost;
        return ghost;
    };

    const getBranchNodes = (state, branch) => {
        return (state.nodes || [])
            .filter((node) => node.branch === branch && !node.autoUnlock && Number(node.rank || 0) > 0)
            .sort((a, b) => Number(b.rank || 0) - Number(a.rank || 0));
    };

    const normalizeWorkbench = (state) => {
        const branchMap = {
            core: getBranchNodes(state, 'core'),
            element: getBranchNodes(state, 'element'),
            behavior: getBranchNodes(state, 'behavior'),
            utility: getBranchNodes(state, 'utility'),
            sigil: getBranchNodes(state, 'sigil')
        };
        const allowed = new Set(state.nodes.filter((node) => Number(node.rank || 0) > 0).map((node) => node.id));
        const ensureSingle = (currentId, branchKey) => {
            if (currentId && allowed.has(currentId) && branchMap[branchKey].some((node) => node.id === currentId)) return currentId;
            return branchMap[branchKey][0]?.id || null;
        };
        const ensureMulti = (ids, branchKey) => {
            const max = 2;
            const uniq = [];
            (Array.isArray(ids) ? ids : []).forEach((id) => {
                if (!id || uniq.length >= max) return;
                if (!allowed.has(id)) return;
                if (!branchMap[branchKey].some((node) => node.id === id)) return;
                if (uniq.includes(id)) return;
                uniq.push(id);
            });
            for (const node of branchMap[branchKey]) {
                if (uniq.length >= max) break;
                if (!uniq.includes(node.id)) uniq.push(node.id);
            }
            return uniq.slice(0, max);
        };

        workbench.coreId = ensureSingle(workbench.coreId, 'core');
        workbench.elementId = ensureSingle(workbench.elementId, 'element');
        workbench.behaviorIds = ensureMulti(workbench.behaviorIds, 'behavior');
        workbench.utilityIds = ensureMulti(workbench.utilityIds, 'utility');
        workbench.sigilId = ensureSingle(workbench.sigilId, 'sigil');

        return branchMap;
    };

    const getWorkbenchPayload = () => ({
        coreId: workbench.coreId,
        elementId: workbench.elementId,
        behaviorIds: [...workbench.behaviorIds],
        utilityIds: [...workbench.utilityIds],
        sigilId: workbench.sigilId
    });

    const attachBoardPanHandlers = () => {
        let isPanning = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        boardHost.onpointerdown = (event) => {
            if (event.button !== 0) return;
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest('.trait-node')) return;
            isPanning = true;
            startX = event.clientX;
            startY = event.clientY;
            startLeft = boardHost.scrollLeft;
            startTop = boardHost.scrollTop;
            boardHost.classList.add('is-panning');
            try { boardHost.setPointerCapture(event.pointerId); } catch (_) {}
        };
        boardHost.onpointermove = (event) => {
            if (!isPanning) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressNodeClick = true;
            boardHost.scrollLeft = startLeft - dx;
            boardHost.scrollTop = startTop - dy;
        };
        boardHost.onpointerup = (event) => {
            if (!isPanning) return;
            isPanning = false;
            boardHost.classList.remove('is-panning');
            try { boardHost.releasePointerCapture(event.pointerId); } catch (_) {}
        };
        boardHost.onpointercancel = () => {
            isPanning = false;
            boardHost.classList.remove('is-panning');
        };
        boardHost.onpointerleave = () => {
            if (!isPanning) return;
            isPanning = false;
            boardHost.classList.remove('is-panning');
        };
    };

    const render = (keepScroll = null) => {
        const state = player.getSkillGraphPayload?.();
        if (!state) return;
        const nodeMap = new Map(state.nodes.map((node) => [node.id, node]));
        if (!nodeMap.has(selectedId)) {
            selectedId = state.nodes.find((node) => node.canPurchase)?.id || state.nodes[0]?.id;
        }

        const boardWidth = Math.max(1200, state.width || 1200);
        const boardHeight = Math.max(780, state.height || 780);
        const selectedForScroll = nodeMap.get(selectedId);
        const defaultLeft = selectedForScroll ? Math.max(0, selectedForScroll.x - 280) : 0;
        const defaultTop = selectedForScroll ? Math.max(0, selectedForScroll.y - 220) : 0;
        const scrollLeft = keepScroll ? keepScroll.left : defaultLeft;
        const scrollTop = keepScroll ? keepScroll.top : defaultTop;

        boardHost.innerHTML = `
            <div class="trait-graph-board" style="width:${boardWidth}px;height:${boardHeight}px;">
                <svg class="trait-graph-links" viewBox="0 0 ${boardWidth} ${boardHeight}" preserveAspectRatio="none"></svg>
                <div class="trait-graph-nodes"></div>
            </div>
        `;
        const svg = boardHost.querySelector('.trait-graph-links');
        const nodeLayer = boardHost.querySelector('.trait-graph-nodes');
        if (!svg || !nodeLayer) return;
        attachBoardPanHandlers();

        state.edges.forEach((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", String(from.x + 54));
            line.setAttribute("y1", String(from.y + 26));
            line.setAttribute("x2", String(to.x + 54));
            line.setAttribute("y2", String(to.y + 26));
            line.setAttribute("class", "trait-link");
            svg.appendChild(line);
        });

        state.nodes.forEach((node) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const statusClass = node.rank > 0
                ? 'unlocked'
                : (node.canPurchase ? 'available' : 'locked');
            btn.className = `trait-node trait-tier-${node.tier} ${statusClass} ${node.id === selectedId ? 'selected' : ''}`;
            btn.style.left = `${node.x}px`;
            btn.style.top = `${node.y}px`;
            btn.innerHTML = `
                <span class="trait-node-name">${escapeHtml(node.name)}</span>
                <span class="trait-node-rank">Lv ${node.rank}/${node.maxRank}</span>
            `;
            btn.addEventListener('click', () => {
                if (suppressNodeClick) {
                    suppressNodeClick = false;
                    return;
                }
                selectedId = node.id;
                render({ left: boardHost.scrollLeft, top: boardHost.scrollTop });
            });
            nodeLayer.appendChild(btn);
        });

        pointHost.innerHTML = `남은 포인트 <b>${state.points}</b> | 누적 투자 <b>${state.spent}</b> | 제작 스킬 <b>${(state.craftedSkills || []).length}</b>`;

        const selected = nodeMap.get(selectedId);
        if (!selected) return;
        const reqText = (selected.requires || []).length > 0
            ? selected.requires.map((req) => {
                const reqNode = nodeMap.get(req.id);
                const reqRank = player.getSkillNodeRank?.(req.id) || 0;
                return `${reqNode?.name || req.id} (${reqRank}/${req.rank || 1})`;
            }).join(', ')
            : "없음";

        const purchaseDisabled = !selected.canPurchase;
        const nextCost = selected.nextCost || 0;
        const reasonText = purchaseDisabled ? (selected.blockedReason || "투자 불가") : "투자 가능";
        if (!workbench.coreId && selected.branch === "core" && Number(selected.rank || 0) > 0) {
            workbench.coreId = selected.id;
        }
        if (!workbench.elementId && selected.branch === "element" && Number(selected.rank || 0) > 0) {
            workbench.elementId = selected.id;
        }
        const branchMap = normalizeWorkbench(state);
        const preview = typeof player.getSkillSynthesisPreview === "function"
            ? player.getSkillSynthesisPreview(getWorkbenchPayload())
            : null;
        const previewText = preview
            ? `미리보기: ${preview.skillName} | 피해 ${preview.damage} | MP ${preview.mpCost} | 쿨타임 ${preview.cooldown} | 대상 ${preview.targets}`
            : "워크벤치 슬롯에 코어/속성/행동을 배치하면 결과가 즉시 계산됩니다.";

        const renderPalette = (title, branch, nodes) => `
            <section class="skill-workbench-group">
                <h5>${escapeHtml(title)}</h5>
                <div class="skill-workbench-palette">
                    ${(nodes || []).map((node) => `
                        <button
                            type="button"
                            draggable="true"
                            class="skill-workbench-node"
                            data-node-id="${escapeHtml(node.id)}"
                            data-node-branch="${escapeHtml(branch)}"
                            title="${escapeHtml(node.desc || '')}"
                        >
                            <b>${escapeHtml(node.name)}</b>
                            <span>Lv ${node.rank}/${node.maxRank}</span>
                        </button>
                    `).join("") || `<p class="trait-node-reason">투자된 노드 없음</p>`}
                </div>
            </section>
        `;

        const slotDefs = [
            { id: "core", label: "코어 슬롯", branch: "core", value: workbench.coreId },
            { id: "element", label: "속성 슬롯", branch: "element", value: workbench.elementId },
            { id: "behavior-1", label: "행동 슬롯 A", branch: "behavior", value: workbench.behaviorIds[0] || null },
            { id: "behavior-2", label: "행동 슬롯 B", branch: "behavior", value: workbench.behaviorIds[1] || null },
            { id: "utility-1", label: "지원 슬롯 A", branch: "utility", value: workbench.utilityIds[0] || null },
            { id: "utility-2", label: "지원 슬롯 B", branch: "utility", value: workbench.utilityIds[1] || null },
            { id: "sigil", label: "인장 슬롯", branch: "sigil", value: workbench.sigilId }
        ];

        detailHost.innerHTML = `
            <h4>${escapeHtml(selected.name)}</h4>
            <p class="trait-node-desc">${escapeHtml(selected.desc || "")}</p>
            <div class="trait-node-meta">
                <div><b>브랜치</b><span>${escapeHtml(selected.branch || "none")}</span></div>
                <div><b>요구 레벨</b><span>${selected.unlockLevel || 1}</span></div>
                <div><b>랭크</b><span>${selected.rank}/${selected.maxRank}</span></div>
                <div><b>다음 비용</b><span>${nextCost}pt</span></div>
            </div>
            <p class="trait-node-require"><b>선행</b>: ${escapeHtml(reqText)}</p>
            <p class="trait-node-grant"><b>효과</b>: ${escapeHtml(formatSkillGrant(selected))}</p>
            <p class="trait-node-reason">${escapeHtml(reasonText)}</p>
            <section class="skill-workbench-shell">
                <h5>드래그 앤 드롭 워크벤치</h5>
                <p class="trait-node-reason">노드를 슬롯으로 끌어 배치하세요. 유효 슬롯은 녹색, 거부 슬롯은 붉게 표시됩니다.</p>
                <div class="skill-workbench-layout">
                    <div class="skill-workbench-sources">
                        ${renderPalette("코어", "core", branchMap.core)}
                        ${renderPalette("속성", "element", branchMap.element)}
                        ${renderPalette("행동", "behavior", branchMap.behavior)}
                        ${renderPalette("지원", "utility", branchMap.utility)}
                        ${renderPalette("인장", "sigil", branchMap.sigil)}
                    </div>
                    <div class="skill-workbench-slots">
                        ${slotDefs.map((slot) => {
                            const node = slot.value ? nodeMap.get(slot.value) : null;
                            return `
                                <div class="skill-workbench-slot" data-slot-id="${slot.id}" data-slot-branch="${slot.branch}">
                                    <span class="slot-label">${escapeHtml(slot.label)}</span>
                                    <span class="slot-value">${node ? escapeHtml(node.name) : "비어 있음"}</span>
                                    <span class="slot-branch">${escapeHtml(slot.branch)}</span>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </div>
            </section>
            <p class="trait-node-reason">${escapeHtml(previewText)}</p>
            <button id="skill-node-upgrade" class="trait-upgrade-btn" ${purchaseDisabled ? "disabled" : ""}>이 노드 투자</button>
            <button id="skill-node-craft" class="trait-upgrade-btn" ${preview ? "" : "disabled"}>현재 조합으로 스킬 제작</button>
        `;

        const assignSlotValue = (slotId, nodeId) => {
            if (!slotId || !nodeId) return;
            if (slotId === "core") workbench.coreId = nodeId;
            else if (slotId === "element") workbench.elementId = nodeId;
            else if (slotId === "sigil") workbench.sigilId = nodeId;
            else if (slotId === "behavior-1") {
                const next = [nodeId, ...(workbench.behaviorIds || []).filter((id) => id && id !== nodeId)];
                workbench.behaviorIds = next.slice(0, 2);
            } else if (slotId === "behavior-2") {
                const first = (workbench.behaviorIds || []).find((id) => id && id !== nodeId) || null;
                workbench.behaviorIds = [first, nodeId].filter(Boolean).slice(0, 2);
            } else if (slotId === "utility-1") {
                const next = [nodeId, ...(workbench.utilityIds || []).filter((id) => id && id !== nodeId)];
                workbench.utilityIds = next.slice(0, 2);
            } else if (slotId === "utility-2") {
                const first = (workbench.utilityIds || []).find((id) => id && id !== nodeId) || null;
                workbench.utilityIds = [first, nodeId].filter(Boolean).slice(0, 2);
            }
        };

        detailHost.querySelectorAll('.skill-workbench-node').forEach((nodeBtn) => {
            const nodeId = nodeBtn.getAttribute('data-node-id');
            const node = nodeMap.get(nodeId || "");
            if (!nodeId || !node) return;

            nodeBtn.addEventListener('dragstart', (event) => {
                dragSourceId = nodeId;
                nodeBtn.classList.add('is-dragging-source');
                event.dataTransfer?.setData('text/plain', nodeId);
                event.dataTransfer?.setData('application/x-skill-node', nodeId);
                event.dataTransfer.effectAllowed = 'move';
                const ghost = createDragGhost(node.name);
                ghost.style.left = `${event.pageX + 14}px`;
                ghost.style.top = `${event.pageY + 14}px`;
                try {
                    event.dataTransfer?.setDragImage(ghost, 16, 12);
                } catch (_) {}
            });
            nodeBtn.addEventListener('drag', (event) => {
                if (!dragGhost) return;
                if (!Number.isFinite(event.pageX) || !Number.isFinite(event.pageY)) return;
                dragGhost.style.left = `${event.pageX + 14}px`;
                dragGhost.style.top = `${event.pageY + 14}px`;
            });
            nodeBtn.addEventListener('dragend', () => {
                nodeBtn.classList.remove('is-dragging-source');
                dragSourceId = null;
                removeDragGhost();
            });
        });

        detailHost.querySelectorAll('.skill-workbench-slot').forEach((slotEl) => {
            const slotId = slotEl.getAttribute('data-slot-id') || '';
            const slotBranch = slotEl.getAttribute('data-slot-branch') || '';
            const clearClasses = () => {
                slotEl.classList.remove('drop-valid', 'drop-invalid', 'drop-snap', 'drop-reject');
            };
            const getDraggedNodeId = (event) =>
                event.dataTransfer?.getData('application/x-skill-node') ||
                event.dataTransfer?.getData('text/plain') ||
                dragSourceId ||
                "";
            const isValidDrop = (nodeId) => {
                const node = nodeMap.get(nodeId || "");
                if (!node) return false;
                return String(node.branch || "") === slotBranch;
            };

            slotEl.addEventListener('dragover', (event) => {
                event.preventDefault();
                const nodeId = getDraggedNodeId(event);
                clearClasses();
                if (isValidDrop(nodeId)) {
                    slotEl.classList.add('drop-valid', 'drop-snap');
                    event.dataTransfer.dropEffect = 'move';
                } else {
                    slotEl.classList.add('drop-invalid');
                    event.dataTransfer.dropEffect = 'none';
                }
            });
            slotEl.addEventListener('dragleave', () => {
                clearClasses();
            });
            slotEl.addEventListener('drop', (event) => {
                event.preventDefault();
                const nodeId = getDraggedNodeId(event);
                clearClasses();
                if (!isValidDrop(nodeId)) {
                    slotEl.classList.add('drop-reject');
                    setTimeout(() => slotEl.classList.remove('drop-reject'), 260);
                    return;
                }
                assignSlotValue(slotId, nodeId);
                const keep = { left: boardHost.scrollLeft, top: boardHost.scrollTop };
                render(keep);
            });
            slotEl.addEventListener('click', () => {
                if (slotId === "core") workbench.coreId = null;
                else if (slotId === "element") workbench.elementId = null;
                else if (slotId === "sigil") workbench.sigilId = null;
                else if (slotId === "behavior-1") workbench.behaviorIds = [workbench.behaviorIds[1]].filter(Boolean);
                else if (slotId === "behavior-2") workbench.behaviorIds = [workbench.behaviorIds[0]].filter(Boolean);
                else if (slotId === "utility-1") workbench.utilityIds = [workbench.utilityIds[1]].filter(Boolean);
                else if (slotId === "utility-2") workbench.utilityIds = [workbench.utilityIds[0]].filter(Boolean);
                const keep = { left: boardHost.scrollLeft, top: boardHost.scrollTop };
                render(keep);
            });
        });

        const upgradeBtn = document.getElementById('skill-node-upgrade');
        if (upgradeBtn && !purchaseDisabled) {
            upgradeBtn.onclick = () => {
                const keep = { left: boardHost.scrollLeft, top: boardHost.scrollTop };
                player.purchaseSkillNode?.(selected.id);
                player.showStatus?.();
                render(keep);
            };
        }

        const craftBtn = document.getElementById('skill-node-craft');
        if (craftBtn && preview) {
            craftBtn.onclick = () => {
                const keep = { left: boardHost.scrollLeft, top: boardHost.scrollTop };
                player.craftCustomSkill?.(getWorkbenchPayload());
                player.showStatus?.();
                render(keep);
            };
        }

        boardHost.scrollLeft = scrollLeft;
        boardHost.scrollTop = scrollTop;
    };

    showModal('#skill-graph-screen');
    render();
    if (closeButton) {
        closeButton.onclick = () => {
            dragSourceId = null;
            removeDragGhost();
            hideModal('#skill-graph-screen');
        };
    }
}

export function showTraitGraph(player) {
    const modal = document.getElementById('trait-graph-screen');
    const boardHost = document.getElementById('trait-graph-board-wrap');
    const detailHost = document.getElementById('trait-graph-detail');
    const pointHost = document.getElementById('trait-graph-point');
    const closeButton = document.getElementById('trait-graph-close');
    if (!modal || !boardHost || !detailHost || !pointHost) return;

    const payload = (typeof player.getTraitGraphPayload === "function")
        ? player.getTraitGraphPayload()
        : null;
    if (!payload) {
        logMessage("특성 그래프 데이터가 아직 준비되지 않았습니다.");
        return;
    }

    let selectedId = payload.nodes.find((node) => node.canPurchase)?.id || payload.nodes.find((node) => !node.autoUnlock)?.id || payload.nodes[0]?.id;
    let suppressNodeClick = false;

    const attachBoardPanHandlers = () => {
        let isPanning = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        boardHost.onpointerdown = (event) => {
            if (event.button !== 0) return;
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest('.trait-node')) return;
            isPanning = true;
            startX = event.clientX;
            startY = event.clientY;
            startLeft = boardHost.scrollLeft;
            startTop = boardHost.scrollTop;
            boardHost.classList.add('is-panning');
            try { boardHost.setPointerCapture(event.pointerId); } catch (_) {}
        };
        boardHost.onpointermove = (event) => {
            if (!isPanning) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressNodeClick = true;
            boardHost.scrollLeft = startLeft - dx;
            boardHost.scrollTop = startTop - dy;
        };
        boardHost.onpointerup = (event) => {
            if (!isPanning) return;
            isPanning = false;
            boardHost.classList.remove('is-panning');
            try { boardHost.releasePointerCapture(event.pointerId); } catch (_) {}
        };
        boardHost.onpointercancel = () => {
            isPanning = false;
            boardHost.classList.remove('is-panning');
        };
        boardHost.onpointerleave = () => {
            if (!isPanning) return;
            isPanning = false;
            boardHost.classList.remove('is-panning');
        };
    };

    const render = (keepScroll = null) => {
        const state = player.getTraitGraphPayload();
        if (!state) return;
        const nodeMap = new Map(state.nodes.map((node) => [node.id, node]));
        if (!nodeMap.has(selectedId)) {
            selectedId = state.nodes.find((node) => node.canPurchase)?.id || state.nodes[0]?.id;
        }

        const boardWidth = Math.max(1200, state.width);
        const boardHeight = Math.max(780, state.height);
        const selectedForScroll = nodeMap.get(selectedId);
        const defaultLeft = selectedForScroll ? Math.max(0, selectedForScroll.x - 280) : 0;
        const defaultTop = selectedForScroll ? Math.max(0, selectedForScroll.y - 220) : 0;
        const scrollLeft = keepScroll ? keepScroll.left : defaultLeft;
        const scrollTop = keepScroll ? keepScroll.top : defaultTop;

        boardHost.innerHTML = `
            <div class="trait-graph-board" style="width:${boardWidth}px;height:${boardHeight}px;">
                <svg class="trait-graph-links" viewBox="0 0 ${boardWidth} ${boardHeight}" preserveAspectRatio="none"></svg>
                <div class="trait-graph-nodes"></div>
            </div>
        `;
        const board = boardHost.querySelector('.trait-graph-board');
        const svg = boardHost.querySelector('.trait-graph-links');
        const nodeLayer = boardHost.querySelector('.trait-graph-nodes');
        if (!board || !svg || !nodeLayer) return;
        attachBoardPanHandlers();

        state.edges.forEach((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", String(from.x + 54));
            line.setAttribute("y1", String(from.y + 26));
            line.setAttribute("x2", String(to.x + 54));
            line.setAttribute("y2", String(to.y + 26));
            line.setAttribute("class", "trait-link");
            svg.appendChild(line);
        });

        state.nodes.forEach((node) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const statusClass = node.rank > 0
                ? 'unlocked'
                : (node.canPurchase ? 'available' : 'locked');
            btn.className = `trait-node trait-tier-${node.tier} ${statusClass} ${node.id === selectedId ? 'selected' : ''}`;
            btn.style.left = `${node.x}px`;
            btn.style.top = `${node.y}px`;
            btn.innerHTML = `
                <span class="trait-node-name">${escapeHtml(node.name)}</span>
                <span class="trait-node-rank">Lv ${node.rank}/${node.maxRank}</span>
            `;
            btn.addEventListener('click', () => {
                if (suppressNodeClick) {
                    suppressNodeClick = false;
                    return;
                }
                selectedId = node.id;
                render({ left: boardHost.scrollLeft, top: boardHost.scrollTop });
            });
            nodeLayer.appendChild(btn);
        });

        pointHost.innerHTML = `남은 포인트 <b>${state.points}</b> | 누적 투자 <b>${state.spent}</b>`;

        const selected = nodeMap.get(selectedId);
        if (!selected) return;

        const reqText = (selected.requires || []).length > 0
            ? selected.requires.map((req) => {
                const reqNode = nodeMap.get(req.id);
                const reqRank = player.getTraitNodeRank?.(req.id) || 0;
                return `${reqNode?.name || req.id} (${reqRank}/${req.rank || 1})`;
            }).join(', ')
            : "없음";
        const purchaseDisabled = !selected.canPurchase;
        const nextCost = selected.nextCost || 0;
        const reasonText = purchaseDisabled ? (selected.blockedReason || "투자 불가") : "투자 가능";
        detailHost.innerHTML = `
            <h4>${escapeHtml(selected.name)}</h4>
            <p class="trait-node-desc">${escapeHtml(selected.desc || "")}</p>
            <div class="trait-node-meta">
                <div><b>브랜치</b><span>${escapeHtml(selected.branch || "none")}</span></div>
                <div><b>요구 레벨</b><span>${selected.unlockLevel || 1}</span></div>
                <div><b>랭크</b><span>${selected.rank}/${selected.maxRank}</span></div>
                <div><b>다음 비용</b><span>${nextCost}pt</span></div>
            </div>
            <p class="trait-node-require"><b>선행</b>: ${escapeHtml(reqText)}</p>
            <p class="trait-node-grant"><b>효과</b>: ${escapeHtml(formatTraitGrant(selected))}</p>
            <p class="trait-node-reason">${escapeHtml(reasonText)}</p>
            <button id="trait-node-upgrade" class="trait-upgrade-btn" ${purchaseDisabled ? "disabled" : ""}>이 노드 투자</button>
        `;

        const upgradeBtn = document.getElementById('trait-node-upgrade');
        if (upgradeBtn && !purchaseDisabled) {
            upgradeBtn.onclick = () => {
                const keep = { left: boardHost.scrollLeft, top: boardHost.scrollTop };
                player.purchaseTraitNode?.(selected.id);
                player.showStatus?.();
                render(keep);
            };
        }

        boardHost.scrollLeft = scrollLeft;
        boardHost.scrollTop = scrollTop;
    };

    showModal('#trait-graph-screen');
    render();
    if (closeButton) {
        closeButton.onclick = () => hideModal('#trait-graph-screen');
    }
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
    const traitNodeCount = Object.values(player.traitRanks || {}).filter((v) => Number(v) > 0).length;
    const traitPoints = Number(player.traitPoints || 0);
    const traitSpent = Number(player.traitSpentPoints || 0);
    const skillNodeCount = Object.values(player.skillRanks || {}).filter((v) => Number(v) > 0).length;
    const skillPoints = Number(player.skillPoints || 0);
    const skillSpent = Number(player.skillSpentPoints || 0);
    const craftedCount = Array.isArray(player.craftedSkills) ? player.craftedSkills.length : 0;
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
        <section class="character-trait-summary">
            <h4>특성 그래프</h4>
            <p>남은 포인트 ${traitPoints} | 투자 ${traitSpent} | 활성 노드 ${traitNodeCount}</p>
            <button id="open-trait-graph-btn" class="modal-close-btn trait-open-btn">특성 그래프 열기</button>
        </section>
        <section class="character-trait-summary">
            <h4>스킬 특성 그래프</h4>
            <p>남은 포인트 ${skillPoints} | 투자 ${skillSpent} | 활성 노드 ${skillNodeCount} | 제작 스킬 ${craftedCount}</p>
            <button id="open-skill-graph-btn" class="modal-close-btn trait-open-btn">스킬 특성 그래프 열기</button>
        </section>
    `;

    showModal('#character-status-screen');
    const openTraitBtn = document.getElementById('open-trait-graph-btn');
    const openSkillBtn = document.getElementById('open-skill-graph-btn');
    if (openTraitBtn) {
        openTraitBtn.onclick = () => {
            hideModal('#character-status-screen');
            showTraitGraph(player);
        };
    }
    if (openSkillBtn) {
        openSkillBtn.onclick = () => {
            hideModal('#character-status-screen');
            showSkillGraph(player);
        };
    }
    if (closeButton) {
        closeButton.onclick = () => hideModal('#character-status-screen');
    }
}

function normalizeEquipmentSlot(type) {
    if (!type) return null;
    if (['검', '창', '횃불', '둔기', '활', '클로', '몽둥이', '장검', '철퇴'].includes(type)) return '무기';
    if (['방패', '시계'].includes(type)) return '부무기';
    if (['부츠'].includes(type)) return '각반';
    const accessoryMap = {
        목걸이: '목걸이',
        반지: '반지',
        팔찌: '팔찌',
        '팔목 보호대': '팔찌',
        귀걸이: '귀걸이',
        벨트: '벨트',
        부적: '부적',
        토큰: '토큰',
        마도구: '마도구',
        가면: '가면',
        원판: '부적',
        함정: '마도구',
        장비: '부적',
        가방: '부적'
    };
    if (Object.prototype.hasOwnProperty.call(accessoryMap, type)) return accessoryMap[type];
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
    const identified = isEquipment
        ? Boolean(player.isItemIdentified?.(itemName))
        : true;
    const mysteryState = isEquipment ? (player.getItemIdentityState?.(itemName) || null) : null;
    const displayName = (isEquipment && !identified)
        ? `미감정 ${equipSlot || "장비"}`
        : itemName;

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
        category,
        identified,
        mysteryState,
        displayName
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

    const magicStoneCount = Math.max(0, Math.floor(Number(player.magic_stones || 0)));
    if (magicStoneCount > 0) {
        itemEntries.unshift({
            name: '마석',
            count: magicStoneCount,
            itemData: {
                type: '재화',
                desc: '미궁에서 회수한 핵심 재화입니다. 환전소에서 스톤으로 교환할 수 있습니다.'
            },
            functionalData: null,
            equipSlot: null,
            isEquipment: false,
            isUsable: false,
            isMaterial: true,
            category: 'material',
            identified: true,
            mysteryState: null,
            displayName: '마석'
        });
    }

    const slotOrder = ['투구', '갑옷', '장갑', '각반', '무기', '부무기', '목걸이', '반지', '팔찌', '귀걸이', '벨트', '부적', '토큰', '마도구', '가면'];
    const equippedCount = slotOrder.reduce((count, slot) => count + (player.equipment?.[slot] ? 1 : 0), 0);

    inventoryListDiv.innerHTML = `
        <div class="inventory-rpg-layout">
            <section class="inventory-equip-panel">
                <div class="inv-panel-head">
                    <h3>장비 슬롯</h3>
                    <span>${equippedCount}/${slotOrder.length} 장착</span>
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
            const shownName = equippedItem
                ? (player.isItemIdentified?.(equippedItem) ? equippedItem : `미감정 ${slot}`)
                : '비어 있음';
            const cursedMark = equippedItem && player.itemIdentity?.cursedSlots?.[slot]?.itemName === equippedItem
                ? " [저주]"
                : "";
            const slotBtn = document.createElement('button');
            slotBtn.type = 'button';
            slotBtn.className = `inv-equip-slot ${equippedItem ? 'equipped' : 'empty'}`;
            slotBtn.innerHTML = `
                <span class="slot-label">${slot}</span>
                <span class="slot-item">${escapeHtml(shownName)}${cursedMark}</span>
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
        const typeLabel = meta.identified ? (meta.itemData?.type || '미분류') : '미감정';
        const tierLabel = meta.identified ? (meta.itemData?.tier ? `${meta.itemData.tier}티어` : '일반') : '???';
        const hasActiveEffect = Boolean(meta.functionalData && typeof meta.functionalData.effect === 'function');
        const canAct = meta.isUsable || meta.isEquipment;
        const actionLabel = meta.isEquipment
            ? (equippedBySlot ? '장착 해제' : (meta.identified ? '장착' : '감정 없이 장착(도박)'))
            : (meta.isUsable ? '사용' : '사용 불가');
        const showActivateButton = Boolean(meta.isEquipment && equippedBySlot && hasActiveEffect);
        const mysteryNote = (!meta.identified && meta.isEquipment)
            ? `<p class="inv-detail-line"><b>감정 상태:</b> 미확인 (저주/축복 가능)</p>`
            : '';
        const curseNote = (meta.isEquipment && meta.equipSlot && player.itemIdentity?.cursedSlots?.[meta.equipSlot]?.itemName === meta.name)
            ? `<p class="inv-detail-line"><b>저주 상태:</b> 장착 고정(해제 불가)</p>`
            : '';
        const descText = meta.identified
            ? (meta.itemData?.desc || '설명이 없습니다.')
            : '정체를 알 수 없는 장비다. 감정소나 감정 스크롤로 확인 가능.';
        const titleText = meta.identified ? meta.name : meta.displayName;

        detailBody.innerHTML = `
            <h4 class="inv-detail-title">${escapeHtml(titleText)}</h4>
            <p class="inv-detail-line"><b>수량:</b> ${meta.count}개</p>
            <p class="inv-detail-line"><b>종류:</b> ${escapeHtml(typeLabel)}</p>
            <p class="inv-detail-line"><b>등급:</b> ${escapeHtml(tierLabel)}</p>
            ${meta.equipSlot ? `<p class="inv-detail-line"><b>장착 부위:</b> ${meta.equipSlot}</p>` : ''}
            ${mysteryNote}
            ${curseNote}
            <p class="inv-detail-desc">${escapeHtml(descText)}</p>
            <button type="button" class="inv-detail-action" ${canAct ? '' : 'disabled'}>${actionLabel}</button>
            ${showActivateButton ? `<button type="button" class="inv-detail-action inv-detail-activate">능력 발동</button>` : ''}
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
                    player.equipItem(meta.name);
                }
                showInventory(player);
            }
        };

        const activateButton = detailBody.querySelector('.inv-detail-activate');
        if (activateButton) {
            activateButton.onclick = () => {
                hideModal('#inventory-screen');
                player.useItem(meta.name);
            };
        }
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
            const nameText = meta.identified ? meta.name : meta.displayName;
            const typeText = meta.identified ? (meta.itemData?.type || '미분류') : '미감정';
            card.innerHTML = `
                <span class="inv-item-name">${escapeHtml(nameText)}</span>
                <span class="inv-item-meta">${escapeHtml(typeText)}</span>
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

    const maxEssences = typeof player.getMaxEssenceCapacity === 'function'
        ? player.getMaxEssenceCapacity(player.level)
        : Math.max(1, (player.level * 3) + Math.floor(player.level / 5) - (player.essences?.includes("디아몬트") ? 1 : 0));
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
