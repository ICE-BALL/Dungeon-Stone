/**
 * ===== 종족 시스템 완전 통합 가이드 =====
 * 6개 종족 × 고유 시스템 = 완전히 분기된 게임플레이
 * 
 * 구조:
 * 1. 종족 정의 (data/race_definitions.js)
 * 2. 종족 시스템 코어 (race_system.js)
 * 3. 종족별 고유 시스템 (6개 파일)
 * 4. main.js 통합
 * 5. Combat 시스템 수정
 * 6. UI 통합
 */

// ========== 📋 컴포넌트 목록 ==========

const RACE_SYSTEM_COMPONENTS = {
  data_layer: [
    'data/race_definitions.js' // 모든 종족 정의, 팩션 정의, 상점 수정자'
  ],

  core_systems: [
    'race_system.js' // 종족 설정, 능력 제약, 상점 상호작용, 대화 필터
  ],

  race_specific_systems: [
    'barbarian_spirit_imprint.js', // 바바리안
    'beastkin_spirit_beast.js', // 수인
    'human_aura_system.js', // 인간
    'dwarf_engineering_toolkit.js', // 드워프
    'fairy_elemental_pact.js', // 요정
    'dragonkin_dragon_tongue.js' // 용인족
  ]
};

// ========== 🎮 통합 포인트 ==========

/**
 * 1. main.js 수정사항
 */
const MAIN_JS_MODIFICATIONS = {
  imports: `
    import { RaceSystem } from './race_system.js';
    import { SpiritImprintSystem } from './barbarian_spirit_imprint.js';
    import { SpiritBeastSystem } from './beastkin_spirit_beast.js';
    import { AuraSystem } from './human_aura_system.js';
    import { EngineeringToolkitSystem } from './dwarf_engineering_toolkit.js';
    import { ElementalPactSystem } from './fairy_elemental_pact.js';
    import { DragonTongueSystem } from './dragonkin_dragon_tongue.js';
    import { RACE_DEFINITIONS } from './data/race_definitions.js';
  `,

  player_initialization: `
    const player = new Player(gameCallbacks);
    
    // 종족 시스템 초기화
    player.raceSystem = new RaceSystem(player);
    
    // 고유 시스템 초기화 (선택적, 종족 선택 후)
    player.spiritImprintSystem = new SpiritImprintSystem(player);
    player.spiritBeastSystem = new SpiritBeastSystem(player);
    player.auraSystem = new AuraSystem(player);
    player.engineeringToolkitSystem = new EngineeringToolkitSystem(player);
    player.elementalPactSystem = new ElementalPactSystem(player);
    player.dragonTongueSystem = new DragonTongueSystem(player);
  `,

  race_selection_logic: `
    // 종족 선택 시 호출
    function selectRace(raceId) {
      const success = player.raceSystem.setPlayerRace(raceId);
      
      if (success) {
        // UI 업데이트
        updateRaceSpecificUI(raceId);
        
        // 팩션 평판 초기화
        initializeFactionReputation(player.raceSystem.currentRace);
        
        return { success: true, race: player.raceSystem.currentRace };
      }
      
      return { success: false };
    }
  `
};

/**
 * 2. 전투 시스템 수정사항
 */
const COMBAT_MODIFICATIONS = {
  damage_calculation: `
    function calculateDamage(attacker, defender) {
      let baseDamage = attacker.attack + (weaponDamage || 0);
      
      // 오러 웨폰 적용 (인간)
      if (attacker.race === 'human' && attacker.auraSystem?.activeAura === 'aura_weapon') {
        baseDamage = attacker.auraSystem.applyAuraWeaponDamage(baseDamage, defender.defense);
      }
      
      // 쌍신 슬래시 / 영혼수 협공 (수인)
      if (attacker.race === 'beastkin' && attacker.spiritBeastSystem?.currentMode === 'manifestation') {
        const beastAttack = attacker.spiritBeastSystem.performBeastAttack(defender);
        baseDamage = beastAttack.damage;
      }
      
      // 결과 반환
      return Math.max(baseDamage, 1);
    }
  `,

  defensive_calculations: `
    function calculateIncomingDamage(damage, defender) {
      // 오러 아머 적용 (인간)
      if (defender.race === 'human' && defender.auraSystem?.activeAura === 'aura_armor') {
        damage = defender.auraSystem.applyAuraArmorDamageReduction(damage, 'physical');
      }
      
      // 강철의 혼 (바바리안)
      if (defender.imprintEffects?.spirit_of_steel) {
        damage *= 0.8; // 20% 감소
      }
      
      // 요정의 유리 대포 (피해 증가)
      if (defender.race === 'fairy') {
        damage *= defender.elementalPactSystem.getGlassCannonDamageMultiplier();
      }
      
      return Math.max(damage, 1);
    }
  `,

  state_resistance: `
    function applyAilment(target, ailmentType) {
      const resistanceChance = 0;
      
      // 공포 저항 (바바리안)
      if (ailmentType === 'fear' && target.race === 'barbarian') {
        resistanceChance += 0.5;
      }
      
      // 드래곤 공포 면역 (용인족)
      if (ailmentType === 'dragon_fear' && target.race === 'dragonkin') {
        return { applied: false, reason: '드래곤 혈통의 면역' };
      }
      
      // 중독 면역 (드워프)
      if (ailmentType === 'poison' && target.race === 'dwarf') {
        return { applied: false, reason: '강철 위장' };
      }
      
      // 저항 확인
      if (Math.random() < resistanceChance) {
        return { applied: false, reason: '저항 성공' };
      }
      
      // 적용
      return { applied: true };
    }
  `
};

/**
 * 3. UI 시스템 수정사항
 */
const UI_MODIFICATIONS = {
  race_selection: `
    function renderRaceSelectionUI() {
      const races = RACE_DEFINITIONS;
      const raceButtons = Object.entries(races).map(([id, race]) => ({
        id: race.id,
        name: race.displayName,
        description: race.description,
        icon: race.icon,
        color: race.color,
        passives: race.passives.map(p => p.description)
      }));
      
      return renderRaceSelectionPanel(raceButtons);
    }
  `,

  race_specific_ui: `
    function updateRaceSpecificUI(raceId) {
      const race = RACE_DEFINITIONS[raceId];
      
      if (raceId === 'barbarian') {
        // 스피릿 임프린트 패널 표시
        showSpiritImprintPanel();
      } else if (raceId === 'human') {
        // 오러 패널 표시
        showAuraPanel();
      } else if (raceId === 'beastkin') {
        // 영혼수 계약 패널 표시
        showSpiritBeastPanel();
      } else if (raceId === 'dwarf') {
        // 도구 가방 UI 표시
        showToolkitSlots();
      } else if (raceId === 'fairy') {
        // 정령 계약 UI 표시
        showElementalPactPanel();
      } else if (raceId === 'dragonkin') {
        // 용언 UI 표시
        showDragonTonguePanel();
      }
    }
  `,

  resource_bars: `
    function renderResourceBars(player) {
      const race = player.raceSystem.currentRace;
      
      // 바바리안: MP 숨김, 분노 게이지 표시
      if (race.id === 'barbarian') {
        renderBar('HP', player.hp, player.maxHp, '#FF0000');
        renderBar('기력', player.stamina, player.maxStamina, '#FFA500');
        renderBar('분노', player.rage, 100, '#8B0000');
        // MP 바 숨김
      }
      // 일반 플레이어
      else {
        renderBar('HP', player.hp, player.maxHp, '#FF0000');
        renderBar('MP', player.mp, player.maxMp, '#0000FF');
        renderBar('기력', player.stamina, player.maxStamina, '#FFA500');
      }
    }
  `,

  dialogue_filtering: `
    function filterDialogueOptions(allOptions, player, npc) {
      return allOptions.filter(option => {
        // 종족별 대화 제약 확인
        if (!player.raceSystem.canShowDialogueOption(option.tag)) {
          return false;
        }
        
        // NPC와의 팩션 평판 확인
        const affinityBonus = player.raceSystem.hasDialogueBonus(option.tag);
        
        // UI에서 보너스 표시
        if (affinityBonus) {
          option.bonus = true;
        }
        
        return true;
      });
    }
  `
};

/**
 * 4. 게임 상태 저장/복원 수정사항
 */
const SAVE_LOAD_MODIFICATIONS = {
  player_to_json: `
    player.toJSON = function() {
      return {
        // 기존 정보
        ...existingPlayerData,
        
        // 종족 정보
        race: this.race,
        raceData: {
          id: this.race,
          stats: this.stats,
          resources: this.resources,
          factionReputation: this.factionReputation
        },
        
        // 종족별 고유 시스템
        raceSpecificSystems: {
          spiritImprints: this.spiritImprintSystem?.toJSON(),
          spiritBeast: this.spiritBeastSystem?.toJSON(),
          aura: this.auraSystem?.toJSON(),
          toolkit: this.engineeringToolkitSystem?.toJSON(),
          elementalPact: this.elementalPactSystem?.toJSON(),
          dragonTongue: this.dragonTongueSystem?.toJSON()
        }
      };
    }
  `,

  player_from_json: `
    player.fromJSON = function(data) {
      // 기존 복원
      Object.assign(this, data);
      
      // 종족 시스템 복원
      if (data.race) {
        this.raceSystem.setPlayerRace(data.race);
      }
      
      // 종족별 고유 시스템 복원
      if (data.raceSpecificSystems) {
        if (data.raceSpecificSystems.spiritImprints) {
          // this.spiritImprintSystem.fromJSON(...)
        }
        // ... 각 시스템별 복원
      }
    }
  `
};

/**
 * 5. 상점 시스템 수정사항
 */
const SHOP_MODIFICATIONS = {
  shop_pricing: `
    function calculateShopPrice(basePrice, shop, player) {
      let finalPrice = basePrice;
      
      // 종족별 가격 수정자 적용
      const racePriceModifier = player.raceSystem.getShopPrice(1.0, shop.type);
      finalPrice *= racePriceModifier;
      
      // 인간: 팩션 평판 보정
      if (player.race === 'human') {
        finalPrice *= 1 - (player.factionReputation[shop.faction] || 0) / 1000;
      }
      
      return Math.floor(finalPrice);
    }
  `,

  shop_access: `
    function canAccessShop(player, shop) {
      const shopAccess = player.raceSystem.canAccessShop(shop.type);
      
      if (!shopAccess.allowed) {
        showEventMessage(shopAccess.message);
        return false;
      }
      
      return true;
    }
  `
};

/**
 * 6. 이동 시스템 수정사항
 */
const_MOVEMENT_MODIFICATIONS = {
  tile_entry: `
    function canEnterTile(player, tileType, tileData) {
      const tileCheck = player.raceSystem.canEnterTile(tileType);
      
      if (!tileCheck.allowed) {
        showEventMessage(tileCheck.message);
        
        // 바바리안의 익사 (매 턴 데미지)
        if (tileCheck.damageType === 'drown') {
          applyPeriodicDamage(player, tileCheck.damage, 'drown');
        }
        
        return false;
      }
      
      return true;
    }
  `
};

/**
 * 7. 아이템 소비 시스템 수정사항
 */
const CONSUMABLE_MODIFICATIONS = {
  consumable_effectiveness: `
    function useConsumable(player, consumableType, baseHealing) {
      // 종족별 소비품 효율 적용
      const modifier = player.raceSystem.getConsumableModifier(consumableType);
      const finalHealing = Math.floor(baseHealing * modifier);
      
      // 드워프 특화: 포션 20% 업상, 음식 50% 업상
      if (player.race === 'dwarf') {
        const technicianBonus = player.engineeringToolkitSystem.getConsumableModifier();
        return Math.floor(finalHealing * technicianBonus);
      }
      
      player.hp = Math.min(player.hp + finalHealing, player.maxHp);
      
      return { success: true, healing: finalHealing };
    }
  `
};

// ========== 📊 예제: 각 종족의 플레이스타일 ==========

const GAMEPLAY_EXAMPLES = {
  barbarian: `
    초반:
    1. 마법 불가 패널티: 투사체, 주문 흭득 불가
    2. 물 타일 진입 불가: 수영 불가, 특정 맵 지역 봉쇄
    3. 포션 효율 50%: 약국 비효율
    
    중반:
    1. 스피릿 임프린트 학습: 골드 + 정수로 스탯 강화
    2. 분기점 선택 (3단계): 거인의 심장 vs 광전사의 피
    3. 귀족 상점 50% 바가지: 경제적 불리
    
    후반:
    1. 최상위 각인 선택 (6단계): 불꽃의 혼 vs 강철의 혼
    2. 영혼 계승: 사망 시 다음 바바리안 캐릭터에 자산 이전
  `,

  human: `
    초반:
    1. 기본 스탯: 모든 종족 중 평행 (단, 적응력으로 경험치 +10%)
    2. 모든 대화 선택지 가능: 최고의 자유도
    
    중반:
    1. 검술 레벨 50 달성 + 10,000 골드: 오러 시스템 해금
    2. 오러 웨폰 배우기: 방어력 90% 무시
    
    후반:
    1. 오러 아머: 마법 피해 50% 감소 + 투사체 반사
    2. 오러 센스: 벽 투과 감지 (Wall Hack)
    3. 최강의 방어 무시 데미지로 보스전 최강자 등극
  `,

  beastkin: `
    초반:
    1. 부족 선택: 늑대(치명타), 곰(HP), 고양이(회피)
    2. 야수 감각: 은신 감지 +40%, 어둠 페널티 무시
    
    중반:
    1. 2층 이상 던전에서 영혼수 계약
    2. 빙의 모드: 스탯 모두 +15%, 공격에 자연 속성 부여
    
    후반:
    1. 현현 모드: 영혼수 분리, 2:1 협공
    2. 각성: 게이지 100% 시 3턴 야수 변신 (스킬 쿨타임 0, MP 소모 0)
    3. 탱킹/딜 택티컬 플레이
  `,

  dwarf: `
    초반:
    1. 기본 소양: 도구 가방 5칸, 전투 중 퀵슬롯 사용
    2. 황금의 손: 판매가 +15%, 강화 성공률 +20%
    
    중반:
    1. 개조 기술: 숫돌 발라 무기 효율 3배 증폭
    2. 폭발물 전문가: 투척 무기 사거리 +2, 범위 +1칸
    
    후반:
    1. 도구 가방에 5개 도구 장착 (폭탄, 방패, 치유 포드, 스캐너 등)
    2. 긴급 수리: 전투 중 파괴된 장비 즉시 복구
    3. 아이템 마스터로 소비품 효율 150%
  `,

  fairy: `
    초반:
    1. 철 알레르기: 금속 갑옷 착용 시 매 턴 5% 데미지
    2. 마력 친화: MP 회복 +3/턴
    
    중반:
    1. 불, 물, 바람, 흙의 자연물과 상호작용: 정령 획득
    2. 각 정령은 패시브 + 스킬 보유
    
    후반:
    1. 최대 4개 정령 동시 계약
    2. 유리 대포: 피해 1.5배 받음 (높은 위험도)
    3. 강력한 정령 스킬로 보상
  `,

  dragonkin: `
    초반:
    1. 고대 혈통: 초기 스탯 1.5배 (강력한 출발)
    2. 오만: 경험치 요구량 200%, 파티 경험치 거부 (느린 성장)
    
    중반:
    1. 레벨 10: Dov (공포의 절규) - 모든 적 도망
    2. 레벨 20: Yol (화염의 절규) - 3x3 방어 무시 화염
    
    후반:
    1. 레벨 30: Fus (거절의 절규) - 인접 적 3칸 밀쳐냄 + 기절
    2. 타임 어택: 강력한 시작이지만 느린 성장, 엔드게임 전에 종족 교체 고려
  `
};

// ========== 🎯 구현 순서 ==========

const IMPLEMENTATION_ORDER = [
  '1. race_definitions.js 생성 (완료) ✅',
  '2. race_system.js 생성 (완료) ✅',
  '3. 종족별 문제 시스템 생성 (완료) ✅',
  '   - barbarian_spirit_imprint.js ✅',
  '   - beastkin_spirit_beast.js ✅',
  '   - human_aura_system.js ✅',
  '   - dwarf_engineering_toolkit.js ✅',
  '   - fairy_elemental_pact.js ✅',
  '   - dragonkin_dragon_tongue.js ✅',
  '',
  '4. main.js 통합 (다음 단계)',
  '   - import 추가',
  '   - player 초기화',
  '   - 종족 선택 콜백',
  '',
  '5. class_player_core.js 수정 (다음 단계)',
  '   - resources 프로퍼티 확장',
  '   - 종족 설정 초기화',
  '',
  '6. 전투 시스템 수정 (다음 단계)',
  '   - 데미지 계산: 오러, 각인 효과 적용',
  '   - 상태이상 저항: 종족별 저항 적용',
  '   - 영혼수 협공: 수인 특화',
  '',
  '7. UI 시스템 수정 (다음 단계)',
  '   - 종족 선택 UI',
  '   - 리소스 바 동적 표시',
  '   - 종족별 고유 UI 패널',
  '   - 대화 선택지 필터링',
  '',
  '8. 상점 시스템 수정 (다음 단계)',
  '   - 종족별 가격 수정자',
  '   - 입장 제약 (바바리안 귀족점 금지)',
  '',
  '9. 저장/복원 시스템 수정 (다음 단계)',
  '   - player.toJSON() 확장',
  '   - player.fromJSON() 복원',
  '',
  '10. 테스트 및 밸런싱 (최종 단계)'
];

// ========== ✅ 생성된 파일들 ==========

const FILES_CREATED = [
  'data/race_definitions.js (850 줄)',
  'race_system.js (800 줄)',
  'barbarian_spirit_imprint.js (550 줄)',
  'beastkin_spirit_beast.js (600 줄)',
  'human_aura_system.js (580 줄)',
  'dwarf_engineering_toolkit.js (700 줄)',
  'fairy_elemental_pact.js (650 줄)',
  'dragonkin_dragon_tongue.js (550 줄)'
];

console.log('🎉 종족 시스템 완성!');
console.log('총 5,280 줄 신규 코드 생성');
console.log('다음 단계: main.js 통합 시작');

export const RACE_SYSTEM_COMPLETION = {
  status: 'CORE_SYSTEMS_COMPLETE',
  filesCreated: FILES_CREATED.length,
  totalLines: 5280,
  nextStep: 'Integration into main.js',
  implementationOrder: IMPLEMENTATION_ORDER
};
