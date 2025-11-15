// 파일: ui_combat.js
// 이 파일은 게임의 전투(Combat) UI 함수를 담당합니다.
// [수정] updateCombatStatus: 2등급 이하 보스 몬스터 전용 HP 바 추가
// [수정] showCombatSkillsMenu: 스킬 클릭 시 항상 showTargetSelection을 호출하도록 수정
// [수정] (v5) showTargetSelection: 아군/적군 타겟팅 제한을 제거하고,
//        모든 스킬에 대해 항상 적, 자신, 아군을 선택할 수 있도록 수정

// --- 핵심 UI 유틸리티 임포트 ---
import {
    logMessage,
    addButton,
    showModal,
    hideModal,
    updateStatusBars
} from './ui_core.js';


/**
 * [수정] 전투 중 상태 갱신 (보스/몬스터/파티원 HP 표시)
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
     /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
     if (!player.currentMonster || !Array.isArray(player.currentMonster) || player.currentMonster.every(m => !m || m.hp <= 0)) {
         statusDiv.innerHTML = "<h4>전투 종료</h4>";
         return;
     }

    let combatStatusHtml = "";

    // [신규] 보스(2등급 이하) 전용 UI
    const boss = player.currentMonster.find(m => m && m.hp > 0 && m.grade <= 2);
    if (boss) {
        const bossPhase = boss.bossPhase || 1;
        combatStatusHtml += `
            <div class="boss-status-container">
                <h4>${boss.name} (Phase ${bossPhase})</h4>
                <progress id="boss-hp-bar" max="${boss.maxHp}" value="${boss.hp}"></progress>
                <span id="boss-hp-value">${boss.hp}/${boss.maxHp}</span>
                 ${/* AUTO-FIX: added optional chaining ?. for safety (Rule B.5) */
                   boss.debuffs?.length > 0 ? `<span style='color: orange; display: block;'>[${boss.debuffs.join(',')}]</span>` : ''}
            </div>`;
    }

    // 몬스터 상태 표시 (HP 바 포함)
    combatStatusHtml += "<h4>몬스터</h4><ul class='monster-status-list'>";
    player.currentMonster.forEach((m, i) => {
        if (!m) return; 
        
        // 보스는 이미 표시했으므로 리스트에서 제외
        if (m === boss) return;

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
                    ${/* AUTO-FIX: added optional chaining ?. for safety (Rule B.5) */
                      m.debuffs?.length > 0 ? `<span style='color: orange;'>[${m.debuffs.join(',')}]</span>` : ''}
                </li>`;
        }
    });
    if (player.currentMonster.filter(m => m !== boss).length === 0) {
        combatStatusHtml += "<li>(남은 몬스터 없음)</li>";
    }
    combatStatusHtml += "</ul>";


    // 파티원 상태 표시 (HP 바 포함)
    /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
    if (player.party?.length > 0) {
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

    combatMenu.innerHTML = ''; // 메뉴 초기화
    menu.classList.add('hidden');
    menu.style.display = 'none';
    combatScreen.classList.remove('hidden');
    combatScreen.style.display = 'block';

    if (player.playerTurn && player.inCombat) {
        combatMenu.innerHTML = '<h4>플레이어 턴</h4>';
        const attackCost = 1; 

        // 공격 대상 선택 버튼 생성
        /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
        if (player.currentMonster?.length > 0) {
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
        /* AUTO-FIX: added guards for this.gameData to avoid TypeError when undefined (Rule 4) */
        const racialSkill = player.cb?.gameData?.races?.[player.race]?.racial_skill;
        if (racialSkill) {
            addButton(combatMenu, `종족 스킬: ${racialSkill.name}`, () => {
                /* AUTO-FIX: added guards for this.gameData to avoid TypeError when undefined (Rule 4) */
                const raceEffect = player.cb?.gameData?.races?.[player.race]?.racial_skill?.effect;
                if (typeof raceEffect === 'function') {
                    // [신규] (v4) 스킬 연출 (화면 흔들림 + 텍스트 박스)
                    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                    player.cb?.showScreenEffect?.('shake');
                    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                    player.cb?.logMessage?.(`[${racialSkill.name}]!`, 'log-skill-player');
                    
                    logMessage(`종족 스킬 [${racialSkill.name}]을(를) 사용합니다: ${racialSkill.desc}`, 'skill-player');
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

    /* AUTO-FIX: added guards for this.gameData to avoid TypeError when undefined (Rule 4) */
    const magic = player.cb?.gameData?.magic || {};
    const essences = player.cb?.gameData?.essences || {};

    const availableSkills = [];

    // 사용 가능한 마법 추가
    /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
    player.spells?.forEach(spellName => {
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
    /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
    player.essence_skills?.forEach(skillName => {
        let skillData = null;
        let skillKey = null; // [신규] 원본 정수 키 저장 (effect 함수 참조용)
        
        /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
        for (const key of player.essences || []) {
            const ess = essences[key];
            if (ess && ess.active) {
                const activeSkills = Array.isArray(ess.active) ? ess.active : [ess.active];
                const foundSkill = activeSkills.find(s => s.name === skillName);
                if (foundSkill) {
                    skillData = foundSkill;
                    skillKey = key; // 원본 정수 키 (예: "오우거")
                    break;
                }
            }
        }
        
        if (skillData) {
             availableSkills.push({
                 ...skillData, 
                 essenceKey: skillKey, // [신규] 원본 키 저장
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
 * [수정] (v5) 스킬/마법 대상 선택 메뉴
 * 타겟팅 유형 분석 로직을 제거하고, 항상 모든 대상(적, 아군, 자신)을 표시합니다.
 * @param {Player} player - 플레이어 객체
 * @param {object} skill - 선택된 스킬 *전체* 정보 객체
 */
function showTargetSelection(player, skill) {
    const menu = document.getElementById('combat-menu');
    if (!menu || !player.inCombat || !player.playerTurn || !player.currentMonster) return;

    menu.innerHTML = `<h4>[${skill.name}] 대상 선택:</h4>`;
    const livingMonsters = player.currentMonster.filter(m => m && m.hp > 0);
    
    // [신규] (v5) 타겟팅 유형 분석 로직 제거.
    
    // 스킬 실행 함수
    const executeSkill = (targetIndex) => {
        if (skill.type === 'spell') player.playerSpell(skill.name, targetIndex);
        else if (skill.type === 'essence') player.playerEssenceSkill(skill.name, targetIndex, skill.essenceKey); // essenceKey 전달
    };

    // 1. 적 단일 대상 (항상 표시)
    livingMonsters.forEach((monster) => {
         const originalIndex = player.currentMonster.findIndex(m => m === monster);
         const btn = addButton(menu, `[적 단일] ${originalIndex}: ${monster.name} (HP: ${monster.hp})`, () => executeSkill(originalIndex));
         btn.style.borderLeftColor = "var(--color-health)"; // 적 대상 강조
    });

    // 2. 적 광역 대상 (항상 표시)
    if (livingMonsters.length > 0) {
        const aoeBtn = addButton(menu, `[적 광역] 모든 적`, () => executeSkill(-1)); // -1: 적 광역
        aoeBtn.style.borderLeftColor = "var(--color-health)";
    }

    // 3. 자신 대상 (항상 표시)
    const selfBtn = addButton(menu, `[자신] (HP: ${player.hp}/${player.maxHp})`, () => executeSkill(-2)); // -2: 자신
    selfBtn.style.borderLeftColor = "var(--color-stamina)"; // 아군 대상 강조

    // 4. 아군 단일 대상 (항상 표시)
    player.party.forEach((member, index) => {
        if (member && member.hp > 0) {
             const allyBtn = addButton(menu, `[아군 단일] ${member.name} (HP: ${member.hp}/${member.maxHp})`, () => executeSkill(100 + index)); // 100+: 아군 인덱스
             allyBtn.style.borderLeftColor = "var(--color-stamina)";
        }
    });
    
    // 5. 아군 광역 대상 (항상 표시)
    if (player.party.length > 0) {
        const allyAoeBtn = addButton(menu, `[아군 광역] 모든 아군 (자신 포함)`, () => executeSkill(-3)); // -3: 아군 광역
        allyAoeBtn.style.borderLeftColor = "var(--color-stamina)";
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

    /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
    const itemCounts = player.inventory?.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});

    /* AUTO-FIX: added guards for this.gameData to avoid TypeError when undefined (Rule 4) */
    const allConsumableItems = {
        ...(player.cb?.gameData?.items || {}), 
        ...(player.cb?.gameData?.numbersItems || {})
    };
    let foundConsumable = false;

    /* AUTO-FIX: Added null check for itemCounts */
    if (itemCounts) {
        Object.entries(itemCounts).forEach(([itemName, count]) => {
            const itemData = allConsumableItems[itemName];
            /* AUTO-FIX: added guards for this.gameData to avoid TypeError when undefined (Rule 4) */
            const usableItemData = player.cb?.gameData?.items?.[itemName] || player.cb?.gameData?.numbersItems?.[itemName]; 
            
            if (usableItemData && typeof usableItemData.effect === 'function' && (!usableItemData.type || usableItemData.type === '소모품')) {
                 foundConsumable = true;
                 const btn = document.createElement('button');
                btn.textContent = `사용: ${itemName} (${count}개) - ${usableItemData.desc}`;
                btn.onclick = () => {
                    hideModal('#inventory-screen');
                    
                    // [신규] (v4) 아이템 사용 시 연출 (스킬보다는 약하게)
                    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                    player.cb?.logMessage?.(`[${itemName}] 사용!`, 'log-skill-player');
                    
                    player.useItem(itemName); // useItem이 showStatus 호출
                     if (player.inCombat) {
                        player.endTurn();
                     }
                };
                inventoryListDiv.appendChild(btn);
            }
        });
    }

     if (!foundConsumable) {
         inventoryListDiv.innerHTML += "<p>전투 중에 사용할 수 있는 아이템이 없습니다.</p>";
     }

    showModal('#inventory-screen');
    backButton.onclick = () => {
        hideModal('#inventory-screen');
    };
}