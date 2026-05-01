// 파일: living_world_system.js
// 역할: 보이지 않는 구역의 추상 생태계 시뮬레이션 + 몬스터 FSM 보조

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createLayerState() {
    return {
        predator: 12,
        prey: 26,
        scavenger: 8,
        corpsePressure: 0,
        tick: 0
    };
}

function roundTo(value, digits = 2) {
    const base = Math.pow(10, digits);
    return Math.round(Number(value || 0) * base) / base;
}

function makeRumorHeadline(key, mult, trend) {
    const map = {
        magic_stone: "마석",
        essence: "정수",
        rift_shard: "균열석",
        mana_core: "마력결정체"
    };
    const name = map[key] || key;
    const pct = Math.round((Number(mult || 1) - 1) * 100);
    if (trend === "up") return `${name} 매입가 상승 기류 (${pct >= 0 ? "+" : ""}${pct}%)`;
    if (trend === "down") return `${name} 매입가 하락 기류 (${pct >= 0 ? "+" : ""}${pct}%)`;
    return `${name} 시세 횡보`;
}

export class LivingWorldSimulator {
    constructor(player) {
        this.player = player;
        this.layers = {};
        this.lastGlobalTick = 0;
        this.market = {
            dayStamp: "1-1",
            multipliers: {
                magic_stone: 1.0,
                essence: 1.0,
                rift_shard: 1.0,
                mana_core: 1.0
            },
            tomorrowHints: [],
            rumorLog: []
        };
    }

    ensureLayer(layerId) {
        const key = String(layerId || 1);
        if (!this.layers[key]) this.layers[key] = createLayerState();
        return this.layers[key];
    }

    getLayerSnapshot(layerId) {
        const layer = this.ensureLayer(layerId);
        return { ...layer };
    }

    onCorpseAdded(layerId, nutrition = 1) {
        const layer = this.ensureLayer(layerId);
        layer.corpsePressure = clamp(layer.corpsePressure + (Number(nutrition || 1) * 0.6), 0, 200);
    }

    onCorpseConsumed(layerId, nutrition = 1) {
        const layer = this.ensureLayer(layerId);
        layer.corpsePressure = clamp(layer.corpsePressure - (Number(nutrition || 1) * 1.2), 0, 200);
    }

    simulateTurn({ currentLayer, localPredators = 0, localPrey = 0, corpseCount = 0 } = {}) {
        const activeLayer = String(currentLayer || 1);
        const keys = [];
        for (let i = 1; i <= 10; i++) keys.push(String(i));
        keys.forEach((k) => this.ensureLayer(k));

        keys.forEach((layerKey) => {
            const state = this.layers[layerKey];
            state.tick += 1;

            const localBoost = layerKey === activeLayer ? 1.2 : 1;
            const predPressure = Math.max(0.2, state.predator / Math.max(1, state.prey));
            const preyDrop = Math.floor((predPressure * localBoost) + (Math.random() * 2));
            const preyGain = Math.floor((state.corpsePressure * 0.02) + (Math.random() * 2));
            const predGain = Math.floor((state.prey * 0.03) + (Math.random() * 1.6));
            const predLoss = Math.floor((Math.random() * 2) + (state.prey < 8 ? 1 : 0));

            state.prey = clamp(state.prey - preyDrop + preyGain, 0, 240);
            state.predator = clamp(state.predator + predGain - predLoss, 0, 180);
            state.scavenger = clamp(
                state.scavenger + Math.floor((state.corpsePressure * 0.04) - (Math.random() * 1.2)),
                0,
                140
            );

            state.corpsePressure = clamp(state.corpsePressure - 0.7, 0, 220);
            if (layerKey === activeLayer) {
                state.predator = clamp(state.predator + Math.floor(Number(localPredators || 0) * 0.03), 0, 180);
                state.prey = clamp(state.prey + Math.floor(Number(localPrey || 0) * 0.02), 0, 240);
                state.corpsePressure = clamp(state.corpsePressure + Number(corpseCount || 0) * 0.4, 0, 220);
            }
        });

        const current = this.layers[activeLayer];
        const spawnBias = clamp((current.predator / Math.max(8, current.prey)) * 0.18, -0.2, 0.35);
        return {
            spawnBias,
            predator: current.predator,
            prey: current.prey,
            scavenger: current.scavenger
        };
    }

    decideMonsterState(monster, context = {}) {
        const hp = Number(monster?.hp || 0);
        const maxHp = Math.max(1, Number(monster?.maxHp || hp || 1));
        const hpRate = hp / maxHp;
        const playerDistance = Number(context.playerDistance || 999);
        const corpseDistance = Number(context.corpseDistance || 999);

        if (hpRate <= 0.35) return "Hungry";
        if (corpseDistance <= 4) return "Scavenge";
        if (playerDistance >= 8 && Math.random() < 0.24) return "Sleep";
        if (playerDistance <= 5) return "Battle";
        return "Patrol";
    }

    ensureMarketState() {
        if (!this.market || typeof this.market !== "object") {
            this.market = {
                dayStamp: "1-1",
                multipliers: {},
                tomorrowHints: [],
                rumorLog: []
            };
        }
        this.market.multipliers = this.market.multipliers || {};
        this.market.rumorLog = Array.isArray(this.market.rumorLog) ? this.market.rumorLog : [];
        this.market.tomorrowHints = Array.isArray(this.market.tomorrowHints) ? this.market.tomorrowHints : [];
        ["magic_stone", "essence", "rift_shard", "mana_core"].forEach((k) => {
            if (!Number.isFinite(Number(this.market.multipliers[k]))) {
                this.market.multipliers[k] = 1.0;
            }
        });
        return this.market;
    }

    getCommodityKey(itemName = "", itemData = null) {
        const name = String(itemName || "");
        if (name.includes("정수")) return "essence";
        if (name === "균열석") return "rift_shard";
        if (name === "마력결정체") return "mana_core";
        if (name.includes("마석")) return "magic_stone";
        if (itemData?.type === "정수") return "essence";
        return "general";
    }

    getMarketMultiplier(itemName = "", itemData = null) {
        const state = this.ensureMarketState();
        const key = this.getCommodityKey(itemName, itemData);
        if (key === "general") return 1.0;
        return clamp(Number(state.multipliers?.[key] || 1.0), 0.8, 1.5);
    }

    getAdjustedPrice(basePrice = 0, itemName = "", mode = "buy", itemData = null) {
        const base = Math.max(1, Math.floor(Number(basePrice || 0)));
        const marketMult = this.getMarketMultiplier(itemName, itemData);
        let result = base;
        if (mode === "sell") {
            result = Math.floor(base * marketMult);
        } else if (mode === "buy") {
            // 매입가가 오르면 판매가도 일부 연동되지만 폭은 낮춤
            const buyMult = 1 + ((marketMult - 1) * 0.45);
            result = Math.floor(base * clamp(buyMult, 0.9, 1.25));
        }
        return Math.max(1, result);
    }

    buildTomorrowHints() {
        const state = this.ensureMarketState();
        const hints = [];
        Object.entries(state.multipliers || {}).forEach(([key, mult]) => {
            const m = Number(mult || 1);
            let trend = "flat";
            if (m >= 1.18) trend = "up";
            else if (m <= 0.9) trend = "down";
            hints.push({ key, trend, text: makeRumorHeadline(key, m, trend) });
        });
        state.tomorrowHints = hints;
        return hints;
    }

    onDayPassed({ day = 1, month = 1 } = {}) {
        const state = this.ensureMarketState();
        const stamp = `${month}-${day}`;
        if (state.dayStamp === stamp) return null;
        state.dayStamp = stamp;

        const next = {};
        Object.entries(state.multipliers || {}).forEach(([key, prev]) => {
            const drift = 0.8 + (Math.random() * 0.7); // 0.8 ~ 1.5
            const smoothed = (Number(prev || 1) * 0.35) + (drift * 0.65);
            next[key] = clamp(roundTo(smoothed, 2), 0.8, 1.5);
        });
        state.multipliers = next;
        const hints = this.buildTomorrowHints();
        const headline = hints.length > 0
            ? hints[Math.floor(Math.random() * hints.length)].text
            : "주요 물품 시세 변동 없음";
        state.rumorLog.push({ day, month, headline, multipliers: { ...next } });
        if (state.rumorLog.length > 24) state.rumorLog.shift();
        return { headline, multipliers: { ...next }, hints };
    }

    getTavernRumor() {
        const state = this.ensureMarketState();
        const hints = Array.isArray(state.tomorrowHints) && state.tomorrowHints.length > 0
            ? state.tomorrowHints
            : this.buildTomorrowHints();
        if (!hints.length) return "오늘은 시세 관련 소문이 없습니다.";
        const pick = hints[Math.floor(Math.random() * hints.length)];
        const prefix = [
            "주점 소문:",
            "상인들 말로는,",
            "길드 게시판 소식:",
            "하역장 정보:"
        ];
        const head = prefix[Math.floor(Math.random() * prefix.length)];
        if (pick.trend === "down") return `${head} 내일은 ${pick.text} 가능성이 큽니다.`;
        if (pick.trend === "up") return `${head} 내일은 ${pick.text} 전망입니다.`;
        return `${head} ${pick.text}. 큰 변동은 없을 듯합니다.`;
    }

    resolveBlackMarketDeal({
        player = null,
        mode = "sell",
        itemName = "",
        basePrice = 0
    } = {}) {
        const safeBase = Math.max(1, Math.floor(Number(basePrice || 0)));
        const marketPrice = this.getAdjustedPrice(safeBase, itemName, mode, null);
        const sellBoost = 1.12 + (Math.random() * 0.3);
        const targetPrice = mode === "sell"
            ? Math.max(1, Math.floor(marketPrice * sellBoost))
            : Math.max(1, Math.floor(marketPrice * (0.78 + (Math.random() * 0.16))));

        const fakeCoinChance = mode === "sell" ? 0.2 : 0.0;
        const raidChance = 0.14;
        const fakeCoin = Math.random() < fakeCoinChance;
        const raid = !fakeCoin && Math.random() < raidChance;
        const result = {
            mode,
            targetPrice,
            fakeCoin,
            raid,
            fine: 0,
            realGain: targetPrice
        };

        if (fakeCoin) {
            result.realGain = Math.floor(targetPrice * (0.1 + Math.random() * 0.25));
        }
        if (raid) {
            result.fine = Math.floor(targetPrice * (0.22 + Math.random() * 0.28));
        }

        if (player) {
            if (mode === "sell") {
                player.gold = Math.max(0, Number(player.gold || 0) + result.realGain);
            } else {
                player.gold = Math.max(0, Number(player.gold || 0) - result.targetPrice);
            }
            if (result.raid) {
                player.gold = Math.max(0, Number(player.gold || 0) - result.fine);
            }
        }
        return result;
    }
}
