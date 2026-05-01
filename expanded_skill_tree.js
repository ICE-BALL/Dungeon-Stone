/**
 * ===== 확장된 스킬 트리 시스템 =====
 * 트리 기반 스킬 시스템 확장: 100+ 스킬 노드
 * 여러 스킬 카테고리: Combat, Utility, Exploration, Economy, Magic
 * 스킬 신분 및 상호작용
 */

class ExpandedSkillTree {
  constructor() {
    this.nodes = {};
    this.skillRanks = {}; // 플레이어별 스킬 레벨
    this.skillPoints = 0;
    this.initializeSkillNodes();
  }

  // ===== 스킬 초기화 =====
  initializeSkillNodes() {
    const categories = {
      combat: this.getCombatSkills(),
      defense: this.getDefenseSkills(),
      utility: this.getUtilitySkills(),
      exploration: this.getExplorationSkills(),
      economy: this.getEconomySkills(),
      magic: this.getMagicSkills(),
      crafting: this.getCraftingSkills()
    };

    for (let category in categories) {
      categories[category].forEach(skill => {
        this.nodes[skill.id] = skill;
      });
    }
  }

  // ===== 전투 스킬 (30개) =====
  getCombatSkills() {
    return [
      // 1단계: 기본 공격
      { id: 'slash_1', name: '베기', category: 'combat', tier: 1, damage: 1.0, cost: 1, requires: [] },
      { id: 'stab_1', name: '찌르기', category: 'combat', tier: 1, damage: 1.2, cost: 1, requires: [] },
      { id: 'smash_1', name: '내려찍기', category: 'combat', tier: 1, damage: 1.5, cost: 1, requires: [] },
      
      // 2단계: 강화된 공격
      { id: 'slash_2', name: '회전베기', category: 'combat', tier: 2, damage: 1.8, cost: 3, requires: ['slash_1'] },
      { id: 'stab_2', name: '빠른찌르기', category: 'combat', tier: 2, damage: 2.0, cost: 3, requires: ['stab_1'] },
      { id: 'smash_2', name: '강한내려찍기', category: 'combat', tier: 2, damage: 2.5, cost: 3, requires: ['smash_1'] },
      
      // 3단계: 고급 콤보
      { id: 'whirlwind', name: '회오리바람', category: 'combat', tier: 3, damage: 3.0, cost: 5, requires: ['slash_2', 'stab_2'] },
      { id: 'power_strike', name: '강타', category: 'combat', tier: 3, damage: 3.5, cost: 5, requires: ['smash_2'] },
      { id: 'rapid_slash', name: '연격', category: 'combat', tier: 3, damage: 2.2, speed: 1.5, cost: 5, requires: ['slash_2'] },
      
      // 4단계: 우수급 스킬
      { id: 'berserk', name: '광전사', category: 'combat', tier: 4, damage: 4.5, cost: 8, requires: ['power_strike', 'whirlwind'] },
      { id: 'thunder_strike', name: '번개사격', category: 'combat', tier: 4, damage: 3.8, element: 'lightning', cost: 8, requires: ['rapid_slash'] },
      
      // 특수 공격
      { id: 'bleed_stab', name: '출혈 중상', category: 'combat', tier: 2, effect: 'bleed', cost: 3, requires: ['stab_1'] },
      { id: 'stun_smash', name: '기절 때리기', category: 'combat', tier: 2, effect: 'stun', cost: 3, requires: ['smash_1'] },
      { id: 'lifesteal', name: '생명력 흡수', category: 'combat', tier: 3, heals: 0.3, cost: 5, requires: ['bleed_stab'] },
      
      // 쌍검 전문
      { id: 'dual_wield_1', name: '쌍검 기본', category: 'combat', tier: 2, offhand: 0.6, cost: 4, requires: ['slash_1', 'stab_1'] },
      { id: 'dual_wield_2', name: '쌍검 마스터', category: 'combat', tier: 3, offhand: 0.9, cost: 6, requires: ['dual_wield_1'] },
      { id: 'cross_slash', name: '십자베기', category: 'combat', tier: 3, damage: 2.8, cost: 6, requires: ['dual_wield_2'] },
      
      // 반사 및 회피
      { id: 'parry_1', name: '재검', category: 'combat', tier: 1, reflect: 0.3, cost: 1, requires: [] },
      { id: 'parry_2', name: '완전한 재검', category: 'combat', tier: 2, reflect: 0.6, cost: 3, requires: ['parry_1'] },
      { id: 'riposte', name: '역습', category: 'combat', tier: 3, damage: 2.5, cost: 5, requires: ['parry_2'] }
    ];
  }

  // ===== 방어 스킬 (20개) =====
  getDefenseSkills() {
    return [
      { id: 'shield_1', name: '방패 기본', category: 'defense', tier: 1, defense: 10, cost: 1, requires: [] },
      { id: 'shield_2', name: '방패 숙련', category: 'defense', tier: 2, defense: 20, cost: 3, requires: ['shield_1'] },
      { id: 'shield_bash', name: '방패 강타', category: 'defense', tier: 2, damage: 1.5, cost: 3, requires: ['shield_1'] },
      
      { id: 'armor_1', name: '철갑 숙련', category: 'defense', tier: 1, defense: 8, cost: 1, requires: [] },
      { id: 'armor_2', name: '철갑 마스터', category: 'defense', tier: 2, defense: 15, cost: 3, requires: ['armor_1'] },
      { id: 'thick_skin', name: '두껍고 거친 피부', category: 'defense', tier: 3, defense: 12, cost: 5, requires: ['armor_2'] },
      
      { id: 'dodge_1', name: '회피 기본', category: 'defense', tier: 1, evasion: 0.05, cost: 1, requires: [] },
      { id: 'dodge_2', name: '회피 전문', category: 'defense', tier: 2, evasion: 0.12, cost: 3, requires: ['dodge_1'] },
      { id: 'shadow_step', name: '그림자 발걸음', category: 'defense', tier: 3, evasion: 0.2, cost: 5, requires: ['dodge_2'] },
      
      { id: 'regeneration_1', name: '재생 기본', category: 'defense', tier: 1, regen: 0.02, cost: 1, requires: [] },
      { id: 'regeneration_2', name: '재생 향상', category: 'defense', tier: 2, regen: 0.05, cost: 3, requires: ['regeneration_1'] },
      
      { id: 'barrier', name: '마력 보호막', category: 'defense', tier: 3, shield: 100, cost: 5, requires: [] }
    ];
  }

  // ===== 유틸리티 스킬 (25개) =====
  getUtilitySkills() {
    return [
      { id: 'sprint', name: '전력질주', category: 'utility', tier: 1, speed: 1.3, cost: 1, requires: [] },
      { id: 'sprint_2', name: '초스피드', category: 'utility', tier: 2, speed: 1.8, cost: 3, requires: ['sprint'] },
      
      { id: 'climb', name: '등반 스킬', category: 'utility', tier: 1, climb: true, cost: 1, requires: [] },
      { id: 'climb_2', name: '빠른 등반', category: 'utility', tier: 2, climb: true, speed: 1.5, cost: 3, requires: ['climb'] },
      
      { id: 'lockpick', name: '자물쇠 따기', category: 'utility', tier: 1, mechanic: true, cost: 1, requires: [] },
      { id: 'lockpick_2', name: '고급 자물쇠따기', category: 'utility', tier: 2, mechanic: true, cost: 3, requires: ['lockpick'] },
      
      { id: 'stealth_1', name: '잠입 기본', category: 'utility', tier: 1, stealth: 0.5, cost: 1, requires: [] },
      { id: 'stealth_2', name: '잠입 마스터', category: 'utility', tier: 2, stealth: 0.8, cost: 3, requires: ['stealth_1'] },
      { id: 'shadow_strike', name: '그림자 습격', category: 'utility', tier: 3, damage: 2.0, stealth: true, cost: 5, requires: ['stealth_2'] },
      
      { id: 'treasure_sense', name: '보물 감지', category: 'utility', tier: 2, sense: 'treasure', cost: 2, requires: [] },
      { id: 'trap_sense', name: '함정 감지', category: 'utility', tier: 2, sense: 'trap', cost: 2, requires: [] },
      
      { id: 'crowd_control', name: '군중 조종', category: 'utility', tier: 3, effect: 'taunt', cost: 5, requires: [] }
    ];
  }

  // ===== 탐사 스킬 (20개) =====
  getExplorationSkills() {
    return [
      { id: 'basic_navigation', name: '기본 항법', category: 'exploration', tier: 1, navigation: 1.0, cost: 1, requires: [] },
      { id: 'expert_navigation', name: '지도 읽기', category: 'exploration', tier: 2, navigation: 1.4, cost: 3, requires: ['basic_navigation'] },
      
      { id: 'foraging', name: '채집', category: 'exploration', tier: 1, gather: 'herbs', cost: 1, requires: [] },
      { id: 'advanced_foraging', name: '고급 채집', category: 'exploration', tier: 2, gather: 'rare_herbs', cost: 3, requires: ['foraging'] },
      
      { id: 'mining_basics', name: '채광 기본', category: 'exploration', tier: 1, mining: 1.0, cost: 1, requires: [] },
      { id: 'mining_expert', name: '채광 전문', category: 'exploration', tier: 2, mining: 1.5, cost: 3, requires: ['mining_basics'] },
      
      { id: 'fishing', name: '낚시', category: 'exploration', tier: 1, fishing: true, cost: 1, requires: [] },
      { id: 'fishing_pro', name: '낚시 마스터', category: 'exploration', tier: 2, fishing: true, cost: 3, requires: ['fishing'] },
      
      { id: 'rift_detection', name: '균열 감지', category: 'exploration', tier: 2, sense: 'rift', cost: 3, requires: [] }
    ];
  }

  // ===== 경제 스킬 (20개) =====
  getEconomySkills() {
    return [
      { id: 'bargaining', name: '흥정', category: 'economy', tier: 1, discount: 0.05, cost: 1, requires: [] },
      { id: 'negotiation', name: '협상술', category: 'economy', tier: 2, discount: 0.12, cost: 3, requires: ['bargaining'] },
      { id: 'persuasion', name: '설득', category: 'economy', tier: 3, discount: 0.20, cost: 5, requires: ['negotiation'] },
      
      { id: 'appraise', name: '감정', category: 'economy', tier: 1, appraise: true, cost: 1, requires: [] },
      { id: 'expert_appraise', name: '전문 감정', category: 'economy', tier: 2, appraise: true, cost: 3, requires: ['appraise'] },
      
      { id: 'commerce', name: '상업', category: 'economy', tier: 1, profit: 1.05, cost: 1, requires: [] },
      { id: 'advanced_commerce', name: '고급 상업', category: 'economy', tier: 2, profit: 1.15, cost: 3, requires: ['commerce'] },
      
      { id: 'crafting_trade', name: '수공예 판매', category: 'economy', tier: 2, craft_profit: 1.1, cost: 3, requires: [] }
    ];
  }

  // ===== 마법 스킬 (25개) =====
  getMagicSkills() {
    return [
      // 불
      { id: 'fire_bolt', name: '화염볼트', category: 'magic', tier: 1, element: 'fire', damage: 1.5, cost: 2, requires: [] },
      { id: 'fireball', name: '화염구', category: 'magic', tier: 2, element: 'fire', damage: 2.5, aoe: true, cost: 4, requires: ['fire_bolt'] },
      { id: 'inferno', name: '지옥불', category: 'magic', tier: 3, element: 'fire', damage: 4.0, aoe: true, cost: 7, requires: ['fireball'] },
      
      // 얼음
      { id: 'ice_spike', name: '얼음 창', category: 'magic', tier: 1, element: 'ice', damage: 1.3, cost: 2, requires: [] },
      { id: 'ice_storm', name: '눈보라', category: 'magic', tier: 2, element: 'ice', damage: 2.0, aoe: true, effect: 'slow', cost: 4, requires: ['ice_spike'] },
      { id: 'absolute_zero', name: '절대영도', category: 'magic', tier: 3, element: 'ice', damage: 3.5, aoe: true, effect: 'freeze', cost: 7, requires: ['ice_storm'] },
      
      // 번개
      { id: 'lightning', name: '번개', category: 'magic', tier: 1, element: 'lightning', damage: 1.8, cost: 2, requires: [] },
      { id: 'chain_lightning', name: '연쇄번개', category: 'magic', tier: 2, element: 'lightning', damage: 2.3, bounce: true, cost: 4, requires: ['lightning'] },
      
      // 신성
      { id: 'holy_light', name: '신성한 빛', category: 'magic', tier: 1, element: 'holy', damage: 1.5, heal: 0.3, cost: 3, requires: [] },
      { id: 'divine_protection', name: '신성 보호', category: 'magic', tier: 2, element: 'holy', defense: 10, cost: 4, requires: ['holy_light'] },
      
      // 어둠
      { id: 'shadow_bolt', name: '그림자 화살', category: 'magic', tier: 1, element: 'dark', damage: 1.6, cost: 2, requires: [] },
      { id: 'death_mark', name: '죽음의 표식', category: 'magic', tier: 2, element: 'dark', damage: 2.0, debuff: true, cost: 4, requires: ['shadow_bolt'] },
      
      // 보조 마법
      { id: 'teleport', name: '순간이동', category: 'magic', tier: 2, utility: true, cost: 3, requires: [] },
      { id: 'time_warp', name: '시간 왜곡', category: 'magic', tier: 3, utility: true, slow: true, cost: 6, requires: ['teleport'] }
    ];
  }

  // ===== 제작 스킬 (20개) =====
  getCraftingSkills() {
    return [
      { id: 'blacksmith_1', name: '대장장이 기본', category: 'crafting', tier: 1, craft: 'weapon', cost: 1, requires: [] },
      { id: 'blacksmith_2', name: '대장장이 숙련', category: 'crafting', tier: 2, craft: 'weapon', cost: 3, requires: ['blacksmith_1'] },
      { id: 'blacksmith_3', name: '대장장이 마스터', category: 'crafting', tier: 3, craft: 'weapon', cost: 5, requires: ['blacksmith_2'] },
      
      { id: 'armorer_1', name: '갑옷 제작 기본', category: 'crafting', tier: 1, craft: 'armor', cost: 1, requires: [] },
      { id: 'armorer_2', name: '갑옷 제작 숙련', category: 'crafting', tier: 2, craft: 'armor', cost: 3, requires: ['armorer_1'] },
      
      { id: 'alchemy_1', name: '연금술 기본', category: 'crafting', tier: 1, craft: 'potion', cost: 1, requires: [] },
      { id: 'alchemy_2', name: '연금술 숙련', category: 'crafting', tier: 2, craft: 'potion', cost: 3, requires: ['alchemy_1'] },
      
      { id: 'enchanting', name: '마법 부여', category: 'crafting', tier: 2, craft: 'enchant', cost: 4, requires: [] },
      { id: 'runesmith', name: '룬 제작', category: 'crafting', tier: 3, craft: 'rune', cost: 6, requires: ['enchanting'] },
      
      { id: 'quick_craft', name: '빠른 제작', category: 'crafting', tier: 2, speed: 1.5, cost: 3, requires: [] }
    ];
  }

  // ===== 스킬 노드 구입 =====
  purchaseSkill(nodeId, player) {
    if (!this.nodes[nodeId]) {
      return { success: false, message: '존재하지 않는 스킬입니다.' };
    }

    const skill = this.nodes[nodeId];
    const currentRank = player.skillRanks[nodeId] || 0;
    const cost = skill.cost * (1 + currentRank * 0.5); // 레벨에 따라 비용 증가

    // 전제 조건 확인
    if (skill.requires && skill.requires.length > 0) {
      for (let req of skill.requires) {
        if (!player.skillRanks[req] || player.skillRanks[req] < 1) {
          return { success: false, message: `선행 스킬 필요: ${req}` };
        }
      }
    }

    // 스킬 포인트 확인
    if (player.skillPoints < cost) {
      return { success: false, message: `스킬 포인트 부족. (필요: ${cost}, 보유: ${player.skillPoints})` };
    }

    player.skillPoints -= cost;
    player.skillRanks[nodeId] = (player.skillRanks[nodeId] || 0) + 1;

    return {
      success: true,
      message: `${skill.name}을 습득했습니다!`,
      newRank: player.skillRanks[nodeId]
    };
  }

  // ===== 스킬 보너스 계산 =====
  calculateSkillBonuses(player) {
    const bonuses = {
      damage: 1.0,
      defense: 0,
      speed: 1.0,
      evasion: 0,
      healing: 0,
      elementBonus: {}
    };

    for (let skillId in player.skillRanks) {
      const rank = player.skillRanks[skillId];
      const skill = this.nodes[skillId];

      if (!skill || rank < 1) continue;

      if (skill.damage) bonuses.damage += skill.damage * 0.1 * rank;
      if (skill.defense) bonuses.defense += skill.defense * rank;
      if (skill.speed) bonuses.speed *= skill.speed;
      if (skill.evasion) bonuses.evasion += skill.evasion * rank;
      if (skill.heals) bonuses.healing += skill.heals * rank;
    }

    return bonuses;
  }

  // ===== 스킬 트리 정보 조회 =====
  getSkillTreeInfo() {
    const stats = {
      total: Object.keys(this.nodes).length,
      byCategory: {}
    };

    for (let nodeId in this.nodes) {
      const category = this.nodes[nodeId].category;
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = 0;
      }
      stats.byCategory[category]++;
    }

    return stats;
  }

  // ===== 추천 스킬 경로 =====
  getRecommendedPath(playerClass) {
    const paths = {
      warrior: ['slash_1', 'shield_1', 'armor_1', 'slash_2', 'power_strike'],
      mage: ['fire_bolt', 'lightning', 'holy_light', 'fireball', 'ice_storm'],
      rogue: ['stab_1', 'stealth_1', 'dodge_1', 'stab_2', 'shadow_strike'],
      cleric: ['holy_light', 'divine_protection', 'regeneration_1', 'armor_1', 'shield_1']
    };

    return paths[playerClass] || [];
  }
}

export { ExpandedSkillTree };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExpandedSkillTree };
}
