// 이 파일은 게임의 메인 진입점(Entry Point)입니다.
// [개선] BGM 및 SFX 재생을 위한 음악 관리자 및 콜백 추가
// [수정] ui.js 분리에 따라 import 구문 수정
// --- [계획 수정 3] ---
// [수정] ui_main.js에서 showPortalChoice 함수 import 추가
// [수정] gameCallbacks 객체에 showPortalChoice 콜백 추가
// [오류 수정] 자동 재생 오류 방지를 위해 초기 BGM 재생 주석 처리

// 1. 클래스 임포트
import { Player } from './classes.js';

// 2. [수정] UI 함수 임포트 (파일 분리)
import {
    logMessage,
    updateStatusBars
} from './ui_core.js';

import {
    initRaceSelection,
    updateMenu,
    showPortalChoice // [수정] showPortalChoice import 추가
} from './ui_main.js';

import {
    updateCombatStatus,
    updateCombatMenu
} from './ui_combat.js';
// --- 수정 완료 ---


// --- 유틸리티 함수 임포트 ---
import {
    randomMonsterFromLayer,
    getRandomMonsters
} from './utils.js';

// --- [신규] 음악 관리자 (Music Manager) ---
const musicManager = {
    audioElements: {}, // 오디오 요소를 저장할 객체
    currentTrack: null, // 현재 재생 중인 BGM ID 추적
    fadeInterval: null, // 페이드 아웃 인터벌 ID

    // 초기화: HTML에서 audio 요소를 찾아 저장
    init: function() {
        // --- bgm_dungeon_snowfall.mp3 ID 추가 ---
        const audioIds = ['bgm-title', 'bgm-city', 'bgm-dungeon', 'bgm-combat', 'sfx-event']; // 모든 오디오 ID 목록
        // --- 수정 완료 ---
        audioIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.audioElements[id] = element;
                // 초기 볼륨 설정 (예: 50%)
                element.volume = 0.5;
            } else {
                console.warn(`Audio element with id "${id}" not found.`);
            }
        });
        console.log("Music Manager Initialized", this.audioElements);
    },

    // BGM 재생 함수
    playMusic: function(trackId) {
        if (!this.audioElements[trackId]) {
            console.error(`Music track "${trackId}" not found.`);
            return;
        }

        // 이미 같은 곡이 재생 중이면 중단
        if (this.currentTrack === trackId && !this.audioElements[trackId].paused) { // paused 확인 추가
            return;
        }

        // 현재 재생 중인 BGM 부드럽게 중지
        this.stopCurrentMusic();

        // 새 BGM 재생 시도
        const track = this.audioElements[trackId];
        track.currentTime = 0; // 처음부터 재생
        track.volume = 0.5; // 기본 볼륨으로 재설정 (페이드 아웃 후)

        // 중요: 사용자의 첫 상호작용 전에 play()가 실패할 수 있음
        const playPromise = track.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                // 자동 재생 성공
                console.log(`Playing music: ${trackId}`);
                this.currentTrack = trackId; // 현재 트랙 ID 업데이트
            }).catch(error => {
                // 자동 재생 실패 (사용자 상호작용 필요)
                 // --- 오류 메시지 개선 및 현재 트랙 초기화 ---
                 console.warn(`Playback failed for ${trackId}: ${error}. User interaction required.`);
                 this.currentTrack = null; // 재생 실패 시 현재 트랙 초기화
                 // --- 수정 완료 ---
                // 필요하다면, 사용자 클릭 시 재생을 다시 시도하는 로직 추가 가능
            });
        } else {
             // play()가 Promise를 반환하지 않는 구형 브라우저 처리 (거의 없음)
             try {
                 track.play();
                 console.log(`Playing music: ${trackId}`);
                 this.currentTrack = trackId;
             } catch (error) {
                 console.warn(`Playback failed for ${trackId}: ${error}. User interaction required.`);
                 this.currentTrack = null; // 재생 실패 시 현재 트랙 초기화
             }
        }
    },

    // 현재 BGM 부드럽게 중지 함수
    stopCurrentMusic: function() {
        if (this.currentTrack && this.audioElements[this.currentTrack]) {
            const track = this.audioElements[this.currentTrack];
            // 이전 페이드 아웃 중지
            if (this.fadeInterval) {
                clearInterval(this.fadeInterval);
                 this.fadeInterval = null; // 인터벌 ID 초기화
            }
            // 볼륨 서서히 줄이기 (Fade out)
            this.fadeInterval = setInterval(() => {
                // --- 볼륨 감소 로직 및 정지 조건 수정 ---
                if (track.volume > 0.05) { // 더 낮은 값까지 감소
                    track.volume = Math.max(0, track.volume - 0.1); // 0 미만 방지
                } else {
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null; // 인터벌 ID 초기화
                    track.pause();
                    track.volume = 0.5; // 나중 재생을 위해 볼륨 복구
                    console.log(`Music stopped: ${this.currentTrack}`);
                    this.currentTrack = null; // 현재 트랙 없음으로 표시
                }
                // --- 수정 완료 ---
            }, 50); // 50ms 마다 볼륨 감소
        }
         // 현재 재생 중인 트랙이 없어도, 혹시 모를 인터벌 정리
        else if (this.fadeInterval) {
             clearInterval(this.fadeInterval);
             this.fadeInterval = null;
        }
    },

    // 효과음 재생 함수
    playSfx: function(sfxId) {
        if (this.audioElements[sfxId]) {
            const sfx = this.audioElements[sfxId];
            sfx.currentTime = 0; // 항상 처음부터 재생
            sfx.play().catch(error => {
                 console.warn(`SFX ${sfxId} playback failed: ${error}. User interaction might be required.`);
            });
            console.log(`Playing SFX: ${sfxId}`);
        } else {
            console.error(`SFX "${sfxId}" not found.`);
        }
    }
};

// --- 음악 관리자 초기화 ---
musicManager.init();
// --- 초기화 완료 ---


// 3. Player 객체가 UI 및 음악 함수를 호출할 수 있도록 콜백 객체 생성
const gameCallbacks = {
    // [수정] ui_core.js에서 가져온 함수들
    logMessage: logMessage,
    updateStatusBars: (playerInstance) => updateStatusBars(playerInstance),

    // [수정] ui_main.js에서 가져온 함수
    updateMenu: (playerInstance) => updateMenu(playerInstance),
    showPortalChoice: (playerInstance, nextLayer) => showPortalChoice(playerInstance, nextLayer), // [수정] 콜백 추가

    // [수정] ui_combat.js에서 가져온 함수들
    updateCombatStatus: (playerInstance) => updateCombatStatus(playerInstance),
    updateCombatMenu: (playerInstance) => updateCombatMenu(playerInstance),

    // 유틸리티 함수 콜백
    randomMonsterFromLayer: (layer) => randomMonsterFromLayer(layer),
    getRandomMonsters: (layer) => getRandomMonsters(layer),

    // [신규] 음악/효과음 제어 콜백 추가
    playMusic: (trackId) => musicManager.playMusic(trackId),
    playSfx: (sfxId) => musicManager.playSfx(sfxId),
    stopMusic: () => musicManager.stopCurrentMusic() // [신규] 음악 중지 콜백
};

// 4. 플레이어 객체 생성
const player = new Player(gameCallbacks);

// 5. 주기적인 이벤트 체크 (포만감, 배신 등)
setInterval(() => {
    // --- player 객체 생성 확인 ---
    if (player && player.position === "Labyrinth") {
    // --- 수정 완료 ---
        player.checkSatiety();
        player.checkBetrayal();
    }
}, 60000); // 1분에 한 번 체크

// 6. 게임 시작
// --- [오류 수정] 초기 BGM 자동 재생 시도 주석 처리 ---
// musicManager.playMusic('bgm-title'); // 브라우저 정책으로 인해 사용자 상호작용 없이는 실패함
// --- 수정 완료 ---
// 종족 선택 화면을 띄웁니다. (ui_main.js에서 import)
// 종족 선택 시 ui_main.js의 initRaceSelection 내부에서 bgm-city 재생 시도
initRaceSelection(player);

// -----------------------------------------------------------------
// 중요: 'index.html' 파일의 <script> 태그는 이미 'type="module"' 입니다.
// <script type="module" src="main.js"></script>
// -----------------------------------------------------------------

// --- [선택 사항] 사용자 상호작용 시 오디오 잠금 해제 시도 ---
// 사용자가 처음 클릭/터치할 때 모든 오디오 로드를 시도하여 이후 자동 재생 문제를 줄임
function unlockAudioContext() {
    console.log("Attempting to unlock audio context after user interaction...");
    let unlocked = false;
    Object.values(musicManager.audioElements).forEach(audio => {
        // 짧게 재생 후 즉시 멈추는 방식 (소리가 거의 안 나게)
        audio.volume = 0.01;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
             playPromise.then(_ => {
                 audio.pause();
                 audio.currentTime = 0; // 재생 위치 초기화
                 audio.volume = 0.5; // 원래 볼륨 복구
                 unlocked = true;
             }).catch(error => {
                // console.warn("Audio unlock failed for one element:", error); // 개별 오류 로깅은 생략 가능
                 audio.volume = 0.5; // 실패해도 볼륨 복구
             });
        }
    });
    if (unlocked) {
        console.log("Audio context likely unlocked.");
    } else {
        console.warn("Could not unlock audio context automatically.");
    }
    // 이벤트 리스너 제거 (한 번만 실행)
    document.body.removeEventListener('click', unlockAudioContext);
    document.body.removeEventListener('touchstart', unlockAudioContext);
}
 // --- 페이지 로드 후 첫 클릭/터치 시 unlockAudioContext 실행 ---
 document.body.addEventListener('click', unlockAudioContext, { once: true }); // once: true 로 자동 제거
 document.body.addEventListener('touchstart', unlockAudioContext, { once: true });
 // --- 수정 완료 ---
// --- 오디오 잠금 해제 끝 ---