/**
 * ===== 도시 확장 시스템 =====
 * 4개 도시 × 5+ 위치 = 20+ 고유 장소
 * 위치별 잠금, NPC, 상점, 퀘스트 통합
 */

class CityLocationsSystem {
  constructor() {
    this.cities = {
      rabigeon: this.createRabigeonLocations(),
      hwangdo_karnon: this.createHwangdoKarnonLocations(),
      bifron: this.createBifronLocations(),
      kommelby: this.createKommelbyLocations()
    };
    this.unlockedLocations = new Set();
    this.locationProgress = {};
  }

  // ===== 라비젼 도시 (상업 중심) =====
  createRabigeonLocations() {
    return {
      // Tier 1: 기본 위치
      main_plaza: {
        id: 'rabigeon_main_plaza',
        name: '라비젼 중앙 광장',
        description: '도시의 심장이자 모험가들의 집결지',
        level_required: 1,
        unlocked: true,
        npcs: ['merchant_lisa', 'guard_captain', 'guild_master'],
        shops: ['general_store', 'weapon_shop'],
        quests: ['plaza_missing_item', 'plaza_escort'],
        events: ['market_day', 'festival'],
        treasures: []
      },
      
      blacksmith_district: {
        id: 'rabigeon_blacksmith_district',
        name: '대장장이 거리',
        description: '금속이 울리는 소리가 끊이지 않는 곳',
        level_required: 3,
        unlocked: false,
        unlock_type: 'exploration', // 탐사하면 자동 해제
        npcs: ['master_blacksmith', 'apprentice', 'weapon_merchant'],
        shops: ['weapon_upgrade', 'armor_shop'],
        quests: ['forge_order', 'collect_ore'],
        services: ['weapon_craft', 'armor_upgrade', 'repair'],
        treasures: ['rare_metal_ingot', 'blueprint_greatsword']
      },

      merchant_guild: {
        id: 'rabigeon_merchant_guild',
        name: '상인 길드',
        description: '상업 거래의 중심지',
        level_required: 5,
        unlocked: false,
        unlock_type: 'commerce', // 상업 거래 시 해제 (100회)
        unlock_progress: 0,
        npcs: ['guild_master', 'broker', 'trader_veteran'],
        shops: ['rare_goods', 'bulk_dealer'],
        quests: ['trading_competition', 'market_analysis'],
        services: ['bulk_purchase', 'trading_post'],
        treasures: []
      },

      temple_district: {
        id: 'rabigeon_temple_district',
        name: '사원 구역',
        description: '신의 은총이 가득한 곳',
        level_required: 7,
        unlocked: false,
        unlock_type: 'affinity', // NPC 호감도 높음 필요
        unlock_npc: 'priest_theodore',
        unlock_affinity: 50,
        npcs: ['priest_theodore', 'monk', 'oracle'],
        shops: ['holy_items', 'blessing_services'],
        quests: ['blessing_ritual', 'protect_temple'],
        services: ['blessing', 'curse_removal', 'prophecy'],
        treasures: ['holy_relic', 'blessed_weapon']
      },

      luxury_lounge: {
        id: 'rabigeon_luxury_lounge',
        name: '럭셔리 라운지',
        description: '부유층의 전유물',
        level_required: 10,
        unlocked: false,
        unlock_type: 'wealth', // 금석 일정 개수 필요 (10,000+)
        unlock_wealth: 10000,
        npcs: ['aristocrat', 'sommelier', 'art_collector'],
        shops: ['luxury_items', 'rare_items'],
        quests: ['collector_hunt', 'noble_party'],
        services: ['exclusive_trading'],
        treasures: ['legendary_artifact', 'mystery_box']
      }
    };
  }

  // ===== 황도 카르논 (전투 중심) =====
  createHwangdoKarnonLocations() {
    return {
      arena: {
        id: 'hwangdo_karnon_arena',
        name: '황도 카르논 전투장',
        description: '무술가들이 모여 실력을 겨루는 곳',
        level_required: 5,
        unlocked: true,
        npcs: ['arena_master', 'champion', 'tournament_organizer'],
        shops: ['combat_gear'],
        quests: ['tournament_1v1', 'tournament_team'],
        services: ['gladiator_training', 'tournament_registration'],
        treasures: ['champion_belt', 'war_medal']
      },

      gladiator_barracks: {
        id: 'hwangdo_karnon_barracks',
        name: '검투사 병영',
        description: '전투 광인들의 보금자리',
        level_required: 8,
        unlocked: false,
        unlock_type: 'combat', // 전투 100회 필요
        unlock_progress: 0,
        npcs: ['trainer_rex', 'weapon_master', 'veteran_fighter'],
        shops: ['heavy_weapons', 'combat_supplies'],
        quests: ['training_montage', 'prove_strength'],
        services: ['advanced_training', 'combat_simulation'],
        treasures: []
      },

      war_museum: {
        id: 'hwangdo_karnon_museum',
        name: '전쟁 박물관',
        description: '역사의 전투들이 기록된 곳',
        level_required: 12,
        unlocked: false,
        unlock_type: 'quest', // 특정 퀘스트 완료
        unlock_quest: 'defeat_legendary_warrior',
        npcs: ['curator', 'historian', 'artifact_keeper'],
        shops: ['historical_weapons', 'artifacts'],
        quests: ['artifact_hunt', 'historical_reenactment'],
        services: ['historical_knowledge'],
        treasures: ['ancient_blade', 'war_journal']
      },

      dueling_grounds: {
        id: 'hwangdo_karnon_dueling_grounds',
        name: '결투장',
        description: '명예와 실력을 증명하는 최고의 무대',
        level_required: 15,
        unlocked: false,
        unlock_type: 'achievements', // 업적 3개 필요
        unlock_achievements: ['combat_master', 'arena_champion'],
        npcs: ['duel_master', 'challenge_board', 'referee'],
        shops: [],
        quests: ['ultimate_duel', 'rank_advancement'],
        services: ['ranked_duel', 'rank_reset'],
        treasures: ['legendary_duel_trophy']
      }
    };
  }

  // ===== 비프론 (마법 중심) =====
  createBifronLocations() {
    return {
      mage_tower: {
        id: 'bifron_mage_tower',
        name: '마법사 탑',
        description: '신비한 마력이 흘러나오는 건물',
        level_required: 6,
        unlocked: false,
        unlock_type: 'magic', // 마법 스킬 레벨 5 필요
        unlock_magic_level: 5,
        npcs: ['archmage', 'apprentice_mage', 'enchanter'],
        shops: ['spells', 'magical_components'],
        quests: ['tower_puzzle', 'magical_research'],
        services: ['spell_training', 'enchantment'],
        treasures: ['spell_tome', 'mana_crystal']
      },

      alchemy_lab: {
        id: 'bifron_alchemy_lab',
        name: '연금술 실험실',
        description: '신비로운 물질 변환이 일어나는 곳',
        level_required: 8,
        unlocked: false,
        unlock_type: 'crafting', // 제작 10회
        unlock_progress: 0,
        npcs: ['alchemist_master', 'potion_seller', 'ingredient_gatherer'],
        shops: ['potions', 'alchemy_supplies'],
        quests: ['create_potion', 'rare_ingredient_hunt'],
        services: ['potion_brewing', 'transmutation'],
        treasures: ['philosopher_stone', 'elixir_recipe']
      },

      runestone_library: {
        id: 'bifron_runestone_library',
        name: '룬석 도서관',
        description: '고대의 지식과 주문이 보관된 곳',
        level_required: 10,
        unlocked: false,
        unlock_type: 'knowledge', // 스킬 습득 15개
        unlock_skill_count: 15,
        npcs: ['head_librarian', 'ancient_keeper', 'scholar'],
        shops: ['ancient_scrolls', 'runestones'],
        quests: ['copy_runescript', 'decode_ancient'],
        services: ['rune_crafting', 'knowledge_research'],
        treasures: ['master_rune', 'lost_spell_scroll']
      },

      crystal_cavern: {
        id: 'bifron_crystal_cavern',
        name: '수정 동굴',
        description: '거대한 마력 수정으로 가득 찬 던전',
        level_required: 14,
        unlocked: false,
        unlock_type: 'quest', // 특정 퀘스트
        unlock_quest: 'find_crystal_cavern',
        npcs: ['crystal_guardian', 'miner_expert'],
        shops: [],
        quests: ['mine_crystals', 'crystal_guardian_challenge'],
        services: ['crystal_recharge'],
        treasures: ['star_crystal', 'core_of_stars']
      }
    };
  }

  // ===== 코멜비 (잠금해제 도시) =====
  createKommelbyLocations() {
    return {
      mystical_market: {
        id: 'kommelby_mystical_market',
        name: '신비로운 시장',
        description: '다른 차원에서 온 물품들이 거래되는 곳',
        level_required: 12,
        unlocked: false,
        unlock_type: 'rifts', // 균열 10회 진입
        unlock_progress: 0,
        npcs: ['interdimensional_merchant', 'curious_trader'],
        shops: ['exotic_goods', 'mysterious_items'],
        quests: ['find_rare_item', 'interdimensional_trade'],
        services: ['interdimensional_exchange'],
        treasures: ['artifact_of_worlds', 'dimensional_key']
      },

      sanctuary_of_ancients: {
        id: 'kommelby_sanctuary_of_ancients',
        name: '고대인의 성역',
        description: '오래전 문명의 유적',
        level_required: 15,
        unlocked: false,
        unlock_type: 'lore', // 특수 조건 - 여러 퀘스트 완료
        unlock_quests: ['meet_ancient_guardian', 'solve_ancient_puzzle'],
        npcs: ['ancient_guardian', 'ghostly_scholar'],
        shops: ['ancient_artifacts', 'lost_knowledge'],
        quests: ['ancient_prophecy', 'restore_sanctuary'],
        services: ['ancient_knowledge', 'blessing_of_ancients'],
        treasures: ['divine_artifact', 'eternal_equipment']
      },

      collapse_epicenter: {
        id: 'kommelby_collapse_epicenter',
        name: '붕괴의 중심지',
        description: '차원의 경계가 무너지는 곳',
        level_required: 18,
        unlocked: false,
        unlock_type: 'endgame', // 엔드게임 콘텐츠
        unlock_quest: 'reach_dimension_collapse',
        npcs: [],
        shops: [],
        quests: ['final_challenge', 'dimensional_collapse_save'],
        services: [],
        treasures: ['ultimate_artifact', 'transcendence_stone']
      }
    };
  }

  // ===== 위치 잠금해제 로직 =====
  checkUnlockConditions(locationId, player, gameState) {
    const location = this.findLocation(locationId);
    if (!location || location.unlocked) return true;

    const types = {
      exploration: () => player.totalExplorations >= 20,
      commerce: () => {
        if (!this.locationProgress[locationId]) this.locationProgress[locationId] = { trades: 0 };
        return this.locationProgress[locationId].trades >= 100;
      },
      affinity: () => gameState.npcAffinity[location.unlock_npc]?.value >= location.unlock_affinity,
      wealth: () => (player.assets?.stone || 0) >= location.unlock_wealth,
      combat: () => {
        if (!this.locationProgress[locationId]) this.locationProgress[locationId] = { combats: 0 };
        return this.locationProgress[locationId].combats >= 100;
      },
      quest: () => gameState.completedQuests?.includes(location.unlock_quest),
      magic: () => (player.skillRanks?.magic_level || 0) >= location.unlock_magic_level,
      crafting: () => {
        if (!this.locationProgress[locationId]) this.locationProgress[locationId] = { crafts: 0 };
        return this.locationProgress[locationId].crafts >= 10;
      },
      knowledge: () => Object.keys(player.skillRanks || {}).length >= location.unlock_skill_count,
      achievements: () => location.unlock_achievements?.every(ach => gameState.achievements?.includes(ach)),
      rifts: () => {
        if (!this.locationProgress[locationId]) this.locationProgress[locationId] = { rifts: 0 };
        return this.locationProgress[locationId].rifts >= 10;
      },
      lore: () => location.unlock_quests?.every(q => gameState.completedQuests?.includes(q)),
      endgame: () => gameState.currentDimensionCollapse !== undefined
    };

    const conditionMet = types[location.unlock_type]?.();
    if (conditionMet) {
      location.unlocked = true;
      this.unlockedLocations.add(locationId);
    }
    return conditionMet || false;
  }

  // ===== 위치 찾기 =====
  findLocation(locationId) {
    for (let cityKey in this.cities) {
      const city = this.cities[cityKey];
      if (city[locationId.replace(`${cityKey}_`, '')]) {
        return city[locationId.replace(`${cityKey}_`, '')];
      }
    }
    return null;
  }

  // ===== 도시별 위치 목록 조회 =====
  getLocationsByCity(cityName) {
    return this.cities[cityName] ? Object.values(this.cities[cityName]) : [];
  }

  // ===== 접근 가능한 위치 목록 =====
  getAccessibleLocations(cityName, player, gameState) {
    const locations = this.getLocationsByCity(cityName);
    return locations.filter(loc => {
      if (player.level < loc.level_required) return false;
      return this.checkUnlockConditions(loc.id, player, gameState);
    });
  }

  // ===== 진행 업데이트 (상인 거래, 전투, 짓기 등) =====
  recordProgress(locationId, type) {
    if (!this.locationProgress[locationId]) {
      this.locationProgress[locationId] = {};
    }

    const typeMap = {
      commerce: 'trades',
      combat: 'combats',
      crafting: 'crafts',
      rifts: 'rifts',
      exploration: 'explorations'
    };

    if (typeMap[type]) {
      this.locationProgress[locationId][typeMap[type]] = 
        (this.locationProgress[locationId][typeMap[type]] || 0) + 1;
    }
  }

  // ===== 위치별 이벤트 생성 =====
  generateLocationEvent(location, player) {
    const events = {
      rabigeon_main_plaza: () => ({
        type: 'market_day',
        name: '시장의 날',
        description: '특별 할인 상품들이 나타났다!',
        reward: { discount: 0.2 }
      }),
      rabigeon_blacksmith_district: () => ({
        type: 'weapon_order',
        name: '무기 주문',
        description: '특별한 무기를 만들어줄 수 있는 기회',
        reward: { craft_time: 0.5 }
      }),
      hwangdo_karnon_arena: () => ({
        type: 'tournament',
        name: '토너먼트 개최',
        description: '강력한 선수들과 경쟁할 기회',
        reward: { item: 'tournament_token' }
      }),
      bifron_mage_tower: () => ({
        type: 'spell_research',
        name: '마법 연구',
        description: '새로운 마법을 배울 수 있다',
        reward: { skill_point: 1 }
      })
    };

    return events[location.id]?.() || { type: 'none' };
  }

  // ===== 위치 정보 조회 =====
  getLocationInfo(locationId) {
    const location = this.findLocation(locationId);
    if (!location) return null;

    return {
      ...location,
      npcs: location.npcs || [],
      shops: location.shops || [],
      quests: location.quests || [],
      services: location.services || [],
      treasures: location.treasures || []
    };
  }

  // ===== 모든 위치의 통계 =====
  getLocationStats() {
    let total = 0;
    let unlocked = 0;

    for (let cityKey in this.cities) {
      const locations = Object.values(this.cities[cityKey]);
      total += locations.length;
      unlocked += locations.filter(loc => loc.unlocked).length;
    }

    return {
      total,
      unlocked,
      locked: total - unlocked,
      percentage: Math.floor((unlocked / total) * 100)
    };
  }
}

export { CityLocationsSystem };
