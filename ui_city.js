// 파일: ui_city.js
// 이 파일은 게임의 도시(비전투) UI 함수를 담당합니다.
// (구역 이동, 장소 활동, 상점, 마탑, 길드 등)
// [수정] handleCityAction: "뒤로 가기" 버튼을 맨 위에 추가하여 상점가 스크롤 버그 해결

// --- 핵심 UI 유틸리티 임포트 ---
import {
    logMessage,
    addButton,
    showModal,
    hideModal,
    updateStatusBars
} from './ui_core.js';

const CITY_GRID_DISTRICT = "라비기온 (7-13구역)";
const RACE_HOMELAND_DISTRICT = "종족 영지";
const LOCATION_OPERATOR = {
    "상점가": "상점 주인",
    "대장간": "대장장이",
    "여관": "여관 주인",
    "주점": "주점 주인",
    "탐험가 길드 지부": "탐험가 길드 접수원",
    "라비기온 중앙 도서관": "도서관 사서 라그나",
    "대신전 (삼신교)": "교단 신관",
    "마탑": "마탑 마도사",
    "훈련장": "훈련 교관",
    "알미너스 중앙 거래소": "거래소 중개인",
    "알미너스 은행": "은행 관리자",
    "천공 경매장": "경매장 진행인",
    "왕궁": "왕궁 시종장",
    "배급소": "배급소 관리자",
    "깡패 점거 여관/주점": "비프론 암시장 주인",
    "하수도 비밀 통로": "밀수 안내인"
};
let ACTIVE_CITY_CONTEXT = {
    player: null,
    location: ""
};

function setActiveCityContext(player, location = "") {
    ACTIVE_CITY_CONTEXT = { player: player || null, location: String(location || "") };
}

function isLowIntSpeechMode(player) {
    if (!player) return false;
    if (typeof player.isLowIntelligence === 'function') return Boolean(player.isLowIntelligence());
    return Number(player.currentStats?.["정신력"] || player.stats?.["정신력"] || 0) < 10;
}

const NPC_PERSONALITY_PROFILES = {
    "상점 주인": {
        temperament: "실리적 상인",
        traits: ["흥정 선호", "단골 우대", "손익 계산이 빠름"],
        likes: ["business", "gift"],
        dislikes: ["rude"],
        lines: {
            low: "신용이 없는 손님한텐 정가 이상도 받을 수 있어.",
            mid: "거래는 신뢰지. 자주 오면 조건은 좋아진다.",
            high: "좋아, 이번엔 특별 단가로 맞춰주지."
        }
    },
    "대장장이": {
        temperament: "과묵한 장인",
        traits: ["품질 집착", "실력 존중", "무례를 싫어함"],
        likes: ["greet", "business"],
        dislikes: ["rude"],
        lines: {
            low: "도구를 함부로 다루는 자와는 거래 안 한다.",
            mid: "수리든 제작이든, 제대로 맡기면 제대로 해준다.",
            high: "네 장비는 내가 끝까지 책임진다."
        }
    },
    "여관 주인": {
        temperament: "친화형 관리인",
        traits: ["안전 중시", "소문 수집", "정 많은 성격"],
        likes: ["greet", "rumor", "gift"],
        dislikes: ["rude"],
        lines: {
            low: "문제 일으키면 숙박은 거절이야.",
            mid: "규칙만 지키면 여기선 편히 쉬어도 돼.",
            high: "좋은 방 비워뒀어. 단골 특전으로 챙겨줄게."
        }
    },
    "주점 주인": {
        temperament: "사교형 정보상",
        traits: ["소문에 밝음", "재미를 좋아함", "분위기 중시"],
        likes: ["rumor", "business"],
        dislikes: ["rude"],
        lines: {
            low: "시비 거는 손님은 바로 내보낸다.",
            mid: "정보는 술값보다 비싸지. 하지만 너에겐 조금 싸게.",
            high: "좋은 얘기 하나 들려주지. 오늘 운 좋을 거야."
        }
    },
    "탐험가 길드 접수원": {
        temperament: "규정 중심 실무형",
        traits: ["절차 중시", "기록 철저", "성실함"],
        likes: ["greet", "business"],
        dislikes: ["rude"],
        lines: {
            low: "규정 미준수 시 접수가 거절될 수 있습니다.",
            mid: "요청 사항을 정리해서 제출해 주세요.",
            high: "우선 처리 라인으로 올려드리겠습니다."
        }
    },
    "도서관 사서 라그나": {
        temperament: "학구형 분석가",
        traits: ["지식 선호", "논리적", "예의 중시"],
        likes: ["rumor", "greet"],
        dislikes: ["rude"],
        lines: {
            low: "근거 없는 소문은 기록 가치가 없습니다.",
            mid: "정리된 단서라면 탐색 시간을 줄일 수 있죠.",
            high: "당신에게는 비공개 열람 구역도 허용하겠습니다."
        }
    },
    "교단 신관": {
        temperament: "온건한 성직자",
        traits: ["질서 중시", "정중함 선호", "신앙 중심"],
        likes: ["greet", "gift"],
        dislikes: ["rude"],
        lines: {
            low: "경건함 없는 대화는 응하지 않습니다.",
            mid: "치유와 정화는 질서를 위해 쓰여야 합니다.",
            high: "당신의 의지를 믿습니다. 축복을 내리겠습니다."
        }
    },
    "마탑 마도사": {
        temperament: "오만한 연구자",
        traits: ["효율 중시", "지식 거래", "감정보다 성과"],
        likes: ["business", "rumor"],
        dislikes: ["rude"],
        lines: {
            low: "준비되지 않은 질문은 시간 낭비입니다.",
            mid: "대가를 지불하면 필요한 지식은 제공하죠.",
            high: "흥미롭군요. 당신에겐 연구 메모를 공유하겠습니다."
        }
    },
    "훈련 교관": {
        temperament: "강경한 실전파",
        traits: ["규율 강조", "행동 중시", "성과 평가형"],
        likes: ["greet", "business"],
        dislikes: ["rude"],
        lines: {
            low: "훈련장에선 말보다 자세가 먼저다.",
            mid: "반복이 실전을 만든다. 다음 루틴으로 가자.",
            high: "좋다. 다음 단계 훈련을 열어두지."
        }
    },
    "거래소 중개인": {
        temperament: "시장 추적형 중개인",
        traits: ["시세 변동 집착", "짧은 의사결정 선호", "리스크 분산 강조"],
        likes: ["business", "rumor"],
        dislikes: ["rude"],
        lines: {
            low: "근거 없는 감으로는 시장에서 오래 못 버팁니다.",
            mid: "거래는 타이밍입니다. 기록을 남기세요.",
            high: "당신 거래 패턴은 안정적이군요. 우선 매물을 먼저 연결하죠."
        }
    },
    "은행 관리자": {
        temperament: "보수적 재무 관리자",
        traits: ["안정성 우선", "기록 신뢰", "리스크 회피"],
        likes: ["greet", "business"],
        dislikes: ["rude"],
        lines: {
            low: "검증되지 않은 자금은 취급하기 어렵습니다.",
            mid: "지출 통제가 자산을 지키는 첫 단계입니다.",
            high: "신뢰 등급이 높습니다. 더 나은 조건을 검토해드리죠."
        }
    },
    "경매장 진행인": {
        temperament: "연출형 경매 전문가",
        traits: ["긴장감 연출", "고가 거래 선호", "비밀 유지 철저"],
        likes: ["business", "greet"],
        dislikes: ["rude"],
        lines: {
            low: "예절 없는 입찰자는 즉시 퇴장 조치됩니다.",
            mid: "입찰은 침착하게, 그러나 과감하게 하세요.",
            high: "당신이라면 비공개 우선 출품 정보를 드릴 수 있습니다."
        }
    },
    "왕궁 시종장": {
        temperament: "예법 중심 행정관",
        traits: ["형식 중시", "질서 우선", "권위 보호"],
        likes: ["greet", "business"],
        dislikes: ["rude"],
        lines: {
            low: "왕궁 질서를 해치는 언행은 허용되지 않습니다.",
            mid: "형식을 지키면 행정 절차는 신속해집니다.",
            high: "보고 체계를 믿고 따르는군요. 기록 우선권을 부여하겠습니다."
        }
    },
    "배급소 관리자": {
        temperament: "배급 통제 실무관",
        traits: ["공정 분배 강조", "현장 통제", "절차 준수"],
        likes: ["business", "greet"],
        dislikes: ["rude"],
        lines: {
            low: "질서를 어기면 배급 순위에서 제외됩니다.",
            mid: "필요한 물자를 정리해 오면 처리 속도가 빨라집니다.",
            high: "당신 기록은 양호합니다. 우선 배급권을 검토하죠."
        }
    },
    "비프론 암시장 주인": {
        temperament: "회색지대 협상가",
        traits: ["정보 은폐", "속전속결 거래", "위험 허용"],
        likes: ["business", "gift"],
        dislikes: ["rude"],
        lines: {
            low: "신뢰가 없으면 가격은 두 배다.",
            mid: "묻지 말고 가져가. 서로 편해진다.",
            high: "좋아, 너에겐 숨겨둔 물건도 보여주지."
        }
    },
    "밀수 안내인": {
        temperament: "잠입 루트 설계자",
        traits: ["은밀 이동 선호", "현장 감각 탁월", "신호 체계 엄수"],
        likes: ["rumor", "business"],
        dislikes: ["rude"],
        lines: {
            low: "입이 가벼우면 길도 끊깁니다.",
            mid: "길은 열어줄 수 있지만, 발각되면 각자 책임입니다.",
            high: "당신 발걸음은 조용하군요. 더 깊은 통로를 안내하죠."
        }
    },
    "종족 인도자": {
        temperament: "의식 지도자",
        traits: ["상징 해석", "혈통 의식", "맹세의 무게"],
        likes: ["greet", "rumor"],
        dislikes: ["rude"],
        lines: {
            low: "의식을 가볍게 여기면 길이 닫힙니다.",
            mid: "당신의 선택이 종족의 결을 바꿉니다.",
            high: "피의 맹세가 깊어졌군요. 다음 문장을 전수하겠습니다."
        }
    }
};

function getLocationOperator(location) {
    return LOCATION_OPERATOR[location] || `${location} 운영자`;
}

function buildRaceHomelandDistrict(player) {
    const raceName = player?.race || "미정";
    const mentorName = player?.raceStory?.mentor || `${raceName} 종족 인도자`;
    return {
        desc: `${raceName} 종족 전용 거점. 서사 의식과 영지 운영을 담당합니다.`,
        locations: {
            "종족 성소 의식장": {
                desc: `${mentorName}와 대화하며 종족 서사를 진행합니다.`
            },
            "개인 영지": {
                desc: "그리드 배치로 영지를 꾸미고 생산/휴식을 관리합니다."
            },
            "귀환 차원문": {
                desc: `${CITY_GRID_DISTRICT}(으)로 복귀하는 차원문입니다.`
            }
        }
    };
}

function getCityDataWithRaceHomeland(player) {
    const base = player?.cb?.gameData?.cities?.["라프도니아"] || {};
    const raceDistrict = buildRaceHomelandDistrict(player);
    const existing = base[RACE_HOMELAND_DISTRICT] || {};
    return {
        ...base,
        [RACE_HOMELAND_DISTRICT]: {
            ...raceDistrict,
            ...existing,
            locations: {
                ...(raceDistrict.locations || {}),
                ...(existing.locations || {})
            }
        }
    };
}

function hashText(text = "") {
    const src = String(text || "");
    let hash = 2166136261;
    for (let i = 0; i < src.length; i++) {
        hash ^= src.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
}

function seededPick(list, seed = 0, fallback = "") {
    if (!Array.isArray(list) || list.length === 0) return fallback;
    const idx = Math.abs(Number(seed || 0)) % list.length;
    return list[idx];
}

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0)));
}

const MAGE_TOWER_RANKS = [
    { name: "견습 마도사", meritRequired: 0, maxLearnableGrade: 9 },
    { name: "하급 연구원", meritRequired: 20, maxLearnableGrade: 8 },
    { name: "중급 연구원", meritRequired: 45, maxLearnableGrade: 7 },
    { name: "상급 연구원", meritRequired: 80, maxLearnableGrade: 6 },
    { name: "수석 연구원", meritRequired: 130, maxLearnableGrade: 5 },
    { name: "학파 부교수", meritRequired: 190, maxLearnableGrade: 4 },
    { name: "학파 교수", meritRequired: 270, maxLearnableGrade: 3 },
    { name: "원로 마도사", meritRequired: 360, maxLearnableGrade: 2 },
    { name: "마탑 원로의회", meritRequired: 480, maxLearnableGrade: 1 }
];

const MAGE_TOWER_QUESTS = [
    {
        id: "tower_fund_ledger",
        title: "연구기금 납부",
        desc: "연구기금 3,000 스톤을 지원해 마탑 장서를 복구합니다.",
        merit: 8,
        requirement: { type: "gold_payment", amount: 3000 }
    },
    {
        id: "tower_catalyst_delivery",
        title: "촉매 납품",
        desc: "마력결정체 2개와 붕대 2개를 납품합니다.",
        merit: 12,
        requirement: {
            type: "item_delivery",
            items: [
                { name: "마력결정체", count: 2 },
                { name: "붕대", count: 2 }
            ]
        }
    },
    {
        id: "tower_field_report",
        title: "현장 표본 조사",
        desc: "미궁 몬스터 8마리를 처치해 관측 보고서를 제출합니다.",
        merit: 14,
        requirement: { type: "kill_total", count: 8 }
    },
    {
        id: "tower_elite_report",
        title: "고등 개체 관측",
        desc: "5등급 이상 몬스터를 3마리 처치해 고등 위협 보고를 완성합니다.",
        merit: 18,
        requirement: { type: "kill_grade_or_better", grade: 5, count: 3 }
    },
    {
        id: "tower_rift_guardian",
        title: "균열 수호자 기록",
        desc: "균열 수호자를 1회 처치해 핵 반응 기록을 제출합니다.",
        merit: 30,
        requirement: { type: "rift_guardian_kill", count: 1 }
    },
    {
        id: "tower_stone_transcript",
        title: "마석 분석 의뢰",
        desc: "마석 350개를 제공해 차원 분석을 지원합니다.",
        merit: 16,
        requirement: { type: "magic_stone_delivery", amount: 350 }
    }
];

function getWorldDayStamp(player) {
    const tick = Math.max(0, Math.floor(Number(player?.cityActionTick || 0)));
    if (tick > 0) return tick;
    const eco = player?.economyState || {};
    const year = Math.max(1, Number(eco.year || 1));
    const day = Math.max(1, Number(eco.day || 1));
    const month = Math.max(1, Number(eco.month || 1));
    const daysPerMonth = Math.max(1, Number(eco.daysPerMonth || 25));
    const monthsPerYear = Math.max(1, Number(eco.monthsPerYear || 13));
    return (((year - 1) * monthsPerYear + (month - 1)) * daysPerMonth) + day;
}

function ensureMageTowerState(player) {
    if (!player) return null;
    if (!player.mageTowerState || typeof player.mageTowerState !== "object") {
        player.mageTowerState = {
            merit: 0,
            questState: {},
            rankName: MAGE_TOWER_RANKS[0].name
        };
    }
    if (!player.mageTowerState.questState) player.mageTowerState.questState = {};
    if (!player.mageTowerProgress || typeof player.mageTowerProgress !== "object") {
        player.mageTowerProgress = {
            killsTotal: 0,
            killsByGrade: {},
            riftGuardianKills: 0
        };
    }
    return player.mageTowerState;
}

function getMageTowerRankInfo(merit = 0) {
    let picked = MAGE_TOWER_RANKS[0];
    MAGE_TOWER_RANKS.forEach((rank) => {
        if (Number(merit || 0) >= Number(rank.meritRequired || 0)) picked = rank;
    });
    return picked;
}

function getMageTowerQuestRuntime(player, questId) {
    const state = ensureMageTowerState(player);
    if (!state) return null;
    if (!state.questState[questId]) {
        const questMeta = MAGE_TOWER_QUESTS.find((q) => q.id === questId);
        const req = questMeta?.requirement || {};
        const progress = player?.mageTowerProgress || {};
        const killsByGrade = progress.killsByGrade || {};
        const baselineGrade = (req.type === "kill_grade_or_better")
            ? Object.entries(killsByGrade).reduce((acc, [gradeKey, count]) => {
                const g = Number(gradeKey);
                return (g <= Number(req.grade || 9)) ? (acc + Number(count || 0)) : acc;
            }, 0)
            : 0;
        state.questState[questId] = {
            completedCount: 0,
            lastCompletedDay: -1,
            killSnapshot: req.type === "kill_total" ? Math.max(0, Number(progress.killsTotal || 0)) : 0,
            gradeKillSnapshot: Math.max(0, Number(baselineGrade || 0)),
            guardianSnapshot: req.type === "rift_guardian_kill" ? Math.max(0, Number(progress.riftGuardianKills || 0)) : 0
        };
    }
    return state.questState[questId];
}

function countInventoryItem(player, itemName) {
    return (player.inventory || []).filter((name) => name === itemName).length;
}

function removeInventoryItems(player, itemName, count = 1) {
    let remain = Math.max(0, Number(count || 0));
    while (remain > 0) {
        const idx = player.inventory.indexOf(itemName);
        if (idx < 0) break;
        player.inventory.splice(idx, 1);
        remain--;
    }
    return remain <= 0;
}

function getMageTowerQuestProgress(player, quest, runtime) {
    const req = quest?.requirement || {};
    const progress = player?.mageTowerProgress || {};
    const result = {
        canComplete: false,
        current: 0,
        required: 0,
        label: "조건 확인 필요"
    };

    if (req.type === "gold_payment") {
        const current = Math.max(0, Number(player?.gold || 0));
        const required = Math.max(1, Number(req.amount || 0));
        result.current = current;
        result.required = required;
        result.label = `스톤 ${current.toLocaleString()} / ${required.toLocaleString()}`;
        result.canComplete = current >= required;
        return result;
    }
    if (req.type === "magic_stone_delivery") {
        const current = Math.max(0, Number(player?.magic_stones || 0));
        const required = Math.max(1, Number(req.amount || 0));
        result.current = current;
        result.required = required;
        result.label = `마석 ${current.toLocaleString()} / ${required.toLocaleString()}`;
        result.canComplete = current >= required;
        return result;
    }
    if (req.type === "item_delivery") {
        const items = Array.isArray(req.items) ? req.items : [];
        const itemStates = items.map((item) => {
            const current = countInventoryItem(player, item.name);
            const required = Math.max(1, Number(item.count || 1));
            return {
                name: item.name,
                current,
                required
            };
        });
        const canComplete = itemStates.every((state) => state.current >= state.required);
        result.current = canComplete ? itemStates.length : itemStates.filter((state) => state.current >= state.required).length;
        result.required = itemStates.length;
        result.label = itemStates.map((state) => `${state.name} ${state.current}/${state.required}`).join(" | ");
        result.canComplete = canComplete;
        return result;
    }
    if (req.type === "kill_total") {
        const total = Math.max(0, Number(progress.killsTotal || 0));
        const baseline = Math.max(0, Number(runtime?.killSnapshot || 0));
        const current = Math.max(0, total - baseline);
        const required = Math.max(1, Number(req.count || 1));
        result.current = current;
        result.required = required;
        result.label = `처치 ${current}/${required}`;
        result.canComplete = current >= required;
        return result;
    }
    if (req.type === "kill_grade_or_better") {
        const grade = Math.max(1, Number(req.grade || 9));
        const killsByGrade = progress.killsByGrade || {};
        const total = Object.entries(killsByGrade).reduce((acc, [gradeKey, count]) => {
            const g = Number(gradeKey);
            return (g <= grade) ? (acc + Number(count || 0)) : acc;
        }, 0);
        const baseline = Math.max(0, Number(runtime?.gradeKillSnapshot || 0));
        const current = Math.max(0, total - baseline);
        const required = Math.max(1, Number(req.count || 1));
        result.current = current;
        result.required = required;
        result.label = `${grade}등급 이상 처치 ${current}/${required}`;
        result.canComplete = current >= required;
        return result;
    }
    if (req.type === "rift_guardian_kill") {
        const total = Math.max(0, Number(progress.riftGuardianKills || 0));
        const baseline = Math.max(0, Number(runtime?.guardianSnapshot || 0));
        const current = Math.max(0, total - baseline);
        const required = Math.max(1, Number(req.count || 1));
        result.current = current;
        result.required = required;
        result.label = `수호자 처치 ${current}/${required}`;
        result.canComplete = current >= required;
        return result;
    }

    return result;
}

function completeMageTowerQuest(player, quest, runtime) {
    if (!player || !quest || !runtime) return { ok: false, message: "퀘스트 데이터를 찾을 수 없습니다." };
    const req = quest.requirement || {};
    const progress = getMageTowerQuestProgress(player, quest, runtime);
    if (!progress.canComplete) {
        return { ok: false, message: `완료 조건 미달: ${progress.label}` };
    }

    if (req.type === "gold_payment") {
        player.gold -= Math.max(0, Number(req.amount || 0));
    } else if (req.type === "magic_stone_delivery") {
        player.magic_stones -= Math.max(0, Number(req.amount || 0));
    } else if (req.type === "item_delivery") {
        const items = Array.isArray(req.items) ? req.items : [];
        const canConsume = items.every((item) => countInventoryItem(player, item.name) >= Math.max(1, Number(item.count || 1)));
        if (!canConsume) {
            return { ok: false, message: "납품 아이템이 부족합니다." };
        }
        items.forEach((item) => removeInventoryItems(player, item.name, Math.max(1, Number(item.count || 1))));
    } else if (req.type === "kill_total") {
        runtime.killSnapshot = Math.max(0, Number(player?.mageTowerProgress?.killsTotal || 0));
    } else if (req.type === "kill_grade_or_better") {
        const grade = Math.max(1, Number(req.grade || 9));
        const killsByGrade = player?.mageTowerProgress?.killsByGrade || {};
        runtime.gradeKillSnapshot = Object.entries(killsByGrade).reduce((acc, [gradeKey, count]) => {
            const g = Number(gradeKey);
            return (g <= grade) ? (acc + Number(count || 0)) : acc;
        }, 0);
    } else if (req.type === "rift_guardian_kill") {
        runtime.guardianSnapshot = Math.max(0, Number(player?.mageTowerProgress?.riftGuardianKills || 0));
    }

    const state = ensureMageTowerState(player);
    const meritGain = Math.max(1, Number(quest.merit || 0));
    state.merit = Math.max(0, Number(state.merit || 0) + meritGain);
    runtime.completedCount = Math.max(0, Number(runtime.completedCount || 0) + 1);
    runtime.lastCompletedDay = getWorldDayStamp(player);
    const rankInfo = getMageTowerRankInfo(state.merit);
    state.rankName = rankInfo.name;

    const bonusGold = 500 + Math.floor(Math.random() * 420);
    player.gold += bonusGold;
    return {
        ok: true,
        message: `퀘스트 완료! 공적 +${meritGain}, 보상 스톤 +${bonusGold.toLocaleString()}`
    };
}

function getMageTowerSpellLearningRule(player, spell) {
    const state = ensureMageTowerState(player);
    const merit = Math.max(0, Number(state?.merit || 0));
    const rankInfo = getMageTowerRankInfo(merit);
    const spellGrade = Math.max(1, Number(spell?.grade || 9));
    const canLearn = spellGrade >= Number(rankInfo.maxLearnableGrade || 9);
    return {
        merit,
        rankInfo,
        spellGrade,
        canLearn
    };
}

function advanceCityActionTime(hours = 2, actionLabel = "도시 활동") {
    // 시간 시스템 제거: 도시 액션은 시간을 소모하지 않습니다.
    return;
}

function getObscuredPriceLabel(player, itemName = "", basePrice = 0) {
    if (!isLowIntSpeechMode(player)) return `${Math.max(1, Math.floor(basePrice)).toLocaleString()} 스톤`;
    const rough = [
        "?? 스톤",
        "대충 비쌈",
        "값 판독 실패",
        "숫자 난독: 확인 불가"
    ];
    const seed = hashText(`${itemName}:${basePrice}:${player?.cityActionTick || 0}`);
    return seededPick(rough, seed, "?? 스톤");
}

function applyRestRecoveryByLodging(player, quality = "standard") {
    if (!player) return 1;
    let rate = Number(player.getLodgingRecoveryMultiplier?.() || 1);
    if (quality === "luxury") rate += 0.12;
    if (quality === "poor") rate -= 0.08;
    rate = clampNumber(rate, 0.4, 1.25);

    const recoverEntity = (entity) => {
        if (!entity) return;
        if (rate >= 1) {
            entity.hp = entity.maxHp;
            entity.mp = entity.maxMp;
            if (typeof entity.stamina === 'number') entity.stamina = entity.maxStamina;
            return;
        }
        const hpTarget = Math.max(Number(entity.hp || 0), Math.floor(Number(entity.maxHp || 1) * rate));
        const mpTarget = Math.max(Number(entity.mp || 0), Math.floor(Number(entity.maxMp || 1) * rate));
        entity.hp = Math.min(entity.maxHp, hpTarget);
        entity.mp = Math.min(entity.maxMp, mpTarget);
        if (typeof entity.stamina === 'number') {
            const stTarget = Math.max(Number(entity.stamina || 0), Math.floor(Number(entity.maxStamina || 1) * rate));
            entity.stamina = Math.min(entity.maxStamina, stTarget);
        }
    };

    recoverEntity(player);
    (player.party || []).forEach(recoverEntity);

    if (rate >= 1) {
        player.fatigue = 0;
    } else {
        const fatigueRecover = Math.floor(68 * rate);
        player.fatigue = Math.max(0, Number(player.fatigue || 0) - fatigueRecover);
    }
    return rate;
}

function ensureNpcSocialState(player) {
    if (!player) return null;
    if (!player.npcSocialState) {
        player.npcSocialState = {
            memories: {},
            questState: {},
            questCounter: 0,
            rumorIndex: {}
        };
    }
    return player.npcSocialState;
}

function getNpcSocialMemory(player, npcName) {
    const state = ensureNpcSocialState(player);
    if (!state || !npcName) return null;
    if (!state.memories[npcName]) {
        state.memories[npcName] = {
            metCount: 0,
            lastVisitTick: 0,
            lastTopic: "",
            lastLineSeed: 0,
            trustMilestones: {
                friendly: false,
                trusted: false
            },
            lastGiftItem: "",
            moodOffset: (hashText(npcName) % 7) - 3
        };
    }
    return state.memories[npcName];
}

function getNpcQuestState(player, npcName) {
    const state = ensureNpcSocialState(player);
    if (!state || !npcName) return null;
    if (!state.questState[npcName]) {
        state.questState[npcName] = {
            lastIssuedTick: -999,
            issuedCount: 0,
            deniedCount: 0,
            lastQuestId: ""
        };
    }
    return state.questState[npcName];
}

function buildFallbackNpcProfile(npcName) {
    const seed = hashText(npcName);
    const temperaments = [
        "현장 운영자",
        "원칙 중심 실무형",
        "민첩한 대응형",
        "안전 우선 관리자",
        "정보 교환형 조정가"
    ];
    const traitA = ["기록형", "실행력 높음", "현장 감각 우수", "판단이 빠름", "절차 지향"];
    const traitB = ["신뢰 중시", "협상 선호", "상황판단형", "보수적 운영", "기회 포착형"];
    const traitC = ["리스크 관리", "장기 관계 선호", "업무 집중", "정보 수집 습관", "현실주의"];
    const likesPool = [
        ["greet", "business"],
        ["rumor", "business"],
        ["greet", "rumor"],
        ["business", "gift"]
    ];
    const likes = seededPick(likesPool, seed, ["greet", "business"]);

    return {
        temperament: seededPick(temperaments, seed, "현장 운영자"),
        traits: [
            seededPick(traitA, seed + 1, "실무형"),
            seededPick(traitB, seed + 7, "거래 성향"),
            seededPick(traitC, seed + 13, "현장 경험 풍부")
        ],
        likes,
        dislikes: ["rude"],
        lines: {
            low: "지금은 당신을 신뢰하기 어렵군요.",
            mid: "필요한 일이 있으면 말해보세요.",
            high: "당신은 믿을 수 있는 파트너입니다."
        }
    };
}

function getNpcProfile(npcName, npcs = null) {
    const fromData = npcs?.[npcName]?.personalityProfile;
    const base = NPC_PERSONALITY_PROFILES[npcName] || fromData || buildFallbackNpcProfile(npcName);
    const seed = hashText(npcName);
    const quirkPool = [
        "말 끝에 수치를 덧붙이는 버릇",
        "대답 전 기록을 확인하는 습관",
        "주변 동선을 먼저 살피는 습관",
        "상대 표정을 먼저 읽는 버릇",
        "거래 내역을 즉시 암기하는 습관"
    ];
    const focusPool = [
        "보급 안정화",
        "현장 안전",
        "정보 정확도",
        "수익성 유지",
        "관계 신뢰도"
    ];
    const lines = base.lines || {
        low: "지금은 당신을 신뢰하기 어렵군요.",
        mid: "필요한 일이 있으면 말해보세요.",
        high: "당신은 믿을 수 있는 파트너입니다."
    };
    const normalizedLikes = Array.isArray(base.likes) && base.likes.length > 0
        ? [...new Set(base.likes)]
        : ["greet", "business"];
    const normalizedDislikes = Array.isArray(base.dislikes) && base.dislikes.length > 0
        ? [...new Set(base.dislikes)]
        : ["rude"];

    return {
        ...base,
        likes: normalizedLikes,
        dislikes: normalizedDislikes,
        quirk: base.quirk || seededPick(quirkPool, seed + 5, "현장 노트를 반복 확인"),
        focus: base.focus || seededPick(focusPool, seed + 9, "현장 운영"),
        linePools: {
            hostile: [
                base?.linePools?.hostile?.[0],
                lines.low,
                "아직은 거리를 두는 편이 좋겠습니다."
            ].filter(Boolean),
            guarded: [
                base?.linePools?.guarded?.[0],
                lines.low,
                "규칙을 지키면 대화는 이어갈 수 있습니다."
            ].filter(Boolean),
            neutral: [
                base?.linePools?.neutral?.[0],
                lines.mid,
                "용건을 명확히 말해주면 더 정확히 도울 수 있습니다."
            ].filter(Boolean),
            friendly: [
                base?.linePools?.friendly?.[0],
                lines.mid,
                "당신과는 일 처리가 빨라서 편하군요."
            ].filter(Boolean),
            trusted: [
                base?.linePools?.trusted?.[0],
                lines.high,
                "당신이라면 민감한 정보도 공유할 수 있겠습니다."
            ].filter(Boolean)
        }
    };
}

function getAffinityBand(affinity) {
    if (affinity >= 70) return "trusted";
    if (affinity >= 35) return "friendly";
    if (affinity >= 10) return "neutral";
    if (affinity > -40) return "guarded";
    return "hostile";
}

function getNpcMoodLine(profile, affinity, seed = 0) {
    if (!profile) return "";
    const band = getAffinityBand(affinity);
    const pool = profile?.linePools?.[band];
    if (Array.isArray(pool) && pool.length > 0) {
        return seededPick(pool, seed, pool[0]);
    }
    if (!profile.lines) return "";
    if (affinity >= 60) return profile.lines.high || "";
    if (affinity >= 10) return profile.lines.mid || "";
    return profile.lines.low || "";
}

function getAffinityTier(affinity) {
    if (affinity >= 70) return "신뢰";
    if (affinity >= 35) return "우호";
    if (affinity >= 10) return "호의";
    if (affinity > -15) return "중립";
    if (affinity > -50) return "경계";
    return "적대";
}

function buildNpcAdviceLine(player, npcName) {
    const satiety = Number(player?.satiety || 0);
    const fatigue = Number(player?.fatigue || 0);
    const hp = Number(player?.hp || 0);
    const maxHp = Math.max(1, Number(player?.maxHp || hp || 1));
    const hpRate = hp / maxHp;
    const layer = Number(player?.currentLayer || 1);

    if (satiety <= 28) return `${npcName}: 포만감이 위험 수치입니다. 전투보다 보급을 먼저 챙기세요.`;
    if (fatigue >= 70) return `${npcName}: 피로가 높습니다. 숙소나 캠프로 리듬을 먼저 회복하세요.`;
    if (hpRate <= 0.45) return `${npcName}: 지금 상태로 밀어붙이면 손실이 커집니다. 회복 루트를 먼저 확보하세요.`;
    if (player?.position === "Labyrinth") return `${npcName}: ${layer}층은 시야와 동선이 핵심입니다. 좁은 통로에서 한 번에 교전하지 마세요.`;
    return `${npcName}: 거래 기록과 동선을 남기면 다음 선택이 빨라집니다.`;
}

function buildNpcOpeningLine({ baseDialog, profile, affinity, memory, npcName, location, player }) {
    const visit = Number(memory?.metCount || 1);
    const band = getAffinityBand(affinity);
    const seed = hashText(`${npcName}:${location}:${visit}:${player?.cityActionTick || 0}`);
    const introPool = {
        hostile: [
            `${npcName}: 또 왔군요. 이번엔 실수하지 마세요.`,
            `${npcName}: 용건부터 말하세요. 잡담할 시간은 없습니다.`
        ],
        guarded: [
            `${npcName}: 지난번보다는 낫군요. 규칙은 지켜주세요.`,
            `${npcName}: 최소한 절차는 알고 온 것 같네요.`
        ],
        neutral: [
            `${npcName}: 오셨군요. 오늘은 어떤 일로?`,
            `${npcName}: 타이밍이 좋네요. 지금은 얘기할 여유가 있습니다.`
        ],
        friendly: [
            `${npcName}: 반갑군요. 당신 건은 우선순위로 보고 있습니다.`,
            `${npcName}: 마침 필요하던 사람이 왔네요.`
        ],
        trusted: [
            `${npcName}: 잘 왔습니다. 민감한 건부터 먼저 공유하죠.`,
            `${npcName}: 당신이라면 맡길 수 있습니다. 안쪽 이야기로 들어가죠.`
        ]
    };
    const intro = seededPick(introPool[band], seed, `${npcName}: 환영합니다.`);
    const visitLine = visit <= 1
        ? `${npcName}: 첫 만남이군요. 서로 일하는 방식부터 맞춰봅시다.`
        : `${npcName}: ${visit}번째 대면입니다. 지난 대화 흐름을 기억하고 있습니다.`;
    const mood = getNpcMoodLine(profile, affinity, seed + 5);
    return `${baseDialog}\n${intro}\n${visitLine}\n${mood}`;
}

function buildNpcTopicLine({ choiceKey, npcName, profile, affinity, memory, player, location }) {
    const seed = hashText(`${npcName}:${choiceKey}:${memory?.metCount || 0}:${player?.cityActionTick || 0}`);
    const mood = getNpcMoodLine(profile, affinity, seed + 11);
    const topicPools = {
        greet: [
            `${npcName}: 예의를 지키는 사람과는 일의 속도가 다릅니다.`,
            `${npcName}: 인사 하나로 분위기가 정리되는군요.`,
            `${npcName}: 좋습니다. 기본이 갖춰진 대화는 신뢰가 빠릅니다.`
        ],
        rumor: [
            `${npcName}: 최근 ${location} 주변 동선이 바뀌었습니다. 야간 이동을 줄이세요.`,
            `${npcName}: 보급선이 흔들리면 시장이 먼저 반응합니다. 가격표를 자주 확인하세요.`,
            `${npcName}: 조용한 구역일수록 큰 사건이 준비됩니다. 경보를 무시하지 마세요.`
        ],
        business: [
            `${npcName}: 숫자와 기한을 먼저 맞추면 거래는 어렵지 않습니다.`,
            `${npcName}: 납기와 품질, 둘 중 하나라도 흐리면 신뢰가 깨집니다.`,
            `${npcName}: 좋은 조건은 꾸준한 이행에서 생깁니다.`
        ],
        smalltalk: [
            `${npcName}: 요즘은 말투보다 행동 기록이 더 많은 걸 말해줍니다.`,
            `${npcName}: 현장은 늘 바뀌지만, 습관은 사람을 드러내죠.`,
            `${npcName}: 피곤할수록 원칙으로 돌아가는 게 안전합니다.`
        ],
        advice: [
            buildNpcAdviceLine(player, npcName),
            `${npcName}: 오늘 기준으로 가장 약한 고리를 먼저 보강하세요. 보통은 보급이나 시야입니다.`,
            `${npcName}: 다음 한 턴에서 잃지 않는 선택이 장기적으로 가장 빠릅니다.`
        ],
        apology: [
            `${npcName}: 사과는 기록했습니다. 다음 행동으로 증명해보세요.`,
            `${npcName}: 말보다 이행이 중요합니다. 하지만 기회는 한 번 더 주죠.`,
            `${npcName}: 좋습니다. 이번 건은 넘기겠습니다.`
        ],
        rude: [
            `${npcName}: 그 태도는 손해로 돌아옵니다.`,
            `${npcName}: 존중이 없으면 협력도 없습니다.`,
            `${npcName}: 이 대화는 여기까지 하죠.`
        ]
    };
    const base = seededPick(topicPools[choiceKey] || topicPools.business, seed, `${npcName}: 용건을 이어가죠.`);
    return `${base}\n${mood}`;
}

function buildNpcQuestData(player, npcName, location, profile, affinity, questState) {
    const level = Math.max(1, Number(player?.level || 1));
    const layer = clampNumber(player?.currentLayer || 1, 1, 10);
    const monsters = player?.cb?.gameData?.layers?.[layer]?.monsters ||
        player?.cb?.gameData?.maps?.[layer]?.monsters ||
        [];
    const monsterName = seededPick(monsters, hashText(`${npcName}:${layer}:${questState?.issuedCount || 0}`), "고블린");
    const collectPool = ["건조 식량", "포션", "붕대", "해독제", "강철 조각", "마력결정체", "라이티늄"];
    const collectItem = seededPick(collectPool, hashText(`${npcName}:collect:${level}`), "포션");
    const talkTargets = [...new Set(Object.values(LOCATION_OPERATOR).filter((name) => name !== npcName))];
    const talkNpc = seededPick(talkTargets, hashText(`${npcName}:talk:${location}`), "탐험가 길드 접수원");
    const temperament = String(profile?.temperament || "");
    const preferredKinds = temperament.includes("상인") || temperament.includes("중개") || temperament.includes("은행")
        ? ["COLLECT", "TALK", "KILL"]
        : (temperament.includes("실전") || temperament.includes("교관") || temperament.includes("행정")
            ? ["KILL", "REACH", "COLLECT"]
            : ["COLLECT", "KILL", "TALK", "REACH"]);
    const kind = seededPick(
        preferredKinds,
        hashText(`${npcName}:${questState?.issuedCount || 0}:${player?.cityActionTick || 0}`),
        "COLLECT"
    );

    const socialState = ensureNpcSocialState(player);
    socialState.questCounter = Number(socialState.questCounter || 0) + 1;
    const questId = `NPC_SOCIAL_${hashText(npcName).toString(36).toUpperCase()}_${socialState.questCounter}`;
    const rewardExp = Math.max(60, 45 + (level * 18) + Math.floor(Math.max(0, affinity) * 0.9));
    const rewardGold = Math.max(120, 160 + (level * 110) + Math.floor(Math.max(0, affinity) * 4));
    const rewardRep = Math.max(1, Math.floor(Math.max(0, affinity) / 35) + 1);
    const rewardItem = seededPick(["포션", "상급 포션", "건조 식량", "붕대", "마나 포션"], hashText(`${questId}:reward`), "포션");

    let objectives = [];
    let title = "";
    let description = "";
    if (kind === "KILL") {
        const killCount = clampNumber(3 + Math.floor(level / 3) + (questState?.issuedCount || 0), 3, 15);
        title = `${npcName}의 위협 제거 요청`;
        description = `${npcName}이(가) ${monsterName}의 위협을 줄여달라고 요청했습니다.`;
        objectives = [{ type: "KILL", target: monsterName, requiredCount: killCount, currentCount: 0 }];
    } else if (kind === "TALK") {
        title = `${npcName}의 연락 임무`;
        description = `${talkNpc}에게 전달 사항을 확인하고 보고해 주세요.`;
        objectives = [{ type: "TALK", target: talkNpc, requiredCount: 1, currentCount: 0 }];
    } else if (kind === "REACH") {
        const targetLayer = clampNumber(layer + 1, 1, 10);
        title = `${npcName}의 현장 정찰 요청`;
        description = `${targetLayer}층의 현황을 확인하고 귀환해 보고해 주세요.`;
        objectives = [{ type: "REACH", target: `${targetLayer}층`, requiredCount: 1, currentCount: 0 }];
    } else {
        const collectCount = clampNumber(2 + Math.floor(level / 4) + ((questState?.issuedCount || 0) % 3), 2, 8);
        title = `${npcName}의 보급 협조 요청`;
        description = `${npcName}이(가) ${collectItem} ${collectCount}개 확보를 부탁했습니다.`;
        objectives = [{ type: "COLLECT", target: collectItem, requiredCount: collectCount, currentCount: 0 }];
    }

    return {
        id: questId,
        title,
        description,
        type: "NPC_DYNAMIC",
        giver: npcName,
        objectives,
        rewards: {
            exp: rewardExp,
            gold: rewardGold,
            items: [{ item: rewardItem, count: 1 }],
            reputation: rewardRep
        },
        startCondition: { level: Math.max(1, Math.floor(level * 0.6)) },
        endCondition: { npc: npcName }
    };
}

function requestNpcQuest(player, npcName, location, profile, affinity) {
    if (!player?.questManager || !player?.cb?.gameData) {
        return { ok: false, reason: "퀘스트 매니저가 준비되지 않았습니다." };
    }
    const questState = getNpcQuestState(player, npcName);
    if (!questState) return { ok: false, reason: "의뢰 상태를 준비할 수 없습니다." };
    if (affinity < 10) {
        return { ok: false, reason: `${npcName}: 아직 당신에게 일을 맡길 신뢰가 충분하지 않습니다.` };
    }

    const tick = Number(player.cityActionTick || 0);
    const cooldown = Math.max(4, 14 - Math.floor(Math.max(0, affinity) / 18));
    const remain = (questState.lastIssuedTick + cooldown) - tick;
    if (remain > 0) {
        return { ok: false, reason: `${npcName}: 의뢰 정리 중입니다. 대화를 ${remain}회 정도 더 나눈 뒤 다시 오세요.` };
    }

    const sameGiverActive = player.questManager.activeQuests
        .filter((quest) => String(quest?.giver || "") === npcName)
        .length;
    if (sameGiverActive >= 2) {
        return { ok: false, reason: `${npcName}: 이미 맡긴 일이 ${sameGiverActive}건 있습니다. 먼저 처리해 주세요.` };
    }

    const chance = clampNumber(0.15 + (Math.max(0, affinity) * 0.005) + (questState.deniedCount * 0.08), 0.15, 0.82);
    if (Math.random() > chance) {
        questState.deniedCount = Number(questState.deniedCount || 0) + 1;
        return { ok: false, reason: `${npcName}: 지금은 바로 맡길 만한 건이 없습니다. 다음 순번 때 이야기합시다.` };
    }

    const quest = buildNpcQuestData(player, npcName, location, profile, affinity, questState);
    if (!player.cb.gameData.quests) player.cb.gameData.quests = {};
    player.cb.gameData.quests[quest.id] = quest;
    const prevActive = Number(player.questManager.activeQuests.length || 0);
    player.questManager.acceptQuest(quest.id);
    const accepted = Number(player.questManager.activeQuests.length || 0) > prevActive;
    if (!accepted) {
        return { ok: false, reason: `${npcName}: 지금은 새로운 의뢰를 등록할 수 없습니다.` };
    }

    questState.lastIssuedTick = tick;
    questState.issuedCount = Number(questState.issuedCount || 0) + 1;
    questState.deniedCount = 0;
    questState.lastQuestId = quest.id;

    return { ok: true, quest };
}

function maybeTriggerAffinityMilestone(player, npcName, affinity, memory) {
    if (!player || !memory) return "";
    if (affinity >= 70 && !memory.trustMilestones.trusted) {
        memory.trustMilestones.trusted = true;
        return `${npcName}: 신뢰 단계에 도달했습니다. 앞으로는 우선 협력 대상으로 분류하겠습니다.`;
    }
    if (affinity >= 35 && !memory.trustMilestones.friendly) {
        memory.trustMilestones.friendly = true;
        return `${npcName}: 우호 단계로 전환되었습니다. 거래와 의뢰 조건이 유리해집니다.`;
    }
    return "";
}

function ensureNpcDialogModal() {
    let modal = document.getElementById('npc-dialog-screen');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'npc-dialog-screen';
    modal.className = 'modal-overlay hidden';
    modal.innerHTML = `
        <div class="modal-content npc-dialog-modal">
            <div class="modal-grid-head">
                <h3 id="npc-dialog-title">NPC 대화</h3>
                <span id="npc-dialog-subtitle"></span>
            </div>
            <div class="modal-grid-section">
                <h4>성향 정보</h4>
                <div class="status-chip-grid" id="npc-dialog-traits"></div>
            </div>
            <div class="modal-grid-section">
                <h4>대화 내용</h4>
                <p id="npc-dialog-text" class="city-dialog-text"></p>
            </div>
            <div class="modal-grid-section">
                <h4>대화 선택</h4>
                <div class="modal-card-grid" id="npc-dialog-options"></div>
            </div>
            <button id="npc-dialog-close" class="modal-close-btn">닫기</button>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function openNpcDialog(player, location, npcName, npcs, onUpdated = null) {
    if (!player || !npcName) return;
    ensureNpcDialogModal();
    const modal = document.getElementById('npc-dialog-screen');
    if (!modal) return;

    player.cityActionTick = Number(player.cityActionTick || 0) + 1;
    const memory = getNpcSocialMemory(player, npcName);
    if (!memory) return;
    memory.metCount = Number(memory.metCount || 0) + 1;
    memory.lastVisitTick = Number(player.cityActionTick || 0);
    player.questManager?.checkProgress?.('TALK', npcName, 1);

    const profile = getNpcProfile(npcName, npcs);
    const affinity = getNpcAffinity(player, npcName);
    const title = document.getElementById('npc-dialog-title');
    const subtitle = document.getElementById('npc-dialog-subtitle');
    const traits = document.getElementById('npc-dialog-traits');
    const text = document.getElementById('npc-dialog-text');
    const options = document.getElementById('npc-dialog-options');
    const closeBtn = document.getElementById('npc-dialog-close');

    if (!title || !subtitle || !traits || !text || !options || !closeBtn) return;

    const greetingFromAI = player?.npcAI?.generateNPCGreeting?.(npcName, profile?.temperament || "운영자");
    const baseDialog = greetingFromAI || npcs?.[npcName]?.dialog || `${npcName}: 환영합니다.`;
    title.textContent = `${npcName} 대화`;
    const updateSubtitle = () => {
        const currentAffinity = getNpcAffinity(player, npcName);
        const tier = getAffinityTier(currentAffinity);
        const discount = getDiscountRate(player, npcName, 0.25);
        const aiAttitude = player?.npcAI?.determineNPCAttitude?.(npcName) || "중립적";
        const giverActiveCount = Array.isArray(player.questManager?.activeQuests)
            ? player.questManager.activeQuests.filter((quest) => String(quest?.giver || "") === npcName).length
            : 0;
        subtitle.textContent = `${location} | 성향 ${profile.temperament} | AI 태도 ${aiAttitude} | 호감도 ${currentAffinity} (${tier}) | 할인율 ${Math.floor(discount * 100)}% | 방문 ${memory.metCount}회 | 진행의뢰 ${giverActiveCount}건`;
    };
    updateSubtitle();

    const renderTraitChips = () => {
        traits.innerHTML = '';
        [profile.temperament, ...(profile.traits || []), `집중:${profile.focus || "현장 운영"}`, `버릇:${profile.quirk || "기록 확인"}`]
            .slice(0, 6)
            .forEach((chip) => {
                const span = document.createElement('span');
                span.textContent = chip;
                traits.appendChild(span);
            });
    };
    renderTraitChips();

    const updateText = (line) => {
        text.textContent = line || baseDialog;
    };
    const lowIntMode = isLowIntSpeechMode(player);
    const aiContextLine = player?.npcAI?.generateContextualResponse?.(npcName, { location }) || "";
    updateText(`${buildNpcOpeningLine({
        baseDialog,
        profile,
        affinity,
        memory,
        npcName,
        location,
        player
    })}${aiContextLine ? `\n${aiContextLine}` : ""}`);

    const getTalkDelta = (choiceKey) => {
        let delta = 1;
        if (profile.likes?.includes(choiceKey)) delta += 2;
        if (profile.dislikes?.includes(choiceKey)) delta -= 3;
        if (choiceKey === "smalltalk") delta = Math.max(0, delta);
        if (choiceKey === "advice") delta = Math.max(0, delta);
        if (choiceKey === "request") delta = Math.max(0, delta);
        return delta;
    };

    const consumeGiftItem = () => {
        const giftPool = ["건조 식량", "포션", "횃불", "마력결정체", "붕대"];
        const item = giftPool.find((name) => player.inventory?.includes(name));
        if (!item) return null;
        const idx = player.inventory.indexOf(item);
        if (idx >= 0) player.inventory.splice(idx, 1);
        return item;
    };

    const trySpontaneousQuestOffer = (currentAffinity) => {
        if (currentAffinity < 35) return null;
        const questState = getNpcQuestState(player, npcName);
        if (!questState) return null;
        const chance = clampNumber(0.05 + (Math.max(0, currentAffinity) * 0.002), 0.05, 0.3);
        if (Math.random() > chance) return null;
        const offered = requestNpcQuest(player, npcName, location, profile, currentAffinity);
        if (!offered?.ok || !offered.quest) return null;
        return `${npcName}: 마침 맡길 건이 생겼습니다.\n[의뢰 등록] ${offered.quest.title}\n- ${offered.quest.description}`;
    };

    const applyTalk = (choiceKey, reason, customBuild = null) => {
        player.advanceWorldTime?.(1, `${npcName} 대화`);
        const beforeAffinity = getNpcAffinity(player, npcName);
        let delta = getTalkDelta(choiceKey);

        if (choiceKey === "gift") {
            const gift = consumeGiftItem();
            if (!gift) {
                updateText(`${npcName}: 지금 줄 수 있는 선물이 없군요. (건조 식량/포션/횃불/마력결정체/붕대 필요)`);
                return;
            }
            memory.lastGiftItem = gift;
            delta += 2;
            updateText(`${npcName}: ${gift}를 받았군요. 성의를 확인했습니다.`);
        } else if (choiceKey === "rude") {
            delta = Math.min(-1, delta);
            updateText(buildNpcTopicLine({ choiceKey, npcName, profile, affinity: beforeAffinity, memory, player, location }));
        } else if (choiceKey === "request") {
            const requested = requestNpcQuest(player, npcName, location, profile, beforeAffinity);
            if (requested?.ok && requested.quest) {
                delta += 1;
                updateText(`${npcName}: 좋습니다. 이 건을 맡아주세요.\n[의뢰 등록] ${requested.quest.title}\n- ${requested.quest.description}`);
            } else {
                delta = Math.max(0, delta - 1);
                updateText(requested?.reason || `${npcName}: 지금은 맡길 건이 없습니다.`);
            }
        } else if (choiceKey === "apology") {
            delta = beforeAffinity < 0 ? Math.max(1, delta + 1) : Math.max(0, delta - 1);
            updateText(buildNpcTopicLine({ choiceKey, npcName, profile, affinity: beforeAffinity, memory, player, location }));
        } else if (typeof customBuild === "function") {
            updateText(customBuild());
        } else {
            updateText(buildNpcTopicLine({ choiceKey, npcName, profile, affinity: beforeAffinity, memory, player, location }));
        }

        if (lowIntMode && ["rumor", "business", "advice", "request", "apology"].includes(choiceKey)) {
            delta -= 1;
            updateText(`${text.textContent}\n(어눌한 화법 때문에 협상 효율이 떨어졌다.)`);
        }
        if (lowIntMode && ["greet", "smalltalk", "rude"].includes(choiceKey)) {
            const bonded = player.applyBarbarianSpeechBond?.(1, `${npcName} 대화`);
            if (bonded > 0) {
                delta += 1;
                updateText(`${text.textContent}\n(거친 화법에 동조한 바바리안 계열 동료들의 결속이 강화되었다.)`);
            }
        }

        memory.lastTopic = choiceKey;
        const changedAffinity = delta !== 0
            ? changeNpcAffinity(player, npcName, delta, `${location} 대화:${reason}`)
            : getNpcAffinity(player, npcName);
        if (delta !== 0) {
            player?.npcAI?.affectNPCAttitude?.(npcName, reason || choiceKey, Math.trunc(delta * 6));
        }
        const milestone = maybeTriggerAffinityMilestone(player, npcName, changedAffinity, memory);
        if (milestone) {
            updateText(`${text.textContent}\n${milestone}`);
        } else {
            const spontaneous = trySpontaneousQuestOffer(changedAffinity);
            if (spontaneous) {
                updateText(`${text.textContent}\n${spontaneous}`);
            }
        }

        player.showStatus?.();
        updateSubtitle();
        if (typeof onUpdated === 'function') onUpdated();
    };

    options.innerHTML = '';
    const optionDefs = [
        {
            label: "정중히 인사",
            key: "greet",
            reason: "인사",
            variant: "buy",
            build: () => buildNpcTopicLine({ choiceKey: "greet", npcName, profile, affinity: getNpcAffinity(player, npcName), memory, player, location })
        },
        {
            label: "최근 소문 공유",
            key: "rumor",
            reason: "정보 공유",
            variant: "buy",
            build: () => buildNpcTopicLine({ choiceKey: "rumor", npcName, profile, affinity: getNpcAffinity(player, npcName), memory, player, location })
        },
        {
            label: "업무/거래 얘기",
            key: "business",
            reason: "업무 협의",
            variant: "buy",
            build: () => buildNpcTopicLine({ choiceKey: "business", npcName, profile, affinity: getNpcAffinity(player, npcName), memory, player, location })
        },
        {
            label: "개인 근황 묻기",
            key: "smalltalk",
            reason: "근황 대화",
            variant: "default",
            build: () => buildNpcTopicLine({ choiceKey: "smalltalk", npcName, profile, affinity: getNpcAffinity(player, npcName), memory, player, location })
        },
        {
            label: "전술 조언 요청",
            key: "advice",
            reason: "조언 요청",
            variant: "default",
            build: () => buildNpcTopicLine({ choiceKey: "advice", npcName, profile, affinity: getNpcAffinity(player, npcName), memory, player, location })
        },
        {
            label: "일거리 부탁",
            key: "request",
            reason: "의뢰 요청",
            variant: "buy",
            build: null
        },
        {
            label: "선물 건네기",
            key: "gift",
            reason: "선물",
            variant: "buy",
            build: null
        },
        {
            label: "관계 회복 시도",
            key: "apology",
            reason: "사과",
            variant: "default",
            build: null
        },
        {
            label: "무례한 농담",
            key: "rude",
            reason: "무례",
            variant: "sell",
            build: null
        }
    ];

    optionDefs.forEach((opt) => {
        const lowIntLabelMap = {
            greet: "어. 인사.",
            rumor: "소문. 빨리.",
            business: "값 얼마냐.",
            smalltalk: "오늘 뭐 함?",
            advice: "싸움법 말해.",
            request: "일 줘.",
            gift: "이거 받어.",
            apology: "미안. 아마도.",
            rude: "약한 놈."
        };
        const shownLabel = lowIntMode ? (lowIntLabelMap[opt.key] || opt.label) : opt.label;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `city-action-card ${opt.variant || 'default'}`;
        btn.innerHTML = `
            <span class="city-card-title">${shownLabel}</span>
            <span class="city-card-meta">성향 반응: ${profile.likes?.includes(opt.key) ? "선호" : (profile.dislikes?.includes(opt.key) ? "비선호" : "보통")}</span>
        `;
        btn.onclick = () => applyTalk(opt.key, opt.reason, opt.build);
        options.appendChild(btn);
    });

    closeBtn.onclick = () => {
        hideModal('#npc-dialog-screen');
    };

    showModal('#npc-dialog-screen');
}

function getNpcAffinity(player, npcName) {
    if (!player || !npcName) return 0;
    if (typeof player.getNpcAffinity === 'function') return player.getNpcAffinity(npcName);
    return Number(player.npcAffinity?.[npcName] || 0);
}

function changeNpcAffinity(player, npcName, delta, reason = "") {
    if (!player || !npcName || !Number.isFinite(delta) || delta === 0) return 0;
    if (typeof player.changeNpcAffinity === 'function') {
        return player.changeNpcAffinity(npcName, delta, reason);
    }
    player.npcAffinity = player.npcAffinity || {};
    const current = Number(player.npcAffinity[npcName] || 0);
    const next = Math.max(-100, Math.min(100, current + Math.trunc(delta)));
    player.npcAffinity[npcName] = next;
    if (reason) {
        const sign = next - current >= 0 ? "+" : "";
        logMessage(`[호감도] ${npcName} ${sign}${next - current} (${reason}) -> ${next}`);
    }
    return next;
}

function getDiscountRate(player, npcName, maxDiscount = 0.25) {
    const affinity = getNpcAffinity(player, npcName);
    const rate = Math.max(0, affinity) * 0.0025;
    return Math.min(maxDiscount, rate);
}

const BASIC_SHOP_ALLOWLIST = new Set([
    "포션",
    "상급 포션",
    "기력 회복 물약",
    "마나 포션",
    "횃불",
    "모닥불 키트",
    "식량",
    "건조 식량",
    "고급 식량",
    "붕대",
    "해독제",
    "나침반",
    "감정 스크롤",
    "밀 씨앗",
    "감자 씨앗",
    "토마토 씨앗",
    "약초 씨앗"
]);

const BASIC_SHOP_ALLOW_PATTERNS = [
    /포션|물약/i,
    /횃불|모닥불/i,
    /식량|건조|붕대|해독|나침반|감정|씨앗/i
];

const BASIC_SHOP_BLOCK_PATTERNS = [
    /넘버스|시크릿|유니크|전설|군주|밀라옐|아이기스|데드리우스|영혼지기/i,
    /각인|성유물|계층군주|신물|아티팩트/i
];

const HOMESTEAD_TILE_LIBRARY = {
    empty: { label: "비움", marker: "", desc: "빈 타일" },
    path: { label: "길", marker: "=", desc: "보행로" },
    grass: { label: "잔디", marker: "'", desc: "잔디 지형" },
    water: { label: "연못", marker: "~", desc: "수경 장식" },
    tree: { label: "수목", marker: "T", desc: "수목 배치" },
    flower: { label: "화단", marker: "*", desc: "화단 배치" },
    statue: { label: "조형물", marker: "O", desc: "조형 장식" },
    forge: { label: "공방소품", marker: "F", desc: "공방 장식" },
    altar: { label: "성소소품", marker: "A", desc: "의식 장식" },
    camp: { label: "휴식쉼터", marker: "C", desc: "휴식 장식" }
};

function getHomesteadThemeClass(themeName = "") {
    const key = String(themeName || "기본").toLowerCase();
    if (key.includes("숲")) return "homestead-theme-forest";
    if (key.includes("요새")) return "homestead-theme-fortress";
    if (key.includes("성소")) return "homestead-theme-sanctum";
    if (key.includes("용혈") || key.includes("dragon")) return "homestead-theme-dragon";
    return "homestead-theme-base";
}

function renderHomesteadDesignerSection(menu, player) {
    if (!menu || !player) return;
    const payload = typeof player.getHomesteadPayload === 'function'
        ? player.getHomesteadPayload()
        : null;
    if (!payload) return;

    const decorGrid = Array.isArray(payload.decor?.grid) ? payload.decor.grid : [];
    const width = decorGrid[0]?.length || 10;
    const height = decorGrid.length || 10;
    const structureOverlay = payload.structureOverlay || {};

    const section = document.createElement('section');
    section.className = `city-action-section homestead-designer ${getHomesteadThemeClass(payload.decor?.theme)}`;
    section.innerHTML = `
        <h3 class="city-action-title">영지 꾸미기 그리드</h3>
        <p class="city-action-desc">타일을 클릭해 장식을 배치하세요. 시설 타일(HG/FG/RT/LG)은 고정됩니다.</p>
    `;
    menu.appendChild(section);

    const state = {
        selectedTile: "path",
        width,
        height
    };

    const palette = document.createElement('div');
    palette.className = 'homestead-palette-grid';
    section.appendChild(palette);

    const brushInfo = document.createElement('p');
    brushInfo.className = 'city-action-desc homestead-brush-info';
    section.appendChild(brushInfo);

    const grid = document.createElement('div');
    grid.className = 'homestead-visual-grid';
    grid.style.gridTemplateColumns = `repeat(${width}, minmax(0, 1fr))`;
    section.appendChild(grid);

    const footer = document.createElement('div');
    footer.className = 'homestead-designer-footer';
    section.appendChild(footer);

    const tileElements = Array.from({ length: height }, () => Array(width).fill(null));
    const updateBrushInfo = () => {
        const meta = HOMESTEAD_TILE_LIBRARY[state.selectedTile] || HOMESTEAD_TILE_LIBRARY.empty;
        brushInfo.textContent = `현재 브러시: ${meta.label} (${meta.marker || "빈칸"})`;
    };

    Object.entries(HOMESTEAD_TILE_LIBRARY).forEach(([key, meta]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'city-action-card homestead-palette-btn';
        btn.innerHTML = `
            <span class="city-card-title">${meta.label}</span>
            <span class="city-card-meta">${meta.marker || "(빈칸)"}</span>
        `;
        btn.onclick = () => {
            state.selectedTile = key;
            palette.querySelectorAll('.homestead-palette-btn').forEach((node) => node.classList.remove('selected'));
            btn.classList.add('selected');
            updateBrushInfo();
        };
        if (key === state.selectedTile) btn.classList.add('selected');
        palette.appendChild(btn);
    });
    updateBrushInfo();

    const getTileMeta = (x, y) => {
        const tile = String(decorGrid?.[y]?.[x] || "empty");
        return HOMESTEAD_TILE_LIBRARY[tile] || HOMESTEAD_TILE_LIBRARY.empty;
    };

    const renderCell = (x, y) => {
        const cell = tileElements[y][x];
        if (!cell) return;
        const fixed = structureOverlay[`${x},${y}`] || null;
        if (fixed) {
            cell.className = 'homestead-grid-cell fixed';
            cell.textContent = `${fixed.marker}${Math.max(1, Number(fixed.level || 1))}`;
            cell.title = `${fixed.label} Lv.${fixed.level}`;
            return;
        }
        const meta = getTileMeta(x, y);
        cell.className = `homestead-grid-cell tile-${String(decorGrid?.[y]?.[x] || "empty")}`;
        cell.textContent = meta.marker;
        cell.title = `${meta.label} (${x}, ${y})`;
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'homestead-grid-cell';
            cell.onclick = () => {
                const key = `${x},${y}`;
                if (structureOverlay[key]) {
                    logMessage(`[영지] ${structureOverlay[key].label} 타일은 이동할 수 없습니다.`);
                    return;
                }
                const ok = player.setHomesteadDecorTile?.(x, y, state.selectedTile);
                if (!ok) return;
                decorGrid[y][x] = state.selectedTile;
                renderCell(x, y);
                updateStatusBars(player);
            };
            tileElements[y][x] = cell;
            grid.appendChild(cell);
            renderCell(x, y);
        }
    }

    addActionCard(footer, {
        title: "그리드 전체 정리",
        desc: "모든 장식 타일을 비웁니다.",
        meta: "안락도 소폭 감소",
        variant: "sell",
        onClick: () => {
            player.resetHomesteadDecorGrid?.();
            handleCityAction(player, "개인 영지");
        }
    });
    addActionCard(footer, {
        title: "새로고침",
        desc: "현재 배치를 다시 렌더링합니다.",
        meta: "시각 미리보기 갱신",
        onClick: () => handleCityAction(player, "개인 영지")
    });
}

function buildBasicShopStock(shopItems = {}, allGameItems = {}) {
    const basicTypeAllow = new Set(["소모품", "설치품", "도구", "재료", "기타"]);
    const stockEntries = Object.entries(shopItems || {}).filter(([itemName, itemData]) => {
        const meta = itemData || allGameItems[itemName] || {};
        const metaText = `${itemName || ""} ${meta?.desc || ""}`;
        if (!itemName) return false;
        if (BASIC_SHOP_BLOCK_PATTERNS.some((pattern) => pattern.test(metaText))) return false;
        if (BASIC_SHOP_ALLOWLIST.has(itemName)) return true;

        const type = String(meta.type || "");
        const price = Number(meta.price || 0);
        if (!basicTypeAllow.has(type)) return false;
        if (price <= 0 || price > 12000) return false;
        return BASIC_SHOP_ALLOW_PATTERNS.some((pattern) => pattern.test(metaText));
    });

    return Object.fromEntries(stockEntries);
}

function getServicePrice(baseCost, discountRate = 0) {
    const price = Math.floor(baseCost * (1 - Math.max(0, discountRate)));
    return Math.max(1, price);
}

function getEconomyAdjustedPrice(player, basePrice, itemName, mode = "buy", itemData = null) {
    const base = Math.max(1, Math.floor(Number(basePrice || 0)));
    if (!player?.livingWorld?.getAdjustedPrice) return base;
    return Math.max(1, Math.floor(player.livingWorld.getAdjustedPrice(base, itemName, mode, itemData)));
}

function getMarketMultiplierPercent(player, itemName, itemData = null) {
    if (!player?.livingWorld?.getMarketMultiplier) return 100;
    const mult = Number(player.livingWorld.getMarketMultiplier(itemName, itemData) || 1);
    return Math.max(80, Math.min(150, Math.round(mult * 100)));
}

function getTodayStamp(player) {
    const tick = Math.max(0, Math.floor(Number(player?.cityActionTick || 0)));
    if (tick > 0) return `ACT-${tick}`;
    const eco = player?.economyState || {};
    return `${Number(eco.year || 1)}-${Number(eco.month || 1)}-${Number(eco.day || 1)}`;
}

function rollBlackMarketStatus(player) {
    if (!player) return { open: false, location: "" };
    const eco = player.economyState || (player.economyState = {});
    eco.blackMarket = eco.blackMarket || { stamp: "", open: false, location: "깡패 점거 여관/주점" };
    const today = getTodayStamp(player);
    if (eco.blackMarket.stamp === today) return eco.blackMarket;

    eco.blackMarket.stamp = today;
    const openChance = 0.52;
    eco.blackMarket.open = Math.random() < openChance;
    eco.blackMarket.location = eco.blackMarket.open ? "깡패 점거 여관/주점" : "";
    if (eco.blackMarket.open) {
        logMessage("[암시장 소식] 오늘은 비프론 슬럼가에서 암시장이 열린다는 소문이 돌고 있습니다.");
    }
    return eco.blackMarket;
}

function addOperatorCard(grid, player, location, npcs, onUpdated = null) {
    if (!grid || !player) return;
    const operatorName = getLocationOperator(location);
    const affinity = getNpcAffinity(player, operatorName);
    const discount = getDiscountRate(player, operatorName, 0.25);
    const profile = getNpcProfile(operatorName, npcs);
    const dialog = npcs?.[operatorName]?.dialog || `${operatorName}: 환영합니다.`;
    const questState = getNpcQuestState(player, operatorName);
    const tick = Number(player.cityActionTick || 0);
    const cooldown = Math.max(4, 14 - Math.floor(Math.max(0, affinity) / 18));
    const remain = Math.max(0, Number((questState?.lastIssuedTick || -999) + cooldown - tick));
    const questHint = affinity < 10
        ? "의뢰 잠금(호감도 10+ 필요)"
        : (remain > 0 ? `의뢰 대기 ${remain}회` : "의뢰 요청 가능");
    addActionCard(grid, {
        title: `${operatorName}와 대화`,
        desc: `${dialog}\n성향: ${profile.temperament}`,
        meta: `호감도 ${affinity} | 단계 ${getAffinityTier(affinity)} | 할인율 ${Math.floor(discount * 100)}% | 집중 ${profile.focus} | ${questHint}`,
        variant: "buy",
        onClick: () => {
            openNpcDialog(player, location, operatorName, npcs, onUpdated);
        }
    });
}

function returnToCityGridMap(player) {
    if (!player) return;
    const cityData = getCityDataWithRaceHomeland(player);
    if (!cityData[player.position]) {
        player.position = CITY_GRID_DISTRICT;
    }
    player.cb?.updateMenu?.(player);
}

function enableCityDetailLayout(menu) {
    if (!menu) return;
    menu.classList.remove('city-map-menu');
    menu.classList.add('city-detail-menu');
}

function createActionSection(menu, title, desc = "") {
    const section = document.createElement('section');
    section.className = 'city-action-section';

    if (title) {
        const heading = document.createElement('h3');
        heading.className = 'city-action-title';
        heading.textContent = title;
        section.appendChild(heading);
    }

    if (desc) {
        const sub = document.createElement('p');
        sub.className = 'city-action-desc';
        sub.textContent = desc;
        section.appendChild(sub);
    }

    const grid = document.createElement('div');
    grid.className = 'city-action-grid';
    section.appendChild(grid);

    menu.appendChild(section);
    return grid;
}

function addActionCard(grid, { title, desc = "", meta = "", onClick = null, variant = "default", disabled = false, dataAttrs = null, timeCostHours = 2, skipTimeCost = false }) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `city-action-card ${variant}`;
    card.innerHTML = `
        <span class="city-card-title">${title}</span>
        ${desc ? `<span class="city-card-desc">${desc}</span>` : ""}
        ${meta ? `<span class="city-card-meta">${meta}</span>` : ""}
    `;
    card.disabled = Boolean(disabled);
    if (onClick && !disabled) {
        card.onclick = () => {
            const player = ACTIVE_CITY_CONTEXT.player;
            if (player) {
                player.cityActionTick = Math.max(0, Math.floor(Number(player.cityActionTick || 0))) + 1;
            }
            if (!skipTimeCost) {
                advanceCityActionTime(timeCostHours, title || "도시 활동");
            }
            onClick();
        };
    }
    if (dataAttrs && typeof dataAttrs === 'object') {
        Object.entries(dataAttrs).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            card.dataset[key] = String(value);
        });
    }
    grid.appendChild(card);
    return card;
}

function getSafeQueryValue(text) {
    try {
        if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(String(text));
    } catch (_) {}
    return String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function restoreShopViewState(menu, viewState = {}) {
    if (!menu) return;
    const hasTop = Number.isFinite(viewState.scrollTop);
    const hasAnchor = Boolean(viewState.anchorType && viewState.anchorItem);
    if (!hasTop && !hasAnchor) return;

    requestAnimationFrame(() => {
        if (hasTop) menu.scrollTop = Math.max(0, Number(viewState.scrollTop));
        if (!hasAnchor) return;
        const item = getSafeQueryValue(viewState.anchorItem);
        const type = getSafeQueryValue(viewState.anchorType);
        const anchor = menu.querySelector(`.city-action-card[data-shop-type="${type}"][data-shop-item="${item}"]`);
        if (anchor) anchor.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
}

function renderSubGridMenu(menu, backLabel, backHandler, title, desc = "") {
    enableCityDetailLayout(menu);
    menu.innerHTML = '';
    const backBtn = addButton(menu, backLabel, backHandler);
    backBtn.style.borderLeftColor = "var(--color-stamina)";
    const hr = document.createElement('hr');
    hr.style.borderColor = "var(--color-border)";
    menu.appendChild(hr);
    return createActionSection(menu, title, desc);
}

function renderShopGrid(menu, player, location, shopItems, allGameItems, viewState = null) {
    setActiveCityContext(player, location);
    enableCityDetailLayout(menu);
    menu.innerHTML = '';
    const backBtn = addButton(menu, "뒤로 (도시 그리드 맵)", () => returnToCityGridMap(player));
    backBtn.style.borderLeftColor = "var(--color-stamina)";
    const hr = document.createElement('hr');
    hr.style.borderColor = "var(--color-border)";
    menu.appendChild(hr);

    const section = document.createElement('section');
    section.className = 'city-action-section city-shop-section';
    const operatorName = getLocationOperator(location);
    const affinity = getNpcAffinity(player, operatorName);
    const buyDiscount = getDiscountRate(player, operatorName, 0.25);
    const sellBonus = getDiscountRate(player, operatorName, 0.14);
    
    // [Phase 3] 종족 시스템: 상점 접근 제약 체크
    if (player.raceSystem && !player.raceSystem.canAccessShop(location)) {
        const restrictionInfo = player.raceSystem.canAccessShop(location);
        const message = restrictionInfo.message || '이 상점에는 출입할 수 없습니다.';
        section.innerHTML = `
            <h3 class="city-action-title">접근 불가</h3>
            <p class="city-action-desc" style="color: #d32f2f; font-weight: bold;">${message}</p>
        `;
        menu.appendChild(section);
        addButton(menu, "뒤로 (도시 그리드 맵)", () => returnToCityGridMap(player));
        return;
    }
    section.innerHTML = `
        <h3 class="city-action-title">상점가</h3>
        <p class="city-action-desc">운영: ${operatorName} | 호감도 ${affinity} | 구매 할인 ${Math.floor(buyDiscount * 100)}% | 판매 보너스 ${Math.floor(sellBonus * 100)}%</p>
        <p class="city-action-desc">보유 스톤: ${player.gold.toLocaleString()} | 구매/판매를 카드형 목록에서 선택할 수 있습니다.</p>
        <p class="city-action-desc">안내: 이곳에서는 기본 소모품/생존 물자만 판매합니다. 희귀/넘버스 장비는 미궁 균열과 보스 공략으로 획득하세요.</p>
    `;
    menu.appendChild(section);

    const socialGrid = document.createElement('div');
    socialGrid.className = 'city-action-grid';
    section.appendChild(socialGrid);
    addOperatorCard(socialGrid, player, location, player.cb?.gameData?.npcs || {}, () => {
        const keep = { scrollTop: menu.scrollTop };
        renderShopGrid(menu, player, location, shopItems, allGameItems, keep);
    });
    const unidentifiedPool = [
        ...(player.inventory || []),
        ...Object.values(player.equipment || {}).filter(Boolean)
    ].filter((itemName, idx, arr) =>
        arr.indexOf(itemName) === idx &&
        player.isEquipmentItem?.(itemName) &&
        !player.isItemIdentified?.(itemName)
    );
    const appraisalCost = getServicePrice(650, buyDiscount);
    addActionCard(socialGrid, {
        title: "도시 감정소",
        desc: unidentifiedPool.length > 0
            ? `미식별 장비 ${unidentifiedPool.length}개를 감정합니다.`
            : "감정할 미식별 장비가 없습니다.",
        meta: unidentifiedPool.length > 0 ? `${appraisalCost.toLocaleString()} 스톤` : "이용 불가",
        variant: "buy",
        disabled: unidentifiedPool.length === 0,
        onClick: () => {
            if (player.gold < appraisalCost) {
                logMessage("감정 비용이 부족합니다.");
                return;
            }
            player.gold -= appraisalCost;
            const identified = player.identifyRandomUnidentifiedItem?.("도시 감정소");
            if (!identified) {
                logMessage("감정할 장비가 남아있지 않습니다.");
            } else {
                logMessage(`[도시 감정소] ${identified}의 성능이 해독되었습니다.`);
                changeNpcAffinity(player, operatorName, 1, `${location} 감정`);
            }
            player.showStatus?.();
            const keep = { scrollTop: menu.scrollTop };
            renderShopGrid(menu, player, location, shopItems, allGameItems, keep);
        }
    });

    const layout = document.createElement('div');
    layout.className = 'city-shop-layout';
    section.appendChild(layout);

    const buyWrap = document.createElement('div');
    buyWrap.className = 'city-shop-column';
    buyWrap.innerHTML = `<h4 class="city-shop-column-title">구매 목록</h4>`;
    layout.appendChild(buyWrap);

    const buyGrid = document.createElement('div');
    buyGrid.className = 'city-action-grid city-shop-grid';
    buyWrap.appendChild(buyGrid);

    const shopEntryList = Object.entries(shopItems).sort((a, b) => (a[1]?.price || 0) - (b[1]?.price || 0));
    if (shopEntryList.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'city-grid-empty';
        empty.textContent = "판매 가능한 기본 물자가 없습니다.";
        buyWrap.appendChild(empty);
    }

    shopEntryList.forEach(([itemName, shopItem]) => {
            const basePrice = Math.max(1, Number(shopItem?.price || 0));
            
            // [Phase 3] 종족 시스템: 상점 가격 배수 적용
            let racePriceModified = basePrice;
            if (player.raceSystem) {
                racePriceModified = player.raceSystem.getShopPrice(basePrice, location);
            }
            const marketAdjustedPrice = getEconomyAdjustedPrice(player, racePriceModified, itemName, "buy", shopItem);
            const marketPct = getMarketMultiplierPercent(player, itemName, shopItem);
            
            const finalPrice = getServicePrice(marketAdjustedPrice, buyDiscount);
            const isLowInt = isLowIntSpeechMode(player);
            const priceMeta = isLowInt
                ? `${getObscuredPriceLabel(player, itemName, finalPrice)} (정확한 수치 판독 불가)`
                : `${finalPrice.toLocaleString()} 스톤 (기본 ${basePrice.toLocaleString()}, 종족: ${racePriceModified.toLocaleString()}, 시세 ${marketPct}%)`;
            addActionCard(buyGrid, {
                title: itemName,
                desc: shopItem?.desc || "설명 없음",
                meta: priceMeta,
                variant: 'buy',
                dataAttrs: { shopType: 'buy', shopItem: itemName },
                onClick: () => {
                    let price = finalPrice;
                    if (isLowInt && Math.random() < 0.4) {
                        const surchargeRate = 1.1 + (Math.random() * 0.45);
                        const fooledPrice = Math.max(1, Math.floor(finalPrice * surchargeRate));
                        if (fooledPrice > finalPrice) {
                            logMessage(`[숫자 난독증] 가격을 잘못 읽어 ${fooledPrice.toLocaleString()} 스톤을 지불했다.`);
                        }
                        price = fooledPrice;
                    }
                    if (player.gold < price) {
                        logMessage("돈이 부족하다.");
                        return;
                    }
                    player.gold -= price;
                    player.addItem(itemName);
                    logMessage(`${itemName}을(를) 구매했다.`);
                    changeNpcAffinity(player, operatorName, 1, `${location} 구매`);
                    player.showStatus();
                    const keep = { scrollTop: menu.scrollTop, anchorType: 'buy', anchorItem: itemName };
                    renderShopGrid(menu, player, location, shopItems, allGameItems, keep);
                }
            });
        });

    const sellWrap = document.createElement('div');
    sellWrap.className = 'city-shop-column';
    sellWrap.innerHTML = `<h4 class="city-shop-column-title">판매 가능 아이템</h4>`;
    layout.appendChild(sellWrap);

    const sellGrid = document.createElement('div');
    sellGrid.className = 'city-action-grid city-shop-grid';
    sellWrap.appendChild(sellGrid);

    const invCounts = (player.inventory || []).reduce((acc, itemName) => {
        acc[itemName] = (acc[itemName] || 0) + 1;
        return acc;
    }, {});

    const sellable = Object.keys(invCounts).sort((a, b) => a.localeCompare(b, 'ko'));

    if (sellable.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'city-grid-empty';
        empty.textContent = "판매할 아이템이 없습니다.";
        sellWrap.appendChild(empty);
    } else {
        sellable.forEach((itemName) => {
            const count = invCounts[itemName];
            let basePrice = allGameItems[itemName]?.price || allGameItems[itemName]?.tier * 100 || 10;
            
            // [Phase 3] 종족 시스템: 판매가도 종족 배수 적용
            if (player.raceSystem) {
                basePrice = player.raceSystem.getShopPrice(basePrice, location);
            }
            const marketAdjustedPrice = getEconomyAdjustedPrice(player, basePrice, itemName, "sell", allGameItems[itemName]);
            const marketPct = getMarketMultiplierPercent(player, itemName, allGameItems[itemName]);
            
            const sellPrice = Math.max(1, Math.floor((marketAdjustedPrice / 2) * (1 + sellBonus)));
            addActionCard(sellGrid, {
                title: itemName,
                desc: `${count}개 보유`,
                meta: `판매가 ${sellPrice.toLocaleString()} 스톤 (시세 ${marketPct}%)`,
                variant: 'sell',
                dataAttrs: { shopType: 'sell', shopItem: itemName },
                onClick: () => {
                    const idx = player.inventory.indexOf(itemName);
                    if (idx < 0) {
                        logMessage("해당 아이템을 가지고 있지 않다.");
                        return;
                    }
                    player.inventory.splice(idx, 1);
                    player.gold += sellPrice;
                    logMessage(`${itemName}을(를) ${sellPrice.toLocaleString()} 스톤에 판매했다.`);
                    changeNpcAffinity(player, operatorName, 1, `${location} 판매`);
                    player.cb?.playSfx?.('sfx-event');
                    player.showStatus();
                    const keep = { scrollTop: menu.scrollTop, anchorType: 'sell', anchorItem: itemName };
                    renderShopGrid(menu, player, location, shopItems, allGameItems, keep);
                }
            });
        });
    }

    restoreShopViewState(menu, viewState || {});
}

/**
 * 도시 구역 이동 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCityDistricts(player) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    enableCityDetailLayout(menu);
    menu.innerHTML = ''; // 메뉴 초기화
    logMessage("어느 구역으로 이동하시겠습니까?");

    /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
    const cityData = getCityDataWithRaceHomeland(player);
    if (cityData) {
        Object.keys(cityData).forEach(district => {
             if (cityData[district] && cityData[district].desc) {
                 addButton(menu, `${district} - ${cityData[district].desc}`, () => {
                     // 1구역(황도 카르논) 입장 조건 체크
                     if (district.includes("1구역")) {
                         /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
                         if (player.specialStats?.['명성']?.value < 50) { // (임시 명성 50 필요)
                             logMessage("명성이 부족하여 황도 카르논에 입장할 수 없습니다.");
                             return;
                         }
                     }
                     
                     player.position = district; // 플레이어 위치 변경
                     logMessage(`${district}(으)로 이동했다.`);
                     
                     // [확장 계획 3] 퀘스트 진행 체크 (REACH)
                     /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                     player.questManager?.checkProgress('REACH', district, 1);
                     
                     /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                     player.cb?.updateMenu(player); // 메인 메뉴 업데이트
                 });
            }
        });
    }
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    addButton(menu, "뒤로 (도시 그리드 맵)", () => returnToCityGridMap(player));
}

/**
 * 현재 도시 구역의 활동 장소 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCityLocations(player) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    setActiveCityContext(player, player?.position || "");
    enableCityDetailLayout(menu);
    menu.innerHTML = ''; // 메뉴 초기화
    
    if (player.position === RACE_HOMELAND_DISTRICT || player.position === "종족 성소") {
        if (player.position === "종족 성소") {
            player.position = RACE_HOMELAND_DISTRICT;
        }
        logMessage("종족 영지는 종족 서사와 영지 운영을 담당하는 독립 구역입니다.");
        const sanctumGrid = createActionSection(menu, RACE_HOMELAND_DISTRICT, "원하는 시설 카드를 선택하세요.");
        addActionCard(sanctumGrid, {
            title: "종족 성소 의식장",
            desc: "멘토와 대화하고 종족 서사 단계를 진행합니다.",
            meta: "서사 전용 공간",
            variant: "buy",
            onClick: () => handleCityAction(player, "종족 성소")
        });
        addActionCard(sanctumGrid, {
            title: "개인 영지",
            desc: "그리드 배치로 영지를 꾸미고 관리합니다.",
            meta: "영지 운영",
            variant: "buy",
            onClick: () => handleCityAction(player, "개인 영지")
        });
        addActionCard(sanctumGrid, {
            title: "라비기온으로 귀환",
            desc: "라비기온 (7-13구역)으로 돌아갑니다.",
            meta: CITY_GRID_DISTRICT,
            onClick: () => {
                player.position = CITY_GRID_DISTRICT;
                player.cb?.updateMenu?.(player);
            }
        });
        addButton(menu, "뒤로 (도시 그리드 맵)", () => returnToCityGridMap(player));
        return;
    }

    const cityData = getCityDataWithRaceHomeland(player);
    const district = cityData?.[player.position];

    if (district && district.locations) {
        logMessage(`현재 구역 [${player.position}]에서 활동할 장소를 선택하세요.`);
        const grid = createActionSection(menu, `${player.position} 활동 장소`, "원하는 장소 카드를 선택하세요.");
        Object.keys(district.locations).forEach(loc => {
            if (String(loc).includes("종족 성소")) return;
            if (district.locations[loc] && district.locations[loc].desc) {
                addActionCard(grid, {
                    title: loc,
                    desc: district.locations[loc].desc,
                    onClick: () => {
                        logMessage(`${loc}(으)로 이동했다.`);
                        handleCityAction(player, loc);
                    }
                });
            }
        });

        const extraLocations = (typeof player.getHomeDistrictExtraLocations === 'function')
            ? player.getHomeDistrictExtraLocations()
            : [];
        extraLocations.forEach((extra) => {
            if (!extra?.name) return;
            addActionCard(grid, {
                title: extra.name,
                desc: extra.desc || "특수 거점 활동",
                meta: extra.actionType === 'race_story'
                    ? "종족 고유 스토리 진행"
                    : (extra.actionType === 'homestead' ? "개인 영지 관리" : "특수 활동"),
                variant: "buy",
                onClick: () => {
                    handleCityAction(player, extra.name);
                }
            });
        });
    } else {
        logMessage("현재 구역에는 특별한 활동 장소가 없습니다.");
    }
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    addButton(menu, "뒤로 (도시 그리드 맵)", () => returnToCityGridMap(player));
}

/**
 * [대규모 수정] 도시 장소별 행동 처리 (모든 도시 기능 구현)
 * @param {Player} player - 플레이어 객체
 * @param {string} location - 행동을 처리할 장소 이름
 */
export function handleCityAction(player, location) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    setActiveCityContext(player, location);
    rollBlackMarketStatus(player);
    enableCityDetailLayout(menu);
    menu.innerHTML = ''; // 행동 메뉴 초기화

    // [!!!] [버그 수정] "뒤로 가기" 버튼을 가장 먼저 추가합니다.
    // 이렇게 하면 상점가 등에 아이템이 많아도 항상 뒤로가기 버튼이 보입니다.
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    const backBtn = addButton(menu, "뒤로 (도시 그리드 맵)", () => returnToCityGridMap(player));
    backBtn.style.borderLeftColor = "var(--color-stamina)"; // 뒤로가기 버튼 강조

    // [신규] 시각적 구분을 위한 구분선 추가
    const hr = document.createElement('hr');
    hr.style.borderColor = "var(--color-border)";
    menu.appendChild(hr);


    // [신규] 필요한 모든 데이터 미리 불러오기
    /* AUTO-FIX: added guards for this.gameData to avoid TypeError when undefined (Rule 4) */
    const npcs = player.cb.gameData?.npcs || {};
    const shopItems = player.cb.gameData?.items || {}; // [수정] static_content.json의 items 사용
    const magic = player.cb.gameData?.magic || {};
    const operatorName = getLocationOperator(location);
    const operatorDiscount = getDiscountRate(player, operatorName, 0.25);
    const allGameItems = {
        ...(player.cb.gameData?.items || {}), 
        ...(player.cb.gameData?.numbersItems || {}), 
        ...(player.cb.gameData?.shopItems || {}), // (shopItems은 이제 items와 동일)
        ...(player.cb.gameData?.materials || {})
    };
    player.cityContentState = player.cityContentState || {};
    const cityState = player.cityContentState;

    switch(location) {
        case "라비기온 중앙 도서관":
             /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
             player.questManager?.checkProgress('TALK', '도서관 사서 라그나', 1);
             {
                const grid = createActionSection(menu, "라비기온 중앙 도서관", "지식과 기록을 탐색할 수 있습니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "사서와 대화",
                    desc: "도서관 사서 라그나에게 정보를 요청합니다.",
                    meta: "대화 / 정보 탐색",
                    onClick: () => {
                        const librarian = npcs["도서관 사서 라그나"];
                        if (librarian && typeof librarian.action === 'function') {
                            librarian.action(player);
                        } else {
                            logMessage("도서관 사서 라그나: 찾는 책이 있나요? (임시 대화)");
                        }
                    }
                });
                addActionCard(grid, {
                    title: "문헌 조사 (일일)",
                    desc: "자료 조사를 진행해 보상 또는 공적을 획득합니다.",
                    meta: `${getServicePrice(280, operatorDiscount).toLocaleString()} 스톤 | 4시간`,
                    timeCostHours: 4,
                    onClick: () => {
                        const stamp = getTodayStamp(player);
                        if (Number(cityState.libraryResearchStamp || -1) === stamp) {
                            logMessage("오늘은 이미 문헌 조사를 마쳤습니다.");
                            return;
                        }
                        const cost = getServicePrice(280, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("조사 비용이 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        cityState.libraryResearchStamp = stamp;
                        const roll = Math.random();
                        if (roll < 0.45) {
                            const lootPool = ["감정 스크롤", "마력결정체", "해독제", "나침반"];
                            const found = lootPool[Math.floor(Math.random() * lootPool.length)];
                            player.addItem?.(found);
                            logMessage(`[도서관 조사] 희귀 자료를 찾아 ${found}을(를) 확보했습니다.`);
                        } else if (roll < 0.82) {
                            const towerState = ensureMageTowerState(player);
                            towerState.merit = Math.max(0, Number(towerState.merit || 0) + 2);
                            const rankInfo = getMageTowerRankInfo(towerState.merit);
                            towerState.rankName = rankInfo.name;
                            logMessage(`[도서관 조사] 고문헌 분석에 성공해 마탑 공적 +2 (현재 ${towerState.merit}, ${rankInfo.name}).`);
                        } else {
                            const payout = 450 + Math.floor((player.level || 1) * 35);
                            player.gold += payout;
                            logMessage(`[도서관 조사] 외부 연구 의뢰를 완수해 ${payout.toLocaleString()} 스톤을 받았습니다.`);
                        }
                        changeNpcAffinity(player, operatorName, 1, "문헌 조사");
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "고문서 필사",
                    desc: "필사를 누적해 정신력을 단련합니다. (3회마다 정신력 +1)",
                    meta: `${getServicePrice(420, operatorDiscount).toLocaleString()} 스톤 | 6시간`,
                    timeCostHours: 6,
                    onClick: () => {
                        const cost = getServicePrice(420, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("필사 비용이 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        cityState.libraryCopyCount = Math.max(0, Number(cityState.libraryCopyCount || 0) + 1);
                        const copyCount = Number(cityState.libraryCopyCount || 0);
                        let resultText = `필사 누적 ${copyCount}회`;
                        if ((copyCount % 3) === 0) {
                            player.stats = player.stats || {};
                            player.stats["정신력"] = Math.max(0, Number(player.stats["정신력"] || 0) + 1);
                            player.calculateStats?.();
                            resultText = `${resultText} 달성으로 정신력 +1`;
                        }
                        if (Math.random() < 0.35) player.addItem?.("감정 스크롤");
                        changeNpcAffinity(player, operatorName, 1, "고문서 필사");
                        logMessage(`[도서관] ${resultText}.`);
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
             }
            break;

        case "환전소":
            {
                const grid = createActionSection(menu, "환전소", "마석을 스톤으로 환전합니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "마석 전량 환전",
                    desc: "현재 보유한 마석을 전부 스톤으로 교환합니다.",
                    meta: `보유 마석 ${player.magic_stones.toLocaleString()}개`,
                    variant: "buy",
                    onClick: () => {
                        if(player.magic_stones > 0) {
                            const exchangeRate = getEconomyAdjustedPrice(player, 20, "마석", "sell");
                            const earnedStones = player.magic_stones * exchangeRate;
                            player.gold += earnedStones;
                            logMessage(`마석 ${player.magic_stones.toLocaleString()}개를 ${earnedStones.toLocaleString()} 스톤으로 교환했다. (시세 배율 ${getMarketMultiplierPercent(player, "마석")}%)`);
                            player.magic_stones = 0;
                            changeNpcAffinity(player, operatorName, 1, "환전 거래");
                            player.cb?.playSfx?.('sfx-event');
                        } else {
                            logMessage("교환할 마석이 없다.");
                        }
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "마석 수량 환전",
                    desc: "원하는 수량만 선택해 환전합니다.",
                    meta: "수동 수량 선택",
                    variant: "buy",
                    onClick: () => {
                        const stock = Math.max(0, Number(player.magic_stones || 0));
                        if (stock <= 0) {
                            logMessage("교환할 마석이 없다.");
                            return;
                        }
                        const qtyInput = prompt(`환전할 마석 수량을 입력하세요. (보유 ${stock.toLocaleString()}개)`);
                        const qty = Math.floor(Number(qtyInput));
                        if (!Number.isFinite(qty) || qty <= 0) {
                            logMessage("유효한 수량을 입력해야 합니다.");
                            return;
                        }
                        if (qty > stock) {
                            logMessage("보유 마석보다 많은 수량입니다.");
                            return;
                        }
                        const exchangeRate = getEconomyAdjustedPrice(player, 20, "마석", "sell");
                        const earnedStones = qty * exchangeRate;
                        player.magic_stones = stock - qty;
                        player.gold += earnedStones;
                        changeNpcAffinity(player, operatorName, 1, "수량 환전");
                        logMessage(`마석 ${qty.toLocaleString()}개를 ${earnedStones.toLocaleString()} 스톤으로 교환했습니다. (시세 ${getMarketMultiplierPercent(player, "마석")}%)`);
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "환율 투기 계약 (일일)",
                    desc: "보증금을 걸고 당일 환율 변동에 베팅합니다.",
                    meta: `보증금 ${getServicePrice(300, operatorDiscount).toLocaleString()} 스톤`,
                    variant: "sell",
                    onClick: () => {
                        const stamp = getTodayStamp(player);
                        if (Number(cityState.exchangeSpecStamp || -1) === stamp) {
                            logMessage("오늘은 이미 환율 투기 계약을 진행했습니다.");
                            return;
                        }
                        const deposit = getServicePrice(300, operatorDiscount);
                        if (player.gold < deposit) {
                            logMessage("보증금이 부족합니다.");
                            return;
                        }
                        player.gold -= deposit;
                        cityState.exchangeSpecStamp = stamp;
                        const roll = Math.random();
                        if (roll < 0.57) {
                            const payout = deposit + 180 + Math.floor(Math.random() * 420);
                            player.gold += payout;
                            logMessage(`[환전소] 환율 투기 성공! 정산 ${payout.toLocaleString()} 스톤을 수령했습니다.`);
                            changeNpcAffinity(player, operatorName, 1, "환율 투기 성공");
                        } else {
                            logMessage("[환전소] 환율이 반대로 움직여 보증금을 전액 손실했습니다.");
                            changeNpcAffinity(player, operatorName, -1, "환율 투기 실패");
                        }
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "탐험가 길드 지부":
             /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
             player.questManager?.checkProgress('TALK', '탐험가 길드 접수원', 1);
             const guildReceptionist = npcs["탐험가 길드 접수원"];
             logMessage(guildReceptionist ? guildReceptionist.dialog : "무엇을 도와드릴까요?");
            {
                const grid = createActionSection(menu, "탐험가 길드 지부", "길드 업무를 카드에서 선택하세요.");
                addOperatorCard(grid, player, location, npcs);
                const recruitRepGrade = typeof player.getRecruitmentReputationGrade === 'function'
                    ? player.getRecruitmentReputationGrade()
                    : "normal";
                const canRecruitElite = typeof player.canRecruitEliteCompanion === 'function'
                    ? player.canRecruitEliteCompanion()
                    : true;

                if (recruitRepGrade === "excellent") {
                    addActionCard(grid, {
                        title: "우수 평판 선입금",
                        desc: "길드가 신뢰 등급을 반영해 선입금 의뢰비를 지급합니다.",
                        meta: "하루 1회",
                        variant: "buy",
                        onClick: () => {
                            const stamp = getTodayStamp(player);
                            player.economyState = player.economyState || {};
                            if (player.economyState.guildAdvanceStamp === stamp) {
                                logMessage("오늘은 이미 선입금을 수령했습니다.");
                                return;
                            }
                            const prepay = 450 + Math.floor((player.level || 1) * 55);
                            player.economyState.guildAdvanceStamp = stamp;
                            player.gold += prepay;
                            logMessage(`[길드] 신뢰 등급 보너스 선입금 ${prepay.toLocaleString()} 스톤을 받았습니다.`);
                            player.showStatus?.();
                            handleCityAction(player, location);
                        }
                    });
                } else if (recruitRepGrade === "poor" || recruitRepGrade === "blacklist") {
                    logMessage("[길드 안내] 악명 때문에 고등급 용병이 지원을 꺼립니다. 초보/문제 인력 위주로만 모집됩니다.");
                }

                addActionCard(grid, {
                    title: "파티원 모집",
                    desc: "등급별 동료를 고용해 파티를 보강합니다.",
                    onClick: () => {
                        logMessage("어떤 등급의 동료를 모집하시겠습니까? (비용이 발생합니다)");
                        const recruitGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (길드 메뉴)",
                            () => handleCityAction(player, location),
                            "동료 모집",
                            "등급이 높을수록 비용이 증가합니다."
                        );
                        const traits = ["전사", "탐색꾼", "인도자", "항해사", "신관", "마법사"];
                        const shadyTraits = ["전사", "탐색꾼"];
                        for (let i = 9; i >= 3; i--) {
                            const baseCost = (10 - i) * 1000 * (1 + (9 - i) * 0.5);
                            const repCostMult = recruitRepGrade === "excellent"
                                ? 0.9
                                : (recruitRepGrade === "poor" ? 1.2 : (recruitRepGrade === "blacklist" ? 1.35 : 1));
                            const cost = Math.max(100, Math.floor(baseCost * repCostMult));
                            const eliteBlocked = (recruitRepGrade === "blacklist" && i <= 6)
                                || (!canRecruitElite && i <= 5);
                            addActionCard(recruitGrid, {
                                title: `${i}등급 동료`,
                                desc: eliteBlocked
                                    ? "현재 평판으로는 해당 등급 용병이 지원하지 않습니다."
                                    : "무작위 성향의 동료를 모집합니다.",
                                meta: eliteBlocked
                                    ? "모집 거절"
                                    : `${cost.toLocaleString()} 스톤${recruitRepGrade === "excellent" ? " (신뢰 할인)" : ""}`,
                                disabled: eliteBlocked,
                                onClick: () => {
                                    if (player.gold < cost) {
                                        logMessage("돈이 부족합니다.");
                                        return;
                                    }
                                    if (player.party.length >= 4) {
                                        logMessage("파티원이 가득 찼습니다. (최대 4명)");
                                        return;
                                    }
                                    if (player.cb?.NPCClass) {
                                        player.gold -= cost;
                                        const traitPool = (recruitRepGrade === "poor" || recruitRepGrade === "blacklist")
                                            ? shadyTraits
                                            : traits;
                                        const randomTrait = traitPool[Math.floor(Math.random() * traitPool.length)];
                                        const prefix = (recruitRepGrade === "poor" || recruitRepGrade === "blacklist")
                                            ? (Math.random() < 0.5 ? "초보" : "요주의")
                                            : "동료용병";
                                        const newCompanion = new player.cb.NPCClass(`${prefix}-${player.party.length + 1}`, "Human", i, player.cb, randomTrait);
                                        player.party.push(newCompanion);
                                        player.registerCompanion?.(newCompanion, "길드 모집");
                                        if (recruitRepGrade === "poor" || recruitRepGrade === "blacklist") {
                                            player.changeCompanionLoyalty?.(newCompanion, -18, "악명 영향");
                                        }
                                        logMessage(`${newCompanion.name}(${i}등급/${newCompanion.trait})와 파티 결속을 맺었다.`);
                                        player.cb?.playSfx?.('sfx-event');
                                        player.showStatus();
                                        handleCityAction(player, location);
                                    } else {
                                        logMessage("오류: NPC 생성자를 찾을 수 없어 동료를 모집할 수 없습니다.");
                                    }
                                }
                            });
                        }
                    }
                });

                addActionCard(grid, {
                    title: "의뢰 확인",
                    desc: "수락 가능한 길드 퀘스트를 확인합니다.",
                    onClick: () => {
                        const questGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (길드 메뉴)",
                            () => handleCityAction(player, location),
                            "길드 의뢰",
                            "수락 가능한 퀘스트 목록입니다."
                        );
                        logMessage("수락 가능한 의뢰 목록:");
                        let foundQuest = false;
                        const quests = player.cb.gameData?.quests || {};
                        for (const questId in quests) {
                            const quest = quests[questId];
                            if (quest.type === "GUILD" &&
                                !player.questManager.completedQuests.includes(questId) &&
                                !player.questManager.activeQuests.some(q => q.id === questId) &&
                                player.level >= (quest.startCondition?.level || 1))
                            {
                                foundQuest = true;
                                addActionCard(questGrid, {
                                    title: quest.title,
                                    desc: quest.description,
                                    meta: `시작 레벨 ${quest.startCondition?.level || 1}+`,
                                    onClick: () => {
                                        player.questManager.acceptQuest(questId);
                                        handleCityAction(player, location);
                                    }
                                });
                            }
                        }
                        if (!foundQuest) {
                            addActionCard(questGrid, {
                                title: "수락 가능한 의뢰 없음",
                                desc: "현재 조건에 맞는 길드 의뢰가 없습니다.",
                                disabled: true
                            });
                        }
                    }
                });
                addActionCard(grid, {
                    title: "일일 파견 의뢰",
                    desc: "길드 단기 계약을 수행합니다. 실패 시 부상 위험이 있습니다.",
                    meta: "8시간 / 하루 1회",
                    timeCostHours: 8,
                    onClick: () => {
                        const stamp = getTodayStamp(player);
                        if (Number(cityState.guildDispatchStamp || -1) === stamp) {
                            logMessage("오늘의 파견 의뢰는 이미 완료했습니다.");
                            return;
                        }
                        cityState.guildDispatchStamp = stamp;
                        const level = Math.max(1, Number(player.level || 1));
                        const partyCount = Array.isArray(player.party) ? player.party.length : 0;
                        const successChance = Math.min(0.92, 0.64 + (partyCount * 0.04) + (Math.min(20, level) * 0.01));
                        if (Math.random() < successChance) {
                            const reward = 800 + (level * 95) + Math.floor(Math.random() * 420);
                            player.gold += reward;
                            if (Math.random() < 0.42) {
                                const rewardItemPool = ["포션", "건조 식량", "마력결정체", "붕대"];
                                const rewardItem = rewardItemPool[Math.floor(Math.random() * rewardItemPool.length)];
                                player.addItem?.(rewardItem);
                                logMessage(`[길드 파견] 계약 성공. ${reward.toLocaleString()} 스톤과 ${rewardItem}을 획득했습니다.`);
                            } else {
                                logMessage(`[길드 파견] 계약 성공. ${reward.toLocaleString()} 스톤을 획득했습니다.`);
                            }
                            changeNpcAffinity(player, operatorName, 2, "길드 파견 성공");
                        } else {
                            const maxHp = Math.max(1, Number(player.maxHp || 1));
                            const hpLoss = Math.max(1, Math.floor(maxHp * 0.12));
                            player.hp = Math.max(1, Number(player.hp || maxHp) - hpLoss);
                            if (player.resources?.hp && !player.resources.hp.locked) {
                                player.resources.hp.current = player.hp;
                            }
                            player.fatigue = Math.max(0, Number(player.fatigue || 0) + 12);
                            logMessage(`[길드 파견] 계약 실패. 교전으로 HP -${hpLoss}, 피로 +12.`);
                            changeNpcAffinity(player, operatorName, -1, "길드 파견 실패");
                        }
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });

                addActionCard(grid, {
                    title: "파티 결속 (24시간)",
                    desc: "파티원과의 유대를 강화합니다.",
                    onClick: () => {
                        logMessage("[결속] 마법으로 파티원들과의 유대가 24시간 동안 강화되었습니다.");
                    }
                });
            }
            break;

        case "주점":
            logMessage(npcs["주점 주인"] ? npcs["주점 주인"].dialog : "시원한 맥주 한 잔 어때?");
            {
                const grid = createActionSection(menu, "주점", "탐험가들과 정보를 교환할 수 있습니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "탐험가와 대화",
                    desc: "랜덤 정보나 팁을 얻습니다.",
                    onClick: () => {
                        const tips = Array.isArray(player.cb.gameData?.companionDialogues) ? player.cb.gameData.companionDialogues : ["정보가 없습니다."];
                        const randomTip = tips[Math.floor(Math.random() * tips.length)];
                        const marketRumor = player.livingWorld?.getTavernRumor?.();
                        if (marketRumor && Math.random() < 0.72) {
                            logMessage(`옆 테이블 탐험가: "${marketRumor}"`);
                        } else {
                            logMessage(`옆 테이블 탐험가: "${randomTip}"`);
                        }
                    }
                });
                addActionCard(grid, {
                    title: "주사위 내기",
                    desc: "판돈을 걸고 2d6 승부를 합니다.",
                    meta: "최소 50 스톤",
                    onClick: () => {
                        const minBet = 50;
                        if (player.gold < minBet) {
                            logMessage("판돈이 부족합니다.");
                            return;
                        }
                        const maxBet = Math.min(Math.max(minBet, Number(player.gold || 0)), 5000);
                        const betInput = prompt(`판돈을 입력하세요. (${minBet}~${maxBet.toLocaleString()} 스톤)`);
                        const bet = Math.floor(Number(betInput));
                        if (!Number.isFinite(bet) || bet < minBet || bet > maxBet) {
                            logMessage("유효한 판돈이 아닙니다.");
                            return;
                        }
                        player.gold -= bet;
                        const playerRoll = (1 + Math.floor(Math.random() * 6)) + (1 + Math.floor(Math.random() * 6));
                        const houseRoll = (1 + Math.floor(Math.random() * 6)) + (1 + Math.floor(Math.random() * 6));
                        if (playerRoll >= houseRoll) {
                            const reward = Math.floor(bet * 1.9);
                            player.gold += reward;
                            logMessage(`[주사위] 승리! (${playerRoll} vs ${houseRoll}) 정산 ${reward.toLocaleString()} 스톤`);
                            changeNpcAffinity(player, operatorName, 1, "주점 승부 승리");
                        } else {
                            logMessage(`[주사위] 패배... (${playerRoll} vs ${houseRoll}) 판돈 ${bet.toLocaleString()} 스톤 손실`);
                            changeNpcAffinity(player, operatorName, -1, "주점 승부 패배");
                        }
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "공연 감상",
                    desc: "현지 밴드 공연을 보며 피로를 해소합니다.",
                    meta: `${getServicePrice(180, operatorDiscount).toLocaleString()} 스톤 | 3시간`,
                    timeCostHours: 3,
                    onClick: () => {
                        const cost = getServicePrice(180, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("공연 관람비가 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        const maxStamina = Math.max(0, Number(player.maxStamina || player.stamina || 0));
                        player.stamina = Math.min(maxStamina, Number(player.stamina || 0) + 30);
                        player.fatigue = Math.max(0, Number(player.fatigue || 0) - 18);
                        cityState.tavernShowCount = Math.max(0, Number(cityState.tavernShowCount || 0) + 1);
                        logMessage(`[주점 공연] 긴장을 풀고 휴식했습니다. (기력 +30, 피로 -18)`);
                        changeNpcAffinity(player, operatorName, 1, "공연 감상");
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "정보 중개인 접선 (일일)",
                    desc: "미궁/균열 관련 밀정보를 구매합니다.",
                    meta: `${getServicePrice(420, operatorDiscount).toLocaleString()} 스톤`,
                    onClick: () => {
                        const stamp = getTodayStamp(player);
                        if (Number(cityState.tavernBrokerStamp || -1) === stamp) {
                            logMessage("오늘은 이미 정보 중개인과 접선했습니다.");
                            return;
                        }
                        const fee = getServicePrice(420, operatorDiscount);
                        if (player.gold < fee) {
                            logMessage("정보 수수료가 부족합니다.");
                            return;
                        }
                        player.gold -= fee;
                        cityState.tavernBrokerStamp = stamp;
                        const worldRumor = player.livingWorld?.getTavernRumor?.();
                        const rumorPool = [
                            "1층 북서 광맥 지대에서 희귀 광물 채집 빈도가 상승했다.",
                            "균열 수호자는 연속 제압기보다 상태 이상 누적에 취약하다.",
                            "최근 미궁 2층에서 팀 단위 모험가와 교전 보고가 증가했다.",
                            "마탑 의뢰 완료 이력이 높을수록 고급 마법 해금 속도가 빨라진다."
                        ];
                        const rumor = (worldRumor && Math.random() < 0.55)
                            ? worldRumor
                            : rumorPool[Math.floor(Math.random() * rumorPool.length)];
                        logMessage(`[정보 중개인] ${rumor}`);
                        if (Math.random() < 0.28) {
                            player.addItem?.("나침반");
                            logMessage("[정보 중개인] 보너스 현장 지도 덕분에 나침반을 1개 받았습니다.");
                        }
                        changeNpcAffinity(player, operatorName, 1, "정보 거래");
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "상점가":
            logMessage(npcs["상점 주인"] ? npcs["상점 주인"].dialog : "어서 오세요!");
            {
                const basicShopStock = buildBasicShopStock(shopItems, allGameItems);
                renderShopGrid(menu, player, location, basicShopStock, allGameItems);
            }
            break;

        case "대신전 (삼신교)":
            player.questManager?.checkProgress('TALK', '교단 신관', 1);
            logMessage(npcs["교단 신관"] ? npcs["교단 신관"].dialog : "신의 은총이 함께하길...");
            {
                const grid = createActionSection(menu, "대신전 (삼신교)", "정수 삭제를 진행할 수 있습니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "부상 진단",
                    desc: "현재 신체 부위별 부상 상태를 확인합니다.",
                    onClick: () => {
                        const state = player.ensureInjuryState?.() || player.injuryState || {};
                        const labelMap = { leg: "다리", arm: "팔", head: "머리", torso: "흉부" };
                        const active = ["leg", "arm", "head", "torso"]
                            .filter((part) => Boolean(state?.[part]))
                            .map((part) => `${labelMap[part]}(${state[part]?.severity || "경상"})`);
                        if (active.length === 0) {
                            logMessage("[대신전] 현재 치료가 필요한 부상이 없습니다.");
                        } else {
                            logMessage(`[대신전] 활성 부상: ${active.join(", ")} | 흉터 ${Number(state?.scarCount || 0)}개`);
                        }
                    }
                });
                addActionCard(grid, {
                    title: "부상 치료",
                    desc: "모든 부상을 치료합니다. 흉터는 남습니다.",
                    meta: `${getServicePrice(1200, operatorDiscount).toLocaleString()} 스톤`,
                    onClick: () => {
                        const state = player.ensureInjuryState?.() || player.injuryState || {};
                        const activeCount = ["leg", "arm", "head", "torso"].filter((part) => Boolean(state?.[part])).length;
                        if (activeCount <= 0) {
                            logMessage("치료할 부상이 없습니다.");
                            return;
                        }
                        const cost = getServicePrice(1200 + (activeCount * 180), operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("치료 비용이 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        const cleared = player.clearAllInjuries?.("대신전 치료") || 0;
                        if (cleared > 0) {
                            logMessage(`[대신전] 부상 ${cleared}건을 치료했습니다. 흉터는 남아 위압감에 영향을 줍니다.`);
                            changeNpcAffinity(player, operatorName, 1, "부상 치료");
                            player.calculateStats?.();
                            player.showStatus?.();
                            handleCityAction(player, location);
                        }
                    }
                });
                addActionCard(grid, {
                    title: "저주 장비 정화",
                    desc: "장착 해제 불가 저주 장비 1개를 정화합니다.",
                    meta: `${getServicePrice(1400, operatorDiscount).toLocaleString()} 스톤`,
                    onClick: () => {
                        const cursedSlots = Object.keys(player.itemIdentity?.cursedSlots || {});
                        if (cursedSlots.length === 0) {
                            logMessage("정화할 저주 장비가 없습니다.");
                            return;
                        }
                        const cost = getServicePrice(1400, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("정화 비용이 부족합니다.");
                            return;
                        }
                        const slot = cursedSlots[0];
                        player.gold -= cost;
                        const ok = player.clearCursedBinding?.(slot, "대신전 정화");
                        if (ok) {
                            changeNpcAffinity(player, operatorName, 1, "저주 정화");
                            player.calculateStats?.();
                            player.showStatus?.();
                            handleCityAction(player, location);
                        }
                    }
                });
                if(player.essences.length > 0) {
                    logMessage("삭제할 정수를 선택하세요. 삭제 비용은 5,000,000 스톤입니다.");
                    player.essences.forEach((essenceKey, index) => {
                        const cost = 5000000;
                        addActionCard(grid, {
                            title: `${essenceKey} 정수`,
                            desc: "정수 삭제",
                            meta: `${cost.toLocaleString()} 스톤`,
                            variant: 'sell',
                            onClick: () => {
                                if (player.gold < cost) {
                                    logMessage("정수 삭제 비용이 부족합니다.");
                                    return;
                                }
                            if (confirm(`정말로 [${essenceKey}] 정수를 삭제하시겠습니까?`)) {
                                player.gold -= cost;
                                changeNpcAffinity(player, operatorName, 1, "정수 정화 의뢰");
                                const removed = player.essences.splice(index, 1)[0];
                                logMessage(`신관의 도움으로 [${removed}] 정수의 흔적을 지웠다.`);

                                    player.essence_skills = player.essence_skills.filter(skillName => {
                                        let skillExistsInOtherEssences = false;
                                        for(const essKey of player.essences) {
                                            const ess = player.cb.gameData?.essences?.[essKey];
                                            if (ess && ess.active) {
                                                const skills = Array.isArray(ess.active) ? ess.active : [ess.active];
                                                if (skills.some(s => s.name === skillName)) {
                                                    skillExistsInOtherEssences = true;
                                                    break;
                                                }
                                            }
                                        }
                                        return skillExistsInOtherEssences;
                                    });

                                    player.cb?.playSfx?.('sfx-event');
                                    player.calculateStats();
                                    player.showStatus();
                                    handleCityAction(player, location);
                                }
                            }
                        });
                    });
                } else {
                    addActionCard(grid, {
                        title: "삭제할 정수 없음",
                        desc: "현재 보유 중인 정수가 없습니다.",
                        disabled: true
                    });
                }
            }
            break;

        case "대장간":
            player.questManager?.checkProgress('TALK', '대장장이', 1);
            logMessage(npcs["대장장이"] ? npcs["대장장이"].dialog : "뭘 도와줄까?");
            {
                const grid = createActionSection(menu, "대장간", "장비 수리/제작/강화를 진행합니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "장비 수리",
                    desc: "모든 장비를 수리합니다.",
                    meta: `${getServicePrice(100, operatorDiscount).toLocaleString()} 스톤 (기본 100)`,
                    onClick: () => {
                        const cost = getServicePrice(100, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("수리비가 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        changeNpcAffinity(player, operatorName, 1, "장비 수리");
                        logMessage("모든 장비가 완벽하게 수리되었습니다.");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "아이템 제작",
                    desc: "재료를 이용해 아이템을 제작합니다.",
                    onClick: () => {
                        const craftGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (대장간)",
                            () => handleCityAction(player, location),
                            "대장간 제작",
                            "재료와 수수료를 지불해 즉시 제작합니다."
                        );
                        const recipes = [
                            {
                                title: "포션 x1",
                                output: "포션",
                                count: 1,
                                cost: getServicePrice(220, operatorDiscount),
                                inputs: [{ name: "붕대", count: 1 }, { name: "마력결정체", count: 1 }]
                            },
                            {
                                title: "해독제 x1",
                                output: "해독제",
                                count: 1,
                                cost: getServicePrice(260, operatorDiscount),
                                inputs: [{ name: "포션", count: 1 }]
                            },
                            {
                                title: "모닥불 키트 x1",
                                output: "모닥불 키트",
                                count: 1,
                                cost: getServicePrice(450, operatorDiscount),
                                inputs: [{ name: "횃불", count: 2 }, { name: "건조 식량", count: 1 }]
                            },
                            {
                                title: "횃불 x2",
                                output: "횃불",
                                count: 2,
                                cost: getServicePrice(140, operatorDiscount),
                                inputs: [{ name: "건조 식량", count: 1 }, { name: "붕대", count: 1 }]
                            }
                        ];
                        recipes.forEach((recipe) => {
                            const ingredientText = recipe.inputs.map((input) => `${input.name} ${countInventoryItem(player, input.name)}/${input.count}`).join(" | ");
                            addActionCard(craftGrid, {
                                title: recipe.title,
                                desc: `제작 결과: ${recipe.output} ${recipe.count}개`,
                                meta: `${ingredientText} | 비용 ${recipe.cost.toLocaleString()} 스톤`,
                                onClick: () => {
                                    if (player.gold < recipe.cost) {
                                        logMessage("제작 비용이 부족합니다.");
                                        return;
                                    }
                                    const canCraft = recipe.inputs.every((input) => countInventoryItem(player, input.name) >= input.count);
                                    if (!canCraft) {
                                        logMessage("재료가 부족합니다.");
                                        return;
                                    }
                                    recipe.inputs.forEach((input) => removeInventoryItems(player, input.name, input.count));
                                    player.gold -= recipe.cost;
                                    for (let i = 0; i < recipe.count; i++) {
                                        player.addItem(recipe.output);
                                    }
                                    changeNpcAffinity(player, operatorName, 1, "대장간 제작");
                                    logMessage(`[대장간 제작] ${recipe.output} ${recipe.count}개를 완성했습니다.`);
                                    player.showStatus?.();
                                    handleCityAction(player, location);
                                }
                            });
                        });
                    }
                });
                addActionCard(grid, {
                    title: "장비 강화",
                    desc: "장비 성능을 강화합니다.",
                    onClick: () => {
                        const enhanceGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (대장간)",
                            () => handleCityAction(player, location),
                            "장비 강화",
                            "강화 수치가 높아질수록 비용이 증가하고 실패 위험이 커집니다."
                        );
                        const equippedEntries = Object.entries(player.equipment || {}).filter(([, itemName]) => Boolean(itemName));
                        if (equippedEntries.length === 0) {
                            addActionCard(enhanceGrid, {
                                title: "강화할 장비 없음",
                                desc: "먼저 장비를 착용해야 합니다.",
                                disabled: true
                            });
                            return;
                        }
                        player.enhancementLevels = player.enhancementLevels || {};
                        equippedEntries.forEach(([slot, itemName]) => {
                            const currentLevel = Math.max(0, Number(player.enhancementLevels[itemName] || 0));
                            const nextLevel = currentLevel + 1;
                            const cost = getServicePrice(900 + (nextLevel * nextLevel * 450), operatorDiscount);
                            const successChance = Math.max(0.35, 0.92 - (currentLevel * 0.12));
                            const bonusPct = Math.round(nextLevel * 8);
                            addActionCard(enhanceGrid, {
                                title: `${itemName} (+${currentLevel})`,
                                desc: `${slot} 강화 시도 -> +${nextLevel}`,
                                meta: `비용 ${cost.toLocaleString()} | 성공률 ${Math.round(successChance * 100)}% | 누적 보너스 +${bonusPct}%`,
                                onClick: () => {
                                    if (player.gold < cost) {
                                        logMessage("강화 비용이 부족합니다.");
                                        return;
                                    }
                                    player.gold -= cost;
                                    if (Math.random() < successChance) {
                                        player.enhancementLevels[itemName] = nextLevel;
                                        logMessage(`[강화 성공] ${itemName}이(가) +${nextLevel} 단계에 도달했습니다.`);
                                    } else if (currentLevel > 0 && Math.random() < 0.42) {
                                        player.enhancementLevels[itemName] = currentLevel - 1;
                                        logMessage(`[강화 실패] ${itemName} 강화 수치가 +${currentLevel - 1}(으)로 하락했습니다.`);
                                    } else {
                                        logMessage(`[강화 실패] ${itemName} 강화 수치가 유지되었습니다.`);
                                    }
                                    changeNpcAffinity(player, operatorName, 1, "장비 강화");
                                    player.calculateStats?.();
                                    player.showStatus?.();
                                    handleCityAction(player, location);
                                }
                            });
                        });
                    }
                });
            }
            break;

        case "여관":
            player.questManager?.checkProgress('TALK', '여관 주인', 1);
            {
                const innCost = getServicePrice(200, operatorDiscount);
                logMessage(npcs["여관 주인"] ? npcs["여관 주인"].dialog : `하룻밤에 ${innCost} 스톤입니다.`);
                const grid = createActionSection(menu, "여관", "휴식을 통해 체력과 마력을 회복합니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "하룻밤 숙박",
                    desc: "HP/MP/기력 완전 회복",
                    meta: `${innCost.toLocaleString()} 스톤`,
                    timeCostHours: 24,
                    onClick: () => {
                        if(player.gold < innCost) {
                            logMessage("돈이 부족하여 여관에 묵을 수 없다.");
                            return;
                        }
                        player.setLodgingTier?.("standard");
                        const recoveryRate = applyRestRecoveryByLodging(player, "standard");
                        player.gold -= innCost;
                        changeNpcAffinity(player, operatorName, 1, "숙박 이용");
                        if (recoveryRate >= 1) {
                            logMessage(`여관에서 하루 묵으며 컨디션을 회복했다. (${innCost} 스톤 지불)`);
                        } else {
                            logMessage(`체납 여파로 숙소 상태가 나빠져 회복률이 ${Math.floor(recoveryRate * 100)}%로 제한됩니다.`);
                        }
                        player.cb?.playSfx?.('sfx-event');
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;
            
        case "마탑":
            player.questManager?.checkProgress('TALK', '마탑 마법사', 1); // (임의의 NPC 이름)
            {
                const towerState = ensureMageTowerState(player);
                const rankInfo = getMageTowerRankInfo(towerState?.merit || 0);
                logMessage(`마탑에 들어왔습니다. 현재 공적 ${Number(towerState?.merit || 0)} | 등급: ${rankInfo.name} (학습 가능 ${rankInfo.maxLearnableGrade}등급 이하)`);
            }
            {
                const grid = createActionSection(menu, "마탑", "지식을 탐구하거나 마법을 배울 수 있습니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "공적 현황",
                    desc: "현재 마탑 공적과 학습 해금 등급을 확인합니다.",
                    onClick: () => {
                        const towerState = ensureMageTowerState(player);
                        const merit = Number(towerState?.merit || 0);
                        const rankInfo = getMageTowerRankInfo(merit);
                        const nextRank = MAGE_TOWER_RANKS.find((rank) =>
                            rank.maxLearnableGrade < rankInfo.maxLearnableGrade &&
                            rank.meritRequired > merit
                        );
                        logMessage(`[마탑 공적] ${merit} | 현재 등급: ${rankInfo.name} | 학습 가능: ${rankInfo.maxLearnableGrade}등급 이상`);
                        if (nextRank) {
                            const needed = Math.max(0, Number(nextRank.meritRequired || 0) - merit);
                            logMessage(`[마탑 공적] 다음 등급 '${nextRank.name}'까지 공적 ${needed} 필요.`);
                        } else {
                            logMessage("[마탑 공적] 최상위 연구 등급에 도달했습니다.");
                        }
                    }
                });
                addActionCard(grid, {
                    title: "마탑 의뢰 게시판",
                    desc: "퀘스트를 완료해 공적을 올리고 고급 마법 해금을 진행합니다.",
                    onClick: () => {
                        const questGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (마탑 메뉴)",
                            () => handleCityAction(player, location),
                            "마탑 의뢰 게시판",
                            "각 의뢰는 하루 1회 완료할 수 있으며, 공적을 지급합니다."
                        );

                        const dayStamp = getWorldDayStamp(player);
                        MAGE_TOWER_QUESTS.forEach((quest) => {
                            const runtime = getMageTowerQuestRuntime(player, quest.id);
                            const progress = getMageTowerQuestProgress(player, quest, runtime);
                            const completedToday = Number(runtime?.lastCompletedDay || -1) === dayStamp;
                            addActionCard(questGrid, {
                                title: quest.title,
                                desc: `${quest.desc}`,
                                meta: `${progress.label} | 공적 +${quest.merit}${completedToday ? " | 오늘 완료됨" : ""}`,
                                disabled: completedToday,
                                onClick: () => {
                                    if (completedToday) {
                                        logMessage("이 의뢰는 오늘 이미 완료했습니다.");
                                        return;
                                    }
                                    const result = completeMageTowerQuest(player, quest, runtime);
                                    logMessage(result.message);
                                    if (result.ok) {
                                        changeNpcAffinity(player, operatorName, 1, "마탑 의뢰 완료");
                                        player.cb?.playSfx?.('sfx-event');
                                        player.showStatus?.();
                                        handleCityAction(player, location);
                                    }
                                }
                            });
                        });
                    }
                });
                addActionCard(grid, {
                    title: "마법 배우기",
                    desc: "공적 등급에 맞는 마법만 학습할 수 있습니다.",
                    onClick: () => {
                        const spellGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (마탑 메뉴)",
                            () => handleCityAction(player, location),
                            "습득 가능한 마법",
                            "공적 등급 조건을 충족한 마법만 카드가 활성화됩니다."
                        );

                        const towerState = ensureMageTowerState(player);
                        const merit = Number(towerState?.merit || 0);
                        const rankInfo = getMageTowerRankInfo(merit);
                        logMessage(`[마탑 학습] 현재 공적 ${merit}, 등급 ${rankInfo.name}, 학습 가능 ${rankInfo.maxLearnableGrade}등급 이하`);
                        let foundSpell = false;
                        let lockedSpellCount = 0;
                        for (const spellName in magic) {
                            const spell = magic[spellName];
                            const baseCost = (10 - (spell.grade || 9)) * 5000 + 1000;
                            const cost = getServicePrice(baseCost, operatorDiscount);
                            const rule = getMageTowerSpellLearningRule(player, spell);
                            if (!player.spells.includes(spellName)) {
                                if (!rule.canLearn) {
                                    lockedSpellCount += 1;
                                    continue;
                                }
                                foundSpell = true;
                                addActionCard(spellGrid, {
                                    title: `[${spell.grade}등급] ${spellName}`,
                                    desc: spell.desc,
                                    meta: `${cost.toLocaleString()} 스톤 (기본 ${baseCost.toLocaleString()})`,
                                    onClick: () => {
                                        if (player.gold < cost) {
                                            logMessage("마법을 배우기에 스톤이 부족합니다.");
                                            return;
                                        }
                                        player.gold -= cost;
                                        changeNpcAffinity(player, operatorName, 1, "마법 학습");
                                        player.learnSpell(spellName);
                                        handleCityAction(player, location);
                                    }
                                });
                            }
                        }
                        if (!foundSpell) {
                            const nextRank = MAGE_TOWER_RANKS.find((rank) =>
                                rank.maxLearnableGrade < rankInfo.maxLearnableGrade &&
                                rank.meritRequired > merit
                            );
                            addActionCard(spellGrid, {
                                title: "학습 가능한 마법 없음",
                                desc: nextRank
                                    ? `공적이 부족합니다. 다음 해금: ${nextRank.name} (공적 ${nextRank.meritRequired})`
                                    : "현재 더 배울 수 있는 마법이 없습니다.",
                                disabled: true
                            });
                        }
                        if (lockedSpellCount > 0) {
                            logMessage(`[마탑 학습] 공적 부족으로 잠긴 마법 ${lockedSpellCount}개`);
                        }
                    }
                });
                addActionCard(grid, {
                    title: "마법 연구",
                    desc: "연구비를 지불하고 공적을 추가 획득합니다. (하루 1회)",
                    onClick: () => {
                        const towerState = ensureMageTowerState(player);
                        const dayStamp = getWorldDayStamp(player);
                        const researchState = getMageTowerQuestRuntime(player, "__tower_research_daily__");
                        if (Number(researchState.lastCompletedDay || -1) === dayStamp) {
                            logMessage("오늘은 이미 연구를 진행했습니다.");
                            return;
                        }
                        const researchCost = getServicePrice(1800, operatorDiscount);
                        if (player.gold < researchCost) {
                            logMessage("연구비가 부족합니다.");
                            return;
                        }
                        player.gold -= researchCost;
                        const meritGain = 6;
                        towerState.merit = Math.max(0, Number(towerState.merit || 0) + meritGain);
                        const rankInfo = getMageTowerRankInfo(towerState.merit);
                        towerState.rankName = rankInfo.name;
                        researchState.lastCompletedDay = dayStamp;
                        researchState.completedCount = Math.max(0, Number(researchState.completedCount || 0) + 1);
                        logMessage(`[마탑 연구] 연구를 완료했습니다. 공적 +${meritGain}, 현재 등급: ${rankInfo.name}`);
                        changeNpcAffinity(player, operatorName, 1, "마탑 연구");
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "훈련장":
            logMessage("이능 및 스킬 사용이 허가된 훈련 공간입니다.");
            {
                const grid = createActionSection(menu, "훈련장", "능력 향상을 위한 훈련을 진행합니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "기본 훈련",
                    desc: "근력/민첩성/지구력/정신력 중 1 상승",
                    meta: `${getServicePrice(500, operatorDiscount).toLocaleString()} 스톤 (하루 1회, 기본 500)`,
                    onClick: () => {
                        const cost = getServicePrice(500, operatorDiscount);
                        const trainStamp = getTodayStamp(player);
                        if (player.lastTrainedStamp === trainStamp) {
                            logMessage("훈련은 하루에 한 번만 가능합니다.");
                            return;
                        }
                        if (player.gold < cost) {
                            logMessage("훈련 비용이 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        changeNpcAffinity(player, operatorName, 1, "훈련 의뢰");
                        player.lastTrainedStamp = trainStamp;
                        const statsToTrain = ["근력", "민첩성", "지구력", "정신력"];
                        const trainedStat = statsToTrain[Math.floor(Math.random() * statsToTrain.length)];
                        player.stats[trainedStat]++;
                        logMessage(`훈련을 통해 [${trainedStat}] 스탯이 1 상승했습니다!`);
                        player.calculateStats();
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
                if (player.isRace?.("human")) {
                    addActionCard(grid, {
                        title: "오러 수련",
                        desc: "인간 전용 심화 수련",
                        meta: "성장형 강화",
                        onClick: () => {
                            const current = Math.max(0, Number(player.auraTrainingLevel || 0));
                            const maxLevel = 10;
                            if (current >= maxLevel) {
                                logMessage("오러 숙련이 이미 최고 단계입니다.");
                                return;
                            }
                            const cost = getServicePrice(1000 + (current * 700), operatorDiscount);
                            if (player.gold < cost) {
                                logMessage("오러 수련 비용이 부족합니다.");
                                return;
                            }
                            player.gold -= cost;
                            player.auraTrainingLevel = current + 1;
                            if ((player.auraTrainingLevel % 3) === 0) {
                                player.stats["정신력"] = Math.max(0, Number(player.stats["정신력"] || 0) + 1);
                            }
                            changeNpcAffinity(player, operatorName, 1, "오러 수련");
                            logMessage(`[오러 수련] 숙련 단계가 ${current} -> ${player.auraTrainingLevel}로 상승했습니다.`);
                            player.calculateStats?.();
                            player.showStatus?.();
                            handleCityAction(player, location);
                        }
                    });
                }
            }
            break;

        case "알미너스 중앙 거래소":
            {
                const grid = createActionSection(menu, "알미너스 중앙 거래소", "검색/위탁 판매 기능을 이용할 수 있습니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "아이템 검색",
                    desc: "시세와 거래 가능 여부를 조회합니다.",
                    meta: `수수료 ${getServicePrice(3000, operatorDiscount).toLocaleString()} 스톤`,
                    onClick: () => {
                        const cost = getServicePrice(3000, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("검색 수수료가 부족합니다.");
                            return;
                        }
                        const itemToSearch = prompt("검색할 아이템 이름을 입력하세요:");
                        if (itemToSearch) {
                            player.gold -= cost;
                            const itemData = allGameItems[itemToSearch];
                            if (itemData) {
                                const basePrice = itemData.price || itemData.tier * 100 || 50;
                                const price = getEconomyAdjustedPrice(player, basePrice, itemToSearch, "sell", itemData);
                                const marketPct = getMarketMultiplierPercent(player, itemToSearch, itemData);
                                if (isLowIntSpeechMode(player)) {
                                    logMessage(`[${itemToSearch}] 검색 결과: 현재 시세는... 음, 대충 ${getObscuredPriceLabel(player, itemToSearch, price)} 입니다.`);
                                } else {
                                    logMessage(`[${itemToSearch}] 검색 결과: 현재 ${price.toLocaleString()} 스톤 수준입니다. (시세 ${marketPct}%)`);
                                }
                            } else {
                                logMessage(`[${itemToSearch}](은)는 거래소에 매물이 없습니다.`);
                            }
                            player.showStatus();
                            handleCityAction(player, location);
                        }
                    }
                });
                addActionCard(grid, {
                    title: "아이템 위탁 판매",
                    desc: "거래소에 아이템을 등록합니다.",
                    onClick: () => {
                        const itemToSell = prompt("위탁 판매할 아이템 이름을 입력하세요:");
                        if (!itemToSell) return;
                        const owned = countInventoryItem(player, itemToSell);
                        if (owned <= 0) {
                            logMessage("해당 아이템을 보유하고 있지 않습니다.");
                            return;
                        }
                        const qtyInput = prompt(`판매 수량을 입력하세요. (보유 ${owned})`);
                        const qty = Math.max(1, Math.min(owned, Number.parseInt(qtyInput, 10) || 1));
                        const itemData = allGameItems[itemToSell];
                        if (!itemData) {
                            logMessage("거래소가 해당 품목의 기준 시세를 찾지 못했습니다.");
                            return;
                        }
                        const basePrice = Number(itemData.price || (Number(itemData.tier || 1) * 100) || 50);
                        const marketUnit = getEconomyAdjustedPrice(player, basePrice, itemToSell, "sell", itemData);
                        const premiumUnit = Math.max(1, Math.floor(marketUnit * 1.12));
                        const gross = premiumUnit * qty;
                        const fee = Math.max(20, Math.floor(gross * 0.06));
                        const earned = Math.max(0, gross - fee);
                        if (!removeInventoryItems(player, itemToSell, qty)) {
                            logMessage("위탁 등록 중 인벤토리 확인에 실패했습니다.");
                            return;
                        }
                        player.gold += earned;
                        changeNpcAffinity(player, operatorName, 1, "위탁 판매");
                        logMessage(`[위탁 판매] ${itemToSell} x${qty} 판매 완료. 정산 ${earned.toLocaleString()} 스톤 (수수료 ${fee.toLocaleString()})`);
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
            }
            break;
            
        case "알미너스 은행":
            logMessage(`현재 잔고: ${player.gold.toLocaleString()} 스톤 | 은행 예금: ${player.bankGold.toLocaleString()} 스톤`);
            {
                const grid = createActionSection(menu, "알미너스 은행", "입금과 출금을 카드로 선택합니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "입금",
                    desc: "소지 스톤을 은행 예금으로 이체",
                    onClick: () => {
                        const amountStr = prompt("입금할 금액을 입력하세요:");
                        const amount = parseInt(amountStr);
                        if (amount > 0 && player.gold >= amount) {
                            player.gold -= amount;
                            player.bankGold += amount;
                            logMessage(`${amount.toLocaleString()} 스톤을 입금했습니다.`);
                            player.showStatus();
                            handleCityAction(player, location);
                        } else if (amount > 0) {
                            logMessage("잔고가 부족합니다.");
                        }
                    }
                });
                addActionCard(grid, {
                    title: "출금",
                    desc: "은행 예금을 소지 스톤으로 인출",
                    onClick: () => {
                        const amountStr = prompt("출금할 금액을 입력하세요:");
                        const amount = parseInt(amountStr);
                        if (amount > 0 && player.bankGold >= amount) {
                            player.bankGold -= amount;
                            player.gold += amount;
                            logMessage(`${amount.toLocaleString()} 스톤을 출금했습니다.`);
                            player.showStatus();
                            handleCityAction(player, location);
                        } else if (amount > 0) {
                            logMessage("예금이 부족합니다.");
                        }
                    }
                });
            }
            break;

        case "왕궁":
            {
                const grid = createActionSection(menu, "왕궁", "왕도 핵심 행정 구역입니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "업적 보고",
                    desc: "탐험 실적을 공식 기록합니다.",
                    onClick: () => {
                        const reward = 1000 + Math.floor((player.level || 1) * 140);
                        player.gold += reward;
                        changeNpcAffinity(player, operatorName, 2, "업적 보고");
                        logMessage(`왕궁 기록관이 업적을 인정했습니다. (${reward.toLocaleString()} 스톤 포상)`);
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "천공 경매장":
            {
                const grid = createActionSection(menu, "천공 경매장", "희귀품은 직접 획득 후 위탁되는 방식으로만 거래됩니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "경매 정보 열람",
                    desc: "최근 균열/보스 드랍 희귀품 시세를 확인합니다.",
                    onClick: () => {
                        const hints = [
                            "이번 주 상위 시세: 8층 균열 수호자 드랍품이 강세입니다.",
                            "넘버스/희귀 아이템은 미궁 내 획득품 위탁만 가능합니다.",
                            "보스 토벌 기록이 높을수록 희귀품 위탁 제안이 늘어납니다."
                        ];
                        changeNpcAffinity(player, operatorName, 1, "경매 정보 열람");
                        logMessage(`[천공 경매장] ${hints[Math.floor(Math.random() * hints.length)]}`);
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "영광의 궁":
            {
                const grid = createActionSection(menu, "영광의 궁", "왕가 연회 및 사교 장소.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "연회 참석",
                    desc: "사교 활동으로 명성과 호감도를 확보합니다.",
                    onClick: () => {
                        player.specialStats = player.specialStats || {};
                        player.specialStats["명성"] = player.specialStats["명성"] || { value: 0 };
                        player.specialStats["명성"].value += 1;
                        changeNpcAffinity(player, operatorName, 3, "연회 참석");
                        logMessage("연회에서 인맥을 넓혔습니다. (명성 +1)");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "모즐란 본청":
            {
                const grid = createActionSection(menu, "모즐란 본청", "치안 관련 신고/의뢰를 처리합니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "치안 의뢰 수령",
                    desc: "약탈자 소탕 의뢰를 접수합니다.",
                    onClick: () => {
                        const reward = 600 + Math.floor(Math.random() * 900);
                        player.gold += reward;
                        logMessage(`치안 협조비 ${reward.toLocaleString()} 스톤을 받았습니다.`);
                        changeNpcAffinity(player, operatorName, 2, "치안 협조");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "고급 여관":
            {
                const grid = createActionSection(menu, "고급 여관", "고급 숙박 서비스.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "스위트룸 숙박",
                    desc: "완전 회복 + 피로 대폭 감소",
                    meta: `${getServicePrice(1200, operatorDiscount).toLocaleString()} 스톤`,
                    timeCostHours: 24,
                    onClick: () => {
                        const cost = getServicePrice(1200, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("숙박비가 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        player.setLodgingTier?.("luxury");
                        const recoveryRate = applyRestRecoveryByLodging(player, "luxury");
                        changeNpcAffinity(player, operatorName, 1, "고급 숙박");
                        if (recoveryRate >= 1.05) {
                            logMessage("고급 여관에서 최상급 휴식을 취했습니다.");
                        } else {
                            logMessage(`회복률 페널티가 남아 있습니다. (현재 ${Math.floor(recoveryRate * 100)}%)`);
                        }
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "다과점":
        case "제과점":
            {
                const grid = createActionSection(menu, location, "간단한 보급품과 간식을 구입할 수 있습니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "식량 세트 구매",
                    desc: "식량/건조식량/포션 중 무작위 2개 획득",
                    meta: `${getServicePrice(700, operatorDiscount).toLocaleString()} 스톤`,
                    onClick: () => {
                        const cost = getServicePrice(700, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("구매 비용이 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        const pool = ["식량", "건조 식량", "포션", "횃불"];
                        for (let i = 0; i < 2; i++) {
                            const item = pool[Math.floor(Math.random() * pool.length)];
                            player.addItem(item);
                        }
                        changeNpcAffinity(player, operatorName, 1, "식량 구매");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "키아르비스":
        case "온천":
        case "승마장":
        case "농장/목장":
            {
                const grid = createActionSection(menu, location, "휴양/훈련/생활 시설을 이용할 수 있습니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "시설 이용",
                    desc: "기력과 피로를 회복하고 소모품을 얻습니다.",
                    meta: `${getServicePrice(500, operatorDiscount).toLocaleString()} 스톤`,
                    onClick: () => {
                        const cost = getServicePrice(500, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("이용 비용이 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        player.stamina = Math.min(player.maxStamina, player.stamina + 45);
                        player.fatigue = Math.max(0, (player.fatigue || 0) - 35);
                        if (Math.random() < 0.6) player.addItem("식량");
                        changeNpcAffinity(player, operatorName, 1, "시설 이용");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "배급소":
            {
                const grid = createActionSection(menu, "배급소", "비프론 주민 대상 배급을 진행합니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "배급 수령",
                    desc: "식량/건조식량/포션 중 1개 수령",
                    onClick: () => {
                        const pool = ["식량", "건조 식량", "포션"];
                        player.addItem(pool[Math.floor(Math.random() * pool.length)]);
                        changeNpcAffinity(player, operatorName, 2, "배급 수령");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "깡패 점거 여관/주점":
            {
                const bm = rollBlackMarketStatus(player);
                const isOpen = Boolean(bm?.open && bm.location === location);
                const grid = createActionSection(
                    menu,
                    "깡패 점거 여관/주점",
                    isOpen
                        ? "오늘은 암시장이 열렸습니다. 시세보다 비싸게 팔 수 있지만 사기/단속 위험이 있습니다."
                        : "오늘은 암시장 문이 닫혀 있습니다. 정보만 수집할 수 있습니다."
                );
                addOperatorCard(grid, player, location, npcs);
                if (!isOpen) {
                    addActionCard(grid, {
                        title: "암시장 잠금",
                        desc: "오늘은 암시장 통로가 열리지 않았습니다.",
                        meta: "다음 날 재확인",
                        disabled: true
                    });
                    break;
                }

                addActionCard(grid, {
                    title: "암시장 매각",
                    desc: "인벤토리 물품 1개를 고가 매각합니다. 위조 화폐/단속 위험.",
                    meta: "시세 대비 프리미엄",
                    variant: "sell",
                    onClick: () => {
                        const sellable = [...new Set(player.inventory || [])];
                        if (sellable.length === 0) {
                            logMessage("암시장에 팔 물건이 없습니다.");
                            return;
                        }

                        const pick = prompt(`매각할 아이템명을 입력하세요:\n${sellable.slice(0, 12).join(", ")}`);
                        if (!pick) return;
                        const idx = player.inventory.indexOf(pick);
                        if (idx < 0) {
                            logMessage("해당 아이템을 보유하고 있지 않습니다.");
                            return;
                        }

                        const itemData = allGameItems[pick] || {};
                        const basePrice = Math.max(20, Number(itemData.price || itemData.tier * 100 || 100));
                        const deal = player.livingWorld?.resolveBlackMarketDeal
                            ? player.livingWorld.resolveBlackMarketDeal({ mode: "sell", itemName: pick, basePrice })
                            : { targetPrice: Math.floor(basePrice * 1.2), realGain: Math.floor(basePrice * 1.2), fakeCoin: false, raid: false, fine: 0 };

                        player.inventory.splice(idx, 1);
                        player.gold += Math.max(0, Number(deal.realGain || 0));

                        if (deal.fakeCoin) {
                            logMessage(`[암시장] ${pick}을(를) ${deal.targetPrice.toLocaleString()}에 판 줄 알았지만 위조 화폐를 받았습니다. 실제 수익 ${deal.realGain.toLocaleString()} 스톤.`);
                        } else {
                            logMessage(`[암시장] ${pick} 매각 성공. ${deal.realGain.toLocaleString()} 스톤 획득.`);
                        }

                        if (deal.raid) {
                            const fine = Math.max(0, Number(deal.fine || 0));
                            player.gold = Math.max(0, player.gold - fine);
                            player.economyState = player.economyState || {};
                            player.economyState.taxDebt = Math.max(0, Number(player.economyState.taxDebt || 0) + Math.floor(fine * 0.25));
                            logMessage(`[치안대 단속] 벌금 ${fine.toLocaleString()} 스톤 부과. 체납 위험도가 상승했습니다.`);
                        }
                        changeNpcAffinity(player, operatorName, 1, "암시장 거래");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "암시장 보급 구매",
                    desc: "시세보다 싸게 물건을 구입합니다. 단속 위험이 있습니다.",
                    meta: "랜덤 물품 1개",
                    onClick: () => {
                        const pool = ["횃불", "건조 식량", "포션", "모닥불 키트", "붕대"];
                        const pick = pool[Math.floor(Math.random() * pool.length)];
                        const itemData = allGameItems[pick] || {};
                        const basePrice = Math.max(50, Number(itemData.price || itemData.tier * 100 || 160));
                        const deal = player.livingWorld?.resolveBlackMarketDeal
                            ? player.livingWorld.resolveBlackMarketDeal({ mode: "buy", itemName: pick, basePrice })
                            : { targetPrice: Math.floor(basePrice * 0.8), raid: false, fine: 0 };
                        const pay = Math.max(1, Number(deal.targetPrice || 1));
                        if (player.gold < pay) {
                            logMessage("암시장 구매 자금이 부족합니다.");
                            return;
                        }
                        player.gold -= pay;
                        player.addItem(pick);
                        logMessage(`[암시장] ${pick}(을)를 ${pay.toLocaleString()} 스톤에 구매했습니다.`);

                        if (deal.raid) {
                            const fine = Math.max(0, Number(deal.fine || 0));
                            player.gold = Math.max(0, player.gold - fine);
                            player.economyState = player.economyState || {};
                            player.economyState.taxDebt = Math.max(0, Number(player.economyState.taxDebt || 0) + Math.floor(fine * 0.25));
                            logMessage(`[치안대 단속] 벌금 ${fine.toLocaleString()} 스톤 부과. 체납 위험도가 상승했습니다.`);
                        }
                        changeNpcAffinity(player, operatorName, 1, "암시장 거래");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "하수도 비밀 통로":
            {
                const grid = createActionSection(menu, "하수도 비밀 통로", "통로 정보를 얻거나 이동 루트를 확보합니다.");
                addOperatorCard(grid, player, location, npcs);
                addActionCard(grid, {
                    title: "밀수 경로 확보",
                    desc: "비밀 루트 정보로 탐험 보너스를 얻습니다.",
                    meta: `${getServicePrice(900, operatorDiscount).toLocaleString()} 스톤`,
                    onClick: () => {
                        const cost = getServicePrice(900, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("정보 거래 비용이 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        player.explorationBuffs = player.explorationBuffs || {};
                        player.explorationBuffs.hunterSense = Math.max(player.explorationBuffs.hunterSense || 0, 12);
                        logMessage("비밀 통로 정보를 얻었습니다. (탐지 감각 강화)");
                        changeNpcAffinity(player, operatorName, 2, "경로 확보");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "종족 성소":
            {
                const story = typeof player.getRaceStoryPayload === 'function'
                    ? player.getRaceStoryPayload()
                    : null;
                const mentorName = player.raceStory?.mentor || "성소 인도자";
                const title = story?.title || `${player.race || "종족"} 서사`;
                const stageText = story
                    ? `${story.stageIndex}/${story.stages.length} 단계 진행`
                    : "서사 데이터 없음";
                const desc = story
                    ? `${title} | 지도자: ${mentorName} | ${stageText}`
                    : "종족 서사가 아직 준비되지 않았습니다.";
                const grid = createActionSection(menu, "종족 성소", desc);

                addActionCard(grid, {
                    title: `${mentorName}와 대화`,
                    desc: story?.current
                        ? `${story.current.title} 단계 안내를 받습니다.`
                        : "완료된 서사 기록을 점검합니다.",
                    meta: story?.current ? (story.current.desc || "") : "모든 서사 단계를 완료했습니다.",
                    variant: "buy",
                    onClick: () => {
                        if (!story) {
                            logMessage("진행 가능한 서사가 없습니다.");
                            return;
                        }
                        const req = story.current?.requirement || {};
                        const stageTitle = story.current?.title || "모든 서사 단계 완료";
                        const stageDesc = story.current?.desc || "서사의 모든 장을 완수했습니다.";
                        const stageGuide = story.completed
                            ? `[${mentorName}] 서사 완수자에게는 언제나 문이 열려 있습니다.`
                            : `[${mentorName}] [${stageTitle}] 요구치: 레벨 ${req.level || 1}, 스톤 ${Number(req.gold || 0).toLocaleString()}, 마석 ${Number(req.magicStones || 0).toLocaleString()}`;
                        const stageNpcData = {
                            ...(npcs || {}),
                            [mentorName]: {
                                ...(npcs?.[mentorName] || {}),
                                dialog: `${stageGuide}\n${stageDesc}`
                            }
                        };
                        openNpcDialog(player, location, mentorName, stageNpcData, () => handleCityAction(player, location));
                    }
                });

                addActionCard(grid, {
                    title: story?.completed ? "서사 완수 기록" : "현재 서사 단계 진행",
                    desc: story?.completed
                        ? "모든 단계 완료. 기록을 열람합니다."
                        : (story?.current?.desc || "현재 단계 설명이 없습니다."),
                    meta: story?.completed
                        ? `완료 단계 ${story?.stages?.length || 0}`
                        : `요구: Lv ${story?.current?.requirement?.level || 1}, 스톤 ${Number(story?.current?.requirement?.gold || 0).toLocaleString()}, 마석 ${Number(story?.current?.requirement?.magicStones || 0).toLocaleString()}`,
                    variant: "buy",
                    onClick: () => {
                        if (!story) {
                            logMessage("서사 데이터가 없습니다.");
                            return;
                        }
                        if (story.completed) {
                            const logs = Array.isArray(player.raceStory?.log) ? player.raceStory.log : [];
                            if (logs.length === 0) {
                                logMessage("기록된 서사 완료 내역이 없습니다.");
                            } else {
                                logs.forEach((entry, idx) => {
                                    logMessage(`[서사 기록 ${idx + 1}] ${entry.title} - ${entry.desc}`);
                                });
                            }
                            return;
                        }
                        const progressed = player.progressRaceStoryStep?.();
                        if (progressed) {
                            logMessage("[종족 성소] 서사 단계가 진행되었습니다.");
                            handleCityAction(player, location);
                        }
                    }
                });

                addActionCard(grid, {
                    title: "성소 보조 훈련",
                    desc: "소량 비용으로 종족 특화 훈련을 받습니다.",
                    meta: `${getServicePrice(850, operatorDiscount).toLocaleString()} 스톤`,
                    onClick: () => {
                        const cost = getServicePrice(850, operatorDiscount);
                        if (player.gold < cost) {
                            logMessage("훈련 비용이 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        const boostStats = player.isRace?.("dwarf")
                            ? ["근력", "골강도", "물리 내성"]
                            : player.isRace?.("fairy")
                                ? ["정신력", "시각", "인지력"]
                                : player.isRace?.("dragonkin")
                                    ? ["근력", "항마력", "화염 내성"]
                                    : ["근력", "민첩성", "지구력"];
                        const pick = boostStats[Math.floor(Math.random() * boostStats.length)];
                        if (player.stats?.hasOwnProperty(pick)) {
                            player.stats[pick] += 1;
                            player.calculateStats?.();
                        }
                        logMessage(`[종족 성소] ${pick} +1 훈련 효과를 얻었습니다.`);
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "개인 영지":
            {
                const home = typeof player.getHomesteadPayload === 'function'
                    ? player.getHomesteadPayload()
                    : null;
                const farmPayload = typeof player.getHomesteadFarmPayload === 'function'
                    ? player.getHomesteadFarmPayload()
                    : null;
                const farmPlotCount = Math.max(0, Number(farmPayload?.farm?.plotCapacity || 0));
                const farmOccupied = Array.isArray(farmPayload?.farm?.plots)
                    ? farmPayload.farm.plots.filter((plot) => Boolean(plot)).length
                    : 0;
                const farmReady = Math.max(0, Number(farmPayload?.readyCount || 0));
                if (!home) {
                    logMessage("영지 데이터를 불러올 수 없습니다.");
                    break;
                }
                const grid = createActionSection(
                    menu,
                    "개인 영지",
                    `영지 Lv.${home.level} | 안락도 ${home.comfort} | 테마 ${home.decor?.theme || "기본"} | 경작지 ${farmOccupied}/${farmPlotCount} (수확 가능 ${farmReady})`
                );

                addActionCard(grid, {
                    title: "영지 수확",
                    desc: "시설 상태에 따라 물자/마석을 회수합니다.",
                    meta: "식량/소모품/마석 획득",
                    variant: "buy",
                    onClick: () => {
                        player.harvestHomestead?.();
                        handleCityAction(player, location);
                    }
                });

                addActionCard(grid, {
                    title: "씨앗 구매",
                    desc: "상점 없이 영지에서 바로 씨앗을 구매합니다.",
                    meta: "밀/감자/토마토/약초 씨앗",
                    onClick: () => {
                        const catalog = player.getHomesteadFarmCatalog?.() || {};
                        const seedNames = Object.keys(catalog);
                        if (seedNames.length <= 0) {
                            logMessage("구매 가능한 씨앗 데이터가 없습니다.");
                            return;
                        }
                        const listText = seedNames
                            .map((name) => `${name} (${Number(catalog[name]?.seedPrice || 0).toLocaleString()} 스톤)`)
                            .join(", ");
                        const seedName = prompt(`구매할 씨앗명을 입력하세요.\n${listText}`);
                        if (!seedName) return;
                        const qtyInput = prompt("구매 수량", "1");
                        if (qtyInput === null) return;
                        const qty = Math.max(1, parseInt(qtyInput, 10) || 1);
                        player.buyHomesteadSeed?.(seedName.trim(), qty);
                        handleCityAction(player, location);
                    }
                });

                addActionCard(grid, {
                    title: "씨앗 파종",
                    desc: "보유한 씨앗을 경작지에 심습니다.",
                    meta: "성장 시간은 게임 시간 기준",
                    onClick: () => {
                        const payload = player.getHomesteadFarmPayload?.();
                        const seedInventory = payload?.farm?.seedInventory || {};
                        const seedNames = Object.keys(seedInventory).filter((seedName) => Number(seedInventory[seedName] || 0) > 0);
                        if (seedNames.length <= 0) {
                            logMessage("파종할 씨앗이 없습니다.");
                            return;
                        }
                        const listText = seedNames.map((name) => `${name} x${seedInventory[name]}`).join(", ");
                        const seedName = prompt(`파종할 씨앗명을 입력하세요.\n${listText}`);
                        if (!seedName) return;
                        const qtyInput = prompt("파종 수량", "1");
                        if (qtyInput === null) return;
                        const qty = Math.max(1, parseInt(qtyInput, 10) || 1);
                        player.plantHomesteadSeed?.(seedName.trim(), qty);
                        handleCityAction(player, location);
                    }
                });

                addActionCard(grid, {
                    title: "작물 수확",
                    desc: "성장이 완료된 작물을 수확합니다.",
                    meta: `현재 수확 가능 ${farmReady}칸`,
                    variant: "buy",
                    onClick: () => {
                        player.harvestHomesteadCrops?.();
                        handleCityAction(player, location);
                    }
                });

                addActionCard(grid, {
                    title: "농산물 일괄 판매",
                    desc: "수확한 작물을 즉시 판매합니다.",
                    meta: "보유 작물 전체 정산",
                    variant: "sell",
                    onClick: () => {
                        player.sellAllHomesteadProduce?.();
                        handleCityAction(player, location);
                    }
                });

                addActionCard(grid, {
                    title: "경작지 확장",
                    desc: "경작지 3칸을 추가로 확장합니다.",
                    meta: "최대 18칸",
                    onClick: () => {
                        player.expandHomesteadFarmPlots?.();
                        handleCityAction(player, location);
                    }
                });

                addActionCard(grid, {
                    title: "영지에서 취침",
                    desc: "8시간 취침해 피로를 회복합니다.",
                    meta: "피로 회복/HP·MP 안정화",
                    timeCostHours: 8,
                    onClick: () => {
                        const rate = applyRestRecoveryByLodging(player, "standard");
                        const lodgeLevel = Math.max(0, Number(home.structures?.lodge || 0));
                        const fatigueRecover = 26 + (lodgeLevel * 8);
                        player.fatigue = Math.max(0, Number(player.fatigue || 0) - fatigueRecover);
                        player.sleepCount = Math.max(0, Number(player.sleepCount || 0) + 1);
                        logMessage(`[취침] 영지에서 잠을 잤습니다. (회복률 ${Math.floor(rate * 100)}%, 피로 -${fatigueRecover})`);
                        player.showStatus?.();
                        handleCityAction(player, location);
                    }
                });

                const structures = [
                    { key: "herbGarden", label: "약초 정원" },
                    { key: "forgeBench", label: "공방 벤치" },
                    { key: "ritualHall", label: "의식당" },
                    { key: "lodge", label: "숙소" }
                ];
                structures.forEach((entry) => {
                    const lv = Number(home.structures?.[entry.key] || 0);
                    const next = lv + 1;
                    const costGold = 900 + (next * 650);
                    const costStone = 20 + (next * 15);
                    addActionCard(grid, {
                        title: `${entry.label} 강화`,
                        desc: `현재 Lv.${lv} -> Lv.${next}`,
                        meta: `비용 ${costGold.toLocaleString()} 스톤 / 마석 ${costStone}`,
                        onClick: () => {
                            const ok = player.upgradeHomesteadStructure?.(entry.key);
                            if (ok) handleCityAction(player, location);
                        }
                    });
                });

                addActionCard(grid, {
                    title: "영지 테마 변경",
                    desc: "영지 배경 테마를 변경합니다.",
                    meta: "기본/숲/요새/성소/용혈",
                    onClick: () => {
                        const theme = prompt("적용할 영지 테마를 입력하세요. (기본/숲/요새/성소/용혈)");
                        if (!theme) return;
                        player.decorateHomestead?.(theme);
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "종족 영지로 이동",
                    desc: "종족 영지 구역 화면으로 이동합니다.",
                    meta: "독립 공간",
                    variant: "buy",
                    onClick: () => {
                        player.position = RACE_HOMELAND_DISTRICT;
                        player.cb?.updateMenu?.(player);
                    }
                });

                renderHomesteadDesignerSection(menu, player);
            }
            break;

        default:
            logMessage("이 구역은 아직 조용합니다. 다른 시설을 이용해 탐험 준비를 진행하세요.");
    }
    
    // [제거] "뒤로" 버튼을 맨 위로 옮겼기 때문에 하단에서는 제거
    // addButton(menu, "뒤로 (구역 활동 메뉴)", () => player.cb?.showCityLocations(player));
    updateStatusBars(player);
}
