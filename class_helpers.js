// 파일: class_helpers.js

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
     */
    safeHpUpdate: (target, amount) => {
        /* AUTO-FIX: Added null check */
        if (!target) return;

        let newHp = (target.hp || 0) + amount;

        // [패시브 구현] 사망 시 부활 패시브 체크 (플레이어 대상)
        if (target.race && newHp <= 0 && amount < 0) { // 대상이 플레이어이고 피해를 받아 죽었을 때
            // 1. 시체골렘 "시체 결합"
            /* AUTO-FIX: added optional chaining ?. for safety */
            if (target.essences?.includes("시체골렘") && !target.usedPassive_CorpseRebind) {
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
    },
    safeHpSet: (target, amount) => {
        /* AUTO-FIX: Added null check */
        if (!target) return;
        target.hp = Math.max(0, amount);
        if(target.maxHp) {
            target.hp = Math.min(target.maxHp, target.hp);
        }
    },
    calculateDamage: (base, defense) => {
        /* AUTO-FIX: Added default value for defense */
        return Math.floor(Math.max(1, base - (defense || 0)));
    }
};