// data/loader.js
// 게임의 모든 데이터(JSON 및 JS 모듈)를 불러와 통합 관리하는 로더
// [수정] (v8) curios_data.js 로드 및 통합 로직 추가

// 1. JSON 데이터 경로 설정
const DATA_PATHS = {
    monsters1_3: 'data/monsters_grades_1-3.json',
    monsters4_6: 'data/monsters_grades_4-6.json',
    monsters7_10_b1: 'data/monsters_grades_7-10_b1.json',
    essences1_3: 'data/essences_grades_1-3.json',
    essences4_6: 'data/essences_grades_4-6.json',
    essences7_10_b1: 'data/essences_grades_7-10_b1.json',
    staticContent: 'data/static_content.json',
    worldData: 'data/world_data.json', 
    quests: 'data/quests.json',
    curios: 'data/curios.json' // [신규] Curio 데이터 추가
};

/**
 * 모든 게임 데이터를 비동기적으로 불러오고 통합합니다.
 * @returns {Promise<Object>} 통합된 GameData 객체
 */
export async function loadAllGameData() {
    console.log("게임 데이터 로딩 시작...");

    // 최종 GameData 객체 초기화
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
        layers: {}, // 맵 데이터 (JS 모듈에서 로드)
        rifts: {},
        hidden_fields: {}, 
        quests: {},
        curios: {}, // [신규] 상호작용 오브젝트 (JS 모듈에서 로드)
        statsList: [],
        specialStats: {},
        expToLevel: {},
        maxLevelModded: 30,
        companionDialogues: []
    };

    try {
        // 2. JS 모듈 데이터 동적 임포트 (맵, 기물)
        // (curios_data.js가 추가됨)
        const [maps1, maps2, maps3] = await Promise.all([
            import('./maps_floors_1-3.js'),
            import('./maps_floors_4-6.js'),
            import('./maps_floors_7-10.js')
        ]);
        
        // Curio 데이터는 JSON에서 로드 (curios.json)
        let curioData = null;

        // 맵 데이터 병합 (mapsFloors1_3, mapsFloors4_6, mapsFloors7_10)
        Object.assign(GameData.layers, maps1.mapsFloors1_3 || {}, maps2.mapsFloors4_6 || {}, maps3.mapsFloors7_10 || {});
        // maps도 동일하게 설정 (호환성)
        GameData.maps = { ...GameData.layers };
        
        // [신규] 기물(Curio) 데이터는 JSON에서 로드 (아래 fetch 단계에서 처리)

        console.log("JS 모듈 데이터 로드 완료:", Object.keys(GameData.layers).length + "개 층 데이터");

    } catch (error) {
        console.error("JS 모듈 로딩 실패:", error);
        // 일부 파일 로딩 실패 시에도 게임 진행을 위해 중단하지 않음
    }

    // 3. JSON 데이터 fetch 및 병합
    const fetchPromises = Object.entries(DATA_PATHS).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for file: ${path}`);
            }
            const data = await response.json();
            return { key, data };
        } catch (error) {
            console.error(`[Data Loader] 파일 로딩 실패: ${path}`, error);
            return { key, data: null };
        }
    });

    const results = await Promise.all(fetchPromises);

    for (const result of results) {
        if (result.data) {
            switch (result.key) {
                // 몬스터 데이터 병합
                case 'monsters1_3':
                case 'monsters4_6':
                case 'monsters7_10_b1':
                    Object.assign(GameData.monsters, result.data);
                    break;
                
                // 정수 데이터 병합
                case 'essences1_3':
                case 'essences4_6':
                case 'essences7_10_b1':
                    Object.assign(GameData.essences, result.data);
                    break;

                // 정적 콘텐츠 (아이템, 마법, 종족 등)
                case 'staticContent':
                    Object.assign(GameData.items, result.data.shopItems || {});
                    Object.assign(GameData.numbersItems, result.data.numbersItems || {});
                    Object.assign(GameData.materials, result.data.materials || {});
                    Object.assign(GameData.magic, result.data.magic || {});
                    Object.assign(GameData.races, result.data.races || {});
                    Object.assign(GameData.npcs, result.data.npcs || {});
                    
                    GameData.statsList = result.data.statsList || [];
                    GameData.specialStats = result.data.specialStats || {};
                    GameData.expToLevel = result.data.expToLevel || {};
                    GameData.maxLevelModded = result.data.maxLevelModded || 30;
                    GameData.companionDialogues = result.data.companionDialogues || [];
                    break;

                // 월드 데이터 (도시, 균열 정보)
                case 'worldData':
                    Object.assign(GameData.cities, result.data.cities || {});
                    // rifts 키 정규화: "4." 같은 키를 숫자층 키로 통합
                    const sourceRifts = result.data.rifts || {};
                    Object.keys(sourceRifts).forEach(rawKey => {
                        const normalized = String(rawKey).replace(/[^\d-]/g, '');
                        const targetKey = normalized.length > 0 ? normalized : String(rawKey);
                        const arr = Array.isArray(sourceRifts[rawKey]) ? sourceRifts[rawKey] : [];
                        GameData.rifts[targetKey] = (GameData.rifts[targetKey] || []).concat(arr);
                    });
                    Object.assign(GameData.hidden_fields, result.data.hidden_fields || {});
                    
                    // world_data.json에 혹시라도 layers 키가 남아있으면 경고 (JS 모듈이 우선)
                    if (result.data.layers) {
                        console.warn("경고: world_data.json에 layers 데이터가 남아있습니다. JS 모듈 데이터를 사용합니다.");
                    }
                    break;
                
                // 퀘스트 데이터
                case 'quests':
                    Object.assign(GameData.quests, result.data);
                    break;
                
                // Curio 데이터
                case 'curios':
                    Object.assign(GameData.curios, result.data || {});
                    console.log("Curio 데이터 로드 완료:", Object.keys(GameData.curios).length + "개 정의됨");
                    break;
            }
        }
    }

    console.log("모든 게임 데이터 로딩 완료.", GameData);
    return GameData;
}
