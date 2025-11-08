// 이 파일은 게임의 파티원 정보 UI 함수를 담당합니다.
// (파티원 정보 모달 표시, 파티원 추방)
// [수정] 모든 데이터를 player.cb.gameData (JSON)에서 가져오도록 수정
// [AUTO-FIX] 확장 계획 1 (정수 분배 UI) 반영
// [AUTO-FIX] showEssencePartyChoice: 메인 메뉴(#menu) 대신 모달(#essence-choice-screen)을 사용하도록 수정
// [AUTO-FIX] showEssencePartyChoice: player.resumeCombatAfterChoice()를 호출하여 게임 루프를 재개하도록 수정
// [AUTO-FIX] showEssencePartyChoice: [User Request] 정수 획득 팝업 제목을 "[몬스터이름] 정수 획득!" 형식으로 수정

// --- 핵심 UI 유틸리티 임포트 ---
import {
    logMessage,
    addButton,
    showModal,
    hideModal
} from './ui_core.js';

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

    // [수정] gameData에서 expToLevel 데이터 가져오기
    /* AUTO-FIX: added guards for this.gameData to avoid TypeError when undefined (Rule 4) */
    const expToLevel = player.cb?.gameData?.expToLevel || {};

    partyListDiv.innerHTML = ''; // 목록 초기화
    /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
    if (player.party?.length === 0) {
        partyListDiv.innerHTML = "<p>모집한 파티원이 없습니다.</p>";
    } else {
        /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5); review required */
        player.party?.forEach((member, index) => {
            // 파티원 정보 표시 (상세 스탯 포함)
            let memberInfo = `<b>${member.name} (${member.grade}등급/${member.trait})</b><br>`;
            memberInfo += `레벨: ${member.level} | EXP: ${member.exp}/${expToLevel[member.level] || 'MAX'}<br>`;
            memberInfo += `HP: ${member.hp}/${member.maxHp} | MP: ${member.mp}/${member.maxMp}<br>`;
            memberInfo += `스킬: ${member.skills.map(s => s.name).join(', ') || '없음'}<br>`;
            memberInfo += `정수: ${member.essences.join(', ') || '없음'}<br>`;
            
            // [수정] NPC의 최종 스탯(currentStats)을 표시하도록 변경
            memberInfo += "스탯:<ul class='stat-list' style='font-size: 0.8em;'>";
            for (const statName in member.currentStats) {
                 // [문법 수정] 스탯 이름에 공백이 있어도 대괄호 표기법으로 안전하게 접근
                 if(member.currentStats[statName] !== 0) {
                    memberInfo += `<li class='stat-item'>${statName}: ${member.currentStats[statName]}</li>`;
                 }
            }
            memberInfo += "</ul>";
            
            // [신규] NPC 장비 표시
            memberInfo += "장비:<ul class='stat-list' style='font-size: 0.8em;'>";
            for (const slot in member.equipment) {
                if (member.equipment[slot]) {
                    memberInfo += `<li class='stat-item'>${slot}: ${member.equipment[slot]}</li>`;
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
                    player.showStatus(); // [UI] 파티원 목록 갱신 (메인 UI)
                    showParty(player); // [UI] 모달 내용 갱신
                }
            });
            dismissButton.style.marginTop = "10px";
            dismissButton.style.background = "var(--color-health)";
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
 * [신규][확장 계획 1] 몬스터가 정수 드랍 시, 분배 대상을 선택하는 UI
 * (이 함수는 main.js의 gameCallbacks를 통해 Player 클래스에서 호출됩니다)
 * @param {Player} player - 플레이어 객체
 * @param {string} essenceName - 드랍된 정수의 이름 (예: "고블린")
 * @param {string} essenceDisplayName - "고블린 정수" (classes.js에서 전달받음)
 */
/* AUTO-FIX: [Optimization] Rewritten function to use modal '#essence-choice-screen' and support game loop pause/resume */
export function showEssencePartyChoice(player, essenceName, essenceDisplayName) {
    
    // 1. 모달 요소 가져오기
    const modal = document.getElementById('essence-choice-screen');
    const title = document.getElementById('essence-choice-title');
    const desc = document.getElementById('essence-choice-desc');
    const list = document.getElementById('essence-choice-list');
    const closeButton = document.getElementById('essence-choice-close');

    if (!modal || !title || !list || !closeButton || !desc) {
        console.error("Essence Choice Modal elements not found! (Check index.html)");
        logMessage(`[${essenceDisplayName}] 획득. (UI 오류로 자동 흡수 시도)`);
        player.addEssence(essenceName);
        /* AUTO-FIX: [Optimization] Must call resume function on error to prevent game freeze */
        player.resumeCombatAfterChoice();
        return;
    }

    // 2. 내용 초기화
    list.innerHTML = '';

    /* AUTO-FIX: [User Request] Changed modal title format to "[MonsterName] 정수 획득!" */
    // (essenceName은 classes.js에서 몬스터 이름을 받고, essenceDisplayName은 "몬스터이름 정수"임)
    // 따라서 essenceName을 사용하는 것이 사용자의 요구사항 "[몬스터이름]"에 부합함.
    title.innerHTML = `<i class="icon-essence"></i> [${essenceName || '알 수 없는'}] 정수 획득!`;
    
    /* * AUTO-FIX: [User Request] Removed passive/active skill description lookup.
     * The modal will now only display the essence name (in the title) and a generic prompt.
     */
    desc.textContent = "누가 이 정수를 흡수하겠습니까?";

    // 3. 선택 완료 시 공통으로 실행할 함수 (게임 재개)
    const handleChoiceMade = () => {
        hideModal('#essence-choice-screen');
        /* AUTO-FIX: [Optimization] Calling resume function to unpause game loop */
        player.resumeCombatAfterChoice();
    };

    // 4. 버튼 생성: 플레이어
    const playerLimit = player.level * 3;
    const playerBtn = addButton(list, `1. 내가 흡수한다 (현재: ${player.essences.length}/${playerLimit}개)`, () => {
        player.addEssence(essenceName);
        handleChoiceMade();
    });
    if (player.essences.length >= playerLimit) {
        playerBtn.disabled = true;
        playerBtn.textContent += " (정수 가득 참)";
    }

    // 5. 버튼 생성: 파티원
    /* AUTO-FIX: added optional chaining ?. for safety (Rule B.5) */
    player.party?.forEach((member, index) => {
        if (member && member.hp > 0) { // 살아있는 동료만
            const memberLimit = member.level * 3;
            const memberBtn = addButton(list, `${index + 2}. ${member.name}에게 주기 (현재: ${member.essences.length}/${memberLimit}개)`, () => {
                member.addEssence(essenceName); // NPC의 addEssence 호출
                handleChoiceMade();
            });
            
            if (member.essences.length >= memberLimit) {
                memberBtn.disabled = true;
                memberBtn.textContent += " (정수 가득 참)";
            }
        }
    });

    // 6. 닫기/버리기 버튼 연결
    closeButton.onclick = () => {
        logMessage(`[${essenceDisplayName}] 정수를 버렸습니다.`);
        handleChoiceMade();
    };

    // 7. 모달 표시
    showModal('#essence-choice-screen');
}