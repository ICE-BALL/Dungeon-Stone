// 파일: data/maps_floors_7-10.js
// 역할: 7~10층 맵 데이터 정의 (심층/엔드게임 구간 강화)

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

function carveRect(map, x, y, w, h, tile = TILE.FLOOR) {
    for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
            if (yy > 0 && yy < map.length - 1 && xx > 0 && xx < map[0].length - 1) map[yy][xx] = tile;
        }
    }
}

function carveCorridor(map, x1, y1, x2, y2, tile = TILE.FLOOR, thick = 1) {
    let x = x1;
    let y = y1;
    while (x !== x2) {
        x += Math.sign(x2 - x);
        for (let t = -thick; t <= thick; t++) {
            const ny = y + t;
            if (map[ny] && map[ny][x] !== undefined && ny > 0 && ny < map.length - 1) map[ny][x] = tile;
        }
    }
    while (y !== y2) {
        y += Math.sign(y2 - y);
        for (let t = -thick; t <= thick; t++) {
            const nx = x + t;
            if (map[y] && map[y][nx] !== undefined && nx > 0 && nx < map[0].length - 1) map[y][nx] = tile;
        }
    }
}

function boundaryWalls(map) {
    const h = map.length;
    const w = map[0].length;
    for (let x = 0; x < w; x++) {
        map[0][x] = TILE.WALL;
        map[h - 1][x] = TILE.WALL;
    }
    for (let y = 0; y < h; y++) {
        map[y][0] = TILE.WALL;
        map[y][w - 1] = TILE.WALL;
    }
}

export const mapsFloors7_10 = {
    7: {
        id: 7,
        name: "7층: 암흑대륙 / 아이스록",
        width: 92,
        height: 92,
        description: "좌측은 암흑대륙, 우측은 아이스록. 중앙 균열지대를 통과해야 다음 길이 열립니다.",
        monsterDensity: 30,
        spawnRate: 0.007,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.FLOOR);
            const cx = Math.floor(w / 2);

            // 좌측: 암흑대륙(숲/암석)
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < cx - 1; x++) {
                    map[y][x] = Math.random() < 0.45 ? TILE.FOREST : TILE.FLOOR;
                    if (Math.random() < 0.14) map[y][x] = TILE.WALL;
                }
            }

            // 우측: 아이스록(빙원)
            for (let y = 1; y < h - 1; y++) {
                for (let x = cx + 1; x < w - 1; x++) {
                    map[y][x] = TILE.ICE;
                    if (Math.random() < 0.10) map[y][x] = TILE.WALL;
                }
            }

            // 중앙 균열 용암대 + 횡단로
            for (let y = 1; y < h - 1; y++) {
                map[y][cx] = TILE.LAVA;
                if (Math.random() < 0.35 && y > 8 && y < h - 9) map[y][cx] = TILE.WALL;
            }
            const bridges = [14, 28, 45, 62, 78];
            bridges.forEach(by => {
                carveCorridor(map, cx - 3, by, cx + 3, by, TILE.FLOOR, 0);
            });

            // 시작/목표 구역
            carveRect(map, 5, Math.floor(h / 2) - 4, 10, 9, TILE.FLOOR);
            carveRect(map, w - 15, Math.floor(h / 2) - 4, 10, 9, TILE.FLOOR);

            boundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: 8, y: height => Math.floor(height / 2), desc: "암흑대륙 진입지" },
            { type: "PORTAL", targetLayer: 8, x: width => width - 9, y: height => Math.floor(height / 2), desc: "여명의 땅으로 가는 길" },
            { type: "CURIO", id: "ancient_grave", x: "random_floor", y: "random_floor", desc: "암흑 무덤" },
            { type: "CURIO", id: "mysterious_altar", x: "random_floor", y: "random_floor", desc: "심연 제단" },
            { type: "CURIO", id: "old_tombstone", x: "random_floor", y: "random_floor", desc: "탐험가 표식석" }
        ],
        monsterTable: ["데드레드", "벤시 퀸", "예티", "아이스 골렘", "듀라한"],
        monsterTableByRegion: {
            WEST: ["데드레드", "벤시 퀸", "듀라한"],
            EAST: ["예티", "아이스 골렘", "데드레드"],
            CENTER: ["데드레드", "벤시 퀸", "예티", "아이스 골렘"]
        }
    },

    8: {
        id: 8,
        name: "8층: 여명의 땅",
        width: 52,
        height: 52,
        description: "짧은 정비를 위한 안전지대. 몬스터가 없으며 균열과 다음 포탈이 공존합니다.",
        monsterDensity: 0,
        spawnRate: 0,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.FOREST);
            const cx = Math.floor(w / 2);
            const cy = Math.floor(h / 2);

            // 중앙 광장/성소
            carveRect(map, cx - 8, cy - 8, 17, 17, TILE.FLOOR);
            carveRect(map, cx - 3, cy - 3, 7, 7, TILE.FLOOR);

            // 둘레 산책로
            carveRect(map, 6, 6, w - 12, h - 12, TILE.FLOOR);
            carveRect(map, 10, 10, w - 20, h - 20, TILE.FOREST);

            // 소형 연못
            carveRect(map, cx - 14, cy - 2, 4, 4, TILE.WATER);
            carveRect(map, cx + 11, cy - 2, 4, 4, TILE.WATER);

            boundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: "center", y: height => height - 8, desc: "여명의 광장" },
            { type: "PORTAL", targetLayer: 9, x: "center", y: 7, desc: "9층으로 가는 포탈" },
            { type: "RIFT", id: "random_rift", x: width => Math.floor(width / 2) - 6, y: height => Math.floor(height / 2), desc: "불안정한 균열" },
            { type: "CURIO", id: "ancient_fountain", x: width => Math.floor(width / 2) + 6, y: height => Math.floor(height / 2), desc: "회복의 샘" },
            { type: "CURIO", id: "herb_garden", x: "random_floor", y: "random_floor", desc: "약초 군락" }
        ],
        monsterTable: []
    },

    9: {
        id: 9,
        name: "9층: 별무덤",
        width: 92,
        height: 92,
        description: "거대한 운석 분화구와 용암 웅덩이가 흩어진 전장. 위험 지형을 우회해야 합니다.",
        monsterDensity: 34,
        spawnRate: 0.008,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.FLOOR);

            // 운석 분화구 다수 생성
            for (let i = 0; i < 28; i++) {
                const cx = Math.floor(Math.random() * (w - 14)) + 7;
                const cy = Math.floor(Math.random() * (h - 14)) + 7;
                const r = Math.floor(Math.random() * 4) + 2;
                for (let y = cy - r; y <= cy + r; y++) {
                    for (let x = cx - r; x <= cx + r; x++) {
                        if (!map[y] || map[y][x] === undefined) continue;
                        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
                        if (d2 <= r * r) map[y][x] = TILE.LAVA;
                        else if (d2 <= (r + 1) * (r + 1) && Math.random() < 0.4) map[y][x] = TILE.WALL;
                    }
                }
            }

            // 주 통로 확보
            carveCorridor(map, 5, Math.floor(h / 2), w - 6, Math.floor(h / 2), TILE.FLOOR, 1);
            carveCorridor(map, Math.floor(w / 2), 5, Math.floor(w / 2), h - 6, TILE.FLOOR, 1);
            carveRect(map, Math.floor(w / 2) - 4, Math.floor(h / 2) - 4, 9, 9, TILE.FLOOR);

            boundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: 7, y: height => Math.floor(height / 2), desc: "별무덤 외곽" },
            { type: "PORTAL", targetLayer: 10, x: width => width - 8, y: height => Math.floor(height / 2), desc: "심연 입구" },
            { type: "CURIO", id: "rubble_pile", x: "random_floor", y: "random_floor", desc: "운석 파편 지대" },
            { type: "CURIO", id: "crystal_cave", x: "random_floor", y: "random_floor", desc: "운석공명 동굴" },
            { type: "CURIO", id: "ancient_inscription", x: "random_floor", y: "random_floor", desc: "붕괴된 관측 비문" }
        ],
        monsterTable: ["기가제르오스", "본 드래곤", "드라이즌", "라망시스", "종말의 기사"],
        monsterTableByRegion: {
            CENTER: ["기가제르오스", "본 드래곤", "라망시스"],
            NORTH: ["드라이즌", "본 드래곤"],
            SOUTH: ["기가제르오스", "라망시스", "종말의 기사"]
        }
    },

    10: {
        id: 10,
        name: "10층: 심연의 문",
        width: 42,
        height: 112,
        description: "세로로 긴 최종 회랑. 양측 함정구역을 돌파해 심연의 문에 도달해야 합니다.",
        monsterDensity: 36,
        spawnRate: 0.009,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.WALL);
            const cx = Math.floor(w / 2);

            // 중앙 대회랑
            carveRect(map, cx - 4, 2, 9, h - 4, TILE.FLOOR);

            // 좌/우 함정 가지길
            for (let y = 8; y < h - 8; y += 12) {
                carveRect(map, cx - 14, y, 7, 5, TILE.FLOOR);
                carveRect(map, cx + 8, y + 2, 7, 5, TILE.FLOOR);
                carveCorridor(map, cx - 5, y + 2, cx - 8, y + 2, TILE.FLOOR, 0);
                carveCorridor(map, cx + 5, y + 4, cx + 8, y + 4, TILE.FLOOR, 0);
            }

            // 회랑 내 위험 타일
            for (let y = 4; y < h - 4; y++) {
                for (let x = cx - 4; x <= cx + 4; x++) {
                    if (Math.random() < 0.08) map[y][x] = TILE.LAVA;
                    if (Math.random() < 0.05) map[y][x] = TILE.WALL;
                }
            }

            // 시작/엔딩 구역 보정
            carveRect(map, cx - 6, h - 11, 13, 8, TILE.FLOOR);
            carveRect(map, cx - 6, 3, 13, 8, TILE.FLOOR);

            boundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: "center", y: height => height - 8, desc: "심연 회랑 입구" },
            { type: "CURIO", id: "old_tombstone", x: "center", y: height => height - 20, desc: "최후의 경고문" },
            { type: "CURIO", id: "mysterious_altar", x: "random_floor", y: "random_floor", desc: "심연 제단" },
            { type: "CURIO", id: "locked_chest", x: "random_floor", y: "random_floor", desc: "봉인된 보물함" },
            { type: "PORTAL", targetLayer: "Ending", x: "center", y: 5, desc: "심연의 문" }
        ],
        monsterTable: ["길티고스", "톨-라푸파", "종말의 기사", "어비스 스켈레톤", "본 드래곤"],
        monsterTableByRegion: {
            CENTER: ["길티고스", "톨-라푸파", "종말의 기사", "어비스 스켈레톤"],
            NORTH: ["종말의 기사", "본 드래곤"],
            SOUTH: ["길티고스", "어비스 스켈레톤"]
        }
    }
};
