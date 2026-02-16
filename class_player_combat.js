// 파일: class_player_combat.js
// 역할: Player 클래스의 전투 관련 메서드 (턴 관리, 공격, 스킬 사용)
// [수정] (v8) startCombat: 몬스터 데이터 누락 시 예외 처리 추가 (전투 안정성 확보)

import { helpers } from './class_helpers.js';

export const PlayerCombatMethods = {

    startCombat(monsterNamesInput) {
        let monsterNames = helpers.toArray(monsterNamesInput);
        // "A or B" 형태 문자열 지원
        monsterNames = monsterNames.flatMap(name => {
            if (typeof name !== 'string') return [name];
            if (name.includes(' or ')) {
                const picks = name.split(' or ').map(x => x.trim()).filter(Boolean);
                return picks.length > 0 ? [picks[Math.floor(Math.random() * picks.length)]] : [name];
            }
            return [name];
        });
        
        // [핵심 수정] 유효한 몬스터만 필터링 및 생성
        const validMonsters = monsterNames.map(name => {
            // 1. 데이터 존재 여부 확인
            if (!this.gameData.monsters || !this.gameData.monsters[name]) {
                this.cb?.logMessage?.(`오류: [${name}] 몬스터 데이터를 찾을 수 없습니다.`);
                return null; // null 반환하여 필터링 유도
            }

            // 2. 몬스터 객체 생성 (깊은 복사)
            const monsterData = this.gameData.monsters[name];
            const monster = JSON.parse(JSON.stringify(monsterData));
            
            // 3. 기본값 설정 (데이터 누락 방지)
            monster.name = name;
            monster.hp = monster.hp || 50;
            monster.maxHp = monster.hp;
            monster.atk = monster.atk || 10;
            monster.def = monster.def || 5;
            monster.magic_def = monster.magic_def || 3;
            monster.grade = monster.grade || 9;
            monster.attacks = monster.attacks || [{name:"기본 공격", dmg: monster.atk, type: "physical"}];
            monster.debuffs = [];
            
            // 보스 페이즈 플래그
            monster.bossPhase = 1;
            monster.phase2Triggered = false;

            // 현재 스탯 계산용 객체
            monster.currentStats = {
                '근력': monster.atk,
                '물리 내성': monster.def,
                '항마력': monster.magic_def,
                ...(monster.stats || {}) 
            };
            
            // 디버프 적용 메서드 주입
            monster.applyDebuff = function(debuff) {
                 if (!this.debuffs.includes(debuff)) {
                     this.debuffs.push(debuff);
                 }
            };
            return monster;
        }).filter(m => m !== null); // null(데이터 없음) 제거

        // [예외 처리] 유효한 몬스터가 하나도 없는 경우
        if (validMonsters.length === 0) {
             this.cb?.logMessage?.("전투 시작 실패: 출현할 수 있는 몬스터가 없습니다.");
             return;
        }

        // 전투 시작
        this.currentMonster = validMonsters;
        this.inCombat = true;
        this.playerTurn = true;
        this.evasionBonus = 0; 

        this.cb?.logMessage?.(`!! ${validMonsters.map(m => `${m.name}(${m.grade}등급)`).join(', ')}와(과) 전투 시작 !!`);
        this.cb?.playMusic?.('bgm-combat');
        this.cb?.updateCombatStatus?.(this);
        this.cb?.updateCombatMenu?.(this);
    },


    handleMonsterDefeat(monster) {
        this.cb?.logMessage?.(`${monster.name}을(를) 처치했다!`);
        
        this.questManager?.checkProgress?.('KILL', monster.name, 1);

        const gradeNum = typeof monster.grade === 'number' ? monster.grade : 9;
        let expGained = Math.max(0, (10 - gradeNum) * 10 + 5);
        
        this.gainExp(expGained, monster.name); 

        let magicStoneAmount = Math.max(1, (10 - gradeNum) * (Math.floor(Math.random() * 5) + 1));
        this.magic_stones += magicStoneAmount;

        if (this.essences?.includes("소울이터")) {
            const mpHeal = Math.floor(this.maxMp * 0.10);
            this.mp = Math.min(this.maxMp, this.mp + mpHeal);
            this.cb?.logMessage?.(`[패시브: 영혼 갈취]! ${monster.name} 처치! MP를 ${mpHeal} 회복합니다!`);
        }

        let droppedEssence = null;
        if (monster.essences?.length > 0) {
            let dropChance = 0.05 + ((10 - gradeNum) * 0.01) + ((this.currentStats["행운"] || 0) / 1000); 
            if (this.inventory?.includes("초심자의 행운") && !this.killedMonsterTypes.has(monster.name)) {
                dropChance += 0.05; 
                this.cb?.logMessage?.("[패시브: 초심자의 행운] 정수 드랍률 +5% 적용!");
            }
            dropChance = Math.min(1.0, Math.max(0, dropChance));

            if (Math.random() < dropChance) {
                const essenceKey = monster.essences[Math.floor(Math.random() * monster.essences.length)];
                if (essenceKey && this.gameData.essences && this.gameData.essences[essenceKey]) {
                    const essenceDisplayName = `${essenceKey} 정수`;
                    
                    this.isWaitingForEssenceChoice = true;
                    
                    this.cb?.logMessage?.(`[${essenceDisplayName}]을(를) 획득했습니다! 누구에게 주시겠습니까?`);
                    this.cb?.showEssencePartyChoice?.(this, essenceKey, essenceDisplayName);
                }
            }
        }

        let droppedItem = null;
        if (monster.drops?.length > 0 && Math.random() < 0.1) {
             const item = monster.drops[Math.floor(Math.random() * monster.drops.length)];
             if (item) {
                 droppedItem = item;
                 this.addItem(item); 
             }
        }

        if (gradeNum <= 2 && Math.random() < 0.05) { 
            const numbersItemsList = Object.keys(this.gameData.numbersItems || {});
            if (numbersItemsList.length > 0) {
                const item = numbersItemsList[Math.floor(Math.random() * numbersItemsList.length)];
                if (item) {
                    droppedItem = item;
                    this.addItem(item);
                }
            }
        }

        this.cb?.logMessage?.(`${monster.name} 처치 보상: 마석 ${magicStoneAmount}개`
            + (droppedEssence ? `, ${essenceDisplayName} (획득)` : "")
            + (droppedItem ? `, ${droppedItem}` : ""));
        
        this.showStatus(); 
    },


    endCombat(victory) {
        if (victory && this.isWaitingForEssenceChoice) return;

        if (!this.inCombat && this.hp > 0) return;

        const wasInCombat = this.inCombat;
        this.inCombat = false;
        this.criticalHitBoost = false; 

        if (victory && this.position === "Rift" && this.currentRift) {
            this.currentRiftStage++; 

            if (this.currentRiftStage >= this.currentRift.stages.length) {
                this.cb?.logMessage?.(`[${this.currentRift.name}] 균열 정복! 수호자를 처치했습니다.`);
                this.addItem("균열석"); 
                
                if (this.currentLayer === 8 || this.currentLayer === "8") {
                    this.cb?.logMessage?.("9층으로 향하는 포탈과 8층으로 돌아가는 포탈이 열렸습니다.");
                    this.currentRift = null;
                    this.currentRiftStage = 0;
                    this.cb?.showPortalChoice?.(this, 9, 8);
                    return; 
                }

                this.cb?.logMessage?.("도시로 귀환합니다.");
                this.position = "라비기온 (7-13구역)";
                this.currentRift = null;
                this.currentRiftStage = 0;
                
                this.cb?.playMusic?.('bgm-city');
                this.cb?.updateMenu?.(this);
                this.showStatus();
                return;
            } else {
                this.cb?.logMessage?.(`균열 ${this.currentRift.stages[this.currentRiftStage-1].name} 단계를 클리어했습니다. 다음 탐사를 준비하십시오.`);
                this.cb?.playMusic?.('bgm-dungeon');
                this.cb?.updateMenu?.(this); 
                this.showStatus();
                return;
            }
        }

        if (this.hp <= 0) {
             this.cb?.logMessage?.("패배... 모든 것을 잃고 게임을 처음부터 다시 시작합니다.");
             this.cb?.stopMusic?.();
             setTimeout(() => location.reload(), 3000);
             return;
        }

        if (wasInCombat) {
            if (victory) {
                this.cb?.logMessage?.("승리!");
            } else {
                 this.cb?.logMessage?.("성공적으로 도망쳤다!");
            }
            
            if (this.position === "Labyrinth") {
                this.cb?.playMusic?.('bgm-dungeon');
            } else {
                this.cb?.playMusic?.('bgm-city');
            }
        }

        this.currentMonster = null;
        this.cb?.updateMenu?.(this);
        this.showStatus();
    },

    playerAttack(targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;
        if (this.stamina < 1) {
             this.cb?.logMessage?.("기력이 부족하여 공격할 수 없습니다.");
             return;
        }

        const target = this.currentMonster[targetIndex];
         if (!target || target.hp <= 0) {
             this.cb?.logMessage?.("오류: 공격 대상이 이미 처치되었습니다.");
             this.cb?.updateCombatMenu?.(this);
             return;
         }

        const staminaCost = Math.max(1, 2 - Math.floor((this.currentStats["지구력"] || 0) / 120));
        this.stamina = Math.max(0, this.stamina - staminaCost);
        let fatiguePenalty = this.fatigue >= 100 ? 0.5 : 1;
        
        let baseDamage = this.currentStats["근력"] || 10;
        let targetDefense = target.currentStats?.['물리 내성'] || 0;
        
        if (this.aura_active) {
            let defense_penetration = targetDefense * 0.9; 
            targetDefense = targetDefense - defense_penetration;
            this.aura_active = false;
            this.cb?.logMessage?.("오러의 힘으로 방어력을 90% 무시합니다!");
        }

        // 명중/회피 판정 (다양한 스탯 활용)
        const accuracy = 0.72
            + ((this.currentStats["명중률"] || 0) / 250)
            + ((this.currentStats["시각"] || 0) / 600)
            + ((this.currentStats["인지력"] || 0) / 1200);
        const targetEvasion = ((target.currentStats?.["민첩성"] || 0) / 500) + ((target.currentStats?.["시야"] || 0) / 1200);
        const hitChance = Math.max(0.2, Math.min(0.98, accuracy - targetEvasion));
        if (Math.random() > hitChance) {
            this.cb?.logMessage?.(`공격이 빗나갔습니다! (명중률 ${(hitChance * 100).toFixed(0)}%)`);
            this.endTurn();
            return;
        }

        // 무기 계열 스탯 반영
        const weaponName = this.equipment?.["무기"] || "";
        if (weaponName.includes("검") || weaponName.includes("소드")) {
            baseDamage += Math.floor((this.currentStats["절삭력"] || 0) * 0.35);
        }
        if (weaponName.includes("창") || weaponName.includes("스피어")) {
            baseDamage += Math.floor((this.currentStats["도약력"] || 0) * 0.25);
        }

        let dmg = helpers.calculateDamage(baseDamage, targetDefense);
        dmg *= fatiguePenalty;

        let critChance = this.critChance; 
        if (this.criticalHitBoost) {
            critChance += 0.5; 
            this.cb?.logMessage?.("급소 공격! 치명타 확률이 증가합니다!");
        }
        if (this.race === "Dragonkin" && Math.random() < 0.2) {
            critChance += 0.2;
        }
        
        if (this.debuffs?.includes("사형선고(1회)")) {
            const luckBonus = (this.currentStats["행운"] || 0) / 10 * 2;
            dmg *= (1 + luckBonus);
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

        helpers.safeHpUpdate(target, -dmg, { isSkillHit: false });

        if (this.race === "Dragonkin" && Math.random() < 0.16) {
            helpers.safeApplyDebuff(target, "공포(1턴)");
            this.cb?.logMessage?.("[용언의 울림] 적이 공포에 질렸습니다!");
        }

        if (isCritical) {
            this.cb?.logMessage?.(`치명타!`, 'log-critical-hit');
            this.cb?.showScreenEffect?.('shake');
        }
        
        this.cb?.logMessage?.(`플레이어의 공격! ${target.name}에게 ${dmg}의 피해. (몬스터 HP: ${target.hp})`);

        if (this.essences?.includes("고블린")) { 
            if (Math.random() < 0.1) helpers.safeApplyDebuff(this, target, "둔화(마비독)");
        }
        if (this.essences?.includes("고블린 궁수")) { 
            if (this.equipment["무기"]?.includes("활")) { 
                 helpers.safeApplyDebuff(this, target, "독(약)");
            }
        }
        if (this.essences?.includes("뱀파이어")) {
            const healAmount = Math.floor(dmg * 0.10);
            helpers.safeHpUpdate(this, healAmount);
            this.cb?.logMessage?.(`[패시브: 흡혈]! ${healAmount}의 HP를 흡수했습니다.`);
        }

        if (target.hp <= 0) {
            this.handleMonsterDefeat(target);
            this.cb?.updateCombatStatus?.(this);

            if (this.isWaitingForEssenceChoice) return;

            const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
            if (allMonstersDefeated) {
                this.endCombat(true);
                return;
            }
        }
        
        this.showStatus(); 
        this.endTurn();
    },

    playerSpell(spellName, targetIndex) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;

        const spell = (this.gameData.magic && this.gameData.magic[spellName]);
        if (!spell) {
             this.cb?.logMessage?.(`오류: '${spellName}' 주문을 찾을 수 없습니다.`);
             return;
        }
        const spellCost = spell.mp_cost || 0;
        if (this.mp < spellCost) {
            this.cb?.logMessage?.("MP가 부족하여 마법을 사용할 수 없다.");
            return;
        }

        // 바바리안 제약: 신성 계열 마법 사용 불가
        const spellDesc = (spell.desc || "");
        if (this.race === "Barbarian" && (spellName.includes("신성") || spellDesc.includes("신성"))) {
            this.cb?.logMessage?.("바바리안은 신성 계열 마법을 사용할 수 없습니다.");
            return;
        }

        let target = null;
        let targets = [];
        
        if (targetIndex === -1) {
            targets = this.currentMonster.filter(m => m && m.hp > 0);
        } else if (targetIndex === -2) {
             target = this;
             targets.push(target);
        } else if (targetIndex >= 100) {
            const partyIndex = targetIndex - 100;
            if (partyIndex >= 0 && partyIndex < this.party.length && this.party[partyIndex].hp > 0) {
                target = this.party[partyIndex];
                targets.push(target);
            }
        } else if (targetIndex === -3) {
            targets = [this, ...this.party].filter(p => p && p.hp > 0);
        } else {
             if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length || !this.currentMonster[targetIndex] || this.currentMonster[targetIndex].hp <= 0) {
                this.cb?.logMessage?.("오류: 주문 대상이 유효하지 않습니다.");
                this.cb?.updateCombatMenu?.(this);
                return;
             }
             target = this.currentMonster[targetIndex];
             targets.push(target);
        }
        
        if (targets.length === 0) {
             this.cb?.logMessage?.("오류: 주문을 사용할 유효한 대상이 없습니다.");
             this.cb?.updateCombatMenu?.(this);
             return;
        }

        this.mp -= spellCost;
        
        this.cb?.showScreenEffect?.('shake');
        this.cb?.logMessage?.(`[${spellName}]!`, 'log-skill-player');

        try {
             if (typeof spell.effect === 'function') {
                 if (targetIndex === -1) spell.effect(this, targets);
                 else if (targetIndex === -2) spell.effect(this, this);
                 else if (targetIndex === -3) spell.effect(this, targets);
                 else if (targetIndex >= 100) spell.effect(this, target);
                 else spell.effect(this, target);
             } 
             else if (spell.dmg !== undefined) {
                  targets.forEach(t => {
                     let magicDefense = t.currentStats?.['항마력'] || 0;
                     let spellDamage = spell.dmg + (this.currentStats['정신력'] || 10);
                     let finalDamage = helpers.calculateDamage(spellDamage, magicDefense);
                     helpers.safeHpUpdate(t, -finalDamage, { isSkillHit: true });
                     this.cb?.logMessage?.(`주문 ${spellName}(으)로 ${t.name}에게 ${finalDamage}의 피해! (몬스터 HP: ${t.hp})`);
                 });
             }

             targets.forEach(t => {
                 if (t.hp <= 0 && t !== this && !this.party.includes(t)) {
                     this.handleMonsterDefeat(t);
                 }
             });
             this.cb?.updateCombatStatus?.(this);
             
            if (this.isWaitingForEssenceChoice) return;

             const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
             if (allMonstersDefeated) {
                 this.endCombat(true);
                 return;
             }
             
        } catch (e) {
             this.cb?.logMessage?.(`Error casting spell ${spellName}: ${e.message}`);
             console.error(e);
        }

        this.showStatus();
        this.endTurn();
    },

    playerEssenceSkill(skillName, targetIndex, essenceKey) {
        if (!this.playerTurn || !this.inCombat || !this.currentMonster) return;

        let essenceData = null;
        let effectFunction = null;

        // 전달된 essenceKey를 우선적으로 확인, 없으면 전체 검색
        if (essenceKey && this.gameData.essences?.[essenceKey]?.active) {
             const activeSkills = helpers.toArray(this.gameData.essences[essenceKey].active);
             const foundSkill = activeSkills.find(s => s.name === skillName);
             if (foundSkill && typeof foundSkill.effect === 'function') {
                 essenceData = foundSkill;
                 effectFunction = foundSkill.effect;
             }
        }

        if (!essenceData) {
            // fallback: 전체 검색
            for (const key of this.essences) {
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
        }

        if (!essenceData || !effectFunction) {
            this.cb?.logMessage?.(`오류: '${skillName}' 정수 스킬의 effect 함수를 찾을 수 없습니다.`);
            return;
        }

        const skillCost = essenceData.mp_cost || 0;
        if (this.mp < skillCost) {
            this.cb?.logMessage?.("MP가 부족하여 정수 스킬을 사용할 수 없다.");
            return;
        }
        
        let target = null;
        let targets = [];
        
        if (targetIndex === -1) {
            targets = this.currentMonster.filter(m => m && m.hp > 0);
        } else if (targetIndex === -2) {
             target = this; 
             targets.push(target);
        } else if (targetIndex >= 100) {
            const partyIndex = targetIndex - 100;
            if (partyIndex >= 0 && partyIndex < this.party.length && this.party[partyIndex].hp > 0) {
                target = this.party[partyIndex];
                targets.push(target);
            }
        } else if (targetIndex === -3) {
            targets = [this, ...this.party].filter(p => p && p.hp > 0);
        } else {
             if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= this.currentMonster.length || !this.currentMonster[targetIndex] || !this.currentMonster[targetIndex].hp > 0) {
                this.cb?.logMessage?.("오류: 스킬 대상이 유효하지 않습니다.");
                this.cb?.updateCombatMenu?.(this);
                return;
             }
             target = this.currentMonster[targetIndex];
             targets.push(target);
        }

        if (targets.length === 0) {
             this.cb?.logMessage?.("오류: 스킬을 사용할 유효한 대상이 없습니다.");
             this.cb?.updateCombatMenu?.(this);
             return;
        }

        this.mp -= skillCost;
        
        this.cb?.showScreenEffect?.('shake');
        this.cb?.logMessage?.(`[${skillName}]!`, 'log-skill-player');

        try {
            if (targetIndex === -1) effectFunction(this, targets);
            else if (targetIndex === -2) effectFunction(this, this);
            else if (targetIndex === -3) effectFunction(this, targets);
            else if (targetIndex >= 100) effectFunction(this, target);
            else effectFunction(this, target);

             targets.forEach(t => {
                 if (t.hp <= 0 && t !== this && !this.party.includes(t)) {
                     this.handleMonsterDefeat(t);
                 }
             });
             this.cb?.updateCombatStatus?.(this);
             
            if (this.isWaitingForEssenceChoice) return;

             const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
             if (allMonstersDefeated) {
                 this.endCombat(true);
                 return;
             }

        } catch (e) {
            this.cb?.logMessage?.(`Error using essence skill ${skillName}: ${e.message}`);
            console.error(e);
        }

        this.showStatus();
        this.endTurn();
    },

    playerRun() {
        if (!this.playerTurn || !this.inCombat) return;
        this.cb?.logMessage?.("도망을 시도한다...");
        
        let runChance = 0.5 + (this.evasion * 0.5); 
        runChance = Math.min(0.95, runChance);

        if (Math.random() < runChance) {
            this.endCombat(false);
        } else {
            this.cb?.logMessage?.("도망에 실패했다.");
            this.endTurn();
        }
    },

    endTurn() {
        if (!this.inCombat) return;

        const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
        if (allMonstersDefeated) {
            this.endCombat(true);
            return;
        }

        this.playerTurn = false;
        this.cb?.updateCombatMenu?.(this);
        setTimeout(() => this.monsterTurn(), 750);
    },

    monsterTurn() {
        if (!this.inCombat) return;
        const livingMonstersInTurnStart = this.currentMonster?.filter(m => m && m.hp > 0);
        if (!livingMonstersInTurnStart || livingMonstersInTurnStart.length === 0) {
             this.startPlayerTurn();
             return;
        }

        this.currentMonster.forEach((monster) => {
            if (this.hp <= 0 || !this.inCombat || !monster || monster.hp <= 0) return;

            if (monster.grade <= 2 && monster.hp / monster.maxHp < 0.5 && !monster.phase2Triggered) {
                monster.phase2Triggered = true;
                monster.bossPhase = 2;
                monster.atk = Math.floor(monster.atk * 1.3); 
                monster.def = Math.floor(monster.def * 1.2); 
                this.cb?.logMessage?.(`[BOSS] ${monster.name}이(가) 광폭화합니다! (Phase 2 돌입)`);
            }
            
            let turnSkipped = false;
            let debuffsToRemove = [];
            let hadStunDebuff = false;
            const oneTurnDebuffs = [
                "기절(1턴)", "석화(1턴)", "수면(1턴)", "빙결(1턴)", 
                "속박(늪)", "속박(뱀)", "속박(나무)", "속박(거품)", 
                "속박(얼음)", "속박(무덤)", "속박(중력)", "속박(뿌리)"
            ];

            (monster.debuffs || []).forEach(debuff => {
                if (debuff.endsWith("(1턴)")) {
                    debuffsToRemove.push(debuff);
                    if (oneTurnDebuffs.includes(debuff)) {
                        turnSkipped = true;
                        hadStunDebuff = true;
                    }
                }
                if (debuff.startsWith("공포") && Math.random() < 0.5) {
                    turnSkipped = true;
                }
            });

            if (debuffsToRemove.length > 0) {
                monster.debuffs = monster.debuffs.filter(d => !debuffsToRemove.includes(d));
            }

            if (turnSkipped) {
                if (hadStunDebuff) {
                    this.cb?.logMessage?.(`${monster.name}은(는) [${debuffsToRemove.filter(d => oneTurnDebuffs.includes(d)).join(', ')}] 효과로 행동할 수 없다!`);
                } else {
                    this.cb?.logMessage?.(`${monster.name}은(는) 공포에 질려 아무것도 하지 못했다!`);
                }
                return;
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
            
            if (isTargetPlayer) {
                let evasionChance = this.evasion + this.evasionBonus; 
                if (this.essences?.includes("브라키아이스텔로")) {
                    evasionChance += 0.20;
                }
                evasionChance = Math.min(0.8, evasionChance);
                if (Math.random() < evasionChance) {
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
                
                if (isTargetPlayer) {
                    if (this.essences?.includes("레이스") || this.essences?.includes("영혼의 거신병") || this.essences?.includes("벤시 퀸")) { 
                        dmg *= 0.5;
                        this.cb?.logMessage?.("[패시브: 영체]로 받는 물리 피해가 50% 감소합니다!");
                    }
                    if (this.essences?.includes("슬라임")) {
                        dmg *= 0.9;
                    }
                    if (this.essences?.includes("오우거")) {
                        if (atk.name.includes("베기") || atk.name.includes("할퀴기") || atk.name.includes("손톱") || atk.name.includes("절삭")) {
                            let boostedDefense = (target.currentStats?.["물리 내성"] || 5) * 2;
                            dmg = helpers.calculateDamage(atk.dmg || monster.atk || 10, boostedDefense);
                            this.cb?.logMessage?.("[패시브: 무쇠가죽]이 베기 공격에 대한 방어력을 2배로 늘립니다!");
                        }
                    }
                }
            }

            // 속성 내성 추가 적용
            const typeToResist = {
                fire: "화염 내성",
                ice: "냉기 내성",
                lightning: "번개 내성",
                poison: "독 내성",
                holy: "신성 내성",
                dark: "어둠 내성",
                earth: "대지 내성"
            };
            const resistStat = typeToResist[atk.type];
            if (resistStat) {
                const resist = target.currentStats?.[resistStat] || 0;
                const resistFactor = Math.max(0.25, 1 - (resist / 220));
                dmg = Math.floor(dmg * resistFactor);
            }
            dmg = Math.max(1, dmg);
            
             dmg = Math.floor(dmg);
             const isSkill = (atk.name !== "기본 공격");
             helpers.safeHpUpdate(target, -dmg, { isSkillHit: isSkill });
             const targetName = isTargetPlayer ? '플레이어' : target.name;

             this.cb?.showScreenEffect?.('shake');
             this.cb?.logMessage?.(`[${atk.name}]!`, 'log-skill-monster');
             
             this.cb?.logMessage?.(`${monster.name}의 '${atk.name}' 공격! ${targetName}에게 ${dmg}의 피해. (${targetName} HP: ${target.hp})`);
             this.cb?.updateCombatStatus?.(this);

             if (isTargetPlayer) {
                 if(atk.effect === "fear" && Math.random() < 0.3) this.applyDebuff("공포");
                 if(atk.dot && atk.type === 'poison') this.applyDebuff(`독(${atk.dot})`);
                 if(atk.dot && atk.type !== 'poison') this.applyDebuff(`출혈(${atk.dot})`);
             }

            if (target.hp <= 0) {
                 if (isTargetPlayer) {
                     this.cb?.logMessage?.("플레이어가 쓰러졌다!");
                     this.endCombat(false);
                     return;
                 } else {
                     this.cb?.logMessage?.(`${target.name}이(가) 쓰러졌다!`);
                 }
             }
        });

        if (this.hp > 0 && this.inCombat) {
            this.partyTurn();
        }
    },

    partyTurn() {
        if (!this.inCombat || !this.currentMonster || this.currentMonster?.every(m => !m || m.hp <= 0)) {
            if (this.inCombat) this.endCombat(true);
            return;
        }

        if (this.debuffs?.includes("진압")) {
            this.cb?.logMessage?.("진압 상태라서 파티원들이 행동할 수 없다!");
            this.startPlayerTurn();
            return;
        }

        this.party.forEach(member => {
             if (!this.inCombat || !this.currentMonster || this.currentMonster?.every(m => !m || m.hp <= 0) || !member || member.hp <= 0) return;

             const livingMonsters = this.currentMonster.filter(m => m && m.hp > 0);
             if (livingMonsters.length === 0) return;

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
                    
                    try {
                        const functionalSkill = (this.gameData.magic?.[healSkill.name]) || 
                                                (this.gameData.essences?.[healSkill.fromEssence]?.active.find(s => s.name === healSkill.name));
                        
                        if (functionalSkill && typeof member.useSkill === 'function') {
                            member.useSkill(healTarget, healSkill.name);
                        } else {
                             const healAmount = 30 + Math.floor((member.currentStats["정신력"] || 10) * 1.5);
                             helpers.safeHpUpdate(healTarget, healAmount);
                             this.cb?.logMessage?.(`${targetName}의 체력을 ${healAmount} 회복했다.`);
                        }
                    } catch (e) {
                         this.cb?.logMessage?.(`${member.name}의 힐 스킬 사용 중 오류 발생: ${e.message}`);
                         const healAmount = 30 + Math.floor((member.currentStats["정신력"] || 10) / 2);
                         helpers.safeHpUpdate(healTarget, healAmount);
                         this.cb?.logMessage?.(`${targetName}의 체력을 ${healAmount} 회복했다.`);
                    }
                    
                    this.cb?.updateCombatStatus?.(this); 
                    return; 
                }
            }

             const targetMonster = livingMonsters[Math.floor(Math.random() * livingMonsters.length)];
             if (!targetMonster) return;

             const offensiveSkills = member.skills.filter(s => (s.cost || 0) <= member.mp && !s.name.includes("힐") && !s.name.includes("치유"));
             if (offensiveSkills.length > 0 && Math.random() < 0.4) {
                 member.useSkill(targetMonster); 
             } else {
                 member.attack(targetMonster);
             }

             if (targetMonster.hp <= 0) {
                 this.cb?.logMessage?.(`${member.name}이(가) ${targetMonster.name}을(를) 처치했다!`);
                 this.handleMonsterDefeat(targetMonster);
                 this.cb?.updateCombatStatus?.(this);

                 const allMonstersDefeatedNow = this.currentMonster?.every(m => !m || m.hp <= 0);
                 if (allMonstersDefeatedNow) {
                    if (this.isWaitingForEssenceChoice) return;
                     this.endCombat(true);
                     return;
                 }
             }
        });

        if (this.inCombat) {
            if (this.isWaitingForEssenceChoice) return;
            this.startPlayerTurn();
        }
    },

    startPlayerTurn() {
         if (!this.inCombat) return;

         let turnSkipped = false;

         if(this.debuffs?.includes("공포") && Math.random() < 0.5) { 
             this.cb?.logMessage?.("공포에 질려 아무것도 할 수 없다!");
             turnSkipped = true;
         }
         else if (this.debuffs?.includes("기절(1턴)") || this.debuffs?.includes("석화(1턴)") || this.debuffs?.includes("수면(1턴)") || this.debuffs?.includes("빙결(1턴)") || this.debuffs?.includes("속박(늪)") || this.debuffs?.includes("속박(뱀)") || this.debuffs?.includes("속박(나무)") || this.debuffs?.includes("속박(거품)") || this.debuffs?.includes("속박(얼음)") || this.debuffs?.includes("속박(무덤)") || this.debuffs?.includes("속박(중력)") || this.debuffs?.includes("속박(뿌리)")) {
             this.cb?.logMessage?.(`[${this.debuffs.find(d => d.includes("턴") || d.includes("속박"))}] 효과로 행동할 수 없다!`);
             turnSkipped = true;
         }

         if (this.debuffs?.includes("파멸의 각인(영구)")) { 
             let dmg = Math.floor(this.maxHp * 0.01);
             helpers.safeHpUpdate(this, -dmg);
             this.cb?.logMessage?.(`[파멸의 각인] 효과로 ${dmg}의 생명력 피해!`);
         }
         if (this.debuffs?.some(d => d.startsWith("독("))) {
             let poisonDmg = 5; 
             if (this.debuffs.includes("독(중)")) poisonDmg = 10;
             if (this.debuffs.includes("독(강)")) poisonDmg = 20;
             if (this.debuffs.includes("독(최상급)")) poisonDmg = 50;
             
             if (this.debuffs?.includes("악취(디버프)")) {
                 poisonDmg *= 2;
                 this.cb?.logMessage?.("[패시브: 악취] 효과로 독 피해가 2배 증가합니다!");
             }
             if (this.debuffs.includes("치명적 중독(8배)")) { 
                 poisonDmg *= 8;
             }
             
             helpers.safeHpUpdate(this, -poisonDmg);
             this.cb?.logMessage?.(`[독] 효과로 ${poisonDmg}의 피해!`);
         }
         
         if (this.debuffs?.includes("초재생(1턴)")) { 
             let healAmount = 1000;
             helpers.safeHpUpdate(this, healAmount);
             this.cb?.logMessage?.(`[불멸의 의지] 효과로 체력을 ${healAmount} 회복합니다!`);
         }
         
         this.debuffs = this.debuffs.filter(d => !d.endsWith("(1턴)"));

         if (this.hp <= 0) {
             if (this.inCombat) this.endCombat(false);
             return;
         }

         // 턴 시작 회복(스탯 기반)
         const staminaRegen = Math.max(1, Math.floor((this.currentStats["지구력"] || 10) / 12));
         this.stamina = Math.min(this.maxStamina, this.stamina + staminaRegen);
         const hpRegen = Math.max(0, Math.floor((this.currentStats["자연 재생력"] || 0) / 25));
         if (hpRegen > 0) helpers.safeHpUpdate(this, hpRegen);
         const mpRegen = Math.max(0, Math.floor((this.currentStats["영혼 재생력"] || 0) / 20));
         if (mpRegen > 0) this.mp = Math.min(this.maxMp, this.mp + mpRegen);
         if (this.race === "Elf") {
             this.mp = Math.min(this.maxMp, this.mp + 2);
         }

         if (turnSkipped) {
             this.endTurn();
             return;
         }

         this.playerTurn = true;
         this.evasionBonus = 0;
         this.cb?.updateCombatStatus?.(this);
         this.cb?.updateCombatMenu?.(this);
     }
};
