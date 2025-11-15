// 파일: class_player_combat.js
// 역할: Player 클래스의 전투 관련 메서드 (턴 관리, 공격, 스킬 사용)
// [수정] monsterTurn: 몬스터의 (1턴) 디버프가 제거되지 않아 무한 기절/속박에 걸리던 버그 수정
// [수정] (v4) playerAttack, monsterTurn, playerSpell, playerEssenceSkill, partyTurn:
//        스킬 사용 시 화면 흔들림(showScreenEffect) 및 스킬 텍스트 박스(logMessage 클래스) 연출 추가
// [수정] (v5) playerAttack: 치명타 발생 시 'log-critical-hit' (노란색) 텍스트 박스 연출 추가

import { helpers } from './class_helpers.js';

export const PlayerCombatMethods = {

    startCombat(monsterNamesInput) {
        let monsterNames = helpers.toArray(monsterNamesInput);
        
        const validMonsters = monsterNames.map(name => {
            if (!this.gameData.monsters || !this.gameData.monsters[name]) {
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.(`오류: ${name} 몬스터를 찾을 수 없습니다.`);
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
            
            // [신규] 보스 페이즈 플래그
            monster.bossPhase = 1;
            monster.phase2Triggered = false;

            monster.currentStats = {
                '근력': monster.atk,
                '물리 내성': monster.def,
                '항마력': monster.magic_def,
                ...(monster.stats || {}) // [수정] 몬스터의 원본 스탯도 currentStats에 포함
            };
            
            monster.applyDebuff = function(debuff) {
                 if (!this.debuffs.includes(debuff)) {
                     this.debuffs.push(debuff);
                 }
            };
            return monster;
        }).filter(m => m !== null);

        if (validMonsters.length === 0) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.("전투 시작 실패: 유효한 몬스터 없음");
             return;
        }

        this.currentMonster = validMonsters;
        this.inCombat = true;
        this.playerTurn = true;
        this.evasionBonus = 0; 

        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage?.(`!! ${validMonsters.map(m => `${m.name}(${m.grade}등급)`).join(', ')}와(과) 전투 시작 !!`);
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.playMusic?.('bgm-combat');
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.updateCombatStatus?.(this);
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.updateCombatMenu?.(this);
    },


    /**
     * [수정] 정수 분배 및 레이드 보상 드랍 + 처치 시 패시브
     * @param {object} monster - 처치된 몬스터 객체
     */
    handleMonsterDefeat(monster) {
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage?.(`${monster.name}을(를) 처치했다!`);
        
        // [신규] 퀘스트 진행 체크
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.questManager?.checkProgress?.('KILL', monster.name, 1);

        const gradeNum = typeof monster.grade === 'number' ? monster.grade : 9;
        let expGained = Math.max(0, (10 - gradeNum) * 10 + 5);
        
        // [수정] gainExp에서 최초/반복 여부 처리
        this.gainExp(expGained, monster.name); 

        let magicStoneAmount = Math.max(1, (10 - gradeNum) * (Math.floor(Math.random() * 5) + 1));
        this.magic_stones += magicStoneAmount;

        // [패시브 구현] 처치 시 패시브 (예: 소울이터)
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (this.essences?.includes("소울이터")) {
            const mpHeal = Math.floor(this.maxMp * 0.10);
            this.mp = Math.min(this.maxMp, this.mp + mpHeal);
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.(`[패시브: 영혼 갈취]! ${monster.name} 처치! MP를 ${mpHeal} 회복합니다!`);
        }

        let droppedEssence = null;
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (monster.essences?.length > 0) {
            let dropChance = 0.05 + ((10 - gradeNum) * 0.01) + ((this.currentStats["행운"] || 0) / 1000); // 기본 5% + @
            /* AUTO-FIX: added optional chaining ?. for safety */
            if (this.inventory?.includes("초심자의 행운") && !this.killedMonsterTypes.has(monster.name)) {
                dropChance += 0.05; // 5%p 고정 증가
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.("[패시브: 초심자의 행운] 정수 드랍률 +5% 적용!");
            }
            dropChance = Math.min(1.0, Math.max(0, dropChance));

            if (Math.random() < dropChance) {
                const essenceKey = monster.essences[Math.floor(Math.random() * monster.essences.length)];
                if (essenceKey && this.gameData.essences && this.gameData.essences[essenceKey]) {
                    const essenceDisplayName = `${essenceKey} 정수`;
                    
                    /* AUTO-FIX: [Optimization] Set pause flag to wait for user input from modal */
                    this.isWaitingForEssenceChoice = true;
                    
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage?.(`[${essenceDisplayName}]을(를) 획득했습니다! 누구에게 주시겠습니까?`);
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    // [수정] 3번째 인자로 몬스터 이름(essenceKey)을 전달 (ui_party.js의 타이틀 표시용)
                    this.cb?.showEssencePartyChoice?.(this, essenceKey, essenceDisplayName);
                }
            }
        }

        let droppedItem = null;
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (monster.drops?.length > 0 && Math.random() < 0.1) {
             const item = monster.drops[Math.floor(Math.random() * monster.drops.length)];
             if (item) {
                 droppedItem = item;
                 this.addItem(item); // addItem에서 showStatus 및 퀘스트 체크 호출
             }
        }

        // [신규] 2등급 이하 보스 '넘버스 아이템' 드랍
        if (gradeNum <= 2 && Math.random() < 0.05) { // (임의 5% 확률)
            const numbersItemsList = Object.keys(this.gameData.numbersItems || {});
            if (numbersItemsList.length > 0) {
                const item = numbersItemsList[Math.floor(Math.random() * numbersItemsList.length)];
                if (item) {
                    droppedItem = item;
                    this.addItem(item);
                }
            }
        }

        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage?.(`${monster.name} 처치 보상: 마석 ${magicStoneAmount}개`
            + (droppedEssence ? `, ${essenceDisplayName} (획득)` : "")
            + (droppedItem ? `, ${droppedItem}` : ""));
        
        this.showStatus(); 
    },


    // [수정] 8층 균열 클리어 로직 수정
    endCombat(victory) {
        /* AUTO-FIX: [Optimization] Guard to prevent combat ending while essence choice modal is active */
        if (victory && this.isWaitingForEssenceChoice) return;

        if (!this.inCombat && this.hp > 0) return;

        const wasInCombat = this.inCombat;
        this.inCombat = false;
        this.criticalHitBoost = false; 

        // --- [수정] 균열 클리어 로직 ---
        if (victory && this.position === "Rift" && this.currentRift) {
            
            this.currentRiftStage++; 

            // 마지막 스테이지인지 확인
            if (this.currentRiftStage >= this.currentRift.stages.length) {
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.(`[${this.currentRift.name}] 균열 정복! 수호자를 처치했습니다.`);
                this.addItem("균열석"); 
                
                // [신규] 8층 버그 수정: 8층에서 균열 클리어 시
                if (this.currentLayer === 8 || this.currentLayer === "8") {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage?.("9층으로 향하는 포탈과 8층으로 돌아가는 포탈이 열렸습니다.");
                    this.currentRift = null;
                    this.currentRiftStage = 0;
                    // 9층으로 가거나 8층(현재층)에 머무를지 선택
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.showPortalChoice?.(this, 9, 8);
                    return; 
                }

                // (8층이 아닌 다른 층의 균열 클리어 시)
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.("도시로 귀환합니다.");
                this.position = "라비기온 (7-13구역)"; // 도시로 강제 귀환
                this.currentRift = null;
                this.currentRiftStage = 0;
                
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.playMusic?.('bgm-city');
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.updateMenu?.(this);
                this.showStatus();
                return;
            } else {
                // 아직 다음 스테이지가 남음
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.(`균열 ${this.currentRift.stages[this.currentRiftStage-1].name} 단계를 클리어했습니다. 다음 탐사를 준비하십시오.`);
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.playMusic?.('bgm-dungeon'); // 던전 BGM 유지
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.updateMenu?.(this); 
                this.showStatus();
                return;
            }
        }
        // --- 수정 끝 ---


        if (this.hp <= 0) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.("패배... 모든 것을 잃고 게임을 처음부터 다시 시작합니다.");
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.stopMusic?.();
             setTimeout(() => location.reload(), 3000);
             return;
        }

        if (wasInCombat) {
            if (victory) {
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.("승리!");
            } else {
                 /* AUTO-FIX: added optional chaining ?. for safety */
                 this.cb?.logMessage?.("성공적으로 도망쳤다!");
            }
            
            if (this.position === "Labyrinth") {
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.playMusic?.('bgm-dungeon');
            } else {
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.playMusic?.('bgm-city');
            }
        }

        this.currentMonster = null;
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.updateMenu?.(this);
        this.showStatus();
    },


    /**
     * [수정] (v5) 치명타 연출 추가
     */
    playerAttack(targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;
        if (this.stamina < 1) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.("기력이 부족하여 공격할 수 없습니다.");
             return;
        }

        const target = this.currentMonster[targetIndex];
         if (!target || target.hp <= 0) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.("오류: 공격 대상이 이미 처치되었습니다.");
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.updateCombatMenu?.(this);
             return;
         }

        this.stamina -= 1;
        let fatiguePenalty = this.fatigue >= 100 ? 0.5 : 1;
        
        let baseDamage = this.currentStats["근력"] || 10;
        let targetDefense = target.currentStats?.['물리 내성'] || 0;
        
        // [패시브 구현] '오러' (방어력 90% 무시)
        if (this.aura_active) {
            let defense_penetration = targetDefense * 0.9; // 방어력 90% 무시
            targetDefense = targetDefense - defense_penetration;
            this.aura_active = false;
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.("오러의 힘으로 방어력을 90% 무시합니다!");
        }

        let dmg = helpers.calculateDamage(baseDamage, targetDefense);
        dmg *= fatiguePenalty;

        // [수정] class_player_core에서 계산된 파생 스탯(critChance) 사용
        let critChance = this.critChance; 
        if (this.criticalHitBoost) {
            critChance += 0.5; 
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.("급소 공격! 치명타 확률이 증가합니다!");
        }
        
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (this.debuffs?.includes("사형선고(1회)")) {
            const luckBonus = (this.currentStats["행운"] || 0) / 10 * 2; // 행운 10당 200% -> 2배
            dmg *= (1 + luckBonus);
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.(`[패시브: 사형선고]! 행운 보너스로 피해량이 ${luckBonus * 100}% 증폭됩니다!`);
            this.debuffs = this.debuffs.filter(d => d !== "사형선고(1회)");
        }

        let isCritical = false;
        if (Math.random() < critChance) {
            dmg *= 2;
            isCritical = true;
        }
        
        this.criticalHitBoost = false;
        dmg = Math.floor(dmg);

        helpers.safeHpUpdate(target, -dmg);

        // [신규] (v4) 스킬 연출 (화면 흔들림)
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.showScreenEffect?.('shake');
        
        // [신규] (v5) 치명타 연출 (노란색 텍스트 박스)
        if (isCritical) {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.(`치명타!`, 'log-critical-hit');
        }
        
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage?.(`플레이어의 공격! ${target.name}에게 ${dmg}의 피해. (몬스터 HP: ${target.hp})`);

        // [패시브 구현] 공격 시 발동 패시브 (흡혈, 독 부여 등)
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (this.essences?.includes("고블린")) { // 마비독
            if (Math.random() < 0.1) helpers.safeApplyDebuff(this, target, "둔화(마비독)");
        }
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (this.essences?.includes("고블린 궁수")) { // 독화살
            /* AUTO-FIX: added optional chaining ?. for safety */
            if (this.equipment["무기"]?.includes("활")) { // (활 착용 시 - 임의)
                 helpers.safeApplyDebuff(this, target, "독(약)");
            }
        }
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (this.essences?.includes("뱀파이어")) { // 흡혈
            const healAmount = Math.floor(dmg * 0.10);
            helpers.safeHpUpdate(this, healAmount);
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.(`[패시브: 흡혈]! ${healAmount}의 HP를 흡수했습니다.`);
        }
        // ... 기타 공격 시 패시브 ...


        if (target.hp <= 0) {
            this.handleMonsterDefeat(target);
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.updateCombatStatus?.(this);

            /* AUTO-FIX: [Optimization] Guard to pause game loop while essence choice modal is active */
            if (this.isWaitingForEssenceChoice) return;

            /* AUTO-FIX: added optional chaining ?. for safety */
            const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
            if (allMonstersDefeated) {
                this.endCombat(true);
                return;
            }
        }
        
        this.showStatus(); // [UI] 기력 소모 등 반영
        this.endTurn();
    },


    /**
     * [신규] (v4) 스킬 사용 시 연출 추가
     */
    playerSpell(spellName, targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;

        const spell = (this.gameData.magic && this.gameData.magic[spellName]);
        if (!spell) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.(`오류: '${spellName}' 주문을 찾을 수 없습니다.`);
             return;
        }
        const spellCost = spell.mp_cost || 0;
        if (this.mp < spellCost) {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.("MP가 부족하여 마법을 사용할 수 없다.");
            return;
        }

        let target = null;
        let targets = [];
        
        if (targetIndex === -1) { // 광역기 (모든 적)
            targets = this.currentMonster.filter(m => m && m.hp > 0);
        } else if (targetIndex === -2) { // 자신 또는 아군 대상
             target = this;
             targets.push(target);
        } else if (targetIndex >= 100) { // [신규] 아군 단일 대상
            const partyIndex = targetIndex - 100;
            if (partyIndex >= 0 && partyIndex < this.party.length && this.party[partyIndex].hp > 0) {
                target = this.party[partyIndex];
                targets.push(target);
            }
        } else if (targetIndex === -3) { // [신규] 아군 광역 대상
            targets = [this, ...this.party].filter(p => p && p.hp > 0);
        } else { // 단일 적 대상
             if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length || !this.currentMonster[targetIndex] || this.currentMonster[targetIndex].hp <= 0) {
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.("오류: 주문 대상이 유효하지 않습니다.");
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.updateCombatMenu?.(this);
                return;
             }
             target = this.currentMonster[targetIndex];
             targets.push(target);
        }
        
        if (targets.length === 0) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.("오류: 주문을 사용할 유효한 대상이 없습니다.");
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.updateCombatMenu?.(this);
             return;
        }


        this.mp -= spellCost;
        
        // [신규] 스킬 연출 (화면 흔들림 + 텍스트 박스)
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.showScreenEffect?.('shake');
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage?.(`[${spellName}]!`, 'log-skill-player');


        try {
             if (typeof spell.effect === 'function') {
                 // [수정] 모든 타겟팅 유형 전달
                 if (targetIndex === -1) spell.effect(this, targets); // 적 광역
                 else if (targetIndex === -2) spell.effect(this, this); // 자신
                 else if (targetIndex === -3) spell.effect(this, targets); // 아군 광역
                 else if (targetIndex >= 100) spell.effect(this, target); // 아군 단일
                 else spell.effect(this, target); // 적 단일
             } 
             else if (spell.dmg !== undefined) { // effect가 없는 기본 마법
                  targets.forEach(t => {
                     let magicDefense = t.currentStats?.['항마력'] || 0;
                     let spellDamage = spell.dmg + (this.currentStats['정신력'] || 10);
                     let finalDamage = helpers.calculateDamage(spellDamage, magicDefense);
                     helpers.safeHpUpdate(t, -finalDamage);
                     /* AUTO-FIX: added optional chaining ?. for safety */
                     this.cb?.logMessage?.(`주문 ${spellName}(으)로 ${t.name}에게 ${finalDamage}의 피해! (몬스터 HP: ${t.hp})`);
                 });
             }

             targets.forEach(t => {
                 if (t.hp <= 0 && t !== this && !this.party.includes(t)) { // 대상이 몬스터일 경우
                     this.handleMonsterDefeat(t);
                 }
             });
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.updateCombatStatus?.(this);
             
            /* AUTO-FIX: [Optimization] Guard to pause game loop while essence choice modal is active */
            if (this.isWaitingForEssenceChoice) return;

             /* AUTO-FIX: added optional chaining ?. for safety */
             const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
             if (allMonstersDefeated) {
                 this.endCombat(true);
                 return;
             }
             
        } catch (e) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.(`Error casting spell ${spellName}: ${e.message}`);
             console.error(e);
        }

        this.showStatus(); // [UI] MP 소모 등 반영
        this.endTurn();
    },


    /**
     * [수정] (v4) 스킬 사용 시 연출 추가
     * @param {string} skillName - 사용할 스킬 이름
     * @param {number} targetIndex - 대상 인덱스 (-1: 적 광역, -2: 자신, -3: 아군 광역, 100+: 아군)
     */
    playerEssenceSkill(skillName, targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;

        let essenceData = null;
        let effectFunction = null;

        // [수정] GameData.essences에서 직접 effect 함수를 찾음
        for (const key of this.essences) {
            /* AUTO-FIX: added optional chaining ?. for safety */
            const ess = this.gameData.essences?.[key];
            if (ess && ess.active) {
                const activeSkills = helpers.toArray(ess.active);
                const foundSkill = activeSkills.find(s => s.name === skillName);
                if (foundSkill && typeof foundSkill.effect === 'function') {
                    essenceData = foundSkill;
                    effectFunction = foundSkill.effect;
                    break;
                }
            }
        }

        if (!essenceData || !effectFunction) {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.(`오류: '${skillName}' 정수 스킬의 effect 함수를 찾을 수 없습니다.`);
            return;
        }

        const skillCost = essenceData.mp_cost || 0;
        if (this.mp < skillCost) {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.("MP가 부족하여 정수 스킬을 사용할 수 없다.");
            return;
        }
        
        let target = null;
        let targets = [];
        
        if (targetIndex === -1) { // 광역기 (모든 적)
            targets = this.currentMonster.filter(m => m && m.hp > 0);
        } else if (targetIndex === -2) { // 자신 또는 아군 대상
             target = this; 
             targets.push(target);
        } else if (targetIndex >= 100) { // [신규] 아군 단일 대상
            const partyIndex = targetIndex - 100;
            if (partyIndex >= 0 && partyIndex < this.party.length && this.party[partyIndex].hp > 0) {
                target = this.party[partyIndex];
                targets.push(target);
            }
        } else if (targetIndex === -3) { // [신규] 아군 광역 대상
            targets = [this, ...this.party].filter(p => p && p.hp > 0);
        } else { // 단일 적 대상
             if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length || !this.currentMonster[targetIndex] || !this.currentMonster[targetIndex].hp > 0) {
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.("오류: 스킬 대상이 유효하지 않습니다.");
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.updateCombatMenu?.(this);
                return;
             }
             target = this.currentMonster[targetIndex];
             targets.push(target);
        }

        if (targets.length === 0) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.("오류: 스킬을 사용할 유효한 대상이 없습니다.");
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.updateCombatMenu?.(this);
             return;
        }


        this.mp -= skillCost;
        
        // [신규] 스킬 연출 (화면 흔들림 + 텍스트 박스)
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.showScreenEffect?.('shake');
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage?.(`[${skillName}]!`, 'log-skill-player');


        try {
            // [수정] 모든 타겟팅 유형 전달
            if (targetIndex === -1) effectFunction(this, targets); // 적 광역
            else if (targetIndex === -2) effectFunction(this, this); // 자신
            else if (targetIndex === -3) effectFunction(this, targets); // 아군 광역
            else if (targetIndex >= 100) effectFunction(this, target); // 아군 단일
            else effectFunction(this, target); // 적 단일

             targets.forEach(t => {
                 if (t.hp <= 0 && t !== this && !this.party.includes(t)) { // 대상이 몬스터일 경우
                     this.handleMonsterDefeat(t);
                 }
             });
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.updateCombatStatus?.(this);
             
            /* AUTO-FIX: [Optimization] Guard to pause game loop while essence choice modal is active */
            if (this.isWaitingForEssenceChoice) return;

             /* AUTO-FIX: added optional chaining ?. for safety */
             const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
             if (allMonstersDefeated) {
                 this.endCombat(true);
                 return;
             }

        } catch (e) {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.(`Error using essence skill ${skillName}: ${e.message}`);
            console.error(e);
        }

        this.showStatus(); // [UI] MP 소모 등 반영
        this.endTurn();
    },


    playerRun() {
        if (!this.playerTurn || !this.inCombat) return;
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.logMessage?.("도망을 시도한다...");
        
        // [수정] class_player_core에서 계산된 파생 스탯(evasion) 사용
        let runChance = 0.5 + (this.evasion * 0.5); // (임의) 기본 50% + 회피율 절반
        runChance = Math.min(0.95, runChance);

        if (Math.random() < runChance) {
            this.endCombat(false);
        } else {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.("도망에 실패했다.");
            this.endTurn();
        }
    },

    endTurn() {
        if (!this.inCombat) return;

        /* AUTO-FIX: added optional chaining ?. for safety */
        const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
        if (allMonstersDefeated) {
            this.endCombat(true);
            return;
        }

        this.playerTurn = false;
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.updateCombatMenu?.(this);
        setTimeout(() => this.monsterTurn(), 750);
    },

    /**
     * [수정] 몬스터의 턴 로직
     * [BUG FIX] 몬스터의 (1턴) 디버프가 제거되지 않던 무한 기절/속박 버그 수정
     * [신규] (v4) 몬스터 공격/스킬 사용 시 연출 추가
     */
    monsterTurn() {
        if (!this.inCombat) return;
        /* AUTO-FIX: added optional chaining ?. for safety */
        const livingMonstersInTurnStart = this.currentMonster?.filter(m => m && m.hp > 0);
        if (!livingMonstersInTurnStart || livingMonstersInTurnStart.length === 0) {
             this.startPlayerTurn();
             return;
        }

        this.currentMonster.forEach((monster) => {
            if (this.hp <= 0 || !this.inCombat || !monster || monster.hp <= 0) return;

            // [신규] 보스 페이즈 2 로직 (2등급 이하, HP 50% 미만)
            if (monster.grade <= 2 && monster.hp / monster.maxHp < 0.5 && !monster.phase2Triggered) {
                monster.phase2Triggered = true;
                monster.bossPhase = 2;
                monster.atk = Math.floor(monster.atk * 1.3); // (임의) 공격력 30% 증가
                monster.def = Math.floor(monster.def * 1.2); // (임의) 방어력 20% 증가
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage?.(`[BOSS] ${monster.name}이(가) 광폭화합니다! (Phase 2 돌입)`);
            }

            
            // --- [BUG FIX] 턴 시작 시 몬스터 디버프 처리 ---
            let turnSkipped = false;
            let debuffsToRemove = [];
            let hadStunDebuff = false;
            const oneTurnDebuffs = [
                "기절(1턴)", "석화(1턴)", "수면(1턴)", "빙결(1턴)", 
                "속박(늪)", "속박(뱀)", "속박(나무)", "속박(거품)", 
                "속박(얼음)", "속박(무덤)", "속박(중력)", "속박(뿌리)"
            ];

            /* AUTO-FIX: added optional chaining ?. for safety */
            (monster.debuffs || []).forEach(debuff => {
                // 1. (1턴)으로 끝나는 디버프 제거 목록에 추가
                if (debuff.endsWith("(1턴)")) {
                    debuffsToRemove.push(debuff);
                    // 2. 해당 디버프가 행동 불가 디버프인지 확인
                    if (oneTurnDebuffs.includes(debuff)) {
                        turnSkipped = true;
                        hadStunDebuff = true;
                    }
                }
                
                // 3. (1턴)이 아닌 공포 등 별도 턴 스킵 체크
                if (debuff.startsWith("공포") && Math.random() < 0.5) {
                    turnSkipped = true;
                }
            });

            // 4. 턴 경과 디버프 실제 제거
            if (debuffsToRemove.length > 0) {
                monster.debuffs = monster.debuffs.filter(d => !debuffsToRemove.includes(d));
            }
            // --- [BUG FIX] 끝 ---


            // [수정] 턴 스킵 처리
            if (turnSkipped) {
                if (hadStunDebuff) {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    // [기절(1턴), 속박(늪)] 처럼 표시
                    this.cb?.logMessage?.(`${monster.name}은(는) [${debuffsToRemove.filter(d => oneTurnDebuffs.includes(d)).join(', ')}] 효과로 행동할 수 없다!`);
                } else {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage?.(`${monster.name}은(는) 공포에 질려 아무것도 하지 못했다!`);
                }
                return; // 턴 행동 종료 (forEach의 다음 몬스터로)
            }


            const potentialTargets = [this, ...this.party].filter(p => p && p.hp > 0);
            if (potentialTargets.length === 0) return;
            
            const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
            if (!target) return;

            const attackOptions = monster.attacks || [{name:"기본 공격", dmg: monster.atk, type: "physical"}];
            const atk = attackOptions[Math.floor(Math.random() * attackOptions.length)];
            let dmg = 0;
            let defense = 0;
            
            const isTargetPlayer = (target === this);
            
            // [수정] 플레이어 대상 회피 체크 (파생 스탯 evasion 사용)
            if (isTargetPlayer) {
                let evasionChance = this.evasion + this.evasionBonus; // 기본 회피 + 스킬 보너스
                /* AUTO-FIX: added optional chaining ?. for safety */
                if (this.essences?.includes("브라키아이스텔로")) { // 염동력
                    evasionChance += 0.20;
                }
                evasionChance = Math.min(0.8, evasionChance);
                if (Math.random() < evasionChance) {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage?.(`${monster.name}의 '${atk.name}' 공격! 하지만 민첩하게 회피했다!`);
                    return;
                }
            }

            if(atk.type === "magic") {
                 defense = target.currentStats?.["항마력"] || 5;
                 dmg = helpers.calculateDamage(atk.dmg || monster.atk || 10, defense);
            } else {
                defense = target.currentStats?.["물리 내성"] || 5;
                dmg = helpers.calculateDamage(atk.dmg || monster.atk || 10, defense);
                
                // [패시브 구현] 피격 시 물리 피해 감소 (플레이어 대상)
                if (isTargetPlayer) {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    if (this.essences?.includes("레이스") || this.essences?.includes("영혼의 거신병") || this.essences?.includes("벤시 퀸")) { // "영체"
                        dmg *= 0.5;
                        /* AUTO-FIX: added optional chaining ?. for safety */
                        this.cb?.logMessage?.("[패시브: 영체]로 받는 물리 피해가 50% 감소합니다!");
                    }
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    if (this.essences?.includes("슬라임")) { // "끈적이는 신체"
                        dmg *= 0.9; // 10% 감소
                    }
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    if (this.essences?.includes("오우거")) { // "무쇠가죽"
                        // (임의) 베기 공격 유형 체크
                        if (atk.name.includes("베기") || atk.name.includes("할퀴기") || atk.name.includes("손톱") || atk.name.includes("절삭")) {
                            let boostedDefense = (target.currentStats?.["물리 내성"] || 5) * 2;
                            dmg = helpers.calculateDamage(atk.dmg || monster.atk || 10, boostedDefense);
                            /* AUTO-FIX: added optional chaining ?. for safety */
                            this.cb?.logMessage?.("[패시브: 무쇠가죽]이 베기 공격에 대한 방어력을 2배로 늘립니다!");
                        }
                    }
                }
            }
            
             dmg = Math.floor(dmg);
             helpers.safeHpUpdate(target, -dmg); // HP 감소 (부활 패시브 여기서 체크됨)
             const targetName = isTargetPlayer ? '플레이어' : target.name;

             // [신규] 스킬 연출 (화면 흔들림 + 텍스트 박스)
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.showScreenEffect?.('shake');
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.(`[${atk.name}]!`, 'log-skill-monster');
             
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.(`${monster.name}의 '${atk.name}' 공격! ${targetName}에게 ${dmg}의 피해. (${targetName} HP: ${target.hp})`);
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.updateCombatStatus?.(this);

             if (isTargetPlayer) {
                 if(atk.effect === "fear" && Math.random() < 0.3) this.applyDebuff("공포");
                 if(atk.dot && atk.type === 'poison') this.applyDebuff(`독(${atk.dot})`);
                 if(atk.dot && atk.type !== 'poison') this.applyDebuff(`출혈(${atk.dot})`);
             }

            if (target.hp <= 0) {
                 if (isTargetPlayer) {
                     /* AUTO-FIX: added optional chaining ?. for safety */
                     this.cb?.logMessage?.("플레이어가 쓰러졌다!");
                     this.endCombat(false);
                     return;
                 } else {
                     /* AUTO-FIX: added optional chaining ?. for safety */
                     this.cb?.logMessage?.(`${target.name}이(가) 쓰러졌다!`);
                 }
             }
        });

        if (this.hp > 0 && this.inCombat) {
            this.partyTurn();
        }
    },

    /**
     * [신규] (v4) 파티원 스킬 사용 시 연출 추가
     */
    partyTurn() {
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (!this.inCombat || !this.currentMonster || this.currentMonster?.every(m => !m || m.hp <= 0)) {
            if (this.inCombat) this.endCombat(true);
            return;
        }

        /* AUTO-FIX: added optional chaining ?. for safety */
        if (this.debuffs?.includes("진압")) {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage?.("진압 상태라서 파티원들이 행동할 수 없다!");
            this.startPlayerTurn();
            return;
        }

        this.party.forEach(member => {
             /* AUTO-FIX: added optional chaining ?. for safety */
             if (!this.inCombat || !this.currentMonster || this.currentMonster?.every(m => !m || m.hp <= 0) || !member || member.hp <= 0) return;

             const livingMonsters = this.currentMonster.filter(m => m && m.hp > 0);
             if (livingMonsters.length === 0) return;

            // --- [계획 1] 신관(Priest) AI 로직 ---
            if (member.trait === "신관") {
                const healSkill = member.skills.find(s => (s.name.includes("힐") || s.name.includes("치유")) && (s.cost || 0) <= member.mp);
                let healTarget = null;
                let lowestHpRatio = 0.7; 

                if (this.hp / this.maxHp < lowestHpRatio) {
                    lowestHpRatio = this.hp / this.maxHp;
                    healTarget = this;
                }
                this.party.forEach(p => {
                    if (p.hp > 0 && p.hp / p.maxHp < lowestHpRatio) {
                        lowestHpRatio = p.hp / p.maxHp;
                        healTarget = p;
                    }
                });

                if (healSkill && healTarget) {
                    member.mp -= (healSkill.cost || 0);
                    const targetName = healTarget === this ? '플레이어' : healTarget.name;
                    
                    // [신규] 스킬 연출 (화면 흔들림 + 텍스트 박스)
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.showScreenEffect?.('shake');
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage?.(`[${healSkill.name}]! - ${member.name}`, 'log-skill-player');
                    
                    try {
                        // [수정] NPC 스킬 effect 함수 찾기 (main.js에서 병합된 것)
                        const functionalSkill = (this.gameData.magic?.[healSkill.name]) || // 마법 힐
                                                (this.gameData.essences?.[healSkill.fromEssence]?.active.find(s => s.name === healSkill.name)); // 정수 힐
                        
                        if (functionalSkill && typeof functionalSkill.effect === 'function') {
                            functionalSkill.effect(member, healTarget);
                        } else {
                             // 예비 힐 로직
                             const healAmount = 30 + Math.floor((member.currentStats["정신력"] || 10) * 1.5);
                             helpers.safeHpUpdate(healTarget, healAmount);
                             this.cb?.logMessage?.(`${targetName}의 체력을 ${healAmount} 회복했다.`);
                        }
                    } catch (e) {
                         /* AUTO-FIX: added optional chaining ?. for safety */
                         this.cb?.logMessage?.(`${member.name}의 힐 스킬 사용 중 오류 발생: ${e.message}`);
                         // 힐 로직 예비 실행
                         const healAmount = 30 + Math.floor((member.currentStats["정신력"] || 10) / 2);
                         helpers.safeHpUpdate(healTarget, healAmount);
                         this.cb?.logMessage?.(`${targetName}의 체력을 ${healAmount} 회복했다.`);
                    }
                    
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.updateCombatStatus?.(this); // [UI] 힐 결과 반영
                    return; 
                }
            }
            // --- [계획 1] 신관 AI 종료 ---


             const targetMonster = livingMonsters[Math.floor(Math.random() * livingMonsters.length)];
             if (!targetMonster) return;

             const offensiveSkills = member.skills.filter(s => (s.cost || 0) <= member.mp && !s.name.includes("힐") && !s.name.includes("치유"));
             if (offensiveSkills.length > 0 && Math.random() < 0.4) {
                 // [신규] 스킬 연출 (useSkill 내부에서 처리)
                 member.useSkill(targetMonster); 
             } else {
                 // [신규] 기본 공격 연출
                 /* AUTO-FIX: added optional chaining ?. for safety */
                 this.cb?.showScreenEffect?.('shake');
                 member.attack(targetMonster);
             }

             if (targetMonster.hp <= 0) {
                 /* AUTO-FIX: added optional chaining ?. for safety */
                 this.cb?.logMessage?.(`${member.name}이(가) ${targetMonster.name}을(를) 처치했다!`);
                 this.handleMonsterDefeat(targetMonster);
                 /* AUTO-FIX: added optional chaining ?. for safety */
                 this.cb?.updateCombatStatus?.(this);

                 /* AUTO-FIX: added optional chaining ?. for safety */
                 const allMonstersDefeatedNow = this.currentMonster?.every(m => !m || m.hp <= 0);
                 if (allMonstersDefeatedNow) {
                    /* AUTO-FIX: [Optimization] Guard to pause game loop while essence choice modal is active */
                    if (this.isWaitingForEssenceChoice) return;
                     this.endCombat(true);
                     return;
                 }
             }
        });

        if (this.inCombat) {
            /* AUTO-FIX: [Optimization] Guard to prevent player turn start while essence choice modal is active */
            if (this.isWaitingForEssenceChoice) return;
            this.startPlayerTurn();
        }
    },


    /**
     * [패시브 구현] 플레이어 턴 시작 로직
     * "공포", "파멸의 각인", "악취" 등 턴 시작 시 발동하는 디버프/패시브 처리
     * [수정] DOT(지속 피해) 및 HOT(지속 회복) 로직 추가
     */
     startPlayerTurn() {
         if (!this.inCombat) return;

         // [패시브 구현] 턴 시작 시 디버프/패시브 처리
         let turnSkipped = false;

         // 1. 행동 불가 디버프
         /* AUTO-FIX: added optional chaining ?. for safety */
         if(this.debuffs?.includes("공포") && Math.random() < 0.5) { //
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.("공포에 질려 아무것도 할 수 없다!");
             turnSkipped = true;
         }
         /* AUTO-FIX: added optional chaining ?. for safety */
         else if (this.debuffs?.includes("기절(1턴)") || this.debuffs?.includes("석화(1턴)") || this.debuffs?.includes("수면(1턴)") || this.debuffs?.includes("빙결(1턴)") || this.debuffs?.includes("속박(늪)") || this.debuffs?.includes("속박(뱀)") || this.debuffs?.includes("속박(나무)") || this.debuffs?.includes("속박(거품)") || this.debuffs?.includes("속박(얼음)") || this.debuffs?.includes("속박(무덤)") || this.debuffs?.includes("속박(중력)") || this.debuffs?.includes("속박(뿌리)")) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.(`[${this.debuffs.find(d => d.includes("턴") || d.includes("속박"))}] 효과로 행동할 수 없다!`);
             turnSkipped = true;
         }

         // 2. 지속 피해(DOT) 디버프
         /* AUTO-FIX: added optional chaining ?. for safety */
         if (this.debuffs?.includes("파멸의 각인(영구)")) { // 인면조
             let dmg = Math.floor(this.maxHp * 0.01);
             helpers.safeHpUpdate(this, -dmg);
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.(`[파멸의 각인] 효과로 ${dmg}의 생명력 피해!`);
         }
         /* AUTO-FIX: added optional chaining ?. for safety */
         if (this.debuffs?.some(d => d.startsWith("독("))) {
             let poisonDmg = 5; // (임의) 기본 독 데미지
             if (this.debuffs.includes("독(중)")) poisonDmg = 10;
             if (this.debuffs.includes("독(강)")) poisonDmg = 20;
             if (this.debuffs.includes("독(최상급)")) poisonDmg = 50;
             
             /* AUTO-FIX: added optional chaining ?. for safety */
             if (this.debuffs?.includes("악취(디버프)")) { // (몬스터가 이 디버프를 걸었다고 가정)
                 poisonDmg *= 2;
                 /* AUTO-FIX: added optional chaining ?. for safety */
                 this.cb?.logMessage?.("[패시브: 악취] 효과로 독 피해가 2배 증가합니다!");
             }
             if (this.debuffs.includes("치명적 중독(8배)")) { // 스닉투라
                 poisonDmg *= 8;
             }
             
             helpers.safeHpUpdate(this, -poisonDmg);
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.(`[독] 효과로 ${poisonDmg}의 피해!`);
         }
         
         // 3. 지속 회복(HOT) 버프
         /* AUTO-FIX: added optional chaining ?. for safety */
         if (this.debuffs?.includes("초재생(1턴)")) { // 스닉투라
             let healAmount = 1000;
             helpers.safeHpUpdate(this, healAmount);
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage?.(`[불멸의 의지] 효과로 체력을 ${healAmount} 회복합니다!`);
         }
         
         // 4. 턴 경과 처리 (간단하게 1턴짜리만 제거)
         // [수정] (1턴)으로 끝나는 모든 디버프/버프 제거
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
         /* AUTO-FIX: added optional chaining ?. for safety */
         this.cb?.updateCombatStatus?.(this);
         /* AUTO-FIX: added optional chaining ?. for safety */
         this.cb?.updateCombatMenu?.(this);
     }
};