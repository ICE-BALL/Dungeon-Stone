function stringHash(value) {
    const text = String(value || "");
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function statId(name) {
    return String(name || "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w\uac00-\ud7a3]/g, "_");
}

const BRANCHES = [
    { id: "body", label: "육체 회로", hint: "근접 전투와 신체 능력 중심", regex: /근력|민첩성|유연성|도약력|절삭력|근질량|체중|골강도|골밀도/ },
    { id: "endurance", label: "생존 회로", hint: "지구력/재생/지속력 중심", regex: /지구력|기력|자연 재생력|수복력|고통내성|인내심|폐활량|소화력|식욕/ },
    { id: "mind", label: "정신 회로", hint: "정신 저항과 제어 중심", regex: /정신력|통제력|집착|적응력|인지력|인지 방해/ },
    { id: "soul", label: "영혼 회로", hint: "영혼력/마력 운용 중심", regex: /영혼력|영혼 재생력|항마력|명중률|손재주/ },
    { id: "sense", label: "감각 회로", hint: "탐지/정밀/회피 중심", regex: /시각|시야|후각|청각|육감|행운/ },
    { id: "element", label: "속성 회로", hint: "감응/내성/속성 대응 중심", regex: /감응도|내성|화염|냉기|번개|대지|독|신성|어둠/ }
];

const BRANCH_DERIVED = {
    body: { maxHpRate: 0.004, critChance: 0.0012 },
    endurance: { maxStaminaRate: 0.006, hpRegenBonus: 0.002 },
    mind: { debuffResist: 0.006, controlPower: 0.004 },
    soul: { maxMpRate: 0.006, essenceDropRate: 0.0026 },
    sense: { evasion: 0.0018, critChance: 0.0014, itemDropRate: 0.0022 },
    element: { itemDropRate: 0.0016, numberDropRate: 0.0012 }
};

function resolveBranch(statName) {
    const branch = BRANCHES.find((entry) => entry.regex.test(statName));
    return branch || BRANCHES[0];
}

function nodeFactory({
    id,
    name,
    desc,
    branch,
    x,
    y,
    tier = 1,
    cost = 1,
    costStep = 0,
    maxRank = 1,
    requires = [],
    unlockLevel = 1,
    grants = null,
    autoUnlock = false
}) {
    return {
        id,
        name,
        desc,
        branch,
        x,
        y,
        tier,
        cost,
        costStep,
        maxRank,
        requires,
        unlockLevel,
        grants: grants || { stats: {}, derived: {} },
        autoUnlock
    };
}

function addBonus(target, bonus, multiplier = 1) {
    Object.entries(bonus || {}).forEach(([key, value]) => {
        if (!Number.isFinite(value)) return;
        target[key] = (target[key] || 0) + (value * multiplier);
    });
}

function createTierNode(branch, statName, tier, rowIndex) {
    const sid = statId(statName);
    const rootId = `trait_root_${branch.id}`;
    const prevId = tier === 1 ? rootId : `trait_${sid}_t${tier - 1}`;
    const columnIndex = BRANCHES.findIndex((entry) => entry.id === branch.id);
    const baseX = 160 + (columnIndex * 300);
    const baseY = 140 + (rowIndex * 170);
    const offset = (tier - 1) * 64;

    const statsBonus = {};
    const sideStats = {};
    const statNamePool = ["행운", "인지력", "수복력", "항마력", "지구력", "민첩성"];
    const sidePick = statNamePool[stringHash(statName + tier) % statNamePool.length];
    if (tier === 1) {
        statsBonus[statName] = 2;
    } else if (tier === 2) {
        statsBonus[statName] = 3;
        sideStats[sidePick] = 1;
    } else {
        statsBonus[statName] = 5;
        sideStats[sidePick] = 2;
    }

    const derivedBase = BRANCH_DERIVED[branch.id] || {};
    const derivedBonus = {};
    if (tier >= 2) {
        Object.entries(derivedBase).forEach(([key, value]) => {
            derivedBonus[key] = Number((value * (tier === 2 ? 1 : 1.8)).toFixed(5));
        });
    }

    return nodeFactory({
        id: `trait_${sid}_t${tier}`,
        name: `${statName} 회로 ${tier}`,
        desc: `${statName} 계열 특성을 강화합니다.`,
        branch: branch.id,
        x: baseX + offset - 64,
        y: baseY + (tier - 1) * 34,
        tier,
        cost: tier === 1 ? 1 : (tier === 2 ? 2 : 3),
        costStep: tier === 1 ? 1 : 0,
        maxRank: tier === 1 ? 3 : (tier === 2 ? 2 : 1),
        requires: [{ id: prevId, rank: 1 }],
        unlockLevel: tier === 1 ? 1 : (tier === 2 ? 4 : 8),
        grants: {
            stats: { ...statsBonus, ...sideStats },
            derived: derivedBonus
        }
    });
}

function createSynergyNode(index, a, b, aBranch, bBranch, x, y) {
    const aId = statId(a);
    const bId = statId(b);
    const synergyHash = stringHash(`${a}-${b}-${index}`);
    const baseDerived = {
        critChance: 0.004 + ((synergyHash % 4) * 0.0006),
        evasion: 0.004 + ((synergyHash % 3) * 0.0007),
        expGainRate: 0.005 + ((synergyHash % 2) * 0.002)
    };
    if (aBranch === "soul" || bBranch === "soul") baseDerived.essenceDropRate = 0.008;
    if (aBranch === "element" || bBranch === "element") baseDerived.numberDropRate = 0.004;
    if (aBranch === "endurance" || bBranch === "endurance") baseDerived.maxHpRate = 0.01;

    const aBonus = 3 + (synergyHash % 2);
    const bBonus = 3 + ((synergyHash >> 1) % 2);

    return nodeFactory({
        id: `trait_synergy_${index}_${aId}_${bId}`,
        name: `${a} × ${b}`,
        desc: `두 특성을 공명시켜 복합 보너스를 얻습니다.`,
        branch: "synergy",
        x,
        y,
        tier: 4,
        cost: 3,
        costStep: 1,
        maxRank: 2,
        requires: [
            { id: `trait_${aId}_t2`, rank: 1 },
            { id: `trait_${bId}_t2`, rank: 1 }
        ],
        unlockLevel: 10,
        grants: {
            stats: {
                [a]: aBonus,
                [b]: bBonus
            },
            derived: baseDerived
        }
    });
}

function pickSynergyPairs(statNames, statBranchMap, targetCount) {
    if (!Array.isArray(statNames) || statNames.length < 2 || targetCount <= 0) return [];

    const pairList = [];
    const seen = new Set();
    const statCount = statNames.length;
    const maxAttempts = Math.max(targetCount * 35, 1200);

    for (let attempt = 0; attempt < maxAttempts && pairList.length < targetCount; attempt++) {
        const aIndex = attempt % statCount;
        const a = statNames[aIndex];
        const hash = stringHash(`${attempt}-${a}-${statCount}`);
        const bIndex = (aIndex + 1 + (hash % Math.max(1, statCount - 1))) % statCount;
        const b = statNames[bIndex];
        if (!a || !b || a === b) continue;

        const key = [a, b].sort().join("|");
        if (seen.has(key)) continue;

        const sameBranch = statBranchMap[a] === statBranchMap[b];
        if (sameBranch && (hash % 100) < 42) continue;

        seen.add(key);
        pairList.push({
            key,
            a,
            b,
            aBranch: statBranchMap[a],
            bBranch: statBranchMap[b]
        });
    }

    return pairList;
}

const BRANCH_KEYSTONE_DERIVED = {
    body: { critChance: 0.008, maxHpRate: 0.02, maxStaminaRate: 0.015 },
    endurance: { maxHpRate: 0.028, maxStaminaRate: 0.03, hpRegenBonus: 0.01 },
    mind: { controlPower: 0.02, debuffResist: 0.024, expGainRate: 0.01 },
    soul: { maxMpRate: 0.03, essenceDropRate: 0.02, numberDropRate: 0.008 },
    sense: { evasion: 0.012, critChance: 0.009, itemDropRate: 0.02 },
    element: { itemDropRate: 0.015, numberDropRate: 0.018, maxMpRate: 0.014 }
};

function createKeystoneNode(branch, index, statA, statB, x, y) {
    const aId = statId(statA);
    const bId = statId(statB);
    const boost = 4 + (stringHash(`${branch.id}-${statA}-${statB}-${index}`) % 3);
    return nodeFactory({
        id: `trait_keystone_${branch.id}_${index}_${aId}_${bId}`,
        name: `${branch.label} 핵심 ${index + 1}`,
        desc: `${statA} / ${statB}를 결속해 상위 회로를 개방합니다.`,
        branch: branch.id,
        x,
        y,
        tier: 5,
        cost: 4,
        costStep: 1,
        maxRank: 1,
        requires: [
            { id: `trait_${aId}_t3`, rank: 1 },
            { id: `trait_${bId}_t3`, rank: 1 }
        ],
        unlockLevel: 14,
        grants: {
            stats: {
                [statA]: boost,
                [statB]: boost
            },
            derived: { ...(BRANCH_KEYSTONE_DERIVED[branch.id] || {}) }
        }
    });
}

function createParagonNode(index, leftBranch, rightBranch, leftKeystoneId, rightKeystoneId, x, y) {
    const derived = {
        critChance: 0.008,
        evasion: 0.008,
        expGainRate: 0.01,
        itemDropRate: 0.012
    };
    if (leftBranch.id === "soul" || rightBranch.id === "soul") derived.essenceDropRate = 0.02;
    if (leftBranch.id === "element" || rightBranch.id === "element") derived.numberDropRate = 0.02;
    if (leftBranch.id === "endurance" || rightBranch.id === "endurance") derived.maxHpRate = 0.02;

    return nodeFactory({
        id: `trait_paragon_${index}_${leftBranch.id}_${rightBranch.id}`,
        name: `${leftBranch.label} + ${rightBranch.label}`,
        desc: `두 핵심 회로를 융합한 특화 노드.`,
        branch: "synergy",
        x,
        y,
        tier: 6,
        cost: 5,
        costStep: 2,
        maxRank: 2,
        requires: [
            { id: leftKeystoneId, rank: 1 },
            { id: rightKeystoneId, rank: 1 }
        ],
        unlockLevel: 20,
        grants: {
            stats: {},
            derived
        }
    });
}

function createMasteryNode(index, config, requires, x, y) {
    return nodeFactory({
        id: `trait_mastery_${index}_${statId(config.name)}`,
        name: config.name,
        desc: config.desc,
        branch: "mastery",
        x,
        y,
        tier: 7,
        cost: 7,
        costStep: 0,
        maxRank: 1,
        requires: requires.map((id) => ({ id, rank: 1 })),
        unlockLevel: 24,
        grants: {
            stats: { ...(config.stats || {}) },
            derived: { ...(config.derived || {}) }
        }
    });
}

export function buildTraitGraph(statsList = []) {
    const statNames = statsList
        .map((entry) => String(entry?.name || "").trim())
        .filter((name) => name.length > 0);

    const nodes = [];
    const edges = [];
    const nodesById = {};
    const branchBuckets = {};

    BRANCHES.forEach((branch, index) => {
        branchBuckets[branch.id] = [];
        const rootNode = nodeFactory({
            id: `trait_root_${branch.id}`,
            name: branch.label,
            desc: branch.hint,
            branch: branch.id,
            x: 160 + (index * 300),
            y: 42,
            tier: 0,
            cost: 0,
            maxRank: 1,
            requires: [],
            unlockLevel: 1,
            grants: { stats: {}, derived: {} },
            autoUnlock: true
        });
        nodes.push(rootNode);
        nodesById[rootNode.id] = rootNode;
    });

    statNames.forEach((statName) => {
        const branch = resolveBranch(statName);
        branchBuckets[branch.id].push(statName);
    });

    Object.entries(branchBuckets).forEach(([branchId, names]) => {
        const branch = BRANCHES.find((entry) => entry.id === branchId);
        names.forEach((statName, rowIndex) => {
            for (let tier = 1; tier <= 3; tier++) {
                const node = createTierNode(branch, statName, tier, rowIndex);
                nodes.push(node);
                nodesById[node.id] = node;
            }
        });
    });

    const statBranchMap = {};
    statNames.forEach((name) => { statBranchMap[name] = resolveBranch(name).id; });
    const statCount = statNames.length;
    const maxSynergy = statCount < 2 ? 0 : Math.min(420, Math.max(140, statCount * 9));
    const synergyPairs = pickSynergyPairs(statNames, statBranchMap, maxSynergy);

    const topTierBottom = Math.max(0, ...nodes.map((node) => node.y));
    const synergyStartY = 240 + topTierBottom;
    const synergyColumns = Math.max(8, Math.min(16, Math.ceil(Math.sqrt(Math.max(1, synergyPairs.length)))));
    synergyPairs.forEach((pair, index) => {
        const col = index % synergyColumns;
        const row = Math.floor(index / synergyColumns);
        const x = 100 + (col * 150);
        const y = synergyStartY + (row * 104);
        const node = createSynergyNode(index + 1, pair.a, pair.b, pair.aBranch, pair.bBranch, x, y);
        nodes.push(node);
        nodesById[node.id] = node;
    });

    const keystoneByBranch = {};
    const synergyBottom = synergyPairs.length > 0
        ? Math.max(...nodes.filter((node) => node.tier >= 4).map((node) => node.y))
        : topTierBottom;
    const keystoneStartY = synergyBottom + 190;

    BRANCHES.forEach((branch, branchIndex) => {
        const list = (branchBuckets[branch.id] || []).slice(0, 10);
        if (list.length < 2) {
            keystoneByBranch[branch.id] = [];
            return;
        }
        const ids = [];
        const pairCount = Math.min(4, Math.floor(list.length / 2));
        for (let i = 0; i < pairCount; i++) {
            const a = list[(i * 2) % list.length];
            const b = list[(i * 2 + 1) % list.length];
            const x = 140 + (branchIndex * 300) + ((i % 2) * 130) - 60;
            const y = keystoneStartY + (Math.floor(i / 2) * 118);
            const node = createKeystoneNode(branch, i, a, b, x, y);
            nodes.push(node);
            nodesById[node.id] = node;
            ids.push(node.id);
        }
        keystoneByBranch[branch.id] = ids;
    });

    const paragonStartY = keystoneStartY + 300;
    const paragonPairs = [];
    const paragonNodeIds = [];
    for (let i = 0; i < BRANCHES.length; i++) {
        for (let j = i + 1; j < BRANCHES.length; j++) {
            const left = BRANCHES[i];
            const right = BRANCHES[j];
            if (!(keystoneByBranch[left.id]?.length > 0) || !(keystoneByBranch[right.id]?.length > 0)) continue;
            paragonPairs.push({ left, right });
        }
    }
    paragonPairs.slice(0, 15).forEach((pair, index) => {
        const col = index % 5;
        const row = Math.floor(index / 5);
        const x = 160 + (col * 270);
        const y = paragonStartY + (row * 126);
        const leftKey = keystoneByBranch[pair.left.id][index % keystoneByBranch[pair.left.id].length];
        const rightKey = keystoneByBranch[pair.right.id][index % keystoneByBranch[pair.right.id].length];
        const node = createParagonNode(index + 1, pair.left, pair.right, leftKey, rightKey, x, y);
        nodes.push(node);
        nodesById[node.id] = node;
        paragonNodeIds.push(node.id);
    });

    const masteryTemplates = [
        {
            name: "불멸의 전열",
            desc: "생존과 전투 지속력을 극한으로 끌어올립니다.",
            stats: { "지구력": 8, "근력": 6, "물리 내성": 5 },
            derived: { maxHpRate: 0.04, maxStaminaRate: 0.04, debuffResist: 0.015 }
        },
        {
            name: "차원 추적 연산",
            desc: "균열/드랍 탐색 효율을 극단적으로 강화합니다.",
            stats: { 인지력: 8, 시각: 6, 행운: 5 },
            derived: { essenceDropRate: 0.03, itemDropRate: 0.03, numberDropRate: 0.018 }
        },
        {
            name: "정밀 살해 회로",
            desc: "치명과 회피의 상한을 동시에 밀어붙입니다.",
            stats: { 민첩성: 7, 유연성: 7, 인지력: 4 },
            derived: { critChance: 0.018, evasion: 0.018, expGainRate: 0.012 }
        },
        {
            name: "광역 공명 증폭",
            desc: "영혼/속성 회로를 결합해 광역 적응력을 확보합니다.",
            stats: { 영혼력: 8, 정신력: 6, 항마력: 6 },
            derived: { maxMpRate: 0.045, controlPower: 0.02, hpRegenBonus: 0.01 }
        },
        {
            name: "심연 항해자",
            desc: "고층/균열 탐험에서 안정성을 제공하는 특화 회로.",
            stats: { 후각: 4, 청각: 4, 육감: 7, 시야: 7 },
            derived: { itemDropRate: 0.02, debuffResist: 0.02, controlPower: 0.01 }
        },
        {
            name: "수복 지휘 연쇄",
            desc: "탐험 중 회복과 장기전을 동시에 지원합니다.",
            stats: { "자연 재생력": 8, "수복력": 8, "인내심": 5 },
            derived: { hpRegenBonus: 0.02, maxHpRate: 0.025, maxMpRate: 0.02 }
        }
    ];

    const masteryStartY = paragonStartY + 240;
    masteryTemplates.forEach((config, index) => {
        if (paragonNodeIds.length < 2) return;
        const reqA = paragonNodeIds[index % paragonNodeIds.length];
        const reqB = paragonNodeIds[(index * 3 + 2) % paragonNodeIds.length];
        if (!reqA || !reqB || reqA === reqB) return;

        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 280 + (col * 440);
        const y = masteryStartY + (row * 130);
        const node = createMasteryNode(index + 1, config, [reqA, reqB], x, y);
        nodes.push(node);
        nodesById[node.id] = node;
    });

    nodes.forEach((node) => {
        (node.requires || []).forEach((req) => {
            edges.push({ from: req.id, to: node.id });
        });
    });

    const width = Math.max(1800, ...nodes.map((node) => node.x + 180));
    const height = Math.max(980, ...nodes.map((node) => node.y + 120));

    return {
        nodes,
        nodesById,
        edges,
        width,
        height,
        branchLabels: BRANCHES.map((entry) => ({ id: entry.id, label: entry.label, hint: entry.hint }))
    };
}

export function evaluateTraitBonuses(graph, ranks = {}) {
    const result = {
        stats: {},
        derived: {
            critChance: 0,
            evasion: 0,
            expGainRate: 0,
            essenceDropRate: 0,
            itemDropRate: 0,
            numberDropRate: 0,
            maxHpRate: 0,
            maxMpRate: 0,
            maxStaminaRate: 0,
            hpRegenBonus: 0,
            debuffResist: 0,
            controlPower: 0
        }
    };

    (graph?.nodes || []).forEach((node) => {
        const rank = Math.max(0, Number(ranks[node.id] || 0));
        if (rank <= 0) return;
        addBonus(result.stats, node.grants?.stats, rank);
        addBonus(result.derived, node.grants?.derived, rank);
    });

    return result;
}
