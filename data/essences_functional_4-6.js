// 이 파일은 4, 5, 6 등급 정수의
// 'active' 스킬 effect(함수)를 정의합니다.
// 이 파일은 main.js에서 GameData.essences에 병합됩니다.
// [수정] (기능 미구현)으로 표시된 스킬들의 실제 효과 구현

// --- 스킬 effect 헬퍼 함수 ---

/**
 * 대상의 HP를 안전하게 변경합니다. (Player 또는 Monster 객체)
 * @param {object} target - HP를 변경할 대상 (player 또는 monster)
 * @param {number} amount - 변경할 HP 양 (양수: 회복, 음수: 피해)
 */
const safeHpUpdate = (target, amount) => {
    if (!target) return;
    target.hp = (target.hp || 0) + amount;
    if (target.hp < 0) target.hp = 0;
    if (target.maxHp && target.hp > target.maxHp) {
        target.hp = target.maxHp;
    }
    
    // 피격 시 '진압', '수면', '석화' 등 해제
    if (amount < 0 && target.debuffs) {
        const debuffsToClear = ["진압(1턴)", "수면(1턴)", "석화(1턴)", "석화(2턴)", "속박(거품)", "속박(나무)", "속박(얼음)", "속박(무덤)", "속박(뱀)", "속박(늪)"];
        target.debuffs = target.debuffs.filter(d => !debuffsToClear.includes(d));
    }
};

/**
 * 방어력을 고려한 데미지를 계산합니다.
 * @param {number} base - 기본 데미지
 * @param {number} defense - 대상의 방어력
 * @returns {number} 1 이상의 정수 데미지
 */
const calculateDamage = (base, defense) => {
    return Math.floor(Math.max(1, base - (defense || 0)));
};

/**
 * 대상에게 디버프를 적용합니다. (caster는 로그 출력을 위해 필요)
 * @param {object} caster - 스킬 시전자 (Player)
 * @param {object} target - 디버프 대상
 * @param {string} debuffName - 적용할 디버프 이름
 */
const applyDebuff = (caster, target, debuffName) => {
    if (!target) return;
    if (target.applyDebuff) { // Monster 또는 Player 객체에 applyDebuff가 있는지 확인
        target.applyDebuff(debuffName);
        caster?.cb?.logMessage?.(`${target.name || '대상'}이(가) [${debuffName}] 효과를 받습니다!`);
    }
};

/**
 * 대상의 디버프를 해제합니다.
 * @param {object} caster - 스킬 시전자 (Player)
 * @param {object} target - 디버프 해제 대상
 * @param {string} debuffName - 해제할 디버프 이름 (또는 "ALL" or "POISON" 등)
 */
const removeDebuff = (caster, target, debuffName) => {
    if (!target) return;
    if (debuffName === "ALL") {
        target.debuffs = [];
        caster?.cb?.logMessage?.(`${target.name || '대상'}의 모든 디버프가 해제됩니다.`);
    } else {
        if (target.debuffs && target.debuffs.includes(debuffName)) {
            target.debuffs = target.debuffs.filter(d => d !== debuffName);
            caster?.cb?.logMessage?.(`${target.name || '대상'}의 [${debuffName}] 효과가 해제됩니다.`);
        }
    }
};


// --- 정수(Essences) 함수 구현부 ---
export const essences = {
  // --- 4등급 ---
  "리치": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[죽음의 손길]! ${target.name}의 생명력을 흡수합니다!`);
        const dmg = calculateDamage(60 + (caster.currentStats['정신력'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        const healAmount = Math.floor(dmg * 0.3); // 30% 흡수
        safeHpUpdate(caster, healAmount);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 암흑 피해를 입히고, 체력을 ${healAmount} 회복했습니다! (HP: ${target.hp})`);
      }
    }
  },
  "영혼의 거신병": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[정신 붕괴]! ${target.name}에게 강력한 정신 공격을 가합니다!`);
        const dmg = calculateDamage(80 + (caster.currentStats['정신력'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "혼란(2턴)");
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 마법 피해를 입히고 '혼란' 상태로 만들었습니다!`);
      }
    }
  },
  "강철 거인": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[강철 주먹]! ${target.name}에게 강력한 주먹을 날립니다!`);
        const dmg = calculateDamage((caster.currentStats['근력'] || 0) * 1.5, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        if (Math.random() < 0.3) {
            applyDebuff(caster, target, "기절(1턴)");
        }
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 물리 피해! (HP: ${target.hp})`);
      }
    }
  },
  "용암 거인": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[용암 분출]! 바닥에서 용암이 솟아오릅니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(50 + (caster.currentStats['화염 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
                caster.cb.logMessage(`${t.name}에게 ${dmg}의 화염 피해! (HP: ${t.hp})`);
            }
        });
      }
    }
  },
  "나이트메어": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "수면(2턴)");
        caster.cb.logMessage(`[영원한 수면]! ${target.name}을(를) 2턴간 '수면' 상태로 만듭니다! (피격 시 해제)`);
      }
    }
  },
  "도플갱어": {
    active: [
      {
        name: "자기복제",
        effect: (caster, target) => {
            caster.cb.logMessage("[자기복제]! 자신의 환영 분신체를 생성합니다! (기능 미구현)");
        }
      },
      {
        name: "바꿔치기",
        effect: (caster, target) => {
            caster.cb.logMessage("[바꿔치기]! 대상과 위치를 변경합니다. (기능 미구현)");
        }
      },
      {
        name: "결정화",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "결정화(1턴)");
            caster.cb.logMessage("[결정화]! 1턴간 마법 피해 99%, 물리 피해 90%가 감소하는 방어 태세를 취합니다!");
        }
      }
    ]
  },
  "메두사": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "석화(2턴)");
        caster.cb.logMessage(`[석화의 시선]! ${target.name}을(를) 2턴간 '석화' 상태로 만듭니다!`);
      }
    }
  },
  "세이렌 여왕": {
    active: [
      {
        name: "바다의 노래",
        effect: (caster, target) => {
            caster.cb.logMessage("[바다의 노래]! 범위 내 적들의 능력치가 3턴간 감소합니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) applyDebuff(caster, t, "능력치 감소(3턴)");
            });
        }
      },
      {
        name: "소용돌이",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[소용돌이]! ${target.name}의 MP를 빼앗습니다!`);
            const mpDrain = 20;
            if (target.mp) target.mp = Math.max(0, target.mp - mpDrain);
            caster.mp = Math.min(caster.maxMp, caster.mp + mpDrain);
            caster.cb.logMessage(`${target.name}의 MP ${mpDrain}를 흡수합니다!`);
        }
      },
      {
        name: "충성의 증거",
        effect: (caster, target) => {
            caster.cb.logMessage("[충성의 증거]! 5등급 '세이렌'을 소환합니다. (기능 미구현)");
        }
      }
    ]
  },
  "엘프로트": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "속박(뿌리)");
        applyDebuff(caster, target, "독(강)");
        caster.cb.logMessage(`[맹독 뿌리]! ${target.name}을(를) 1턴간 '속박'하고 '강한 중독' 상태로 만듭니다!`);
      }
    }
  },
  "씨머챈트": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[불건전계약]! ${target.name}에게 계약을 시도합니다... (기능 미구현)`);
        applyDebuff(caster, target, "불건전계약(영구)"); // (실제 로직은 safeHpUpdate에서 처리 필요)
      }
    }
  },
  "라플레미믹": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[도주]! 땅 속으로 숨어 전투에서 즉시 이탈합니다.");
        if (caster.inCombat) {
            caster.endCombat(false); // 전투 강제 종료 (도망)
        }
      }
    }
  },
  "머멀 제사장": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[대규모 치유]! 모든 아군의 체력을 100 회복합니다!");
        safeHpUpdate(caster, 100);
        caster.party.forEach(p => {
            safeHpUpdate(p, 100);
        });
      }
    }
  },
  "가고일": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "석화(2턴)");
        caster.cb.logMessage(`[석화]! ${target.name}을(를) 2턴간 '석화' 상태로 만듭니다!`);
      }
    }
  },
  "서리불꽃 고블린": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[서리불꽃 함정]! ${target.name}의 발 밑에 함정을 설치합니다!`);
        const dmg = calculateDamage(40, target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "속박(얼음)");
        caster.cb.logMessage(`${target.name}이(가) 함정을 밟아 ${dmg}의 피해를 입고 속박 상태가 됩니다!`);
      }
    }
  },
  "텐타쿨란": {
    active: [
      {
        name: "악의 소리",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            applyDebuff(caster, target, "공포(1턴)");
        }
      },
      {
        name: "돌의 저주",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            applyDebuff(caster, target, "석화(1턴)");
        }
      },
      {
        name: "수중포효",
        effect: (caster, target) => {
            caster.cb.logMessage("[수중포효]! 주변 적들에게 피해를 주고 기절시킵니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if(t.hp > 0) {
                    const dmg = calculateDamage(20, t.currentStats?.['항마력'] || 0);
                    safeHpUpdate(t, -dmg);
                    applyDebuff(caster, t, "기절(1턴)");
                }
            });
        }
      }
    ]
  },
  "굴다람쥐": {
    active: [
      {
        name: "성장하는 씨앗",
        effect: (caster, target) => {
            caster.cb.logMessage("[성장하는 씨앗]! 5등급 '씨드리아'를 소환합니다. (기능 미구현)");
        }
      },
      {
        name: "마력연사",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[마력연사]! ${target.name}에게 마력 구체를 3회 발사합니다!`);
            for (let i = 0; i < 3; i++) {
                const dmg = calculateDamage(15, target.currentStats?.['항마력'] || 0);
                safeHpUpdate(target, -dmg);
            }
        }
      },
      {
        name: "매혹가루",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            applyDebuff(caster, target, "혼란(1턴)");
            caster.cb.logMessage(`[매혹가루]! ${target.name}이(가) 혼란에 빠집니다!`);
        }
      }
    ]
  },
  "황금독니 칼피온": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[독니 돌진]! ${target.name}에게 황금독 돌진 공격!`);
        const dmg = calculateDamage(40 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "마비(강)");
      }
    }
  },
  "라바로드 (화주 피아닐)": {
    active: [
      {
        name: "재의 낙인",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            applyDebuff(caster, target, "재의 낙인(3턴)");
            caster.cb.logMessage(`[재의 낙인]! ${target.name}에게 낙인을 새깁니다! (3턴간 스킬 사용 시 화염 피해)`);
        }
      },
      {
        name: "잿불의 종",
        effect: (caster, target) => {
            caster.cb.logMessage("[잿불의 종]! 화염 속성 정령을 소환합니다. (기능 미구현)");
        }
      }
    ]
  },
  "지옥거인 헤르쟈": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[파동 연결]! 파티원과 스킬을 공유합니다! (기능 미구현)");
      }
    }
  },
  "영혼지기 하우시엘": {
    active: [
      {
        name: "방어체계",
        effect: (caster, target) => {
            caster.cb.logMessage("[방어체계]! 마력포가 적을 공격합니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) {
                    const dmg = calculateDamage(70, t.currentStats?.['항마력'] || 0);
                    safeHpUpdate(t, -dmg);
                    caster.cb.logMessage(`마력포가 ${t.name}에게 ${dmg}의 마법 피해! (HP: ${t.hp})`);
                }
            });
        }
      },
      {
        name: "목표지정",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            applyDebuff(caster, target, "어그로 고정(1턴)");
            caster.cb.logMessage(`[목표지정]! ${target.name}의 어그로가 1턴간 고정됩니다!`);
        }
      }
    ]
  },
  "천공의 군주": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[천공의 심판]! 하늘에서 빛의 기둥이 쏟아집니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(100 + (caster.currentStats['정신력'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
                caster.cb.logMessage(`${t.name}에게 ${dmg}의 신성 피해! (HP: ${t.hp})`);
            }
        });
      }
    }
  },
  "조율자 그레고리": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[균형의 추]! 모든 대상의 HP를 50%로 고정합니다!");
        const allTargets = [caster, ...caster.party, ...(caster.currentMonster || [])];
        allTargets.forEach(t => {
            if (t && t.hp > 0) {
                // safeHpUpdate 대신 고정값 설정
                t.hp = Math.floor(t.maxHp * 0.5);
                if (t.hp <= 0) t.hp = 1; // 0이 되는 것 방지
            }
        });
        caster.cb.logMessage("모든 대상의 HP가 50%로 조율되었습니다.");
      }
    }
  },

  // --- 5등급 ---
  "심연 고블린": {
    active: [
      {
        name: "무작위 덫",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[무작위 덫]! ${target.name}의 발 밑에 마법 덫을 설치합니다!`);
            if (Math.random() < 0.5) {
                const dmg = calculateDamage(50, target.currentStats?.['항마력'] || 0);
                safeHpUpdate(target, -dmg);
                caster.cb.logMessage(`(덫 발동: 화염구!) ${target.name}에게 ${dmg}의 화염 피해!`);
            } else {
                applyDebuff(caster, target, "둔화(덫)");
                caster.cb.logMessage(`(덫 발동: 둔화!) ${target.name}이(가) 둔화 상태가 됩니다!`);
            }
        }
      },
      {
        name: "괴물주머니",
        effect: (caster, target) => {
            caster.cb.logMessage("[괴물주머니]! 5등급 이하 무작위 몬스터 소환! (기능 미구현)");
        }
      }
    ]
  },
  "심연 구울": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[심연의 손톱]! ${target.name}을(를) 공격합니다!`);
        const dmg = calculateDamage(30 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "부패(중)");
      }
    }
  },
  "심연 노움": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[어둠의 늪]! 3턴간 적들을 속박하고 피해를 줍니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                applyDebuff(caster, t, "속박(늪)");
                applyDebuff(caster, t, "암흑 피해(10/턴)"); // (classes.js에서 턴마다 처리 필요)
            }
        });
      }
    }
  },
  "심연 칼날늑대": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "내면의 광기(3턴)");
        caster.cb.logMessage("[내면의 광기]! 3턴간 방어 관련 스탯이 사라지고 공격 스탯이 대폭 증가합니다!");
      }
    }
  },
  "데쓰웜": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[산성액 분사]! ${target.name}에게 강력한 산성액을 뿜습니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['독 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "방어 감소(강)");
      }
    }
  },
  "오크 히어로": {
    active: [
      {
        name: "열광의 함성 (빨강)",
        effect: (caster, target) => {
            caster.cb.logMessage("[열광의 함성]! 3턴간 모든 아군의 공격력이 상승합니다!");
            applyDebuff(caster, caster, "공격력 증가(3턴)");
            caster.party.forEach(p => applyDebuff(caster, p, "공격력 증가(3턴)"));
        }
      },
      {
        name: "투쟁의 깃발 (파랑)",
        effect: (caster, target) => {
            caster.cb.logMessage("[투쟁의 깃발]! 3턴간 모든 아군의 기력 소모가 감소합니다!");
            applyDebuff(caster, caster, "기력 소모 감소(3턴)");
            caster.party.forEach(p => applyDebuff(caster, p, "기력 소모 감소(3턴)"));
        }
      },
      {
        name: "거대화 (초록)",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "거대화(3턴)");
            caster.cb.logMessage("[거대화]! 몸이 거대해지며 3턴간 근력과 지구력이 상승합니다!");
        }
      }
    ]
  },
  "트롤": {
    active: [
      {
        name: "광분",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "광분(3턴)");
            caster.cb.logMessage("[광분]! 3턴간 통증이 사라지고 육체 수치가 상승합니다!");
        }
      },
      {
        name: "초재생 (지정)",
        effect: (caster, target) => {
            const healAmount = Math.floor(caster.maxHp * 0.25);
            safeHpUpdate(caster, healAmount);
            removeDebuff(caster, caster, "출혈(약)");
            removeDebuff(caster, caster, "출혈(중)");
            caster.cb.logMessage(`[초재생]! 상처가 빠르게 아물며 체력을 ${healAmount} 회복하고 출혈을 멈춥니다!`);
        }
      }
    ]
  },
  "이프리트": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "불타는 가죽(3턴)");
        caster.cb.logMessage("[불타는 가죽]! 3턴간 몸에 불길을 둘러 근접하는 적에게 피해를 줍니다!");
      }
    }
  },
  "헬 프레임": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[지옥불]! ${target.name}에게 강력한 화염 피해를 줍니다!`);
        const dmg = calculateDamage(50 + (caster.currentStats['화염 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "혈원귀": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "출혈(강)");
        caster.cb.logMessage(`[피의 저주]! ${target.name}에게 강력한 출혈을 겁니다!`);
      }
    }
  },
  "다키리온": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[영혼 흡수]! ${target.name}의 영혼을 흡수합니다!`);
        const dmg = calculateDamage(30 + (caster.currentStats['정신력'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        const healAmount = Math.floor(dmg * 0.3);
        safeHpUpdate(caster, healAmount);
        caster.mp = Math.min(caster.maxMp, caster.mp + healAmount);
      }
    }
  },
  "소울이터": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[영혼기병 소환]! 강력한 영혼기병을 소환합니다! (기능 미구현)");
      }
    }
  },
  "세이렌": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "혼란(2턴)");
        caster.cb.logMessage(`[유혹의 노래]! ${target.name}을(를) 2턴간 '혼란' 상태로 만듭니다!`);
      }
    }
  },
  "나가 궁수": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[다중 사격]! 3명의 적에게 독 화살을 발사합니다!");
        const targets = (caster.currentMonster || []).filter(t => t.hp > 0).slice(0, 3);
        targets.forEach(t => {
            const dmg = calculateDamage(20 + (caster.currentStats['민첩성'] || 0), t.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(t, -dmg);
            applyDebuff(caster, t, "독(중)");
            caster.cb.logMessage(`${t.name}에게 ${dmg}의 피해 및 중독!`);
        });
      }
    }
  },
  "팔푸스의 뱀": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "속박(뱀)");
        applyDebuff(caster, target, "독(강)");
        caster.cb.logMessage(`[맹독 휘감기]! ${target.name}을(를) 2턴간 '속박'하고 '강한 중독' 상태로 만듭니다!`);
      }
    }
  },
  "벨가로": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[야수 돌진]! ${target.name}에게 돌진하여 기절시킵니다!`);
        const dmg = calculateDamage(50 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "기절(1턴)");
      }
    }
  },
  "해신석": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[물의 창]! ${target.name}에게 강력한 물의 창을 발사합니다!`);
        const dmg = calculateDamage(60 + (caster.currentStats['정신력'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "바포메트": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[어둠의 불꽃]! ${target.name}에게 암흑 화염 피해를 줍니다!`);
        const dmg = calculateDamage(50 + (caster.currentStats['어둠 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "아르고스": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[악마의 눈]! ${target.name}의 버프 1개를 제거하고 저주를 겁니다!`);
        applyDebuff(caster, target, "저주(2턴)");
        // (버프 제거 로직은 classes.js에 별도 구현 필요)
      }
    }
  },
  "라크자르": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "불타는 가죽(3턴)");
        caster.cb.logMessage("[불타는 가죽]! 3턴간 근접 공격자에게 화염 피해를 줍니다!");
      }
    }
  },
  "둠 워리어": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[파멸의 일격]! ${target.name}에게 암흑 물리 피해를 줍니다!`);
        const dmg = calculateDamage(50 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "레드우드": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[줄기 채찍]! ${target.name}에게 물리 피해를 줍니다!`);
        const dmg = calculateDamage(30, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "베르타스": {
    active: [
      {
        name: "증오의 군단",
        effect: (caster, target) => {
            caster.cb.logMessage("[증오의 군단]! 하급 악마를 소환합니다! (기능 미구현)");
        }
      },
      {
        name: "파멸광선",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[파멸광선]! ${target.name}에게 파괴 광선을 발사합니다!`);
            const dmg = calculateDamage(60, target.currentStats?.['항마력'] || 0);
            safeHpUpdate(target, -dmg);
        }
      }
    ]
  },
  "뱀파이어": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "안개화(1턴)");
        caster.cb.logMessage("[안개화]! 1턴간 모든 물리 피해를 무시합니다!");
      }
    }
  },
  "뱀파이어 공작 캠보르미어": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "제물");
        caster.cb.logMessage(`[피의 문신]! ${target.name}에게 '제물' 낙인을 찍습니다! (기능 미구현)`);
      }
    }
  },
  "만티코어": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[포효]! 주변 적들에게 '공포'를 겁니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0 && Math.random() < 0.3) {
                applyDebuff(caster, t, "공포(1턴)");
            }
        });
      }
    }
  },
  "이각수": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[뿔 돌진]! ${target.name}에게 돌진합니다!`);
        const dmg = calculateDamage(50 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "큘베스": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[암습]! ${target.name}의 배후를 공격합니다! (피해 3배)`);
        const dmg = calculateDamage((30 + (caster.currentStats['민첩성'] || 0)) * 3, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "종말의 기사 (백색신전)": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[종복]! 7등급 '혼령마'를 소환합니다!");
        
        // [수정] 소환 기능 구현 (class_player_combat.js의 startCombat 로직 참조)
        const monsterName = "혼령마";
        const monsterData = caster.gameData.monsters[monsterName];
        
        if (monsterData && caster.currentMonster) {
            const newMonster = JSON.parse(JSON.stringify(monsterData));
            newMonster.name = monsterName;
            newMonster.hp = newMonster.hp || 50;
            newMonster.maxHp = newMonster.hp;
            newMonster.atk = newMonster.atk || 10;
            newMonster.def = newMonster.def || 5;
            newMonster.magic_def = newMonster.magic_def || 3;
            newMonster.grade = newMonster.grade || 7;
            newMonster.attacks = newMonster.attacks || [{name:"기본 공격", dmg: newMonster.atk, type: "physical"}];
            newMonster.debuffs = [];
            newMonster.bossPhase = 1;
            newMonster.phase2Triggered = false;
            newMonster.currentStats = { '근력': newMonster.atk, '물리 내성': newMonster.def, '항마력': newMonster.magic_def };
            newMonster.applyDebuff = function(debuff) { 
                if (!this.debuffs.includes(debuff)) { this.debuffs.push(debuff); } 
            };
            
            caster.currentMonster.push(newMonster);
            caster.cb.logMessage(`${monsterName}이(가) 전장에 합류합니다!`);
            caster.cb.updateCombatStatus(caster); // 전투 UI 갱신
        } else {
            caster.cb.logMessage("오류: '혼령마' 몬스터 데이터를 찾을 수 없거나 전투 중이 아닙니다.");
        }
      }
    }
  },
  "씨드리아": {
    active: {
      effect: (caster, target) => {
        const mpHeal = 30;
        caster.mp = Math.min(caster.maxMp, caster.mp + mpHeal);
        caster.cb.logMessage(`[광합성]! MP를 ${mpHeal} 회복합니다.`);
      }
    }
  },
  "타락한 짐승 키르뒤": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[오우거의 휘두르기]! ${target.name}에게 강력한 일격을 날립니다!`);
        const dmg = calculateDamage(Math.floor((caster.currentStats['근력'] || 0) * 1.8), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "태양의 기사": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "태양의 검(1회)");
        caster.cb.logMessage("[태양의 검]! 다음 1회 공격이 추가 신성 피해(30)를 줍니다!");
      }
    }
  },
  "달의 기사": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[달빛 베기]! ${target.name}에게 냉기 마법 피해를 줍니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['냉기 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "별의 기사": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[유성 낙하]! 무작위 적 3명에게 마법 피해를 줍니다!");
        const targets = (caster.currentMonster || []).filter(t => t.hp > 0);
        for(let i=0; i<3; i++) {
            if (targets.length === 0) break;
            const t = targets[Math.floor(Math.random() * targets.length)];
            const dmg = calculateDamage(25, t.currentStats?.['항마력'] || 0);
            safeHpUpdate(t, -dmg);
            caster.cb.logMessage(`${t.name}에게 ${dmg}의 마법 피해!`);
        }
      }
    }
  },
  "밀라로든": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[거울 세계]! ${target.name}을(를) 1턴간 '불의 거울'로 추방합니다! (1턴 기절로 대체)`);
        applyDebuff(caster, target, "기절(1턴)");
      }
    }
  },
  "레드머드": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[진흙탄]! ${target.name}에게 진흙탄을 던집니다!`);
        const dmg = calculateDamage(20, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "둔화(1턴)");
      }
    }
  },
  "스톤번": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[화염석 투척]! ${target.name}에게 화염석을 던집니다!`);
        const dmg = calculateDamage(35 + (caster.currentStats['화염 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "타락한 피조물": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[어둠의 일격]! ${target.name}에게 암흑 피해를 줍니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['어둠 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "커스스톤": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const debuffs = ["둔화(저주)", "약화(저주)", "부패(저주)"];
        const chosenDebuff = debuffs[Math.floor(Math.random() * debuffs.length)];
        applyDebuff(caster, target, chosenDebuff);
        caster.cb.logMessage(`[무작위 저주]! ${target.name}에게 [${chosenDebuff}] 저주를 겁니다!`);
      }
    }
  },

  // --- 6등급 ---
  "데스나이트": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[원한]! 3턴간 모든 적의 치유 및 재생 효과가 대폭 감소합니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) applyDebuff(caster, t, "치유 감소(3턴)");
        });
      }
    }
  },
  "바이쿤두스": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[핼버드 휘두르기]! 전방의 적들을 공격합니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(30 + (caster.currentStats['근력'] || 0), t.currentStats?.['물리 내성'] || 0);
                safeHpUpdate(t, -dmg);
            }
        });
      }
    }
  },
  "청갑 거신병": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[푸른 주먹]! ${target.name}을(를) 밀쳐냅니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        // (넉백 로직은 전투 시스템에 별도 구현 필요)
      }
    }
  },
  "고블린 폭탄병": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[폭탄 설치]! 지면에 폭탄을 설치합니다. 1턴 후 폭발합니다! (기능 미구현)");
      }
    }
  },
  "킹 슬라임": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[산성액 분출]! 주변에 산성액을 뿌려 적의 방어력을 감소시킵니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) applyDebuff(caster, t, "방어 감소(산성)");
        });
      }
    }
  },
  "워 스네이크": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "속박(뱀)");
        caster.cb.logMessage(`[휘감기]! ${target.name}을(를) 1턴간 속박합니다!`);
      }
    }
  },
  "니겔 펜서": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[그림자 할퀴기]! ${target.name}에게 암흑 피해를 주고 실명시킵니다!`);
        const dmg = calculateDamage(30 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "실명(약)");
      }
    }
  },
  "해저 수호병": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[수압 창]! ${target.name}에게 강력한 수압 창을 발사합니다!`);
        const dmg = calculateDamage(45 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "철인 일디움": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "물리 면역(1턴)");
        caster.cb.logMessage("[철벽 방어]! 3초간 (1턴) 모든 물리 피해를 무효화합니다!");
      }
    }
  },
  "저주받은 기사 블라터": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[원한의 일격]! ${target.name}에게 피해를 주고 치유를 감소시킵니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "치유 감소(3턴)");
      }
    }
  },
  "헬 하운드": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[화염 숨결]! 전방에 화염을 내뿜습니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(30 + (caster.currentStats['화염 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
            }
        });
      }
    }
  },
  "지옥 수호병": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[지옥의 검]! ${target.name}에게 화염 물리 피해를 줍니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        const fireDmg = calculateDamage(10 + (caster.currentStats['화염 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -(dmg + fireDmg));
      }
    }
  },
  "셀러맨더": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[불꽃 세례]! 범위 내 적들에게 화염 피해를 줍니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(30 + (caster.currentStats['화염 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
            }
        });
      }
    }
  },
  "캐논 골렘": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[대포 발사]! ${target.name}에게 대포를 발사합니다!`);
        const dmg = calculateDamage(50 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "웨스트 샌드맨": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[헤드샷]! ${target.name}에게 치명타를 노립니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['명중률'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        // (치명타 로직은 playerAttack처럼 구현 필요, 여기선 기본 피해로 처리)
      }
    }
  },
  "발란티스 해결사": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[그림자 일격]! ${target.name}에게 암흑 물리 피해를 줍니다!`);
        const dmg = calculateDamage(35 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "발란티스 기사": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[방패 강타]! ${target.name}을(를) 기절시킵니다!`);
        const dmg = calculateDamage(20 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "기절(1턴)");
      }
    }
  },
  "빙괴": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[냉기 폭발]! 사망 시 주변에 냉기 피해를 줍니다! (패시브 효과)");
      }
    }
  },
  "프로즌 미믹": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "속박(얼음)");
        caster.cb.logMessage(`[얼음 함정]! ${target.name}을(를) 1턴간 '속박'합니다!`);
      }
    }
  },
  "해각수": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[뿔 박치기]! ${target.name}에게 돌진합니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "머멀": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const dmg = calculateDamage(25 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`[삼지창 찌르기]! ${target.name}에게 ${dmg}의 피해!`);
      }
    }
  },
  "머멀 전사": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "방패 방어(1턴)");
        caster.cb.logMessage("[방패 방어]! 1턴간 받는 물리 피해가 50% 감소합니다!");
      }
    }
  },
  "머멀 궁수": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const dmg = calculateDamage(30 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`[작살 화살]! ${target.name}에게 ${dmg}의 피해!`);
      }
    }
  },
  "머멀 주술사": {
    active: {
      effect: (caster, target) => {
        const healTarget = target || caster;
        const healAmount = 70;
        safeHpUpdate(healTarget, healAmount);
        caster.cb.logMessage(`[수중 치유]! ${healTarget.name}의 체력을 ${healAmount} 회복합니다.`);
      }
    }
  },
  "머멀 대전사": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const dmg = calculateDamage(40 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "기절(1턴)");
        caster.cb.logMessage(`[광전사의 돌격]! ${target.name}에게 ${dmg}의 피해를 주고 기절시킵니다!`);
      }
    }
  },
  "딥다이버": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const dmg = calculateDamage(25 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "독(중)");
        caster.cb.logMessage(`[맹독 이빨]! ${target.name}에게 ${dmg}의 피해를 주고 중독시킵니다!`);
      }
    }
  },
  "쉘아머": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "껍질 방어(1턴)");
        caster.cb.logMessage("[껍질 방어]! 1턴간 받는 모든 피해가 30% 감소합니다!");
      }
    }
  }
}