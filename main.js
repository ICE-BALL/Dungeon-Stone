// 이 파일은 게임의 메인 진입점(Entry Point)입니다.
// [수정] JSON 데이터 로더 + data_functional.js 로더를 통해 모든 게임 데이터를 불러오도록 수정
// [수정] gameCallbacks 객체를 확장하여 모든 UI, 데이터, 유틸 함수를 Player에 주입
// [AUTO-FIX] static_content.json 로딩 오류를 해결하기 위해 loader.js 변경 사항을 반영 (L231-L241)
// [AUTO-FIX] 확장 계획에 따라 showRiftEntryModal, showEssencePartyChoice 콜백 시그니처 수정
// [리팩토링] Player 클래스를 3개 파일(core, combat, world)에서 임포트하고 프로토타입에 병합(Mixin)

// 1. 클래스 및 데이터 로더 임포트
// [수정] class_player.js를 3개의 파일(core, combat, world)로 분리하여 임포트
import { Player } from './class_player_core.js';
import { PlayerCombatMethods } from './class_player_combat.js';
import { PlayerWorldMethods } from './class_player_world.js';
import { NPC } from './class_npc.js';
import { loadAllGameData } from './data/loader.js';
import { QuestManager } from './quest_system.js';

// [신규] 함수가 포함된 데이터를 별도 임포트
import { races, magic, items, numbersItems, npcs } from './data_functional.js';

// [수정] 3개의 신규 정수 기능(effect 함수) 파일 임포트
import { essences as essences1_3 } from './data/essences_functional_1-3.js';
import { essences as essences4_6 } from './data/essences_functional_4-6.js';
import { essences as essences7_9 } from './data/essences_functional_7-9.js';


// 2. UI 함수 임포트
import {
    logMessage,
    updateStatusBars
} from './ui_core.js';
import {
    initRaceSelection,
    updateMenu,
    showPortalChoice,
    /* AUTO-FIX: [Plan 4] Replaced 'showRiftChoice' with new modal function 'showRiftEntryModal' */
    showRiftEntryModal
} from './ui_main.js';
import {
    updateCombatStatus,
    updateCombatMenu
} from './ui_combat.js';
import {
    showCityDistricts,
    showCityLocations,
    handleCityAction
} from './ui_city.js';
// [확장 계획 1] 정수 분배 UI 임포트
import { showParty, showEssencePartyChoice } from './ui_party.js'; 
import { showQuestLog } from './ui_quests.js';


// --- [신규] Player 클래스 프로토타입에 분리된 메서드 주입 (Mixin) ---
// Player 객체가 생성되기 전에 전투/월드 메서드를 클래스 정의에 결합합니다.
Object.assign(Player.prototype, PlayerCombatMethods);
Object.assign(Player.prototype, PlayerWorldMethods);


// --- [신규] Deep Merge 유틸리티 함수 ---
/**
 * 두 객체를 깊은 병합(Deep Merge)합니다.
 * @param {object} target - 원본 객체 (JSON 데이터)
 * @param {object} source - 병합할 객체 (함수 데이터)
 * @returns {object} 병합된 객체
 */
function deepMerge(target, source) {
    const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);

    if (!isObject(target) || !isObject(source)) {
        return source; // 한쪽이 객체가 아니면 덮어씀
    }

    const output = Object.assign({}, target);

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            // 배열은 덮어쓰기 (단, 이 프로젝트에서는 정수 active가 객체/배열 혼용이라 문제가 다름)
            // JSON(정보)의 active가 배열이고, Functional(함수)의 active도 배열일 때
            // -> 이 경우 이름(name)을 기준으로 합쳐야 함.
            if (key === 'active') {
                 output[key] = targetValue.map(targetSkill => {
                    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                    const sourceSkill = sourceValue?.find(s => s.name === targetSkill.name);
                    return sourceSkill ? { ...targetSkill, ...sourceSkill } : targetSkill;
                 });
            } else {
                 output[key] = sourceValue;
            }
            
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            // 객체일 경우 재귀적으로 병합 (핵심: active 객체 병합)
            output[key] = deepMerge(targetValue, sourceValue);
        } else {
            // 그 외 (함수, 기본형 등)는 덮어쓰기
            output[key] = sourceValue;
        }
    });

    return output;
}

// [수정] GameData.essences 전체를 순회하며 깊은 병합을 수행하는 래퍼 함수
function mergeEssenceData(targetEssences, sourceEssences) {
    /* AUTO-FIX: Added null check for safety (Rule 4) */
    if (!targetEssences || !sourceEssences) return; 
    for (const key in sourceEssences) {
        if (targetEssences.hasOwnProperty(key)) {
            // deepMerge(target[key], source[key])
            targetEssences[key] = deepMerge(targetEssences[key], sourceEssences[key]);
        } else {
            // JSON에 없는 정수 데이터가 functional에 있다면 (예: 임의 생성)
            targetEssences[key] = sourceEssences[key];
        }
    }
}


// --- 음악 관리자 (Music Manager) ---
const musicManager = {
    audioElements: {}, 
    currentTrack: null,
    fadeInterval: null, 

    init: function() {
        const audioIds = ['bgm-title', 'bgm-city', 'bgm-dungeon', 'bgm-combat', 'sfx-event'];
        audioIds.forEach(id => {
            /* AUTO-FIX: added guard for document.getElementById result (Rule 8); review required */
            const element = document.getElementById(id);
            if (element) {
                this.audioElements[id] = element;
                element.volume = 0.5; /* DEFAULT: 0.5 (검토 필요) */
            } else {
                console.warn(`Audio element with id "${id}" not found.`);
            }
        });
        console.log("Music Manager Initialized", this.audioElements);
    },

    playMusic: function(trackId) {
        if (!this.audioElements[trackId]) {
            console.error(`Music track "${trackId}" not found.`);
            return;
        }
        if (this.currentTrack === trackId && !this.audioElements[trackId].paused) {
            return;
        }
        this.stopCurrentMusic();
        const track = this.audioElements[trackId];
        track.currentTime = 0;
        track.volume = 0.5; /* DEFAULT: 0.5 (검토 필요) */
        const playPromise = track.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                console.log(`Playing music: ${trackId}`);
                this.currentTrack = trackId;
            }).catch(error => {
                 /* AUTO-FIX: [Error 2] Added log for NotSupportedError. User must rename 'øneheart...mp3' file. */
                 console.warn(`Playback failed for ${trackId}: ${error}. User interaction required. (If 'NotSupportedError', check audio file path/name in index.html)`);
                 this.currentTrack = null;
            });
        }
    },

    stopCurrentMusic: function() {
        if (this.currentTrack && this.audioElements[this.currentTrack]) {
            const track = this.audioElements[this.currentTrack];
            if (this.fadeInterval) clearInterval(this.fadeInterval);
            this.fadeInterval = setInterval(() => {
                if (track.volume > 0.05) {
                    track.volume = Math.max(0, track.volume - 0.1);
                } else {
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                    track.pause();
                    track.volume = 0.5; /* DEFAULT: 0.5 (검토 필요) */
                    this.currentTrack = null;
                }
            }, 50 /* DEFAULT: 50 (검토 필요) */);
        }
        else if (this.fadeInterval) {
             clearInterval(this.fadeInterval);
             this.fadeInterval = null;
        }
    },

    playSfx: function(sfxId) {
        if (this.audioElements[sfxId]) {
            const sfx = this.audioElements[sfxId];
            sfx.currentTime = 0;
            sfx.play().catch(error => {
                 console.warn(`SFX ${sfxId} playback failed: ${error}.`);
            });
        } else {
            console.error(`SFX "${sfxId}" not found.`);
        }
    }
};
// --- 음악 관리자 끝 ---


/**
 * 게임 메인 실행 함수 (비동기)
 * 모든 데이터 로딩이 완료된 후 게임을 시작합니다.
 */
async function initGame() {
    
    // 1. 모든 JSON 데이터 로드
    let GameData = {};
    try {
        // [수정] data/loader.js가 모든 JSON을 로드하고 GameData 객체를 반환
        GameData = await loadAllGameData();
    } catch (error) {
        console.error("치명적 오류: JSON 게임 데이터를 불러오는 데 실패했습니다.", error);
        logMessage("오류: 게임 데이터를 불러올 수 없습니다. 페이지를 새로고침하세요.");
        return; // 게임 실행 중단
    }

    // 2. [신규] 함수형 데이터 (data_functional.js)를 GameData 객체에 병합합니다.
    try {
        /* AUTO-FIX: added guard for null data (Rule 4) */
        Object.assign(GameData.races, races || {});
        Object.assign(GameData.magic, magic || {});
        Object.assign(GameData.items, items || {});
        Object.assign(GameData.numbersItems, numbersItems || {});
        Object.assign(GameData.npcs, npcs || {});
        
        // [수정] Object.assign 대신 deepMerge 래퍼 함수를 사용하여
        // JSON(정보)와 JS(기능)를 병합합니다.
        mergeEssenceData(GameData.essences, essences1_3);
        mergeEssenceData(GameData.essences, essences4_6);
        mergeEssenceData(GameData.essences, essences7_9);
        
        /* AUTO-FIX: [Error 1] Corrected logic based on the fix in loader.js. (Rule 4) */
        // [수정] loader.js가 이미 루트에 statsList를 로드했는지 확인
        if (!Array.isArray(GameData.statsList) || GameData.statsList.length === 0) {
             // 비상용: static_content.json 로딩 실패 시
             console.error("static_content.json에서 statsList를 로드하지 못했습니다. 기본값으로 대체합니다.");
             GameData.statsList = [{name: "근력"}, {name: "민첩성"}, {name: "지구력"}, {name: "정신력"}, {name: "영혼력"}];
             GameData.specialStats = {"명성": { value: 0 }};
        }
        
    } catch (e) {
        console.error("치명적 오류: 함수형 데이터 병합에 실패했습니다.", e);
        logMessage("오류: 게임 로직 데이터를 불러올 수 없습니다.");
        return;
    }


    // 3. 음악 관리자 초기화
    musicManager.init();

    // 4. Player 객체가 사용할 콜백 객체 생성
    const gameCallbacks = {
        // [Data] 로드된 모든 게임 데이터를 Player가 접근할 수 있도록 전달
        gameData: GameData,
        // [Class] Player가 NPC를 생성할 수 있도록 NPC 클래스 전달
        NPCClass: NPC, 
        // [Quest] 퀘스트 매니저 클래스 전달 (Player 생성자에서 사용)
        QuestManagerClass: QuestManager,

        // [UI Core]
        logMessage: logMessage,
        updateStatusBars: (playerInstance) => updateStatusBars(playerInstance),

        // [UI Main]
        updateMenu: (playerInstance) => updateMenu(playerInstance),
        showPortalChoice: (playerInstance, nextLayer) => showPortalChoice(playerInstance, nextLayer),
        /* AUTO-FIX: [Plan 4] Changed callback to match new function in ui_main.js */
        showRiftEntryModal: (playerInstance, rift) => showRiftEntryModal(playerInstance, rift),
        
        // [UI Combat]
        updateCombatStatus: (playerInstance) => updateCombatStatus(playerInstance),
        updateCombatMenu: (playerInstance) => updateCombatMenu(playerInstance),
        
        // [UI City]
        showCityDistricts: (playerInstance) => showCityDistricts(playerInstance),
        showCityLocations: (playerInstance) => showCityLocations(playerInstance),
        handleCityAction: (playerInstance, location) => handleCityAction(playerInstance, location),
        
        // [UI Party]
        showParty: (playerInstance) => showParty(playerInstance),
        /* AUTO-FIX: [Optimization] Added 3rd argument for essence modal title (Rule 11) */
        showEssencePartyChoice: (playerInstance, essenceName, essenceDisplayName) => showEssencePartyChoice(playerInstance, essenceName, essenceDisplayName),
        
        // [UI Quests]
        showQuestLog: (playerInstance) => showQuestLog(playerInstance),

        // [Utils] (GameData를 사용하도록 main.js에 내장)
        randomMonsterFromLayer: (layer) => {
            /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
            const m = GameData.layers?.[layer]?.monsters;
            if (!m || m.length === 0) return null;
            return m[Math.floor(Math.random() * m.length)];
        },
        getRandomMonsters: (layer) => {
            /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
            const monsterList = GameData.layers?.[layer]?.monsters;
            if (!monsterList || monsterList.length === 0) return [];
            const count = Math.floor(Math.random() * 3) + 1;
            const result = [];
            for (let i = 0; i < count; i++) {
                result.push(monsterList[Math.floor(Math.random() * monsterList.length)]);
            }
            return result;
        },

        // [Music/SFX]
        playMusic: (trackId) => musicManager.playMusic(trackId),
        playSfx: (sfxId) => musicManager.playSfx(sfxId),
        stopMusic: () => musicManager.stopCurrentMusic()
    };

    // 5. 플레이어 객체 생성 (모든 데이터와 콜백 주입)
    const player = new Player(gameCallbacks);

    // 6. 주기적인 이벤트 체크 (포만감, 배신 등)
    setInterval(() => {
        if (player && player.position === "Labyrinth") {
            player.checkSatiety();
            player.checkBetrayal();
        }
    }, 60000); // 1분에 한 번 체크

    // 7. 게임 시작 (종족 선택 화면 표시)
    initRaceSelection(player);
}


// --- 오디오 잠금 해제 ---
function unlockAudioContext() {
    console.log("Attempting to unlock audio context after user interaction...");
    let unlocked = false;
    /* AUTO-FIX: added guard for musicManager.audioElements to avoid TypeError when undefined (Rule 8) */
    Object.values(musicManager?.audioElements || {}).forEach(audio => {
        if (!audio) return; // [AUTO-FIX] 추가 방어
        audio.volume = 0.01; /* DEFAULT: 0.01 (검토 필요) */
        const playPromise = audio.play();
        if (playPromise !== undefined) {
             playPromise.then(_ => {
                 audio.pause();
                 audio.currentTime = 0;
                 audio.volume = 0.5; /* DEFAULT: 0.5 (검토 필요) */
                 unlocked = true;
             }).catch(error => {
                 audio.volume = 0.5; /* DEFAULT: 0.5 (검토 필요) */
             });
        }
    });
    if (unlocked) console.log("Audio context likely unlocked.");
    else console.warn("Could not unlock audio context automatically.");
}
 document.body.addEventListener('click', unlockAudioContext, { once: true });
 document.body.addEventListener('touchstart', unlockAudioContext, { once: true });
// --- 오디오 잠금 해제 끝 ---


// --- 게임 실행 ---
initGame();