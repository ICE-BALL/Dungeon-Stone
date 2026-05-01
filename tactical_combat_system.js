// 파일: tactical_combat_system.js
// 역할: SRPG 전술 모드 보조 로직 (이동 범위, 사거리, LOS/엄폐)

export function tileKey(x, y) {
    return `${x},${y}`;
}

export function parseTileKey(key) {
    const [sx, sy] = String(key || "").split(",");
    const x = Number(sx);
    const y = Number(sy);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

export function manhattan(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

export function createTacticalState() {
    return {
        active: false,
        phase: "player",
        movePoints: 4,
        maxMovePoints: 4,
        actionPoints: 1,
        attackRange: 3,
        moveTiles: new Set(),
        attackTiles: new Set(),
        coverTiles: new Set(),
        lastLog: ""
    };
}

export function computeReachableTiles({
    width,
    height,
    startX,
    startY,
    movePoints,
    isBlocked
}) {
    const result = new Set();
    const costMap = new Map();
    const queue = [{ x: startX, y: startY, c: 0 }];
    costMap.set(tileKey(startX, startY), 0);
    result.add(tileKey(startX, startY));

    while (queue.length > 0) {
        const current = queue.shift();
        const nextCost = current.c + 1;
        if (nextCost > movePoints) continue;

        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (isBlocked(nx, ny)) continue;
            const key = tileKey(nx, ny);
            const previous = costMap.get(key);
            if (previous !== undefined && previous <= nextCost) continue;
            costMap.set(key, nextCost);
            result.add(key);
            queue.push({ x: nx, y: ny, c: nextCost });
        }
    }
    return result;
}

export function computeRangeTiles({
    width,
    height,
    originX,
    originY,
    range
}) {
    const result = new Set();
    const maxRange = Math.max(0, Number(range || 0));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const d = manhattan(originX, originY, x, y);
            if (d > 0 && d <= maxRange) {
                result.add(tileKey(x, y));
            }
        }
    }
    return result;
}

export function bresenhamLine(x0, y0, x1, y1) {
    const points = [];
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
        points.push({ x, y });
        if (x === x1 && y === y1) break;
        const e2 = err * 2;
        if (e2 >= dy) {
            err += dy;
            x += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y += sy;
        }
    }
    return points;
}

function inferCoverTiles(targetX, targetY) {
    return [
        { x: targetX + 1, y: targetY },
        { x: targetX - 1, y: targetY },
        { x: targetX, y: targetY + 1 },
        { x: targetX, y: targetY - 1 }
    ];
}

export function evaluateLineOfSight({
    fromX,
    fromY,
    toX,
    toY,
    isWall
}) {
    const line = bresenhamLine(fromX, fromY, toX, toY);
    const body = line.slice(1, line.length - 1);
    const blockedTiles = body.filter((p) => Boolean(isWall(p.x, p.y)));
    if (blockedTiles.length > 0) {
        return {
            hasLineOfSight: false,
            coverRate: 1,
            blockedTiles
        };
    }

    let coverRate = 0;
    const coverCandidates = inferCoverTiles(toX, toY);
    const coverHits = coverCandidates.filter((p) => Boolean(isWall(p.x, p.y))).length;
    if (coverHits >= 2) coverRate = 0.35;
    else if (coverHits === 1) coverRate = 0.18;

    return {
        hasLineOfSight: true,
        coverRate,
        blockedTiles: []
    };
}

export function pickNearestAttackableTarget({
    playerX,
    playerY,
    monsters,
    attackRange,
    hasRangeTile,
    evaluateLos
}) {
    const list = Array.isArray(monsters) ? monsters : [];
    const candidates = [];
    list.forEach((monster) => {
        if (!monster || !Number.isFinite(monster.x) || !Number.isFinite(monster.y)) return;
        const d = manhattan(playerX, playerY, monster.x, monster.y);
        if (d <= 0 || d > attackRange) return;
        if (typeof hasRangeTile === "function" && !hasRangeTile(monster.x, monster.y)) return;
        const los = evaluateLos(monster.x, monster.y);
        if (!los?.hasLineOfSight) return;
        candidates.push({ monster, d, los });
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0];
}

