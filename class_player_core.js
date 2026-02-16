// 파일: class_player_core.js
// 역할: Player 클래스 정의, 생성자, 핵심 데이터 관리 (스탯, 아이템, 정수)
// [수정] (v4) 2D 맵 탐험을 위한 좌표(x, y) 및 맵 ID 속성 추가
// [복원] calculateStats 내의 방대한 패시브 로직 완전 복구

import { helpers } from './class_helpers.js';

export class Player {
    constructor(callbacks) {
        this.cb = callbacks; 
        this.gameData = callbacks?.gameData || {}; 
        
        this.questManager = callbacks && callbacks.QuestManagerClass 
            ? new callbacks.QuestManagerClass(this, this.gameData) 
            : null;

        this.race = null;
        
        this.stats = {}; 
        const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
        statsList.forEach(stat => this.stats[stat.name] = 0);
        
        this.specialStats = this.gameData.specialStats 
            ? JSON.parse(JSON.stringify(this.gameData.specialStats)) 
            : {};
        
        this.currentStats = { ...this.stats }; 

        this.critChance = 0.05; 
        this.evasion = 0.05; 

        this.level = 1;
        this.exp = 0;
        this.hp = 100;
        this.mp = 100;
        this.stamina = 100;
        this.maxHp = 100;
        this.maxMp = 100;
        this.maxStamina = 100;
        
        this.currentLayer = 1;
        
        // [신규] 2D 맵 탐험용 좌표 및 맵 ID
        this.x = 0;
        this.y = 0;
        this.currentMapId = null; 

        this.inventory = [];
        this.spells = [];
        this.essences = []; 
        this.essence_skills = []; 
        
        this.position = "라비기온 (7-13구역)";
        this.gold = 100000; 
        this.magic_stones = 0;
        
        this.currentMonster = null;
        this.inCombat = false;
        this.playerTurn = true;
        this.debuffs = [];
        this.equipment = {투구: null, 갑옷: null, 장갑: null, 각반: null, 무기: null, 부무기: null};
        
        this.satiety = 100;
        this.labyrinthSteps = 0; // 미궁 이동 누적(30칸당 포만감 1 감소)
        this.hungerStepThreshold = 30;
        this.hungerWarningShown = false;
        this.fatigue = 0;
        this.betrayalChance = 0.01; 
        this.party = []; 
        
        this.daysInLabyrinth = 1;
        this.explorationCount = 0;
        this.timeRemaining = 0; 
        this.grade = 9; 
        this.sleepCount = 0; 
        
        this.killedMonsterTypes = new Set(); 
        
        this.currentStage = 1; 
        
        this.bankGold = 0; 
        this.lastTrainedDate = -1; 

        this.currentRift = null; 
        this.currentRiftStage = 0; 
        
        this.isWaitingForEssenceChoice = false; 

        this.aura_active = false; 
        this.evasionBonus = 0; 
        this.criticalHitBoost = false; 

        this.usedPassive_CorpseRebind = false; 
        this.usedPassive_SoulJar = false; 
        this.usedPassive_Chivalry = false; 

        // [신규] 모닥불 설치 위치 저장 (층별로)
        this.campfires = {}; // { layer: { x, y } } 형태
        this.torches = {}; // { layer: [{x,y}, ...] } 횃불 설치 위치
    }

    chooseRace(race) {
        if (!this.gameData.races || !this.gameData.races[race]) {
             this.cb?.logMessage?.(`Error: Race "${race}" not found.`);
             return;
        }
        this.race = race;
        const base = this.gameData.races[race].base_stats;
        
        this.stats = {}; 
        const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
        statsList.forEach(stat => this.stats[stat.name] = 0);
        
        Object.keys(base).forEach(k => {
            if (this.stats.hasOwnProperty(k)) {
                this.stats[k] = base[k];
            }
        });

        this.calculateStats(); 
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.stamina = this.maxStamina;

        // 종족 고유 스킬을 실제 전투 스킬 슬롯에 등록
        const raceData = this.gameData.races?.[race];
        const racial = raceData?.racial_skill;
        if (racial?.name && typeof racial.effect === 'function') {
            this.gameData.magic = this.gameData.magic || {};
            if (!this.gameData.magic[racial.name]) {
                this.gameData.magic[racial.name] = {
                    grade: 1,
                    mp_cost: 10,
                    desc: racial.desc || `${race}의 종족 고유 능력`,
                    effect: racial.effect
                };
            }
            if (!this.spells.includes(racial.name)) {
                this.spells.push(racial.name);
            }
            this.cb?.logMessage?.(`종족 고유 스킬 [${racial.name}]을(를) 익혔습니다.`);
        }
        this.cb?.logMessage?.(`종족 선택: ${race}. ${this.gameData.races[race].special}`);
    }

    calculateStats() {
        const newStats = { ...this.stats };
        const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];

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
        
        // 4. 정수 패시브 스탯 적용 (완전 복원)
        for (const essenceName of this.essences) {
             const essenceData = (this.gameData.essences && this.gameData.essences[essenceName]);
             if (essenceData && essenceData.passive) {
                 const passives = helpers.toArray(essenceData.passive);
                 passives.forEach(passive => {
                    switch(passive.name) {
                        case "석화 피부": // 스톤골렘
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            newStats['민첩성'] = (newStats['민첩성'] || 0) - 5;
                            break;
                        case "육체보존": // 데스핀드
                            newStats['자연 재생력'] = (newStats['자연 재생력'] || 0) + 10;
                            break;
                        case "강철 피부": // 아이안트로
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 5;
                            break;
                        case "석상 형태": // 가고일
                            if (!this.inCombat) newStats['물리 내성'] = (newStats['물리 내성'] || 0) * 2;
                            break;
                        case "매의 눈": // 아이언팔콘
                            newStats['시각'] = (newStats['시각'] || 0) + 5;
                            break;
                        case "영체": // 레이스
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 5;
                            break;
                        case "꺼지지 않는 불꽃": // 위치스램프
                            newStats['화염 내성'] = (newStats['화염 내성'] || 0) + 5;
                            break;
                        case "심연의 적응": // 심연어
                            newStats['어둠 내성'] = (newStats['어둠 내성'] || 0) + 10;
                            break;
                        case "두꺼운 가죽": // 반달바위곰
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            break;
                        case "높은 물리 내성": // 듀라한
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 20;
                            break;
                        case "바위 피부": // 거석병
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 15;
                            break;
                        case "강철 갑옷": // 강철언덕 수호병
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            break;
                        case "대전사": // 오크 대전사
                            newStats['근력'] = (newStats['근력'] || 0) + 5;
                            break;
                        case "나무 피부": // 스네트리, 우드맨
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + (passive.name === '스네트리' ? 12 : 10);
                            newStats['화염 내성'] = (newStats['화염 내성'] || 0) - (passive.name === '스네트리' ? 15 : 10);
                            break;
                        case "예리한 감각": // 아울베어
                            newStats['시각'] = (newStats['시각'] || 0) + 5;
                            newStats['청각'] = (newStats['청각'] || 0) + 5;
                            break;
                        case "설인": // 예티
                            newStats['냉기 내성'] = (newStats['냉기 내성'] || 0) + 10;
                            break;
                        case "얼음 피부": // 아이스 오크
                            newStats['냉기 내성'] = (newStats['냉기 내성'] || 0) + 10;
                            break;
                        case "구리 피부": // 코퍼 골렘
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            newStats['번개 내성'] = (newStats['번개 내성'] || 0) + 10;
                            break;
                        case "철갑": // 철기병
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            break;
                        case "철 비늘": // 아이언 리자드맨
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            break;
                        case "신속": // 웨스트 샌드맨
                            newStats['민첩성'] = (newStats['민첩성'] || 0) + 10;
                            break;
                        case "바다의 전사": // 라네무트 전사
                            if (this.currentLayer == 6) newStats['근력'] = (newStats['근력'] || 0) + 10;
                            break;
                        case "단단한 껍질": // 소라고동뿔
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            break;
                        case "언데드": // 스켈레톤, 데드맨 등
                            newStats['독 내성'] = (newStats['독 내성'] || 0) + 999; 
                            newStats['신성 내성'] = (newStats['신성 내성'] || 0) - 100; 
                            newStats['화염 내성'] = (newStats['화염 내성'] || 0) - 100; 
                            break;
                        case "광물 피부": // 광물 슬라임
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 15;
                            break;
                        case "원거리 명중": // 코볼트 총잡이
                            newStats['명중률'] = (newStats['명중률'] || 0) + 10;
                            break;
                        case "단단한 등껍질": // 스터렙
                            newStats['물리 내성'] = Math.floor((newStats['물리 내성'] || 0) * 1.10);
                            break;
                        case "철의 육체": // 강철 거인
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 50;
                            newStats['민첩성'] = (newStats['민첩성'] || 0) - 15;
                            break;
                        case "독사의 피": // 메두사
                            newStats['독 내성'] = (newStats['독 내성'] || 0) + 50;
                            break;
                        case "외눈박이": // 지옥거인 헤르쟈
                            newStats['인지력'] = (newStats['인지력'] || 0) + 200; 
                            break;
                        case "조율자": // 조율자 그레고리
                            statsList.forEach(s => { newStats[s.name] = (newStats[s.name] || 0) + 5; });
                            break;
                        case "심연의 육체": // 심연 구울
                            newStats['어둠 내성'] = (newStats['어둠 내성'] || 0) + 15;
                            newStats['자연 재생력'] = (newStats['자연 재생력'] || 0) + 5;
                            break;
                        case "영웅의 길": // 오크 히어로
                            if (this.hp <= this.maxHp * 0.5) {
                                newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10; 
                                newStats['항마력'] = (newStats['항마력'] || 0) + 10;
                                if(this.hp <= this.maxHp * 0.2) {
                                    newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10; 
                                    newStats['항마력'] = (newStats['항마력'] || 0) + 10; 
                                }
                            }
                            break;
                        case "태양의 갑옷": // 태양의 기사
                            newStats['신성 내성'] = (newStats['신성 내성'] || 0) + 15;
                            newStats['화염 내성'] = (newStats['화염 내성'] || 0) + 15;
                            break;
                        case "별의 인도": // 별의 기사
                            newStats['행운'] = (newStats['행운'] || 0) + 10;
                            break;
                        case "진흙 갑옷": // 레드머드
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            break;
                        case "파멸의 갑옷": // 둠 워리어
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            newStats['어둠 내성'] = (newStats['어둠 내성'] || 0) + 10;
                            break;
                        case "검은 표범": // 니겔 펜서
                            newStats['민첩성'] = (newStats['민첩성'] || 0) + 10;
                            break;
                        case "심해의 갑옷": // 해저 수호병
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 15;
                            break;
                        case "지옥의 갑옷": // 지옥 수호병
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 5;
                            newStats['화염 내성'] = (newStats['화염 내성'] || 0) + 5;
                            break;
                        case "얼음 갑옷": // 빙괴
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 10;
                            newStats['냉기 내성'] = (newStats['냉기 내성'] || 0) + 10;
                            break;
                        case "철갑 껍질": // 쉘아머
                            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 20;
                            break;
                    }
                 });
             }
        }
        
        // 5. 버프/디버프 스탯 적용
        if (this.debuffs?.includes("무기력")) {
            newStats['근력'] = Math.max(1, (newStats['근력'] || 0) - 20);
        }
        if (this.debuffs?.includes("광분(3턴)")) {
            newStats['근력'] = (newStats['근력'] || 0) + 15;
            newStats['민첩성'] = (newStats['민첩성'] || 0) + 10;
        }
        if (this.debuffs?.includes("거대화(3턴)")) {
            newStats['근력'] = (newStats['근력'] || 0) + 10;
            newStats['지구력'] = (newStats['지구력'] || 0) + 10;
        }
        if (this.debuffs?.includes("두드리기(3턴)")) {
            newStats['근력'] = (newStats['근력'] || 0) + 10;
        }
        if (this.debuffs?.includes("재생/육체 급증(3턴)")) {
            newStats['자연 재생력'] = (newStats['자연 재생력'] || 0) + 20;
            newStats['근력'] = (newStats['근력'] || 0) + 10;
        }
        if (this.debuffs?.includes("철벽(1턴)")) {
            newStats['물리 내성'] = (newStats['물리 내성'] || 0) * 2;
            newStats['항마력'] = (newStats['항마력'] || 0) * 2;
        }
        if (this.debuffs?.includes("얼음 갑옷(3턴)")) {
            newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 20;
        }
        
        // 심연 칼날늑대 "심연의 광기" 패시브 (항시 적용)
        if (this.essences?.includes("심연 칼날늑대") || this.debuffs?.includes("내면의 광기(3턴)")) {
            const defenseTotal = (newStats['물리 내성'] || 0) + (newStats['항마력'] || 0);
            newStats['물리 내성'] = 0;
            newStats['항마력'] = 0;
            newStats['절삭력'] = (newStats['절삭력'] || 0) + defenseTotal;
            newStats['근력'] = (newStats['근력'] || 0) + Math.floor(defenseTotal / 2);
        }

        // 6. 백분율(%) 스탯 최종 적용
        if (newStats['근질량'] > 0) {
            newStats['근력'] += Math.floor(newStats['근력'] * (newStats['근질량'] / 100));
        }
        if (this.debuffs?.includes("초월(3턴)")) { // 바이욘
            statsList.forEach(s => { newStats[s.name] = Math.floor((newStats[s.name] || 0) * 1.30); });
        }
        if (this.debuffs?.includes("섬의 권능(3턴)")) { // 짐승
            statsList.forEach(s => { newStats[s.name] = Math.floor((newStats[s.name] || 0) * 1.20); });
        }

        // 6.5 종족별 상시 패시브
        switch (this.race) {
            case "Human":
                statsList.forEach(s => {
                    newStats[s.name] = (newStats[s.name] || 0) + 2;
                });
                break;
            case "Elf":
                newStats['민첩성'] = (newStats['민첩성'] || 0) + 4;
                newStats['정신력'] = (newStats['정신력'] || 0) + 4;
                newStats['시각'] = (newStats['시각'] || 0) + 6;
                break;
            case "Dwarf":
                newStats['근력'] = (newStats['근력'] || 0) + 3;
                newStats['지구력'] = (newStats['지구력'] || 0) + 5;
                newStats['물리 내성'] = (newStats['물리 내성'] || 0) + 8;
                break;
            case "Barbarian":
                newStats['근력'] = (newStats['근력'] || 0) + 5;
                newStats['지구력'] = (newStats['지구력'] || 0) + 5;
                if (this.hp > 0 && this.hp <= this.maxHp * 0.35) {
                    newStats['근력'] = (newStats['근력'] || 0) + 10;
                    newStats['투쟁심'] = (newStats['투쟁심'] || 0) + 20;
                }
                break;
            case "Fairy":
                newStats['민첩성'] = (newStats['민첩성'] || 0) + 6;
                newStats['모든 속성 감응도'] = (newStats['모든 속성 감응도'] || 0) + 8;
                newStats['항마력'] = (newStats['항마력'] || 0) + 4;
                break;
            case "Beastman":
                newStats['근력'] = (newStats['근력'] || 0) + 3;
                newStats['민첩성'] = (newStats['민첩성'] || 0) + 5;
                newStats['후각'] = (newStats['후각'] || 0) + 10;
                newStats['청각'] = (newStats['청각'] || 0) + 10;
                break;
            case "Dragonkin":
                newStats['근력'] = (newStats['근력'] || 0) + 5;
                newStats['항마력'] = (newStats['항마력'] || 0) + 8;
                newStats['화염 내성'] = (newStats['화염 내성'] || 0) + 20;
                break;
        }

        // 7. 최종 스탯 갱신
        this.currentStats = newStats; 

        // 8. 파생 스탯 계산
        this.critChance = 0.05 + (newStats['행운'] / 500) + (newStats['유연성'] / 1000) + ((newStats['인지력'] || 0) / 2000);
        this.evasion = 0.05 + (newStats['민첩성'] / 500) + (newStats['유연성'] / 1000) + (newStats['시야'] / 1000) + ((newStats['시각'] || 0) / 2000);
        
        if (this.essences?.includes("브라키아이스텔로")) {
            this.evasion += 0.20;
        }
        if (this.race === "Fairy") {
            this.evasion += 0.05;
        }
        this.critChance = Math.min(0.85, Math.max(0.01, this.critChance));
        this.evasion = Math.min(0.85, Math.max(0.01, this.evasion));

        // 9. 스탯 기반 HP/MP 갱신
        this.updateMaxStats(); 
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

    gainExp(amount, monsterName = null) {
        if (this.essences?.includes("영혼지기 하우시엘")) {
            this.cb?.logMessage?.("[패시브: 영혼의 계약]으로 인해 경험치를 얻을 수 없습니다.");
            return;
        }

        let expGained = amount;
        let isFirstKill = false;

        if (monsterName) {
            if (this.killedMonsterTypes.has(monsterName)) {
                expGained = Math.max(1, Math.floor(amount * 0.1));
                this.cb?.logMessage?.(`이미 처치한 ${monsterName}이므로, 경험치를 ${expGained} (10%) 획득합니다.`);
            } else {
                expGained = amount;
                this.killedMonsterTypes.add(monsterName);
                isFirstKill = true;
                this.cb?.logMessage?.(`${monsterName} 최초 처치! 경험치를 ${expGained} (100%) 획득합니다.`);
            }
        }
        else {
             this.cb?.logMessage?.(`경험치를 ${expGained} 획득합니다.`);
        }

        if (this.race === "Human") {
            expGained = Math.floor(expGained * 1.05);
        }

        this.exp += expGained;
        this.party.forEach(member => member.gainExp(expGained)); 

        const requiredExp = (this.gameData.expToLevel && this.gameData.expToLevel[this.level]) || Infinity;
        while (this.level < this.gameData.maxLevelModded && this.exp >= requiredExp) {
            this.exp -= requiredExp;
            this.levelUp();
        }
        
        this.showStatus(); 
        return isFirstKill; 
    }

    levelUp() {
        this.level++;
        const statKeys = Object.keys(this.stats);
        if (statKeys.length > 0) {
             for(let i=0; i<3; i++) {
                 const randomStatName = this.gameData.statsList[Math.floor(Math.random() * this.gameData.statsList.length)].name;
                 this.stats[randomStatName] = (this.stats[randomStatName] || 0) + 1;
             }
        }

        this.stats["영혼력"] = (this.stats["영혼력"] || 0) + (this.level > 5 ? 30 : 10);
        
        this.calculateStats(); 
        this.updateGrade();
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.stamina = this.maxStamina;
        
        this.cb?.logMessage?.(`레벨 업! ${this.level} 레벨이 되었다! 영혼력이 상승하고, 최대 흡수 가능 정수가 ${this.level * 3}개로 증가했다.`);
        this.cb?.playSfx?.('sfx-event');
    }

    addEssence(essenceName) {
        let maxEssences = this.level * 3;
        if (this.essences?.includes("디아몬트")) {
            maxEssences -= 1;
        }
        
        if (this.essences.length >= maxEssences) { 
            this.cb?.logMessage?.(`최대 정수 흡수량(${maxEssences}개)을 초과하여 더 이상 흡수할 수 없다.`);
            return;
        }
        
        const essenceData = (this.gameData.essences && this.gameData.essences[essenceName]);
        if (!essenceData) {
            this.cb?.logMessage?.(`오류: '${essenceName}' 정수를 찾을 수 없습니다.`);
            return;
        }

        if (this.essences.includes(essenceName)) { 
             this.cb?.logMessage?.(`이미 ${essenceName} 정수를 흡수했습니다.`);
             return;
        }

        if (essenceName === "영혼지기 하우시엘") {
            this.level = 8;
            this.exp = 0;
            this.cb?.logMessage?.("[패시브: 영혼의 계약]! 정수 흡수 시 즉시 8레벨이 되며, 이후 경험치 획득이 불가능해집니다!");
            if (this.essences?.includes("영혼지기 하우시엘")) { 
                this.cb?.logMessage?.("이미 영혼의 계약 패시브를 가지고 있습니다.");
                return;
            }
        }
        
        if (essenceName === "디아몬트") {
            this.cb?.logMessage?.("[패시브: 부정한 자]! 정수 최대치가 -1로 감소합니다.");
        }

        this.essences.push(essenceName);
        this.cb?.logMessage?.(`${essenceName} 정수를 흡수했다.`);
        this.cb?.playSfx?.('sfx-event');
        
        this.applyEssenceEffect(essenceData);
        this.calculateStats(); 
        this.showStatus(); 
    }

    applyEssenceEffect(essence) {
        if (essence.stats) {
            Object.entries(essence.stats).forEach(([stat, value]) => {
                if (this.stats.hasOwnProperty(stat)) {
                    this.stats[stat] += value;
                    this.cb?.logMessage?.(`${stat} 스탯이 ${value > 0 ? '+' : ''}${value} 영구적으로 변경되었다.`);
                }
            });
        }

        if (essence.passive) {
            const passive = helpers.toArray(essence.passive)[0]; 
            this.cb?.logMessage?.(`패시브 스킬 '${passive.name}'을 얻었다: ${passive.desc}`);
        }

        if (essence.active) {
            const skillsToAdd = helpers.toArray(essence.active);
            skillsToAdd.forEach(skill => {
                if (!this.essence_skills.includes(skill.name)) {
                    this.essence_skills.push(skill.name);
                    this.cb?.logMessage?.(`액티브 스킬 '${skill.name}'을 배웠다.`);
                }
            });
        }
    }

    equipItem(itemName) {
        const itemData = (this.gameData.items && this.gameData.items[itemName]) || 
                       (this.gameData.numbersItems && this.gameData.numbersItems[itemName]) || 
                       (this.gameData.shopItems && this.gameData.shopItems[itemName]);
        
        if (!itemData) {
            this.cb?.logMessage?.(`[${itemName}] 아이템 정보를 찾을 수 없습니다.`);
            return;
        }
        
        const slot = itemData.type;
        if (!slot || !this.equipment.hasOwnProperty(slot)) {
            this.cb?.logMessage?.(`[${itemName}](${slot}) (은)는 장착할 수 없는 아이템 타입입니다.`);
            return;
        }

        this.unequipItem(slot); 
        
        this.equipment[slot] = itemName;

        const index = this.inventory.indexOf(itemName);
        if (index > -1) this.inventory.splice(index, 1);
        
        this.cb?.logMessage?.(`${itemName}을(를) ${slot} 부위에 장착했다.`);
        this.cb?.playSfx?.('sfx-event');
        this.calculateStats(); 
        this.showStatus(); 
    }

    unequipItem(slot) {
        const oldItem = this.equipment[slot];
        if (oldItem) {
            this.inventory.push(oldItem); 
            this.equipment[slot] = null;
            this.cb?.logMessage?.(`${oldItem} 장착을 해제했다.`);
            this.calculateStats(); 
            this.showStatus(); 
        }
    }

    learnSpell(spell) {
        if (!this.gameData.magic || !this.gameData.magic[spell]) {
            this.cb?.logMessage?.(`오류: '${spell}' 마법을 찾을 수 없습니다.`);
            return;
        }
        if (!this.spells.includes(spell)) {
            this.spells.push(spell);
            this.cb?.logMessage?.(`${spell} 마법을 배웠다.`);
            this.cb?.playSfx?.('sfx-event');
            this.showStatus(); 
        }
    }

    addItem(item) {
        this.inventory.push(item);
        this.cb?.logMessage?.(`${item} 아이템을 획득했다.`);
        this.cb?.playSfx?.('sfx-event');
        
        this.questManager?.checkProgress?.('COLLECT', item, 1);
        
        this.showStatus(); 
    }

    applyDebuff(debuff) {
        // 면역 체크
        if (debuff.startsWith("독")) {
            if (this.essences?.includes("홉 고블린")) { 
                this.cb?.logMessage?.("[패시브: 독 면역]으로 인해 하급 독 효과를 무시합니다!");
                return;
            }
            if (this.essences?.includes("스닉투라")) { 
                this.cb?.logMessage?.("[패시브: 만독지체]로 인해 모든 독 효과를 무효화합니다!");
                return;
            }
        }
        if (this.essences?.includes("스켈레톤") || this.essences?.includes("데드맨")) {
            if (debuff.startsWith("독") || debuff.startsWith("질병")) {
                 this.cb?.logMessage?.("[패시브: 언데드]로 인해 독/질병 효과를 무시합니다!");
                 return;
            }
        }
        if (debuff.startsWith("공포")) {
            if (this.currentStats["투쟁심"] >= 50) { 
                 this.cb?.logMessage?.("[패시브: 투쟁심]으로 인해 공포 효과에 저항합니다!");
                 return;
            }
        }
        if (debuff === "저체온증" && this.essences?.includes("서리 늑대")) {
             this.cb?.logMessage?.("[패시브: 냉기 적응]으로 인해 저체온증 효과를 무시합니다!");
             return;
        }

        if (!this.debuffs.includes(debuff)) {
            this.debuffs.push(debuff);
            this.cb?.logMessage?.(`[${debuff}] 디버프에 걸렸다!`);
            this.showStatus(); 
        }
    }

    removeAllDebuffs() {
        this.debuffs = [];
        this.cb?.logMessage?.("모든 디버프가 해제되었다.");
        this.showStatus(); 
    }
}
