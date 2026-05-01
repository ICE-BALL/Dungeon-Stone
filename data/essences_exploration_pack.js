// 추가 정수 팩: 미궁 탐험/균열 대응용 정수

const safeHpUpdate = (target, amount) => {
    if (!target || typeof target.hp !== 'number') return;
    target.hp += amount;
    if (target.hp < 0) target.hp = 0;
    if (target.maxHp && target.hp > target.maxHp) target.hp = target.maxHp;
};

const calcDamage = (base, defense) => Math.floor(Math.max(1, base - (defense || 0)));

const applyDebuff = (caster, target, debuffName) => {
    if (!target || typeof target.applyDebuff !== 'function') return;
    target.applyDebuff(debuffName);
    caster?.cb?.logMessage?.(`${target.name || '대상'}에게 [${debuffName}] 적용.`);
};

export const essences = {
    "루멘 와처": {
        grade: 6,
        desc: "빛을 다루는 감시자 정수. 시야와 탐지 능력을 강화한다.",
        stats: { "시각": 8, "인지력": 6, "청각": 4 },
        passive: { name: "광휘 공명", desc: "어둠 속 시야가 약간 확장됩니다." },
        active: {
            name: "광휘 파동",
            desc: "빛의 파동으로 주변 적을 드러내고 피해를 준다.",
            mp_cost: 16,
            effect: (caster, target) => {
                const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
                caster.cb?.logMessage?.("[광휘 파동] 빛의 파동이 어둠을 밀어냅니다.");
                targets.forEach((t) => {
                    if (!t || t.hp <= 0) return;
                    const dmg = calcDamage(34 + Math.floor((caster.currentStats?.["정신력"] || 0) * 0.35), t.currentStats?.["항마력"] || 0);
                    safeHpUpdate(t, -dmg);
                    applyDebuff(caster, t, "위치 발각(2턴)");
                });
            }
        }
    },
    "심층 정찰자": {
        grade: 7,
        desc: "미궁의 숨겨진 길을 찾아내는 정찰 특화 정수.",
        stats: { "육감": 8, "후각": 6, "시각": 5 },
        passive: { name: "탐지 파동", desc: "숨겨진 요소 발견 확률이 증가합니다." },
        active: {
            name: "숨은 길 감지",
            desc: "주변 약점 지형과 숨은 통로를 감지한다.",
            mp_cost: 12,
            effect: (caster) => {
                caster.cb?.logMessage?.("[숨은 길 감지] 지형의 약점이 눈에 들어옵니다.");
                if (typeof caster.applyBuff === 'function') caster.applyBuff("정찰 태세(3턴)");
            }
        }
    },
    "균열 정박자": {
        grade: 5,
        desc: "차원 왜곡에 저항하고 균열을 안정화시키는 정수.",
        stats: { "정신력": 6, "항마력": 8, "어둠 내성": 6 },
        passive: { name: "공간 닻", desc: "차원붕괴 시 생존력이 소폭 증가합니다." },
        active: {
            name: "차원 고정",
            desc: "왜곡을 고정해 이동과 붕괴를 늦춘다.",
            mp_cost: 20,
            effect: (caster, target) => {
                caster.cb?.logMessage?.("[차원 고정] 공간 진동이 느려집니다.");
                if (target) applyDebuff(caster, target, "속박(균열)");
            }
        }
    },
    "공허 공학 포탑": {
        grade: 6,
        desc: "자율 포탑을 전개하는 공학형 정수.",
        stats: { "정신력": 4, "명중률": 8, "인지력": 5 },
        passive: { name: "자동 조준", desc: "원거리 명중률이 상승합니다." },
        active: {
            name: "자동 포격",
            desc: "공허 포탑이 대상에게 마력탄을 연사한다.",
            mp_cost: 18,
            effect: (caster, target) => {
                if (!target) {
                    caster.cb?.logMessage?.("대상이 없습니다.");
                    return;
                }
                caster.cb?.logMessage?.(`[자동 포격] ${target.name}에게 마력탄을 발사합니다.`);
                for (let i = 0; i < 2; i++) {
                    const dmg = calcDamage(24 + Math.floor((caster.currentStats?.["명중률"] || 0) * 0.2), target.currentStats?.["항마력"] || 0);
                    safeHpUpdate(target, -dmg);
                }
            }
        }
    },
    "추적 사냥개": {
        grade: 8,
        desc: "혈흔과 체열을 추적하는 야수형 정수.",
        stats: { "후각": 10, "청각": 8, "민첩성": 4 },
        passive: { name: "열 추적", desc: "도주/은신 적을 감지하기 쉬워집니다." },
        active: {
            name: "열 추적",
            desc: "대상의 약점을 포착해 회피율을 낮춘다.",
            mp_cost: 10,
            effect: (caster, target) => {
                if (!target) return;
                applyDebuff(caster, target, "추적 표식(2턴)");
                caster.cb?.logMessage?.(`[열 추적] ${target.name}의 움직임을 추적합니다.`);
            }
        }
    },
    "탐식의 불씨": {
        grade: 8,
        desc: "전투와 탐험에서 잔광을 흡수해 회복하는 정수.",
        stats: { "자연 재생력": 6, "화염 감응도": 4, "지구력": 4 },
        passive: { name: "잔불 회복", desc: "전투 종료 후 소량 회복합니다." },
        active: {
            name: "잔불 흡수",
            desc: "주변 열기를 흡수해 HP/MP를 회복한다.",
            mp_cost: 8,
            effect: (caster) => {
                const hpGain = 40 + Math.floor((caster.currentStats?.["자연 재생력"] || 0) * 0.3);
                const mpGain = 16 + Math.floor((caster.currentStats?.["정신력"] || 0) * 0.2);
                safeHpUpdate(caster, hpGain);
                if (typeof caster.mp === 'number') caster.mp = Math.min(caster.maxMp || caster.mp, caster.mp + mpGain);
                caster.cb?.logMessage?.(`[잔불 흡수] HP +${hpGain}, MP +${mpGain}`);
            }
        }
    },
    "장막 파쇄자": {
        grade: 5,
        desc: "은폐막과 환영 장치를 깨뜨리는 해제형 정수.",
        stats: { "인지력": 7, "정신력": 5, "항마력": 4 },
        passive: { name: "장막 감쇠", desc: "은폐/환영 계열 효과를 덜 받습니다." },
        active: {
            name: "장막 파쇄",
            desc: "적의 은폐막을 깨뜨려 저항을 약화한다.",
            mp_cost: 14,
            effect: (caster, target) => {
                if (!target) return;
                applyDebuff(caster, target, "방어 붕괴(2턴)");
                caster.cb?.logMessage?.(`[장막 파쇄] ${target.name}의 방어막이 흔들립니다.`);
            }
        }
    },
    "유적 추적자": {
        grade: 6,
        desc: "오래된 기호와 발자국을 읽어 경로를 복원하는 정수.",
        stats: { "시각": 6, "육감": 6, "후각": 4 },
        passive: { name: "유물 감응", desc: "탐험 중 보급/유물 탐지 성공률이 증가합니다." },
        active: {
            name: "추적 각인",
            desc: "대상의 이동을 읽고 약점을 노출시킨다.",
            mp_cost: 11,
            effect: (caster, target) => {
                if (!target) return;
                applyDebuff(caster, target, "약점 노출(2턴)");
                caster.cb?.logMessage?.(`[추적 각인] ${target.name}의 움직임을 읽었습니다.`);
            }
        }
    },
    "심연 길잡이": {
        grade: 7,
        desc: "어두운 통로에서도 방향 감각을 잃지 않는 항해자 정수.",
        stats: { "청각": 6, "인지력": 7, "정신력": 4 },
        passive: { name: "심연 항법", desc: "탐험 중 길찾기 안정성이 소폭 상승합니다." },
        active: {
            name: "심연 나침",
            desc: "심연 좌표를 읽어 다음 행동을 보조한다.",
            mp_cost: 13,
            effect: (caster) => {
                caster.cb?.logMessage?.("[심연 나침] 주변 좌표의 불안정성이 낮아집니다.");
                if (typeof caster.mp === 'number') caster.mp = Math.min(caster.maxMp || caster.mp, caster.mp + 6);
            }
        }
    },
    "환영 인도자": {
        grade: 6,
        desc: "환각 지형을 통과하며 아군 시야를 보조하는 정수.",
        stats: { "정신력": 7, "항마력": 5, "시각": 4 },
        passive: { name: "환영 내성", desc: "환각/혼란 계열 저항이 증가합니다." },
        active: {
            name: "환영 도려내기",
            desc: "환영체를 찢어 주변 적에게 피해를 준다.",
            mp_cost: 17,
            effect: (caster, target) => {
                const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
                targets.forEach((t) => {
                    if (!t || t.hp <= 0) return;
                    const dmg = calcDamage(28 + Math.floor((caster.currentStats?.["정신력"] || 0) * 0.25), t.currentStats?.["항마력"] || 0);
                    safeHpUpdate(t, -dmg);
                });
                caster.cb?.logMessage?.("[환영 도려내기] 환영 파동이 주변을 훑고 지나갑니다.");
            }
        }
    },
    "붉은 정찰안": {
        grade: 8,
        desc: "열원 반응을 분석해 교전 전 우위를 확보하는 정수.",
        stats: { "시각": 6, "명중률": 6, "민첩성": 4 },
        passive: { name: "열원 분석", desc: "기습 대응력이 소폭 향상됩니다." },
        active: {
            name: "열점 고정",
            desc: "적의 약점을 고정해 연속 타격을 유도한다.",
            mp_cost: 15,
            effect: (caster, target) => {
                if (!target) return;
                const dmg = calcDamage(30 + Math.floor((caster.currentStats?.["명중률"] || 0) * 0.2), target.currentStats?.["항마력"] || 0);
                safeHpUpdate(target, -dmg);
                applyDebuff(caster, target, "열점 노출(2턴)");
                caster.cb?.logMessage?.(`[열점 고정] ${target.name}의 열점 좌표를 고정했습니다.`);
            }
        }
    },
    "파편 주술사": {
        grade: 7,
        desc: "차원 파편을 소모해 단기 보강 효과를 부여하는 정수.",
        stats: { "정신력": 5, "항마력": 7, "영혼력": 4 },
        passive: { name: "파편 축적", desc: "전투 중 마력 회수 효율이 증가합니다." },
        active: {
            name: "파편 소각",
            desc: "파편을 폭발시켜 주변 적에게 피해를 준다.",
            mp_cost: 19,
            effect: (caster, target) => {
                const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
                targets.forEach((t) => {
                    if (!t || t.hp <= 0) return;
                    const dmg = calcDamage(26 + Math.floor((caster.currentStats?.["항마력"] || 0) * 0.2), t.currentStats?.["항마력"] || 0);
                    safeHpUpdate(t, -dmg);
                });
                caster.cb?.logMessage?.("[파편 소각] 파편이 폭발하며 마력 잔해가 퍼집니다.");
            }
        }
    }
};
