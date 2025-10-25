// 이 파일은 게임 전반에서 사용되는 유틸리티 헬퍼 함수들을 보관합니다.
// data.js에서 필요한 데이터를 가져옵니다.

// --- 수정된 import 구문 ---
import { layers } from './data_content.js';
// --- 수정 완료 ---

/**
 * 지정된 층(layer)의 몬스터 목록에서 랜덤한 몬스터 이름 하나를 반환합니다.
 * @param {number} layer - 층 번호 (예: 1)
 * @returns {string} 랜덤하게 선택된 몬스터 이름
 */
export function randomMonsterFromLayer(layer) {
    const m = layers[layer].monsters;
    return m[Math.floor(Math.random() * m.length)];
}
        
/**
 * 지정된 층(layer)에서 1~3마리의 랜덤 몬스터 이름 배열을 반환합니다.
 * @param {number} layer - 층 번호 (예: 1)
 * @returns {string[]} 랜덤하게 선택된 몬스터 이름 배열
 */
export function getRandomMonsters(layer) {
    const monsterList = layers[layer].monsters;
    const count = Math.floor(Math.random() * 3) + 1; // 1~3마리
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(monsterList[Math.floor(Math.random() * monsterList.length)]);
    }
    return result;
}