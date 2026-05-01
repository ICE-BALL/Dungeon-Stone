// 파일: main.js
// 역할: 게임의 메인 진입점 (통합 및 초기화)
// 기능 상실 없이 모든 모듈과 데이터 로드

import { Player } from './class_player_core.js';
import { PlayerCombatMethods } from './class_player_combat.js';
import { PlayerWorldMethods } from './class_player_world.js';
import { NPC } from './class_npc.js';
import { loadAllGameData } from './data/loader.js';
import { QuestManager } from './quest_system.js';
import { races, magic, items, numbersItems, npcs } from './data_functional.js';
import { numbersItemsExtended } from './data/numbers_items_extended.js';
import { applySettingsTextExpansion } from './data/settings_text_expansion.js';
import { FactionSystem } from './faction_system.js';
import { LivingWorldSimulator } from './living_world_system.js';
// [신규] 플레이어 고급 시스템
import { ReputationSystem, InjurySystem, ButcherySystem } from './player_advanced_systems.js';
import { EnhancedNPCInteraction, ENHANCED_NPC_PROFILES } from './npc_ai_enhanced.js';

// [신규 Phase 2] 자원 및 확장 시스템
import { MiningSystem } from './mining_system.js';
import { MapEventRenderer } from './exploration_ui_renderer.js';
import { NPCCommerceSystem } from './npc_commerce_system.js';
import { HomesteadSystem } from './homestead_system.js';
import { ExpandedSkillTree } from './expanded_skill_tree.js';
import { CityLocationsSystem } from './city_locations_system.js';

// [신규] 탐험 시스템 및 UI 임포트
import { MapManager } from './exploration_system.js';
import { initExplorationUI, updateExplorationUI, showInteractionPrompt, hideInteractionPrompt, spawnExplorationHitVfx, showRivalLootModal } from './ui_exploration.js';

// [Phase 3] 종족 시스템 임포트
import { RACE_DEFINITIONS } from './data/race_definitions.js';
import { RaceSystem } from './race_system.js';
import { SpiritImprintSystem } from './barbarian_spirit_imprint.js';
import { SpiritBeastSystem } from './beastkin_spirit_beast.js';
import { AuraSystem } from './human_aura_system.js';
import { EngineeringToolkitSystem } from './dwarf_engineering_toolkit.js';
import { ElementalPactSystem } from './fairy_elemental_pact.js';
import { DragonTongueSystem } from './dragonkin_dragon_tongue.js';

// [신규] 맵 데이터 임포트
import { mapsFloors1_3 } from './data/maps_floors_1-3.js';
import { mapsFloors4_6 } from './data/maps_floors_4-6.js';
import { mapsFloors7_10 } from './data/maps_floors_7-10.js';

// [기존] 정수 데이터 임포트
import { essences as essences1_3 } from './data/essences_functional_1-3.js';
import { essences as essences4_6 } from './data/essences_functional_4-6.js';
import { essences as essences7_9 } from './data/essences_functional_7-9.js';
import { essences as essencesExplorationPack } from './data/essences_exploration_pack.js';

// UI 함수 임포트
// [필수] showScreenEffect 포함
import { logMessage, updateStatusBars, showScreenEffect } from './ui_core.js';
import { initRaceSelection, updateMenu, showPortalChoice, showRiftEntryModal, showInventory, showCharacterStatus } from './ui_main.js';
import { updateCombatStatus, updateCombatMenu } from './ui_combat.js';
import { showCityDistricts, showCityLocations, handleCityAction } from './ui_city.js';
import { showParty, showEssencePartyChoice } from './ui_party.js'; 
import { showQuestLog } from './ui_quests.js';


// Player 클래스 Mixin (전투/월드 메서드 병합)
Object.assign(Player.prototype, PlayerCombatMethods);
Object.assign(Player.prototype, PlayerWorldMethods);

// Deep Merge 유틸리티 (데이터 병합용)
function deepMerge(target, source) {
    const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);
    if (!isObject(target) || !isObject(source)) return source;
    const output = Object.assign({}, target);
    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];
        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            if (key === 'active') {
                 output[key] = targetValue.map(targetSkill => {
                    const sourceSkill = sourceValue?.find(s => s.name === targetSkill.name);
                    return sourceSkill ? { ...targetSkill, ...sourceSkill } : targetSkill;
                 });
            } else { output[key] = sourceValue; }
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            output[key] = deepMerge(targetValue, sourceValue);
        } else { output[key] = sourceValue; }
    });
    return output;
}

function mergeEssenceData(targetEssences, sourceEssences) {
    if (!targetEssences || !sourceEssences) return; 
    for (const key in sourceEssences) {
        if (targetEssences.hasOwnProperty(key)) {
            targetEssences[key] = deepMerge(targetEssences[key], sourceEssences[key]);
        } else {
            targetEssences[key] = sourceEssences[key];
        }
    }
}

function stringHash(value) {
    const text = String(value || "");
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function enrichMonsterEssencePools(gameData) {
    if (!gameData?.monsters || !gameData?.essences) return;

    const genericPool = [
        "루멘 와처",
        "심층 정찰자",
        "균열 정박자",
        "탐식의 불씨",
        "공허 공학 포탑",
        "추적 사냥개",
        "장막 파쇄자",
        "유적 추적자",
        "심연 길잡이",
        "환영 인도자",
        "붉은 정찰안",
        "파편 주술사"
    ];

    Object.entries(gameData.monsters).forEach(([monsterName, monsterData]) => {
        const essenceSet = new Set(Array.isArray(monsterData?.essences) ? monsterData.essences : []);
        const grade = Number(monsterData?.grade);
        const hash = stringHash(monsterName);

        if (monsterName.includes("골렘") || monsterName.includes("수호자") || monsterName.includes("기사")) {
            essenceSet.add("공허 공학 포탑");
        }
        if (monsterName.includes("늑대") || monsterName.includes("타이거") || monsterName.includes("사냥")) {
            essenceSet.add("추적 사냥개");
        }
        if (monsterName.includes("램프") || monsterName.includes("정령") || monsterName.includes("페어리") || monsterName.includes("드라이즌")) {
            essenceSet.add("루멘 와처");
        }
        if (monsterName.includes("데드") || monsterName.includes("스켈레톤") || monsterName.includes("구울") || monsterName.includes("망령")) {
            essenceSet.add("균열 정박자");
        }
        if (monsterName.includes("심연") || monsterName.includes("공허") || monsterName.includes("드래곤")) {
            essenceSet.add("심층 정찰자");
        }
        if (monsterName.includes("마녀") || monsterName.includes("환영") || monsterName.includes("정신")) {
            essenceSet.add("환영 인도자");
            essenceSet.add("장막 파쇄자");
        }
        if (monsterName.includes("유적") || monsterName.includes("사제") || monsterName.includes("미믹")) {
            essenceSet.add("유적 추적자");
        }

        const extraCount = Number.isFinite(grade) && grade <= 3 ? 2 : 1;
        for (let i = 0; i < extraCount; i++) {
            essenceSet.add(genericPool[(hash + i) % genericPool.length]);
        }

        monsterData.essences = [...essenceSet].filter(essenceKey => Boolean(gameData.essences?.[essenceKey]));
    });
}

// 음악 관리자
const musicManager = {
    audioElements: {}, 
    currentTrack: null,
    fadeInterval: null, 

    init: function() {
        const audioIds = ['bgm-title', 'bgm-city', 'bgm-dungeon', 'bgm-combat', 'sfx-event'];
        audioIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.audioElements[id] = element;
                element.volume = 0.5; 
            }
        });
    },
    playMusic: async function(trackId) {
        if (!this.audioElements[trackId]) return;
        if (this.currentTrack === trackId && !this.audioElements[trackId].paused) return;
        await this.stopCurrentMusic();
        const track = this.audioElements[trackId];
        track.currentTime = 0;
        track.volume = 0.5; 
        track.play().catch(e => console.warn(`Music play failed: ${e}`));
        this.currentTrack = trackId;
    },
    stopCurrentMusic: function() {
        return new Promise((resolve) => {
            if (this.currentTrack && this.audioElements[this.currentTrack]) {
                const track = this.audioElements[this.currentTrack];
                if (this.fadeInterval) clearInterval(this.fadeInterval);
                this.fadeInterval = setInterval(() => {
                    if (track.volume > 0.05) track.volume -= 0.1;
                    else {
                        clearInterval(this.fadeInterval);
                        track.pause();
                        track.volume = 0.5; 
                        this.currentTrack = null;
                        resolve();
                    }
                }, 50);
            } else { resolve(); }
        });
    },
    playSfx: function(sfxId) {
        if (this.audioElements[sfxId]) {
            const sfx = this.audioElements[sfxId];
            sfx.currentTime = 0;
            sfx.play().catch(() => {});
        }
    }
};


// --- 게임 초기화 ---
async function initGame() {
    let GameData = {};
    
    // 1. JSON 데이터 로드
    try {
        GameData = await loadAllGameData();
    } catch (error) {
        console.error("데이터 로딩 실패", error);
        return;
    }

    // 2. 함수형 데이터 병합
    try {
        Object.assign(GameData.races, races || {});
        Object.assign(GameData.magic, magic || {});
        Object.assign(GameData.items, items || {});
        Object.assign(GameData.numbersItems, numbersItems || {});
        Object.assign(GameData.numbersItems, numbersItemsExtended || {});
        Object.assign(GameData.npcs, npcs || {});
        
        // 정수 데이터 병합
        mergeEssenceData(GameData.essences, essences1_3);
        mergeEssenceData(GameData.essences, essences4_6);
        mergeEssenceData(GameData.essences, essences7_9);
        mergeEssenceData(GameData.essences, essencesExplorationPack);
        enrichMonsterEssencePools(GameData);

        await applySettingsTextExpansion(GameData, (msg) => console.log(msg));
        
        // [신규] 맵 데이터 병합 (maps_floors)
        // loader.js에서 이미 layers에 병합했으므로, maps도 동일하게 설정
        if (!GameData.maps) {
            GameData.maps = { ...GameData.layers };
        }
        
        if (!Array.isArray(GameData.statsList) || GameData.statsList.length === 0) {
             GameData.statsList = [{name: "근력"}, {name: "민첩성"}, {name: "지구력"}, {name: "정신력"}, {name: "영혼력"}];
        }
    } catch (e) {
        console.error("데이터 병합 실패", e);
        return;
    }

    // 3. 음악 및 콜백 초기화
    musicManager.init();
    musicManager.playMusic('bgm-title');

    const gameCallbacks = {
        // Data & Classes
        gameData: GameData,
        NPCClass: NPC, 
        QuestManagerClass: QuestManager,

        // UI Core
        logMessage: logMessage,
        updateStatusBars: updateStatusBars,
        showScreenEffect: showScreenEffect, // [중요] 화면 연출 함수

        // UI Sections
        updateMenu: updateMenu,
        showPortalChoice: showPortalChoice,
        showRiftEntryModal: showRiftEntryModal,
        showInventory: showInventory,
        showCharacterStatus: showCharacterStatus,
        updateCombatStatus: updateCombatStatus,
        updateCombatMenu: updateCombatMenu,
        showCityDistricts: showCityDistricts,
        showCityLocations: showCityLocations,
        handleCityAction: handleCityAction,
        showParty: showParty,
        showEssencePartyChoice: showEssencePartyChoice,
        showQuestLog: showQuestLog,
        
        // [신규] 탐험 시스템 UI 콜백
        initExplorationUI: initExplorationUI,
        updateExplorationUI: updateExplorationUI,
        showInteractionPrompt: showInteractionPrompt,
        hideInteractionPrompt: hideInteractionPrompt,
        spawnExplorationHitVfx: spawnExplorationHitVfx,
        showRivalLootModal: showRivalLootModal,

        // Utils
        randomMonsterFromLayer: (layer) => {
            const m = GameData.layers?.[layer]?.monsters;
            return m ? m[Math.floor(Math.random() * m.length)] : null;
        },
        getRandomMonsters: (layer) => {
            const m = GameData.layers?.[layer]?.monsters;
            if(!m) return [];
            const count = Math.floor(Math.random() * 3) + 1;
            return Array.from({length: count}, () => m[Math.floor(Math.random() * m.length)]);
        },

        // Music/SFX
        playMusic: (id) => musicManager.playMusic(id),
        playSfx: (id) => musicManager.playSfx(id),
        stopMusic: () => musicManager.stopCurrentMusic(),

        // [신규 Phase 2] 시스템 콜백
        miningSystem: () => player.miningSystem,
        mapEventRenderer: () => player.mapEventRenderer,
        npcCommerceSystem: () => player.npcCommerceSystem,
        homesteadSystem: () => player.homesteadSystem,
        expandedSkillTree: () => player.expandedSkillTree,
        cityLocationsSystem: () => player.cityLocationsSystem,

        // [Phase 3] 종족 시스템 콜백
        raceSystem: () => player.raceSystem,
        raceDefinitions: () => RACE_DEFINITIONS,
        setPlayerRace: (raceId) => {
            if (player && player.raceSystem) {
                player.raceSystem.setPlayerRace(raceId);
            }
        }
    };

    // 4. 플레이어 및 매니저 초기화
    const player = new Player(gameCallbacks);
    player.factionSystem = new FactionSystem(player);
    player.livingWorld = new LivingWorldSimulator(player);
    
    // [신규] MapManager 생성 및 연결
    player.mapManager = new MapManager(player, gameCallbacks);
    
    // [신규] 플레이어 고급 시스템 초기화
    player.reputationSystem = new ReputationSystem(player);
    player.injurySystem = new InjurySystem(player);
    player.butcherySystem = new ButcherySystem(player);
    player.npcAI = new EnhancedNPCInteraction(player);

    // [신규 Phase 2] 자원 및 확장 시스템 초기화
    player.miningSystem = new MiningSystem(player);
    player.mapEventRenderer = new MapEventRenderer();
    player.npcCommerceSystem = new NPCCommerceSystem();
    player.homesteadSystem = new HomesteadSystem(player);
    player.expandedSkillTree = new ExpandedSkillTree();
    player.cityLocationsSystem = new CityLocationsSystem();

    // [Phase 3] 종족 시스템 초기화
    player.raceSystem = new RaceSystem(player, gameCallbacks);
    player.spiritImprintSystem = new SpiritImprintSystem(player);
    player.spiritBeastSystem = new SpiritBeastSystem(player);
    player.auraSystem = new AuraSystem(player);
    player.engineeringToolkitSystem = new EngineeringToolkitSystem(player);
    player.elementalPactSystem = new ElementalPactSystem(player);
    player.dragonTongueSystem = new DragonTongueSystem(player);

    // 5. 시간 시스템 비활성화: 실시간 월드 시간 동기화 사용 안 함

    // 6. 게임 시작
    initRaceSelection(player);
}

// 오디오 잠금 해제 (브라우저 정책 대응)
function unlockAudioContext() {
    Object.values(musicManager.audioElements).forEach(audio => {
        audio.volume = 0.01;
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0.5;
        }).catch(()=>{});
    });
}
document.body.addEventListener('click', unlockAudioContext, { once: true });

initGame();
