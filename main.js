// 이 파일은 게임의 메인 진입점(Entry Point)입니다.
// [개선] BGM 및 SFX 재생을 위한 음악 관리자 및 콜백 추가
// [수정] ui.js 분리에 따라 import 구문 수정
// --- [계획 수정 3] ---
// [수정] ui_main.js에서 showPortalChoice 함수 import 추가
// [수정] gameCallbacks 객체에 showPortalChoice 콜백 추가

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
        const audioIds = ['bgm-title', 'bgm-city', 'bgm-dungeon', 'bgm-combat', 'sfx-event']; // 모든 오디오 ID 목록
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
        if (this.currentTrack === trackId) {
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
                console.warn(`Autoplay failed for ${trackId}: ${error}. User interaction required.`);
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
            }
            // 볼륨 서서히 줄이기 (Fade out)
            this.fadeInterval = setInterval(() => {
                if (track.volume > 0.1) {
                    track.volume -= 0.1;
                } else {
                    clearInterval(this.fadeInterval);
                    track.pause();
                    track.volume = 0.5; // 나중 재생을 위해 볼륨 복구
                    this.currentTrack = null; // 현재 트랙 없음으로 표시
                    console.log("Music stopped");
                }
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
    if (player.position === "Labyrinth") {
        player.checkSatiety();
        player.checkBetrayal();
    }
}, 60000);

// 6. 게임 시작
// --- [신규] 타이틀 BGM 재생 ---
musicManager.playMusic('bgm-title');
// 종족 선택 화면을 띄웁니다. (ui_main.js에서 import)
initRaceSelection(player);

// -----------------------------------------------------------------
// 중요: 'index.html' 파일의 <script> 태그는 이미 'type="module"' 입니다.
// <script type="module" src="main.js"></script>
// -----------------------------------------------------------------

// --- [선택 사항] 사용자 상호작용 시 오디오 잠금 해제 시도 ---
// 사용자가 처음 클릭/터치할 때 모든 오디오 로드를 시도하여 이후 자동 재생 문제를 줄임
function unlockAudioContext() {
    console.log("Attempting to unlock audio context...");
    Object.values(musicManager.audioElements).forEach(audio => {
        // 이미 재생 중이거나 로드 중이지 않은 오디오만 로드 시도
        if (audio.paused && audio.readyState < 3) {
             audio.load(); // 메타데이터 로드 시도
             // 짧게 재생 후 멈추는 방법도 있으나, 원치 않는 소리가 날 수 있음
             // audio.play().then(() => audio.pause()).catch(()=>{});
        }
    });
    // 이벤트 리스너 제거 (한 번만 실행)
    document.body.removeEventListener('click', unlockAudioContext);
    document.body.removeEventListener('touchstart', unlockAudioContext);
}
// document.body.addEventListener('click', unlockAudioContext);
// document.body.addEventListener('touchstart', unlockAudioContext);
// --> 주석 처리: 명시적인 사용자 클릭 유도 없이, play() 실패 시 경고만 표시하는 것으로 변경.
//     필요하다면 게임 시작 버튼 등을 만들고 해당 버튼 클릭 시 unlockAudioContext() 호출 가능.
// --- 오디오 잠금 해제 끝 ---