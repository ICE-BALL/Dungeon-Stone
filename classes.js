// 이 파일은 게임의 핵심 객체인 Player와 NPC 클래스를 정의합니다.
// [수정] 전투 시작/종료, 게임 오버, 아이템 획득, 레벨 업 시 BGM/SFX 재생 콜백 호출 추가
// [수정] 레벨당 최대 흡수 정수 개수 3개로 변경
// [수정] 칼날늑대 정수 '급소 공격' 스킬 효과 구현 (다음 공격 치명타 확률 증가)
// [수정] NPC 클래스: 등급별 스탯 차등, 특성/스킬/정수 부여, 스킬 사용 메소드 추가
// [수정] Player 클래스: 몬스터 턴 타겟팅 변경 (파티원 포함), 정수 효과 구체화 (급소 공격)

// --- 수정된 import 구문 ---
import {
    races,
    statsList,
    specialStats,
    expToLevel,
    maxLevelModded,
    magic,
    essences
} from './data_core.js';

import {
    monsters,
    items,
    numbersItems,
    layers
} from './data_content.js';
// --- 수정 완료 ---

// --- [신규] 파티원 특성 및 스킬 정의 (간단화) ---
const npcTraits = ["마법사", "신관", "인도자", "전사", "암살자", "원거리 딜러"];
const npcSkillsByTrait = {
    "마법사": [{ name: "마력 화살", cost: 5, effect: (caster, target) => { const dmg = Math.max(1, (caster.stats["정신력"] || 5) * 1.5 - (target.magic_def || 0)); target.hp -= dmg; if (caster.cb?.logMessage) caster.cb.logMessage(`${caster.name}의 마력 화살! ${target.name}에게 ${dmg}의 마법 피해!`);} }],
    "신관": [{ name: "치유", cost: 10, effect: (caster, target) => { const healAmount = (caster.stats["정신력"] || 5) * 2; target.hp = Math.min(target.maxHp, target.hp + healAmount); if (caster.cb?.logMessage) caster.cb.logMessage(`${caster.name}의 치유! ${target.name}의 HP가 ${healAmount} 회복되었다.`);} }],
    "인도자": [{ name: "길찾기", cost: 0, effect: (caster, target) => { if (caster.cb?.logMessage) caster.cb.logMessage(`${caster.name}이(가) 주변 지형을 살피며 길을 찾습니다.`); /* 실제 길찾기 로직 필요 */ } }],
    "전사": [{ name: "강타", cost: 3, effect: (caster, target) => { const dmg = Math.max(1, (caster.stats["근력"] || 8) * 1.2 - (target.def || 0)); target.hp -= dmg; if (caster.cb?.logMessage) caster.cb.logMessage(`${caster.name}의 강타! ${target.name}에게 ${dmg}의 물리 피해!`);} }],
    "암살자": [{ name: "기습", cost: 5, effect: (caster, target) => { const dmg = Math.max(1, (caster.stats["민첩성"] || 8) * 1.3 - (target.def || 0)); target.hp -= dmg; if (caster.cb?.logMessage) caster.cb.logMessage(`${caster.name}의 기습! ${target.name}에게 ${dmg}의 물리 피해!`);} }],
    "원거리 딜러": [{ name: "조준 사격", cost: 4, effect: (caster, target) => { const dmg = Math.max(1, (caster.stats["민첩성"] || 7) * 1.1 - (target.def || 0)); target.hp -= dmg; if (caster.cb?.logMessage) caster.cb.logMessage(`${caster.name}의 조준 사격! ${target.name}에게 ${dmg}의 물리 피해!`);} }],
};
// --- 파티원 특성/스킬 정의 끝 ---


export class NPC {
    // [수정] 생성자 및 속성 추가
    constructor(name, race, grade, callbacks) {
        this.name = name;
        this.race = race;
        this.grade = grade; // 등급 (1~9, 낮을수록 강함)
        this.cb = callbacks;

        // 등급별 스탯 배율 (등급 간 차이 크게)
        const gradeMultiplier = Math.max(1, 6 - Math.floor(grade / 1.8)); // 9등급=1배, 1등급=약 5배

        // 기본 스탯 설정 (등급 반영)
        this.stats = {};
        const baseStats = races[race] ? JSON.parse(JSON.stringify(races[race].base_stats)) : {"근력": 8, "민첩성": 8, "지구력": 8, "정신력": 8}; // 기본 인간형 스탯
        for (const stat in baseStats) {
            this.stats[stat] = Math.floor(baseStats[stat] * gradeMultiplier * (0.8 + Math.random() * 0.4)); // 기본값 * 배율 * (80%~120% 랜덤)
        }

        // 특성 부여
        this.trait = npcTraits[Math.floor(Math.random() * npcTraits.length)];
        this.skills = npcSkillsByTrait[this.trait] ? JSON.parse(JSON.stringify(npcSkillsByTrait[this.trait])) : [];

        // 인도자 특성
        if (this.trait === "인도자") {
            this.knownPortals = {}; // { '층번호': {x, y} or 'found' } 형태로 저장 가능
        }

        // 고등급 NPC 정수 부여 (5등급 이하만, 낮은 확률)
        this.essences = [];
        if (grade <= 5 && Math.random() < 0.2) { // 20% 확률로 정수 보유
            // 해당 등급 또는 특성과 관련된 정수 목록에서 랜덤 선택 (여기서는 임시로 고블린)
            const potentialEssences = ["고블린", "노움", "칼날늑대"]; // 등급/특성별 정수 목록 필요
            const randomEssence = potentialEssences[Math.floor(Math.random() * potentialEssences.length)];
            if (essences[randomEssence]) {
                 this.essences.push(randomEssence);
                 // NPC에게 정수 효과 적용 (Player의 applyEssenceEffect 와 유사하게 구현 필요)
                 this.applyNpcEssenceEffect(randomEssence);
            }
        }

        this.level = Math.max(1, Math.floor((10 - grade) * 1.5)); // 등급 기반 초기 레벨 설정 (임시)
        this.exp = 0;

        // HP, MP 설정 (스탯 기반)
        this.updateNpcMaxStats();
        this.hp = this.maxHp;
        this.mp = this.maxMp;

        this.equipment = { 무기: "기본 검", 갑옷: "가죽 갑옷" }; // 등급별 장비 부여 가능
        this.affinity = 0; // 플레이어와의 호감도
    }

    // [신규] NPC 스탯 기반 최대 HP/MP 업데이트
    updateNpcMaxStats() {
        this.maxHp = (this.stats["지구력"] || 8) * 6 + (this.level * 15); // NPC는 플레이어보다 HP 보너스 낮게 설정 (임시)
        this.maxMp = (this.stats["영혼력"] || 5) + (this.stats["정신력"] || 8) * 4; // MP 공식도 약간 다르게
        this.hp = Math.min(this.hp, this.maxHp);
        this.mp = Math.min(this.mp, this.maxMp);
    }

    // [신규] NPC 정수 효과 적용 (간단 버전)
    applyNpcEssenceEffect(essenceName) {
        const essence = essences[essenceName];
        if (!essence) return;

        if (essence.stats) {
            Object.entries(essence.stats).forEach(([stat, value]) => {
                if (this.stats.hasOwnProperty(stat)) {
                    this.stats[stat] += value;
                }
            });
        }
        // NPC는 액티브 스킬을 skills 배열로 관리하므로 여기서는 추가 안 함
        // 패시브 효과는 필요 시 여기에 적용 로직 추가
        this.updateNpcMaxStats(); // 스탯 변경 후 최대치 업데이트
        if (this.cb?.logMessage) this.cb.logMessage(`${this.name}이(가) ${essenceName} 정수의 영향을 받습니다.`);
    }

    // [수정] 공격 대상 지정 가능하도록 변경
    attack(target) {
        if (!target) return;
        let dmg = Math.max(1, (this.stats["근력"] || 10) - (target.def || target.stats?.["물리 내성"] || 0));
        target.hp -= dmg;
        if (this.cb && typeof this.cb.logMessage === 'function') {
            this.cb.logMessage(`${this.name}의 공격! ${target.name || '플레이어'}에게 ${dmg}의 피해를 입혔다. (${target.name ? '몬스터' : '플레이어'} HP: ${target.hp})`);
        }
    }

    // [신규] NPC 스킬 사용 로직 (간단 버전)
    useSkill(target) {
        if (!target || this.skills.length === 0) {
            this.attack(target); // 스킬 없으면 기본 공격
            return;
        }

        // 사용 가능한 스킬 중 무작위 선택 (MP 고려)
        const availableSkills = this.skills.filter(skill => skill.cost <= this.mp);
        if (availableSkills.length === 0) {
            this.attack(target); // MP 부족 시 기본 공격
            return;
        }

        const skillToUse = availableSkills[Math.floor(Math.random() * availableSkills.length)];

        this.mp -= skillToUse.cost;
        if (this.cb?.logMessage) this.cb.logMessage(`${this.name}이(가) 스킬 [${skillToUse.name}]을(를) 사용! (MP ${skillToUse.cost} 소모)`);

        try {
            skillToUse.effect(this, target); // 대상에게 효과 적용
        } catch (e) {
             if (this.cb?.logMessage) this.cb.logMessage(`${this.name}의 스킬 사용 중 오류 발생: ${e.message}`);
             console.error(e);
        }
    }


    gainExp(amount) {
        this.exp += amount;
        while (this.level < maxLevelModded && this.exp >= (expToLevel[this.level] || Infinity)) {
            this.exp -= expToLevel[this.level];
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        // NPC 레벨업 시 스탯 상승폭 조정 (플레이어보다 낮게)
        const statKeys = Object.keys(this.stats);
        if (statKeys.length > 0) {
             for(let i=0; i<2; i++) { // 플레이어는 3개, NPC는 2개 랜덤 상승 (임시)
                 const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
                 this.stats[randomStat]++;
             }
        }
        // 영혼력 상승폭도 조정
        this.stats["영혼력"] = (this.stats["영혼력"] || 0) + (this.level > 5 ? 15 : 5); // 플레이어보다 낮게

        this.updateNpcMaxStats(); // 최대치 업데이트
        this.hp = this.maxHp;
        this.mp = this.maxMp;

        if (this.cb && typeof this.cb.logMessage === 'function') {
           this.cb.logMessage(`${this.name}이(가) ${this.level} 레벨이 되었다!`);
        }
    }
}

// 플레이어 클래스 - 모든 시스템 구현
export class Player {
    constructor(callbacks) {
        this.cb = callbacks; // UI, 유틸리티, 음악 콜백 저장
        this.race = null;
        this.stats = {};
        statsList.forEach(stat => this.stats[stat.name] = 0);
        this.specialStats = JSON.parse(JSON.stringify(specialStats));
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
        this.essences = [];
        this.essence_skills = [];
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
        this.dropRateBonus = 0; // 넘버스 아이템 등으로 인한 드랍률 보너스
        this.staminaRegenBonus = 1; // 기력 재생 스크롤 등으로 인한 보너스
        this.killedMonsters = new Set(); // 경험치 중복 획득 방지용
        this.timeRemaining = 0; // 미궁 남은 시간
        this.grade = 9; // 탐험가 등급
        this.sleepCount = 0; // 하루 잠자기 횟수
        this.aura_active = false; // 인간 종족 오러 활성화 여부
        this.evasionBonus = 0; // 비행 등으로 인한 임시 회피율 보너스
        this.criticalHitBoost = false; // [수정] 급소 공격 스킬 활성화 플래그
    }

     // --- 콜백 헬퍼 함수 (음악/SFX 관련 추가) ---
     safeLog(message) {
        if (this.cb && typeof this.cb.logMessage === 'function') {
            this.cb.logMessage(message);
        } else {
            console.error("logMessage callback not available:", message);
        }
    }
     safeUpdateMenu() {
        if (this.cb && typeof this.cb.updateMenu === 'function') {
            this.cb.updateMenu(this);
        } else {
             console.error("updateMenu callback not available");
        }
     }
     safeUpdateCombatStatus() {
         if (this.cb && typeof this.cb.updateCombatStatus === 'function') {
             this.cb.updateCombatStatus(this);
         } else {
             console.error("updateCombatStatus callback not available");
         }
     }
      safeUpdateCombatMenu() {
         if (this.cb && typeof this.cb.updateCombatMenu === 'function') {
             this.cb.updateCombatMenu(this);
         } else {
             console.error("updateCombatMenu callback not available");
         }
     }
     safeUpdateStatusBars() {
        if (this.cb && typeof this.cb.updateStatusBars === 'function') {
            this.cb.updateStatusBars(this);
        } else {
            console.error("updateStatusBars callback not available");
        }
     }
     // 음악/SFX 헬퍼
     safePlayMusic(trackId) {
         if (this.cb && typeof this.cb.playMusic === 'function') {
             this.cb.playMusic(trackId);
         } else {
             console.error("playMusic callback not available");
         }
     }
     safePlaySfx(sfxId) {
         if (this.cb && typeof this.cb.playSfx === 'function') {
             this.cb.playSfx(sfxId);
         } else {
             console.error("playSfx callback not available");
         }
     }
      safeStopMusic() {
         if (this.cb && typeof this.cb.stopMusic === 'function') {
             this.cb.stopMusic();
         } else {
             console.error("stopMusic callback not available");
         }
     }
     // --- 헬퍼 함수 끝 ---


    chooseRace(race) {
        if (!races[race]) {
             this.safeLog(`Error: Race "${race}" not found.`);
             return;
        }
        this.race = race;
        const base = races[race].base_stats;
        Object.keys(base).forEach(k => this.stats[k] = base[k]);
        this.updateMaxStats();
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.stamina = this.maxStamina;
        this.safeLog(`종족 선택: ${race}. ${races[race].special}`);
        // 도시 BGM은 ui.js의 initRaceSelection에서 재생
    }

    updateMaxStats() {
        this.maxHp = (this.stats["지구력"] || 10) * 8 + (this.level * 20);
        this.maxMp = (this.stats["영혼력"] || 10) + (this.stats["정신력"] || 10) * 5;
        this.maxStamina = (this.stats["지구력"] || 10) * 10;
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
        if (monsterName) {
            if (this.killedMonsters.has(monsterName)) {
                this.safeLog(`이미 처치한 ${monsterName}에게서는 경험치를 얻을 수 없습니다.`);
                return false;
            }
            this.killedMonsters.add(monsterName);
        }

        this.exp += amount;
        // 파티원 경험치 분배 (결속 효과)
        this.party.forEach(member => member.gainExp(amount)); // 각 NPC의 gainExp 호출

        while (this.level < maxLevelModded && this.exp >= (expToLevel[this.level] || Infinity)) {
            this.exp -= expToLevel[this.level];
            this.levelUp(); // levelUp 함수 내부에서 SFX 재생
        }
        this.showStatus();
        return true;
    }

    levelUp() {
        this.level++;
        const statKeys = Object.keys(this.stats);
        if (statKeys.length > 0) {
             for(let i=0; i<3; i++) {
                 const randomStat = statKeys[Math.floor(Math.random() * statKeys.length)];
                 this.stats[randomStat]++;
             }
        }

        this.stats["영혼력"] = (this.stats["영혼력"] || 0) + (this.level > 5 ? 30 : 10);
        this.updateMaxStats();
        this.updateGrade();
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.stamina = this.maxStamina;
        // [수정] 레벨당 정수 칸 3개 메시지 반영
        this.safeLog(`레벨 업! ${this.level} 레벨이 되었다! 영혼력이 상승하고, 최대 흡수 가능 정수가 ${this.level * 3}개로 증가했다. 탐험 등급이 ${this.grade}등급으로 변경될 수 있습니다. 정수 드랍률이 소폭 상승합니다.`);
        this.dropRateBonus += 0.01;

        // --- [SFX] 레벨 업 효과음 재생 ---
        this.safePlaySfx('sfx-event');
        // --- [SFX] ---
    }

    addEssence(essenceName) {
        // [수정] 최대 흡수 가능 정수 개수를 레벨 * 3으로 변경
        if (this.essences.length >= this.level * 3) {
            this.safeLog(`최대 정수 흡수량(${this.level * 3}개)을 초과하여 더 이상 흡수할 수 없다.`);
            return;
        }
        const essenceData = essences[essenceName];
        if (!essenceData) {
            this.safeLog(`오류: '${essenceName}' 정수를 찾을 수 없습니다.`);
            // 스탯 정수 처리 (예: 근력 +10)
            const parts = essenceName.match(/^(.+?)\s*\+\s*(\d+)$/);
            if (parts && parts.length === 3) {
                const statName = parts[1].trim();
                const value = parseInt(parts[2]);
                if (this.stats.hasOwnProperty(statName) && !isNaN(value)) {
                    this.stats[statName] += value;
                    this.safeLog(`${statName} 스탯이 ${value}만큼 영구적으로 상승했다.`);
                    this.updateMaxStats();
                    this.showStatus();
                } else {
                    this.safeLog(`오류: '${essenceName}' 정수 적용 실패 - 스탯 이름 또는 값 오류`);
                }
            } else {
                 this.safeLog(`오류: '${essenceName}' 정수 적용 실패 - 형식 오류`);
            }
            return;
        }

        if (this.essences.includes(essenceName)) {
             this.safeLog(`이미 ${essenceName} 정수를 흡수했습니다.`);
             return;
        }


        this.essences.push(essenceName);
        this.safeLog(`${essenceName} 정수를 흡수했다.`);
        // --- [SFX] 정수 획득 효과음 재생 ---
        this.safePlaySfx('sfx-event');
        // --- [SFX] ---
        this.applyEssenceEffect(essenceName);
    }

    // [수정] 정수 효과 적용 로직 보강 (필요시 data_core.js effect 함수 정의 필요)
    applyEssenceEffect(essenceName) {
        const essence = essences[essenceName];
        if (!essence) return;

        // 스탯 적용
        if (essence.stats) {
            Object.entries(essence.stats).forEach(([stat, value]) => {
                if (this.stats.hasOwnProperty(stat)) {
                    this.stats[stat] += value;
                    this.safeLog(`${stat} 스탯이 ${value}만큼 영구적으로 변경되었다.`);
                } else {
                    this.safeLog(`경고: 정수 '${essenceName}'의 스탯 '${stat}'이(가) 플레이어 스탯 목록에 없습니다.`);
                }
            });
        }

        // 패시브 효과 설명 및 즉시 적용 (예시: 자연 재생력 증가)
        if (essence.passive) {
            this.safeLog(`패시브 스킬 '${essence.passive.name}'을 얻었다: ${essence.passive.desc}`);
            // 예시: 데스핀드 정수 - 자연 재생력 증가 (구체적인 구현 필요)
            // if (essenceName === '데스핀드') { this.stats['자연 재생력'] = (this.stats['자연 재생력'] || 0) + 5; /* 임시값 */ }
            // 다른 패시브 효과 적용 로직 추가...
        }

        // 액티브 스킬 추가
        if (essence.active) {
            if (!this.essence_skills.includes(essence.active.name)) {
                 this.essence_skills.push(essence.active.name);
                 this.safeLog(`액티브 스킬 '${essence.active.name}'을 배웠다.`);
                 // --- [SFX] 스킬 습득 효과음 재생 (선택 사항) ---
                 // this.safePlaySfx('sfx-event');
                 // --- [SFX] ---
            }
        }

        // 스탯 변경 후 최대치 업데이트 및 상태 표시
        this.updateMaxStats();
        this.showStatus();
    }


    learnSpell(spell) {
        if (!this.spells.includes(spell)) {
             if (!magic[spell]) {
                 this.safeLog(`오류: '${spell}' 마법을 찾을 수 없습니다.`);
                 return;
             }
            this.spells.push(spell);
            this.safeLog(`${spell} 마법을 배웠다.`);
            // --- [SFX] 마법 습득 효과음 재생 (선택 사항) ---
            // this.safePlaySfx('sfx-event');
            // --- [SFX] ---
        }
    }

    hasSpell(spellName) {
        return this.spells.includes(spellName);
    }

    addItem(item) {
        this.inventory.push(item);
        this.safeLog(`${item} 아이템을 획득했다.`);
        // --- [SFX] 아이템 획득 효과음 재생 ---
        this.safePlaySfx('sfx-event');
        // --- [SFX] ---
    }

    useItem(itemName) {
        if (!this.inventory.includes(itemName)) {
             this.safeLog(`오류: 인벤토리에 ${itemName} 아이템이 없습니다.`);
             return;
        }

        const item = items[itemName] || numbersItems[itemName];
        if (item && typeof item.effect === 'function') {
            this.safeLog(`${itemName}을(를) 사용했다. ${item.desc}`);
            try {
                 item.effect(this); // 아이템 효과 적용
                 // 소모품인 경우 인벤토리에서 제거 (넘버스 아이템 중 소모품도 포함)
                 if (!numbersItems[itemName] || numbersItems[itemName].type === '소모품') {
                     const itemIndex = this.inventory.indexOf(itemName);
                     if (itemIndex > -1) {
                         this.inventory.splice(itemIndex, 1);
                     }
                 }
                 // 아이템 사용 효과음은 필요 시 여기에 추가
                 this.showStatus();
            } catch (e) {
                this.safeLog(`Error using item ${itemName}: ${e.message}`);
                 console.error(e);
            }
        } else {
            this.safeLog(`${itemName} 아이템은 사용할 수 없습니다.`);
        }
    }


    applyDebuff(debuff) {
        this.debuffs.push(debuff);
        this.safeLog(`[${debuff}] 디버프에 걸렸다!`);
    }

    removeAllDebuffs() {
        this.debuffs = [];
        this.safeLog("모든 디버프가 해제되었다.");
    }

    checkSatiety() {
        if (this.position === "Labyrinth") {
            this.satiety -= 1;
            if (this.satiety < 30) {
                this.safeLog("허기를 느낀다... 능력치가 감소한다.");
                // 실제 능력치 감소 로직 추가 가능
            }
            if (this.satiety <= 0) {
                this.hp = Math.max(0, this.hp - 10);
                this.safeLog("굶주림으로 인해 체력이 10 감소했다.");
                if (this.hp <= 0) {
                    this.endCombat(false); // 전투 중이 아니어도 게임 오버 처리 가능하도록
                }
            }
        }
    }

    checkBetrayal() {
        if (this.party.length > 0 && Math.random() < this.betrayalChance) {
            const traitorIndex = Math.floor(Math.random() * this.party.length);
            const traitor = this.party.splice(traitorIndex, 1)[0];
            this.safeLog(`동료 ${traitor.name}이(가) 배신했다! 갑작스러운 공격에 큰 피해를 입었다!`);
            this.hp = Math.max(0, this.hp - 50); // 배신 데미지
            if (this.hp <= 0) {
                 this.endCombat(false);
            }
            // 배신한 NPC와의 전투 로직 추가 가능
        }
    }


    startCombat(monsterNamesInput) {
        let monsterNames = monsterNamesInput;
        if (!Array.isArray(monsterNames)) {
            monsterNames = [monsterNames];
        }
        const validMonsters = monsterNames.map(name => {
            if (!monsters[name]) {
                this.safeLog(`오류: ${name} 몬스터를 찾을 수 없습니다.`);
                return null;
            }
            // 몬스터 데이터 복사 및 초기화
            const monster = JSON.parse(JSON.stringify(monsters[name]));
            monster.name = name; // 이름 명시적 할당
            monster.hp = monster.hp || 50;
            monster.maxHp = monster.hp; // 최대 HP 설정
            monster.atk = monster.atk || 10;
            monster.def = monster.def || 5;
            monster.magic_def = monster.magic_def || 3;
            monster.grade = monster.grade || 9;
            monster.attacks = monster.attacks || [{name:"기본 공격", dmg: monster.atk, type: "physical"}];
            monster.debuffs = []; // 몬스터 디버프 배열 추가
            // 몬스터에게 디버프 적용 함수 추가 (Player 클래스와 유사)
            monster.applyDebuff = function(debuff) {
                 this.debuffs.push(debuff);
                 // 몬스터 디버프 로그는 Player 콜백 사용 불가, 필요시 전투 로그 시스템 확장
            };
            return monster;
        }).filter(m => m !== null);

        if (validMonsters.length === 0) {
             this.safeLog("전투 시작 실패: 유효한 몬스터 없음");
             return;
        }

        this.currentMonster = validMonsters; // 몬스터 배열 저장
        this.inCombat = true;
        this.playerTurn = true;
        this.evasionBonus = 0; // 전투 시작 시 회피 보너스 초기화

        this.safeLog(`!! ${validMonsters.map(m => `${m.name}(${m.grade}등급)`).join(', ')}와(과) 전투 시작 !!`);
        this.safeLog("전투 중에는 미궁을 나갈 수 없습니다.");

        // --- [BGM] 전투 BGM 재생 ---
        this.safePlayMusic('bgm-combat');
        // --- [BGM] ---

        this.safeUpdateCombatStatus(); // 전투 상태 UI 업데이트
        this.safeUpdateCombatMenu(); // 전투 메뉴 UI 업데이트
    }


    handleMonsterDefeat(monster) {
        this.safeLog(`${monster.name}을(를) 처치했다!`);

        // 경험치 획득 (최초 처치 시)
        const gradeNum = typeof monster.grade === 'number' ? monster.grade : 9;
        let expGained = Math.max(0, (10 - gradeNum) * 10 + 5); // 등급 기반 경험치 계산 (임시)
        let gainedExp = false;
        if (monster.name) {
             gainedExp = this.gainExp(expGained, monster.name); // gainExp에서 최초 처치 여부 확인
        } else {
             gainedExp = this.gainExp(expGained); // 이름 없는 몬스터 (거의 없음)
        }

        // 마석 드롭
        let magicStoneAmount = Math.max(1, (10 - gradeNum) * (Math.floor(Math.random() * 5) + 1)); // 등급 기반 마석 계산
        this.magic_stones += magicStoneAmount;

        // 정수 드롭
        let droppedEssence = null;
        if (monster.essences && monster.essences.length > 0) {
            // 드롭률 계산 (기본 + 등급 + 행운 + 아이템 보너스)
            let dropChance = 0.05 + ((10 - gradeNum) * 0.01) + ((this.stats["행운"] || 0) / 1000) + this.dropRateBonus;
            dropChance = Math.min(1.0, Math.max(0, dropChance)); // 0% ~ 100%

            if (Math.random() < dropChance) {
                // 몬스터가 가진 정수 중 하나 랜덤 선택
                const essenceKey = monster.essences[Math.floor(Math.random() * monster.essences.length)];
                if (essenceKey && essences[essenceKey]) { // data_core.js에 정의된 정수인지 확인
                    const essenceDisplayName = `${essenceKey} 정수`;
                    // 흡수 여부 확인
                    if (confirm(`[${essenceDisplayName}]을(를) 획득했습니다. 흡수하시겠습니까? (현재: ${this.essences.length}/${this.level * 3}개)`)) {
                        this.addEssence(essenceKey); // addEssence 내부에서 SFX 재생
                        droppedEssence = essenceDisplayName; // 로그 출력을 위해 저장
                    } else {
                        this.safeLog(`[${essenceDisplayName}]을(를) 버렸습니다.`);
                    }
                } else if (essenceKey) {
                    // 정의되지 않은 정수 키 드롭 시 경고
                    this.safeLog(`경고: ${monster.name}이(가) ${essenceKey} 정수 키를 드롭했지만, data_core.js에 정의되지 않았습니다.`);
                }
            }
        }

        // 아이템 드롭
        let droppedItem = null;
        if (monster.drops && monster.drops.length > 0 && Math.random() < 0.1) { // 10% 확률로 아이템 드롭 (임시)
             const item = monster.drops[Math.floor(Math.random() * monster.drops.length)];
             if (item) {
                 droppedItem = item;
                 this.addItem(item); // addItem 내부에서 SFX 재생
             }
        }

        // 보상 로그 출력
        let rewardMsg = `${monster.name} 처치 보상: `;
        if(gainedExp) rewardMsg += `경험치 ${expGained}, `;
        rewardMsg += `마석 ${magicStoneAmount}개`;
        if (droppedEssence) rewardMsg += `, ${droppedEssence} (흡수됨)`;
        if (droppedItem) rewardMsg += `, ${droppedItem}`;
        this.safeLog(rewardMsg);
    }


    endCombat(victory) {
        if (!this.inCombat && this.hp > 0) return; // 전투 중이 아니거나 살아있으면 종료 로직 스킵

        const wasInCombat = this.inCombat;
        this.inCombat = false;
        this.criticalHitBoost = false; // 전투 종료 시 급소 공격 플래그 초기화

        // 게임 오버 처리
        if (!wasInCombat && this.hp <= 0) { // 전투 중이 아닌 상태에서 HP가 0이 된 경우 (굶주림 등)
             this.safeLog("패배... 모든 것을 잃고 게임을 처음부터 다시 시작합니다.");
             this.safeStopMusic();
             setTimeout(() => location.reload(), 3000); // 3초 후 새로고침
             return;
        }

        if (victory) {
            this.safeLog("승리!");
            // 승리 후 BGM 전환
            if (this.position === "Labyrinth") {
                this.safePlayMusic('bgm-dungeon');
            } else {
                this.safePlayMusic('bgm-city');
            }
        } else if (this.hp <= 0) { // 전투 패배
            this.safeLog("패배... 모든 것을 잃고 게임을 처음부터 다시 시작합니다.");
            this.safeStopMusic();
            setTimeout(() => location.reload(), 3000);
            return;
        } else { // 도망 성공
             // 도망 후 BGM 전환
             if (this.position === "Labyrinth") {
                 this.safePlayMusic('bgm-dungeon');
             } else {
                 this.safePlayMusic('bgm-city');
             }
        }

        this.currentMonster = null; // 현재 몬스터 정보 초기화
        this.safeUpdateMenu(); // 메인 메뉴 UI 업데이트
        this.showStatus(); // 플레이어 상태 정보 업데이트
    }



    playerAttack(targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster || this.currentMonster.length === 0) return;
        if (this.stamina < 1) { // 기력 1 소모 가정
             this.safeLog("기력이 부족하여 공격할 수 없습니다.");
             return;
        }

        // 대상 유효성 검사
        if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length) {
            this.safeLog("잘못된 대상입니다.");
            return;
        }
        const target = this.currentMonster[targetIndex];
         if (!target || target.hp <= 0) { // 대상이 없거나 이미 죽은 경우
             this.safeLog("오류: 공격 대상이 존재하지 않거나 이미 처치되었습니다.");
             this.safeUpdateCombatMenu(); // 메뉴 다시 표시
             return;
         }


        this.stamina -= 1; // 기력 소모
        let fatiguePenalty = this.fatigue >= 100 ? 0.5 : 1; // 피로도 100 이상 시 공격력 50% 감소
        let baseDamage = this.stats["근력"] || 10;
        let targetDefense = target.def || 0;
        let dmg = Math.max(1, (baseDamage - targetDefense) * fatiguePenalty);

        // [수정] 치명타 로직 (급소 공격 효과 적용)
        let critChance = (this.stats["행운"] || 5) / 100; // 기본 치명타 확률 (행운 기반)
        if (this.criticalHitBoost) {
            critChance += 0.5; // 급소 공격 활성화 시 치명타 확률 50% 증가
            this.safeLog("급소 공격! 치명타 확률이 증가합니다!");
        }
        let isCritical = Math.random() < critChance;
        if (isCritical) {
            dmg *= 2; // 치명타 시 데미지 2배
            this.safeLog("치명타!");
        }
        this.criticalHitBoost = false; // 급소 공격 플래그 사용 후 초기화

        // 오러 효과 적용 (인간 종족)
        if (this.aura_active) {
            let defense_penetration = (target.def || 0) * 0.1; // 방어력 10% 무시 (임시값)
            let magic_defense_penetration = (target.magic_def || 0) * 0.1; // 마법방어력 10% 무시 (임시값)
            dmg += defense_penetration + magic_defense_penetration;
            this.aura_active = false; // 오러 사용 후 비활성화
            this.safeLog("오러의 힘으로 방어력을 일부 무시합니다!");
        }
        dmg = Math.floor(dmg); // 데미지 정수 처리

        // 대상에게 데미지 적용
        target.hp -= dmg;
        this.safeLog(`플레이어의 공격! ${target.name}에게 ${dmg}의 피해를 입혔다. (몬스터 HP: ${target.hp})`);
        if (fatiguePenalty < 1) this.safeLog("피로가 100에 도달하여 공격력이 크게 감소했다!");

        // 몬스터 처치 확인
        if (target.hp <= 0) {
            this.handleMonsterDefeat(target); // 처치 처리 (경험치, 드랍 등)
            // 죽은 몬스터를 배열에서 제거 (filter 대신 splice 사용 고려 가능)
            this.currentMonster = this.currentMonster.filter((m, i) => i !== targetIndex);
            this.safeUpdateCombatStatus(); // 전투 상태 UI 업데이트
        }

        // 플레이어 턴 종료
        this.endTurn();
    }


    playerSpell(spellName, targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster || this.currentMonster.length === 0) return;

        const spell = magic[spellName];
        if (!spell) {
             this.safeLog(`오류: '${spellName}' 주문을 찾을 수 없습니다.`);
             return;
        }
        if (this.mp < spell.mp_cost) {
            this.safeLog("MP가 부족하여 마법을 사용할 수 없다.");
            return;
        }

         // 대상 유효성 검사
         if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length) {
            this.safeLog("잘못된 대상입니다.");
            return;
        }
        const target = this.currentMonster[targetIndex];
         if (!target || target.hp <= 0) {
             this.safeLog("오류: 주문 대상이 존재하지 않거나 이미 처치되었습니다.");
             this.safeUpdateCombatMenu();
            return;
        }

        this.mp -= spell.mp_cost; // MP 소모
        this.safeLog(`'${spellName}' 주문을 시전했다!`);

        try {
             // 주문 효과 적용
             if (typeof spell.effect === 'function') {
                 // effect 함수에 caster(this)와 target 전달
                spell.effect(this, target);
             } else if (spell.dmg !== undefined) { // 직접적인 데미지 주문인 경우
                 let magicDefense = target.magic_def || 0;
                 let spellDamage = spell.dmg || 0;
                 // 정수 등으로 인한 마법 데미지 증폭 로직 추가 가능
                 let finalDamage = Math.max(1, spellDamage - magicDefense);
                 target.hp -= finalDamage;
                 this.safeLog(`주문 ${spellName}(으)로 ${target.name}에게 ${finalDamage}의 피해! (몬스터 HP: ${target.hp})`);
             }
             // 기타 효과 (디버프 등) 로직 추가 가능

             // 몬스터 처치 확인
             if (target.hp <= 0) {
                 this.handleMonsterDefeat(target);
                 this.currentMonster = this.currentMonster.filter((m, i) => i !== targetIndex);
                 this.safeUpdateCombatStatus();
             }
        } catch (e) {
             this.safeLog(`Error casting spell ${spellName}: ${e.message}`);
             console.error(e);
        }

        this.endTurn(); // 플레이어 턴 종료
    }


    playerEssenceSkill(skillName, targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster || this.currentMonster.length === 0) return;

        // 사용하려는 스킬 정보 찾기
        let essenceData = null;
        let essenceKey = null;
        for (const key of this.essences) {
            const ess = essences[key];
            if (ess && ess.active && ess.active.name === skillName) {
                essenceData = ess.active;
                essenceKey = key; // 해당 스킬이 어느 정수에서 왔는지 저장
                break;
            }
        }

        if (!essenceData) {
            this.safeLog(`오류: '${skillName}' 정수 스킬을 찾을 수 없거나 배우지 않았습니다.`);
            return;
        }

        const skillCost = essenceData.mp_cost || 0; // MP 소모량
        if (this.mp < skillCost) {
            this.safeLog("MP가 부족하여 정수 스킬을 사용할 수 없다.");
            return;
        }

        // 대상 유효성 검사
        if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length) {
            this.safeLog("잘못된 대상입니다.");
            return;
        }
        const target = this.currentMonster[targetIndex];
        if (!target || target.hp <= 0) {
            this.safeLog("오류: 스킬 대상이 존재하지 않거나 이미 처치되었습니다.");
            this.safeUpdateCombatMenu();
            return;
        }

        this.mp -= skillCost; // MP 소모
        this.safeLog(`'${skillName}' 정수 스킬을 사용했다!`);

        try {
            // [수정] 칼날늑대 '급소 공격' 효과 적용
            if (essenceKey === '칼날늑대' && skillName === '급소 공격') {
                this.criticalHitBoost = true; // 다음 공격 치명타 확률 증가 플래그 활성화
                // this.safeLog("다음 공격의 치명타 확률이 증가했다!"); // playerAttack 에서 로그 출력하므로 중복 제거
            }
            // 다른 정수 스킬 효과 구현 ...
            // 예: 스톤골렘 '진압'
            else if (essenceKey === '스톤골렘' && skillName === '진압') {
                 target.applyDebuff("진압");
                 this.safeLog(`${target.name}을 진압 상태로 만들었다! (피해를 입으면 해제)`);
            }
            // 예: 데스핀드 '망자의 부름' (소환 로직 필요)
            else if (essenceKey === '데스핀드' && skillName === '망자의 부름') {
                 this.safeLog("망자들을 불러내어 구울을 소환했다!"); // 실제 소환 로직은 복잡하므로 로그만 출력
                 // 예시: this.summonMonsters(['구울', '구울']);
            }
            // 기본 effect 함수 실행 (data_core.js 에 정의된 경우)
            else if (typeof essenceData.effect === 'function') {
                // effect 함수가 caster(this)와 target을 받도록 수정 (필요 시 data_core.js의 effect 함수도 수정)
                essenceData.effect(this, target);
            }
            // 데미지 직접 적용 (data_core.js 에 dmg 정의된 경우)
            else if (essenceData.dmg !== undefined) {
                 let defense = (essenceData.type === 'magic') ? (target.magic_def || 0) : (target.def || 0);
                 let finalDamage = Math.max(1, (essenceData.dmg || 0) - defense);
                 target.hp -= finalDamage;
                 this.safeLog(`스킬 ${skillName}(으)로 ${target.name}에게 ${finalDamage}의 피해! (몬스터 HP: ${target.hp})`);
            }
            else {
                 this.safeLog(`경고: '${skillName}' 스킬의 효과(effect 또는 dmg)가 정의되지 않았습니다.`);
            }

            // 몬스터 처치 확인
            if (target.hp <= 0) {
                 this.handleMonsterDefeat(target);
                 this.currentMonster = this.currentMonster.filter((m, i) => i !== targetIndex);
                 this.safeUpdateCombatStatus();
            }
        } catch (e) {
            this.safeLog(`Error using essence skill ${skillName}: ${e.message}`);
            console.error(e);
        }

        this.endTurn(); // 플레이어 턴 종료
    }


    playerRun() {
        if (!this.playerTurn || !this.inCombat) return;
        this.safeLog("도망을 시도한다...");
        // 도망 확률 계산 (민첩성 기반)
        let runChance = 0.5 + ((this.stats["민첩성"] || 10) / 200);
        runChance = Math.min(0.95, runChance); // 최대 95%

        if (Math.random() < runChance) {
            this.safeLog("성공적으로 도망쳤다!");
            this.endCombat(false); // 전투 종료 (승리 아님)
        } else {
            this.safeLog("도망에 실패했다.");
            this.endTurn(); // 도망 실패 시 턴 종료
        }
    }

    endTurn() {
        if (!this.inCombat) return;

        // 모든 몬스터가 처치되었는지 확인
        if (this.currentMonster && this.currentMonster.length === 0) {
            this.endCombat(true); // 승리 처리
            return;
        }

        // 플레이어 턴 종료 및 몬스터 턴 시작 예약
        this.playerTurn = false;
        this.safeUpdateCombatMenu(); // UI 업데이트 (몬스터 턴 표시)
        setTimeout(() => this.monsterTurn(), 750); // 0.75초 후 몬스터 턴 실행
    }

    // [수정] 몬스터 턴 로직 (타겟팅 변경)
    monsterTurn() {
        if (!this.inCombat) return;
        if (!this.currentMonster || this.currentMonster.length === 0) {
             this.safeLog("오류: 몬스터 턴이지만 몬스터가 없습니다.");
             this.startPlayerTurn(); // 즉시 플레이어 턴 시작
             return;
        }

        // 모든 살아있는 몬스터가 순서대로 행동
        this.currentMonster.forEach((monster, index) => {
            if (this.hp <= 0 || !this.inCombat) return; // 플레이어가 죽었거나 전투가 종료되면 중단
            if (!monster || monster.hp <= 0) return; // 이미 죽은 몬스터는 턴 스킵

            // 상태이상 체크 (공포, 기절, 결빙 등)
            if(monster.debuffs && monster.debuffs.includes("공포") && Math.random() < 0.5) {
                this.safeLog(`${monster.name}은(는) 공포에 질려 아무것도 하지 못했다!`);
                return; // 행동 불가
            }
             if(monster.debuffs && monster.debuffs.includes("기절") && Math.random() < 0.7) {
                this.safeLog(`${monster.name}은(는) 기절해서 아무것도 하지 못했다!`);
                return; // 행동 불가
            }
             if(monster.debuffs && monster.debuffs.includes("결빙")) {
                 this.safeLog(`${monster.name}은(는) 얼어붙어 움직일 수 없다!`);
                 if (Math.random() < 0.3) { // 결빙 해제 시도
                     monster.debuffs = monster.debuffs.filter(d => d !== "결빙");
                     this.safeLog(`${monster.name}의 결빙이 풀렸다!`);
                 }
                 return; // 행동 불가
             }
             // 진압 상태이상은 플레이어에게만 적용되므로 몬스터 턴에서는 체크 불필요

            // 공격 대상 결정 (플레이어 또는 파티원 중 랜덤)
            const potentialTargets = [this, ...this.party.filter(p => p.hp > 0)]; // 살아있는 플레이어와 파티원
            const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
            if (!target) return; // 공격 대상 없음 (모두 사망?)

            // 사용할 공격/스킬 선택
            const attackOptions = monster.attacks || [{name:"기본 공격", dmg: monster.atk, type: "physical"}];
            const atk = attackOptions[Math.floor(Math.random() * attackOptions.length)];
            let dmg = 0;
            let defense = 0;

            // 데미지 타입에 따른 방어력 적용
            if(atk.type === "magic") {
                 defense = target.stats?.["항마력"] || target.magic_def || 5; // 대상의 항마력 또는 기본 마법 방어력
                 dmg = Math.max(1, (atk.dmg || monster.atk || 10) - defense);
            } else {
                 defense = target.stats?.["물리 내성"] || target.def || 5; // 대상의 물리 내성 또는 기본 방어력
                 dmg = Math.max(1, (atk.dmg || monster.atk || 10) - defense);
            }

            // 회피 체크 (플레이어 대상일 경우만, NPC는 회피 로직 없음)
            if (target === this) {
                let evasionChance = this.evasionBonus + ((this.stats['민첩성'] || 10) / 200); // 플레이어 회피율
                evasionChance = Math.min(0.8, evasionChance); // 최대 80%
                if (Math.random() < evasionChance) {
                    this.safeLog(`${monster.name}의 '${atk.name}' 공격! 하지만 민첩하게 회피했다!`);
                    return; // 공격 회피
                }
            }

             // 대상에게 데미지 적용
             target.hp = Math.max(0, target.hp - dmg);
             this.safeLog(`${monster.name}의 '${atk.name}' 공격! ${target.name || '플레이어'}에게 ${dmg}의 피해를 입혔다. (${target.name ? target.name : '플레이어'} HP: ${target.hp})`);
             this.safeUpdateCombatStatus(); // 파티원 HP 표시 업데이트

             // 대상이 플레이어일 경우 디버프 적용
             if (target === this) {
                 if(atk.dot && atk.type === 'poison') this.applyDebuff(`독(${atk.dot})`);
                 if(atk.dot && atk.type !== 'poison') this.applyDebuff(`출혈(${atk.dot})`);
                 if(atk.effect === "stun" && Math.random() < 0.3) this.applyDebuff("기절");
                 if(atk.effect === "blind" && Math.random() < 0.2) this.applyDebuff("실명");
                 if(atk.effect === "trap" && atk.name === "진압" && Math.random() < 0.4) { // 고블린 덫 설치, 스톤골렘 진압 구분 필요
                     this.applyDebuff("진압");
                     this.safeLog(`${monster.name}의 진압에 걸려 움직일 수 없다! (피해를 입으면 해제)`);
                 }
                 // 공포 등 다른 효과 추가
             }

             // 대상 사망 체크
            if (target.hp <= 0) {
                 if (target === this) { // 플레이어 사망
                     this.safeLog("플레이어가 쓰러졌다!");
                     this.endCombat(false); // 게임 오버
                     return; // 몬스터 턴 즉시 종료
                 } else { // 파티원 사망
                     this.safeLog(`${target.name}이(가) 쓰러졌다!`);
                     // 쓰러진 파티원 처리 (전투에서 제외 등) - party 배열에서 제거는 전투 종료 후 고려
                 }
             }
        });

        // 플레이어나 전투가 종료되지 않았다면 파티원 턴 진행
        if (this.hp > 0 && this.inCombat) {
            this.partyTurn();
        }
    }

    // [신규] 파티원 턴 로직
    partyTurn() {
        if (!this.inCombat || !this.currentMonster || this.currentMonster.length === 0) {
            this.startPlayerTurn(); // 전투 끝났거나 몬스터 없으면 플레이어 턴
            return;
        }

        // 진압 상태 시 파티원 행동 불가
        if (this.debuffs.includes("진압")) {
            this.safeLog("진압 상태라서 파티원들이 행동할 수 없다!");
            this.startPlayerTurn(); // 즉시 플레이어 턴 시작
            return;
        }

        // 살아있는 파티원들이 순서대로 행동
        this.party.forEach(member => {
            if (!this.inCombat || !this.currentMonster || this.currentMonster.length === 0 || member.hp <= 0) return; // 전투 중단/종료 또는 파티원 사망 시 스킵

             // 공격 대상 몬스터 랜덤 선택 (살아있는 몬스터 중에서)
             const livingMonsters = this.currentMonster.filter(m => m && m.hp > 0);
             if (livingMonsters.length === 0) return; // 공격할 몬스터 없음
             const targetIndex = Math.floor(Math.random() * livingMonsters.length);
             const targetMonster = livingMonsters[targetIndex];
             const originalTargetIndex = this.currentMonster.findIndex(m => m === targetMonster); // 원본 배열에서의 인덱스

             // 스킬 사용 또는 기본 공격 (간단한 확률 기반 결정)
             if (member.skills.length > 0 && member.mp >= (member.skills[0]?.cost || 0) && Math.random() < 0.4) { // 40% 확률로 스킬 사용 (MP 있을 경우)
                 // 치유 스킬은 HP 낮은 아군 대상, 공격 스킬은 몬스터 대상 (세부 로직 필요)
                 if (member.trait === "신관") {
                     const lowestHpAlly = [this, ...this.party].filter(p => p.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
                     if (lowestHpAlly && lowestHpAlly.hp < lowestHpAlly.maxHp) {
                         member.useSkill(lowestHpAlly);
                     } else {
                         member.attack(targetMonster); // 치유 대상 없으면 공격
                     }
                 } else {
                    member.useSkill(targetMonster); // 몬스터 대상 스킬 사용
                 }
             } else {
                 member.attack(targetMonster); // 기본 공격
             }

             // 파티원 공격으로 몬스터 처치 확인
             if (targetMonster.hp <= 0) {
                 this.safeLog(`${member.name}이(가) ${targetMonster.name}을(를) 처치했다!`);
                 this.handleMonsterDefeat(targetMonster);
                 // 죽은 몬스터 제거
                 this.currentMonster = this.currentMonster.filter(m => m !== targetMonster);
                 this.safeUpdateCombatStatus(); // 전투 상태 UI 업데이트

                 // 모든 몬스터 처치 시 전투 종료
                 if (this.currentMonster.length === 0) {
                     this.endCombat(true);
                     return; // 파티원 턴 종료
                 }
             }
        });

        // 모든 파티원 행동 후 플레이어 턴 시작 (전투가 계속 중이라면)
        if (this.inCombat) {
            this.startPlayerTurn();
        }
    }


     startPlayerTurn() {
         if (!this.inCombat) return;

         // 플레이어 턴 시작 시 처리 (예: 디버프 효과 적용, 쿨타임 감소 등)
         // 예: 독 디버프 처리
         this.debuffs.filter(d => d.startsWith("독(")).forEach(debuff => {
             const match = debuff.match(/독\((\d+)\)/);
             if (match) {
                 const dotDamage = parseInt(match[1]);
                 this.hp = Math.max(0, this.hp - dotDamage);
                 this.safeLog(`독 효과로 ${dotDamage}의 피해를 입었다. (HP: ${this.hp})`);
                 if (this.hp <= 0) {
                     this.endCombat(false);
                     return;
                 }
             }
         });
         // 예: 출혈 디버프 처리
         this.debuffs.filter(d => d.startsWith("출혈(")).forEach(debuff => {
              const match = debuff.match(/출혈\((\d+)\)/);
              if (match) {
                  const dotDamage = parseInt(match[1]);
                  this.hp = Math.max(0, this.hp - dotDamage);
                  this.safeLog(`출혈 효과로 ${dotDamage}의 피해를 입었다. (HP: ${this.hp})`);
                  if (this.hp <= 0) {
                      this.endCombat(false);
                      return;
                  }
              }
          });

         // 진압 상태 해제 시도 (피해 입으면 자동 해제되도록 수정 필요 - Player 클래스 데미지 받는 부분)
         // this.debuffs = this.debuffs.filter(d => d !== "진압");

         this.playerTurn = true;
         this.evasionBonus = 0; // 턴 시작 시 회피 보너스 초기화
         this.safeUpdateCombatStatus(); // 상태 UI 업데이트
         this.safeUpdateCombatMenu(); // 메뉴 UI 업데이트
     }


    showStatus() {
         if (!document.getElementById('status')) {
             console.error("Error: Status element not found in DOM.");
             return;
         }
        // 상태 텍스트 생성
        let statusHtml = `<b>종족:</b> ${this.race || '미선택'} | <b>레벨:</b> ${this.level} | <b>탐험 등급:</b> ${this.grade}등급 | <b>EXP:</b> ${this.exp}/${expToLevel[this.level] || 'MAX'}<br>`;
        statusHtml += `<b>포만감:</b> ${this.satiety} | <b>피로:</b> ${this.fatigue}/100 | <b>미궁 남은시간:</b> ${this.timeRemaining > 0 ? this.timeRemaining + '시간' : '제한 없음'}<br>`;
        // [수정] 파티원 이름과 등급만 표시 (간략화)
        statusHtml += `<b>동료:</b> ${this.party.map(p => `${p.name}(${p.grade}등급/${p.trait})`).join(', ') || '없음'}<br>`;
        statusHtml += "<b>스탯:</b><ul class='stat-list'>";
        statsList.forEach(stat => {
            if (this.stats.hasOwnProperty(stat.name) && this.stats[stat.name] !== 0) {
                statusHtml += `<li class='stat-item'>${stat.name}: ${this.stats[stat.name]}</li>`;
            }
        });
        statusHtml += "</ul><b>특수 스탯:</b><ul class='special-stat-list'>";
        Object.entries(this.specialStats).forEach(([k, obj]) => {
             if (obj.value !== 0) {
                 statusHtml += `<li>${k}: ${obj.value}</li>`;
             }
        });
        statusHtml += "</ul>";
        statusHtml += `<b>마법:</b> ${this.spells.length > 0 ? this.spells.join(", ") : '없음'}<br>`;
        // [수정] 레벨당 정수 칸 3개 표시
        statusHtml += `<b>정수:</b> ${this.essences.length > 0 ? this.essences.map(key => `${key} 정수`).join(", ") : '없음'} (${this.essences.length}/${this.level * 3})<br>`;
        statusHtml += `<b>정수 스킬:</b> ${this.essence_skills.length > 0 ? this.essence_skills.join(", ") : '없음'}<br>`;
        statusHtml += `<b>인벤토리 (${this.inventory.length}개):</b> ${this.inventory.slice(0, 5).join(", ")}${this.inventory.length > 5 ? '...' : ''}<br>`;
        statusHtml += `<b>장비:</b><br>
            투구: ${this.equipment.투구 || '없음'} |
            갑옷: ${this.equipment.갑옷 || '없음'} |
            장갑: ${this.equipment.장갑 || '없음'} <br>
            각반: ${this.equipment.각반 || '없음'} |
            무기: ${this.equipment.무기 || '없음'} |
            부무기: ${this.equipment.부무기 || '없음'}<br>`;
        statusHtml += `<b>골드:</b> ${this.gold} 스톤 | <b>마석:</b> ${this.magic_stones} 개`;

        // 상태 엘리먼트 업데이트
        try {
            document.getElementById('status').innerHTML = statusHtml;
        } catch(e) {
             console.error("DOM Error updating status:", e);
        }

        // 상태 바 업데이트 호출
        this.safeUpdateStatusBars();
    }
}