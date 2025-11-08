// 이 파일은 게임 UI의 핵심 DOM 헬퍼 및 유틸리티 함수를 보관합니다.
// (로그, 버튼 생성, 모달 제어, 상태 바 업데이트)
// [수정] logMessage: 전투 연출을 위해 CSS 클래스(className) 인자 추가
// [신규] showScreenEffect: 전투 연출을 위한 화면 효과(번쩍임/흔들림) 함수 추가

/**
 * 로그 메시지 출력 함수
 * @param {string} msg - 출력할 메시지
 * @param {string} [className=null] - (선택) 메시지에 추가할 CSS 클래스
 */
export function logMessage(msg, className = null) {
    const log = document.getElementById('log');
    if (!log) {
        console.error("Log element not found!");
        return;
    }

    const p = document.createElement('p');
    p.classList.add('log-message');

    // [신규] 스킬 연출 등을 위한 커스텀 클래스 추가
    if (className) {
        p.classList.add(className);
    }

    // 메시지 내용에 따라 기본 스타일 클래스 부여
    if (msg.includes('피해') || msg.includes('공격!')) {
        p.classList.add('combat');
    } else if (msg.includes('획득') || msg.includes('회복')) {
        p.classList.add('reward');
    } else if (msg.includes('정수') || msg.includes('마법')) {
        p.classList.add('magic');
    } else if (msg.includes('!!') || msg.includes('오류') || msg.includes('퀘스트')) {
        p.classList.add('system');
    }

    p.innerHTML = `> ${msg}`; 
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
}

/**
 * [신규] 화면 효과(번쩍임, 흔들림) 함수
 * @param {'flash' | 'shake' | 'boss-hit'} effectName - style.css에 정의된 효과 클래스 이름
 */
export function showScreenEffect(effectName) {
    const container = document.getElementById('game-container');
    if (!container) return;

    const effectClass = `effect-${effectName}`;
    
    container.classList.add(effectClass);
    
    // 애니메이션이 끝나면 클래스 제거
    setTimeout(() => {
        container.classList.remove(effectClass);
    }, 300); // 0.3s (style.css의 애니메이션 시간과 일치)
}


/**
 * 버튼 추가 헬퍼 함수
 * @param {HTMLElement} parent - 버튼을 추가할 부모 DOM 엘리먼트
 * @param {string} text - 버튼에 표시될 텍스트
 * @param {function} onclick - 버튼 클릭 시 실행될 콜백 함수
 * @returns {HTMLButtonElement} 생성된 버튼 엘리먼트
 */
export function addButton(parent, text, onclick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.onclick = onclick;
    parent.appendChild(btn);
    return btn;
}

// --- 모달 제어 헬퍼 함수 ---

/**
 * 모달을 표시합니다.
 * @param {string} modalId - '#'을 포함한 모달의 ID (예: '#inventory-screen')
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId.replace('#', ''));
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // style.css의 .modal-overlay 스타일 적용
    } else {
        console.error(`${modalId} 모달을 찾을 수 없습니다.`);
    }
}

/**
 * 모달을 숨깁니다.
 * @param {string} modalId - '#'을 포함한 모달의 ID (예: '#inventory-screen')
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId.replace('#', ''));
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none'; 
    }
}
// --- 모달 헬퍼 끝 ---


// --- 상태 바 업데이트 함수 ---
/**
 * 플레이어의 HP, MP, 기력 프로그레스 바와 텍스트를 업데이트합니다.
 * @param {Player} player - 플레이어 객체
 */
export function updateStatusBars(player) {
    const hpBar = document.getElementById('player-hp');
    const hpValue = document.getElementById('player-hp-value');
    const mpBar = document.getElementById('player-mp');
    const mpValue = document.getElementById('player-mp-value');
    const staminaBar = document.getElementById('player-stamina');
    const staminaValue = document.getElementById('player-stamina-value');

    if (hpBar && hpValue) {
        hpBar.max = player.maxHp;
        hpBar.value = player.hp;
        hpValue.textContent = `${player.hp}/${player.maxHp}`;
    }
    if (mpBar && mpValue) {
        mpBar.max = player.maxMp;
        mpBar.value = player.mp;
        mpValue.textContent = `${player.mp}/${player.maxMp}`;
    }
    if (staminaBar && staminaValue) {
        staminaBar.max = player.maxStamina;
        staminaBar.value = player.stamina;
        staminaValue.textContent = `${player.stamina}/${player.maxStamina}`;
    }
}
// --- 상태 바 업데이트 끝 ---