// 이 파일은 게임의 월드 콘텐츠 데이터를 보관합니다.
// (소재, 층, 몬스터, 아이템, NPC, 도시 등)
// 수정: logMessage, randomMonsterFromLayer, updateMenu -> p.cb.logMessage 등으로 변경
// 수정: 겜바바 설정.txt 내용 반영하여 데이터 대폭 확장
// [수정] 차원 비석(포탈) 등장 확률 소폭 상향
// --- [계획 수정 1] ---
// [수정] 1, 2, 3, 5, 6, 7층의 포탈 발견 이벤트에 'portalTo' 속성을 추가하고 effect를 비웁니다.
// [수정] 4층(천공의 탑)의 5층 포탈 발견 effect 로직을 'p.cb.showPortalChoice(5)'를 호출하도록 수정합니다.

// --- [오류 수정] 몬스터 데이터 정의 및 export ---
// classes.js에서 import할 수 있도록 monsters 객체를 정의하고 export합니다.
// layers 객체에 정의된 모든 몬스터 이름을 여기에 포함해야 합니다.
export const monsters = {
    // 1층 몬스터 (layers[1] 참조)
    "고블린": {
        grade: 9,
        hp: 50,
        atk: 10,
        def: 5,
        magic_def: 2,
        essences: ["고블린"],
        drops: ["강철 조각", "포션"],
        attacks: [
            { name: "기본 공격", dmg: 10, type: "physical" },
            { name: "덫 설치", effect: "trap", type: "utility" }
        ]
    },
    "구울": {
        grade: 9,
        hp: 60,
        atk: 12,
        def: 3,
        magic_def: 3,
        essences: [], // data_core에 구울 정수 없음
        drops: ["부패한 살점"],
        attacks: [
            { name: "할퀴기", dmg: 12, type: "physical" },
            { name: "물어뜯기", dmg: 15, type: "physical", dot: 3, dot_type: "poison" }
        ]
    },
    "노움": {
        grade: 9,
        hp: 40,
        atk: 8,
        def: 6,
        magic_def: 5,
        essences: ["노움"],
        drops: ["마력 깃든 흙"],
        attacks: [
            { name: "돌 던지기", dmg: 8, type: "physical" }
        ]
    },
    "칼날늑대": {
        grade: 9,
        hp: 70,
        atk: 15,
        def: 4,
        magic_def: 3,
        essences: ["칼날늑대"],
        drops: ["늑대 가죽"],
        attacks: [
            { name: "빠른 공격", dmg: 15, type: "physical" }
        ]
    },
    "드레드피어": { // 1층 보스
        grade: 7, // 임의
        hp: 1500,
        atk: 40,
        def: 20,
        magic_def: 20,
        essences: [],
        drops: ["상급 포션", "강철"],
        attacks: [
            { name: "공포의 일격", dmg: 40, type: "physical" },
            { name: "공포의 시선", effect: "fear", type: "magic" }
        ]
    },
    "베르자크": { // 1층 보스
        grade: 7, // 임의
        hp: 2000,
        atk: 35,
        def: 25,
        magic_def: 15,
        essences: [],
        drops: ["상급 포션", "라이티늄"],
        attacks: [
            { name: "심연의 일격", dmg: 45, type: "magic" }
        ]
    },
    "심연 고블린": {
        grade: 8, // 1층 히든
        hp: 100,
        atk: 15,
        def: 8,
        magic_def: 5,
        essences: ["심연 고블린"],
        drops: ["강철 조각"],
        attacks: [
            { name: "기습", dmg: 20, type: "physical" }
        ]
    },
    "심연 구울": { grade: 8, hp: 120, atk: 18, def: 5, magic_def: 5, essences: [], drops: ["부패한 살점"] },
    "심연 노움": { grade: 8, hp: 80, atk: 12, def: 10, magic_def: 8, essences: [], drops: ["마력 깃든 흙"] },
    "심연 칼날늑대": {
        grade: 8,
        hp: 140,
        atk: 20,
        def: 6,
        magic_def: 5,
        essences: ["심연 칼날늑대"],
        drops: ["늑대 가죽"],
        attacks: [
            { name: "심연의 습격", dmg: 25, type: "physical" }
        ]
    },

    // 2층 몬스터 (layers[2] 참조)
    "거대칼날늑대": { grade: 8, hp: 100, atk: 18, def: 6, magic_def: 4, essences: ["칼날늑대"], drops: ["늑대 가죽"] },
    "핏빛칼날늑대": { grade: 8, hp: 120, atk: 20, def: 5, magic_def: 5, essences: ["칼날늑대"], drops: ["늑대 가죽"] },
    "벽두더지": { grade: 8, hp: 90, atk: 15, def: 8, magic_def: 3, essences: [], drops: [] },
    "벽두더지 여왕": { grade: 7, hp: 300, atk: 25, def: 10, magic_def: 5, essences: [], drops: ["강철"] },
    "반달바위곰": { grade: 7, hp: 350, atk: 30, def: 15, magic_def: 8, essences: [], drops: ["곰 가죽"] },
    "불카르": { grade: 7, hp: 320, atk: 35, def: 12, magic_def: 10, essences: [], drops: ["화염석"] },
    "샤벨타이거": { grade: 7, hp: 280, atk: 40, def: 10, magic_def: 8, essences: [], drops: ["호랑이 가죽"] },
    "웨어울프": { grade: 7, hp: 400, atk: 38, def: 15, magic_def: 12, essences: [], drops: ["늑대 가죽"] },
    "엘더 구울": { grade: 8, hp: 130, atk: 15, def: 5, magic_def: 5, essences: [], drops: ["부패한 살점"] },
    "스켈레톤": { grade: 9, hp: 55, atk: 11, def: 6, magic_def: 4, essences: [], drops: [] },
    "스켈레톤 전사": { grade: 8, hp: 80, atk: 15, def: 10, magic_def: 5, essences: [], drops: ["강철 조각"] },
    "스켈레톤 궁수": { grade: 8, hp: 60, atk: 18, def: 5, magic_def: 5, essences: [], drops: [] },
    "스켈레톤 메이지": { grade: 8, hp: 50, atk: 20, def: 4, magic_def: 8, essences: [], drops: [] },
    "벤시": { grade: 8, hp: 100, atk: 25, def: 5, magic_def: 10, essences: [], drops: [] },
    "데스핀드": { grade: 8, hp: 180, atk: 20, def: 12, magic_def: 15, essences: ["데스핀드"], drops: [] },
    "키메라 울프": { grade: 7, hp: 300, atk: 30, def: 10, magic_def: 10, essences: [], drops: ["늑대 가죽"] },
    "구울로드": { grade: 7, hp: 400, atk: 35, def: 12, magic_def: 10, essences: [], drops: ["부패한 살점"] },
    "듀라한": { grade: 6, hp: 600, atk: 45, def: 20, magic_def: 15, essences: [], drops: ["라이티늄"] },
    "데스나이트": { grade: 6, hp: 700, atk: 50, def: 25, magic_def: 20, essences: ["데스나이트"], drops: ["라이티늄"] },
    "코볼트": { grade: 9, hp: 45, atk: 9, def: 4, magic_def: 2, essences: [], drops: ["강철 조각"] },
    "코볼트 방패병": { grade: 8, hp: 70, atk: 8, def: 12, magic_def: 3, essences: [], drops: ["강철 조각"] },
    "타락한 노움": { grade: 8, hp: 60, atk: 12, def: 8, magic_def: 8, essences: ["노움"], drops: ["마력 깃든 흙"] },
    "스톤골렘": { grade: 8, hp: 200, atk: 15, def: 20, magic_def: 10, essences: ["스톤골렘"], drops: ["마력결정체"] },
    "거석병": { grade: 7, hp: 450, atk: 25, def: 30, magic_def: 15, essences: [], drops: ["마력결정체"] },
    "샌드맨": { grade: 8, hp: 100, atk: 15, def: 5, magic_def: 10, essences: [], drops: [] },
    "샌드웜": { grade: 7, hp: 300, atk: 30, def: 10, magic_def: 8, essences: [], drops: [] },
    "데쓰웜": { grade: 6, hp: 500, atk: 40, def: 15, magic_def: 10, essences: [], drops: [] },
    "고블린 검사": { grade: 9, hp: 60, atk: 12, def: 6, magic_def: 2, essences: ["고블린"], drops: ["강철 조각"] },
    "고블린 궁수": { grade: 9, hp: 40, atk: 15, def: 4, magic_def: 3, essences: ["고블린 궁수"], drops: ["강철 조각"] },
    "홉 고블린": { grade: 7, hp: 150, atk: 25, def: 10, magic_def: 8, essences: ["홉 고블린"], drops: ["강철", "포션"] },
    "후회의 군주": { // 2층 보스
        grade: 6, // 임의
        hp: 3000,
        atk: 40,
        def: 20,
        magic_def: 25,
        essences: [],
        drops: ["상급 포션", "라이티늄"],
        attacks: [
            { name: "후회의 절규", dmg: 50, type: "magic" }
        ]
    },

    // 3층 몬스터 (layers[3] 참조)
    "웜스톤": { grade: 7, hp: 200, atk: 20, def: 20, magic_def: 10, essences: [], drops: ["강철"] },
    "아이언팔콘": { grade: 7, hp: 180, atk: 28, def: 10, magic_def: 8, essences: [], drops: [] },
    "강철언덕 수호병": { grade: 7, hp: 250, atk: 25, def: 15, magic_def: 10, essences: ["강철언덕 추격자"], drops: ["강철"] }, // 추격자 정수로 임시 대체
    "아이안트로": { grade: 7, hp: 300, atk: 22, def: 18, magic_def: 10, essences: ["아이안트로"], drops: ["강철"] },
    "오크 주술사": { grade: 8, hp: 120, atk: 15, def: 8, magic_def: 12, essences: ["오크 주술사"], drops: ["포션"] },
    "오크 전사": { grade: 8, hp: 180, atk: 22, def: 12, magic_def: 5, essences: [], drops: ["강철"] },
    "오크 궁수": { grade: 8, hp: 130, atk: 25, def: 8, magic_def: 6, essences: [], drops: ["강철"] },
    "오크 대전사": { grade: 7, hp: 300, atk: 30, def: 15, magic_def: 8, essences: [], drops: ["강철", "라이티늄"] },
    "오크 히어로": { grade: 5, hp: 800, atk: 50, def: 25, magic_def: 15, essences: ["오크 히어로"], drops: ["라이티늄", "상급 포션"] },
    "오크 로드": { grade: 4, hp: 1500, atk: 60, def: 30, magic_def: 20, essences: ["오크 로드"], drops: ["아이릴제", "상급 포션"] },
    "프로그맨": { grade: 8, hp: 100, atk: 18, def: 8, magic_def: 6, essences: ["프로그맨"], drops: [] },
    "리자드맨": { grade: 8, hp: 130, atk: 20, def: 10, magic_def: 7, essences: ["리자드맨 척후병"], drops: [] }, // 척후병 정수로 임시 대체
    "무명 조각상": { grade: 7, hp: 280, atk: 30, def: 20, magic_def: 10, essences: [], drops: ["마력결정체", "무명 조각"] },
    "페어리": { grade: 8, hp: 80, atk: 10, def: 5, magic_def: 15, essences: [], drops: [] }, // data_core에 Fairy 종족은 있으나 정수 없음
    "레이스": { grade: 9, hp: 60, atk: 15, def: 4, magic_def: 8, essences: ["레이스"], drops: [] },
    "위치스램프": { grade: 9, hp: 50, atk: 12, def: 3, magic_def: 10, essences: ["위치스램프"], drops: [] },
    "우드맨": { grade: 8, hp: 150, atk: 20, def: 10, magic_def: 5, essences: [], drops: [] },
    "스네트리": { grade: 7, hp: 200, atk: 25, def: 12, magic_def: 8, essences: [], drops: [] },
    "다이로우터": { grade: 7, hp: 220, atk: 28, def: 10, magic_def: 10, essences: [], drops: [] },
    "돌연변이 하급 정령": { grade: 7, hp: 150, atk: 30, def: 5, magic_def: 15, essences: [], drops: [] },
    "호문쿨루스": { grade: 7, hp: 100, atk: 15, def: 10, magic_def: 10, essences: [], drops: [] },
    "아울베어": { grade: 7, hp: 330, atk: 32, def: 15, magic_def: 8, essences: [], drops: ["곰 가죽"] },
    "드라이어드": { grade: 7, hp: 200, atk: 20, def: 10, magic_def: 15, essences: [], drops: [] },
    "하프 트롤": { grade: 7, hp: 400, atk: 30, def: 15, magic_def: 5, essences: ["하프 트롤"], drops: ["트롤 뼈"] },
    "카나바로": { grade: 7, hp: 250, atk: 35, def: 10, magic_def: 10, essences: ["카나바로"], drops: [] },
    "플미나스": { grade: 7, hp: 280, atk: 30, def: 12, magic_def: 12, essences: [], drops: [] },
    "리아키스": { // 3층 보스
        grade: 5, // 임의
        hp: 4000,
        atk: 50,
        def: 25,
        magic_def: 30,
        essences: [],
        drops: ["아이릴제", "상급 포션"],
        attacks: [
            { name: "혼돈의 속삭임", dmg: 60, type: "magic" }
        ]
    },

    // 4층 몬스터 (layers[4] 참조)
    "바이쿤두스": { grade: 6, hp: 500, atk: 40, def: 20, magic_def: 15, essences: [], drops: ["라이티늄"] },
    "헬 하운드": { grade: 6, hp: 450, atk: 45, def: 15, magic_def: 18, essences: [], drops: ["화염석"] },
    "트롤": { grade: 5, hp: 1000, atk: 50, def: 25, magic_def: 10, essences: [], drops: ["트롤 뼈", "불멸의 심장"] }, // 오우거 정수 아님
    "천공의 군주": { grade: 4, hp: 5000, atk: 60, def: 30, magic_def: 30, essences: [], drops: ["아이디움"] }, // 4층 보스
    "조율자 그레고리": { grade: 4, hp: 4500, atk: 55, def: 25, magic_def: 35, essences: [], drops: ["아이디움"] }, // 4층 보스

    // 5층 몬스터 (layers[5] 참조)
    "불의 망자": { grade: 5, hp: 600, atk: 45, def: 20, magic_def: 20, essences: [], drops: ["화염석"] },
    "밀라로든": { grade: 5, hp: 700, atk: 40, def: 25, magic_def: 20, essences: [], drops: ["화염석"] },
    "레드머드": { grade: 5, hp: 650, atk: 42, def: 22, magic_def: 18, essences: [], drops: [] },
    "스톤번": { grade: 5, hp: 750, atk: 38, def: 30, magic_def: 15, essences: [], drops: [] },
    "이프리트": { grade: 5, hp: 500, atk: 55, def: 15, magic_def: 25, essences: [], drops: ["화염석"] },
    "헬 프레임": { grade: 5, hp: 550, atk: 50, def: 18, magic_def: 22, essences: [], drops: ["화염석"] },
    "타락한 피조물": { grade: 5, hp: 700, atk: 48, def: 20, magic_def: 15, essences: [], drops: [] },
    "커스스톤": { grade: 5, hp: 600, atk: 40, def: 25, magic_def: 20, essences: [], drops: [] },
    "혈원귀": { grade: 5, hp: 500, atk: 50, def: 15, magic_def: 25, essences: [], drops: [] },
    "다키리온": { grade: 5, hp: 750, atk: 45, def: 20, magic_def: 20, essences: [], drops: [] },
    "소울이터": { grade: 5, hp: 650, atk: 52, def: 18, magic_def: 22, essences: [], drops: [] },
    "미믹": { grade: 7, hp: 300, atk: 30, def: 10, magic_def: 10, essences: ["미믹"], drops: ["골드", "포션"] },
    "베르타스": { grade: 5, hp: 800, atk: 50, def: 20, magic_def: 20, essences: [], drops: [] },
    "실리어트": { grade: 4, hp: 6000, atk: 65, def: 30, magic_def: 30, essences: [], drops: ["월광석"] }, // 5층 보스
    "화주 피아닐": { grade: 4, hp: 5500, atk: 70, def: 25, magic_def: 35, essences: [], drops: ["월광석"] }, // 5층 보스
    "지옥거인 헤르쟈": { grade: 4, hp: 7000, atk: 75, def: 35, magic_def: 20, essences: [], drops: ["월광석"] }, // 5층 보스

    // 6층 몬스터 (layers[6] 참조 - 너무 많아서 일부만 스탯 정의)
    "해각수": { grade: 4, hp: 1000, atk: 50, def: 25, magic_def: 20, essences: [], drops: [] },
    "머멀 대전사": { grade: 5, hp: 700, atk: 45, def: 20, magic_def: 15, essences: [], drops: [] },
    "딥다이버": { grade: 5, hp: 600, atk: 50, def: 15, magic_def: 18, essences: [], drops: [] },
    "쉘아머": { grade: 5, hp: 800, atk: 40, def: 35, magic_def: 20, essences: [], drops: [] },
    "씨웜": { grade: 5, hp: 750, atk: 48, def: 18, magic_def: 15, essences: [], drops: [] },
    "마리모어": { grade: 4, hp: 1200, atk: 55, def: 20, magic_def: 25, essences: [], drops: [] },
    "나가쿨로스": { grade: 4, hp: 1300, atk: 60, def: 22, magic_def: 22, essences: [], drops: [] },
    "머멀": { grade: 6, hp: 400, atk: 30, def: 15, magic_def: 10, essences: [], drops: [] },
    "머멀 전사": { grade: 6, hp: 500, atk: 35, def: 18, magic_def: 12, essences: [], drops: [] },
    "머멀 궁수": { grade: 6, hp: 350, atk: 40, def: 12, magic_def: 10, essences: [], drops: [] },
    "머멀 주술사": { grade: 6, hp: 300, atk: 25, def: 10, magic_def: 20, essences: [], drops: [] },
    "스터렙": { grade: 4, hp: 1100, atk: 50, def: 25, magic_def: 20, essences: [], drops: [] },
    "크룽비": { grade: 4, hp: 1000, atk: 52, def: 22, magic_def: 18, essences: [], drops: [] },
    "라네무트 전사": { grade: 4, hp: 1200, atk: 55, def: 28, magic_def: 15, essences: [], drops: [] },
    "소라고동뿔": { grade: 4, hp: 900, atk: 45, def: 30, magic_def: 25, essences: [], drops: [] },
    "가르벨": { grade: 4, hp: 1400, atk: 60, def: 25, magic_def: 20, essences: [], drops: [] },
    "씨자이언트": { grade: 3, hp: 2000, atk: 70, def: 30, magic_def: 15, essences: [], drops: ["미스릴"] },
    "나가 궁수": { grade: 4, hp: 800, atk: 65, def: 15, magic_def: 20, essences: [], drops: [] },
    "팔푸스의 뱀": { grade: 4, hp: 1000, atk: 50, def: 20, magic_def: 20, essences: [], drops: [] },
    "세이렌": { grade: 5, hp: 600, atk: 40, def: 15, magic_def: 25, essences: [], drops: [] },
    "세이렌 여왕": { grade: 4, hp: 1500, atk: 50, def: 20, magic_def: 30, essences: [], drops: [] },
    "구아노 씨 서펜트": { grade: 3, hp: 2500, atk: 70, def: 25, magic_def: 20, essences: [], drops: ["미스릴"] },
    "엘프로트": { grade: 4, hp: 1100, atk: 55, def: 20, magic_def: 20, essences: [], drops: [] },
    "스톰거쉬": { grade: 3, hp: 3000, atk: 75, def: 30, magic_def: 25, essences: [], drops: ["미스릴"] },
    "블랙 트리": { grade: 5, hp: 700, atk: 40, def: 25, magic_def: 10, essences: [], drops: [] },
    "래플 몽키": { grade: 5, hp: 500, atk: 45, def: 15, magic_def: 15, essences: [], drops: [] },
    "워 스네이크": { grade: 5, hp: 650, atk: 50, def: 18, magic_def: 15, essences: [], drops: [] },
    "니겔 펜서": { grade: 5, hp: 700, atk: 52, def: 20, magic_def: 16, essences: [], drops: [] },
    "벨가로": { grade: 4, hp: 1300, atk: 60, def: 25, magic_def: 20, essences: [], drops: [] },
    "라플레미믹": { grade: 4, hp: 1000, atk: 50, def: 20, magic_def: 20, essences: ["미믹"], drops: ["골드", "상급 포션"] },
    "해저 수호병": { grade: 4, hp: 1400, atk: 58, def: 30, magic_def: 20, essences: [], drops: [] },
    "해신석": { grade: 4, hp: 1000, atk: 40, def: 40, magic_def: 30, essences: [], drops: [] },
    "라비토르": { grade: 3, hp: 2200, atk: 65, def: 28, magic_def: 22, essences: [], drops: [] },
    "머멀 제사장": { grade: 4, hp: 900, atk: 45, def: 18, magic_def: 30, essences: [], drops: [] },
    "리우모비딕": { grade: 3, hp: 2800, atk: 70, def: 30, magic_def: 25, essences: [], drops: [] },
    "심해 거인": { grade: 3, hp: 3200, atk: 75, def: 35, magic_def: 20, essences: [], drops: [] },
    "테트라세아": { grade: 3, hp: 8000, atk: 80, def: 35, magic_def: 40, essences: [], drops: ["미스티움"] }, // 6층 보스

    // 7층 몬스터 (layers[7] 참조 - 기본값)
    "절벽귀": { grade: 3, hp: 2000, atk: 60, def: 25, magic_def: 20, essences: [], drops: [] },
    "스켈레톤 머메이드 퀸": { grade: 3, hp: 2500, atk: 65, def: 20, magic_def: 30, essences: [], drops: [] },
    "데드번": { grade: 3, hp: 2200, atk: 70, def: 22, magic_def: 20, essences: [], drops: [] },
    "협곡 망령": { grade: 3, hp: 1800, atk: 60, def: 15, magic_def: 25, essences: [], drops: [] },
    "데드아이": { grade: 3, hp: 2100, atk: 68, def: 20, magic_def: 20, essences: [], drops: [] },
    "티쓰 스켈레톤": { grade: 3, hp: 2300, atk: 65, def: 28, magic_def: 15, essences: [], drops: [] },
    "고스티즈": { grade: 3, hp: 1900, atk: 55, def: 18, magic_def: 30, essences: [], drops: [] },
    "말더 엘펀트": { grade: 2, hp: 4000, atk: 80, def: 35, magic_def: 20, essences: [], drops: [] },
    "벤시 퀸": { grade: 2, hp: 3000, atk: 60, def: 20, magic_def: 40, essences: [], drops: [] },
    "카오스씨먼": { grade: 2, hp: 3500, atk: 75, def: 25, magic_def: 25, essences: [], drops: [] },
    "소울드링커": { grade: 2, hp: 3200, atk: 70, def: 22, magic_def: 30, essences: [], drops: [] },
    "기가울프": { grade: 2, hp: 3800, atk: 80, def: 30, magic_def: 20, essences: [], drops: [] },
    "벨라리오스": { grade: 2, hp: 4200, atk: 78, def: 28, magic_def: 25, essences: [], drops: [] },
    "잠베트": { grade: 2, hp: 3600, atk: 72, def: 25, magic_def: 28, essences: [], drops: [] },
    "공허 개미": { grade: 3, hp: 1500, atk: 50, def: 20, magic_def: 15, essences: [], drops: [] },
    "헬구울": { grade: 3, hp: 2000, atk: 60, def: 18, magic_def: 15, essences: [], drops: [] },
    "마이눔": { grade: 2, hp: 3300, atk: 70, def: 25, magic_def: 25, essences: [], drops: [] },
    "다크 크리스탈": { grade: 2, hp: 2500, atk: 50, def: 35, magic_def: 35, essences: [], drops: [] },
    "볼-헤르찬": { grade: 2, hp: 4500, atk: 85, def: 30, magic_def: 25, essences: [], drops: [] },
    "바이테리온": { grade: 3, hp: 2800, atk: 70, def: 20, magic_def: 20, essences: [], drops: ["바이테리온의 발톱"] },
    "본 드래고니안": { grade: 2, hp: 5000, atk: 90, def: 35, magic_def: 30, essences: [], drops: [] },
    "바이욘": { grade: 3, hp: 2600, atk: 65, def: 22, magic_def: 22, essences: [], drops: ["기생 거미"] },
    "서리불꽃 거북": { grade: 3, hp: 2400, atk: 60, def: 35, magic_def: 25, essences: [], drops: [] },
    "얼어붙은 영혼": { grade: 3, hp: 1800, atk: 50, def: 15, magic_def: 30, essences: [], drops: [] },
    "오염된 눈의 정령": { grade: 3, hp: 2000, atk: 55, def: 20, magic_def: 28, essences: [], drops: [] },
    "리치": { grade: 4, hp: 1500, atk: 40, def: 15, magic_def: 35, essences: ["리치"], drops: ["망자의 영혼"] },
    "스톤윈터": { grade: 3, hp: 2800, atk: 65, def: 30, magic_def: 20, essences: [], drops: [] },
    "프로스트 가디언": { grade: 2, hp: 4000, atk: 75, def: 35, magic_def: 25, essences: [], drops: [] },
    "빙하 거인": { grade: 2, hp: 4800, atk: 85, def: 40, magic_def: 20, essences: [], drops: [] },
    "프로즌 웹터": { grade: 3, hp: 2200, atk: 62, def: 20, magic_def: 22, essences: [], drops: [] },
    "서리불꽃 고블린": { grade: 4, hp: 1000, atk: 45, def: 15, magic_def: 18, essences: ["고블린"], drops: [] },
    "녹지 않는 고치": { grade: 3, hp: 1500, atk: 0, def: 30, magic_def: 30, essences: [], drops: [] },
    "메르안": { grade: 2, hp: 3500, atk: 70, def: 25, magic_def: 28, essences: [], drops: [] },
    "청염조": { grade: 2, hp: 3000, atk: 75, def: 20, magic_def: 30, essences: [], drops: [] },
    "유령마": { grade: 3, hp: 2000, atk: 60, def: 18, magic_def: 25, essences: [], drops: [] },
    "가고일": { grade: 8, hp: 150, atk: 20, def: 15, magic_def: 10, essences: ["가고일"], drops: [] },
    "화이트 와이번": { grade: 2, hp: 4500, atk: 80, def: 30, magic_def: 28, essences: [], drops: [] },
    "카리아데아": { grade: 2, hp: 4200, atk: 75, def: 25, magic_def: 30, essences: [], drops: [] },
    "데드레드": { grade: 2, hp: 10000, atk: 90, def: 40, magic_def: 40, essences: [], drops: ["아크"] }, // 7층 보스

    // 8층 몬스터 (layers[8] - 없음)
    "희망의 군주": { grade: 1, hp: 20000, atk: 100, def: 50, magic_def: 50, essences: [], drops: [] }, // 8층 보스

    // 9층 몬스터 (layers[9] 참조)
    "기가제르오스": { grade: 1, hp: 8000, atk: 110, def: 40, magic_def: 30, essences: [], drops: [] },
    "본 드래곤": { grade: 1, hp: 10000, atk: 120, def: 45, magic_def: 35, essences: [], drops: [] },
    "드라이즌": { grade: 1, hp: 7500, atk: 100, def: 35, magic_def: 40, essences: [], drops: [] },
    "브라키아이스텔로": { grade: 1, hp: 9000, atk: 115, def: 42, magic_def: 30, essences: [], drops: [] },
    "라망시스": { grade: 1, hp: 8500, atk: 105, def: 38, magic_def: 38, essences: [], drops: [] },

    // 10층 몬스터 (layers[10] 참조)
    "길티고스": { grade: 1, hp: 12000, atk: 130, def: 50, magic_def: 40, essences: [], drops: [] },
    "톨-라푸파": { grade: 1, hp: 11000, atk: 120, def: 45, magic_def: 45, essences: [], drops: [] },
    "어비스 스켈레톤": { grade: 1, hp: 9000, atk: 110, def: 40, magic_def: 30, essences: [], drops: [] },
    "종말의 기사": { grade: 1, hp: 25000, atk: 150, def: 60, magic_def: 50, essences: ["종말의 기사"], drops: [] }, // 10층 보스

    // 지하 1층 몬스터 (layers["-1"] 참조)
    "맥구리": { grade: 7, hp: 300, atk: 25, def: 10, magic_def: 10, essences: [], drops: [] },
    "텐타쿨란": { grade: 6, hp: 500, atk: 35, def: 15, magic_def: 15, essences: [], drops: [] },
    "디아몬트": { grade: 6, hp: 600, atk: 30, def: 20, magic_def: 10, essences: [], drops: [] },
    "굴다람쥐": { grade: 7, hp: 250, atk: 30, def: 8, magic_def: 5, essences: [], drops: [] },
    "원주민": { grade: 7, hp: 350, atk: 28, def: 12, magic_def: 10, essences: [], drops: [] },
    "레카르도": { grade: 5, hp: 4500, atk: 55, def: 25, magic_def: 25, essences: [], drops: [] }, // 지하 1층 보스

    // 기타 (ui.js, classes.js 참조)
    "균열 수호자": {
        grade: 5, // 임의
        hp: 1000,
        atk: 50,
        def: 30,
        magic_def: 30,
        essences: ["균열"],
        drops: ["균열석"],
        attacks: [
            { name: "차원 가르기", dmg: 60, type: "magic" }
        ]
    },
    "클랜 멤버": { // 5층 이벤트 참조
       grade: 6,
       hp: 300,
       atk: 35,
       def: 15,
       magic_def: 10,
       essences: [],
       drops: ["강철 검", "포션"],
       attacks: [
           { name: "베기", dmg: 35, type: "physical" }
       ]
   }
};
// --- 몬스터 데이터 추가 완료 ---


// 소재 아이템 데이터
// 소재 아이템 데이터
export const materials = {
    "강철 조각": { desc: "고블린 등이 드랍하는 기초 금속 조각.", tier: 0 },
    "부패한 살점": { desc: "구울에게서 얻을 수 있는 재료.", tier: 0 },
    "마력 깃든 흙": { desc: "노움에게서 얻을 수 있는 재료.", tier: 0 },
    "늑대 가죽": { desc: "칼날늑대의 가죽.", tier: 1 },
    "강철": { desc: "1단계 금속. 기본적인 장비 제작에 사용.", tier: 1 }, //
    "라이티늄": { desc: "2단계 금속. 강철보다 2배 가볍고 단단함.", tier: 2 }, //
    "와이번 가죽": { desc: "2단계 소재. 가죽 방어구 제작에 사용.", tier: 2 }, //
    "레드우드": { desc: "2단계 소재 목재.", tier: 2 }, //
    "트롤 뼈": { desc: "3단계 소재. 매우 단단하다.", tier: 3 }, //
    "아이릴제": { desc: "3단계 합금. 미스릴과 강철 혼합.", tier: 3 }, //
    "아이디움": { desc: "3단계 금속. 일부 희귀 몬스터에게서 발견됨.", tier: 3 }, //
    "월광석": { desc: "4단계 금속. 마법적인 기운을 띈다.", tier: 4 }, //
    "보르탈 나무": { desc: "4단계 소재인 나무.", tier: 4 },
    "미스릴": { desc: "5단계 금속. 가볍고 매우 강하다.", tier: 5 }, //
    "아다만티움": { desc: "5단계 금속. 무겁지만 속성 데미지 50% 감소.", tier: 5 }, //
    "오우거 가죽": { desc: "5단계 가죽. 질기고 튼튼하다.", tier: 5 }, //
    "드레이크 가죽": { desc: "항마력 보정이 높지만 물리 방어에 취약.", tier: 5 },
    "미스티움": { desc: "6단계 금속. 주로 왕가에 납품된다.", tier: 6 }, //
    "아크": { desc: "6단계 금속. 마법 카운터. 용인족만 제대로 다룰 수 있다.", tier: 6 }, //
    "세계수": { desc: "6단계 소재 나무. 강력한 생명력을 지님.", tier: 6 }, //
    "블루스톤": { desc: "최상급 장비 소재. 6층 씨머챈트에게 얻을 수 있다.", tier: 6 },
    "아르테네목": { desc: "최상급 선박 재료. 단단하고 부력이 좋다.", tier: 6 },
    "불멸의 심장": { desc: "트롤에게서 극히 낮은 확률로 얻는 3등급 소재. 혼령각인 6단계 재료.", tier: 3 },
    "망자의 영혼": { desc: "리치에게서 얻는 4등급 소재. 혼령각인 7단계 재료.", tier: 4 },
    // --- [수정된 부분] ---
    "마력결정체": { desc: "무명 조각상 등에게서 얻는 소재.", tier: 'N/A' },
    "무명 조각": { desc: "무명 조각상에게서 얻는 특수 소재. 지하 1층 입장 열쇠.", tier: 'N/A' },
    // --- [수정 완료] ---
    "바이테리온의 발톱": { desc: "7층 희귀몹 바이테리온의 부산물. 혼령각인 8단계 재료.", tier: 3 },
    "기생 거미": { desc: "3등급 바이욘의 부산물. 혼령각인 8단계 재료.", tier: 3 },
    // --- [수정된 부분] ---
    "노밀라트의 루비": { desc: "혼령각인 8단계 재료.", tier: 'N/A' },
    // --- [수정 완료] ---
    "곰 가죽": { desc: "반달바위곰의 가죽.", tier: 2 },
    "화염석": { desc: "불카르, 헬 하운드 등에게서 얻는 마력이 담긴 돌.", tier: 2 },
    "호랑이 가죽": { desc: "샤벨타이거의 가죽.", tier: 2 },
};

// 4. 미궁 층 (Layers) - 겜바바 설정 기반 상세 구현 (1~7층 위주)
export const layers = {
    1: { //
        name: "수정동굴",
        desc: "수정 동굴, 수정에서 빛이 나옴. 동쪽(칼날늑대), 서쪽(노움), 남쪽(구울), 북쪽(고블린)으로 2층 포탈 4개. 중앙 기념비 안전 구역. 어두운 구역 시야 감소.", //
        monsters: ["고블린", "구울", "노움", "칼날늑대"], //
        events: [
            {desc: "중앙 기념비 발견. 대현자에 대한 기록을 읽었다.", effect: function(p) { p.gainExp(50); p.cb.logMessage("대현자의 기념비를 발견하고 약간의 경험치를 얻었다."); }}, //
            {desc: "어두운 구역 진입. 시야가 감소하고 매복의 위험이 도사린다.", effect: function(p) { p.cb.logMessage("시야가 극도로 제한된다!"); if (Math.random() < 0.3) p.startCombat(p.cb.randomMonsterFromLayer(1)); }}, //
            {desc: "미궁의 구조가 바뀌어 길이 복잡해졌다.", effect: function(p) { p.cb.logMessage("익숙했던 길이 막히고 새로운 길이 나타났다."); }}, //
            {desc: "숨겨진 수정 벽을 발견했다. 안에서 수정 조각을 획득했다.", effect: function(p) { p.addItem("수정 조각"); }}, //
            // --- [계획 수정 1] ---
            {desc: "2층으로 향하는 차원 비석을 발견했다!", portalTo: 2, effect: function(p) { /* ui_main.js에서 portalTo 속성을 감지하여 처리 */ }}, // [수정] effect를 비우고 portalTo: 2 추가
            // --- [수정 완료] ---
            {desc: "외곽 지역을 탐색하던 중, 굶주린 몬스터 무리와 조우했다!", effect: function(p) { p.startCombat(p.cb.getRandomMonsters(1)); }}, // getRandomMonsters 사용
            {desc: "파티원이 5명 이상 모여있다. 시간이 흐르자 불길한 기운이 감돈다...", effect: function(p) { if(p.party.length + 1 >= 5 && p.daysInLabyrinth * 24 + p.explorationCount > 72 && Math.random() < 0.1) {p.cb.logMessage("공포의 군주 드레드피어가 나타났다!"); p.startCombat("드레드피어"); } }}, //
            {desc: "깊은 어둠 속에서 심연의 기운이 느껴진다! 베르자크의 영향으로 강력한 심연 몬스터가 나타났다!", effect: function(p) { p.startCombat(["심연 고블린", "심연 구울", "심연 노움", "심연 칼날늑대"]); }}, //
            {desc: "반짝이는 무언가를 발견했다. 작은 마석이었다.", effect: (p) => { p.magic_stones += Math.floor(Math.random() * 5) + 1; p.cb.logMessage("작은 마석 몇 개를 주웠다."); }},
            {desc: "고블린의 엉성한 덫에 걸릴 뻔했지만, 재빨리 피했다.", effect: (p) => { p.cb.logMessage("바닥에 숨겨진 덫을 발견하고 조심스럽게 지나갔다."); }},
            {desc: "지하로 이어지는 듯한 수상한 비석을 발견했다.", effect: (p) => { p.cb.logMessage("비석 아래에 '하나의 별, 하나의 태양, 하나의 달...'이라는 글귀가 적혀있다."); /* 지하 입구 로직 필요 */ }}, //
        ],
        time_limit: 168, //
        hidden_pieces: [
            {name: "대현자의 기념비", desc: "미궁 창조 가설에 대한 단서를 제공.", effect: function(p) { p.cb.logMessage("기념비의 기록: '이 미궁은 누군가에 의해 창조되었을지도 모른다.'"); }} //
        ],
        bosses: ["드레드피어", "베르자크"] //
    },
    2: { //
        name: "짐승의 소굴/망자의 땅/바위 사막/고블린 숲",
        desc: "4개의 구역으로 나뉨. 밤처럼 어둡지만 별빛 천장이 약간의 시야 제공. 1층보다 몬스터가 훨씬 많고 강하다.", //
        monsters: [ // 각 구역별 몬스터 세분화 필요
            // 짐승의 소굴
            "거대칼날늑대", "핏빛칼날늑대", "벽두더지", "벽두더지 여왕", "반달바위곰", "불카르", "샤벨타이거", "웨어울프",
            // 망자의 땅
            "구울", "엘더 구울", "스켈레톤", "스켈레톤 전사", "스켈레톤 궁수", "스켈레톤 메이지", "벤시", "데스핀드", "키메라 울프", "구울로드", "듀라한", "데스나이트",
            // 바위 사막
            "노움", "코볼트", "코볼트 방패병", "타락한 노움", "스톤골렘", "거석병", "샌드맨", "샌드웜", "데쓰웜",
            // 고블린 숲
            "고블린", "고블린 검사", "고블린 궁수", "홉 고블린"],
        events: [
            {desc: "고블린 숲 깊숙한 곳, 교묘하게 숨겨진 덫을 밟았다!", effect: function(p) { if ((p.stats["민첩성"] || 10) < 15) {p.hp -= 20; p.cb.logMessage("덫에 걸려 20의 피해를 입었다!"); p.applyDebuff("출혈(약)");} else {p.cb.logMessage("민첩하게 덫을 피했다!");} }}, //
            {desc: "망자의 땅 중심부, 짙은 어둠 속에서 벤시의 울음소리가 들려온다.", effect: function(p) { p.cb.logMessage("벤시의 울음소리가 정신을 어지럽힌다..."); p.applyDebuff("혼란(약)"); }}, //
            {desc: "짐승의 소굴의 복잡한 협곡. 뛰어난 감각으로 숨겨진 길을 찾아냈다.", effect: function(p) { if ((p.stats["육감"] || 0) > 15 || (p.stats["후각"] || 0) > 15) { p.gainExp(100); p.cb.logMessage("뛰어난 감각으로 숨겨진 길을 찾아 추가 경험치를 얻었다!"); } else { p.cb.logMessage("복잡한 협곡에서 길을 헤매는 듯 하다."); } }}, //
            {desc: "망자의 땅 깊숙한 곳, 강력한 언데드 데스핀드가 나타났다!", effect: function(p) { p.startCombat("데스핀드"); }}, //
            {desc: "바위 사막의 뜨거운 공기와 모래 함정. 조심하지 않으면 위험하다.", effect: function(p) { p.stamina -= 10; p.cb.logMessage("뜨거운 열기로 기력이 소모된다."); if(Math.random() < 0.1) { p.hp -= 15; p.cb.logMessage("모래 함정에 빠져 피해를 입었다!"); } }}, //
            {desc: "고블린 숲 외곽, 7등급 몬스터 홉 고블린과 조우했다!", effect: function(p) { p.startCombat("홉 고블린"); }}, //
            // --- [계획 수정 1] ---
            {desc: "3층으로 가는 차원 비석을 발견했다.", portalTo: 3, effect: function(p) { /* ui_main.js에서 portalTo 속성을 감지하여 처리 */ }}, // [수정] effect를 비우고 portalTo: 3 추가
            // --- [수정 완료] ---
            {desc: "이곳 어딘가에 후회의 군주가 숨어있다는 소문이 있다.", effect: function(p) { p.cb.logMessage("주변에서 강력하지만 슬픈 기운이 느껴진다..."); }}, //
            {desc: "스켈레톤 무리가 나타났다! 수가 많으니 조심해야 한다.", effect: (p) => { p.startCombat(Array(Math.floor(Math.random() * 5) + 3).fill("스켈레톤")); }},
            {desc: "버려진 제단을 발견했다. 특정 몬스터의 마석을 바치면 균열이 열릴지도 모른다.", effect: (p) => { p.cb.logMessage("제단에 마석을 바칠 수 있을 것 같다."); /* 균열 강제 오픈 로직 */ }}, //
        ],
        time_limit: 240, //
        hidden_pieces: [
            {name: "짐승의 소굴 숨겨진 동굴", desc: "희귀 약초 발견.", effect: function(p) { p.addItem("희귀 약초"); p.cb.logMessage("숨겨진 동굴에서 희귀 약초를 발견했다."); }},
            {name: "망자의 땅 저주받은 유물", desc: "강력한 저주가 걸린 유물. 해제 시 보상 혹은 페널티.", effect: function(p) { p.addItem("저주받은 유물"); p.cb.logMessage("망자의 땅 깊은 곳에서 저주받은 유물을 발견했다."); }}
        ],
        bosses: ["후회의 군주"] //
    },
    3: { //
        name: "순례자의 길",
        desc: "매우 넓은 층. 강철바위 언덕, 오크 군락지, 황혼의 비탈길, 칠흑의 강어귀, 녹빛꼬리 습지, 조각 사원, 가시갈대 밭, 마녀의 숲(중앙) 등 다양한 필드로 구성.", //
        monsters: [
            // 강철바위 언덕
            "웜스톤", "아이언팔콘", "강철언덕 수호병", "아이안트로",
            // 오크 군락지
            "오크 주술사", "오크 전사", "오크 궁수", "오크 대전사", "오크 히어로", "오크 로드",
            // 칠흑의 강어귀
            "프로그맨",
            // 녹빛꼬리 습지
            "리자드맨",
            // 조각 사원
            "무명 조각상",
            // 마녀의 숲
            "페어리", "레이스", "위치스램프", "우드맨", "스네트리", "다이로우터", "돌연변이 하급 정령", "호문쿨루스", "아울베어", "드라이어드", "하프 트롤", "카나바로",
            // 기타 필드
            "플미나스"
        ],
        events: [
            {desc: "마녀의 숲에 진입하자 방향 감각이 사라지고 환각과 환청에 시달린다! [방향 상실], [환각], [환청], [통각강화] 디버프!", effect: function(p) { p.applyDebuff("방향 상실"); p.applyDebuff("환각"); p.applyDebuff("환청"); p.applyDebuff("통각강화"); p.cb.logMessage("마녀의 숲의 저주가 정신을 어지럽힌다!"); }}, //
            {desc: "숲에서 12시간 이상 머물자 [마녀의 눈] 디버프가 생겼다! 한 곳에 오래 머물면 사냥꾼 '카나바로'가 나타난다!", effect: function(p) { p.applyDebuff("마녀의 눈"); p.cb.logMessage("[마녀의 눈] 효과로 인해 한 곳에 오래 머무르면 위험하다!"); if (Math.random() < 0.2) p.startCombat("카나바로"); }}, //
            {desc: "우연히 '마녀의 오두막' 입구를 발견했다! 8시간 동안 안전하게 쉴 수 있는 공간이다 (최대 5명).", effect: function(p) { /* 오두막 입장 로직 필요 */ p.cb.logMessage("신비로운 오두막을 발견했다. 안식처가 될지도 모른다."); }}, //
            {desc: "오크 군락지에서 오크 대전사 무리와 마주쳤다!", effect: function(p) { p.startCombat(Array(Math.floor(Math.random() * 3) + 2).fill("오크 대전사")); }}, //
            {desc: "조각 사원 깊숙한 곳, 목 없는 조각상들 사이에서 기이한 힘이 느껴진다.", effect: function(p) { p.cb.logMessage("조각상들 사이에서 스산한 기운이 감돈다."); if(Math.random() < 0.3) p.startCombat("무명 조각상"); }}, //
            // --- [계획 수정 1] ---
            {desc: "4층 천공의 탑으로 가는 차원 비석을 발견했다.", portalTo: 4, effect: function(p) { /* ui_main.js에서 portalTo 속성을 감지하여 처리 */ }}, // [수정] effect를 비우고 portalTo: 4 추가
            // --- [수정 완료] ---
            {desc: "7명의 제물이 바쳐지면 혼돈의 군주 리아키스가 깨어난다는 소문을 들었다.", effect: (p) => { p.cb.logMessage("끔찍한 소문이다. 그런 일이 일어나지 않기를 바랄 뿐..."); }}, //
            {desc: "오크 군락지 제단에 오크 대전사 마석 777개를 바치면 히든 보스가 소환된다고 한다.", effect: (p) => { p.cb.logMessage("오크 군락지 중앙에 있는 제단이 수상해 보인다."); /* 히든 보스 소환 로직 */ }}, //
        ],
        time_limit: 360, // 15일
        hidden_pieces: [
            {name: "마녀의 오두막 벽난로", desc: "혼돈의 군주 리아키스 처치 후 오두막 내부 벽난로를 통해 보상 획득 가능.", effect: function(p) { /* 리아키스 처치 여부 확인 및 보상 로직 필요 */ p.cb.logMessage("벽난로 안에서 무언가 빛나고 있다."); }} //
        ],
        bosses: ["리아키스"] //
    },
    4: { //
        name: "천공의 탑",
        desc: "독립된 계층. 스테이지형 구조. 용기, 지혜, 운명, 인내의 문 중 하나를 선택하여 시련 통과. 100층 이상 돌파 시 5층 진입 가능.", //
        monsters: [ // 3층 몬스터 + 6등급 일부
            "오크 주술사", "오크 전사", "프로그맨", "리자드맨", "무명 조각상", "페어리", "레이스", "위치스램프", "우드맨", "스네트리", "다이로우터", "호문쿨루스", "아울베어", "드라이어드", "하프 트롤", "카나바로",
            "데스나이트", "바이쿤두스", "헬 하운드", // 6등급 (희귀)
            "트롤" // 5등급 (극악 확률)
        ],
        events: [
            {desc: "탑에 입장하자 몬스터들이 쏟아져 나온다! 첫 번째 시련이다!", effect: function(p) { p.startCombat(p.cb.getRandomMonsters(3)); }}, // 3층 몬스터 기준
            {desc: "용기의 문: 몬스터 웨이브를 막아내야 한다. 완료 후 4시간 대기.", effect: function(p) { p.cb.logMessage("용기의 시련: 끊임없이 몰려오는 몬스터들을 처치하라!"); /* 웨이브 전투 및 대기 로직 */ }}, //
            {desc: "지혜의 문: 함정과 퍼즐로 가득한 길. 성공 시 5층 상승. 대기 시간 없음.", effect: function(p) { p.cb.logMessage("지혜의 시련: 함정을 피하고 퍼즐을 풀어 길을 찾아라!"); /* 퍼즐 및 층 상승 로직 */ }}, //
            {desc: "인내의 문: 정신적인 고통을 주는 시련. 완료 시 특별 보상 상자 등장.", effect: function(p) { p.cb.logMessage("인내의 시련: 과거의 고통과 마주하고 극복하라!"); p.applyDebuff("정신 고통"); /* 시련 완료 및 보상 로직 */ }}, //
            {desc: "운명의 문: 무작위 시련 혹은 낮은 확률로 히든 필드 이동.", effect: function(p) { p.cb.logMessage("운명의 시련: 예측할 수 없는 운명에 몸을 맡겨라!"); /* 무작위 이벤트 또는 히든 필드 이동 로직 */ }}, //
            // --- [계획 수정 1] ---
            {
                desc: "현재 스테이지: " + (p => p.currentStage) + "층. 100층부터 5층 포탈 수색 가능.", 
                effect: function(p) { 
                    p.cb.logMessage(`현재 천공의 탑 ${p.currentStage}층입니다.`); 
                    if (p.currentStage >= 100 && Math.random() < 0.15) {
                        // [수정] p.cb.logMessage(...) 대신 p.cb.showPortalChoice(5) 호출
                        p.cb.showPortalChoice(5); 
                        // p.startCombat("오크 히어로"); // 5층 이동 로직 (showPortalChoice에서 처리하거나, 전투 후 이동으로 변경 필요)
                    } 
                }
            }, // [확률 상향] 0.1 -> 0.15
            // --- [수정 완료] ---
        ],
        time_limit: 552, // 23일
        hidden_pieces: [
            {name: "인내의 시련 보상 상자", desc: "넘버스 아이템 또는 6등급 이하 랜덤 정수 획득 가능.", effect: function(p) { p.addItem(Math.random() < 0.5 ? "넘버스 아이템 조각" : "하급 정수 랜덤 상자"); p.cb.logMessage("인내의 시련 보상 상자를 열었다!"); }}, //
            {name: "라르카즈의 미로", desc: "운명의 문 3개가 동시에 나올 시 입장 가능한 히든 필드.", effect: function(p) { p.position = "라르카즈의 미로"; p.cb.logMessage("히든 필드 '라르카즈의 미로'에 입장했다!"); }}, //
            // 다른 히든 필드 추가 가능
        ],
        bosses: ["천공의 군주", "조율자 그레고리"] //
    },
    5: { //
        name: "대마경",
        desc: "오픈 월드 구조. 클랜들이 사냥터를 통제. 길이 복잡하고 위험한 협곡 지형.", //
        monsters: [
            // 일반
            "오크 로드", "듀라한", "데스나이트", "데쓰웜", "오크 히어로", "카나바로",
            // 지옥불 협곡
            "불의 망자", "밀라로든", "레드머드", "스톤번", "이프리트", "헬 프레임",
            // 망령의 협곡
            "타락한 피조물", "커스스톤", "혈원귀", "다키리온", "소울이터",
            // 기타 희귀몹
            "미믹", "베르타스",
        ],
        events: [
            {desc: "대마경 도착. 업적 달성! 영혼력이 20 상승한다.", effect: function(p) { p.stats["영혼력"] += 20; p.cb.logMessage("대마경에 도달하여 영혼력이 20 상승했다!"); }}, //
            {desc: "한 클랜이 길목을 막고 통행료(1000 스톤)를 요구한다.", effect: function(p) { if (p.gold >= 1000) { if(confirm("통행료 1000 스톤을 지불하시겠습니까? (거절 시 전투)")) { p.gold -= 1000; p.cb.logMessage("1000 스톤을 지불하고 지나갔다."); } else { p.cb.logMessage("통행료 지불을 거부하자 클랜원들이 공격해온다!"); p.startCombat("클랜 멤버"); } } else { p.cb.logMessage("돈이 부족하여 클랜원들과 싸울 수밖에 없다!"); p.startCombat("클랜 멤버"); } }}, //
            {desc: "클랜 구역에서 문제를 일으켜 블랙리스트에 올랐다.", effect: function(p) { p.cb.logMessage("이 지역 클랜들이 당신을 적대합니다. 사냥이 어려워졌습니다."); }}, //
            {desc: "지옥불 협곡 진입. [잿불낙인] 효과로 자원 소모 1.5배, 화염 내성 -30!", effect: function(p) { p.applyDebuff("잿불낙인"); p.cb.logMessage("지옥불 협곡의 열기가 숨 막힌다!"); }}, //
            {desc: "망령의 협곡 진입. [지박령] 효과로 어둠/물리 내성 -100! 주기적인 지진 발생!", effect: function(p) { p.applyDebuff("지박령"); p.cb.logMessage("망령들의 울음소리가 들려오고 땅이 흔들린다!"); }}, //
            {desc: "협곡의 거울에서 몬스터들이 끊임없이 리젠된다.", effect: function(p) { p.cb.logMessage("근처 거울에서 몬스터가 나타났다!"); p.startCombat(p.cb.randomMonsterFromLayer(5)); }}, //
            // --- [계획 수정 1] ---
            {desc: "6층 대해로 이어지는 차원 비석을 발견했다.", portalTo: 6, effect: function(p) { /* ui_main.js에서 portalTo 속성을 감지하여 처리 */ }}, // [수정] effect를 비우고 portalTo: 6 추가
            // --- [수정 완료] ---
            {desc: "고요의 군주 실리어트의 기운이 느껴진다.", effect: (p) => { p.cb.logMessage("주변이 섬뜩할 정도로 고요해졌다..."); }}, //
            {desc: "희귀종 '밀라로든'을 발견했다!", effect: (p) => { p.startCombat("밀라로든"); }}, //
        ],
        time_limit: 720, // 30일
        hidden_pieces: [
            {name: "불의 거울 (히든 필드)", desc: "밀라로든의 거울을 사용하여 입장. 마석/정수 드랍률 증가.", effect: function(p) { if(p.inventory.includes("밀라로든의 거울")) { p.position = "불의 거울"; p.cb.logMessage("밀라로든의 거울을 통해 히든 필드 '불의 거울'에 입장했다!"); } else { p.cb.logMessage("밀라로든의 거울이 있어야 입장할 수 있다."); } }} //
        ],
        bosses: ["실리어트", "화주 피아닐", "지옥거인 헤르쟈"] //
    },
    6: { //
        name: "대해",
        desc: "리셋되지 않는 지속적인 월드. 드넓은 바다를 항해하며 섬 탐험. 항해사 필요. 클랜 규모 권장.", //
        monsters: [
            // 일반 해양 몬스터
             "데쓰웜", "오크 히어로", "카나바로", "리아키스", "실리어트", "화주 피아닐", "지옥거인 헤르쟈", "해각수", "머멀 대전사", "딥다이버", "쉘아머", "씨웜", "마리모어", "나가쿨로스", "머멀", "머멀 전사", "머멀 궁수", "머멀 주술사",
            // 파루네 섬
            "스터렙", "크룽비", "라네무트 전사", "소라고동뿔", "가르벨", "씨자이언트", "나가 궁수", "팔푸스의 뱀", "세이렌", "세이렌 여왕", "구아노 씨 서펜트", "엘프로트", "스톰거쉬",
            // 아노스 섬
            "블랙 트리", "래플 몽키", "워 스네이크", "니겔 펜서", "벨가로",
            // 피오네 섬
            "라플레미믹",
            // 아틀란테 (히든)
             "나가쿨로스", "해저 수호병", "해신석", "라비토르", "머멀 제사장", "리우모비딕", "심해 거인"
        ],
        events: [
            {desc: "시작의 섬 라이미아 도착. 배 제작을 위한 특수 나무 채집 가능.", effect: function(p) { p.cb.logMessage("항해를 위해 배를 만들어야 한다."); p.addItem("아르테네목"); }}, //
            {desc: "항해 중 거대한 바다 괴수 '스톰거쉬'와 조우했다!", effect: function(p) { p.startCombat("스톰거쉬"); }}, //
            {desc: "파루네 섬 상륙. 섬 중앙의 공물을 파괴하면 '바다의 분노' 이벤트 발생!", effect: function(p) { p.cb.logMessage("섬 중앙에 불안정한 기운의 공물이 있다..."); /* 이벤트 발동 로직 */ }}, //
            {desc: "무풍지대 진입. 바람이 없어 항해가 불가능하다. 마력 추진 장치나 노 젓기 필요.", effect: function(p) { p.cb.logMessage("바람 한 점 없는 무풍지대다. 이동 속도가 극도로 느려진다."); }}, //
            {desc: "피오네 섬(보물섬) 발견! 희귀 몬스터 '라플레미믹' 출현 가능성!", effect: function(p) { p.cb.logMessage("형형색색의 꽃밭이 펼쳐진 아름다운 섬이다. 보물이 숨겨져 있을지도?"); if(Math.random() < 0.05) p.startCombat("라플레미믹"); }}, //
            {desc: "극동부 해역 그랜드록 진입. 암초가 많고 항해가 어렵다.", effect: function(p) { p.cb.logMessage("험준한 바위와 암초 지대다. 항해에 주의해야 한다."); }}, //
            {desc: "눈물의 군주 테트라세아의 기운이 바다 전체에 퍼져있다.", effect: (p) => { p.cb.logMessage("바다에서 깊은 슬픔의 기운이 느껴진다..."); }}, //
            {desc: "오래된 난파선을 발견했다. 쓸만한 물건이 있을지도?", effect: (p) => { p.addItem(Math.random() < 0.3 ? "낡은 보물 지도" : "젖은 두루마리"); p.cb.logMessage("난파선 안에서 무언가를 발견했다."); }},
            // --- [계획 수정 1] ---
            {desc: "7층(암흑대륙/아이스록)으로 향하는 차원 비석을 발견했다.", portalTo: 7, effect: (p) => { /* ui_main.js에서 portalTo 속성을 감지하여 처리 */ }}, // [수정] effect를 비우고 portalTo: 7 추가
            // --- [수정 완료] ---
        ],
        time_limit: 1440, // 60일
        hidden_pieces: [
            {name: "해골섬 (히든 필드)", desc: "특정 조건을 만족하면 나타나는 섬. 특수 이벤트 존재.", effect: function(p) { /* 해골섬 발견 및 진입 로직 */ p.cb.logMessage("짙은 안개 너머로 해골 모양의 섬이 보인다..."); }}, //
            {name: "아틀란테 (히든 필드)", desc: "그랜드록 해저 유적을 통해 입장 가능. 강력한 해양 몬스터 서식.", effect: function(p) { /* 아틀란테 발견 및 진입 로직 */ p.cb.logMessage("그랜드록 해저 깊은 곳에 고대 유적이 숨겨져 있다..."); }}, //
            {name: "종말의 기억 (히든 필드)", desc: "해골섬 히든 보스 처치 후 특정 조건을 만족하면 입장 가능.", effect: function(p) { /* 종말의 기억 발견 및 진입 로직 */ p.cb.logMessage("해골섬 깊은 곳에서 불타는 세계로 통하는 문을 발견했다..."); }}, //
        ],
        bosses: ["테트라세아"] //
    },
    7: { //
        name: "암흑대륙 / 아이스록",
        desc: "두 개의 다른 경로. 암흑대륙(어둠, 유적, 강한 몬스터), 아이스록(극한의 추위, 굶주림, 특수 필드 효과).", //
        monsters: [
             // 암흑대륙
            "절벽귀", "스켈레톤 머메이드 퀸", "데드번", "협곡 망령", "데드아이", "티쓰 스켈레톤", "고스티즈", "말더 엘펀트", "벤시 퀸", "카오스씨먼", "소울드링커", "기가울프", "벨라리오스", "잠베트", "공허 개미", "헬구울", "마이눔", "다크 크리스탈", "볼-헤르찬", "바이테리온", "본 드래고니안", "바이욘",
            // 아이스록
            "서리불꽃 거북", "얼어붙은 영혼", "오염된 눈의 정령", "리치", "스톤윈터", "프로스트 가디언", "빙하 거인", "프로즌 웹터", "서리불꽃 고블린", "녹지 않는 고치", "메르안", "청염조", "유령마", "가고일", "화이트 와이번", "카리아데아",
        ],
        events: [
            {desc: "암흑대륙 진입로 '원귀의 협곡'. 모든 치유/재생 효과 비활성화, 신성력 봉인!", effect: function(p) { p.applyDebuff("치유 불가"); p.applyDebuff("신성력 봉인"); p.cb.logMessage("원귀들의 원념이 모든 치유의 힘을 거부한다!"); }}, //
            {desc: "판텔리온 유적지 진입. 고대 기계 몬스터들이 깨어난다!", effect: function(p) { p.cb.logMessage("유적의 수호자들이 침입자를 감지했다!"); p.startCombat("기가울프"); }}, //
            {desc: "아이스록 진입. [얼어붙은 세계] 효과로 공간 아이템 비활성화! [기아] 효과로 음식 효율 1/3!", effect: function(p) { p.applyDebuff("얼어붙은 세계"); p.applyDebuff("기아"); p.cb.logMessage("살을 에는 추위와 굶주림이 엄습한다!"); }}, //
            {desc: "아이스록에서 [곪아드는 한기] 눈보라가 몰아친다! 음식 부패 가속!", effect: function(p) { p.cb.logMessage("끔찍한 한기의 눈보라가 모든 것을 얼리고 부패시킨다!"); /* 음식 부패 로직 필요 */ }}, //
            {desc: "빙하의 눈 필드 진입. [불멸의 속삭임] 저주! 사망 시 언데드화! [기회박탈]! 치유 효과가 피해로!", effect: function(p) { p.applyDebuff("불멸의 속삭임"); p.applyDebuff("기회박탈"); p.cb.logMessage("죽음의 속삭임이 들려온다... 이곳에서의 죽음은 끝이 아니다!"); }}, //
            // --- [계획 수정 1] ---
            {desc: "8층 여명의 땅으로 향하는 차원 비석을 발견했다.", portalTo: 8, effect: function(p) { /* ui_main.js에서 portalTo 속성을 감지하여 처리 */ }}, // [수정] effect를 비우고 portalTo: 8 추가
            // --- [수정 완료] ---
            {desc: "어둠의 군주 데드레드의 기운이 암흑대륙을 감돌고 있다.", effect: (p) => { p.cb.logMessage("암흑대륙 깊은 곳에서 강력한 어둠의 존재가 느껴진다..."); }}, //
        ],
        time_limit: 1800, // 75일
        hidden_pieces: [
            {name: "판텔리온 유적지 기록 장치", desc: "고대 문명의 비밀을 담고 있는 기록 장치.", effect: function(p) { p.addItem("고대 기록 장치"); p.cb.logMessage("판텔리온 유적지 깊은 곳에서 고대 기록 장치를 발견했다."); }},
            {name: "얼어붙은 심장", desc: "아이스록 빙하 깊은 곳에 봉인된 심장. 강력한 냉기 마력이 담겨있다.", effect: function(p) { p.addItem("얼어붙은 심장"); p.cb.logMessage("빙하 속에서 차갑게 빛나는 심장을 발견했다."); }}
        ],
        bosses: ["데드레드"] // (다른 7층 군주는 불명확)
    },
    // 8층 이상 및 지하층은 간략화 또는 추후 확장
    8: {
        name: "여명의 땅",
        desc: "심층 시작. 안전지대. 항상 균열 1개 존재. 균열 클리어 시 9층 이동 가능.", //
        monsters: [],
        events: [ {desc: "여명의 땅 도착 업적! 영혼력 +50!", effect: function(p) { p.stats["영혼력"] += 50; p.cb.logMessage("여명의 땅 도착 업적 달성! 영혼력이 50 상승했다!"); }} ], //
        time_limit: null, bosses: ["희망의 군주"] //
    },
    9: {
        name: "별무덤",
        desc: "하늘에서 운석 낙하. 태고의 땅, 옛바위 초원, 맹독 용암지, 꿈결 폭포, 용골산 구역.", //
        monsters: ["기가제르오스", "본 드래곤", "드라이즌", "브라키아이스텔로", "라망시스"], // 1, 2, 3등급 위주
        events: [ {desc: "운석 낙하! 피하지 못하면 즉사!", effect: function(p) { if(Math.random()<0.1){ p.hp=0; p.cb.logMessage("운석 직격! 사망!"); } else { p.hp -= 200; p.cb.logMessage("운석 파편 피해!");} }} ], //
        time_limit: null, bosses: []
    },
    10: {
        name: "심연의 문",
        desc: "미궁 마지막 층. 창세보구 6개 필요. 함정 가득. 최종 보스 존재.", //
        monsters: ["길티고스", "톨-라푸파", "어비스 스켈레톤"],
        events: [ {desc: "심연의 문 앞 도착. 창세보구를 모아 문을 열어야 한다.", effect: (p)=>{ p.cb.logMessage("세상의 운명을 결정할 문 앞에 섰다."); }} ], //
        time_limit: null, bosses: ["종말의 기사"] // 게임 엔딩 보스
    },
    // 지하층 (간략)
    "-1": {
        name: "기록 보관소",
        desc: "1층 히든 포탈로 진입. 미궁에서 사라진 것들이 모이는 곳. 기록의 바다와 여러 섬.", //
        monsters: ["맥구리", "텐타쿨란", "디아몬트", "굴다람쥐", "원주민"], // 변종 몬스터
        events: [ {desc: "기록의 바다 항해 중 <우기> 시작! 몬스터 비가 내린다!", effect: (p)=>{ p.cb.logMessage("<우기>가 시작되었다! 안전한 곳을 찾아야 한다!"); }} ], //
        time_limit: null, bosses: ["레카르도"] //
    }
};

// 7. 아이템 (Items) - 소모품, 재료 등 확장
export const items = {
    // 기본 & 상점
    "포션": {desc: "체력을 50 회복한다.", price: 100, effect: function(p) { p.hp = Math.min(p.maxHp, p.hp + 50); }},
    "상급 포션": {desc: "체력을 150 회복한다. 사지 절단도 회복 가능.", price: 500, effect: function(p) { p.hp = Math.min(p.maxHp, p.hp + 150); }}, //
    "최상급 포션": {desc: "체력을 500 회복한다. 신체 능력 높으면 효과 감소.", price: 1030000, effect: function(p) { p.hp = Math.min(p.maxHp, p.hp + 500); }}, //
    "기력 회복 물약": {desc: "기력을 50 회복한다.", price: 150, effect: function(p) { p.stamina = Math.min(p.maxStamina, p.stamina + 50); }},
    "마나 포션": {desc: "MP를 50 회복한다.", price: 200, effect: function(p) { p.mp = Math.min(p.maxMp, p.mp + 50); }},
    "횃불": {desc: "주변을 밝힌다 (3일 지속).", price: 10000, effect: function(p) { p.cb.logMessage("횃불에 불을 붙여 주변을 밝혔다."); }}, //
    "나침반": {desc: "방향을 알려준다.", price: 500, effect: function(p) { p.cb.logMessage("나침반을 확인하여 방향을 잡았다."); }}, //
    "식량": {desc: "포만감을 30 회복한다.", price: 50, effect: function(p) { p.satiety = Math.min(100, p.satiety + 30); p.cb.logMessage("식량을 먹어 허기를 달랬다."); }}, //
    "붕대": {desc: "출혈 상태이상을 제거한다.", price: 30, effect: function(p) { /* 출혈 제거 로직 필요 */ p.debuffs = p.debuffs.filter(d => !d.startsWith("출혈")); p.cb.logMessage("붕대로 상처를 감쌌다."); }}, //
    "해독제": {desc: "독 상태이상을 제거한다.", price: 50, effect: function(p) { p.debuffs = p.debuffs.filter(d => !d.startsWith("독")); p.cb.logMessage("해독제를 마셨다."); }},
    // 스크롤
    "물리 방어 보조 스크롤": {desc: "일시적으로 물리 내성 +10.", price: 1000, effect: function(p) { p.stats["물리 내성"] += 10; setTimeout(() => p.stats["물리 내성"] -= 10, 60000); p.cb.logMessage("물리 방어 스크롤을 사용하여 물리 내성이 잠시 증가했다."); }}, //
    "기력 재생 보조 스크롤": {desc: "일시적으로 기력 재생 속도 대폭 증가.", price: 1500, effect: function(p) { p.staminaRegenBonus = 3; setTimeout(() => p.staminaRegenBonus = 1, 60000); p.cb.logMessage("기력 재생 스크롤을 사용하여 기력 회복 속도가 빨라졌다."); }}, //
    "멸악선포 스크롤": {desc: "신성 스크롤. 멸악선포 마법 시전. 희귀.", price: 500000, effect: function(p) { magic["멸악선포"].effect(p); }}, //
    "결속 스크롤": {desc: "결속 마법을 시전한다.", price: 15000, effect: function(p) { magic["결속"].effect(p); }}, //
    // 비약 및 특수 소모품
    "근력 강화의 비약": {desc: "일시적으로 근력 +10.", price: 2000, effect: function(p) { p.stats["근력"] += 10; setTimeout(() => p.stats["근력"] -= 10, 60000); p.cb.logMessage("근력 강화 비약을 마셨다."); }}, //
    "정령의 눈물": {desc: "일시적으로 모든 원소 저항력 +15.", price: 3000, effect: function(p) { /* 저항력 증가 로직 */ p.cb.logMessage("정령의 눈물을 마셔 원소 저항력이 증가했다."); }}, //
    "바실리스크 플라스크": {desc: "일시적으로 고통 내성 +15.", price: 2500, effect: function(p) { p.stats["고통내성"] += 15; setTimeout(() => p.stats["고통내성"] -= 15, 60000); p.cb.logMessage("바실리스크 플라스크를 마셨다."); }}, //
    "영원의 잿물": {desc: "일시적으로 화염 내성 +50.", price: 4000, effect: function(p) { p.stats["화염 내성"] += 50; setTimeout(() => p.stats["화염 내성"] -= 50, 60000); p.cb.logMessage("영원의 잿물을 마셨다."); }}, //
    "순수한 불꽃": {desc: "일시적으로 받는 화염 피해 10% 감소, 화염 감응도 +15.", price: 5000, effect: function(p) { /* 효과 로직 */ p.cb.logMessage("순수한 불꽃을 삼켰다."); }}, //
    // 히든 피스 아이템
    "수정 조각": {desc: "1층 수정동굴에서 발견되는 평범한 수정. 상점에 팔 수 있다.", effect: function(p) { p.gold += 100; p.inventory.splice(p.inventory.indexOf("수정 조각"), 1); p.cb.logMessage("수정 조각을 100 스톤에 팔았다."); }}, //
    "마녀의 성물": {desc: "마녀의 오두막에서 얻을 수 있는 성물. 강력한 마력이 담겨있다.", effect: function(p) { p.stats["항마력"] += 10; p.inventory.splice(p.inventory.indexOf("마녀의 성물"), 1); p.cb.logMessage("마녀의 성물을 흡수하여 항마력이 영구적으로 10 상승했다!"); p.showStatus(); }}, //
    "여신의 눈물": {desc: "강력한 '은총'을 퍼트리는 소모성 성물. 악 속성에게 강력.", effect: function(p) { /* 은총 효과 로직 */ p.cb.logMessage("여신의 눈물이 부서지며 성스러운 빛이 퍼져나간다!"); }}, //
    "마력이 깃든 얼음 조각": {desc: "빙하굴 히든 피스. 복용 시 냉기 내성 영구 +3 (최초 1회).", effect: function(p) { /* 영구 스탯 상승 로직 (최초 1회) */ p.stats["냉기 내성"] += 3; p.inventory.splice(p.inventory.indexOf("마력이 깃든 얼음 조각"), 1); p.cb.logMessage("얼음 조각을 삼키자 냉기 내성이 영구적으로 3 상승했다!"); p.showStatus(); }}, //
    "빙정": {desc: "빙하굴 히든 피스. 복용 시 냉기 감응도 영구 +3 (최대 3회).", effect: function(p) { /* 영구 스탯 상승 로직 (최대 3회) */ p.stats["냉기 감응도"] += 3; p.inventory.splice(p.inventory.indexOf("빙정"), 1); p.cb.logMessage("빙정을 삼키자 냉기 감응도가 영구적으로 3 상승했다!"); p.showStatus(); }}, //
    "봉인된 악의 조각": {desc: "도플갱어 숲 히든 피스. 복용 시 항마력 영구 +1 (최대 5회).", effect: function(p) { /* 영구 스탯 상승 로직 (최대 5회) */ p.stats["항마력"] += 1; p.inventory.splice(p.inventory.indexOf("봉인된 악의 조각"), 1); p.cb.logMessage("악의 조각을 삼키자 항마력이 영구적으로 1 상승했다!"); p.showStatus(); }}, //
    "백과": {desc: "백색신전 히든 피스. 복용 시 보유 정수 중 하나의 스탯 무작위 변경.", effect: function(p) { /* 정수 스탯 변경 로직 */ p.cb.logMessage("백과를 먹자 정수의 힘 일부가 변화하는 것이 느껴진다!"); }}, //
    "땅의 파편": {desc: "백색신전 히든 피스. 대지 저항력 및 물리 내성 영구 +1.", effect: function(p) { p.stats["대지 내성"] += 1; p.stats["물리 내성"] += 1; p.inventory.splice(p.inventory.indexOf("땅의 파편"), 1); p.cb.logMessage("땅의 파편을 흡수하여 대지 저항력과 물리 내성이 영구적으로 1 상승했다!"); p.showStatus(); }}, //
    "영혼의 서": {desc: "백색신전 히든 피스. 사용 시 경험치 3 획득.", effect: function(p) { p.gainExp(3); p.inventory.splice(p.inventory.indexOf("영혼의 서"), 1); p.cb.logMessage("영혼의 서를 읽어 경험치 3을 얻었다."); }}, //
    "고블 쿼츠": {desc: "녹색 탄광 히든 피스. 복용 시 독 내성 영구 +3 (최초 1회).", effect: function(p) { /* 영구 스탯 상승 로직 (최초 1회) */ p.stats["독 내성"] += 3; p.inventory.splice(p.inventory.indexOf("고블 쿼츠"), 1); p.cb.logMessage("고블 쿼츠를 삼키자 독 내성이 영구적으로 3 상승했다!"); p.showStatus(); }}, //
    "얼어붙은 생명의 흔적": {desc: "빙하의 눈 히든 피스. 복용 시 해당 필드에서 치유 가능.", effect: function(p) { /* 특수 치유 효과 부여 로직 */ p.cb.logMessage("얼어붙은 생명의 흔적을 삼키자 상처를 회복할 힘을 얻었다."); }}, //
    "꿈꾸는 영혼": {desc: "영혼의 요새 히든 피스(0.001% 드랍). 10레벨 도달 시 경험치 10000 획득.", effect: function(p) { /* 레벨 조건부 경험치 획득 로직 */ p.cb.logMessage("꿈꾸는 영혼을 얻었다! 10레벨이 되면 강력한 힘을 얻을 수 있을 것이다."); }}, //
    // 기타
    "균열석": {desc: "균열 수호자 드랍. 균열 재입장 또는 특정 아이템 사용에 필요.", price: 100000, effect: function(p) { p.cb.logMessage("균열의 힘이 담긴 돌이다."); }}, //
    "계층석": {desc: "계층군주 드랍. 해당 계층의 균열을 1회 강제 개방.", price: 10000000, effect: function(p) { /* 균열 개방 로직 */ p.cb.logMessage("계층의 힘이 담긴 돌이다. 이것으로 균열을 열 수 있다."); }}, //
    "바바리안의 심장": {desc: "바바리안에게서 얻는 특수 재료. 과거 마법 재료로 고가에 거래됨.", price: 1800000, effect: function(p) { p.cb.logMessage("강력한 생명력이 느껴지는 심장이다."); }}, //
    "야수의 피": {desc: "수인족 영혼수 성장 촉진제.", price: 2000000, effect: function(p) { p.cb.logMessage("영혼수의 성장을 돕는 신비한 피다."); }}, //
    // 2층 히든 피스 (임시 추가)
    "희귀 약초": {desc: "짐승의 소굴 숨겨진 동굴에서 발견한 희귀한 약초.", effect: function(p) { p.hp = Math.min(p.maxHp, p.hp + 100); p.inventory.splice(p.inventory.indexOf("희귀 약초"), 1); p.cb.logMessage("희귀 약초를 사용하여 체력을 100 회복했다."); }},
    "저주받은 유물": {desc: "망자의 땅에서 발견된 유물. 스산한 기운이 느껴진다.", effect: function(p) { p.inventory.splice(p.inventory.indexOf("저주받은 유물"), 1); if(Math.random() < 0.5) { p.stats["항마력"] += 5; p.cb.logMessage("유물의 저주를 이겨내고 항마력이 5 상승했다!"); } else { p.hp -= 50; p.cb.logMessage("유물의 저주가 발동하여 50의 피해를 입었다!"); } p.showStatus(); }},
    // 4층 히든 피스 (임시 추가)
    "넘버스 아이템 조각": {desc: "넘버스 아이템의 조각. 모으면 복원할 수 있을지도?", effect: function(p) { p.cb.logMessage("넘버스 아이템의 조각을 획득했다."); }},
    "하급 정수 랜덤 상자": {desc: "사용 시 6~9등급 정수 중 하나를 획득한다.", effect: function(p) { const grades = [6,7,8,9]; const randomGrade = grades[Math.floor(Math.random()*grades.length)]; const essences = ["데스나이트", "시체골렘", "홉 고블린", "고블린"]; /* 등급별 정수 목록 필요 */ p.addEssence(essences[Math.floor(Math.random()*essences.length)]); p.inventory.splice(p.inventory.indexOf("하급 정수 랜덤 상자"), 1); p.cb.logMessage("상자를 열어 정수를 획득했다!"); }},
};

// 넘버스 아이템 데이터
export const numbersItems = {
    "초심자의 행운": {no: 9999, type: "부적", desc: "첫 사냥 몬스터 정수 드랍률 +5% (귀속)", effect: function(p) { p.dropRateBonus += 0.05; p.cb.logMessage("초심자의 행운 부적 효과가 적용되었다!"); }}, //
    "서리혼령 가락지": {no: 9425, type: "반지", desc: "장착 시 보유 정수 스킬 1개 무작위 봉인 (스탯 유지).", effect: (p) => { /* 정수 스킬 봉인 로직 */ p.cb.logMessage("서리혼령 가락지가 정수 스킬 하나를 봉인했다."); }}, //
    "수호자의 팔목 보호대": {no: 3112, type: "팔목", desc: "상시 피해 감소 5%. 사용: 주변 적 밀쳐내고 해로운 효과 면역.", equipment_effect: {"피해 감소%": 5}, effect: (p) => { /* 밀쳐내기 및 면역 효과 로직 */ p.cb.logMessage("수호자의 힘이 주변의 적을 밀어내고 해로운 기운을 정화했다!"); }}, //
    "가르파스의 목걸이": {no: 7777, type: "목걸이", desc: "마석 소모하여 무작위 물질 변환 (가챠).", effect: (p) => { p.cb.logMessage("마석을 넣었지만 아직 부족한 것 같다..."); }}, //
    "독사의 송곳니": {no: 5991, type: "무기", desc: "관통력 보너스, 중독 피해 2배.", equipment_effect: {'관통력': 10, '독피해증가%': 100}}, //
    "시체술사의 기만": {no: 7661, type: "팔찌", desc: "죽음에 달하는 피해 시 가사상태(피해 면역) (3회).", effect: (p) => { /* 가사상태 로직 */ p.cb.logMessage("시체술사의 기만이 죽음의 순간 당신을 보호했다!"); }}, //
    "운명 추적자": {no: 6111, type: "반지", desc: "주변 이벤트 발생 시 색으로 알려줌 (미궁 전용).", effect: (p) => { p.cb.logMessage("반지가 희미하게 빛나며 주변의 운명을 감지한다."); }}, //
    "두 번째 심장": {no: 3120, type: "소모품", desc: "심장 즉사 피해 시 일정 시간 절대 보호 (1회).", effect: (p) => { /* 심장 보호 로직 */ p.cb.logMessage("두 번째 심장이 뛰기 시작하며 죽음의 위협으로부터 보호한다!"); }}, //
    "어긋난 신뢰": {no: 7234, type: "소모품", desc: "10분간 반경 10m 내 거짓말 불가 (횟수 제한).", effect: (p) => { /* 거짓말 탐지 로직 */ p.cb.logMessage("진실만이 허락된 공간이 형성되었다."); }}, //
    "수호병단의 징표": {no: 2988, type: "귀걸이", desc: "방패 충격 흡수 +50%.", equipment_effect: {'방패 충격 흡수%': 50}}, //
    "황야의 무법자": {no: 8667, type: "벨트", desc: "사용: 주변 인간형 몬스터 수 비례 근접 피해 증가 (쿨타임 1일).", effect: (p) => { /* 피해 증가 로직 */ p.cb.logMessage("황야의 무법자 효과 발동! 인간형 적이 많을수록 강해진다!"); }}, //
    "철벽": {no: 8820, type: "신발", desc: "사용: 3초간 물리 내성 및 항마력 2배.", effect: (p) => { /* 방어력 증가 로직 */ p.cb.logMessage("철벽 효과 발동! 3초간 방어력이 극대화된다!"); }}, //
    "아이기스의 장벽": {no: 3, type: "방패", desc: "최상급 방패. 피해 면역 가드, 광역 마법 피해 감소 등.", equipment_effect: {'마법 피해 감소%': 30, '방어 스탯%': 20}, effect: (p) => { /* 액티브 효과: 대상 지정 스킬 대신 맞기 */ p.cb.logMessage("아이기스의 장벽이 위험한 공격을 대신 받아낸다!"); }}, //
    "신뢰": {no: 12, type: "팔찌", desc: "결속 아군 피해 면역/딜 증가/힐 증가 중 택1 효과.", effect: (p) => { /* 효과 선택 및 적용 로직 */ p.cb.logMessage("신뢰의 팔찌가 파티원과의 유대를 강화한다!"); }}, //
};

// 상점 아이템 데이터
export const shopItems = {
    // 소모품
    "포션": { price: 100, desc: "체력을 50 회복합니다." },
    "상급 포션": { price: 500, desc: "체력을 150 회복합니다." },
    "기력 회복 물약": { price: 150, desc: "기력을 50 회복합니다." },
    "마나 포션": { price: 200, desc: "MP를 50 회복합니다." },
    "횃불": { price: 10000, desc: "주변을 밝힙니다 (3일 지속)." },
    "나침반": { price: 500, desc: "방향을 알려줍니다." },
    "식량": { price: 50, desc: "포만감을 30 회복합니다." },
    "붕대": { price: 30, desc: "출혈 상태이상을 제거합니다." },
    "해독제": { price: 50, desc: "독 상태이상을 제거합니다." },
    // 장비 (기본)
    "강철 검": { price: 1000, desc: "기본적인 검 (1단계).", type: "무기" }, //
    "가죽 갑옷": { price: 800, desc: "기본적인 가죽 갑옷 (1단계).", type: "갑옷" }, //
    "강철 방패": { price: 900, desc: "기본적인 방패 (1단계).", type: "부무기" },
    "가죽 장갑": { price: 300, desc: "기본적인 장갑 (1단계).", type: "장갑" },
    "가죽 신발": { price: 400, desc: "기본적인 신발 (1단계).", type: "각반" }, // 게임 내 각반 = 신발로 가정
    "천 모자": { price: 200, desc: "기본적인 모자 (1단계).", type: "투구" }, // 게임 내 투구 = 모자로 가정
    "라이티늄 검": { price: 10000, desc: "라이티늄으로 만든 검 (2단계).", type: "무기" },
    "와이번 가죽 갑옷": { price: 8000, desc: "와이번 가죽으로 만든 갑옷 (2단계).", type: "갑옷" },
    // 기타
    "확장형 배낭": { price: 2500000, desc: "수납 공간이 넓은 마법 배낭.", type: "기타" }, //
};

// 8. NPC - 주요 인물 및 상호작용 NPC 확장
export const npcs = {
    "이한수": {dialog: "이 게임... 만만하게 보면 안 돼. 히든 피스를 찾는 게 중요해.", action: function(p) { p.cb.logMessage("이한수: 경험치는 첫 사냥 때만 주니, 다양한 몬스터를 잡고 정수를 모으는 게 핵심이야."); }}, //
    "이백호": {dialog: "기록석에는 이 세계의 모든 역사가 담겨있지. 심지어 미래까지도... 하지만 운명은 바뀔 수 있다네.", action: function(p) { p.cb.logMessage("이백호: 창세보구가 사라진 건 왕가 짓일지도 몰라. 놈들은 심연의 문이 열리는 걸 원치 않거든."); }}, //
    "탐험가 길드 접수원": {dialog: "무슨 일로 오셨나요? 퀘스트 수락, 파티 결속, 정보 구매, 동료 모집이 가능합니다.", action: function(p) { /* 길드 메뉴 로직 (ui.js handleCityAction) */ }}, //
    "도서관 사서 라그나": {dialog: "찾는 책이 있다면 '서적 탐지' 마법으로 찾아드릴 수 있습니다. 수수료는 3천 스톤입니다.", action: function(p) { //
        if (p.gold < 3000) {
             p.cb.logMessage("라그나: 안타깝지만 수수료가 부족하시군요.");
             return;
        }
        const keyword = prompt("찾고 싶은 책의 키워드를 입력하세요 (수수료 3000 스톤):");
        if(keyword) {
             p.gold -= 3000;
             p.cb.logMessage(`라그나: "'${keyword}'... 좋습니다. '서적 탐지' 마법을 사용합니다.`);
            // 실제 책 검색 로직은 생략 (더미 결과)
            setTimeout(() => {
                 const foundBooks = ["미궁의 역사 제 3권", "고대 마법 이론", "정수 백과사전 상권"];
                 p.cb.logMessage(`'${keyword}' 관련 서적: ${foundBooks[Math.floor(Math.random()*foundBooks.length)]}`);
            }, 1500);
        }
    }},
    "상점 주인": {dialog: "어서 오세요! 필요한 물건이라도 있으신가?", action: function(p) { /* 상점 메뉴 로직 (ui.js handleCityAction) */ }}, //
    "교단 신관": {dialog: "신의 은총이 함께하길... 치료나 정수 삭제가 필요하신가요? 정수 삭제 비용은 500만 스톤부터 시작합니다.", action: function(p) { /* 교단 메뉴 로직 (ui.js handleCityAction) */ }}, //
    "에르웬": {dialog: "당신... 나와 같은 '집착'을 가지고 있군요. 위험하지만... 매력적인 힘이죠.", action: function(p) { p.cb.logMessage("에르웬에게서 강렬한 집착의 기운을 느꼈다."); p.stats["집착"] = (p.stats["집착"] || 0) + 10; p.showStatus(); }}, //
    "대장장이": {dialog: "뭘 도와줄까? 제작, 수리, 강화 다 가능해.", action: function(p) { /* 대장간 메뉴 로직 (ui.js handleCityAction) */ }},
    "주점 주인": {dialog: "어서와! 시원한 맥주 한 잔 어때?", action: function(p) { /* 주점 메뉴 로직 (ui.js handleCityAction) */ }},
    "여관 주인": {dialog: "편히 쉬다 가세요. 하룻밤에 200 스톤입니다.", action: function(p) { /* 여관 메뉴 로직 (ui.js handleCityAction) */ }},
};

// 9. 도시 시스템 (Cities) - 라프도니아 구조 상세화
export const cities = {
    "라프도니아": {
        "황도 카르논 (1구역)": { //
            desc: "왕가 및 귀족 거주 지역. 높은 명성 필요.", //
            locations: {
                "왕궁": {desc: "왕족과 최고위 귀족들이 거주하는 곳.", actions: ["royal_audience", "report_achievement"]}, // 왕 알현, 업적 보고 등
                "천공 경매장": {desc: "희귀 아이템과 넘버스 아이템이 거래되는 최고급 경매장.", actions: ["auction_browse", "auction_bid"]}, //
                "영광의 궁": {desc: "왕가의 공식 행사 및 연회가 열리는 장소.", actions: ["attend_banquet"]}, //
                "모즐란 본청": {desc: "귀족들의 경찰 역할을 하는 모즐란의 본부.", actions: ["report_noble_crime"]}, //
            }
        },
        "컴멜비 (2-5구역)": { //
            desc: "상업지구. 자유시장이라 불리기도 함.", //
            locations: {
                "알미너스 중앙 거래소": {desc: "모든 종류의 아이템 검색 및 위탁 판매 가능 (수수료 있음).", actions: ["trade_search", "trade_consign", "trade_appraise"]}, //
                "알미너스 은행": {desc: "스톤 및 아이템 보관, 상속 지정, 무기명 금고 이용 가능.", actions: ["bank_deposit", "bank_withdraw", "bank_storage", "bank_inheritance"]}, //
                "고급 여관": {desc: "비싸지만 편안한 숙박 시설.", actions: ["rest_luxury"]}, //
                "다과점": {desc: "차와 다과를 즐기며 휴식하는 곳.", actions: ["relax_cafe"]}, //
                "제과점": {desc: "다양한 쿠키와 과자를 판매하는 곳.", actions: ["buy_sweets"]}, //
            }
        },
        "노움트리 (6구역)": { //
            desc: "특별 지역구. 귀족들의 휴양지. 농경/축산 시설.", //
            locations: {
                "키아르비스": {desc: "귀족 전용 주거 및 휴양 시설.", actions: ["enter_kearvis"]},
                "온천": {desc: "피로를 풀 수 있는 천연 온천.", actions: ["rest_hotspring"]}, //
                "승마장": {desc: "말을 타며 여가를 즐길 수 있는 곳.", actions: ["enjoy_riding"]},
                "농장/목장": {desc: "요정, 수인 등이 관리하는 농작 및 축산 시설 견학.", actions: ["observe_farm"]},
            }
        },
        "라비기온 (7-13구역)": { //
            desc: "일반 거주 및 상업 지구. 대부분의 탐험가 활동 지역.", //
            locations: {
                "차원 광장": {desc: "매달 미궁으로 통하는 포탈이 열리는 곳.", actions: ["enter_labyrinth_portal"]},
                "탐험가 길드 지부": {desc: "결속, 퀘스트, 정보, 동료 모집 등 지원.", actions: ["guild_bind", "guild_quest", "guild_info", "guild_recruit"]}, //
                "라비기온 중앙 도서관": {desc: "방대한 서적 소장. 사서에게 책 검색 요청 가능.", actions: ["library_search"]}, //
                "상점가": {desc: "무기점, 방어구점, 잡화점 등이 모여있는 거리.", actions: ["shop_buy", "shop_sell"]}, //
                "대신전 (삼신교)": {desc: "부상 치료 및 정수 삭제 가능.", actions: ["temple_heal", "temple_remove_essence"]}, //
                "여관": {desc: "저렴한 비용으로 하룻밤 숙박 및 식사 가능.", actions: ["rest_inn"]}, //
                "대장간": {desc: "장비 수리, 제작, 강화 가능.", actions: ["forge_repair", "forge_craft", "forge_enchant"]}, //
                "주점": {desc: "탐험가들의 휴식 및 정보 교환 장소.", actions: ["bar_drink", "bar_gather_info"]}, //
                "환전소": {desc: "마석을 스톤으로 교환.", actions: ["exchange_stones"]}, //
                "훈련장": {desc: "이능 및 스킬 사용이 허가된 훈련 공간.", actions: ["train_skill"]}, //
                "공용 승강장": {desc: "다른 구역으로 이동하는 마차 탑승.", actions: ["use_carriage"]}, //
                "행정청": {desc: "도시 행정 업무 처리 및 간혹 의뢰 발생.", actions: ["visit_admin_office"]}, //
            }
        },
        "비프론 (14구역)": { //
            desc: "통행금지 구역. 유배지. 치안 불안정.", //
            locations: {
                "배급소": {desc: "왕가에서 식량을 배급하는 곳. 통제 세력 존재.", actions: ["get_ration"]}, //
                "깡패 점거 여관/주점": {desc: "불량배들이 운영하는 시설.", actions: ["visit_gang_place"]}, //
                "하수도 비밀 통로": {desc: "8구역으로 이어지는 비밀 통로.", actions: ["use_secret_passage"]}, //
            }
        }
    }
};

// 동료와의 간단한 상호작용 대화 (추후 확장 가능)
export const companionDialogues = [
    "지난번 탐험에서는 아슬아슬했어.",
    "이봐, 다음엔 더 깊은 곳에 도전해보는 건 어때?",
    "새로운 장비가 필요할 것 같군.",
    "미궁의 비밀... 과연 끝이 있을까?",
    "가끔은 도시의 소음이 그리워.",
    "방심하지 마. 언제 어디서 위험이 닥칠지 몰라.",
    "오늘 저녁은 뭘 먹을까?",
    "내 무기가 좀 무뎌진 것 같아. 대장간에 들러야겠어.",
    "충분히 휴식하는 것도 중요해.",
    "우리의 목표를 잊지 말자고."
];

// 이 외에도 겜바바 설정.txt의 방대한 내용을 추가할 수 있습니다.
// (예: 균열 상세 정보, 히든 필드 상세 정보, 조직 상세 정보, 마법/신성주문/흑마법 추가 등)