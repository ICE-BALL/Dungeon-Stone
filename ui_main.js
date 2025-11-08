// 이 파일은 게임의 메인 흐름(비전투) UI 함수를 담당합니다.
// (종족 선택, 도시, 탐험, 메인 모달창)
// [수정] data_core.js, data_content.js의 직접 임포트 제거
// [수정] 모든 데이터(races, layers, items 등)를 player.cb.gameData 객체를 통해 참조하도록 변경

// --- 데이터 임포트 (제거) ---
// (모든 데이터는 player.cb.gameData를 통해 접근)

// --- 클래스 임포트 (제거) ---
// (NPC 클래스는 main.js에서 콜백으로 주입됨)

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

        // [수정] player.cb.gameData에서 races 데이터를 가져옵니다.
        const races = player.cb.gameData.races;
        
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
                player.showStatus(); // 상태창 업데이트
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

    // --- [BGM] 현재 위치에 맞는 BGM 재생 ---
    if (player.cb && player.cb.playMusic) {
        if (player.position === "Labyrinth") {
            player.cb.playMusic('bgm-dungeon');
        } else { // 도시 또는 다른 안전 구역
            player.cb.playMusic('bgm-city');
        }
    }
    // --- [BGM] 완료 ---

    // 화면 전환
    menu.innerHTML = ''; // 메뉴 초기화
    menu.classList.remove('hidden');
    menu.style.display = 'flex';
    combatScreen.classList.add('hidden');
    combatScreen.style.display = 'none';
    mainGameDiv.style.display = 'grid';

    updateStatusBars(player); // 상태 바 업데이트

    // 미궁 내부 메뉴
    if (player.position === "Labyrinth") {
        // [수정] player.cb.gameData에서 layers 데이터를 가져옵니다.
        const layer = player.cb.gameData.layers[player.currentLayer];
        if (!layer) {
             logMessage(`오류: ${player.currentLayer}층 데이터를 찾을 수 없습니다.`);
             player.position = "라비기온 (7-13구역)"; 
             updateMenu(player);
             return;
        }

        player.timeRemaining = player.timeRemaining !== undefined && player.timeRemaining > 0 ? player.timeRemaining : layer.time_limit;
        logMessage(`현재 위치: ${player.currentLayer}층 - ${layer.name} | 남은 시간: ${player.timeRemaining}시간`);

        // 탐색 버튼
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

            const rand = Math.random();
            let encounteredMonster = null;
            // [수정] player.cb.gameData.monsters를 통해 몬스터 존재 여부 확인
            if (rand < 0.05 && player.cb.gameData.monsters["균열 수호자"]) { 
                 logMessage("땅이 흔들리며 균열이 나타났다!");
                 encounteredMonster = "균열 수호자";
            } else if (rand < 0.6) { 
                logMessage("몬스터와 조우했다!");
                 encounteredMonster = player.cb.getRandomMonsters(player.currentLayer); // 콜백 사용
            } else { 
                 if (layer.events && layer.events.length > 0) {
                     const event = layer.events[Math.floor(Math.random() * layer.events.length)];

                     if (event.portalTo !== undefined) {
                         // [수정] 콜백 대신 이 파일의 로컬 함수 호출
                         showPortalChoice(player, event.portalTo);
                     }
                     else {
                         logMessage(event.desc);
                         // [수정] JSON에는 함수가 없으므로, effect 객체를 Player가 처리하도록 전달
                         if (event.effect) {
                             player.handleEventEffect(event.effect); // classes.js에 이 함수 구현 필요 (또는 여기서 직접 처리)
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
        if (player.inCombat) exploreButton.disabled = true;

        // 잠자기 버튼
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
                     const monsterToAttack = player.cb.randomMonsterFromLayer(player.currentLayer); // 콜백 사용
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
        if (player.sleepCount >= 3 || player.inCombat) sleepButton.disabled = true;

        // 종족 스킬 버튼
        // [수정] player.cb.gameData에서 races 데이터를 가져옵니다.
        const racialSkill = player.cb.gameData.races[player.race]?.racial_skill; 
        if (racialSkill) {
            addButton(menu, `종족 스킬: ${racialSkill.name}`, () => {
                // [수정] data_functional.js에서 병합된 effect 함수를 호출합니다.
                if(typeof racialSkill.effect === 'function') {
                    logMessage(`종족 스킬 [${racialSkill.name}]을(를) 사용합니다: ${racialSkill.desc}`);
                    racialSkill.effect(player);
                    player.showStatus();
                } else {
                    logMessage("이 종족은 특별한 스킬이 없습니다.");
                }
            }).disabled = player.inCombat;
        }

        // 도시 귀환 버튼
        const returnButton = addButton(menu, "도시로 귀환", () => {
            player.position = "라비기온 (7-13구역)";
            logMessage("안전하게 도시로 귀환했다.");
            player.timeRemaining = 0;
            updateMenu(player);
            player.showStatus();
        });
        if (player.inCombat) { 
            returnButton.disabled = true;
            returnButton.title = "전투 중에는 귀환할 수 없습니다.";
        }

    }
    // 도시 내부 메뉴
    else {
        // [수정] 도시 관련 기능은 ui_city.js로 분리되었으므로 해당 콜백 호출
        addButton(menu, "도시 구역 이동", () => player.cb.showCityDistricts(player));
        addButton(menu, "현재 구역 활동", () => player.cb.showCityLocations(player));
        addButton(menu, "미궁 진입 (1층)", () => {
             // [수정] player.cb.gameData에서 layers 데이터를 가져옵니다.
             const layerOne = player.cb.gameData.layers[1];
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
            updateMenu(player);
            player.showStatus();
        });
    }

    // 공통 메뉴 (모달 열기 버튼)
    // [수정] 이 함수들이 이 파일 내에 다시 정의되었으므로 로컬 호출로 변경
    addButton(menu, "인벤토리", () => showInventory(player)).disabled = player.inCombat;
    addButton(menu, "정수 확인", () => showEssences(player)).disabled = player.inCombat;
    addButton(menu, "마법/스킬", () => showSpells(player)).disabled = player.inCombat;
    // [수정] ui_party.js가 있지만, main.js의 import 구조가 혼란스러우므로
    // 원본처럼 ui_main.js에 showParty를 포함시키고 로컬 호출
    addButton(menu, "파티원 정보", () => showParty(player)).disabled = player.inCombat;
    // [신규] 임무 일지 버튼 (콜백 사용)
    addButton(menu, "임무 일지", () => player.cb.showQuestLog(player)).disabled = player.inCombat;
    addButton(menu, "상태 보기 (텍스트 재출력)", () => player.showStatus());
}

/**
 * [신규] 차원 비석(포탈) 발견 시 선택 메뉴 표시
 * @param {Player} player - 플레이어 객체
 * @param {number | string} nextLayer - 이동할 다음 층 번호
 */
export function showPortalChoice(player, nextLayer) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; 

    // [수정] player.cb.gameData에서 layers 데이터를 가져옵니다.
    const layerData = player.cb.gameData.layers[nextLayer];
    if (!layerData) {
        logMessage(`오류: ${nextLayer}층 데이터를 찾을 수 없습니다.`);
        updateMenu(player); 
        return;
    }

    logMessage(`${nextLayer}층 (${layerData.name})으로 가는 차원 비석을 발견했다. 이동하시겠습니까?`);

    addButton(menu, `이동한다 (${nextLayer}층 ${layerData.name})`, () => {
        player.position = "Labyrinth";
        player.currentLayer = nextLayer;
        player.daysInLabyrinth = 1; 
        player.explorationCount = 0;
        player.sleepCount = 0;
        player.timeRemaining = layerData.time_limit || 0; 

        logMessage(`${nextLayer}층 ${layerData.name}(으)로 진입합니다.`);
        updateMenu(player); 
        player.showStatus();
    });

    addButton(menu, "머무른다 (현재 층 탐색)", () => {
        logMessage("현재 층에 머무르기로 했다.");
        updateMenu(player);
    });
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

    const itemCounts = player.inventory.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});

    // [수정] player.cb.gameData에서 모든 아이템 데이터를 가져옵니다.
    const allGameItems = {
        ...player.cb.gameData.items, 
        ...player.cb.gameData.numbersItems, 
        ...player.cb.gameData.shopItems, 
        ...player.cb.gameData.materials
    };

    if (Object.keys(itemCounts).length === 0) {
        inventoryListDiv.innerHTML = "<p>인벤토리가 비어있습니다.</p>";
    } else {
        Object.entries(itemCounts).forEach(([itemName, count]) => {
            const btn = document.createElement('button');
            const itemData = allGameItems[itemName] || {desc: "정보 없음"};
            btn.textContent = `${itemName} (${count}개) - ${itemData.desc}`;
            btn.classList.add('list-item'); 

            // [수정] data_functional.js에서 병합된 effect 함수를 확인합니다.
            const functionalItemData = player.cb.gameData.items[itemName] || player.cb.gameData.numbersItems[itemName];
            
            if (functionalItemData && typeof functionalItemData.effect === 'function' && (!itemData.type || itemData.type === '소모품')) {
                btn.onclick = () => {
                     hideModal('#inventory-screen'); 
                     player.useItem(itemName); 
                     // player.showStatus(); // useItem에서 이미 호출됨
                }
                btn.style.borderLeftColor = 'var(--color-stamina)'; 
            }
            // 2. 장착 가능한 장비
            else if (itemData.type && ['투구', '갑옷', '장갑', '각반', '무기', '부무기'].includes(itemData.type)) {
                const isEquipped = player.equipment[itemData.type] === itemName;
                if (isEquipped) {
                    btn.textContent = `[해제] ${itemName} (${count}개) - ${itemData.desc}`;
                    btn.onclick = () => {
                        player.unequipItem(itemData.type);
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
 * 파티원 정보 모달 표시 (ui_main.js로 복구)
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

    partyListDiv.innerHTML = ''; 
    if (player.party.length === 0) {
        partyListDiv.innerHTML = "<p>모집한 파티원이 없습니다.</p>";
    } else {
        player.party.forEach((member, index) => {
            let memberInfo = `<b>${member.name} (${member.grade}등급/${member.trait})</b><br>`;
            // [수정] player.cb.gameData에서 expToLevel 데이터를 가져옵니다.
            memberInfo += `레벨: ${member.level} | EXP: ${member.exp}/${player.cb.gameData.expToLevel[member.level] || 'MAX'}<br>`; 
            memberInfo += `HP: ${member.hp}/${member.maxHp} | MP: ${member.mp}/${member.maxMp}<br>`;
            memberInfo += `스킬: ${member.skills.map(s => s.name).join(', ') || '없음'}<br>`;
            memberInfo += `정수: ${member.essences.join(', ') || '없음'}<br>`;
            memberInfo += "스탯:<ul class='stat-list' style='font-size: 0.8em;'>";
            // [수정] NPC의 currentStats를 표시합니다.
            for (const statName in member.currentStats) {
                 if(member.currentStats[statName] !== 0) {
                    memberInfo += `<li class='stat-item'>${statName}: ${member.currentStats[statName]}</li>`;
                 }
            }
            memberInfo += "</ul>";

            const memberDiv = document.createElement('div');
            memberDiv.className = 'list-item';
            memberDiv.style.borderLeftColor = 'var(--color-stamina)';
            memberDiv.innerHTML = memberInfo;

            // 추방 버튼
            const dismissButton = addButton(memberDiv, "파티에서 추방", () => {
                 if (confirm(`${member.name}을(를) 정말로 파티에서 추방하시겠습니까?`)) {
                    const removedMember = player.party.splice(index, 1)[0]; 
                    logMessage(`${removedMember.name}을(를) 파티에서 추방했다.`);
                    player.showStatus();
                    showParty(player);
                }
            });
            dismissButton.style.marginTop = "10px";
            dismissButton.style.background = "var(--color-health)"; 
            dismissButton.style.color = "white";

            partyListDiv.appendChild(memberDiv);
        });
    }

    showModal('#party-screen'); 
    backButton.onclick = () => {
        hideModal('#party-screen');
    };
}

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

    essencesListDiv.innerHTML = `<p style="text-align: right;"><b>보유 정수 (${player.essences.length}/${player.level * 3})</b></p>`;

    if (player.essences.length === 0) {
        essencesListDiv.innerHTML += "<p>흡수한 정수가 없습니다.</p>";
    } else {
        player.essences.forEach(essenceName => {
            // [수정] player.cb.gameData에서 essences 데이터를 가져옵니다.
            const essence = player.cb.gameData.essences[essenceName];
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = 'var(--color-magic)'; 

            let essenceInfo = `<b>${essenceName} 정수</b>`;
            if(essence){ 
                 if (essence.stats) {
                     essenceInfo += `<br>- 스탯: ${Object.entries(essence.stats).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')}`;
                 }
                // [수정] passive/active가 배열일 수 있음을 고려
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
            // [수정] player.cb.gameData에서 magic 데이터를 가져옵니다.
            const spell = player.cb.gameData.magic[spellName];
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
                 // [수정] player.cb.gameData에서 essences 데이터를 가져옵니다.
                 const ess = player.cb.gameData.essences[key];
                 if (ess && ess.active) {
                     // [수정] active가 배열일 수 있음을 고려
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