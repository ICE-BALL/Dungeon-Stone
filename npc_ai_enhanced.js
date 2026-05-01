// 파일: npc_ai_enhanced.js
// 역할: NPC AI의 고도화된 인터랙션 시스템 (평판, 감정, 기억 관리)

/**
 * 향상된 NPC AI 시스템
 * NPC가 플레이어의 평판, 행동 기록, 감정을 추적하고 그에 따라 반응
 */
export class EnhancedNPCInteraction {
    constructor(player) {
        this.player = player;
        this.npcMemories = {};     // npcName -> { affinity, interactions, lastMeeting, traits }
        this.globalRumorMill = []; // 마을 전체에 퍼지는 소문
    }

    /**
     * NPC와 상호작용 시 기억 초기화
     */
    ensureNPCMemory(npcName) {
        if (!this.npcMemories[npcName]) {
            this.npcMemories[npcName] = {
                affinity: 0,           // -100 ~ 100
                interactions: [],      // 과거 대화 기록
                lastMeeting: null,     // 마지막 만난 날짜
                traits: {},            // NPC의 특성 데이터
                relationship: "처음 만남"
            };
        }
        return this.npcMemories[npcName];
    }

    /**
     * NPC의 현재 태도 결정
     * 평판, affinity, 시간에 따라 변함
     */
    determineNPCAttitude(npcName) {
        const mem = this.ensureNPCMemory(npcName);
        const repSystem = this.player.reputationSystem;
        
        // 기본 태도: affinity와 평판에 따라 결정
        let attitude = "중립적";
        
        // 평판이 좋으면
        if (repSystem && !repSystem.player.reputationProfile.labels.includes("겁쟁이") &&
            !repSystem.player.reputationProfile.labels.includes("파렴치한")) {
            if (mem.affinity >= 30) attitude = "우호적";
            else if (mem.affinity >= 0) attitude = "호의적";
        }
        
        // 평판이 나쁘면
        if (repSystem && (repSystem.player.reputationProfile.labels.includes("겁쟁이") ||
            repSystem.player.reputationProfile.labels.includes("파렴치한"))) {
            if (mem.affinity < 0) attitude = "적대적";
            else if (mem.affinity < 20) attitude = "의심적";
        }

        return attitude;
    }

    /**
     * NPC와의 대면 시 동적 대사 생성
     */
    generateNPCGreeting(npcName, trait = "상점 주인") {
        const mem = this.ensureNPCMemory(npcName);
        const attitude = this.determineNPCAttitude(npcName);
        
        const greetings = {
            "우호적": [
                `반가워! ${this.player.race || '모험가'}. 요즘 잘 지냈어?`,
                `아, ${npcName}이야. 최근에 좋은 일이 있었나 봐.`,
                `너는 정말 믿을 수 있는 친구야. 도와줄 게 있나?`
            ],
            "호의적": [
                `안녕하세요. 뵙게 되어 반갑습니다.`,
                `그동안 잘 지내셨나요?`,
                `어서 오세요. 뭔가 도와드릴까요?`
            ],
            "중립적": [
                `뭐하러 온 거야?`,
                `오셨네요.`,
                `뭔가 필요한 게 있나?`
            ],
            "의심적": [
                `음... 너니까 조심해야 할 것 같은데.`,
                `당신의 평판이 별로 좋지 않네요.`,
                `조심해서 행동하세요.`
            ],
            "적대적": [
                `당신은 들어올 수 없어. 여기 가지 마.`,
                `니 꼴을 보기만 싫어.`,
                `나가.`
            ]
        };

        const msgs = greetings[attitude] || greetings["중립적"];
        return msgs[Math.floor(Math.random() * msgs.length)];
    }

    /**
     * 특정 액션으로 NPC affinity 변경
     */
    affectNPCAttitude(npcName, action, amount = 10) {
        const mem = this.ensureNPCMemory(npcName);
        mem.affinity = Math.max(-100, Math.min(100, mem.affinity + amount));
        mem.interactions.push({ 
            action, 
            date: new Date(),
            affinityChange: amount 
        });

        // 소문 전파 (중요한 이벤트)
        if (Math.abs(amount) > 20) {
            this._spreadRumor(`${npcName}이(가) ${action}에 ${amount > 0 ? '호감을' : '분노를'} 나타냈습니다.`);
        }

        return mem.affinity;
    }

    /**
     * 소문 전파 (다른 NPC들에게 영향)
     */
    _spreadRumor(rumorText) {
        this.globalRumorMill.push({
            text: rumorText,
            timestamp: Date.now(),
            confirmed: false
        });

        // 최대 10개까지만 유지
        if (this.globalRumorMill.length > 10) {
            this.globalRumorMill.shift();
        }

        // 길지 않은 시간 이후 다른 NPC들의 태도에 영향
        // (나중에 구현)
    }

    /**
     * 상황에 따른 NPC의 특별한 반응
     */
    generateContextualResponse(npcName, context = {}) {
        const mem = this.ensureNPCMemory(npcName);
        const playerRepSystem = this.player.reputationSystem;
        const playerInjurySystem = this.player.injurySystem;

        // 플레이어가 부상 상태인 경우
        if (playerInjurySystem && playerInjurySystem.getCurrentDebuffs().length > 0) {
            const debuffs = playerInjurySystem.getCurrentDebuffs();
            if (debuffs.includes("arm_injury_1") || debuffs.includes("arm_injury_2")) {
                return "어라, 팔을 다친 것 같은데? 대신전에 가보시지? 신관이 치료해줄 거야.";
            }
            if (debuffs.includes("leg_injury_1") || debuffs.includes("leg_injury_2")) {
                return "다리 절뚝거리네. 쉬어야 할 것 같은데.";
            }
        }

        // 플레이어의 평판에 따른 반응
        if (playerRepSystem) {
            const labels = playerRepSystem.player.reputationProfile.labels;
            if (labels.includes("겁쟁이")) {
                return "당신은 위험할 때마다 도망친다고 들었어. 정말인가?";
            }
            if (labels.includes("버스기사")) {
                return "마지막 일격 명인이라고 들었어. 대단해.";
            }
            if (labels.includes("파렴치한")) {
                return "동료를 버리고 금만 챙겼다고? 최악이군.";
            }
        }

        // 경제 상황에 따른 반응
        if (this.player.livingWorld) {
            const rumors = this.player.livingWorld.getTavernRumor();
            if (Math.random() < 0.3) return rumors;
        }

        return "오늘도 길을 나서려고?" + (mem.affinity > 0 ? " 조심해." : "");
    }

    /**
     * NPC 파티 모집 시 평판과 affinity 연동
     */
    canRecruit(npcName) {
        const mem = this.ensureNPCMemory(npcName);
        const repSystem = this.player.reputationSystem;

        // 벡그라운드 조건
        if (repSystem && !repSystem.canRecruitHighTierNPC()) {
            // 평판이 나쁘면 낮은 등급의 NPC만 가능
            return mem.affinity >= 10;
        }

        // 평판과 affinity 모두 고려
        return mem.affinity >= 0;
    }

    /**
     * 보고서 생성 (플레이어의 NPC 관계 상태)
     */
    getNPCRelationshipReport() {
        const report = {};
        const repSystem = this.player.reputationSystem;
        
        Object.entries(this.npcMemories).forEach(([npcName, mem]) => {
            report[npcName] = {
                affinity: mem.affinity,
                attitude: this.determineNPCAttitude(npcName),
                interactionCount: mem.interactions.length,
                relationship: mem.relationship
            };
        });

        return {
            npcRelationships: report,
            playerReputation: repSystem?.getReputationReport(),
            globalRumors: this.globalRumorMill.slice(-3) // 최근 3개의 소문
        };
    }
}

/**
 * NPC 기본 성향 프로필 강화본
 */
export const ENHANCED_NPC_PROFILES = {
    "상점 주인": {
        personality: "실리적",
        responseStyle: "business-like",
        favoriteActions: ["gift", "business"],
        hateActions: ["rude", "theft"],
        dynamicResponses: {
            "high_affinity": "좋아, 특별 할인을 해주지. 자주 와 주니까.",
            "low_affinity": "가격은 정가야. 다른 데 가봐.",
            "injury": "부상 당했나? 회복약 사갈래?",
            "reputation_coward": "겁쟁이더라고. 믿을 수 없어."
        }
    },
    "대장장이": {
        personality: "장인정신",
        responseStyle: "direct",
        favoriteActions: ["greet", "business", "respect"],
        hateActions: ["rude", "disrespect"],
        dynamicResponses: {
            "high_affinity": "네 장비는 내가 책임진다.",
            "low_affinity": "도구를 함부로 다루는 자와는 거래 안 한다.",
            "injury": "손상된 도구 있나? 수리해주지.",
            "butchery_success": "제대로 된 해체네. 도구도 좋지만 실력이 더 좋아."
        }
    },
    "방랑 치료사": {
        personality: "공감",
        responseStyle: "caring",
        favoriteActions: ["help", "gift"],
        hateActions: ["rude"],
        dynamicResponses: {
            "high_affinity": "좋은 일을 많이 했구나. 응원한다.",
            "low_affinity": "도움이 필요하지만 믿을 수 없네.",
            "injury": "다치셨군. 치료해드릴까? 가격은 착할 거야.",
            "reputation_shameless": "동료를 버렸다고? 그런 사람 치료할 수 없어."
        }
    }
};

/**
 * 플레이어의 특정 행동이 NPC 감정에 미치는 영향
 */
export function getActionAffinity(action, npcPersonality = "") {
    const baseAffinity = {
        "help": 15,
        "gift": 20,
        "business": 5,
        "greet": 3,
        "respectful": 8,
        "rude": -30,
        "theft": -50,
        "disrespect": -25,
        "cowardly": -15,
        "heroic": 20,
        "shameless": -40
    };

    let multiplier = 1.0;
    
    // 성향에 따른 배수 조정
    if (npcPersonality === "실리적" && action === "business") multiplier = 1.5;
    if (npcPersonality === "공감" && action === "help") multiplier = 1.3;
    if (npcPersonality === "장인정신" && action === "respectful") multiplier = 1.2;

    const base = baseAffinity[action] || 0;
    return Math.floor(base * multiplier);
}
