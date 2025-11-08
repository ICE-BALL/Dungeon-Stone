// 이 파일은 게임의 파티원 정보 UI 함수를 담당합니다.
// (파티원 정보 모달 표시, 파티원 추방)
// 기존 ui_main.js에서 분리됨
// [수정] 모든 데이터를 player.cb.gameData (JSON)에서 가져오도록 수정

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
    const expToLevel = player.cb.gameData.expToLevel;

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