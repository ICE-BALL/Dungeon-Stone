// 파일: ui_main.js
// 이 파일은 게임의 메인 흐름(비전투) UI 함수를 담당합니다.
// (종족 선택, 도시, 탐험, 메인 모달창)
// [수정] showPortalChoice: 8층 버그 수정을 위해 '현재 층 머무르기' 옵션 추가
// [수정] updateMenu (Rift): 몬스터 없는 스테이지('녹색 탄광 3챕터' 등) 진행 불가 버그 수정
// [수정] updateMenu (Labyrinth): 8층 탐색 불가 오류 수정 (8층 전용 균열 입장 메뉴 추가)
// [수정] (v4) updateMenu (Labyrinth): 종족 스킬 사용 시 화면 흔들림 및 텍스트 박스 연출 추가
// [수정] (v5) updateMenu (Rift): 'A or B' 보스 및 몬스터/보스 동시 출현 로직 버그 수정

// --- 핵심 UI 유틸리티 임포트 ---
import {
    logMessage,
    addButton,
    showModal,
    hideModal,
    updateStatusBars
} from './ui_core.js';


/**
 * 게임 시작 시 종족 선택 화면 초기화 + 도시 BGM 재생 트리거
 * @param {Player} player - 플레이어 객체
 */
export function initRaceSelection(player) {
    const raceSelectionDiv = document.getElementById('race-selection');
    const racesListDiv = document.getElementById('races-list');
    const mainGameDiv = document.getElementById('main-game');

    if (raceSelectionDiv && racesListDiv && mainGameDiv) {
        raceSelectionDiv.style.display = 'block';
        mainGameDiv.classList.add('hidden');
        mainGameDiv.style.display = 'none';

        racesListDiv.innerHTML = '';

        /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
        const races = player.cb?.gameData?.races || {};
        
        Object.keys(races).forEach(race => {
            addButton(racesListDiv, `${race} - ${races[race].description}`, () => {
                player.chooseRace(race);
                raceSelectionDiv.style.display = 'none';

                mainGameDiv.classList.remove('hidden');
                mainGameDiv.style.display = 'grid'; 

                logMessage("던전 앤 스톤의 세계에 온 것을 환영합니다. 도시에서 탐험을 준비하세요.");

                /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                if (player.cb && player.cb.playMusic) {
                    player.cb?.playMusic('bgm-city');
                }

                updateMenu(player); 
                player.showStatus(); 
            });
        });
    } else {
        console.error("Race selection elements not found!");
    }
}

/**
 * 플레이어 위치에 따라 메인 메뉴 갱신 + 상황별 BGM 재생
 * @param {Player} player - 플레이어 객체
 */
export function updateMenu(player) {
    const menu = document.getElementById('menu');
    const combatScreen = document.getElementById('combat-screen');
    const mainGameDiv = document.getElementById('main-game'); 

    if (!menu || !combatScreen || !mainGameDiv) {
        console.error("Menu, CombatScreen, or MainGame element not found!");
        return;
    }

    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    if (player.cb && player.cb.playMusic) {
        if (player.position === "Labyrinth" || player.position === "Rift") {
            player.cb?.playMusic('bgm-dungeon');
        } else { // 도시 또는 다른 안전 구역
            player.cb?.playMusic('bgm-city');
        }
    }

    // 화면 전환
    menu.innerHTML = ''; // 메뉴 초기화
    menu.classList.remove('hidden');
    menu.style.display = 'flex';
    combatScreen.classList.add('hidden');
    combatScreen.style.display = 'none';
    mainGameDiv.style.display = 'grid';

    updateStatusBars(player); // 상태 바 업데이트

    // [확장 계획 5] 균열(Rift) 내부 메뉴
    if (player.position === "Rift") {
        if (!player.currentRift || !player.currentRift.stages) {
            logMessage("오류: 유효하지 않은 균열입니다. 도시로 귀환합니다.");
            player.position = "라비기온 (7-13구역)"; 
            player.currentRift = null;
            updateMenu(player);
            return;
        }
        
        const stageIndex = player.currentRiftStage;
        const stage = player.currentRift.stages[stageIndex];
        
        if (!stage) {
            // (이 로직은 classes.js의 endCombat에서 이미 처리됨 - 8층 제외)
            logMessage(`[${player.currentRift.name}] 균열 탐사가 완료되었습니다. 도시로 귀환합니다.`);
            player.position = "라비기온 (7-13구역)"; 
            player.currentRift = null;
            updateMenu(player);
            return;
        }

        logMessage(`현재 위치: [${player.currentRift.name}] 균열 - ${stage.name}`);

        // 균열 탐사 버튼
        const exploreButton = addButton(menu, `균열 탐사: ${stage.name} 진입`, () => {
            logMessage(`[${stage.name}]으로 진입합니다...`);
            
            // [BUG FIX] (v5) "A or B" 보스 및 몬스터/보스 동시 출현 로직 수정
            let monstersToSpawn = [];

            // 1. 일반 몬스터 추가 (예: 녹색 탄광 4챕터의 '슬라임')
            if (stage.monsters && stage.monsters.length > 0) {
                monstersToSpawn = monstersToSpawn.concat(stage.monsters);
            }

            // 2. 보스 몬스터 추가 (및 "or" 문자열 처리)
            if (stage.boss) {
                let chosenBoss = null;
                // "A or B" 형태의 문자열 처리 (예: 핏빛성채 5챕터)
                if (typeof stage.boss === 'string' && stage.boss.includes(" or ")) {
                    const options = stage.boss.split(" or ");
                    chosenBoss = options[Math.floor(Math.random() * options.length)];
                    logMessage(`균열이 불안정합니다... [${chosenBoss}] (이)가 나타났습니다!`);
                } else if (Array.isArray(stage.boss)) {
                    // 보스가 이미 배열인 경우 (예: ["보스1", "보스2"])
                    monstersToSpawn = monstersToSpawn.concat(stage.boss);
                } else {
                    // 보스가 단일 문자열인 경우 (예: "킹 슬라임")
                    chosenBoss = stage.boss;
                }
                
                if (chosenBoss) {
                    monstersToSpawn.push(chosenBoss);
                }
            }
            // [BUG FIX] 수정 끝

            // 3. 최종 스폰 목록으로 전투 시작
            if (monstersToSpawn.length > 0) {
                player.startCombat(monstersToSpawn);
            } else {
                // 몬스터가 없는 스테이지 (예: 녹색탄광 3챕터) 처리
                logMessage("이 구역에는 몬스터가 없는 것 같습니다... 다음 단계로 이동합니다.");
                player.currentRiftStage++; // [수정] 스테이지 수동 증가
                updateMenu(player); // [수정] 메뉴 즉시 갱신
            }
            player.showStatus();
        });
        /* AUTO-FIX: [Optimization] Disable button during combat AND if waiting for essence choice */
        if (player.inCombat || player.isWaitingForEssenceChoice) exploreButton.disabled = true;

        // 균열 포기 버튼
        const returnButton = addButton(menu, "균열 포기 (도시로 귀환)", () => {
            if (confirm("균열 탐사를 포기하고 도시로 귀환하시겠습니까?")) {
                player.position = "라비기온 (7-13구역)";
                logMessage("균열에서 탈출하여 도시로 귀환했다.");
                player.currentRift = null;
                player.currentRiftStage = 0;
                updateMenu(player);
                player.showStatus();
            }
        });
        if (player.inCombat || player.isWaitingForEssenceChoice) { 
            returnButton.disabled = true;
            returnButton.title = "전투 중 또는 선택 중에는 귀환할 수 없습니다.";
        }
    }
    // 미궁 내부 메뉴
    else if (player.position === "Labyrinth") {
        /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
        const layer = player.cb.gameData?.layers?.[player.currentLayer];
        if (!layer) {
             logMessage(`오류: ${player.currentLayer}층 데이터를 찾을 수 없습니다.`);
             player.position = "라비기온 (7-13구역)"; 
             updateMenu(player);
             return;
        }

        player.timeRemaining = player.timeRemaining !== undefined && player.timeRemaining > 0 ? player.timeRemaining : layer.time_limit;
        logMessage(`현재 위치: ${player.currentLayer}층 - ${layer.name} | 남은 시간: ${player.timeRemaining}시간`);

        // [신규] 8층 (여명의 땅) 특별 로직
        if (player.currentLayer === 8 || player.currentLayer === "8") {
            logMessage("이곳은 안전지대입니다. 탐색 대신 층계의 균열에 도전할 수 있습니다.");
            
            /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
            const riftData = player.cb.gameData?.rifts?.[player.currentLayer]; // rifts["8"]
            
            if (riftData && riftData.length > 0) {
                // 8층은 균열이 여러 개일 수 있으므로 모두 표시
                riftData.forEach(rift => {
                    const riftButton = addButton(menu, `균열 입장: [${rift.name}]`, () => {
                        logMessage(`[${rift.name}] 균열 입구를 발견했습니다.`);
                        /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                        player.cb?.showRiftEntryModal(player, rift); // 균열 입장 모달 호출
                    });
                    if (player.inCombat || player.isWaitingForEssenceChoice) riftButton.disabled = true;
                });
            } else {
                logMessage("오류: 8층 균열 데이터를 찾을 수 없습니다. (world_data.json 확인 필요)");
            }
            // 8층은 안전지대이므로 "탐색하기" 및 "잠자기" 버튼을 생성하지 않습니다.

        } 
        // [신규] 8층이 아닌 경우 (기존 탐색 로직)
        else {
            
            // 탐색 버튼 (기존 로직)
            const exploreButton = addButton(menu, "탐색하기", () => {
                player.explorationCount++;
                player.fatigue += Math.max(1, 10 - Math.floor((player.stats["지구력"] || 10) / 2));
                player.timeRemaining--; 
                if(player.fatigue > 100) player.fatigue = 100;

                if (player.explorationCount % 24 === 0) {
                    player.daysInLabyrinth++;
                    player.sleepCount = 0; 
                    logMessage("하루가 지났다...");
                }
                if (player.timeRemaining <= 0) {
                    logMessage("시간이 다 되어 강제로 도시로 귀환합니다.");
                    player.position = "라비기온 (7-13구역)";
                    player.timeRemaining = 0; 
                    updateMenu(player); 
                    return;
                }

                /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
                const riftData = player.cb.gameData?.rifts?.[player.currentLayer];
                /* AUTO-FIX: [Plan 4] Changed logic to call random rift modal popup */
                if (riftData && riftData.length > 0 && Math.random() < 0.05) { // 8층이 아니므로 5% 확률 유지
                    logMessage("땅이 흔들리며 기이한 균열이 나타났다!");
                    const randomRift = riftData[Math.floor(Math.random() * riftData.length)];
                    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                    player.cb?.showRiftEntryModal(player, randomRift); // 새 모달 함수 호출
                    return; 
                }

                /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                const navigator = player.party?.find(m => m.trait === "인도자");
                if (navigator && Math.random() < 0.2) {
                    logMessage(`[파티 보너스] 인도자 ${navigator.name}이(가) 다음 층으로 향하는 지름길을 발견했습니다!`);
                    const nextLayer = parseInt(player.currentLayer) + 1;
                    /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
                    if (player.cb.gameData?.layers?.[nextLayer]) {
                        showPortalChoice(player, nextLayer);
                    } else {
                        logMessage("...하지만 더 이상 나아갈 길이 없는 것 같습니다.");
                    }
                    return; 
                }

                const rand = Math.random();
                let encounteredMonster = null;
                /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
                if (rand < 0.05 && player.cb.gameData?.monsters?.["균열 수호자"]) { 
                     logMessage("땅이 흔들리며 균열이 나타났다!");
                     encounteredMonster = "균열 수호자";
                } else if (rand < 0.6) { 
                    logMessage("몬스터와 조우했다!");
                     /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                     encounteredMonster = player.cb?.getRandomMonsters(player.currentLayer); // 콜백 사용
                } else { 
                     /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
                     if (layer?.events && layer.events.length > 0) {
                         const event = layer.events[Math.floor(Math.random() * layer.events.length)];

                         if (event.effect?.type === "portal") {
                             // [수정] 로컬 함수 호출
                             showPortalChoice(player, event.effect.targetLayer);
                         }
                         else {
                             logMessage(event.desc);
                             if (event.effect) {
                                 player.handleEventEffect(event.effect); 
                             }
                         }
                     } else {
                         logMessage("아무 일도 일어나지 않았다.");
                     }
                }

                if (encounteredMonster) {
                     player.startCombat(encounteredMonster); 
                }

                player.showStatus();
            });
            /* AUTO-FIX: [Optimization] Disable button during combat AND if waiting for essence choice */
            if (player.inCombat || player.isWaitingForEssenceChoice) exploreButton.disabled = true;

            // 잠자기 버튼 (기존 로직) - 8층이 아닐 때만
            const sleepButton = addButton(menu, `잠자기 (피로/체력/MP/기력 회복) [${player.sleepCount}/3]`, () => {
                if (player.sleepCount >= 3) {
                    logMessage("오늘은 이미 너무 많이 잤다.");
                    return;
                }
                player.sleepCount++;
                if (player.party.length > 0) { 
                    player.fatigue = 0;
                    player.hp = player.maxHp;
                    player.mp = player.maxMp;
                    player.stamina = player.maxStamina;
                    player.party.forEach(member => {
                        member.hp = member.maxHp;
                        member.mp = member.maxMp;
                    });
                    logMessage(`${player.party[0].name}이(가) 보초를 서는 동안 안전하게 잠을 자 모든 것을 회복했다.`);
                } else { 
                    logMessage("동료가 없어 불안한 마음에 잠을 청한다...");
                    if (Math.random() < 0.4) { 
                        logMessage("잠든 사이 몬스터의 습격을 받았다!");
                         /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                         const monsterToAttack = player.cb?.randomMonsterFromLayer(player.currentLayer); // 콜백 사용
                         if (monsterToAttack) player.startCombat(monsterToAttack);
                    } else {
                        player.fatigue = 0;
                        player.hp = player.maxHp;
                        player.mp = player.maxMp;
                        player.stamina = player.maxStamina;
                        logMessage("다행히 아무 일도 일어나지 않았다. 모든 것을 회복했다.");
                    }
                }
                player.showStatus();
                updateMenu(player); 
            });
            /* AUTO-FIX: [Optimization] Disable button during combat AND if waiting for essence choice */
            if (player.sleepCount >= 3 || player.inCombat || player.isWaitingForEssenceChoice) sleepButton.disabled = true;
        }


        // 종족 스킬 버튼 (8층 포함 공통)
        /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
        const racialSkill = player.cb.gameData?.races?.[player.race]?.racial_skill; 
        if (racialSkill) {
            const racialSkillButton = addButton(menu, `종족 스킬: ${racialSkill.name}`, () => {
                
                // [신규] (v4) 스킬 연출 (화면 흔들림 + 텍스트 박스)
                /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                player.cb?.showScreenEffect?.('shake');
                /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                // [수정] racial_skill.name을 사용
                player.cb?.logMessage?.(`[${racialSkill.name}]!`, 'log-skill-player');
                
                if(typeof racialSkill.effect === 'function') {
                    // [수정] (v4) 텍스트 박스 출력 후 효과 설명 로그 표시
                    logMessage(`종족 스킬 [${racialSkill.name}]을(를) 사용합니다: ${racialSkill.desc}`);
                    racialSkill.effect(player);
                    player.showStatus();
                } else {
                    logMessage("이 종족은 특별한 스킬이 없습니다.");
                }
            });
            /* AUTO-FIX: [Optimization] Disable button during combat AND if waiting for essence choice */
            if (player.inCombat || player.isWaitingForEssenceChoice) racialSkillButton.disabled = true;
        }

        // 도시 귀환 버튼 (8층 포함 공통)
        const returnButton = addButton(menu, "도시로 귀환", () => {
            player.position = "라비기온 (7-13구역)";
            logMessage("안전하게 도시로 귀환했다.");
            player.timeRemaining = 0;
            updateMenu(player);
            player.showStatus();
        });
        if (player.inCombat || player.isWaitingForEssenceChoice) { 
            returnButton.disabled = true;
            returnButton.title = "전투 중 또는 선택 중에는 귀환할 수 없습니다.";
        }

    }
    // 도시 내부 메뉴
    else {
        // [수정] 도시 관련 기능은 ui_city.js로 분리되었으므로 해당 콜백 호출
        /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
        addButton(menu, "도시 구역 이동", () => player.cb?.showCityDistricts(player));
        /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
        addButton(menu, "현재 구역 활동", () => player.cb?.showCityLocations(player));
        addButton(menu, "미궁 진입 (1층)", () => {
             /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
             const layerOne = player.cb.gameData?.layers?.[1];
             if (!layerOne) {
                 logMessage("오류: 1층 미궁 데이터를 찾을 수 없습니다.");
                 return;
             }
            player.position = "Labyrinth";
            player.currentLayer = 1;
            player.daysInLabyrinth = 1;
            player.explorationCount = 0;
            player.sleepCount = 0;
            player.timeRemaining = layerOne.time_limit; 
            logMessage("1층 수정동굴로 진입합니다.");

            /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
            player.questManager?.checkProgress('REACH', '1층', 1);

            updateMenu(player);
            player.showStatus();
        });
    }

    // 공통 메뉴 (모달 열기 버튼)
    /* AUTO-FIX: [Optimization] Disable all modal buttons during combat AND if waiting for essence choice */
    const commonButtonsDisabled = player.inCombat || player.isWaitingForEssenceChoice;
    
    addButton(menu, "인벤토리", () => showInventory(player)).disabled = commonButtonsDisabled;
    addButton(menu, "정수 확인", () => showEssences(player)).disabled = commonButtonsDisabled;
    addButton(menu, "마법/스킬", () => showSpells(player)).disabled = commonButtonsDisabled;
    // [수정] ui_party.js의 함수를 콜백으로 호출
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    addButton(menu, "파티원 정보", () => player.cb?.showParty(player)).disabled = commonButtonsDisabled;
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    addButton(menu, "임무 일지", () => player.cb?.showQuestLog(player)).disabled = commonButtonsDisabled;
    addButton(menu, "상태 보기 (텍스트 재출력)", () => player.showStatus()).disabled = commonButtonsDisabled;
}

/**
 * [수정] 차원 비석(포탈) 발견 시 선택 메뉴 표시
 * 8층 버그 수정을 위해 '현재 층'으로 돌아가는 옵션 추가
 * @param {Player} player - 플레이어 객체
 * @param {number | string} nextLayer - 이동할 다음 층 번호
 * @param {number | string | null} [currentLayer=null] - (선택) 현재 층 (머무르기 옵션용)
 */
export function showPortalChoice(player, nextLayer, currentLayer = null) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; 

    /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
    const nextLayerData = player.cb.gameData?.layers?.[nextLayer];
    if (!nextLayerData) {
        logMessage(`오류: ${nextLayer}층 데이터를 찾을 수 없습니다.`);
        updateMenu(player); 
        return;
    }

    logMessage(`${nextLayer}층 (${nextLayerData.name})으로 가는 차원 비석을 발견했다. 이동하시겠습니까?`);

    addButton(menu, `이동한다 (${nextLayer}층 ${nextLayerData.name})`, () => {
        player.position = "Labyrinth";
        player.currentLayer = nextLayer;
        player.daysInLabyrinth = 1; 
        player.explorationCount = 0;
        player.sleepCount = 0;
        player.timeRemaining = nextLayerData.time_limit || 0; 

        logMessage(`${nextLayer}층 ${nextLayerData.name}(으)로 진입합니다.`);
        
        /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
        player.questManager?.checkProgress('REACH', `${nextLayer}층`, 1);

        updateMenu(player); 
        player.showStatus();
    });

    // [신규] 8층 -> 9층 이동 시 "머무른다" 옵션
    if (currentLayer) {
        /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
        const currentLayerData = player.cb.gameData?.layers?.[currentLayer];
        const currentLayerName = currentLayerData?.name || `${currentLayer}층`;
        addButton(menu, `머무른다 (${currentLayerName})`, () => {
            logMessage(`현재 ${currentLayerName}에 머무르기로 했다.`);
            updateMenu(player);
        });
    } 
    // (기존) 8층이 아닌 경우
    else {
        addButton(menu, "머무른다 (현재 층 탐색)", () => {
            logMessage("현재 층에 머무르기로 했다.");
            updateMenu(player);
        });
    }
}


/**
 * [신규][확장 계획 5] 균열(Rift) 발견 시 입장 여부 팝업 표시
 * @param {Player} player - 플레이어 객체
 * @param {object} rift - 입장할 단일 균열 데이터 (world_data.json)
 */
/* AUTO-FIX: [Plan 4] Added new modal function 'showRiftEntryModal' */
export function showRiftEntryModal(player, rift) {
    const modal = document.getElementById('rift-choice-screen');
    const title = document.getElementById('rift-choice-title');
    const desc = document.getElementById('rift-choice-desc');
    const buttonList = document.getElementById('rift-choice-buttons');

    if (!modal || !title || !desc || !buttonList) {
        console.error("Rift Choice Modal elements not found! (Check index.html)");
        logMessage("균열을 발견했지만 UI 오류로 인해 무시합니다.");
        return;
    }

    buttonList.innerHTML = '';
    title.innerHTML = `<i class="icon-combat"></i> [${rift.name}] 균열 발견!`;
    desc.textContent = rift.description || "불안정한 차원의 틈새를 발견했습니다. 입장하시겠습니까?";

    // 1. 입장 버튼
    addButton(buttonList, "입장한다", () => {
        player.position = "Rift"; // 플레이어 위치를 '균열'로 변경
        player.currentRift = rift; // 진입할 균열 정보 저장
        player.currentRiftStage = 0; // 균열 1단계부터 시작

        logMessage(`[${rift.name}] 균열 속으로 진입합니다...`);
        hideModal('#rift-choice-screen');
        updateMenu(player); // 균열용 메뉴(Rift Menu)로 갱신
        player.showStatus();
    });

    // 2. 거절 버튼
    addButton(buttonList, "입장하지 않는다", () => {
        logMessage("균열을 무시하고 탐색을 계속합니다.");
        hideModal('#rift-choice-screen');
    });

    showModal('#rift-choice-screen');
}


/**
 * 인벤토리 모달 표시 (ui_main.js로 복구)
 * @param {Player} player - 플레이어 객체
 */
export function showInventory(player) {
    const inventoryScreenDiv = document.getElementById('inventory-screen');
    const inventoryListDiv = document.getElementById('inventory-list');
    const backButton = inventoryScreenDiv ? inventoryScreenDiv.querySelector('.modal-close-btn') : null;

    if (!inventoryScreenDiv || !inventoryListDiv || !backButton) {
        console.error("Inventory modal elements not found!");
        return;
    }

    inventoryListDiv.innerHTML = '';

    /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
    const itemCounts = player.inventory?.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});

    /* AUTO-FIX: added optional chaining ?. and default values {} for safety (Rule 4); review required */
    const allGameItems = {
        ...(player.cb?.gameData?.items || {}), 
        ...(player.cb?.gameData?.numbersItems || {}), 
        ...(player.cb?.gameData?.shopItems || {}), 
        ...(player.cb?.gameData?.materials || {})
    };

    if (!itemCounts || Object.keys(itemCounts).length === 0) {
        inventoryListDiv.innerHTML = "<p>인벤토리가 비어있습니다.</p>";
    } else {
        Object.entries(itemCounts).forEach(([itemName, count]) => {
            const btn = document.createElement('button');
            const itemData = allGameItems[itemName] || {desc: "정보 없음"};
            btn.textContent = `${itemName} (${count}개) - ${itemData.desc}`;
            btn.classList.add('list-item'); 

            /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
            const functionalItemData = player.cb?.gameData?.items?.[itemName] || player.cb?.gameData?.numbersItems?.[itemName];
            
            if (functionalItemData && typeof functionalItemData.effect === 'function' && (!itemData.type || itemData.type === '소모품')) {
                btn.onclick = () => {
                     hideModal('#inventory-screen'); 
                     player.useItem(itemName); 
                }
                btn.style.borderLeftColor = 'var(--color-stamina)'; 
            }
            // 2. 장착 가능한 장비
            else if (itemData.type && ['투구', '갑옷', '장갑', '각반', '무기', '부무기', '팔찌', '목걸이', '반지', '귀걸이', '벨트', '방패', '검', '창', '부츠', '시계', '횃불'].includes(itemData.type)) {
                
                // [수정] 장착 부위 재-매핑 (예: "검" -> "무기")
                let slot = itemData.type;
                if (['검', '창', '횃불'].includes(slot)) slot = '무기';
                if (['방패', '시계'].includes(slot)) slot = '부무기';
                if (['부츠'].includes(slot)) slot = '각반';

                const isEquipped = player.equipment[slot] === itemName;
                
                if (isEquipped) {
                    btn.textContent = `[해제] ${itemName} (${count}개) - ${itemData.desc}`;
                    btn.onclick = () => {
                        player.unequipItem(slot);
                        showInventory(player); // 모달 갱신
                    }
                    btn.style.borderLeftColor = 'var(--color-health)';
                } else {
                    btn.textContent = `[장착] ${itemName} (${count}개) - ${itemData.desc}`;
                    btn.onclick = () => {
                        player.equipItem(itemName);
                        showInventory(player); // 모달 갱신
                    }
                    btn.style.borderLeftColor = 'var(--color-accent)'; 
                }
            }
            // 3. 기타 (재료 등)
            else {
                btn.disabled = true;
                btn.style.borderLeftColor = 'var(--color-border)'; 
            }
            inventoryListDiv.appendChild(btn);
        });
    }

    showModal('#inventory-screen'); 
    backButton.onclick = () => {
        hideModal('#inventory-screen');
    };
}

/**
 * [제거됨] ui_party.js로 이동
 */
// export function showParty(player) { ... }

/**
 * 보유 정수 목록 모달 표시 (ui_main.js로 복구)
 * @param {Player} player - 플레이어 객체
 */
export function showEssences(player) {
    const essencesScreenDiv = document.getElementById('essences-screen');
    const essencesListDiv = document.getElementById('essences-list');
    const backButton = essencesScreenDiv ? essencesScreenDiv.querySelector('.modal-close-btn') : null;

     if (!essencesScreenDiv || !essencesListDiv || !backButton) {
         console.error("Essences screen modal elements not found!");
         return;
     }

    // [수정] 디아몬트 패시브 반영
    let maxEssences = player.level * 3;
    /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
    if (player.essences?.includes("디아몬트")) {
        maxEssences -= 1;
    }
    essencesListDiv.innerHTML = `<p style="text-align: right;"><b>보유 정수 (${player.essences.length}/${maxEssences})</b></p>`;

    if (player.essences.length === 0) {
        essencesListDiv.innerHTML += "<p>흡수한 정수가 없습니다.</p>";
    } else {
        player.essences.forEach(essenceName => {
            /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
            const essence = player.cb?.gameData?.essences?.[essenceName];
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = 'var(--color-magic)'; 

            let essenceInfo = `<b>${essenceName} 정수</b> (등급: ${essence?.grade || '?'})`;
            if(essence){ 
                 if (essence.stats) {
                     essenceInfo += `<br>- 스탯: ${Object.entries(essence.stats).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')}`;
                 }
                if(essence.passive) {
                    const passives = Array.isArray(essence.passive) ? essence.passive : [essence.passive];
                    passives.forEach(p => {
                        essenceInfo += `<br>- 패시브: ${p.name} (${p.desc})`;
                    });
                }
                if(essence.active) {
                    const actives = Array.isArray(essence.active) ? essence.active : [essence.active];
                    actives.forEach(a => {
                        essenceInfo += `<br>- 액티브: ${a.name} (MP ${a.mp_cost || 0}) - ${a.desc}`;
                    });
                }
            } else {
                essenceInfo += `<br>- (데이터 오류: 상세 정보 없음)`;
            }
            div.innerHTML = essenceInfo;
            essencesListDiv.appendChild(div);
        });
    }

    showModal('#essences-screen'); 
    backButton.onclick = () => {
        hideModal('#essences-screen');
    };
}

/**
 * 배운 마법 및 정수 스킬 목록 모달 표시 (ui_main.js로 복구)
 * @param {Player} player - 플레이어 객체
 */
export function showSpells(player) {
    const spellsScreenDiv = document.getElementById('spells-screen');
    const spellsListDiv = document.getElementById('spells-list');
    const backButton = spellsScreenDiv ? spellsScreenDiv.querySelector('.modal-close-btn') : null;

     if (!spellsScreenDiv || !spellsListDiv || !backButton) {
         console.error("Spells screen modal elements not found!");
         return;
     }

    spellsListDiv.innerHTML = '<h3>마법 목록</h3>'; 
    if (player.spells.length > 0) {
        player.spells.forEach(spellName => {
            /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
            const spell = player.cb?.gameData?.magic?.[spellName];
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = 'var(--color-magic)'; 
            if (spell) {
                 div.innerHTML = `<b>${spellName}</b> - [${spell.grade}등급/MP ${spell.mp_cost}]<br>${spell.desc}`;
            } else {
                div.textContent = `${spellName} - (데이터 오류: 상세 정보 없음)`;
            }
            spellsListDiv.appendChild(div);
        });
    } else {
         spellsListDiv.innerHTML += '<p>배운 마법이 없습니다.</p>';
    }

     spellsListDiv.innerHTML += '<h3 style="margin-top: 20px;">정수 스킬 목록</h3>'; 
     if (player.essence_skills.length > 0) {
        player.essence_skills.forEach(skillName => {
             let skillDesc = "(상세 정보 없음)";
             let mpCost = 0;
             for (const key of player.essences) { 
                 /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
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

            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = 'var(--color-accent)'; 
            div.innerHTML = `<b>${skillName}</b> - [MP ${mpCost}]<br>${skillDesc}`;
            spellsListDiv.appendChild(div);
        });
     } else {
         spellsListDiv.innerHTML += '<p>배운 정수 스킬이 없습니다.</p>';
     }

    showModal('#spells-screen');
    backButton.onclick = () => {
        hideModal('#spells-screen');
    };
}