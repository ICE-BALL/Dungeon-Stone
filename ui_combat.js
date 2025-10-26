// 이 파일은 게임의 전투(Combat) UI 함수를 담당합니다.
// (전투 상태, 전투 메뉴, 전투 중 스킬/인벤토리)
// 기존 ui.js에서 분리됨
// [수정] 몬스터 HP 바 추가
// [수정] 파티원 HP 표시 추가
// [수정] showCombatSkillsMenu: 모든 전투용 액티브 정수 스킬 표시 로직 수정
// [오류 수정] 몬스터 처치 시 UI에서 '데이터 오류' 대신 '처치됨'을 표시하도록 로직 수정

// --- 데이터 임포트 ---
import {
    races, // updateCombatMenu (종족 스킬)
    essences, // showCombatSkillsMenu
    magic // showCombatSkillsMenu
} from './data_core.js';

import {
    items, // showInventoryInCombat
    numbersItems // showInventoryInCombat
} from './data_content.js';

// --- 핵심 UI 유틸리티 임포트 ---
import {
    logMessage,
    addButton,
    showModal,
    hideModal,
    updateStatusBars
} from './ui_core.js';


/**
 * 전투 중 상태 갱신 (플레이어, 몬스터, 파티원 HP 표시)
 * @param {Player} player - 플레이어 객체
 */
export function updateCombatStatus(player) {
    updateStatusBars(player); // 플레이어 상태 바 업데이트 (ui_core.js)

    const statusDiv = document.getElementById('combat-status');
    if (!statusDiv) {
         console.error("Combat status element not found!");
         return;
    }

     // 전투 종료 시
     if (!player.currentMonster || !Array.isArray(player.currentMonster) || player.currentMonster.every(m => !m || m.hp <= 0)) {
         statusDiv.innerHTML = "<h4>전투 종료</h4>";
         return;
     }

    let combatStatusHtml = "<h4>몬스터</h4><ul class='monster-status-list'>";
    // 몬스터 상태 표시 (HP 바 포함)
    player.currentMonster.forEach((m, i) => {
        // [오류 수정] 몬스터 객체 자체가 유효하지 않은 경우만 건너뛰고, HP를 기준으로 상태를 판단
        if (!m) return; // 유효하지 않은 항목 (예: 이미 제거되었을 경우)

        const maxHp = m.maxHp ?? m.hp ?? 1;
        const currentHp = m.hp ?? 0;
        const isDefeated = currentHp <= 0;
        
        // 처치된 몬스터 표시
        if (isDefeated) {
             combatStatusHtml += `<li style="text-decoration: line-through; color: grey;">${i}: <b>${m.name || '알 수 없는 몬스터'}</b> (처치됨)</li>`;
        } 
        // 살아있는 몬스터 표시
        else { 
            combatStatusHtml += `
                <li>
                    ${i}: <b>${m.name || '알 수 없는 몬스터'}</b> (${m.grade || '?'}등급)
                    <progress class="monster-hp-bar" max="${maxHp}" value="${currentHp}"></progress>
                    <span class="monster-hp-value">${currentHp}/${maxHp}</span>
                    ${m.debuffs && m.debuffs.length > 0 ? `<span style='color: orange;'>[${m.debuffs.join(',')}]</span>` : ''}
                </li>`;
        }
    });
    combatStatusHtml += "</ul>";

    // [신규] 파티원 상태 표시 (HP 바 포함)
    if (player.party && player.party.length > 0) {
        combatStatusHtml += "<h4 style='margin-top: 15px;'>파티원</h4><ul class='party-status-list'>"; // CSS 스타일링용 클래스 추가
        player.party.forEach((p, i) => {
            if (p) {
                const maxHp = p.maxHp ?? 1;
                const currentHp = p.hp ?? 0;
                // 파티원 HP 바 추가 (CSS 클래스 부여)
                combatStatusHtml += `
                    <li>
                        <b>${p.name || '동료'}</b> (${p.grade}등급/${p.trait})
                        <progress class="party-hp-bar" max="${maxHp}" value="${currentHp}"></progress>
                        <span class="party-hp-value">${currentHp}/${maxHp}</span>
                         ${p.hp <= 0 ? "<span style='color: red;'> (쓰러짐)</span>" : ""}
                    </li>`;
            }
        });
        combatStatusHtml += "</ul>";
    }

    statusDiv.innerHTML = combatStatusHtml;
}


/**
 * [수정] 전투 중 행동 메뉴 갱신 + 전투 BGM 재생
 * @param {Player} player - 플레이어 객체
 */
export function updateCombatMenu(player) {
    const menu = document.getElementById('menu');
    const combatScreen = document.getElementById('combat-screen');
    const combatMenu = document.getElementById('combat-menu');

    if (!menu || !combatScreen || !combatMenu) {
        console.error("Combat menu elements not found!");
        return;
    }

    // --- [BGM] 전투 BGM 재생 ---
    if (player.inCombat && player.cb && player.cb.playMusic) {
        player.cb.playMusic('bgm-combat');
    }
    // --- [BGM] 완료 ---

    combatMenu.innerHTML = ''; // 메뉴 초기화
    menu.classList.add('hidden'); // 메인 메뉴 숨김
    menu.style.display = 'none';
    combatScreen.classList.remove('hidden'); // 전투 화면 표시
    combatScreen.style.display = 'block';

    if (player.playerTurn && player.inCombat) {
        combatMenu.innerHTML = '<h4>플레이어 턴</h4>';
        const attackCost = 1; // 기본 공격 기력 소모량

        // 공격 대상 선택 버튼 생성
        if (player.currentMonster && player.currentMonster.length > 0) {
            const livingMonsters = player.currentMonster.filter(m => m && m.hp > 0);
            if (livingMonsters.length > 1) { // 몬스터가 여러 마리일 경우
                livingMonsters.forEach((monster, index) => {
                     const originalIndex = player.currentMonster.findIndex(m => m === monster); // 원본 배열 인덱스 찾기
                     addButton(combatMenu, `공격: ${monster.name} #${originalIndex} (기력 ${attackCost})`, () => player.playerAttack(originalIndex));
                });
            } else if (livingMonsters.length === 1) { // 몬스터가 한 마리일 경우
                 const originalIndex = player.currentMonster.findIndex(m => m === livingMonsters[0]);
                addButton(combatMenu, `공격: ${livingMonsters[0].name} (기력 ${attackCost})`, () => player.playerAttack(originalIndex));
            } else {
                 combatMenu.innerHTML += '<p>공격할 대상이 없습니다.</p>';
            }
        } else {
            combatMenu.innerHTML += '<p>공격할 대상이 없습니다.</p>';
        }

        // 종족 스킬 버튼
        const racialSkill = races[player.race]?.racial_skill;
        if (racialSkill) {
            addButton(combatMenu, `종족 스킬: ${racialSkill.name}`, () => {
                if(typeof racialSkill.effect === 'function') {
                    logMessage(`종족 스킬 [${racialSkill.name}]을(를) 사용합니다.`);
                    racialSkill.effect(player); // 스킬 효과 실행
                    if (player.inCombat) { // 스킬 사용 후 전투가 계속되면 턴 종료
                       player.endTurn();
                    } else { // 스킬 사용으로 전투가 종료된 경우 (매우 드묾)
                         if(player.cb && player.cb.updateMenu) player.cb.updateMenu(player); // 메인 메뉴 업데이트
                    }
                } else {
                    logMessage("이 종족 스킬은 전투 중 사용할 수 없거나 효과가 정의되지 않았습니다.");
                }
            });
        }

        // 기타 행동 버튼
        addButton(combatMenu, "스킬/마법 사용", () => showCombatSkillsMenu(player));
        addButton(combatMenu, "인벤토리 (아이템 사용)", () => showInventoryInCombat(player));
        addButton(combatMenu, "도망치기", () => player.playerRun());

    } else if (player.inCombat) { // 몬스터 또는 파티원 턴
        combatMenu.innerHTML = "<p>상대의 턴...</p>";
    }

    // 전투 상태 UI 갱신 (항상 호출)
    if (player.inCombat) {
        updateCombatStatus(player);
    }
}

/**
 * 전투 중 스킬/마법 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCombatSkillsMenu(player) {
    const menu = document.getElementById('combat-menu');
    if (!menu || !player.inCombat || !player.playerTurn) return;

    menu.innerHTML = '<h4>사용할 스킬/마법 선택:</h4>';

    const availableSkills = [];
    const livingMonsters = player.currentMonster?.filter(m => m && m.hp > 0) || [];

    // 사용 가능한 마법 추가 (공격/디버프 계열만)
    player.spells.forEach(spellName => {
        const spell = magic[spellName];
        // 대상 지정이 필요하거나(effect 함수에 target 인자) 직접 데미지가 있는 경우
        // 또는 대상 지정 없이 광역 피해를 주는 경우 (effect 함수만 있고 dmg 없는 광역기, 예: 냉기폭풍)
        if (spell && (spell.dmg !== undefined || (spell.effect && spell.effect.toString().includes('target')) || (spell.effect && !spell.effect.toString().includes('target') && spell.type === 'magic' && spell.mp_cost > 0) )) {
            availableSkills.push({
                name: spellName,
                type: 'spell',
                cost: spell.mp_cost || 0,
                desc: `[마법] ${spell.desc || "설명 없음"}`
            });
        }
    });

    // 사용 가능한 정수 스킬 추가 (공격/디버프 계열만)
    player.essence_skills.forEach(skillName => {
        let skillData = null;
        for (const key of player.essences) {
            const ess = essences[key];
            if (ess && ess.active && ess.active.name === skillName) {
                skillData = ess.active;
                break;
            }
        }
        // 대상 지정이 필요하거나 직접 데미지가 있는 경우
        // 또는 대상 지정 없이 광역 피해를 주는 경우 (effect 함수만 있고 dmg 없는 광역기, 예: 해일)
        if (skillData && (skillData.dmg !== undefined || (skillData.effect && skillData.effect.toString().includes('target')) || (skillData.effect && !skillData.effect.toString().includes('target') && skillData.mp_cost > 0) )) {
             availableSkills.push({
                 name: skillName,
                 type: 'essence',
                 cost: skillData.mp_cost || 0,
                 desc: `[정수] ${skillData.desc || "설명 없음"}`
             });
        }
    });

    // 사용 가능한 스킬이 없을 경우
    if (availableSkills.length === 0) {
        menu.innerHTML += '<p>사용 가능한 전투 스킬/마법이 없습니다.</p>';
    } else {
        // 스킬 버튼 생성
        availableSkills.forEach(skill => {
            const btn = addButton(menu, `${skill.name} (MP ${skill.cost}) - ${skill.desc}`, () => {
                if (player.mp < skill.cost) {
                    logMessage("MP가 부족합니다.");
                    return;
                }
                // 공격 대상 선택 필요 여부 확인 (대상이 필요하거나, 몬스터가 여러 마리인 경우)
                // 광역기는 대상 선택 없이 바로 사용
                const skillInfo = skill.type === 'spell' ? magic[skill.name] : essences[player.essences.find(eKey => essences[eKey]?.active?.name === skill.name)]?.active;
                const requiresTarget = (skillInfo?.dmg !== undefined || (skillInfo?.effect && skillInfo.effect.toString().includes('target')));

                if (requiresTarget && livingMonsters.length > 1) {
                    showTargetSelection(player, skill); // 대상 선택 함수 호출
                } else if (requiresTarget && livingMonsters.length === 1) { // 대상이 하나면 바로 사용
                    const targetIndex = player.currentMonster.findIndex(m => m === livingMonsters[0]);
                    if (skill.type === 'spell') {
                        player.playerSpell(skill.name, targetIndex);
                    } else if (skill.type === 'essence') {
                        player.playerEssenceSkill(skill.name, targetIndex);
                    }
                } else if (!requiresTarget && livingMonsters.length > 0) { // 광역기 등 대상 지정 불필요 스킬
                     // 광역기의 경우 targetIndex를 -1 또는 null 로 전달하여 구분 가능하도록 함 (Player 클래스 수정 필요)
                     // 여기서는 임시로 첫 번째 대상을 타겟으로 넘기거나 null을 넘김
                     const targetIndex = livingMonsters.length > 0 ? player.currentMonster.findIndex(m => m === livingMonsters[0]) : -1; // 임시: 첫 몬스터 인덱스 또는 -1
                    if (skill.type === 'spell') {
                        player.playerSpell(skill.name, targetIndex); // Player 클래스에서 targetIndex가 -1일 때 광역 처리 필요
                    } else if (skill.type === 'essence') {
                        player.playerEssenceSkill(skill.name, targetIndex); // Player 클래스에서 targetIndex가 -1일 때 광역 처리 필요
                    }
                } else {
                     logMessage("스킬을 사용할 대상이 없습니다.");
                     updateCombatMenu(player); // 행동 메뉴로 복귀
                }
            });
            btn.disabled = player.mp < skill.cost; // MP 부족 시 비활성화
        });
    }

    addButton(menu, "뒤로 (행동 메뉴)", () => updateCombatMenu(player)); // 이전 메뉴로 돌아가기
}

/**
 * 스킬/마법 대상 선택 메뉴 표시 (이 파일 내부에서만 사용)
 * @param {Player} player - 플레이어 객체
 * @param {object} skill - 선택된 스킬 정보 ({name, type, cost, desc})
 */
function showTargetSelection(player, skill) {
    const menu = document.getElementById('combat-menu');
    if (!menu || !player.inCombat || !player.playerTurn || !player.currentMonster || player.currentMonster.length <= 1) return;

    menu.innerHTML = `<h4>[${skill.name}] 대상 선택:</h4>`;
    const livingMonsters = player.currentMonster.filter(m => m && m.hp > 0);

    // 살아있는 몬스터 대상 버튼 생성
    livingMonsters.forEach((monster) => {
         const originalIndex = player.currentMonster.findIndex(m => m === monster);
         addButton(menu, `${originalIndex}: ${monster.name} (HP: ${monster.hp})`, () => {
             if (skill.type === 'spell') {
                 player.playerSpell(skill.name, originalIndex);
             } else if (skill.type === 'essence') {
                 player.playerEssenceSkill(skill.name, originalIndex);
             }
         });
    });

    addButton(menu, "뒤로 (스킬 선택)", () => showCombatSkillsMenu(player)); // 이전 메뉴로 돌아가기
}


/**
 * 전투 중 인벤토리 모달 표시 (소모품 사용)
 * @param {Player} player - 플레이어 객체
 */
export function showInventoryInCombat(player) {
    const inventoryScreenDiv = document.getElementById('inventory-screen');
    const inventoryListDiv = document.getElementById('inventory-list');
    const backButton = inventoryScreenDiv ? inventoryScreenDiv.querySelector('.modal-close-btn') : null;

     if (!inventoryScreenDiv || !inventoryListDiv || !backButton) {
         console.error("Combat inventory modal elements not found!");
         return;
     }

    inventoryListDiv.innerHTML = '<h4>사용할 아이템 선택:</h4>'; // 모달 내용 초기화

    // 인벤토리 아이템 수량 계산
    const itemCounts = player.inventory.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});

    const allConsumableItems = {...items, ...numbersItems}; // 소비 아이템 데이터 통합
    let foundConsumable = false;

    // 소비 가능한 아이템 버튼 생성
    Object.entries(itemCounts).forEach(([itemName, count]) => {
        const itemData = allConsumableItems[itemName];
        // 소비 아이템만 (효과 함수가 있고, 타입이 없거나 '소모품'인 경우)
        if (itemData && typeof itemData.effect === 'function' && (!itemData.type || itemData.type === '소모품')) {
             foundConsumable = true;
             const btn = document.createElement('button');
            btn.textContent = `사용: ${itemName} (${count}개) - ${itemData.desc}`;
            btn.onclick = () => {
                hideModal('#inventory-screen'); // 아이템 사용 전 모달 닫기
                player.useItem(itemName); // 아이템 사용 로직 호출 (classes.js)
                 if (player.inCombat) { // 아이템 사용 후 전투가 계속되면 턴 종료
                    player.endTurn();
                 } else { // 아이템 사용으로 전투가 종료된 경우
                     if(player.cb && player.cb.updateMenu) player.cb.updateMenu(player); // 메인 메뉴 업데이트
                 }
            };
            inventoryListDiv.appendChild(btn);
        }
    });

     // 사용 가능한 아이템이 없을 경우 메시지 표시
     if (!foundConsumable) {
         inventoryListDiv.innerHTML += "<p>전투 중에 사용할 수 있는 아이템이 없습니다.</p>";
     }

    showModal('#inventory-screen'); // 모달 표시
    // 모달 닫기 버튼 이벤트 설정
    backButton.onclick = () => {
        hideModal('#inventory-screen');
    };
}