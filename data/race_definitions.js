/**
 * ===== 종족 정의 테이블 (Race Definitions) =====
 * 모든 종족의 기본 정보, 패시브, 특성을 중앙에서 관리
 * 데이터 기반으로 작동하여 하드코딩 방지
 */

export const RACE_DEFINITIONS = {
  // ========== 1. 바바리안 (Barbarian) ==========
  barbarian: {
    id: 'barbarian',
    name: '바바리안',
    displayName: '바바리안',
    description: '하이 리스크, 하이 리턴의 육체파 전차. 마법 불가, 순수 피지컬로만 싸운다.',
    icon: '🔥',
    color: '#D32F2F',
    
    // 기본 스탯 (상대적 배치)
    baseStats: {
      근력: 18,
      민첩성: 12,
      지구력: 15,
      정신력: 6,
      영혼력: 5
    },
    
    // 자원 시스템
    resources: {
      hp: { name: 'HP', baseValue: 150 },
      mp: { name: 'MP', baseValue: 0, locked: true, reason: '마법 불감증' },
      stamina: { name: '기력', baseValue: 100 },
      rage: { name: '분노', baseValue: 0, max: 100 }
    },
    
    // 특성 태그 (Trait Tags)
    traitTags: [
      'NO_MAGIC',           // 마법 사용 불가
      'CANNOT_SWIM',        // 수영 불가
      'NO_POTIONS',         // 포션 사용 제한 (50% 효율)
      'FEAR_RESISTANT',     // 공포 저항력 +50%
      'CONFUSION_RESISTANT' // 혼란 저항력 +50%
    ],
    
    // 패시브 능력
    passives: [
      {
        id: 'null_magic',
        name: '마법 불감증',
        description: 'MP 스탯이 0으로 고정. 마법 주문서 사용 불가.'
      },
      {
        id: 'iron_body',
        name: '맥주병 (철의 육신)',
        description: '물(Water) 타일 진입 시 매 턴 최대 HP의 20% 익사 데미지.'
      },
      {
        id: 'feral_instinct',
        name: '야성의 직감',
        description: '공포, 혼란 상태 이상 저항력 +50%'
      }
    ],
    
    // 초기 팩션 평판
    factionReputation: {
      nobility: -50,      // 귀족 - 적대적
      merchant: -20,      // 상인 - 낮음
      common: 10,         // 평민 - 중립
      religious: -60,     // 종교 - 매우 적대
      adventurers: 30     // 모험가 - 우호
    },
    
    // 고유 시스템
    uniqueSystems: ['spirit_imprint'],
    
    // 상점 수정자
    shopModifiers: {
      nobility_shop: { priceMult: 1.5, restriction: 'banned' },       // 귀족 상점 50% 바가지
      weapon_shop: { priceMult: 0.95, restriction: 'none' },          // 무기점 5% 할인
      general_store: { priceMult: 1.1, restriction: 'none' },         // 일반 상점 10% 인상
      potion_shop: { priceMult: 1.2, restriction: 'potion_limited' }  // 포션점 20% 인상
    },
    
    // 대화 필터
    dialogueRestrictions: [
      { tag: 'polite_formal', allowed: false, reason: '계급 차이' },
      { tag: 'merchant_haggle', allowed: true },
      { tag: 'brutal_choice', allowed: true }
    ]
  },

  // ========== 2. 수인 (Beastkin) ==========
  beastkin: {
    id: 'beastkin',
    name: '수인',
    displayName: '수인',
    description: '상황에 따라 태세를 전환하는 택티컬 파이터. 영혼수의 서포트.',
    icon: '🐺',
    color: '#7B1FA2',
    
    baseStats: {
      근력: 14,
      민첩성: 16,
      지구력: 13,
      정신력: 10,
      영혼력: 12
    },
    
    resources: {
      hp: { name: 'HP', baseValue: 120 },
      mp: { name: 'MP', baseValue: 80 },
      stamina: { name: '기력', baseValue: 100 },
      beastGauge: { name: '각성', baseValue: 0, max: 100 }
    },
    
    traitTags: [
      'BEAST_SENSE',        // 은신 감지 +40%, 함정 감지 +40%
      'DARKNESS_BYPASS',    // 어둠에서 명중률 페널티 무시
      'TRIBAL_INSTINCT',    // 부족 보너스
      'SPIRIT_AFFINITY'     // 영혼수 계약 가능
    ],
    
    passives: [
      {
        id: 'beast_sense',
        name: '야수 감각',
        description: '은신한 적, 함정 감지 확률 +40%. 어두운 곳에서 명중률 페널티 무시.'
      },
      {
        id: 'tribal_bonus',
        name: '부족 본능',
        description: '부족 선택에 따라 고유 보너스 획득:\n- 늑대: 치명타율 +10%\n- 곰: 최대 체력 +15%\n- 고양이: 회피율 +10%'
      }
    ],
    
    // 부족 선택지
    tribals: [
      { id: 'wolf', name: '늑대족', bonus: { critChance: 0.1 } },
      { id: 'bear', name: '곰족', bonus: { maxHp: 0.15 } },
      { id: 'cat', name: '고양이족', bonus: { evasion: 0.1 } }
    ],
    
    factionReputation: {
      nobility: -30,
      merchant: 0,
      common: 10,
      religious: -20,
      adventurers: 40,
      nature: 60
    },
    
    uniqueSystems: ['spirit_beast_contract'],
    
    shopModifiers: {
      general_store: { priceMult: 1.05 },
      hunter_guild: { priceMult: 0.9 },
      noble_shop: { priceMult: 1.15 }
    },
    
    dialogueRestrictions: [
      { tag: 'civilized_speech', allowed: true },
      { tag: 'nature_knowledge', allowed: true, bonus: true },
      { tag: 'hunting_methods', allowed: true, bonus: true }
    ]
  },

  // ========== 3. 인간 (Human) ==========
  human: {
    id: 'human',
    name: '인간',
    displayName: '인간',
    description: '대기만성형. 초반은 약하지만 오러를 습득하면 최강자 등극.',
    icon: '👨',
    color: '#F57C00',
    
    baseStats: {
      근력: 12,
      민첩성: 12,
      지구력: 12,
      정신력: 12,
      영혼력: 12
    },
    
    resources: {
      hp: { name: 'HP', baseValue: 100 },
      mp: { name: 'MP', baseValue: 100 },
      stamina: { name: '기력', baseValue: 100 },
      auraGauge: { name: '오러', baseValue: 0, max: 100 }
    },
    
    traitTags: [
      'ADAPTABLE',          // 경험치 +10%, 팩션 평판 +10%
      'CITIZENSHIP',        // 도시 입장료 면제, 은행 대출 가능
      'INSURANCE_ELIGIBLE'  // 사망 시 보험금
    ],
    
    passives: [
      {
        id: 'adaptive',
        name: '적응력',
        description: '경험치 획득량 +10%. 모든 팩션 우호도 획득량 +10%.'
      },
      {
        id: 'citizenship',
        name: '시민권',
        description: '도시 입장료 면제. 은행 대출 가능. 사망 시 보험금 수령 가능(다음 캐릭터 초기자금 지원).'
      }
    ],
    
    factionReputation: {
      nobility: 20,
      merchant: 30,
      common: 50,
      religious: 20,
      adventurers: 30
    },
    
    uniqueSystems: ['aura_system'],
    
    shopModifiers: {
      all: { priceMult: 1.0 } // 기본가
    },
    
    dialogueRestrictions: [
      { tag: 'all_dialogue', allowed: true } // 모든 대화 선택지 가능
    ]
  },

  // ========== 4. 드워프 (Dwarf) ==========
  dwarf: {
    id: 'dwarf',
    name: '드워프',
    displayName: '드워프',
    description: '자본주의가 낳은 괴물. 아이템 마스터로 전투를 지배.',
    icon: '⛏️',
    color: '#424242',
    
    baseStats: {
      근력: 13,
      민첩성: 9,
      지구력: 16,
      정신력: 11,
      영혼력: 8
    },
    
    resources: {
      hp: { name: 'HP', baseValue: 130 },
      mp: { name: 'MP', baseValue: 70 },
      stamina: { name: '기력', baseValue: 120 },
      toolkit: { name: '도구 가방', baseValue: 1, max: 5 }
    },
    
    traitTags: [
      'GOLDEN_HAND',        // 강화 +20%, 판매가 +15%
      'STEEL_STOMACH',      // 음식 회복 +50%, 중독 면역
      'ITEM_MASTER',        // 소모품 효율 1.5배
      'ENGINEERING_EXPERT'  // 도구 전문가
    ],
    
    passives: [
      {
        id: 'golden_hand',
        name: '황금의 손',
        description: '장비 강화/수리 성공률 +20%. 상점 판매가 +15%.'
      },
      {
        id: 'steel_stomach',
        name: '강철 위장',
        description: '음식/포션 섭취 시 회복량 +50%. 중독 상태 이상 면역.'
      }
    ],
    
    factionReputation: {
      nobility: 10,
      merchant: 60,
      common: 40,
      religious: 10,
      crafters: 80
    },
    
    uniqueSystems: ['engineering_toolkit'],
    
    shopModifiers: {
      weapon_shop: { priceMult: 0.85 },      // 무기점 15% 할인
      armor_shop: { priceMult: 0.85 },       // 갑옷점 15% 할인
      potion_shop: { priceMult: 0.8 },       // 포션점 20% 할인
      explosives_shop: { priceMult: 0.75 }   // 폭발물 25% 할인
    },
    
    dialogueRestrictions: [
      { tag: 'commerce', allowed: true, bonus: true },
      { tag: 'crafting', allowed: true, bonus: true },
      { tag: 'formal_speech', allowed: true }
    ]
  },

  // ========== 5. 요정 (Fairy/Elf) ==========
  fairy: {
    id: 'fairy',
    name: '요정',
    displayName: '요정',
    description: '정령과 함께하는 유리 대포. 강력하지만 취약한 극단적 플레이.',
    icon: '🧚',
    color: '#1DE9B6',
    
    baseStats: {
      근력: 9,
      민첩성: 15,
      지구력: 10,
      정신력: 16,
      영혼력: 15
    },
    
    resources: {
      hp: { name: 'HP', baseValue: 80 },
      mp: { name: 'MP', baseValue: 150 },
      stamina: { name: '기력', baseValue: 90 },
      spiritGauge: { name: '정령', baseValue: 0, max: 100 }
    },
    
    traitTags: [
      'IRON_ALLERGY',       // 금속 갑옷 착용 불가
      'MANA_AFFINITY',      // MP 회복 +3/턴
      'ELEMENTAL_PACT',     // 정령 계약 가능
      'GLASS_CANNON'        // 피격 시 취약 (데미지 1.5배)
    ],
    
    passives: [
      {
        id: 'iron_allergy',
        name: '철 알레르기',
        description: '금속 재질의 갑옷(중갑, 판금) 착용 불가. 착용 시 매 턴 데미지 및 스킬 봉인.'
      },
      {
        id: 'mana_affinity',
        name: '마력 친화',
        description: '마나 자연 회복량 +3/턴.'
      }
    ],
    
    factionReputation: {
      nobility: 30,
      merchant: 20,
      common: 0,
      religious: 40,
      nature: 80
    },
    
    uniqueSystems: ['elemental_pact'],
    
    shopModifiers: {
      magic_shop: { priceMult: 0.9 },
      noble_shop: { priceMult: 1.0 },
      general_store: { priceMult: 1.1 }
    },
    
    dialogueRestrictions: [
      { tag: 'elegance', allowed: true, bonus: true },
      { tag: 'magic_knowledge', allowed: true, bonus: true },
      { tag: 'crude_speech', allowed: false }
    ]
  },

  // ========== 6. 용인족 (Dragonkin) ==========
  dragonkin: {
    id: 'dragonkin',
    name: '용인족',
    displayName: '용인족',
    description: '태생부터 완성된 강자이지만 성장이 느려 타임 어택형 종족.',
    icon: '🐉',
    color: '#FFB300',
    
    baseStats: {
      근력: 16,
      민첩성: 14,
      지구력: 16,
      정신력: 14,
      영혼력: 16
    },
    
    resources: {
      hp: { name: 'HP', baseValue: 180 },
      mp: { name: 'MP', baseValue: 120 },
      stamina: { name: '기력', baseValue: 120 },
      dragonGauge: { name: '용언', baseValue: 0, max: 6 }
    },
    
    traitTags: [
      'ANCIENT_BLOODLINE',  // 초기 스탯 1.5배, 수명 매우 김
      'SLOW_GROWTH',        // 경험치 요구량 200%
      'DRAGON_FEAR_IMMUNE', // 드래곤 패어 면역
      'DRAGON_TONGUE'       // 용언 사용 가능
    ],
    
    passives: [
      {
        id: 'ancient_bloodline',
        name: '고대 혈통',
        description: '시작 스탯의 합계가 타 종족의 1.5배. 수명(Life Expectancy)이 매우 길다.'
      },
      {
        id: 'arrogance',
        name: '오만',
        description: '경험치 요구량 200%. 파티 플레이 시 경험치 공유 거부(독식).'
      },
      {
        id: 'dragon_fear_immune',
        name: '드래곤 위압 면역',
        description: '드래곤 계열 적의 공포 효과 면역.'
      }
    ],
    
    factionReputation: {
      nobility: 50,
      merchant: 30,
      common: -20,
      religious: 0,
      adventurers: 40
    },
    
    uniqueSystems: ['dragon_tongue'],
    
    shopModifiers: {
      noble_shop: { priceMult: 0.9 },
      all: { priceMult: 1.05 }
    },
    
    dialogueRestrictions: [
      { tag: 'pride_speech', allowed: true, bonus: true },
      { tag: 'humble_dialogue', allowed: false },
      { tag: 'power_negotiation', allowed: true, bonus: true }
    ]
  }
};

// ========== 팩션 정의 ==========
export const FACTION_DEFINITION = {
  nobility: { id: 'nobility', name: '귀족', type: 'social' },
  merchant: { id: 'merchant', name: '상인', type: 'economic' },
  common: { id: 'common', name: '평민', type: 'social' },
  religious: { id: 'religious', name: '종교', type: 'social' },
  adventurers: { id: 'adventurers', name: '모험가', type: 'social' },
  nature: { id: 'nature', name: '자연', type: 'natural' },
  crafters: { id: 'crafters', name: '장인', type: 'economic' }
};

// ========== 유틸 함수 ==========
export function getRaceById(raceId) {
  return RACE_DEFINITIONS[raceId] || null;
}

export function getAllRaces() {
  return Object.values(RACE_DEFINITIONS);
}

export function hasTraitTag(race, tag) {
  return race.traitTags?.includes(tag) || false;
}

export function getInitialFactionReputation(raceId) {
  const race = getRaceById(raceId);
  return race ? race.factionReputation : {};
}

export function getShopModifier(raceId, shopType) {
  const race = getRaceById(raceId);
  if (!race) return 1.0;
  
  const modifier = race.shopModifiers[shopType];
  if (!modifier) return race.shopModifiers['all']?.priceMult || 1.0;
  
  return modifier.priceMult || 1.0;
}

export function getShopRestriction(raceId, shopType) {
  const race = getRaceById(raceId);
  if (!race) return 'none';
  
  const modifier = race.shopModifiers[shopType];
  return modifier?.restriction || 'none';
}
