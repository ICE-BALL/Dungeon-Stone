// 파일: class_player_world.js
// 역할: Player 클래스의 비전투 상호작용 (이동, 이벤트 처리, 아이템 사용, UI 업데이트)
// [수정] (v10) 이동 시 랜덤 인카운터(무작위 몬스터 등장) 로직 추가

import { helpers } from './class_helpers.js';

export const PlayerWorldMethods = {

    /**
     * [핵심] 2D 맵 탐험 시스템의 이동 및 타일 이벤트 처리
     * @param {'north' | 'south' | 'east' | 'west'} direction - 이동 방향
     */
    moveOnMap(direction) {
        // [안전성 검사] 데이터 존재 여부 확인
        if (!this.cb?.gameData?.layers) {
            this.cb?.logMessage?.("오류: 맵 데이터(layers)를 찾을 수 없습니다.");
            return;
        }

        const layer = this.cb.gameData.layers[this.currentLayer];
        if (!layer || !layer.map || !layer.tileData) {
            this.cb?.logMessage?.(`오류: 현재 층(${this.currentLayer})의 맵 또는 타일 데이터가 정의되지 않았습니다.`);
            return;
        }

        const map = layer.map;
        const mapHeight = map.length;
        const mapWidth = map[0].length;
        
        let newX = this.mapX;
        let newY = this.mapY;

        // 방향에 따른 좌표 변경
        if (direction === 'north') newY--;
        else if (direction === 'south') newY++;
        else if (direction === 'west') newX--;
        else if (direction === 'east') newX++;

        // 1. 경계 확인 (Boundary Check)
        if (newY < 0 || newY >= mapHeight || newX < 0 || newX >= mapWidth) {
            this.cb?.logMessage?.("더 이상 그 방향으로 갈 수 없습니다. (맵 경계)");
            return;
        }

        // 2. 타일 ID 및 데이터 가져오기
        const tileID = map[newY][newX]; 
        const splitID = tileID.split(':');
        const tileTypeKey = splitID[0]; // "Portal", "Boss", "Curio" 등
        const tileParam = splitID[1];   // "2", "드레드피어" 등
        
        // 타일 데이터 조회 (우선 layer.tileData, 없으면 전역 curios 데이터)
        let tileData = layer.tileData[tileID] || layer.tileData[tileTypeKey];
        if ((tileTypeKey === 'Curio' || tileTypeKey === 'Trace') && !tileData) {
             tileData = this.cb?.gameData?.curios?.[tileParam];
        }

        // 3. 벽(Wall) 확인 - 이동 불가
        if (tileTypeKey === "Wall") {
            this.cb?.logMessage?.(tileData?.desc || "단단한 벽이 길을 막고 있습니다.");
            return;
        }

        // 4. 이동 처리 및 비용 차감
        this.mapX = newX;
        this.mapY = newY;
        this.timeRemaining--; 
        
        // 이동 피로도: 기본 5, 지구력 3당 1 감소 (최소 1)
        const fatigueCost = Math.max(1, 5 - Math.floor((this.currentStats["지구력"] || 10) / 3));
        this.fatigue = Math.min(100, this.fatigue + fatigueCost);
        
        // [방문 기록] 안개 걷기
        this.visitedTiles = this.visitedTiles || {};
        if (!this.visitedTiles[this.currentLayer]) {
             this.visitedTiles[this.currentLayer] = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false));
        }
        this.visitedTiles[this.currentLayer][newY][newX] = true;


        // 5. 타일 이벤트 처리
        switch (tileTypeKey) {
            case "Portal":
                if (typeof this.cb?.showPortalChoice === 'function') {
                    const nextLayer = tileParam ? (isNaN(tileParam) ? tileParam : parseInt(tileParam)) : this.currentLayer + 1;
                    this.cb.showPortalChoice(this, nextLayer, this.currentLayer);
                } else {
                    this.cb?.logMessage?.(`[차원 비석] ${tileData?.desc || "다른 층으로 가는 길입니다."}`);
                }
                break;

            case "Rift":
                const rift = this.cb?.gameData?.rifts?.[this.currentLayer]?.find(r => r.name === tileParam) || 
                             this.cb?.gameData?.rifts?.[this.currentLayer]?.[0]; // fallback

                if(rift && this.cb?.showRiftEntryModal) {
                    this.cb.showRiftEntryModal(this, rift);
                } else {
                    this.cb?.logMessage?.(`[균열] ${tileData?.desc || "차원의 틈새가 보입니다."}`);
                }
                break;

            case "Curio":
            case "Trace":
                if (tileData && this.cb?.showCurioInteraction) {
                    this.cb.showCurioInteraction(this, tileData, tileTypeKey);
                } else {
                    this.cb?.logMessage?.(`[${tileTypeKey}] ${tileData?.desc || "무언가 흥미로운 것이 있습니다."}`);
                }
                break;

            case "Boss":
                this.cb?.logMessage?.(`[경고] ${tileData?.desc || "강력한 기운이 느껴집니다."}`);
                if (tileParam && typeof this.startCombat === 'function') {
                    this.startCombat(tileParam);
                }
                break;

            case "Monster":
                this.cb?.logMessage?.(`[전투] ${tileData?.desc || "몬스터가 나타났습니다!"}`);
                if (tileParam && typeof this.startCombat === 'function') {
                    this.startCombat(tileParam);
                }
                break;
            
            case "Item":
                this.cb?.logMessage?.(`[발견] ${tileData?.desc || "아이템이 떨어져 있습니다."}`);
                if (tileData?.events) {
                    tileData.events.forEach(e => this.handleEventEffect(e));
                } else if (tileParam && typeof this.addItem === 'function') {
                    this.addItem(tileParam);
                }
                break;

            case "Start":
                this.cb?.logMessage?.("안전한 시작 지점입니다.");
                break;

            // 일반 지형 (Forest, Cave, Desert, Sea 등) - 여기서 랜덤 인카운터 체크
            default:
                if(tileData?.desc) this.cb?.logMessage?.(tileData.desc);

                let eventTriggeredCombat = false;

                // 타일 고유 이벤트 처리 (확률적 전투 등)
                const eventList = tileData?.events;
                if (eventList && Array.isArray(eventList) && eventList.length > 0) {
                    const randomEvent = eventList[Math.floor(Math.random() * eventList.length)];
                    if (randomEvent.chance === undefined || Math.random() < randomEvent.chance) {
                        this.handleEventEffect(randomEvent);
                        // 이벤트로 인해 전투가 시작되었는지 확인
                        if (this.inCombat) eventTriggeredCombat = true;
                    }
                }

                // [신규] 랜덤 인카운터 체크 (타일 이벤트로 전투가 발생하지 않았을 때만)
                if (!eventTriggeredCombat && !this.inCombat) {
                    this.checkRandomEncounter();
                }
                break;
        }

        // 6. UI 갱신 (전투나 모달이 열리지 않았을 때만)
        if (!this.inCombat && !document.querySelector('.modal-overlay:not(.hidden)')) {
            if (typeof this.cb?.drawMap === 'function') {
                this.cb.drawMap(this); 
            }
            if (typeof this.cb?.updateMenu === 'function') {
                this.cb.updateMenu(this);
            }
        }
    },

    /**
     * [신규] 이동 시 랜덤 몬스터 조우 체크
     */
    checkRandomEncounter() {
        // 1. 해당 층에 몬스터 데이터가 있는지 확인 (8층 안전지대 등 제외)
        const randomMonsterName = this.cb?.randomMonsterFromLayer(this.currentLayer);
        if (!randomMonsterName) return; // 등장할 몬스터가 없으면 스킵

        // 2. 확률 체크 (기본 15%)
        const ENCOUNTER_CHANCE = 0.15; 
        
        // (추후 '은신' 스킬이나 '악취' 아이템 등으로 확률 조정 가능)
        // ex: if (this.debuffs.includes("은신")) chance *= 0.5;

        if (Math.random() < ENCOUNTER_CHANCE) {
            this.cb?.logMessage("이동 중 야생의 몬스터와 마주쳤습니다!");
            // 전투 시작 (class_player_combat.js의 startCombat 호출)
            if (typeof this.startCombat === 'function') {
                this.startCombat(randomMonsterName);
            }
        }
    },

    /**
     * Curio 상호작용 결과 처리
     */
    resolveCurioInteraction(resultData) {
        if (!resultData) return;

        if (resultData.msg) {
            this.cb?.logMessage(resultData.msg);
        }

        switch (resultData.type) {
            case "item":
                this.addItem(resultData.id); 
                break;
            case "damage":
                helpers.safeHpUpdate(this, -(resultData.value || 0), { isSkillHit: false });
                break;
            case "buff":
                this.cb?.logMessage("기분 좋은 기운이 감돕니다. (버프 효과 미구현)");
                break;
            case "debuff":
                if(typeof this.applyDebuff === 'function') this.applyDebuff(resultData.id);
                break;
            case "combat":
                if (typeof this.startCombat === 'function') {
                    this.startCombat(resultData.id);
                }
                break;
            case "remove_debuff":
                if(typeof this.removeAllDebuffs === 'function') this.removeAllDebuffs();
                break;
            case "damage_reward":
                 helpers.safeHpUpdate(this, -(resultData.cost || 0), { isSkillHit: false });
                 if (resultData.reward) {
                     this.resolveCurioInteraction(resultData.reward);
                 }
                 break;
        }
        this.showStatus();
    },

    useItem(itemName) {
        if (!this.inventory?.includes(itemName)) {
             this.cb?.logMessage?.(`오류: 인벤토리에 ${itemName} 아이템이 없습니다.`);
             return;
        }

        const item = (this.gameData.items && this.gameData.items[itemName]) || 
                       (this.gameData.numbersItems && this.gameData.numbersItems[itemName]);
        
        if (item && typeof item.effect === 'function') {
            this.cb?.logMessage(`${itemName}을(를) 사용했다. ${item.desc}`);
            try {
                 item.effect(this);
                 if (!item.type || item.type === '소모품') {
                     const itemIndex = this.inventory.indexOf(itemName);
                     if (itemIndex > -1) {
                         this.inventory.splice(itemIndex, 1);
                     }
                 }
                 this.showStatus();
            } catch (e) {
                this.cb?.logMessage(`Error using item ${itemName}: ${e.message}`);
                 console.error(e);
            }
        } else {
            this.cb?.logMessage(`${itemName} 아이템은 사용할 수 없습니다.`);
        }
    },

    applyHungerFromMovement(steps = 1) {
        if (this.position !== "Labyrinth" || steps <= 0) return;

        this.labyrinthSteps = (this.labyrinthSteps || 0) + steps;
        const threshold = this.hungerStepThreshold || 30;

        while (this.labyrinthSteps >= threshold) {
            this.labyrinthSteps -= threshold;
            this.satiety = Math.max(0, (this.satiety || 0) - 1);
            this.cb?.logMessage(`미궁에서 ${threshold}칸 이동하여 포만감이 1 감소했습니다. (현재 포만감: ${this.satiety})`);
        }

        this.checkSatiety();
    },

    checkSatiety() {
        if (this.position !== "Labyrinth") return;

        if (this.satiety < 30 && this.satiety > 0 && !this.hungerWarningShown) {
            this.hungerWarningShown = true;
            this.cb?.logMessage("허기가 심해집니다. 식량을 섭취하거나 모닥불에서 휴식하세요.");
        }
        if (this.satiety >= 30) {
            this.hungerWarningShown = false;
        }

        if (this.satiety <= 0) {
            helpers.safeHpUpdate(this, -10, { isSkillHit: false });
            this.cb?.logMessage("굶주림으로 인해 체력이 10 감소했다.");
            if (this.hp <= 0) {
                this.cb?.logMessage("굶주림으로 쓰러졌다...");
                if (typeof this.endCombat === 'function') this.endCombat(false);
            }
        }
        this.showStatus();
    },

    checkBetrayal() {
        if (this.party.length > 0 && Math.random() < this.betrayalChance) {
            const traitorIndex = Math.floor(Math.random() * this.party.length);
            const traitor = this.party.splice(traitorIndex, 1)[0];
            this.cb?.logMessage(`동료 ${traitor.name}이(가) 배신했다! 갑작스러운 공격에 큰 피해를 입었다!`);
             helpers.safeHpUpdate(this, -50, { isSkillHit: true }); 
            if (this.hp <= 0) {
                 this.cb?.logMessage("배신자의 공격으로 쓰러졌다...");
                 if (typeof this.endCombat === 'function') this.endCombat(false);
            }
            this.showStatus();
        }
    },

    handleEventEffect(effect) {
        if (!effect) return;

        switch (effect.type) {
            case "gainExp":
                if (typeof this.gainExp === 'function') this.gainExp(effect.value || 0, null);
                if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "addItem":
                if (typeof this.addItem === 'function') this.addItem(effect.item);
                if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "gainGold":
                this.gold = Math.max(0, (this.gold || 0) + (effect.value || 0));
                if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "recoverAll":
                {
                    const ratio = Math.max(0, Math.min(100, effect.value || 0)) / 100;
                    this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * ratio));
                    this.mp = Math.min(this.maxMp, this.mp + Math.floor(this.maxMp * ratio));
                    this.stamina = Math.min(this.maxStamina, this.stamina + Math.floor(this.maxStamina * ratio));
                    if (effect.log) this.cb?.logMessage(effect.log);
                }
                break;
            case "applyBuff":
                if (typeof this.applyBuff === 'function') {
                    const dur = effect.duration ? `(${effect.duration}턴)` : "";
                    this.applyBuff(`${effect.buff || "강화"}${dur}`);
                } else {
                    this.debuffs = this.debuffs || [];
                    this.debuffs.push(`${effect.buff || "강화"}(버프)`);
                }
                if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "damage":
                helpers.safeHpUpdate(this, -(effect.value || 0), { isSkillHit: false });
                if (effect.log) this.cb?.logMessage(effect.log);
                if (effect.debuff && typeof this.applyDebuff === 'function') this.applyDebuff(effect.debuff);
                if (this.hp <= 0) {
                    this.cb?.logMessage("이벤트로 인해 쓰러졌다...");
                    if (typeof this.endCombat === 'function') this.endCombat(false);
                }
                break;
            case "conditionalDamage":
                if (Math.random() < (effect.chance || 1.0)) {
                    helpers.safeHpUpdate(this, -(effect.value || 0), { isSkillHit: true });
                    if (effect.log) this.cb?.logMessage(effect.log);
                    if (this.hp <= 0) {
                         this.cb?.logMessage("치명적인 피해를 입고 쓰러졌다...");
                         if (typeof this.endCombat === 'function') this.endCombat(false);
                    }
                } else if (effect.failure) {
                    this.handleEventEffect(effect.failure);
                }
                break;
            case "applyDebuff":
                const debuffs = helpers.toArray(effect.debuff);
                debuffs.forEach(d => {
                    if (typeof this.applyDebuff === 'function') this.applyDebuff(d);
                });
                if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "log":
                if (effect.log) this.cb?.logMessage(effect.log);
                break;

            case "portal":
                if (effect.targetLayer) {
                    this.cb?.showPortalChoice(this, effect.targetLayer);
                } else {
                    this.cb?.logMessage("오류: 포탈 이벤트에 'targetLayer'가 없습니다.");
                }
                break;

            case "conditionalPortal":
                const stageReq = effect.stage || 100;
                if (this.currentStage >= stageReq && Math.random() < (effect.chance || 0.0)) {
                    this.cb?.logMessage("5층으로 향하는 차원 비석을 발견했습니다!");
                    this.cb?.showPortalChoice(this, effect.targetLayer);
                } else {
                    if (effect.log) this.cb?.logMessage(effect.log);
                }
                break;

            case "combat":
                let monstersToCombat = effect.monsters;
                if (monstersToCombat === "randomGroup" && effect.monsterLayer) {
                    monstersToCombat = this.cb?.getRandomMonsters(effect.monsterLayer);
                } else if (monstersToCombat === "random" && effect.monsterLayer) {
                     monstersToCombat = [this.cb?.randomMonsterFromLayer(effect.monsterLayer)];
                }
                
                if (monstersToCombat && (Array.isArray(monstersToCombat) ? monstersToCombat.length > 0 : true)) {
                    if (effect.log) this.cb?.logMessage(effect.log);
                    if (typeof this.startCombat === 'function') this.startCombat(monstersToCombat);
                }
                break;
            
            case "conditionalCombat":
                if (Math.random() < (effect.chance || 1.0)) {
                    if (effect.log) this.cb?.logMessage(effect.log);
                    let condMonsters = effect.monsters;
                     if (condMonsters === "randomGroup" && effect.monsterLayer) {
                        condMonsters = this.cb?.getRandomMonsters(effect.monsterLayer);
                    } else if (condMonsters === "random" && effect.monsterLayer) {
                         condMonsters = [this.cb?.randomMonsterFromLayer(effect.monsterLayer)];
                    }
                    if (condMonsters && (Array.isArray(condMonsters) ? condMonsters.length > 0 : true)) {
                        if (typeof this.startCombat === 'function') this.startCombat(condMonsters);
                    }
                }
                break;
            
            case "conditionalBoss":
                 if ((this.party.length + 1 >= (effect.partySize || 0)) &&
                     ((this.daysInLabyrinth * 24 + this.explorationCount) > (effect.timeElapsed || 0)) &&
                     (Math.random() < (effect.chance || 0.0)))
                 {
                     if (effect.log) this.cb?.logMessage(effect.log);
                     if (typeof this.startCombat === 'function') this.startCombat(effect.boss);
                 }
                break;
            
            case "statCheck":
                 let threshold = effect.threshold;
                 // 탐색꾼 보너스
                 if (this.party.some(m => m.trait === "탐색꾼")) {
                     const bonus = 5;
                     threshold = Math.max(1, threshold - bonus); 
                     this.cb?.logMessage(`[파티 보너스] 탐색꾼의 도움으로 난이도가 ${bonus} 감소합니다! (요구치: ${threshold})`);
                 }

                 if ((this.currentStats[effect.stat] || 0) >= threshold) {
                     if(effect.success && effect.success.log) this.cb?.logMessage(effect.success.log);
                     if(effect.success) this.handleEventEffect(effect.success);
                 } else {
                     if(effect.failure && effect.failure.log) this.cb?.logMessage(effect.failure.log);
                     if(effect.failure) this.handleEventEffect(effect.failure);
                 }
                break;
            case "loseStamina":
                this.stamina = Math.max(0, this.stamina - (effect.value || 0));
                 if (effect.log) this.cb?.logMessage(effect.log);
                 if (effect.chain) this.handleEventEffect(effect.chain);
                break;
            case "gainMagicStones":
                 let amount = effect.value;
                 if (amount === "random") {
                     amount = Math.floor(Math.random() * (effect.max - effect.min + 1)) + effect.min;
                 }
                 this.magic_stones += amount;
                 if (effect.log) this.cb?.logMessage(effect.log);
                break;
            case "modifyStat":
                 if (this.stats.hasOwnProperty(effect.stat)) {
                     this.stats[effect.stat] += effect.value;
                     if (effect.log) this.cb?.logMessage(effect.log);
                     this.calculateStats();
                 }
                break;

            default:
                break;
        }
        
        const uiChangingEvents = ["portal", "combat", "conditionalCombat", "conditionalBoss", "conditionalPortal"];
        if (!uiChangingEvents.includes(effect.type)) {
             this.showStatus();
        }
    },

    resumeCombatAfterChoice() {
        if (this.isWaitingForEssenceChoice === false) return;
        
        this.isWaitingForEssenceChoice = false;

        if (!this.inCombat) return;

        const allMonstersDefeated = this.currentMonster?.every(m => !m || m.hp <= 0);
        
        if (allMonstersDefeated) {
            if (typeof this.endCombat === 'function') this.endCombat(true);
        } else {
            if (typeof this.endTurn === 'function') this.endTurn();
        }
    },

    showStatus() {
        const statusDiv = document.getElementById('status');
        if (!statusDiv) return;

        if (typeof this.calculateStats === 'function') this.calculateStats();

        const requiredExp = (this.gameData.expToLevel && this.gameData.expToLevel[this.level]) || 'MAX';
        const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
        const baseStats = statsList.filter(stat => this.stats?.[stat.name] !== 0);
        const finalStats = statsList.filter(stat => this.currentStats?.[stat.name] !== 0);

        const statusChips = [
            `종족 ${this.race || '미선택'}`,
            `레벨 ${this.level}`,
            `탐험 ${this.grade}등급`,
            `EXP ${this.exp}/${requiredExp}`,
            `포만감 ${this.satiety}`,
            `피로 ${this.fatigue}/100`,
            `동료 ${this.party?.length || 0}명`
        ];

        let labyrinthInfo = '';
        if (this.position === "Labyrinth") {
            labyrinthInfo += `<div class="status-inline-card"><b>현재 좌표</b><span>L${this.currentLayer} (${this.x}, ${this.y})</span></div>`;
            labyrinthInfo += `<div class="status-inline-card"><b>허기 카운트</b><span>${(this.labyrinthSteps || 0)}/${this.hungerStepThreshold || 30}</span></div>`;
            if (this.mapManager?.collapse?.active) {
                const c = this.mapManager.collapse;
                labyrinthInfo += `<div class="status-inline-card"><b>차원붕괴</b><span>${c.wave}/${c.maxWaves} | 왜곡 ${c.movesUntilShift}턴 | 장막 ${c.barrierRadius}</span></div>`;
            }
        } else {
            labyrinthInfo = `<div class="status-inline-card"><b>현재 위치</b><span>${this.position || '도시'}</span></div>`;
        }

        const equipSlots = ['투구', '갑옷', '장갑', '각반', '무기', '부무기'];
        const equipCards = equipSlots
            .map(slot => `<div class="status-mini-card"><b>${slot}</b><span>${this.equipment?.[slot] || '없음'}</span></div>`)
            .join('');

        const spellPreview = this.spells?.length > 0 ? this.spells.slice(0, 8).join(', ') : '없음';
        const essencePreview = this.essences?.length > 0 ? this.essences.map(key => `${key} 정수`).slice(0, 6).join(', ') : '없음';
        const skillPreview = this.essence_skills?.length > 0 ? this.essence_skills.slice(0, 8).join(', ') : '없음';
        const invPreview = this.inventory?.length > 0 ? this.inventory.slice(0, 8).join(', ') : '없음';

        statusDiv.innerHTML = `
            <div class="status-chip-grid">
                ${statusChips.map(chip => `<span class="status-chip">${chip}</span>`).join('')}
            </div>

            <div class="status-inline-grid">
                <div class="status-inline-card"><b>보유 스톤</b><span>${this.gold.toLocaleString()}</span></div>
                <div class="status-inline-card"><b>은행 예금</b><span>${this.bankGold.toLocaleString()}</span></div>
                <div class="status-inline-card"><b>마석</b><span>${this.magic_stones.toLocaleString()} 개</span></div>
                <div class="status-inline-card"><b>미궁 남은시간</b><span>${this.timeRemaining > 0 ? this.timeRemaining + '시간' : '제한 없음'}</span></div>
                ${labyrinthInfo}
            </div>

            <div class="status-section">
                <h4>기본 스탯</h4>
                <div class="status-mini-grid">
                    ${baseStats.length ? baseStats.map(stat => `<div class="status-mini-card"><b>${stat.name}</b><span>${this.stats[stat.name]}</span></div>`).join('') : '<p class="status-empty">표시할 스탯 없음</p>'}
                </div>
            </div>

            <div class="status-section">
                <h4>최종 스탯</h4>
                <div class="status-mini-grid">
                    ${finalStats.length ? finalStats.map(stat => `<div class="status-mini-card"><b>${stat.name}</b><span>${this.currentStats[stat.name]}</span></div>`).join('') : '<p class="status-empty">표시할 스탯 없음</p>'}
                </div>
            </div>

            <div class="status-section">
                <h4>장비</h4>
                <div class="status-mini-grid">${equipCards}</div>
            </div>

            <div class="status-section">
                <h4>기술 / 보유</h4>
                <div class="status-inline-grid">
                    <div class="status-inline-card"><b>마법</b><span>${spellPreview}</span></div>
                    <div class="status-inline-card"><b>정수 (${this.essences.length}/${this.level * 3})</b><span>${essencePreview}</span></div>
                    <div class="status-inline-card"><b>정수 스킬</b><span>${skillPreview}</span></div>
                    <div class="status-inline-card"><b>인벤토리 (${this.inventory?.length || 0})</b><span>${invPreview}</span></div>
                </div>
            </div>
        `;

        this.cb?.updateStatusBars(this);
    }
};
