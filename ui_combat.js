// 이 파일은 게임의 전투(Combat) UI 함수를 담당합니다.
// [수정] 몬스터 HP 바 추가
// [수정] 파티원 HP 표시 추가
// [수정] showCombatSkillsMenu: 스킬 클릭 시 항상 showTargetSelection을 호출하도록 수정
// [수정] showTargetSelection: 단일/광역/자신을 유저가 선택하도록 수정

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
        // [수정] 몬스터 객체 유효성 및 HP 기준으로 상태 판단
        if (!m) return; 

        const maxHp = m.maxHp ?? m.hp ?? 1;
        const currentHp = m.hp ?? 0;
        const isDefeated = currentHp <= 0;
        
        if (isDefeated) {
             combatStatusHtml += `<li style="text-decoration: line-through; color: grey;">${i}: <b>${m.name || '알 수 없는 몬스터'}</b> (처치됨)</li>`;
        } 
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

    // 파티원 상태 표시 (HP 바 포함)
    if (player.party && player.party.length > 0) {
        combatStatusHtml += "<h4 style='margin-top: 15px;'>파티원</h4><ul class='party-status-list'>";
        player.party.forEach((p, i) => {
            if (p) {
                const maxHp = p.maxHp ?? 1;
                const currentHp = p.hp ?? 0;
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
 * 전투 중 행동 메뉴 갱신
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

    // BGM 재생은 Player 클래스의 startCombat에서 이미 호출됨

    combatMenu.innerHTML = ''; // 메뉴 초기화
    menu.classList.add('hidden');
    menu.style.display = 'none';
    combatScreen.classList.remove('hidden');
    combatScreen.style.display = 'block';

    if (player.playerTurn && player.inCombat) {
        combatMenu.innerHTML = '<h4>플레이어 턴</h4>';
        const attackCost = 1; // 기본 공격 기력 소모량

        // 공격 대상 선택 버튼 생성
        if (player.currentMonster && player.currentMonster.length > 0) {
            const livingMonsters = player.currentMonster.filter(m => m && m.hp > 0);
            if (livingMonsters.length > 1) {
                livingMonsters.forEach((monster, index) => {
                     const originalIndex = player.currentMonster.findIndex(m => m === monster);
                     addButton(combatMenu, `공격: ${monster.name} #${originalIndex} (기력 ${attackCost})`, () => player.playerAttack(originalIndex));
                });
            } else if (livingMonsters.length === 1) {
                 const originalIndex = player.currentMonster.findIndex(m => m === livingMonsters[0]);
                addButton(combatMenu, `공격: ${livingMonsters[0].name} (기력 ${attackCost})`, () => player.playerAttack(originalIndex));
            } else {
                 combatMenu.innerHTML += '<p>공격할 대상이 없습니다.</p>';
            }
        } else {
            combatMenu.innerHTML += '<p>공격할 대상이 없습니다.</p>';
        }

        // 종족 스킬 버튼
        const racialSkill = player.cb.gameData.races[player.race]?.racial_skill;
        if (racialSkill) {
            addButton(combatMenu, `종족 스킬: ${racialSkill.name}`, () => {
                const raceEffect = player.cb.gameData.races[player.race]?.racial_skill?.effect;
                if (typeof raceEffect === 'function') {
                    logMessage(`종족 스킬 [${racialSkill.name}]을(를) 사용합니다.`);
                    raceEffect(player); // 스킬 효과 실행
                    if (player.inCombat) {
                       player.endTurn();
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

    if (player.inCombat) {
        updateCombatStatus(player);
    }
}

/**
 * [수정됨] 전투 중 스킬/마법 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCombatSkillsMenu(player) {
    const menu = document.getElementById('combat-menu');
    if (!menu || !player.inCombat || !player.playerTurn) return;

    menu.innerHTML = '<h4>사용할 스킬/마법 선택:</h4>';

    const magic = player.cb.gameData.magic;
    const essences = player.cb.gameData.essences;

    const availableSkills = [];

    // 사용 가능한 마법 추가
    player.spells.forEach(spellName => {
        const spell = magic[spellName];
        if (spell) {
            // [수정] 스킬의 *전체* 정보를 넘깁니다.
            availableSkills.push({
                ...spell, // effect 함수 포함
                name: spellName,
                type: 'spell',
                cost: spell.mp_cost || 0,
                desc: `[마법] ${spell.desc || "설명 없음"}`
            });
        }
    });

    // 사용 가능한 정수 스킬 추가
    player.essence_skills.forEach(skillName => {
        let skillData = null;
        for (const key of player.essences) {
            const ess = essences[key];
            if (ess && ess.active) {
                const activeSkills = Array.isArray(ess.active) ? ess.active : [ess.active];
                const foundSkill = activeSkills.find(s => s.name === skillName);
                if (foundSkill) {
                    skillData = foundSkill;
                    break;
                }
            }
        }
        
        if (skillData) {
            // [수정] 스킬의 *전체* 정보를 넘깁니다.
             availableSkills.push({
                 ...skillData, // effect 함수 포함
                 type: 'essence',
                 cost: skillData.mp_cost || 0,
                 desc: `[정수] ${skillData.desc || "설명 없음"}`
             });
        }
    });

    if (availableSkills.length === 0) {
        menu.innerHTML += '<p>사용 가능한 전투 스킬/마법이 없습니다.</p>';
    } else {
        availableSkills.forEach(skill => {
            const btn = addButton(menu, `${skill.name} (MP ${skill.cost}) - ${skill.desc}`, () => {
                if (player.mp < skill.cost) {
                    logMessage("MP가 부족합니다.");
                    return;
                }
                // [수정] 클릭 시 대상 선택 메뉴를 항상 호출
                showTargetSelection(player, skill);
            });
            btn.disabled = player.mp < skill.cost;
        });
    }

    addButton(menu, "뒤로 (행동 메뉴)", () => updateCombatMenu(player));
}

/**
 * [신규/수정] 스킬/마법 대상 선택 메뉴
 * @param {Player} player - 플레이어 객체
 * @param {object} skill - 선택된 스킬 *전체* 정보 객체
 */
function showTargetSelection(player, skill) {
    const menu = document.getElementById('combat-menu');
    if (!menu || !player.inCombat || !player.playerTurn || !player.currentMonster) return;

    menu.innerHTML = `<h4>[${skill.name}] 대상 선택:</h4>`;
    const livingMonsters = player.currentMonster.filter(m => m && m.hp > 0);
    const skillDesc = skill.desc.toLowerCase();

    // 1. 적 대상 (단일)
    livingMonsters.forEach((monster) => {
         const originalIndex = player.currentMonster.findIndex(m => m === monster);
         addButton(menu, `적: ${originalIndex}: ${monster.name} (HP: ${monster.hp})`, () => {
             if (skill.type === 'spell') player.playerSpell(skill.name, originalIndex);
             else if (skill.type === 'essence') player.playerEssenceSkill(skill.name, originalIndex);
         });
    });

    // 2. 광역(AOE) 대상
    // 설명에 "광역", "모든 적", "범위 내" 등이 포함된 경우
    if (skillDesc.includes("광역") || skillDesc.includes("모든 적") || skillDesc.includes("범위 내")) {
         addButton(menu, `모든 적 (광역)`, () => {
             if (skill.type === 'spell') player.playerSpell(skill.name, -1); // -1: 광역
             else if (skill.type === 'essence') player.playerEssenceSkill(skill.name, -1);
         });
    }

    // 3. 자신 대상
    // 설명에 "자신", "시전자", "아군" 등이 포함된 경우
    if (skillDesc.includes("자신") || skillDesc.includes("시전자") || skillDesc.includes("아군")) {
         addButton(menu, `자신`, () => {
             if (skill.type === 'spell') player.playerSpell(skill.name, -2); // -2: 자신
             else if (skill.type === 'essence') player.playerEssenceSkill(skill.name, -2);
         });
    }
    
    // 4. (임시) 대상이 불분명한 경우 기본값 (첫 번째 적)
    if (livingMonsters.length > 0 && menu.children.length === 1) { // 뒤로가기 버튼만 있는 경우
         const firstTargetIndex = player.currentMonster.findIndex(m => m === livingMonsters[0]);
         logMessage("대상이 불분명하여 첫 번째 적을 대상으로 자동 선택합니다.");
         if (skill.type === 'spell') player.playerSpell(skill.name, firstTargetIndex);
         else if (skill.type === 'essence') player.playerEssenceSkill(skill.name, firstTargetIndex);
         return;
    }

    addButton(menu, "뒤로 (스킬 선택)", () => showCombatSkillsMenu(player));
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

    inventoryListDiv.innerHTML = '<h4>사용할 아이템 선택:</h4>';

    const itemCounts = player.inventory.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});

    const allConsumableItems = {...player.cb.gameData.items, ...player.cb.gameData.numbersItems};
    let foundConsumable = false;

    Object.entries(itemCounts).forEach(([itemName, count]) => {
        const itemData = allConsumableItems[itemName];
        // [수정] effect가 JSON에 없으므로, gameData.items에서 원본 데이터의 effect 함수 존재 여부 확인
        const usableItemData = player.cb.gameData.items[itemName] || player.cb.gameData.numbersItems[itemName]; 
        
        if (usableItemData && typeof usableItemData.effect === 'function' && (!usableItemData.type || usableItemData.type === '소모품')) {
             foundConsumable = true;
             const btn = document.createElement('button');
            btn.textContent = `사용: ${itemName} (${count}개) - ${usableItemData.desc}`;
            btn.onclick = () => {
                hideModal('#inventory-screen');
                player.useItem(itemName); // useItem이 showStatus 호출
                 if (player.inCombat) {
                    player.endTurn();
                 }
            };
            inventoryListDiv.appendChild(btn);
        }
    });

     if (!foundConsumable) {
         inventoryListDiv.innerHTML += "<p>전투 중에 사용할 수 있는 아이템이 없습니다.</p>";
     }

    showModal('#inventory-screen');
    backButton.onclick = () => {
        hideModal('#inventory-screen');
    };
}