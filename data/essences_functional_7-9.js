// 이 파일은 7, 8, 9, 10, Null 등급 정수의
// 'active' 스킬 effect(함수)를 정의합니다.
// 이 파일은 main.js에서 GameData.essences에 병합됩니다.

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
        if (target.debuffs.includes("진압(1턴)")) {
            target.debuffs = target.debuffs.filter(d => d !== "진압(1턴)");
        }
        if (target.debuffs.includes("수면(1턴)")) {
            target.debuffs = target.debuffs.filter(d => d !== "수면(1턴)");
        }
        if (target.debuffs.includes("석화(1턴)")) {
            target.debuffs = target.debuffs.filter(d => d !== "석화(1턴)");
        }
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

// --- 정수(Essences) 함수 구현부 ---
export const essences = {
  "시체골렘": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const targets = Array.isArray(target) ? target : [target];
        caster.cb.logMessage("[살점폭발]! 부패한 살점이 폭발합니다!");
        targets.forEach(t => {
            const dmg = calculateDamage(25 + (caster.currentStats['근력'] || 0), t.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(t, -dmg);
            applyDebuff(caster, t, "독(산성)");
            caster.cb.logMessage(`${t.name}에게 ${dmg}의 물리 피해를 주고 중독시켰습니다!`);
        });
      }
    }
  },
  "본 나이트": {
    active: [
      {
        name: "생기 흡수 (갈망)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            const dmg = calculateDamage(15 + (caster.currentStats['절삭력'] || 0), target.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(target, -dmg);
            const healAmount = Math.floor(dmg * 0.5); // 50% 흡수
            safeHpUpdate(caster, healAmount);
            caster.cb.logMessage(`[생기 흡수]! ${target.name}에게 ${dmg}의 피해를 입히고, 체력을 ${healAmount} 회복했습니다!`);
        }
      },
      {
        name: "슬픔의 안개 (슬픔)",
        effect: (caster, target) => {
            caster.cb.logMessage("[슬픔의 안개]! 정신을 착란시키는 안개를 내뿜습니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0 && Math.random() < 0.4) {
                    applyDebuff(caster, t, "혼란(1턴)");
                }
            });
        }
      },
      {
        name: "영혼 베기 (증오)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage("[영혼 베기]! 대상의 영혼에 상처를 입히려 시도합니다!");
            if (Math.random() < 0.01) { // 1% 극악의 확률
                caster.cb.logMessage(`치명타! ${target.name}의 레벨이 1 하락합니다! (기능 미구현)`);
            } else {
                caster.cb.logMessage("...하지만 아무 일도 일어나지 않았습니다.");
            }
        }
      }
    ]
  },
  "아이안트로": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "넉백 면역(3턴)");
        caster.cb.logMessage("[균형추]! 3턴간 넉백 면역 상태가 되고 충격 흡수율이 증가합니다!");
      }
    }
  },
  "하프 트롤": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "광분(3턴)");
        caster.cb.logMessage("[광분]! 3턴간 통증이 사라지고 육체 수치가 상승합니다!");
      }
    }
  },
  "카나바로": {
    active: [
      {
        name: "마력 지뢰 (빨강)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            const targets = Array.isArray(target) ? target : [target];
            caster.cb.logMessage(`[마력 지뢰]! ${targets.map(t=>t.name).join(', ')}의 발 밑에 보이지 않는 지뢰를 설치합니다!`);
            targets.forEach(t => {
                const dmg = calculateDamage(30 + (caster.currentStats['민첩성'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
                caster.cb.logMessage(`${t.name}이(가) 지뢰를 밟아 ${dmg}의 마법 피해! (HP: ${t.hp})`);
            });
        }
      },
      {
        name: "하운드 소환 (파랑)",
        effect: (caster, target) => {
            caster.cb.logMessage("[하운드 소환]! 추적용 들개를 소환합니다! (기능 미구현)");
        }
      },
      {
        name: "추격 화살 (초록)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            const targets = Array.isArray(target) ? target : [target];
            caster.cb.logMessage(`[추격 화살]! ${targets.map(t=>t.name).join(', ')}에게 명중률이 높은 화살을 발사합니다!`);
             targets.forEach(t => {
                const dmg = calculateDamage(35 + (caster.currentStats['명중률'] || 0), t.currentStats?.['물리 내성'] || 0);
                safeHpUpdate(t, -dmg);
                caster.cb.logMessage(`${t.name}에게 ${dmg}의 관통 피해! (HP: ${t.hp})`);
            });
        }
      }
    ]
  },
  "미믹": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[보물창고]! 개인 아공간 창고를 엽니다. (기능 미구현)");
      }
    }
  },
  "폭군 타룬바스": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const targets = Array.isArray(target) ? target : [target];
        caster.cb.logMessage(`[얼음 몽둥이]! ${targets.map(t=>t.name).join(', ')}에게 냉기 공격을 합니다!`);
        targets.forEach(t => {
            const dmg = calculateDamage(20 + (caster.currentStats['근력'] || 0), t.currentStats?.['물리 내성'] || 0);
            const coldDmg = calculateDamage(15 + (caster.currentStats['냉기 감응도'] || 0), t.currentStats?.['항마력'] || 0);
            safeHpUpdate(t, -(dmg + coldDmg));
            applyDebuff(caster, t, "둔화(서리)");
            caster.cb.logMessage(`${t.name}에게 ${dmg}의 물리 피해와 ${coldDmg}의 냉기 피해를 입히고 둔화시켰습니다! (HP: ${t.hp})`);
        });
      }
    }
  },
  "홉 고블린": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
         caster.cb.logMessage(`[독성 부여]! ${target.name}에게 독 공격을 합니다!`);
         applyDebuff(caster, target, "중독(중)");
      }
    }
  },
  "무명 조각상": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[응답없는 기도]... MP를 소모하여 기도합니다.");
        if (Math.random() < 0.1) { // 10% 성공 확률 (플레이어 기준)
            caster.cb.logMessage("기도가 응답받았습니다! (임시로 MP 50 회복)");
            caster.mp = Math.min(caster.maxMp, caster.mp + 50);
        } else {
            caster.cb.logMessage("...하지만 아무 일도 일어나지 않았습니다.");
        }
      }
    }
  },
  "씨웜": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "속박(거품)");
        caster.cb.logMessage(`[거품방울]! ${target.name}을(를) 거품에 가둡니다!`);
      }
    }
  },
  "플미나스": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const targets = Array.isArray(target) ? target : [target];
        caster.cb.logMessage(`[천둥가시]! ${targets.map(t=>t.name).join(', ')}에게 번개 가시를 발사합니다!`);
        targets.forEach(t => {
            const dmg = calculateDamage(25 + (caster.currentStats['번개 감응도'] || 0), t.currentStats?.['항마력'] || 0);
            safeHpUpdate(t, -dmg);
            caster.cb.logMessage(`${t.name}에게 ${dmg}의 번개 피해! (HP: ${t.hp})`);
        });
      }
    }
  },
  "어둠숭배자": {
    active: {
      effect: (caster, target) => {
        const healTarget = target || caster; // 대상 지정이 없으면 자신
        const healAmount = 30 + Math.floor((caster.currentStats['정신력'] || 0) * 0.8);
        safeHpUpdate(healTarget, healAmount);
        caster.cb.logMessage(`[차오르는 살점]! 어둠의 힘이 ${healTarget.name}의 체력을 ${healAmount} 회복시킵니다.`);
      }
    }
  },
  "데스핀드": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[망자의 부름]! '구울'을 소환합니다! (기능 미구현)");
      }
    }
  },
  "스톤골렘": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "진압(1턴)");
        caster.cb.logMessage(`[진압]! ${target.name}을(를) 1턴간 행동 불가 상태로 만듭니다! (피격 시 해제)`);
      }
    }
  },
  "가고일": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "석화(1턴)");
        caster.cb.logMessage(`[석화]! ${target.name}을(를) 1턴간 석화 상태로 만듭니다!`);
      }
    }
  },
  "리자드맨 척후병": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[체온색적]! 적들의 위치를 감지합니다!");
        if (caster.inCombat) {
            caster.currentMonster.forEach(t => {
                if (t.hp > 0) applyDebuff(caster, t, "위치 발각(2턴)");
            });
            caster.cb.logMessage("모든 적의 회피율이 2턴간 감소합니다.");
        }
      }
    }
  },
  "리빙아머": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[긴급복원]! 장비의 쿨타임이 초기화됩니다! (기능 미구현)");
      }
    }
  },
  "아이언팔콘": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const targets = Array.isArray(target) ? target : [target];
        caster.cb.logMessage(`[철갑깃털]! ${targets.map(t=>t.name).join(', ')}에게 날카로운 깃털을 발사합니다!`);
        targets.forEach(t => {
            const dmg = calculateDamage(20 + Math.floor((caster.currentStats['민첩성'] || 0) * 0.8), t.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(t, -dmg);
            caster.cb.logMessage(`${t.name}에게 ${dmg}의 물리 피해! (HP: ${t.hp})`);
        });
      }
    }
  },
  "오크 주술사": {
    active: {
      effect: (caster, target) => {
        const buffTarget = target || caster; // 대상 지정이 없으면 자신에게 사용
        applyDebuff(caster, buffTarget, "열광(3턴)");
        caster.cb.logMessage(`[열광]! ${buffTarget.name}의 물리 내성이 3턴간 3배 (최대 300) 증가합니다!`);
      }
    }
  },
  "강철언덕 추격자": {
    active: [
      {
        name: "관통 화살 (빨강)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[관통 화살]! ${target.name}에게 강력한 화살을 발사합니다!`);
            const defense = Math.max(0, (target.currentStats?.['물리 내성'] || 0) - 20); // 방어 20 관통 (임의)
            const dmg = calculateDamage(25 + (caster.currentStats['민첩성'] || 0), defense);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${target.name}에게 ${dmg}의 관통 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "지형 분출 (파랑)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[지형 분출]! ${target.name}의 발 밑에서 바위가 솟아오릅니다!`);
            const dmg = calculateDamage(30, target.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${target.name}에게 ${dmg}의 물리 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "약점 포착 (노랑)",
        effect: (caster, target) => {
            caster.criticalHitBoost = true;
            caster.cb.logMessage("[약점 포착]! 다음 1회의 공격이 반드시 치명타가 됩니다!");
        }
      }
    ]
  },
  "프로그맨": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[점액 투척]! ${target.name}에게 끈적이는 점액을 던집니다!`);
        applyDebuff(caster, target, "둔화(점액)");
      }
    }
  },
  "맥구리": {
    active: [
      {
        name: "천둥가시 (노랑)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            const dmg = calculateDamage(15 + (caster.currentStats['번개 감응도'] || 0), target.currentStats?.['항마력'] || 0);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`[천둥가시]! ${target.name}에게 ${dmg}의 번개 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "철갑깃털 (녹색)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            const dmg = calculateDamage(15 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`[철갑깃털]! ${target.name}에게 ${dmg}의 물리 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "거품방울 (파랑)",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            applyDebuff(caster, target, "속박(거품)");
            caster.cb.logMessage(`[거품방울]! ${target.name}을(를) 거품에 가둡니다!`);
        }
      }
    ]
  },
  "고블린": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[덫 생성]! ${target.name}의 발 밑에 덫을 설치합니다!`);
        const dmg = calculateDamage(15, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "둔화(덫)");
        caster.cb.logMessage(`${target.name}이(가) 덫을 밟아 ${dmg}의 피해를 입고 둔화 상태가 됩니다.`);
      }
    }
  },
  "고블린 궁수": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "은신(1턴)");
        caster.cb.logMessage("[도둑걸음]을 사용해 몸을 숨깁니다. 1턴간 몬스터의 인식에서 벗어납니다.");
      }
    }
  },
  "노움": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "은신(일체화)");
        caster.cb.logMessage("[일체화]를 사용해 주변 지형과 동화합니다. 이동하거나 공격받기 전까지 은신합니다.");
      }
    }
  },
  "레이스": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[시체불꽃]! ${target.name}에게 암흑 화염을 발사합니다!`);
        const dmg = calculateDamage(15 + Math.floor((caster.currentStats['정신력'] || 0) * 0.5), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 암흑 화염 피해! (HP: ${target.hp})`);
      }
    }
  },
  "위치스램프": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage("[위치스램프 소환]! 작은 도깨비불이 적을 공격합니다!");
        const dmg = calculateDamage(10 + Math.floor((caster.currentStats['정신력'] || 0) * 0.2), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 화염 피해! (HP: ${target.hp})`);
      }
    }
  },
  "슬라임": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[분열]! 체력을 소모하여 작은 슬라임을 소환합니다! (기능 미구현)");
      }
    }
  },
  "칼날늑대": {
    active: {
      effect: (caster, target) => {
        caster.criticalHitBoost = true;
        caster.cb.logMessage("[급소 공격]! 다음 물리 공격의 치명타 확률이 크게 증가합니다!");
      }
    }
  },
  "심연어": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[심연의 숨결]! ${target.name}에게 어둠의 브레스를 발사합니다!`);
        const dmg = calculateDamage(20 + Math.floor((caster.currentStats['영혼력'] || 0) * 0.5), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 암흑 피해! (HP: ${target.hp})`);
      }
    }
  },
  "어비스 스켈레톤": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[뼈 창]! ${target.name}에게 어둠의 뼈 창을 던집니다!`);
        const dmg = calculateDamage(30 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 암흑 물리 피해! (HP: ${target.hp})`);
      }
    }
  },
  "벽두더지 여왕": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[땅 흔들기]! 지면이 흔들립니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) applyDebuff(caster, t, "둔화(지진)");
        });
      }
    }
  },
  "반달바위곰": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[휘둘러치기]! 전방의 모든 적을 공격합니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                 const dmg = calculateDamage(30 + (caster.currentStats['근력'] || 0), t.currentStats?.['물리 내성'] || 0);
                 safeHpUpdate(t, -dmg);
                 caster.cb.logMessage(`${t.name}에게 ${dmg}의 물리 피해! (HP: ${t.hp})`);
            }
        });
      }
    }
  },
  "불카르": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[화염 돌진]! ${target.name}에게 돌진합니다!`);
        const dmg = calculateDamage(30 + (caster.currentStats['화염 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 화염 피해! (HP: ${target.hp})`);
      }
    }
  },
  "샤벨타이거": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[도약 공격]! ${target.name}에게 도약합니다!`);
        const dmg = calculateDamage(35 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 물리 피해! (HP: ${target.hp})`);
      }
    }
  },
  "웨어울프": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[광란의 손톱]! ${target.name}을(를) 3회 할큅니다!`);
        for (let i = 0; i < 3; i++) {
            const dmg = calculateDamage(15 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${i+1}타! ${target.name}에게 ${dmg}의 피해! (HP: ${target.hp})`);
        }
      }
    }
  },
  "키메라 울프": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[화염 독 송곳니]! ${target.name}을(를) 공격합니다!`);
        const fireDmg = calculateDamage(15 + (caster.currentStats['화염 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        const poisonDmg = calculateDamage(15 + (caster.currentStats['독 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -(fireDmg + poisonDmg));
        applyDebuff(caster, target, "독(중)");
        caster.cb.logMessage(`${target.name}에게 ${fireDmg}의 화염 피해와 ${poisonDmg}의 독 피해를 입혔습니다!`);
      }
    }
  },
  "구울로드": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[부패 확산]! 모든 적에게 부패를 겁니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) applyDebuff(caster, t, "부패(강)");
        });
      }
    }
  },
  "듀라한": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[죽음의 돌진]! ${target.name}에게 돌진합니다!`);
        const dmg = calculateDamage(40 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "공포(1턴)");
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 피해를 입히고 공포 상태로 만들었습니다!`);
      }
    }
  },
  "거석병": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[바위 던지기]! ${target.name}에게 바위를 던집니다!`);
        const dmg = calculateDamage(30 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 물리 피해! (HP: ${target.hp})`);
      }
    }
  },
  "샌드웜": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[산성액 분사]! ${target.name}에게 산성액을 뿜습니다!`);
        applyDebuff(caster, target, "방어 감소(산성)");
      }
    }
  },
  "드레드피어": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[스며드는 공포]! 모든 적의 명중률을 3턴간 20% 감소시킵니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) applyDebuff(caster, t, "명중률 감소(3턴)");
        });
      }
    }
  },
  "베르자크": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[심연의 부름]! 모든 적에게 암흑 피해를 주고 시야를 차단합니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                 const dmg = calculateDamage(30, t.currentStats?.['항마력'] || 0);
                 safeHpUpdate(t, -dmg);
                 applyDebuff(caster, t, "시야 차단(1턴)");
            }
        });
      }
    }
  },
  "웜스톤": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "얼음 갑옷(3턴)");
        caster.cb.logMessage("[얼음 갑옷]! 3턴간 물리 내성이 +20 증가합니다!");
      }
    }
  },
  "강철언덕 수호병": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "방패 방어(1턴)");
        caster.cb.logMessage("[방패 방어]! 1턴간 받는 모든 물리 피해가 50% 감소합니다!");
      }
    }
  },
  "오크 대전사": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[파쇄]! ${target.name}을(를) 강하게 내리칩니다!`);
        const dmg = calculateDamage(30 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "방어 감소(1턴)");
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 피해를 입히고 방어력을 감소시켰습니다!`);
      }
    }
  },
  "스네트리": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "속박(나무)");
        caster.cb.logMessage(`[촉수 휘감기]! ${target.name}을(를) 1턴간 속박합니다!`);
      }
    }
  },
  "다이로우터": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[급습]! ${target.name}에게 빠르게 접근하여 공격합니다!`);
        const dmg = calculateDamage(25 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 물리 피해! (HP: ${target.hp})`);
      }
    }
  },
  "돌연변이 하급 정령": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[마력 화살]! ${target.name}에게 무작위 속성 화살을 발사합니다!`);
        const dmg = calculateDamage(25, target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 마법 피해! (HP: ${target.hp})`);
      }
    }
  },
  "호문쿨루스": {
    active: {
      effect: (caster, target) => {
        const healAmount = 30;
        safeHpUpdate(caster, healAmount);
        caster.cb.logMessage(`[작은 치유]! 자신의 체력을 ${healAmount} 회복합니다.`);
      }
    }
  },
  "아울베어": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[발톱 찍기]! ${target.name}을(를) 발톱으로 찍습니다!`);
        const dmg = calculateDamage(30 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 물리 피해! (HP: ${target.hp})`);
      }
    }
  },
  "드라이어드": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "매혹(1턴)");
        caster.cb.logMessage(`[매혹]! ${target.name}을(를) 1턴간 매혹합니다!`);
      }
    }
  },
  "예티": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[오한]! 주변에 냉기를 방출합니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                 const dmg = calculateDamage(15, t.currentStats?.['항마력'] || 0);
                 safeHpUpdate(t, -dmg);
                 applyDebuff(caster, t, "둔화(냉기)");
            }
        });
      }
    }
  },
  "아이스 오크": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[얼음 도끼]! ${target.name}에게 냉기 공격을 합니다!`);
        const dmg = calculateDamage(20 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        const coldDmg = calculateDamage(10 + (caster.currentStats['냉기 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -(dmg + coldDmg));
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 물리 피해와 ${coldDmg}의 냉기 피해! (HP: ${target.hp})`);
      }
    }
  },
  "아이스 오크 주술사": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "강철빙벽(1턴)");
        caster.cb.logMessage("[강철빙벽]! 1턴간 방어력이 100% 증가합니다!");
      }
    }
  },
  "홉고블린 광부": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[다이너마이트]! 광역 폭발을 일으킵니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                 const dmg = calculateDamage(30, t.currentStats?.['항마력'] || 0);
                 safeHpUpdate(t, -dmg);
            }
        });
      }
    }
  },
  "코퍼 골렘": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "진압(1턴)");
        caster.cb.logMessage(`[진압]! ${target.name}을(를) 1턴간 행동 불가 상태로 만듭니다!`);
      }
    }
  },
  "철기병": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[검기]! ${target.name}에게 검기를 날립니다!`);
        const dmg = calculateDamage(25 + (caster.currentStats['절삭력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`${target.name}에게 ${dmg}의 물리 피해! (HP: ${target.hp})`);
      }
    }
  },
  "아이언 리자드맨": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[방패 밀치기]! ${target.name}을(를) 기절시킵니다!`);
        const dmg = calculateDamage(10, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "기절(1턴)");
      }
    }
  },
  "거대칼날늑대": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[물어뜯기]! ${target.name}을(를) 물어뜯습니다!`);
        const dmg = calculateDamage(20 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "출혈(약)");
      }
    }
  },
  "핏빛칼날늑대": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[상처 찢기]! ${target.name}의 상처를 공격합니다!`);
        let dmg = calculateDamage(20 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        if (target.debuffs && target.debuffs.some(d => d.startsWith("출혈"))) {
            dmg += 25;
            caster.cb.logMessage("대상이 출혈 상태라 추가 피해를 입힙니다!");
        }
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "벽두더지": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "은신(땅 숨기)");
        caster.cb.logMessage("[땅 숨기]! 1턴간 땅 속으로 숨어 무적 상태가 됩니다.");
      }
    }
  },
  "엘더 구울": {
    active: {
      effect: (caster, target) => {
        const healAmount = 50;
        safeHpUpdate(caster, healAmount);
        caster.cb.logMessage(`[강력한 탐식]! 자신의 체력을 ${healAmount} 회복합니다.`);
      }
    }
  },
  "스켈레톤 전사": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[방패 밀치기]! ${target.name}을(를) 기절시킵니다!`);
        const dmg = calculateDamage(10, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "기절(1턴)");
      }
    }
  },
  "스켈레톤 궁수": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[독화살]! ${target.name}에게 독화살을 쏩니다!`);
        const dmg = calculateDamage(15, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "독(약)");
      }
    }
  },
  "스켈레톤 메이지": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[약한 화염구]! ${target.name}에게 화염구를 쏩니다!`);
        const dmg = calculateDamage(25, target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "벤시": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "저주(방어 감소)");
        caster.cb.logMessage(`[원한의 징표]! ${target.name}의 방어력을 3턴간 10 감소시킵니다!`);
      }
    }
  },
  "코볼트 방패병": {
    active: {
      effect: (caster, target) => {
         if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[방패 밀치기]! ${target.name}을(를) 기절시킵니다!`);
        const dmg = calculateDamage(10, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "기절(1턴)");
      }
    }
  },
  "타락한 노움": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "은신(어둠)");
        caster.cb.logMessage("[어둠의 일체화]! 은신 상태가 되며 다음 공격이 강화됩니다!");
      }
    }
  },
  "샌드맨": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "수면(1턴)");
        caster.cb.logMessage(`[수면 가루]! ${target.name}을(를) 1턴간 수면 상태로 만듭니다! (피격 시 해제)`);
      }
    }
  },
  "오크 전사": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "강타(1회)");
        caster.cb.logMessage("[강타]! 다음 1회 공격의 피해량이 50% 증가합니다!");
      }
    }
  },
  "오크 궁수": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[독화살]! ${target.name}에게 독화살을 쏩니다!`);
        const dmg = calculateDamage(15, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "독(약)");
      }
    }
  },
  "우드맨": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "속박(나무)");
        caster.cb.logMessage(`[뿌리 속박]! ${target.name}을(를) 1턴간 속박합니다!`);
      }
    }
  },
  "아이스 골렘": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[빙결 강타]! ${target.name}에게 냉기 공격을 합니다!`);
        const dmg = calculateDamage(25 + (caster.currentStats['냉기 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "둔화(냉기)");
      }
    }
  },
  "그렘린": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[기계 교란]! ${target.name}을(를) 공격합니다!`);
        let dmg = calculateDamage(10, target.currentStats?.['물리 내성'] || 0);
        if (target.race === "골렘" || target.name.includes("골렘")) { // 임시 골렘 타입 체크
            dmg += 50;
            caster.cb.logMessage("골렘 타입에게 추가 피해!");
        }
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "혼돈충": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "혼란(1턴)");
        caster.cb.logMessage(`[혼란의 빛]! ${target.name}을(를) 1턴간 혼란 상태로 만듭니다!`);
      }
    }
  },
  "고블린 광부": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[광물 탐색]! (패시브 효과, 비전투 시 '강철 조각' 획득 확률 증가)");
      }
    }
  },
  "광물 슬라임": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[산성액]! ${target.name}에게 약한 독 피해를 줍니다.`);
        const dmg = calculateDamage(10, target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "독(약)");
      }
    }
  },
  "배리드언": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        applyDebuff(caster, target, "속박(무덤)");
        caster.cb.logMessage(`[무덤의 손]! ${target.name}을(를) 1턴간 속박합니다!`);
      }
    }
  },
  "수호자의 눈": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[마력 광선]! ${target.name}에게 마력 광선을 쏩니다!`);
        const dmg = calculateDamage(25, target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "코볼트 총잡이": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[연사]! ${target.name}에게 2회 사격합니다!`);
        for (let i = 0; i < 2; i++) {
            const dmg = calculateDamage(10, target.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(target, -dmg);
        }
      }
    }
  },
  "데드맨": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const dmg = calculateDamage(5, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`[약한 물어뜯기]! ${target.name}에게 ${dmg}의 피해!`);
      }
    }
  },
  "병사 데드맨": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const dmg = calculateDamage(8, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`[찌르기]! ${target.name}에게 ${dmg}의 피해!`);
      }
    }
  },
  "지휘관 데드맨": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[뿔피리]! 주변의 데드맨을 부릅니다! (기능 미구현)");
      }
    }
  },
  "스컬 랫": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const dmg = calculateDamage(2, target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`[할퀴기]! ${target.name}에게 ${dmg}의 피해!`);
      }
    }
  },
  "혼돈의 정령": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        const dmg = calculateDamage(10, target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        caster.cb.logMessage(`[혼돈의 불꽃]! ${target.name}에게 ${dmg}의 혼합 피해!`);
      }
    }
  },
  "짐승": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "섬의 권능(3턴)");
        caster.cb.logMessage("[섬의 권능]! 3턴간 모든 스탯이 20% 상승합니다!");
      }
    }
  }
}