// 파일: data_functional.js
// 이 파일은 JSON으로 변환할 수 없는 '함수(effect, action)'를 포함한
// 핵심 데이터 객체들을 보관합니다.
//
// [규칙 준수]
// 1. [메타데이터 분리]: 모든 [cite] 태그는 주석이 아닌 별도의 `citation` 필드로 분리되었습니다.
// 2. [문법 유효성]: 이 파일은 유효한 ES6 모듈입니다.
// 3. [런타임 안전성]: 모든 함수에 Optional Chaining(p?.cb) 및 초기화(p.stats = p.stats || {}) 검사가 적용되었습니다.
// 4. [구조적 분리]: dialog(데이터)와 action(동작)이 분리되었습니다.
// 5. [v6 수정]: magic/items의 effect가 class_helpers.js의 safeHpUpdate를 호출하도록 수정되었습니다.

import { helpers } from './class_helpers.js';

// 1. data_core.js에서 가져온 함수 포함 객체
export const races = {
    "Human": { 
        description: "균형 잡힌 스탯, 다양한 역할에 적합. 평균적인 성장과 적응력.",
        base_stats: { "근력": 10, "민첩성": 10, "지구력": 10, "정신력": 10, "행운": 5, "항마력": 5, "물리 내성": 5 },
        special: "특별 보너스나 페널티 없음. 오러, 정령술, 마법 등 모든 분야에 재능. 후반 포텐 좋음.",
        racial_skill: {
            name: "오러",
            desc: "인간 고유의 능력. 무기에 오러를 담아 공격 시 방어력과 항마력을 일부(90%) 무시합니다.",
            citation: [1683, 1684, 1685],
            effect: (p) => {
                if (p) {
                    p.aura_active = true; // class_player_combat.js의 playerAttack에서 이 플래그를 체크
                    p?.cb?.logMessage?.("무기에 오러를 집중합니다. 다음 공격이 강화됩니다.");
                    // (오러 레벨업은 훈련장 콘텐츠에서 구현)
                }
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
            citation: [1724, 1725, 1718],
            effect: (p) => {
                if (p && p.position === "Labyrinth" && Math.random() < 0.2) {
                    p?.cb?.logMessage?.("정령의 속삭임이 주변의 위험을 알려줍니다.");
                } else {
                    p?.cb?.logMessage?.("정령과 교감합니다. (정령 계약은 마탑 또는 히든 필드에서 가능합니다)");
                }
            }
        }
    },
    "Dwarf": { 
        description: "높은 근력과 지구력, 근접 탱커와 제작에 좋음. 드워프족으로 광산/대장간 친화.",
        base_stats: { "근력": 12, "민첩성": 8, "지구력": 12, "정신력": 9, "행운": 4, "골강도": 10, "물리 내성": 8 },
        special: "물리 데미지 저항과 제작 보너스. 인챈트 비용 감소. 넘버스 아이템 효율 1.5배 증가(무구의 축복).",
        citation: [1698],
        racial_skill: {
            name: "무구의 축복",
            desc: "넘버스 아이템의 효율이 1.5배 증가합니다. (패시브)",
            citation: [1698],
            effect: (p) => {
                if (!p) return;
                if (typeof p.applyDebuff === "function") {
                    p.applyDebuff("무구의 축복(강화)");
                }
                p?.calculateStats?.();
                p?.cb?.logMessage?.("드워프의 손재주가 무구를 조율합니다. (넘버스 아이템 효율 강화)");
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
            citation: [1791, 1792],
            effect: (p) => {
                if (p?.position !== "Labyrinth") {
                    p?.cb?.logMessage?.("도시의 바바리안 주술사를 찾아가 혼령각인을 받을 수 있습니다.");
                    // (ui_city.js에 '바바리안 성지' 장소 추가 필요)
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
                    p.evasionBonus = 0.3; // (임의 수치) 30% 회피 보너스
                    p?.cb?.logMessage?.("날갯짓으로 가볍게 공중에 떠오릅니다. 이번 턴 회피율이 증가합니다.");
                    if (typeof p.endTurn === "function") p.endTurn(); // 행동 소모
                } else {
                    p?.cb?.logMessage?.("날갯짓으로 주변을 빠르게 둘러봅니다.");
                }
            }
        }
    },
    "Beastman": { 
        description: "수인족, 동물적 감각. 후각과 청각 우수. 영혼수와 계약 가능.",
        base_stats: { "근력": 12, "민첩성": 12, "지구력": 12, "정신력": 7, "행운": 5, "후각": 15, "청각": 15 },
        special: "야수 변신 잠재력과 추적 능력이 뛰어나며 영혼수 계약을 통한 전투 보정이 가능하다.",
        racial_skill: {
            name: "영혼수 계약",
            desc: "영혼수와 계약하여 그 힘을 빌릴 수 있습니다. (패시브: 감각 강화)",
            citation: [1709, 1710],
            effect: (p) => {
                if (!p) return;
                p.explorationBuffs = p.explorationBuffs || {};
                p.explorationBuffs.hunterSense = Math.max(12, Number(p.explorationBuffs.hunterSense || 0) + 10);
                p.explorationBuffs.reveal = Math.max(8, Number(p.explorationBuffs.reveal || 0) + 6);
                if (p.inCombat) {
                    p.evasionBonus = Math.max(Number(p.evasionBonus || 0), 0.12);
                }
                p?.cb?.logMessage?.("영혼수 계약이 발동되어 감각이 날카로워졌습니다. (탐색/회피 강화)");
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
            citation: [1818, 1819],
            effect: (p) => {
                if (p?.inCombat && p.currentMonster) {
                    p?.cb?.logMessage?.("용언의 힘이 주변의 마력을 뒤흔듭니다!");
                    const monsters = Array.isArray(p.currentMonster) ? p.currentMonster : [p.currentMonster];
                    let affected = false;
                    monsters.forEach((monster) => {
                        if (monster?.hp > 0 && Math.random() < 0.2) { // 20% 확률로 공포
                            if(typeof monster.applyDebuff === "function") monster.applyDebuff("공포(1턴)");
                            p?.cb?.logMessage?.(`${monster.name}이(가) 공포에 질렸습니다!`);
                            affected = true;
                        }
                    });
                    if (!affected) {
                        p?.cb?.logMessage?.("...하지만 아무 일도 일어나지 않았습니다.");
                    }
                    if (typeof p.endTurn === "function") p.endTurn(); // 행동 소모
                } else {
                    p?.cb?.logMessage?.("전투 중에만 사용할 수 있습니다.");
                }
            }
        }
    }
};

export const magic = {
    // (기존 magic 객체...)
    "서적 탐지": { 
        grade: 3, 
        desc: "원하는 키워드의 책을 찾을 수 있게 해준다.", 
        mp_cost: 10, 
        effect: function(p, t) { 
            p?.cb?.logMessage?.("이 마법은 도서관 사서 라그나에게 말을 걸어 사용해야 합니다."); 
        } 
    },
    "상급 서적 탐지": { 
        grade: 2, 
        desc: "보안 등급이 높은 책을 찾을 수 있게 해준다.", 
        mp_cost: 50, 
        effect: function(p, t) { 
             p?.cb?.logMessage?.("이 마법은 도서관 사서 라그나에게 말을 걸어 사용해야 합니다."); 
        } 
    },
    "왜곡": { 
        grade: 3, 
        desc: "미궁의 부산물을 도시로 가져갈 수 있게 한다.", 
        mp_cost: 30, 
        effect: function(p, t) { 
            if (!p) return;
            const now = Number(p.worldTimeHours || 0);
            p.distortionActiveUntil = now + 24;
            if (p.position === "Labyrinth" && p.mapManager?.getCorpseAt) {
                const corpse = p.mapManager.getCorpseAt(p.x, p.y);
                if (corpse) {
                    const bonusStone = 20 + Math.floor(Math.random() * 41);
                    p.mapManager.consumeCorpseAt?.(p.x, p.y, p);
                    p.magic_stones = Math.max(0, Number(p.magic_stones || 0) + bonusStone);
                    p.addItem?.("마력결정체");
                    p?.cb?.logMessage?.(`왜곡 마법으로 ${corpse.name || "부산물"}을 봉인해 회수했습니다. (마력결정체 +1, 마석 +${bonusStone})`);
                    return;
                }
            }
            p?.cb?.logMessage?.("왜곡 표식을 전개했습니다. (24시간 동안 부산물 회수 안정화)");
        } 
    },
    "결속": { 
        grade: 3, 
        desc: "파티원들이 미궁 시작 시 같은 위치에서 시작하고 경험치를 공유한다.", 
        mp_cost: 15, 
        effect: function(p, t) { 
            p?.cb?.logMessage?.("이 마법은 탐험가 길드에서 사용해야 합니다."); 
        } 
    },
    "빛구체": { 
        grade: 5, 
        desc: "빛을 생성하여 주변을 밝힌다.", 
        mp_cost: 5, 
        effect: function(p, t) { 
            if (!p) return;
            p.explorationBuffs = p.explorationBuffs || {};
            p.explorationBuffs.illumination = Math.max(10, Number(p.explorationBuffs.illumination || 0) + 8);
            p.explorationBuffs.reveal = Math.max(6, Number(p.explorationBuffs.reveal || 0) + 4);
            p.mapManager?.updateVisibility?.();
            if (p.mapManager && typeof p.cb?.updateExplorationUI === "function") {
                p.cb.updateExplorationUI(p.mapManager);
            }
            p?.cb?.logMessage?.("빛구체를 생성해 시야를 확장했습니다. (탐험 시야/감지 강화)");
        } 
    },
    "마력시": { 
        grade: 9, 
        desc: "마법사의 기본 공격. 영체 공격 가능.", 
        mp_cost: 1, 
        dmg: 5, 
        type: "magic", 
        effect: function(p, t) { 
            if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; }
            // [수정] 스탯 기반 데미지
            const dmg = Math.floor(Math.max(1, (p?.currentStats?.['정신력'] || 8) * 1.0 - (t?.currentStats?.['항마력'] || 0)));
            // [수정] (v6) helpers.safeHpUpdate 사용 (HP바 효과를 위해 isSkillHit: true 전달)
            if (typeof t.hp === 'number') helpers.safeHpUpdate(t, -dmg, { isSkillHit: true }); 
            p?.cb?.logMessage?.(`마력시로 ${t?.name || '대상'}에게 ${dmg}의 마법 피해! (HP: ${t?.hp})`); 
        } 
    },
    "힐": { 
        grade: 4, 
        desc: "대상의 체력을 회복시킨다.", 
        mp_cost: 15, 
        citation: [2800, 2801],
        effect: function(p, t) { 
            let healTarget = t || p; 
            if (!healTarget) return;
            // [수정] 스탯 기반 힐량
            const healAmount = 30 + Math.floor((p?.currentStats?.["정신력"] || 10) * 1.5);
            // [수정] (v6) helpers.safeHpUpdate 사용
            if(typeof healTarget.hp === 'number') helpers.safeHpUpdate(healTarget, healAmount); 
            p?.cb?.logMessage?.(`${healTarget === p ? '자신' : healTarget.name}의 체력을 ${healAmount} 회복했다.`); 
        } 
    },
    "신성 불꽃": { 
        grade: 5, 
        desc: "태양 마법. 디버프 해제 및 악 속성에게 피해.", 
        mp_cost: 30, 
        dmg: 50, 
        type: "magic", 
        effect: function(p, t) { 
            if (typeof (t || p)?.removeAllDebuffs === 'function') {
                (t || p).removeAllDebuffs();
            }

            if (t && Array.isArray(t)) { // 광역 대상
                t.forEach(monster => {
                    const dmg = Math.floor(Math.max(1, 50 + (p?.currentStats?.['정신력'] || 10) - (monster?.currentStats?.['항마력'] || 0))); 
                    if (typeof monster.hp === 'number') helpers.safeHpUpdate(monster, -dmg, { isSkillHit: true }); // [수정] (v6)
                });
            } else if (t) { // 단일 대상
                const dmg = Math.floor(Math.max(1, 50 + (p?.currentStats?.['정신력'] || 10) - (t?.currentStats?.['항마력'] || 0))); 
                if (typeof t.hp === 'number') helpers.safeHpUpdate(t, -dmg, { isSkillHit: true }); // [수정] (v6)
            }
            p?.cb?.logMessage?.("신성한 불꽃이 디버프를 태우고 악을 정화했다!"); 
        } 
    },
    "화염구": {
        grade: 6,
        desc: "화염 속성 공격 마법. 적에게 화염 피해를 입힙니다.",
        mp_cost: 20,
        dmg: 40,
        type: "magic",
        effect: function(p, t) {
            if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; }
            const baseDmg = 40;
            const spiritBonus = (p?.currentStats?.['정신력'] || 10) * 0.8;
            const fireAffinity = (p?.currentStats?.['화염 감응도'] || 0) * 0.5;
            const magicDef = t?.currentStats?.['항마력'] || 0;
            const fireResist = t?.currentStats?.['화염 내성'] || 0;
            const dmg = Math.floor(Math.max(1, (baseDmg + spiritBonus + fireAffinity) * (1 - fireResist / 200) - magicDef));
            if (typeof t.hp === 'number') helpers.safeHpUpdate(t, -dmg, { isSkillHit: true });
            p?.cb?.logMessage?.(`화염구로 ${t?.name || '대상'}에게 ${dmg}의 화염 피해! (HP: ${t?.hp})`);
            // 화염 내성이 낮으면 추가 피해
            if (fireResist < 50 && Math.random() < 0.3) {
                if (typeof t.applyDebuff === 'function') t.applyDebuff("화상(3턴)");
                p?.cb?.logMessage?.("화상 상태가 되었다!");
            }
        }
    },
    "번개 화살": {
        grade: 6,
        desc: "번개 속성 공격 마법. 관통력이 높고 연쇄 피해를 입힙니다.",
        mp_cost: 25,
        dmg: 35,
        type: "magic",
        effect: function(p, t) {
            if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; }
            const baseDmg = 35;
            const spiritBonus = (p?.currentStats?.['정신력'] || 10) * 0.9;
            const lightningAffinity = (p?.currentStats?.['번개 감응도'] || 0) * 0.6;
            const magicDef = t?.currentStats?.['항마력'] || 0;
            const lightningResist = t?.currentStats?.['번개 내성'] || 0;
            const dmg = Math.floor(Math.max(1, (baseDmg + spiritBonus + lightningAffinity) * (1 - lightningResist / 200) - magicDef * 0.7));
            if (typeof t.hp === 'number') helpers.safeHpUpdate(t, -dmg, { isSkillHit: true });
            p?.cb?.logMessage?.(`번개 화살로 ${t?.name || '대상'}에게 ${dmg}의 번개 피해! (HP: ${t?.hp})`);
            // 마비 확률
            if (Math.random() < 0.2) {
                if (typeof t.applyDebuff === 'function') t.applyDebuff("마비(1턴)");
                p?.cb?.logMessage?.("번개에 감전되어 마비되었다!");
            }
        }
    },
    "얼음 창": {
        grade: 6,
        desc: "냉기 속성 공격 마법. 적의 이동을 둔화시킵니다.",
        mp_cost: 22,
        dmg: 38,
        type: "magic",
        effect: function(p, t) {
            if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; }
            const baseDmg = 38;
            const spiritBonus = (p?.currentStats?.['정신력'] || 10) * 0.85;
            const iceAffinity = (p?.currentStats?.['냉기 감응도'] || 0) * 0.55;
            const magicDef = t?.currentStats?.['항마력'] || 0;
            const iceResist = t?.currentStats?.['냉기 내성'] || 0;
            const dmg = Math.floor(Math.max(1, (baseDmg + spiritBonus + iceAffinity) * (1 - iceResist / 200) - magicDef));
            if (typeof t.hp === 'number') helpers.safeHpUpdate(t, -dmg, { isSkillHit: true });
            p?.cb?.logMessage?.(`얼음 창으로 ${t?.name || '대상'}에게 ${dmg}의 냉기 피해! (HP: ${t?.hp})`);
            // 둔화 확률
            if (Math.random() < 0.4) {
                if (typeof t.applyDebuff === 'function') t.applyDebuff("둔화(2턴)");
                p?.cb?.logMessage?.("얼음에 얼어 이동이 둔화되었다!");
            }
        }
    },
    "대지의 갑옷": {
        grade: 5,
        desc: "대지 속성 방어 마법. 물리 방어력과 대지 내성을 증가시킵니다.",
        mp_cost: 30,
        effect: function(p, t) {
            const target = t || p;
            if (!target) return;
            const duration = 5; // 5턴
            if (typeof target.applyBuff === 'function') {
                target.applyBuff("대지의 갑옷(5턴)");
                target.earthArmorBonus = {
                    def: Math.floor((p?.currentStats?.['정신력'] || 10) * 0.5),
                    earthResist: 30
                };
            }
            p?.cb?.logMessage?.(`${target === p ? '자신' : target.name}에게 대지의 갑옷을 걸었다. (물리 방어력 +${target.earthArmorBonus?.def || 0}, 대지 내성 +30)`);
        }
    },
    "치유의 빛": {
        grade: 4,
        desc: "신성 속성 치유 마법. 체력을 회복하고 일부 디버프를 제거합니다.",
        mp_cost: 20,
        effect: function(p, t) {
            const target = t || p;
            if (!target) return;
            const healAmount = 40 + Math.floor((p?.currentStats?.["정신력"] || 10) * 2.0);
            if (typeof target.hp === 'number') helpers.safeHpUpdate(target, healAmount);
            // 일부 디버프 제거
            if (target.debuffs && Array.isArray(target.debuffs)) {
                const debuffsToRemove = ["독", "화상", "출혈"];
                target.debuffs = target.debuffs.filter(d => !debuffsToRemove.some(remove => d.includes(remove)));
            }
            p?.cb?.logMessage?.(`치유의 빛으로 ${target === p ? '자신' : target.name}의 체력을 ${healAmount} 회복하고 일부 디버프를 제거했다.`);
        }
    },
    "어둠의 손아귀": {
        grade: 5,
        desc: "어둠 속성 공격 마법. 적의 정신력을 흡수합니다.",
        mp_cost: 35,
        dmg: 45,
        type: "magic",
        effect: function(p, t) {
            if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; }
            const baseDmg = 45;
            const spiritBonus = (p?.currentStats?.['정신력'] || 10) * 1.0;
            const darkAffinity = (p?.currentStats?.['어둠 감응도'] || 0) * 0.5;
            const magicDef = t?.currentStats?.['항마력'] || 0;
            const darkResist = t?.currentStats?.['어둠 내성'] || 0;
            const dmg = Math.floor(Math.max(1, (baseDmg + spiritBonus + darkAffinity) * (1 - darkResist / 200) - magicDef));
            if (typeof t.hp === 'number') helpers.safeHpUpdate(t, -dmg, { isSkillHit: true });
            // MP 흡수
            const mpDrain = Math.floor(dmg * 0.3);
            if (p && typeof p.mp === 'number') {
                p.mp = Math.min(p.maxMp || 100, (p.mp || 0) + mpDrain);
            }
            p?.cb?.logMessage?.(`어둠의 손아귀로 ${t?.name || '대상'}에게 ${dmg}의 어둠 피해! MP ${mpDrain} 흡수! (HP: ${t?.hp})`);
        }
    },
    "바람의 날개": {
        grade: 4,
        desc: "바람 속성 보조 마법. 이동 속도와 회피율을 증가시킵니다.",
        mp_cost: 15,
        effect: function(p, t) {
            const target = t || p;
            if (!target) return;
            const duration = 3; // 3턴
            if (typeof target.applyBuff === 'function') {
                target.applyBuff("바람의 날개(3턴)");
                target.windWingsBonus = {
                    evasion: 0.15,
                    speed: 0.2
                };
            }
            p?.cb?.logMessage?.(`${target === p ? '자신' : target.name}에게 바람의 날개를 걸었다. (회피율 +15%, 이동 속도 +20%)`);
        }
    },
    "독 구름": {
        grade: 5,
        desc: "독 속성 광역 마법. 범위 내 모든 적에게 독 피해를 입힙니다.",
        mp_cost: 40,
        dmg: 30,
        type: "magic",
        effect: function(p, t) {
            if (!t) { p?.cb?.logMessage?.("대상이 없습니다."); return; }
            const targets = Array.isArray(t) ? t : [t];
            targets.forEach(monster => {
                if (!monster || monster.hp <= 0) return;
                const baseDmg = 30;
                const spiritBonus = (p?.currentStats?.['정신력'] || 10) * 0.7;
                const poisonAffinity = (p?.currentStats?.['독 감응도'] || 0) * 0.4;
                const magicDef = monster?.currentStats?.['항마력'] || 0;
                const poisonResist = monster?.currentStats?.['독 내성'] || 0;
                const dmg = Math.floor(Math.max(1, (baseDmg + spiritBonus + poisonAffinity) * (1 - poisonResist / 200) - magicDef));
                if (typeof monster.hp === 'number') helpers.safeHpUpdate(monster, -dmg, { isSkillHit: true });
                // 독 상태 부여
                if (typeof monster.applyDebuff === 'function' && Math.random() < 0.6) {
                    monster.applyDebuff("독(5턴)");
                }
                p?.cb?.logMessage?.(`독 구름이 ${monster?.name || '대상'}에게 ${dmg}의 독 피해!`);
            });
        }
    },
    "차원문": {
        grade: 1,
        desc: "시공 마법. 지정한 위치로 순간이동합니다. (1등급 마법)",
        mp_cost: 100,
        effect: function(p, t) {
            if (!p) return;
            if (p.position === "Labyrinth" && p.mapManager?.getRandomFloorTile) {
                let dest = null;
                for (let i = 0; i < 24; i++) {
                    const pick = p.mapManager.getRandomFloorTile();
                    if (!pick) continue;
                    const dist = Math.abs(Number(p.x || 0) - Number(pick.x || 0)) + Math.abs(Number(p.y || 0) - Number(pick.y || 0));
                    if (dist >= 5) {
                        dest = pick;
                        break;
                    }
                }
                if (dest) {
                    p.x = dest.x;
                    p.y = dest.y;
                    p.mapManager.updateVisibility?.();
                    if (typeof p.cb?.updateExplorationUI === "function") {
                        p.cb.updateExplorationUI(p.mapManager);
                    }
                    p?.cb?.logMessage?.(`차원문을 열어 (${dest.x}, ${dest.y}) 지점으로 도약했습니다.`);
                    return;
                }
            }
            p?.cb?.logMessage?.("차원문을 열었지만 좌표가 불안정해 이동에 실패했습니다.");
        }
    },
    "차단": {
        grade: 3,
        desc: "보호 마법. 일정 시간 동안 필드 효과를 차단합니다.",
        mp_cost: 50,
        effect: function(p, t) {
            const target = t || p;
            if (!target) return;
            const duration = 10; // 10분
            if (typeof target.applyBuff === 'function') {
                target.applyBuff("차단(10분)");
                target.fieldEffectBlock = true;
            }
            p?.cb?.logMessage?.(`${target === p ? '자신' : target.name}에게 차단 마법을 걸었다. (필드 효과 차단)`);
        }
    }
};

// 2. data_content.js에서 가져온 함수 포함 객체
export const items = {
    // (기존 아이템들...)
    "포션": {
        desc: "체력을 50 회복한다.", 
        price: 100, 
        type: "소모품", 
        effect: function(p) { 
            if (p) {
                helpers.safeHpUpdate(p, 50); // [수정] (v6) helpers.safeHpUpdate 사용
                p?.cb?.logMessage("체력을 50 회복했다.");
            }
        }
    },
    "상급 포션": {
        desc: "체력을 150 회복한다.", 
        price: 500, 
        type: "소모품", 
        effect: function(p) { 
            if (p) {
                helpers.safeHpUpdate(p, 150); // [수정] (v6) helpers.safeHpUpdate 사용
                p?.cb?.logMessage("체력을 150 회복했다.");
            }
        }
    },
    "식량": {
        desc: "포만감을 30 회복한다.", 
        price: 50, 
        type: "소모품", 
        effect: function(p) { 
            if (p) {
                p.satiety = Math.min(100, (p.satiety || 0) + 30); 
                p?.cb?.logMessage("식량을 먹어 허기를 달랬다."); 
            }
        }
    },
    "건조 식량": {
        desc: "포만감을 50 회복한다. 보관 기간이 길다.",
        price: 80,
        type: "소모품",
        effect: function(p) {
            if (p) {
                p.satiety = Math.min(100, (p.satiety || 0) + 50);
                p?.cb?.logMessage("건조 식량을 먹어 허기를 달랬다.");
            }
        }
    },
    "고급 식량": {
        desc: "포만감을 80 회복하고 체력을 소량 회복한다.",
        price: 150,
        type: "소모품",
        effect: function(p) {
            if (p) {
                p.satiety = Math.min(100, (p.satiety || 0) + 80);
                const healAmount = 20;
                helpers.safeHpUpdate(p, healAmount);
                p?.cb?.logMessage("고급 식량을 먹어 허기를 달랬고 체력이 소량 회복되었다.");
            }
        }
    },
    "모닥불 키트": {
        desc: "미궁에서 설치할 수 있는 모닥불. 설치 후 쉬기로 체력과 마나를 회복할 수 있다.",
        price: 500,
        type: "설치품",
        effect: function(p) {
            if (p?.position === "Labyrinth" && p?.mapManager?.currentMap) {
                p.mapManager.startCampfirePlacement();
            } else {
                p?.cb?.logMessage("모닥불은 미궁 탐험 중에만 설치할 수 있습니다.");
            }
        }
    },
    "횃불": {
        desc: "미궁에 설치해 반경 9칸의 시야를 밝히는 횃불.",
        price: 120,
        type: "설치품",
        effect: function(p) {
            if (p?.position === "Labyrinth" && p?.mapManager?.currentMap) {
                p.mapManager.startTorchPlacement();
            } else {
                p?.cb?.logMessage("횃불은 미궁 탐험 중에만 설치할 수 있습니다.");
            }
        }
    },
    "응급 전투식량": {
        desc: "포만감을 20 회복하고 기력을 20 회복한다.",
        price: 120,
        type: "소모품",
        effect: function(p) {
            if (!p) return;
            p.satiety = Math.min(100, (p.satiety || 0) + 20);
            p.stamina = Math.min(p.maxStamina || 100, (p.stamina || 0) + 20);
            p?.cb?.logMessage("응급 전투식량을 섭취했다. (포만감 +20, 기력 +20)");
        }
    },
    "여행자 수통": {
        desc: "목을 축여 피로를 완화한다. 포만감 10, 기력 35 회복.",
        price: 140,
        type: "소모품",
        effect: function(p) {
            if (!p) return;
            p.satiety = Math.min(100, (p.satiety || 0) + 10);
            p.stamina = Math.min(p.maxStamina || 100, (p.stamina || 0) + 35);
            p?.cb?.logMessage("여행자 수통으로 갈증을 해소했다.");
        }
    },
    "성수": {
        desc: "저주를 정화하는 성스러운 물.",
        price: 300,
        type: "소모품",
        effect: function(p) {
            if (!p) return;
            const before = p.debuffs?.length || 0;
            p.debuffs = (p.debuffs || []).filter(d => !d.includes("저주"));
            const removed = before - p.debuffs.length;
            p?.cb?.logMessage(removed > 0 ? "성수로 저주를 정화했다." : "성수를 사용했지만 정화할 저주가 없었다.");
        }
    },
    "감정 스크롤": {
        desc: "미감정 장비 1개의 성능을 해독합니다.",
        price: 850,
        type: "소모품",
        effect: function(p) {
            if (!p) return;
            const identified = p.identifyRandomUnidentifiedItem?.("감정 스크롤");
            if (identified) {
                p?.cb?.logMessage?.(`[감정] ${identified}의 성능을 확인했습니다.`);
            } else {
                p?.cb?.logMessage?.("감정할 미감정 장비가 없습니다.");
            }
        }
    },
    "삽": {
        desc: "흙더미를 파헤칠 수 있는 도구.",
        price: 220,
        type: "도구",
        effect: function(p) { p?.cb?.logMessage("삽은 상호작용 오브젝트에서 자동으로 사용됩니다."); }
    },
    "곡괭이": {
        desc: "돌무더기와 광맥을 캘 수 있는 도구.",
        price: 260,
        type: "도구",
        effect: function(p) { p?.cb?.logMessage("곡괭이는 상호작용 오브젝트에서 자동으로 사용됩니다."); }
    },
    "녹슨 열쇠": {
        desc: "낡은 상자를 여는 데 쓰이는 오래된 열쇠.",
        price: 80,
        type: "소모품",
        effect: function(p) { p?.cb?.logMessage("녹슨 열쇠는 잠긴 상자 앞에서 자동으로 사용됩니다."); }
    },
    "강철 조각": {
        desc: "제작에 사용되는 기본 금속 재료.",
        price: 40,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("강철 조각은 제작/거래용 재료입니다."); }
    },
    "라이티늄": {
        desc: "희귀한 경량 금속 재료.",
        price: 900,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("라이티늄은 제작/거래용 희귀 재료입니다."); }
    },
    "마력결정체": {
        desc: "농축된 마력이 담긴 결정체. 마나를 크게 회복한다.",
        price: 1200,
        type: "소모품",
        effect: function(p) {
            if (!p) return;
            p.mp = Math.min(p.maxMp || 100, (p.mp || 0) + 250);
            p?.cb?.logMessage("마력결정체를 흡수해 영혼력을 크게 회복했다.");
        }
    },
    "붕대": {
        desc: "출혈 상태이상을 제거한다.", 
        price: 30, 
        type: "소모품", 
        effect: function(p) { 
            if (p) {
                p.debuffs = p.debuffs || [];
                p.debuffs = p.debuffs.filter(d => !d.startsWith("출혈")); 
                p?.cb?.logMessage("붕대로 상처를 감쌌다."); 
            }
        }
    },
    "해독제": {
        desc: "독 상태이상을 제거한다.", 
        price: 50, 
        type: "소모품", 
        effect: function(p) { 
            if (p) {
                p.debuffs = p.debuffs || [];
                p.debuffs = p.debuffs.filter(d => !d.startsWith("독")); 
                p?.cb?.logMessage("해독제를 마셨다."); 
            }
        }
    },
    "꿈꾸는 영혼": {
        desc: "영혼의 요새 히든 피스. 10레벨 도달 시 경험치 10000 획득.", 
        type: "소모품", 
        citation: [2412, 2413, 2414],
        effect: function(p) { 
            p?.cb?.logMessage("꿈꾸는 영혼을 흡수했다! 10레벨이 되면 강력한 힘을 얻을 수 있을 것이다.");
            // (실제 로직은 class_player_core.js의 gainExp 또는 levelUp에서 처리)
        }
    },
    "마나 포션": {
        desc: "영혼력을 50 회복한다.",
        price: 150,
        type: "소모품",
        effect: function(p) {
            if (p) {
                p.mp = Math.min(p.maxMp || 100, (p.mp || 0) + 50);
                p?.cb?.logMessage("영혼력을 50 회복했다.");
            }
        }
    },
    "상급 마나 포션": {
        desc: "영혼력을 150 회복한다.",
        price: 600,
        type: "소모품",
        effect: function(p) {
            if (p) {
                p.mp = Math.min(p.maxMp || 100, (p.mp || 0) + 150);
                p?.cb?.logMessage("영혼력을 150 회복했다.");
            }
        }
    },
    "스태미나 포션": {
        desc: "기력을 50 회복한다.",
        price: 120,
        type: "소모품",
        effect: function(p) {
            if (p) {
                p.stamina = Math.min(p.maxStamina || 100, (p.stamina || 0) + 50);
                p?.cb?.logMessage("기력을 50 회복했다.");
            }
        }
    },
    "만능 해독제": {
        desc: "모든 상태이상을 제거한다.",
        price: 200,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.removeAllDebuffs === 'function') {
                    p.removeAllDebuffs();
                } else {
                    p.debuffs = [];
                }
                p?.cb?.logMessage("만능 해독제로 모든 상태이상을 제거했다.");
            }
        }
    },
    "정신 안정제": {
        desc: "정신 수치를 일시적으로 증가시킨다.",
        price: 300,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("정신 안정(5턴)");
                }
                p?.cb?.logMessage("정신 안정제를 복용했다. (정신력 +10, 5턴)");
            }
        }
    },
    "힘의 비약": {
        desc: "근력을 일시적으로 증가시킨다.",
        price: 350,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("힘의 비약(5턴)");
                }
                p?.cb?.logMessage("힘의 비약을 복용했다. (근력 +10, 5턴)");
            }
        }
    },
    "민첩의 비약": {
        desc: "민첩성을 일시적으로 증가시킨다.",
        price: 350,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("민첩의 비약(5턴)");
                }
                p?.cb?.logMessage("민첩의 비약을 복용했다. (민첩성 +10, 5턴)");
            }
        }
    },
    "회복의 비약": {
        desc: "자연 재생력을 일시적으로 증가시킨다.",
        price: 400,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("회복의 비약(10턴)");
                }
                p?.cb?.logMessage("회복의 비약을 복용했다. (자연 재생력 +5, 10턴)");
            }
        }
    },
    "저항의 비약": {
        desc: "항마력과 물리 내성을 일시적으로 증가시킨다.",
        price: 450,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("저항의 비약(5턴)");
                }
                p?.cb?.logMessage("저항의 비약을 복용했다. (항마력 +15, 물리 내성 +15, 5턴)");
            }
        }
    },
    "행운의 부적": {
        desc: "행운을 일시적으로 증가시킨다.",
        price: 500,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("행운의 부적(10턴)");
                }
                p?.cb?.logMessage("행운의 부적을 사용했다. (행운 +20, 10턴)");
            }
        }
    },
    "은신 포션": {
        desc: "일정 시간 동안 은신 상태가 된다.",
        price: 600,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("은신(3턴)");
                    p.invisible = true;
                }
                p?.cb?.logMessage("은신 포션을 마셨다. (3턴간 은신)");
            }
        }
    },
    "투명화 스크롤": {
        desc: "일시적으로 투명해져 몬스터의 시야에서 벗어난다.",
        price: 800,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("투명화(5턴)");
                    p.invisible = true;
                }
                p?.cb?.logMessage("투명화 스크롤을 사용했다. (5턴간 투명)");
            }
        }
    },
    "기력 재생 보조 스크롤": {
        desc: "기력 재생 속도를 증가시킨다.",
        price: 1000,
        type: "소모품",
        effect: function(p) {
            if (p) {
                if (typeof p.applyBuff === 'function') {
                    p.applyBuff("기력 재생 보조(30턴)");
                }
                p?.cb?.logMessage("기력 재생 보조 스크롤을 사용했다. (기력 재생 속도 2배, 30턴)");
            }
        }
    },
    "밀 씨앗": {
        desc: "영지 경작지에 파종할 수 있는 밀 씨앗.",
        price: 120,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("영지에서 파종할 수 있는 씨앗입니다."); }
    },
    "감자 씨앗": {
        desc: "영지 경작지에 파종할 수 있는 감자 씨앗.",
        price: 170,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("영지에서 파종할 수 있는 씨앗입니다."); }
    },
    "토마토 씨앗": {
        desc: "영지 경작지에 파종할 수 있는 토마토 씨앗.",
        price: 230,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("영지에서 파종할 수 있는 씨앗입니다."); }
    },
    "약초 씨앗": {
        desc: "영지 경작지에 파종할 수 있는 약초 씨앗.",
        price: 260,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("영지에서 파종할 수 있는 씨앗입니다."); }
    },
    "밀": {
        desc: "수확한 밀. 판매하거나 가공 재료로 사용할 수 있습니다.",
        price: 90,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("가공 또는 판매 가능한 농산물입니다."); }
    },
    "감자": {
        desc: "수확한 감자. 판매하거나 식량 재료로 사용할 수 있습니다.",
        price: 140,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("가공 또는 판매 가능한 농산물입니다."); }
    },
    "토마토": {
        desc: "수확한 토마토. 판매하거나 요리 재료로 사용할 수 있습니다.",
        price: 190,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("가공 또는 판매 가능한 농산물입니다."); }
    },
    "약초 다발": {
        desc: "치유용 약초 묶음. 판매 또는 포션 제작 재료로 사용합니다.",
        price: 240,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("가공 또는 판매 가능한 농산물입니다."); }
    },
    "구리 광석": {
        desc: "미궁 광맥에서 채집한 기초 금속 광석.",
        price: 280,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    },
    "철 광석": {
        desc: "중급 광맥에서 채집되는 금속 광석.",
        price: 450,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    },
    "은 광석": {
        desc: "마법 친화도가 높은 희귀 광석.",
        price: 680,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    },
    "금 광석": {
        desc: "고가에 거래되는 귀금속 광석.",
        price: 1200,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    },
    "미스릴 광석": {
        desc: "고층 미궁에서 발견되는 희귀 경량 금속.",
        price: 1800,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    },
    "아다만타이트 광석": {
        desc: "매우 단단한 고급 광석.",
        price: 2500,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    },
    "오리할콤 광석": {
        desc: "심층에서만 발견되는 초희귀 광석.",
        price: 3500,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    },
    "문스톤 광석": {
        desc: "달빛 공명을 품은 전설급 광석.",
        price: 4200,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    },
    "스타폴 광석": {
        desc: "별의 낙하 흔적을 품은 최고급 광석.",
        price: 5500,
        type: "재료",
        effect: function(p) { p?.cb?.logMessage("채광 재료입니다. 거래소에서 판매할 수 있습니다."); }
    }
};

export const numbersItems = {
    // [신규] 겜바바 설정.txt 기반 넘버스 아이템 effect 구현
    "초심자의 행운": {
        no: 9999, 
        type: "부적", 
        desc: "첫 사냥 몬스터 정수 드랍률 +5% (귀속)", 
        citation: [2323, 2324],
        effect: function(p) { 
            p?.cb?.logMessage("초심자의 행운 부적 효과가 적용되었다! (패시브 효과)"); 
        }
    },
    "시체술사의 기만": {
        no: 7661, 
        type: "팔찌", 
        desc: "죽음에 달하는 피해 시 가사상태(피해 면역) (3회).", 
        stats: { "물리 내성": 10, "항마력": 10, "정신력": 6 },
        citation: [2227],
        effect: function(p) { 
            p?.cb?.logMessage("시체술사의 기만을 장착했다. (죽음에 달하는 피해 3회 방어) (패시브 효과)"); 
        }
    },
    "두 번째 심장": {
        no: 3120, 
        type: "소모품", 
        desc: "심장 즉사 피해 시 일정 시간 절대 보호 (1회).", 
        citation: [2233, 2234],
        effect: function(p) { 
            if (!p) return;
            p.secondHeartReady = true;
            p?.cb?.logMessage("두 번째 심장이 활성화되었습니다. 다음 즉사 피해를 1회 무효화합니다.");
        }
    },
    "수호자의 팔목 보호대": {
        no: 3112,
        type: "팔목 보호대",
        desc: "상시 대미지 감소 5%. 사용 시 적을 밀쳐내고 해로운 효과 면역.",
        stats: { "물리 내성": 16, "항마력": 12, "고통내성": 8 },
        effect: function(p) {
            if (!p) return;
            if (typeof p.removeAllDebuffs === "function") p.removeAllDebuffs();
            if (p.inCombat && Array.isArray(p.currentMonster)) {
                let pushed = 0;
                p.currentMonster.forEach((monster) => {
                    if (!monster || Number(monster.hp || 0) <= 0) return;
                    if (Math.random() < 0.45) {
                        helpers.safeApplyDebuff(monster, "기절(1턴)");
                        pushed += 1;
                    }
                });
                p?.cb?.logMessage(`수호자의 팔목 보호대가 폭발하며 ${pushed}체를 밀어냈습니다.`);
            } else {
                p?.cb?.logMessage("수호자의 팔목 보호대: 모든 해로운 효과를 정화합니다!");
            }
        }
    },
    "가르파스의 목걸이": {
        no: 7777,
        type: "목걸이",
        desc: "마석을 넣어 랜덤한 물질로 변환. (가챠 아이템)",
        stats: { "행운": 8, "인지력": 6, "정신력": 4 },
        citation: [2209, 2210],
        effect: function(p) {
            if (!p) return;
            const available = Math.max(0, Number(p.magic_stones || 0));
            const spend = Math.min(available, 400);
            if (spend <= 0) {
                p?.cb?.logMessage("가르파스의 목걸이: 변환할 마석이 부족합니다.");
                return;
            }
            p.magic_stones -= spend;
            const convertRoll = Math.random();
            if (convertRoll < 0.55) {
                const itemPool = ["마력결정체", "포션", "건조 식량", "횃불", "모닥불 키트", "붕대"];
                const count = Math.max(1, Math.floor(spend / 130));
                for (let i = 0; i < count; i++) {
                    const item = itemPool[Math.floor(Math.random() * itemPool.length)];
                    p?.addItem?.(item);
                }
                p?.cb?.logMessage(`가르파스의 목걸이: 마석 ${spend}개를 보급품으로 변환했습니다.`);
            } else if (convertRoll < 0.9) {
                const goldGain = spend * (18 + Math.floor(Math.random() * 5));
                p.gold = Math.max(0, Number(p.gold || 0) + goldGain);
                p?.cb?.logMessage(`가르파스의 목걸이: 마석 ${spend}개를 ${goldGain.toLocaleString()} 스톤으로 환전했습니다.`);
            } else {
                const numbersPool = Object.keys(p?.cb?.gameData?.numbersItems || {});
                if (numbersPool.length > 0) {
                    const pick = numbersPool[Math.floor(Math.random() * numbersPool.length)];
                    p?.addItem?.(pick);
                    p?.cb?.logMessage(`가르파스의 목걸이: 확률 변환 성공! [${pick}] 넘버스를 획득했습니다.`);
                } else {
                    p?.cb?.logMessage("가르파스의 목걸이: 희귀 변환에 실패했습니다.");
                }
            }
        }
    },
    "독사의 송곳니": {
        no: 5991,
        type: "무기", // 장착 아이템
        desc: "관통력 보너스, 중독 피해 2배.",
        stats: { "근력": 12, "물리 관통": 18, "독 감응도": 14 },
        citation: [2224],
        effect: function(p) { 
             p?.cb?.logMessage("독사의 송곳니를 장착했다. (패시브 효과)"); 
             // (실제 로직은 calculateStats와 playerAttack에서 구현)
        }
    },
    "운명 추적자": {
        no: 6111,
        type: "반지", // 장착 아이템
        desc: "주변 이벤트 발생 시 긍정(녹색)/부정(적색)/혼합(황색)으로 알려줌.",
        stats: { "육감": 18, "인지력": 10, "시각": 6 },
        citation: [2230, 2231],
        effect: function(p) { 
             p?.cb?.logMessage("운명 추적자를 장착했다. (미궁 탐색 시 랜덤 이벤트 발생)"); 
        }
    },
    "어긋난 신뢰": {
        no: 7234,
        type: "원판", // 소모품형 마도구
        desc: "반경 10m 내 거짓말 방지 (10분).",
        stats: { "정신력": 10, "통제력": 8, "인지력": 4 },
        citation: [2235],
        effect: function(p) {
            if (!p) return;
            const now = Number(p.worldTimeHours || 0);
            p.deceptionShieldUntil = now + 10;
            p?.cb?.logMessage("어긋난 신뢰: 10시간 동안 사기/협박/거짓 제안을 차단합니다.");
        }
    },
    "수호병단의 징표": {
        no: 2988,
        type: "귀걸이", // 장착 아이템
        desc: "방패에 충격 흡수 옵션 50% 부여.",
        stats: { "물리 내성": 10, "항마력": 10, "지구력": 6 },
        citation: [2236],
        effect: function(p) { 
             p?.cb?.logMessage("수호병단의 징표를 장착했다. (방패 충격 흡수 50% 패시브 적용)"); 
             // (실제 로직은 calculateStats에서 구현)
        }
    },
    "황야의 무법자": {
        no: 8667,
        type: "벨트", // 장착 아이템
        desc: "인간형 몬스터 수에 비례해 근접 물리 피해 증가.",
        stats: { "근력": 14, "민첩성": 8, "물리 관통": 8 },
        citation: [2237, 2239],
        effect: function(p) { 
             p?.cb?.logMessage("황야의 무법자를 장착했다. (인간형 몬스터 상대 시 피해 증가)"); 
        }
    },
    "용암 방패": {
        no: 4819,
        type: "부무기", // 장착 아이템
        desc: "화염 흡수 시 영혼력 회복. (패시브: 화염 내성 +30)",
        stats: { "화염 내성": 30, "물리 내성": 12, "항마력": 8 },
        citation: [2241, 2242],
        effect: function(p) { 
             p?.cb?.logMessage("용암 방패를 장착했다. (화염 내성 +30)"); 
             // (실제 로직은 calculateStats 및 피격 판정 시 구현)
        }
    },
    "철벽": {
        no: 8820,
        type: "각반", // 장착 아이템
        desc: "사용 시 3초간 물리 내성 및 항마력 2배 상승.",
        stats: { "물리 내성": 14, "항마력": 14, "지구력": 10 },
        citation: [2243],
        effect: function(p) { 
             if (typeof p?.applyDebuff === "function") p.applyDebuff("철벽(1턴)"); // 1턴(3초)간
             p?.cb?.logMessage("철벽! 1턴간 물리 내성과 항마력이 2배 상승합니다!"); 
        }
    },
    "정화의 횃불": {
        no: 8645,
        type: "소모품", // (설정상 횃불이지만 편의상 소모품으로)
        desc: "리아키스 2페이즈를 공짜로 넘길 수 있습니다.",
        citation: [2248, 846, 847],
        effect: function(p) {
            p?.cb?.logMessage("정화의 횃불을 사용합니다. (특정 보스전에서 사용)");
        }
    }
};

export const npcs = {
    // (기존 npcs 객체...)
    "이한수": {
        dialog: "이 게임... 만만하게 보면 안 돼. 히든 피스를 찾는 게 중요해.", 
        citation: [94],
        action: function(p) { 
            p?.cb?.logMessage("이한수: 경험치는 첫 사냥 때만 주니, 다양한 몬스터를 잡고 정수를 모으는 게 핵심이야."); 
        }
    },
    "이백호": {
        dialog: "기록석에는 이 세계의 모든 역사가 담겨있지. 심지어 미래까지도... 하지만 운명은 바뀔 수 있다네.", 
        citation: [2422],
        action: function(p) { 
            p?.cb?.logMessage("이백호: 창세보구가 사라진 건 왕가 짓일지도 몰라. 놈들은 심연의 문이 열리는 걸 원치 않거든."); 
        }
    },
    "탐험가 길드 접수원": {
        dialog: "무슨 일로 오셨나요? 퀘스트 수락, 파티 결속, 정보 구매, 동료 모집이 가능합니다.", 
        personalityProfile: {
            temperament: "규정 중심 실무형",
            traits: ["절차 중시", "기록 철저", "성실함"],
            likes: ["greet", "business"],
            dislikes: ["rude"]
        },
        action: function(p) { 
            p?.cb?.logMessage("탐험가 길드 접수원: (ui_city.js의 '탐험가 길드 지부' 메뉴를 이용해주세요.)");
        }
    },
    "도서관 사서 라그나": {
        dialog: "찾는 책이 있다면 '서적 탐지' 마법으로 찾아드릴 수 있습니다. 수수료는 3천 스톤입니다.", 
        citation: [2013, 2019],
        action: function(p) {
            if (p && p.gold < 3000) {
                 p?.cb?.logMessage("라그나: 안타깝지만 수수료가 부족하시군요.");
                 return;
            }
            // window.prompt는 브라우저 전역 함수이므로 cb를 통하지 않습니다.
            const keyword = prompt("찾고 싶은 책의 키워드를 입력하세요 (수수료 3000 스톤):");
            if(keyword && p) {
                 p.gold -= 3000;
                 p?.cb?.logMessage(`라그나: "'${keyword}'... 좋습니다. '서적 탐지' 마법을 사용합니다.`);
                setTimeout(() => {
                     const foundBooks = ["미궁의 역사 제 3권", "고대 마법 이론", "정수 백과사전 상권", "겜바바 설정.txt"];
                     p?.cb?.logMessage(`'${keyword}' 관련 서적: ${foundBooks[Math.floor(Math.random()*foundBooks.length)]}`);
                }, 1500);
            }
        }
    },
    "상점 주인": {
        dialog: "어서 오세요! 필요한 물건이라도 있으신가?", 
        personalityProfile: {
            temperament: "실리적 상인",
            traits: ["흥정 선호", "단골 우대", "손익 계산이 빠름"],
            likes: ["business", "gift"],
            dislikes: ["rude"]
        },
        action: function(p) { 
            p?.cb?.logMessage("상점 주인: (ui_city.js의 '상점가' 메뉴를 이용해주세요.)");
        }
    },
    "교단 신관": {
        dialog: "신의 은총이 함께하길... 치료나 정수 삭제가 필요하신가요? 정수 삭제 비용은 500만 스톤부터 시작합니다.", 
        citation: [1325],
        personalityProfile: {
            temperament: "온건한 성직자",
            traits: ["질서 중시", "정중함 선호", "신앙 중심"],
            likes: ["greet", "gift"],
            dislikes: ["rude"]
        },
        action: function(p) { 
            p?.cb?.logMessage("교단 신관: (ui_city.js의 '대신전' 메뉴를 이용해주세요.)");
        }
    },
    "에르웬": {
        dialog: "당신... 나와 같은 '집착'을 가지고 있군요. 위험하지만... 매력적인 힘이죠.", 
        citation: [40, 41, 42],
        action: function(p) { 
            p?.cb?.logMessage("에르웬에게서 강렬한 집착의 기운을 느꼈다.");
            // [규칙 3 준수] p.stats 객체가 존재하지 않을 경우를 대비해 초기화
            p.stats = p.stats || {}; 
            p.stats["집착"] = (p.stats["집착"] || 0) + 10; 
            // [규칙 3 준수] p.showStatus가 함수인지 확인
            if (typeof p.showStatus === "function") p.showStatus(); 
        }
    },
    "대장장이": {
        dialog: "뭘 도와줄까? 제작, 수리, 강화 다 가능해.", 
        citation: [2024],
        personalityProfile: {
            temperament: "과묵한 장인",
            traits: ["품질 집착", "실력 존중", "무례를 싫어함"],
            likes: ["greet", "business"],
            dislikes: ["rude"]
        },
        action: function(p) { 
             p?.cb?.logMessage("대장장이: (ui_city.js의 '대장간' 메뉴를 이용해주세요.)");
        }
    },
    "주점 주인": {
        dialog: "어서와! 시원한 맥주 한 잔 어때?", 
        citation: [2025],
        personalityProfile: {
            temperament: "사교형 정보상",
            traits: ["소문에 밝음", "재미를 좋아함", "분위기 중시"],
            likes: ["rumor", "business"],
            dislikes: ["rude"]
        },
        action: function(p) { 
            p?.cb?.logMessage("주점 주인: (ui_city.js의 '주점' 메뉴를 이용해주세요.)");
        }
    },
    "여관 주인": {
        dialog: "편히 쉬다 가세요. 하룻밤에 200 스톤입니다.", 
        citation: [2005],
        personalityProfile: {
            temperament: "친화형 관리인",
            traits: ["안전 중시", "소문 수집", "정 많은 성격"],
            likes: ["greet", "rumor", "gift"],
            dislikes: ["rude"]
        },
        action: function(p) { 
             p?.cb?.logMessage("여관 주인: (ui_city.js의 '여관' 메뉴를 이용해주세요.)");
        }
    },
    "마탑 마도사": {
        dialog: "지식은 대가를 치를수록 깊어지지요. 어떤 주문을 원합니까?",
        personalityProfile: {
            temperament: "오만한 연구자",
            traits: ["효율 중시", "지식 거래", "감정보다 성과"],
            likes: ["business", "rumor"],
            dislikes: ["rude"]
        },
        action: function(p) {
            p?.cb?.logMessage("마탑 마도사: (ui_city.js의 '마탑' 메뉴를 이용해주세요.)");
        }
    },
    "훈련 교관": {
        dialog: "정확한 자세, 반복, 그리고 회복. 그게 생존의 기본이다.",
        personalityProfile: {
            temperament: "강경한 실전파",
            traits: ["규율 강조", "행동 중시", "성과 평가형"],
            likes: ["greet", "business"],
            dislikes: ["rude"]
        },
        action: function(p) {
            p?.cb?.logMessage("훈련 교관: (ui_city.js의 '훈련장' 메뉴를 이용해주세요.)");
        }
    },
    "거래소 중개인": {
        dialog: "시세는 살아 움직입니다. 빠르게 거래할수록 유리합니다.",
        action: function(p) {
            p?.cb?.logMessage("거래소 중개인: (ui_city.js의 '알미너스 중앙 거래소' 메뉴를 이용해주세요.)");
        }
    },
    "은행 관리자": {
        dialog: "자산을 지키는 첫걸음은 분산 보관입니다.",
        action: function(p) {
            p?.cb?.logMessage("은행 관리자: (ui_city.js의 '알미너스 은행' 메뉴를 이용해주세요.)");
        }
    },
    "경매장 진행인": {
        dialog: "오늘도 귀한 넘버스들이 올라왔습니다. 자금 준비는 되셨겠죠?",
        action: function(p) {
            p?.cb?.logMessage("경매장 진행인: (ui_city.js의 '천공 경매장' 메뉴를 이용해주세요.)");
        }
    },
    "왕궁 시종장": {
        dialog: "왕궁 예법을 지키시길 바랍니다. 보고할 내용이 있다면 말씀하세요.",
        action: function(p) {
            p?.cb?.logMessage("왕궁 시종장: 왕궁 보고 체계를 통해 공적을 남길 수 있습니다.");
        }
    },
    "배급소 관리자": {
        dialog: "배급은 질서입니다. 순번대로 받으십시오.",
        action: function(p) {
            p?.cb?.logMessage("배급소 관리자: 비프론 생존 물자를 배급합니다.");
        }
    },
    "비프론 암시장 주인": {
        dialog: "싸게 줄게. 대신 질문은 하지 마.",
        action: function(p) {
            p?.cb?.logMessage("암시장 주인: 값은 싸지만 안전은 보장 못 해.");
        }
    },
    "밀수 안내인": {
        dialog: "지도에 없는 길을 원하면, 값부터 맞춥시다.",
        action: function(p) {
            p?.cb?.logMessage("밀수 안내인: 하수도 비밀 통로는 조용히 이용하세요.");
        }
    }
};

// [수정] essences 객체는 이 파일에서 제거되고, 
// essences_functional_1-3.js, essences_functional_4-6.js, essences_functional_7-9.js 파일로 분리되었습니다.
