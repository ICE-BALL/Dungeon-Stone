/**
 * ===== 요정 정령 계약 시스템 (Elemental Pact) =====
 * 스킬 대신 정령을 장비하여 스킬처럼 사용
 * 필드의 자연물과 상호작용하여 정령 획득
 */

export class ElementalPactSystem {
  constructor(player) {
    this.player = player;
    this.contractedSpirits = [];
    this.maxContracts = 4;
    this.availableSpirits = this.initializeSpirits();
  }

  // ===== 정령 정의 =====
  initializeSpirits() {
    return {
      // 4대 정령
      salamander_fire: {
        id: 'salamander_fire',
        name: '🔥 살라만더 (화염)',
        type: 'fire',
        element: 'fire',
        description: '공격 시 타겟 주변 1칸 스플래시 데미지. (패시브)',
        acquisitionMethod: 'touch_flame',
        acquireLocation: '불이 타오르는 곳 (화염의 소굴)',

        // 정령의 패시브 능력
        passiveEffect: {
          splashDamage: true,
          splashRange: 1,
          splashMultiplier: 0.5  // 주 피해의 50%
        },

        // 정령 스킬
        skills: [
          {
            id: 'fire_burst',
            name: '화염 폭발',
            mpCost: 30,
            damage: 80,
            range: 5,
            cooldown: 2
          }
        ],

        stats: {
          magicPower: 15,
          spellCastingSpeed: 12
        }
      },

      undine_water: {
        id: 'undine_water',
        name: '💧 운디네 (물)',
        type: 'water',
        element: 'water',
        description: '턴 종료 시 파티원 체력 소량 회복.',
        acquisitionMethod: 'touch_water',
        acquireLocation: '수원지 (물의 신전)',

        passiveEffect: {
          partyHealing: true,
          healingPerTurn: 0.15,  // 파티원 최대 HP의 15%
          healRange: 'all_party'
        },

        skills: [
          {
            id: 'heal_wave',
            name: '치유의 파도',
            mpCost: 25,
            healing: 100,
            range: 10,
            cooldown: 3
          }
        ],

        stats: {
          magicPower: 12,
          healing: 18
        }
      },

      sylph_wind: {
        id: 'sylph_wind',
        name: '🌪️ 실프 (바람)',
        type: 'wind',
        element: 'wind',
        description: '이동력 +2, 회피율 +20%.',
        acquisitionMethod: 'touch_wind',
        acquireLocation: '고풍 산맥 (바람의 봉우리)',

        passiveEffect: {
          moveBonus: 2,
          evasionBonus: 0.2
        },

        skills: [
          {
            id: 'wind_slash',
            name: '바람 베기',
            mpCost: 20,
            damage: 60,
            range: 6,
            cooldown: 1
          }
        ],

        stats: {
          agility: 18,
          spellCastingSpeed: 16
        }
      },

      gnome_earth: {
        id: 'gnome_earth',
        name: '🌍 노움 (흙)',
        type: 'earth',
        element: 'earth',
        description: '일시적으로 돌 벽을 생성하여 적의 경로 차단.',
        acquisitionMethod: 'touch_earth',
        acquireLocation: '지하 광산 (흙의 영역)',

        passiveEffect: {
          defenseBonus: 10
        },

        skills: [
          {
            id: 'stone_wall',
            name: '돌 벽 생성',
            mpCost: 35,
            coverage: 3,  // 3칸 벽 생성
            duration: 5,  // 5턴 유지
            cooldown: 4
          }
        ],

        stats: {
          defense: 16,
          constitution: 14
        }
      }
    };
  }

  // ===== 정령 획득 =====
  /**
   * 필드의 자연물과 상호작용하여 정령 획득
   */
  attemptSpiritContract(elementType) {
    const spirit = this.availableSpirits[elementType];

    if (!spirit) {
      return { success: false, message: '존재하지 않는 정령입니다.' };
    }

    // 최대 계약 수 확인
    if (this.contractedSpirits.length >= this.maxContracts) {
      return {
        success: false,
        message: `최대 정령 계약 수에 도달했습니다. (${this.maxContracts}/${this.maxContracts})`
      };
    }

    // 이미 계약했는지 확인
    if (this.hasSpirit(elementType)) {
      return {
        success: false,
        message: `이미 ${spirit.name}과(와) 계약되어 있습니다.`
      };
    }

    // 체력 소모 (계약 의식)
    const ritualCost = Math.floor(this.player.maxHp * 0.15); // 최대 HP의 15%
    if (this.player.hp <= ritualCost) {
      return {
        success: false,
        message: `체력이 부족합니다. (필요: ${ritualCost})`
      };
    }

    this.player.hp -= ritualCost;

    // 정령 계약
    this.contractedSpirits.push({
      spiritId: elementType,
      contractedAt: Date.now(),
      experienceLevel: 1
    });

    return {
      success: true,
      message: `${spirit.name}과 계약했습니다!`,
      spirit: spirit
    };
  }

  // ===== 정령 확인 =====
  hasSpirit(spiritId) {
    return this.contractedSpirits.some(s => s.spiritId === spiritId);
  }

  getContractedSpirits() {
    return this.contractedSpirits.map(contract => {
      const spirit = this.availableSpirits[contract.spiritId];
      return {
        ...contract,
        spirit: spirit
      };
    });
  }

  // ===== 정령 스킬 사용 =====
  /**
   * 정령의 스킬 사용
   */
  useSpiritSkill(spiritId, skillId) {
    if (!this.hasSpirit(spiritId)) {
      return { success: false, message: '계약되지 않은 정령입니다.' };
    }

    const spirit = this.availableSpirits[spiritId];
    const skill = spirit.skills.find(s => s.id === skillId);

    if (!skill) {
      return { success: false, message: '존재하지 않는 정령 스킬입니다.' };
    }

    // MP 확인
    if (this.player.mp < skill.mpCost) {
      return {
        success: false,
        message: `MP가 부족합니다. (필요: ${skill.mpCost}, 보유: ${this.player.mp})`
      };
    }

    // MP 소모
    this.player.mp -= skill.mpCost;

    return {
      success: true,
      message: `${spirit.name}의 '${skill.name}' 발동!`,
      skill: skill,
      spirit: spirit
    };
  }

  // ===== 정령 패시브 적용 =====
  /**
   * 정령의 패시브 효과를 계산
   */
  calculateSpiritBonuses() {
    const bonuses = {
      stats: {},
      passiveEffects: []
    };

    for (let contract of this.contractedSpirits) {
      const spirit = this.availableSpirits[contract.spiritId];

      // 통계 추가 (요정에게만 적용)
      if (spirit.stats) {
        for (let stat in spirit.stats) {
          bonuses.stats[stat] = (bonuses.stats[stat] || 0) + spirit.stats[stat];
        }
      }

      // 패시브 효과 추가
      if (spirit.passiveEffect) {
        bonuses.passiveEffects.push({
          spiritId: contract.spiritId,
          effect: spirit.passiveEffect
        });
      }
    }

    return bonuses;
  }

  /**
   * 특정 패시브 효과 조회 (움직임, 회피 등)
   */
  getSpiritModifier(modifierType) {
    let totalModifier = 0;

    for (let contract of this.contractedSpirits) {
      const spirit = this.availableSpirits[contract.spiritId];

      if (modifierType === 'moveBonus') {
        totalModifier += spirit.passiveEffect?.moveBonus || 0;
      } else if (modifierType === 'evasionBonus') {
        totalModifier += spirit.passiveEffect?.evasionBonus || 0;
      } else if (modifierType === 'defenseBonus') {
        totalModifier += spirit.passiveEffect?.defenseBonus || 0;
      }
    }

    return totalModifier;
  }

  // ===== 정령 치유 (运디네) =====
  /**
   * 턴 종료 시 정령이 파티를 치유
   */
  processSpiritHealing() {
    let totalHealing = 0;

    for (let contract of this.contractedSpirits) {
      const spirit = this.availableSpirits[contract.spiritId];

      if (spirit.passiveEffect?.partyHealing) {
        const partyMemberCount = (this.player.party?.length || 0) + 1; // 플레이어 포함
        const healPerMember = Math.floor(
          this.player.maxHp * spirit.passiveEffect.healingPerTurn
        );

        totalHealing += healPerMember * partyMemberCount;
      }
    }

    return totalHealing;
  }

  // ===== 정령 시각화 (UI) =====
  /**
   * 현재 계약된 정령들 UI 데이터
   */
  getContractedSpiritsUI() {
    return this.contractedSpirits.map(contract => {
      const spirit = this.availableSpirits[contract.spiritId];

      return {
        spiritId: contract.spiritId,
        name: spirit.name,
        type: spirit.type,
        element: spirit.element,
        description: spirit.description,
        skills: spirit.skills.map(skill => ({
          id: skill.id,
          name: skill.name,
          mpCost: skill.mpCost,
          cooldown: skill.cooldown
        })),
        passiveEffect: spirit.passiveEffect,
        level: contract.experienceLevel
      };
    });
  }

  /**
   * 사용 가능한 정령 목록 (아직 계약 안 한 정령들)
   */
  getAvailableSpiritsForContract() {
    return Object.entries(this.availableSpirits)
      .filter(([id, _]) => !this.hasSpirit(id))
      .map(([id, spirit]) => ({
        id: spirit.id,
        name: spirit.name,
        element: spirit.element,
        description: spirit.description,
        acquisitionMethod: spirit.acquisitionMethod,
        acquireLocation: spirit.acquireLocation
      }));
  }

  /**
   * 요정 특성: 철 알레르기
   * 금속 갑옷 착용 시 패널티
   */
  checkIronAllergyDamage() {
    const metalArmor = this.player.equipment?.['갑옷'];

    if (metalArmor && this.isMaterialMetal(metalArmor)) {
      // 매 턴 데미지 + 스킬 봉인
      return {
        allergyActive: true,
        damagePerTurn: Math.floor(this.player.maxHp * 0.05), // 최대 HP의 5%
        skillSilence: true
      };
    }

    return { allergyActive: false };
  }

  isMaterialMetal(armorId) {
    const metalArmor = ['heavy_armor', 'plate_armor', 'steel_armor', 'iron_armor'];
    return metalArmor.some(type => armorId.includes(type));
  }

  /**
   * 유리 대포 특성: 피격 시 취약
   * 모든 피해 1.5배 증가
   */
  getGlassCannonDamageMultiplier() {
    return 1.5; // 피해를 1.5배 받음
  }

  // ===== 정령 기술 트리 UI =====
  getFullSpiritTreeUI() {
    return {
      contracted: this.getContractedSpiritsUI(),
      available: this.getAvailableSpiritsForContract(),
      maxContracts: this.maxContracts
    };
  }

  // ===== 상태 저장/복원 =====
  toJSON() {
    return {
      contractedSpirits: this.contractedSpirits
    };
  }

  fromJSON(data) {
    this.contractedSpirits = data.contractedSpirits || [];
  }
}
