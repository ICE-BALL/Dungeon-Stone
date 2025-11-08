// 이 파일은 JSON으로 변환할 수 없는 '함수(effect, action)'를 포함한
// 핵심 데이터 객체들을 보관합니다.
// (기존 data_core.js와 data_content.js의 일부)
// [수정] essences 객체는 data/essences_functional_*.js 파일로 분리되었습니다.

// 1. data_core.js에서 가져온 함수 포함 객체
export const races = {
    "Human": { 
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
    "Elf": { 
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
    "Dwarf": { 
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
    "Barbarian": { 
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
    "Fairy": { 
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
    "Beastman": { 
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
    "Dragonkin": { 
        description: "용인족, 강력한 육체와 마법 저항력. 기본 스탯이 높지만 성장이 느림.",
        base_stats: { "근력": 14, "민첩성": 9, "지구력": 14, "정신력": 11, "항마력": 10, "물리 내성": 10, "화염 내성": 10 },
        special: "용언 사용 가능. 드래곤 피어로 적에게 공포 유발. 일부 마법 사용 가능.",
        racial_skill: {
            name: "용언",
            desc: "고대 용의 언어를 사용하여 강력한 효과를 발휘합니다. (적 전체에게 낮은 확률로 공포 유발)",
            effect: (p) => {
                if (p?.inCombat && p.currentMonster) {
                    p?.cb?.logMessage?.("용언의 힘이 주변의 마력을 뒤흔듭니다!");
                    const monsters = Array.isArray(p.currentMonster) ? p.currentMonster : [p.currentMonster];
                    monsters.forEach((monster) => {
                        if (monster?.hp > 0 && Math.random() < 0.2) {
                            if(monster.applyDebuff) monster.applyDebuff("공포");
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

export const magic = {
    // (data_core.js의 magic 객체 전체를 여기에 복사)
    // ... (너무 길어서 일부만 예시로 남깁니다) ...
    "서적 탐지": { grade: 3, desc: "원하는 키워드의 책을 찾을 수 있게 해준다.", mp_cost: 10, effect: function(p, t) { p?.cb?.logMessage?.("책을 찾기 시작합니다."); } },
    "상급 서적 탐지": { grade: 2, desc: "보안 등급이 높은 책을 찾을 수 있게 해준다.", mp_cost: 50, effect: function(p, t) { p?.cb?.logMessage?.("고급 정보를 찾기 시작합니다."); } },
    "왜곡": { grade: 3, desc: "미궁의 부산물을 도시로 가져갈 수 있게 한다.", mp_cost: 30, effect: function(p, t) { p?.cb?.logMessage?.("아이템에 왜곡 마법을 겁니다."); } },
    "결속": { grade: 3, desc: "파티원들이 미궁 시작 시 같은 위치에서 시작하고 경험치를 공유한다.", mp_cost: 15, effect: function(p, t) { p?.cb?.logMessage?.("파티원과 결속을 맺었습니다."); } },
    "빛구체": { grade: 5, desc: "빛을 생성하여 주변을 밝힌다.", mp_cost: 5, effect: function(p, t) { p?.cb?.logMessage?.("빛구체를 생성하여 시야를 확보했다."); } },
    "마력시": { grade: 9, desc: "마법사의 기본 공격. 영체 공격 가능.", mp_cost: 1, dmg: 5, type: "magic", effect: function(p, t) { if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; } const dmg = Math.floor(Math.max(1, 5 - (t.magic_def || 0))); if (t.hp) t.hp = Math.max(0, t.hp - dmg); p?.cb?.logMessage?.(`마력시로 ${t?.name || '대상'}에게 ${dmg}의 마법 피해! (HP: ${t?.hp})`); } },
    "힐": { grade: 4, desc: "대상의 체력을 회복시킨다.", mp_cost: 15, effect: function(p, t) { let healTarget = t || p; if (!healTarget) return; const healAmount = 30 + Math.floor((p?.stats?.["정신력"] || 10) / 2); if(healTarget.hp) healTarget.hp = Math.min(healTarget.maxHp || 99999, healTarget.hp + healAmount); p?.cb?.logMessage?.(`${healTarget === p ? '자신' : healTarget.name}의 체력을 ${healAmount} 회복했다.`); } },
    "신성 불꽃": { grade: 5, desc: "태양 마법. 디버프 해제 및 악 속성에게 피해.", mp_cost: 30, dmg: 50, type: "magic", effect: function(p, t) { (t || p)?.removeAllDebuffs?.(); if (t) { const dmg = Math.floor(Math.max(1, 50 - (t.magic_def || 0))); if (t.hp) t.hp = Math.max(0, t.hp - dmg); } p?.cb?.logMessage?.("신성한 불꽃이 디버프를 태우고 악을 정화했다!"); } }
    // ... (data_core.js의 magic 객체 전체를 여기에 복사) ...
};

// 2. data_content.js에서 가져온 함수 포함 객체
export const items = {
    // (data_content.js의 items 객체 전체를 여기에 복사)
    // ... (너무 길어서 일부만 예시로 남깁니다) ...
    "포션": {desc: "체력을 50 회복한다.", price: 100, type: "소모품", effect: function(p) { p.hp = Math.min(p.maxHp, p.hp + 50); }},
    "상급 포션": {desc: "체력을 150 회복한다.", price: 500, type: "소모품", effect: function(p) { p.hp = Math.min(p.maxHp, p.hp + 150); }},
    "식량": {desc: "포만감을 30 회복한다.", price: 50, type: "소모품", effect: function(p) { p.satiety = Math.min(100, p.satiety + 30); p.cb.logMessage("식량을 먹어 허기를 달랬다."); }},
    "붕대": {desc: "출혈 상태이상을 제거한다.", price: 30, type: "소모품", effect: function(p) { p.debuffs = p.debuffs.filter(d => !d.startsWith("출혈")); p.cb.logMessage("붕대로 상처를 감쌌다."); }},
    "해독제": {desc: "독 상태이상을 제거한다.", price: 50, type: "소모품", effect: function(p) { p.debuffs = p.debuffs.filter(d => !d.startsWith("독")); p.cb.logMessage("해독제를 마셨다."); }},
    "꿈꾸는 영혼": {desc: "영혼의 요새 히든 피스. 10레벨 도달 시 경험치 10000 획득.", type: "소모품", effect: function(p) { p.cb.logMessage("꿈꾸는 영혼을 얻었다! 10레벨이 되면 강력한 힘을 얻을 수 있을 것이다."); /* (classes.js에서 실제 로직 구현 필요) */ }}
    // ... (data_content.js의 items 객체 전체를 여기에 복사) ...
};

export const numbersItems = {
    // (data_content.js의 numbersItems 객체 전체를 여기에 복사)
    "초심자의 행운": {no: 9999, type: "부적", desc: "첫 사냥 몬스터 정수 드랍률 +5% (귀속)", effect: function(p) { p.dropRateBonus += 0.05; p.cb.logMessage("초심자의 행운 부적 효과가 적용되었다!"); }},
    "시체술사의 기만": {no: 7661, type: "팔찌", desc: "죽음에 달하는 피해 시 가사상태(피해 면역) (3회).", type: "소모품", effect: (p) => { p.cb.logMessage("시체술사의 기만이 죽음의 순간 당신을 보호했다!"); }},
    "두 번째 심장": {no: 3120, type: "소모품", desc: "심장 즉사 피해 시 일정 시간 절대 보호 (1회).", effect: (p) => { p.cb.logMessage("두 번째 심장이 뛰기 시작하며 죽음의 위협으로부터 보호한다!"); }}
    // ... (data_content.js의 numbersItems 객체 전체를 여기에 복사) ...
};

export const npcs = {
    // (data_content.js의 npcs 객체 전체를 여기에 복사)
    "이한수": {dialog: "이 게임... 만만하게 보면 안 돼. 히든 피스를 찾는 게 중요해.", action: function(p) { p.cb.logMessage("이한수: 경험치는 첫 사냥 때만 주니, 다양한 몬스터를 잡고 정수를 모으는 게 핵심이야."); }},
    "이백호": {dialog: "기록석에는 이 세계의 모든 역사가 담겨있지. 심지어 미래까지도... 하지만 운명은 바뀔 수 있다네.", action: function(p) { p.cb.logMessage("이백호: 창세보구가 사라진 건 왕가 짓일지도 몰라. 놈들은 심연의 문이 열리는 걸 원치 않거든."); }},
    "탐험가 길드 접수원": {dialog: "무슨 일로 오셨나요? 퀘스트 수락, 파티 결속, 정보 구매, 동료 모집이 가능합니다.", action: function(p) { /* 길드 메뉴 로직 (ui_city.js handleCityAction) */ }},
    "도서관 사서 라그나": {dialog: "찾는 책이 있다면 '서적 탐지' 마법으로 찾아드릴 수 있습니다. 수수료는 3천 스톤입니다.", action: function(p) {
        if (p.gold < 3000) {
             p.cb.logMessage("라그나: 안타깝지만 수수료가 부족하시군요.");
             return;
        }
        const keyword = prompt("찾고 싶은 책의 키워드를 입력하세요 (수수료 3000 스톤):");
        if(keyword) {
             p.gold -= 3000;
             p.cb.logMessage(`라그나: "'${keyword}'... 좋습니다. '서적 탐지' 마법을 사용합니다.`);
            setTimeout(() => {
                 const foundBooks = ["미궁의 역사 제 3권", "고대 마법 이론", "정수 백과사전 상권"];
                 p.cb.logMessage(`'${keyword}' 관련 서적: ${foundBooks[Math.floor(Math.random()*foundBooks.length)]}`);
            }, 1500);
        }
    }},
    "상점 주인": {dialog: "어서 오세요! 필요한 물건이라도 있으신가?", action: function(p) { /* 상점 메뉴 로직 (ui_city.js handleCityAction) */ }},
    "교단 신관": {dialog: "신의 은총이 함께하길... 치료나 정수 삭제가 필요하신가요? 정수 삭제 비용은 500만 스톤부터 시작합니다.", action: function(p) { /* 교단 메뉴 로직 (ui_city.js handleCityAction) */ }},
    "에르웬": {dialog: "당신... 나와 같은 '집착'을 가지고 있군요. 위험하지만... 매력적인 힘이죠.", action: function(p) { p.cb.logMessage("에르웬에게서 강렬한 집착의 기운을 느꼈다."); p.stats["집착"] = (p.stats["집착"] || 0) + 10; p.showStatus(); }},
    "대장장이": {dialog: "뭘 도와줄까? 제작, 수리, 강화 다 가능해.", action: function(p) { /* 대장간 메뉴 로직 (ui_city.js handleCityAction) */ }},
    "주점 주인": {dialog: "어서와! 시원한 맥주 한 잔 어때?", action: function(p) { /* 주점 메뉴 로직 (ui_city.js handleCityAction) */ }},
    "여관 주인": {dialog: "편히 쉬다 가세요. 하룻밤에 200 스톤입니다.", action: function(p) { /* 여관 메뉴 로직 (ui_city.js handleCityAction) */ }}
};

// [수정] essences 객체는 이 파일에서 제거되고, 
// essences_functional_1-3.js, essences_functional_4-6.js, essences_functional_7-9.js 파일로 분리되었습니다.
// export const essences = { ... }; // <- 이 블록이 제거됨