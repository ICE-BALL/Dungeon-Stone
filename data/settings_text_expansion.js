const SETTINGS_TEXT_CANDIDATES = [
    "겜바바 설정.txt"
];

const RIFT_TITLE_HINTS = [
    "균열",
    "핏빛성채",
    "빙하굴",
    "녹색 탄광",
    "강철의 묘",
    "총포 사막",
    "백색신전",
    "황금 유적",
    "도플갱어 숲",
    "불타는 숲",
    "빛의 틈새",
    "영혼의 요새",
    "발란티스의 묘궁",
    "서리군주의 궁전",
    "빛의 도시 칼헤움",
    "네크로폴리스",
    "왕의 둥지",
    "적룡의 심처",
    "기록보관소"
];

const ITEM_NAME_HINTS = [
    "아이템",
    "보주",
    "거울",
    "초대장",
    "포션",
    "식량",
    "키트",
    "결정체",
    "휘장",
    "방패",
    "장검",
    "가면",
    "부적",
    "마석",
    "영혼",
    "석",
    "파편",
    "보석",
    "갑옷",
    "장화",
    "활",
    "철퇴",
    "몽둥이"
];

const ITEM_CONTEXT_HINTS = [
    "아이템",
    "드롭",
    "획득",
    "얻",
    "보상",
    "사용",
    "입장",
    "상자",
    "포션",
    "넘버스"
];

const ITEM_CORE_HINTS = [
    "보주",
    "거울",
    "초대장",
    "포션",
    "식량",
    "키트",
    "결정체",
    "휘장",
    "방패",
    "장검",
    "가면",
    "부적",
    "마석",
    "파편",
    "보석",
    "갑옷",
    "장화",
    "활",
    "철퇴",
    "몽둥이",
    "영혼",
    "씨앗",
    "코어",
    "토큰",
    "뿔피리",
    "소망",
    "철창",
    "팔찌",
    "벨트",
    "반지",
    "귀걸이",
    "내갑",
    "용갑"
];

const ITEM_STOP_PATTERN = /넘버스|각종|범용성|종결|효능|리스크|확률|가치|형\s|계열|가능|중요|대표|특수|탐험가|미궁|전투|장비|재화|스톤|강화|회복|증가|감소|사용 시|획득이|드롭률|효과|잡아도|경험치|기본|올라가면|이라|이며|한다고|했다|된다|관련|나머지|주는|위한|한|되는/i;
const ITEM_SHAPE_PATTERN = /(보주|거울|초대장|포션|식량|키트|결정체|휘장|방패|장검|가면|부적|마석|파편|보석|갑옷|장화|활|철퇴|몽둥이|영혼|씨앗|코어|토큰|뿔피리|소망|철창|팔찌|벨트|반지|귀걸이|내갑|용갑|돌)$/;
const ITEM_EXACT_STOP = new Set(["코어", "마석", "영혼", "파편", "보석"]);

const MAGIC_NAME_HINTS = [
    "마법",
    "오러",
    "불꽃",
    "차원문",
    "마력",
    "광선",
    "가호",
    "정령술",
    "치유",
    "회복",
    "봉인",
    "폭풍",
    "재생",
    "가시",
    "지진",
    "낙인",
    "예언",
    "계약"
];

const SKILL_STOP_PATTERN = /편집|오류|특수 조건|시스템|로그|던전|도전자|축하하네|미지의 존재|무언가|감정|증오의|내면에|필멸자여|도전자를 감지/i;
const SKILL_STATUS_STOP_PATTERN = /공포|환각|환청|방향치|저체온증|과호흡|시한부|혼란|절망|기아|오한|원한|매혹|열광|광분|불신|통각강화|지박령|지옥불 협곡|망령의 협곡|차단|중독|출혈|치유 불가|악취|괴혈/i;
const SKILL_CONTEXT_HINTS = [
    "스킬",
    "이능",
    "마법",
    "사용",
    "시전",
    "발동",
    "패시브",
    "액티브",
    "오오라",
    "페이즈"
];
const SKILL_CORE_HINTS = [
    "차원문",
    "기우제",
    "마력지뢰",
    "강림",
    "결정화",
    "토성체",
    "제사장",
    "파멸",
    "영혼추출",
    "각인",
    "바꿔치기",
    "자가복제",
    "형태 변환",
    "용발톱",
    "휘두르기",
    "가호",
    "정령술",
    "불꽃",
    "재생",
    "광선",
    "제물",
    "소멸",
    "봉인",
    "소환",
    "복원",
    "치유",
    "포효",
    "안개",
    "비호",
    "심판",
    "부름",
    "기사도",
    "종복",
    "덫",
    "광기",
    "소멸",
    "신성 불꽃"
];
const SKILL_SHAPE_PATTERN = /(차원문|기우제|지뢰|강림|결정화|토성체|제사장|파멸|추출|각인|복제|바꿔치기|형태 변환|용발톱|휘두르기|기사도|종복|덫|광기|소멸|불꽃|가호|봉인|소환|복원|치유|포효|안개|심판|부름|난사)$/;

const ENTITY_STOP_PATTERN = /필드 효과|스포일러|던전앤스톤|던전 앤 스톤|오류/i;

const ALIAS_MONSTERS = {
    "샤벨 타이거": "샤벨타이거",
    "스켈레톤 아처": "스켈레톤 궁수",
    "라프레미믹": "라플레미믹",
    "가고일 석상": "가고일"
};

function normalizeName(value) {
    return String(value || "")
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/\([^)]*\)/g, " ")
        .replace(/[<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isValidEntityName(value, min = 2, max = 24) {
    const name = normalizeName(value);
    if (!name || name.length < min || name.length > max) return false;
    if (!/[가-힣A-Za-z]/.test(name)) return false;
    if (/[`"'!?.,:;\\/]/.test(name)) return false;
    if (ENTITY_STOP_PATTERN.test(name)) return false;
    return true;
}

function isLikelySkillName(value) {
    const name = normalizeName(value);
    if (!isValidEntityName(name, 2, 18)) return false;
    if (SKILL_STOP_PATTERN.test(name)) return false;
    if (/^\d/.test(name)) return false;
    if (/턴$/.test(name)) return false;
    return true;
}

function hasAnyKeyword(value, keywords = []) {
    const text = String(value || "");
    if (!text) return false;
    return keywords.some(keyword => text.includes(keyword));
}

function removeTrailingParticle(value) {
    return String(value || "")
        .replace(/\s+(가|이|은|는|을|를|와|과|에|의|도|로|만)$/g, "")
        .replace(/(가|이|은|는|을|를|와|과|에|의|도|로|만)$/g, "")
        .replace(/\s+(이라|라고|이며|이다)$/g, "")
        .replace(/(이라|라고|이며|이다)$/g, "")
        .replace(/^(인|또는|그리고|혹은)\s+/g, "")
        .trim();
}

function wordCount(value) {
    return String(value || "")
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean)
        .length;
}

function isLikelyItemNameStrict(value, contextLine = "") {
    const name = removeTrailingParticle(normalizeName(value));
    if (!isValidEntityName(name, 2, 20)) return false;
    if (ITEM_EXACT_STOP.has(name)) return false;
    if (ITEM_STOP_PATTERN.test(name)) return false;
    if (wordCount(name) > 3) return false;
    if (name.length > 16) return false;
    if (/아이템|스킬|마법|정수|군주|층|포탈|필드|이벤트/.test(name)) return false;
    if (!hasAnyKeyword(name, ITEM_CORE_HINTS)) return false;
    if (!ITEM_SHAPE_PATTERN.test(name)) return false;

    const context = String(contextLine || "");
    if (context && !hasAnyKeyword(context, ITEM_CONTEXT_HINTS)) return false;
    return true;
}

function isLikelySkillNameStrict(value, contextLine = "") {
    const name = removeTrailingParticle(normalizeName(value));
    if (!isLikelySkillName(name)) return false;
    if (SKILL_STATUS_STOP_PATTERN.test(name)) return false;
    if (/군주|협곡|대륙|숲|도시|요새|궁전|기록보관소|포탈|필드|미궁/.test(name)) return false;
    if (wordCount(name) > 3) return false;
    if (/했다|한다|되는|이며|이다|처럼|때문/.test(name)) return false;

    const context = String(contextLine || "");
    const hasContext = hasAnyKeyword(context, SKILL_CONTEXT_HINTS);
    const hasCore = hasAnyKeyword(name, SKILL_CORE_HINTS);
    const hasShape = SKILL_SHAPE_PATTERN.test(name);
    if (!hasCore && !hasShape) return false;
    if (!hasContext && !hasShape && name.length > 8) return false;

    return true;
}

function splitNameList(rawLine) {
    return String(rawLine || "")
        .split(/,|\s+or\s+|\s+또는\s+|\//)
        .map(token => normalizeName(token))
        .filter(token => isValidEntityName(token));
}

function toHashInt(value) {
    const text = String(value || "");
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function inferMonsterGrade(rawGrade, isBoss = false) {
    const grade = Number(rawGrade);
    if (Number.isFinite(grade) && grade >= 1 && grade <= 10) return grade;
    return isBoss ? 4 : 7;
}

function createMonsterTemplate(name, grade = 7, isBoss = false) {
    const normalizedGrade = inferMonsterGrade(grade, isBoss);
    const power = Math.max(1, 11 - normalizedGrade);
    const hash = toHashInt(name);
    const hp = 220 + (power * 185) + (hash % 140);
    const atk = 24 + (power * 9) + (hash % 8);
    const def = 14 + (power * 6) + (hash % 6);
    const magicDef = 12 + (power * 5) + (hash % 7);
    return {
        grade: normalizedGrade,
        hp,
        atk,
        def,
        magic_def: magicDef,
        essences: [name],
        autoPatched: true,
        boss: Boolean(isBoss)
    };
}

function createEssenceTemplate(name, grade = 7) {
    const hash = toHashInt(name);
    const statSeed = Math.max(1, Math.floor((11 - inferMonsterGrade(grade)) * 0.6));
    return {
        grade: inferMonsterGrade(grade),
        desc: `${name} 정수. 설정 기반 자동 보강 데이터입니다.`,
        stats: {
            "근력": statSeed + (hash % 2),
            "민첩성": statSeed,
            "지구력": statSeed + 1,
            "정신력": Math.max(0, statSeed - 1)
        },
        passive: {
            name: `${name}의 잔향`,
            desc: "미궁 환경 적응력이 상승합니다."
        },
        active: {
            name: `${name} 공명`,
            desc: "전투/탐험에서 짧은 강화 효과를 발휘합니다.",
            effect: (p, t) => {
                if (!p) return;
                const heal = 8 + (Math.floor((p.currentStats?.["지구력"] || 10) * 0.15));
                p.hp = Math.min(p.maxHp || 100, (p.hp || 1) + heal);
                if (t && typeof t.hp === "number") {
                    const dmg = 8 + Math.floor((p.currentStats?.["정신력"] || 10) * 0.25);
                    t.hp = Math.max(0, t.hp - dmg);
                    p?.cb?.logMessage?.(`[${name} 공명] ${t.name || "대상"}에게 ${dmg} 피해를 주고 ${heal} 회복했습니다.`);
                } else {
                    p?.cb?.logMessage?.(`[${name} 공명] 생명력이 ${heal} 회복되었습니다.`);
                }
            }
        },
        autoPatched: true
    };
}

function inferItemType(name) {
    if (/검|창|철퇴|몽둥이|활|클로|무기/.test(name)) return "무기";
    if (/갑옷|내갑|용갑/.test(name)) return "갑옷";
    if (/방패/.test(name)) return "부무기";
    if (/투구|관|가면/.test(name)) return "투구";
    if (/장화|신발/.test(name)) return "각반";
    if (/부적|목걸이|팔찌|휘장|토큰/.test(name)) return "기타";
    if (/포션|식량|키트|상자|보주|결정체|영혼|석|파편/.test(name)) return "소모품";
    return "기타";
}

function createItemTemplate(name) {
    const type = inferItemType(name);
    const hash = toHashInt(name);
    return {
        type,
        desc: `${name}. 설정 기반 자동 보강 아이템입니다.`,
        effect: (p) => {
            if (!p) return;
            if (/포션|치유|영혼/.test(name)) {
                const heal = 16 + (hash % 18);
                p.hp = Math.min(p.maxHp || 100, (p.hp || 1) + heal);
                p?.cb?.logMessage?.(`[${name}] 체력을 ${heal} 회복했습니다.`);
                return;
            }
            if (/식량|키트/.test(name)) {
                p.satiety = Math.min(100, (p.satiety || 0) + 22);
                p?.cb?.logMessage?.(`[${name}] 포만감을 회복했습니다.`);
                return;
            }
            if (/결정체|마석|보주|파편/.test(name)) {
                const gain = 35 + (hash % 66);
                p.magic_stones = (p.magic_stones || 0) + gain;
                p?.cb?.logMessage?.(`[${name}] 마석 +${gain}`);
                return;
            }
            p?.cb?.logMessage?.(`[${name}]을(를) 사용했습니다.`);
        },
        autoPatched: true
    };
}

function inferSpellGrade(name) {
    if (/종말|파멸|군주|초월/.test(name)) return 2;
    if (/강림|폭풍|지진|광선|결정화/.test(name)) return 4;
    if (/가호|재생|복원|회복|치유/.test(name)) return 5;
    return 6;
}

function inferSpellCost(name) {
    if (/종말|파멸|초월/.test(name)) return 40;
    if (/강림|폭풍|지진|광선/.test(name)) return 28;
    if (/가호|재생|복원|회복|치유/.test(name)) return 18;
    return 16;
}

function createSpellTemplate(name) {
    return {
        grade: inferSpellGrade(name),
        mp_cost: inferSpellCost(name),
        desc: `${name} 기술. 설정 텍스트 기반 자동 보강 스킬입니다.`,
        effect: (p, t) => {
            if (!p) return;
            if (/가호|회복|복원|재생|치유/.test(name)) {
                const target = t || p;
                const heal = 22 + Math.floor((p.currentStats?.["정신력"] || 10) * 0.9);
                target.hp = Math.min(target.maxHp || 100, (target.hp || 1) + heal);
                p?.cb?.logMessage?.(`[${name}] ${target === p ? "자신" : (target.name || "대상")}의 체력을 ${heal} 회복했습니다.`);
                return;
            }
            if (/수호|보호|방패|가호/.test(name)) {
                p?.removeAllDebuffs?.();
                p?.cb?.logMessage?.(`[${name}] 방호막을 전개해 상태이상을 정화했습니다.`);
                return;
            }
            if (t && typeof t.hp === "number") {
                const dmg = 12 + Math.floor((p.currentStats?.["정신력"] || 10) * 0.85);
                t.hp = Math.max(0, t.hp - dmg);
                p?.cb?.logMessage?.(`[${name}] ${t.name || "대상"}에게 ${dmg} 피해를 입혔습니다.`);
            } else {
                p?.cb?.logMessage?.(`[${name}] 기술을 시전했습니다.`);
            }
        },
        autoPatched: true
    };
}

function addLayerLordToken(container, token, layer) {
    const normalized = normalizeName(token)
        .replace(/\s+(가|이|은|는|을|를|와|과|에|의|도|로|만)$/g, "")
        .replace(/(가|이|은|는|을|를|와|과|에|의|도|로|만)$/g, "");
    if (!isLikelyLayerLordName(normalized)) return;
    const lordLayer = Number.isFinite(layer) && layer > 0 ? layer : null;
    if (!container.has(normalized)) container.set(normalized, lordLayer);
}

function isLikelyLayerLordName(name) {
    if (!isValidEntityName(name, 2, 18)) return false;
    if (!name.includes("군주")) return false;
    if (/계층군주|층군주|각층|모든 군주|다른 계층군주|상층|군주들|토벌|처치|처럼|시작|밝혀|설명/i.test(name)) return false;
    if (!/(공포|심연|후회|혼돈|천공|고요|눈물|어둠|희망|기록|설원|악몽|파괴|서리)/.test(name)) return false;
    if (!/의\s*군주|군주$/.test(name)) return false;
    if (name.split(/\s+/).length > 3) return false;
    return true;
}

function buildCompendiumFromText(rawText) {
    const text = String(rawText || "");
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

    const monsterGrades = new Map();
    const bosses = new Set();
    const items = new Set();
    const skills = new Set();
    const rifts = [];
    const layerLords = new Map();
    const eventLines = [];

    let currentLayer = null;

    for (const line of lines) {
        const floorHeading = line.match(/^\d+(?:\.\d+)*\.\s*(\d+)\s*층/);
        if (floorHeading) currentLayer = Number(floorHeading[1]);

        const headingMatch = line.match(/^\d+(?:\.\d+)+\.\s*([^\[\r\n]+)\[편집\]/);
        if (headingMatch) {
            const title = normalizeName(headingMatch[1]);
            if (title && RIFT_TITLE_HINTS.some(hint => title.includes(hint))) {
                rifts.push({ name: title, layer: currentLayer });
            }
        }

        const gradeMatch = line.match(/^(\d+)\s*등급\s*:\s*([^\r\n]+)$/);
        if (gradeMatch) {
            const grade = Number(gradeMatch[1]);
            const names = splitNameList(gradeMatch[2]);
            names.forEach((name) => {
                if (!monsterGrades.has(name)) monsterGrades.set(name, grade);
            });
        }

        const bossMatch = line.match(/(?:히든\s*보스|보스|수호자)\s*[:：]\s*([^\r\n]+)/);
        if (bossMatch) {
            splitNameList(bossMatch[1]).forEach((name) => {
                bosses.add(name);
                if (!monsterGrades.has(name)) monsterGrades.set(name, 4);
            });
        }

        if (line.includes("군주")) {
            const lordMatches = line.matchAll(/([가-힣]{1,10}의\s*군주(?:\s+[가-힣A-Za-z]{1,10})?|[가-힣]{2,10}군주)/g);
            for (const m of lordMatches) {
                addLayerLordToken(layerLords, m[1], currentLayer);
            }
        }

        const hasItemContext = hasAnyKeyword(line, ITEM_CONTEXT_HINTS);
        if (hasItemContext) {
            const quoteMatches = [
                ...line.matchAll(/'([^']{2,24})'/g),
                ...line.matchAll(/"([^"]{2,24})"/g)
            ];
            quoteMatches.forEach((m) => {
                const name = removeTrailingParticle(normalizeName(m[1]));
                if (isLikelyItemNameStrict(name, line)) items.add(name);
            });

            const explicitItemMatches = line.matchAll(/([가-힣A-Za-z0-9][가-힣A-Za-z0-9\s\-]{1,20})\s*(?:아이템|드롭|보상|획득)/g);
            for (const m of explicitItemMatches) {
                const name = removeTrailingParticle(normalizeName(m[1]));
                if (isLikelyItemNameStrict(name, line)) items.add(name);
            }
        }

        const bracketSkillMatches = line.matchAll(/\[([^\[\]\r\n]{2,30})\]/g);
        for (const token of bracketSkillMatches) {
            const name = removeTrailingParticle(normalizeName(token[1]));
            if (!isLikelySkillNameStrict(name, line)) continue;
            skills.add(name);
        }

        const explicitSkillMatches = [
            ...line.matchAll(/(?:스킬|이능|마법)\s*[:：]\s*\[?([가-힣A-Za-z][가-힣A-Za-z\s]{1,14})\]?/g),
            ...line.matchAll(/(?:스킬|이능|마법)\s*명\s*[:：]\s*\[?([가-힣A-Za-z][가-힣A-Za-z\s]{1,14})\]?/g)
        ];
        explicitSkillMatches.forEach((match) => {
            const name = removeTrailingParticle(normalizeName(match[1]));
            if (!isLikelySkillNameStrict(name, line)) return;
            skills.add(name);
        });

        if (/(돌발|이벤트|기연|약탈자|배신|차원 붕괴|몬스터 무리|탐험가|균열)/.test(line) && line.length <= 90) {
            eventLines.push(line);
        }
    }

    const manualSkillSeeds = [
        "차원문", "기우제", "마력지뢰", "강림", "결정화", "토성체",
        "폭풍의 제사장", "파멸광선", "영혼추출", "재생의 각인",
        "바꿔치기", "자가복제", "형태 변환", "용발톱", "휘두르기"
    ];
    manualSkillSeeds.forEach(name => skills.add(name));

    const normalizedEventLines = [...new Set(eventLines.map(line => normalizeName(line)).filter(Boolean))];
    const compactUnique = (values) => {
        const byCompact = new Map();
        values.forEach((value) => {
            const key = String(value || "").replace(/\s+/g, "");
            const prev = byCompact.get(key);
            if (!prev) {
                byCompact.set(key, value);
                return;
            }
            const prevHasSpace = /\s/.test(prev);
            const curHasSpace = /\s/.test(value);
            if (!prevHasSpace && curHasSpace) byCompact.set(key, value);
        });
        return [...byCompact.values()];
    };

    const monsterArray = [...monsterGrades.entries()].map(([name, grade]) => ({ name, grade }));
    return {
        monsterGrades,
        monsters: monsterArray,
        bosses: [...bosses],
        items: compactUnique([...items]),
        skills: compactUnique([...skills]),
        rifts,
        layerLords,
        events: normalizedEventLines
    };
}

async function loadSettingsText() {
    for (const candidate of SETTINGS_TEXT_CANDIDATES) {
        try {
            const response = await fetch(encodeURI(candidate));
            if (!response.ok) continue;
            const text = await response.text();
            if (text && text.trim().length > 0) {
                return { source: candidate, text };
            }
        } catch (_) {
            // 무시하고 다음 후보를 시도한다.
        }
    }
    return null;
}

function ensureMonsterCoverage(gameData, compendium) {
    if (!gameData.monsters) gameData.monsters = {};
    let added = 0;

    Object.entries(ALIAS_MONSTERS).forEach(([alias, target]) => {
        if (!gameData.monsters[target] || gameData.monsters[alias]) return;
        gameData.monsters[alias] = {
            ...gameData.monsters[target],
            essences: [...(gameData.monsters[target].essences || [target])],
            aliasOf: target,
            autoPatched: true
        };
        added += 1;
    });

    compendium.monsters.forEach(({ name, grade }) => {
        if (!gameData.monsters[name]) {
            gameData.monsters[name] = createMonsterTemplate(name, grade, false);
            added += 1;
        }
    });

    compendium.bosses.forEach((name) => {
        if (!gameData.monsters[name]) {
            const inferred = compendium.monsterGrades.get(name) || 4;
            gameData.monsters[name] = createMonsterTemplate(name, inferred, true);
            added += 1;
        }
    });

    return added;
}

function ensureEssenceCoverage(gameData) {
    if (!gameData.essences) gameData.essences = {};
    if (!gameData.monsters) return 0;

    let added = 0;
    Object.entries(gameData.monsters).forEach(([monsterName, monsterData]) => {
        if (!Array.isArray(monsterData.essences) || monsterData.essences.length === 0) {
            monsterData.essences = [monsterName];
        } else if (!monsterData.essences.includes(monsterName)) {
            monsterData.essences = [...new Set([...monsterData.essences, monsterName])];
        }

        if (!gameData.essences[monsterName]) {
            const grade = Number(monsterData?.grade || 7);
            gameData.essences[monsterName] = createEssenceTemplate(monsterName, grade);
            added += 1;
        }
    });

    return added;
}

function ensureItemCoverage(gameData, compendium) {
    if (!gameData.items) gameData.items = {};
    const set = new Set(compendium.items);
    const manualItems = [
        "꿈꾸는 영혼",
        "밀라로든의 거울",
        "불의 보주",
        "절제된 소망",
        "데드리우스의 초대장",
        "지휘관 데드맨의 뿔피리",
        "진실의 돌",
        "성장하는 씨앗"
    ];
    manualItems.forEach(name => set.add(name));
    const manualItemSet = new Set(manualItems);

    let added = 0;
    [...set].forEach((name) => {
        const normalized = removeTrailingParticle(normalizeName(name));
        if (!isValidEntityName(normalized, 2, 24)) return;
        if (!manualItemSet.has(normalized) && !isLikelyItemNameStrict(normalized, "아이템")) return;
        if (gameData.items[normalized] || gameData.numbersItems?.[normalized]) return;
        gameData.items[normalized] = createItemTemplate(normalized);
        added += 1;
    });
    return added;
}

function ensureSkillCoverage(gameData, compendium) {
    if (!gameData.magic) gameData.magic = {};
    const spells = new Set(compendium.skills);
    const manualSkillSet = new Set([
        "차원문", "기우제", "마력지뢰", "강림", "결정화", "토성체",
        "폭풍의 제사장", "파멸광선", "영혼추출", "재생의 각인",
        "바꿔치기", "자가복제", "형태 변환", "용발톱", "휘두르기",
        "기사도", "종복", "무작위 덫", "신성 불꽃"
    ]);
    manualSkillSet.forEach(name => spells.add(name));
    let added = 0;

    [...spells].forEach((name) => {
        const normalized = removeTrailingParticle(normalizeName(name));
        if (!manualSkillSet.has(normalized) && !isLikelySkillNameStrict(normalized, "스킬")) return;
        if (gameData.magic[normalized]) return;
        gameData.magic[normalized] = createSpellTemplate(normalized);
        added += 1;
    });
    return added;
}

function getLayerMonsterCandidates(gameData, layer) {
    const layerKey = String(layer || 1);
    const fromLayerData = gameData.layers?.[layerKey]?.monsters || gameData.maps?.[layerKey]?.monsters || [];
    const normalized = Array.isArray(fromLayerData) ? fromLayerData.filter(name => gameData.monsters?.[name]) : [];
    if (normalized.length > 0) return normalized;

    const global = Object.keys(gameData.monsters || {});
    return global.slice(0, 8);
}

function ensureRiftCoverage(gameData, compendium) {
    if (!gameData.rifts) gameData.rifts = {};
    const existingByLayer = {};
    Object.entries(gameData.rifts).forEach(([layer, rifts]) => {
        existingByLayer[layer] = new Set((rifts || []).map(r => normalizeName(r.name)));
    });

    let added = 0;
    compendium.rifts.forEach((riftInfo, idx) => {
        const name = normalizeName(riftInfo.name);
        if (!isValidEntityName(name, 2, 28)) return;
        const layer = Number.isFinite(riftInfo.layer) ? Math.max(1, riftInfo.layer) : 1;
        const layerKey = String(layer);
        if (!Array.isArray(gameData.rifts[layerKey])) gameData.rifts[layerKey] = [];
        if (!existingByLayer[layerKey]) existingByLayer[layerKey] = new Set();
        if (existingByLayer[layerKey].has(name)) return;

        const monsterPool = getLayerMonsterCandidates(gameData, layer);
        if (monsterPool.length === 0) return;
        const pick = (offset) => monsterPool[(idx + offset) % monsterPool.length];
        const fallbackBoss = compendium.bosses[idx % Math.max(1, compendium.bosses.length)] || pick(2);

        gameData.rifts[layerKey].push({
            name,
            description: `${name} (설정 텍스트 자동 보강 균열)`,
            stages: [
                {
                    name: "1챕터 (정찰)",
                    monsters: [pick(0), pick(1)],
                    event: `${name} 외곽에서 이상 징후를 조사합니다.`
                },
                {
                    name: "2챕터 (교전)",
                    monsters: [pick(1), pick(2), pick(3)],
                    event: `${name} 내부 방어선을 돌파합니다.`
                },
                {
                    name: "3챕터 (수호자)",
                    monsters: [pick(2)],
                    boss: fallbackBoss,
                    event: `${name}의 핵심 수호자를 격파합니다.`
                }
            ],
            autoPatched: true
        });
        existingByLayer[layerKey].add(name);
        added += 1;
    });

    return added;
}

function ensureLayerLordCoverage(gameData, compendium) {
    if (!gameData.layerLords) gameData.layerLords = {};
    let added = 0;

    const baseLords = {
        "1": ["공포의 군주 드레드피어", "희망의 군주"],
        "2": ["후회의 군주"],
        "4": ["천공의 군주"],
        "9": ["기록의 군주 레카르도"]
    };

    Object.entries(baseLords).forEach(([layer, names]) => {
        if (!Array.isArray(gameData.layerLords[layer])) gameData.layerLords[layer] = [];
        names.forEach((name) => {
            if (!gameData.layerLords[layer].includes(name)) {
                gameData.layerLords[layer].push(name);
                added += 1;
            }
        });
    });

    compendium.layerLords.forEach((layer, name) => {
        const layerKey = String(Number.isFinite(layer) && layer > 0 ? layer : 1);
        if (!Array.isArray(gameData.layerLords[layerKey])) gameData.layerLords[layerKey] = [];
        if (!gameData.layerLords[layerKey].includes(name)) {
            gameData.layerLords[layerKey].push(name);
            added += 1;
        }
    });

    return added;
}

function buildSettingsEventPool(compendium, rawText) {
    const events = [
        { id: "settings_horde", kind: "horde", title: "몬스터 무리", desc: "다수의 몬스터가 이동 경로를 포위합니다." },
        { id: "settings_explorer", kind: "explorer", title: "탐험가 조우", desc: "다른 탐험가 분대를 조우했습니다." },
        { id: "settings_raider", kind: "raider", title: "약탈자 기습", desc: "약탈자들이 매복을 시도합니다." },
        { id: "settings_collapse", kind: "collapse", title: "차원 이상", desc: "차원 붕괴의 전조가 감지됩니다." },
        { id: "settings_cache", kind: "cache", title: "은닉 보급품", desc: "폐허 틈에서 비상 물자를 발견했습니다." }
    ];

    const text = String(rawText || "");
    if (!/차원 붕괴/.test(text)) {
        return events.filter(e => e.kind !== "collapse");
    }

    const lineEvents = compendium.events.slice(0, 24).map((line, idx) => {
        let kind = "cache";
        if (/약탈자|기습/.test(line)) kind = "raider";
        else if (/탐험가|동료/.test(line)) kind = "explorer";
        else if (/차원|균열|붕괴/.test(line)) kind = "collapse";
        else if (/무리|웨이브|떼거지|포위/.test(line)) kind = "horde";
        return {
            id: `settings_line_${idx}`,
            kind,
            title: "설정 이벤트",
            desc: line
        };
    });

    const merged = [...events, ...lineEvents];
    const unique = [];
    const seen = new Set();
    merged.forEach((event) => {
        const key = `${event.kind}:${event.desc}`;
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(event);
    });
    return unique;
}

function ensureEventCoverage(gameData, compendium, rawText) {
    const nextPool = buildSettingsEventPool(compendium, rawText);
    const current = Array.isArray(gameData.settingsEvents) ? gameData.settingsEvents : [];
    const merged = [...current];
    const seen = new Set(current.map(event => `${event.kind}:${event.desc}`));

    nextPool.forEach((event) => {
        const key = `${event.kind}:${event.desc}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(event);
    });

    gameData.settingsEvents = merged;
    return Math.max(0, merged.length - current.length);
}

export async function applySettingsTextExpansion(gameData, logger = null) {
    if (!gameData || typeof gameData !== "object") {
        return { applied: false, reason: "invalid-gamedata" };
    }

    const loaded = await loadSettingsText();
    if (!loaded) {
        logger?.("[설정 텍스트 통합] 설정 원문 파일을 찾지 못했습니다. (겜바바 설정.txt)");
        return { applied: false, reason: "missing-settings-text" };
    }

    const compendium = buildCompendiumFromText(loaded.text);
    gameData.settingsCompendium = {
        source: loaded.source,
        monsters: compendium.monsters,
        bosses: compendium.bosses,
        items: compendium.items,
        skills: compendium.skills,
        rifts: compendium.rifts,
        layerLords: [...compendium.layerLords.entries()].map(([name, layer]) => ({ name, layer })),
        events: compendium.events
    };

    const result = {
        applied: true,
        source: loaded.source,
        monstersAdded: ensureMonsterCoverage(gameData, compendium),
        essencesAdded: ensureEssenceCoverage(gameData),
        riftsAdded: ensureRiftCoverage(gameData, compendium),
        layerLordsAdded: ensureLayerLordCoverage(gameData, compendium),
        itemsAdded: ensureItemCoverage(gameData, compendium),
        skillsAdded: ensureSkillCoverage(gameData, compendium),
        eventsAdded: ensureEventCoverage(gameData, compendium, loaded.text)
    };

    logger?.(`[설정 텍스트 통합] ${loaded.source} 반영 완료 | 몬스터+${result.monstersAdded}, 정수+${result.essencesAdded}, 균열+${result.riftsAdded}, 계층군주+${result.layerLordsAdded}, 아이템+${result.itemsAdded}, 스킬/마법+${result.skillsAdded}, 이벤트+${result.eventsAdded}`);
    return result;
}
