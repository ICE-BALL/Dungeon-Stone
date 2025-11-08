// 파일: class_npc.js
// [수정] 겜바바 설정.txt 기반 calculateStats 함수 적용
// [수정] 고등급 NPC(4등급 이하) 생성 시 정수 1~2개 랜덤 보유
// [수정] addEssence/applyEssenceEffect 함수 추가 (정수 획득 기능)

// 1. 공용 유틸리티 임포트
import { helpers } from './class_helpers.js';

// 2. NPC 클래스 (기존 classes.js 내용)
export class NPC {
    // [확장 계획 1] 생성자에 trait 추가
    constructor(name, race, grade, callbacks, trait) {
        this.name = name;
        this.race = race;
        this.grade = grade;
        this.cb = callbacks; // main.js의 gameCallbacks 객체
        /* AUTO-FIX: added guard for this.gameData to avoid TypeError when undefined */
        this.gameData = callbacks?.gameData || {}; // JSON 데이터 바로가기

        // 등급별 스탯 배율 (등급 간 차이 크게)
        const gradeMultiplier = Math.max(1, 6 - Math.floor(grade / 1.8)); // 9등급=1배, 1등급=약 5배
        /* AUTO-FIX: added guard for this.gameData.races to avoid TypeError */
        const baseStats = (this.gameData.races && this.gameData.races[race]) ? JSON.parse(JSON.stringify(this.gameData.races[race].base_stats)) : {"근력": 8, "민첩성": 8, "지구력": 8, "정신력": 8};
        
        this.stats = {}; // 기본 스탯
        /* AUTO-FIX: added guard for this.gameData.statsList to avoid TypeError */
        const npcStatsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
        npcStatsList.forEach(stat => this.stats[stat.name] = 0);
        
        for (const stat in baseStats) {
            if (this.stats.hasOwnProperty(stat)) {
                this.stats[stat] = Math.floor(baseStats[stat] * gradeMultiplier * (0.8 + Math.random() * 0.4));
            }
        }

        // [확장 계획 1] 특성(직업) 설정
        this.trait = trait || "전사"; 
        this.skills = [];

        // [확장 계획 1] 마법사/신관 NPC는 기본 스킬 보유
        if (this.trait === "마법사") {
            this.skills.push({ 
                name: "마력시", 
                cost: 1, 
                effect: (caster, target) => {
                    const dmg = Math.max(1, Math.floor((caster.currentStats['정신력'] || 8) * 1.0 - (target?.magic_def || 0))); 
                    if (target) helpers.safeHpUpdate(target, -dmg); 
                    caster.cb?.logMessage(`${caster.name}의 마력시! ${target?.name || '대상'}에게 ${dmg}의 마법 피해! (HP: ${target?.hp})`);
                } 
            });
        } else if (this.trait === "신관") {
             this.skills.push({ 
                name: "힐", 
                cost: 15, 
                effect: (caster, target) => { 
                    const healAmount = 30 + Math.floor((caster?.currentStats?.["정신력"] || 10) * 1.5);
                    if(target.hp) target.hp = Math.min(target.maxHp || 99999, target.hp + healAmount); 
                    caster.cb.logMessage(`${caster.name}이(가) ${target.name}의 체력을 ${healAmount} 회복했다.`);
                } 
            });
        }
        else {
            // 전사 기본 스킬 (기존 로직)
            this.skills.push({ 
                name: "강타", 
                cost: 3, 
                effect: (caster, target) => { 
                    const dmg = Math.max(1, Math.floor((caster.currentStats['근력'] || 8) * 1.2 - (target?.def || 0))); 
                    if (target) helpers.safeHpUpdate(target, -dmg); 
                    caster.cb?.logMessage(`${caster.name}의 강타! ${target?.name || '대상'}에게 ${dmg}의 물리 피해! (HP: ${target?.hp})`);
                } 
            });
        }


        this.level = Math.max(1, Math.floor((10 - grade) * 1.5));
        this.exp = 0;

        this.equipment = {투구: null, 갑옷: null, 장갑: null, 각반: null, 무기: null, 부무기: null};
        this.inventory = [];
        this.essences = []; // [확장 계획 1] 정수 배열
        
        // [신규] 고등급 동료(4등급 이하)는 정수 1~2개 보유
        if (this.grade <= 4) {
            const essenceCount = (this.grade <= 2) ? 2 : 1; // 1-2등급은 2개, 3-4등급은 1개
            const allEssences = Object.keys(this.gameData.essences || {});
            const appropriateEssences = allEssences.filter(key => {
                const essGrade = this.gameData.essences[key].grade;
                return essGrade >= 4 && essGrade <= 9; // 4~9등급 정수 중에서만
            });
            
            for(let i=0; i<essenceCount; i++) {
                if(appropriateEssences.length > 0) {
                    const randIndex = Math.floor(Math.random() * appropriateEssences.length);
                    const essenceName = appropriateEssences.splice(randIndex, 1)[0];
                    if(essenceName) this.addEssence(essenceName, false); // (로그 없이 추가)
                }
            }
        }
        
        this.currentStats = { ...this.stats }; // 최종 계산된 스탯

        this.updateMaxStats();
        this.hp = this.maxHp;
        this.mp = this.maxMp;

        this.affinity = 0; // 플레이어와의 호감도
        this.debuffs = [];
    }

    // [신규] NPC용 스탯 계산 (플레이어와 동일)
    calculateStats() {
        const newStats = { ...this.stats }; // 1. 기본 스탯

        // 2. 장비 스탯 합산
        for (const slot in this.equipment) {
            const itemName = this.equipment[slot];
            if (itemName) {
                const itemData = (this.gameData.items && this.gameData.items[itemName]) || 
                               (this.gameData.numbersItems && this.gameData.numbersItems[itemName]) || 
                               (this.gameData.shopItems && this.gameData.shopItems[itemName]);
                if (itemData && itemData.stats) {
                    for (const stat in itemData.stats) {
                        if (newStats.hasOwnProperty(stat)) {
                            newStats[stat] = (newStats[stat] || 0) + itemData.stats[stat];
                        }
                    }
                }
            }
        }

        // 3. 정수 기본 스탯 합산
        for (const essenceName of this.essences) {
            const essenceData = (this.gameData.essences && this.gameData.essences[essenceName]);
            if (essenceData && essenceData.stats) {
                for (const stat in essenceData.stats) {
                    if (newStats.hasOwnProperty(stat)) {
                        newStats[stat] = (newStats[stat] || 0) + essenceData.stats[stat];
                    }
                }
            }
        }
        
        // 4. [신규] 정수 패시브 스탯 적용
        for (const essenceName of this.essences) {
             const essenceData = (this.gameData.essences && this.gameData.essences[essenceName]);
             if (essenceData && essenceData.passive) {
                 const passives = helpers.toArray(essenceData.passive);
                 passives.forEach(passive => {
                    // (플레이어와 동일한 패시브 로직 적용)
                    if (passive.name === "석화 피부") { // 스톤골렘
                        newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                        newStats['민첩성'] = (newStats['민첩성'] || 0) - 5;
                    }
                    if (passive.name === "육체보존") { // 데스핀드
                        newStats['자연 재생력'] = (newStats['자연 재생력'] || 0) + 10;
                    }
                    // ... 기타 모든 스탯 패시브 ...
                 });
             }
        }
        
        // 5. 버프/디버프 스탯 적용
        if (this.debuffs?.includes("광분(3턴)")) {
            newStats['근력'] = (newStats['근력'] || 0) + 15;
            newStats['민첩성'] = (newStats['민첩성'] || 0) + 10;
        }
        
        // 6. [신규] 백분율(%) 스탯 최종 적용 (예: 근질량)
        if (newStats['근질량'] > 0) {
            newStats['근력'] += Math.floor(newStats['근력'] * (newStats['근질량'] / 100));
        }

        this.currentStats = newStats; // 최종 스탯 갱신
        this.updateMaxStats(); // 스탯 기반 HP/MP 갱신
    }

    updateMaxStats() {
        // [문법 수정] 대괄호 표기법 사용
        this.maxHp = (this.currentStats["지구력"] || 8) * 6 + (this.level * 15);
        this.maxMp = (this.currentStats["영혼력"] || 5) + (this.currentStats["정신력"] || 8) * 4;
        
        this.hp = Math.min(this.hp, this.maxHp);
        this.mp = Math.min(this.mp, this.maxMp);
    }

    // [신규] NPC용 정수 추가/적용
    addEssence(essenceName, showLog = true) {
        if (this.essences.length >= this.level * 3) { // NPC도 동일한 제한
            if (showLog) this.cb?.logMessage(`${this.name}의 최대 정수 흡수량(${this.level * 3}개)을 초과했습니다.`);
            return;
        }
        const essenceData = (this.gameData.essences && this.gameData.essences[essenceName]);
        if (!essenceData) {
            if (showLog) this.cb?.logMessage(`오류: '${essenceName}' 정수를 찾을 수 없습니다.`);
            return;
        }

        if (this.essences.includes(essenceName)) {
             if (showLog) this.cb?.logMessage(`${this.name}은(는) 이미 ${essenceName} 정수를 흡수했습니다.`);
             return;
        }

        this.essences.push(essenceName);
        if (showLog) this.cb?.logMessage(`${this.name}이(가) ${essenceName} 정수를 흡수했다.`);
        this.applyEssenceEffect(essenceData, showLog);
        this.calculateStats(); // 스탯 재계산
    }
    
    applyEssenceEffect(essence, showLog = true) {
        if (essence.active) {
            const skillsToAdd = helpers.toArray(essence.active);
            skillsToAdd.forEach(skill => {
                if (!this.skills.find(s => s.name === skill.name)) {
                    // [수정] data_functional.js에 병합된 effect 함수를 참조하기 위해 이름만 저장하지 않고 스킬 객체 전체를 복사
                    // (단, effect 함수 자체는 main.js의 GameData.essences에 병합된 것을 참조해야 함)
                    // -> class_player_combat.js에서 NPC 스킬을 사용할 때, GameData에서 effect 함수를 다시 찾아야 함.
                    // -> [로직 변경] skill 객체 전체를 복사 (effect 함수 포함)
                    
                    const functionalSkill = this.gameData.essences[essence.name]?.active.find(s => s.name === skill.name) || skill;

                    this.skills.push({ ...functionalSkill, fromEssence: essence.name });
                    if (showLog) this.cb?.logMessage(`${this.name}이(가) 정수 스킬 '${skill.name}'을 배웠다.`);
                }
            });
        }
        // (패시브 효과는 calculateStats에서 직접 적용)
    }
    
    // NPC용 장비 장착 (플레이어와 유사)
    equipItem(itemName) {
        const itemData = (this.gameData.items && this.gameData.items[itemName]) || 
                       (this.gameData.numbersItems && this.gameData.numbersItems[itemName]) || 
                       (this.gameData.shopItems && this.gameData.shopItems[itemName]);
        if (!itemData || !itemData.type || !this.equipment.hasOwnProperty(itemData.type)) {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage(`${this.name}이(가) ${itemName}을(를) 장착할 수 없습니다.`);
            return;
        }
        
        const slot = itemData.type;
        this.unequipItem(slot); // 기존 장비 해제
        this.equipment[slot] = itemName;
        
        // 인벤토리에서 제거
        const index = this.inventory.indexOf(itemName);
        if (index > -1) this.inventory.splice(index, 1);
        
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage(`${this.name}이(가) ${itemName}을(를) ${slot}에 장착했다.`);
        this.calculateStats();
    }

    unequipItem(slot) {
        const oldItem = this.equipment[slot];
        if (oldItem) {
            this.inventory.push(oldItem); // 인벤토리로 이동
            this.equipment[slot] = null;
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage(`${this.name}이(가) ${oldItem} 장착을 해제했다.`);
            this.calculateStats();
        }
    }

    attack(target) {
        if (!target) return;
        // [문법 수정] 대괄호 표기법 사용
        let defense = target.def ?? target.currentStats?.['물리 내성'] ?? 0;
        let dmg = helpers.calculateDamage(this.currentStats['근력'] || 10, defense);
        
        helpers.safeHpUpdate(target, -dmg);
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage(`${this.name}의 공격! ${target.name || '플레이어'}에게 ${dmg}의 피해. (${target.name || '플레이어'} HP: ${target.hp})`);
    }

    // [확장 계획 1] 신관 AI는 Player.partyTurn에서 처리하므로 이 함수는 범용성 유지
    useSkill(target) {
        if (!target || target.hp <= 0) {
             this.attack(null); // 대상 없으면 공격 시도 안 함
            return;
        }

        if (this.skills.length === 0) {
            this.attack(target);
            return;
        }

        // 힐 스킬 등 아군 대상 스킬 제외 (partyTurn에서 별도 처리)
        const availableSkills = this.skills.filter(skill => 
            (skill.cost || 0) <= this.mp &&
            !skill.name.includes("힐") && 
            !skill.name.includes("치유")
        );
        
        if (availableSkills.length === 0) {
            this.attack(target); // MP 부족 또는 공격 스킬 없으면 기본 공격
            return;
        }

        const skillToUse = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        this.mp -= (skillToUse.cost || 0);
        /* AUTO-FIX: added optional chaining ?. for safety */
        // [신규] 전투 연출 요청 - 스킬 로그 강조
        this.cb?.logMessage(`[SKILL] ${this.name}이(가) 스킬 [${skillToUse.name}]을(를) 사용!`);

        try {
            if (typeof skillToUse.effect === 'function') {
                // 광역 스킬인지 단일 스킬인지 판단 (임시: target이 배열이면 광역)
                const isAOE = Array.isArray(target);
                skillToUse.effect(this, isAOE ? [target] : target);
            } else {
                 /* AUTO-FIX: added optional chaining ?. for safety */
                 this.cb?.logMessage(`${this.name}의 스킬 [${skillToUse.name}] 효과가 정의되지 않았습니다.`);
            }
        } catch (e) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage(`${this.name}의 스킬 사용 중 오류 발생: ${e.message}`);
             console.error(`Error in NPC skill effect (${this.name}, ${skillToUse.name}):`, e);
        }
        
         if (target) {
             // (safeHpUpdate는 effect 함수 내에서 호출됨)
         }
    }


    gainExp(amount) {
        this.exp += amount;
        /* AUTO-FIX: added guard for this.gameData.expToLevel to avoid TypeError */
        const requiredExp = (this.gameData.expToLevel && this.gameData.expToLevel[this.level]) || Infinity;
        
        while (this.level < this.gameData.maxLevelModded && this.exp >= requiredExp) {
            this.exp -= requiredExp;
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        const statKeys = Object.keys(this.stats);
        if (statKeys.length > 0) {
             for(let i=0; i<2; i++) { // NPC는 2개 랜덤 상승
                 const randomStatName = this.gameData.statsList[Math.floor(Math.random() * this.gameData.statsList.length)].name;
                 this.stats[randomStatName] = (this.stats[randomStatName] || 0) + 1;
             }
        }
        // [문법 수정] 대괄호 표기법 사용
        // [수정] 겜바바 설정.txt 기반 (5렙까지 10, 이후 30) - NPC는 절반만 적용 (임의)
        this.stats["영혼력"] = (this.stats["영혼력"] || 0) + (this.level > 5 ? 15 : 5);

        this.calculateStats(); // 스탯 재계산
        this.hp = this.maxHp; // 레벨업 시 체력/마나 완전 회복
        this.mp = this.maxMp;

        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage(`${this.name}이(가) ${this.level} 레벨이 되었다!`);
    }

    applyDebuff(debuff) {
        if (!this.debuffs.includes(debuff)) {
            this.debuffs.push(debuff);
        }
    }
}