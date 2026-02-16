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

// [신규] 탐험 시스템 및 UI 임포트
import { MapManager } from './exploration_system.js';
import { initExplorationUI, updateExplorationUI, showInteractionPrompt, hideInteractionPrompt } from './ui_exploration.js';

// [신규] 맵 데이터 임포트
import { mapsFloors1_3 } from './data/maps_floors_1-3.js';
import { mapsFloors4_6 } from './data/maps_floors_4-6.js';
import { mapsFloors7_10 } from './data/maps_floors_7-10.js';

// [기존] 정수 데이터 임포트
import { essences as essences1_3 } from './data/essences_functional_1-3.js';
import { essences as essences4_6 } from './data/essences_functional_4-6.js';
import { essences as essences7_9 } from './data/essences_functional_7-9.js';

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
        Object.assign(GameData.npcs, npcs || {});
        
        // 정수 데이터 병합
        mergeEssenceData(GameData.essences, essences1_3);
        mergeEssenceData(GameData.essences, essences4_6);
        mergeEssenceData(GameData.essences, essences7_9);
        
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
        stopMusic: () => musicManager.stopCurrentMusic()
    };

    // 4. 플레이어 및 매니저 초기화
    const player = new Player(gameCallbacks);
    
    // [신규] MapManager 생성 및 연결
    player.mapManager = new MapManager(player, gameCallbacks);

    // 5. 주기적 상태 체크 (1분마다)
    setInterval(() => {
        if (player && player.position === "Labyrinth") {
            player.checkSatiety();
            player.checkBetrayal();
        }
    }, 60000);

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
