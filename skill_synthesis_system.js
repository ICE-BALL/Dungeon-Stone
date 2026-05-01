function stringHash(value) {
    const text = String(value || "");
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function safeId(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w\uac00-\ud7a3]/g, "_");
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
        grants: grants || { component: {}, derived: {} },
        autoUnlock
    };
}

function pushNode(list, map, node) {
    if (!node || !node.id) return;
    list.push(node);
    map[node.id] = node;
}

function createRootNode(branchId, label, x) {
    return nodeFactory({
        id: `skill_root_${branchId}`,
        name: `${label} 기점`,
        desc: `${label} 계열의 기본 회로를 활성화합니다.`,
        branch: branchId,
        x,
        y: 112,
        tier: 0,
        cost: 0,
        maxRank: 1,
        autoUnlock: true,
        grants: {
            component: { branch: branchId },
            derived: {}
        }
    });
}

function addEdge(edges, from, to) {
    if (!from || !to) return;
    edges.push({ from, to });
}

function buildDynamicPrototypeNodes(spellPool, roots, xBase, yBase) {
    const nodes = [];
    const branchCycle = ["core", "element", "behavior", "utility", "sigil"];
    const uniqueNames = [];
    const seen = new Set();
    (Array.isArray(spellPool) ? spellPool : []).forEach((name) => {
        const cleaned = String(name || "").trim();
        if (!cleaned || seen.has(cleaned)) return;
        seen.add(cleaned);
        uniqueNames.push(cleaned);
    });

    const picks = uniqueNames.slice(0, 8);
    picks.forEach((name, index) => {
        const hash = stringHash(`${name}:${index}`);
        const branch = branchCycle[index % branchCycle.length];
        const rootId = `skill_root_${branch}`;
        const x = xBase + (index * 170);
        const y = yBase + ((index % 2) * 72);
        const stat = index % 2 === 0 ? "skillPower" : "controlRate";
        const control = 0.01 + ((hash % 4) * 0.01);
        const cooldownRate = -0.02 - ((hash % 3) * 0.01);
        const costRate = -0.02 - (((hash >> 1) % 3) * 0.01);
        nodes.push(nodeFactory({
            id: `skill_proto_${index}_${safeId(name).slice(0, 18)}`,
            name: `${name} 도식`,
            desc: "기록된 주문 패턴을 회로에 이식합니다.",
            branch,
            x,
            y,
            tier: 4,
            cost: 3,
            costStep: 1,
            maxRank: 2,
            requires: [{ id: rootId, rank: 1 }],
            unlockLevel: 12,
            grants: {
                component: {
                    powerRate: 0.02 + ((hash % 5) * 0.01),
                    controlChance: control,
                    cooldownRate
                },
                derived: {
                    [stat]: 0.01 + ((hash % 3) * 0.01),
                    costRate
                }
            }
        }));
    });

    if (nodes.length === 0) {
        nodes.push(nodeFactory({
            id: "skill_proto_archivist",
            name: "기록 보정 도식",
            desc: "기록 기반 보정 회로를 활성화합니다.",
            branch: "utility",
            x: xBase,
            y: yBase,
            tier: 4,
            cost: 3,
            costStep: 1,
            maxRank: 2,
            requires: [{ id: roots.utility, rank: 1 }],
            unlockLevel: 12,
            grants: {
                component: { powerRate: 0.03, controlChance: 0.03, cooldownRate: -0.03 },
                derived: { costRate: 0.03, skillPower: 0.02 }
            }
        }));
    }

    return nodes;
}

export function buildSkillGraph(spellPool = []) {
    const nodes = [];
    const nodesById = {};
    const edges = [];

    const roots = {
        core: "skill_root_core",
        element: "skill_root_element",
        behavior: "skill_root_behavior",
        utility: "skill_root_utility",
        sigil: "skill_root_sigil"
    };

    const rootDefs = [
        { id: "core", label: "핵심 형식", x: 180 },
        { id: "element", label: "속성 각인", x: 520 },
        { id: "behavior", label: "행동 변조", x: 860 },
        { id: "utility", label: "지원 회로", x: 1200 },
        { id: "sigil", label: "인장 공명", x: 1540 }
    ];

    rootDefs.forEach((entry) => {
        const rootNode = createRootNode(entry.id, entry.label, entry.x);
        pushNode(nodes, nodesById, rootNode);
    });

    const branchLabels = rootDefs.map((entry) => ({
        id: entry.id,
        label: entry.label,
        x: entry.x,
        y: 70
    }));

    const coreNodes = [
        nodeFactory({
            id: "skill_core_strike",
            name: "단타 프레임",
            desc: "단일 대상에 강한 기본 타격 형식을 엽니다.",
            branch: "core",
            x: 150,
            y: 250,
            tier: 1,
            cost: 1,
            costStep: 1,
            maxRank: 3,
            requires: [{ id: roots.core, rank: 1 }],
            grants: {
                component: { shape: "strike", baseDamage: 8, baseCost: 3, baseCooldown: -0.2, targets: 0 },
                derived: { skillPower: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_core_beam",
            name: "관통 빔 프레임",
            desc: "관통형 스킬의 기본 프레임을 엽니다.",
            branch: "core",
            x: 278,
            y: 250,
            tier: 1,
            cost: 1,
            costStep: 1,
            maxRank: 3,
            requires: [{ id: roots.core, rank: 1 }],
            grants: {
                component: { shape: "beam", baseDamage: 6, baseCost: 4, baseCooldown: 0.1, targets: 0 },
                derived: { controlRate: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_core_burst",
            name: "폭발 프레임",
            desc: "광역 폭발형 스킬의 기본 프레임을 엽니다.",
            branch: "core",
            x: 406,
            y: 250,
            tier: 1,
            cost: 1,
            costStep: 1,
            maxRank: 3,
            requires: [{ id: roots.core, rank: 1 }],
            grants: {
                component: { shape: "burst", baseDamage: 5, baseCost: 5, baseCooldown: 0.2, targets: 1 },
                derived: { skillPower: 0.005 }
            }
        }),
        nodeFactory({
            id: "skill_core_field",
            name: "장막 프레임",
            desc: "지속 영역형 스킬의 기반을 제공합니다.",
            branch: "core",
            x: 214,
            y: 394,
            tier: 2,
            cost: 2,
            costStep: 1,
            maxRank: 2,
            requires: [{ id: "skill_core_burst", rank: 1 }],
            unlockLevel: 4,
            grants: {
                component: { shape: "field", baseDamage: 7, baseCost: 5, baseCooldown: 0.2, targets: 1 },
                derived: { controlRate: 0.015 }
            }
        }),
        nodeFactory({
            id: "skill_core_lance",
            name: "창격 프레임",
            desc: "고위력 단일 관통 계열을 강화합니다.",
            branch: "core",
            x: 350,
            y: 394,
            tier: 2,
            cost: 2,
            costStep: 1,
            maxRank: 2,
            requires: [{ id: "skill_core_strike", rank: 2 }],
            unlockLevel: 5,
            grants: {
                component: { shape: "strike", baseDamage: 11, baseCost: 4, baseCooldown: 0.2 },
                derived: { skillPower: 0.02 }
            }
        }),
        nodeFactory({
            id: "skill_core_nova",
            name: "노바 프레임",
            desc: "고밀도 범위 폭발로 확장합니다.",
            branch: "core",
            x: 280,
            y: 540,
            tier: 3,
            cost: 3,
            costStep: 1,
            maxRank: 1,
            requires: [{ id: "skill_core_field", rank: 1 }, { id: "skill_core_beam", rank: 1 }],
            unlockLevel: 9,
            grants: {
                component: { shape: "burst", baseDamage: 18, baseCost: 8, baseCooldown: 1, targets: 2 },
                derived: { skillPower: 0.04, controlRate: 0.02 }
            }
        })
    ];

    const elementNodes = [
        nodeFactory({
            id: "skill_element_fire",
            name: "화염 각인",
            desc: "화염 계열 제어 확률을 추가합니다.",
            branch: "element",
            x: 492,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.element, rank: 1 }],
            grants: {
                component: { element: "fire", controlChance: 0.03, powerRate: 0.02, costRate: 0.01 },
                derived: { skillPower: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_element_frost",
            name: "냉기 각인",
            desc: "둔화/빙결 계열 제어 보정을 강화합니다.",
            branch: "element",
            x: 620,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.element, rank: 1 }],
            grants: {
                component: { element: "frost", controlChance: 0.04, powerRate: 0.01, cooldownRate: 0.01 },
                derived: { controlRate: 0.01, costRate: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_element_storm",
            name: "폭풍 각인",
            desc: "연쇄/관통 계열 보정을 제공합니다.",
            branch: "element",
            x: 748,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.element, rank: 1 }],
            grants: {
                component: { element: "storm", controlChance: 0.02, powerRate: 0.03, cooldownRate: 0.02 },
                derived: { critRate: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_element_earth",
            name: "대지 각인",
            desc: "안정성과 보호 성능을 보강합니다.",
            branch: "element",
            x: 556,
            y: 394,
            tier: 2,
            cost: 2,
            maxRank: 2,
            costStep: 1,
            unlockLevel: 4,
            requires: [{ id: "skill_element_frost", rank: 1 }],
            grants: {
                component: { element: "earth", shieldRate: 0.03, powerRate: 0.02, costRate: 0.01 },
                derived: { controlRate: 0.01, costRate: 0.02 }
            }
        }),
        nodeFactory({
            id: "skill_element_void",
            name: "공허 각인",
            desc: "강한 제어/흡수 변조를 가능하게 합니다.",
            branch: "element",
            x: 684,
            y: 394,
            tier: 2,
            cost: 2,
            maxRank: 2,
            costStep: 1,
            unlockLevel: 5,
            requires: [{ id: "skill_element_storm", rank: 1 }],
            grants: {
                component: { element: "void", controlChance: 0.06, lifeSteal: 0.02, costRate: 0.02 },
                derived: { skillPower: 0.02, controlRate: 0.02 }
            }
        }),
        nodeFactory({
            id: "skill_element_harmonic",
            name: "원소 공명핵",
            desc: "복수 원소를 하나의 형식으로 공명시킵니다.",
            branch: "element",
            x: 620,
            y: 540,
            tier: 3,
            cost: 3,
            maxRank: 1,
            unlockLevel: 9,
            requires: [{ id: "skill_element_fire", rank: 2 }, { id: "skill_element_void", rank: 1 }],
            grants: {
                component: { powerRate: 0.08, controlChance: 0.04, costRate: 0.01, cooldownRate: 0.02 },
                derived: { skillPower: 0.04, controlRate: 0.03 }
            }
        })
    ];

    const behaviorNodes = [
        nodeFactory({
            id: "skill_behavior_precision",
            name: "정밀 추격",
            desc: "치명 보정과 명중 안정성을 강화합니다.",
            branch: "behavior",
            x: 832,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.behavior, rank: 1 }],
            grants: {
                component: { critRate: 0.03, powerRate: 0.01 },
                derived: { critRate: 0.01, skillPower: 0.005 }
            }
        }),
        nodeFactory({
            id: "skill_behavior_chain",
            name: "연쇄 반응",
            desc: "추가 대상과 반응 피해를 확장합니다.",
            branch: "behavior",
            x: 960,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.behavior, rank: 1 }],
            grants: {
                component: { targets: 1, powerRate: 0.015, cooldownRate: 0.02 },
                derived: { skillPower: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_behavior_control",
            name: "제압 파형",
            desc: "상태이상 유발 확률과 지속을 향상합니다.",
            branch: "behavior",
            x: 1088,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.behavior, rank: 1 }],
            grants: {
                component: { controlChance: 0.04, powerRate: 0.01 },
                derived: { controlRate: 0.02 }
            }
        }),
        nodeFactory({
            id: "skill_behavior_siphon",
            name: "흡수 회귀",
            desc: "피해 일부를 생명력/마나로 환원합니다.",
            branch: "behavior",
            x: 900,
            y: 394,
            tier: 2,
            cost: 2,
            maxRank: 2,
            costStep: 1,
            unlockLevel: 5,
            requires: [{ id: "skill_behavior_control", rank: 1 }],
            grants: {
                component: { lifeSteal: 0.03, shieldRate: 0.02, costRate: 0.01 },
                derived: { skillPower: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_behavior_overclock",
            name: "과부하 점화",
            desc: "위력은 크게 상승하지만 소모가 증가합니다.",
            branch: "behavior",
            x: 1030,
            y: 394,
            tier: 2,
            cost: 2,
            maxRank: 2,
            costStep: 1,
            unlockLevel: 6,
            requires: [{ id: "skill_behavior_precision", rank: 1 }],
            grants: {
                component: { powerRate: 0.1, critRate: 0.03, costRate: 0.05 },
                derived: { skillPower: 0.03, costRate: -0.01 }
            }
        }),
        nodeFactory({
            id: "skill_behavior_flux",
            name: "플럭스 폭주",
            desc: "연쇄·제압·흡수의 복합 반응을 동시 처리합니다.",
            branch: "behavior",
            x: 964,
            y: 540,
            tier: 3,
            cost: 3,
            maxRank: 1,
            unlockLevel: 10,
            requires: [{ id: "skill_behavior_chain", rank: 2 }, { id: "skill_behavior_siphon", rank: 1 }],
            grants: {
                component: { powerRate: 0.1, controlChance: 0.07, lifeSteal: 0.04, targets: 1, costRate: 0.02 },
                derived: { skillPower: 0.05, controlRate: 0.03, critRate: 0.02 }
            }
        })
    ];

    const utilityNodes = [
        nodeFactory({
            id: "skill_utility_efficiency",
            name: "연비 최적화",
            desc: "MP 소모를 줄입니다.",
            branch: "utility",
            x: 1172,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.utility, rank: 1 }],
            grants: {
                component: { costRate: -0.05 },
                derived: { costRate: 0.03 }
            }
        }),
        nodeFactory({
            id: "skill_utility_quickcast",
            name: "고속 시전",
            desc: "재사용 대기시간을 줄입니다.",
            branch: "utility",
            x: 1300,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.utility, rank: 1 }],
            grants: {
                component: { cooldownRate: -0.05 },
                derived: { cooldownRate: 0.03 }
            }
        }),
        nodeFactory({
            id: "skill_utility_targeting",
            name: "다중 표적화",
            desc: "타겟 수를 추가로 확보합니다.",
            branch: "utility",
            x: 1428,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.utility, rank: 1 }],
            grants: {
                component: { targets: 1, costRate: 0.01 },
                derived: { controlRate: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_utility_guard",
            name: "수호 편향",
            desc: "피해 일부를 보호막/회복으로 변환합니다.",
            branch: "utility",
            x: 1236,
            y: 394,
            tier: 2,
            cost: 2,
            maxRank: 2,
            costStep: 1,
            unlockLevel: 4,
            requires: [{ id: "skill_utility_targeting", rank: 1 }],
            grants: {
                component: { shieldRate: 0.05, lifeSteal: 0.01, costRate: 0.02 },
                derived: { controlRate: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_utility_focus",
            name: "집중 채널",
            desc: "단일 기술의 효율을 극대화합니다.",
            branch: "utility",
            x: 1364,
            y: 394,
            tier: 2,
            cost: 2,
            maxRank: 2,
            costStep: 1,
            unlockLevel: 6,
            requires: [{ id: "skill_utility_efficiency", rank: 2 }],
            grants: {
                component: { powerRate: 0.05, cooldownRate: -0.03 },
                derived: { skillPower: 0.02, cooldownRate: 0.02 }
            }
        }),
        nodeFactory({
            id: "skill_utility_mastery",
            name: "운용 마스터리",
            desc: "소모/재사용/출력을 종합적으로 최적화합니다.",
            branch: "utility",
            x: 1300,
            y: 540,
            tier: 3,
            cost: 3,
            maxRank: 1,
            unlockLevel: 10,
            requires: [{ id: "skill_utility_quickcast", rank: 2 }, { id: "skill_utility_focus", rank: 1 }],
            grants: {
                component: { powerRate: 0.06, cooldownRate: -0.08, costRate: -0.08, targets: 1 },
                derived: { skillPower: 0.03, cooldownRate: 0.04, costRate: 0.05 }
            }
        })
    ];

    const sigilNodes = [
        nodeFactory({
            id: "skill_sigil_sun",
            name: "태양 인장",
            desc: "폭발적인 단기 화력을 강화합니다.",
            branch: "sigil",
            x: 1512,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.sigil, rank: 1 }],
            grants: {
                component: { powerRate: 0.04, critRate: 0.02, costRate: 0.01 },
                derived: { skillPower: 0.02, critRate: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_sigil_moon",
            name: "월광 인장",
            desc: "안정적인 재사용/제어를 보정합니다.",
            branch: "sigil",
            x: 1640,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.sigil, rank: 1 }],
            grants: {
                component: { controlChance: 0.03, cooldownRate: -0.03 },
                derived: { controlRate: 0.02, cooldownRate: 0.02 }
            }
        }),
        nodeFactory({
            id: "skill_sigil_dragon",
            name: "용맥 인장",
            desc: "고비용 고출력 운용을 지원합니다.",
            branch: "sigil",
            x: 1768,
            y: 250,
            tier: 1,
            cost: 1,
            maxRank: 3,
            costStep: 1,
            requires: [{ id: roots.sigil, rank: 1 }],
            grants: {
                component: { powerRate: 0.06, costRate: 0.03, controlChance: 0.02 },
                derived: { skillPower: 0.025 }
            }
        }),
        nodeFactory({
            id: "skill_sigil_twilight",
            name: "황혼 인장",
            desc: "생존형 흡수/보호막 반응을 엮습니다.",
            branch: "sigil",
            x: 1576,
            y: 394,
            tier: 2,
            cost: 2,
            maxRank: 2,
            costStep: 1,
            unlockLevel: 5,
            requires: [{ id: "skill_sigil_moon", rank: 1 }],
            grants: {
                component: { lifeSteal: 0.03, shieldRate: 0.04, cooldownRate: -0.02 },
                derived: { controlRate: 0.01, costRate: 0.01 }
            }
        }),
        nodeFactory({
            id: "skill_sigil_starlight",
            name: "성광 인장",
            desc: "핵심 프레임과 속성 각인의 효율을 동시에 증폭합니다.",
            branch: "sigil",
            x: 1704,
            y: 394,
            tier: 2,
            cost: 2,
            maxRank: 2,
            costStep: 1,
            unlockLevel: 7,
            requires: [{ id: "skill_sigil_sun", rank: 1 }],
            grants: {
                component: { powerRate: 0.07, controlChance: 0.03, cooldownRate: -0.03 },
                derived: { skillPower: 0.03, critRate: 0.02 }
            }
        }),
        nodeFactory({
            id: "skill_sigil_apex",
            name: "극성 인장",
            desc: "모든 스킬 노드를 결속하는 상위 인장입니다.",
            branch: "sigil",
            x: 1640,
            y: 540,
            tier: 3,
            cost: 4,
            maxRank: 1,
            unlockLevel: 12,
            requires: [{ id: "skill_sigil_starlight", rank: 1 }, { id: "skill_core_nova", rank: 1 }, { id: "skill_element_harmonic", rank: 1 }],
            grants: {
                component: { powerRate: 0.12, controlChance: 0.06, cooldownRate: -0.08, costRate: -0.06, targets: 1 },
                derived: { skillPower: 0.06, controlRate: 0.04, critRate: 0.03, cooldownRate: 0.05, costRate: 0.05 }
            }
        })
    ];

    const comboNodes = [
        nodeFactory({
            id: "skill_combo_phoenix",
            name: "봉황 공명식",
            desc: "화염/고속/광역 회로를 묶어 폭발력을 증폭합니다.",
            branch: "sigil",
            x: 820,
            y: 730,
            tier: 4,
            cost: 4,
            costStep: 1,
            maxRank: 1,
            unlockLevel: 14,
            requires: [
                { id: "skill_element_fire", rank: 2 },
                { id: "skill_utility_quickcast", rank: 2 },
                { id: "skill_core_burst", rank: 2 }
            ],
            grants: {
                component: { powerRate: 0.14, controlChance: 0.05, cooldownRate: -0.05, costRate: 0.02, targets: 1 },
                derived: { skillPower: 0.07, critRate: 0.03 }
            }
        }),
        nodeFactory({
            id: "skill_combo_glacier",
            name: "빙하 공명식",
            desc: "냉기/제어/보호 반응을 결속합니다.",
            branch: "sigil",
            x: 1100,
            y: 730,
            tier: 4,
            cost: 4,
            costStep: 1,
            maxRank: 1,
            unlockLevel: 14,
            requires: [
                { id: "skill_element_frost", rank: 2 },
                { id: "skill_behavior_control", rank: 2 },
                { id: "skill_utility_guard", rank: 1 }
            ],
            grants: {
                component: { controlChance: 0.1, shieldRate: 0.08, cooldownRate: -0.04 },
                derived: { controlRate: 0.06, costRate: 0.03 }
            }
        }),
        nodeFactory({
            id: "skill_combo_voidstar",
            name: "공허성 공명식",
            desc: "공허/흡수/정밀 회로를 결합해 고난도 전투를 지원합니다.",
            branch: "sigil",
            x: 1380,
            y: 730,
            tier: 4,
            cost: 4,
            costStep: 1,
            maxRank: 1,
            unlockLevel: 15,
            requires: [
                { id: "skill_element_void", rank: 2 },
                { id: "skill_behavior_siphon", rank: 1 },
                { id: "skill_behavior_precision", rank: 2 }
            ],
            grants: {
                component: { powerRate: 0.1, lifeSteal: 0.08, critRate: 0.04, controlChance: 0.04 },
                derived: { skillPower: 0.05, critRate: 0.03, controlRate: 0.02 }
            }
        })
    ];

    const dynamicPrototypeNodes = buildDynamicPrototypeNodes(
        spellPool,
        roots,
        460,
        890
    );

    [
        ...coreNodes,
        ...elementNodes,
        ...behaviorNodes,
        ...utilityNodes,
        ...sigilNodes,
        ...comboNodes,
        ...dynamicPrototypeNodes
    ].forEach((node) => pushNode(nodes, nodesById, node));

    nodes.forEach((node) => {
        (node.requires || []).forEach((req) => addEdge(edges, req.id, node.id));
    });

    return {
        nodes,
        nodesById,
        edges,
        width: 1960,
        height: 1120,
        branchLabels
    };
}

function addNumericBonus(target, source, multiplier = 1) {
    Object.entries(source || {}).forEach(([key, value]) => {
        if (!Number.isFinite(value)) return;
        target[key] = (target[key] || 0) + (value * multiplier);
    });
}

export function evaluateSkillBonuses(graph, ranks = {}) {
    const payload = {
        derived: {},
        components: {}
    };
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];

    nodes.forEach((node) => {
        const rank = Math.max(0, Number(ranks?.[node.id] || 0));
        if (rank <= 0) return;

        addNumericBonus(payload.derived, node?.grants?.derived || {}, rank);
        const component = node?.grants?.component || {};
        Object.entries(component).forEach(([key, value]) => {
            if (Number.isFinite(value)) {
                payload.components[key] = (payload.components[key] || 0) + (Number(value) * rank);
            } else if (value !== undefined && value !== null && payload.components[key] === undefined) {
                payload.components[key] = value;
            }
        });
    });

    return payload;
}
