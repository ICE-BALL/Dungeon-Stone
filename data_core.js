// 이 파일은 게임의 핵심 시스템 데이터를 보관합니다.
// (캐릭터 기반, 스탯, 레벨, 마법, 정수)
// 수정사항:
// - [cite_*] 토큰 제거 및 주석화
// - p.cb 호출을 안전한 옵셔널 체이닝(p?.cb?.logMessage?.())로 통일
// - 대상/몬스터 처리를 안전하게 다루기 위한 유틸 추가
// - 일부 직접 스탯 수정 시 stats 객체 보장
// - 자바스크립트 문법 오류 수정 (쉼표, 콜론 등)
// - [오류 수정] helpers 객체 export 추가

// 공용 유틸 (export 추가)
export const helpers = {
    toArray: (x) => (Array.isArray(x) ? x : x ? [x] : []), // 객체나 null을 안전하게 배열로 변환
    safeApplyDebuff: (t, name) => { if (!t) return; t.applyDebuff?.(name); }, // 대상의 applyDebuff 안전 호출
    ensureStats: (obj) => { if (!obj) obj = {}; if (!obj.stats) obj.stats = {}; return obj; }, // 객체와 stats 속성 존재 보장
    safeHpUpdate: (target, amount) => { // HP 안전하게 업데이트 (음수 방지)
        if (!target) return;
        target.hp = Math.max(0, (target.hp || 0) + amount);
    },
    safeHpSet: (target, amount) => { // HP 안전하게 설정 (최대치 고려)
        if (!target) return;
        target.hp = Math.min(target.maxHp || 999999, Math.max(0, amount));
    },
    calculateDamage: (base, defense) => Math.floor(Math.max(1, base - (defense || 0))) // 기본 데미지 계산 (최소 1 보장, 정수 처리)
};

// 1. 종족 (Races) - 문서와 위키 기반 전체 리스트
// 각 종족 기본 스탯, 특성, 설명 포함
export const races = {
    "Human": { //
        description: "균형 잡힌 스탯, 다양한 역할에 적합. 평균적인 성장과 적응력.",
        base_stats: { "근력": 10, "민첩성": 10, "지구력": 10, "정신력": 10, "행운": 5, "항마력": 5, "물리 내성": 5 },
        special: "특별 보너스나 페널티 없음. 오러, 정령술, 마법 등 모든 분야에 재능. 후반 포텐 좋음.",
        racial_skill: {
            name: "오러",
            desc: "인간 고유의 능력. 무기에 오러를 담아 공격 시 방어력과 항마력을 일부(90%) 무시합니다.",
            effect: (p) => {
                if (p) p.aura_active = true;
                p?.cb?.logMessage?.("무기에 오러를 집중합니다. 다음 공격이 강화됩니다.");
            }
        }
    },
    "Elf": { //
        description: "높은 민첩성과 정신력, 원거리와 마법에 좋음. 요정족으로 자연 친화적.",
        base_stats: { "근력": 8, "민첩성": 12, "지구력": 9, "정신력": 12, "행운": 6, "육감": 10, "청각": 8 },
        special: "활 명중률과 마나 재생 보너스. 숲에서 재생력 증가. 정령술 사용 가능. 기감이 예민함.",
        racial_skill: {
            name: "정령술",
            desc: "하급 정령과 계약하여 전투에 도움을 받거나 자연의 힘을 빌립니다. (패시브: 주변 위험 감지)",
            effect: (p) => {
                if (p && p.position === "Labyrinth" && Math.random() < 0.2) {
                    p?.cb?.logMessage?.("정령의 속삭임이 주변의 위험을 알려줍니다.");
                }
            }
        }
    },
    "Dwarf": { //
        description: "높은 근력과 지구력, 근접 탱커와 제작에 좋음. 드워프족으로 광산/대장간 친화.",
        base_stats: { "근력": 12, "민첩성": 8, "지구력": 12, "정신력": 9, "행운": 4, "골강도": 10, "물리 내성": 8 },
        special: "물리 데미지 저항과 제작 보너스. 인챈트 비용 감소. 넘버스 아이템 효율 1.5배 증가(무구의 축복).",
        racial_skill: {
            name: "무구의 축복",
            desc: "넘버스 아이템의 효율이 1.5배 증가합니다. (패시브)",
            effect: (p) => {
                p?.cb?.logMessage?.("드워프의 손재주는 넘버스 아이템의 잠재력을 최대로 이끌어냅니다. (넘버스 아이템 효과 1.5배 적용)");
            }
        }
    },
    "Barbarian": { //
        description: "높은 근력과 지구력, 바바리안족으로 야만적 전투 스타일. 토베라 규칙에 따라 신성력 사용 불가.",
        base_stats: { "근력": 13, "민첩성": 10, "지구력": 13, "정신력": 8, "행운": 5, "자연 재생력": 10, "항마력": 5 },
        special: "신성력 사용 불가. 전투 중 재생력 보너스. 집착 스탯 초기 높음. 혼령각인으로 강화 가능.",
        racial_skill: {
            name: "혼령각인",
            desc: "주술사에게 혼령각인을 받아 신체 능력을 강화할 수 있습니다. (도시에서 가능)",
            effect: (p) => {
                if (p?.position !== "Labyrinth") {
                    p?.cb?.logMessage?.("도시의 바바리안 주술사를 찾아가 혼령각인을 받을 수 있습니다.");
                } else {
                    p?.cb?.logMessage?.("혼령각인은 도시에서만 받을 수 있습니다.");
                }
            }
        }
    },
    "Fairy": { // 요정족의 하위 분류 또는 별도 종족으로 가정
        description: "요정족, 높은 정신력과 마법 친화. 비행 가능.",
        base_stats: { "근력": 6, "민첩성": 14, "지구력": 8, "정신력": 15, "행운": 7, "모든 속성 감응도": 10 },
        special: "비행 가능. 마법 위력 증가.",
        racial_skill: {
            name: "비행",
            desc: "짧은 시간 동안 공중을 날아다닐 수 있습니다. 전투 시 회피율이 증가합니다.",
            effect: (p) => {
                if (p?.inCombat) {
                    p.evasionBonus = 0.3;
                    p?.cb?.logMessage?.("날갯짓으로 가볍게 공중에 떠오릅니다. 이번 턴 회피율이 증가합니다.");
                } else {
                    p?.cb?.logMessage?.("날갯짓으로 주변을 빠르게 둘러봅니다.");
                }
            }
        }
    },
    "Beastman": { //
        description: "수인족, 동물적 감각. 후각과 청각 우수. 영혼수와 계약 가능.",
        base_stats: { "근력": 12, "민첩성": 12, "지구력": 12, "정신력": 7, "행운": 5, "후각": 15, "청각": 15 },
        special: "야수 변신 모드 가능성(구현 필요). 추적 능력 우수. 영혼수 계약 가능.",
        racial_skill: {
            name: "영혼수 계약",
            desc: "영혼수와 계약하여 그 힘을 빌릴 수 있습니다. (패시브: 감각 강화)",
            effect: (p) => {
                p?.cb?.logMessage?.("영혼수와의 교감으로 감각이 더욱 예민해집니다. (후각, 청각 관련 판정 보너스)");
            }
        }
    },
    "Dragonkin": { //
        description: "용인족, 강력한 육체와 마법 저항력. 기본 스탯이 높지만 성장이 느림.",
        base_stats: { "근력": 14, "민첩성": 9, "지구력": 14, "정신력": 11, "항마력": 10, "물리 내성": 10, "화염 내성": 10 },
        special: "용언 사용 가능. 드래곤 피어로 적에게 공포 유발. 일부 마법 사용 가능.",
        racial_skill: {
            name: "용언",
            desc: "고대 용의 언어를 사용하여 강력한 효과를 발휘합니다. (적 전체에게 낮은 확률로 공포 유발)",
            effect: (p) => {
                if (p?.inCombat && p.currentMonster) {
                    p?.cb?.logMessage?.("용언의 힘이 주변의 마력을 뒤흔듭니다!");
                    const monsters = helpers.toArray(p.currentMonster);
                    monsters.forEach((monster) => {
                        if (monster?.hp > 0 && Math.random() < 0.2) {
                            helpers.safeApplyDebuff(monster, "공포");
                            p?.cb?.logMessage?.(`${monster.name}이(가) 공포에 질렸습니다!`);
                        }
                    });
                } else {
                    p?.cb?.logMessage?.("전투 중에만 사용할 수 있습니다.");
                }
            }
        }
    }
};

// 2. 스탯 (Stats) - 전체 리스트, 설명, 티어 포함
export const statsList = [
    // 1티어
    { name: "근력", desc: "물리 데미지 상승, 소지 중량 보정. 모든 스탯 중에 1티어로 취급.", tier: 1 },
    { name: "민첩성", desc: "움직임 속도, 동체시력/반사신경 증가. 모든 스탯 중에 1티어로 취급.", tier: 1 },
    { name: "지구력", desc: "스태미나(기력) 최대치/재생 속도 영향.", tier: 1 },
    { name: "정신력", desc: "정신계 마법/상태 이상 내성 보너스.", tier: 1 },
    { name: "영혼력", desc: "MP 역할. 레벨업/정수로만 상승. 재생속도 총량 비례. 희귀 스탯.", tier: 1 },
    { name: "물리 내성", desc: "탱커 필수, 피부/맨살 튼튼, 방어력 영향. 귀한 스탯.", tier: 1 },
    { name: "골강도", desc: "방어력 영향, 뼈/이빨 단단. 상위 티어 수비 능력치.", tier: 1 },
    { name: "항마력", desc: "탱커 필수, 마법 저항/상태 이상 면역. 400 이상 제압 면역. 희귀 스탯.", tier: 1 },
    { name: "자연 재생력", desc: "상처 자연 치유. 흉터/절단 재생 (시간 오래, 범위 제한). 안정성 비약적 상승. 희귀 스탯.", tier: 1 },
    { name: "영혼 재생력", desc: "입수 난이도 최상.", tier: 1 },
    { name: "근질량", desc: "3등급 이상 몬스터 획득 초희귀. 근질량 1당 근력 총합 1% 증가.", tier: 1 },
    { name: "모든 속성 감응도", desc: "모든 속성 스킬 효율 증폭. 매우 중요한 스탯.", tier: 1 },
    { name: "절삭력", desc: "검 공격력 증가. 검사 핵심.", tier: 1 },
    { name: "화염 감응도", desc: "화염 속성 위력 보정.", tier: 1 },
    { name: "냉기 감응도", desc: "냉기 속성 위력 보정.", tier: 1 },
    { name: "화염 내성", desc: "화염 내성. 상위 티어.", tier: 1 },
    { name: "번개 내성", desc: "번개 내성. 상위 티어.", tier: 1 },
    { name: "대지 내성", desc: "대지 내성. 상위 티어.", tier: 1 },
    { name: "냉기 내성", desc: "냉기 내성. 상위 티어.", tier: 1 },
    { name: "독 내성", desc: "독 내성. 100 이상 중독(상)→(하).", tier: 1 },
    { name: "신성 내성", desc: "신성 내성. 상위 티어.", tier: 1 },
    { name: "어둠 내성", desc: "어둠 내성. 상위 티어.", tier: 1 },
    // 2티어
    { name: "유연성", desc: "회피율/치명타율 증가. 좁은 곳/착지 수월. 낮으면 뻣뻣.", tier: 2 },
    { name: "시각", desc: "원거리 사정거리/가시 범위 증가.", tier: 2 },
    { name: "인지력", desc: "동체시력/판단속도 영향. 하락 시 둔해짐, 상승 시 시간 느리게 느껴짐.", tier: 2 },
    { name: "고통내성", desc: "피해 통증 완화.", tier: 2 },
    { name: "투쟁심", desc: "적 만나도 위축되지 않음, 파괴 본능. [공포] 상태 탈출 도움.", tier: 2 },
    { name: "육감", desc: "직감 상승. 적중률 보정, 숨은 공간 발견, 위험 감지. 기본 0~50 랜덤.", tier: 2 },
    { name: "도약력", desc: "점프 높이 증가.", tier: 2 },
    { name: "시야", desc: "시야각 증가. 회피율 보너스.", tier: 2 },
    { name: "행운", desc: "크리티컬 등 랜덤 확률 상승.", tier: 2 },
    { name: "통제력", desc: "정신계 마법/[공포] 등 상태 이상 방어 보정.", tier: 2 },
    { name: "적응력", desc: "디버프 지속 시간에 비례해 점점 디버프의 효과가 줄어든다.", tier: 2 },
    { name: "수복력", desc: "수치에 비례해 모든 치유 및 재생 효과에 조정을 준다.", tier: 2 },
    // 3티어
    { name: "체중", desc: "넉백/둔기 대미지 영향.", tier: 3 },
    { name: "식욕", desc: "공복 주기 빨라짐.", tier: 3 },
    { name: "골밀도", desc: "신장/얼굴 골격 작아짐, 미용 효과.", tier: 3 },
    { name: "후각", desc: "마력의 향으로 길 찾기 가능.", tier: 3 },
    { name: "청각", desc: "소리가 더 선명해짐.", tier: 3 },
    { name: "집착", desc: "미스터리 스탯. 정신 하위, 욕구 강화? 얀데레 부작용.", tier: 3 },
    // 기타 (티어 미분류 또는 특수)
    { name: "손재주", desc: "제작, 덫 해체 등에 영향.", tier: 'N/A' },
    { name: "인내심", desc: "특정 행동 지속 능력에 영향.", tier: 'N/A' },
    { name: "인지 방해", desc: "은신, 기습 등에 영향.", tier: 'N/A' },
    { name: "명중률", desc: "공격 명중 확률.", tier: 'N/A' },
    { name: "소화력", desc: "음식 섭취 효율에 영향.", tier: 'N/A' },
    { name: "폐활량", desc: "잠수, 달리기 등 지구력 소모 활동에 영향.", tier: 'N/A' }
];

// 특수 능력치
export const specialStats = {
    "명성": { desc: "높으면 인식 증가, 이벤트/퀘스트 확률 상승, 호감도 상승. 1구역 입장 필수.", value: 0 },
    "지지도": { desc: "우두머리 시 생성. 통솔력/반동 세력 감소/정책 성공률/지시 수행률 영향.", value: 0 }
};

// 3. 레벨 시스템
export const maxLevelOriginal = 11;
export const maxLevelModded = 30;
export const expToLevel = {};
// expToLevel[level]는 (level-1) 레벨에서 level 레벨로 가기 위해 필요한 경험치를 의미합니다.
for (let i = 1; i <= maxLevelModded; i++) {
    expToLevel[i] = i * 1000 + ((i - 1) * 500);
}

// 6. 마법과 스킬 (Magic and Skills) - 전체 리스트, 등급, 효과, MP 비용
// effect 함수는 Player(p)와 Target(t)을 인자로 받도록 고려
export const magic = {
    // 일반/보조 마법
    "서적 탐지": { grade: 3, desc: "원하는 키워드의 책을 찾을 수 있게 해준다.", mp_cost: 10, effect: function(p, t) { p?.cb?.logMessage?.("책을 찾기 시작합니다."); } },
    "상급 서적 탐지": { grade: 2, desc: "보안 등급이 높은 책을 찾을 수 있게 해준다.", mp_cost: 50, effect: function(p, t) { p?.cb?.logMessage?.("고급 정보를 찾기 시작합니다."); } },
    "왜곡": { grade: 3, desc: "미궁의 부산물을 도시로 가져갈 수 있게 한다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("아이템에 왜곡 마법을 겁니다."); } },
    "상급 왜곡": { grade: 6, desc: "왜곡 성공 확률을 1.5배 높인다.", mp_cost: 100, effect: function(p, t) { p?.cb?.logMessage?.("아이템에 상급 왜곡 마법을 겁니다."); } },
    "결속": { grade: 3, desc: "파티원들이 미궁 시작 시 같은 위치에서 시작하고 경험치를 공유한다.", mp_cost: 15, effect: function(p, t) { p?.cb?.logMessage?.("파티원과 결속을 맺었습니다."); } },
    "빛구체": { grade: 5, desc: "빛을 생성하여 주변을 밝힌다.", mp_cost: 5, effect: function(p, t) { p?.cb?.logMessage?.("빛구체를 생성하여 시야를 확보했다."); } },
    "칼날폭풍": { grade: 3, desc: "주변의 적들에게 칼날 폭풍을 일으켜 피해를 준다.", mp_cost: 40, dmg: 30, type: "physical", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(30, t.def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`칼날 폭풍으로 ${t?.name || '대상'}에게 ${dmg}의 물리 피해! (HP: ${t?.hp})`); /* 광역 처리 필요 */ } },
    "마력시": { grade: 9, desc: "마법사의 기본 공격. 영체 공격 가능.", mp_cost: 1, dmg: 5, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(5, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`마력시로 ${t?.name || '대상'}에게 ${dmg}의 마법 피해! (HP: ${t?.hp})`); } },
    "화염세례": { grade: 6, desc: "불길을 내뿜어 공격한다.", mp_cost: 30, dmg: 40, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(40, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`화염세례로 ${t?.name || '대상'}에게 ${dmg}의 화염 피해! (HP: ${t?.hp})`); } },
    "휘광폭발": { grade: 7, desc: "광역 실명 효과를 부여한다.", mp_cost: 20, effect: function(p, t) { helpers.safeApplyDebuff(t, "실명"); p?.cb?.logMessage?.(`${t?.name || '대상'}의 눈을 멀게 했다!`); /* 광역 처리 필요 */ } },
    "흑점구": { grade: 6, desc: "태양 속성 구체를 발사한다.", mp_cost: 35, dmg: 35, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(35, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`흑점구로 ${t?.name || '대상'}에게 ${dmg}의 태양 피해! (HP: ${t?.hp})`); } },
    "화염구": { grade: 6, desc: "화염 구체를 발사한다.", mp_cost: 30, dmg: 40, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(40, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`화염구로 ${t?.name || '대상'}에게 ${dmg}의 화염 피해! (HP: ${t?.hp})`); } },
    "전음": { grade: 9, desc: "은밀하게 생각을 전달한다.", mp_cost: 5, effect: function(p, t) { p?.cb?.logMessage?.("대상에게 생각을 전달했다."); } },
    "플라이": { grade: 5, desc: "일시적으로 비행 상태가 된다.", mp_cost: 40, effect: function(p, t) { p?.cb?.logMessage?.("공중으로 떠오른다!"); } },
    "영상 기억": { grade: 4, desc: "수정구에 현재 상황을 기록한다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("현재 상황을 수정구에 기록했다."); } },
    "얼음창": { grade: 8, desc: "날카로운 얼음창을 발사한다.", mp_cost: 15, dmg: 25, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(25, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`얼음창으로 ${t?.name || '대상'}에게 ${dmg}의 냉기 피해! (HP: ${t?.hp})`); } },
    "화염운석": { grade: 4, desc: "하늘에서 화염 운석을 떨어뜨린다.", mp_cost: 60, dmg: 70, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(70, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`화염운석으로 ${t?.name || '대상'}에게 ${dmg}의 화염 피해! (HP: ${t?.hp})`); /* 광역 처리 필요 */ } },
    "빙결강화": { grade: 8, desc: "다음 빙결계 주문 위력을 강화한다.", mp_cost: 10, effect: function(p, t) { p?.cb?.logMessage?.("다음 빙결 주문이 강화되었다."); } },
    "음성 제어": { grade: 7, desc: "팀원과 비밀 대화를 가능하게 한다.", mp_cost: 15, effect: function(p, t) { p?.cb?.logMessage?.("팀원과 비밀 통신을 시작했다."); } },
    "마력감지": { grade: 8, desc: "주변의 마법적인 요소를 감지한다.", mp_cost: 20, effect: function(p, t) { p?.cb?.logMessage?.("주변의 마력을 감지한다..."); } },
    "광휘": { grade: 7, desc: "광역 정화 마법.", mp_cost: 30, effect: function(p, t) { p?.removeAllDebuffs?.(); p?.cb?.logMessage?.("광휘로 모든 디버프를 정화했다!"); } },
    "물질화": { grade: 8, desc: "영체류 몬스터에게 물리 공격이 통하도록 한다.", mp_cost: 40, effect: function(p, t) { if (t) { /* 대상의 물리 면역 해제 로직 필요 */ } p?.cb?.logMessage?.(`${t?.name || '대상'}의 물리 면역을 해제했다!`); } },
    "둔화": { grade: 9, desc: "대상의 이동 및 공격 속도를 느리게 한다.", mp_cost: 10, effect: function(p, t) { helpers.safeApplyDebuff(t, "둔화"); p?.cb?.logMessage?.(`${t?.name || '대상'}의 속도를 늦췄다.`); } },
    "냉기폭풍": { grade: 7, desc: "광역 냉기 피해를 입힌다.", mp_cost: 45, dmg: 35, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(35, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`냉기폭풍으로 ${t?.name || '대상'}에게 ${dmg}의 냉기 피해! (HP: ${t?.hp})`); /* 광역 처리 필요 */ } },
    "냉혈": { grade: 8, desc: "화염 저항력을 대폭 상승시킨다.", mp_cost: 15, effect: function(p, t) { const target = helpers.ensureStats(t || p); target.stats['화염 내성'] = (target.stats['화염 내성'] || 0) + 50; p?.cb?.logMessage?.(`${target === p ? '자신' : target.name}의 화염 내성이 크게 상승했다.`); /* 지속시간 필요 */ } },
    "사고가속": { grade: 7, desc: "일시적으로 인지력을 향상시킨다.", mp_cost: 25, effect: function(p, t) { if (p) { helpers.ensureStats(p); p.stats['인지력'] = (p.stats['인지력'] || 0) + 20; p?.cb?.logMessage?.("사고가 가속되어 주변이 느리게 느껴진다."); /* 지속시간 필요 */ } } },
    "마력증폭": { grade: 6, desc: "일시적으로 마법 출력을 높인다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("마력이 증폭되어 다음 마법이 강력해진다."); } },
    "심장촉진": { grade: 8, desc: "심장 박동을 높여 마력 순환을 돕는다.", mp_cost: 10, effect: function(p, t) { p?.cb?.logMessage?.("심장이 빠르게 뛰며 마력 순환이 활발해진다."); } },
    "탐지": { grade: 5, desc: "숨겨진 함정이나 적을 탐지한다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("주변을 탐지하여 숨겨진 위협을 찾는다..."); } },
    "색출": { grade: 8, desc: "은신 상태의 적을 드러낸다.", mp_cost: 25, effect: function(p, t) { if (t) { /* 대상 은신 해제 로직 필요 */ } p?.cb?.logMessage?.(`${t?.name || '대상'}의 은신을 간파했다!`); } },
    "뇌창": { grade: 5, desc: "강력한 번개 창을 발사한다.", mp_cost: 50, dmg: 60, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(60, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`뇌창으로 ${t?.name || '대상'}에게 ${dmg}의 번개 피해! (HP: ${t?.hp})`); } },
    "낙뢰": { grade: 5, desc: "광범위하게 번개를 떨어뜨린다.", mp_cost: 55, dmg: 50, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(50, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`낙뢰로 ${t?.name || '대상'}에게 ${dmg}의 번개 피해! (HP: ${t?.hp})`); /* 광역 처리 필요 */ } },
    "냉기부여": { grade: 7, desc: "무기에 냉기 속성을 부여한다.", mp_cost: 20, effect: function(p, t) { p?.cb?.logMessage?.("무기에 냉기가 서린다."); } },
    "급속냉동": { grade: 6, desc: "대상을 얼려 이동 불가 상태로 만든다.", mp_cost: 40, effect: function(p, t) { helpers.safeApplyDebuff(t, "결빙"); p?.cb?.logMessage?.(`${t?.name || '대상'}을 얼어붙게 만들었다!`); } },
    "얼음비": { grade: 5, desc: "광역으로 날카로운 얼음송곳을 떨어뜨린다.", mp_cost: 60, dmg: 55, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(55, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`얼음비로 ${t?.name || '대상'}에게 ${dmg}의 냉기 피해! (HP: ${t?.hp})`); /* 광역 처리 필요 */ } },
    "마력 측정": { grade: 9, desc: "대상의 마력 수준(등급)을 측정한다.", mp_cost: 5, effect: function(p, t) { if (t?.name && t.grade !== undefined) { p?.cb?.logMessage?.(`${t.name}의 등급은 ${t.grade}등급으로 측정되었다.`); } else { p?.cb?.logMessage?.("측정할 대상이 없거나 정보가 부족합니다."); } } },
    "석벽": { grade: 7, desc: "마력으로 벽을 생성하여 길을 막거나 방어한다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("마력으로 단단한 석벽을 생성했다."); } },
    "검증": { grade: 6, desc: "대상의 진술이 참인지 거짓인지 판별한다.", mp_cost: 40, effect: function(p, t) { p?.cb?.logMessage?.("대상의 진실성을 검증합니다..."); } },
    "마력의 장막": { grade: 6, desc: "마력으로 보호막을 생성하여 피해를 흡수한다.", mp_cost: 25, effect: function(p, t) { p?.cb?.logMessage?.("마력의 장막을 펼쳐 자신을 보호했다."); } },
    "주문강화": { grade: 5, desc: "다음 시전하는 주문의 위력을 증가시킨다.", mp_cost: 35, effect: function(p, t) { p?.cb?.logMessage?.("다음 주문의 위력이 증폭된다!"); } },
    "다중 순간이동": { grade: 4, desc: "최대 20명의 대상을 지정된 좌표로 이동시킨다.", mp_cost: 150, effect: function(p, t) { p?.cb?.logMessage?.("지정된 좌표로 여러 대상을 순간이동 시킨다!"); } },
    "차원문": { grade: 1, desc: "도시로 귀환할 수 있는 차원문을 연다. 사용 시 해당 마법사는 다시 사용할 수 없게 된다.", mp_cost: 300, effect: function(p, t) { p?.cb?.logMessage?.("도시로 돌아가는 차원문을 열었다!"); } },
    "속성부여": { grade: 7, desc: "무기나 대상에게 특정 속성을 부여한다.", mp_cost: 25, effect: function(p, t) { p?.cb?.logMessage?.("대상에게 속성을 부여했다."); } },
    "파멸의 구": { grade: 2, desc: "거대한 파괴력을 가진 구체를 떨어뜨린다.", mp_cost: 200, dmg: 150, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(150, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`파멸의 구로 ${t?.name || '대상'}에게 ${dmg}의 피해! (HP: ${t?.hp})`); /* 광역 처리 필요 */ } },
    "꿰뚫는 강철": { grade: 3, desc: "거대한 마력 화살을 발사한다.", mp_cost: 80, dmg: 90, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(90, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`꿰뚫는 강철로 ${t?.name || '대상'}에게 ${dmg}의 마법 피해! (HP: ${t?.hp})`); } },
    "돌풍": { grade: 8, desc: "대상을 멀리 밀쳐낸다.", mp_cost: 15, effect: function(p, t) { p?.cb?.logMessage?.(`돌풍으로 ${t?.name || '대상'}을 밀쳐냈다!`); } },
    "중화": { grade: 7, desc: "독 피해를 절반으로 감소시킨다.", mp_cost: 20, effect: function(p, t) { p?.cb?.logMessage?.("독의 효과를 중화시켰다."); } },
    "평행계": { grade: 2, desc: "시전자와 대상자를 특정 공간에 가둔다.", mp_cost: 180, effect: function(p, t) { p?.cb?.logMessage?.(`${t?.name || '대상'}과 함께 다른 차원으로 이동했다!`); } },
    "투명": { grade: 5, desc: "일정 시간 동안 모습을 감춘다.", mp_cost: 40, effect: function(p, t) { p?.cb?.logMessage?.("몸이 투명해진다."); } },
    "부유": { grade: 5, desc: "공중을 떠다닐 수 있게 한다.", mp_cost: 35, effect: function(p, t) { p?.cb?.logMessage?.("몸이 공중으로 떠오른다."); } },
    "연쇄번개": { grade: 4, desc: "여러 대상에게 연쇄적으로 번개 피해를 입힌다.", mp_cost: 70, dmg: 65, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(65, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`연쇄번개로 ${t?.name || '대상'}에게 ${dmg}의 번개 피해! (HP: ${t?.hp})`); /* 연쇄 로직 필요 */ } },
    "마력 장벽": { grade: 7, desc: "마력으로 반투명한 방어막을 생성한다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("마력 장벽을 생성했다."); } },
    "붕괴": { grade: 4, desc: "군용 마법. 대상 내부에서 폭발을 일으킨다.", mp_cost: 80, dmg: 100, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(100, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`붕괴 마법으로 ${t?.name || '대상'}에게 ${dmg}의 피해! (HP: ${t?.hp})`); } },
    "천벌": { grade: 4, desc: "군용 마법. 대상에게 강력한 낙뢰를 떨어뜨린다.", mp_cost: 75, dmg: 95, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(95, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`천벌로 ${t?.name || '대상'}에게 ${dmg}의 번개 피해! (HP: ${t?.hp})`); } },
    "산소통": { grade: 7, desc: "물 속에서도 숨을 쉴 수 있게 한다.", mp_cost: 20, effect: function(p, t) { p?.cb?.logMessage?.("물 속에서도 숨을 쉴 수 있게 되었다."); } },
    "환각": { grade: 5, desc: "대상에게 환각을 보여준다.", mp_cost: 40, effect: function(p, t) { helpers.safeApplyDebuff(t, "환각"); p?.cb?.logMessage?.(`${t?.name || '대상'}에게 환각을 보여준다.`); } },
    "천금의 벽": { grade: 2, desc: "거대한 방어벽을 생성한다.", mp_cost: 250, effect: function(p, t) { p?.cb?.logMessage?.("견고한 천금의 벽을 생성했다!"); } },
    "궤도간섭": { grade: 4, desc: "적의 공격 궤도를 틀어버린다.", mp_cost: 50, effect: function(p, t) { p?.cb?.logMessage?.("적의 공격 궤도를 간섭한다!"); } },
    "차단": { grade: 4, desc: "대상에게 걸린 특정 효과를 차단한다.", mp_cost: 60, effect: function(p, t) { p?.cb?.logMessage?.("대상의 특정 효과를 차단했다."); } },
    "통찰": { grade: 5, desc: "어둠 속에서도 시야를 확보한다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("어둠 속에서도 명확하게 볼 수 있게 되었다."); } },
    "결계": { grade: 6, desc: "투사체 공격을 막는 결계를 생성한다.", mp_cost: 40, effect: function(p, t) { p?.cb?.logMessage?.("투사체를 막는 결계를 생성했다."); } },
    "생명의 인형": { grade: 6, desc: "적의 공격을 유도하는 더미 인형을 소환한다.", mp_cost: 35, effect: function(p, t) { p?.cb?.logMessage?.("생명의 인형을 소환했다."); } },
    "수면": { grade: 9, desc: "대상을 잠들게 한다.", mp_cost: 10, effect: function(p, t) { helpers.safeApplyDebuff(t, "수면"); p?.cb?.logMessage?.(`${t?.name || '대상'}을 잠들게 했다.`); } },

    // 신성 주문
    "힐": { grade: 4, desc: "대상의 체력을 회복시킨다.", mp_cost: 15, effect: function(p, t) { let healTarget = t || p; if (!healTarget) return; const healAmount = 30 + Math.floor((p?.stats?.["정신력"] || 10) / 2); helpers.safeHpUpdate(healTarget, healAmount); helpers.safeHpSet(healTarget, healTarget.hp); p?.cb?.logMessage?.(`${healTarget === p ? '자신' : healTarget.name}의 체력을 ${healAmount} 회복했다.`); } },
    "상급 치유": { grade: 3, desc: "대상의 체력을 대량으로 회복시킨다.", mp_cost: 25, effect: function(p, t) { let healTarget = t || p; if (!healTarget) return; const healAmount = 60 + (p?.stats?.["정신력"] || 10); helpers.safeHpUpdate(healTarget, healAmount); helpers.safeHpSet(healTarget, healTarget.hp); p?.cb?.logMessage?.(`${healTarget === p ? '자신' : healTarget.name}의 체력을 ${healAmount} 회복했다.`); } },
    "정화": { grade: 4, desc: "대상의 해로운 효과(디버프)를 제거한다.", mp_cost: 20, effect: function(p, t) { (t || p)?.removeAllDebuffs?.(); p?.cb?.logMessage?.("모든 디버프가 정화되었다."); } },
    "멸악선포": { grade: 2, desc: "결계를 생성하여 몬스터의 침입을 막는다.", mp_cost: 50, effect: function(p, t) { p?.cb?.logMessage?.("멸악선포 결계가 생성되어 몬스터가 접근하지 못합니다."); } },
    "불가침": { grade: 4, desc: "7등급 이하 몬스터가 먼저 공격하지 않게 한다.", mp_cost: 25, effect: function(p, t) { p?.cb?.logMessage?.("불가침 효과로 저등급 몬스터들이 위협을 느끼지 않습니다."); } },
    "태양의 가호": { grade: 3, desc: "5등급 이하 디버프를 해제하고 능력치를 상승시킨다.", mp_cost: 35, effect: function(p, t) { const target = helpers.ensureStats(t || p); target.removeAllDebuffs?.(); target.stats["근력"] = (target.stats["근력"] || 0) + 10; target.stats["민첩성"] = (target.stats["민첩성"] || 0) + 10; p?.cb?.logMessage?.("태양의 가호로 디버프가 해제되고 능력치가 상승했다."); /* 지속시간 필요 */ } },
    "구원": { grade: 2, desc: "악(惡) 속성 적에게 강력한 신성 피해를 준다.", mp_cost: 50, dmg: 100, type: "magic", effect: function(p, t) { if (t) { const dmg = helpers.calculateDamage(100, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`구원의 빛으로 ${t?.name || '대상'}에게 ${dmg}의 신성 피해! (HP: ${t?.hp})`); } } },
    "신성 불꽃": { grade: 5, desc: "태양 마법. 디버프 해제 및 악 속성에게 피해.", mp_cost: 30, dmg: 50, type: "magic", effect: function(p, t) { (t || p)?.removeAllDebuffs?.(); if (t) { const dmg = helpers.calculateDamage(50, t.magic_def); helpers.safeHpUpdate(t, -dmg); } p?.cb?.logMessage?.("신성한 불꽃이 디버프를 태우고 악을 정화했다!"); } },

    // 흑마법
    "원혼화": { grade: 4, desc: "원혼 형태로 변신하여 물리 공격에 대한 저항력을 얻는다.", mp_cost: 30, effect: function(p, t) { if (p) { helpers.ensureStats(p); p.stats["물리 내성"] = (p.stats["물리 내성"] || 0) + 20; p?.cb?.logMessage?.("원혼화 상태로 변했다. 물리 내성이 증가한다."); /* 지속시간 필요 */ } } },
    "악의 만찬": { grade: 4, desc: "독안개를 퍼뜨려 범위 내의 적들을 중독시킨다.", mp_cost: 35, effect: function(p, t) { helpers.safeApplyDebuff(t, "독(강)"); p?.cb?.logMessage?.("악의 만찬으로 적을 중독시켰다."); /* 광역 처리 필요 */ } },
    "추락하는 별": { grade: 3, desc: "흑빛 구체를 떨어뜨려 강력한 피해를 준다.", mp_cost: 40, dmg: 50, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(50, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`추락하는 별로 ${t?.name || '대상'}에게 ${dmg}의 어둠 피해! (HP: ${t?.hp})`); } },
    "부두인형": { grade: 3, desc: "저주 마법의 명중률과 위력을 대폭 증가시킨다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("부두인형으로 저주의 효과를 극대화한다."); } },
    "무기력": { grade: 4, desc: "대상의 근력을 대폭 감소시킨다.", mp_cost: 30, effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } helpers.ensureStats(t); t.stats["근력"] = Math.max(1, (t.stats["근력"] || 10) - 20); helpers.safeApplyDebuff(t, "무기력"); p?.cb?.logMessage?.(`무기력 저주로 ${t?.name || '대상'}의 근력을 약화시켰다.`); /* 지속시간 필요 */ } },
    "살점공물": { grade: 4, desc: "자신의 체력을 소모하여 다음 주문의 위력을 5배로 증폭시킨다.", mp_cost: 50, effect: function(p, t) { if (p) { helpers.safeHpUpdate(p, -Math.max(1, Math.floor((p.maxHp || 0) * 0.1))); p?.cb?.logMessage?.("살점을 공물로 바쳐 다음 주문을 강화했다!"); } } },
    "기력 저하": { grade: 5, desc: "대상의 기력 회복 속도를 감소시킨다.", mp_cost: 25, effect: function(p, t) { helpers.safeApplyDebuff(t, "기력저하"); p?.cb?.logMessage?.(`${t?.name || '대상'}의 기력 회복이 더뎌진다.`); } },
    "하급 부패": { grade: 6, desc: "대상의 상처 회복 속도를 감소시킨다.", mp_cost: 30, effect: function(p, t) { helpers.safeApplyDebuff(t, "부패"); p?.cb?.logMessage?.(`${t?.name || '대상'}의 상처가 잘 아물지 않는다.`); } },
    "추적": { grade: 7, desc: "대상의 위치를 지속적으로 파악한다.", mp_cost: 40, effect: function(p, t) { p?.cb?.logMessage?.(`${t?.name || '대상'}의 위치를 추적하기 시작했다.`); } }
};

// 정수 데이터 (Essences)
export const essences = {
    // 9등급 예시
    "고블린": {
        stats: { "인내심": -5, "후각": -3, "독 내성": -3, "손재주": -3, "시각": -3 },
        passive: { name: "마비독", desc: "근접 무기 사용 시 낮은 확률(10%)로 마비독(둔화)을 부여합니다." },
        active: { name: "덫 생성", desc: "바닥에 덫을 생성하여 밟은 적에게 피해(15)를 주고 이동속도를 감소시킵니다.", mp_cost: 15, effect: (p, t) => { p?.cb?.logMessage?.("바닥에 덫을 설치했다."); } }
    },
    "고블린 궁수": {
        stats: { "민첩성": 2, "유연성": 4, "시각": 6, "후각": 2, "인지력": 2, "인지 방해": 6, "명중률": 8, "독 내성": 4, "집착": 7 },
        passive: { name: "독화살", desc: "활 계열 무기 사용 시 독 데미지(5)를 추가로 부여합니다." },
        active: { name: "도둑걸음", desc: "1턴 동안 은신 상태가 됩니다(어그로 감소).", mp_cost: 20, effect: (p, t) => { p?.cb?.logMessage?.("은신 상태가 되었다."); } }
    },
    "노움": {
        stats: { "항마력": 1, "대지 감응도": 1 },
        passive: { name: "땅과의 친화", desc: "땅 위에서 이동 속도가 소폭 상승하며, 지구력 소모가 감소합니다." },
        active: { name: "일체화", desc: "땅이나 바위와 동화하여 모습을 감춥니다(은신). 움직이면 해제됩니다.", mp_cost: 25, effect: (p, t) => { p?.cb?.logMessage?.("주변 지형과 일체화했다."); } }
    },
    "레이스": {
        stats: { "어둠 감응도": 1, "정신력": 2 },
        passive: { name: "영체", desc: "물리 공격에 대한 저항력(물리 내성 +3)이 소폭 상승합니다." },
        active: { name: "시체불꽃", desc: "어둠과 화염 속성의 불꽃(15 피해)을 발사하여 피해를 줍니다.", mp_cost: 10, dmg: 15, type: "magic", effect: (p, t) => { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(15, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`시체불꽃으로 ${t?.name || '대상'}에게 ${dmg}의 혼합 피해! (HP: ${t?.hp})`); } }
    },
    "위치스램프": {
        stats: { "화염 감응도": 1, "정신력": 1 },
        passive: { name: "꺼지지 않는 불꽃", desc: "화염 저항력(화염 내성 +5)이 소폭 상승합니다." },
        active: { name: "위치스램프 소환", desc: "작은 위치스램프를 소환하여 함께 싸웁니다.", mp_cost: 30, effect: (p, t) => { p?.cb?.logMessage?.("위치스램프를 소환했다."); } }
    },
    "칼날늑대": {
        stats: { "후각": 5, "민첩성": 1 },
        passive: { name: "추적자의 본능", desc: "주변의 약한 적(HP 30% 이하)의 위치를 감지할 수 있습니다." },
        active: { name: "급소 공격", desc: "다음 물리 공격이 치명타가 될 확률이 크게(50%) 증가합니다.", mp_cost: 15, effect: (p, t) => { if (p) p.criticalHitBoost = true; p?.cb?.logMessage?.("다음 공격 시 치명타 확률이 증가했다!"); } }
    },
    "슬라임": {
        stats: { "골강도": -5, "물리 내성": -5, "근력": -5, "민첩성": -5, "독 내성": 2, "육감": 1, "소화력": 10 },
        passive: { name: "끈적이는 신체", desc: "받는 물리 데미지를 소폭(10%) 감소시킵니다." },
        active: { name: "분열", desc: "체력을 소모하여 작은 슬라임을 소환합니다.", mp_cost: 20, effect: (p, t) => { if (p) helpers.safeHpUpdate(p, -Math.max(1, Math.floor((p.maxHp || 0) * 0.05))); p?.cb?.logMessage?.("체력을 소모하여 작은 슬라임을 소환했다."); } }
    },
    "심연어": {
        stats: { "어둠 내성": 5, "영혼력": 10 },
        passive: { name: "심연의 적응", desc: "어둠 속성 공격에 대한 저항력(어둠 내성 +10)이 추가로 증가합니다." },
        active: { name: "심연의 숨결", desc: "작은 어둠의 브레스(20 피해)를 발사합니다.", mp_cost: 20, dmg: 20, type: "magic", effect: (p, t) => { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(20, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`심연의 숨결로 ${t?.name || '대상'}에게 ${dmg}의 어둠 피해! (HP: ${t?.hp})`); } }
    },

    // 8등급 예시
    "스톤골렘": {
        stats: { "골강도": 2, "물리 내성": 3, "근력": 2 },
        passive: { name: "석화 피부", desc: "물리 내성이 대폭(물리 내성 +10) 상승하지만, 민첩성(-5)이 소폭 감소합니다." },
        active: { name: "진압", desc: "대상을 짧은 시간(1턴) 동안 행동 불가 상태(진압 디버프)로 만듭니다. 대상이 피해를 입으면 해제됩니다.", mp_cost: 35, effect: (p, t) => { helpers.safeApplyDebuff(t, "진압"); p?.cb?.logMessage?.(`${t?.name || '대상'}을 진압 상태로 만들었다!`); } }
    },
    "데스핀드": {
        stats: { "어둠 내성": 1, "지구력": 3 },
        passive: { name: "육체보존", desc: "자연 재생력(+5)이 대폭 상승합니다." },
        active: { name: "망자의 부름", desc: "전투당 한 번, 여러 마리(1~3)의 구울을 소환합니다.", mp_cost: 40, effect: (p, t) => { p?.cb?.logMessage?.("망자들을 불러내어 구울을 소환했다!"); } }
    },
    // ... 나머지 정수 데이터들 ...
     // --- 추가 정수 예시 (임의 데이터) ---
     "홉 고블린": {
        stats: { "근력": 5, "지구력": 3, "물리 내성": 2 },
        passive: { name: "독 면역", desc: "모든 종류의 독에 면역이 됩니다." },
        active: { name: "독성 부여", desc: "다음 물리 공격에 독(중) 효과를 부여합니다.", mp_cost: 15, effect: (p, t) => { /* 독 부여 로직 필요 */ p?.cb?.logMessage?.("다음 공격에 독 효과를 부여했다."); }}
    },
     "미믹": {
        stats: { "육감": 10, "행운": 5, "인지 방해": 8 },
        passive: { name: "탐욕", desc: "마석 드랍률이 30% 상승합니다." },
        active: { name: "보물창고", desc: "개인 아공간 창고를 엽니다.", mp_cost: 0, effect: (p, t) => { p?.cb?.logMessage?.("개인 아공간 창고를 열었다."); }}
    },
     "아이안트로": {
         stats: { "근력": 4, "물리 내성": 6, "지구력": 5 },
         passive: { name: "강철 피부", desc: "물리 내성이 추가로 5 상승합니다." },
         active: { name: "균형추", desc: "일시적으로 넉백 면역 상태가 되고 충격 흡수율이 증가합니다.", mp_cost: 20, effect: (p, t) => { /* 넉백 면역 및 충격 흡수 로직 필요 */ p?.cb?.logMessage?.("균형추 스킬을 사용했다!"); }}
     },
     "오크 주술사": {
         stats: { "정신력": 6, "영혼력": 15, "항마력": 3 },
         passive: { name: "주술 강화", desc: "저주 및 버프 계열 스킬 효과가 소폭 증가합니다." },
         active: { name: "열광", desc: "대상 아군의 물리 내성을 10초간 3배 증가시킵니다 (최대 300).", mp_cost: 25, effect: (p, t) => { /* 아군 대상 지정 및 버프 로직 필요 */ p?.cb?.logMessage?.("열광 주문을 외웠다!"); }}
     },
     "프로그맨": {
        stats: { "민첩성": 7, "유연성": 5, "독 내성": 4 },
        passive: { name: "썩은점액", desc: "둔기류 공격에 대한 회피율이 상승합니다." },
        active: { name: "점액 투척", desc: "끈적이는 점액을 던져 대상의 이동 속도를 감소시킵니다.", mp_cost: 10, effect: (p, t) => { helpers.safeApplyDebuff(t, "둔화"); p?.cb?.logMessage?.(`${t?.name || '대상'}에게 점액을 던져 느려지게 했다!`); }}
    },
    "리치": {
        stats: { "정신력": 10, "영혼력": 30, "항마력": 8, "어둠 감응도": 5 },
        passive: { name: "영혼의 함", desc: "죽음에 이르는 피해를 입으면 영혼의 함으로 부활합니다 (1회)." },
        active: { name: "죽음의 손길", desc: "대상에게 강력한 어둠 피해를 주고 생명력을 흡수합니다.", mp_cost: 40, dmg: 60, type:"magic", effect: (p, t) => { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(60, t.magic_def); helpers.safeHpUpdate(t, -dmg); helpers.safeHpUpdate(p, Math.floor(dmg * 0.3)); p?.cb?.logMessage?.(`죽음의 손길로 ${t?.name || '대상'}에게 ${dmg}의 어둠 피해를 주고 체력을 흡수했다! (HP: ${t?.hp})`); }}
    },
     "데스나이트": {
         stats: { "근력": 8, "물리 내성": 10, "골강도": 8, "항마력": 5 },
         passive: { name: "불사의 투지", desc: "HP가 30% 이하일 때 공격력과 방어력이 상승합니다." },
         active: { name: "원한", desc: "주변 적들의 치유 및 재생 효과를 대폭 감소시키는 오오라를 발산합니다.", mp_cost: 30, effect: (p, t) => { /* 주변 적 디버프 로직 필요 */ p?.cb?.logMessage?.("원한의 오오라를 발산했다!"); }}
     },
    "균열": { // 균열 수호자 (임의 데이터)
        stats: { "영혼력": 20, "모든 속성 감응도": 10 },
        passive: { name: "차원의 불안정성", desc: "공격 시 낮은 확률로 무작위 공간 이동 효과를 유발합니다." },
        active: { name: "차원 가르기", desc: "강력한 차원 에너지로 대상을 공격합니다.", mp_cost: 50, dmg: 70, type: "magic", effect: (p, t) => { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = helpers.calculateDamage(70, t.magic_def); helpers.safeHpUpdate(t, -dmg); p?.cb?.logMessage?.(`차원 가르기로 ${t?.name || '대상'}에게 ${dmg}의 마법 피해! (HP: ${t?.hp})`); }}
    },
     "종말의 기사": { // 백색신전 수호자 (임의 데이터)
         stats: { "근력": 15, "지구력": 12, "물리 내성": 10, "항마력": 10 },
         passive: { name: "기사도", desc: "사망 시 장비를 파괴하고 생명력을 회복합니다 (1회)." },
         active: { name: "종복", desc: "강력한 혼령마를 소환하여 함께 싸웁니다.", mp_cost: 60, effect: (p, t) => { p?.cb?.logMessage?.("혼령마를 소환했다!"); }}
     },
     "하프 트롤": {
         stats: { "근력": 6, "지구력": 8, "자연 재생력": 5 },
         passive: { name: "재생력", desc: "자연 재생력이 소폭 상승합니다." },
         active: { name: "광분", desc: "일시적으로 통증을 느끼지 못하고 공격력이 상승합니다.", mp_cost: 20, effect: (p, t) => { /* 버프 로직 필요 */ p?.cb?.logMessage?.("광분 상태에 돌입했다!"); }}
     },
     "카나바로": {
        stats: { "민첩성": 8, "명중률": 6, "인지 방해": 4 },
        passive: { name: "추적자", desc: "이동 시 민첩성이 상승하고 적의 흔적을 발견하기 쉬워집니다." },
        active: { name: "마력 지뢰", desc: "보이지 않는 마력 지뢰를 설치하여 밟은 적에게 피해를 줍니다.", mp_cost: 25, effect: (p, t) => { p?.cb?.logMessage?.("마력 지뢰를 설치했다."); }}
    },
     "가고일": {
         stats: { "물리 내성": 7, "골강도": 5 },
         passive: { name: "석화 피부", desc: "평소 석상 형태로 물리/마법 방어력이 높습니다." },
         active: { name: "석화", desc: "대상을 석화 상태로 만듭니다.", mp_cost: 30, effect: (p, t) => { helpers.safeApplyDebuff(t, "석화"); p?.cb?.logMessage?.(`${t?.name || '대상'}을 석화시켰다!`); }}
     },
    // --- 추가 정수 끝 ---
    "레비아탄": {
        stats: { "영혼력": 50, "모든 속성 감응도": 20, "항마력": 25 },
        passive: { name: "해극신", desc: "바다 지형에서 모든 능력이 대폭(스탯 +20%) 상승하며, 물 속성 공격에 면역이 됩니다." },
        active: { name: "해일", desc: "거대한 해일을 일으켜 필드 전체의 모든 적에게 막대한 물 속성 피해(150)를 입힙니다.", mp_cost: 200, effect: (p, t) => { const monsters = helpers.toArray(p?.currentMonster); monsters.forEach(m => { if (m?.hp > 0) { const dmg = helpers.calculateDamage(150, m.magic_def); helpers.safeHpUpdate(m, -dmg); } }); p?.cb?.logMessage?.("거대한 해일이 모든 적을 휩쓸었다!"); } }
    }
};

// 파일 끝