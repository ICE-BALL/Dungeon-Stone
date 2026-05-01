/**
 * ===== 드워프 공학 도구 시스템 (Engineering Toolkit) =====
 * 전투 중 퀵슬롯처럼 사용 가능한 도구 및 기술
 * 폭탄, 단검, 숫돌, 기름 등을 조합하여 전투 효율 극대화
 */

export class EngineeringToolkitSystem {
  constructor(player) {
    this.player = player;
    this.toolkitSlots = [];
    this.maxSlots = 5;
    this.activeTools = {};
    this.toolInventory = {};

    this.availableTools = this.initializeTools();
  }

  // ===== 도구 정의 =====
  initializeTools() {
    return {
      // 강화 도구
      whetstone: {
        id: 'whetstone',
        name: '숫돌',
        category: 'enhancement',
        description: '무기에 발라 효율을 3배로 증폭 (일반 종족은 1배)',
        effect: {
          damageMultiplier: 3.0,  // 드워프는 3배
          basicMultiplier: 1.0    // 일반 종족은 1배
        },
        duration: 5, // 턴 수
        mpCost: 0,
        cooldown: 3
      },

      magical_oil: {
        id: 'magical_oil',
        name: '마력 기름',
        category: 'enhancement',
        description: '무기에 발라 마법 피해 추가',
        effect: {
          addMagicDamage: 30,
          duration: 5
        },
        mpCost: 0,
        cooldown: 3
      },

      // 폭발 도구
      iron_bomb: {
        id: 'iron_bomb',
        name: '철폭탄',
        category: 'explosive',
        description: '투척형 범위 공격. 사거리 +2, 범위 +1칸. 아군 오폭 피해 없음.',
        effect: {
          damage: 50,
          rangeBonus: 2,
          areaBonus: 1,
          friendlyFireResistance: true
        },
        mpCost: 0,
        cooldown: 2,
        consumable: true,
        quantity: 1
      },

      fire_bomb: {
        id: 'fire_bomb',
        name: '화염탄',
        category: 'explosive',
        description: '화염 범위 공격',
        effect: {
          damage: 60,
          element: 'fire',
          rangeBonus: 2,
          areaBonus: 1,
          burnDuration: 3
        },
        mpCost: 0,
        cooldown: 3,
        consumable: true,
        quantity: 1
      },

      sticky_bomb: {
        id: 'sticky_bomb',
        name: '점착탄',
        category: 'explosive',
        description: '대상에 붙어 다음 턴에 폭발. 높은 데미지.',
        effect: {
          damage: 100,
          delayed: true,
          delayTurns: 1,
          rangeBonus: 1
        },
        mpCost: 0,
        cooldown: 4,
        consumable: true,
        quantity: 1
      },

      // 투척 도구
      throwing_knife: {
        id: 'throwing_knife',
        name: '투척 단검',
        category: 'throwable',
        description: '원거리 투척 공격. 연쇄 공격 가능.',
        effect: {
          damage: 40,
          range: 3,
          chainAttack: true,
          chainCount: 3 // 최대 3명에게 연쇄
        },
        mpCost: 0,
        cooldown: 1,
        consumable: true,
        quantity: 1
      },

      // 방어 도구
      shield_projector: {
        id: 'shield_projector',
        name: '방패 생성기',
        category: 'defense',
        description: '일시적 보호막 생성. 모두에게 방어력 +20',
        effect: {
          defenseBonus: 20,
          targets: 'all',
          duration: 5
        },
        mpCost: 20,
        cooldown: 4
      },

      healing_pod: {
        id: 'healing_pod',
        name: '치유 포드',
        category: 'healing',
        description: '아군 체력 회복 (최대 HP의 30%)',
        effect: {
          healing: 0.3,
          targets: 'single_or_all'
        },
        mpCost: 15,
        cooldown: 2
      },

      // 특수 도구
      scanner: {
        id: 'scanner',
        name: '스캐너',
        category: 'utility',
        description: '적의 약점 노출. 클로킹 해제.',
        effect: {
          exposeWeakness: true,
          Pierce: 'invisibility'
        },
        mpCost: 10,
        cooldown: 5
      },

      lockpick_set: {
        id: 'lockpick_set',
        name: '자물쇠 펴기 도구',
        category: 'utility',
        description: '자물쇠를 열 수 있음. (던전 탐사용)',
        effect: {
          unlock: true,
          successRate: 0.95
        },
        mpCost: 0,
        cooldown: 0
      }
    };
  }

  // ===== 도구 슬롯 관리 =====
  /**
   * 도구를 도구 가방 슬롯에 추가
   */
  addToolToToolkit(toolId) {
    if (this.toolkitSlots.length >= this.maxSlots) {
      return {
        success: false,
        message: `도구 슬롯이 가득 찼습니다. (${this.maxSlots}/${this.maxSlots})`
      };
    }

    const tool = this.availableTools[toolId];
    if (!tool) {
      return { success: false, message: '존재하지 않는 도구입니다.' };
    }

    this.toolkitSlots.push(toolId);
    return { success: true, message: `${tool.name}을(를) 도구 가방에 추가했습니다.` };
  }

  /**
   * 도구를 도구 가방에서 제거
   */
  removeToolFromToolkit(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.toolkitSlots.length) {
      return { success: false, message: '유효하지 않은 슬롯입니다.' };
    }

    const toolId = this.toolkitSlots[slotIndex];
    const tool = this.availableTools[toolId];

    this.toolkitSlots.splice(slotIndex, 1);
    return {
      success: true,
      message: `${tool.name}을(를) 도구 가방에서 제거했습니다.`
    };
  }

  /**
   * 도구 가방 상태 조회
   */
  getToolkitStatus() {
    return {
      slots: this.toolkitSlots.map((toolId, index) => {
        const tool = this.availableTools[toolId];
        const cooldown = this.activeTools[toolId]?.remainingCooldown || 0;

        return {
          slot: index,
          toolId: tool.id,
          name: tool.name,
          category: tool.category,
          onCooldown: cooldown > 0,
          remainingCooldown: cooldown
        };
      }),
      maxSlots: this.maxSlots,
      filledSlots: this.toolkitSlots.length
    };
  }

  // ===== 기술: 개조 (Modify) =====
  /**
   * 무기에 숫돌이나 기름을 발라 효과 3배 증폭 (일반 종족은 1배)
   */
  modifyWeapon(toolType) {
    if (toolType !== 'whetstone' && toolType !== 'magical_oil') {
      return { success: false, message: '이 도구로는 개조할 수 없습니다.' };
    }

    const weaponSlot = this.player.equipment?.['무기'];
    if (!weaponSlot) {
      return { success: false, message: '장착된 무기가 없습니다.' };
    }

    const tool = this.availableTools[toolType];
    const weapon = this.player.inventory?.find(item => item.id === weaponSlot);

    if (!weapon) return { success: false, message: '무기 정보를 찾을 수 없습니다.' };

    // 효과 적용
    const dwarfMultiplier = 3.0;  // 드워프는 3배
    const modifier = {
      toolApplied: toolType,
      duration: tool.duration,
      multiplier: dwarfMultiplier,
      enhancedWeapon: {
        originalDamage: weapon.damage,
        enhancedDamage: Math.floor(weapon.damage * dwarfMultiplier)
      }
    };

    if (!this.player.weaponModifiers) {
      this.player.weaponModifiers = {};
    }

    this.player.weaponModifiers[weaponSlot] = modifier;

    return {
      success: true,
      message: `${weapon.name}에 ${tool.name}을(를) 발라 효율을 3배로 증폭했습니다!`,
      modifier
    };
  }

  // ===== 기술: 폭파 전문가 (Demolitionist) =====
  /**
   * 투척 무기의 사거리 +2, 범위 +1칸. 아군 오폭 피해 없음.
   */
  demoListTechnique(bombType) {
    const tool = this.availableTools[bombType];

    if (!tool || tool.category !== 'explosive') {
      return { success: false, message: '폭발물이 아닙니다.' };
    }

    // MP/골드 확인
    const mpCost = tool.mpCost || 0;
    if (this.player.mp < mpCost) {
      return {
        success: false,
        message: `MP가 부족합니다. (필요: ${mpCost})`
      };
    }

    // 효과 적용
    const enhancedBomb = {
      originalTool: bombType,
      rangeBonus: tool.effect.rangeBonus + 2,
      areaBonus: tool.effect.areaBonus + 1,
      friendlyFireResistance: true,
      damage: Math.floor(tool.effect.damage * 1.3) // 30% 데미지 증가
    };

    return {
      success: true,
      message: `${tool.name}의 위력이 증대되었습니다! (사거리 +2, 범위 +1칸, 아군 오폭 없음)`,
      enhancedBomb
    };
  }

  // ===== 기술: 긴급 수리 (Quick Fix) =====
  /**
   * 전투 중 파괴된 장비(내구도 0)를 즉시 수리하여 다시 착용 가능
   */
  quickFixEquipment(itemSlot) {
    const equipment = this.player.equipment?.[itemSlot];

    if (!equipment) {
      return { success: false, message: '해당 슬롯에 장비가 없습니다.' };
    }

    const inventoryItem = this.player.inventory?.find(item => item.id === equipment);

    if (!inventoryItem) {
      return { success: false, message: '장비 정보를 찾을 수 없습니다.' };
    }

    if (inventoryItem.durability > 0) {
      return { success: false, message: '이미 온전한 장비입니다.' };
    }

    // 수리
    inventoryItem.durability = inventoryItem.maxDurability;

    return {
      success: true,
      message: `${inventoryItem.name}을(를) 긴급 수리했습니다!`,
      repairedItem: inventoryItem
    };
  }

  // ===== 도구 사용 =====
  /**
   * 특정 도구를 전투 중 사용
   */
  useTool(toolId, target = null) {
    const tool = this.availableTools[toolId];

    if (!tool) {
      return { success: false, message: '존재하지 않는 도구입니다.' };
    }

    // 슬롯에 있는지 확인
    if (!this.toolkitSlots.includes(toolId)) {
      return {
        success: false,
        message: `${tool.name}이(가) 도구 가방에 없습니다.`
      };
    }

    // 쿨다운 확인
    const cooldown = this.activeTools[toolId]?.remainingCooldown || 0;
    if (cooldown > 0) {
      return {
        success: false,
        message: `쿨타임 중입니다. (${cooldown}턴)`
      };
    }

    // MP 확인
    if (this.player.mp < tool.mpCost) {
      return {
        success: false,
        message: `MP가 부족합니다. (필요: ${tool.mpCost}, 보유: ${this.player.mp})`
      };
    }

    // 도구 사용
    this.player.mp -= tool.mpCost;

    // 쿨다운 설정
    this.activeTools[toolId] = { remainingCooldown: tool.cooldown };

    // 소모품 처리
    if (tool.consumable) {
      // 인벤토리에서 제거 또는 갯수 감소
    }

    return {
      success: true,
      message: `${tool.name}을(를) 사용했습니다!`,
      tool: tool,
      effect: tool.effect
    };
  }

  // ===== 턴 종료 시 처리 =====
  /**
   * 턴이 지날 때마다 쿨다운 카운트다운
   */
  processTurnCooldowns() {
    for (let toolId in this.activeTools) {
      const cooldownInfo = this.activeTools[toolId];
      if (cooldownInfo.remainingCooldown > 0) {
        cooldownInfo.remainingCooldown -= 1;

        if (cooldownInfo.remainingCooldown <= 0) {
          delete this.activeTools[toolId];
        }
      }
    }
  }

  // ===== 드워프 패시브 연계 =====
  /**
   * 황금의 손: 장비 강화/수리 성공률 +20%
   */
  getEquipmentRepairSuccessRate() {
    return 0.9; // 기본 70% + 20% (드워프) = 90%
  }

  /**
   * 황금의 손: 판매가 +15%
   */
  getSellPriceModifier() {
    return 1.15;
  }

  /**
   * 강철 위장: 포션/음식 섭취 시 회복량 +50%
   */
  getConsumableModifier() {
    return 1.5;
  }

  // ===== 도구 및 UI =====
  getAvailableTools() {
    return Object.entries(this.availableTools).map(([id, tool]) => ({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      description: tool.description,
      mpCost: tool.mpCost,
      cooldown: tool.cooldown,
      consumable: tool.consumable || false
    }));
  }

  /**
   * 전체 도구 트리 정보
   */
  getToolkitTreeUI() {
    const categories = {
      enhancement: [],
      explosive: [],
      throwable: [],
      defense: [],
      healing: [],
      utility: []
    };

    for (let toolId in this.availableTools) {
      const tool = this.availableTools[toolId];
      const category = tool.category;

      if (categories[category]) {
        categories[category].push({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          mpCost: tool.mpCost
        });
      }
    }

    return categories;
  }

  // ===== 상태 저장/복원 =====
  toJSON() {
    return {
      toolkitSlots: this.toolkitSlots,
      activeTools: this.activeTools
    };
  }

  fromJSON(data) {
    this.toolkitSlots = data.toolkitSlots || [];
    this.activeTools = data.activeTools || {};
  }
}
