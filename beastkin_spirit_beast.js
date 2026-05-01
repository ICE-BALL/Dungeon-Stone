/**
 * ===== 수인 영혼수 계약 시스템 (Spirit Beast Contract) =====
 * 캐릭터 배후에 영적인 짐승을 형상화하여 전투를 보조
 * 빙의/현현/각성 3가지 모드 전환 가능
 */

export class SpiritBeastSystem {
  constructor(player) {
    this.player = player;
    this.contractActive = false;
    this.currentMode = 'none'; // none, possession, manifestation
    this.awakenessProgress = 0;
    this.availableBeasts = [
      {
        id: 'wolf_beast',
        name: '늑대 영혼수',
        type: 'wolf',
        description: '빠르고 날카로운 늑대. 치명타에 특화.',
        bonusInPossession: { critChance: 0.1 },
        stats: { hp: 80, str: 10, agi: 14 }
      },
      {
        id: 'bear_beast',
        name: '곰 영혼수',
        type: 'bear',
        description: '강대한 곰. 탱킹과 방어에 특화.',
        bonusInPossession: { defense: 15 },
        stats: { hp: 120, str: 14, agi: 8 }
      },
      {
        id: 'cat_beast',
        name: '고양이 영혼수',
        type: 'cat',
        description: '민첩한 고양이. 회피에 특화.',
        bonusInPossession: { evasion: 0.15 },
        stats: { hp: 70, str: 9, agi: 16 }
      }
    ];
  }

  // ===== 영혼수 계약 =====
  /**
   * 던전 2층 이상의 '고대 짐승의 사당'에서 계약하기
   */
  attemptContract(beastType, currentLayer) {
    if (currentLayer < 2) {
      return {
        success: false,
        message: '이 공간에서 영혼수를 감지할 수 없습니다. (2층 이상 필요)'
      };
    }

    if (this.contractActive) {
      return {
        success: false,
        message: '이미 영혼수와 계약되어 있습니다.'
      };
    }

    const selectedBeast = this.availableBeasts.find(b => b.id === beastType);
    if (!selectedBeast) {
      return { success: false, message: '존재하지 않는 영혼수입니다.' };
    }

    // 체력 소모 (HP를 바쳐 계약)
    const sacrificeHp = Math.floor(this.player.maxHp * 0.3); // 최대 HP의 30%
    if (this.player.hp <= sacrificeHp) {
      return {
        success: false,
        message: `체력이 부족합니다. (필요: ${sacrificeHp})`
      };
    }

    this.player.hp -= sacrificeHp;

    // 계약 성공
    this.contractActive = true;
    this.selectedBeast = selectedBeast;
    this.spiritBeastInstance = {
      type: selectedBeast.id,
      mode: 'none',
      hp: selectedBeast.stats.hp,
      maxHp: selectedBeast.stats.hp
    };

    return {
      success: true,
      message: `${selectedBeast.name}과 계약했습니다!`,
      beast: selectedBeast
    };
  }

  // ===== 모드 전환 =====
  /**
   * 빙의 모드 (Possession)
   * 영혼수가 몸에 깃들어 모든 스탯을 증가시킴
   */
  switchToPossession() {
    if (!this.contractActive) {
      return { success: false, message: '계약된 영혼수가 없습니다.' };
    }

    const previousMode = this.currentMode;

    // 빙의 모드 효과
    const beast = this.selectedBeast;
    const bonuses = {
      allStats: 1.15,        // 모든 스탯 +15%
      damageType: 'nature',  // 공격에 자연 속성 부여
      effects: {
        str: Math.floor(this.player.stats['근력'] * 0.15),
        agi: Math.floor(this.player.stats['민첩성'] * 0.15),
        con: Math.floor(this.player.stats['지구력'] * 0.15)
      }
    };

    this.currentMode = 'possession';
    this.spiritBeastInstance.mode = 'possession';

    if (!this.player.activeBeastMode) {
      this.player.activeBeastMode = {};
    }
    this.player.activeBeastMode.possession = bonuses;

    return {
      success: true,
      message: `${beast.name}이 몸에 깃들었습니다!`,
      modeChange: { from: previousMode, to: 'possession' },
      bonuses: bonuses
    };
  }

  /**
   * 현현 모드 (Manifestation)
   * 영혼수가 별도의 유닛으로 분리되어 협공 가능
   */
  switchToManifestation() {
    if (!this.contractActive) {
      return { success: false, message: '계약된 영혼수가 없습니다.' };
    }

    const previousMode = this.currentMode;
    const beast = this.selectedBeast;

    // 현현 모드 효과
    const manifestedBeast = {
      type: beast.id,
      name: `소환된 ${beast.name}`,
      hp: beast.stats.hp,
      maxHp: beast.stats.hp,
      str: beast.stats.str,
      agi: beast.stats.agi,
      isIndependent: true,
      canAttack: true,
      agroDuration: 3  // 3턴 동안 주의를 끌 수 있음
    };

    this.currentMode = 'manifestation';
    this.spiritBeastInstance = manifestedBeast;

    return {
      success: true,
      message: `${beast.name}이 분리되어 나타났습니다!`,
      modeChange: { from: previousMode, to: 'manifestation' },
      summonedBeast: manifestedBeast
    };
  }

  /**
   * 특수 능력: 각성 (Awakening) 
   * 게이지 100% 시 3턴간 완전한 야수로 변신
   */
  activateAwakening() {
    if (!this.contractActive) {
      return { success: false, message: '계약된 영혼수가 없습니다.' };
    }

    if (this.awakenessProgress < 100) {
      return {
        success: false,
        message: `각성 게이지 부족. (${Math.floor(this.awakenessProgress)}/100)`
      };
    }

    const awakenedForm = {
      mode: 'awakening',
      duration: 3,
      effects: {
        skillCooldownReduction: 1.0,  // 스킬 쿨타임 0
        mpCostReduction: 1.0,          // MP 소모 0
        damageBonus: 1.5,              // 데미지 1.5배
        allStats: 1.3                  // 모든 스탯 +30%
      }
    };

    this.currentMode = 'awakening';
    this.awakenessProgress = 0;

    return {
      success: true,
      message: '야생의 본능이 폭발했습니다! 기타 형태로 변신!',
      awakenedForm: awakenedForm
    };
  }

  // ===== 게이지 관리 =====
  increaseAwakenessGauge(amount = 10) {
    this.awakenessProgress = Math.min(this.awakenessProgress + amount, 100);
  }

  // ===== 전투에서의 영혼수 =====
  /**
   * 현현 모드: 영혼수의 독자적인 공격
   */
  performBeastAttack(targetMonster) {
    if (this.currentMode !== 'manifestation') {
      return { success: false, message: '현현 모드가 아닙니다.' };
    }

    const beast = this.spiritBeastInstance;
    if (!beast || beast.hp <= 0) {
      return { success: false, message: '영혼수가 행동할 수 없습니다.' };
    }

    // 간단한 공격 계산
    const baseDamage = beast.str * 2;
    const critChance = Math.random() < 0.15 ? 1.5 : 1.0; // 15% 치명타
    const totalDamage = Math.floor(baseDamage * critChance);

    // 반격 계산
    const targetCounter = Math.random() < 0.2; // 20% 반격률

    return {
      success: true,
      damage: totalDamage,
      isCritical: critChance > 1,
      targetCounters: targetCounter,
      counterDamage: targetCounter ? Math.floor(targetMonster.attack * 0.5) : 0
    };
  }

  /**
   * 현현 모드: 영혼수가 받은 피해
   */
  damageBeast(damageAmount) {
    if (this.currentMode !== 'manifestation') {
      return;
    }

    const beast = this.spiritBeastInstance;
    if (beast) {
      beast.hp = Math.max(0, beast.hp - damageAmount);

      if (beast.hp <= 0) {
        // 영혼수 처치됨 - 모드 변경
        this.currentMode = 'none';
        return { defeated: true, message: '영혼수가 사라졌습니다...' };
      }
    }
  }

  /**
   * 빙의 모드: 피해 흡수 보조
   */
  absorbDamageInPossession(damageAmount) {
    if (this.currentMode !== 'possession') {
      return damageAmount;
    }

    const beast = this.selectedBeast;
    const damageReduction = 1 - (beast.stats.str / 100) * 0.05; // 근력에 따라 5% 단위로 감소
    return Math.floor(damageAmount * damageReduction);
  }

  // ===== 전투 외 효과 =====
  /**
   * 은신 감지 강화 (동물의 야성)
   */
  enhancedSensing() {
    if (!this.contractActive) {
      return 0;
    }

    return 0.4; // +40% 감지률
  }

  /**
   * 어둠에서 명중률 페널티 무시
   */
  ignoresDarknessDebuff() {
    return this.contractActive;
  }

  // ===== UI 데이터 =====
  getContractInfo() {
    if (!this.contractActive) {
      return {
        status: 'not_contracted',
        message: '영혼수와 계약되지 않았습니다.'
      };
    }

    return {
      status: 'contracted',
      currentBeast: this.selectedBeast,
      currentMode: this.currentMode,
      beastStatus:
        this.currentMode === 'manifestation'
          ? {
              hp: this.spiritBeastInstance.hp,
              maxHp: this.spiritBeastInstance.maxHp,
              alive: this.spiritBeastInstance.hp > 0
            }
          : null,
      awakenessProgress: this.awakenessProgress,
      availableModes: ['possession', 'manifestation'],
      canAwaken: this.awakenessProgress >= 100
    };
  }

  getAvailableBeasts() {
    return this.availableBeasts.map(beast => ({
      id: beast.id,
      name: beast.name,
      type: beast.type,
      description: beast.description,
      bonusInPossession: beast.bonusInPossession
    }));
  }

  // ===== Tribal Bonus (초기 선택) =====
  /**
   * 리더에서 부족을 선택했을 때 적용되는 보너스
   */
  applyTribalBonus(tribalType) {
    const tribalBonuses = {
      wolf: { critChance: 0.1 },
      bear: { maxHp: 0.15 },
      cat: { evasion: 0.1 }
    };

    return tribalBonuses[tribalType] || {};
  }

  // ===== 상태 저장/복원 =====
  toJSON() {
    return {
      contractActive: this.contractActive,
      currentMode: this.currentMode,
      selectedBeastId: this.selectedBeast?.id,
      awakenessProgress: this.awakenessProgress
    };
  }

  fromJSON(data) {
    this.contractActive = data.contractActive;
    this.currentMode = data.currentMode;
    this.awakenessProgress = data.awakenessProgress;

    if (data.selectedBeastId) {
      this.selectedBeast = this.availableBeasts.find(b => b.id === data.selectedBeastId);
    }
  }
}
