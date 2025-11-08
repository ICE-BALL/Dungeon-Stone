// 이 파일은 게임의 핵심 객체인 Player와 NPC 클래스를 정의합니다.
// [수정] handleEventEffect 함수: world_data.json의 "portal", "combat", "statCheck" 등 모든 이벤트 타입 처리 로직 추가
// [수정] 4순위 계획: 모든 '패시브 스킬'이 게임 규칙에 적용되도록 핵심 함수들 수정

// 1. 데이터 임포트 (제거)
// - main.js의 gameCallbacks.gameData를 통해 모든 데이터를 전달받습니다.

// 2. 공용 유틸리티 (data_core.js에서 이동)
const helpers = {
    toArray: (x) => (Array.isArray(x) ? x : x ? [x] : []),
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
        if (!target) return;

        let newHp = (target.hp || 0) + amount;

        // [패시브 구현] 사망 시 부활 패시브 체크 (플레이어 대상)
        if (target.race && newHp <= 0 && amount < 0) { // 대상이 플레이어이고 피해를 받아 죽었을 때
            // 1. 시체골렘 "시체 결합" [essences_grades_7-10_b1.json]
            if (target.essences?.includes("시체골렘") && !target.usedPassive_CorpseRebind) {
                target.usedPassive_CorpseRebind = true; // 1회용 플래그
                const healAmount = Math.floor(target.maxHp * 0.30);
                newHp = healAmount; // HP를 0 대신 회복량으로 설정
                target.cb.logMessage("[패시브: 시체 결합]! 죽음의 문턱에서 시체를 흡수하여 HP를 30% 회복합니다!");
            }
            // 2. 리치 "영혼의 함" 
            else if (target.essences?.includes("리치") && !target.usedPassive_SoulJar) {
                target.usedPassive_SoulJar = true; // 1회용 플래그
                newHp = 1; // 1의 HP로 부활
                target.cb.logMessage("[패시브: 영혼의 함]! 영혼의 함이 파괴되며 죽음을 1회 막아냅니다!");
            }
            // 3. 종말의 기사 "기사도" [cite: 1441] (장비 파괴는 미구현, 1회 부활로 대체)
            else if (target.essences?.includes("종말의 기사") && !target.usedPassive_Chivalry) {
                target.usedPassive_Chivalry = true; // 1회용 플래그
                newHp = Math.floor(target.maxHp * 0.3); // (임의) 30% 회복
                caster.cb.logMessage("[패시브: 기사도]! 장비를 파괴하고 생명력을 회복합니다!");
            }
        }

        target.hp = Math.max(0, newHp);
        
        if(target.maxHp) {
            target.hp = Math.min(target.maxHp, target.hp);
        }

        // [패시브 구현] 피격 시 해제되는 디버프 처리
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
            
            if (clearedDebuffs.length > 0 && target.cb) {
                target.cb.logMessage(`피격으로 인해 [${[...new Set(clearedDebuffs)].join(', ')}] 효과가 해제되었습니다!`);
            }
        }
    },
    safeHpSet: (target, amount) => {
        if (!target) return;
        target.hp = Math.max(0, amount);
        if(target.maxHp) {
            target.hp = Math.min(target.maxHp, target.hp);
        }
    },
    calculateDamage: (base, defense) => {
        return Math.floor(Math.max(1, base - (defense || 0)));
    }
};

// 3. NPC 클래스 (수정 없음 - 원본 유지)
export class NPC {
    constructor(name, race, grade, callbacks) {
        this.name = name;
        this.race = race;
        this.grade = grade;
        this.cb = callbacks; // main.js의 gameCallbacks 객체
        this.gameData = callbacks.gameData; // JSON 데이터 접근

        // 등급별 스탯 배율 (등급 간 차이 크게)
        const gradeMultiplier = Math.max(1, 6 - Math.floor(grade / 1.8)); // 9등급=1배, 1등급=약 5배
        const baseStats = this.gameData.races[race] ? JSON.parse(JSON.stringify(this.gameData.races[race].base_stats)) : {"근력": 8, "민첩성": 8, "지구력": 8, "정신력": 8};
        
        this.stats = {}; // 기본 스탯
        this.gameData.statsList.forEach(stat => this.stats[stat.name] = 0);
        for (const stat in baseStats) {
            if (this.stats.hasOwnProperty(stat)) {
                this.stats[stat] = Math.floor(baseStats[stat] * gradeMultiplier * (0.8 + Math.random() * 0.4));
            }
        }

        // 특성 및 스킬 (임시)
        this.trait = "전사"; // (임시)
        this.skills = [{ name: "강타", cost: 3, effect: (caster, target) => { const dmg = Math.max(1, Math.floor((caster.currentStats['근력'] || 8) * 1.2 - (target?.def || 0))); if (target) helpers.safeHpUpdate(target, -dmg); caster.cb.logMessage(`${caster.name}의 강타! ${target?.name || '대상'}에게 ${dmg}의 물리 피해! (HP: ${target?.hp})`);} }];

        this.level = Math.max(1, Math.floor((10 - grade) * 1.5));
        this.exp = 0;

        this.equipment = {투구: null, 갑옷: null, 장갑: null, 각반: null, 무기: null, 부무기: null};
        this.inventory = [];
        this.essences = [];
        
        this.currentStats = { ...this.stats }; // 최종 계산된 스탯

        this.updateMaxStats();
        this.hp = this.maxHp;
        this.mp = this.maxMp;

        this.affinity = 0; // 플레이어와의 호감도
        this.debuffs = [];
    }

    // NPC용 스탯 계산 (플레이어와 동일)
    calculateStats() {
        const newStats = { ...this.stats }; // 1. 기본 스탯

        // 2. 장비 스탯 합산
        for (const slot in this.equipment) {
            const itemName = this.equipment[slot];
            if (itemName) {
                const itemData = this.gameData.items[itemName] || this.gameData.numbersItems[itemName] || this.gameData.shopItems[itemName];
                if (itemData && itemData.stats) {
                    for (const stat in itemData.stats) {
                        if (newStats.hasOwnProperty(stat)) {
                            newStats[stat] += itemData.stats[stat];
                        }
                    }
                }
            }
        }

        // 3. 정수 스탯 합산
        for (const essenceName of this.essences) {
            const essenceData = this.gameData.essences[essenceName];
            if (essenceData && essenceData.stats) {
                for (const stat in essenceData.stats) {
                    if (newStats.hasOwnProperty(stat)) {
                        newStats[stat] += essenceData.stats[stat];
                    }
                }
            }
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

    // NPC용 정수 추가/적용 (플레이어와 유사)
    addEssence(essenceName) {
        if (this.essences.length >= this.level * 3) { // NPC도 동일한 제한
            this.cb.logMessage(`${this.name}의 최대 정수 흡수량(${this.level * 3}개)을 초과했습니다.`);
            return;
        }
        const essenceData = this.gameData.essences[essenceName];
        if (!essenceData) {
            this.cb.logMessage(`오류: '${essenceName}' 정수를 찾을 수 없습니다.`);
            return;
        }
        this.essences.push(essenceName);
        this.cb.logMessage(`${this.name}이(가) ${essenceName} 정수를 흡수했다.`);
        this.applyEssenceEffect(essenceData);
        this.calculateStats(); // 스탯 재계산
    }
    
    applyEssenceEffect(essence) {
        if (essence.active) {
            // [수정] active가 배열일 수 있음을 처리
            const skillsToAdd = helpers.toArray(essence.active);
            skillsToAdd.forEach(skill => {
                if (!this.skills.find(s => s.name === skill.name)) {
                    this.skills.push({ ...skill, fromEssence: essence.name });
                    this.cb.logMessage(`${this.name}이(가) 정수 스킬 '${skill.name}'을 배웠다.`);
                }
            });
        }
        // 패시브 효과 적용 로직 (필요시)
    }
    
    // NPC용 장비 장착 (플레이어와 유사)
    equipItem(itemName) {
        const itemData = this.gameData.items[itemName] || this.gameData.numbersItems[itemName] || this.gameData.shopItems[itemName];
        if (!itemData || !itemData.type || !this.equipment.hasOwnProperty(itemData.type)) {
            this.cb.logMessage(`${this.name}이(가) ${itemName}을(를) 장착할 수 없습니다.`);
            return;
        }
        
        const slot = itemData.type;
        this.unequipItem(slot); // 기존 장비 해제
        this.equipment[slot] = itemName;
        
        // 인벤토리에서 제거
        const index = this.inventory.indexOf(itemName);
        if (index > -1) this.inventory.splice(index, 1);
        
        this.cb.logMessage(`${this.name}이(가) ${itemName}을(를) ${slot}에 장착했다.`);
        this.calculateStats();
    }

    unequipItem(slot) {
        const oldItem = this.equipment[slot];
        if (oldItem) {
            this.inventory.push(oldItem); // 인벤토리로 이동
            this.equipment[slot] = null;
            this.cb.logMessage(`${this.name}이(가) ${oldItem} 장착을 해제했다.`);
            this.calculateStats();
        }
    }

    attack(target) {
        if (!target) return;
        // [문법 수정] 대괄호 표기법 사용
        let defense = target.def ?? target.currentStats?.['물리 내성'] ?? 0;
        let dmg = helpers.calculateDamage(this.currentStats['근력'] || 10, defense);
        
        helpers.safeHpUpdate(target, -dmg);
        this.cb.logMessage(`${this.name}의 공격! ${target.name || '플레이어'}에게 ${dmg}의 피해. (${target.name || '플레이어'} HP: ${target.hp})`);
    }

    useSkill(target) {
        if (!target || target.hp <= 0) {
             this.attack(null); // 대상 없으면 공격 시도 안 함
            return;
        }

        if (this.skills.length === 0) {
            this.attack(target);
            return;
        }

        const availableSkills = this.skills.filter(skill => (skill.cost || 0) <= this.mp);
        if (availableSkills.length === 0) {
            this.attack(target); // MP 부족 시 기본 공격
            return;
        }

        const skillToUse = availableSkills[Math.floor(Math.random() * availableSkills.length)];
        this.mp -= (skillToUse.cost || 0);
        this.cb.logMessage(`${this.name}이(가) 스킬 [${skillToUse.name}]을(를) 사용!`);

        try {
            if (typeof skillToUse.effect === 'function') {
                skillToUse.effect(this, target); // 대상에게 효과 적용
            } else {
                 this.cb.logMessage(`${this.name}의 스킬 [${skillToUse.name}] 효과가 정의되지 않았습니다.`);
            }
        } catch (e) {
             this.cb.logMessage(`${this.name}의 스킬 사용 중 오류 발생: ${e.message}`);
             console.error(`Error in NPC skill effect (${this.name}, ${skillToUse.name}):`, e);
        }
        
         if (target) {
             helpers.safeHpSet(target, target.hp);
         }
    }


    gainExp(amount) {
        this.exp += amount;
        const requiredExp = this.gameData.expToLevel[this.level] || Infinity;
        
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
                 const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
                 this.stats[randomStat] = (this.stats[randomStat] || 0) + 1;
             }
        }
        // [문법 수정] 대괄호 표기법 사용
        this.stats["영혼력"] = (this.stats["영혼력"] || 0) + (this.level > 5 ? 15 : 5);

        this.calculateStats(); // 스탯 재계산
        this.hp = this.maxHp; // 레벨업 시 체력/마나 완전 회복
        this.mp = this.maxMp;

        this.cb.logMessage(`${this.name}이(가) ${this.level} 레벨이 되었다!`);
    }

    applyDebuff(debuff) {
        if (!this.debuffs.includes(debuff)) {
            this.debuffs.push(debuff);
        }
    }
}

// 4. 플레이어 클래스
export class Player {
    constructor(callbacks) {
        this.cb = callbacks; // UI, 유틸리티, 음악, 데이터 콜백 저장
        this.gameData = callbacks.gameData; // JSON 데이터 바로가기
        
        // [신규] 퀘스트 매니저 초기화
        this.questManager = new callbacks.QuestManagerClass(this, this.gameData);

        this.race = null;
        this.stats = {}; // 기본 스탯 (레벨업, 정수로만 증가)
        this.gameData.statsList.forEach(stat => this.stats[stat.name] = 0);
        this.specialStats = JSON.parse(JSON.stringify(this.gameData.specialStats));
        
        this.currentStats = { ...this.stats }; // 장비, 버프 포함 최종 스탯

        this.level = 1;
        this.exp = 0;
        this.hp = 100;
        this.mp = 100;
        this.stamina = 100;
        this.maxHp = 100;
        this.maxMp = 100;
        this.maxStamina = 100;
        
        this.currentLayer = 1;
        this.inventory = [];
        this.spells = [];
        this.essences = []; // 흡수한 정수 이름 목록
        this.essence_skills = []; // 정수로부터 배운 스킬 목록
        
        this.position = "라비기온 (7-13구역)";
        this.gold = 1000;
        this.magic_stones = 0;
        
        this.currentMonster = null;
        this.inCombat = false;
        this.playerTurn = true;
        this.debuffs = [];
        this.equipment = {투구: null, 갑옷: null, 장갑: null, 각반: null, 무기: null, 부무기: null};
        
        this.satiety = 100;
        this.fatigue = 0;
        this.betrayalChance = 0.01;
        this.party = []; // NPC 객체 배열
        
        this.daysInLabyrinth = 1;
        this.explorationCount = 0;
        this.currentStage = 1; // 천공의 탑 현재 층
        this.timeRemaining = 0; // 미궁 남은 시간
        this.grade = 9; // 탐험가 등급
        this.sleepCount = 0; // 하루 잠자기 횟수
        
        // [수정] killedMonsterTypes: 최초/반복 사냥 구분용
        this.killedMonsterTypes = new Set(); 
        
        // 임시 버프/플래그
        this.aura_active = false; // 인간 종족 오러 활성화
        this.evasionBonus = 0; // 비행 등으로 인한 임시 회피율 보너스
        this.criticalHitBoost = false; // 급소 공격 스킬 활성화 플래그

        // [패시브 구현] 1회용 패시브 플래그
        this.usedPassive_CorpseRebind = false; // 시체골렘 "시체 결합"
        this.usedPassive_SoulJar = false; // 리치 "영혼의 함"
        this.usedPassive_Chivalry = false; // 종말의 기사 "기사도"
    }

    chooseRace(race) {
        if (!this.gameData.races[race]) {
             this.cb.logMessage(`Error: Race "${race}" not found.`);
             return;
        }
        this.race = race;
        const base = this.gameData.races[race].base_stats;
        
        this.stats = {}; // 기존 스탯 초기화
        this.gameData.statsList.forEach(stat => this.stats[stat.name] = 0);
        Object.keys(base).forEach(k => {
            if (this.stats.hasOwnProperty(k)) {
                this.stats[k] = base[k];
            }
        });

        this.calculateStats(); // 최종 스탯 계산
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.stamina = this.maxStamina;
        this.cb.logMessage(`종족 선택: ${race}. ${this.gameData.races[race].special}`);
    }

    // [패시브 구현] 장비/정수/버프/패시브를 모두 합산한 최종 스탯 계산
    calculateStats() {
        const newStats = { ...this.stats }; // 1. 기본 스탯

        // 2. 장비 스탯 합산
        for (const slot in this.equipment) {
            const itemName = this.equipment[slot];
            if (itemName) {
                const itemData = this.gameData.items[itemName] || this.gameData.numbersItems[itemName] || this.gameData.shopItems[itemName];
                if (itemData && itemData.stats) {
                    for (const stat in itemData.stats) {
                        if (newStats.hasOwnProperty(stat)) {
                            newStats[stat] += itemData.stats[stat];
                        }
                    }
                }
            }
        }

        // 3. 정수 기본 스탯 합산
        for (const essenceName of this.essences) {
            const essenceData = this.gameData.essences[essenceName];
            if (essenceData && essenceData.stats) {
                for (const stat in essenceData.stats) {
                    if (newStats.hasOwnProperty(stat)) {
                        newStats[stat] += essenceData.stats[stat];
                    }
                }
            }
        }
        
        // [패시브 구현] 3.5. 정수 패시브 스탯 적용
        for (const essenceName of this.essences) {
             const essenceData = this.gameData.essences[essenceName];
             if (essenceData && essenceData.passive) {
                 const passives = helpers.toArray(essenceData.passive);
                 passives.forEach(passive => {
                    // 여기에 모든 스탯 관련 패시브 로직 추가
                    if (passive.name === "석화 피부") { // 스톤골렘 
                        newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                        newStats['민첩성'] = (newStats['민첩성'] || 0) - 5;
                    }
                    if (passive.name === "육체보존") { // 데스핀드 
                        newStats['자연 재생력'] = (newStats['자연 재생력'] || 0) + 10; // "많이 상승" 임의 적용
                    }
                    if (passive.name === "무쇠가죽") { // 오우거 
                        newStats['물리 내성'] = (newStats['물리 내성'] || 0) * 2;
                    }
                    if (passive.name === "영웅의 길" && this.hp <= this.maxHp * 0.5) { // 오크 히어로 
                        newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10; // (임의) 저항/내성 상승
                        newStats['항마력'] = (newStats['항마력'] || 0) + 10;
                    }
                    if (passive.name === "두꺼운 가죽") { // 반달바위곰
                        newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                    }
                    // ... 기타 모든 스탯 패시브 ...
                 });
             }
        }
        
        // 4. 버프/디버프 스탯 적용
        if (this.debuffs.includes("무기력")) {
            newStats['근력'] = Math.max(1, newStats['근력'] - 20);
        }
        if (this.debuffs.includes("광분(3턴)")) {
            newStats['근력'] = (newStats['근력'] || 0) + 15; // (임의)
            newStats['민첩성'] = (newStats['민첩성'] || 0) + 10;
        }
        if (this.debuffs.includes("열광(3턴)")) {
            newStats['물리 내성'] = Math.min(300, (newStats['물리 내성'] || 0) * 3); // [cite: 1010, 1402]
        }
        if (this.debuffs.includes("내면의 광기(3턴)")) { // [cite: 1435]
            const defenseTotal = (newStats['물리 내성'] || 0) + (newStats['항마력'] || 0);
            newStats['물리 내성'] = 0;
            newStats['항마력'] = 0;
            newStats['절삭력'] = (newStats['절삭력'] || 0) + defenseTotal;
            newStats['근력'] = (newStats['근력'] || 0) + Math.floor(defenseTotal / 2);
        }

        // ... 기타 버프/디버프 로직 ...

        this.currentStats = newStats; // 최종 스탯 갱신
        this.updateMaxStats(); // 스탯 기반 HP/MP 갱신
    }

    updateMaxStats() {
        this.maxHp = (this.currentStats["지구력"] || 10) * 8 + (this.level * 20);
        this.maxMp = (this.currentStats["영혼력"] || 10) + (this.currentStats["정신력"] || 10) * 5;
        this.maxStamina = (this.currentStats["지구력"] || 10) * 10;
        
        this.hp = Math.min(this.hp, this.maxHp);
        this.mp = Math.min(this.mp, this.maxMp);
        this.stamina = Math.min(this.stamina, this.maxStamina);
    }

    updateGrade(){
        if (this.level >= 25) this.grade = 1;
        else if (this.level >= 20) this.grade = 2;
        else if (this.level >= 15) this.grade = 3;
        else if (this.level >= 10) this.grade = 4;
        else if (this.level >= 7) this.grade = 5;
        else if (this.level >= 5) this.grade = 6;
        else if (this.level >= 3) this.grade = 7;
        else if (this.level >= 2) this.grade = 8;
        else this.grade = 9;
    }

    // [수정] 경험치 시스템 (최초 100%, 반복 10%)
    gainExp(amount, monsterName = null) {
        let expGained = amount;
        let isFirstKill = false;

        if (monsterName) {
            if (this.killedMonsterTypes.has(monsterName)) {
                // 반복 처치: 10%의 경험치 (최소 1) (겜바바 설정.txt엔 0%지만 [cite: 94] 10%로 수정)
                expGained = Math.max(1, Math.floor(amount * 0.1));
                this.cb.logMessage(`이미 처치한 ${monsterName}이므로, 경험치를 ${expGained} (10%) 획득합니다.`);
            } else {
                // 최초 처치: 100% 경험치
                expGained = amount;
                this.killedMonsterTypes.add(monsterName);
                isFirstKill = true;
                this.cb.logMessage(`${monsterName} 최초 처치! 경험치를 ${expGained} (100%) 획득합니다.`);
            }
        }
        // [신규] 퀘스트 경험치 등 monsterName이 null인 경우 100% 획득
        else {
             this.cb.logMessage(`경험치를 ${expGained} 획득합니다.`);
        }

        this.exp += expGained;
        
        // 파티원 경험치 분배 (동일하게 10% 또는 100% 적용)
        this.party.forEach(member => member.gainExp(expGained)); 

        const requiredExp = this.gameData.expToLevel[this.level] || Infinity;
        while (this.level < this.gameData.maxLevelModded && this.exp >= requiredExp) {
            this.exp -= requiredExp;
            this.levelUp();
        }
        
        this.showStatus(); // [UI] 상태 갱신
        return isFirstKill; // 최초 처치 여부 반환
    }

    levelUp() {
        this.level++;
        const statKeys = Object.keys(this.stats);
        if (statKeys.length > 0) {
             for(let i=0; i<3; i++) {
                 const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
                 this.stats[randomStat] = (this.stats[randomStat] || 0) + 1;
             }
        }

        // [문법 수정] 대괄호 표기법 [cite: 88]
        this.stats["영혼력"] = (this.stats["영혼력"] || 0) + (this.level > 5 ? 30 : 10);
        
        this.calculateStats(); // 스탯 재계산
        this.updateGrade();
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.stamina = this.maxStamina;
        
        this.cb.logMessage(`레벨 업! ${this.level} 레벨이 되었다! 영혼력이 상승하고, 최대 흡수 가능 정수가 ${this.level * 3}개로 증가했다.`); // [cite: 88]
        this.cb.playSfx('sfx-event');
        // showStatus()는 gainExp에서 호출되므로 중복 호출 필요 없음
    }

    addEssence(essenceName) {
        if (this.essences.length >= this.level * 3) { // [cite: 88]
            this.cb.logMessage(`최대 정수 흡수량(${this.level * 3}개)을 초과하여 더 이상 흡수할 수 없다.`);
            return;
        }
        
        const essenceData = this.gameData.essences[essenceName];
        if (!essenceData) {
            this.cb.logMessage(`오류: '${essenceName}' 정수를 찾을 수 없습니다.`);
            return;
        }

        if (this.essences.includes(essenceName)) { // [cite: 1323]
             this.cb.logMessage(`이미 ${essenceName} 정수를 흡수했습니다.`);
             return;
        }

        this.essences.push(essenceName);
        this.cb.logMessage(`${essenceName} 정수를 흡수했다.`);
        this.cb.playSfx('sfx-event');
        
        this.applyEssenceEffect(essenceData);
        this.calculateStats(); // [수정] 스탯 재계산
        this.showStatus(); // [UI] 상태 갱신
    }

    applyEssenceEffect(essence) {
        // [수정] 스탯 적용 (data_core가 아닌 this.stats에 직접 적용)
        if (essence.stats) {
            Object.entries(essence.stats).forEach(([stat, value]) => {
                if (this.stats.hasOwnProperty(stat)) {
                    this.stats[stat] += value;
                    this.cb.logMessage(`${stat} 스탯이 ${value > 0 ? '+' : ''}${value} 영구적으로 변경되었다.`);
                }
            });
        }

        if (essence.passive) {
            const passive = helpers.toArray(essence.passive)[0]; // 첫 번째 패시브만 우선 적용
            this.cb.logMessage(`패시브 스킬 '${passive.name}'을 얻었다: ${passive.desc}`);
        }

        if (essence.active) {
            // [수정] active가 배열일 수 있으므로 toArray 사용
            const skillsToAdd = helpers.toArray(essence.active);
            skillsToAdd.forEach(skill => {
                if (!this.essence_skills.includes(skill.name)) {
                    this.essence_skills.push(skill.name);
                    this.cb.logMessage(`액티브 스킬 '${skill.name}'을 배웠다.`);
                }
            });
        }
    }

    equipItem(itemName) {
        const itemData = this.gameData.items[itemName] || this.gameData.numbersItems[itemName] || this.gameData.shopItems[itemName];
        
        if (!itemData) {
            this.cb.logMessage(`[${itemName}] 아이템 정보를 찾을 수 없습니다.`);
            return;
        }
        
        const slot = itemData.type;
        if (!slot || !this.equipment.hasOwnProperty(slot)) {
            this.cb.logMessage(`[${itemName}](${slot}) (은)는 장착할 수 없는 아이템 타입입니다.`);
            return;
        }

        this.unequipItem(slot); // 기존 장비 해제
        
        this.equipment[slot] = itemName;

        // 인벤토리에서 제거
        const index = this.inventory.indexOf(itemName);
        if (index > -1) this.inventory.splice(index, 1);
        
        this.cb.logMessage(`${itemName}을(를) ${slot} 부위에 장착했다.`);
        this.cb.playSfx('sfx-event');
        this.calculateStats(); // 스탯 재계산
        this.showStatus(); // [UI] 상태 갱신
    }

    unequipItem(slot) {
        const oldItem = this.equipment[slot];
        if (oldItem) {
            this.inventory.push(oldItem); // 인벤토리로 이동
            this.equipment[slot] = null;
            this.cb.logMessage(`${oldItem} 장착을 해제했다.`);
            this.calculateStats(); // 스탯 재계산
            this.showStatus(); // [UI] 상태 갱신
        }
    }


    learnSpell(spell) {
        if (!this.gameData.magic[spell]) {
            this.cb.logMessage(`오류: '${spell}' 마법을 찾을 수 없습니다.`);
            return;
        }
        if (!this.spells.includes(spell)) {
            this.spells.push(spell);
            this.cb.logMessage(`${spell} 마법을 배웠다.`);
            this.cb.playSfx('sfx-event');
            this.showStatus(); // [UI] 상태 갱신
        }
    }

    addItem(item) {
        this.inventory.push(item);
        this.cb.logMessage(`${item} 아이템을 획득했다.`);
        this.cb.playSfx('sfx-event');
        this.showStatus(); // [UI] 상태 갱신
        
        // [신규] 퀘스트 진행 체크
        this.questManager.checkProgress('COLLECT', item, 1);
    }

    useItem(itemName) {
        if (!this.inventory.includes(itemName)) {
             this.cb.logMessage(`오류: 인벤토리에 ${itemName} 아이템이 없습니다.`);
             return;
        }

        const item = this.gameData.items[itemName] || this.gameData.numbersItems[itemName];
        if (item && typeof item.effect === 'function') {
            this.cb.logMessage(`${itemName}을(를) 사용했다. ${item.desc}`);
            try {
                 item.effect(this); // 아이템 효과 적용
                 if (!item.type || item.type === '소모품') {
                     const itemIndex = this.inventory.indexOf(itemName);
                     if (itemIndex > -1) {
                         this.inventory.splice(itemIndex, 1);
                     }
                 }
                 this.showStatus(); // [UI] 상태 갱신
            } catch (e) {
                this.cb.logMessage(`Error using item ${itemName}: ${e.message}`);
                 console.error(e);
            }
        } else {
            this.cb.logMessage(`${itemName} 아이템은 사용할 수 없습니다.`);
        }
    }

    /**
     * [패시브 구현] 디버프를 적용합니다.
     * "독 면역", "만독지체" 등 면역 패시브를 체크합니다.
     */
    applyDebuff(debuff) {
        // [패시브 구현] 면역 체크
        if (debuff.startsWith("독")) {
            if (this.essences.includes("홉 고블린")) { // 
                this.cb.logMessage("[패시브: 독 면역]으로 인해 하급 독 효과를 무시합니다!");
                return;
            }
            if (this.essences.includes("스닉투라")) { // 
                this.cb.logMessage("[패시브: 만독지체]로 인해 모든 독 효과를 무효화합니다!");
                return;
            }
        }
        if (debuff.startsWith("공포")) {
            if (this.currentStats["투쟁심"] >= 50) { // (임의 수치 50) [cite: 62]
                 this.cb.logMessage("[패시브: 투쟁심]으로 인해 공포 효과에 저항합니다!");
                 return;
            }
        }
        // ... 기타 면역 패시브 ...

        if (!this.debuffs.includes(debuff)) {
            this.debuffs.push(debuff);
            this.cb.logMessage(`[${debuff}] 디버프에 걸렸다!`);
            this.showStatus(); // [UI] 상태 갱신
        }
    }

    removeAllDebuffs() {
        this.debuffs = [];
        this.cb.logMessage("모든 디버프가 해제되었다.");
        this.showStatus(); // [UI] 상태 갱신
    }

    checkSatiety() {
        if (this.position === "Labyrinth") { // [cite: 4]
            this.satiety -= 1;
             if (this.satiety < 0) this.satiety = 0;

            if (this.satiety < 30 && this.satiety > 0) {
                this.cb.logMessage("허기를 느낀다... 능력치가 감소한다.");
            }
            if (this.satiety <= 0) {
                helpers.safeHpUpdate(this, -10);
                this.cb.logMessage("굶주림으로 인해 체력이 10 감소했다.");
                if (this.hp <= 0) {
                     this.cb.logMessage("굶주림으로 쓰러졌다...");
                    this.endCombat(false);
                }
            }
            this.showStatus(); // [UI] 상태 갱신
        }
    }

    checkBetrayal() {
        if (this.party.length > 0 && Math.random() < this.betrayalChance) { // [cite: 3]
            const traitorIndex = Math.floor(Math.random() * this.party.length);
            const traitor = this.party.splice(traitorIndex, 1)[0];
            this.cb.logMessage(`동료 ${traitor.name}이(가) 배신했다! 갑작스러운 공격에 큰 피해를 입었다!`);
             helpers.safeHpUpdate(this, -50);
            if (this.hp <= 0) {
                 this.cb.logMessage("배신자의 공격으로 쓰러졌다...");
                 this.endCombat(false);
            }
            this.showStatus(); // [UI] 상태 갱신
        }
    }


    startCombat(monsterNamesInput) {
        let monsterNames = helpers.toArray(monsterNamesInput);
        
        const validMonsters = monsterNames.map(name => {
            if (!this.gameData.monsters[name]) {
                this.cb.logMessage(`오류: ${name} 몬스터를 찾을 수 없습니다.`);
                return null;
            }
            const monster = JSON.parse(JSON.stringify(this.gameData.monsters[name]));
            monster.name = name;
            monster.hp = monster.hp || 50;
            monster.maxHp = monster.hp;
            monster.atk = monster.atk || 10;
            monster.def = monster.def || 5;
            monster.magic_def = monster.magic_def || 3;
            monster.grade = monster.grade || 9;
            monster.attacks = monster.attacks || [{name:"기본 공격", dmg: monster.atk, type: "physical"}];
            monster.debuffs = [];
            
            monster.currentStats = {
                '근력': monster.atk,
                '물리 내성': monster.def,
                '항마력': monster.magic_def
            };
            
            monster.applyDebuff = function(debuff) {
                 if (!this.debuffs.includes(debuff)) {
                     this.debuffs.push(debuff);
                 }
            };
            return monster;
        }).filter(m => m !== null);

        if (validMonsters.length === 0) {
             this.cb.logMessage("전투 시작 실패: 유효한 몬스터 없음");
             return;
        }

        this.currentMonster = validMonsters;
        this.inCombat = true;
        this.playerTurn = true;
        this.evasionBonus = 0; 

        this.cb.logMessage(`!! ${validMonsters.map(m => `${m.name}(${m.grade}등급)`).join(', ')}와(과) 전투 시작 !!`);
        this.cb.playMusic('bgm-combat');
        this.cb.updateCombatStatus(this);
        this.cb.updateCombatMenu(this);
    }


    handleMonsterDefeat(monster) {
        this.cb.logMessage(`${monster.name}을(를) 처치했다!`);
        
        // [신규] 퀘스트 진행 체크
        this.questManager.checkProgress('KILL', monster.name, 1);

        const gradeNum = typeof monster.grade === 'number' ? monster.grade : 9;
        let expGained = Math.max(0, (10 - gradeNum) * 10 + 5);
        
        // [수정] gainExp에서 최초/반복 여부 처리 [cite: 94]
        this.gainExp(expGained, monster.name); 

        let magicStoneAmount = Math.max(1, (10 - gradeNum) * (Math.floor(Math.random() * 5) + 1));
        this.magic_stones += magicStoneAmount;

        let droppedEssence = null;
        if (monster.essences && monster.essences.length > 0) {
            // [패시브 구현] "초심자의 행운" 드랍률 보정 [cite: 2324]
            let dropChance = 0.05 + ((10 - gradeNum) * 0.01) + ((this.currentStats["행운"] || 0) / 1000); // 기본 5% + @
            if (this.inventory.includes("초심자의 행운") && !this.killedMonsterTypes.has(monster.name)) {
                dropChance += 0.05; // 5%p 고정 증가 [cite: 2324]
                this.cb.logMessage("[패시브: 초심자의 행운] 정수 드랍률 +5% 적용!");
            }
            dropChance = Math.min(1.0, Math.max(0, dropChance));

            if (Math.random() < dropChance) {
                const essenceKey = monster.essences[Math.floor(Math.random() * monster.essences.length)];
                if (essenceKey && this.gameData.essences[essenceKey]) {
                    const essenceDisplayName = `${essenceKey} 정수`;
                    if (confirm(`[${essenceDisplayName}]을(를) 획득했습니다. 흡수하시겠습니까? (현재: ${this.essences.length}/${this.level * 3}개)`)) {
                        this.addEssence(essenceKey); // addEssence에서 showStatus 호출
                        droppedEssence = essenceDisplayName;
                    } else {
                        this.cb.logMessage(`[${essenceDisplayName}]을(를) 버렸습니다.`);
                    }
                }
            }
        }

        let droppedItem = null;
        if (monster.drops && monster.drops.length > 0 && Math.random() < 0.1) {
             const item = monster.drops[Math.floor(Math.random() * monster.drops.length)];
             if (item) {
                 droppedItem = item;
                 this.addItem(item); // addItem에서 showStatus 및 퀘스트 체크 호출
             }
        }

        this.cb.logMessage(`${monster.name} 처치 보상: 마석 ${magicStoneAmount}개`
            + (droppedEssence ? `, ${droppedEssence} (흡수됨)` : "")
            + (droppedItem ? `, ${droppedItem}` : ""));
        
        // [UI] 마석/아이템 획득 즉시 반영
        this.showStatus(); 
    }


    endCombat(victory) {
        if (!this.inCombat && this.hp > 0) return;

        const wasInCombat = this.inCombat;
        this.inCombat = false;
        this.criticalHitBoost = false; 

        if (this.hp <= 0) {
             this.cb.logMessage("패배... 모든 것을 잃고 게임을 처음부터 다시 시작합니다.");
             this.cb.stopMusic();
             setTimeout(() => location.reload(), 3000);
             return;
        }

        if (wasInCombat) {
            if (victory) {
                this.cb.logMessage("승리!");
            } else {
                 this.cb.logMessage("성공적으로 도망쳤다!");
            }
            
            if (this.position === "Labyrinth") {
                this.cb.playMusic('bgm-dungeon');
            } else {
                this.cb.playMusic('bgm-city');
            }
        }

        this.currentMonster = null;
        this.cb.updateMenu(this);
        this.showStatus();
    }


    /**
     * [패시브 구현] 플레이어의 공격 로직
     * "마비독", "독화살" 등 '공격 시' 발동 패시브 적용
     * "사형선고" 등 1회성 공격 버프 적용
     */
    playerAttack(targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;
        if (this.stamina < 1) {
             this.cb.logMessage("기력이 부족하여 공격할 수 없습니다.");
             return;
        }

        const target = this.currentMonster[targetIndex];
         if (!target || target.hp <= 0) {
             this.cb.logMessage("오류: 공격 대상이 이미 처치되었습니다.");
             this.cb.updateCombatMenu(this);
             return;
         }

        this.stamina -= 1;
        let fatiguePenalty = this.fatigue >= 100 ? 0.5 : 1;
        
        let baseDamage = this.currentStats["근력"] || 10;
        let targetDefense = target.currentStats?.['물리 내성'] || 0;
        let dmg = helpers.calculateDamage(baseDamage, targetDefense);
        dmg *= fatiguePenalty;

        let critChance = (this.currentStats["행운"] || 5) / 100;
        if (this.criticalHitBoost) {
            critChance += 0.5;
            this.cb.logMessage("급소 공격! 치명타 확률이 증가합니다!");
        }
        
        // [패시브 구현] "사형선고" (카샨) 
        if (this.debuffs.includes("사형선고(1회)")) {
            const luckBonus = (this.currentStats["행운"] || 0) / 10 * 2; // 행운 10당 200% -> 2배
            dmg *= (1 + luckBonus);
            this.cb.logMessage(`[패시브: 사형선고]! 행운 보너스로 피해량이 ${luckBonus * 100}% 증폭됩니다!`);
            this.debuffs = this.debuffs.filter(d => d !== "사형선고(1회)");
        }

        if (Math.random() < critChance) {
            dmg *= 2;
            this.cb.logMessage("치명타!");
        }
        this.criticalHitBoost = false;

        // [수정] 종족 스킬 '오러' 효과 적용 (방어력 90% 무시) [cite: 1685]
        if (this.aura_active) {
            let defense_penetration = targetDefense * 0.9; // 방어력 90% 무시
            dmg = helpers.calculateDamage(baseDamage, targetDefense - defense_penetration); // 무시된 방어력으로 데미지 재계산
            dmg *= fatiguePenalty; // 피로도 다시 적용
            this.aura_active = false;
            this.cb.logMessage("오러의 힘으로 방어력을 90% 무시합니다!");
        }
        dmg = Math.floor(dmg);

        helpers.safeHpUpdate(target, -dmg);
        this.cb.logMessage(`플레이어의 공격! ${target.name}에게 ${dmg}의 피해. (몬스터 HP: ${target.hp})`);

        // [패시브 구현] 공격 시 발동 패시브
        if (this.essences.includes("고블린")) { // 
            if (Math.random() < 0.1) applyDebuff(this, target, "마비독(약)");
        }
        if (this.essences.includes("고블린 궁수")) { // 
            if (this.equipment["무기"]?.includes("활")) { // (활 착용 시 - 임의)
                 applyDebuff(this, target, "독(약)");
            }
        }
        // ... 기타 공격 시 패시브 ...


        if (target.hp <= 0) {
            this.handleMonsterDefeat(target);
            this.cb.updateCombatStatus(this);

            const allMonstersDefeated = this.currentMonster.every(m => !m || m.hp <= 0);
            if (allMonstersDefeated) {
                this.endCombat(true);
                return;
            }
        }
        
        this.showStatus(); // [UI] 기력 소모 등 반영
        this.endTurn();
    }


    playerSpell(spellName, targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;

        const spell = this.gameData.magic[spellName];
        if (!spell) {
             this.cb.logMessage(`오류: '${spellName}' 주문을 찾을 수 없습니다.`);
             return;
        }
        const spellCost = spell.mp_cost || 0;
        if (this.mp < spellCost) {
            this.cb.logMessage("MP가 부족하여 마법을 사용할 수 없다.");
            return;
        }

        let target = null;
        let targets = [];
        if (targetIndex === -1) { // 광역기
            targets = this.currentMonster.filter(m => m && m.hp > 0);
        } else { // 단일 대상
             if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length || !this.currentMonster[targetIndex] || this.currentMonster[targetIndex].hp <= 0) {
                this.cb.logMessage("오류: 주문 대상이 유효하지 않습니다.");
                this.cb.updateCombatMenu(this);
                return;
             }
             target = this.currentMonster[targetIndex];
             targets.push(target);
        }

        this.mp -= spellCost;
        this.cb.logMessage(`'${spellName}' 주문을 시전했다!`);

        try {
             if (typeof spell.effect === 'function') {
                spell.effect(this, targetIndex === -1 ? targets : target); 
             } 
             else if (spell.dmg !== undefined) {
                  targets.forEach(t => {
                     let magicDefense = t.currentStats?.['항마력'] || 0;
                     let spellDamage = spell.dmg + (this.currentStats['정신력'] || 10);
                     let finalDamage = helpers.calculateDamage(spellDamage, magicDefense);
                     helpers.safeHpUpdate(t, -finalDamage);
                     this.cb.logMessage(`주문 ${spellName}(으)로 ${t.name}에게 ${finalDamage}의 피해! (몬스터 HP: ${t.hp})`);
                 });
             }

             targets.forEach(t => {
                 if (t.hp <= 0) {
                     this.handleMonsterDefeat(t);
                 }
             });
             this.cb.updateCombatStatus(this);
             
             const allMonstersDefeated = this.currentMonster.every(m => !m || m.hp <= 0);
             if (allMonstersDefeated) {
                 this.endCombat(true);
                 return;
             }
             
        } catch (e) {
             this.cb.logMessage(`Error casting spell ${spellName}: ${e.message}`);
             console.error(e);
        }

        this.showStatus(); // [UI] MP 소모 등 반영
        this.endTurn();
    }


    playerEssenceSkill(skillName, targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;

        let essenceData = null;
        let essenceKey = null;
        for (const key of this.essences) {
            const ess = this.gameData.essences[key];
            if (ess && ess.active) {
                const skills = helpers.toArray(ess.active);
                const foundSkill = skills.find(s => s.name === skillName);
                if (foundSkill) {
                    essenceData = foundSkill;
                    essenceKey = key;
                    break;
                }
            }
        }

        if (!essenceData) {
            this.cb.logMessage(`오류: '${skillName}' 정수 스킬을 찾을 수 없습니다.`);
            return;
        }

        const skillCost = essenceData.mp_cost || 0;
        if (this.mp < skillCost) {
            this.cb.logMessage("MP가 부족하여 정수 스킬을 사용할 수 없다.");
            return;
        }
        
        let target = null;
        let targets = [];
        // [수정] data_functional.js에 병합된 effect 함수 찾기
        const functionalSkill = this.gameData.essences[essenceKey].active.find ? this.gameData.essences[essenceKey].active.find(s => s.name === skillName) : this.gameData.essences[essenceKey].active;
        const requiresTarget = (essenceData.dmg !== undefined || (functionalSkill && functionalSkill.effect && functionalSkill.effect.toString().includes('target')));
        
        if (targetIndex === -1 && !requiresTarget) { // 광역기
            targets = this.currentMonster.filter(m => m && m.hp > 0);
        } else { // 단일 대상
             if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length || !this.currentMonster[targetIndex] || this.currentMonster[targetIndex].hp <= 0) {
                 if (targetIndex === -1 && requiresTarget) {
                     target = this.currentMonster.find(m => m && m.hp > 0);
                     if (target) targets.push(target);
                 } else {
                    this.cb.logMessage("오류: 스킬 대상이 유효하지 않습니다.");
                    this.cb.updateCombatMenu(this);
                    return;
                 }
             } else {
                 target = this.currentMonster[targetIndex];
                 targets.push(target);
             }
        }

        if (targets.length === 0 && requiresTarget) {
             this.cb.logMessage("오류: 스킬을 사용할 유효한 대상이 없습니다.");
             this.cb.updateCombatMenu(this);
             return;
        }

        this.mp -= skillCost;
        this.cb.logMessage(`'${skillName}' 정수 스킬을 사용했다!`);

        try {
            if (functionalSkill && typeof functionalSkill.effect === 'function') {
                 functionalSkill.effect(this, targetIndex === -1 && !requiresTarget ? targets : targets[0]);
            }
            else if (essenceData.dmg !== undefined) {
                 targets.forEach(t => {
                     let defense = (essenceData.type === 'magic') ? (t.currentStats?.['항마력'] || 0) : (t.currentStats?.['물리 내성'] || 0);
                     let finalDamage = helpers.calculateDamage(essenceData.dmg || 0, defense);
                     helpers.safeHpUpdate(t, -finalDamage);
                     this.cb.logMessage(`스킬 ${skillName}(으)로 ${t.name}에게 ${finalDamage}의 피해! (몬스터 HP: ${t.hp})`);
                 });
            }
            else {
                 this.cb.logMessage(`경고: '${skillName}' 스킬의 효과(effect 또는 dmg)가 정의되지 않았습니다.`);
            }

             targets.forEach(t => {
                 if (t.hp <= 0) {
                     this.handleMonsterDefeat(t);
                 }
             });
             this.cb.updateCombatStatus(this);
             
             const allMonstersDefeated = this.currentMonster.every(m => !m || m.hp <= 0);
             if (allMonstersDefeated) {
                 this.endCombat(true);
                 return;
             }

        } catch (e) {
            this.cb.logMessage(`Error using essence skill ${skillName}: ${e.message}`);
            console.error(e);
        }

        this.showStatus(); // [UI] MP 소모 등 반영
        this.endTurn();
    }


    playerRun() {
        if (!this.playerTurn || !this.inCombat) return;
        this.cb.logMessage("도망을 시도한다...");
        let runChance = 0.5 + ((this.currentStats["민첩성"] || 10) / 200);
        runChance = Math.min(0.95, runChance);

        if (Math.random() < runChance) {
            this.endCombat(false);
        } else {
            this.cb.logMessage("도망에 실패했다.");
            this.endTurn();
        }
    }

    endTurn() {
        if (!this.inCombat) return;

        const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
        if (allMonstersDefeated) {
            this.endCombat(true);
            return;
        }

        this.playerTurn = false;
        this.cb.updateCombatMenu(this);
        setTimeout(() => this.monsterTurn(), 750);
    }

    /**
     * [패시브 구현] 몬스터의 턴 로직
     * 플레이어의 '방어 패시브' (영체, 끈적이는 신체 등)를 데미지 계산에 적용
     */
    monsterTurn() {
        if (!this.inCombat) return;
        const livingMonstersInTurnStart = this.currentMonster?.filter(m => m && m.hp > 0);
        if (!livingMonstersInTurnStart || livingMonstersInTurnStart.length === 0) {
             this.startPlayerTurn();
             return;
        }

        this.currentMonster.forEach((monster) => {
            if (this.hp <= 0 || !this.inCombat || !monster || monster.hp <= 0) return;

            if(monster.debuffs?.includes("공포") && Math.random() < 0.5) {
                this.cb.logMessage(`${monster.name}은(는) 공포에 질려 아무것도 하지 못했다!`);
                return; 
            }
            if(monster.debuffs?.includes("기절(1턴)") || monster.debuffs?.includes("석화(1턴)") || monster.debuffs?.includes("수면(1턴)") || monster.debuffs?.includes("빙결(1턴)") || monster.debuffs?.includes("속박(늪)") || monster.debuffs?.includes("속박(뱀)")) {
                 this.cb.logMessage(`${monster.name}은(는) 행동할 수 없다!`);
                return;
            }
            // ... 기타 상태이상 ...

            const potentialTargets = [this, ...this.party].filter(p => p && p.hp > 0);
            if (potentialTargets.length === 0) return;
            
            const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
            if (!target) return;

            const attackOptions = monster.attacks || [{name:"기본 공격", dmg: monster.atk, type: "physical"}];
            const atk = attackOptions[Math.floor(Math.random() * attackOptions.length)];
            let dmg = 0;
            let defense = 0;
            
            const isTargetPlayer = (target === this);
            
            if(atk.type === "magic") {
                 defense = target.currentStats?.["항마력"] || 5;
                 dmg = helpers.calculateDamage(atk.dmg || monster.atk || 10, defense);
            } else {
                defense = target.currentStats?.["물리 내성"] || 5;
                dmg = helpers.calculateDamage(atk.dmg || monster.atk || 10, defense);
                
                // [패시브 구현] 플레이어 대상 물리 방어 패시브
                if (isTargetPlayer) {
                    if (this.essences.includes("레이스")) {
                        dmg *= 0.5; // "영체" 물리 피해 50% 감소
                        this.cb.logMessage("[패시브: 영체]로 받는 물리 피해가 50% 감소합니다!");
                    }
                    if (this.essences.includes("슬라임")) {
                        dmg *= 0.9; // "끈적이는 신체" 물리 피해 10% 감소
                    }
                    // "무쇠가죽" (베기 공격 한정)
                    if (this.essences.includes("오우거") && (atk.name.includes("베기") || atk.name.includes("할퀴기"))) {
                        // 방어력을 2배로 하여 데미지 재계산
                        let boostedDefense = (target.currentStats?.["물리 내성"] || 5) * 2;
                        dmg = helpers.calculateDamage(atk.dmg || monster.atk || 10, boostedDefense);
                        this.cb.logMessage("[패시브: 무쇠가죽]이 베기 공격에 대한 방어력을 2배로 늘립니다!");
                    }
                }
            }

            // [수정] 플레이어 대상 회피 체크
            if (isTargetPlayer) {
                let evasionChance = this.evasionBonus + ((this.currentStats['민첩성'] || 10) / 200);
                evasionChance = Math.min(0.8, evasionChance);
                if (Math.random() < evasionChance) {
                    this.cb.logMessage(`${monster.name}의 '${atk.name}' 공격! 하지만 민첩하게 회피했다!`);
                    return;
                }
            }
            
             dmg = Math.floor(dmg);
             helpers.safeHpUpdate(target, -dmg);
             const targetName = isTargetPlayer ? '플레이어' : target.name;
             this.cb.logMessage(`${monster.name}의 '${atk.name}' 공격! ${targetName}에게 ${dmg}의 피해. (${targetName} HP: ${target.hp})`);
             this.cb.updateCombatStatus(this);

             if (isTargetPlayer) {
                 if(atk.effect === "fear" && Math.random() < 0.3) this.applyDebuff("공포");
                 if(atk.dot && atk.type === 'poison') this.applyDebuff(`독(${atk.dot})`);
                 if(atk.dot && atk.type !== 'poison') this.applyDebuff(`출혈(${atk.dot})`);
             }

            if (target.hp <= 0) {
                 if (isTargetPlayer) {
                     this.cb.logMessage("플레이어가 쓰러졌다!");
                     this.endCombat(false);
                     return;
                 } else {
                     this.cb.logMessage(`${target.name}이(가) 쓰러졌다!`);
                 }
             }
        });

        if (this.hp > 0 && this.inCombat) {
            this.partyTurn();
        }
    }

    partyTurn() {
        if (!this.inCombat || !this.currentMonster || this.currentMonster.every(m => !m || m.hp <= 0)) {
            if (this.inCombat) this.endCombat(true);
            return;
        }

        if (this.debuffs.includes("진압")) {
            this.cb.logMessage("진압 상태라서 파티원들이 행동할 수 없다!");
            this.startPlayerTurn();
            return;
        }

        this.party.forEach(member => {
             if (!this.inCombat || !this.currentMonster || this.currentMonster.every(m => !m || m.hp <= 0) || !member || member.hp <= 0) return;

             const livingMonsters = this.currentMonster.filter(m => m && m.hp > 0);
             if (livingMonsters.length === 0) return;
             const targetMonster = livingMonsters[Math.floor(Math.random() * livingMonsters.length)];
             if (!targetMonster) return;

             if (member.skills.length > 0 && member.mp >= (member.skills[0]?.cost || 0) && Math.random() < 0.4) {
                 member.useSkill(targetMonster);
             } else {
                 member.attack(targetMonster);
             }

             if (targetMonster.hp <= 0) {
                 this.cb.logMessage(`${member.name}이(가) ${targetMonster.name}을(를) 처치했다!`);
                 this.handleMonsterDefeat(targetMonster);
                 this.cb.updateCombatStatus(this);

                 const allMonstersDefeatedNow = this.currentMonster.every(m => !m || m.hp <= 0);
                 if (allMonstersDefeatedNow) {
                     this.endCombat(true);
                     return;
                 }
             }
        });

        if (this.inCombat) {
            this.startPlayerTurn();
        }
    }


    /**
     * [패시브 구현] 플레이어 턴 시작 로직
     * "공포", "파멸의 각인", "악취" 등 턴 시작 시 발동하는 디버프/패시브 처리
     */
     startPlayerTurn() {
         if (!this.inCombat) return;

         // [패시브 구현] 턴 시작 시 디버프/패시브 처리
         let turnSkipped = false;

         // 1. 행동 불가 디버프
         if(this.debuffs.includes("공포") && Math.random() < 0.5) { // [cite: 733]
             this.cb.logMessage("공포에 질려 아무것도 할 수 없다!");
             turnSkipped = true;
         }
         else if (this.debuffs.includes("기절(1턴)") || this.debuffs.includes("석화(1턴)") || this.debuffs.includes("수면(1턴)") || this.debuffs.includes("빙결(1턴)") || this.debuffs.includes("속박(늪)") || this.debuffs.includes("속박(뱀)")) {
             this.cb.logMessage(`[${this.debuffs.find(d => d.includes("턴"))}] 효과로 행동할 수 없다!`);
             turnSkipped = true;
         }

         // 2. 지속 피해 디버프
         if (this.debuffs.includes("파멸의 각인(영구)")) { // 
             let dmg = Math.floor(this.maxHp * 0.01);
             helpers.safeHpUpdate(this, -dmg);
             this.cb.logMessage(`[파멸의 각인] 효과로 ${dmg}의 생명력 피해!`);
         }
         if (this.debuffs.some(d => d.startsWith("독("))) {
             let poisonDmg = 5; // (임의) 기본 독 데미지
             // [패시브 구현] "악취" (구아노 씨 서펜트) 
             if (this.debuffs.includes("악취(디버프)")) { // (몬스터가 이 디버프를 걸었다고 가정)
                 poisonDmg *= 2;
                 this.cb.logMessage("[패시브: 악취] 효과로 독 피해가 2배 증가합니다!");
             }
             helpers.safeHpUpdate(this, -poisonDmg);
             this.cb.logMessage(`[독] 효과로 ${poisonDmg}의 피해!`);
         }
         
         // 3. 턴 경과 처리 (간단하게 1턴짜리만 제거)
         this.debuffs = this.debuffs.filter(d => !d.endsWith("(1턴)"));
         // (3턴짜리 등은 더 복잡한 턴 매니저 필요)

         if (this.hp <= 0) {
             if (this.inCombat) this.endCombat(false);
             return;
         }

         if (turnSkipped) {
             this.endTurn();
             return;
         }

         this.playerTurn = true;
         this.evasionBonus = 0;
         this.cb.updateCombatStatus(this);
         this.cb.updateCombatMenu(this);
     }
     
    // [신규] JSON 이벤트 효과 처리기
    handleEventEffect(effect) {
        if (!effect) return;

        switch (effect.type) {
            case "gainExp":
                this.gainExp(effect.value || 0, null); // 퀘스트/이벤트 경험치는 monsterName null
                if (effect.log) this.cb.logMessage(effect.log);
                break;
            case "addItem":
                this.addItem(effect.item);
                if (effect.log) this.cb.logMessage(effect.log);
                break;
            case "damage":
                helpers.safeHpUpdate(this, -(effect.value || 0));
                if (effect.log) this.cb.logMessage(effect.log);
                if (effect.debuff) this.applyDebuff(effect.debuff);
                if (this.hp <= 0) {
                    this.cb.logMessage("이벤트로 인해 쓰러졌다...");
                    this.endCombat(false);
                }
                break;
            case "applyDebuff":
                const debuffs = helpers.toArray(effect.debuff);
                debuffs.forEach(d => this.applyDebuff(d));
                if (effect.log) this.cb.logMessage(effect.log);
                break;
            case "log":
                if (effect.log) this.cb.logMessage(effect.log);
                break;

            case "portal":
                if (effect.targetLayer) {
                    this.cb.showPortalChoice(this, effect.targetLayer);
                } else {
                    this.cb.logMessage("오류: 포탈 이벤트에 'targetLayer'가 없습니다.");
                }
                break;

            case "combat":
                let monstersToCombat = effect.monsters;
                if (monstersToCombat === "randomGroup" && effect.monsterLayer) {
                    monstersToCombat = this.cb.getRandomMonsters(effect.monsterLayer);
                } else if (monstersToCombat === "random" && effect.monsterLayer) {
                     monstersToCombat = this.cb.randomMonsterFromLayer(effect.monsterLayer);
                }
                
                if (monstersToCombat && (Array.isArray(monstersToCombat) ? monstersToCombat.length > 0 : true)) {
                    if (effect.log) this.cb.logMessage(effect.log);
                    this.startCombat(monstersToCombat);
                } else {
                    this.cb.logMessage("오류: 전투 이벤트에 유효한 몬스터가 없습니다.");
                }
                break;
            
            case "conditionalCombat":
                if (Math.random() < (effect.chance || 1.0)) {
                    if (effect.log) this.cb.logMessage(effect.log);
                    let condMonsters = effect.monsters;
                     if (condMonsters === "randomGroup" && effect.monsterLayer) {
                        condMonsters = this.cb.getRandomMonsters(effect.monsterLayer);
                    } else if (condMonsters === "random" && effect.monsterLayer) {
                         condMonsters = this.cb.randomMonsterFromLayer(effect.monsterLayer);
                    }
                    if (condMonsters && (Array.isArray(condMonsters) ? condMonsters.length > 0 : true)) {
                        this.startCombat(condMonsters);
                    }
                }
                break;
            
            case "conditionalBoss":
                 if ((this.party.length + 1 >= (effect.partySize || 0)) &&
                     ((this.daysInLabyrinth * 24 + this.explorationCount) > (effect.timeElapsed || 0)) &&
                     (Math.random() < (effect.chance || 0.0)))
                 {
                     if (effect.log) this.cb.logMessage(effect.log);
                     this.startCombat(effect.boss);
                 }
                break;
                
            case "statCheck":
                 if (this.currentStats[effect.stat] >= effect.threshold) {
                     if(effect.success.log) this.cb.logMessage(effect.success.log);
                     if(effect.success) this.handleEventEffect(effect.success); // 성공 시 연쇄 이벤트
                 } else {
                     if(effect.failure.log) this.cb.logMessage(effect.failure.log);
                     if(effect.failure) this.handleEventEffect(effect.failure); // 실패 시 연쇄 이벤트
                 }
                break;
            case "loseStamina":
                this.stamina = Math.max(0, this.stamina - (effect.value || 0));
                 if (effect.log) this.cb.logMessage(effect.log);
                 if (effect.chain) this.handleEventEffect(effect.chain); // 연쇄 이벤트 처리
                break;
            case "gainMagicStones":
                 let amount = effect.value;
                 if (amount === "random") {
                     amount = Math.floor(Math.random() * (effect.max - effect.min + 1)) + effect.min;
                 }
                 this.magic_stones += amount;
                 if (effect.log) this.cb.logMessage(effect.log);
                break;
            case "modifyStat": // [신규] world_data.json의 5층 이벤트
                 if (this.stats.hasOwnProperty(effect.stat)) {
                     this.stats[effect.stat] += effect.value;
                     if (effect.log) this.cb.logMessage(effect.log);
                     this.calculateStats(); // 스탯 재계산
                 }
                break;

            default:
                this.cb.logMessage(`(미구현 이벤트: ${effect.type})`);
        }
        
        const uiChangingEvents = ["portal", "combat", "conditionalCombat", "conditionalBoss"];
        if (!uiChangingEvents.includes(effect.type)) {
             this.showStatus(); // [UI] 이벤트 결과 반영
        }
    }


    // [수정] UI 즉각 반응을 위한 마스터 업데이트 함수
    showStatus() {
         const statusDiv = document.getElementById('status');
         if (!statusDiv) {
             console.error("Error: Status element not found in DOM.");
             return;
         }

        // [수정] 스탯 계산을 먼저 수행
        this.calculateStats();

        let statusHtml = `<b>종족:</b> ${this.race || '미선택'} | <b>레벨:</b> ${this.level} | <b>탐험 등급:</b> ${this.grade}등급 | <b>EXP:</b> ${this.exp}/${this.gameData.expToLevel[this.level] || 'MAX'}<br>`;
        statusHtml += `<b>포만감:</b> ${this.satiety} | <b>피로:</b> ${this.fatigue}/100 | <b>미궁 남은시간:</b> ${this.timeRemaining > 0 ? this.timeRemaining + '시간' : '제한 없음'}<br>`;
        statusHtml += `<b>동료:</b> ${this.party.map(p => `${p.name}(${p.grade}등급/${p.trait})`).join(', ') || '없음'}<br>`;
        
        // [수정] 기본 스탯(stats)과 최종 스탯(currentStats)을 분리 표시
        statusHtml += "<b>기본 스탯 (순수):</b><ul class='stat-list'>";
        this.gameData.statsList.forEach(stat => {
            if (this.stats.hasOwnProperty(stat.name) && this.stats[stat.name] !== 0) {
                // [문법 수정] 대괄호 표기법
                statusHtml += `<li class='stat-item'>${stat.name}: ${this.stats[stat.name]}</li>`;
            }
        });
        statusHtml += "</ul><b>최종 스탯 (장비/정수 포함):</b><ul class='stat-list'>";
        this.gameData.statsList.forEach(stat => {
            if (this.currentStats.hasOwnProperty(stat.name) && this.currentStats[stat.name] !== 0) {
                // [문법 수정] 대괄호 표기법
                statusHtml += `<li class='stat-item'>${stat.name}: ${this.currentStats[stat.name]}</li>`;
            }
        });
        statusHtml += "</ul>";
        
        statusHtml += `<b>마법:</b> ${this.spells.length > 0 ? this.spells.join(", ") : '없음'}<br>`;
        statusHtml += `<b>정수:</b> ${this.essences.length > 0 ? this.essences.map(key => `${key} 정수`).join(", ") : '없음'} (${this.essences.length}/${this.level * 3})<br>`;
        statusHtml += `<b>정수 스킬:</b> ${this.essence_skills.length > 0 ? this.essence_skills.join(", ") : '없음'}<br>`;
        statusHtml += `<b>인벤토리 (${this.inventory.length}개):</b> ${this.inventory.slice(0, 5).join(", ")}${this.inventory.length > 5 ? '...' : ''}<br>`;
        statusHtml += `<b>장비:</b><br>
            투구: ${this.equipment?.투구 || '없음'} |
            갑옷: ${this.equipment?.갑옷 || '없음'} |
            장갑: ${this.equipment?.장갑 || '없음'} <br>
            각반: ${this.equipment?.각반 || '없음'} |
            무기: ${this.equipment?.무기 || '없음'} |
            부무기: ${this.equipment?.부무기 || '없음'}<br>`;
        statusHtml += `<b>골드:</b> ${this.gold.toLocaleString()} 스톤 | <b>마석:</b> ${this.magic_stones.toLocaleString()} 개`;

        statusDiv.innerHTML = statusHtml;

        // [UI] 상태 바 즉시 업데이트
        this.cb.updateStatusBars(this);
    }
}