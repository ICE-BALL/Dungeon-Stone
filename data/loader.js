// 이 파일은 data/ 폴더 내의 모든 JSON 데이터 파일들을
// 비동기적으로 불러와 하나의 전역 데이터 객체로 통합하는 역할을 합니다.
// main.js에서 이 함수를 호출하여 게임 데이터를 준비합니다.
// [AUTO-FIX] static_content.json 및 quests.json의 실제 파일 구조에 맞게 파싱 로직 수정 (Rule 4)

// 1. 불러올 JSON 데이터 파일 목록
const DATA_PATHS = {
    monsters1_3: 'data/monsters_grades_1-3.json',
    monsters4_6: 'data/monsters_grades_4-6.json',
    monsters7_10_b1: 'data/monsters_grades_7-10_b1.json',
    essences1_3: 'data/essences_grades_1-3.json',
    essences4_6: 'data/essences_grades_4-6.json',
    essences7_10_b1: 'data/essences_grades_7-10_b1.json',
    staticContent: 'data/static_content.json',
    worldData: 'data/world_data.json',
    quests: 'data/quests.json'
};

/**
 * 모든 JSON 게임 데이터를 비동기적으로 불러옵니다.
 * @returns {Promise<Object>} 모든 데이터가 통합된 GameData 객체를 반환하는 프로미스.
 */
export async function loadAllGameData() {
    console.log("게임 데이터 로딩 시작...");
    
    // 최종적으로 모든 데이터가 통합될 객체
    const GameData = {
        monsters: {},
        essences: {},
        items: {},
        numbersItems: {},
        materials: {},
        magic: {},
        races: {},
        npcs: {},
        cities: {},
        layers: {},
        rifts: {},
        quests: {},
        // [AUTO-FIX] statsList 등을 루트에 추가
        statsList: [],
        specialStats: {},
        expToLevel: {},
        maxLevelModded: 30,
        companionDialogues: []
    };

    // 각 파일을 fetch하는 프로미스 배열 생성
    const fetchPromises = Object.entries(DATA_PATHS).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                // 404 에러 등 HTTP 에러 처리
                throw new Error(`HTTP error! status: ${response.status} for file: ${path}`);
            }
            const data = await response.json();
            return { key, data, path };
        } catch (error) {
            console.error(`[Data Loader] 파일 로딩 실패: ${path}`, error);
            // 한 파일이 실패해도 나머지는 로드될 수 있도록 null 반환
            return { key, data: null, path }; 
        }
    });

    // 모든 fetch 프로미스가 완료될 때까지 대기
    const results = await Promise.all(fetchPromises);

    // 로드된 데이터를 GameData 객체에 병합
    for (const result of results) {
        if (result.data) {
            switch (result.key) {
                // 3개의 몬스터 파일을 하나로 합칩니다.
                case 'monsters1_3':
                case 'monsters4_6':
                case 'monsters7_10_b1':
                    /* AUTO-FIX: added guard for null data (Rule 4) */
                    Object.assign(GameData.monsters, result.data || {});
                    break;
                
                // 3개의 정수 파일을 하나로 합칩니다.
                case 'essences1_3':
                case 'essences4_6':
                case 'essences7_10_b1':
                    /* AUTO-FIX: added guard for null data (Rule 4) */
                    Object.assign(GameData.essences, result.data || {});
                    break;

                // 정적 콘텐츠 (아이템, 마법, 종족 등)를 합칩니다.
                /* AUTO-FIX: [Rule 4] Corrected parsing for static_content.json. Data is at root, not nested. */
                case 'staticContent':
                    Object.assign(GameData.items, result.data.shopItems || {}); // [수정] shopItems을 items로 사용
                    Object.assign(GameData.numbersItems, result.data.numbersItems || {});
                    Object.assign(GameData.materials, result.data.materials || {});
                    Object.assign(GameData.magic, result.data.magic || {});
                    Object.assign(GameData.races, result.data.races || {});
                    Object.assign(GameData.npcs, result.data.npcs || {});
                    // [수정] 루트 레벨에 직접 할당 (main.js 오류 수정)
                    GameData.statsList = result.data.statsList || [];
                    GameData.specialStats = result.data.specialStats || {};
                    GameData.expToLevel = result.data.expToLevel || {};
                    GameData.maxLevelModded = result.data.maxLevelModded || 30;
                    GameData.companionDialogues = result.data.companionDialogues || [];
                    break;

                // 월드 데이터 (도시, 층, 균열)를 합칩니다.
                case 'worldData':
                    /* AUTO-FIX: added guard for null data (Rule 4) */
                    Object.assign(GameData.cities, result.data.cities || {});
                    Object.assign(GameData.layers, result.data.layers || {});
                    Object.assign(GameData.rifts, result.data.rifts || {});
                    break;
                
                // 퀘스트 데이터를 로드합니다.
                /* AUTO-FIX: [Rule 4] Corrected parsing for quests.json. Data is at root. */
                case 'quests':
                    Object.assign(GameData.quests, result.data || {});
                    break;
                    
                default:
                    console.warn(`[Data Loader] 알 수 없는 데이터 키: ${result.key}`);
            }
        } else {
            console.error(`[Data Loader] ${result.key} (${result.path}) 데이터 로딩에 실패하여 스킵되었습니다.`);
        }
    }

    console.log("게임 데이터 로딩 및 병합 완료.", GameData);
    return GameData;
}