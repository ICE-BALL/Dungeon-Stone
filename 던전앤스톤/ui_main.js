// 이 파일은 게임의 메인 흐름(비전투) UI 함수를 담당합니다.
// (종족 선택, 도시, 탐험, 메인 모달창)
// 기존 ui.js에서 분리됨
// [수정] 파티원 모집 시 classes.js의 수정된 NPC 생성자 사용
// --- [계획 수정 2] ---
// [추가] showPortalChoice 함수: 차원 비석 발견 시 다음 층 이동/머무르기 선택 버튼 표시
// [수정] updateMenu 함수: '탐색하기' 이벤트 로직 수정 (event.portalTo 속성 감지하여 showPortalChoice 호출)

// --- 데이터 임포트 ---
import {
    races,
    essences,
    magic,
    expToLevel
} from './data_core.js';

import {
    layers, // showPortalChoice에서 다음 층 정보(time_limit)를 가져오기 위해 필요
    cities,
    npcs,
    shopItems,
    materials,
    items,
    numbersItems
} from './data_content.js';

// --- 클래스 임포트 ---
import { NPC } from './classes.js';

// --- [신규] 핵심 UI 유틸리티 임포트 ---
import {
    logMessage,
    addButton,
    showModal,
    hideModal,
    updateStatusBars
} from './ui_core.js';


/**
 * [수정] 게임 시작 시 종족 선택 화면 초기화 + 도시 BGM 재생 트리거
 * @param {Player} player - 플레이어 객체
 */
export function initRaceSelection(player) {
    const raceSelectionDiv = document.getElementById('race-selection');
    const racesListDiv = document.getElementById('races-list');
    const mainGameDiv = document.getElementById('main-game');

    if (raceSelectionDiv && racesListDiv && mainGameDiv) {
        // 타이틀 BGM은 main.js에서 이미 재생 중
        raceSelectionDiv.style.display = 'block';
        mainGameDiv.classList.add('hidden');
        mainGameDiv.style.display = 'none';

        racesListDiv.innerHTML = '';

        Object.keys(races).forEach(race => {
            addButton(racesListDiv, `${race} - ${races[race].description}`, () => {
                player.chooseRace(race);
                raceSelectionDiv.style.display = 'none';

                mainGameDiv.classList.remove('hidden');
                mainGameDiv.style.display = 'grid'; // 메인 게임 레이아웃 활성화

                logMessage("던전 앤 스톤의 세계에 온 것을 환영합니다. 도시에서 탐험을 준비하세요.");

                // --- [BGM] 도시 BGM 재생 ---
                if (player.cb && player.cb.playMusic) {
                    player.cb.playMusic('bgm-city');
                }
                // --- [BGM] 완료 ---

                updateMenu(player); // 메인 메뉴 업데이트
                player.showStatus(); // 상태창 업데이트 (콜백 통해 상태바도 업데이트됨)
                // updateStatusBars(player); // player.showStatus() 내부에서 호출되므로 중복 제거 가능
            });
        });
    } else {
        console.error("Race selection elements not found!");
    }
}

/**
 * [수정] 플레이어 위치에 따라 메인 메뉴 갱신 + 상황별 BGM 재생
 * (참고: 이 함수는 전투 UI를 호출하지 않음, 오직 전투 화면을 숨길 뿐)
 * @param {Player} player - 플레이어 객체
 */
export function updateMenu(player) {
    const menu = document.getElementById('menu');
    const combatScreen = document.getElementById('combat-screen');
    const mainGameDiv = document.getElementById('main-game'); // 메인 게임 div 참조 추가

    if (!menu || !combatScreen || !mainGameDiv) {
        console.error("Menu, CombatScreen, or MainGame element not found!");
        return;
    }

    // --- [BGM] 현재 위치에 맞는 BGM 재생 ---
    if (player.cb && player.cb.playMusic) {
        if (player.position === "Labyrinth") {
            player.cb.playMusic('bgm-dungeon');
        } else { // 도시 또는 다른 안전 구역
            player.cb.playMusic('bgm-city');
        }
    }
    // --- [BGM] 완료 ---

    // 화면 전환 (메인 메뉴 표시, 전투 화면 숨김)
    menu.innerHTML = ''; // 메뉴 초기화
    menu.classList.remove('hidden');
    menu.style.display = 'flex'; // 메뉴 영역 표시
    combatScreen.classList.add('hidden'); // 전투 화면 숨김
    combatScreen.style.display = 'none';
    mainGameDiv.style.display = 'grid'; // 메인 게임 레이아웃 유지

    updateStatusBars(player); // 상태 바 업데이트

    // 미궁 내부 메뉴
    if (player.position === "Labyrinth") {
        const layer = layers[player.currentLayer];
        if (!layer) {
             logMessage(`오류: ${player.currentLayer}층 데이터를 찾을 수 없습니다.`);
             player.position = "라비기온 (7-13구역)"; // 오류 시 도시로 귀환
             updateMenu(player);
             return;
        }

        // 남은 시간 초기화 (처음 진입 시) 또는 유지
        player.timeRemaining = player.timeRemaining !== undefined && player.timeRemaining > 0 ? player.timeRemaining : layer.time_limit;
        logMessage(`현재 위치: ${player.currentLayer}층 - ${layer.name} | 남은 시간: ${player.timeRemaining}시간`);

        // 탐색 버튼
        const exploreButton = addButton(menu, "탐색하기", () => {
            player.explorationCount++;
            player.fatigue += Math.max(1, 10 - Math.floor((player.stats["지구력"] || 10) / 2)); // 피로도 증가
            player.timeRemaining--; // 시간 감소
            if(player.fatigue > 100) player.fatigue = 100; // 피로도 최대 100

            // 하루 경과 체크
            if (player.explorationCount % 24 === 0) {
                player.daysInLabyrinth++;
                player.sleepCount = 0; // 날짜 변경 시 잠자기 횟수 초기화
                logMessage("하루가 지났다...");
            }
            // 시간 초과 체크
            if (player.timeRemaining <= 0) {
                logMessage("시간이 다 되어 강제로 도시로 귀환합니다.");
                player.position = "라비기온 (7-13구역)";
                player.timeRemaining = 0; // 남은 시간 초기화
                updateMenu(player); // 도시 메뉴로 + 도시 BGM 자동 재생
                return;
            }

            // 이벤트 발생
            const rand = Math.random();
            let encounteredMonster = null;
            if (rand < 0.05 && monsters["균열 수호자"]) { // 균열 발생 확률 (5%)
                 logMessage("땅이 흔들리며 균열이 나타났다!");
                 encounteredMonster = "균열 수호자";
            } else if (rand < 0.6) { // 몬스터 조우 확률 (55%)
                logMessage("몬스터와 조우했다!");
                 encounteredMonster = player.cb.getRandomMonsters(player.currentLayer); // 유틸리티 함수 사용
            } else { // 일반 이벤트 또는 아무 일 없음 (40%)
                 if (layer.events && layer.events.length > 0) {
                     const event = layer.events[Math.floor(Math.random() * layer.events.length)];
                     
                     // --- [계획 수정 2] ---
                     // 이벤트에 portalTo 속성이 있는지 확인
                     if (event.portalTo !== undefined) {
                         // 포탈 발견 시, 선택 함수 호출
                         showPortalChoice(player, event.portalTo);
                     } 
                     // --- [수정 완료] ---
                     else {
                         // 기존 일반 이벤트 처리
                         logMessage(event.desc);
                         // 이벤트 효과 실행
                         if(typeof event.effect === 'function') event.effect(player);
                         // --- [SFX] 이벤트 종류에 따라 효과음 재생 가능 ---
                         // 예: if (event.type === 'item_found') player.safePlaySfx('sfx-event');
                     }
                 } else {
                     logMessage("아무 일도 일어나지 않았다.");
                 }
            }

            // 몬스터 조우 시 전투 시작
            if (encounteredMonster) {
                 player.startCombat(encounteredMonster); // classes.js에서 전투 BGM 재생 호출
            }

            player.showStatus(); // 상태 업데이트
            // updateStatusBars(player); // showStatus 내부에서 호출됨
        });
        if (player.inCombat) exploreButton.disabled = true; // 전투 중 비활성화

        // 잠자기 버튼
        const sleepButton = addButton(menu, `잠자기 (피로/체력/MP/기력 회복) [${player.sleepCount}/3]`, () => {
            if (player.sleepCount >= 3) {
                logMessage("오늘은 이미 너무 많이 잤다.");
                return;
            }
            player.sleepCount++;
            if (player.party.length > 0) { // 파티원 있으면 안전하게 잠
                player.fatigue = 0;
                player.hp = player.maxHp;
                player.mp = player.maxMp;
                player.stamina = player.maxStamina;
                logMessage(`${player.party[0].name}이(가) 보초를 서는 동안 안전하게 잠을 자 모든 것을 회복했다.`);
            } else { // 혼자면 습격 확률
                logMessage("동료가 없어 불안한 마음에 잠을 청한다...");
                if (Math.random() < 0.4) { // 40% 확률로 습격
                    logMessage("잠든 사이 몬스터의 습격을 받았다!");
                     const monsterToAttack = player.cb.randomMonsterFromLayer(player.currentLayer);
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
            // updateStatusBars(player); // showStatus 내부에서 호출됨
            updateMenu(player); // 잠자기 횟수 표시 갱신
        });
        if (player.sleepCount >= 3 || player.inCombat) sleepButton.disabled = true; // 3번 잤거나 전투 중이면 비활성화

        // 종족 스킬 버튼
        const racialSkill = races[player.race]?.racial_skill;
        if (racialSkill) {
            addButton(menu, `종족 스킬: ${racialSkill.name}`, () => {
                if(typeof racialSkill.effect === 'function') {
                    logMessage(`종족 스킬 [${racialSkill.name}]을(를) 사용합니다: ${racialSkill.desc}`);
                    racialSkill.effect(player);
                    player.showStatus(); // 상태 변화 표시
                } else {
                    logMessage("이 종족은 특별한 스킬이 없습니다.");
                }
            }).disabled = player.inCombat; // 전투 중 비활성화
        }

        // 도시 귀환 버튼
        const returnButton = addButton(menu, "도시로 귀환", () => {
            player.position = "라비기온 (7-13구역)";
            logMessage("안전하게 도시로 귀환했다.");
            player.timeRemaining = 0; // 남은 시간 초기화
            updateMenu(player); // 도시 메뉴로 + 도시 BGM 자동 재생
            player.showStatus();
        });
        if (player.inCombat) { // 전투 중 비활성화
            returnButton.disabled = true;
            returnButton.title = "전투 중에는 귀환할 수 없습니다.";
        }

    }
    // 도시 내부 메뉴
    else {
        addButton(menu, "도시 구역 이동", () => showCityDistricts(player));
        addButton(menu, "현재 구역 활동", () => showCityLocations(player));
        addButton(menu, "미궁 진입 (1층)", () => {
             const layerOne = layers[1];
             if (!layerOne) {
                 logMessage("오류: 1층 미궁 데이터를 찾을 수 없습니다.");
                 return;
             }
            player.position = "Labyrinth";
            player.currentLayer = 1;
            player.daysInLabyrinth = 1;
            player.explorationCount = 0;
            player.sleepCount = 0;
            player.timeRemaining = layerOne.time_limit; // 1층 시간 제한 설정
            logMessage("1층 수정동굴로 진입합니다.");
            updateMenu(player); // 미궁 메뉴로 + 미궁 BGM 자동 재생
            player.showStatus();
        });
    }

    // 공통 메뉴 (모달 열기 버튼)
    addButton(menu, "인벤토리", () => showInventory(player)).disabled = player.inCombat;
    addButton(menu, "정수 확인", () => showEssences(player)).disabled = player.inCombat;
    addButton(menu, "마법/스킬", () => showSpells(player)).disabled = player.inCombat;
    addButton(menu, "파티원 정보", () => showParty(player)).disabled = player.inCombat;
    addButton(menu, "상태 보기 (텍스트 재출력)", () => player.showStatus()); // 단순 상태 재출력
}

/**
 * 도시 구역 이동 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCityDistricts(player) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 메뉴 초기화
    logMessage("어느 구역으로 이동하시겠습니까?");
    const cityData = cities["라프도니아"];
    if (cityData) {
        Object.keys(cityData).forEach(district => {
             // 구역 정보가 있고, 설명이 있는 경우 버튼 생성
             if (cityData[district] && cityData[district].desc) {
                 addButton(menu, `${district} - ${cityData[district].desc}`, () => {
                     player.position = district; // 플레이어 위치 변경
                     logMessage(`${district}(으)로 이동했다.`);
                     updateMenu(player); // 메인 메뉴 업데이트 (도시 BGM 유지)
                 });
             }
        });
    }
    addButton(menu, "뒤로 (메인 메뉴)", () => updateMenu(player)); // 이전 메뉴로
}

/**
 * 현재 도시 구역의 활동 장소 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCityLocations(player) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 메뉴 초기화
    const district = cities.라프도니아[player.position]; // 현재 구역 데이터 가져오기

    // 현재 구역에 활동 장소가 있으면 버튼 생성
    if (district && district.locations) {
        logMessage(`현재 구역 [${player.position}]에서 활동할 장소를 선택하세요.`);
        Object.keys(district.locations).forEach(loc => {
             // 장소 정보와 설명이 있으면 버튼 생성
             if (district.locations[loc] && district.locations[loc].desc) {
                 addButton(menu, `${loc} - ${district.locations[loc].desc}`, () => {
                     logMessage(`${loc}(으)로 이동했다.`);
                     handleCityAction(player, loc); // 해당 장소 행동 처리 함수 호출
                 });
             }
        });
    } else {
        logMessage("현재 구역에는 특별한 활동 장소가 없습니다.");
    }
    addButton(menu, "뒤로 (메인 메뉴)", () => updateMenu(player)); // 이전 메뉴로
}

/**
 * 도시 장소별 행동 처리
 * @param {Player} player - 플레이어 객체
 * @param {string} location - 행동을 처리할 장소 이름
 */
export function handleCityAction(player, location) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 행동 메뉴 초기화

    // --- [SFX] 아이템 구매/판매/환전 등 성공 시 효과음은 각 로직 내부 또는 Player 클래스에서 처리 ---

    switch(location) {
        // 도서관
        case "라비기온 중앙 도서관":
             const librarian = npcs["도서관 사서 라그나"];
             if (librarian && typeof librarian.action === 'function') {
                librarian.action(player); // NPC 상호작용 함수 호출
             } else {
                 logMessage("도서관 사서를 찾을 수 없거나 상호작용할 수 없습니다.");
             }
            break;
        // 환전소
        case "환전소":
            if(player.magic_stones > 0) {
                const exchangeRate = 20; // 마석 1개당 스톤 환율 (임시)
                const earnedStones = player.magic_stones * exchangeRate;
                player.gold += earnedStones;
                logMessage(`마석 ${player.magic_stones}개를 ${earnedStones} 스톤으로 교환했다.`);
                player.magic_stones = 0; // 마석 초기화
                player.safePlaySfx('sfx-event'); // [SFX] 환전 성공
            } else {
                logMessage("교환할 마석이 없다.");
            }
            break;
        // 탐험가 길드
        case "탐험가 길드 지부":
             const guildReceptionist = npcs["탐험가 길드 접수원"];
             if (guildReceptionist) logMessage(guildReceptionist.dialog);
             else logMessage("탐험가 길드 접수원을 찾을 수 없습니다.");

            // 파티원 모집 버튼
            addButton(menu, "파티원 모집", () => {
                menu.innerHTML = '';
                logMessage("어떤 등급의 동료를 모집하시겠습니까? (비용이 발생합니다)");
                // 등급별 모집 버튼 생성
                for (let i = 9; i >= 1; i--) {
                     const cost = (10 - i) * 1000 * (1 + (9-i)*0.5); // 등급 높을수록 비용 증가폭 크게 (임시)
                     addButton(menu, `${i}등급 동료 모집 (${cost.toLocaleString()} 스톤)`, () => {
                        if (player.gold < cost) {
                            logMessage("돈이 부족합니다.");
                            return;
                        }
                        if (player.party.length >= 4) { // 파티원 최대 수 제한 (임시 4명)
                                logMessage("파티원이 가득 찼습니다. (최대 4명)");
                                return;
                        }

                        player.gold -= cost;
                         // [수정] 수정된 NPC 생성자 사용 (등급, 콜백 전달)
                         const newCompanion = new NPC(`동료용병-${player.party.length+1}`, "Human", i, player.cb);
                        player.party.push(newCompanion);
                        logMessage(`${newCompanion.name}(${i}등급/${newCompanion.trait})와 파티 결속을 맺었다.`);
                        player.safePlaySfx('sfx-event'); // [SFX] 파티원 영입
                        player.showStatus(); // 상태 업데이트
                        handleCityAction(player, "탐험가 길드 지부"); // 길드 메뉴로 복귀
                    });
                }
                addButton(menu, "뒤로 (길드 메뉴)", () => handleCityAction(player, "탐험가 길드 지부"));
            });
            // 다른 길드 기능 버튼 추가 가능 (퀘스트, 정보 구매 등)
            break;
        // 주점
        case "주점":
            const barkeep = npcs["주점 주인"];
            if (barkeep) logMessage(barkeep.dialog);
            else logMessage("주점 주인이 보이지 않는다.");
            // 다른 탐험가와 대화 버튼
            addButton(menu, "다른 탐험가와 대화하기 (정보 얻기)", () => {
                const tips = [
                    "1층 고블린은 약하지만 덫을 조심해야 해.",
                    "6층부터는 미궁 구조가 고정된다더군.",
                    "넘버스 아이템? 그건 균열에서나 나온다고!",
                    "바바리안족은 토베라 교단의 신성력을 받을 수 없다지.",
                    "요즘 노아르크 놈들 때문에 뒤숭숭해.",
                    "마녀의 숲은 방향감각을 잃기 쉬우니 조심하게.",
                    "5층 클랜들은 텃세가 심하니 건드리지 않는게 좋아."
                ];
                logMessage(`옆 테이블 탐험가: "${tips[Math.floor(Math.random() * tips.length)]}"`);
            });
            break;
        // 상점가
        case "상점가":
            const merchant = npcs["상점 주인"];
            if (merchant) logMessage(merchant.dialog);
            // 구매 버튼 생성
            Object.keys(shopItems).forEach(item => {
                 const shopItem = shopItems[item];
                 if (shopItem && shopItem.price) {
                     addButton(menu, `구매: ${item} (${shopItem.price.toLocaleString()} 스톤) - ${shopItem.desc}`, () => {
                         if (player.gold >= shopItem.price) {
                             player.gold -= shopItem.price;
                             player.addItem(item); // Player 클래스에서 SFX 재생 필요
                             logMessage(`${item}을(를) 구매했다.`);
                             player.showStatus(); // 골드 변경 표시
                             // 구매 후 상점 메뉴 다시 표시 (선택사항)
                             // handleCityAction(player, "상점가");
                         } else {
                             logMessage("돈이 부족하다.");
                         }
                     });
                 }
            });
            // 판매 버튼
            addButton(menu, "아이템 판매", () => {
                const itemToSell = prompt("판매할 아이템 이름을 정확히 입력하세요:");
                 if (!itemToSell) return; // 취소 시 종료

                 const itemIndex = player.inventory.indexOf(itemToSell);
                 if (itemIndex > -1) { // 인벤토리에 아이템이 있으면
                     // 판매 가격 계산 (구매가의 절반 또는 기본값)
                     const basePrice = items[itemToSell]?.price || numbersItems[itemToSell]?.price || shopItems[itemToSell]?.price || materials[itemToSell]?.tier * 10 || 10; // 넘버스, 소재 가격 추가
                    const sellPrice = Math.floor(basePrice / 2); // 기본 판매가 = 구매가/2
                    player.gold += sellPrice;
                    player.inventory.splice(itemIndex, 1); // 인벤토리에서 제거
                    logMessage(`${itemToSell}을(를) ${sellPrice} 스톤에 판매했다.`);
                    player.safePlaySfx('sfx-event'); // [SFX] 판매 성공
                    player.showStatus(); // 골드 및 인벤토리 변경 표시
                    handleCityAction(player, "상점가"); // 판매 후 상점 메뉴 다시 표시
                 } else {
                    logMessage("해당 아이템을 가지고 있지 않다.");
                 }
            });
            break;
        // 대신전
        case "대신전 (삼신교)":
                const priest = npcs["교단 신관"];
                if (priest) logMessage(priest.dialog);
                // 정수 삭제 버튼 생성
                if(player.essences.length > 0) {
                    logMessage("삭제할 정수를 선택하세요. 삭제 비용은 5,000,000 스톤입니다.");
                    player.essences.forEach((essenceKey, index) => {
                         const cost = 5000000; // 정수 삭제 비용
                        addButton(menu, `정수 삭제: ${essenceKey} (${cost.toLocaleString()} 스톤)`, () => {
                            if (player.gold < cost) {
                                logMessage("정수 삭제 비용이 부족합니다.");
                                return;
                            }
                            if (confirm(`정말로 [${essenceKey}] 정수를 삭제하시겠습니까? 이 행동은 되돌릴 수 없습니다.`)) {
                                player.gold -= cost;
                                const removed = player.essences.splice(index, 1)[0];
                                logMessage(`신관의 도움으로 영혼에 새겨진 [${removed}] 정수의 흔적을 지웠다.`);
                                // 정수 삭제 시 관련 스킬 제거 로직 필요
                                player.essence_skills = player.essence_skills.filter(skillName => {
                                     let skillExistsInOtherEssences = false;
                                     for(const essKey of player.essences) {
                                         if(essences[essKey]?.active?.name === skillName) {
                                             skillExistsInOtherEssences = true;
                                             break;
                                         }
                                     }
                                     return skillExistsInOtherEssences;
                                });
                                // 패시브 효과 제거 로직도 필요 (복잡할 수 있음)
                                player.safePlaySfx('sfx-event'); // [SFX] 정수 삭제
                                player.showStatus(); // 상태 업데이트
                                handleCityAction(player, "대신전 (삼신교)"); // 메뉴 다시 표시
                            }
                        });
                    });
                } else {
                    logMessage("삭제할 정수가 없습니다.");
                }
                // 치유 기능 추가 가능
            break;
        // 대장간
        case "대장간":
            const blacksmith = npcs["대장장이"];
            if (blacksmith) logMessage(blacksmith.dialog);
            // 아이템 제작 버튼
            addButton(menu, "아이템 제작", () => {
                // 제작 로직 (기존과 유사하게 유지)
                const recipe = prompt("제작할 아이템과 필요한 소재를 입력하세요 (예: 강철 검,강철 조각:5):");
                if (!recipe || !recipe.includes(',') || !recipe.includes(':')) {
                    logMessage("잘못된 입력 형식입니다. (예: 아이템명,소재명:개수,소재명2:개수2)");
                    handleCityAction(player, "대장간");
                    return;
                }
                const parts = recipe.split(',');
                if (parts.length < 2) { logMessage("잘못된 입력 형식."); handleCityAction(player, "대장간"); return; }

                const itemName = parts[0].trim();
                const materialsInput = parts.slice(1).join(',').trim();
                let requiredMaterials = {};
                let canCraft = true;

                 try { // 재료 파싱
                     materialsInput.split(',').forEach(mat => {
                         const matParts = mat.split(':');
                         if (matParts.length !== 2) throw new Error("재료 형식 오류");
                         const materialName = matParts[0].trim();
                         const requiredCount = parseInt(matParts[1]);
                         if (isNaN(requiredCount) || requiredCount <= 0) throw new Error("재료 개수 오류");
                         if (!materials[materialName] && !items[materialName] && !numbersItems[materialName]) throw new Error(`알 수 없는 재료: ${materialName}`); // 아이템, 넘버스도 재료로 사용 가능하게
                         requiredMaterials[materialName] = requiredCount;
                     });
                 } catch (e) {
                     logMessage(`입력 오류: ${e.message}`);
                     canCraft = false;
                 }

                 if (canCraft) { // 재료 보유 확인
                     for (const materialName in requiredMaterials) {
                         const ownedCount = player.inventory.filter(i => i === materialName).length;
                         if (ownedCount < requiredMaterials[materialName]) {
                             logMessage(`${materialName} 소재가 부족합니다. (필요: ${requiredMaterials[materialName]}, 보유: ${ownedCount})`);
                             canCraft = false;
                             break;
                         }
                     }
                 }

                if (canCraft) { // 제작 실행
                     for (const materialName in requiredMaterials) {
                         for (let i = 0; i < requiredMaterials[materialName]; i++) {
                             const indexToRemove = player.inventory.indexOf(materialName);
                             if (indexToRemove > -1) player.inventory.splice(indexToRemove, 1);
                         }
                     }
                    player.addItem(itemName); // 제작된 아이템 추가 (Player 클래스에서 SFX)
                    logMessage(`${itemName}을(를) 제작했다!`);
                    player.showStatus(); // 인벤토리 변경 표시
                } else {
                    logMessage("소재가 부족하거나 입력 오류로 제작할 수 없다.");
                }
                 handleCityAction(player, "대장간"); // 대장간 메뉴로 복귀
            });
            addButton(menu, "장비 강화", () => logMessage("아직 구현되지 않았습니다."));
            addButton(menu, "장비 수리", () => logMessage("아직 구현되지 않았습니다."));
            break;
        // 여관
        case "여관":
             const innCost = 200; // 여관 비용
             const innkeeper = npcs["여관 주인"];
             if (innkeeper) logMessage(innkeeper.dialog);

            if(player.gold < innCost) {
                logMessage("돈이 부족하여 여관에 묵을 수 없다.");
            } else {
                player.hp = player.maxHp;
                player.mp = player.maxMp;
                player.stamina = player.maxStamina;
                player.fatigue = 0; // 피로도 회복
                player.gold -= innCost; // 비용 지불
                logMessage(`여관에서 하루 묵으며 모든 것을 회복했다. (${innCost} 스톤 지불)`);
                player.safePlaySfx('sfx-event'); // [SFX] 휴식
                player.showStatus(); // 상태 업데이트
            }
            break;
        // 구현되지 않은 장소
        default:
            logMessage("아직 구현되지 않은 장소입니다.");
    }
    // 모든 장소 행동 후 '뒤로' 버튼 추가 (도시 구역 활동 메뉴로 돌아감)
    addButton(menu, "뒤로 (구역 활동 메뉴)", () => showCityLocations(player));
    // player.showStatus(); // 각 행동 후 상태 업데이트는 이미 수행됨
    updateStatusBars(player); // 상태 바는 확실히 업데이트
}


/**
 * [신규] 차원 비석(포탈) 발견 시 선택 메뉴 표시
 * @param {Player} player - 플레이어 객체
 * @param {number | string} nextLayer - 이동할 다음 층 번호 (예: 2, 3, 4, ...)
 */
export function showPortalChoice(player, nextLayer) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 메뉴 초기화

    const layerData = layers[nextLayer]; // 다음 층 데이터 (이름, 시간제한 등)
    if (!layerData) {
        logMessage(`오류: ${nextLayer}층 데이터를 찾을 수 없습니다.`);
        updateMenu(player); // 오류 시 메인 메뉴로 복귀
        return;
    }

    logMessage(`${nextLayer}층 (${layerData.name})으로 가는 차원 비석을 발견했다. 이동하시겠습니까?`);

    // 1. 이동한다 버튼
    addButton(menu, `이동한다 (${nextLayer}층 ${layerData.name})`, () => {
        player.position = "Labyrinth"; // 위치 확정
        player.currentLayer = nextLayer; // 층 변경
        
        // 다음 층 진입 시 초기화
        player.daysInLabyrinth = 1; // (기획에 따라 1일차로 초기화 or 유지) -> 1일차로 초기화
        player.explorationCount = 0;
        player.sleepCount = 0;
        player.timeRemaining = layerData.time_limit || 0; // 새 층의 시간 제한 설정 (없으면 0)

        logMessage(`${nextLayer}층 ${layerData.name}(으)로 진입합니다.`);
        updateMenu(player); // 미궁 메뉴 갱신 (새로운 층)
        player.showStatus();
    });

    // 2. 머무른다 버튼
    addButton(menu, "머무른다 (현재 층 탐색)", () => {
        logMessage("현재 층에 머무르기로 했다.");
        updateMenu(player); // 현재 층의 미궁 메뉴로 복귀
    });
}


/**
 * 인벤토리 모달 표시
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

    inventoryListDiv.innerHTML = ''; // 목록 초기화

    // 아이템 종류별 수량 계산
    const itemCounts = player.inventory.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});

    // 게임 내 모든 아이템 데이터 통합 (소모품, 넘버스, 상점템, 재료)
    const allGameItems = {...items, ...numbersItems, ...shopItems, ...materials};

    // 인벤토리 아이템 목록 생성
    if (Object.keys(itemCounts).length === 0) {
        inventoryListDiv.innerHTML = "<p>인벤토리가 비어있습니다.</p>";
    } else {
        Object.entries(itemCounts).forEach(([itemName, count]) => {
            const btn = document.createElement('button');
            const itemData = allGameItems[itemName] || {desc: "정보 없음"}; // 아이템 데이터 가져오기
            btn.textContent = `${itemName} (${count}개) - ${itemData.desc}`;
            btn.classList.add('list-item'); // 스타일 적용용 클래스

            // 아이템 타입에 따라 버튼 기능 설정
            // 1. 사용 가능한 소모품 (effect 함수 존재, type 없거나 '소모품')
            if (typeof itemData.effect === 'function' && (!itemData.type || itemData.type === '소모품')) {
                btn.onclick = () => {
                     hideModal('#inventory-screen'); // 사용 전 모달 닫기
                     player.useItem(itemName); // 아이템 사용 (Player 클래스에서 SFX)
                     // showInventory(player); // 인벤토리 다시 열기 (선택사항)
                     player.showStatus(); // 상태 업데이트
                }
                btn.style.borderLeftColor = 'var(--color-stamina)'; // 사용 가능 표시 (초록색)
            }
            // 2. 장착 가능한 장비 (type이 장비 부위와 일치)
            else if (itemData.type && ['투구', '갑옷', '장갑', '각반', '무기', '부무기'].includes(itemData.type)) {
                btn.textContent = `[장착] ${itemName} (${count}개) - ${itemData.desc}`;
                btn.onclick = () => {
                    const currentEquipment = player.equipment[itemData.type];
                    // 이미 장착된 장비 해제 및 인벤토리 추가
                    if (currentEquipment) {
                        player.addItem(currentEquipment);
                        logMessage(`${currentEquipment} 장착 해제.`);
                    }
                    // 새 장비 장착 및 인벤토리에서 제거
                    player.equipment[itemData.type] = itemName;
                    const indexToRemove = player.inventory.indexOf(itemName);
                    if(indexToRemove > -1) player.inventory.splice(indexToRemove, 1);
                    logMessage(`${itemName}을(를) ${itemData.type} 부위에 장착했다.`);
                    player.safePlaySfx('sfx-event'); // [SFX] 장비 장착
                    player.showStatus(); // 상태 업데이트
                    showInventory(player); // 인벤토리 갱신
                }
                btn.style.borderLeftColor = 'var(--color-accent)'; // 장착 가능 표시 (노란색)
            }
            // 3. 기타 (재료, 사용/장착 불가 아이템)
            else {
                btn.disabled = true; // 버튼 비활성화
                btn.style.borderLeftColor = 'var(--color-border)'; // 비활성 표시 (회색)
            }
            inventoryListDiv.appendChild(btn);
        });
    }

    showModal('#inventory-screen'); // 모달 표시
    // 모달 닫기 버튼
    backButton.onclick = () => {
        hideModal('#inventory-screen');
    };
}

/**
 * 파티원 정보 모달 표시
 * @param {Player} player - 플레이어 객체
 */
export function showParty(player) {
    const partyScreenDiv = document.getElementById('party-screen');
    const partyListDiv = document.getElementById('party-list');
    const backButton = partyScreenDiv ? partyScreenDiv.querySelector('.modal-close-btn') : null;

     if (!partyScreenDiv || !partyListDiv || !backButton) {
         console.error("Party screen modal elements not found!");
         return;
     }

    partyListDiv.innerHTML = ''; // 목록 초기화
    if (player.party.length === 0) {
        partyListDiv.innerHTML = "<p>모집한 파티원이 없습니다.</p>";
    } else {
        player.party.forEach((member, index) => {
            // 파티원 정보 표시 (상세 스탯 포함)
            let memberInfo = `<b>${member.name} (${member.grade}등급/${member.trait})</b><br>`;
            memberInfo += `레벨: ${member.level} | EXP: ${member.exp}/${expToLevel[member.level] || 'MAX'}<br>`;
            memberInfo += `HP: ${member.hp}/${member.maxHp} | MP: ${member.mp}/${member.maxMp}<br>`;
            memberInfo += `스킬: ${member.skills.map(s => s.name).join(', ') || '없음'}<br>`;
            memberInfo += `정수: ${member.essences.join(', ') || '없음'}<br>`;
            memberInfo += "스탯:<ul class='stat-list' style='font-size: 0.8em;'>"; // 스탯 목록 스타일 조정
            for (const statName in member.stats) {
                 if(member.stats[statName] !== 0) { // 0이 아닌 스탯만 표시
                    memberInfo += `<li class='stat-item'>${statName}: ${member.stats[statName]}</li>`;
                 }
            }
            memberInfo += "</ul>";

            const memberDiv = document.createElement('div');
            memberDiv.className = 'list-item';
            memberDiv.style.borderLeftColor = 'var(--color-stamina)'; // 파티원 표시 (초록색)
            memberDiv.innerHTML = memberInfo;

            // 추방 버튼
            const dismissButton = addButton(memberDiv, "파티에서 추방", () => {
                 if (confirm(`${member.name}을(를) 정말로 파티에서 추방하시겠습니까?`)) {
                    const removedMember = player.party.splice(index, 1)[0]; // 배열에서 제거하고 이름 저장
                    logMessage(`${removedMember.name}을(를) 파티에서 추방했다.`);
                    player.showStatus(); // 파티원 목록 갱신
                    showParty(player); // 모달 내용 갱신
                }
            });
            dismissButton.style.marginTop = "10px";
            dismissButton.style.background = "var(--color-health)"; // 추방 버튼 색상
            dismissButton.style.color = "white";

            partyListDiv.appendChild(memberDiv);
        });
    }

    showModal('#party-screen'); // 모달 표시
    backButton.onclick = () => {
        hideModal('#party-screen'); // 모달 닫기
    };
}

/**
 * 보유 정수 목록 모달 표시
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

     // 보유 정수 개수 표시
    essencesListDiv.innerHTML = `<p style="text-align: right;"><b>보유 정수 (${player.essences.length}/${player.level * 3})</b></p>`; // 레벨*3 제한 표시

    if (player.essences.length === 0) {
        essencesListDiv.innerHTML += "<p>흡수한 정수가 없습니다.</p>";
    } else {
        // 각 정수 정보 표시
        player.essences.forEach(essenceName => {
            const essence = essences[essenceName]; // data_core.js 에서 정수 데이터 가져오기
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = 'var(--color-magic)'; // 정수 표시 (파란색)

            let essenceInfo = `<b>${essenceName} 정수</b>`;
            if(essence){ // 정수 데이터가 있으면 상세 정보 추가
                 // 스탯 변화
                 if (essence.stats) {
                     essenceInfo += `<br>- 스탯: ${Object.entries(essence.stats).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')}`;
                 }
                 // 패시브 스킬
                if(essence.passive) essenceInfo += `<br>- 패시브: ${essence.passive.name} (${essence.passive.desc})`;
                // 액티브 스킬
                if(essence.active) essenceInfo += `<br>- 액티브: ${essence.active.name} (MP ${essence.active.mp_cost || 0}) - ${essence.active.desc}`;
            } else { // 데이터 없으면 오류 메시지
                essenceInfo += `<br>- (데이터 오류: 상세 정보 없음)`;
            }
            div.innerHTML = essenceInfo;
            essencesListDiv.appendChild(div);
        });
    }

    showModal('#essences-screen'); // 모달 표시
    backButton.onclick = () => {
        hideModal('#essences-screen'); // 모달 닫기
    };
}

/**
 * 배운 마법 및 정수 스킬 목록 모달 표시
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

    spellsListDiv.innerHTML = '<h3>마법 목록</h3>'; // 마법 목록 섹션
    if (player.spells.length > 0) {
        player.spells.forEach(spellName => {
            const spell = magic[spellName]; // data_core.js 에서 마법 데이터 가져오기
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = 'var(--color-magic)'; // 마법 표시 (파란색)
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

     spellsListDiv.innerHTML += '<h3 style="margin-top: 20px;">정수 스킬 목록</h3>'; // 정수 스킬 목록 섹션
     if (player.essence_skills.length > 0) {
        player.essence_skills.forEach(skillName => {
             // 해당 스킬 데이터 찾기
             let skillDesc = "(상세 정보 없음)";
             let mpCost = 0;
             for (const key of player.essences) { // 보유 정수 순회
                 const ess = essences[key];
                 if (ess && ess.active && ess.active.name === skillName) {
                     skillDesc = ess.active.desc || skillDesc;
                     mpCost = ess.active.mp_cost || 0;
                     break; // 찾으면 종료
                 }
             }

            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = 'var(--color-accent)'; // 정수 스킬 표시 (노란색)
            div.innerHTML = `<b>${skillName}</b> - [MP ${mpCost}]<br>${skillDesc}`;
            spellsListDiv.appendChild(div);
        });
     } else {
         spellsListDiv.innerHTML += '<p>배운 정수 스킬이 없습니다.</p>';
     }

    showModal('#spells-screen'); // 모달 표시
    backButton.onclick = () => {
        hideModal('#spells-screen'); // 모달 닫기
    };
}