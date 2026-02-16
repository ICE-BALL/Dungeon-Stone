// 파일: data/maps_floors_1-3.js
// 역할: 1~3층 맵 데이터 정의 (층별 지형 특징 강화)

const TILE = {
    WALL: 0,
    FLOOR: 1,
    FOREST: 2,
    WATER: 3,
    LAVA: 4,
    ICE: 5,
    PORTAL: 9
};

function createMap(width, height, fill = TILE.WALL) {
    return Array.from({ length: height }, () => Array(width).fill(fill));
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function carveRect(map, x, y, w, h, tile = TILE.FLOOR) {
    const height = map.length;
    const width = map[0].length;
    const sx = clamp(x, 1, width - 2);
    const sy = clamp(y, 1, height - 2);
    const ex = clamp(x + w - 1, 1, width - 2);
    const ey = clamp(y + h - 1, 1, height - 2);

    for (let yy = sy; yy <= ey; yy++) {
        for (let xx = sx; xx <= ex; xx++) map[yy][xx] = tile;
    }
}

function carveCorridor(map, x1, y1, x2, y2, tile = TILE.FLOOR, thickness = 1) {
    let x = x1;
    let y = y1;
    while (x !== x2) {
        x += Math.sign(x2 - x);
        for (let t = -thickness; t <= thickness; t++) {
            const ny = y + t;
            if (map[ny] && map[ny][x] !== undefined && ny > 0 && ny < map.length - 1) map[ny][x] = tile;
        }
    }
    while (y !== y2) {
        y += Math.sign(y2 - y);
        for (let t = -thickness; t <= thickness; t++) {
            const nx = x + t;
            if (map[y] && map[y][nx] !== undefined && nx > 0 && nx < map[0].length - 1) map[y][nx] = tile;
        }
    }
}

function scatterTile(map, tile, count, xMin = 1, xMax = map[0].length - 2, yMin = 1, yMax = map.length - 2) {
    for (let i = 0; i < count; i++) {
        const x = Math.floor(Math.random() * (xMax - xMin + 1)) + xMin;
        const y = Math.floor(Math.random() * (yMax - yMin + 1)) + yMin;
        if (map[y][x] !== TILE.WALL) map[y][x] = tile;
    }
}

function enforceBoundaryWalls(map) {
    const height = map.length;
    const width = map[0].length;
    for (let x = 0; x < width; x++) {
        map[0][x] = TILE.WALL;
        map[height - 1][x] = TILE.WALL;
    }
    for (let y = 0; y < height; y++) {
        map[y][0] = TILE.WALL;
        map[y][width - 1] = TILE.WALL;
    }
}

export const mapsFloors1_3 = {
    1: {
        id: 1,
        name: "1층: 수정동굴",
        width: 64,
        height: 64,
        description: "중앙 기념비와 동서남북 포탈이 존재하는 입문층. 방향마다 출몰 몬스터 특성이 다릅니다.",
        monsterDensity: 18,
        spawnRate: 0.004,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.WALL);
            const cx = Math.floor(w / 2);
            const cy = Math.floor(h / 2);

            // 중앙 공동(대현자 기념비 지대)
            carveRect(map, cx - 6, cy - 6, 13, 13, TILE.FLOOR);

            // 4개 방향 메인 통로
            carveCorridor(map, cx, cy, 5, cy, TILE.FLOOR, 1);
            carveCorridor(map, cx, cy, w - 6, cy, TILE.FLOOR, 1);
            carveCorridor(map, cx, cy, cx, 5, TILE.FLOOR, 1);
            carveCorridor(map, cx, cy, cx, h - 6, TILE.FLOOR, 1);

            // 사분면별 지형 차별화
            // 북쪽(고블린): 숲/굴곡
            for (let y = 2; y < cy - 2; y++) {
                for (let x = 2; x < w - 2; x++) {
                    if (map[y][x] === TILE.WALL && Math.random() < 0.34) map[y][x] = TILE.FOREST;
                }
            }

            // 동쪽(칼날늑대): 좁은 동굴길
            for (let i = 0; i < 14; i++) {
                carveRect(map, cx + 5 + i * 2, cy - 1 - (i % 2), 2, 3, TILE.FLOOR);
            }

            // 서쪽(노움): 바위굴
            for (let i = 0; i < 24; i++) {
                const rx = Math.floor(Math.random() * (cx - 10)) + 4;
                const ry = Math.floor(Math.random() * (h - 8)) + 4;
                carveRect(map, rx, ry, 3, 3, TILE.FLOOR);
            }

            // 남쪽(구울): 습한 공동
            for (let y = cy + 2; y < h - 2; y++) {
                for (let x = 2; x < w - 2; x++) {
                    if (map[y][x] !== TILE.WALL && Math.random() < 0.08) map[y][x] = TILE.WATER;
                }
            }

            // 주변 연결 보정
            for (let i = 0; i < 60; i++) {
                const x = Math.floor(Math.random() * (w - 4)) + 2;
                const y = Math.floor(Math.random() * (h - 4)) + 2;
                if (map[y][x] === TILE.WALL && Math.random() < 0.25) map[y][x] = TILE.FLOOR;
            }

            enforceBoundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: "center", y: "center", desc: "수정동굴 중심부" },
            { type: "MONUMENT", id: "sage_monument", x: "center", y: "center", desc: "대현자의 기념비" },
            { type: "PORTAL", targetLayer: 2, x: 5, y: height => Math.floor(height / 2), desc: "서쪽 포탈 (노움 지대)" },
            { type: "PORTAL", targetLayer: 2, x: width => width - 6, y: height => Math.floor(height / 2), desc: "동쪽 포탈 (칼날늑대 지대)" },
            { type: "PORTAL", targetLayer: 2, x: width => Math.floor(width / 2), y: 5, desc: "북쪽 포탈 (고블린 지대)" },
            { type: "PORTAL", targetLayer: 2, x: width => Math.floor(width / 2), y: height => height - 6, desc: "남쪽 포탈 (구울 지대)" },
            { type: "CURIO", id: "crystal_formation", x: "random_floor", y: "random_floor", desc: "빛나는 수정 군집" },
            { type: "CURIO", id: "rubble_pile", x: "random_floor", y: "random_floor", desc: "붕괴된 광맥" },
            { type: "CURIO", id: "skeleton_remains", x: "random_floor", y: "random_floor", desc: "방치된 유골" },
            { type: "CURIO", id: "ancient_inscription", x: "random_floor", y: "random_floor", desc: "벽면 비문" },
            { type: "CURIO", id: "hidden_cache", x: "random_floor", y: "random_floor", desc: "은닉 보급함" }
        ],
        monsterTable: ["고블린", "구울", "노움", "칼날늑대"],
        monsterTableByRegion: {
            CENTER: ["고블린", "구울", "노움", "칼날늑대"],
            NORTH: ["고블린", "고블린 검사", "고블린 궁수"],
            SOUTH: ["구울", "엘더 구울", "스켈레톤"],
            WEST: ["노움", "타락한 노움", "코볼트"],
            EAST: ["칼날늑대", "거대칼날늑대", "핏빛칼날늑대"]
        }
    },

    2: {
        id: 2,
        name: "2층: 4대 구역",
        width: 84,
        height: 84,
        description: "북서 고블린 숲, 북동 짐승의 소굴, 남서 바위사막, 남동 망자의 땅으로 구성됩니다.",
        monsterDensity: 24,
        spawnRate: 0.005,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.FLOOR);
            const cx = Math.floor(w / 2);
            const cy = Math.floor(h / 2);

            // 중앙 십자 회랑
            for (let x = 1; x < w - 1; x++) map[cy][x] = TILE.FLOOR;
            for (let y = 1; y < h - 1; y++) map[y][cx] = TILE.FLOOR;
            carveRect(map, cx - 3, cy - 3, 7, 7, TILE.FLOOR);

            // NW: 고블린 숲
            for (let y = 1; y < cy; y++) {
                for (let x = 1; x < cx; x++) {
                    if (Math.random() < 0.45) map[y][x] = TILE.FOREST;
                    if (Math.random() < 0.10) map[y][x] = TILE.WALL;
                }
            }

            // NE: 짐승의 소굴(협곡)
            for (let y = 1; y < cy; y++) {
                for (let x = cx + 1; x < w - 1; x++) {
                    if (Math.random() < 0.22) map[y][x] = TILE.WALL;
                    else map[y][x] = TILE.FLOOR;
                }
            }
            for (let k = 0; k < 10; k++) {
                const sx = Math.floor(Math.random() * (w - cx - 10)) + cx + 4;
                const sy = Math.floor(Math.random() * (cy - 8)) + 4;
                carveRect(map, sx, sy, 3 + (k % 3), 2 + (k % 2), TILE.FLOOR);
            }

            // SW: 바위사막
            for (let y = cy + 1; y < h - 1; y++) {
                for (let x = 1; x < cx; x++) {
                    map[y][x] = TILE.FLOOR;
                    if (Math.random() < 0.12) map[y][x] = TILE.WALL;
                    if (Math.random() < 0.06) map[y][x] = TILE.LAVA;
                }
            }

            // SE: 망자의 땅(늪)
            for (let y = cy + 1; y < h - 1; y++) {
                for (let x = cx + 1; x < w - 1; x++) {
                    map[y][x] = TILE.FLOOR;
                    if (Math.random() < 0.25) map[y][x] = TILE.WATER;
                    if (Math.random() < 0.08) map[y][x] = TILE.WALL;
                }
            }

            // 사분면 연결 통로 보정
            carveCorridor(map, cx, cy, 8, 8, TILE.FLOOR, 1);
            carveCorridor(map, cx, cy, w - 9, 8, TILE.FLOOR, 1);
            carveCorridor(map, cx, cy, 8, h - 9, TILE.FLOOR, 1);
            carveCorridor(map, cx, cy, w - 9, h - 9, TILE.FLOOR, 1);

            enforceBoundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: "center", y: "center", desc: "2층 중앙 교차점" },
            { type: "PORTAL", targetLayer: 3, x: "random_floor", y: "random_floor", desc: "3층으로 이어지는 포탈" },
            { type: "CURIO", id: "trap_remains", x: "random_floor", y: "random_floor", desc: "고블린 덫 잔해" },
            { type: "CURIO", id: "beast_tracks", x: "random_floor", y: "random_floor", desc: "대형 짐승의 발자국" },
            { type: "CURIO", id: "desert_oasis", x: "random_floor", y: "random_floor", desc: "사막 속 오아시스" },
            { type: "CURIO", id: "ancient_grave", x: "random_floor", y: "random_floor", desc: "망자의 묘지" },
            { type: "CURIO", id: "suspicious_dirt", x: "random_floor", y: "random_floor", desc: "의심스러운 흙더미" },
            { type: "CURIO", id: "locked_chest", x: "random_floor", y: "random_floor", desc: "잠긴 상자" }
        ],
        monsterTable: ["고블린", "구울", "스켈레톤", "샌드맨", "웨어울프"],
        monsterTableByRegion: {
            NW: ["고블린", "고블린 검사", "고블린 궁수", "홉고블린"],
            NE: ["거대칼날늑대", "핏빛칼날늑대", "벽두더지", "샤벨타이거", "웨어울프"],
            SW: ["노움", "코볼트", "샌드맨", "스톤골렘"],
            SE: ["구울", "스켈레톤", "벤시", "구울로드"],
            CENTER: ["오크", "스켈레톤", "샌드맨", "웨어울프"]
        }
    },

    3: {
        id: 3,
        name: "3층: 순례자의 길",
        width: 108,
        height: 64,
        description: "긴 순례로와 성역/폐허가 공존하는 광활한 필드. 길을 아는 자만 빠르게 돌파할 수 있습니다.",
        monsterDensity: 28,
        spawnRate: 0.005,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.FOREST);

            // 순례자 대로(서->동)
            carveCorridor(map, 3, Math.floor(h / 2), w - 4, Math.floor(h / 2), TILE.FLOOR, 2);

            // 지선 도로
            const forks = [
                [18, 12], [28, h - 12], [42, 10], [58, h - 11], [74, 15], [88, h - 14]
            ];
            forks.forEach(([fx, fy]) => carveCorridor(map, fx, Math.floor(h / 2), fx, fy, TILE.FLOOR, 1));

            // 거점 방들
            carveRect(map, 10, 8, 12, 9, TILE.FLOOR);
            carveRect(map, 25, h - 18, 14, 11, TILE.FLOOR);
            carveRect(map, 49, 7, 13, 10, TILE.FLOOR);
            carveRect(map, 70, h - 20, 16, 12, TILE.FLOOR);
            carveRect(map, 90, 9, 13, 10, TILE.FLOOR);

            // 습지/암석 포인트
            scatterTile(map, TILE.WATER, 220);
            scatterTile(map, TILE.WALL, 320);

            // 시작/종료 주변 정리
            carveRect(map, 2, Math.floor(h / 2) - 3, 8, 7, TILE.FLOOR);
            carveRect(map, w - 10, Math.floor(h / 2) - 3, 8, 7, TILE.FLOOR);

            enforceBoundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: 5, y: height => Math.floor(height / 2), desc: "순례자 출발점" },
            { type: "PORTAL", targetLayer: 4, x: width => width - 7, y: height => Math.floor(height / 2), desc: "4층으로 가는 포탈" },
            { type: "CURIO", id: "ancient_tree", x: "random_floor", y: "random_floor", desc: "고대 나무" },
            { type: "CURIO", id: "ruined_temple", x: "random_floor", y: "random_floor", desc: "무너진 신전" },
            { type: "CURIO", id: "herb_garden", x: "random_floor", y: "random_floor", desc: "약초 군락" },
            { type: "CURIO", id: "beast_lair", x: "random_floor", y: "random_floor", desc: "짐승의 소굴" },
            { type: "CURIO", id: "hidden_cache", x: "random_floor", y: "random_floor", desc: "순례자 은닉품" },
            { type: "CURIO", id: "old_tombstone", x: "random_floor", y: "random_floor", desc: "순례자 표식" }
        ],
        monsterTable: ["오크 전사", "오크 주술사", "스네트리", "아울베어", "가고일"],
        monsterTableByRegion: {
            WEST: ["오크 전사", "오크 주술사", "스네트리"],
            EAST: ["아울베어", "가고일", "오크 히어로"],
            CENTER: ["오크 전사", "오크 주술사", "스네트리", "아울베어"]
        }
    }
};
