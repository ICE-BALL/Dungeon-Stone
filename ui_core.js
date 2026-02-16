// 파일: ui_core.js
// 이 파일은 게임 UI의 핵심 DOM 헬퍼 및 유틸리티 함수를 보관합니다.
// [수정] (v8) drawMap: 방문한 타일 주변(상하좌우) 벽 시야 밝히기(Revealed Fog) 구현
// [수정] (v8) Curio/Trace 타일 타입 시각화 추가

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

    if (className) {
        p.classList.add(className);
    }

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
 * 화면 효과(번쩍임, 흔들림) 함수
 * @param {'flash' | 'shake' | 'boss-hit'} effectName - style.css에 정의된 효과 클래스 이름
 */
export function showScreenEffect(effectName) {
    const container = document.getElementById('game-container');
    if (!container) return;

    const effectClass = `effect-${effectName}`;
    
    container.classList.add(effectClass);
    
    setTimeout(() => {
        container.classList.remove(effectClass);
    }, 300); 
}

/**
 * HP 바에 시각 효과(흔들림, 번쩍임)를 적용합니다.
 * (class_helpers.js 연동용, partyIndex 지원)
 * @param {object} target - 대상 (Player 또는 NPC)
 * @param {string} effectName - 적용할 CSS 클래스
 * @param {number} partyIndex - 플레이어(-1) 또는 파티원 인덱스(0, 1, 2...)
 */
export function triggerHpEffectV2(target, effectName, partyIndex) {
    let hpBar = null;

    if (partyIndex === -1) {
        hpBar = document.getElementById('player-hp');
    } else if (partyIndex >= 0) {
        hpBar = document.getElementById(`party-hp-${partyIndex}`);
    }

    if (!hpBar) return;

    if (effectName === 'hp-flash-skill') {
        hpBar.classList.add(effectName);
        setTimeout(() => {
            hpBar?.classList.remove(effectName); 
        }, 100); 
    } 
    else if (effectName === 'hp-shake') {
        hpBar.classList.add(effectName);
        setTimeout(() => {
            hpBar?.classList.remove(effectName); 
        }, 200); 
    }
}

// [호환성 유지용 구버전 함수]
export function triggerHpEffect(target, effectName) {
    // (v6.1 이후 triggerHpEffectV2 사용 권장)
}


/**
 * [핵심] 2D 맵 탐험 시스템 맵 뷰 렌더링 함수
 * @param {Player} player - 플레이어 객체
 * @param {boolean} [hide=false] - 맵 뷰를 강제로 숨길지 여부
 */
export function drawMap(player, hide = false) {
    const mapView = document.getElementById('map-view');
    if (!mapView) {
        console.error("Map view element (#map-view) not found!");
        return;
    }

    if (hide) {
        mapView.style.display = 'none';
        mapView.innerHTML = '';
        return;
    }

    mapView.style.display = 'block';
    mapView.innerHTML = ''; 

    const layer = player?.cb?.gameData?.layers?.[player.currentLayer];
    const map = layer?.map;
    const mapX = player.mapX;
    const mapY = player.mapY;
    const visited = player?.visitedTiles?.[player.currentLayer];

    if (!map || !Array.isArray(map) || map.length === 0 || !visited) {
        mapView.innerHTML = '<p style="color: grey; text-align: center;">(현재 층의 맵 데이터를 불러올 수 없습니다.)</p>';
        return;
    }

    const mapHeight = map.length;
    const mapWidth = map[0].length;

    // 맵 컨테이너 스타일 설정 (CSS Grid)
    // 맵 크기에 따라 그리드 비율 자동 조정
    mapView.style.display = 'grid';
    mapView.style.gridTemplateColumns = `repeat(${mapWidth}, 1fr)`;
    mapView.style.gap = '2px';
    mapView.style.border = '1px solid var(--color-border)';
    mapView.style.backgroundColor = 'var(--color-bg-darkest)';
    mapView.style.padding = '5px';
    mapView.style.marginBottom = '15px'; 
    // 대형 맵 스크롤 처리
    mapView.style.maxHeight = '400px';
    mapView.style.overflowY = 'auto';

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const tile = document.createElement('div');
            
            tile.style.aspectRatio = '1 / 1';
            tile.style.display = 'flex';
            tile.style.justifyContent = 'center';
            tile.style.alignItems = 'center';
            tile.style.fontSize = '0.7rem';
            tile.style.overflow = 'hidden';
            tile.style.padding = '1px';
            tile.style.boxSizing = 'border-box';
            tile.style.borderRadius = '2px';

            // 시야 로직
            const isVisited = visited[y] && visited[y][x];
            let isRevealed = isVisited;

            // [신규] 안개 걷기 로직: 방문한 타일의 상하좌우는 '보임' 처리 (벽 확인용)
            if (!isRevealed) {
                const neighbors = [
                    visited[y-1]?.[x], // 상
                    visited[y+1]?.[x], // 하
                    visited[y]?.[x-1], // 좌
                    visited[y]?.[x+1]  // 우
                ];
                if (neighbors.some(n => n === true)) {
                    isRevealed = true;
                }
            }

            let tileText = '';

            if (x === mapX && y === mapY) {
                // 플레이어 위치
                tileText = 'YOU';
                tile.style.backgroundColor = 'var(--color-stamina)';
                tile.style.color = 'white';
                tile.style.fontWeight = 'bold';
                tile.style.outline = '2px solid white';
                tile.style.zIndex = '10';
                tile.style.boxShadow = '0 0 5px var(--color-stamina)';
            } 
            else if (isRevealed) {
                // 밝혀진 타일
                const tileID = map[y][x] || "Unknown";
                const tileType = tileID.split(':')[0]; 
                
                if (isVisited) {
                    // 방문함 (밝게)
                    tile.style.backgroundColor = 'var(--color-bg-mid)';
                    tile.style.color = 'var(--color-text-secondary)';
                } else {
                    // 방문 안함, 보이기만 함 (어둡게 - 벽 확인용)
                    tile.style.backgroundColor = '#222'; 
                    tile.style.color = '#555';
                    tile.style.border = '1px dashed #444';
                }

                // 타일 유형별 시각화
                switch(tileType) {
                    case 'Wall':
                        tileText = '■';
                        tile.style.backgroundColor = '#111';
                        tile.style.color = '#333';
                        break;
                    case 'Portal':
                        tileText = 'P';
                        tile.style.backgroundColor = 'rgba(106, 133, 171, 0.3)'; // --color-magic
                        tile.style.color = 'var(--color-magic)';
                        break;
                    case 'Boss':
                        tileText = 'BOSS';
                        tile.style.backgroundColor = 'rgba(171, 106, 106, 0.3)'; // --color-health
                        tile.style.color = 'var(--color-health)';
                        tile.style.fontWeight = 'bold';
                        break;
                    case 'Monster':
                        tileText = 'M';
                        tile.style.color = 'var(--color-monster-hp)';
                        break;
                    case 'Curio':
                        tileText = '?'; // 상호작용 (기물)
                        tile.style.backgroundColor = 'rgba(138, 109, 59, 0.3)'; // --color-accent
                        tile.style.color = 'var(--color-accent)';
                        break;
                    case 'Trace':
                        tileText = '!'; // 흔적
                        tile.style.color = 'var(--color-text-secondary)';
                        tile.style.fontStyle = 'italic';
                        break;
                    case 'Item':
                        tileText = '$';
                        tile.style.color = 'gold';
                        break;
                    case 'Start':
                        tileText = 'S';
                        break;
                    default:
                        // 일반 지형 (Forest, Cave 등) - 첫 글자만
                        if(isVisited) tileText = tileType.substring(0, 2);
                        break;
                }
                
                tile.title = `(${x}, ${y}) - ${tileType}`; // 툴팁
            } else {
                // 완전 안개
                tile.style.backgroundColor = 'var(--color-bg-darkest)';
            }
            
            tile.textContent = tileText;
            mapView.appendChild(tile);
        }
    }
}


/**
 * 버튼 추가 헬퍼 함수
 */
export function addButton(parent, text, onclick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.onclick = onclick;
    parent.appendChild(btn);
    return btn;
}

/**
 * 모달 표시
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId.replace('#', ''));
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; 
    } else {
        console.error(`${modalId} 모달을 찾을 수 없습니다.`);
    }
}

/**
 * 모달 숨기기
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId.replace('#', ''));
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none'; 
    }
}

/**
 * 상태 바 업데이트 함수
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