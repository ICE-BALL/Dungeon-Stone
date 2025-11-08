// 이 파일은 게임의 퀘스트 로그(임무 일지) UI 함수를 담당합니다.
// [신규]

// --- 핵심 UI 유틸리티 임포트 ---
import {
    logMessage,
    addButton,
    showModal,
    hideModal
} from './ui_core.js';

/**
 * 임무 일지 (퀘스트 로그) 모달 표시
 * @param {Player} player - 플레이어 객체
 */
export function showQuestLog(player) {
    const questLogScreenDiv = document.getElementById('quest-log-screen');
    const questLogListDiv = document.getElementById('quest-log-list');
    const backButton = questLogScreenDiv ? questLogScreenDiv.querySelector('.modal-close-btn') : null;

     if (!questLogScreenDiv || !questLogListDiv || !backButton) {
         console.error("Quest log modal elements not found in index.html!");
         logMessage("오류: 임무 일지 UI를 찾을 수 없습니다. index.html에 'quest-log-screen'이 추가되었는지 확인하세요.");
         return;
     }

    // gameData에서 퀘스트 원본 데이터 가져오기 (완료된 퀘스트 제목 표시용)
    const allQuests = player.cb.gameData.quests;
    const questManager = player.questManager;

    questLogListDiv.innerHTML = '<h3><i class="icon-quest"></i> 진행 중인 임무</h3>';

    // 1. 활성 퀘스트 표시
    if (questManager.activeQuests.length === 0) {
        questLogListDiv.innerHTML += "<p>현재 진행 중인 임무가 없습니다.</p>";
    } else {
        questManager.activeQuests.forEach(quest => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = 'var(--color-accent)'; // 퀘스트 표시 (노란색)

            let questInfo = `<b>${quest.title}</b> (from: ${quest.giver})<br>`;
            questInfo += `<p style="font-size: 0.9em; margin-top: 5px; font-style: italic;">${quest.description}</p>`;
            
            questInfo += "<ul style='margin-top: 10px;'>";
            quest.objectives.forEach(obj => {
                const status = obj.currentCount >= obj.requiredCount ? ' <span style="color: var(--color-stamina);">(완료)</span>' : ` (${obj.currentCount}/${obj.requiredCount})`;
                // 목표 설명 텍스트 (예: KILL 고블린 -> 고블린 처치)
                let objectiveText = "";
                switch(obj.type) {
                    case "KILL":
                        objectiveText = `${obj.target} 처치`;
                        break;
                    case "COLLECT":
                        objectiveText = `${obj.target} 수집`;
                        break;
                    case "REACH":
                        objectiveText = `${obj.target} 도달`;
                        break;
                    case "TALK":
                        objectiveText = `${obj.target}와(과) 대화`;
                        break;
                    default:
                        objectiveText = `${obj.type} ${obj.target}`;
                }
                questInfo += `<li>- ${objectiveText}${status}</li>`;
            });
            questInfo += "</ul>";

            div.innerHTML = questInfo;
            questLogListDiv.appendChild(div);
        });
    }

    // 2. 완료 퀘스트 표시
    questLogListDiv.innerHTML += '<h3 style="margin-top: 20px;"><i class="icon-log"></i> 완료한 임무</h3>';
    if (questManager.completedQuests.length === 0) {
        questLogListDiv.innerHTML += "<p>완료한 임무가 없습니다.</p>";
    } else {
        const completedList = document.createElement('ul');
        questManager.completedQuests.forEach(questId => {
            const questTitle = allQuests[questId]?.title || questId;
            const li = document.createElement('li');
            li.textContent = `[${questTitle}]`;
            li.style.color = 'var(--color-text-secondary)';
            li.style.textDecoration = 'line-through';
            completedList.appendChild(li);
        });
        questLogListDiv.appendChild(completedList);
    }

    showModal('#quest-log-screen'); // 모달 표시
    backButton.onclick = () => {
        hideModal('#quest-log-screen'); // 모달 닫기
    };
}