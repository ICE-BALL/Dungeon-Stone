// 파일: data/procedural_bsp.js
// 역할: BSP 기반 절차형 던전 생성기

const TILE = {
    WALL: 0,
    FLOOR: 1
};

function createRng(seed = Date.now()) {
    let s = (Number(seed) >>> 0) || 1;
    return () => {
        s = ((1664525 * s) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function randInt(rng, min, max) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return lo + Math.floor(rng() * ((hi - lo) + 1));
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function createGrid(width, height, fill = TILE.WALL) {
    return Array.from({ length: height }, () => Array(width).fill(fill));
}

function carveRect(grid, x, y, w, h, tile = TILE.FLOOR) {
    const height = grid.length;
    const width = grid[0].length;
    const sx = clamp(x, 1, width - 2);
    const sy = clamp(y, 1, height - 2);
    const ex = clamp(x + w - 1, 1, width - 2);
    const ey = clamp(y + h - 1, 1, height - 2);
    for (let yy = sy; yy <= ey; yy++) {
        for (let xx = sx; xx <= ex; xx++) {
            grid[yy][xx] = tile;
        }
    }
}

function carveLCorridor(grid, from, to, rng = Math.random) {
    if (!from || !to) return [];
    const points = [];
    const horizontalFirst = rng() < 0.5;
    const carveLine = (x1, y1, x2, y2) => {
        let x = x1;
        let y = y1;
        points.push({ x, y });
        while (x !== x2) {
            x += Math.sign(x2 - x);
            if (grid[y] && grid[y][x] !== undefined) grid[y][x] = TILE.FLOOR;
            points.push({ x, y });
        }
        while (y !== y2) {
            y += Math.sign(y2 - y);
            if (grid[y] && grid[y][x] !== undefined) grid[y][x] = TILE.FLOOR;
            points.push({ x, y });
        }
    };

    if (horizontalFirst) {
        carveLine(from.x, from.y, to.x, from.y);
        carveLine(to.x, from.y, to.x, to.y);
    } else {
        carveLine(from.x, from.y, from.x, to.y);
        carveLine(from.x, to.y, to.x, to.y);
    }
    return points;
}

function isDeadEnd(grid, x, y) {
    if (!grid[y] || grid[y][x] !== TILE.FLOOR) return false;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let exits = 0;
    for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (grid[ny] && grid[ny][nx] === TILE.FLOOR) exits++;
    }
    return exits <= 1;
}

function pruneDeadEnds(grid, keepRatio = 0.35, iterations = 2, protectedSet = null, rng = Math.random) {
    const keep = Math.max(0, Math.min(1, Number(keepRatio || 0)));
    const rounds = Math.max(0, Number(iterations || 0));
    for (let round = 0; round < rounds; round++) {
        const toWall = [];
        for (let y = 1; y < grid.length - 1; y++) {
            for (let x = 1; x < grid[0].length - 1; x++) {
                if (protectedSet?.has(`${x},${y}`)) continue;
                if (!isDeadEnd(grid, x, y)) continue;
                if (rng() > keep) {
                    toWall.push({ x, y });
                }
            }
        }
        if (toWall.length === 0) break;
        toWall.forEach((p) => {
            grid[p.y][p.x] = TILE.WALL;
        });
    }
}

function getCenter(room) {
    return {
        x: Math.floor(room.x + (room.w / 2)),
        y: Math.floor(room.y + (room.h / 2))
    };
}

function createLeaf(x, y, w, h, depth = 0) {
    return {
        x,
        y,
        w,
        h,
        depth,
        left: null,
        right: null,
        room: null
    };
}

function splitLeaf(node, rng, minLeafSize, maxLeafSize) {
    if (!node || node.left || node.right) return false;
    if (node.w < (minLeafSize * 2) && node.h < (minLeafSize * 2)) return false;

    const wide = node.w / Math.max(1, node.h);
    const tall = node.h / Math.max(1, node.w);
    let horizontal = rng() > 0.5;
    if (wide > 1.25) horizontal = false;
    else if (tall > 1.25) horizontal = true;

    const maxSplit = (horizontal ? node.h : node.w) - minLeafSize;
    if (maxSplit <= minLeafSize) return false;
    const splitAt = randInt(rng, minLeafSize, maxSplit);

    if (horizontal) {
        node.left = createLeaf(node.x, node.y, node.w, splitAt, node.depth + 1);
        node.right = createLeaf(node.x, node.y + splitAt, node.w, node.h - splitAt, node.depth + 1);
    } else {
        node.left = createLeaf(node.x, node.y, splitAt, node.h, node.depth + 1);
        node.right = createLeaf(node.x + splitAt, node.y, node.w - splitAt, node.h, node.depth + 1);
    }
    return true;
}

function splitTree(root, rng, minLeafSize, maxLeafSize) {
    const leaves = [root];
    let didSplit = true;
    while (didSplit) {
        didSplit = false;
        const queue = leaves.slice();
        for (const leaf of queue) {
            if (leaf.left || leaf.right) continue;
            const shouldSplit = (
                leaf.w > maxLeafSize ||
                leaf.h > maxLeafSize ||
                rng() > 0.72
            );
            if (!shouldSplit) continue;
            if (splitLeaf(leaf, rng, minLeafSize, maxLeafSize)) {
                leaves.push(leaf.left, leaf.right);
                didSplit = true;
            }
        }
    }
}

function gatherLeaves(node, out = []) {
    if (!node) return out;
    if (!node.left && !node.right) {
        out.push(node);
        return out;
    }
    gatherLeaves(node.left, out);
    gatherLeaves(node.right, out);
    return out;
}

function assignRooms(leaves, rng, minRoomSize, maxRoomSize) {
    leaves.forEach((leaf) => {
        const rwMax = clamp(Math.min(maxRoomSize, leaf.w - 2), minRoomSize, Math.max(minRoomSize, leaf.w - 2));
        const rhMax = clamp(Math.min(maxRoomSize, leaf.h - 2), minRoomSize, Math.max(minRoomSize, leaf.h - 2));
        const rw = randInt(rng, minRoomSize, rwMax);
        const rh = randInt(rng, minRoomSize, rhMax);
        const rx = randInt(rng, leaf.x + 1, Math.max(leaf.x + 1, (leaf.x + leaf.w) - rw - 1));
        const ry = randInt(rng, leaf.y + 1, Math.max(leaf.y + 1, (leaf.y + leaf.h) - rh - 1));
        leaf.room = { x: rx, y: ry, w: rw, h: rh, depth: leaf.depth };
    });
}

function getAnyRoom(node) {
    if (!node) return null;
    if (node.room) return node.room;
    return getAnyRoom(node.left) || getAnyRoom(node.right);
}

function connectSiblingRooms(node, grid, edges = [], rng = Math.random) {
    if (!node || (!node.left && !node.right)) return edges;
    connectSiblingRooms(node.left, grid, edges, rng);
    connectSiblingRooms(node.right, grid, edges, rng);
    if (!node.left || !node.right) return edges;

    const leftRoom = getAnyRoom(node.left);
    const rightRoom = getAnyRoom(node.right);
    if (!leftRoom || !rightRoom) return edges;

    const from = getCenter(leftRoom);
    const to = getCenter(rightRoom);
    carveLCorridor(grid, from, to, rng);
    edges.push({
        from: `${from.x},${from.y}`,
        to: `${to.x},${to.y}`
    });
    return edges;
}

function computeRoomDistances(rooms, startCenter) {
    const withDist = rooms.map((room) => {
        const center = getCenter(room);
        const d = Math.abs(center.x - startCenter.x) + Math.abs(center.y - startCenter.y);
        return { room, center, dist: d };
    });
    withDist.sort((a, b) => a.dist - b.dist);
    return withDist;
}

function buildPopulation(rooms, startCenter, depthScale = 1) {
    const ranked = computeRoomDistances(rooms, startCenter);
    const farthest = ranked[ranked.length - 1] || null;
    const monsterSpawns = [];
    const chestSpawns = [];

    ranked.forEach((entry, idx) => {
        const area = entry.room.w * entry.room.h;
        const depth = Math.max(1, Math.floor((entry.dist / 14) * depthScale) + 1);
        const baseCount = Math.max(0, Math.floor(area / 36));
        const count = Math.min(4, baseCount);
        for (let i = 0; i < count; i++) {
            const ox = (i % 2 === 0) ? -1 : 1;
            const oy = (i % 3 === 0) ? 0 : ((i % 2 === 0) ? 1 : -1);
            monsterSpawns.push({
                x: entry.center.x + ox,
                y: entry.center.y + oy,
                tier: depth
            });
        }
        if (idx > 0 && (idx % 2 === 0)) {
            chestSpawns.push({
                x: entry.center.x,
                y: entry.center.y,
                tier: depth
            });
        }
    });

    return {
        boss: farthest ? { x: farthest.center.x, y: farthest.center.y, tier: Math.max(5, Math.floor((farthest.dist / 10) + 3)) } : null,
        monsters: monsterSpawns,
        chests: chestSpawns
    };
}

export function generateBspDungeon(config = {}) {
    const width = Math.max(24, Number(config.width || 64));
    const height = Math.max(24, Number(config.height || 64));
    const rng = createRng(config.seed ?? Date.now());
    const minLeafSize = Math.max(8, Number(config.minLeafSize || 14));
    const maxLeafSize = Math.max(minLeafSize + 2, Number(config.maxLeafSize || 26));
    const minRoomSize = Math.max(4, Number(config.minRoomSize || 6));
    const maxRoomSize = Math.max(minRoomSize + 1, Number(config.maxRoomSize || 14));

    const grid = createGrid(width, height, TILE.WALL);
    const root = createLeaf(1, 1, width - 2, height - 2, 0);
    splitTree(root, rng, minLeafSize, maxLeafSize);

    const leaves = gatherLeaves(root, []);
    assignRooms(leaves, rng, minRoomSize, maxRoomSize);
    const rooms = leaves.map((leaf) => leaf.room).filter(Boolean);
    rooms.forEach((room) => carveRect(grid, room.x, room.y, room.w, room.h, TILE.FLOOR));

    const edges = connectSiblingRooms(root, grid, [], rng);
    const startRoom = rooms[0] || { x: 2, y: 2, w: 4, h: 4, depth: 0 };
    const startPos = getCenter(startRoom);
    const placements = buildPopulation(rooms, startPos, Number(config.depthScale || 1));
    const endPos = placements.boss ? { x: placements.boss.x, y: placements.boss.y } : getCenter(rooms[rooms.length - 1] || startRoom);

    const protectedSet = new Set([`${startPos.x},${startPos.y}`, `${endPos.x},${endPos.y}`]);
    pruneDeadEnds(
        grid,
        Number(config.deadEndKeepRatio ?? 0.35),
        Number(config.deadEndTrimPasses ?? 2),
        protectedSet,
        rng
    );

    return {
        grid,
        startPos,
        endPos,
        rooms,
        edges,
        placements
    };
}
