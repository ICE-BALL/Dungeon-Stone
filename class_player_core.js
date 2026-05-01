// 파일: class_player_core.js
// 역할: Player 클래스 정의, 생성자, 핵심 데이터 관리 (스탯, 아이템, 정수)
// [수정] (v4) 2D 맵 탐험을 위한 좌표(x, y) 및 맵 ID 속성 추가
// [복원] calculateStats 내의 방대한 패시브 로직 완전 복구

import { helpers } from './class_helpers.js';
import { buildTraitGraph, evaluateTraitBonuses } from './trait_graph_system.js';
import { buildSkillGraph, evaluateSkillBonuses } from './skill_synthesis_system.js';

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0)));
}

export class Player {
    constructor(callbacks) {
        this.cb = callbacks; 
        this.gameData = callbacks?.gameData || {}; 
        
        this.questManager = callbacks && callbacks.QuestManagerClass 
            ? new callbacks.QuestManagerClass(this, this.gameData) 
            : null;

        this.race = null;
        
        // [Phase 3] 종족 리소스 시스템
        this.resources = {
            hp: { name: 'HP', current: 100, max: 100, locked: false },
            mp: { name: 'MP', current: 100, max: 100, locked: false },
            stamina: { name: '기력', current: 100, max: 100, locked: false }
        };
        
        this.stats = {}; 
        const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
        statsList.forEach(stat => this.stats[stat.name] = 0);
        
        this.specialStats = this.gameData.specialStats 
            ? JSON.parse(JSON.stringify(this.gameData.specialStats)) 
            : {};

        this.traitPoints = 6;
        this.traitGraph = { nodes: [], nodesById: {}, edges: [], width: 1800, height: 1000, branchLabels: [] };
        this.traitRanks = {};
        this.traitBonuses = { stats: {}, derived: {} };
        this.traitSpentPoints = 0;

        this.skillPoints = 4;
        this.skillGraph = { nodes: [], nodesById: {}, edges: [], width: 1800, height: 1000, branchLabels: [] };
        this.skillRanks = {};
        this.skillBonuses = { derived: {}, components: {} };
        this.skillSpentPoints = 0;
        this.craftedSkills = [];
        this.skillCraftedSignatures = {};

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
        this.equipment = {
            투구: null,
            갑옷: null,
            장갑: null,
            각반: null,
            무기: null,
            부무기: null,
            목걸이: null,
            반지: null,
            팔찌: null,
            귀걸이: null,
            벨트: null,
            부적: null,
            토큰: null,
            마도구: null,
            가면: null
        };
        this.enhancementLevels = {};
        this.auraTrainingLevel = 0;
        this.corpseDeceiverCharges = 0;
        this.secondHeartReady = false;
        
        this.satiety = 100;
        this.labyrinthSteps = 0; // 미궁 이동 누적(30칸당 포만감 1 감소)
        this.hungerStepThreshold = 30;
        this.hungerWarningShown = false;
        this.fatigue = 0;
        this.betrayalChance = 0.002; 
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
        this.pendingRiftStageIndex = null;
        this.currentRiftProgressKey = null;
        this.pendingRivalLoot = null;
        this.riftProgress = {};
        this.originDistrict = "";
        this.homeDistrict = "";
        this.raceStory = null;
        this.homestead = null;
        
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
        this.equippedTorch = false;
        this.equippedTorchItem = null;
        this.shipUnlocked = false;
        this.seaIntroShown = false;
        this.explorationBuffs = {
            illumination: 0,
            reveal: 0,
            hunterSense: 0
        };
        this.hiddenFieldHints = {};
        this.npcAffinity = {};
        this.npcAffinityLog = {};
        this.npcAffinityActionState = {};
        this.npcSocialState = {
            memories: {},
            questState: {},
            questCounter: 0,
            rumorIndex: {}
        };
        this.cityActionTick = 0;
        this.mageTowerState = {
            merit: 0,
            questState: {},
            rankName: "견습 마도사"
        };
        this.mageTowerProgress = {
            killsTotal: 0,
            killsByGrade: {},
            riftGuardianKills: 0
        };
        this.deceptionShieldUntil = 0;
        this.factionState = {
            reputation: {},
            matrix: null,
            flags: {},
            log: []
        };
        this.factionSystem = null;
        this.livingWorld = null;
        this.rareDropTracker = {
            scoutNoRareKills: 0,
            scoutInsight: 0,
            lastRareSource: ""
        };
        this.worldTimeHours = 0;
        this.timeSystemEnabled = false;
        this.economyState = {
            year: 1,
            day: 1,
            month: 1,
            hoursInDay: 24,
            daysPerMonth: 25,
            monthsPerYear: 13,
            halfYearMonths: 6,
            nextHalfYearDueInMonths: 6,
            taxDebt: 0,
            delinquency: 0,
            lodgingTier: "standard",
            recoveryPenaltyDays: 0,
            upkeepLedger: []
        };
        this.itemIdentity = {
            identified: {},
            mystery: {},
            cursedSlots: {},
            blessedSlots: {}
        };
        this.butcherySkill = 0;
        this.injuryState = {
            leg: null,
            arm: null,
            head: null,
            torso: null,
            scarCount: 0
        };
        this.reputationProfile = {
            coward: 0,
            busDriver: 0,
            shameless: 0,
            labels: []
        };
        this.combatMetrics = null;

        this.initializeTraitSystem(true);
        this.refreshTraitBonuses();
        this.initializeSkillSystem(true);
        this.refreshSkillBonuses();
    }

    normalizeRaceId(raceId) {
        const raw = String(raceId || "").trim();
        if (!raw) return "";
        const key = raw.toLowerCase();
        const aliases = {
            human: "human",
            elf: "fairy",
            fairy: "fairy",
            dwarf: "dwarf",
            barbarian: "barbarian",
            beastman: "beastkin",
            beastkin: "beastkin",
            dragonkin: "dragonkin",
            인간: "human",
            엘프: "fairy",
            요정: "fairy",
            드워프: "dwarf",
            바바리안: "barbarian",
            수인: "beastkin",
            용인족: "dragonkin"
        };
        return aliases[key] || key;
    }

    getLegacyRaceKey(raceId = this.race) {
        const canonical = this.normalizeRaceId(raceId);
        const map = {
            human: "Human",
            fairy: "Fairy",
            dwarf: "Dwarf",
            barbarian: "Barbarian",
            beastkin: "Beastman",
            dragonkin: "Dragonkin"
        };
        return map[canonical] || String(raceId || "");
    }

    isRace(raceId) {
        return this.normalizeRaceId(this.race) === this.normalizeRaceId(raceId);
    }

    getBalanceConfig() {
        const raw = this.gameData?.balanceConfig;
        return (raw && typeof raw === "object") ? raw : {};
    }

    getStatBalanceConfig() {
        return this.getBalanceConfig().stats || {};
    }

    getCombatBalanceConfig() {
        return this.getBalanceConfig().combat || {};
    }

    getRaceBalanceProfile(raceId = this.race) {
        const canonical = this.normalizeRaceId(raceId);
        return this.getStatBalanceConfig()?.racePassives?.[canonical] || {};
    }

    getItemStatScale(itemData = {}, slot = "") {
        const cfg = this.getStatBalanceConfig()?.item || {};
        const global = Number(cfg.globalMultiplier ?? 1);
        const tier = Number(itemData?.tier || 0);
        const tierMult = Number(cfg.tierMultiplier?.[tier] ?? 1);
        const slotMult = Number(cfg.slotMultiplier?.[slot] ?? 1);
        return Math.max(0, global * tierMult * slotMult);
    }

    getEssenceStatScale(essenceData = {}, essenceName = "") {
        const cfg = this.getStatBalanceConfig()?.essence || {};
        const global = Number(cfg.globalMultiplier ?? 1);
        const grade = Number(essenceData?.grade || essenceData?.tier || 0);
        const gradeMult = Number(cfg.gradeMultiplier?.[grade] ?? 1);
        const namedMult = Number(cfg.namedMultiplier?.[essenceName] ?? 1);
        return Math.max(0, global * gradeMult * namedMult);
    }

    evaluateBalanceCondition(condition = null, context = {}) {
        if (!condition || typeof condition !== "object") return true;

        if (Object.prototype.hasOwnProperty.call(condition, "inCombat")) {
            if (Boolean(context.inCombat) !== Boolean(condition.inCombat)) return false;
        }
        if (Number.isFinite(Number(condition.layerEquals))) {
            if (Number(context.layer) !== Number(condition.layerEquals)) return false;
        }
        if (Number.isFinite(Number(condition.hpRateLte))) {
            if (Number(context.hpRate || 0) > Number(condition.hpRateLte)) return false;
        }
        if (condition.essenceEquals) {
            const candidates = Array.isArray(condition.essenceEquals)
                ? condition.essenceEquals.map((v) => String(v))
                : [String(condition.essenceEquals)];
            if (!candidates.includes(String(context.essenceName || ""))) return false;
        }
        return true;
    }

    applyStatMap(targetStats, statMap = {}) {
        if (!targetStats || !statMap || typeof statMap !== "object") return;
        Object.entries(statMap).forEach(([stat, value]) => {
            const delta = Number(value || 0);
            if (!Number.isFinite(delta) || delta === 0) return;
            targetStats[stat] = (targetStats[stat] || 0) + delta;
        });
    }

    applyStatOperations(targetStats, operations = [], context = {}, statsList = []) {
        if (!targetStats || !Array.isArray(operations)) return;
        operations.forEach((op) => {
            if (!op || typeof op !== "object") return;
            if (!this.evaluateBalanceCondition(op.condition, context)) return;

            const type = String(op.type || "");
            const stat = String(op.stat || "");
            const value = Number(op.value || 0);

            if (type === "allAdd") {
                statsList.forEach((entry) => {
                    const statName = String(entry?.name || "");
                    if (!statName) return;
                    targetStats[statName] = (targetStats[statName] || 0) + value;
                });
                return;
            }
            if (type === "allMul") {
                statsList.forEach((entry) => {
                    const statName = String(entry?.name || "");
                    if (!statName) return;
                    targetStats[statName] = (targetStats[statName] || 0) * value;
                });
                return;
            }

            if (!stat) return;

            if (type === "add") {
                targetStats[stat] = (targetStats[stat] || 0) + value;
            } else if (type === "mul") {
                targetStats[stat] = (targetStats[stat] || 0) * value;
            } else if (type === "set") {
                targetStats[stat] = value;
            }
        });
    }

    applyEssencePassiveStatRule(targetStats, passiveName = "", essenceName = "", statsList = []) {
        const rules = this.getBalanceConfig()?.essencePassiveRules || {};
        const operations = rules[passiveName];
        if (!Array.isArray(operations) || operations.length === 0) return;

        const hpRate = Number(this.hp || 0) / Math.max(1, Number(this.maxHp || 1));
        this.applyStatOperations(
            targetStats,
            operations,
            {
                inCombat: Boolean(this.inCombat),
                layer: Number(this.currentLayer || 0),
                hpRate,
                essenceName: String(essenceName || "")
            },
            statsList
        );
    }

    applyRacePassiveStatBonuses(targetStats, statsList = []) {
        const profile = this.getRaceBalanceProfile(this.race);
        if (!profile || typeof profile !== "object") return;

        const allStatsAdd = Number(profile.allStatsAdd || 0);
        if (allStatsAdd !== 0) {
            statsList.forEach((entry) => {
                const statName = String(entry?.name || "");
                if (!statName) return;
                targetStats[statName] = (targetStats[statName] || 0) + allStatsAdd;
            });
        }

        this.applyStatMap(targetStats, profile.add || {});

        if (Array.isArray(profile.conditional)) {
            const hpRate = Number(this.hp || 0) / Math.max(1, Number(this.maxHp || 1));
            profile.conditional.forEach((entry) => {
                if (!entry || typeof entry !== "object") return;
                if (!this.evaluateBalanceCondition(entry.condition, { hpRate })) return;
                this.applyStatMap(targetStats, entry.add || {});
            });
        }
    }

    autoAcceptRaceQuests() {
        if (!this.questManager || !this.gameData?.quests) return;
        const raceId = this.normalizeRaceId(this.race);
        const questEntries = Object.values(this.gameData.quests || {});
        questEntries
            .filter((quest) => {
                if (!quest || quest.type !== "RACE") return false;
                if (!quest.autoAcceptOnRaceSelect) return false;
                const requiredRace = this.normalizeRaceId(quest?.startCondition?.race);
                return requiredRace && requiredRace === raceId;
            })
            .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")))
            .forEach((quest) => this.questManager.acceptQuest(quest.id));
    }

    initializeTraitSystem(force = false) {
        const statsList = Array.isArray(this.gameData?.statsList) ? this.gameData.statsList : [];
        if (!force && Array.isArray(this.traitGraph?.nodes) && this.traitGraph.nodes.length > 0) return;

        this.traitGraph = buildTraitGraph(statsList);
        this.traitRanks = this.traitRanks || {};
        this.traitGraph.nodes.forEach((node) => {
            if (node.autoUnlock) this.traitRanks[node.id] = Math.max(1, Number(this.traitRanks[node.id] || 0));
        });
        this.recalculateTraitSpentPoints();
    }

    recalculateTraitSpentPoints() {
        if (!this.traitGraph?.nodes) {
            this.traitSpentPoints = 0;
            return;
        }
        let spent = 0;
        this.traitGraph.nodes.forEach((node) => {
            const rank = Number(this.traitRanks?.[node.id] || 0);
            if (rank <= 0) return;
            for (let i = 0; i < rank; i++) {
                spent += this.getTraitNodeCost(node.id, i);
            }
        });
        this.traitSpentPoints = spent;
    }

    getTraitNode(nodeId) {
        this.initializeTraitSystem();
        return this.traitGraph?.nodesById?.[nodeId] || null;
    }

    getTraitNodeRank(nodeId) {
        return Math.max(0, Number(this.traitRanks?.[nodeId] || 0));
    }

    getTraitNodeCost(nodeId, rankBeforePurchase = null) {
        const node = this.getTraitNode(nodeId);
        if (!node) return 0;
        const rankBase = Number.isInteger(rankBeforePurchase) ? rankBeforePurchase : this.getTraitNodeRank(nodeId);
        return Math.max(0, Math.floor((node.cost || 0) + ((node.costStep || 0) * rankBase)));
    }

    hasTraitRequirements(node) {
        if (!node) return false;
        const requirements = Array.isArray(node.requires) ? node.requires : [];
        return requirements.every((req) => this.getTraitNodeRank(req.id) >= (req.rank || 1));
    }

    canPurchaseTraitNode(nodeId) {
        const node = this.getTraitNode(nodeId);
        if (!node) return { ok: false, reason: "존재하지 않는 노드입니다.", node: null, cost: 0 };
        if (node.autoUnlock) return { ok: false, reason: "기본 노드는 자동 활성화됩니다.", node, cost: 0 };

        const rank = this.getTraitNodeRank(nodeId);
        if (rank >= (node.maxRank || 1)) {
            return { ok: false, reason: "이미 최대 랭크입니다.", node, cost: 0 };
        }
        if ((this.level || 1) < (node.unlockLevel || 1)) {
            return { ok: false, reason: `레벨 ${node.unlockLevel}부터 투자할 수 있습니다.`, node, cost: 0 };
        }
        if (!this.hasTraitRequirements(node)) {
            return { ok: false, reason: "선행 노드가 부족합니다.", node, cost: 0 };
        }
        const cost = this.getTraitNodeCost(nodeId, rank);
        if ((this.traitPoints || 0) < cost) {
            return { ok: false, reason: "특성 포인트가 부족합니다.", node, cost };
        }
        return { ok: true, reason: "", node, cost };
    }

    gainTraitPoints(amount = 0, reason = "") {
        if (!Number.isFinite(amount) || amount === 0) return;
        this.traitPoints = Math.max(0, Number(this.traitPoints || 0) + Math.trunc(amount));
        if (reason) this.cb?.logMessage?.(`[특성] ${reason}: 포인트 ${amount > 0 ? "+" : ""}${Math.trunc(amount)} (현재 ${this.traitPoints})`);
    }

    purchaseTraitNode(nodeId) {
        const verdict = this.canPurchaseTraitNode(nodeId);
        if (!verdict.ok) {
            if (verdict.reason) this.cb?.logMessage?.(`[특성] ${verdict.reason}`);
            return false;
        }

        const rank = this.getTraitNodeRank(nodeId);
        const cost = verdict.cost;
        this.traitPoints = Math.max(0, this.traitPoints - cost);
        this.traitRanks[nodeId] = rank + 1;
        this.recalculateTraitSpentPoints();
        this.refreshTraitBonuses();
        this.calculateStats();
        this.showStatus?.();

        const nodeName = verdict.node?.name || nodeId;
        this.cb?.logMessage?.(`[특성] ${nodeName} 투자 완료 (랭크 ${rank + 1}/${verdict.node.maxRank}, -${cost}pt)`);
        return true;
    }

    refreshTraitBonuses() {
        this.initializeTraitSystem();
        this.traitBonuses = evaluateTraitBonuses(this.traitGraph, this.traitRanks || {});
        if (!this.traitBonuses?.derived) this.traitBonuses = { ...this.traitBonuses, derived: {} };
    }

    getTraitGraphPayload() {
        this.initializeTraitSystem();
        this.refreshTraitBonuses();
        this.recalculateTraitSpentPoints();

        const nodes = (this.traitGraph.nodes || []).map((node) => {
            const rank = this.getTraitNodeRank(node.id);
            const nextCost = rank < (node.maxRank || 1) ? this.getTraitNodeCost(node.id, rank) : 0;
            const can = this.canPurchaseTraitNode(node.id);
            return {
                ...node,
                rank,
                nextCost,
                canPurchase: Boolean(can.ok),
                blockedReason: can.reason || ""
            };
        });

        return {
            points: Number(this.traitPoints || 0),
            spent: Number(this.traitSpentPoints || 0),
            nodes,
            edges: this.traitGraph.edges || [],
            width: this.traitGraph.width || 1800,
            height: this.traitGraph.height || 1000,
            branchLabels: this.traitGraph.branchLabels || []
        };
    }

    initializeSkillSystem(force = false) {
        if (!force && Array.isArray(this.skillGraph?.nodes) && this.skillGraph.nodes.length > 0) return;
        const spellPool = [
            ...Object.keys(this.gameData?.magic || {}),
            ...Object.keys(this.gameData?.items || {})
        ];
        this.skillGraph = buildSkillGraph(spellPool);
        this.skillRanks = this.skillRanks || {};
        this.skillGraph.nodes.forEach((node) => {
            if (node.autoUnlock) this.skillRanks[node.id] = Math.max(1, Number(this.skillRanks[node.id] || 0));
        });
        this.recalculateSkillSpentPoints();
    }

    recalculateSkillSpentPoints() {
        if (!this.skillGraph?.nodes) {
            this.skillSpentPoints = 0;
            return;
        }
        let spent = 0;
        this.skillGraph.nodes.forEach((node) => {
            const rank = Number(this.skillRanks?.[node.id] || 0);
            if (rank <= 0) return;
            for (let i = 0; i < rank; i++) {
                spent += this.getSkillNodeCost(node.id, i);
            }
        });
        this.skillSpentPoints = spent;
    }

    getSkillNode(nodeId) {
        this.initializeSkillSystem();
        return this.skillGraph?.nodesById?.[nodeId] || null;
    }

    getSkillNodeRank(nodeId) {
        return Math.max(0, Number(this.skillRanks?.[nodeId] || 0));
    }

    getSkillNodeCost(nodeId, rankBeforePurchase = null) {
        const node = this.getSkillNode(nodeId);
        if (!node) return 0;
        const rankBase = Number.isInteger(rankBeforePurchase) ? rankBeforePurchase : this.getSkillNodeRank(nodeId);
        return Math.max(0, Math.floor((node.cost || 0) + ((node.costStep || 0) * rankBase)));
    }

    hasSkillRequirements(node) {
        if (!node) return false;
        const requirements = Array.isArray(node.requires) ? node.requires : [];
        return requirements.every((req) => this.getSkillNodeRank(req.id) >= (req.rank || 1));
    }

    canPurchaseSkillNode(nodeId) {
        const node = this.getSkillNode(nodeId);
        if (!node) return { ok: false, reason: "존재하지 않는 스킬 노드입니다.", node: null, cost: 0 };
        if (node.autoUnlock) return { ok: false, reason: "기본 노드는 자동 활성화됩니다.", node, cost: 0 };

        const rank = this.getSkillNodeRank(nodeId);
        if (rank >= (node.maxRank || 1)) {
            return { ok: false, reason: "이미 최대 랭크입니다.", node, cost: 0 };
        }
        if ((this.level || 1) < (node.unlockLevel || 1)) {
            return { ok: false, reason: `레벨 ${node.unlockLevel}부터 투자할 수 있습니다.`, node, cost: 0 };
        }
        if (!this.hasSkillRequirements(node)) {
            return { ok: false, reason: "선행 노드가 부족합니다.", node, cost: 0 };
        }
        const cost = this.getSkillNodeCost(nodeId, rank);
        if ((this.skillPoints || 0) < cost) {
            return { ok: false, reason: "스킬 포인트가 부족합니다.", node, cost };
        }
        return { ok: true, reason: "", node, cost };
    }

    gainSkillPoints(amount = 0, reason = "") {
        if (!Number.isFinite(amount) || amount === 0) return;
        this.skillPoints = Math.max(0, Number(this.skillPoints || 0) + Math.trunc(amount));
        if (reason) this.cb?.logMessage?.(`[스킬 특성] ${reason}: 포인트 ${amount > 0 ? "+" : ""}${Math.trunc(amount)} (현재 ${this.skillPoints})`);
    }

    purchaseSkillNode(nodeId) {
        const verdict = this.canPurchaseSkillNode(nodeId);
        if (!verdict.ok) {
            if (verdict.reason) this.cb?.logMessage?.(`[스킬 특성] ${verdict.reason}`);
            return false;
        }

        const rank = this.getSkillNodeRank(nodeId);
        const cost = verdict.cost;
        this.skillPoints = Math.max(0, this.skillPoints - cost);
        this.skillRanks[nodeId] = rank + 1;
        this.recalculateSkillSpentPoints();
        this.refreshSkillBonuses();
        this.showStatus?.();

        const nodeName = verdict.node?.name || nodeId;
        this.cb?.logMessage?.(`[스킬 특성] ${nodeName} 투자 완료 (랭크 ${rank + 1}/${verdict.node.maxRank}, -${cost}pt)`);
        return true;
    }

    refreshSkillBonuses() {
        this.initializeSkillSystem();
        this.skillBonuses = evaluateSkillBonuses(this.skillGraph, this.skillRanks || {});
        if (!this.skillBonuses?.derived) this.skillBonuses = { ...this.skillBonuses, derived: {} };
    }

    getSkillGraphPayload() {
        this.initializeSkillSystem();
        this.refreshSkillBonuses();
        this.recalculateSkillSpentPoints();

        const nodes = (this.skillGraph.nodes || []).map((node) => {
            const rank = this.getSkillNodeRank(node.id);
            const nextCost = rank < (node.maxRank || 1) ? this.getSkillNodeCost(node.id, rank) : 0;
            const can = this.canPurchaseSkillNode(node.id);
            return {
                ...node,
                rank,
                nextCost,
                canPurchase: Boolean(can.ok),
                blockedReason: can.reason || ""
            };
        });

        return {
            points: Number(this.skillPoints || 0),
            spent: Number(this.skillSpentPoints || 0),
            nodes,
            edges: this.skillGraph.edges || [],
            width: this.skillGraph.width || 1800,
            height: this.skillGraph.height || 1000,
            branchLabels: this.skillGraph.branchLabels || [],
            craftedSkills: Array.isArray(this.craftedSkills) ? this.craftedSkills.slice(-8) : []
        };
    }

    ensureStorySkillDefinition(skillName, data = {}) {
        if (!skillName) return;
        this.gameData.magic = this.gameData.magic || {};
        if (this.gameData.magic[skillName]) return;
        this.gameData.magic[skillName] = {
            grade: Number(data.grade || 4),
            mp_cost: Number(data.mp_cost || 20),
            desc: data.desc || `${skillName} 스킬`,
            effect: data.effect || ((p, t) => {
                if (!p) return;
                const target = t || p;
                const power = 16 + Math.floor((p.currentStats?.["정신력"] || 10) * 0.8);
                if (target && typeof target.hp === "number") {
                    target.hp = Math.max(0, target.hp - power);
                }
                p?.cb?.logMessage?.(`[${skillName}] ${target?.name || "대상"}에게 ${power}의 피해.`);
            })
        };
    }

    grantRaceStoryReward(reward) {
        if (!reward) return false;
        let changed = false;
        if (reward.traitPoints) {
            this.gainTraitPoints(Number(reward.traitPoints || 0), "종족 서사 보상");
            changed = true;
        }
        if (reward.skillPoints) {
            this.gainSkillPoints(Number(reward.skillPoints || 0), "종족 서사 보상");
            changed = true;
        }
        if (reward.stats && typeof reward.stats === "object") {
            Object.entries(reward.stats).forEach(([stat, value]) => {
                if (!this.stats.hasOwnProperty(stat)) return;
                this.stats[stat] = (this.stats[stat] || 0) + Number(value || 0);
                changed = true;
            });
            if (changed) this.calculateStats();
        }
        if (reward.spell && reward.spell.name) {
            this.ensureStorySkillDefinition(reward.spell.name, reward.spell);
            if (!this.spells.includes(reward.spell.name)) {
                this.spells.push(reward.spell.name);
                this.cb?.logMessage?.(`[종족 서사] ${reward.spell.name} 스킬이 개화했습니다.`);
                changed = true;
            }
        }
        return changed;
    }

    getRaceStoryPayload() {
        const story = this.raceStory;
        if (!story) return null;
        const stages = Array.isArray(story.stages) ? story.stages : [];
        const index = Math.max(0, Number(story.stageIndex || 0));
        const completed = index >= stages.length;
        return {
            race: story.race,
            raceName: story.raceName || story.race,
            title: story.title,
            district: story.district,
            mentor: story.mentor,
            stageIndex: index,
            completed,
            current: completed ? null : stages[index],
            next: completed ? null : stages[index + 1] || null,
            stages
        };
    }

    progressRaceStoryStep() {
        const payload = this.getRaceStoryPayload();
        if (!payload || payload.completed || !payload.current) {
            this.cb?.logMessage?.("진행 가능한 종족 서사 단계가 없습니다.");
            return false;
        }

        const step = payload.current;
        const requirement = step.requirement || {};
        const neededLevel = Number(requirement.level || 1);
        const neededGold = Number(requirement.gold || 0);
        const neededStone = Number(requirement.magicStones || 0);

        if ((this.level || 1) < neededLevel) {
            this.cb?.logMessage?.(`[종족 서사] 레벨 ${neededLevel}부터 진행할 수 있습니다.`);
            return false;
        }
        if ((this.gold || 0) < neededGold) {
            this.cb?.logMessage?.(`[종족 서사] ${neededGold.toLocaleString()} 스톤이 필요합니다.`);
            return false;
        }
        if ((this.magic_stones || 0) < neededStone) {
            this.cb?.logMessage?.(`[종족 서사] 마석 ${neededStone}개가 필요합니다.`);
            return false;
        }

        if (neededGold > 0) this.gold -= neededGold;
        if (neededStone > 0) this.magic_stones -= neededStone;

        this.grantRaceStoryReward(step.reward);
        this.raceStory.stageIndex = Math.min(payload.stages.length, payload.stageIndex + 1);
        this.raceStory.log = this.raceStory.log || [];
        this.raceStory.log.push({
            title: step.title,
            desc: step.desc,
            atLevel: this.level
        });
        this.cb?.logMessage?.(`[종족 서사] ${step.title} 완료`);
        this.showStatus?.();
        return true;
    }

    getHomeDistrictExtraLocations() {
        return [];
    }

    getHomesteadGridConfig() {
        return { width: 10, height: 10 };
    }

    createHomesteadDecorGrid(fill = "empty") {
        const { width, height } = this.getHomesteadGridConfig();
        return Array.from({ length: height }, () => Array(width).fill(fill));
    }

    getHomesteadStructureAnchors() {
        return {
            herbGarden: { x: 1, y: 1, marker: "HG", label: "약초 정원" },
            forgeBench: { x: 8, y: 1, marker: "FG", label: "공방 벤치" },
            ritualHall: { x: 1, y: 8, marker: "RT", label: "의식당" },
            lodge: { x: 8, y: 8, marker: "LG", label: "숙소" }
        };
    }

    getHomesteadStructureOverlay() {
        const home = this.ensureHomestead();
        const overlay = {};
        const anchors = this.getHomesteadStructureAnchors();
        Object.entries(anchors).forEach(([key, anchor]) => {
            const level = Number(home.structures?.[key] || 0);
            if (level <= 0) return;
            overlay[`${anchor.x},${anchor.y}`] = {
                ...anchor,
                key,
                level
            };
        });
        return overlay;
    }

    getHomesteadFarmCatalog() {
        return {
            "밀 씨앗": {
                seedName: "밀 씨앗",
                produceName: "밀",
                seedPrice: 120,
                sellPrice: 90,
                growHours: 24,
                yieldMin: 2,
                yieldMax: 4
            },
            "감자 씨앗": {
                seedName: "감자 씨앗",
                produceName: "감자",
                seedPrice: 170,
                sellPrice: 140,
                growHours: 36,
                yieldMin: 2,
                yieldMax: 5
            },
            "토마토 씨앗": {
                seedName: "토마토 씨앗",
                produceName: "토마토",
                seedPrice: 230,
                sellPrice: 190,
                growHours: 48,
                yieldMin: 3,
                yieldMax: 5
            },
            "약초 씨앗": {
                seedName: "약초 씨앗",
                produceName: "약초 다발",
                seedPrice: 260,
                sellPrice: 240,
                growHours: 30,
                yieldMin: 1,
                yieldMax: 3
            }
        };
    }

    ensureHomesteadFarmState(home = this.ensureHomestead()) {
        const catalog = this.getHomesteadFarmCatalog();
        const defaultCapacity = 6;
        home.farm = home.farm || {
            plotCapacity: defaultCapacity,
            plots: Array.from({ length: defaultCapacity }, () => null),
            seedInventory: {}
        };
        home.farm.plotCapacity = Math.max(defaultCapacity, Number(home.farm.plotCapacity || defaultCapacity));
        if (!home.farm.seedInventory || typeof home.farm.seedInventory !== "object") {
            home.farm.seedInventory = {};
        }
        if (!Array.isArray(home.farm.plots)) {
            home.farm.plots = Array.from({ length: home.farm.plotCapacity }, () => null);
        }
        if (home.farm.plots.length < home.farm.plotCapacity) {
            while (home.farm.plots.length < home.farm.plotCapacity) home.farm.plots.push(null);
        } else if (home.farm.plots.length > home.farm.plotCapacity) {
            home.farm.plots = home.farm.plots.slice(0, home.farm.plotCapacity);
        }

        Object.keys(catalog).forEach((seedName) => {
            if (!Number.isFinite(Number(home.farm.seedInventory[seedName]))) {
                home.farm.seedInventory[seedName] = 0;
            }
        });
        return home.farm;
    }

    getHomesteadFarmPayload() {
        const home = this.ensureHomestead();
        const farm = this.ensureHomesteadFarmState(home);
        const now = Number(this.worldTimeHours || 0);
        const readyCount = farm.plots.filter((plot) => plot && Number(plot.readyAt || 0) <= now).length;
        return {
            catalog: this.getHomesteadFarmCatalog(),
            farm: {
                plotCapacity: Number(farm.plotCapacity || 6),
                seedInventory: { ...(farm.seedInventory || {}) },
                plots: farm.plots.map((plot) => plot ? ({ ...plot }) : null)
            },
            readyCount
        };
    }

    buyHomesteadSeed(seedName, quantity = 1) {
        const catalog = this.getHomesteadFarmCatalog();
        const seed = catalog[seedName];
        if (!seed) {
            this.cb?.logMessage?.(`[농사] 알 수 없는 씨앗입니다: ${seedName}`);
            return false;
        }

        const qty = Math.max(1, Math.floor(Number(quantity || 1)));
        const cost = Math.max(1, Math.floor(Number(seed.seedPrice || 0) * qty));
        if (Number(this.gold || 0) < cost) {
            this.cb?.logMessage?.(`[농사] 씨앗 구매 비용이 부족합니다. (필요 ${cost.toLocaleString()} 스톤)`);
            return false;
        }

        const farm = this.ensureHomesteadFarmState();
        this.gold -= cost;
        farm.seedInventory[seedName] = Math.max(0, Number(farm.seedInventory[seedName] || 0) + qty);
        this.cb?.logMessage?.(`[농사] ${seedName} ${qty}개를 구매했습니다. (-${cost.toLocaleString()} 스톤)`);
        this.showStatus?.();
        return true;
    }

    plantHomesteadSeed(seedName, quantity = 1) {
        const catalog = this.getHomesteadFarmCatalog();
        const seed = catalog[seedName];
        if (!seed) return false;

        const farm = this.ensureHomesteadFarmState();
        const availableSeed = Math.max(0, Number(farm.seedInventory[seedName] || 0));
        if (availableSeed <= 0) {
            this.cb?.logMessage?.(`[농사] ${seedName} 재고가 부족합니다.`);
            return false;
        }

        const qty = Math.max(1, Math.min(Math.floor(Number(quantity || 1)), availableSeed));
        const now = Number(this.worldTimeHours || 0);
        let planted = 0;
        for (let i = 0; i < farm.plots.length && planted < qty; i++) {
            if (farm.plots[i]) continue;
            farm.plots[i] = {
                seedName: seed.seedName,
                produceName: seed.produceName,
                plantedAt: now,
                readyAt: now + Math.max(1, Number(seed.growHours || 24)),
                yieldMin: Math.max(1, Number(seed.yieldMin || 1)),
                yieldMax: Math.max(1, Number(seed.yieldMax || 1))
            };
            planted += 1;
        }

        if (planted <= 0) {
            this.cb?.logMessage?.("[농사] 사용할 수 있는 경작지가 없습니다.");
            return false;
        }

        farm.seedInventory[seedName] = Math.max(0, Number(farm.seedInventory[seedName] || 0) - planted);
        this.cb?.logMessage?.(`[농사] ${seedName} ${planted}개를 파종했습니다. (수확까지 ${seed.growHours}시간)`);
        return true;
    }

    harvestHomesteadCrops() {
        const farm = this.ensureHomesteadFarmState();
        const now = Number(this.worldTimeHours || 0);
        const harvestSummary = {};
        let harvestedPlots = 0;

        for (let i = 0; i < farm.plots.length; i++) {
            const plot = farm.plots[i];
            if (!plot) continue;
            if (Number(plot.readyAt || 0) > now) continue;
            const minYield = Math.max(1, Number(plot.yieldMin || 1));
            const maxYield = Math.max(minYield, Number(plot.yieldMax || minYield));
            const amount = minYield + Math.floor(Math.random() * ((maxYield - minYield) + 1));
            const produceName = String(plot.produceName || "작물");
            harvestSummary[produceName] = (harvestSummary[produceName] || 0) + amount;
            for (let n = 0; n < amount; n++) this.inventory.push(produceName);
            farm.plots[i] = null;
            harvestedPlots += 1;
        }

        if (harvestedPlots <= 0) {
            this.cb?.logMessage?.("[농사] 아직 수확 가능한 작물이 없습니다.");
            return false;
        }

        const desc = Object.entries(harvestSummary)
            .map(([name, amount]) => `${name} x${amount}`)
            .join(", ");
        this.cb?.logMessage?.(`[농사] ${harvestedPlots}개 경작지 수확 완료: ${desc}`);
        this.showStatus?.();
        return true;
    }

    sellHomesteadProduce(itemName, quantity = 1) {
        const catalog = this.getHomesteadFarmCatalog();
        const produceMeta = Object.values(catalog).find((entry) => String(entry.produceName) === String(itemName));
        if (!produceMeta) {
            this.cb?.logMessage?.(`[농사] 판매 가능한 농산물이 아닙니다: ${itemName}`);
            return false;
        }

        const qty = Math.max(1, Math.floor(Number(quantity || 1)));
        let removed = 0;
        for (let i = this.inventory.length - 1; i >= 0 && removed < qty; i--) {
            if (this.inventory[i] !== itemName) continue;
            this.inventory.splice(i, 1);
            removed += 1;
        }
        if (removed <= 0) {
            this.cb?.logMessage?.(`[농사] ${itemName} 재고가 없습니다.`);
            return false;
        }

        const gain = Math.max(1, Number(produceMeta.sellPrice || 1) * removed);
        this.gold += gain;
        this.cb?.logMessage?.(`[농사] ${itemName} ${removed}개 판매 완료. (+${gain.toLocaleString()} 스톤)`);
        this.showStatus?.();
        return true;
    }

    sellAllHomesteadProduce() {
        const catalog = this.getHomesteadFarmCatalog();
        const targets = Object.values(catalog).map((entry) => String(entry.produceName));
        const countByName = {};
        this.inventory.forEach((itemName) => {
            if (!targets.includes(itemName)) return;
            countByName[itemName] = (countByName[itemName] || 0) + 1;
        });

        let soldCount = 0;
        Object.entries(countByName).forEach(([itemName, qty]) => {
            if (qty <= 0) return;
            if (this.sellHomesteadProduce(itemName, qty)) {
                soldCount += qty;
            }
        });

        if (soldCount <= 0) {
            this.cb?.logMessage?.("[농사] 판매할 농산물이 없습니다.");
            return false;
        }
        return true;
    }

    expandHomesteadFarmPlots() {
        const home = this.ensureHomestead();
        const farm = this.ensureHomesteadFarmState(home);
        const current = Math.max(6, Number(farm.plotCapacity || 6));
        if (current >= 18) {
            this.cb?.logMessage?.("[농사] 경작지 확장은 최대치입니다.");
            return false;
        }
        const next = current + 3;
        const costGold = 1800 + (next * 260);
        const costStone = 35 + Math.floor(next * 1.5);
        if (Number(this.gold || 0) < costGold || Number(this.magic_stones || 0) < costStone) {
            this.cb?.logMessage?.(`[농사] 경작지 확장 비용 부족. (스톤 ${costGold.toLocaleString()}, 마석 ${costStone})`);
            return false;
        }
        this.gold -= costGold;
        this.magic_stones -= costStone;
        farm.plotCapacity = next;
        while (farm.plots.length < next) farm.plots.push(null);
        this.cb?.logMessage?.(`[농사] 경작지를 ${next}칸으로 확장했습니다.`);
        this.showStatus?.();
        return true;
    }

    ensureHomestead() {
        if (!this.homestead) {
            this.homestead = {
                district: this.homeDistrict || "라비기온 (7-13구역)",
                level: 1,
                comfort: 0,
                structures: {
                    herbGarden: 1,
                    forgeBench: 0,
                    ritualHall: 0,
                    lodge: 1
                },
                decor: {
                    theme: "기본",
                    landmark: "작은 화로",
                    grid: this.createHomesteadDecorGrid("empty")
                },
                farm: {
                    plotCapacity: 6,
                    plots: Array.from({ length: 6 }, () => null),
                    seedInventory: {}
                },
                tick: 0
            };
        }

        this.homestead.decor = this.homestead.decor || {};
        if (!this.homestead.decor.theme) this.homestead.decor.theme = "기본";
        if (!this.homestead.decor.landmark) this.homestead.decor.landmark = "작은 화로";
        const { width, height } = this.getHomesteadGridConfig();
        const grid = this.homestead.decor.grid;
        const invalidGrid = !Array.isArray(grid) ||
            grid.length !== height ||
            grid.some((row) => !Array.isArray(row) || row.length !== width);
        if (invalidGrid) {
            this.homestead.decor.grid = this.createHomesteadDecorGrid("empty");
        }
        this.ensureHomesteadFarmState(this.homestead);

        return this.homestead;
    }

    getHomesteadPayload() {
        const home = this.ensureHomestead();
        return {
            ...home,
            structures: { ...(home.structures || {}) },
            decor: {
                ...(home.decor || {}),
                grid: (home.decor?.grid || []).map((row) => Array.isArray(row) ? [...row] : [])
            },
            farm: {
                ...(home.farm || {}),
                seedInventory: { ...(home.farm?.seedInventory || {}) },
                plots: (home.farm?.plots || []).map((plot) => (plot ? ({ ...plot }) : null))
            },
            structureOverlay: this.getHomesteadStructureOverlay()
        };
    }

    setHomesteadDecorTile(x, y, tileKey = "empty") {
        const home = this.ensureHomestead();
        const allowedTiles = new Set(["empty", "path", "grass", "water", "tree", "flower", "statue", "forge", "altar", "camp"]);
        const tile = allowedTiles.has(tileKey) ? tileKey : "empty";
        const { width, height } = this.getHomesteadGridConfig();
        const ix = Math.floor(Number(x));
        const iy = Math.floor(Number(y));
        if (!Number.isInteger(ix) || !Number.isInteger(iy)) return false;
        if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;

        const overlay = this.getHomesteadStructureOverlay();
        if (overlay[`${ix},${iy}`]) return false;

        const grid = home.decor.grid;
        const before = String(grid[iy][ix] || "empty");
        if (before === tile) return true;
        grid[iy][ix] = tile;

        if (before === "empty" && tile !== "empty") {
            home.comfort = Math.min(100, Number(home.comfort || 0) + 1);
        } else if (before !== "empty" && tile === "empty") {
            home.comfort = Math.max(0, Number(home.comfort || 0) - 1);
        }
        return true;
    }

    resetHomesteadDecorGrid() {
        const home = this.ensureHomestead();
        home.decor.grid = this.createHomesteadDecorGrid("empty");
        home.comfort = Math.max(0, Number(home.comfort || 0) - 5);
        this.cb?.logMessage?.("[영지] 배치 그리드를 초기화했습니다.");
        return true;
    }

    upgradeHomesteadStructure(key) {
        const home = this.ensureHomestead();
        const current = Number(home.structures?.[key] || 0);
        const next = current + 1;
        const baseCost = 900 + (next * 650);
        const stoneCost = 20 + (next * 15);
        if ((this.gold || 0) < baseCost || (this.magic_stones || 0) < stoneCost) {
            this.cb?.logMessage?.(`영지 업그레이드 자원이 부족합니다. (스톤 ${baseCost}, 마석 ${stoneCost})`);
            return false;
        }
        this.gold -= baseCost;
        this.magic_stones -= stoneCost;
        home.structures[key] = next;
        home.level = Math.max(home.level, 1 + Math.floor(Object.values(home.structures).reduce((a, b) => a + Number(b || 0), 0) / 5));
        home.comfort = Math.min(100, Number(home.comfort || 0) + 4 + next);
        this.cb?.logMessage?.(`[영지] 시설 강화 완료: ${key} Lv.${next}`);
        this.showStatus?.();
        return true;
    }

    decorateHomestead(theme) {
        const home = this.ensureHomestead();
        home.decor = home.decor || {};
        home.decor.theme = String(theme || "기본");
        home.comfort = Math.min(100, Number(home.comfort || 0) + 2);
        this.cb?.logMessage?.(`[영지] 장식 테마를 '${home.decor.theme}'(으)로 변경했습니다.`);
        return true;
    }

    harvestHomestead() {
        const home = this.ensureHomestead();
        home.tick = Number(home.tick || 0) + 1;
        const garden = Number(home.structures?.herbGarden || 0);
        const forge = Number(home.structures?.forgeBench || 0);
        const ritual = Number(home.structures?.ritualHall || 0);
        const lodge = Number(home.structures?.lodge || 0);

        const itemPool = ["건조 식량", "포션", "붕대", "마력결정체", "강철 조각"];
        const gainCount = Math.max(1, 1 + Math.floor((garden + forge + ritual) / 2));
        for (let i = 0; i < gainCount; i++) {
            const item = itemPool[(i + home.tick + garden + forge) % itemPool.length];
            this.inventory.push(item);
        }

        const stoneGain = 40 + (forge * 25) + (ritual * 22);
        const satietyGain = 4 + (garden * 3);
        const fatigueRelief = 3 + (lodge * 2);
        this.magic_stones += stoneGain;
        this.satiety = Math.min(100, (this.satiety || 0) + satietyGain);
        this.fatigue = Math.max(0, (this.fatigue || 0) - fatigueRelief);
        this.cb?.logMessage?.(`[영지] 수확 완료: 물자 ${gainCount}개, 마석 +${stoneGain}, 포만감 +${satietyGain}, 피로 -${fatigueRelief}`);
        this.showStatus?.();
        return true;
    }

    getSkillSynthesisPreview(preferredConfig = null) {
        this.refreshSkillBonuses();
        const nodes = this.skillGraph?.nodes || [];
        const rankedNodes = nodes.filter((node) => this.getSkillNodeRank(node.id) > 0);
        const byBranch = (branch) => rankedNodes
            .filter((node) => node.branch === branch && !node.autoUnlock)
            .sort((a, b) => this.getSkillNodeRank(b.id) - this.getSkillNodeRank(a.id));

        const config = typeof preferredConfig === "string"
            ? { coreId: preferredConfig }
            : ((preferredConfig && typeof preferredConfig === "object") ? preferredConfig : {});

        const pickSingle = (candidates, preferredId = null) => {
            if (!Array.isArray(candidates) || candidates.length === 0) return null;
            if (preferredId) {
                const found = candidates.find((node) => node.id === preferredId);
                if (found) return found;
            }
            return candidates[0] || null;
        };

        const pickMulti = (candidates, preferredIds = [], limit = 2) => {
            const picked = [];
            const desired = Array.isArray(preferredIds) ? preferredIds : [];
            desired.forEach((id) => {
                if (!id || picked.length >= limit) return;
                const found = candidates.find((node) => node.id === id);
                if (!found || picked.some((node) => node.id === found.id)) return;
                picked.push(found);
            });
            if (picked.length < limit) {
                candidates.forEach((node) => {
                    if (picked.length >= limit) return;
                    if (picked.some((entry) => entry.id === node.id)) return;
                    picked.push(node);
                });
            }
            return picked.slice(0, limit);
        };

        const coreCandidates = byBranch("core");
        const elementCandidates = byBranch("element");
        const behaviorCandidates = byBranch("behavior");
        const utilityCandidates = byBranch("utility");
        const sigilCandidates = byBranch("sigil");

        const chosenCore = pickSingle(coreCandidates, config.coreId);
        if (!chosenCore) return null;
        const chosenElement = pickSingle(elementCandidates, config.elementId);
        const chosenBehaviors = pickMulti(behaviorCandidates, config.behaviorIds, 2);
        const chosenUtilities = pickMulti(utilityCandidates, config.utilityIds, 2);
        const chosenSigil = pickSingle(sigilCandidates, config.sigilId);

        const coreData = chosenCore.grants?.component || {};
        const elementData = chosenElement?.grants?.component || {};
        const behaviorData = chosenBehaviors.reduce((acc, node) => {
            const comp = node.grants?.component || {};
            Object.entries(comp).forEach(([key, value]) => {
                if (typeof value === "number") acc[key] = (acc[key] || 0) + value;
                else if (value) acc[key] = value;
            });
            return acc;
        }, {});
        const utilityData = chosenUtilities.reduce((acc, node) => {
            const comp = node.grants?.component || {};
            Object.entries(comp).forEach(([key, value]) => {
                if (typeof value === "number") acc[key] = (acc[key] || 0) + value;
                else if (value) acc[key] = value;
            });
            return acc;
        }, {});
        const sigilData = chosenSigil?.grants?.component || {};

        const derived = this.skillBonuses?.derived || {};
        const baseDamage = Number(coreData.baseDamage || 22);
        const powerRate = 1 + Number(derived.skillPower || 0) + Number(behaviorData.powerRate || 0) + Number(sigilData.powerRate || 0);
        const costRate = 1 + Number(coreData.costRate || 0) + Number(elementData.costRate || 0) + Number(behaviorData.costRate || 0) + Number(utilityData.costRate || 0) - Number(derived.costRate || 0);
        const cooldownRate = 1 + Number(coreData.cooldownRate || 0) + Number(behaviorData.cooldownRate || 0) + Number(utilityData.cooldownRate || 0) - Number(derived.cooldownRate || 0);
        const targetCount = Math.max(1, Math.min(5, Number(coreData.targets || 1) + Number(behaviorData.targets || 0) + Number(utilityData.targets || 0)));
        const controlChance = Math.max(0, Math.min(0.65, Number(elementData.controlChance || 0) + Number(behaviorData.controlChance || 0) + Number(derived.controlRate || 0)));
        const critBonus = Math.max(0, Number(behaviorData.critRate || 0) + Number(derived.critRate || 0));

        const computedDamage = Math.max(8, Math.round(baseDamage * powerRate));
        const mpCost = Math.max(6, Math.round((coreData.baseCost || 20) * Math.max(0.45, costRate)));
        const cooldown = Math.max(1, Math.round((coreData.baseCooldown || 4) * Math.max(0.5, cooldownRate)));
        const element = String(elementData.element || "neutral");
        const shape = String(coreData.shape || "strike");
        const signature = [
            chosenCore.id,
            chosenElement?.id || "neutral",
            ...chosenBehaviors.map((n) => n.id),
            ...chosenUtilities.map((n) => n.id),
            chosenSigil?.id || "sigil_none"
        ].join("|");
        const labelCore = chosenCore.name.replace(/ 회로| 공명| 형식/g, "");
        const labelElement = chosenElement ? chosenElement.name.replace(/ 각인| 공명/g, "") : "무속성";
        const skillName = `${labelElement} ${labelCore} [${shape.toUpperCase()}]`;

        return {
            signature,
            skillName,
            shape,
            element,
            mpCost,
            cooldown,
            damage: computedDamage,
            targets: targetCount,
            controlChance,
            critBonus,
            lifeSteal: Math.max(0, Number(behaviorData.lifeSteal || 0) + Number(utilityData.lifeSteal || 0)),
            shieldRate: Math.max(0, Number(utilityData.shieldRate || 0)),
            nodesUsed: {
                core: chosenCore,
                element: chosenElement,
                behaviors: chosenBehaviors,
                utilities: chosenUtilities,
                sigil: chosenSigil
            }
        };
    }

    craftCustomSkill(preferredConfig = null) {
        const preview = this.getSkillSynthesisPreview(preferredConfig);
        if (!preview) {
            this.cb?.logMessage?.("스킬 제작에 필요한 핵심 노드가 부족합니다.");
            return null;
        }
        this.skillCraftedSignatures = this.skillCraftedSignatures || {};
        if (this.skillCraftedSignatures[preview.signature]) {
            this.cb?.logMessage?.("이미 같은 조합의 커스텀 스킬을 보유하고 있습니다.");
            return preview;
        }

        const skillName = `${preview.skillName}#${(this.craftedSkills?.length || 0) + 1}`;
        const desc = `커스텀 스킬 | 속성 ${preview.element} | 형태 ${preview.shape} | 대상 ${preview.targets} | 피해 ${preview.damage} | 제어 ${(preview.controlChance * 100).toFixed(0)}% | 치명 보정 +${(preview.critBonus * 100).toFixed(0)}%`;
        this.ensureStorySkillDefinition(skillName, {
            grade: 3,
            mp_cost: preview.mpCost,
            desc,
            effect: (p, t) => {
                if (!p) return;
                const targets = Array.isArray(t) ? t : (t ? [t] : []);
                if (targets.length === 0) {
                    p?.cb?.logMessage?.(`[${skillName}] 대상이 없어 공명을 종료합니다.`);
                    return;
                }
                const atkPower = (p.currentStats?.["근력"] || 10) * 0.35 + (p.currentStats?.["정신력"] || 10) * 0.85;
                const finalDamage = Math.max(1, Math.floor(preview.damage + atkPower));
                let totalDamage = 0;
                const maxTargets = Math.max(1, Number(preview.targets || 1));
                targets.slice(0, maxTargets).forEach((target) => {
                    if (!target || typeof target.hp !== "number" || target.hp <= 0) return;
                    const resist = Number(target.currentStats?.["항마력"] || 0);
                    const dmg = Math.max(1, Math.floor(finalDamage - (resist * 0.35)));
                    target.hp = Math.max(0, target.hp - dmg);
                    totalDamage += dmg;
                    if (preview.controlChance > 0 && typeof target.applyDebuff === "function" && Math.random() < preview.controlChance) {
                        target.applyDebuff("혼란(1턴)");
                    }
                });

                if (preview.lifeSteal > 0 && totalDamage > 0) {
                    const heal = Math.max(1, Math.floor(totalDamage * preview.lifeSteal));
                    p.hp = Math.min(p.maxHp || 100, (p.hp || 1) + heal);
                }
                if (preview.shieldRate > 0 && totalDamage > 0) {
                    const shieldMp = Math.max(1, Math.floor(totalDamage * preview.shieldRate * 0.25));
                    p.mp = Math.min(p.maxMp || 100, (p.mp || 0) + shieldMp);
                }
                p?.cb?.logMessage?.(`[${skillName}] ${totalDamage} 누적 피해를 입혔습니다.`);
            }
        });

        this.spells = this.spells || [];
        if (!this.spells.includes(skillName)) this.spells.push(skillName);
        this.craftedSkills = this.craftedSkills || [];
        this.craftedSkills.push({
            name: skillName,
            signature: preview.signature,
            element: preview.element,
            shape: preview.shape,
            mpCost: preview.mpCost,
            damage: preview.damage,
            targets: preview.targets
        });
        this.skillCraftedSignatures[preview.signature] = skillName;
        this.cb?.logMessage?.(`[스킬 제작] ${skillName} 생성 완료`);
        this.showStatus?.();
        return { ...preview, name: skillName };
    }

    getRaceOriginProfile(race) {
        const table = {
            Human: {
                district: "황도 카르논 (1구역)",
                title: "제국 수련기사단의 서약",
                mentor: "왕궁 기사단장 에르민",
                opening: "왕궁 기사단은 당신을 차세대 수호자로 선발했습니다.",
                stages: [
                    {
                        title: "오러 기초 각성",
                        desc: "기사단장과의 수련을 통해 오러를 안정적으로 증폭합니다.",
                        requirement: { level: 1, gold: 900 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 1,
                            stats: { 근력: 2, 정신력: 1, 항마력: 2 },
                            spell: {
                                name: "오러 각성",
                                grade: 4,
                                mp_cost: 12,
                                desc: "오러 밀도를 높여 단일 대상에게 강한 압력을 가합니다.",
                                effect: (p, t) => {
                                    if (!p || !t) return;
                                    const dmg = 36 + Math.floor((p.currentStats?.["근력"] || 10) * 1.1);
                                    if (typeof t.hp === "number") t.hp = Math.max(0, t.hp - dmg);
                                    p?.cb?.logMessage?.(`[오러 각성] ${t?.name || "대상"}에게 ${dmg} 피해.`);
                                }
                            }
                        }
                    },
                    {
                        title: "황도 방위 임무",
                        desc: "왕도의 균열 방위전 기록을 완수해 전투 지휘 능력을 증명합니다.",
                        requirement: { level: 4, gold: 1800, magicStones: 60 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 2,
                            stats: { 투쟁심: 3, 통제력: 2 }
                        }
                    },
                    {
                        title: "황금 오러 의식",
                        desc: "오러를 방어막과 공격으로 동시에 운용하는 상위 회로를 개방합니다.",
                        requirement: { level: 8, gold: 4200, magicStones: 180 },
                        reward: {
                            traitPoints: 3,
                            skillPoints: 3,
                            stats: { 항마력: 4, "물리 내성": 3 },
                            spell: {
                                name: "황금 오러",
                                grade: 3,
                                mp_cost: 24,
                                desc: "강한 타격과 함께 사용자에게 오러 보호막을 부여합니다.",
                                effect: (p, t) => {
                                    if (!p) return;
                                    const target = t || p;
                                    const dmg = 52 + Math.floor((p.currentStats?.["근력"] || 12) * 1.25);
                                    if (target && typeof target.hp === "number") target.hp = Math.max(0, target.hp - dmg);
                                    const shield = 28 + Math.floor((p.currentStats?.["정신력"] || 10) * 0.8);
                                    p.hp = Math.min(p.maxHp, p.hp + Math.floor(shield * 0.35));
                                    p?.cb?.logMessage?.(`[황금 오러] 타격 ${dmg}, 오러 회복 ${Math.floor(shield * 0.35)}.`);
                                }
                            }
                        }
                    }
                ]
            },
            Elf: {
                district: "노움트리 (6구역)",
                title: "실바누스 성소의 정령 연대기",
                mentor: "성소 수호자 아린델",
                opening: "고목 성소의 정령들이 당신의 이름을 기억하고 있습니다.",
                stages: [
                    {
                        title: "하급 정령 계약",
                        desc: "정령과의 공명을 안정화해 탐험 보조 능력을 얻습니다.",
                        requirement: { level: 1, gold: 700 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 1,
                            stats: { 정신력: 2, 시각: 2, "모든 속성 감응도": 2 },
                            spell: {
                                name: "정령 계약",
                                grade: 4,
                                mp_cost: 14,
                                desc: "정령이 적에게 피해를 입히고 주변 기류를 읽습니다.",
                                effect: (p, t) => {
                                    if (!p || !t) return;
                                    const dmg = 30 + Math.floor((p.currentStats?.["정신력"] || 12) * 1.2);
                                    if (typeof t.hp === "number") t.hp = Math.max(0, t.hp - dmg);
                                    p?.cb?.logMessage?.(`[정령 계약] ${t?.name || "대상"}에게 ${dmg}의 정령 피해.`);
                                }
                            }
                        }
                    },
                    {
                        title: "숲결 동조",
                        desc: "정령 흐름을 따라 회복/탐지 능력을 확장합니다.",
                        requirement: { level: 4, gold: 1500, magicStones: 50 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 2,
                            stats: { 인지력: 3, 육감: 3 }
                        }
                    },
                    {
                        title: "군집 정령 소환",
                        desc: "복수 정령과 동시 계약하여 전투·탐험 효율을 극대화합니다.",
                        requirement: { level: 8, gold: 3900, magicStones: 170 },
                        reward: {
                            traitPoints: 3,
                            skillPoints: 3,
                            stats: { 정신력: 4, "모든 속성 감응도": 4 },
                            spell: {
                                name: "정령 군주화",
                                grade: 3,
                                mp_cost: 26,
                                desc: "복수 표적에 정령 반응을 연쇄시킵니다.",
                                effect: (p, targets) => {
                                    if (!p) return;
                                    const list = Array.isArray(targets) ? targets : [targets];
                                    const valid = list.filter((m) => m && typeof m.hp === "number" && m.hp > 0);
                                    const cap = Math.max(1, Math.min(3, valid.length));
                                    let total = 0;
                                    for (let i = 0; i < cap; i++) {
                                        const dmg = 28 + Math.floor((p.currentStats?.["정신력"] || 12) * 0.95);
                                        valid[i].hp = Math.max(0, valid[i].hp - dmg);
                                        total += dmg;
                                    }
                                    p?.cb?.logMessage?.(`[정령 군주화] ${cap}개 대상에 누적 ${total} 피해.`);
                                }
                            }
                        }
                    }
                ]
            },
            Dwarf: {
                district: "컴멜비 (2-5구역)",
                title: "강철 공방 연대기",
                mentor: "대장 마이스터 브론",
                opening: "컴멜비 공방 연합이 당신에게 도면 인가를 부여했습니다.",
                stages: [
                    {
                        title: "무구의 천재 - 초안",
                        desc: "장비 조율법을 익혀 무기/방어구 잠재력을 끌어냅니다.",
                        requirement: { level: 1, gold: 1000 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 1,
                            stats: { 근력: 2, 골강도: 3, "물리 내성": 2 },
                            spell: {
                                name: "무구의 천재",
                                grade: 4,
                                mp_cost: 10,
                                desc: "무구에 잠재된 보정을 활성화해 공격력을 증폭합니다.",
                                effect: (p, t) => {
                                    if (!p || !t) return;
                                    const dmg = 34 + Math.floor((p.currentStats?.["근력"] || 14) * 1.15);
                                    if (typeof t.hp === "number") t.hp = Math.max(0, t.hp - dmg);
                                    p?.cb?.logMessage?.(`[무구의 천재] ${t?.name || "대상"}에게 ${dmg} 피해.`);
                                }
                            }
                        }
                    },
                    {
                        title: "합금 장인 인증",
                        desc: "라이티늄/아이릴제 조율식을 완성해 장비 효율을 끌어올립니다.",
                        requirement: { level: 4, gold: 2100, magicStones: 70 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 2,
                            stats: { "물리 내성": 3, 항마력: 2, 지구력: 2 }
                        }
                    },
                    {
                        title: "대장 마이스터 인장",
                        desc: "공방 연합의 최고 인장을 받아 무구 조율 최종 단계를 연다.",
                        requirement: { level: 8, gold: 4600, magicStones: 180 },
                        reward: {
                            traitPoints: 3,
                            skillPoints: 3,
                            stats: { 근력: 4, 지구력: 3 },
                            spell: {
                                name: "강철 황금비",
                                grade: 3,
                                mp_cost: 22,
                                desc: "타격 후 장비 공명을 일으켜 추가 피해와 회복을 얻습니다."
                            }
                        }
                    }
                ]
            },
            Barbarian: {
                district: "비프론 (14구역)",
                title: "피의 주술 연대",
                mentor: "바바리안 주술사 카르툼",
                opening: "비프론 주술단이 혼령각인의 후계자로 당신을 지목했습니다.",
                stages: [
                    {
                        title: "혼령각인 1단계",
                        desc: "피와 혼령의 주파수를 동기화해 전투 지속력을 높입니다.",
                        requirement: { level: 1, gold: 800 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 1,
                            stats: { 근력: 3, "자연 재생력": 3 },
                            spell: {
                                name: "혼령각인",
                                grade: 4,
                                mp_cost: 14,
                                desc: "혼령각인을 활성화해 일시적으로 공격/재생을 강화합니다.",
                                effect: (p) => {
                                    if (!p) return;
                                    const heal = 18 + Math.floor((p.currentStats?.["자연 재생력"] || 10) * 0.6);
                                    p.hp = Math.min(p.maxHp || 100, (p.hp || 1) + heal);
                                    p?.cb?.logMessage?.(`[혼령각인] 육체가 재구성됩니다. (HP +${heal})`);
                                }
                            }
                        }
                    },
                    {
                        title: "망자 심장 융합",
                        desc: "균열 부산물을 각인 재료로 사용해 상위 파형을 개방합니다.",
                        requirement: { level: 4, gold: 1800, magicStones: 60 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 2,
                            stats: { "물리 내성": 3, 투쟁심: 4 }
                        }
                    },
                    {
                        title: "혼령왕 각인",
                        desc: "혼령 각인을 상위 단계로 승격해 전장을 지배합니다.",
                        requirement: { level: 8, gold: 4200, magicStones: 190 },
                        reward: {
                            traitPoints: 3,
                            skillPoints: 3,
                            stats: { 근력: 5, "자연 재생력": 4 },
                            spell: {
                                name: "혼령왕 각인",
                                grade: 3,
                                mp_cost: 26,
                                desc: "대상을 분쇄하고 자신을 재생시키는 상위 각인 기술."
                            }
                        }
                    }
                ]
            },
            Beastman: {
                district: "노움트리 (6구역)",
                title: "야수 영혼수 결속",
                mentor: "영혼수 추적자 리오나",
                opening: "노움트리의 영혼수 목장이 당신과 결속을 기다립니다.",
                stages: [
                    {
                        title: "영혼수 추적 의식",
                        desc: "영혼수와의 감각 공유를 통해 추적 능력을 확보합니다.",
                        requirement: { level: 1, gold: 700 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 1,
                            stats: { 후각: 4, 청각: 4, 민첩성: 2 },
                            spell: {
                                name: "영혼수 결속",
                                grade: 4,
                                mp_cost: 12,
                                desc: "영혼수의 감각을 빌려 적의 약점을 포착합니다."
                            }
                        }
                    },
                    {
                        title: "흔적 사냥 시험",
                        desc: "희귀 개체 추적 임무를 완수해 결속을 강화합니다.",
                        requirement: { level: 4, gold: 1500, magicStones: 50 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 2,
                            stats: { 인지력: 2, 육감: 2, 행운: 2 }
                        }
                    },
                    {
                        title: "군집 사냥장 계약",
                        desc: "다수 영혼수와 동기화해 전투/탐험 연계를 확보합니다.",
                        requirement: { level: 8, gold: 3800, magicStones: 160 },
                        reward: {
                            traitPoints: 3,
                            skillPoints: 3,
                            stats: { 민첩성: 4, 지구력: 3 },
                            spell: {
                                name: "야수 군집 공명",
                                grade: 3,
                                mp_cost: 24,
                                desc: "연속 추적으로 다수 표적을 압박합니다."
                            }
                        }
                    }
                ]
            },
            Fairy: {
                district: "노움트리 (6구역)",
                title: "별빛 군락의 서",
                mentor: "별무리 관측자 에이라",
                opening: "별빛 군락의 관측대가 당신의 비행 공명을 기록하려 합니다.",
                stages: [
                    {
                        title: "광익 조율",
                        desc: "비행 궤적과 마력선을 일치시켜 전투 기동을 강화합니다.",
                        requirement: { level: 1, gold: 750 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 1,
                            stats: { 민첩성: 3, 정신력: 2, 시야: 2 },
                            spell: {
                                name: "별빛 날개",
                                grade: 4,
                                mp_cost: 13,
                                desc: "별빛 기류를 타고 회피와 타격을 동시에 강화합니다."
                            }
                        }
                    },
                    {
                        title: "요정 군집 동조",
                        desc: "군집 공명을 통해 연쇄 마력 반응을 일으킵니다.",
                        requirement: { level: 4, gold: 1600, magicStones: 55 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 2,
                            stats: { "모든 속성 감응도": 4, 항마력: 2 }
                        }
                    },
                    {
                        title: "극광 비행 의식",
                        desc: "별빛 항로를 개방하여 상위 비행 전투를 구사합니다.",
                        requirement: { level: 8, gold: 4000, magicStones: 170 },
                        reward: {
                            traitPoints: 3,
                            skillPoints: 3,
                            stats: { 민첩성: 4, 정신력: 3 },
                            spell: {
                                name: "극광 비행진",
                                grade: 3,
                                mp_cost: 25,
                                desc: "광역 기동 타격으로 다수 적을 교란합니다."
                            }
                        }
                    }
                ]
            },
            Dragonkin: {
                district: "황도 카르논 (1구역)",
                title: "용혈 서약 연대기",
                mentor: "용혈 사제 발티르",
                opening: "황도의 용혈 사원은 당신의 용언 계승을 승인했습니다.",
                stages: [
                    {
                        title: "용언 기본 서약",
                        desc: "고대 용언의 자음을 안정화해 제압력을 확보합니다.",
                        requirement: { level: 1, gold: 1100 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 1,
                            stats: { 근력: 2, 항마력: 3, "화염 내성": 4 },
                            spell: {
                                name: "용언 연쇄",
                                grade: 4,
                                mp_cost: 15,
                                desc: "용언의 파동을 연쇄시켜 다수 대상을 압박합니다."
                            }
                        }
                    },
                    {
                        title: "용혈 각성 의례",
                        desc: "용혈 축복을 받아 생존성과 제어력을 강화합니다.",
                        requirement: { level: 4, gold: 2300, magicStones: 80 },
                        reward: {
                            traitPoints: 2,
                            skillPoints: 2,
                            stats: { "물리 내성": 3, 항마력: 3, 지구력: 2 }
                        }
                    },
                    {
                        title: "용의 축복",
                        desc: "완전한 축복을 받아 전장 지배권을 확보합니다.",
                        requirement: { level: 8, gold: 5000, magicStones: 200 },
                        reward: {
                            traitPoints: 3,
                            skillPoints: 3,
                            stats: { 근력: 4, 항마력: 4, "화염 내성": 6 },
                            spell: {
                                name: "용의 축복",
                                grade: 3,
                                mp_cost: 27,
                                desc: "용혈의 축복으로 공격력과 방어를 동시에 강화합니다.",
                                effect: (p) => {
                                    if (!p) return;
                                    const heal = 24 + Math.floor((p.currentStats?.["지구력"] || 12) * 0.9);
                                    p.hp = Math.min(p.maxHp || 100, (p.hp || 1) + heal);
                                    p?.cb?.logMessage?.(`[용의 축복] 용혈이 육체를 강화합니다. (HP +${heal})`);
                                }
                            }
                        }
                    }
                ]
            }
        };

        const profileKey = this.getLegacyRaceKey(race);
        const canonicalRace = this.normalizeRaceId(race);
        return table[profileKey] || {
            district: "라비기온 (7-13구역)",
            title: `${canonicalRace || "미상"} 서사`,
            mentor: "무명의 조력자",
            opening: "아직 정의되지 않은 종족 경로입니다.",
            stages: []
        };
    }

    initializeRaceOriginAndStory(race) {
        const profile = this.getRaceOriginProfile(race);
        const raceId = this.normalizeRaceId(race);
        const raceDisplay = this.cb?.raceDefinitions?.()?.[raceId]?.name || raceId || race || "미상";
        const cityData = this.gameData?.cities?.["라프도니아"] || {};
        const fallbackDistrict = "라비기온 (7-13구역)";
        const district = cityData?.[profile.district] ? profile.district : fallbackDistrict;

        this.originDistrict = district;
        this.homeDistrict = district;
        this.position = "종족 영지";
        this.raceStory = {
            race: raceId,
            raceName: raceDisplay,
            title: profile.title,
            district,
            mentor: profile.mentor,
            stageIndex: 0,
            stages: Array.isArray(profile.stages) ? profile.stages.map((stage) => ({ ...stage })) : [],
            log: []
        };
        this.homestead = null;
        this.ensureHomestead();

        this.cb?.logMessage?.(`[출신지] ${raceDisplay} 영지 ${district} (시작 위치: 종족 영지)`);
        if (profile.opening) {
            this.cb?.logMessage?.(`[종족 서사] ${profile.opening}`);
        }
    }

    chooseRace(raceId) {
        // [Phase 3] 새로운 RACE_DEFINITIONS 사용
        // 기존 시스템도 유지하되, 새 레이스 시스템 우선 사용
        const normalizedRaceId = this.normalizeRaceId(raceId);
        const legacyRaceKey = this.getLegacyRaceKey(normalizedRaceId);
        const raceDefinitions = this.cb?.raceDefinitions?.();
        const legacyRaces = this.gameData?.races;
        
        let raceData = null;
        
        // 1. RACE_DEFINITIONS 확인
        if (raceDefinitions && raceDefinitions[normalizedRaceId]) {
            raceData = raceDefinitions[normalizedRaceId];
        }
        // 2. 레거시 races 확인
        else if (legacyRaces && legacyRaces[legacyRaceKey]) {
            raceData = legacyRaces[legacyRaceKey];
        }
        // 3. 아무것도 없으면 에러
        else {
            this.cb?.logMessage?.(`Error: Race "${raceId}" not found.`);
            return;
        }
        
        this.race = normalizedRaceId;
        
        // --- 새로운 방식: RACE_DEFINITIONS 기반 ---
        if (raceDefinitions && raceDefinitions[normalizedRaceId]) {
            // 기본 스탯 적용 (RACE_DEFINITIONS의 baseStats)
            const baseStats = raceDefinitions[normalizedRaceId].baseStats || {};
            this.stats = {}; 
            const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
            statsList.forEach(stat => this.stats[stat.name] = 0);
            
            Object.keys(baseStats).forEach(k => {
                if (this.stats.hasOwnProperty(k)) {
                    this.stats[k] = baseStats[k];
                }
            });
            
            // 리소스 초기화 (RACE_DEFINITIONS의 resources)
            if (raceData.resources) {
                for (const resourceKey in raceData.resources) {
                    const resourceDef = raceData.resources[resourceKey];
                    this.resources[resourceKey] = {
                        name: resourceDef.name,
                        current: resourceDef.baseValue,
                        max: resourceDef.baseValue,
                        locked: resourceDef.locked || false,
                        reason: resourceDef.reason || null
                    };
                }
            }
            
            // 레이스 시스템 초기화
            if (this.raceSystem) {
                this.raceSystem.setPlayerRace(normalizedRaceId);
                this.cb?.logMessage?.(`[종족] ${raceData.name}을(를) 선택했습니다!`);
            }
        }
        // --- 레거시 방식 유지 (호환성) ---
        else if (legacyRaces && legacyRaces[legacyRaceKey]) {
            const base = legacyRaces[legacyRaceKey].base_stats;
            this.stats = {}; 
            const statsList = Array.isArray(this.gameData.statsList) ? this.gameData.statsList : [];
            statsList.forEach(stat => this.stats[stat.name] = 0);
            
            Object.keys(base).forEach(k => {
                if (this.stats.hasOwnProperty(k)) {
                    this.stats[k] = base[k];
                }
            });
            
            const racial = legacyRaces[legacyRaceKey]?.racial_skill;
            if (racial?.name && typeof racial.effect === 'function') {
                this.gameData.magic = this.gameData.magic || {};
                if (!this.gameData.magic[racial.name]) {
                    this.gameData.magic[racial.name] = {
                        grade: 1,
                        mp_cost: 10,
                        desc: racial.desc || `${normalizedRaceId}의 종족 고유 능력`,
                        effect: racial.effect
                    };
                }
                if (!this.spells.includes(racial.name)) {
                    this.spells.push(racial.name);
                }
                this.cb?.logMessage?.(`종족 고유 스킬 [${racial.name}]을(를) 익혔습니다.`);
            }
        }
        
        this.calculateStats(); 
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.stamina = this.maxStamina;
        
        this.initializeRaceOriginAndStory(normalizedRaceId);
        this.autoAcceptRaceQuests();
        this.cb?.logMessage?.(`[특성] 현재 사용 가능 포인트: ${this.traitPoints}`);
        this.cb?.logMessage?.(`[스킬 특성] 현재 사용 가능 포인트: ${this.skillPoints}`);
        
        if (raceData?.description) {
            this.cb?.logMessage?.(`[종족 설명] ${raceData.description}`);
        }
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
                    const scale = this.getItemStatScale(itemData, slot);
                    const raceProfile = this.getRaceBalanceProfile(this.race) || {};
                    const numbersItemMult = Math.max(0, Number(raceProfile.numbersItemMultiplier ?? 1));
                    const forgeBoost = this.debuffs?.includes("무구의 축복(강화)") ? 1.2 : 1;
                    const isNumbersItem = Boolean(this.gameData?.numbersItems?.[itemName]);
                    for (const stat in itemData.stats) {
                        if (newStats.hasOwnProperty(stat)) {
                            let raw = Number(itemData.stats[stat] || 0);
                            if (raw > 0 && isNumbersItem) {
                                raw *= numbersItemMult;
                                raw *= forgeBoost;
                            }
                            newStats[stat] = (newStats[stat] || 0) + (raw * scale);
                        }
                    }

                    const enhanceLevel = Math.max(0, Number(this.enhancementLevels?.[itemName] || 0));
                    if (enhanceLevel > 0) {
                        const enhanceRate = Math.min(0.8, enhanceLevel * 0.08);
                        for (const stat in itemData.stats) {
                            if (!newStats.hasOwnProperty(stat)) continue;
                            const raw = Number(itemData.stats[stat] || 0);
                            if (raw <= 0) continue;
                            newStats[stat] = (newStats[stat] || 0) + Math.floor(raw * enhanceRate);
                        }
                    }
                }
            }
        }

        // 3. 정수 기본 스탯 합산
        for (const essenceName of this.essences) {
            const essenceData = (this.gameData.essences && this.gameData.essences[essenceName]);
            if (essenceData && essenceData.stats) {
                const scale = this.getEssenceStatScale(essenceData, essenceName);
                for (const stat in essenceData.stats) {
                    if (newStats.hasOwnProperty(stat)) {
                        const raw = Number(essenceData.stats[stat] || 0);
                        newStats[stat] = (newStats[stat] || 0) + (raw * scale);
                    }
                }
            }
        }

        // 4. 정수 패시브 스탯 적용 (데이터 기반)
        for (const essenceName of this.essences) {
            const essenceData = (this.gameData.essences && this.gameData.essences[essenceName]);
            if (!essenceData || !essenceData.passive) continue;
            const passives = helpers.toArray(essenceData.passive);
            passives.forEach((passive) => {
                const passiveName = typeof passive === "string" ? passive : passive?.name;
                this.applyEssencePassiveStatRule(newStats, passiveName, essenceName, statsList);
            });
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

        // 6.5 종족별 상시 패시브 (데이터 기반)
        this.applyRacePassiveStatBonuses(newStats, statsList);

        // 6.9 특성 그래프 보너스 반영
        this.refreshTraitBonuses();
        const traitStats = this.traitBonuses?.stats || {};
        Object.entries(traitStats).forEach(([statName, value]) => {
            if (!Number.isFinite(value) || value === 0) return;
            newStats[statName] = (newStats[statName] || 0) + Math.trunc(value);
        });

        // 포만감이 낮으면 전투 핵심 능력치가 하락합니다.
        const satietyPenalty = this.getSatietyPenaltyProfile();
        if (satietyPenalty.strPenalty > 0) {
            newStats["근력"] = (newStats["근력"] || 0) - satietyPenalty.strPenalty;
        }
        if (satietyPenalty.dexPenalty > 0) {
            newStats["민첩성"] = (newStats["민첩성"] || 0) - satietyPenalty.dexPenalty;
        }

        const injuryPenalty = this.getInjuryPenaltyProfile?.() || {};
        if (Number(injuryPenalty.str || 0) > 0) {
            newStats["근력"] = (newStats["근력"] || 0) - Number(injuryPenalty.str || 0);
        }
        if (Number(injuryPenalty.dex || 0) > 0) {
            newStats["민첩성"] = (newStats["민첩성"] || 0) - Number(injuryPenalty.dex || 0);
        }
        if (Number(injuryPenalty.end || 0) > 0) {
            newStats["지구력"] = (newStats["지구력"] || 0) - Number(injuryPenalty.end || 0);
        }
        if (Number(injuryPenalty.mental || 0) > 0) {
            newStats["정신력"] = (newStats["정신력"] || 0) - Number(injuryPenalty.mental || 0);
        }
        if (Number(injuryPenalty.hitRate || 0) > 0) {
            newStats["명중률"] = (newStats["명중률"] || 0) - Math.floor(Number(injuryPenalty.hitRate || 0) * 100);
        }
        if (Number(injuryPenalty.charm || 0) > 0 && Object.prototype.hasOwnProperty.call(newStats, "매력")) {
            newStats["매력"] = (newStats["매력"] || 0) - Number(injuryPenalty.charm || 0);
        }
        if (Number(injuryPenalty.intimidation || 0) > 0 && Object.prototype.hasOwnProperty.call(newStats, "위압감")) {
            newStats["위압감"] = (newStats["위압감"] || 0) + Number(injuryPenalty.intimidation || 0);
        }

        // 저주/축복 장착 효과(감정 시스템)
        this.itemIdentity = this.itemIdentity || { identified: {}, mystery: {}, cursedSlots: {}, blessedSlots: {} };
        this.itemIdentity.cursedSlots = this.itemIdentity.cursedSlots || {};
        this.itemIdentity.blessedSlots = this.itemIdentity.blessedSlots || {};
        Object.keys(this.itemIdentity.cursedSlots).forEach((slot) => {
            const bind = this.itemIdentity.cursedSlots[slot];
            if (!bind || this.equipment?.[slot] !== bind.itemName) {
                delete this.itemIdentity.cursedSlots[slot];
                return;
            }
            const power = Math.max(1, Number(bind.power || 1));
            newStats["근력"] = (newStats["근력"] || 0) - (1 + power);
            newStats["민첩성"] = (newStats["민첩성"] || 0) - power;
            newStats["정신력"] = (newStats["정신력"] || 0) - power;
        });
        Object.keys(this.itemIdentity.blessedSlots).forEach((slot) => {
            const bind = this.itemIdentity.blessedSlots[slot];
            if (!bind || this.equipment?.[slot] !== bind.itemName) {
                delete this.itemIdentity.blessedSlots[slot];
                return;
            }
            const power = Math.max(1, Number(bind.power || 1));
            newStats["근력"] = (newStats["근력"] || 0) + power;
            newStats["물리 내성"] = (newStats["물리 내성"] || 0) + (power + 1);
            newStats["항마력"] = (newStats["항마력"] || 0) + power;
        });

        Object.keys(newStats).forEach((key) => {
            if (!Number.isFinite(newStats[key])) newStats[key] = 0;
            newStats[key] = Math.floor(newStats[key]);
        });

        // 7. 최종 스탯 갱신
        this.currentStats = newStats; 

        // 8. 파생 스탯 계산
        const derivedCfg = this.getStatBalanceConfig()?.derived || {};
        const critCfg = derivedCfg.crit || {};
        const evadeCfg = derivedCfg.evasion || {};

        const critBase = Number(critCfg.base ?? 0.05);
        const critLuckDiv = Number(critCfg.luckDivisor || 500);
        const critFlexDiv = Number(critCfg.flexibilityDivisor || 1000);
        const critPerceptionDiv = Number(critCfg.perceptionDivisor || 2000);
        this.critChance = critBase
            + ((newStats["행운"] || 0) / Math.max(1, critLuckDiv))
            + ((newStats["유연성"] || 0) / Math.max(1, critFlexDiv))
            + ((newStats["인지력"] || 0) / Math.max(1, critPerceptionDiv));

        const evasionBase = Number(evadeCfg.base ?? 0.05);
        const evadeDexDiv = Number(evadeCfg.dexDivisor || 500);
        const evadeFlexDiv = Number(evadeCfg.flexibilityDivisor || 1000);
        const evadeVisionDiv = Number(evadeCfg.visionDivisor || 1000);
        const evadeEyesightDiv = Number(evadeCfg.eyesightDivisor || 2000);
        this.evasion = evasionBase
            + ((newStats["민첩성"] || 0) / Math.max(1, evadeDexDiv))
            + ((newStats["유연성"] || 0) / Math.max(1, evadeFlexDiv))
            + ((newStats["시야"] || 0) / Math.max(1, evadeVisionDiv))
            + ((newStats["시각"] || 0) / Math.max(1, evadeEyesightDiv));

        const essenceDerivedBonuses = derivedCfg.essenceBonuses || {};
        Object.entries(essenceDerivedBonuses).forEach(([essenceName, bonus]) => {
            if (!this.essences?.includes(essenceName)) return;
            this.critChance += Number(bonus?.critChance || 0);
            this.evasion += Number(bonus?.evasion || 0);
        });

        const raceDerived = this.getRaceBalanceProfile(this.race)?.derived || {};
        this.critChance += Number(raceDerived.critChance || 0);
        this.evasion += Number(raceDerived.evasion || 0);

        const traitDerived = this.traitBonuses?.derived || {};
        this.critChance += Number(traitDerived.critChance || 0);
        this.evasion += Number(traitDerived.evasion || 0);
        const injuryDerivedPenalty = this.getInjuryPenaltyProfile?.() || {};
        this.evasion -= Number(injuryDerivedPenalty.evadeRate || 0);

        const critMin = Number(critCfg.min ?? 0.01);
        const critMax = Number(critCfg.max ?? 0.85);
        const evadeMin = Number(evadeCfg.min ?? 0.01);
        const evadeMax = Number(evadeCfg.max ?? 0.85);
        this.critChance = Math.min(critMax, Math.max(critMin, this.critChance));
        this.evasion = Math.min(evadeMax, Math.max(evadeMin, this.evasion));

        // 9. 스탯 기반 HP/MP 갱신
        this.updateMaxStats(); 
    }

    updateMaxStats() {
        const maxCfg = this.getStatBalanceConfig()?.maxStats || {};
        const hpCfg = maxCfg.hp || {};
        const mpCfg = maxCfg.mp || {};
        const staminaCfg = maxCfg.stamina || {};

        this.maxHp = ((this.currentStats["지구력"] || 10) * Number(hpCfg.enduranceScale || 8)) + (this.level * Number(hpCfg.levelScale || 20));
        this.maxMp = ((this.currentStats["영혼력"] || 10) * Number(mpCfg.soulScale || 1)) + ((this.currentStats["정신력"] || 10) * Number(mpCfg.mindScale || 5));
        this.maxStamina = (this.currentStats["지구력"] || 10) * Number(staminaCfg.enduranceScale || 10);

        const derived = this.traitBonuses?.derived || {};
        this.maxHp = Math.max(1, Math.floor(this.maxHp * (1 + Number(derived.maxHpRate || 0))));
        this.maxMp = Math.max(1, Math.floor(this.maxMp * (1 + Number(derived.maxMpRate || 0))));
        this.maxStamina = Math.max(1, Math.floor(this.maxStamina * (1 + Number(derived.maxStaminaRate || 0))));
        
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

    getRequiredExpForLevel(level = this.level) {
        const lv = Math.max(1, Number(level || 1));
        const raw = Number(this.gameData?.expToLevel?.[lv]);
        if (!Number.isFinite(raw) || raw <= 0) return Infinity;
        return Math.max(4, Math.floor(raw * 0.18));
    }

    getExpGainMultiplier() {
        const lv = Math.max(1, Number(this.level || 1));
        const table = this.getStatBalanceConfig()?.progression?.expMultiplierByLevel;
        if (Array.isArray(table) && table.length > 0) {
            for (const entry of table) {
                const maxLevel = Number(entry?.maxLevel || 0);
                if (maxLevel > 0 && lv <= maxLevel) {
                    const mult = Number(entry?.multiplier || 1);
                    return Number.isFinite(mult) && mult > 0 ? mult : 1;
                }
            }
        }
        if (lv <= 10) return 3.8;
        if (lv <= 20) return 3.4;
        return 3.0;
    }

    getMaxEssenceCapacity(level = this.level) {
        const lv = Math.max(1, Number(level || 1));
        const capCfg = this.getStatBalanceConfig()?.progression?.essenceCapacity || {};
        const basePerLevel = Number(capCfg.basePerLevel || 3);
        const bonusEveryLevel = Math.max(1, Number(capCfg.bonusEveryLevel || 5));
        const bonusAmount = Number(capCfg.bonusAmount || 1);
        const minCap = Number(capCfg.min || 1);
        let maxEssences = (lv * basePerLevel) + (Math.floor(lv / bonusEveryLevel) * bonusAmount);
        if (this.essences?.includes("디아몬트")) {
            maxEssences -= Number(capCfg.diamondPenalty || 1);
        }
        return Math.max(minCap, Math.floor(maxEssences));
    }

    getMentalStatValue() {
        const fromCurrent = Number(this.currentStats?.["정신력"]);
        if (Number.isFinite(fromCurrent)) return fromCurrent;
        const fromBase = Number(this.stats?.["정신력"]);
        return Number.isFinite(fromBase) ? fromBase : 0;
    }

    isLowIntelligence() {
        return this.getMentalStatValue() < 10;
    }

    getSatietyPenaltyProfile() {
        const satiety = Number(this.satiety || 0);
        if (satiety <= 0) {
            return {
                stage: "starving",
                strPenalty: 12,
                dexPenalty: 8,
                skillFailChance: 0.35
            };
        }
        if (satiety < 15) {
            return {
                stage: "critical",
                strPenalty: 8,
                dexPenalty: 5,
                skillFailChance: 0.24
            };
        }
        if (satiety < 35) {
            return {
                stage: "hungry",
                strPenalty: 4,
                dexPenalty: 2,
                skillFailChance: 0.12
            };
        }
        if (satiety < 55) {
            return {
                stage: "uneasy",
                strPenalty: 2,
                dexPenalty: 1,
                skillFailChance: 0.05
            };
        }
        return {
            stage: "stable",
            strPenalty: 0,
            dexPenalty: 0,
            skillFailChance: 0
        };
    }

    getSatietySkillFailChance() {
        return Number(this.getSatietyPenaltyProfile()?.skillFailChance || 0);
    }

    ensureInjuryState() {
        if (!this.injuryState || typeof this.injuryState !== "object") {
            this.injuryState = { leg: null, arm: null, head: null, torso: null, scarCount: 0 };
        }
        ["leg", "arm", "head", "torso"].forEach((part) => {
            if (!this.injuryState[part] || typeof this.injuryState[part] !== "object") {
                this.injuryState[part] = null;
            }
        });
        this.injuryState.scarCount = Math.max(0, Number(this.injuryState.scarCount || 0));
        return this.injuryState;
    }

    hasActiveInjury() {
        const state = this.ensureInjuryState();
        return ["leg", "arm", "head", "torso"].some((part) => Boolean(state[part]));
    }

    getInjuryPenaltyProfile() {
        const state = this.ensureInjuryState();
        const penalty = {
            str: 0,
            dex: 0,
            end: 0,
            mental: 0,
            hitRate: 0,
            evadeRate: 0,
            skipTurnChance: 0,
            intimidation: 0,
            charm: 0
        };
        const applyPart = (partKey, values = {}) => {
            if (!state[partKey]) return;
            Object.entries(values).forEach(([k, v]) => {
                penalty[k] = Number(penalty[k] || 0) + Number(v || 0);
            });
        };
        applyPart("leg", { dex: 5, evadeRate: 0.08 });
        applyPart("arm", { str: 4, hitRate: 0.1 });
        applyPart("head", { mental: 6, skipTurnChance: 0.18 });
        applyPart("torso", { end: 5, evadeRate: 0.03 });
        if (state.scarCount > 0) {
            penalty.charm += state.scarCount;
            penalty.intimidation += Math.min(6, state.scarCount * 2);
        }
        return penalty;
    }

    getHeadInjurySkipChance() {
        return Number(this.getInjuryPenaltyProfile()?.skipTurnChance || 0);
    }

    applyCombatInjury(trigger = {}) {
        const damage = Math.max(0, Number(trigger.damage || 0));
        const maxHp = Math.max(1, Number(this.maxHp || 1));
        const damageRate = damage / maxHp;
        const forced = Boolean(trigger.force);
        const baseChance = clampNumber((damageRate * 0.95) + (forced ? 0.4 : 0), 0, 0.9);
        if (!forced && Math.random() >= baseChance) return null;

        const partPool = ["leg", "arm", "head", "torso"];
        const pickedPart = partPool[Math.floor(Math.random() * partPool.length)];
        const severity = damageRate >= 0.35 ? "major" : "minor";
        const state = this.ensureInjuryState();
        const prev = state[pickedPart];
        const nextValue = {
            severity,
            source: trigger.source || "전투",
            timestamp: Date.now()
        };
        state[pickedPart] = nextValue;
        if (prev && prev.severity === "minor" && severity === "major") {
            state.scarCount = Math.max(0, Number(state.scarCount || 0) + 1);
        }

        const partNameMap = {
            leg: "다리",
            arm: "팔",
            head: "머리",
            torso: "흉부"
        };
        const descMap = {
            leg: "이동과 회피가 둔화됩니다.",
            arm: "공격력/명중이 저하됩니다.",
            head: "행동 중 멍때림 위험이 증가합니다.",
            torso: "지구력 기반 유지력이 저하됩니다."
        };
        this.cb?.logMessage?.(`[부상] ${partNameMap[pickedPart]} 부상(${severity === "major" ? "중상" : "경상"}) 발생. ${descMap[pickedPart]}`);
        this.calculateStats?.();
        return { part: pickedPart, severity };
    }

    clearInjury(part = "", reason = "치료") {
        const keyMap = {
            leg: "leg",
            arm: "arm",
            head: "head",
            torso: "torso",
            다리: "leg",
            팔: "arm",
            머리: "head",
            흉부: "torso"
        };
        const mapped = keyMap[String(part || "").trim()] || "";
        if (!mapped) return false;
        const state = this.ensureInjuryState();
        if (!state[mapped]) return false;
        const severityRaw = state[mapped]?.severity;
        const scarGain = (severityRaw === "major" || Number(severityRaw) >= 3) ? 2 : 1;
        state[mapped] = null;
        state.scarCount = Math.max(0, Number(state.scarCount || 0) + scarGain);
        this.cb?.logMessage?.(`[치료] ${part} 부상이 회복되었습니다. 흉터 +${scarGain} (${reason})`);
        this.calculateStats?.();
        return true;
    }

    clearAllInjuries(reason = "치료") {
        const state = this.ensureInjuryState();
        let cleared = 0;
        let scarGain = 0;
        ["leg", "arm", "head", "torso"].forEach((part) => {
            if (state[part]) {
                const severityRaw = state[part]?.severity;
                scarGain += (severityRaw === "major" || Number(severityRaw) >= 3) ? 2 : 1;
                state[part] = null;
                cleared += 1;
            }
        });
        if (cleared > 0) {
            state.scarCount = Math.max(0, Number(state.scarCount || 0) + scarGain);
            this.cb?.logMessage?.(`[치료] 부상 ${cleared}건을 정리했습니다. 흉터 +${scarGain} (${reason})`);
            this.calculateStats?.();
        }
        return cleared;
    }

    ensureReputationProfile() {
        if (!this.reputationProfile || typeof this.reputationProfile !== "object") {
            this.reputationProfile = { coward: 0, busDriver: 0, shameless: 0, labels: [] };
        }
        this.reputationProfile.coward = Math.max(0, Number(this.reputationProfile.coward || 0));
        this.reputationProfile.busDriver = Math.max(0, Number(this.reputationProfile.busDriver || 0));
        this.reputationProfile.shameless = Math.max(0, Number(this.reputationProfile.shameless || 0));
        this.reputationProfile.labels = Array.isArray(this.reputationProfile.labels) ? this.reputationProfile.labels : [];
        return this.reputationProfile;
    }

    refreshBehaviorReputationLabels() {
        const rep = this.ensureReputationProfile();
        const labels = [];
        if (rep.coward >= 8) labels.push("겁쟁이");
        if (rep.shameless >= 8) labels.push("파렴치한");
        if (rep.busDriver >= 8) labels.push("버스기사");
        rep.labels = labels;
        return labels;
    }

    addBehaviorReputation(kind = "", amount = 1, reason = "") {
        const rep = this.ensureReputationProfile();
        const keyMap = {
            coward: "coward",
            겁쟁이: "coward",
            bus: "busDriver",
            busDriver: "busDriver",
            버스기사: "busDriver",
            shameless: "shameless",
            파렴치한: "shameless"
        };
        const key = keyMap[String(kind || "").trim()] || "";
        if (!key) return rep;
        const delta = Math.max(0, Math.floor(Number(amount || 0)));
        if (delta <= 0) return rep;
        rep[key] = Math.max(0, Number(rep[key] || 0) + delta);
        this.refreshBehaviorReputationLabels();
        if (reason) {
            this.cb?.logMessage?.(`[행동 평판] ${kind} +${delta} (${reason})`);
        }
        return rep;
    }

    getBehaviorReputationValue(kind = "") {
        const rep = this.ensureReputationProfile();
        const keyMap = {
            coward: "coward",
            busDriver: "busDriver",
            shameless: "shameless",
            겁쟁이: "coward",
            버스기사: "busDriver",
            파렴치한: "shameless"
        };
        const key = keyMap[String(kind || "").trim()] || "";
        return key ? Number(rep[key] || 0) : 0;
    }

    canRecruitEliteCompanion() {
        const rep = this.ensureReputationProfile();
        return rep.coward < 8 && rep.shameless < 8;
    }

    getRecruitmentReputationGrade() {
        const rep = this.ensureReputationProfile();
        if (rep.coward >= 10 || rep.shameless >= 10) return "blacklist";
        if (rep.coward >= 8 || rep.shameless >= 8) return "poor";
        if (rep.busDriver >= 10 && rep.coward <= 3 && rep.shameless <= 3) return "excellent";
        return "normal";
    }

    beginCombatMetrics() {
        this.combatMetrics = {
            damageTaken: 0,
            kills: 0,
            ranAway: false,
            allyDeaths: 0
        };
        return this.combatMetrics;
    }

    recordCombatMetric(key, delta = 1) {
        if (!this.combatMetrics) this.beginCombatMetrics();
        if (!Object.prototype.hasOwnProperty.call(this.combatMetrics, key)) return;
        this.combatMetrics[key] = Math.max(0, Number(this.combatMetrics[key] || 0) + Number(delta || 0));
    }

    finalizeCombatReputationOnVictory() {
        const metrics = this.combatMetrics;
        if (!metrics) return;
        if (Number(metrics.ranAway || 0) > 0) {
            this.addBehaviorReputation("겁쟁이", 2, "전투 이탈");
        }
        if ((Number(metrics.kills || 0) >= 2) || Number(metrics.damageTaken || 0) >= Math.max(1, Math.floor(this.maxHp * 0.45))) {
            this.addBehaviorReputation("버스기사", 1, "전투 기여");
        }
        if (Number(metrics.allyDeaths || 0) > 0) {
            this.addBehaviorReputation("파렴치한", 1, "동료 손실 상황");
        }
    }

    getLodgingRecoveryMultiplier() {
        const eco = this.economyState || {};
        const tier = String(eco.lodgingTier || "standard");
        const baseByTier = {
            luxury: 1.15,
            standard: 1.0,
            poor: 0.82,
            squalid: 0.65
        };
        let rate = Number(baseByTier[tier] || 1.0);
        if (Number(eco.recoveryPenaltyDays || 0) > 0) rate -= 0.16;
        return clampNumber(rate, 0.45, 1.25);
    }

    setLodgingTier(nextTier = "standard") {
        const allowed = ["luxury", "standard", "poor", "squalid"];
        const eco = this.economyState || (this.economyState = {});
        if (!allowed.includes(nextTier)) return;
        const prev = String(eco.lodgingTier || "standard");
        eco.lodgingTier = nextTier;
        if (prev !== nextTier) {
            this.cb?.logMessage?.(`[도시 생존] 숙소 등급이 ${prev} -> ${nextTier}로 변경되었습니다.`);
        }
    }

    downgradeLodgingTier() {
        const order = ["luxury", "standard", "poor", "squalid"];
        const eco = this.economyState || (this.economyState = {});
        const current = String(eco.lodgingTier || "standard");
        const idx = order.indexOf(current);
        const next = order[Math.min(order.length - 1, Math.max(0, idx) + 1)] || "squalid";
        this.setLodgingTier(next);
    }

    getDailyUpkeepProfile() {
        const partyCount = Array.isArray(this.party) ? this.party.length : 0;
        const headCount = 1 + partyCount;
        const equippedCount = Object.values(this.equipment || {}).filter(Boolean).length;
        const eco = this.economyState || {};
        const lodgingTier = String(eco.lodgingTier || "standard");
        const lodgingBase = {
            luxury: 260,
            standard: 130,
            poor: 70,
            squalid: 30
        };
        const pollTax = 45 * headCount;
        const lodging = Number(lodgingBase[lodgingTier] || lodgingBase.standard);
        const repair = 60 + (equippedCount * 18) + Math.floor((Number(this.level || 1) * 7));
        const total = pollTax + lodging + repair;
        return { pollTax, lodging, repair, total, lodgingTier };
    }

    getMonthlyUpkeepProfile() {
        const partyCount = Array.isArray(this.party) ? this.party.length : 0;
        const headCount = 1 + partyCount;
        const civicTax = 320 + (headCount * 90);
        const guildFee = 180 + Math.floor(Number(this.level || 1) * 22);
        return {
            civicTax,
            guildFee,
            total: civicTax + guildFee
        };
    }

    applyMonetaryUpkeep(totalCost = 0, label = "유지비") {
        const total = Math.max(0, Math.floor(Number(totalCost || 0)));
        const eco = this.economyState || (this.economyState = {});
        if (total <= 0) return { paidAmount: 0, shortage: 0, paid: true };

        let required = total;
        let paidAmount = 0;

        const wallet = Math.max(0, Math.floor(Number(this.gold || 0)));
        if (wallet > 0) {
            const pay = Math.min(required, wallet);
            this.gold -= pay;
            required -= pay;
            paidAmount += pay;
        }

        const bank = Math.max(0, Math.floor(Number(this.bankGold || 0)));
        if (required > 0 && bank > 0) {
            const pay = Math.min(required, bank);
            this.bankGold -= pay;
            required -= pay;
            paidAmount += pay;
        }

        const shortage = Math.max(0, required);
        if (shortage > 0) {
            eco.taxDebt = Math.max(0, Math.floor(Number(eco.taxDebt || 0) + shortage));
            eco.delinquency = Math.max(0, Number(eco.delinquency || 0) + 1);
            eco.recoveryPenaltyDays = Math.max(Number(eco.recoveryPenaltyDays || 0), 2);
            this.downgradeLodgingTier();
            this.cb?.logMessage?.(`[도시 생존] ${label} ${total.toLocaleString()} 중 ${paidAmount.toLocaleString()}만 납부했습니다. 체납 ${shortage.toLocaleString()} 발생.`);
        } else {
            eco.delinquency = Math.max(0, Number(eco.delinquency || 0) - 1);
            if (Number(eco.taxDebt || 0) > 0) {
                const spare = Math.max(0, Math.floor(Number(this.gold || 0) * 0.25));
                if (spare > 0) {
                    const repay = Math.min(spare, Number(eco.taxDebt || 0));
                    this.gold -= repay;
                    eco.taxDebt = Math.max(0, Number(eco.taxDebt || 0) - repay);
                    if (repay > 0) {
                        this.cb?.logMessage?.(`[도시 생존] 체납금 ${repay.toLocaleString()}를 추가로 상환했습니다.`);
                    }
                }
            }
        }

        eco.upkeepLedger = Array.isArray(eco.upkeepLedger) ? eco.upkeepLedger : [];
        eco.upkeepLedger.push({
            label,
            total,
            paidAmount,
            shortage,
            day: Number(eco.day || 1),
            month: Number(eco.month || 1)
        });
        if (eco.upkeepLedger.length > 18) eco.upkeepLedger.shift();

        return { paidAmount, shortage, paid: shortage <= 0 };
    }

    applyDailyUpkeep(reason = "도시 생활비") {
        const profile = this.getDailyUpkeepProfile();
        const result = this.applyMonetaryUpkeep(profile.total, "일일 생활비");
        if (result.paid) {
            this.cb?.logMessage?.(`[도시 생존] 일일 정산 완료 (${reason}): 인두세 ${profile.pollTax}, 숙박 ${profile.lodging}, 수리비 ${profile.repair}.`);
        }

        const eco = this.economyState || {};
        if (Number(eco.recoveryPenaltyDays || 0) > 0) {
            eco.recoveryPenaltyDays = Math.max(0, Number(eco.recoveryPenaltyDays || 0) - 1);
        }
    }

    applyHalfYearTax(reason = "반년 세금 정산") {
        const eco = this.economyState || (this.economyState = {});
        const taxAmount = 20000;
        let remaining = taxAmount;
        let paid = 0;

        const wallet = Math.max(0, Math.floor(Number(this.gold || 0)));
        if (wallet > 0) {
            const pay = Math.min(wallet, remaining);
            this.gold -= pay;
            remaining -= pay;
            paid += pay;
        }

        const bank = Math.max(0, Math.floor(Number(this.bankGold || 0)));
        if (remaining > 0 && bank > 0) {
            const pay = Math.min(bank, remaining);
            this.bankGold -= pay;
            remaining -= pay;
            paid += pay;
        }

        if (remaining > 0) {
            this.cb?.logMessage?.(`[세금] 반년 세금 ${taxAmount.toLocaleString()} 스톤 납부 실패. 미납 ${remaining.toLocaleString()} 스톤.`);
            this.triggerTaxExecution(`반년 세금 미납 (${reason})`);
            return { paid: false, paidAmount: paid, shortage: remaining };
        }

        this.cb?.logMessage?.(`[세금] 반년 세금 ${taxAmount.toLocaleString()} 스톤을 납부했습니다. (${reason})`);
        return { paid: true, paidAmount: paid, shortage: 0 };
    }

    triggerTaxExecution(reason = "세금 미납") {
        if (this._executionTriggered) return;
        this._executionTriggered = true;
        this.hp = 0;
        this.inCombat = false;
        this.currentMonster = null;
        this.cb?.logMessage?.(`[사형 집행] ${reason}. 즉시 처형되었습니다.`);
        this.showStatus?.();
        setTimeout(() => {
            location.reload();
        }, 2600);
    }

    applyMonthlyUpkeep(reason = "월말 정산") {
        const profile = this.getMonthlyUpkeepProfile();
        const result = this.applyMonetaryUpkeep(profile.total, "월간 인두세/행정비");
        if (result.paid) {
            this.cb?.logMessage?.(`[도시 생존] 월말 정산 완료 (${reason}): 월세금 ${profile.total.toLocaleString()} 납부.`);
        } else {
            this.cb?.logMessage?.("[도시 생존] 월간 세금 체납으로 신용이 하락했습니다.");
        }
    }

    advanceWorldTime(hours = 1, reason = "시간 경과") {
        if (!this.timeSystemEnabled) {
            const eco = this.economyState || {};
            return {
                advanced: 0,
                daysPassed: 0,
                day: Math.max(1, Number(eco.day || 1)),
                month: Math.max(1, Number(eco.month || 1)),
                year: Math.max(1, Number(eco.year || 1))
            };
        }

        let step = Math.floor(Number(hours || 0));
        if (!Number.isFinite(step) || step <= 0) return { advanced: 0, daysPassed: 0 };

        const eco = this.economyState || (this.economyState = {});
        eco.year = Math.max(1, Number(eco.year || 1));
        eco.day = Math.max(1, Number(eco.day || 1));
        eco.month = Math.max(1, Number(eco.month || 1));
        eco.hoursInDay = Math.max(1, Number(eco.hoursInDay || 24));
        eco.daysPerMonth = Math.max(7, Number(eco.daysPerMonth || 25));
        eco.monthsPerYear = Math.max(1, Number(eco.monthsPerYear || 13));
        eco.halfYearMonths = Math.max(1, Number(eco.halfYearMonths || 6));
        eco.nextHalfYearDueInMonths = Math.max(1, Number(eco.nextHalfYearDueInMonths || eco.halfYearMonths));

        this.worldTimeHours = Math.max(0, Number(this.worldTimeHours || 0)) + step;
        let dayPassed = 0;

        while (this.worldTimeHours >= eco.hoursInDay) {
            this.worldTimeHours -= eco.hoursInDay;
            eco.day += 1;
            dayPassed += 1;
            this.daysInLabyrinth = Math.max(1, Number(this.daysInLabyrinth || 1) + 1);

            this.applyDailyUpkeep(reason);
            const marketUpdate = this.livingWorld?.onDayPassed?.({
                day: eco.day,
                month: eco.month,
                year: eco.year
            });
            if (marketUpdate?.headline) {
                this.cb?.logMessage?.(`[시세] ${marketUpdate.headline}`);
            }
            if (this.livingWorld?.simulateTurn) {
                this.livingWorld.simulateTurn({
                    currentLayer: this.currentLayer,
                    localPredators: Array.isArray(this.mapManager?.activeMonsters) ? this.mapManager.activeMonsters.length : 0,
                    localPrey: Math.max(
                        0,
                        Number(this.mapManager?.currentMap?.monsterDensity || 0) -
                        (Array.isArray(this.mapManager?.activeMonsters) ? this.mapManager.activeMonsters.length : 0)
                    ),
                    corpseCount: Array.isArray(this.mapManager?.corpses) ? this.mapManager.corpses.length : 0
                });
            }

            if (eco.day > eco.daysPerMonth) {
                eco.day = 1;
                eco.month += 1;
                if (eco.month > eco.monthsPerYear) {
                    eco.month = 1;
                    eco.year += 1;
                }
                this.applyMonthlyUpkeep(reason);
                eco.nextHalfYearDueInMonths = Math.max(0, Number(eco.nextHalfYearDueInMonths || eco.halfYearMonths) - 1);
                if (eco.nextHalfYearDueInMonths <= 0) {
                    const taxResult = this.applyHalfYearTax(reason);
                    eco.nextHalfYearDueInMonths = Math.max(1, Number(eco.halfYearMonths || 6));
                    if (!taxResult.paid || this._executionTriggered) {
                        break;
                    }
                }
            }
        }

        if (!this._executionTriggered) {
            this.mapManager?.onWorldTimeAdvanced?.({
                hoursAdvanced: step,
                reason
            });
        }

        return {
            advanced: step,
            daysPassed: dayPassed,
            day: eco.day,
            month: eco.month,
            year: eco.year
        };
    }

    ensureCompanionBehavior(member) {
        if (!member) return null;
        if (!member.personalityTags) {
            const gradeWeight = clampNumber((10 - Number(member.grade || 9)) * 6, 0, 40);
            member.personalityTags = {
                greed: Math.floor(30 + gradeWeight + (Math.random() * 40)),
                fear: Math.floor(25 + (Math.random() * 55)),
                faith: Math.floor(20 + (Math.random() * 60))
            };
        }
        if (!Number.isFinite(Number(member.hiddenLoyalty))) {
            const temperamentBonus = String(member.trait || "") === "신관" ? 14 : 0;
            member.hiddenLoyalty = clampNumber(50 + temperamentBonus + (Math.random() * 32), 10, 98);
        }
        if (!member.moraleState) {
            member.moraleState = {
                panicCooldown: 0,
                greedCooldown: 0
            };
        }
        return member;
    }

    registerCompanion(member, source = "계약") {
        const ensured = this.ensureCompanionBehavior(member);
        if (!ensured) return null;
        const loyalty = Math.round(Number(ensured.hiddenLoyalty || 0));
        this.cb?.logMessage?.(`[동료] ${ensured.name}: 숨은 충성도 ${loyalty}, 성향 태그(탐욕/공포/신의) 설정 완료. (${source})`);
        return ensured;
    }

    changeCompanionLoyalty(member, delta = 0, reason = "") {
        if (!member || !Number.isFinite(delta) || delta === 0) return Number(member?.hiddenLoyalty || 0);
        this.ensureCompanionBehavior(member);
        const before = Number(member.hiddenLoyalty || 0);
        const next = clampNumber(before + delta, 0, 100);
        member.hiddenLoyalty = next;
        if (reason) {
            this.cb?.logMessage?.(`[동료 충성도] ${member.name} ${delta > 0 ? "+" : ""}${Math.round(delta)} (${reason}) -> ${Math.round(next)}`);
        }
        return next;
    }

    applyBarbarianSpeechBond(baseDelta = 1, reason = "바바리안 화법") {
        if (!this.isLowIntelligence()) return 0;
        const party = Array.isArray(this.party) ? this.party : [];
        let affected = 0;
        party.forEach((member) => {
            const race = this.normalizeRaceId(member?.race);
            const trait = String(member?.trait || "");
            if (race !== "barbarian" && trait !== "전사") return;
            this.changeCompanionLoyalty(member, baseDelta, reason);
            affected += 1;
        });
        return affected;
    }

    getPartyAverageHpRate() {
        const members = [this, ...(Array.isArray(this.party) ? this.party : [])]
            .filter((m) => m && Number(m.maxHp || 0) > 0);
        if (members.length === 0) return 1;
        const sum = members.reduce((acc, member) => {
            const rate = clampNumber(Number(member.hp || 0) / Math.max(1, Number(member.maxHp || 1)), 0, 1);
            return acc + rate;
        }, 0);
        return sum / members.length;
    }

    processCompanionPanic(context = "위기 상황") {
        if (!Array.isArray(this.party) || this.party.length === 0) return null;
        const avgHpRate = this.getPartyAverageHpRate();
        if (avgHpRate > 0.45) return null;

        const candidates = [];
        this.party.forEach((member, index) => {
            if (!member || Number(member.hp || 0) <= 0) return;
            this.ensureCompanionBehavior(member);
            const fear = Number(member.personalityTags?.fear || 0);
            const loyalty = Number(member.hiddenLoyalty || 0);
            const cooldown = Number(member.moraleState?.panicCooldown || 0);
            if (cooldown > 0) {
                member.moraleState.panicCooldown = Math.max(0, cooldown - 1);
                return;
            }
            const chance = clampNumber(
                ((fear - 52) / 92) +
                ((0.42 - avgHpRate) * 1.6) +
                ((58 - loyalty) / 145),
                0,
                0.78
            );
            if (chance > 0 && Math.random() < chance) {
                candidates.push({ index, member, chance });
            }
        });
        if (candidates.length === 0) return null;

        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        const runaway = this.party.splice(picked.index, 1)[0];
        if (runaway?.moraleState) runaway.moraleState.panicCooldown = 6;
        this.cb?.logMessage?.(`[동료 공포] ${runaway.name}이(가) ${context} 중 공포에 무너져 도주했습니다.`);
        return runaway;
    }

    getItemDataByName(itemName) {
        if (!itemName) return null;
        return (
            this.gameData?.items?.[itemName] ||
            this.gameData?.numbersItems?.[itemName] ||
            this.gameData?.shopItems?.[itemName] ||
            this.gameData?.materials?.[itemName] ||
            null
        );
    }

    getEquipmentSlotByItem(itemName) {
        const itemData = this.getItemDataByName(itemName);
        const rawType = String(itemData?.type || "");
        if (!rawType) return null;
        if (["검", "창", "횃불", "둔기", "활", "클로", "몽둥이", "장검", "철퇴"].includes(rawType)) return "무기";
        if (["방패", "시계"].includes(rawType)) return "부무기";
        if (["부츠"].includes(rawType)) return "각반";
        const accessoryMap = {
            목걸이: "목걸이",
            반지: "반지",
            팔찌: "팔찌",
            "팔목 보호대": "팔찌",
            귀걸이: "귀걸이",
            벨트: "벨트",
            부적: "부적",
            토큰: "토큰",
            마도구: "마도구",
            가면: "가면",
            원판: "부적",
            함정: "마도구",
            장비: "부적",
            가방: "부적"
        };
        if (Object.prototype.hasOwnProperty.call(accessoryMap, rawType)) return accessoryMap[rawType];
        if (Object.prototype.hasOwnProperty.call(this.equipment || {}, rawType)) return rawType;
        return null;
    }

    getEquippedItemNames() {
        return Object.values(this.equipment || {}).filter(Boolean);
    }

    hasEquippedItem(itemName) {
        if (!itemName) return false;
        return this.getEquippedItemNames().includes(itemName);
    }

    isEquipmentItem(itemName) {
        return Boolean(this.getEquipmentSlotByItem(itemName));
    }

    isItemIdentified(itemName) {
        if (!this.isEquipmentItem(itemName)) return true;
        return Boolean(this.itemIdentity?.identified?.[itemName]);
    }

    getItemIdentityState(itemName) {
        if (!itemName || !this.isEquipmentItem(itemName)) return null;
        this.itemIdentity = this.itemIdentity || { identified: {}, mystery: {}, cursedSlots: {}, blessedSlots: {} };
        this.itemIdentity.mystery = this.itemIdentity.mystery || {};
        this.itemIdentity.identified = this.itemIdentity.identified || {};

        if (!this.itemIdentity.mystery[itemName]) {
            const itemData = this.getItemDataByName(itemName) || {};
            const price = Number(itemData.price || 0);
            const tier = Number(itemData.tier || 9);
            const rarityBoost = price >= 18000 ? 0.08 : 0;
            const curseChance = clampNumber(0.12 + ((10 - tier) * 0.015) + rarityBoost, 0.08, 0.38);
            const cursed = Math.random() < curseChance;
            const blessed = !cursed && Math.random() < clampNumber(0.14 - (curseChance * 0.3), 0.04, 0.16);
            this.itemIdentity.mystery[itemName] = {
                isCursed: cursed,
                isBlessed: blessed,
                cursePower: 1 + Math.floor(Math.random() * 3),
                blessPower: 1 + Math.floor(Math.random() * 2)
            };
        }
        const state = this.itemIdentity.mystery[itemName];
        return {
            ...state,
            identified: this.isItemIdentified(itemName)
        };
    }

    identifyItem(itemName, source = "감정") {
        if (!itemName || !this.isEquipmentItem(itemName)) return false;
        this.itemIdentity = this.itemIdentity || { identified: {}, mystery: {}, cursedSlots: {}, blessedSlots: {} };
        this.itemIdentity.identified = this.itemIdentity.identified || {};
        this.getItemIdentityState(itemName);
        if (this.itemIdentity.identified[itemName]) return false;
        this.itemIdentity.identified[itemName] = true;
        const state = this.itemIdentity?.mystery?.[itemName];
        if (state?.isCursed) {
            this.cb?.logMessage?.(`[감정] ${itemName}: 저주된 장비로 판정되었습니다. (${source})`);
        } else if (state?.isBlessed) {
            this.cb?.logMessage?.(`[감정] ${itemName}: 축복받은 장비로 판정되었습니다. (${source})`);
        } else {
            this.cb?.logMessage?.(`[감정] ${itemName}: 특이한 저주/축복 반응이 없습니다. (${source})`);
        }
        return true;
    }

    identifyRandomUnidentifiedItem(source = "감정") {
        const candidates = [];
        (this.inventory || []).forEach((itemName) => {
            if (this.isEquipmentItem(itemName) && !this.isItemIdentified(itemName)) {
                candidates.push(itemName);
            }
        });
        Object.values(this.equipment || {}).forEach((itemName) => {
            if (itemName && this.isEquipmentItem(itemName) && !this.isItemIdentified(itemName)) {
                candidates.push(itemName);
            }
        });
        if (candidates.length === 0) return null;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        this.identifyItem(pick, source);
        return pick;
    }

    applyEquipmentMysteryOnEquip(itemName, slot) {
        if (!itemName || !slot || !this.isEquipmentItem(itemName)) return;
        this.itemIdentity = this.itemIdentity || { identified: {}, mystery: {}, cursedSlots: {}, blessedSlots: {} };
        this.itemIdentity.cursedSlots = this.itemIdentity.cursedSlots || {};
        this.itemIdentity.blessedSlots = this.itemIdentity.blessedSlots || {};

        const state = this.getItemIdentityState(itemName);
        if (!state) return;

        if (!this.isItemIdentified(itemName)) {
            this.identifyItem(itemName, "미감정 장착");
        }
        if (state.isCursed) {
            this.itemIdentity.cursedSlots[slot] = { itemName, power: Number(state.cursePower || 1) };
            delete this.itemIdentity.blessedSlots[slot];
            this.cb?.logMessage?.(`[저주] ${itemName}이(가) 신체에 달라붙어 해제가 불가능해졌습니다.`);
        } else if (state.isBlessed) {
            this.itemIdentity.blessedSlots[slot] = { itemName, power: Number(state.blessPower || 1) };
            delete this.itemIdentity.cursedSlots[slot];
            this.cb?.logMessage?.(`[축복] ${itemName}에서 안정적인 보강 반응이 감지됩니다.`);
        } else {
            delete this.itemIdentity.cursedSlots[slot];
            delete this.itemIdentity.blessedSlots[slot];
        }
    }

    canUnequipSlot(slot) {
        const itemName = this.equipment?.[slot];
        if (!itemName) return true;
        const cursed = this.itemIdentity?.cursedSlots?.[slot];
        if (cursed && cursed.itemName === itemName) {
            this.cb?.logMessage?.(`[저주] ${itemName}은(는) 저주로 인해 해제할 수 없습니다. 감정소 정화가 필요합니다.`);
            return false;
        }
        return true;
    }

    clearCursedBinding(slot, reason = "정화") {
        if (!slot) return false;
        if (!this.itemIdentity?.cursedSlots?.[slot]) return false;
        const itemName = this.itemIdentity.cursedSlots[slot].itemName;
        delete this.itemIdentity.cursedSlots[slot];
        this.cb?.logMessage?.(`[정화] ${itemName}의 저주 고정이 해제되었습니다. (${reason})`);
        return true;
    }

    getItemRarityScore(itemName, itemData = null) {
        const data = itemData || this.getItemDataByName(itemName) || {};
        let score = 0;
        if (this.gameData?.numbersItems?.[itemName]) score += 3;
        const tier = Number(data.tier || 9);
        if (tier <= 3) score += 2;
        else if (tier <= 5) score += 1;
        const price = Number(data.price || 0);
        if (price >= 20000) score += 2;
        else if (price >= 8000) score += 1;
        if (/(희귀|전설|넘버스|고대|신화)/.test(String(itemName || ""))) score += 1;
        return score;
    }

    processRareLootGreedEvent(itemName, rarityScore = 0) {
        if (!Array.isArray(this.party) || this.party.length === 0) return false;
        if (rarityScore < 2) return false;

        const candidates = [];
        this.party.forEach((member, index) => {
            this.ensureCompanionBehavior(member);
            const greed = Number(member.personalityTags?.greed || 0);
            const loyalty = Number(member.hiddenLoyalty || 0);
            const cooldown = Number(member.moraleState?.greedCooldown || 0);
            if (cooldown > 0) {
                member.moraleState.greedCooldown = Math.max(0, cooldown - 1);
                return;
            }
            if (greed < 58 || loyalty > 72) return;
            const triggerChance = clampNumber(
                ((greed - 55) / 95) +
                ((rarityScore - 2) * 0.13) +
                ((65 - loyalty) / 130),
                0,
                0.8
            );
            if (Math.random() < triggerChance) {
                candidates.push({ index, member, chance: triggerChance });
            }
        });
        if (candidates.length === 0) return false;

        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        const traitor = this.party[picked.index];
        if (!traitor) return false;

        const theft = Math.random() < 0.62;
        if (theft) {
            const idx = this.inventory.indexOf(itemName);
            if (idx >= 0) this.inventory.splice(idx, 1);
            this.party.splice(picked.index, 1);
            this.cb?.logMessage?.(`[배신] ${traitor.name}이(가) ${itemName}(을)를 훔쳐 도주했습니다.`);
        } else {
            const dmg = 22 + Math.floor(Math.random() * (14 + rarityScore * 4));
            this.party.splice(picked.index, 1);
            helpers.safeHpUpdate(this, -dmg, { isSkillHit: true });
            this.cb?.logMessage?.(`[배신] ${traitor.name}이(가) 희귀 전리품을 노리고 공격 후 이탈했습니다. (${dmg} 피해)`);
        }
        if (traitor?.moraleState) traitor.moraleState.greedCooldown = 8;
        return true;
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

        const raceExpBonus = Number(this.getRaceBalanceProfile(this.race)?.expGainMultiplier || 1);
        if (raceExpBonus > 0 && raceExpBonus !== 1) {
            expGained = Math.floor(expGained * raceExpBonus);
        }

        const traitExpGain = Number(this.traitBonuses?.derived?.expGainRate || 0);
        if (traitExpGain > 0) {
            expGained = Math.max(1, Math.floor(expGained * (1 + traitExpGain)));
        }

        expGained = Math.max(1, Math.floor(expGained * this.getExpGainMultiplier()));
        this.cb?.logMessage?.(`성장 가속으로 최종 경험치 ${expGained}를 획득합니다.`);

        this.exp += expGained;
        this.party.forEach(member => member.gainExp(expGained)); 

        const maxLevel = Number(this.gameData?.maxLevelModded || 999);
        while (this.level < maxLevel) {
            const requiredExp = this.getRequiredExpForLevel(this.level);
            if (!Number.isFinite(requiredExp) || this.exp < requiredExp) break;
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
        this.gainTraitPoints(3, "레벨 업");
        
        this.calculateStats(); 
        this.updateGrade();
        this.hp = this.maxHp;
        this.mp = this.maxMp;
        this.stamina = this.maxStamina;

        const maxEssences = this.getMaxEssenceCapacity(this.level);
        this.cb?.logMessage?.(`레벨 업! ${this.level} 레벨이 되었다! 영혼력이 상승하고, 최대 흡수 가능 정수가 ${maxEssences}개로 증가했다. (특성 포인트 +3)`);
        this.cb?.playSfx?.('sfx-event');
    }

    addEssence(essenceName) {
        const maxEssences = this.getMaxEssenceCapacity(this.level);
        
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
        const itemData = this.getItemDataByName(itemName);
        
        if (!itemData) {
            this.cb?.logMessage?.(`[${itemName}] 아이템 정보를 찾을 수 없습니다.`);
            return;
        }
        
        const slot = this.getEquipmentSlotByItem(itemName);
        if (!slot || !this.equipment.hasOwnProperty(slot)) {
            this.cb?.logMessage?.(`[${itemName}] (은)는 장착할 수 없는 아이템 타입입니다.`);
            return;
        }

        if (this.equipment?.[slot] && !this.canUnequipSlot(slot)) {
            return;
        }

        this.unequipItem(slot); 
        
        this.equipment[slot] = itemName;

        const index = this.inventory.indexOf(itemName);
        if (index > -1) this.inventory.splice(index, 1);

        this.applyEquipmentMysteryOnEquip(itemName, slot);
        if (itemName === "시체술사의 기만") {
            this.corpseDeceiverCharges = 3;
        }
        
        this.cb?.logMessage?.(`${itemName}을(를) ${slot} 부위에 장착했다.`);
        this.cb?.playSfx?.('sfx-event');
        this.calculateStats(); 
        this.showStatus(); 
    }

    unequipItem(slot) {
        const oldItem = this.equipment[slot];
        if (oldItem) {
            if (!this.canUnequipSlot(slot)) return;
            this.inventory.push(oldItem); 
            this.equipment[slot] = null;
            if (oldItem === "시체술사의 기만") {
                this.corpseDeceiverCharges = 0;
            }
            if (this.itemIdentity?.blessedSlots?.[slot]?.itemName === oldItem) {
                delete this.itemIdentity.blessedSlots[slot];
            }
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

        if (this.isEquipmentItem(item)) {
            this.getItemIdentityState(item);
            if (!this.itemIdentity?.identified?.[item]) {
                this.cb?.logMessage?.(`[미감정] ${item}의 정확한 성능은 감정 전까지 알 수 없습니다.`);
            }
        }

        const rarityScore = this.getItemRarityScore(item, this.getItemDataByName(item));
        if (rarityScore >= 2) {
            this.processRareLootGreedEvent(item, rarityScore);
        }
        
        this.questManager?.checkProgress?.('COLLECT', item, 1);
        
        this.showStatus(); 
    }

    getNpcAffinity(npcName) {
        if (!npcName) return 0;
        return Number(this.npcAffinity?.[npcName] || 0);
    }

    getNpcAffinityActionState(npcName) {
        if (!npcName) return null;
        if (!this.npcAffinityActionState) this.npcAffinityActionState = {};
        if (!this.npcAffinityActionState[npcName]) {
            this.npcAffinityActionState[npcName] = {
                lastReason: "",
                reasonGain: {},
                reasonUses: {}
            };
        }
        return this.npcAffinityActionState[npcName];
    }

    changeNpcAffinity(npcName, delta = 0, reason = "") {
        if (!npcName || !Number.isFinite(delta) || delta === 0) return 0;
        this.cityActionTick = (this.cityActionTick || 0) + 1;

        const state = this.getNpcAffinityActionState(npcName);
        const reasonKey = String(reason || "일반 상호작용")
            .trim()
            .replace(/\s+/g, " ");
        const gainCapPerReason = 6;
        let appliedDelta = Math.trunc(delta);

        if (state && appliedDelta > 0) {
            const lastReason = String(state.lastReason || "");
            const reasonGain = Number(state.reasonGain?.[reasonKey] || 0);
            const reasonUses = Number(state.reasonUses?.[reasonKey] || 0);
            state.reasonUses[reasonKey] = reasonUses + 1;

            if (lastReason === reasonKey) {
                appliedDelta = 0;
                this.cb?.logMessage?.(`[호감도] ${npcName}: 같은 행동 반복으로 호감도 상승이 차단되었습니다. (${reasonKey})`);
            } else if (reasonGain >= gainCapPerReason) {
                appliedDelta = 0;
                this.cb?.logMessage?.(`[호감도] ${npcName}: [${reasonKey}] 행동으로 올릴 수 있는 호감도 한도에 도달했습니다.`);
            } else {
                appliedDelta = Math.min(appliedDelta, gainCapPerReason - reasonGain);
                state.reasonGain[reasonKey] = reasonGain + Math.max(0, appliedDelta);
            }
        }

        if (!this.npcAffinity) this.npcAffinity = {};
        const current = Number(this.npcAffinity[npcName] || 0);
        const next = Math.max(-100, Math.min(100, current + appliedDelta));
        this.npcAffinity[npcName] = next;

        if (state) state.lastReason = reasonKey;

        if (!this.npcAffinityLog) this.npcAffinityLog = {};
        this.npcAffinityLog[npcName] = Date.now();

        if (reason && next !== current) {
            const sign = next - current >= 0 ? "+" : "";
            this.cb?.logMessage?.(`[호감도] ${npcName} ${sign}${next - current} (${reason}) -> ${next}`);
        }
        return next;
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
