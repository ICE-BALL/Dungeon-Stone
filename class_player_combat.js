// 파일: class_player_combat.js
// 역할: Player 클래스의 전투 관련 메서드 (턴 관리, 공격, 스킬 사용)
// [수정] (v8) startCombat: 몬스터 데이터 누락 시 예외 처리 추가 (전투 안정성 확보)

import { helpers } from './class_helpers.js';
import { inferFactionFromMonster } from './faction_system.js';

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
            monster.atk = monster.atk || 10;
            monster.def = monster.def || 5;
            monster.magic_def = monster.magic_def || 3;
            monster.grade = monster.grade || 9;
            monster.attacks = monster.attacks || [{name:"기본 공격", dmg: monster.atk, type: "physical"}];
            monster.debuffs = [];

            this.applyMonsterBalanceProfile?.(monster);
            monster.maxHp = monster.hp;
            
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
            monster.combatProfile = helpers.ensureCombatProfile(monster);
            
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
        this.beginCombatMetrics?.();

        this.cb?.logMessage?.(`!! ${validMonsters.map(m => `${m.name}(${m.grade}등급)`).join(', ')}와(과) 전투 시작 !!`);
        this.applyRivalCombatIntervention?.("start");
        this.cb?.playMusic?.('bgm-combat');
        this.cb?.updateCombatStatus?.(this);
        this.cb?.updateCombatMenu?.(this);
    },

    applyMonsterBalanceProfile(monster) {
        if (!monster) return;
        const statCfg = this.getStatBalanceConfig?.() || {};
        const monsterCfg = statCfg.monster || {};
        const grade = Number(monster.grade || 9);
        const global = Number(monsterCfg.globalMultiplier ?? 1);
        const gradeMult = Number(monsterCfg.gradeMultiplier?.[grade] ?? 1);
        const total = Math.max(0.1, global * gradeMult);

        monster.hp = Math.max(1, Math.floor(Number(monster.hp || 1) * total));
        monster.atk = Math.max(1, Math.floor(Number(monster.atk || 1) * total));
        monster.def = Math.max(0, Math.floor(Number(monster.def || 0) * total));
        monster.magic_def = Math.max(0, Math.floor(Number(monster.magic_def || 0) * total));

        if (Array.isArray(monster.attacks)) {
            monster.attacks = monster.attacks.map((atk) => {
                if (!atk || typeof atk !== "object") return atk;
                if (!Object.prototype.hasOwnProperty.call(atk, "dmg")) return atk;
                const scaled = Math.max(1, Math.floor(Number(atk.dmg || 0) * total));
                return { ...atk, dmg: scaled };
            });
        }
    },

    decrementDebuffDurations(debuffs = []) {
        const next = [];
        const expired = [];
        (debuffs || []).forEach((debuff) => {
            const m = String(debuff || "").match(/\((\d+)턴\)$/);
            if (!m) {
                next.push(debuff);
                return;
            }
            const turns = parseInt(m[1], 10);
            if (!Number.isFinite(turns) || turns <= 1) {
                expired.push(debuff);
                return;
            }
            next.push(String(debuff).replace(/\(\d+턴\)$/, `(${turns - 1}턴)`));
        });
        return { next, expired };
    },

    applyCombatDebuffEffects(target, options = {}) {
        if (!target) return { skipTurn: false };
        const isPlayer = Boolean(options.isPlayer);
        const targetName = options.targetName || target.name || (isPlayer ? "플레이어" : "대상");
        const debuffs = target.debuffs || [];
        let skipTurn = false;
        let skipByControl = false;
        let skipByFear = false;

        const controlDebuffs = debuffs.filter((d) => /(기절|석화|수면|빙결|속박|혼절)/.test(String(d)));
        if (controlDebuffs.length > 0) {
            skipTurn = true;
            skipByControl = true;
        }
        if (debuffs.some((d) => String(d).startsWith("공포")) && Math.random() < 0.5) {
            skipTurn = true;
            skipByFear = true;
        }

        let poisonDmg = 0;
        let bleedDmg = 0;
        let burnDmg = 0;
        let shockDmg = 0;
        let shockMpLoss = 0;

        debuffs.forEach((d) => {
            const text = String(d || "");
            if (text.includes("파멸의 각인")) {
                const doom = Math.max(1, Math.floor((target.maxHp || 100) * 0.01));
                helpers.safeHpUpdate(target, -doom, { isSkillHit: true });
                this.cb?.logMessage?.(`[파멸의 각인] ${targetName}에게 ${doom} 피해`);
            }
            if (text.startsWith("독(")) {
                if (text.includes("최상급")) poisonDmg += 50;
                else if (text.includes("강")) poisonDmg += 20;
                else if (text.includes("중")) poisonDmg += 10;
                else if (text.includes("약")) poisonDmg += 5;
                else {
                    const m = text.match(/독\((\d+)\)/);
                    poisonDmg += m ? Math.max(1, parseInt(m[1], 10)) : 5;
                }
            }
            if (text.startsWith("출혈(")) {
                const m = text.match(/출혈\((\d+)\)/);
                bleedDmg += m ? Math.max(1, parseInt(m[1], 10)) : 8;
            }
            if (text.startsWith("화상(")) {
                const m = text.match(/화상\((\d+)\)/);
                burnDmg += m ? Math.max(1, parseInt(m[1], 10)) : 10;
            }
            if (text.startsWith("감전(")) {
                const m = text.match(/감전\((\d+)\)/);
                const val = m ? Math.max(1, parseInt(m[1], 10)) : 6;
                shockDmg += val;
                shockMpLoss += Math.max(1, Math.floor(val / 2));
            }
            if (text.includes("초재생")) {
                const healAmount = 1000;
                helpers.safeHpUpdate(target, healAmount);
                this.cb?.logMessage?.(`[초재생] ${targetName} 체력 +${healAmount}`);
            }
        });

        if (isPlayer && this.debuffs?.includes("악취(디버프)")) poisonDmg *= 2;
        if (isPlayer && this.debuffs?.includes("치명적 중독(8배)")) poisonDmg *= 8;

        const totalDot = poisonDmg + bleedDmg + burnDmg + shockDmg;
        if (totalDot > 0) {
            helpers.safeHpUpdate(target, -totalDot, { isSkillHit: true });
            const chunks = [];
            if (poisonDmg > 0) chunks.push(`독 ${poisonDmg}`);
            if (bleedDmg > 0) chunks.push(`출혈 ${bleedDmg}`);
            if (burnDmg > 0) chunks.push(`화상 ${burnDmg}`);
            if (shockDmg > 0) chunks.push(`감전 ${shockDmg}`);
            this.cb?.logMessage?.(`[지속 피해] ${targetName} ${chunks.join(", ")} (총 ${totalDot})`);
        }

        if (shockMpLoss > 0) {
            if (typeof target.mp === "number") target.mp = Math.max(0, target.mp - shockMpLoss);
            if (typeof target.stamina === "number") target.stamina = Math.max(0, target.stamina - shockMpLoss);
        }

        const { next, expired } = this.decrementDebuffDurations(debuffs);
        target.debuffs = next;
        return { skipTurn, skipByControl, skipByFear, controlDebuffs, expired };
    },

    applyAttackStatusEffects(attack, target) {
        if (!attack || !target || typeof target.applyDebuff !== "function") return;

        const atkType = String(attack.type || "physical").toLowerCase();
        const atkName = String(attack.name || "");
        const dot = Math.max(1, Number(attack.dot || 0));
        const magicRes = Number(target.currentStats?.["항마력"] || 0);
        const mentalRes = Number(target.currentStats?.["정신력"] || 0);
        const resist = Math.min(0.45, (magicRes + mentalRes) / 1200);
        const rollDebuff = (chance, debuffName) => {
            const finalChance = Math.max(0.05, Math.min(0.9, chance));
            if (Math.random() < finalChance) target.applyDebuff(debuffName);
        };

        if (attack.effect === "fear") {
            rollDebuff(0.3 - (resist * 0.5), "공포(1턴)");
        }

        if (attack.dot) {
            if (atkType === "poison") {
                rollDebuff(0.48 - (resist * 0.35), `독(${dot})(2턴)`);
            } else {
                rollDebuff(0.36 - (resist * 0.25), `출혈(${dot})(2턴)`);
            }
        }

        if (atkType === "physical" && /(베기|할퀴|손톱|절삭|가르기)/.test(atkName)) {
            rollDebuff(0.28 - (resist * 0.2), "출혈(8)(2턴)");
        }
        if (atkType === "fire") {
            rollDebuff(0.38 - (resist * 0.2), `화상(${Math.max(10, dot)})(2턴)`);
        }
        if (atkType === "lightning") {
            rollDebuff(0.35 - (resist * 0.2), `감전(${Math.max(8, dot)})(2턴)`);
        }
        if (atkType === "ice") {
            rollDebuff(0.22 - (resist * 0.25), "빙결(1턴)");
        }
        if (atkType === "earth") {
            rollDebuff(0.18 - (resist * 0.2), "속박(1턴)");
        }
        if (atkType === "dark" || atkName.includes("저주")) {
            rollDebuff(0.2 - (resist * 0.2), "파멸의 각인(3턴)");
        }
    },

    inferDamageTypeFromText(skillName = "", skillDesc = "") {
        const text = `${String(skillName || "")} ${String(skillDesc || "")}`.toLowerCase();
        if (/화염|불꽃|용암|열기|ignite|fire/.test(text)) return "fire";
        if (/냉기|빙결|서리|얼음|freeze|ice/.test(text)) return "ice";
        if (/번개|뇌전|감전|storm|lightning|thunder/.test(text)) return "lightning";
        if (/독|맹독|중독|venom|poison/.test(text)) return "poison";
        if (/신성|축복|성광|holy|sacred/.test(text)) return "holy";
        if (/어둠|암흑|저주|심연|dark|shadow/.test(text)) return "dark";
        if (/대지|바위|지진|earth|stone/.test(text)) return "earth";
        if (/바람|질풍|풍압|wind/.test(text)) return "wind";
        if (/마력|비전|arcane/.test(text)) return "arcane";
        return "physical";
    },


    handleMonsterDefeat(monster, source = "player") {
        this.cb?.logMessage?.(`${monster.name}을(를) 처치했다!`);
        if (source === "player") {
            this.recordCombatMetric?.("kills", 1);
        }
        
        this.questManager?.checkProgress?.('KILL', monster.name, 1);
        const monsterFaction = String(monster?.faction || inferFactionFromMonster(monster?.name || ""));
        const witnessFactions = this.mapManager?.getNearbyNpcFactions?.(6) || [];
        this.factionSystem?.applyKillConsequences?.({
            killedFaction: monsterFaction,
            witnesses: witnessFactions
        });

        const gradeNum = typeof monster.grade === 'number' ? monster.grade : 9;
        const expGained = Math.max(0, (10 - gradeNum) * 10 + 5);
        const isFirstKill = Boolean(this.gainExp(expGained, monster.name));

        const traitDerived = this.traitBonuses?.derived || {};
        let magicStoneAmount = Math.max(1, (10 - gradeNum) * (Math.floor(Math.random() * 5) + 1));
        const extraStoneRate = Math.max(0, Number(traitDerived.controlPower || 0));
        if (extraStoneRate > 0) {
            magicStoneAmount = Math.max(1, Math.floor(magicStoneAmount * (1 + extraStoneRate)));
        }
        this.magic_stones += magicStoneAmount;

        if (this.essences?.includes("소울이터")) {
            const mpHeal = Math.floor(this.maxMp * 0.10);
            this.mp = Math.min(this.maxMp, this.mp + mpHeal);
            this.cb?.logMessage?.(`[패시브: 영혼 갈취]! ${monster.name} 처치! MP를 ${mpHeal} 회복합니다!`);
        }

        const scoutCount = Array.isArray(this.party)
            ? this.party.filter(member => String(member?.trait || "").trim() === "탐색꾼").length
            : 0;
        this.rareDropTracker = this.rareDropTracker || {
            scoutNoRareKills: 0,
            scoutInsight: 0,
            lastRareSource: ""
        };
        const tracker = this.rareDropTracker;
        const scoutInsight = Math.max(0, Number(tracker.scoutInsight || 0));
        const pityThreshold = Math.max(3, 8 - scoutCount);
        const forceRareDrop = scoutCount > 0 && Number(tracker.scoutNoRareKills || 0) >= pityThreshold;

        let droppedEssence = null;
        let droppedEssenceDisplayName = "";
        const droppedItems = [];
        const extraRewardParts = [];
        let rareDropHappened = false;

        const numbersItemsList = Object.keys(this.gameData.numbersItems || {});
        const isRiftGuardianKill = (() => {
            if (this.position !== "Rift" || !this.currentRift) return false;
            const currentStageIndex = Number.isInteger(this.pendingRiftStageIndex)
                ? this.pendingRiftStageIndex
                : Math.max(0, Number(this.currentRiftStage || 1) - 1);
            const currentStage = this.currentRift?.stages?.[currentStageIndex];
            const bossName = String(currentStage?.boss || "").trim();
            const monsterName = String(monster?.name || "").trim();
            const stageHasGuardianTag = /수호자|guardian/i.test(`${currentStage?.name || ""} ${bossName}`);
            const byExactBoss = Boolean(bossName && monsterName && bossName === monsterName);
            const byGuardianName = /(균열\s*수호자|차원\s*수호자|rift\s*guardian)/i.test(monsterName);
            return Boolean((byExactBoss && stageHasGuardianTag) || byGuardianName);
        })();

        this.mageTowerProgress = this.mageTowerProgress || {
            killsTotal: 0,
            killsByGrade: {},
            riftGuardianKills: 0
        };
        this.mageTowerProgress.killsTotal = Math.max(0, Number(this.mageTowerProgress.killsTotal || 0) + 1);
        this.mageTowerProgress.killsByGrade = this.mageTowerProgress.killsByGrade || {};
        this.mageTowerProgress.killsByGrade[gradeNum] = Math.max(
            0,
            Number(this.mageTowerProgress.killsByGrade[gradeNum] || 0) + 1
        );
        if (isRiftGuardianKill) {
            this.mageTowerProgress.riftGuardianKills = Math.max(
                0,
                Number(this.mageTowerProgress.riftGuardianKills || 0) + 1
            );
        }

        const getRiftGuardianEssencePool = () => {
            const pool = [];
            const stageIndex = Number.isInteger(this.pendingRiftStageIndex)
                ? this.pendingRiftStageIndex
                : Math.max(0, Number(this.currentRiftStage || 1) - 1);
            const stage = this.currentRift?.stages?.[stageIndex];
            const stageMonsters = [];
            if (Array.isArray(stage?.monsters)) stageMonsters.push(...stage.monsters);
            if (stage?.boss) stageMonsters.push(stage.boss);

            stageMonsters.forEach((name) => {
                const essences = this.gameData?.monsters?.[name]?.essences || [];
                essences.forEach((essenceName) => {
                    if (this.gameData?.essences?.[essenceName]) pool.push(essenceName);
                });
            });

            if (Array.isArray(monster?.essences)) {
                monster.essences.forEach((essenceName) => {
                    if (this.gameData?.essences?.[essenceName]) pool.push(essenceName);
                });
            }

            if (pool.length === 0) {
                ["균열 정박자", "심층 정찰자", "루멘 와처", "장막 파쇄자"].forEach((essenceName) => {
                    if (this.gameData?.essences?.[essenceName]) pool.push(essenceName);
                });
            }
            return [...new Set(pool)];
        };

        const grantEssence = (essenceKey, forced = false) => {
            if (!essenceKey || !this.gameData.essences?.[essenceKey]) return false;
            droppedEssence = essenceKey;
            droppedEssenceDisplayName = `${essenceKey} 정수`;
            rareDropHappened = true;
            this.isWaitingForEssenceChoice = true;
            if (forced) {
                this.cb?.logMessage?.("[탐색꾼-추적] 추적 데이터가 완성되어 희귀 정수를 강제로 포착했습니다!");
            }
            this.cb?.logMessage?.(`[${droppedEssenceDisplayName}]을(를) 획득했습니다! 누구에게 주시겠습니까?`);
            this.cb?.showEssencePartyChoice?.(this, essenceKey, droppedEssenceDisplayName);
            return true;
        };

        if (monster.essences?.length > 0) {
            let dropChance = 0.05 + ((10 - gradeNum) * 0.01) + ((this.currentStats["행운"] || 0) / 1000); 
            if (this.inventory?.includes("초심자의 행운") && isFirstKill) {
                dropChance += 0.05; 
                this.cb?.logMessage?.("[패시브: 초심자의 행운] 정수 드랍률 +5% 적용!");
            }
            dropChance += Math.max(0, Number(traitDerived.essenceDropRate || 0));
            if (scoutCount > 0) {
                const scoutEssenceBonus = Math.min(0.14, (scoutCount * 0.025) + (scoutInsight * 0.005));
                dropChance += scoutEssenceBonus;
            }
            dropChance = Math.min(1.0, Math.max(0, dropChance));

            if (Math.random() < dropChance) {
                const essenceKey = monster.essences[Math.floor(Math.random() * monster.essences.length)];
                grantEssence(essenceKey, false);
            }
        }

        let baseItemDropChance = 0.1 + Math.max(0, Number(traitDerived.itemDropRate || 0));
        if (scoutCount > 0) {
            baseItemDropChance += Math.min(0.1, scoutCount * 0.02);
        }
        if (monster.drops?.length > 0 && Math.random() < Math.min(1, baseItemDropChance)) {
             const item = monster.drops[Math.floor(Math.random() * monster.drops.length)];
             if (item) {
                 droppedItems.push(item);
                 this.addItem(item);
             }
        }

        let numberDropChance = 0.05 + Math.max(0, Number(traitDerived.numberDropRate || 0));
        if (scoutCount > 0) {
            numberDropChance += Math.min(0.08, (scoutCount * 0.015) + (scoutInsight * 0.004));
        }
        if (gradeNum <= 2 && numbersItemsList.length > 0 && Math.random() < Math.min(1, numberDropChance)) {
            const item = numbersItemsList[Math.floor(Math.random() * numbersItemsList.length)];
            if (item) {
                droppedItems.push(item);
                this.addItem(item);
                rareDropHappened = true;
            }
        }

        if (isRiftGuardianKill) {
            this.cb?.logMessage?.("[균열 수호자] 핵 반응이 폭주합니다. 추가 전리품 판정을 진행합니다.");

            if (!droppedEssence && Math.random() < 0.33) {
                const guardianEssencePool = getRiftGuardianEssencePool();
                if (guardianEssencePool.length > 0) {
                    const pickedEssence = guardianEssencePool[Math.floor(Math.random() * guardianEssencePool.length)];
                    grantEssence(pickedEssence, false);
                    this.cb?.logMessage?.("[균열 수호자] 정수 잔향이 응집되었습니다! (보스 전용 33% 판정)");
                }
            }

            const guardianNumberChance = Math.min(1, 0.18 + Math.max(0, Number(traitDerived.numberDropRate || 0)));
            if (numbersItemsList.length > 0 && Math.random() < guardianNumberChance) {
                const pickedNumber = numbersItemsList[Math.floor(Math.random() * numbersItemsList.length)];
                if (pickedNumber) {
                    droppedItems.push(pickedNumber);
                    this.addItem(pickedNumber);
                    rareDropHappened = true;
                    this.cb?.logMessage?.(`[균열 수호자] 차원 파편이 [${pickedNumber}] 넘버스로 응축되었습니다.`);
                }
            }
        }

        if (forceRareDrop && !rareDropHappened) {
            if (monster.essences?.length > 0) {
                const forceEssence = monster.essences[Math.floor(Math.random() * monster.essences.length)];
                grantEssence(forceEssence, true);
            } else if (numbersItemsList.length > 0 && gradeNum <= 4) {
                const forceItem = numbersItemsList[Math.floor(Math.random() * numbersItemsList.length)];
                if (forceItem) {
                    droppedItems.push(forceItem);
                    this.addItem(forceItem);
                    rareDropHappened = true;
                    this.cb?.logMessage?.("[탐색꾼-추적] 추적 데이터가 완성되어 넘버스 아이템을 포착했습니다!");
                }
            }
        }

        if (scoutCount > 0) {
            if (rareDropHappened || droppedEssence) {
                tracker.scoutNoRareKills = 0;
                tracker.scoutInsight = Math.max(0, scoutInsight - 2);
                tracker.lastRareSource = monster.name;
                this.cb?.logMessage?.("[탐색꾼-추적] 희귀 반응 포착 완료. 추적 게이지를 재정비합니다.");
            } else {
                tracker.scoutNoRareKills = Math.min(999, Number(tracker.scoutNoRareKills || 0) + 1);
                tracker.scoutInsight = Math.min(12, scoutInsight + 1);
                const remain = Math.max(0, pityThreshold - tracker.scoutNoRareKills);
                this.cb?.logMessage?.(`[탐색꾼-추적] 희귀 단서 ${tracker.scoutNoRareKills}/${pityThreshold} (강제 추적까지 ${remain}회)`);
            }
        }

        if (monster?.isRivalExplorer && monster?.rivalLoot && typeof monster.rivalLoot === "object") {
            const rivalLoot = monster.rivalLoot;
            const rivalName = String(monster?.rivalPartyName || monster?.name || "탐험가");
            const goldGain = Math.max(0, Number(rivalLoot.gold || 0));
            const stoneGain = Math.max(0, Number(rivalLoot.magicStones || 0));
            const lootItems = Array.isArray(rivalLoot.items) ? rivalLoot.items.filter(Boolean) : [];
            const lootEquipments = Array.isArray(rivalLoot.equipment) ? rivalLoot.equipment.filter(Boolean) : [];
            const pending = (this.pendingRivalLoot && typeof this.pendingRivalLoot === "object")
                ? this.pendingRivalLoot
                : null;
            if (pending && !pending.collected) {
                pending.gold = Math.max(0, Number(pending.gold || 0) + goldGain);
                pending.magicStones = Math.max(0, Number(pending.magicStones || 0) + stoneGain);
                pending.items = [...(Array.isArray(pending.items) ? pending.items : []), ...lootItems];
                pending.equipment = [...(Array.isArray(pending.equipment) ? pending.equipment : []), ...lootEquipments];
                pending.sourceNames = [...new Set([...(Array.isArray(pending.sourceNames) ? pending.sourceNames : []), rivalName])];
                pending.createdAt = Date.now();
                this.pendingRivalLoot = pending;
            } else {
                this.pendingRivalLoot = {
                    sourceNames: [rivalName],
                    gold: goldGain,
                    magicStones: stoneGain,
                    items: [...lootItems],
                    equipment: [...lootEquipments],
                    collected: false,
                    createdAt: Date.now()
                };
            }

            const totalLootCount = lootItems.length + lootEquipments.length;
            this.cb?.logMessage?.(`[탐험가 루팅] ${rivalName} 제압. 루팅 화면이 생성되었습니다. (전리품 ${totalLootCount}개)`);
            this.cb?.logMessage?.("[탐험가 루팅] 탐험 화면에서 [L] 키를 눌러 전리품을 회수하세요.");
            extraRewardParts.push("탐험가 루팅 대기");
        }

        const rewardParts = [`마석 ${magicStoneAmount}개`];
        if (droppedEssence) rewardParts.push(`${droppedEssenceDisplayName} (획득)`);
        if (droppedItems.length > 0) rewardParts.push(...droppedItems);
        if (extraRewardParts.length > 0) rewardParts.push(...extraRewardParts);
        this.cb?.logMessage?.(`${monster.name} 처치 보상: ${rewardParts.join(", ")}`);

        if (this.mapManager && this.position === "Labyrinth") {
            this.mapManager.registerCorpse?.(monster, this.x, this.y);
            this.cb?.spawnExplorationHitVfx?.(this.x, this.y);
        }
        
        this.showStatus(); 
    },


    endCombat(victory) {
        if (victory && this.isWaitingForEssenceChoice) return;
        if (this._combatEndPending) return;
        if (!this.inCombat && this.hp > 0) return;

        const defeatedMonsters = Array.isArray(this.currentMonster)
            ? this.currentMonster.filter((m) => m && Number(m.hp || 0) <= 0 && !m.rivalClaimed)
            : [];
        const allyDeathCount = Array.isArray(this.party)
            ? this.party.filter((member) => member && Number(member.hp || 0) <= 0).length
            : 0;
        if (allyDeathCount > 0) {
            this.recordCombatMetric?.("allyDeaths", allyDeathCount);
        }

        const wasInCombat = this.inCombat;
        this.inCombat = false;
        this.playerTurn = false;
        this.criticalHitBoost = false;

        const finalizeAfterCombat = ({ butcheryProcessed = false } = {}) => {
            if (victory && this.position === "Rift" && this.currentRift) {
                if (this.mapManager?.currentMap?.isRiftMap) {
                    const clearedStage = Number.isInteger(this.pendingRiftStageIndex) ? this.pendingRiftStageIndex : null;
                    this.pendingRiftStageIndex = null;
                    if (clearedStage !== null) {
                        this.mapManager.markRiftStageCleared(clearedStage, { fromCombat: true });
                    }
                    this.cb?.playMusic?.('bgm-dungeon');
                    this.cb?.updateMenu?.(this);
                    this.showStatus();
                    this.combatMetrics = null;
                    return;
                }

                this.currentRiftStage++;
                if (this.currentRiftStage >= this.currentRift.stages.length) {
                    this.cb?.logMessage?.(`[${this.currentRift.name}] 균열 정복! 수호자를 처치했습니다.`);
                    this.addItem("균열석");
                    if (this.currentLayer === 8 || this.currentLayer === "8") {
                        this.cb?.logMessage?.("9층으로 향하는 포탈과 8층으로 돌아가는 포탈이 열렸습니다.");
                        this.currentRift = null;
                        this.currentRiftStage = 0;
                        this.cb?.showPortalChoice?.(this, 9, 8);
                        this.combatMetrics = null;
                        return;
                    }

                    this.cb?.logMessage?.("도시로 귀환합니다.");
                    this.position = "라비기온 (7-13구역)";
                    this.currentRift = null;
                    this.currentRiftStage = 0;

                    this.cb?.playMusic?.('bgm-city');
                    this.cb?.updateMenu?.(this);
                    this.showStatus();
                    this.combatMetrics = null;
                    return;
                }

                this.cb?.logMessage?.(`균열 ${this.currentRift.stages[this.currentRiftStage - 1].name} 단계를 클리어했습니다. 다음 탐사를 준비하십시오.`);
                this.cb?.playMusic?.('bgm-dungeon');
                this.cb?.updateMenu?.(this);
                this.showStatus();
                this.combatMetrics = null;
                return;
            }

            if (this.hp <= 0) {
                this.cb?.logMessage?.("패배... 모든 것을 잃고 게임을 처음부터 다시 시작합니다.");
                this.cb?.stopMusic?.();
                setTimeout(() => location.reload(), 3000);
                this.combatMetrics = null;
                return;
            }

            if (victory) {
                this.finalizeCombatReputationOnVictory?.();
                if (butcheryProcessed && Number(this.combatMetrics?.allyDeaths || 0) > 0) {
                    this.addBehaviorReputation?.("파렴치한", 1, "동료 사망 직후 해체 우선");
                }
            }

            if (wasInCombat) {
                if (victory) this.cb?.logMessage?.("승리!");
                else this.cb?.logMessage?.("성공적으로 도망쳤다!");

                if (this.position === "Labyrinth") this.cb?.playMusic?.('bgm-dungeon');
                else this.cb?.playMusic?.('bgm-city');
            }

            this.currentMonster = null;
            if (this.mapManager) {
                this.mapManager.updateVisibility?.();
                this.cb?.updateExplorationUI?.(this.mapManager);
            }
            this.cb?.updateMenu?.(this);
            this.showStatus();
            this.combatMetrics = null;
        };

        if (victory && defeatedMonsters.length > 0 && this.position !== "Rift") {
            this._combatEndPending = true;
            this._combatButcheryActions = 0;
            import('./ui_combat.js')
                .then((module) => {
                    const showButcheryScreen = module?.showButcheryScreen;
                    if (typeof showButcheryScreen !== "function") {
                        this._combatEndPending = false;
                        finalizeAfterCombat({ butcheryProcessed: false });
                        return;
                    }
                    showButcheryScreen(this, defeatedMonsters, {
                        onComplete: ({ processedCount = 0 } = {}) => {
                            this._combatEndPending = false;
                            this._combatButcheryActions = Math.max(0, Number(processedCount || 0));
                            finalizeAfterCombat({ butcheryProcessed: this._combatButcheryActions > 0 });
                        }
                    });
                })
                .catch((error) => {
                    console.error("Butchery modal load failed:", error);
                    this._combatEndPending = false;
                    finalizeAfterCombat({ butcheryProcessed: false });
                });
            return;
        }

        finalizeAfterCombat({ butcheryProcessed: false });
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
        const hasEquipped = (itemName) => Boolean(this.hasEquippedItem?.(itemName));
        const auraTrainingLevel = Math.max(0, Number(this.auraTrainingLevel || 0));
        
        let baseDamage = this.currentStats["근력"] || 10;
        let extraPenetration = 0;
        if (auraTrainingLevel > 0) {
            baseDamage *= (1 + Math.min(0.24, auraTrainingLevel * 0.025));
        }
        
        if (this.aura_active) {
            const targetDefense = target.currentStats?.['물리 내성'] || 0;
            const penetrationRate = Math.min(1.35, 0.9 + (auraTrainingLevel * 0.05));
            extraPenetration = targetDefense * penetrationRate;
            if (auraTrainingLevel > 0) {
                baseDamage *= (1 + Math.min(0.2, auraTrainingLevel * 0.02));
            }
            this.aura_active = false;
            this.cb?.logMessage?.(`오러의 힘으로 방어력을 ${Math.round(penetrationRate * 100)}% 무시합니다!`);
        }

        // 명중/회피 판정 (다양한 스탯 활용)
        const hitCfg = this.getCombatBalanceConfig?.()?.hitChance || {};
        let accuracy = Number(hitCfg.base ?? 0.72)
            + ((this.currentStats["명중률"] || 0) / Math.max(1, Number(hitCfg.hitRateDivisor || 250)))
            + ((this.currentStats["시각"] || 0) / Math.max(1, Number(hitCfg.eyesightDivisor || 600)))
            + ((this.currentStats["인지력"] || 0) / Math.max(1, Number(hitCfg.perceptionDivisor || 1200)));
        if (hasEquipped("브라이엇의 사냥활")) accuracy += 0.08;
        const targetEvasion = ((target.currentStats?.["민첩성"] || 0) / Math.max(1, Number(hitCfg.targetDexDivisor || 500)))
            + ((target.currentStats?.["시야"] || 0) / Math.max(1, Number(hitCfg.targetVisionDivisor || 1200)));
        const hitChance = Math.max(Number(hitCfg.min ?? 0.2), Math.min(Number(hitCfg.max ?? 0.98), accuracy - targetEvasion));
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
        if (hasEquipped("공성 살육자")) {
            baseDamage *= 1.35;
        }
        if (hasEquipped("파쇄의 철퇴") && /(둔기|몽둥이|철퇴)/.test(weaponName)) {
            baseDamage *= 1.28;
        }
        if (hasEquipped("브라이엇의 사냥활") && weaponName.includes("활")) {
            baseDamage *= 1.18;
        }

        let playerAttackType = "physical";
        if (hasEquipped("변환의 장검") && /(검|소드|장검)/.test(weaponName) && Math.random() < 0.35) {
            playerAttackType = "arcane";
        } else if (hasEquipped("라크자르의 화염각")) {
            playerAttackType = "fire";
        }

        const damageResult = helpers.calculateAdvancedDamage({
            attacker: this,
            defender: target,
            baseDamage,
            damageType: playerAttackType,
            extraPenetration
        });
        let dmg = damageResult.finalDamage;
        dmg *= fatiguePenalty;
        if (damageResult.weaknessHit) {
            this.cb?.logMessage?.(`[약점 타격] ${target.name}의 ${helpers.getDamageTypeLabel(playerAttackType)} 약점을 찔렀습니다.`);
        }
        if (damageResult.resistanceHit) {
            this.cb?.logMessage?.(`[내성 저항] ${target.name}이 ${helpers.getDamageTypeLabel(playerAttackType)} 저항으로 피해를 경감했습니다.`);
        }

        let critChance = this.critChance; 
        if (this.criticalHitBoost) {
            critChance += 0.5; 
            this.cb?.logMessage?.("급소 공격! 치명타 확률이 증가합니다!");
        }
        if (hasEquipped("브라이엇의 사냥활")) critChance += 0.08;
        if (hasEquipped("그림자 토큰")) critChance += 0.05;
        const raceCombatCfg = this.getCombatBalanceConfig?.()?.raceModifiers || {};
        const dragonkinCombat = raceCombatCfg.dragonkin || {};
        if (this.isRace?.("dragonkin") && Math.random() < Number(dragonkinCombat.bonusCritProcChance || 0.2)) {
            critChance += Number(dragonkinCombat.bonusCritChanceOnAttack || 0.2);
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
        if (hasEquipped("독사의 송곳니")) {
            dmg *= 1.12;
        }
        if (hasEquipped("화염 관통장")) {
            dmg += Math.max(2, Math.floor((this.currentStats["근력"] || 10) * 0.12));
        }
        if (hasEquipped("홍염 공진기") && playerAttackType === "fire") {
            dmg *= 1.22;
        }
        dmg = Math.floor(dmg);

        helpers.safeHpUpdate(target, -dmg, { isSkillHit: false });

        if (hasEquipped("쌍왕 클로") && weaponName.includes("클로") && target.hp > 0 && Math.random() < 0.26) {
            const bonusHit = Math.max(1, Math.floor(dmg * 0.42));
            helpers.safeHpUpdate(target, -bonusHit, { isSkillHit: true });
            dmg += bonusHit;
            this.cb?.logMessage?.(`[쌍왕 클로] 연속 타격! 추가 피해 ${bonusHit}`);
        }

        if (this.isRace?.("dragonkin") && Math.random() < Number(dragonkinCombat.fearProcChance || 0.16)) {
            helpers.safeApplyDebuff(target, "공포(1턴)");
            this.cb?.logMessage?.("[용언의 울림] 적이 공포에 질렸습니다!");
        }

        if (isCritical) {
            this.cb?.logMessage?.(`치명타!`, 'log-critical-hit');
            this.cb?.showScreenEffect?.('shake');
        }
        
        this.cb?.logMessage?.(`플레이어의 공격! ${target.name}에게 ${dmg}의 피해. (몬스터 HP: ${target.hp})`);

        if (this.essences?.includes("고블린")) { 
            if (Math.random() < 0.1) helpers.safeApplyDebuff(target, "둔화(마비독)(1턴)");
        }
        if (this.essences?.includes("고블린 궁수")) { 
            if (this.equipment["무기"]?.includes("활")) { 
                 helpers.safeApplyDebuff(target, "독(약)(2턴)");
            }
        }
        if (hasEquipped("독사의 송곳니")) {
            helpers.safeApplyDebuff(target, "독(중)(2턴)");
        }
        if (this.essences?.includes("뱀파이어")) {
            const healAmount = Math.floor(dmg * 0.10);
            helpers.safeHpUpdate(this, healAmount);
            this.cb?.logMessage?.(`[패시브: 흡혈]! ${healAmount}의 HP를 흡수했습니다.`);
        }

        if (target.hp <= 0) {
            this.handleMonsterDefeat(target, "player");
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
        
        // [Phase 3] 종족 시스템을 통한 마법 사용 체크
        if (this.raceSystem && !this.raceSystem.canUseMagic()) {
            const result = this.raceSystem.tryUseMagic(spellName);
            this.cb?.logMessage?.(result.message);
            return;
        }
        
        const spellCost = spell.mp_cost || 0;
        if (this.mp < spellCost) {
            this.cb?.logMessage?.("MP가 부족하여 마법을 사용할 수 없다.");
            return;
        }

        const satietyFailChance = Number(this.getSatietySkillFailChance?.() || 0);
        if (satietyFailChance > 0 && Math.random() < satietyFailChance) {
            const failCost = Math.max(1, Math.floor(spellCost * 0.6));
            this.mp = Math.max(0, this.mp - failCost);
            this.cb?.logMessage?.(`허기로 주문 영창이 붕괴했습니다. (${Math.round(satietyFailChance * 100)}% 실패 구간, MP ${failCost} 소모)`);
            this.showStatus();
            this.endTurn();
            return;
        }

        // 종족별 제약 (하위호환성 유지)
        const spellDesc = (spell.desc || "");
        const spellRuleCfg = this.getCombatBalanceConfig?.()?.spellRules || {};
        const holyKeyword = String(spellRuleCfg.holyKeyword || "신성");
        const barbarianCombat = this.getCombatBalanceConfig?.()?.raceModifiers?.barbarian || {};
        const holyBlocked = Boolean(barbarianCombat.holySpellBlocked);
        if (holyBlocked && this.isRace?.("barbarian") && (spellName.includes(holyKeyword) || spellDesc.includes(holyKeyword))) {
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
                     const spellDamage = Number(spell.dmg || 0) + (this.currentStats['정신력'] || 10);
                     const damageType = this.inferDamageTypeFromText(spellName, spellDesc);
                     const damageResult = helpers.calculateAdvancedDamage({
                         attacker: this,
                         defender: t,
                         baseDamage: spellDamage,
                         damageType
                     });
                     const finalDamage = damageResult.finalDamage;
                     helpers.safeHpUpdate(t, -finalDamage, { isSkillHit: true });
                     const dmgLabel = helpers.getDamageTypeLabel(damageResult.damageType);
                     this.cb?.logMessage?.(`주문 ${spellName}(으)로 ${t.name}에게 ${finalDamage}의 ${dmgLabel} 피해! (몬스터 HP: ${t.hp})`);
                     if (damageResult.weaknessHit) {
                         this.cb?.logMessage?.(`[약점 노출] ${t.name}의 ${dmgLabel} 약점을 공략했습니다.`);
                     }
                     if (damageResult.resistanceHit) {
                         this.cb?.logMessage?.(`[속성 저항] ${t.name}이(가) ${dmgLabel} 내성으로 피해를 줄였습니다.`);
                     }
                 });
             }

             targets.forEach(t => {
                 if (t.hp <= 0 && t !== this && !this.party.includes(t)) {
                     this.handleMonsterDefeat(t, "player");
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

        const satietyFailChance = Number(this.getSatietySkillFailChance?.() || 0);
        if (satietyFailChance > 0 && Math.random() < satietyFailChance) {
            const failCost = Math.max(1, Math.floor(skillCost * 0.6));
            this.mp = Math.max(0, this.mp - failCost);
            this.cb?.logMessage?.(`허기로 정수 스킬이 발동에 실패했습니다. (MP ${failCost} 소모)`);
            this.showStatus();
            this.endTurn();
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
            const beforeSnapshot = targets.map((entity) => ({
                entity,
                hp: Number(entity?.hp || 0),
                mp: Number(entity?.mp || 0),
                debuffCount: Array.isArray(entity?.debuffs) ? entity.debuffs.length : 0
            }));
            if (targetIndex === -1) effectFunction(this, targets);
            else if (targetIndex === -2) effectFunction(this, this);
            else if (targetIndex === -3) effectFunction(this, targets);
            else if (targetIndex >= 100) effectFunction(this, target);
            else effectFunction(this, target);

            const changedByEffect = beforeSnapshot.some((snap) => {
                const currentHp = Number(snap.entity?.hp || 0);
                const currentMp = Number(snap.entity?.mp || 0);
                const currentDebuffs = Array.isArray(snap.entity?.debuffs) ? snap.entity.debuffs.length : 0;
                return currentHp !== snap.hp || currentMp !== snap.mp || currentDebuffs !== snap.debuffCount;
            });

            const skillText = `${skillName} ${essenceData?.desc || ""}`;
            const needsFallback = !changedByEffect && /미구현|not implemented|구현 필요|placeholder/i.test(skillText);
            if (needsFallback) {
                const fallbackPower = Math.max(12, Math.floor((this.currentStats?.["정신력"] || 12) * 1.35));
                if (/치유|회복|재생|정화/.test(skillText)) {
                    const allies = [this, ...(this.party || [])].filter((member) => member && Number(member.hp || 0) > 0);
                    const healTargets = targetIndex === -3
                        ? allies
                        : (targetIndex >= 100 && target ? [target] : (targetIndex === -2 ? [this] : [this]));
                    healTargets.forEach((member) => {
                        const healAmount = Math.max(8, Math.floor(fallbackPower * 0.8));
                        helpers.safeHpUpdate(member, healAmount);
                    });
                    this.cb?.logMessage?.(`[자동 보정] ${skillName}의 미구현 효과를 치유 보정으로 대체했습니다.`);
                } else if (/강화|버프|증폭|각성|방어/.test(skillText)) {
                    this.applyDebuff?.("정수 공명(2턴)");
                    const mpGain = Math.max(6, Math.floor(fallbackPower * 0.4));
                    this.mp = Math.min(this.maxMp, this.mp + mpGain);
                    this.cb?.logMessage?.(`[자동 보정] ${skillName}의 미구현 효과를 공명 버프로 대체했습니다. (MP +${mpGain})`);
                } else {
                    const offensiveTargets = (targetIndex === -1)
                        ? this.currentMonster.filter((monster) => monster && Number(monster.hp || 0) > 0)
                        : ((targetIndex >= 0 && target) ? [target] : this.currentMonster.filter((monster) => monster && Number(monster.hp || 0) > 0).slice(0, 1));
                    const damageType = this.inferDamageTypeFromText(skillName, essenceData?.desc || "");
                    offensiveTargets.forEach((enemy) => {
                        const result = helpers.calculateAdvancedDamage({
                            attacker: this,
                            defender: enemy,
                            baseDamage: fallbackPower,
                            damageType
                        });
                        helpers.safeHpUpdate(enemy, -Math.max(1, Number(result.finalDamage || 1)), { isSkillHit: true });
                    });
                    this.cb?.logMessage?.(`[자동 보정] ${skillName}의 미구현 효과를 공격 보정으로 대체했습니다.`);
                }
            }

             targets.forEach(t => {
                 if (t.hp <= 0 && t !== this && !this.party.includes(t)) {
                     this.handleMonsterDefeat(t, "player");
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
            this.recordCombatMetric?.("ranAway", 1);
            this.addBehaviorReputation?.("겁쟁이", 1, "전투 도주");
            this.endCombat(false);
        } else {
            this.cb?.logMessage?.("도망에 실패했다.");
            this.endTurn();
        }
    },

    applyRivalCombatIntervention(phase = "turn") {
        if (!this.inCombat || !Array.isArray(this.currentMonster) || !this.mapManager) return null;
        const living = this.currentMonster.filter((monster) => monster && Number(monster.hp || 0) > 0);
        if (living.length === 0) return null;

        const intervention = this.mapManager.getRivalCombatIntervention?.(living.length);
        if (!intervention) return null;

        if (intervention.type === "assist") {
            const heal = Math.max(1, Number(intervention.heal || 0));
            this.hp = Math.min(this.maxHp, Number(this.hp || 0) + heal);
            this.cb?.logMessage?.(`[경쟁자 개입] ${intervention.rivalName}이(가) 지나가며 지원했습니다. (HP +${heal})`);
            this.cb?.updateCombatStatus?.(this);
            this.showStatus?.();
            return intervention;
        }

        if (intervention.type === "killsteal") {
            const target = living
                .slice()
                .sort((a, b) => Number(a.hp || 0) - Number(b.hp || 0))[0];
            if (!target) return null;
            target.hp = 0;
            target.rivalClaimed = true;
            this.cb?.logMessage?.(`[경쟁자 개입] ${intervention.rivalName}이(가) ${target.name}에게 막타를 넣어 보상을 챙겼습니다.`);
            this.cb?.updateCombatStatus?.(this);
            const allDefeated = this.currentMonster?.every((monster) => !monster || Number(monster.hp || 0) <= 0);
            if (allDefeated) {
                this.endCombat(true);
            }
            return intervention;
        }

        return null;
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

            const debuffResult = this.applyCombatDebuffEffects(monster, {
                isPlayer: false,
                targetName: monster.name
            });

            if (monster.hp <= 0) {
                this.handleMonsterDefeat(monster, "player");
                this.cb?.updateCombatStatus?.(this);
                if (this.isWaitingForEssenceChoice) return;
                return;
            }

            if (debuffResult.skipTurn) {
                if (debuffResult.skipByControl) {
                    const controls = (debuffResult.controlDebuffs || []).join(', ');
                    this.cb?.logMessage?.(`${monster.name}은(는) [${controls}] 효과로 행동할 수 없다!`);
                } else if (debuffResult.skipByFear) {
                    this.cb?.logMessage?.(`${monster.name}은(는) 공포에 질려 아무것도 하지 못했다!`);
                } else {
                    this.cb?.logMessage?.(`${monster.name}은(는) 디버프 효과로 행동할 수 없다!`);
                }
                return;
            }


            const potentialTargets = [this, ...this.party].filter(p => p && p.hp > 0);
            if (potentialTargets.length === 0) return;
            
            const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
            if (!target) return;

            const attackOptions = monster.attacks || [{name:"기본 공격", dmg: monster.atk, type: "physical"}];
            const atk = attackOptions[Math.floor(Math.random() * attackOptions.length)];
            
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

            const attackType = helpers.normalizeDamageType(
                atk.type || this.inferDamageTypeFromText(atk.name, atk.desc || "")
            );
            const rawAtkDamage = Number(atk.dmg || monster.atk || 10);
            let defenderForCalc = target;
            if (
                isTargetPlayer &&
                attackType === "physical" &&
                this.essences?.includes("오우거") &&
                (atk.name.includes("베기") || atk.name.includes("할퀴기") || atk.name.includes("손톱") || atk.name.includes("절삭"))
            ) {
                const boostedDefense = (target.currentStats?.["물리 내성"] || 5) * 2;
                defenderForCalc = {
                    ...target,
                    currentStats: {
                        ...(target.currentStats || {}),
                        "물리 내성": boostedDefense
                    }
                };
                this.cb?.logMessage?.("[패시브: 무쇠가죽]이 베기 계열 피해에 대한 견고함을 끌어올립니다.");
            }

            const damageResult = helpers.calculateAdvancedDamage({
                attacker: monster,
                defender: defenderForCalc,
                baseDamage: rawAtkDamage,
                damageType: attackType
            });
            let dmg = Number(damageResult.finalDamage || 1);

            if (isTargetPlayer && attackType === "physical") {
                if (this.essences?.includes("레이스") || this.essences?.includes("영혼의 거신병") || this.essences?.includes("벤시 퀸")) {
                    dmg *= 0.5;
                    this.cb?.logMessage?.("[패시브: 영체]로 받는 물리 피해가 50% 감소합니다!");
                }
                if (this.essences?.includes("슬라임")) {
                    dmg *= 0.9;
                }
            }

            if (isTargetPlayer) {
                const hasEquipped = (itemName) => Boolean(this.hasEquippedItem?.(itemName));
                if (hasEquipped("수호자의 팔목 보호대")) dmg *= 0.95;
                if (hasEquipped("아이기스의 용갑")) dmg *= 0.82;
                if (hasEquipped("심해 구명 내갑")) dmg *= 0.9;
                if (hasEquipped("수호자의 두 번째 방패") && attackType === "physical") dmg *= 0.88;
                if (hasEquipped("수호병단의 징표") && attackType === "physical" && String(this.equipment?.["부무기"] || "").includes("방패")) {
                    dmg *= 0.5;
                }
                if (hasEquipped("극지 방패") && attackType === "ice") dmg *= 0.65;
                if (hasEquipped("용암 방패") && attackType === "fire") {
                    dmg *= 0.7;
                    const mpGain = Math.max(4, Math.floor(Math.max(1, dmg) * 0.35));
                    this.mp = Math.min(this.maxMp, this.mp + mpGain);
                    this.cb?.logMessage?.(`[용암 방패] 화염을 흡수해 MP +${mpGain}`);
                }
            }

            dmg = Math.max(1, Math.floor(dmg));
             const isSkill = (atk.name !== "기본 공격");
             helpers.safeHpUpdate(target, -dmg, { isSkillHit: isSkill });
             const targetName = isTargetPlayer ? '플레이어' : target.name;

             this.cb?.showScreenEffect?.('shake');
             this.cb?.logMessage?.(`[${atk.name}]!`, 'log-skill-monster');
             if (damageResult.weaknessHit) {
                 this.cb?.logMessage?.(`[약점 타격] ${targetName}의 ${helpers.getDamageTypeLabel(attackType)} 약점을 공략했습니다.`);
             }
             if (damageResult.resistanceHit) {
                 this.cb?.logMessage?.(`[내성 저항] ${targetName}이(가) ${helpers.getDamageTypeLabel(attackType)} 내성으로 피해를 경감했습니다.`);
             }
             
             this.cb?.logMessage?.(`${monster.name}의 '${atk.name}' 공격! ${targetName}에게 ${dmg}의 피해. (${targetName} HP: ${target.hp})`);
             this.cb?.updateCombatStatus?.(this);

             if (isTargetPlayer) {
                  this.recordCombatMetric?.("damageTaken", dmg);
                  const shouldInjure = dmg >= Math.max(8, Math.floor(this.maxHp * 0.18));
                  if (shouldInjure || Math.random() < 0.08) {
                      this.applyCombatInjury?.({ damage: dmg, source: `${monster.name}:${atk.name}` });
                  }
                  const hasMentalWard = Boolean(this.hasEquippedItem?.("블랙 앤 화이트 화관"));
                  if (hasMentalWard && (attackType === "dark" || /저주|공포|정신|혼란/.test(String(atk.name || "")))) {
                      this.cb?.logMessage?.("[블랙 앤 화이트 화관] 정신계 상태이상을 차단했습니다.");
                  } else {
                      this.applyAttackStatusEffects({ ...atk, type: attackType }, target);
                  }
              }

            if (target.hp <= 0) {
                 if (isTargetPlayer) {
                     this.cb?.logMessage?.("플레이어가 쓰러졌다!");
                     this.endCombat(false);
                     return;
                 } else {
                     this.recordCombatMetric?.("allyDeaths", 1);
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
                 this.handleMonsterDefeat(targetMonster, "party");
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

         const debuffResult = this.applyCombatDebuffEffects(this, {
            isPlayer: true,
            targetName: "플레이어"
         });

         if (debuffResult.skipTurn) {
             if (debuffResult.skipByControl) {
                 const controls = (debuffResult.controlDebuffs || []).join(', ');
                 this.cb?.logMessage?.(`[${controls}] 효과로 행동할 수 없다!`);
             } else if (debuffResult.skipByFear) {
                 this.cb?.logMessage?.("공포에 질려 아무것도 할 수 없다!");
             } else {
                 this.cb?.logMessage?.("디버프 효과로 행동할 수 없다!");
             }
         }

         if (this.hp <= 0) {
             if (this.inCombat) this.endCombat(false);
             return;
         }

         // 턴 시작 회복(스탯 기반)
         const regenCfg = this.getCombatBalanceConfig?.()?.turnStartRegen || {};
         const staminaRegen = Math.max(1, Math.floor((this.currentStats["지구력"] || 10) / Math.max(1, Number(regenCfg.staminaDivisor || 12))));
         this.stamina = Math.min(this.maxStamina, this.stamina + staminaRegen);
         const hpRegen = Math.max(0, Math.floor((this.currentStats["자연 재생력"] || 0) / Math.max(1, Number(regenCfg.hpDivisor || 25))));
         if (hpRegen > 0) helpers.safeHpUpdate(this, hpRegen);
         const mpRegen = Math.max(0, Math.floor((this.currentStats["영혼 재생력"] || 0) / Math.max(1, Number(regenCfg.mpDivisor || 20))));
         if (mpRegen > 0) this.mp = Math.min(this.maxMp, this.mp + mpRegen);
         const raceTurnRegen = Number(this.getRaceBalanceProfile?.(this.race)?.turnStart?.mpRegenFlat || 0);
         if (raceTurnRegen > 0) this.mp = Math.min(this.maxMp, this.mp + raceTurnRegen);

         if (debuffResult.skipTurn) {
             this.endTurn();
             return;
         }

         this.applyRivalCombatIntervention?.("turn");
         if (!this.inCombat) return;

         const headSkipChance = Number(this.getHeadInjurySkipChance?.() || 0);
         if (headSkipChance > 0 && Math.random() < headSkipChance) {
             this.cb?.logMessage?.(`[부상] 머리 부상 여파로 멍해져 행동 기회를 놓쳤습니다. (${Math.round(headSkipChance * 100)}%)`);
             this.endTurn();
             return;
         }

         if (typeof this.processCompanionPanic === 'function') {
             const runaway = this.processCompanionPanic("전투 압박");
             if (runaway) {
                 this.cb?.updateCombatStatus?.(this);
             }
         }

         this.playerTurn = true;
         this.evasionBonus = 0;
         this.cb?.updateCombatStatus?.(this);
         this.cb?.updateCombatMenu?.(this);
     }
};
