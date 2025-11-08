/**
 * 이 파일은 게임의 퀘스트 시스템을 관리하는 QuestManager 클래스를 정의합니다.
 * Player 클래스 내에서 이 클래스의 인스턴스가 생성됩니다.
 */
export class QuestManager {
    /**
     * QuestManager를 생성합니다.
     * @param {Player} player - 퀘스트를 소유한 플레이어 객체
     * @param {object} gameData - main.js에서 로드된 전체 게임 데이터
     */
    constructor(player, gameData) {
        this.player = player;
        this.gameData = gameData;
        this.activeQuests = [];   // 현재 진행 중인 퀘스트 목록 (퀘스트 객체 복사본 저장)
        this.completedQuests = []; // 완료한 퀘스트 ID 목록
    }

    /**
     * 퀘스트 ID로 퀘스트 데이터를 가져옵니다.
     * @param {string} questId - 퀘스트 ID
     * @returns {object | null} 퀘스트 데이터 객체 또는 null
     */
    getQuestById(questId) {
        return this.gameData.quests[questId] || null;
    }

    /**
     * 새로운 퀘스트를 수락합니다.
     * @param {string} questId - 수락할 퀘스트의 ID
     */
    acceptQuest(questId) {
        const questData = this.getQuestById(questId);

        if (!questData) {
            this.player.cb.logMessage(`오류: [${questId}] 퀘스트를 찾을 수 없습니다.`);
            return;
        }

        // 이미 수락했거나 완료한 퀘스트인지 확인
        if (this.activeQuests.some(q => q.id === questId) || this.completedQuests.includes(questId)) {
            this.player.cb.logMessage(`[${questData.title}] 퀘스트는 이미 수락했거나 완료했습니다.`);
            return;
        }

        // 시작 조건 확인 (예: 레벨)
        if (questData.startCondition) {
            if (questData.startCondition.level && this.player.level < questData.startCondition.level) {
                this.player.cb.logMessage(`레벨 ${questData.startCondition.level} 이상이 되어야 이 퀘스트를 수락할 수 있습니다.`);
                return;
            }
            // ... 기타 조건 (필요시 추가)
        }

        // 퀘스트 데이터를 복사하여 activeQuests에 추가 (원본 데이터 수정을 방지)
        const newQuest = JSON.parse(JSON.stringify(questData));
        
        // objectives의 currentCount를 0으로 초기화
        if (newQuest.objectives) {
            newQuest.objectives.forEach(obj => obj.currentCount = 0);
        }

        this.activeQuests.push(newQuest);
        this.player.cb.logMessage(`퀘스트 수락: [${newQuest.title}] - ${newQuest.description}`);
        this.player.cb.playSfx('sfx-event'); // 퀘스트 수락 효과음
        this.player.showStatus(); // UI 갱신 (퀘스트 로그가 있다면)
    }

    /**
     * 퀘스트 진행 상황을 체크하고 업데이트합니다.
     * 이 함수는 Player의 행동(몬스터 처치, 아이템 획득 등)이 발생할 때마다 호출됩니다.
     * @param {'KILL' | 'COLLECT' | 'REACH' | 'TALK'} eventType - 발생한 이벤트 타입
     * @param {string} target - 이벤트 대상 (몬스터 이름, 아이템 이름, 장소 이름, NPC 이름)
     * @param {number} [amount=1] - 획득/처치 수량
     */
    checkProgress(eventType, target, amount = 1) {
        if (this.activeQuests.length === 0) return;

        let questUpdated = false;

        for (const quest of this.activeQuests) {
            let questComplete = true; // 현재 퀘스트의 완료 여부 플래그

            for (const obj of quest.objectives) {
                // 1. 이벤트 타입과 타겟이 일치하는지 확인
                if (obj.type === eventType && obj.target === target) {
                    // 2. 이미 목표 수량을 달성했는지 확인
                    if (obj.currentCount < obj.requiredCount) {
                        obj.currentCount += amount;
                        questUpdated = true;
                        
                        // 목표 수량 초과 방지
                        if (obj.currentCount > obj.requiredCount) {
                            obj.currentCount = obj.requiredCount;
                        }
                        
                        this.player.cb.logMessage(`[퀘스트 진행] ${quest.title}: ${obj.target} (${obj.currentCount}/${obj.requiredCount})`);
                    }
                }
                
                // 3. 모든 목표가 달성되었는지 최종 확인
                if (obj.currentCount < obj.requiredCount) {
                    questComplete = false;
                }
            }

            // 4. 모든 목표가 달성되었다면 퀘스트 완료 처리
            if (questComplete) {
                this.completeQuest(quest);
                questUpdated = true; // 퀘스트 목록이 변경되었으므로 플래그 설정
            }
        }

        // 퀘스트가 업데이트되었다면 (진행 또는 완료)
        if (questUpdated) {
            // 완료된 퀘스트를 activeQuests에서 제거
            this.activeQuests = this.activeQuests.filter(q => !this.completedQuests.includes(q.id));
            this.player.showStatus(); // UI 갱신 (퀘스트 로그)
        }
    }

    /**
     * 퀘스트를 완료 처리하고 보상을 지급합니다.
     * @param {object} quest - 완료된 퀘스트 객체
     */
    completeQuest(quest) {
        this.player.cb.logMessage(`퀘스트 완료: [${quest.title}]`);
        this.player.cb.playSfx('sfx-event'); // 퀘스트 완료 효과음

        // 1. 보상 지급
        const rewards = quest.rewards;
        if (rewards) {
            if (rewards.exp) {
                // [수정] 퀘스트 보상 경험치는 gainExp의 '최초 처치' 로직을 타지 않도록 null 전달
                this.player.gainExp(rewards.exp, null); 
                this.player.cb.logMessage(`경험치 ${rewards.exp} 획득!`);
            }
            if (rewards.gold) {
                this.player.gold += rewards.gold;
                this.player.cb.logMessage(`${rewards.gold.toLocaleString()} 스톤 획득!`);
            }
            if (rewards.items) {
                rewards.items.forEach(itemInfo => {
                    for (let i = 0; i < itemInfo.count; i++) {
                        this.player.addItem(itemInfo.item);
                    }
                });
            }
            if (rewards.reputation) {
                // [문법 수정] 대괄호 표기법 사용
                this.player.specialStats['명성'].value += rewards.reputation;
                this.player.cb.logMessage(`명성 ${rewards.reputation} 획득!`);
            }
        }

        // 2. 퀘스트 목록 이동
        this.completedQuests.push(quest.id);
        // checkProgress 함수에서 activeQuests를 필터링하므로 여기서는 ID만 추가
    }

    /**
     * @returns {Array<object>} 현재 진행 중인 퀘스트 목록 반환
     */
    getActiveQuests() {
        return this.activeQuests;
    }

    /**
     * @returns {Array<string>} 완료한 퀘스트 ID 목록 반환
     */
    getCompletedQuests() {
        return this.completedQuests;
    }
}