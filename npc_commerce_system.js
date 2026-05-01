/**
 * ===== NPC 친화도 상거래 시스템 =====
 * NPC와의 관계도가 가격, 아이템 가용성에 영향
 * 친화도 기반 할인, 특별 아이템 해금, 신용 시스템
 */

class NPCCommerceSystem {
  constructor(player) {
    this.player = player;
    this.npcAffinity = {}; // NPC별 친화도 저장
    this.npcReputation = {}; // NPC별 평판
    this.npcCommerceHistory = {}; // 거래 기록
    this.npcSpecialOffers = {}; // NPC별 특별 할인 정보
    this.npcInventoryTiers = {}; // NPC별 인벤토리 레벨
    this.creditLines = {}; // NPC와의 신용 한도
  }

  // ===== 친화도 초기화 =====
  initializeNPCAffinity(npcId) {
    if (!this.npcAffinity[npcId]) {
      this.npcAffinity[npcId] = {
        value: 0, // -100 ~ +100
        lastInteraction: Date.now(),
        interactionCount: 0,
        questsCompleted: 0,
        giftsGiven: 0
      };
      this.npcCommerceHistory[npcId] = [];
      this.npcSpecialOffers[npcId] = [];
      this.creditLines[npcId] = { limit: 1000, used: 0 }; // 기본 신용 한도
    }
  }

  // ===== 친화도 증가 =====
  increaseAffinity(npcId, amount = 1, reason = 'interaction') {
    this.initializeNPCAffinity(npcId);
    
    const before = this.npcAffinity[npcId].value;
    this.npcAffinity[npcId].value = Math.min(100, this.npcAffinity[npcId].value + amount);
    this.npcAffinity[npcId].lastInteraction = Date.now();
    this.npcAffinity[npcId].interactionCount++;

    const after = this.npcAffinity[npcId].value;
    const milestone = this.checkAffinityMilestone(after, before);

    return {
      success: true,
      affinity: after,
      change: after - before,
      reason: reason,
      milestone: milestone
    };
  }

  // ===== 친화도 감소 =====
  decreaseAffinity(npcId, amount = 1, reason = 'conflict') {
    this.initializeNPCAffinity(npcId);
    
    const before = this.npcAffinity[npcId].value;
    this.npcAffinity[npcId].value = Math.max(-100, this.npcAffinity[npcId].value - amount);

    const after = this.npcAffinity[npcId].value;
    const milestone = this.checkAffinityMilestone(after, before);

    return {
      success: true,
      affinity: after,
      change: after - before,
      reason: reason,
      milestone: milestone
    };
  }

  // ===== 친화도 마일스톤 확인 =====
  checkAffinityMilestone(currentValue, previousValue) {
    const milestones = [
      { value: -80, label: '적대적', unlocks: [] },
      { value: -50, label: '부정적', unlocks: [] },
      { value: 0, label: '중립적', unlocks: ['basic_inventory'] },
      { value: 30, label: '친근한', unlocks: ['friendly_discount_10', 'expanded_inventory'] },
      { value: 60, label: '신뢰하는', unlocks: ['trusted_discount_20', 'premium_inventory', 'credit_expansion'] },
      { value: 80, label: '존경하는', unlocks: ['elite_discount_30', 'exclusive_items', 'high_credit'] }
    ];

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (currentValue >= m.value && previousValue < m.value) {
        return {
          reached: true,
          label: m.label,
          unlocks: m.unlocks
        };
      }
    }

    return null;
  }

  // ===== NPC별 가격 계산 =====
  calculateNPCPrice(basePrice, npcId) {
    this.initializeNPCAffinity(npcId);

    const affinity = this.npcAffinity[npcId].value;
    let discount = 0;

    // 친화도에 따른 할인 계산
    if (affinity <= -80) {
      discount = -0.50; // 가격 인상 50%
    } else if (affinity <= -50) {
      discount = -0.30; // 가격 인상 30%
    } else if (affinity <= -10) {
      discount = -0.10; // 가격 인상 10%
    } else if (affinity < 0) {
      discount = -0.05; // 가격 인상 5%
    } else if (affinity < 30) {
      discount = 0; // 정상 가격
    } else if (affinity < 60) {
      discount = 0.10; // 할인 10%
    } else if (affinity < 80) {
      discount = 0.20; // 할인 20%
    } else {
      discount = 0.30; // 할인 30%
    }

    // 스톤 시스템의 시장 곱수 적용
    let marketMultiplier = 1.0;
    if (this.player.livingWorld && this.player.livingWorld.market) {
      marketMultiplier = this.player.livingWorld.getMarketMultiplier('item');
    }

    const finalPrice = Math.floor(basePrice * (1 + discount) * marketMultiplier);
    return {
      basePrice: basePrice,
      discount: discount * 100, // 퍼센트
      finalPrice: finalPrice,
      savings: basePrice - finalPrice,
      marketMultiplier: marketMultiplier
    };
  }

  // ===== NPC 인벤토리 레벨 결정 =====
  getNPCInventoryTier(npcId) {
    this.initializeNPCAffinity(npcId);
    const affinity = this.npcAffinity[npcId].value;

    if (affinity <= -50) return 'restricted'; // 기본 아이템만
    if (affinity < 0) return 'basic'; // 기본 아이템
    if (affinity < 30) return 'standard'; // 표준 아이템
    if (affinity < 60) return 'expanded'; // 확장 아이템
    if (affinity < 80) return 'premium'; // 프리미엄 아이템
    return 'elite'; // 엘리트 아이템 포함
  }

  // ===== NPC별 특별 할인 설정 (시즈널) =====
  setSpecialOffer(npcId, itemCategory, discountPercent, validDays = 7) {
    this.npcSpecialOffers[npcId] = {
      itemCategory: itemCategory,
      discount: discountPercent,
      startDate: Date.now(),
      endDate: Date.now() + (validDays * 24 * 60 * 60 * 1000),
      active: true
    };

    return {
      npcId: npcId,
      offer: `${itemCategory} 카테고리 ${discountPercent}% 할인`,
      validDays: validDays
    };
  }

  // ===== 활성 특별 할인 확인 =====
  getActiveOffers(npcId) {
    this.initializeNPCAffinity(npcId);
    
    if (!this.npcSpecialOffers[npcId]) {
      return [];
    }

    const offer = this.npcSpecialOffers[npcId];
    if (!offer.active || Date.now() > offer.endDate) {
      offer.active = false;
      return [];
    }

    return [offer];
  }

  // ===== 신용 한도 관리 =====
  adjustCreditLimit(npcId, adjustment) {
    this.initializeNPCAffinity(npcId);

    const affinity = this.npcAffinity[npcId].value;
    const baseCreditLimit = 1000;

    // 친화도에 따른 신용 한도 결정
    let creditMultiplier = 1.0;
    if (affinity <= -50) {
      creditMultiplier = 0.3; // 신용 한도 30%만 가능
    } else if (affinity < 0) {
      creditMultiplier = 0.7;
    } else if (affinity < 30) {
      creditMultiplier = 1.0;
    } else if (affinity < 60) {
      creditMultiplier = 1.5;
    } else if (affinity < 80) {
      creditMultiplier = 2.0;
    } else {
      creditMultiplier = 3.0;
    }

    this.creditLines[npcId].limit = baseCreditLimit * creditMultiplier + adjustment;

    return {
      newLimit: this.creditLines[npcId].limit,
      used: this.creditLines[npcId].used,
      available: this.creditLines[npcId].limit - this.creditLines[npcId].used
    };
  }

  // ===== 외상 구매 =====
  purchaseOnCredit(npcId, itemId, quantity, unitPrice) {
    this.initializeNPCAffinity(npcId);

    const affinity = this.npcAffinity[npcId].value;
    if (affinity < -30) {
      return {
        success: false,
        message: '이 NPC와의 관계가 너무 나빠서 외상을 받을 수 없습니다.'
      };
    }

    const totalCost = unitPrice * quantity;
    const available = this.creditLines[npcId].limit - this.creditLines[npcId].used;

    if (totalCost > available) {
      return {
        success: false,
        message: `신용 한도 초과. (필요: ${totalCost}, 가용: ${available})`
      };
    }

    this.creditLines[npcId].used += totalCost;
    this.npcCommerceHistory[npcId].push({
      type: 'credit_purchase',
      itemId: itemId,
      quantity: quantity,
      cost: totalCost,
      date: Date.now(),
      dueDate: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7일 후
    });

    return {
      success: true,
      message: `${quantity}개를 ${totalCost} 스톤에 외상으로 구매했습니다.`,
      newBalance: {
        used: this.creditLines[npcId].used,
        available: this.creditLines[npcId].limit - this.creditLines[npcId].used
      }
    };
  }

  // ===== 외상금 상환 =====
  payCredit(npcId, amount) {
    this.initializeNPCAffinity(npcId);

    if (this.player.assets.stone < amount) {
      return {
        success: false,
        message: `스톤이 부족합니다. (필요: ${amount}, 보유: ${this.player.assets.stone})`
      };
    }

    const previousUsed = this.creditLines[npcId].used;
    this.creditLines[npcId].used = Math.max(0, this.creditLines[npcId].used - amount);
    this.player.assets.stone -= amount;

    // 외상금 성실히 상환 → 친화도 증가
    this.increaseAffinity(npcId, 2, 'paid_credit');

    return {
      success: true,
      message: `${amount} 스톤을 상환했습니다.`,
      paidAmount: amount,
      newBalance: {
        previousUsed: previousUsed,
        currentUsed: this.creditLines[npcId].used,
        available: this.creditLines[npcId].limit - this.creditLines[npcId].used
      }
    };
  }

  // ===== 선물 주기 (친화도 상승) =====
  giftNPC(npcId, giftItemId, player) {
    this.initializeNPCAffinity(npcId);

    // 선물 종류에 따른 친화도 변화
    const giftValue = this.calculateGiftValue(giftItemId);
    const affinityGain = Math.ceil(giftValue / 100);

    const result = this.increaseAffinity(npcId, affinityGain, 'gift_received');

    this.npcAffinity[npcId].giftsGiven++;

    // 플레이어 인벤토리에서 아이템 제거
    if (player.inventory && player.inventory[giftItemId]) {
      player.inventory[giftItemId]--;
    }

    return {
      success: true,
      message: `${player.getNPCName ? player.getNPCName(npcId) : 'NPC'}에게 선물을 주었습니다!`,
      affinityGained: affinityGain,
      newAffinity: result.affinity
    };
  }

  // ===== 선물 가치 계산 =====
  calculateGiftValue(giftItemId) {
    // 기본 선물 가치 맵
    const giftValues = {
      'rare_flower': 50,
      'aged_wine': 150,
      'exotic_spice': 100,
      'fine_jewelry': 300,
      'ancient_tome': 250,
      'enchanted_tools': 200,
      'exotic_food': 80,
      'precious_gem': 400,
      'mysterious_artifact': 500
    };

    return giftValues[giftItemId] || 30;
  }

  // ===== NPC 정보 조회 =====
  getNPCProfile(npcId) {
    this.initializeNPCAffinity(npcId);

    const affinity = this.npcAffinity[npcId];
    const credit = this.creditLines[npcId];

    let affinityLabel = 'Neutral';
    if (affinity.value <= -80) affinityLabel = 'Hostile';
    else if (affinity.value <= -50) affinityLabel = 'Negative';
    else if (affinity.value < 30) affinityLabel = 'Neutral';
    else if (affinity.value < 60) affinityLabel = 'Friendly';
    else if (affinity.value < 80) affinityLabel = 'Trusted';
    else affinityLabel = 'Revered';

    return {
      npcId: npcId,
      affinity: {
        value: affinity.value,
        label: affinityLabel,
        progress: (affinity.value + 100) / 200 // 0~1 사이 진행도
      },
      commerce: {
        inventoryTier: this.getNPCInventoryTier(npcId),
        priceModifier: (this.npcAffinity[npcId].value > 0 ? -1 : 1) * Math.abs(this.npcAffinity[npcId].value) * 0.5,
        activeOffers: this.getActiveOffers(npcId)
      },
      credit: {
        limit: credit.limit,
        used: credit.used,
        available: credit.limit - credit.used
      },
      history: {
        interactions: affinity.interactionCount,
        questsCompleted: affinity.questsCompleted,
        giftsGiven: affinity.giftsGiven
      }
    };
  }

  // ===== 거래 기록 조회 =====
  getCommerceHistory(npcId, limit = 10) {
    this.initializeNPCAffinity(npcId);
    
    const history = this.npcCommerceHistory[npcId] || [];
    return history.slice(-limit).reverse();
  }

  // ===== 퀘스트 완료 보상 (친화도 증가) =====
  completeQuestForNPC(npcId, questReward = 'standard') {
    this.initializeNPCAffinity(npcId);

    const rewardAffinityMap = {
      'minor': 3,
      'standard': 8,
      'major': 15,
      'legendary': 30
    };

    const affinityGain = rewardAffinityMap[questReward] || 5;
    const result = this.increaseAffinity(npcId, affinityGain, 'quest_completed');

    this.npcAffinity[npcId].questsCompleted++;

    return {
      success: true,
      message: `퀘스트를 완료했습니다. NPC와의 친화도가 증가했습니다.`,
      affinityGained: affinityGain,
      milestone: result.milestone
    };
  }
}

export { NPCCommerceSystem };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NPCCommerceSystem };
}
