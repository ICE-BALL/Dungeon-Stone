/**
 * ===== 마이닝 시스템 =====
 * 광물 채집, 광석 종류, 마이닝 메커니즘
 * 각 층별 광물 분포도 정의
 */

// ===== 광물 종류 정의 =====
const MINERALS = {
  // 기본 광물 (1-3층)
  copper_ore: {
    id: 'copper_ore',
    name: '구리 광석',
    name_en: 'Copper Ore',
    baseValue: 280,
    minLayer: 1,
    maxLayer: 3,
    rarity: 'common',
    color: '#B87333',
    icon: '◯',
    craftingRecipes: ['copper_tool', 'bronze_alloy'],
    description: '일반적인 구리 광석. 여러 도구와 재료의 기초.'
  },
  
  iron_ore: {
    id: 'iron_ore',
    name: '철 광석',
    name_en: 'Iron Ore',
    baseValue: 450,
    minLayer: 2,
    maxLayer: 4,
    rarity: 'common',
    color: '#6B4423',
    icon: '◆',
    craftingRecipes: ['iron_tool', 'steel_alloy'],
    description: '내구성 좋은 철 광석.'
  },
  
  silver_ore: {
    id: 'silver_ore',
    name: '은 광석',
    name_en: 'Silver Ore',
    baseValue: 680,
    minLayer: 2,
    maxLayer: 5,
    rarity: 'uncommon',
    color: '#C0C0C0',
    icon: '◇',
    craftingRecipes: ['silver_tool', 'magic_catalyst'],
    description: '은색 빛을 내는 광석. 마법 친화도가 높다.'
  },
  
  gold_ore: {
    id: 'gold_ore',
    name: '금 광석',
    name_en: 'Gold Ore',
    baseValue: 1200,
    minLayer: 3,
    maxLayer: 6,
    rarity: 'rare',
    color: '#FFD700',
    icon: '◈',
    craftingRecipes: ['gold_tool', 'treasure_craft'],
    description: '귀금속 금. 장인들이 가장 원하는 재료.'
  },
  
  // 중층 광물 (4-6층)
  mithril_ore: {
    id: 'mithril_ore',
    name: '미스릴 광석',
    name_en: 'Mithril Ore',
    baseValue: 1800,
    minLayer: 4,
    maxLayer: 7,
    rarity: 'rare',
    color: '#5FD3BC',
    icon: '◉',
    craftingRecipes: ['mithril_equipment', 'legendary_craft'],
    description: '전설의 금속. 매우 가볍고 튼튼하다.'
  },
  
  adamantite_ore: {
    id: 'adamantite_ore',
    name: '아다만타이트 광석',
    name_en: 'Adamantite Ore',
    baseValue: 2500,
    minLayer: 5,
    maxLayer: 8,
    rarity: 'epic',
    color: '#1E90FF',
    icon: '●',
    craftingRecipes: ['adamant_equipment', 'supreme_craft'],
    description: '미궁의 가장 견고한 금속.'
  },
  
  // 고층 광물 (7-10층)
  orichalcum_ore: {
    id: 'orichalcum_ore',
    name: '오리할콤 광석',
    name_en: 'Orichalcum Ore',
    baseValue: 3500,
    minLayer: 6,
    maxLayer: 9,
    rarity: 'epic',
    color: '#FF6B6B',
    icon: '✦',
    craftingRecipes: ['orichalcum_artifact'],
    description: '붉은 빛을 내는 신비로운 금속.'
  },
  
  moonstone_ore: {
    id: 'moonstone_ore',
    name: '문스톤 광석',
    name_en: 'Moonstone Ore',
    baseValue: 4200,
    minLayer: 7,
    maxLayer: 10,
    rarity: 'legendary',
    color: '#E6E6FA',
    icon: '◐',
    craftingRecipes: ['moonstone_artifact', 'celestial_craft'],
    description: '달빛을 담은 광석. 시공 마법과 친화도가 높다.'
  },
  
  starfall_ore: {
    id: 'starfall_ore',
    name: '스타폴 광석',
    name_en: 'Starfall Ore',
    baseValue: 5500,
    minLayer: 8,
    maxLayer: 10,
    rarity: 'legendary',
    color: '#FFB6C1',
    icon: '✧',
    craftingRecipes: ['starfall_artifact', 'dimensional_craft'],
    description: '별에서 떨어진 신비한 광석. 극도로 드물다.'
  },
  
  // 특수 광물 (hitten layers에만)
  crystal_ore: {
    id: 'crystal_ore',
    name: '결정 광석',
    name_en: 'Crystal Ore',
    baseValue: 2000,
    minLayer: 4,
    maxLayer: 10,
    rarity: 'epic',
    color: '#00CED1',
    icon: '◆◆',
    craftingRecipes: ['enhancement_crystal', 'spell_amplifier'],
    description: '순수한 마력을 담은 결정체.'
  },
  
  obsidian_ore: {
    id: 'obsidian_ore',
    name: '흑요석 광석',
    name_en: 'Obsidian Ore',
    baseValue: 1500,
    minLayer: 5,
    maxLayer: 9,
    rarity: 'rare',
    color: '#1C1C1C',
    icon: '■',
    craftingRecipes: ['obsidian_blade', 'darkness_craft'],
    description: '어둠 속성과 친화도가 높은 검은 광석.'
  }
};

// ===== 광물 채집 확률 (층별, 광물별) =====
const MINERAL_SPAWN_RATES = {
  1: { copper_ore: 0.15, iron_ore: 0 },
  2: { copper_ore: 0.12, iron_ore: 0.15, silver_ore: 0.08 },
  3: { copper_ore: 0.08, iron_ore: 0.15, silver_ore: 0.12, gold_ore: 0.05 },
  4: { iron_ore: 0.10, silver_ore: 0.12, gold_ore: 0.12, mithril_ore: 0.08, crystal_ore: 0.06 },
  5: { silver_ore: 0.09, gold_ore: 0.12, mithril_ore: 0.12, adamantite_ore: 0.06, crystal_ore: 0.08, obsidian_ore: 0.07 },
  6: { gold_ore: 0.08, mithril_ore: 0.10, adamantite_ore: 0.10, orichalcum_ore: 0.06, crystal_ore: 0.08, obsidian_ore: 0.09 },
  7: { mithril_ore: 0.08, adamantite_ore: 0.10, orichalcum_ore: 0.10, moonstone_ore: 0.06, crystal_ore: 0.07, obsidian_ore: 0.08 },
  8: { adamantite_ore: 0.08, orichalcum_ore: 0.10, moonstone_ore: 0.10, starfall_ore: 0.04, crystal_ore: 0.06, obsidian_ore: 0.06 },
  9: { orichalcum_ore: 0.08, moonstone_ore: 0.12, starfall_ore: 0.06, crystal_ore: 0.05, obsidian_ore: 0.05 },
  10: { moonstone_ore: 0.10, starfall_ore: 0.08, crystal_ore: 0.04, obsidian_ore: 0.04 }
};

// ===== 마이닝 시스템 클래스 =====
class MiningSystem {
  constructor(player) {
    this.player = player;
    this.pickaxeDurability = 100; // 곡괭이 내구도
    this.maxPickaxeDurability = 100;
    this.miningSkillLevel = 0; // 채광 스킬 레벨
    this.mineralInventory = {}; // 채삭한 광물 저장소
    this.currentVein = null; // 현재 채광중인 광맥
    this.miningSessionTime = 0; // 채광 세션 시간

    // 광물 인벤토리 초기화
    for (let mineralId in MINERALS) {
      this.mineralInventory[mineralId] = 0;
    }
  }

  // ===== 곡괭이 구매 (상점) =====
  purchasePickaxe(tierLevel = 1) {
    const pickaxeTypes = {
      1: { name: '철제 곡괭이', cost: 500, durability: 100, efficiencyBonus: 1.0 },
      2: { name: '강철 곡괭이', cost: 1500, durability: 200, efficiencyBonus: 1.3 },
      3: { name: '미스릴 곡괭이', cost: 5000, durability: 400, efficiencyBonus: 1.7 },
      4: { name: '아다만타이트 곡괭이', cost: 15000, durability: 800, efficiencyBonus: 2.2 },
      5: { name: '오리할콤 곡괭이', cost: 40000, durability: 1600, efficiencyBonus: 2.8 }
    };

    const pickaxe = pickaxeTypes[tierLevel] || pickaxeTypes[1];
    if (this.player.assets.stone < pickaxe.cost) {
      return { success: false, message: `스톤이 부족합니다. (필요: ${pickaxe.cost}, 보유: ${this.player.assets.stone})` };
    }

    this.player.assets.stone -= pickaxe.cost;
    this.maxPickaxeDurability = pickaxe.durability;
    this.pickaxeDurability = pickaxe.durability;
    this.pickaxeEfficiency = pickaxe.efficiencyBonus;

    return {
      success: true,
      message: `${pickaxe.name}을(를) 구매했습니다. 내구도: ${pickaxe.durability}`,
      pickaxe: pickaxe
    };
  }

  // ===== 광맥 탐색 (맵에서) =====
  discoverVein(layer) {
    if (!this.player.pickaxeDurability || this.pickaxeDurability <= 0) {
      return { success: false, message: '곡괭이가 없거나 부셔졌습니다. 재구매하세요.' };
    }

    // 해당 층의 광맥 생성
    const veinMineral = this.generateRandomVein(layer);
    if (!veinMineral) {
      return { success: false, message: '이 층에서는 광석이 없습니다.' };
    }

    this.currentVein = {
      layer: layer,
      mineralId: veinMineral,
      remainingAmount: Math.floor(Math.random() * 8) + 5, // 5-12개
      difficulty: this.calculateVeinDifficulty(layer, veinMineral)
    };

    return {
      success: true,
      message: `${MINERALS[veinMineral].name} 광맥을 발견했습니다!`,
      vein: this.currentVein
    };
  }

  // ===== 광맥 채집 =====
  mineVein(attempt = 1) {
    if (!this.currentVein) {
      return { success: false, message: '활성 광맥이 없습니다.' };
    }

    if (this.pickaxeDurability <= 0) {
      return { success: false, message: '곡괭이가 부셔졌습니다.' };
    }

    const mineral = MINERALS[this.currentVein.mineralId];
    const baseSuccess = 0.6 + (this.player.stats.body.dexterity / 1000); // DEX 기반 성공율
    const skillBonus = this.miningSkillLevel * 0.05;
    const difficultyPenalty = this.currentVein.difficulty * 0.1;
    const successRate = Math.max(0.1, Math.min(0.95, baseSuccess + skillBonus - difficultyPenalty));

    const roll = Math.random();
    let result = {
      attempt: attempt,
      successRate: successRate,
      roll: roll,
      mined: 0,
      damage: Math.floor(Math.random() * 2) + 1 // 곡괭이 내구도 감소
    };

    // 채광 내구도 감소
    this.pickaxeDurability -= result.damage;

    if (roll < successRate) {
      // 성공: 광석 획득
      const minedAmount = Math.floor(Math.random() * 2) + 1; // 1-2개
      const efficiency = this.pickaxeEfficiency || 1.0;
      result.mined = Math.floor(minedAmount * efficiency);
      
      this.mineralInventory[this.currentVein.mineralId] += result.mined;
      this.currentVein.remainingAmount--;
      
      // 채광 스킬 경험치 획득
      this.gainMiningExperience(mineral.rarity);

      result.message = `${mineral.name} ${result.mined}개를 채집했습니다.`;

      // 광맥 고갈 확인
      if (this.currentVein.remainingAmount <= 0) {
        result.veinDepleted = true;
        result.message += ' 광맥이 고갈되었습니다.';
        this.currentVein = null;
      }
    } else {
      // 실패: 광석 미획득
      result.message = '채광에 실패했습니다.';
    }

    return { success: true, ...result };
  }

  // ===== 광맥 난이도 계산 =====
  calculateVeinDifficulty(layer, mineralId) {
    const mineral = MINERALS[mineralId];
    const layerDifficulty = layer / 10;
    const rarityMultiplier = {
      'common': 1.0,
      'uncommon': 1.3,
      'rare': 1.6,
      'epic': 2.0,
      'legendary': 2.5
    };
    return layerDifficulty * (rarityMultiplier[mineral.rarity] || 1.0);
  }

  // ===== 채광 스킬 경험치 획득 =====
  gainMiningExperience(rarity) {
    const expGains = {
      'common': 2,
      'uncommon': 5,
      'rare': 12,
      'epic': 25,
      'legendary': 50
    };

    const exp = expGains[rarity] || 1;
    if (!this.player.miningExperience) this.player.miningExperience = 0;
    
    this.player.miningExperience += exp;
    
    const expNeeded = (this.miningSkillLevel + 1) * 100;
    if (this.player.miningExperience >= expNeeded) {
      this.player.miningExperience -= expNeeded;
      this.miningSkillLevel++;
      return { levelUp: true, newLevel: this.miningSkillLevel };
    }
    
    return { levelUp: false, totalExp: this.player.miningExperience };
  }

  // ===== 무작위 광맥 생성 =====
  generateRandomVein(layer) {
    const rates = MINERAL_SPAWN_RATES[layer];
    if (!rates) return null;

    const roll = Math.random();
    let cumulative = 0;

    for (let mineralId in rates) {
      cumulative += rates[mineralId];
      if (roll < cumulative) {
        return mineralId;
      }
    }

    return null;
  }

  // ===== 광물 판매 =====
  sellMineral(mineralId, quantity) {
    if (!this.mineralInventory[mineralId] || this.mineralInventory[mineralId] < quantity) {
      return { success: false, message: '보유한 광물이 부족합니다.' };
    }

    const mineral = MINERALS[mineralId];
    const baseValue = mineral.baseValue * quantity;

    // 시장 가격 변동 (경제 시스템 반영)
    let marketMultiplier = 1.0;
    if (this.player.livingWorld && this.player.livingWorld.market) {
      marketMultiplier = this.player.livingWorld.getMarketMultiplier('ore');
    }

    const finalValue = Math.floor(baseValue * marketMultiplier);

    this.mineralInventory[mineralId] -= quantity;
    this.player.assets.stone += finalValue;

    return {
      success: true,
      message: `${mineral.name} ${quantity}개를 ${finalValue} 스톤에 판매했습니다.`,
      earnings: finalValue
    };
  }

  // ===== 광물 인벤토리 조회 =====
  getInventory() {
    const inventory = [];
    let totalValue = 0;

    for (let mineralId in this.mineralInventory) {
      if (this.mineralInventory[mineralId] > 0) {
        const mineral = MINERALS[mineralId];
        const value = mineral.baseValue * this.mineralInventory[mineralId];
        
        inventory.push({
          id: mineralId,
          name: mineral.name,
          quantity: this.mineralInventory[mineralId],
          value: value,
          unitValue: mineral.baseValue
        });
        totalValue += value;
      }
    }

    return { inventory, totalValue };
  }

  // ===== 곡괭이 수리 =====
  repairPickaxe() {
    if (this.pickaxeDurability >= this.maxPickaxeDurability) {
      return { success: false, message: '곡괭이가 이미 완상태입니다.' };
    }

    // 수리 비용 계산
    const damageTaken = this.maxPickaxeDurability - this.pickaxeDurability;
    const repairCost = damageTaken * 10; // 내구도 1당 10 스톤

    if (this.player.assets.stone < repairCost) {
      return { success: false, message: `수리 비용이 부족합니다. (필요: ${repairCost}, 보유: ${this.player.assets.stone})` };
    }

    this.player.assets.stone -= repairCost;
    this.pickaxeDurability = this.maxPickaxeDurability;

    return {
      success: true,
      message: `곡괭이를 ${repairCost} 스톤에 수리했습니다.`,
      repairCost: repairCost
    };
  }

  // ===== 마이닝 통계 조회 =====
  getMiningStats() {
    return {
      miningSkillLevel: this.miningSkillLevel,
      pickaxeDurability: this.pickaxeDurability,
      maxPickaxeDurability: this.maxPickaxeDurability,
      currentVein: this.currentVein,
      miningExperience: this.player.miningExperience || 0,
      nextLevelExp: (this.miningSkillLevel + 1) * 100
    };
  }
}

export { MiningSystem, MINERALS, MINERAL_SPAWN_RATES };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MiningSystem, MINERALS, MINERAL_SPAWN_RATES };
}
