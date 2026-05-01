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

        // [Phase 3] 종족별 환경 제약 체크
        if (this.raceSystem) {
            const constraintResult = this.raceSystem.canEnterTile(tileTypeKey);
            if (!constraintResult.allowed) {
                // 타일 진입 불가
                this.cb?.logMessage?.(constraintResult.message || `${tileTypeKey} 지역으로 진입할 수 없습니다.`);
                return;
            }
        }

        // 3. 벽(Wall) 확인 - 이동 불가
        if (tileTypeKey === "Wall") {
            this.cb?.logMessage?.(tileData?.desc || "단단한 벽이 길을 막고 있습니다.");
            return;
        }

        // 4. 이동 처리 및 비용 차감
        this.mapX = newX;
        this.mapY = newY;
        
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
                {
                    const buffName = String(resultData.id || "축복");
                    const hpGain = Math.max(6, Math.floor(Number(this.maxHp || 100) * 0.08));
                    const mpGain = Math.max(4, Math.floor(Number(this.maxMp || 60) * 0.06));
                    helpers.safeHpUpdate(this, hpGain);
                    this.mp = Math.min(this.maxMp, Number(this.mp || 0) + mpGain);
                    if (typeof this.applyDebuff === "function") {
                        this.applyDebuff(`${buffName}(3턴)`);
                    }
                    this.cb?.logMessage(`기분 좋은 기운이 감돕니다. (${buffName}, HP +${hpGain}, MP +${mpGain})`);
                }
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
        const equippedSlots = Object.entries(this.equipment || {})
            .filter(([, equipped]) => equipped === itemName)
            .map(([slot]) => slot);
        const isEquippedItem = equippedSlots.length > 0;

        if (!this.inventory?.includes(itemName) && !isEquippedItem) {
             this.cb?.logMessage?.(`오류: 인벤토리에 ${itemName} 아이템이 없습니다.`);
             return;
        }

        if (this.position === "Labyrinth" && this.mapManager?.tryResolveHiddenPieceByItem) {
            const hiddenResult = this.mapManager.tryResolveHiddenPieceByItem(itemName);
            if (hiddenResult?.resolved) {
                if (hiddenResult.consume) {
                    const itemIndex = this.inventory.indexOf(itemName);
                    if (itemIndex > -1) this.inventory.splice(itemIndex, 1);
                }
                this.showStatus?.();
                return;
            }
        }

        if (itemName === "감정 스크롤") {
            const itemIndex = this.inventory.indexOf(itemName);
            if (itemIndex > -1) this.inventory.splice(itemIndex, 1);
            const identified = this.identifyRandomUnidentifiedItem?.("감정 스크롤");
            if (!identified) {
                this.cb?.logMessage?.("감정할 미식별 장비가 없습니다.");
            } else {
                this.cb?.logMessage?.(`[감정 스크롤] ${identified}의 정체를 확인했습니다.`);
            }
            this.showStatus?.();
            return;
        }

        if (itemName === "모닥불 키트") {
            if (this.mapManager?.startCampfirePlacement) {
                this.mapManager.startCampfirePlacement();
                return;
            }
        }
        if (itemName === "횃불" && this.position === "Labyrinth") {
            if (this.mapManager?.startTorchPlacement || this.mapManager?.toggleTorchEquip) {
                const placeFirst = confirm("횃불을 설치할까요?\n취소를 누르면 장착/해제를 시도합니다.");
                if (placeFirst) this.mapManager.startTorchPlacement?.();
                else this.mapManager.toggleTorchEquip?.();
                return;
            }
        }

        const item = (this.gameData.items && this.gameData.items[itemName]) || 
                       (this.gameData.numbersItems && this.gameData.numbersItems[itemName]);
        
        if (item && typeof item.effect === 'function') {
            this.cb?.logMessage(`${itemName}을(를) 사용했다. ${item.desc}`);
            try {
                 item.effect(this);
                 if (!item.type || item.type === '소모품') {
                     const itemIndex = this.inventory.indexOf(itemName);
                     if (itemIndex > -1) this.inventory.splice(itemIndex, 1);
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

        const penalty = this.getSatietyPenaltyProfile?.() || {};
        const stage = String(penalty.stage || "stable");
        if (this._lastSatietyPenaltyStage !== stage) {
            this._lastSatietyPenaltyStage = stage;
            if (stage === "hungry") {
                this.cb?.logMessage("허기로 인해 힘이 빠집니다. (근력/민첩 저하, 스킬 실패 확률 증가)");
            } else if (stage === "critical") {
                this.cb?.logMessage("극심한 허기 상태입니다. 공격력 저하와 스킬 실패 위험이 큽니다.");
            } else if (stage === "starving") {
                this.cb?.logMessage("아사 직전입니다. 즉시 식량을 확보하지 않으면 생존이 어렵습니다.");
            }
        }

        if (this.satiety < 35 && this.satiety > 0 && !this.hungerWarningShown) {
            this.hungerWarningShown = true;
            this.cb?.logMessage("허기가 심해집니다. 식량을 섭취하거나 모닥불에서 휴식하세요.");
        }
        if (this.satiety >= 35) {
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
        if (typeof this.processCompanionPanic === 'function') {
            const panicked = this.processCompanionPanic("탐험 중 위기");
            if (panicked) {
                this.showStatus?.();
                return;
            }
        }

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

        const requiredExpRaw = (typeof this.getRequiredExpForLevel === 'function')
            ? this.getRequiredExpForLevel(this.level)
            : Number(this.gameData?.expToLevel?.[this.level]);
        const requiredExp = Number.isFinite(requiredExpRaw) ? requiredExpRaw : 'MAX';
        const maxEssenceCapacity = (typeof this.getMaxEssenceCapacity === 'function')
            ? this.getMaxEssenceCapacity(this.level)
            : Math.max(1, (this.level * 3) + Math.floor(this.level / 5) - (this.essences?.includes("디아몬트") ? 1 : 0));
        const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
        const baseStats = statsList.filter(stat => this.stats?.[stat.name] !== 0);
        const finalStats = statsList.filter(stat => this.currentStats?.[stat.name] !== 0);
        const statusChips = [
            `종족 ${this.race || '미선택'}`,
            `레벨 ${this.level}`,
            `탐험 ${this.grade}등급`,
            `EXP ${this.exp}/${requiredExp}`,
            `특성 포인트 ${this.traitPoints || 0}`,
            `포만감 ${this.satiety}`,
            `피로 ${this.fatigue}/100`,
            `동료 ${this.party?.length || 0}명`,
            `숙소 ${this.economyState?.lodgingTier || 'standard'}`
        ];

        let labyrinthInfo = '';
        if (this.position === "Labyrinth") {
            labyrinthInfo += `<div class="status-inline-card"><b>현재 좌표</b><span>L${this.currentLayer} (${this.x}, ${this.y})</span></div>`;
            labyrinthInfo += `<div class="status-inline-card"><b>허기 카운트</b><span>${(this.labyrinthSteps || 0)}/${this.hungerStepThreshold || 30}</span></div>`;
            const torchState = this.equippedTorch ? `장착 중(${this.equippedTorchItem || "횃불"})` : "미장착";
            const buffs = this.explorationBuffs || {};
            labyrinthInfo += `<div class="status-inline-card"><b>탐험 광원</b><span>${torchState} | 광휘 ${buffs.illumination || 0}턴</span></div>`;
            labyrinthInfo += `<div class="status-inline-card"><b>탐지 버프</b><span>탐색 ${buffs.reveal || 0}턴 | 추적 ${buffs.hunterSense || 0}턴</span></div>`;
            if (Number(this.currentLayer || 0) === 6) {
                const shipReady = this.shipUnlocked ? "선박 준비 완료" : "선박 없음";
                const sailorCount = Array.isArray(this.party)
                    ? this.party.filter(member => String(member?.trait || "").trim() === "항해사").length
                    : 0;
                labyrinthInfo += `<div class="status-inline-card"><b>해상 이동</b><span>${shipReady} | 항해사 ${sailorCount}명</span></div>`;
            }
            const scoutCount = Array.isArray(this.party)
                ? this.party.filter(member => String(member?.trait || "").trim() === "탐색꾼").length
                : 0;
            if (scoutCount > 0) {
                const tracker = this.rareDropTracker || {};
                const pityThreshold = Math.max(3, 8 - scoutCount);
                labyrinthInfo += `<div class="status-inline-card"><b>희귀 추적</b><span>${tracker.scoutNoRareKills || 0}/${pityThreshold} | 통찰 ${tracker.scoutInsight || 0}</span></div>`;
            }
            const cooldownEntries = Object.entries(this.mapManager?.explorationAbilityCooldowns || {})
                .filter(([, value]) => Number(value) > 0)
                .sort((a, b) => Number(b[1]) - Number(a[1]))
                .slice(0, 3);
            if (cooldownEntries.length > 0) {
                const summary = cooldownEntries.map(([key, value]) => {
                    const label = this.mapManager?.getExplorationAbilityLabel?.(key) || key;
                    return `${label} ${value}턴`;
                }).join(", ");
                labyrinthInfo += `<div class="status-inline-card"><b>이능 쿨다운</b><span>${summary}</span></div>`;
            }
            if (this.mapManager?.collapse?.active) {
                const c = this.mapManager.collapse;
                labyrinthInfo += `<div class="status-inline-card"><b>차원붕괴</b><span>${c.wave}/${c.maxWaves} | 왜곡 ${c.movesUntilShift}턴 | 장막 ${c.barrierRadius}</span></div>`;
            }
        } else {
            labyrinthInfo = `<div class="status-inline-card"><b>현재 위치</b><span>${this.position || '도시'}</span></div>`;
        }

        const equipSlots = ['투구', '갑옷', '장갑', '각반', '무기', '부무기', '목걸이', '반지', '팔찌', '귀걸이', '벨트', '부적', '토큰', '마도구', '가면'];
        const equipCards = equipSlots
            .map(slot => `<div class="status-mini-card"><b>${slot}</b><span>${this.equipment?.[slot] || '없음'}</span></div>`)
            .join('');

        const spellPreview = this.spells?.length > 0 ? this.spells.slice(0, 8).join(', ') : '없음';
        const essencePreview = this.essences?.length > 0 ? this.essences.map(key => `${key} 정수`).slice(0, 6).join(', ') : '없음';
        const skillPreview = this.essence_skills?.length > 0 ? this.essence_skills.slice(0, 8).join(', ') : '없음';
        const invPreview = this.inventory?.length > 0 ? this.inventory.slice(0, 8).join(', ') : '없음';
        const traitNodeCount = Object.values(this.traitRanks || {}).filter(v => Number(v) > 0).length;
        const traitSpent = Number(this.traitSpentPoints || 0);
        const factionState = (typeof this.factionSystem?.getState === 'function')
            ? this.factionSystem.getState()
            : (this.factionState || {});
        const reputationEntries = Object.entries(factionState.reputation || {})
            .filter(([, value]) => Number.isFinite(Number(value)))
            .map(([name, value]) => [name, Math.round(Number(value))]);
        const sortedReputation = reputationEntries.slice().sort((a, b) => Number(b[1]) - Number(a[1]));
        const formatRep = (entry) => entry ? `${entry[0]} ${entry[1] >= 0 ? '+' : ''}${entry[1]}` : '없음';
        const bestReputation = formatRep(sortedReputation[0]);
        const worstReputation = formatRep(sortedReputation[sortedReputation.length - 1]);
        const factionFlagLabels = {
            black_market_hidden_gate: '암시장 은닉 입구 개방',
            kingdom_chaser_active: '왕국군 추격자 활성'
        };
        const activeFactionFlags = Object.entries(factionState.flags || {})
            .filter(([, enabled]) => Boolean(enabled))
            .map(([flag]) => factionFlagLabels[flag] || flag);
        const factionFlagSummary = activeFactionFlags.length > 0
            ? activeFactionFlags.slice(0, 3).join(', ')
            : '없음';
        const ecoLayer = Number(this.currentLayer || 1);
        const ecoSnapshot = (this.position === "Labyrinth" && this.mapManager?.ecoSnapshot)
            ? this.mapManager.ecoSnapshot
            : this.livingWorld?.getLayerSnapshot?.(ecoLayer);
        const ecoSummary = ecoSnapshot
            ? `포식 ${Number(ecoSnapshot.predator || 0)} | 피식 ${Number(ecoSnapshot.prey || 0)} | 청소 ${Number(ecoSnapshot.scavenger || 0)}`
            : '기록 없음';
        const spawnBias = Number(this.mapManager?.ecoSnapshot?.spawnBias || 0);
        const spawnBiasText = Number.isFinite(spawnBias)
            ? `${spawnBias >= 0 ? '+' : ''}${(spawnBias * 100).toFixed(1)}%`
            : '0.0%';
        const corpseCountText = this.position === "Labyrinth"
            ? `${Array.isArray(this.mapManager?.corpses) ? this.mapManager.corpses.length : 0}구`
            : '0구';

        statusDiv.innerHTML = `
            <div class="status-chip-grid">
                ${statusChips.map(chip => `<span class="status-chip">${chip}</span>`).join('')}
            </div>

            <div class="status-inline-grid">
                <div class="status-inline-card"><b>보유 스톤</b><span>${this.gold.toLocaleString()}</span></div>
                <div class="status-inline-card"><b>은행 예금</b><span>${this.bankGold.toLocaleString()}</span></div>
                <div class="status-inline-card"><b>마석</b><span>${this.magic_stones.toLocaleString()} 개</span></div>
                <div class="status-inline-card"><b>마탑 공적</b><span>${Number(this.mageTowerState?.merit || 0)} (${this.mageTowerState?.rankName || '견습'})</span></div>
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
                    <div class="status-inline-card"><b>정수 (${this.essences.length}/${maxEssenceCapacity})</b><span>${essencePreview}</span></div>
                    <div class="status-inline-card"><b>정수 스킬</b><span>${skillPreview}</span></div>
                    <div class="status-inline-card"><b>특성 그래프</b><span>노드 ${traitNodeCount}개 활성 | 투자 ${traitSpent}pt</span></div>
                    <div class="status-inline-card"><b>인벤토리 (${this.inventory?.length || 0})</b><span>${invPreview}</span></div>
                </div>
            </div>

            <div class="status-section">
                <h4>세력 / 생태계</h4>
                <div class="status-inline-grid">
                    <div class="status-inline-card"><b>평판 최고</b><span>${bestReputation}</span></div>
                    <div class="status-inline-card"><b>평판 최저</b><span>${worstReputation}</span></div>
                    <div class="status-inline-card"><b>활성 세력 트리거</b><span>${factionFlagSummary}</span></div>
                    <div class="status-inline-card"><b>현재층 생태계</b><span>${ecoSummary}</span></div>
                    <div class="status-inline-card"><b>스폰 보정</b><span>${spawnBiasText}</span></div>
                    <div class="status-inline-card"><b>시체 잔존</b><span>${corpseCountText}</span></div>
                </div>
            </div>
        `;

        this.cb?.updateStatusBars(this);
    }
};
