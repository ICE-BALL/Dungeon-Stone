// 파일: data/maps_floors_4-6.js
// 역할: 4~6층 맵 데이터 정의 (중층 난이도 구간 강화)

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

export const mapsFloors4_6 = {
    4: {
        id: 4,
        name: "4층: 천공의 탑",
        width: 56,
        height: 56,
        description: "고리형 복도와 4개 시련실로 구성된 탑 내부. 길목 통제가 중요한 층입니다.",
        monsterDensity: 18,
        spawnRate: 0.007,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.WALL);
            const cx = Math.floor(w / 2);
            const cy = Math.floor(h / 2);

            // 외곽/내곽 고리
            carveRect(map, 4, 4, w - 8, h - 8, TILE.FLOOR);
            carveRect(map, 12, 12, w - 24, h - 24, TILE.WALL);
            carveRect(map, 19, 19, w - 38, h - 38, TILE.FLOOR);

            // 4개 시련실
            carveRect(map, 6, 6, 12, 12, TILE.FLOOR); // NW
            carveRect(map, w - 18, 6, 12, 12, TILE.FLOOR); // NE
            carveRect(map, 6, h - 18, 12, 12, TILE.FLOOR); // SW
            carveRect(map, w - 18, h - 18, 12, 12, TILE.FLOOR); // SE

            // 십자형 연결
            carveCorridor(map, cx, 5, cx, h - 6, TILE.FLOOR, 1);
            carveCorridor(map, 5, cy, w - 6, cy, TILE.FLOOR, 1);

            // 중앙 성소
            carveRect(map, cx - 3, cy - 3, 7, 7, TILE.FLOOR);

            boundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: "center", y: height => height - 8, desc: "탑 하층 입구" },
            { type: "PORTAL", targetLayer: 5, x: "center", y: 7, desc: "상층 포탈" },
            { type: "CURIO", id: "locked_chest", x: 9, y: 9, desc: "북서 시련실 보관함" },
            { type: "CURIO", id: "locked_chest", x: width => width - 10, y: 9, desc: "북동 시련실 보관함" },
            { type: "CURIO", id: "old_tombstone", x: 9, y: height => height - 10, desc: "남서 시련 비문" },
            { type: "CURIO", id: "mysterious_altar", x: width => width - 10, y: height => height - 10, desc: "남동 금단 제단" },
            { type: "CURIO", id: "ancient_inscription", x: "center", y: "center", desc: "중앙 문양석" }
        ],
        monsterTable: ["오크 전사", "리자드맨", "가고일", "트롤", "오크 히어로"],
        monsterTableByRegion: {
            NW: ["가고일", "리자드맨"],
            NE: ["오크 전사", "트롤"],
            SW: ["리자드맨", "가고일"],
            SE: ["오크 히어로", "트롤"],
            CENTER: ["오크 전사", "리자드맨", "가고일", "트롤"]
        }
    },

    5: {
        id: 5,
        name: "5층: 대마경",
        width: 82,
        height: 78,
        description: "용암 협곡과 좁은 암석 다리가 이어지는 고위험 구간. 경로 선택이 생존을 좌우합니다.",
        monsterDensity: 26,
        spawnRate: 0.008,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.WALL);

            // 중앙 종단 회랑
            carveCorridor(map, 4, Math.floor(h / 2), w - 5, Math.floor(h / 2), TILE.FLOOR, 1);

            // 용암 대협곡 (가로 띠)
            for (let y = Math.floor(h / 2) - 12; y <= Math.floor(h / 2) + 12; y++) {
                for (let x = 2; x < w - 2; x++) {
                    if (Math.random() < 0.65) map[y][x] = TILE.LAVA;
                }
            }

            // 안전 다리
            const bridges = [8, 18, 30, 45, 60, 72];
            bridges.forEach(bx => carveCorridor(map, bx, 6, bx, h - 7, TILE.FLOOR, 0));

            // 보조 석실
            carveRect(map, 6, 6, 14, 10, TILE.FLOOR);
            carveRect(map, w - 20, 8, 14, 10, TILE.FLOOR);
            carveRect(map, 10, h - 18, 16, 10, TILE.FLOOR);
            carveRect(map, w - 24, h - 20, 16, 12, TILE.FLOOR);

            // 랜덤 안전 바닥 생성
            for (let i = 0; i < 650; i++) {
                const x = Math.floor(Math.random() * (w - 4)) + 2;
                const y = Math.floor(Math.random() * (h - 4)) + 2;
                if (map[y][x] === TILE.WALL) map[y][x] = TILE.FLOOR;
            }

            boundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: 5, y: height => Math.floor(height / 2), desc: "대마경 입구" },
            { type: "PORTAL", targetLayer: 6, x: width => width - 6, y: height => Math.floor(height / 2), desc: "대해로 이어지는 포탈" },
            { type: "CURIO", id: "suspicious_dirt", x: "random_floor", y: "random_floor", desc: "흩어진 야영 흔적" },
            { type: "CURIO", id: "mysterious_altar", x: "random_floor", y: "random_floor", desc: "화염 제단" },
            { type: "CURIO", id: "locked_chest", x: "random_floor", y: "random_floor", desc: "화산암 상자" },
            { type: "CURIO", id: "rubble_pile", x: "random_floor", y: "random_floor", desc: "무너진 용암 광맥" }
        ],
        monsterTable: ["이프리트", "헬 하운드", "오크 히어로", "베르타스", "샌드웜"],
        monsterTableByRegion: {
            NORTH: ["이프리트", "헬 하운드"],
            SOUTH: ["오크 히어로", "베르타스"],
            CENTER: ["이프리트", "헬 하운드", "오크 히어로", "샌드웜"]
        }
    },

    6: {
        id: 6,
        name: "6층: 대해",
        width: 108,
        height: 108,
        description: "광대한 바다 위로 섬들이 흩뿌려진 해역. 섬 간 이동 루트를 찾는 탐색력이 중요합니다.",
        monsterDensity: 20,
        spawnRate: 0.006,
        generate: function() {
            const w = this.width;
            const h = this.height;
            const map = createMap(w, h, TILE.WATER);

            // 대형 섬 5개
            const islands = [
                [18, 18, 16, 14],
                [w - 34, 16, 18, 15],
                [14, h - 36, 20, 18],
                [w - 38, h - 38, 22, 20],
                [Math.floor(w / 2) - 10, Math.floor(h / 2) - 9, 20, 18]
            ];

            islands.forEach(([x, y, iw, ih], idx) => {
                carveRect(map, x, y, iw, ih, TILE.FLOOR);
                for (let i = 0; i < 80; i++) {
                    const rx = Math.floor(Math.random() * iw) + x;
                    const ry = Math.floor(Math.random() * ih) + y;
                    if (map[ry][rx] === TILE.FLOOR && Math.random() < 0.35) map[ry][rx] = TILE.FOREST;
                }
                if (idx === 4) {
                    carveRect(map, x + 5, y + 4, iw - 10, ih - 8, TILE.FLOOR);
                }
            });

            // 얕은 여울(연결선)
            carveCorridor(map, 25, 25, Math.floor(w / 2), Math.floor(h / 2), TILE.FLOOR, 0);
            carveCorridor(map, Math.floor(w / 2), Math.floor(h / 2), w - 26, 24, TILE.FLOOR, 0);
            carveCorridor(map, Math.floor(w / 2), Math.floor(h / 2), 25, h - 26, TILE.FLOOR, 0);
            carveCorridor(map, Math.floor(w / 2), Math.floor(h / 2), w - 27, h - 27, TILE.FLOOR, 0);

            // 작은 암초 군도
            for (let i = 0; i < 240; i++) {
                const x = Math.floor(Math.random() * (w - 4)) + 2;
                const y = Math.floor(Math.random() * (h - 4)) + 2;
                if (map[y][x] === TILE.WATER && Math.random() < 0.35) map[y][x] = TILE.FLOOR;
            }

            boundaryWalls(map);
            return map;
        },
        fixedEvents: [
            { type: "Start", x: 18, y: 18, desc: "해역 서북 섬" },
            { type: "PORTAL", targetLayer: 7, x: width => width - 28, y: height => height - 28, desc: "7층으로 가는 심해 포탈" },
            { type: "CURIO", id: "ancient_fountain", x: "random_floor", y: "random_floor", desc: "민물 샘" },
            { type: "CURIO", id: "locked_chest", x: "random_floor", y: "random_floor", desc: "표류 상자" },
            { type: "CURIO", id: "beast_tracks", x: "random_floor", y: "random_floor", desc: "해수 짐승 흔적" },
            { type: "CURIO", id: "hidden_cache", x: "random_floor", y: "random_floor", desc: "침몰선 보급함" }
        ],
        monsterTable: ["머멀", "씨 서펜트", "스톰거쉬", "라플레미믹", "심연어"],
        monsterTableByRegion: {
            NORTH: ["머멀", "씨 서펜트"],
            SOUTH: ["스톰거쉬", "라플레미믹", "심연어"],
            CENTER: ["머멀", "씨 서펜트", "스톰거쉬", "심연어"]
        }
    }
};
