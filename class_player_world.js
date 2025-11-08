// 파일: class_player_world.js
// 역할: Player 클래스의 비전투 상호작용 (이벤트 처리, 아이템 사용, UI 업데이트)

import { helpers } from './class_helpers.js';

export const PlayerWorldMethods = {

    useItem(itemName) {
        /* AUTO-FIX: added optional chaining ?. for safety */
        if (!this.inventory?.includes(itemName)) {
             /* AUTO-FIX: added optional chaining ?. for safety */
             this.cb?.logMessage(`오류: 인벤토리에 ${itemName} 아이템이 없습니다.`);
             return;
        }

        const item = (this.gameData.items && this.gameData.items[itemName]) || 
                       (this.gameData.numbersItems && this.gameData.numbersItems[itemName]);
        
        // [수정] effect 함수는 data_functional.js에서 병합된 것을 사용
        if (item && typeof item.effect === 'function') {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage(`${itemName}을(를) 사용했다. ${item.desc}`);
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
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage(`Error using item ${itemName}: ${e.message}`);
                 console.error(e);
            }
        } else {
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage(`${itemName} 아이템은 사용할 수 없습니다.`);
        }
    },

    checkSatiety() {
        if (this.position === "Labyrinth") { //
            this.satiety -= 1;
             if (this.satiety < 0) this.satiety = 0;

            if (this.satiety < 30 && this.satiety > 0) {
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage("허기를 느낀다... 능력치가 감소한다.");
            }
            if (this.satiety <= 0) {
                helpers.safeHpUpdate(this, -10);
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage("굶주림으로 인해 체력이 10 감소했다.");
                if (this.hp <= 0) {
                     /* AUTO-FIX: added optional chaining ?. for safety */
                     this.cb?.logMessage("굶주림으로 쓰러졌다...");
                    this.endCombat(false);
                }
            }
            this.showStatus(); // [UI] 상태 갱신
        }
    },

    checkBetrayal() {
        if (this.party.length > 0 && Math.random() < this.betrayalChance) { //
            const traitorIndex = Math.floor(Math.random() * this.party.length);
            const traitor = this.party.splice(traitorIndex, 1)[0];
            /* AUTO-FIX: added optional chaining ?. for safety */
            this.cb?.logMessage(`동료 ${traitor.name}이(가) 배신했다! 갑작스러운 공격에 큰 피해를 입었다!`);
             helpers.safeHpUpdate(this, -50);
            if (this.hp <= 0) {
                 /* AUTO-FIX: added optional chaining ?. for safety */
                 this.cb?.logMessage("배신자의 공격으로 쓰러졌다...");
                 this.endCombat(false);
            }
            this.showStatus(); // [UI] 상태 갱신
        }
    },


    // [확장 계획 1, 2] "conditionalPortal", "statCheck" 수정
    handleEventEffect(effect) {
        if (!effect) return;

        switch (effect.type) {
            case "gainExp":
                this.gainExp(effect.value || 0, null); // 퀘스트/이벤트 경험치는 monsterName null
                if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "addItem":
                this.addItem(effect.item);
                if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "damage":
                helpers.safeHpUpdate(this, -(effect.value || 0));
                if (effect.log) this.cb?.logMessage(effect.log);
                if (effect.debuff) this.applyDebuff(effect.debuff);
                if (this.hp <= 0) {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage("이벤트로 인해 쓰러졌다...");
                    this.endCombat(false);
                }
                break;
            case "applyDebuff":
                const debuffs = helpers.toArray(effect.debuff);
                debuffs.forEach(d => this.applyDebuff(d));
                if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "log":
                if (effect.log) this.cb?.logMessage(effect.log);
                break;

            case "portal":
                if (effect.targetLayer) {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.showPortalChoice(this, effect.targetLayer);
                } else {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage("오류: 포탈 이벤트에 'targetLayer'가 없습니다.");
                }
                break;

            // [확장 계획 2] conditionalPortal 구현
            case "conditionalPortal":
                // 겜바바 설정.txt 100스테이지부터 5층 포탈 수색 가능
                const stageReq = effect.stage || 100;
                if (this.currentStage >= stageReq && Math.random() < (effect.chance || 0.0)) {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage("5층으로 향하는 차원 비석을 발견했습니다!");
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.showPortalChoice(this, effect.targetLayer);
                } else {
                    if (effect.log) this.cb?.logMessage(effect.log);
                }
                break;

            case "combat":
                let monstersToCombat = effect.monsters;
                if (monstersToCombat === "randomGroup" && effect.monsterLayer) {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    monstersToCombat = this.cb?.getRandomMonsters(effect.monsterLayer);
                } else if (monstersToCombat === "random" && effect.monsterLayer) {
                     /* AUTO-FIX: added optional chaining ?. for safety */
                     monstersToCombat = this.cb?.randomMonsterFromLayer(effect.monsterLayer);
                }
                
                if (monstersToCombat && (Array.isArray(monstersToCombat) ? monstersToCombat.length > 0 : true)) {
                    if (effect.log) this.cb?.logMessage(effect.log);
                    this.startCombat(monstersToCombat);
                } else {
                    /* AUTO-FIX: added optional chaining ?. for safety */
                    this.cb?.logMessage("오류: 전투 이벤트에 유효한 몬스터가 없습니다.");
                }
                break;
            
            case "conditionalCombat":
                if (Math.random() < (effect.chance || 1.0)) {
                    if (effect.log) this.cb?.logMessage(effect.log);
                    let condMonsters = effect.monsters;
                     if (condMonsters === "randomGroup" && effect.monsterLayer) {
                        /* AUTO-FIX: added optional chaining ?. for safety */
                        condMonsters = this.cb?.getRandomMonsters(effect.monsterLayer);
                    } else if (condMonsters === "random" && effect.monsterLayer) {
                         /* AUTO-FIX: added optional chaining ?. for safety */
                         condMonsters = this.cb?.randomMonsterFromLayer(effect.monsterLayer);
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
                     if (effect.log) this.cb?.logMessage(effect.log);
                     this.startCombat(effect.boss);
                 }
                break;
            
            // [확장 계획 1] 탐색꾼 보너스 추가
            case "statCheck":
                 let threshold = effect.threshold;
                 // --- [계획 1] 탐색꾼(Scout) 보너스 ---
                 if (this.party.some(m => m.trait === "탐색꾼")) {
                     const bonus = 5; /* DEFAULT: 5 (검토 필요) */ // (임의) 난이도 5 감소
                     threshold = Math.max(1, threshold - bonus); 
                     /* AUTO-FIX: added optional chaining ?. for safety */
                     this.cb?.logMessage(`[파티 보너스] 탐색꾼 ${this.party.find(m => m.trait === "탐색꾼").name}의 도움으로 함정 난이도가 ${bonus} 감소합니다! (요구치: ${threshold})`);
                 }
                 // --- [계획 1] 끝 ---

                 if (this.currentStats[effect.stat] >= threshold) {
                     if(effect.success.log) this.cb?.logMessage(effect.success.log);
                     if(effect.success) this.handleEventEffect(effect.success); // 성공 시 연쇄 이벤트
                 } else {
                     if(effect.failure.log) this.cb?.logMessage(effect.failure.log);
                     if(effect.failure) this.handleEventEffect(effect.failure); // 실패 시 연쇄 이벤트
                 }
                break;
            case "loseStamina":
                this.stamina = Math.max(0, this.stamina - (effect.value || 0));
                 if (effect.log) this.cb?.logMessage(effect.log);
                 if (effect.chain) this.handleEventEffect(effect.chain); // 연쇄 이벤트 처리
                break;
            case "gainMagicStones":
                 let amount = effect.value;
                 if (amount === "random") {
                     amount = Math.floor(Math.random() * (effect.max - effect.min + 1)) + effect.min;
                 }
                 this.magic_stones += amount;
                 if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "modifyStat": // [신규] world_data.json의 5층 이벤트
                 if (this.stats.hasOwnProperty(effect.stat)) {
                     this.stats[effect.stat] += effect.value;
                     if (effect.log) this.cb?.logMessage(effect.log);
                     this.calculateStats(); // 스탯 재계산
                 }
                break;

            default:
                /* AUTO-FIX: added optional chaining ?. for safety */
                this.cb?.logMessage(`(미구현 이벤트: ${effect.type})`);
        }
        
        const uiChangingEvents = ["portal", "combat", "conditionalCombat", "conditionalBoss", "conditionalPortal"];
        if (!uiChangingEvents.includes(effect.type)) {
             this.showStatus(); // [UI] 이벤트 결과 반영
        }
    },

    /**
     * [신규] 정수 선택 모달이 닫힌 후 게임 루프(턴/전투 종료)를 재개합니다.
     * (ui_party.js의 showEssencePartyChoice에서 호출됨)
     */
    /* AUTO-FIX: [Optimization] Added function to resume game loop after modal choice */
    resumeCombatAfterChoice() {
        if (this.isWaitingForEssenceChoice === false) return; // 중복 호출 방지
        
        this.isWaitingForEssenceChoice = false; // "일시정지" 플래그 해제

        if (!this.inCombat) return; // 전투가 이미 끝났으면 중지

        // 모든 몬스터가 처치되었는지 다시 확인
        /* AUTO-FIX: added optional chaining ?. for safety */
        const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
        
        if (allMonstersDefeated) {
            this.endCombat(true); // 모든 몬스터가 죽었으므로 전투 종료
        } else {
            this.endTurn(); // 아직 몬스터가 남았으므로 턴 종료
        }
    },


    // [수정] UI 즉각 반응을 위한 마스터 업데이트 함수
    showStatus() {
         const statusDiv = document.getElementById('status');
         if (!statusDiv) {
             console.error("Error: Status element not found in DOM.");
             return;
         }

        // [수정] 스탯 계산을 먼저 수행
        this.calculateStats();
        
        /* AUTO-FIX: added guard for this.gameData.expToLevel to avoid TypeError */
        const requiredExp = (this.gameData.expToLevel && this.gameData.expToLevel[this.level]) || 'MAX';

        let statusHtml = `<b>종족:</b> ${this.race || '미선택'} | <b>레벨:</b> ${this.level} | <b>탐험 등급:</b> ${this.grade}등급 | <b>EXP:</b> ${this.exp}/${requiredExp}<br>`;
        
        // [확장 계획 4] 은행 잔고 표시
        statusHtml += `<b>골드:</b> ${this.gold.toLocaleString()} 스톤 | <b>은행:</b> ${this.bankGold.toLocaleString()} 스톤 | <b>마석:</b> ${this.magic_stones.toLocaleString()} 개<br>`;

        statusHtml += `<b>포만감:</b> ${this.satiety} | <b>피로:</b> ${this.fatigue}/100 | <b>미궁 남은시간:</b> ${this.timeRemaining > 0 ? this.timeRemaining + '시간' : '제한 없음'}<br>`;
        
        // [확장 계획 1] 파티원 직업(trait) 표시
        statusHtml += `<b>동료:</b> ${this.party.map(p => `${p.name}(${p.grade}등급/${p.trait})`).join(', ') || '없음'}<br>`;
        
        // [수정] 기본 스탯(stats)과 최종 스탯(currentStats)을 분리 표시
        statusHtml += "<b>기본 스탯 (순수):</b><ul class='stat-list'>";
        
        /* AUTO-FIX: added guard for this.gameData.statsList to avoid TypeError */
        const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
        
        statsList.forEach(stat => {
            if (this.stats.hasOwnProperty(stat.name) && this.stats[stat.name] !== 0) {
                // [문법 수정] 대괄호 표기법
                statusHtml += `<li class='stat-item'>${stat.name}: ${this.stats[stat.name]}</li>`;
            }
        });
        statusHtml += "</ul><b>최종 스탯 (장비/정수 포함):</b><ul class='stat-list'>";
        statsList.forEach(stat => {
            if (this.currentStats.hasOwnProperty(stat.name) && this.currentStats[stat.name] !== 0) {
                // [문법 수정] 대괄호 표기법
                statusHtml += `<li class='stat-item'>${stat.name}: ${this.currentStats[stat.name]}</li>`;
            }
        });
        statusHtml += "</ul>";
        
        statusHtml += `<b>마법:</b> ${this.spells.length > 0 ? this.spells.join(", ") : '없음'}<br>`;
        statusHtml += `<b>정수:</b> ${this.essences.length > 0 ? this.essences.map(key => `${key} 정수`).join(", ") : '없음'} (${this.essences.length}/${this.level * 3})<br>`;
        statusHtml += `<b>정수 스킬:</b> ${this.essence_skills.length > 0 ? this.essence_skills.join(", ") : '없음'}<br>`;
        /* AUTO-FIX: added optional chaining ?. for safety */
        statusHtml += `<b>인벤토리 (${this.inventory?.length}개):</b> ${this.inventory.slice(0, 5).join(", ")}${this.inventory.length > 5 ? '...' : ''}<br>`;
        statusHtml += `<b>장비:</b><br>
            투구: ${this.equipment?.투구 || '없음'} |
            갑옷: ${this.equipment?.갑옷 || '없음'} |
            장갑: ${this.equipment?.장갑 || '없음'} <br>
            각반: ${this.equipment?.각반 || '없음'} |
            무기: ${this.equipment?.무기 || '없음'} |
            부무기: ${this.equipment?.부무기 || '없음'}<br>`;

        statusDiv.innerHTML = statusHtml;

        // [UI] 상태 바 즉시 업데이트
        /* AUTO-FIX: added optional chaining ?. for safety */
        this.cb?.updateStatusBars(this);
    }
};