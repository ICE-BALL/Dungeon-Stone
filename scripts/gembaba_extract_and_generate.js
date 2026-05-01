/**
 * 겜바바 설정.txt에서 몬스터/정수/층 정보를 추출해
 * 프로젝트 데이터 파일(data/*.json)로 생성하는 스크립트.
 *
 * 실행:
 *   node scripts/gembaba_extract_and_generate.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, '겜바바 설정.txt');

const OUTPUT_MONSTERS = path.join(ROOT, 'data', 'monsters_gembaba_extracted.json');
const OUTPUT_ESSENCES = path.join(ROOT, 'data', 'essences_gembaba_extracted.json');
const OUTPUT_FLOORS = path.join(ROOT, 'data', 'floors_gembaba_extracted.json');
const OUTPUT_REPORT = path.join(ROOT, 'data', 'gembaba_extraction_report.json');

const EXISTING_MONSTER_FILES = [
    path.join(ROOT, 'data', 'monsters_grades_1-3.json'),
    path.join(ROOT, 'data', 'monsters_grades_4-6.json'),
    path.join(ROOT, 'data', 'monsters_grades_7-10_b1.json')
];

const EXISTING_ESSENCE_FILES = [
    path.join(ROOT, 'data', 'essences_grades_1-3.json'),
    path.join(ROOT, 'data', 'essences_grades_4-6.json'),
    path.join(ROOT, 'data', 'essences_grades_7-10_b1.json')
];

const NAME_ALIASES = new Map([
    ['칼날 늑대', '칼날늑대'],
    ['거대 칼날 늑대', '거대칼날늑대'],
    ['핏빛 칼날 늑대', '핏빛칼날늑대'],
    ['샤벨 타이거', '샤벨타이거'],
    ['구울 로드', '구울로드'],
    ['셀러맨더', '샐러맨더'],
    ['카니바로', '카나바로'],
    ['벤시 여왕', '벤시 퀸'],
    ['아이스골렘', '아이스 골렘'],
    ['본드래곤', '본 드래곤'],
    ['라르카즈', '라크자르'],
    ['미궁의 악마 아르고스', '아르고스'],
    ['캠브로미어', '캠보르미어']
]);

const MONSTER_BASE_STATS = {
    1: { hp: 30000, atk: 150, def: 60, magic_def: 60 },
    2: { hp: 14000, atk: 110, def: 46, magic_def: 46 },
    3: { hp: 7000, atk: 85, def: 34, magic_def: 34 },
    4: { hp: 3400, atk: 65, def: 26, magic_def: 26 },
    5: { hp: 1800, atk: 55, def: 22, magic_def: 22 },
    6: { hp: 1100, atk: 45, def: 18, magic_def: 18 },
    7: { hp: 700, atk: 35, def: 14, magic_def: 14 },
    8: { hp: 430, atk: 27, def: 10, magic_def: 10 },
    9: { hp: 240, atk: 18, def: 6, magic_def: 6 },
    10: { hp: 150, atk: 13, def: 5, magic_def: 5 },
    0: { hp: 180, atk: 16, def: 6, magic_def: 6 } // 무등급
};

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function canonicalName(input) {
    return cleanupName(input).replace(/\s+/g, '');
}

function cleanupName(raw) {
    if (!raw) return '';
    let name = String(raw);
    name = name.replace(/[“”"'`]/g, '');
    name = name.replace(/\[[^\]]*]/g, '');
    name = name.replace(/\([^)]*\)/g, '');
    name = name.replace(/\{[^}]*}/g, '');
    name = name.replace(/\s*-\s*.*/, '');
    name = name.replace(/\s*\/.*/, '');
    name = name.replace(/\s*\|.*/, '');
    name = name.replace(/\s*…+.*/, '');
    name = name.replace(/[。.;!?,]+$/g, '');
    name = name.replace(/^(히든 보스|중간 보스|수호자|특수 보스)\s*:\s*/g, '');
    name = name.replace(/^(무등급|\d+등급)\s*:\s*/g, '');
    name = name.replace(/\s+/g, ' ').trim();
    if (NAME_ALIASES.has(name)) {
        name = NAME_ALIASES.get(name);
    }
    return name;
}

function isLikelyEntityName(rawLine) {
    const line = cleanupName(rawLine);
    if (!line) return false;
    if (line === '???') return false;
    if (line.length < 1 || line.length > 20) return false;
    if (/[:：]/.test(line)) return false;
    if (/[.!?]/.test(line)) return false;
    if (!/^[0-9A-Za-z가-힣\-\s]+$/.test(line)) return false;
    if (/^\d/.test(line)) return false;

    const tokens = line.split(' ').filter(Boolean);
    if (tokens.length > 3) return false;

    const skipPrefixes = [
        '겜바바',
        '잡으면',
        '능력치',
        '패시브',
        '액티브',
        '희귀종',
        '상위 변이종',
        '이명',
        '개체명',
        '정수',
        '마석',
        '몬스터',
        '(P)',
        '(A)'
    ];
    for (const prefix of skipPrefixes) {
        if (line.startsWith(prefix)) return false;
    }

    const bannedSubstrings = [
        '몬스터',
        '정수',
        '균열',
        '출현',
        '등장',
        '처치',
        '스킬',
        '효과',
        '피해',
        '회복',
        '증가',
        '감소',
        '루팅',
        '확률',
        '대표적',
        '비행종',
        '해양',
        '피지컬',
        '초대형',
        '원거리',
        '야수종',
        '자연종',
        '언데드',
        '무등급',
        '수호자 중',
        '정수는'
    ];
    for (const token of bannedSubstrings) {
        if (line.includes(token)) return false;
    }

    if (/\sor\s/i.test(line)) return false;
    if (line.endsWith('타입')) return false;
    if (line.endsWith('변이종')) return false;
    if (line === '바다 괴수') return false;
    if (line === '스켈레톤의 변이종') return false;

    if (/(한다|했다|된다|있다|같다|입혀진다|생긴다)$/.test(line)) return false;

    return true;
}

function inferFloorId(token) {
    const normalized = token.replace(/\s+/g, '');
    if (normalized.startsWith('지하')) {
        const num = normalized.match(/지하(\d+)층/);
        if (num) return `B${num[1]}`;
        return normalized;
    }
    const normal = normalized.match(/(\d+)층/);
    if (normal) return normal[1];
    return normalized;
}

function addCandidate(set, gradeMap, nameRaw, grade) {
    const name = cleanupName(nameRaw);
    if (!name || name === '???') return;
    if (name.length > 34) return;
    if (!isLikelyEntityName(name)) return;
    set.add(name);
    if (gradeMap && grade !== undefined && grade !== null && Number.isFinite(grade)) {
        if (!gradeMap.has(name)) gradeMap.set(name, grade);
    }
}

function parseSource(sourceText) {
    const lines = sourceText.split(/\r?\n/);

    const monsters = new Set();
    const monsterGrades = new Map();
    const essences = new Set();
    const essenceGrades = new Map();
    const explicitEssences = new Set();

    const floorData = {
        source: '겜바바 설정.txt',
        extractedAt: new Date().toISOString(),
        layers: [],
        hidden_fields: [],
        rifts: [],
        special_fields: []
    };

    // floor headings: 4.1. 1층: 수정동굴[편집]
    const floorHeadingRegex = /^(\d+)\.(\d+)\.\s*(지하\s*\d+층|\d+층)(?:\s*:\s*([^\[]+))?\[편집]/;
    for (const raw of lines) {
        const line = raw.trim();
        const match = line.match(floorHeadingRegex);
        if (!match) continue;
        const chapter = Number(match[1]);
        const section = Number(match[2]);
        const floorToken = match[3];
        const floorName = (match[4] || '').trim();
        const record = {
            chapter,
            section,
            floorId: inferFloorId(floorToken),
            floorLabel: floorToken.replace(/\s+/g, ''),
            name: floorName || null
        };

        if (chapter === 4) floorData.layers.push(record);
        else if (chapter === 5) floorData.hidden_fields.push(record);
        else if (chapter === 6) floorData.rifts.push(record);
        else if (chapter === 7) floorData.special_fields.push(record);
    }

    // Global grade lines: 9등급: A, B, C
    for (const raw of lines) {
        const line = raw.trim();
        const gradeLine = line.match(/^(무등급|\d+등급)\s*:\s*(.+)$/);
        if (gradeLine) {
            const gradeToken = gradeLine[1];
            const grade = gradeToken === '무등급' ? 0 : Number(gradeToken.replace('등급', ''));
            const names = gradeLine[2].split(/[，,]/g);
            for (const name of names) addCandidate(monsters, monsterGrades, name, grade);
            continue;
        }

        const bossLine = line.match(/^(히든 보스|중간 보스|수호자|특수 보스)\s*:\s*(.+)$/);
        if (bossLine) {
            const names = bossLine[2].split(/[，,]/g);
            for (const entry of names) {
                const gradeMatch = entry.match(/(\d+)등급/);
                const grade = gradeMatch ? Number(gradeMatch[1]) : null;
                addCandidate(monsters, monsterGrades, entry, grade);
            }
            continue;
        }
    }

    // Monster list section (10. 목록[편집] ~ 정수:)
    let inMonsterList = false;
    let currentMonsterGrade = null;
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (/^10\. 목록\[편집]/.test(line)) {
            inMonsterList = true;
            currentMonsterGrade = null;
            continue;
        }
        if (inMonsterList && /^정수:/.test(line)) {
            inMonsterList = false;
            continue;
        }
        if (!inMonsterList) continue;

        const gradeHeader = line.match(/^10\.\d+(?:\.\d+)?\.\s*(무등급|\d+)등급/);
        if (gradeHeader) {
            currentMonsterGrade = gradeHeader[1] === '무등급' ? 0 : Number(gradeHeader[1]);
            continue;
        }

        if (isLikelyEntityName(line)) {
            addCandidate(monsters, monsterGrades, line, currentMonsterGrade);
        }
    }

    // Essence section (정수: ~ 마석:)
    let inEssenceSection = false;
    let currentEssenceGrade = null;
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (/^정수:/.test(line)) {
            inEssenceSection = true;
            currentEssenceGrade = null;
            continue;
        }
        if (inEssenceSection && /^마석:/.test(line)) {
            inEssenceSection = false;
            continue;
        }
        if (!inEssenceSection) continue;

        const essenceGradeHeader = line.match(/^8\.\d+\.\s*(\d+)등급/);
        if (essenceGradeHeader) {
            currentEssenceGrade = Number(essenceGradeHeader[1]);
            continue;
        }

        const customEssenceEntry = line.match(/^\[([^\]]+)]\s*:\s*(\d+)\s*등급/);
        if (customEssenceEntry) {
            const name = customEssenceEntry[1];
            const grade = Number(customEssenceEntry[2]);
            addCandidate(essences, essenceGrades, name, grade);
            explicitEssences.add(cleanupName(name));
            continue;
        }

        if (line.endsWith('의 정수')) {
            addCandidate(essences, essenceGrades, line, currentEssenceGrade);
            explicitEssences.add(cleanupName(line));
            continue;
        }
    }

    return { monsters, monsterGrades, essences, essenceGrades, explicitEssences, floorData };
}

function loadExistingNames(pathsList) {
    const names = new Set();
    for (const filePath of pathsList) {
        const obj = readJson(filePath);
        for (const key of Object.keys(obj)) {
            names.add(key);
        }
    }
    return names;
}

function buildMonsterEntry(name, mappedGrade) {
    const grade = mappedGrade === 0 ? null : (mappedGrade || 6);
    const statKey = mappedGrade === 0 ? 0 : (mappedGrade || 6);
    const base = MONSTER_BASE_STATS[statKey] || MONSTER_BASE_STATS[6];
    return {
        grade,
        hp: base.hp,
        atk: base.atk,
        def: base.def,
        magic_def: base.magic_def,
        essences: [name],
        description: mappedGrade === 0
            ? '겜바바 설정.txt 기반 자동 추가 데이터(무등급).'
            : '겜바바 설정.txt 기반 자동 추가 데이터.'
    };
}

function buildEssenceEntry(grade) {
    const resolved = grade || 6;
    return {
        grade: resolved,
        stats: {},
        passive: {
            name: '미확인 패시브',
            desc: '겜바바 설정.txt에 이름만 언급되어 세부 효과는 미기재입니다.'
        },
        active: null
    };
}

function uniqueByCanonical(names) {
    const seen = new Set();
    const unique = [];
    for (const name of names) {
        const key = canonicalName(name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(name);
    }
    return unique;
}

function main() {
    if (!fs.existsSync(SOURCE_FILE)) {
        throw new Error(`소스 파일을 찾을 수 없습니다: ${SOURCE_FILE}`);
    }

    const sourceText = fs.readFileSync(SOURCE_FILE, 'utf8');
    const parsed = parseSource(sourceText);

    const existingMonsterNames = loadExistingNames(EXISTING_MONSTER_FILES);
    const existingEssenceNames = loadExistingNames(EXISTING_ESSENCE_FILES);
    const existingMonsterCanonical = new Set([...existingMonsterNames].map(canonicalName));
    const existingEssenceCanonical = new Set([...existingEssenceNames].map(canonicalName));

    const missingMonsters = uniqueByCanonical([...parsed.monsters]
        .filter(name => !existingMonsterCanonical.has(canonicalName(name)))
        .sort((a, b) => a.localeCompare(b, 'ko')));

    // 몬스터 정수는 기본적으로 몬스터명과 동일하게 취급
    const mergedEssenceCandidates = new Set([
        ...missingMonsters,
        ...parsed.explicitEssences
    ]);

    const missingEssences = uniqueByCanonical([...mergedEssenceCandidates]
        .filter(name => !existingEssenceCanonical.has(canonicalName(name)))
        .sort((a, b) => a.localeCompare(b, 'ko')));

    const generatedMonsters = {};
    for (const name of missingMonsters) {
        const grade = parsed.monsterGrades.has(name) ? parsed.monsterGrades.get(name) : null;
        generatedMonsters[name] = buildMonsterEntry(name, grade);
    }

    const generatedEssences = {};
    for (const name of missingEssences) {
        const grade = parsed.essenceGrades.has(name) ? parsed.essenceGrades.get(name) : null;
        generatedEssences[name] = buildEssenceEntry(grade);
    }

    writeJson(OUTPUT_MONSTERS, generatedMonsters);
    writeJson(OUTPUT_ESSENCES, generatedEssences);
    writeJson(OUTPUT_FLOORS, parsed.floorData);

    const report = {
        source: path.basename(SOURCE_FILE),
        extractedAt: new Date().toISOString(),
        parsed: {
            totalMonsterCandidates: parsed.monsters.size,
            totalEssenceCandidates: parsed.essences.size,
            floors: {
                layers: parsed.floorData.layers.length,
                hidden_fields: parsed.floorData.hidden_fields.length,
                rifts: parsed.floorData.rifts.length,
                special_fields: parsed.floorData.special_fields.length
            }
        },
        diff: {
            existingMonsters: existingMonsterNames.size,
            existingEssences: existingEssenceNames.size,
            addedMonsters: missingMonsters.length,
            addedEssences: missingEssences.length
        },
        addedMonsterNames: missingMonsters,
        addedEssenceNames: missingEssences
    };
    writeJson(OUTPUT_REPORT, report);

    console.log(`[겜바바 추출] 몬스터 후보: ${parsed.monsters.size}, 추가: ${missingMonsters.length}`);
    console.log(`[겜바바 추출] 정수 후보: ${parsed.essences.size}, 추가: ${missingEssences.length}`);
    console.log(`[겜바바 추출] 층 정보: layers=${parsed.floorData.layers.length}, hidden=${parsed.floorData.hidden_fields.length}, rifts=${parsed.floorData.rifts.length}, special=${parsed.floorData.special_fields.length}`);
    console.log(`[겜바바 추출] 생성 파일:`);
    console.log(`  - ${path.relative(ROOT, OUTPUT_MONSTERS)}`);
    console.log(`  - ${path.relative(ROOT, OUTPUT_ESSENCES)}`);
    console.log(`  - ${path.relative(ROOT, OUTPUT_FLOORS)}`);
    console.log(`  - ${path.relative(ROOT, OUTPUT_REPORT)}`);
}

main();
