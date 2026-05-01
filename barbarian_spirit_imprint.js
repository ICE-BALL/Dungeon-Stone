/**
 * ===== 바바리안 혼령각인 시스템 (Spirit Imprint) =====
 * 골드와 정수를 소모하여 몸에 문신을 새겨 스탯을 올리는 전용 성장 트리
 */

export class SpiritImprintSystem {
  constructor(player) {
    this.player = player;
    this.imprintTree = this.initializeTree();
  }

  // ===== 혼령각인 트리 정의 =====
  initializeTree() {
    return {
      // Tier 1: 기초 각인
      tier1: {
        bear_strength: {
          id: 'bear_strength',
          name: '곰의 힘',
          tier: 1,
          cost: { gold: 500, essence: { type: 'common', amount: 1 } },
          effect: { 근력: 5 },
          description: '곰의 근력을 체득. 근력 +5',
          repeatable: true,
          maxRanks: 5,
          currentRank: 0
        },
        cat_agility: {
          id: 'cat_agility',
          name: '살쾡이의 민첩',
          tier: 1,
          cost: { gold: 500, essence: { type: 'common', amount: 1 } },
          effect: { 민첩성: 5 },
          description: '살쾡이의 민첩을 체득. 민첩성 +5',
          repeatable: true,
          maxRanks: 5,
          currentRank: 0
        },
        wolf_toughness: {
          id: 'wolf_toughness',
          name: '늑대의 인내',
          tier: 1,
          cost: { gold: 500, essence: { type: 'common', amount: 1 } },
          effect: { 지구력: 5 },
          description: '늑대의 인내를 체득. 지구력 +5',
          repeatable: true,
          maxRanks: 5,
          currentRank: 0
        }
      },

      // Tier 3: 분기점 (택1)
      tier3: {
        giant_heart_a: {
          id: 'giant_heart_a',
          tier: 3,
          name: '🅰 거인의 심장 (분기)',
          cost: { gold: 2000, essence: { type: 'uncommon', amount: 3 } },
          effect: {
            hpRegen: 2.0,      // HP 재생률 200%
            potionEfficiency: 0.5  // 포션 효율 -50%
          },
          description: 'HP 재생률 +200%, 포션 효율 -50%. 전투 유지력 특화.',
          mutuallyExclusive: 'tier3',
          conflict: 'barbarian_rage_b',
          prerequisite: ['bear_strength', 'cat_agility', 'wolf_toughness']
        },

        barbarian_rage_b: {
          id: 'barbarian_rage_b',
          tier: 3,
          name: '🅱 광전사의 피 (분기)',
          cost: { gold: 2000, essence: { type: 'uncommon', amount: 3 } },
          effect: {
            critDamageWhenLow: 0.5,  // 30% 이하 HP일 때 공격력 +50%
            hpThreshold: 0.3
          },
          description: '체력이 30% 이하일 때 공격력 +50%. 위기 대처 특화.',
          mutuallyExclusive: 'tier3',
          conflict: 'giant_heart_a',
          prerequisite: ['bear_strength', 'cat_agility', 'wolf_toughness']
        }
      },

      // Tier 6: 최상위 각인 (택1)
      tier6: {
        spirit_of_fire: {
          id: 'spirit_of_fire',
          tier: 6,
          name: '🔥 불꽃의 혼',
          cost: { gold: 5000, essence: { type: 'rare', amount: 5 } },
          effect: {
            reflectDamage: 0.3,  // 피격 시 입은 피해의 30%를 화염으로 반사
            element: 'fire'
          },
          description: '피격 시 공격자에게 입은 피해의 30%를 화염 속성으로 반사.',
          mutuallyExclusive: 'tier6',
          conflict: 'spirit_of_steel',
          prerequisite: ['giant_heart_a', 'barbarian_rage_b']
        },

        spirit_of_steel: {
          id: 'spirit_of_steel',
          tier: 6,
          name: '⛑️ 강철의 혼',
          cost: { gold: 5000, essence: { type: 'rare', amount: 5 } },
          effect: {
            physicalDamageReduction: 0.2,  // 모든 물리 피해 20% 감소
            bleedImmune: true              // 출혈 면역
          },
          description: '모든 물리 피해 20% 감소. 출혈 면역.',
          mutuallyExclusive: 'tier6',
          conflict: 'spirit_of_fire',
          prerequisite: ['giant_heart_a', 'barbarian_rage_b']
        }
      }
    };
  }

  // ===== 각인 학습 =====
  learnImprint(imprintId) {
    const imprint = this.findImprint(imprintId);

    if (!imprint) {
      return { success: false, message: `혼령각인을 찾을 수 없습니다: ${imprintId}` };
    }

    // 전제 조건 확인
    if (imprint.prerequisite) {
      for (let prereq of imprint.prerequisite) {
        if (!this.hasImprint(prereq)) {
          return { success: false, message: `선행 각인이 필요합니다: ${prereq}` };
        }
      }
    }

    // 상호 배제 확인 (분기점)
    if (imprint.mutuallyExclusive) {
      if (this.hasConflict(imprint.conflict)) {
        return { 
          success: false, 
          message: `이미 다른 분기를 선택했습니다: ${imprint.conflict}` 
        };
      }
    }

    // 비용 확인
    const costCheck = this.checkCost(imprint);
    if (!costCheck.canAfford) {
      return { success: false, message: costCheck.message };
    }

    // 반복 가능 여부 확인
    if (!imprint.repeatable && imprint.currentRank > 0) {
      return { success: false, message: '이미 이 각인을 받았습니다.' };
    }

    if (imprint.repeatable && imprint.currentRank >= imprint.maxRanks) {
      return { success: false, message: `최대 강화 횟수 도달: ${imprint.maxRanks}` };
    }

    // 비용 차감
    this.consumeCost(imprint);

    // 각인적용
    this.applyImprint(imprint);

    // 저장
    if (!this.player.spiritImprints) {
      this.player.spiritImprints = {};
    }

    if (!this.player.spiritImprints[imprintId]) {
      this.player.spiritImprints[imprintId] = {
        imprintId,
        acquiredAt: Date.now(),
        ranks: 1
      };
    } else {
      this.player.spiritImprints[imprintId].ranks += 1;
    }

    imprint.currentRank += 1;

    return {
      success: true,
      message: `혼령각인 '${imprint.name}'을 받았습니다!`,
      imprint: imprint
    };
  }

  // ===== 각인 검색 =====
  findImprint(imprintId) {
    for (let tier in this.imprintTree) {
      const tierImprints = this.imprintTree[tier];
      if (tierImprints[imprintId]) {
        return tierImprints[imprintId];
      }
    }
    return null;
  }

  // ===== 각인 보유 확인 =====
  hasImprint(imprintId) {
    return this.player.spiritImprints?.[imprintId]?.ranks > 0 || false;
  }

  // ===== 충돌 확인 =====
  hasConflict(conflictId) {
    return this.hasImprint(conflictId);
  }

  // ===== 비용 확인 및 차감 =====
  checkCost(imprint) {
    const goldRequired = imprint.cost.gold;
    const essenceRequired = imprint.cost.essence;

    if (!this.player.assets || this.player.assets.gold < goldRequired) {
      return {
        canAfford: false,
        message: `골드 부족. (필요: ${goldRequired}, 보유: ${this.player.assets?.gold || 0})`
      };
    }

    // essenceRequired 검증 (필요시)
    // 일단 간단한 골드 확인만 수행

    return { canAfford: true };
  }

  consumeCost(imprint) {
    const goldRequired = imprint.cost.gold;
    if (this.player.assets) {
      this.player.assets.gold -= goldRequired;
    }
    // 정수 소모는 별도 로직 필요
  }

  // ===== 각인 효과 적용 =====
  applyImprint(imprint) {
    const effects = imprint.effect || {};

    // 직접 스탯 증가
    if (effects.근력 !== undefined && this.player.stats) {
      this.player.stats['근력'] += effects.근력;
    }
    if (effects.민첩성 !== undefined && this.player.stats) {
      this.player.stats['민첩성'] += effects.민첩성;
    }
    if (effects.지구력 !== undefined && this.player.stats) {
      this.player.stats['지구력'] += effects.지구력;
    }

    // 플래그 설정 (영구)
    if (!this.player.imprintEffects) {
      this.player.imprintEffects = {};
    }

    this.player.imprintEffects[imprint.id] = effects;

    // HP/MP 재계산 필요 시
    if (this.player.calculateStats) {
      this.player.calculateStats();
    }
  }

  // ===== 각인 화면 표시용 데이터 =====
  getImprintTreeUI() {
    return {
      tier1: {
        title: '1단계 - 기초 각인 (반복 강화 가능)',
        imprints: Object.values(this.imprintTree.tier1).map(imp => this.formatImprintUI(imp))
      },
      tier3: {
        title: '3단계 - 분기점 (택1)',
        imprints: Object.values(this.imprintTree.tier3).map(imp => this.formatImprintUI(imp))
      },
      tier6: {
        title: '6단계 - 최상위 각인 (택1)',
        imprints: Object.values(this.imprintTree.tier6).map(imp => this.formatImprintUI(imp))
      }
    };
  }

  formatImprintUI(imprint) {
    const isLearned = this.hasImprint(imprint.id);
    const costStr = `골드: ${imprint.cost.gold}, 정수: ${imprint.cost.essence.type}x${imprint.cost.essence.amount}`;

    return {
      id: imprint.id,
      name: imprint.name,
      tier: imprint.tier,
      description: imprint.description,
      cost: costStr,
      isLearned: isLearned,
      currentRank: imprint.currentRank,
      maxRanks: imprint.maxRanks || 1,
      canLearn: this.canLearnImprint(imprint),
      conflictWith: imprint.conflict || null
    };
  }

  canLearnImprint(imprint) {
    // 전제 조건 확인
    if (imprint.prerequisite) {
      for (let prereq of imprint.prerequisite) {
        if (!this.hasImprint(prereq)) return false;
      }
    }

    // 충돌 여부
    if (imprint.mutuallyExclusive && this.hasConflict(imprint.conflict)) {
      return false;
    }

    // 최대 랭크 확인
    if (imprint.repeatable && imprint.currentRank >= imprint.maxRanks) {
      return false;
    }

    // 비용 확인
    return this.checkCost(imprint).canAfford;
  }

  // ===== 영혼 계승 (Soul Succession) =====
  /**
   * 바바리안 사망 시, 다음 바바리안 캐릭터에 계승 가능한 재산 반환
   */
  getSuccessionLegacy() {
    if (this.player.race !== 'barbarian') {
      return null;
    }

    const legacy = {
      highestEssence: this.findHighestEssence(),
      skillProficiency: this.calculateSkillLegacy()
    };

    return legacy;
  }

  findHighestEssence() {
    // 보유한 정수 중 가장 높은 등급 1개 반환
    const essences = this.player.essences || [];
    if (essences.length === 0) return null;

    // 등급순 정렬
    const rarityRank = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
    essences.sort((a, b) => (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0));

    return essences[0] || null;
  }

  calculateSkillLegacy() {
    // 스킬 숙련도 50% 계승
    if (!this.player.skillGraph?.nodes) return 0;

    const totalSkillLevels = this.player.skillGraph.nodes.reduce((sum, node) => {
      return sum + (this.player.skillRanks?.[node.id] || 0);
    }, 0);

    return Math.floor(totalSkillLevels * 0.5);
  }

  // ===== 통계 =====
  getImprintStats() {
    const learned = Object.values(this.player.spiritImprints || {});

    return {
      totalLearned: learned.length,
      totalRanks: learned.reduce((sum, imp) => sum + imp.ranks, 0),
      activeBonuses: this.player.imprintEffects ? Object.keys(this.player.imprintEffects).length : 0
    };
  }
}
