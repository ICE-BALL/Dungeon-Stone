// 이 파일은 1, 2, 3 등급 정수의
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
  // --- 1등급 ---
  "종말의 기사": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[종복]! 7등급 '혼령마'를 소환합니다! (기능 미구현)");
      }
    }
  },
  "레비아탄": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[해일]! 거대한 해일이 모든 적을 덮칩니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(150 + (caster.currentStats['모든 속성 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
                caster.cb.logMessage(`${t.name}에게 ${dmg}의 막대한 물 속성 피해!`);
            }
        });
      }
    }
  },
  "카샨": {
    active: [
      {
        name: "삼미안",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage("[삼미안]! 3개의 꼬리에서 광선이 발사됩니다!");
            const t = Array.isArray(target) ? target[0] : target; // 단일 대상 지정
            // 좌(마법/저주)
            const dmg1 = calculateDamage(70 + (caster.currentStats['정신력'] || 0), t.currentStats?.['항마력'] || 0);
            safeHpUpdate(t, -dmg1);
            applyDebuff(caster, t, "저주(강)");
            caster.cb.logMessage(`(좌) ${t.name}에게 ${dmg1}의 마법 피해 및 강력한 저주!`);
            // 우(물리/방깎)
            const dmg2 = calculateDamage(70 + (caster.currentStats['근력'] || 0), t.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(t, -dmg2);
            applyDebuff(caster, t, "방어 감소(강)");
            caster.cb.logMessage(`(우) ${t.name}에게 ${dmg2}의 물리 피해 및 방어 감소!`);
            // 중앙(혼합/소환)
            const dmg3 = calculateDamage(70, (t.currentStats?.['물리 내성'] || 0 + t.currentStats?.['항마력'] || 0) / 2);
            safeHpUpdate(t, -dmg3);
            caster.cb.logMessage(`(중앙) ${t.name}에게 ${dmg3}의 혼합 피해! (소환 미구현)`);
        }
      },
      {
        name: "수명약탈",
        effect: (caster, target) => {
            caster.cb.logMessage("[수명약탈]! 적들의 생명력을 강탈합니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            let totalHeal = 0;
            targets.forEach(t => {
                if (t.hp > 0) {
                    const dmg = calculateDamage(50, t.currentStats?.['항마력'] || 0);
                    safeHpUpdate(t, -dmg);
                    totalHeal += Math.floor(dmg * 0.8); // 80% 흡수
                    caster.cb.logMessage(`${t.name}에게 ${dmg}의 피해를 입혔습니다.`);
                }
            });
            safeHpUpdate(caster, totalHeal);
            caster.cb.logMessage(`총 ${totalHeal}의 체력을 회복했습니다!`);
        }
      },
      {
        name: "종말의 불",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[종말의 불]! ${target.name}의 위치에 불기둥이 솟아오릅니다!`);
            const dmg = calculateDamage(100 + (caster.currentStats['화염 감응도'] || 0), target.currentStats?.['항마력'] || 0);
            safeHpUpdate(target, -dmg);
        }
      },
      {
        name: "사형선고",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "사형선고(1회)");
            caster.cb.logMessage("[사형선고]! 다음 1회의 공격이 행운에 비례하여 증폭됩니다! (행운 10당 200%)");
        }
      },
      {
        name: "운명교차",
        effect: (caster, target) => {
            caster.cb.logMessage("[운명교차]! 특수 스킬 발동! (기능 미구현)");
        }
      }
    ]
  },
  "스닉투라": {
    active: [
      {
        name: "멸망의 씨앗",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[멸망의 씨앗]! ${target.name}에게 회피 불가의 평타 공격을 날립니다!`);
            const dmg = calculateDamage((caster.currentStats['근력'] || 0), 9999); // 회피 불가 (고정 피해)
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${target.name}에게 ${dmg}의 고정 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "독액분출",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[독액분출]! ${target.name}에게 [만독지체]로 강화된 독액을 발사합니다!`);
            const dmg = calculateDamage(50 + (caster.currentStats['독 감응도'] || 0), target.currentStats?.['항마력'] || 0);
            safeHpUpdate(target, -dmg);
            applyDebuff(caster, target, "독(최상급)");
        }
      },
      {
        name: "형태 변환",
        effect: (caster, target) => {
            caster.cb.logMessage("[형태 변환]! 다른 개체로 변이합니다! (기능 미구현)");
        }
      },
      {
        name: "불멸의 의지",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "초재생(1턴)");
            caster.cb.logMessage("[불멸의 의지]! 1턴간 자연 재생력이 1000 증가합니다!");
        }
      },
      {
        name: "치명적인 중독",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[치명적인 중독]! ${target.name}의 중독 효과를 8배 증폭시킵니다!`);
            // (실제 증폭은 classes.js의 턴 시작/종료 시 독 디버프 데미지 계산 로직 수정 필요)
        }
      }
    ]
  },
  "본 드래곤": {
    active: [
      {
        name: "본 브레스",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[본 브레스]! ${target.name}에게 흑색 광선을 발사합니다!`);
            const dmg = calculateDamage(120 + (caster.currentStats['근력'] || 0), target.currentStats?.['항마력'] || 0);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${target.name}에게 ${dmg}의 암흑 마법 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "흑마력의 가호",
        effect: (caster, target) => {
            caster.cb.logMessage("[흑마력의 가호]! 주변의 흑색 구슬들이 적들을 공격합니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
             targets.forEach(t => {
                if (t.hp > 0) {
                    const dmg = calculateDamage(40, t.currentStats?.['항마력'] || 0);
                    safeHpUpdate(t, -dmg);
                }
            });
        }
      },
      {
        name: "마법의 종주",
        effect: (caster, target) => {
            caster.cb.logMessage("[마법의 종주]! 2턴간 범위 내 모든 마법 효과가 10배 증가합니다! (기능 미구현)");
            applyDebuff(caster, caster, "마법 증폭(10배)");
        }
      }
    ]
  },
  "원시 정령": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[토성체]! 1km 내 모든 적을 이동 불가 상태로 만들고 중심으로 끌어당깁니다! (기능 미구현)");
      }
    }
  },
  "희망의 군주": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[희망의 축복]! 모든 아군의 디버프를 해제하고 3턴간 '상태이상 면역'을 부여합니다!");
        removeDebuff(caster, caster, "ALL");
        applyDebuff(caster, caster, "상태이상 면역(3턴)");
        caster.party.forEach(p => {
            removeDebuff(caster, p, "ALL");
            applyDebuff(caster, p, "상태이상 면역(3턴)");
        });
      }
    }
  },
  "기가제르오스": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[대방류]! 몸에서 전류를 방출시킵니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
         targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(100 + (caster.currentStats['번개 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
                caster.cb.logMessage(`${t.name}에게 ${dmg}의 번개 피해!`);
            }
        });
      }
    }
  },
  "드라이즌": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "무적(3턴)");
        caster.cb.logMessage("[꿈꾸는 연못]! 3턴간 모든 피해를 무효화하는 장막을 칩니다!");
      }
    }
  },
  "브라키아이스텔로": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[수압 폭발]! 범위 내 적들에게 강력한 수속성 피해를 줍니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
         targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(100 + (caster.currentStats['정신력'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
            }
        });
      }
    }
  },

  // --- 2등급 ---
  "오크 로드": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[대전사의 돌격]! ${target.name}에게 강력한 돌격을 감행합니다!`);
        const dmg = calculateDamage(80 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "천계의 창지기 밀라옐": {
    active: [
      {
        name: "재귀",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[재귀]! ${target.name}에게 회피 불가의 창을 던집니다!`);
            const dmg = calculateDamage(80 + (caster.currentStats['근력'] || 0), 9999); // 회피 불가 (고정 피해)
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${target.name}에게 ${dmg}의 관통 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "빛의 가호",
        effect: (caster, target) => {
            const healAmount = Math.floor(caster.maxHp * 0.5); // 50% 회복
            safeHpUpdate(caster, healAmount);
            applyDebuff(caster, caster, "내구성 증가(3턴)");
            caster.cb.logMessage(`[빛의 가호]! 체력을 ${healAmount} 회복하고 3턴간 내구성이 증가합니다!`);
        }
      },
      {
        name: "혜성분열",
        effect: (caster, target) => {
            caster.cb.logMessage("[혜성분열]! 투사체가 복제됩니다! (기능 미구현: 다음 공격 2배로 대체)");
            applyDebuff(caster, caster, "공격 2배(1회)");
        }
      },
      {
        name: "강림",
        effect: (caster, target) => {
            caster.cb.logMessage("[강림]! 빛의 날개로 비행하며 빛의 정령을 소환합니다! (기능 미구현)");
        }
      },
      {
        name: "껍질깨기",
        effect: (caster, target) => {
            caster.cb.logMessage("[껍질깨기]! 외피가 부서지며 본래의 모습을 드러냅니다!");
            applyDebuff(caster, caster, "공격력 대폭 증가(3턴)");
        }
      }
    ]
  },
  "인면조": {
    active: [
      {
        name: "종말의 노래",
        effect: (caster, target) => {
            caster.cb.logMessage("[종말의 노래]! 빛기둥이 쏟아집니다! (소환 미구현)");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) {
                    const dmg = calculateDamage(40, t.currentStats?.['항마력'] || 0);
                    safeHpUpdate(t, -dmg);
                    caster.cb.logMessage(`${t.name}에게 ${dmg}의 신성 피해! (HP: ${t.hp})`);
                }
            });
        }
      },
      {
        name: "파멸의 각인",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            applyDebuff(caster, target, "파멸의 각인(영구)");
            caster.cb.logMessage(`[파멸의 각인]! ${target.name}은(는) 이제 죽기 전까지 초당 1%의 생명력이 감소합니다!`);
        }
      },
      {
        name: "의태",
        effect: (caster, target) => {
            caster.cb.logMessage("[의태]! 무작위 스킬을 시전합니다! (기능 미구현)");
        }
      }
    ]
  },
  "이블루스": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "부활 제단(3회)");
        caster.cb.logMessage("[이교 제단]! 부활 제단을 설치합니다. (최대 3회 부활 가능)");
      }
    }
  },
  "몰락의 별 발란티스": {
    active: [
      {
        name: "일식",
        effect: (caster, target) => {
            caster.cb.logMessage("[일식]! 필드를 어둡게 만들고 공포를 유발합니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) applyDebuff(caster, t, "공포(2턴)");
            });
        }
      },
      {
        name: "부정 물질",
        effect: (caster, target) => {
            caster.cb.logMessage("[부정 물질]! 흑색 불꽃이 필드를 뒤덮습니다!");
             const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) {
                    const dmg = calculateDamage(50 + (caster.currentStats['항마력'] || 0), t.currentStats?.['항마력'] || 0);
                    safeHpUpdate(t, -dmg);
                    applyDebuff(caster, t, "부패(강)");
                }
            });
        }
      }
    ]
  },
  "말더 엘펀트": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[지진 발구르기]! 범위 내 모든 적에게 피해를 주고 기절시킵니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(60 + (caster.currentStats['근력'] || 0), t.currentStats?.['물리 내성'] || 0);
                safeHpUpdate(t, -dmg);
                applyDebuff(caster, t, "기절(1턴)");
            }
        });
      }
    }
  },
  "벤시 퀸": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[절규]! 범위 내 모든 적에게 '공포'와 '혼란'을 겁니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                applyDebuff(caster, t, "공포(2턴)");
                applyDebuff(caster, t, "혼란(2턴)");
            }
        });
      }
    }
  },
  "카오스씨먼": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[혼돈의 일격]! ${target.name}에게 강력한 암흑 피해를 줍니다!`);
        const dmg = calculateDamage(70 + (caster.currentStats['어둠 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "소울드링커": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[영혼 강탈]! ${target.name}의 MP를 50 강탈합니다!`);
        const mpDrain = 50;
        if (target.mp) target.mp = Math.max(0, target.mp - mpDrain);
        caster.mp = Math.min(caster.maxMp, caster.mp + mpDrain);
      }
    }
  },
  "기가울프": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[광란의 손톱]! ${target.name}을(를) 3회 할큅니다!`);
        for (let i = 0; i < 3; i++) {
            const dmg = calculateDamage(30 + (caster.currentStats['민첩성'] || 0), target.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${i+1}타! ${target.name}에게 ${dmg}의 피해! (HP: ${target.hp})`);
        }
      }
    }
  },
  "벨라리오스": {
    active: [
      {
        name: "탐욕의 비늘",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "마법 저항(3턴)");
            caster.cb.logMessage("[탐욕의 비늘]! 3턴간 마법 저항력이 상승하고, 받은 마법 피해만큼 물리 내성이 증가합니다!");
        }
      },
      {
        name: "재해",
        effect: (caster, target) => {
            caster.cb.logMessage("[재해]! 무작위 필드 효과를 적용합니다! (기능 미구현)");
        }
      },
      {
        name: "용의 보주",
        effect: (caster, target) => {
            caster.cb.logMessage("[용의 보주]! 모든 캐릭터의 자원 소모량이 12배 증가하고, 시전자가 영혼력을 흡수합니다! (기능 미구현)");
        }
      },
      {
        name: "파쇄",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[파쇄]! ${target.name}의 공간을 우그러뜨립니다!`);
            const dmg = calculateDamage(80 + (caster.currentStats['정신력'] || 0), 9999); // 회피/가드 불가 (고정 피해)
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${target.name}에게 ${dmg}의 고정 피해! (HP: ${target.hp})`);
        }
      }
    ]
  },
  "잠베트": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "은신(3턴)");
        caster.cb.logMessage("[은신]! 3턴간 '은신' 상태가 됩니다.");
      }
    }
  },
  "마이눔": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[돌진]! ${target.name}에게 돌진합니다!`);
        const dmg = calculateDamage(60 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "다크 크리스탈": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[어둠의 광선]! ${target.name}에게 암흑 마법 피해를 줍니다!`);
        const dmg = calculateDamage(70 + (caster.currentStats['어둠 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "볼-헤르찬": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[지면 강타]! 범위 내 모든 적에게 피해를 줍니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(50 + (caster.currentStats['근력'] || 0), t.currentStats?.['물리 내성'] || 0);
                safeHpUpdate(t, -dmg);
            }
        });
      }
    }
  },
  "본 드래고니안": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[뼈 폭풍]! 범위 내 적들에게 물리 피해를 줍니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(60 + (caster.currentStats['근력'] || 0), t.currentStats?.['물리 내성'] || 0);
                safeHpUpdate(t, -dmg);
            }
        });
      }
    }
  },
  "프로스트 가디언": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[빙결의 일격]! ${target.name}에게 냉기 피해를 주고 '빙결'시킵니다!`);
        const dmg = calculateDamage(60 + (caster.currentStats['냉기 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "빙결(1턴)");
      }
    }
  },
  "빙하 거인": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[빙하 강타]! ${target.name}에게 강력한 냉기 물리 피해를 줍니다!`);
        const dmg = calculateDamage(70 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "메르안": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[냉기 화살]! ${target.name}에게 냉기 피해를 줍니다!`);
        const dmg = calculateDamage(50 + (caster.currentStats['냉기 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "청염조": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[화염 돌진]! ${target.name}에게 돌진하여 화염 피해를 줍니다!`);
        const dmg = calculateDamage(60 + (caster.currentStats['화염 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "화이트 와이번": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[냉기 브레스]! 범위 내 적들에게 냉기 피해를 줍니다!");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(50 + (caster.currentStats['냉기 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
            }
        });
      }
    }
  },
  "카리아데아": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[영혼추출]! 모든 적을 기절시키고 영혼을 징벌의 함으로 인도합니다! (기능 미구현: 광역 기절로 대체)");
        const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                applyDebuff(caster, t, "기절(1턴)");
            }
        });
      }
    }
  },
  "데드레드": {
    active: {
      effect: (caster, target) => {
        caster.cb.logMessage("[별의 소멸]! 최강의 공격 스킬로 모든 적을 소멸시킵니다!");
         const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
        targets.forEach(t => {
            if (t.hp > 0) {
                const dmg = calculateDamage(200 + (caster.currentStats['어둠 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                safeHpUpdate(t, -dmg);
                caster.cb.logMessage(`${t.name}에게 ${dmg}의 파괴적인 암흑 피해!`);
            }
        });
      }
    }
  },
  "심연 골렘": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[어둠의 강타]! ${target.name}에게 강력한 암흑 물리 피해를 줍니다!`);
        const dmg = calculateDamage(70 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },

  // --- 3등급 ---
  "오우거": {
    active: [
      {
        name: "휘두르기",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[휘두르기]! ${target.name}에게 파괴적인 일격을 날립니다!`);
            const dmg = calculateDamage(Math.floor((caster.currentStats['근력'] || 0) * 2.0), target.currentStats?.['물리 내성'] || 0); // 근력 2배
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${target.name}에게 ${dmg}의 파괴적인 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "웅크리기",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "웅크리기(3턴)");
            caster.cb.logMessage("[웅크리기]! 3분간(3턴) 모든 내성과 재생력이 20배 증가합니다!");
        }
      }
    ]
  },
  "반데몬": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[비탄의 일격]! ${target.name}에게 강력한 암흑 피해를 줍니다!`);
        const dmg = calculateDamage(60 + (caster.currentStats['어둠 감응도'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "데스로드": {
    active: [
      {
        name: "찰나의 불멸",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "무적(1턴)");
            caster.cb.logMessage("[찰나의 불멸]! 1분간(1턴) 무적 상태가 됩니다!");
        }
      },
      {
        name: "구원의 안개",
        effect: (caster, target) => {
            caster.cb.logMessage("[구원의 안개]! 아군의 체력을 회복시키는 안개를 방출합니다!");
            const healAmount = 50;
            safeHpUpdate(caster, healAmount);
            caster.party.forEach(p => safeHpUpdate(p, healAmount));
        }
      }
    ]
  },
  "니바로크": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[영혼의 일격]! ${target.name}에게 강력한 마법 피해를 줍니다!`);
        const dmg = calculateDamage(70 + (caster.currentStats['정신력'] || 0), target.currentStats?.['항마력'] || 0);
        safeHpUpdate(target, -dmg);
      }
    }
  },
  "스톰거쉬": {
    active: [
      {
        name: "폭풍의 눈",
        effect: (caster, target) => {
            caster.cb.logMessage("[폭풍의 눈]! 5초간 주변의 적을 끌어당깁니다! (기능 미구현)");
        }
      },
      {
        name: "용맥",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[용맥]! ${target.name}의 위치에 공기 기둥이 터지고 소용돌이가 발생합니다!`);
            const dmg = calculateDamage(40, target.currentStats?.['항마력'] || 0);
            safeHpUpdate(target, -dmg);
            // (MP 빼앗기 및 공중에 뜸 기능 미구현)
        }
      },
      {
        name: "폭군의 포효",
        effect: (caster, target) => {
            caster.cb.logMessage("[폭군의 포효]! 주변 10m 이내의 적을 기절시킵니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) applyDebuff(caster, t, "기절(1턴)");
            });
        }
      },
      {
        name: "폭풍의 혈족",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "재생/육체 급증(3턴)");
            caster.cb.logMessage("[폭풍의 혈족]! 3턴간 재생력 및 육체 수치가 급증합니다!");
        }
      },
      {
        name: "기우제",
        effect: (caster, target) => {
            caster.cb.logMessage("[기우제]! 비를 내려 자신은 버프를, 적들은 디버프를 겁니다!");
            applyDebuff(caster, caster, "육체 버프(3턴)");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) applyDebuff(caster, t, "둔화(비)");
            });
        }
      },
      {
        name: "폭풍부름",
        effect: (caster, target) => {
            const mpHeal = 50;
            caster.mp = Math.min(caster.maxMp, caster.mp + mpHeal);
            caster.cb.logMessage(`[폭풍부름]! 바람을 빨아들여 영혼력을 ${mpHeal} 회복합니다.`);
        }
      },
      {
        name: "폭풍의 제사장",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "무적(1턴)");
            caster.cb.logMessage("[폭풍의 제사장]! 캐스팅 동안 무적! (10분간 방어 상승 및 광역 피해, 스킬 불가로 변경) (기능 미구현)");
        }
      }
    ]
  },
  "심해 거인": {
    active: [
      {
        name: "칼날 급류",
        effect: (caster, target) => {
            if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
            caster.cb.logMessage(`[칼날 급류]! ${target.name}에게 수백 개의 물길을 발사합니다!`);
            const dmg = calculateDamage(70 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${target.name}에게 ${dmg}의 수속성 물리 피해! (HP: ${target.hp})`);
        }
      },
      {
        name: "생명의 근원",
        effect: (caster, target) => {
            const healAmount = Math.floor(caster.maxHp * 0.4); // 40% 회복
            safeHpUpdate(caster, healAmount);
            applyDebuff(caster, caster, "방어 감소(심장 노출)");
            caster.cb.logMessage(`[생명의 근원]! 심장의 생명력으로 체력을 ${healAmount} 회복합니다! (일시적 방어 감소)`);
        }
      },
      {
        name: "영혼 잠수",
        effect: (caster, target) => {
            const mpHeal = caster.maxMp - caster.mp; // 소모된 영혼력만큼 회복
            caster.mp = caster.maxMp;
            caster.cb.logMessage(`[영혼 잠수]! 소모된 영혼력을 모두 회복합니다! (${mpHeal} 회복)`);
        }
      }
    ]
  },
  "스톤윈터": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[빙하 돌진]! ${target.name}에게 강력한 냉기 물리 피해를 줍니다!`);
        const dmg = calculateDamage(60 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
        safeHpUpdate(target, -dmg);
        applyDebuff(caster, target, "둔화(냉기)");
      }
    }
  },
  "바이테리온": {
    active: {
      effect: (caster, target) => {
        if (!target) { caster.cb.logMessage("대상이 없습니다."); return; }
        caster.cb.logMessage(`[발톱 휘두르기]! ${target.name}을(를) 2회 공격합니다!`);
        for (let i = 0; i < 2; i++) {
            const dmg = calculateDamage(35 + (caster.currentStats['근력'] || 0), target.currentStats?.['물리 내성'] || 0);
            safeHpUpdate(target, -dmg);
            caster.cb.logMessage(`${i+1}타! ${target.name}에게 ${dmg}의 피해! (HP: ${target.hp})`);
        }
      }
    }
  },
  "바이욘": {
    active: {
      effect: (caster, target) => {
        applyDebuff(caster, caster, "초월(3턴)");
        caster.cb.logMessage("[초월]! 3턴간 모든 스탯이 30% 상승합니다!");
      }
    }
  },
  "헬스미스": {
    active: [
      {
        name: "두드리기",
        effect: (caster, target) => {
            applyDebuff(caster, caster, "두드리기(3턴)");
            caster.cb.logMessage("[두드리기]! 3턴간 모든 화염 스킬 피해량이 대폭 증가하고 육체 수치가 상승합니다!");
        }
      },
      {
        name: "지옥불",
        effect: (caster, target) => {
            caster.cb.logMessage("[지옥불]! 용암 액체를 사방에 튀겨 폭발시킵니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) {
                    const dmg = calculateDamage(60 + (caster.currentStats['화염 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                    safeHpUpdate(t, -dmg);
                    caster.cb.logMessage(`${t.name}에게 ${dmg}의 화염 피해! (HP: ${t.hp})`);
                }
            });
        }
      },
      {
        name: "땜질",
        effect: (caster, target) => {
            const healAmount = 50;
            safeHpUpdate(caster, healAmount);
            removeDebuff(caster, caster, "출혈(약)");
            caster.cb.logMessage(`[땜질]! 상처를 땜질하여 체력을 ${healAmount} 회복하고 '출혈(약)'을 제거합니다.`);
        }
      }
    ]
  },
  "디아몬트": {
    active: [
      {
        name: "구원의 안개",
        effect: (caster, target) => {
            caster.cb.logMessage("[구원의 안개]! 아군의 체력을 회복시키는 안개를 방출합니다!");
            const healAmount = 50;
            safeHpUpdate(caster, healAmount);
            caster.party.forEach(p => safeHpUpdate(p, healAmount));
        }
      },
      {
        name: "시체독",
        effect: (caster, target) => {
            caster.cb.logMessage("[시체독]! 범위 내에 강력한 독 안개를 퍼뜨립니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) applyDebuff(caster, t, "독(강)");
            });
        }
      },
      {
        name: "지옥불",
        effect: (caster, target) => {
            caster.cb.logMessage("[지옥불]! 용암 액체를 사방에 튀겨 폭발시킵니다!");
            const targets = Array.isArray(target) ? target : (caster.currentMonster || []);
            targets.forEach(t => {
                if (t.hp > 0) {
                    const dmg = calculateDamage(60 + (caster.currentStats['화염 감응도'] || 0), t.currentStats?.['항마력'] || 0);
                    safeHpUpdate(t, -dmg);
                    caster.cb.logMessage(`${t.name}에게 ${dmg}의 화염 피해! (HP: ${t.hp})`);
                }
            });
        }
      }
    ]
  }
}