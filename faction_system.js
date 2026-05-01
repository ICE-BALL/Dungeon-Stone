// 파일: faction_system.js
// 역할: 세력 평판/관계 매트릭스/트리거 처리

const DEFAULT_FACTION_MATRIX = {
    "왕국군": { "왕국군": 100, "반란군": -100, "암시장": -50, "클랜": 25, "약탈자": -80, "중립": 0 },
    "반란군": { "왕국군": -100, "반란군": 100, "암시장": 30, "클랜": -20, "약탈자": 10, "중립": -10 },
    "암시장": { "왕국군": -50, "반란군": 30, "암시장": 100, "클랜": 5, "약탈자": 25, "중립": 10 },
    "클랜": { "왕국군": 25, "반란군": -20, "암시장": 5, "클랜": 100, "약탈자": -40, "중립": 15 },
    "약탈자": { "왕국군": -80, "반란군": 10, "암시장": 25, "클랜": -40, "약탈자": 100, "중립": -60 },
    "중립": { "왕국군": 0, "반란군": -10, "암시장": 10, "클랜": 15, "약탈자": -60, "중립": 100 }
};

const DEFAULT_TRIGGERS = [
    {
        faction: "암시장",
        mode: "gte",
        threshold: 50,
        flag: "black_market_hidden_gate",
        message: "[세력] 암시장 평판이 높아져 은밀한 입구가 개방되었습니다."
    },
    {
        faction: "왕국군",
        mode: "lte",
        threshold: -60,
        flag: "kingdom_chaser_active",
        message: "[세력] 왕국군이 추격자를 파견하기 시작했습니다."
    }
];

function clampRep(v) {
    return Math.max(-100, Math.min(100, Math.round(Number(v || 0))));
}

function ensureFactionState(player) {
    player.factionState = player.factionState || {};
    const state = player.factionState;
    state.matrix = state.matrix || JSON.parse(JSON.stringify(DEFAULT_FACTION_MATRIX));
    state.reputation = state.reputation || {
        "왕국군": 0,
        "반란군": 0,
        "암시장": 0,
        "클랜": 0,
        "약탈자": 0,
        "중립": 0
    };
    state.flags = state.flags || {};
    state.log = state.log || [];
    return state;
}

function getByPath(table, a, b) {
    if (!table || !table[a]) return 0;
    return Number(table[a][b] || 0);
}

export function inferFactionFromMonster(monsterName = "") {
    const name = String(monsterName || "");
    if (/약탈|강도|도적|레이지|raider/i.test(name)) return "약탈자";
    if (/기사|근위|모즐란|king|royal/i.test(name)) return "왕국군";
    if (/밀수|암시장|smuggler/i.test(name)) return "암시장";
    if (/클랜|부족|tribe/i.test(name)) return "클랜";
    if (/혁명|반란|rebel/i.test(name)) return "반란군";
    return "중립";
}

export class FactionSystem {
    constructor(player, options = {}) {
        this.player = player;
        this.triggers = Array.isArray(options.triggers) ? options.triggers : DEFAULT_TRIGGERS.slice();
        ensureFactionState(this.player);
    }

    getState() {
        return ensureFactionState(this.player);
    }

    getReputation(faction) {
        const state = this.getState();
        return clampRep(state.reputation?.[faction] || 0);
    }

    getRelation(a, b) {
        const state = this.getState();
        return getByPath(state.matrix, a, b);
    }

    setFlag(flagName, value = true) {
        const state = this.getState();
        state.flags[flagName] = Boolean(value);
    }

    getFlag(flagName) {
        const state = this.getState();
        return Boolean(state.flags?.[flagName]);
    }

    adjustReputation(faction, delta, reason = "") {
        if (!faction || !Number.isFinite(Number(delta)) || Number(delta) === 0) return 0;
        const state = this.getState();
        const prev = clampRep(state.reputation[faction] || 0);
        const next = clampRep(prev + Number(delta));
        state.reputation[faction] = next;
        if (next !== prev) {
            const signed = (next - prev) >= 0 ? `+${next - prev}` : `${next - prev}`;
            const message = `[세력] ${faction} 평판 ${signed} -> ${next}${reason ? ` (${reason})` : ""}`;
            state.log.push({ at: Date.now(), faction, change: next - prev, value: next, reason });
            this.player.cb?.logMessage?.(message);
        }
        this.evaluateTriggers();
        return next;
    }

    evaluateTriggers() {
        const state = this.getState();
        this.triggers.forEach((trigger) => {
            const current = clampRep(state.reputation?.[trigger.faction] || 0);
            const met = trigger.mode === "lte"
                ? current <= Number(trigger.threshold)
                : current >= Number(trigger.threshold);
            if (met && !state.flags?.[trigger.flag]) {
                state.flags[trigger.flag] = true;
                if (trigger.message) this.player.cb?.logMessage?.(trigger.message);
            }
        });
    }

    applyKillConsequences({ killedFaction = "중립", witnesses = [] } = {}) {
        const base = {
            "왕국군": 0,
            "반란군": 0,
            "암시장": 0,
            "클랜": 0,
            "약탈자": 0,
            "중립": 0
        };

        switch (killedFaction) {
            case "약탈자":
                base["약탈자"] -= 9;
                base["왕국군"] += 5;
                base["클랜"] += 4;
                base["중립"] += 2;
                break;
            case "왕국군":
                base["왕국군"] -= 8;
                base["반란군"] += 6;
                base["암시장"] += 2;
                base["중립"] -= 2;
                break;
            case "반란군":
                base["반란군"] -= 7;
                base["왕국군"] += 4;
                base["클랜"] += 1;
                break;
            default:
                base["중립"] += 1;
                break;
        }

        const uniqueWitness = [...new Set((Array.isArray(witnesses) ? witnesses : []).filter(Boolean))];
        uniqueWitness.forEach((faction) => {
            const relation = this.getRelation(faction, killedFaction);
            const weight = Math.max(-4, Math.min(4, Math.round(-relation / 25)));
            if (!Number.isFinite(weight) || weight === 0) return;
            base[faction] = (base[faction] || 0) + weight;
        });

        Object.entries(base).forEach(([faction, delta]) => {
            if (!delta) return;
            this.adjustReputation(faction, delta, `${killedFaction} 처치`);
        });
    }
}

