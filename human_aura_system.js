/**
 * ===== 인간 오러 시스템 (Human Aura System) =====
 * MP를 지속적으로 소모하며 무기에 기운을 둘러 물리법칙을 초월하는 기술
 * 개화 조건: 검술 레벨 50 + 기사단장에게 10,000골드 지불
 */

export class AuraSystem {
  constructor(player) {
    this.player = player;
    this.auraUnlocked = false;
    this.activeAura = null;
    this.auraGauge = 0;
    this.maxAuraGauge = 100;
    this.mpPerTurn = 2; // 기본 MP 유지 비용

    this.auraTypes = {
      weapon: {
        id: 'aura_weapon',
        name: '오러 웨폰 (공격)',
        type: 'attack',
        description: '[절대 관통] 적의 물리 방어력을 90% 무시하고 데미지를 적용합니다.',
        unlockRequirement: {
          swordskillLevel: 50,
          goldCost: 10000,
          npc: 'knight_commander'
        },
        effects: {
          defenseBypass: 0.9,  // 방어력 90% 무시 = 10% 만 적용
          damageModifier: 1.0  // 기본 데미지
        },
        mpCost: 5,             // 공격당 MP 5 소모
        cooldown: 0
      },

      armor: {
        id: 'aura_armor',
        name: '오러 아머 (방어)',
        type: 'defense',
        description: '마법 데미지 50% 감소. 투사체(화살 등)를 튕겨냅니다.',
        unlockRequirement: {
          previousAura: 'aura_weapon',
          level: 15,
          goldCost: 0
        },
        effects: {
          magicDamageReduction: 0.5,  // 마법 데미지 50% 감소
          projectileReflect: true      // 투사체 반사
        },
        mpCost: 10,            // 피격당 MP 10 소모
        cooldown: 0
      },

      sense: {
        id: 'aura_sense',
        name: '오러 센스 (감지)',
        type: 'utility',
        description: '벽 너머의 생명체를 감지합니다 (Wall Hack).',
        unlockRequirement: {
          previousAura: 'aura_armor',
          level: 20,
          goldCost: 0
        },
        effects: {
          wallHack: true,           // 벽 투과 감지
          enemyDetectionRange: 10   // 10칸 범위
        },
        mpCost: 2,             // 턴당 MP 2 소모
        cooldown: 0
      }
    };
  }

  // ===== 오러 해금 =====
  /**
   * 기사단장 NPC로부터 오러 시스템 해금
   */
  unlockAura() {
    // 조건 확인: 검술 레벨 50 + 골드 10,000
    const swordskilLevel = this.getSwordskillLevel();

    if (!swordskilLevel || swordskilLevel < 50) {
      return {
        success: false,
        message: `검술 레벨이 부족합니다. (현재: ${swordskilLevel || 0}, 필요: 50)`
      };
    }

    const requiredGold = 10000;
    if ((this.player.assets?.gold || 0) < requiredGold) {
      return {
        success: false,
        message: `골드가 부족합니다. (현재: ${this.player.assets?.gold || 0}, 필요: ${requiredGold})`
      };
    }

    // 해금!
    this.auraUnlocked = true;
    this.player.assets.gold -= requiredGold;

    return {
      success: true,
      message: '오러 마스터로부터 오러 기술을 배웠습니다!',
      unlockedAuras: this.getUnlockedAuras()
    };
  }

  getSwordskillLevel() {
    // skillRanks에서 검술 관련 스킬의 레벨 확인
    const swordskills = ['slash_1', 'slash_2', 'stab_1', 'power_strike'];
    let totalLevel = 0;

    for (let skill of swordskills) {
      totalLevel += this.player.skillRanks?.[skill] || 0;
    }

    return totalLevel;
  }

  // ===== 오러 류 활성화 =====
  /**
   * 특정 오러를 활성화
   */
  activateAura(auraId) {
    if (!this.auraUnlocked) {
      return { success: false, message: '오러 시스템이 해금되지 않았습니다.' };
    }

    const aura = this.auraTypes[auraId];
    if (!aura) {
      return { success: false, message: '존재하지 않는 오러입니다.' };
    }

    // 이미 활성화된 오러인지 확인
    if (this.activeAura === auraId) {
      return { success: false, message: `이미 ${aura.name}이 활성화되어 있습니다.` };
    }

    // MP 충분한지 확인
    if (this.player.mp < 20) {
      return {
        success: false,
        message: '오러를 유지할 MP가 부족합니다. (최소: 20)'
      };
    }

    this.activeAura = auraId;

    return {
      success: true,
      message: `${aura.name} 활성화!`,
      activeAura: aura
    };
  }

  /**
   * 오러 비활성화
   */
  deactivateAura() {
    if (!this.activeAura) {
      return { success: false, message: '활성화된 오러가 없습니다.' };
    }

    const aura = this.auraTypes[this.activeAura];
    this.activeAura = null;

    return {
      success: true,
      message: `${aura.name} 비활성화`
    };
  }

  // ===== 데미지 계산 수정 (손상 시스템과 연계) =====
  /**
   * 오러 웨폰 적용 시 데미지 계산
   * 기존 데미지 공식의 마지막 단계에서 호출됨
   */
  applyAuraWeaponDamage(baseDamage, targetDefense) {
    if (this.activeAura !== 'aura_weapon') {
      return baseDamage;
    }

    const aura = this.auraTypes.aura_weapon;

    // 방어력 90% 무시 = 10% 만 적용
    const bypassRatio = aura.effects.defenseBypass; // 0.9
    const appliedDefense = Math.floor(targetDefense * (1 - bypassRatio)); // 10% 적용

    // 기본 데미지 - 적용된 방어력
    const finalDamage = Math.max(baseDamage - appliedDefense, 1);

    // MP 소모
    this.consumeMpForAttack(aura.mpCost);

    return finalDamage;
  }

  /**
   * 오러 아머 적용 시 데미지 감소
   */
  applyAuraArmorDamageReduction(incomingDamage, damageType) {
    if (this.activeAura !== 'aura_armor') {
      return incomingDamage;
    }

    const aura = this.auraTypes.aura_armor;

    // 마법 데미지 50% 감소
    if (damageType === 'magic' || damageType === 'spell') {
      incomingDamage = Math.floor(incomingDamage * (1 - aura.effects.magicDamageReduction));
    }

    // MP 소모
    this.consumeMpForDefense(aura.mpCost);

    return incomingDamage;
  }

  /**
   * 오러 센스로 벽 뒤의 적 감지
   */
  getWallHackDetection() {
    if (this.activeAura !== 'aura_sense') {
      return null;
    }

    // 턴당 MP 소모
    this.consumeMpForUtility();

    return {
      wallHackActive: true,
      detectionRange: this.auraTypes.aura_sense.effects.enemyDetectionRange
    };
  }

  /**
   * 투사체 반사 (화살 등)
   */
  reflectProjectile(projectile) {
    if (this.activeAura !== 'aura_armor') {
      return { reflected: false };
    }

    const aura = this.auraTypes.aura_armor;
    if (!aura.effects.projectileReflect) {
      return { reflected: false };
    }

    // MP 소모 (피격이므로 더 큼)
    this.consumeMpForDefense(aura.mpCost);

    return {
      reflected: true,
      reflectedDamage: Math.floor(projectile.damage * 0.5),
      message: `${this.player.name}의 오러가 투사체를 튕겨냈다!`
    };
  }

  // ===== MP 관리 =====
  consumeMpForAttack(amount) {
    if (this.player.mp >= amount) {
      this.player.mp -= amount;
    } else {
      // MP 부족 시 오러 비활성화
      this.deactivateAura();
    }
  }

  consumeMpForDefense(amount) {
    if (this.player.mp >= amount) {
      this.player.mp -= amount;
    }
  }

  consumeMpForUtility() {
    const aura = this.auraTypes.aura_sense;
    if (this.player.mp >= aura.mpCost) {
      this.player.mp -= aura.mpCost;
    } else {
      this.deactivateAura();
    }
  }

  /**
   * 턴 종료 시 오러 유지 MP 소모
   */
  consumeTurnMaintenanceMp() {
    if (!this.activeAura) return;

    const maintenanceCost = 2; // 턴당 기본 2 소모
    if (this.player.mp >= maintenanceCost) {
      this.player.mp -= maintenanceCost;
    } else {
      // MP 부족하면 오러 자동 해제
      this.deactivateAura();
      if (this.player.cb?.logMessage) {
        this.player.cb.logMessage('MP가 부족하여 오러가 해제되었습니다.');
      }
    }
  }

  // ===== 오러 정보 =====
  getUnlockedAuras() {
    const unlockedList = [];

    for (let auraId in this.auraTypes) {
      const aura = this.auraTypes[auraId];
      const requirement = aura.unlockRequirement;

      // 첫 번째 오러는 시스템 해금 시 자동 해금
      if (auraId === 'aura_weapon') {
        unlockedList.push(aura);
      }
      // 나머지는 나중에 조건 확인 후 해금
      else {
        // 레벨/이전 오러 조건 확인
        if (
          this.hasAura(requirement.previousAura) &&
          this.player.level >= requirement.level
        ) {
          unlockedList.push(aura);
        }
      }
    }

    return unlockedList;
  }

  hasAura(auraId) {
    // 플레이어가 이미 오러를 습득했는지 확인
    return this.player.learnedAuras?.includes(auraId) || false;
  }

  /**
   * 오러 작동 상태 조회
   */
  getAuraStatus() {
    if (!this.auraUnlocked) {
      return { unlocked: false, message: '오러 시스템 미해금' };
    }

    if (!this.activeAura) {
      return { unlocked: true, active: false, message: '활성화된 오러 없음' };
    }

    const aura = this.auraTypes[this.activeAura];
    return {
      unlocked: true,
      active: true,
      activeAura: {
        id: aura.id,
        name: aura.name,
        type: aura.type,
        mpCost: aura.mpCost
      },
      currentMp: this.player.mp,
      maxMp: this.player.maxMp
    };
  }

  /**
   * 전체 오러 트리 UI용 데이터
   */
  getAuraTreeUI() {
    return {
      system: {
        unlocked: this.auraUnlocked,
        unlockedRequirement: {
          swordskillLevel: 50,
          goldCost: 10000
        }
      },
      auras: Object.values(this.auraTypes).map(aura => ({
        id: aura.id,
        name: aura.name,
        type: aura.type,
        description: aura.description,
        mpCost: aura.mpCost,
        effects: aura.effects,
        isActive: this.activeAura === aura.id
      }))
    };
  }

  // ===== 상태 저장/복원 =====
  toJSON() {
    return {
      auraUnlocked: this.auraUnlocked,
      activeAura: this.activeAura,
      auraGauge: this.auraGauge
    };
  }

  fromJSON(data) {
    this.auraUnlocked = data.auraUnlocked;
    this.activeAura = data.activeAura;
    this.auraGauge = data.auraGauge;
  }
}
