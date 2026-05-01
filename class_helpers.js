// 파일: class_helpers.js
// [수정] (v6) safeHpUpdate: 피격 시 HP바 시각 효과(흔들림, 번쩍임)를
//        호출하기 위해 options 객체(isSkillHit)를 받도록 수정
//        및 콜백(cb.triggerHpEffect) 호출 로직 추가

/**
 * Player와 NPC가 공통으로 사용하는 유틸리티 함수 모음
 */
export const helpers = {
    toArray: (x) => (Array.isArray(x) ? x : x ? [x] : []),
    /* AUTO-FIX: added optional chaining ?. for safety */
    safeApplyDebuff: (t, name) => { if (!t) return; t.applyDebuff?.(name); },
    ensureStats: (obj) => {
        if (!obj) obj = {};
        if (!obj.stats) obj.stats = {};
        return obj;
    },
    
    /**
     * [패시브 구현] 대상의 HP를 안전하게 변경합니다.
     * '진압', '수면' 등 피격 시 해제되는 디버프를 처리합니다.
     * '시체 결합', '영혼의 함' 등 사망 시 발동하는 부활 패시브를 처리합니다.
     * [신규] (v6) 피격 시 UI 효과(흔들림, 번쩍임)를 콜백으로 요청합니다.
     * @param {object} target - HP를 변경할 대상 (Player, NPC, Monster)
     * @param {number} amount - 변경할 HP 양 (양수: 회복, 음수: 피해)
     * @param {object} [options={}] - (선택) 추가 옵션
     * @param {boolean} [options.isSkillHit=false] - 이 피해가 스킬로 인한 것인지 여부
     */
    safeHpUpdate: (target, amount, options = {}) => { // [수정] options 객체 추가
        /* AUTO-FIX: Added null check */
        if (!target) return;

        let newHp = (target.hp || 0) + amount;

        // [패시브 구현] 사망 시 부활 패시브 체크 (플레이어 대상)
        if (target.race && newHp <= 0 && amount < 0) { // 대상이 플레이어이고 피해를 받아 죽었을 때
            // 0. 넘버스 "두 번째 심장" 선적용
            if (target.secondHeartReady) {
                target.secondHeartReady = false;
                newHp = Math.max(1, Math.floor(Number(target.maxHp || 1) * 0.25));
                target.cb?.logMessage?.("[넘버스: 두 번째 심장] 즉사 피해를 차단하고 생명력을 회복합니다!");
            }
            // 0.5 넘버스 "시체술사의 기만" (장비 착용 시 3회 보호)
            else if (typeof target.hasEquippedItem === "function" && target.hasEquippedItem("시체술사의 기만")) {
                const charges = Math.max(0, Number(target.corpseDeceiverCharges ?? 3));
                if (charges > 0) {
                    target.corpseDeceiverCharges = charges - 1;
                    newHp = Math.max(1, Math.floor(Number(target.maxHp || 1) * 0.18));
                    target.cb?.logMessage?.(`[시체술사의 기만] 치명상을 무효화했습니다. (잔여 ${target.corpseDeceiverCharges}회)`);
                }
            }
            // 1. 시체골렘 "시체 결합"
            /* AUTO-FIX: added optional chaining ?. for safety */
            else if (target.essences?.includes("시체골렘") && !target.usedPassive_CorpseRebind) {
                target.usedPassive_CorpseRebind = true; // 1회용 플래그
                const healAmount = Math.floor(target.maxHp * 0.30 /* DEFAULT: 0.30 (검토 필요) */);
                newHp = healAmount; // HP를 0 대신 회복량으로 설정
                /* AUTO-FIX: replaced undefined 'caster' with 'target' (likely intent) — verify in review */
                /* AUTO-FIX: added optional chaining ?. for safety */
                target.cb?.logMessage("[패시브: 시체 결합]! 죽음의 문턱에서 시체를 흡수하여 HP를 30% 회복합니다!");
            }
            // 2. 리치 "영혼의 함"
            /* AUTO-FIX: added optional chaining ?. for safety */
            else if (target.essences?.includes("리치") && !target.usedPassive_SoulJar) {
                target.usedPassive_SoulJar = true; // 1회용 플래그
                newHp = 1; /* DEFAULT: 1 (검토 필요) */
                /* AUTO-FIX: replaced undefined 'caster' with 'target' (likely intent) — verify in review */
                /* AUTO-FIX: added optional chaining ?. for safety */
                target.cb?.logMessage("[패시브: 영혼의 함]! 영혼의 함이 파괴되며 죽음을 1회 막아냅니다!");
            }
            // 3. 종말의 기사 "기사도" (장비 파괴는 미구현, 1회 부활로 대체)
            /* AUTO-FIX: added optional chaining ?. for safety */
            else if (target.essences?.includes("종말의 기사") && !target.usedPassive_Chivalry) {
                target.usedPassive_Chivalry = true; // 1회용 플래그
                newHp = Math.floor(target.maxHp * 0.3 /* DEFAULT: 0.3 (검토 필요) */); // (임의) 30% 회복
                /* AUTO-FIX: replaced undefined 'caster' with 'target' (likely intent) — verify in review */
                /* AUTO-FIX: added optional chaining ?. for safety */
                target.cb?.logMessage("[패시브: 기사도]! 장비를 파괴하고 생명력을 회복합니다!");
            }
        }

        target.hp = Math.max(0, newHp);
        
        if(target.maxHp) {
            target.hp = Math.min(target.maxHp, target.hp);
        }

        // [신규] (v6) 피격 시 HP바 흔들림/번쩍임 효과 요청
        // amount < 0 (피해) 이고, target이 cb(콜백)을 가진 플레이어 또는 NPC일 경우
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (amount < 0 && target.cb && target.cb.triggerHpEffect) {
            
            // 1. 기본 흔들림 효과
            target.cb.triggerHpEffect(target, 'hp-shake');

            // 2. 스킬 피격 시 번쩍임 효과
            if (options.isSkillHit) {
                target.cb.triggerHpEffect(target, 'hp-flash-skill');
            }
        }
        // [신규] (v6) 수정 끝

        // [패시브 구현] 피격 시 해제되는 디버프 처리
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (amount < 0 && target.debuffs) {
            const debuffsToClear = [
                "진압(1턴)", "수면(1턴)", "수면(2턴)", 
                "석화(1턴)", "석화(2턴)", "은신(일체화)"
            ];
            const clearedDebuffs = [];
            
            target.debuffs = target.debuffs.filter(d => {
                if (debuffsToClear.includes(d)) {
                    clearedDebuffs.push(d.split('(')[0]); // "진압" 등 이름만 추출
                    return false;
                }
                return true;
            });
            
            /* AUTO-FIX: added optional chaining ?. for safety */
            if (clearedDebuffs.length > 0 && target.cb) {
                target.cb?.logMessage(`피격으로 인해 [${[...new Set(clearedDebuffs)].join(', ')}] 효과가 해제되었습니다!`);
            }
        }

        // 체력 바 갱신 누락 방지를 위해 변경 직후 UI 동기화
        if (target.cb?.updateStatusBars && target.race) {
            target.cb.updateStatusBars(target);
        }
    },
    safeHpSet: (target, amount) => {
        /* AUTO-FIX: Added null check */
        if (!target) return;
        target.hp = Math.max(0, amount);
        if(target.maxHp) {
            target.hp = Math.min(target.maxHp, target.hp);
        }
    },
    normalizeDamageType: (type = "physical") => {
        const key = String(type || "physical").toLowerCase();
        const map = {
            basic: "physical",
            slash: "physical",
            pierce: "physical",
            crush: "physical",
            physical: "physical",
            magic: "arcane",
            arcane: "arcane",
            fire: "fire",
            flame: "fire",
            ice: "ice",
            frost: "ice",
            lightning: "lightning",
            thunder: "lightning",
            poison: "poison",
            venom: "poison",
            holy: "holy",
            sacred: "holy",
            dark: "dark",
            shadow: "dark",
            earth: "earth",
            stone: "earth",
            wind: "wind"
        };
        return map[key] || key || "physical";
    },
    getDamageTypeLabel: (type = "physical") => {
        const key = helpers.normalizeDamageType(type);
        const labels = {
            physical: "물리",
            fire: "화염",
            ice: "냉기",
            lightning: "번개",
            poison: "독",
            holy: "신성",
            dark: "어둠",
            earth: "대지",
            wind: "바람",
            arcane: "비전"
        };
        return labels[key] || key;
    },
    getDamageCategory: (type = "physical") => {
        const key = helpers.normalizeDamageType(type);
        return key === "physical" ? "physical" : "magic";
    },
    getElementResistStat: (type = "physical") => {
        const key = helpers.normalizeDamageType(type);
        const map = {
            fire: "화염 내성",
            ice: "냉기 내성",
            lightning: "번개 내성",
            poison: "독 내성",
            holy: "신성 내성",
            dark: "어둠 내성",
            earth: "대지 내성",
            wind: "대지 내성",
            arcane: "항마력"
        };
        return map[key] || null;
    },
    getElementAptitudeStat: (type = "physical") => {
        const key = helpers.normalizeDamageType(type);
        const map = {
            fire: "화염 감응도",
            ice: "냉기 감응도",
            lightning: "번개 감응도",
            poison: "독 감응도",
            holy: "신성 감응도",
            dark: "어둠 감응도",
            earth: "대지 감응도",
            wind: "모든 속성 감응도",
            arcane: "모든 속성 감응도"
        };
        return map[key] || null;
    },
    inferWeaknessProfile: (entity) => {
        const weaknesses = new Set();
        const resistances = new Set();
        const name = String(entity?.name || "").toLowerCase();
        const addWeak = (type) => weaknesses.add(helpers.normalizeDamageType(type));
        const addRes = (type) => resistances.add(helpers.normalizeDamageType(type));

        if (/(이프리트|용암|화염|불|헬 하운드|라바|파이어)/.test(name)) {
            addWeak("ice");
            addRes("fire");
        }
        if (/(빙|얼음|서리|예티|아이스|한기)/.test(name)) {
            addWeak("fire");
            addRes("ice");
        }
        if (/(스톰|번개|뇌전|전기)/.test(name)) {
            addWeak("earth");
            addRes("lightning");
        }
        if (/(슬라임|독|뱀|맹독|사독)/.test(name)) {
            addWeak("fire");
            addRes("poison");
        }
        if (/(구울|데드|스켈레톤|리치|언데드|망령|레이스)/.test(name)) {
            addWeak("holy");
            addRes("dark");
            addRes("poison");
        }
        if (/(심연|어둠|암흑|그림자)/.test(name)) {
            addWeak("holy");
            addRes("dark");
        }
        if (/(신성|천사|성기사|태양)/.test(name)) {
            addWeak("dark");
            addRes("holy");
        }
        if (/(골렘|바위|거석|철갑|강철 거인)/.test(name)) {
            addWeak("lightning");
            addRes("physical");
            addRes("earth");
        }

        const attacks = Array.isArray(entity?.attacks) ? entity.attacks : [];
        const score = {};
        attacks.forEach((attack) => {
            const type = helpers.normalizeDamageType(attack?.type || "physical");
            score[type] = (score[type] || 0) + 1;
        });
        const dominant = Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (dominant === "fire") {
            addRes("fire");
            addWeak("ice");
        } else if (dominant === "ice") {
            addRes("ice");
            addWeak("fire");
        } else if (dominant === "lightning") {
            addRes("lightning");
            addWeak("earth");
        } else if (dominant === "poison") {
            addRes("poison");
            addWeak("holy");
        } else if (dominant === "dark") {
            addRes("dark");
            addWeak("holy");
        } else if (dominant === "holy") {
            addRes("holy");
            addWeak("dark");
        }

        const finalWeak = [...weaknesses].filter((type) => !resistances.has(type));
        return {
            weaknesses: finalWeak,
            resistances: [...resistances]
        };
    },
    ensureCombatProfile: (entity) => {
        if (!entity || typeof entity !== "object") return { weaknesses: [], resistances: [] };
        entity.combatProfile = entity.combatProfile || {};
        const explicitWeak = helpers.toArray(entity.weaknesses || entity.combatProfile.weaknesses).map(helpers.normalizeDamageType);
        const explicitRes = helpers.toArray(entity.resistances || entity.combatProfile.resistances).map(helpers.normalizeDamageType);
        let weaknesses = [...new Set(explicitWeak)];
        let resistances = [...new Set(explicitRes)];

        if (weaknesses.length === 0 && resistances.length === 0) {
            const inferred = helpers.inferWeaknessProfile(entity);
            weaknesses = inferred.weaknesses;
            resistances = inferred.resistances;
        }

        const resistanceSet = new Set(resistances);
        weaknesses = weaknesses.filter((type) => !resistanceSet.has(type));
        entity.combatProfile.weaknesses = weaknesses;
        entity.combatProfile.resistances = resistances;
        return entity.combatProfile;
    },
    getPhysicalPenetration: (attacker) => {
        const stats = attacker?.currentStats || attacker?.stats || {};
        const explicit = Number(stats["물리 관통"] || stats["관통력"] || 0);
        const sharp = Number(stats["절삭력"] || 0);
        const mass = Number(stats["근질량"] || 0);
        const control = Number(stats["통제력"] || 0);
        const instinct = Number(stats["육감"] || 0);
        return Math.max(0, explicit + (sharp * 0.45) + (mass * 0.35) + (control * 0.18) + (instinct * 0.12));
    },
    getMagicPenetration: (attacker, damageType = "arcane") => {
        const stats = attacker?.currentStats || attacker?.stats || {};
        const explicit = Number(stats["마법 관통"] || stats["관통력"] || 0);
        const allApt = Number(stats["모든 속성 감응도"] || 0);
        const aptStat = helpers.getElementAptitudeStat(damageType);
        const specific = aptStat ? Number(stats[aptStat] || 0) : 0;
        const mental = Number(stats["정신력"] || 0);
        const control = Number(stats["통제력"] || 0);
        return Math.max(0, explicit + (allApt * 0.52) + (specific * 0.58) + (mental * 0.22) + (control * 0.2));
    },
    getPhysicalToughness: (defender) => {
        const stats = defender?.currentStats || defender?.stats || {};
        const armor = Number(stats["물리 내성"] || defender?.def || 0);
        const bone = Number(stats["골강도"] || 0);
        const endurance = Number(stats["지구력"] || 0);
        const pain = Number(stats["고통내성"] || 0);
        return Math.max(0, (armor * 0.3) + (bone * 0.48) + (endurance * 0.24) + (pain * 0.18));
    },
    getMagicGuard: (defender, damageType = "arcane") => {
        const stats = defender?.currentStats || defender?.stats || {};
        const magicDef = Number(stats["항마력"] || defender?.magic_def || 0);
        const mental = Number(stats["정신력"] || 0);
        const resistStat = helpers.getElementResistStat(damageType);
        const specificResist = resistStat ? Number(stats[resistStat] || 0) : 0;
        const control = Number(stats["통제력"] || 0);
        return Math.max(0, (magicDef * 0.42) + (specificResist * 0.5) + (mental * 0.2) + (control * 0.2));
    },
    getElementMultiplier: (attacker, defender, damageType = "physical") => {
        const type = helpers.normalizeDamageType(damageType);
        const attackerStats = attacker?.currentStats || attacker?.stats || {};
        const defenderStats = defender?.currentStats || defender?.stats || {};
        const profile = helpers.ensureCombatProfile(defender);
        const weaknesses = new Set(profile?.weaknesses || []);
        const resistances = new Set(profile?.resistances || []);
        const resistStat = helpers.getElementResistStat(type);
        const aptStat = helpers.getElementAptitudeStat(type);

        let multiplier = 1;
        if (type !== "physical") {
            const allApt = Number(attackerStats["모든 속성 감응도"] || 0);
            const apt = aptStat ? Number(attackerStats[aptStat] || 0) : 0;
            const resist = resistStat ? Number(defenderStats[resistStat] || 0) : 0;
            const attuneBonus = Math.min(0.9, (allApt * 0.0020) + (apt * 0.0024));
            const resistPenalty = Math.max(-0.42, Math.min(0.82, resist * 0.0028));
            multiplier = multiplier + attuneBonus - resistPenalty;
        }

        let weaknessHit = false;
        let resistanceHit = false;
        if (weaknesses.has(type)) {
            multiplier *= 1.35;
            weaknessHit = true;
        }
        if (resistances.has(type)) {
            multiplier *= 0.72;
            resistanceHit = true;
        }

        multiplier = Math.max(0.15, Math.min(2.8, multiplier));
        return { multiplier, weaknessHit, resistanceHit };
    },
    calculateAdvancedDamage: ({
        attacker,
        defender,
        baseDamage = 1,
        damageType = "physical",
        extraPenetration = 0
    } = {}) => {
        const type = helpers.normalizeDamageType(damageType);
        const category = helpers.getDamageCategory(type);
        const raw = Math.max(1, Number(baseDamage || 1));
        const defenderStats = defender?.currentStats || defender?.stats || {};

        let effectiveDefense = 0;
        let penetration = 0;
        if (category === "physical") {
            const armor = Number(defenderStats["물리 내성"] || defender?.def || 0);
            const toughness = helpers.getPhysicalToughness(defender);
            penetration = helpers.getPhysicalPenetration(attacker) + Math.max(0, Number(extraPenetration || 0));
            effectiveDefense = Math.max(0, armor + (toughness * 0.55) - penetration);
        } else {
            const magicDef = Number(defenderStats["항마력"] || defender?.magic_def || 0);
            const guard = helpers.getMagicGuard(defender, type);
            penetration = helpers.getMagicPenetration(attacker, type) + Math.max(0, Number(extraPenetration || 0));
            effectiveDefense = Math.max(0, magicDef + (guard * 0.45) - penetration);
        }

        const preElementDamage = helpers.calculateDamage(raw, effectiveDefense);
        const element = helpers.getElementMultiplier(attacker, defender, type);
        const finalDamage = Math.max(1, Math.floor(preElementDamage * element.multiplier));
        return {
            finalDamage,
            damageType: type,
            category,
            penetration,
            effectiveDefense,
            weaknessHit: element.weaknessHit,
            resistanceHit: element.resistanceHit,
            elementMultiplier: element.multiplier
        };
    },
    describeCombatAffinity: (entity) => {
        const profile = helpers.ensureCombatProfile(entity);
        const weak = (profile?.weaknesses || []).map((t) => helpers.getDamageTypeLabel(t));
        const resist = (profile?.resistances || []).map((t) => helpers.getDamageTypeLabel(t));
        const weakText = weak.length > 0 ? weak.join(", ") : "없음";
        const resistText = resist.length > 0 ? resist.join(", ") : "없음";
        return `약점 ${weakText} | 내성 ${resistText}`;
    },
    calculateDamage: (base, defense) => {
        /* AUTO-FIX: Added default value for defense */
        return Math.floor(Math.max(1, base - (defense || 0)));
    }
};
