// 겜바바 설정.txt 기반 확장 넘버스 아이템 팩

export const numbersItemsExtended = {
    "공성 살육자": {
        no: 687,
        type: "무기",
        desc: "근력 대폭 상승. 대신 민첩성이 크게 감소한다.",
        stats: { "근력": 38, "절삭력": 16, "민첩성": -12 },
        effect: (p) => {
            p?.cb?.logMessage?.("[공성 살육자] 근력 보정이 활성화됩니다. (민첩 페널티 주의)");
        }
    },
    "미스터리 박스": {
        no: 777,
        type: "소모품",
        desc: "사용 시 무작위 아이템 또는 영구 보너스를 얻는다.",
        effect: (p) => {
            const pool = ["포션", "건조 식량", "횃불", "마력결정체", "모닥불 키트"];
            const pick = pool[Math.floor(Math.random() * pool.length)];
            p?.addItem?.(pick);
            p?.cb?.logMessage?.(`[미스터리 박스] ${pick}(을)를 획득했습니다.`);
        }
    },
    "명계의 족쇄": {
        no: 17,
        type: "부무기",
        desc: "대상을 결투 공간으로 끌어들이는 더블 넘버스.",
        stats: { "항마력": 12, "정신력": 8, "물리 내성": 6 },
        effect: (p) => {
            if (p?.inCombat && Array.isArray(p.currentMonster)) {
                let bound = 0;
                p.currentMonster.forEach((monster) => {
                    if (!monster || Number(monster.hp || 0) <= 0) return;
                    if (Math.random() < 0.42) {
                        monster.applyDebuff?.("속박(1턴)");
                        bound += 1;
                    }
                });
                p?.cb?.logMessage?.(`[명계의 족쇄] 결계를 전개해 ${bound}체를 속박했습니다.`);
                return;
            }
            p?.cb?.logMessage?.("[명계의 족쇄] 결투 결계를 전개합니다.");
        }
    },
    "결속 증폭 팔찌": {
        no: 12,
        type: "팔찌",
        desc: "결속 상태 아군 수에 따라 지원/공격 효율이 상승한다.",
        stats: { "정신력": 10, "지구력": 8, "통제력": 8 },
        effect: (p) => {
            const allies = [p, ...((Array.isArray(p?.party) ? p.party : []))].filter((member) => member && Number(member.hp || 0) > 0);
            const heal = Math.max(6, 4 + allies.length * 3);
            allies.forEach((member) => {
                member.hp = Math.min(member.maxHp || 1, Number(member.hp || 0) + heal);
            });
            p?.cb?.logMessage?.(`[결속 증폭 팔찌] 파티 공명이 증폭됩니다. (전원 HP +${heal})`);
        }
    },
    "블랙 앤 화이트 화관": {
        no: "????",
        type: "투구",
        desc: "정신계 해로운 효과 면역. 대신 신성 계열 축복을 받지 못한다.",
        stats: { "정신력": 18, "항마력": 14 },
        effect: (p) => {
            p?.cb?.logMessage?.("[시크릿 넘버스] 정신 보호막이 형성됩니다.");
        }
    },
    "아이기스의 용갑": {
        no: "????",
        type: "갑옷",
        desc: "시크릿 넘버스 중갑. 극도로 높은 방호 성능을 지닌다.",
        stats: { "물리 내성": 42, "항마력": 28, "지구력": 16, "민첩성": -4 },
        effect: (p) => {
            p?.cb?.logMessage?.("[아이기스의 용갑] 극한 방호장이 전개됩니다.");
        }
    },
    "순례자의 휘장": {
        no: 3113,
        type: "부적",
        desc: "장기 탐험 시 피로 누적을 완화한다.",
        stats: { "지구력": 10, "고통내성": 8, "자연 재생력": 6 },
        effect: (p) => {
            if (typeof p?.fatigue === "number") p.fatigue = Math.max(0, p.fatigue - 8);
            if (typeof p?.stamina === "number") p.stamina = Math.min(p.maxStamina || 0, p.stamina + 10);
            p?.cb?.logMessage?.("[순례자의 휘장] 피로가 완화되었습니다.");
        }
    },
    "가르파스 연금권": {
        no: 7778,
        type: "목걸이",
        desc: "마석을 투입해 보급품 변환 효율을 높인다.",
        stats: { "행운": 10, "인지력": 8, "정신력": 6 },
        effect: (p) => {
            const spend = Math.min(5000, Number(p?.magic_stones || 0));
            if (spend <= 0) {
                p?.cb?.logMessage?.("마석이 부족합니다.");
                return;
            }
            p.magic_stones -= spend;
            const gain = 1 + Math.floor(spend / 1500);
            for (let i = 0; i < gain; i++) p?.addItem?.("마력결정체");
            p?.cb?.logMessage?.(`[가르파스 연금권] 마석 ${spend}개를 결정체 ${gain}개로 변환했습니다.`);
        }
    },
    "심연 항해 나침반": {
        no: 3410,
        type: "부적",
        desc: "균열/심연 지형에서 길 찾기 안정성이 오른다.",
        stats: { "육감": 12, "인지력": 10, "시각": 6 },
        effect: (p) => {
            p.explorationBuffs = p.explorationBuffs || {};
            p.explorationBuffs.reveal = Math.max(Number(p.explorationBuffs.reveal || 0), 14);
            p.explorationBuffs.hunterSense = Math.max(Number(p.explorationBuffs.hunterSense || 0), 12);
            p?.cb?.logMessage?.("[심연 항해 나침반] 왜곡 지형에서 방향 감각이 향상됩니다.");
        }
    },
    "무명 추적 장화": {
        no: 3124,
        type: "각반",
        desc: "비전투 이동 속도와 탐색 효율을 높인다.",
        stats: { "민첩성": 12, "도약력": 8, "지구력": 6 },
        effect: (p) => {
            if (typeof p?.stamina === "number") p.stamina = Math.min(p.maxStamina || 0, p.stamina + 14);
            p?.cb?.logMessage?.("[무명 추적 장화] 추적 이동 모드가 활성화됩니다.");
        }
    },
    "칼헤움 파편 코어": {
        no: 7007,
        type: "마도구",
        desc: "빛의 도시 칼헤움 잔재를 담은 핵심 파편.",
        stats: { "정신력": 14, "항마력": 10, "모든 속성 감응도": 8 },
        effect: (p) => {
            const mpGain = Math.max(10, Math.floor((p?.maxMp || 60) * 0.18));
            p.mp = Math.min(p.maxMp || 0, Number(p.mp || 0) + mpGain);
            p?.cb?.logMessage?.("[칼헤움 파편 코어] 광역 탐색 파동이 발생합니다.");
        }
    },
    "절망의 비 우의": {
        no: 8646,
        type: "갑옷",
        desc: "절망의 비 필드 피해를 경감한다.",
        stats: { "물리 내성": 14, "항마력": 16, "정신력": 8 },
        effect: (p) => {
            p?.cb?.logMessage?.("[절망의 비 우의] 환경 피해 저항이 상승합니다.");
        }
    },
    "라크자르의 화염각": {
        no: 4561,
        type: "무기",
        desc: "화염 속성 근접 공격 특화 넘버스 무구.",
        stats: { "근력": 20, "화염 감응도": 24, "절삭력": 10 },
        effect: (p) => {
            p?.cb?.logMessage?.("[라크자르의 화염각] 화염 피해 계수가 상승합니다.");
        }
    },
    "미궁 총해록: 넘버스 편찬본": {
        no: 10000,
        type: "기타",
        desc: "넘버스 아이템 정보가 기록된 편찬본.",
        effect: (p) => {
            p?.cb?.logMessage?.("[총해록] 분석 기록이 갱신되었습니다.");
        }
    },

    "미명 봉인고리": {
        no: 9425,
        type: "부적",
        desc: "흡수한 정수 중 하나의 스킬을 봉인해 안정성을 높인다.",
        stats: { "정신력": 12, "통제력": 10, "항마력": 6 },
        effect: (p) => {
            p.removeAllDebuffs?.();
            p?.cb?.logMessage?.("[미명 봉인고리] 정수 공명이 안정화되었습니다.");
        }
    },
    "침잠의 관": {
        no: 1577,
        type: "투구",
        desc: "휴식 시 체력 회복 속도를 크게 높여준다.",
        stats: { "자연 재생력": 18, "정신력": 8 },
        effect: (p) => {
            const heal = Math.max(15, Math.floor((p?.maxHp || 100) * 0.2));
            p.hp = Math.min(p.maxHp, p.hp + heal);
            p?.cb?.logMessage?.(`[침잠의 관] 휴식 회복 +${heal}`);
        }
    },
    "낡은 결전 휘장": {
        no: 9981,
        type: "부적",
        desc: "전투 준비 시 안정적인 전투 보정이 붙는다.",
        stats: { "근력": 8, "민첩성": 8, "물리 내성": 6 },
        effect: (p) => {
            p.applyDebuff?.("결전 태세(2턴)");
            p?.cb?.logMessage?.("[낡은 결전 휘장] 전투 보정이 적용됩니다.");
        }
    },
    "폭군 타룬바스의 몽둥이": {
        no: 9712,
        type: "둔기",
        desc: "공격 시 냉기 추가 피해를 부여한다.",
        stats: { "근력": 22, "냉기 감응도": 18, "물리 관통": 12 },
        effect: (p) => {
            p?.cb?.logMessage?.("[타룬바스의 몽둥이] 냉기 피해가 강화됩니다.");
        }
    },
    "심해 구명 내갑": {
        no: 2578,
        type: "갑옷",
        desc: "고수준 방어 성능을 제공하는 청록색 내갑.",
        stats: { "물리 내성": 26, "항마력": 16, "지구력": 12 },
        effect: (p) => {
            p?.cb?.logMessage?.("[심해 구명 내갑] 방어 안정성이 상승합니다.");
        }
    },
    "시체술사의 오만": {
        no: 7612,
        type: "벨트",
        desc: "기만 계열 보구와 공명하면 생존력이 증폭된다.",
        stats: { "지구력": 12, "고통내성": 8, "정신력": 6 },
        effect: (p) => {
            const heal = Math.max(8, Math.floor((p?.maxHp || 100) * 0.12));
            p.hp = Math.min(p.maxHp, p.hp + heal);
            p?.cb?.logMessage?.(`[시체술사의 오만] 생명력 +${heal}`);
        }
    },

    "홍염 공진기": {
        no: 760,
        type: "마도구",
        desc: "화염 계열 스킬 효율을 높이는 트리플 넘버스.",
        stats: { "화염 감응도": 28, "정신력": 10 },
        effect: (p) => {
            p?.cb?.logMessage?.("[홍염 공진기] 화염 공진률이 상승합니다.");
        }
    },
    "봉마 철창": {
        no: 399,
        type: "함정",
        desc: "공간 이동 계열을 억제하는 트랩형 넘버스.",
        stats: { "항마력": 10, "정신력": 8, "통제력": 6 },
        effect: (p) => {
            p.applyDebuff?.("봉마 결계(2턴)");
            p?.cb?.logMessage?.("[봉마 철창] 주변 공간 이동이 봉쇄됩니다.");
        }
    },
    "화염 관통장": {
        no: 761,
        type: "부적",
        desc: "물리력에 비례해 화염 관통 피해를 추가한다.",
        stats: { "화염 감응도": 16, "근력": 10, "물리 관통": 8 },
        effect: (p) => {
            p?.cb?.logMessage?.("[화염 관통장] 관통 화염 피해가 강화됩니다.");
        }
    },
    "극지 방패": {
        no: 535,
        type: "방패",
        desc: "극지 환경 특화 방어 보정을 제공한다.",
        stats: { "물리 내성": 16, "냉기 내성": 30, "항마력": 10 },
        effect: (p) => {
            p?.cb?.logMessage?.("[극지 방패] 냉기 방호장이 전개됩니다.");
        }
    },
    "브라이엇의 사냥활": {
        no: 696,
        type: "활",
        desc: "장거리 교전에 특화된 트리플 넘버스 활.",
        stats: { "민첩성": 20, "명중률": 28, "시각": 12, "근력": 8 },
        effect: (p) => {
            p?.cb?.logMessage?.("[브라이엇의 사냥활] 원거리 명중이 안정화됩니다.");
        }
    },
    "자원 순환 부적": {
        no: 989,
        type: "부적",
        desc: "부상 없을 때 자원 회복 속도를 크게 올려준다.",
        stats: { "지구력": 8, "영혼 재생력": 10, "정신력": 6 },
        effect: (p) => {
            p.stamina = Math.min(p.maxStamina, p.stamina + 12);
            p.mp = Math.min(p.maxMp, p.mp + 8);
            p?.cb?.logMessage?.("[자원 순환 부적] 기력/MP가 빠르게 회복됩니다.");
        }
    },

    "파쇄의 철퇴": {
        no: 87,
        type: "둔기",
        desc: "둔기류 스킬 피해량을 대폭 강화하는 더블 넘버스.",
        stats: { "근력": 24, "물리 관통": 14, "절삭력": 4 },
        effect: (p) => {
            p?.cb?.logMessage?.("[파쇄의 철퇴] 둔기 기술 위력이 증폭됩니다.");
        }
    },
    "변환의 장검": {
        no: 19,
        type: "검",
        desc: "물리 피해를 상황에 따라 마법 피해로 전환한다.",
        stats: { "근력": 14, "모든 속성 감응도": 14, "절삭력": 10 },
        effect: (p) => {
            p?.cb?.logMessage?.("[변환의 장검] 물리/마법 변환 모드가 활성화됩니다.");
        }
    },
    "쌍왕 클로": {
        no: 35,
        type: "클로",
        desc: "세트 운용 시 효과가 커지는 쌍형 무기.",
        stats: { "민첩성": 18, "근력": 12, "절삭력": 14 },
        effect: (p) => {
            p?.cb?.logMessage?.("[쌍왕 클로] 연속 타격 보정이 적용됩니다.");
        }
    },
    "수호자의 두 번째 방패": {
        no: 21,
        type: "방패",
        desc: "생존 특화 운용에 적합한 더블 넘버스 방패.",
        stats: { "물리 내성": 24, "항마력": 10, "지구력": 8 },
        effect: (p) => {
            p?.cb?.logMessage?.("[두 번째 방패] 방어 태세가 강화됩니다.");
        }
    },
    "균열 예견자": {
        no: 18,
        type: "부적",
        desc: "미래 단서와 균열 생성 보정에 관련된 보구.",
        stats: { "육감": 16, "인지력": 12, "행운": 8 },
        effect: (p) => {
            p.explorationBuffs = p.explorationBuffs || {};
            p.explorationBuffs.hunterSense = Math.max(Number(p.explorationBuffs.hunterSense || 0), 16);
            p?.cb?.logMessage?.("[균열 예견자] 차원 파형을 예측합니다.");
        }
    },
    "그림자 토큰": {
        no: 16,
        type: "토큰",
        desc: "은신 계열 스킬에 강력한 보정을 부여한다.",
        stats: { "민첩성": 14, "인지력": 10, "명중률": 8 },
        effect: (p) => {
            p?.cb?.logMessage?.("[그림자 토큰] 은신 성능이 강화됩니다.");
        }
    },

    "여우 가면": {
        no: 9,
        type: "가면",
        desc: "싱글 넘버스 영역의 희귀 가면.",
        stats: { "민첩성": 10, "육감": 10, "시각": 6 },
        effect: (p) => {
            p?.cb?.logMessage?.("[여우 가면] 직감이 선명해집니다.");
        }
    },
    "메아리 수거낭": {
        no: 1001,
        type: "가방",
        desc: "마석 수급량을 높여주는 부적형 넘버스.",
        stats: { "행운": 8, "지구력": 6, "인지력": 4 },
        effect: (p) => {
            const bonus = 12 + Math.floor(Math.random() * 19);
            p.magic_stones = (p.magic_stones || 0) + bonus;
            p?.cb?.logMessage?.(`[메아리 수거낭] 전투 흔적을 회수했습니다. (마석 +${bonus})`);
        }
    },

    "창공 감시안": {
        no: 5401,
        type: "귀걸이",
        desc: "시야/인지를 강화해 함정 회피와 정찰 효율을 높입니다.",
        stats: { "시각": 24, "인지력": 18, "명중률": 10 },
        effect: (p) => {
            p?.cb?.logMessage?.("[창공 감시안] 전장 시야 해석 능력이 향상됩니다.");
        }
    },
    "균열 유도 반지": {
        no: 5422,
        type: "반지",
        desc: "균열 탐색과 기연 반응을 증폭하는 반지.",
        stats: { "육감": 20, "정신력": 12, "모든 속성 감응도": 8 },
        effect: (p) => {
            p?.cb?.logMessage?.("[균열 유도 반지] 균열 반응 감지율이 상승합니다.");
        }
    },
    "심연 역장 벨트": {
        no: 5477,
        type: "벨트",
        desc: "환경/필드 피해를 감소시키는 역장 장비.",
        stats: { "지구력": 18, "항마력": 14, "고통내성": 10 },
        effect: (p) => {
            p?.cb?.logMessage?.("[심연 역장 벨트] 역장 보호가 활성화됩니다.");
        }
    },
    "대현자의 군청 로브": {
        no: 5512,
        type: "갑옷",
        desc: "마법 운용 효율과 생존력을 동시에 끌어올리는 장비.",
        stats: { "정신력": 26, "항마력": 22, "영혼 재생력": 14 },
        effect: (p) => {
            p?.cb?.logMessage?.("[대현자의 군청 로브] 마력 순환이 안정화됩니다.");
        }
    },
    "파동 사슬 건틀릿": {
        no: 5533,
        type: "장갑",
        desc: "근접 타격 시 관통력이 상승하는 건틀릿.",
        stats: { "근력": 14, "절삭력": 12, "물리 관통": 10 },
        effect: (p) => {
            p?.cb?.logMessage?.("[파동 사슬 건틀릿] 근접 관통 보정이 적용됩니다.");
        }
    }
};
