/**
 * ===== 종족 시스템 (Race System) =====
 * 플레이어의 종족에 따라 게임 로직을 분기 처리
 * 능력 제약, 자원 관리, 팩션 평판, 상점 수정자 통합
 */

import { 
  RACE_DEFINITIONS, 
  getRaceById, 
  hasTraitTag,
  getShopModifier,
  getShopRestriction 
} from './data/race_definitions.js';

export class RaceSystem {
  constructor(player) {
    this.player = player;
    this.currentRace = null;
  }

  // ===== 종족 설정 =====
  setPlayerRace(raceId) {
    const race = getRaceById(raceId);
    if (!race) {
      console.error(`Unknown race: ${raceId}`);
      return false;
    }

    this.currentRace = race;
    this.player.race = raceId;
    this.player.raceData = race;

    // 기본 스탯 적용
    this.applyBaseStats(race);

    // 자원 시스템 확장
    this.initializeResources(race);

    // 팩션 평판 초기화
    this.initializeFactionReputation(race);

    // 종족 특성 시스템 초기화
    this.initializeRaceSpecificSystems(race);

    return true;
  }

  // ===== 기본 스탯 적용 =====
  applyBaseStats(race) {
    if (!this.player.stats) {
      this.player.stats = {};
    }

    for (let statName in race.baseStats) {
      this.player.stats[statName] = race.baseStats[statName];
    }

    // 용인족의 경우 1.5배 보정
    if (race.id === 'dragonkin') {
      for (let statName in this.player.stats) {
        this.player.stats[statName] *= 1.5;
      }
    }
  }

  // ===== 자원 시스템 초기화 =====
  initializeResources(race) {
    if (!this.player.resources) {
      this.player.resources = {};
    }

    for (let resourceKey in race.resources) {
      const resourceDef = race.resources[resourceKey];

      // 고정된 자원 처리 (예: 바바리안의 MP = 0)
      if (resourceDef.locked) {
        this.player.resources[resourceKey] = {
          current: 0,
          max: 0,
          locked: true,
          reason: resourceDef.reason
        };
      } else {
        this.player.resources[resourceKey] = {
          current: resourceDef.baseValue,
          max: resourceDef.max || resourceDef.baseValue,
          locked: false
        };
      }
    }

    // 기존 HP/MP 호환성 유지
    this.player.maxHp = race.resources.hp.baseValue;
    this.player.hp = race.resources.hp.baseValue;
    
    if (!race.resources.mp.locked) {
      this.player.maxMp = race.resources.mp.baseValue;
      this.player.mp = race.resources.mp.baseValue;
    } else {
      this.player.maxMp = 0;
      this.player.mp = 0;
    }

    this.player.maxStamina = race.resources.stamina.baseValue;
    this.player.stamina = race.resources.stamina.baseValue;
  }

  // ===== 팩션 평판 초기화 =====
  initializeFactionReputation(race) {
    if (!this.player.factionReputation) {
      this.player.factionReputation = {};
    }

    for (let factionId in race.factionReputation) {
      this.player.factionReputation[factionId] = race.factionReputation[factionId];
    }
  }

  // ===== 종족 특성 시스템 초기화 =====
  initializeRaceSpecificSystems(race) {
    this.player.raceSpecificData = {
      traitTags: race.traitTags || [],
      uniqueSystems: race.uniqueSystems || [],
      passives: race.passives || []
    };

    // 종족별 고유 시스템 초기화 (선택적)
    if (race.id === 'barbarian') {
      this.player.spiritImprints = {};
    } else if (race.id === 'beastkin') {
      this.player.selectedTribal = null;
      this.player.spiritBeastMode = 'none'; // none, possession, manifestation
    } else if (race.id === 'human') {
      this.player.auraState = null;
    } else if (race.id === 'dwarf') {
      this.player.toolkitSlots = [];
    } else if (race.id === 'fairy') {
      this.player.elementalPacts = [];
    } else if (race.id === 'dragonkin') {
      this.player.dragonTongueUnlocked = [];
    }
  }

  // ===== 능력 제약 검증 =====

  /**
   * 마법 사용 가능 여부 확인
   */
  canUseMagic() {
    if (!this.currentRace) return true;
    return !hasTraitTag(this.currentRace, 'NO_MAGIC');
  }

  /**
   * 특정 마법 사용 시도
   */
  tryUseMagic(spellName) {
    if (!this.canUseMagic()) {
      return {
        success: false,
        message: `마나 감응력이 없어 주문이 실패했습니다. (${spellName})`
      };
    }
    return { success: true };
  }

  /**
   * MP 소모 가능 여부
   */
  canConsumeMp(amount = 0) {
    if (!this.currentRace) return true;
    
    if (hasTraitTag(this.currentRace, 'NO_MAGIC')) {
      return false;
    }

    return this.player.mp >= amount;
  }

  /**
   * 특정 타일에 진입 가능 여부
   */
  canEnterTile(tileType) {
    if (!this.currentRace) return true;

    // 바바리안은 물 타일 진입 불가
    if (hasTraitTag(this.currentRace, 'CANNOT_SWIM') && tileType === 'water') {
      return {
        allowed: false,
        message: '이 깊은 물은 헤엄칠 수 없습니다. 익사할 위험이 있습니다.',
        damage: this.player.maxHp * 0.2, // 매 턴 20% 데미지
        damageType: 'drown'
      };
    }

    return { allowed: true };
  }

  /**
   * 포션/음식 사용 제약
   */
  getConsumableModifier(consumableType) {
    if (!this.currentRace) return 1.0;

    if (hasTraitTag(this.currentRace, 'NO_POTIONS')) {
      if (consumableType === 'potion') return 0.5; // 포션 50% 효율
    }

    if (hasTraitTag(this.currentRace, 'STEEL_STOMACH')) {
      if (consumableType === 'food') return 1.5; // 음식 150% 효율
    }

    // 티켓 마스터는 모든 소모품 150% 효율
    if (hasTraitTag(this.currentRace, 'ITEM_MASTER')) {
      return 1.5;
    }

    return 1.0;
  }

  /**
   * 장비 슬롯 제약
   */
  getEquipmentRestrictions() {
    if (!this.currentRace) return {};

    const restrictions = {
      'fairy': {
        forbidden_armor: ['heavy_armor', 'plate_armor', 'metal_armor'],
        message: '금속 재질의 갑옷은 착용할 수 없습니다.'
      },
      'barbarian': {
        forbidden_armor: [] // 제약 없음
      }
    };

    return restrictions[this.currentRace.id] || {};
  }

  // ===== 상점/경제 시스템 = 

  /**
   * 특정 상점의 조정된 가격 계산
   */
  getShopPrice(basePrice, shopType) {
    if (!this.currentRace) return basePrice;

    // 가격 수정자 적용
    const priceMult = getShopModifier(this.currentRace.id, shopType);
    return Math.floor(basePrice * priceMult);
  }

  /**
   * 상점 접근 제약
   */
  canAccessShop(shopType) {
    if (!this.currentRace) return true;

    const restriction = getShopRestriction(this.currentRace.id, shopType);

    if (restriction === 'banned') {
      return {
        allowed: false,
        message: '이 상점에서는 당신을 받아주지 않습니다.',
        eventType: 'shop_ban'
      };
    }

    if (restriction === 'potion_limited') {
      return {
        allowed: true,
        message: '포션 구매는 제한됩니다.',
        limitedItems: ['potion']
      };
    }

    return { allowed: true };
  }

  /**
   * 팩션 평판 획득 시 종족 보정
   */
  getReputationModifier() {
    if (!this.currentRace) return 1.0;

    // 인간은 모든 팩션 평판 +10%
    if (hasTraitTag(this.currentRace, 'ADAPTABLE')) {
      return 1.1;
    }

    return 1.0;
  }

  // ===== NPC 대화 필터링 =====

  /**
   * 특정 대화 선택지 표시 여부
   */
  canShowDialogueOption(optionTag) {
    if (!this.currentRace) return true;

    const restrictions = this.currentRace.dialogueRestrictions || [];

    for (let restriction of restrictions) {
      if (restriction.tag === optionTag) {
        return restriction.allowed;
      }

      // 와일드카드 처리
      if (restriction.tag === 'all_dialogue') {
        return restriction.allowed;
      }
    }

    return true;
  }

  /**
   * 도출된 대화 선택지들
   */
  getAvailableDialogueOptions(allOptions) {
    if (!this.player.race) return allOptions;

    return allOptions.filter(option => this.canShowDialogueOption(option.tag));
  }

  /**
   * 대화 선택지에 보너스 표시
   */
  hasDialogueBonus(optionTag) {
    if (!this.currentRace) return false;

    const restrictions = this.currentRace.dialogueRestrictions || [];

    for (let restriction of restrictions) {
      if (restriction.tag === optionTag && restriction.bonus) {
        return true;
      }
    }

    return false;
  }

  // ===== 전투 메커닉 =====

  /**
   * 공포(Fear) 상태 저항 추가
   */
  getFearResistance() {
    if (!this.currentRace) return 0;

    if (hasTraitTag(this.currentRace, 'FEAR_RESISTANT')) {
      return 0.5; // 50% 저항
    }

    return 0;
  }

  /**
   * 혼란(Confusion) 상태 저항
   */
  getConfusionResistance() {
    if (!this.currentRace) return 0;

    if (hasTraitTag(this.currentRace, 'CONFUSION_RESISTANT')) {
      return 0.5; // 50% 저항
    }

    return 0;
  }

  /**
   * 드래곤 공포 면역 여부
   */
  isDragonFearImmune() {
    if (!this.currentRace) return false;
    return hasTraitTag(this.currentRace, 'DRAGON_FEAR_IMMUNE');
  }

  /**
   * 중독(Poison) 면역 여부
   */
  isPoisonImmune() {
    if (!this.currentRace) return false;
    return hasTraitTag(this.currentRace, 'STEEL_STOMACH');
  }

  // ===== 경험치 및 성장 =====

  /**
   * 경험치 획득 시 수정자
   */
  getExperienceModifier() {
    if (!this.currentRace) return 1.0;

    if (hasTraitTag(this.currentRace, 'ADAPTABLE')) {
      return 1.1; // 10% 더 빨리 성장
    }

    if (hasTraitTag(this.currentRace, 'SLOW_GROWTH')) {
      return 0.5; // 200% 요구량 = 50% 획득
    }

    return 1.0;
  }

  /**
   * 레벨업 필요 경험치
   */
  getExperienceRequired(level) {
    let baseExp = level * 100;

    if (hasTraitTag(this.currentRace, 'SLOW_GROWTH')) {
      baseExp *= 2.0; // 드래곤은 2배
    }

    return baseExp;
  }

  // ===== 고유 시스템 접근 =====

  /**
   * 종족이 고유 시스템을 가지고 있는지 확인
   */
  hasUniqueSystem(systemName) {
    if (!this.currentRace) return false;
    return this.currentRace.uniqueSystems?.includes(systemName) || false;
  }

  /**
   * 모든 종족 패시브 정보
   */
  getRacePassives() {
    if (!this.currentRace) return [];
    return this.currentRace.passives || [];
  }

  // ===== 디버깅 정보 =====

  /**
   * 현재 종족 정보 출력
   */
  getRaceInfo() {
    if (!this.currentRace) return null;

    return {
      id: this.currentRace.id,
      name: this.currentRace.displayName,
      description: this.currentRace.description,
      baseStats: this.currentRace.baseStats,
      traitTags: this.currentRace.traitTags,
      passives: this.currentRace.passives,
      uniqueSystems: this.currentRace.uniqueSystems,
      factionReputation: this.currentRace.factionReputation
    };
  }
}
