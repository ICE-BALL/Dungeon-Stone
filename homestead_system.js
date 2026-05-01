/**
 * ===== 홈스테드 시스템 =====
 * 플레이어의 정착지 관리: 건물, 농사, 채용 NPC, 생산 시설 등
 * 지속적인 수익과 장기 게임 플레이를 위한 핵심 시스템
 */

class HomesteadSystem {
  constructor(player) {
    this.player = player;
    this.level = 1; // 정착지 레벨
    this.prosperity = 50; // 번영도 (0-100)
    this.storage = {}; // 저장소 (자원 저장)
    this.buildings = {}; // 건물 목록
    this.workers = {}; // 고용 NPC
    this.crops = {}; // 재배 중인 작물
    this.productionQueues = []; // 생산 대기열
    this.dailyIncome = 0; // 일일 수입
    this.reputation = 0; // 정착지 평판
    this.unlcokedBuildings = this.getAvailableBuildings(1); // 잠금 해제된 건물
    
    this.initializeStorage();
  }

  // ===== 저장소 초기화 =====
  initializeStorage() {
    const resources = [
      'stone', 'wood', 'iron_ore', 'copper_ore', 'grain',
      'vegetables', 'herbs', 'alchemy_ingredients', 'crafting_materials'
    ];
    
    resources.forEach(resource => {
      this.storage[resource] = 0;
    });
  }

  // ===== 건물 데이터베이스 =====
  getBuildingTemplates() {
    return {
      'farm': {
        id: 'farm',
        name: '농장',
        name_en: 'Farm',
        level: 1,
        tier: 'basic',
        cost: { stone: 100, wood: 200 },
        constructionTime: 3600000, // 1시간
        production: { grain: 10, vegetables: 5 },
        productionInterval: 3600000, // 1시간마다 생산
        efficiency: 1.0,
        description: '곡물과 채소를 생산한다.',
        maxLevel: 3
      },
      
      'herb_garden': {
        id: 'herb_garden',
        name: '약초 정원',
        name_en: 'Herb Garden',
        level: 2,
        tier: 'standard',
        cost: { stone: 200, wood: 150 },
        constructionTime: 5400000, // 1.5시간
        production: { herbs: 15 },
        productionInterval: 3600000,
        efficiency: 1.2,
        description: '약초를 생산한다.',
        maxLevel: 2
      },
      
      'workshop': {
        id: 'workshop',
        name: '공방',
        name_en: 'Workshop',
        level: 1,
        tier: 'standard',
        cost: { stone: 300, wood: 100 },
        constructionTime: 7200000, // 2시간
        production: { crafting_materials: 8 },
        productionInterval: 3600000,
        efficiency: 1.0,
        requiresWorker: 'artisan',
        description: '기본 도구와 재료를 제작한다.',
        maxLevel: 3
      },
      
      'alchemy_lab': {
        id: 'alchemy_lab',
        name: '연금술 실험실',
        name_en: 'Alchemy Lab',
        level: 3,
        tier: 'premium',
        cost: { stone: 500, iron_ore: 100 },
        constructionTime: 10800000, // 3시간
        production: { alchemy_ingredients: 12 },
        productionInterval: 5400000,
        efficiency: 1.5,
        requiresWorker: 'alchemist',
        description: '연금술 재료를 제조한다.',
        maxLevel: 2
      },
      
      'storage': {
        id: 'storage',
        name: '창고',
        name_en: 'Storage',
        level: 1,
        tier: 'basic',
        cost: { stone: 150, wood: 150 },
        constructionTime: 1800000, // 30분
        storageBonus: 1000, // 저장 용량 증가
        description: '자원 저장 용량을 증가시킨다.',
        maxLevel: 5
      },
      
      'tavern': {
        id: 'tavern',
        name: '주점',
        name_en: 'Tavern',
        level: 2,
        tier: 'social',
        cost: { stone: 250, wood: 300 },
        constructionTime: 5400000,
        incomeMultiplier: 1.2, // 수입 증가
        workerCapacity: 2,
        description: 'NPC 채용을 용이하게 하고 수입을 증가시킨다.',
        maxLevel: 1
      },
      
      'watchtower': {
        id: 'watchtower',
        name: '망루',
        name_en: 'Watchtower',
        level: 2,
        tier: 'defense',
        cost: { stone: 400, iron_ore: 50 },
        constructionTime: 7200000,
        defense: 10, // 방어력 증가
        description: '정착지 방어력을 강화한다.',
        maxLevel: 2
      },
      
      'market': {
        id: 'market',
        name: '시장',
        name_en: 'Market',
        level: 3,
        tier: 'commerce',
        cost: { stone: 600, wood: 200 },
        constructionTime: 10800000,
        tradeBonus: 1.3, // 거래 이익 증가
        description: '거래 이익을 증가시킨다.',
        maxLevel: 1
      }
    };
  }

  // ===== 건물 건설 =====
  constructBuilding(buildingId) {
    const templates = this.getBuildingTemplates();
    const template = templates[buildingId];

    if (!template) {
      return { success: false, message: '존재하지 않는 건물입니다.' };
    }

    // 비용 확인
    for (let resource in template.cost) {
      if ((this.storage[resource] || 0) < template.cost[resource]) {
        return {
          success: false,
          message: `자원 부족: ${resource} (필요: ${template.cost[resource]}, 보유: ${this.storage[resource] || 0})`
        };
      }
    }

    // 비용 차감
    for (let resource in template.cost) {
      this.storage[resource] -= template.cost[resource];
    }

    // 건물 추가
    if (!this.buildings[buildingId]) {
      this.buildings[buildingId] = [];
    }

    this.buildings[buildingId].push({
      id: `${buildingId}_${this.buildings[buildingId].length + 1}`,
      level: 1,
      efficiency: template.efficiency || 1.0,
      completionTime: Date.now() + template.constructionTime,
      completed: false,
      ...template
    });

    return {
      success: true,
      message: `${template.name} 건설이 시작되었습니다.`,
      constructionTime: template.constructionTime / 1000,
      seconds: template.constructionTime / 1000
    };
  }

  // ===== NPC 채용 =====
  hireWorker(npcId, workerType) {
    // 채용 가능 용량 확인
    const tavern = this.buildings['tavern'] ? this.buildings['tavern'][0] : null;
    const maxWorkers = tavern ? 3 + (tavern.level * 2) : 2;

    const currentWorkerCount = Object.keys(this.workers).length;
    if (currentWorkerCount >= maxWorkers) {
      return {
        success: false,
        message: `채용 용량이 초과했습니다. (현재: ${currentWorkerCount}/${maxWorkers})`
      };
    }

    // 임금 확인
    const wages = {
      'farmer': 100,
      'artisan': 150,
      'alchemist': 250,
      'merchant': 200,
      'guard': 120
    };

    const wage = wages[workerType] || 150;
    if (this.player.assets.stone < wage) {
      return {
        success: false,
        message: `임금이 부족합니다. (필요: ${wage}, 보유: ${this.player.assets.stone})`
      };
    }

    // NPC 고용
    this.workers[npcId] = {
      npcId: npcId,
      type: workerType,
      hirDate: Date.now(),
      wage: wage,
      productivity: 1.0,
      morale: 50,
      loyalty: 0
    };

    this.player.assets.stone -= wage;

    return {
      success: true,
      message: `${workerType} 유형의 NPC를 채용했습니다.`,
      wage: wage
    };
  }

  // ===== 작물 재배 =====
  plantCrop(cropType, quantity = 1) {
    const cropData = {
      grain: { growTime: 7200000, yield: 3, cost: 10 }, // 2시간 재배
      vegetables: { growTime: 5400000, yield: 2, cost: 15 },
      herbs: { growTime: 10800000, yield: 4, cost: 20 }
    };

    if (!cropData[cropType]) {
      return { success: false, message: '존재하지 않는 작물입니다.' };
    }

    const crop = cropData[cropType];
    const totalCost = crop.cost * quantity;

    // 비용 확인 (이미 생성된 종자 비용)
    if (!this.crops[cropType]) {
      this.crops[cropType] = [];
    }

    // 재배 시작
    for (let i = 0; i < quantity; i++) {
      this.crops[cropType].push({
        planted: Date.now(),
        readyTime: Date.now() + crop.growTime,
        yield: crop.yield,
        harvested: false
      });
    }

    return {
      success: true,
      message: `${quantity}개의 ${cropType}을 재배했습니다.`,
      harvestTime: crop.growTime / 1000
    };
  }

  // ===== 작물 수확 =====
  harvestCrop(cropType) {
    if (!this.crops[cropType] || this.crops[cropType].length === 0) {
      return { success: false, message: '수확할 작물이 없습니다.' };
    }

    let harvested = 0;
    this.crops[cropType] = this.crops[cropType].filter(crop => {
      if (!crop.harvested && crop.readyTime <= Date.now()) {
        this.storage[cropType] = (this.storage[cropType] || 0) + crop.yield;
        harvested++;
        return false;
      }
      return true;
    });

    return {
      success: true,
      message: `${harvested}개의 ${cropType}을 수확했습니다.`,
      yield: harvested * (this.crops[cropType][0]?.yield || 1)
    };
  }

  // ===== 일일 생산 사이클 =====
  processDailyProduction() {
    let totalIncome = 0;
    const production = {};

    // 건물별 생산
    for (let buildingType in this.buildings) {
      const buildings = this.buildings[buildingType];
      buildings.forEach(building => {
        if (building.completed) {
          const output = building.production || {};
          
          // NPC 효율 보너스
          let efficiency = building.efficiency || 1.0;
          if (building.requiresWorker) {
            for (let workerId in this.workers) {
              if (this.workers[workerId].type === building.requiresWorker) {
                efficiency *= (this.workers[workerId].productivity || 1.0);
              }
            }
          }

          for (let resource in output) {
            const amount = Math.floor(output[resource] * efficiency);
            production[resource] = (production[resource] || 0) + amount;
            this.storage[resource] = (this.storage[resource] || 0) + amount;
          }
        }
      });
    }

    // NPC 임금 지급
    for (let workerId in this.workers) {
      const worker = this.workers[workerId];
      const wage = worker.wage;
      if (this.player.assets.stone >= wage) {
        this.player.assets.stone -= wage;
      } else {
        // 임금 미지급 → 사기 감소
        worker.morale -= 10;
      }
    }

    // 번영도 업데이트
    const workerCount = Object.keys(this.workers).length;
    const buildingCount = Object.keys(this.buildings).length;
    this.prosperity = Math.min(100, this.prosperity + (workerCount + buildingCount) * 0.5);

    return {
      production: production,
      totalIncome: totalIncome,
      prosperity: this.prosperity
    };
  }

  // ===== 건물 업그레이드 =====
  upgradeBuilding(buildingId, buildingIndex = 0) {
    if (!this.buildings[buildingId] || !this.buildings[buildingId][buildingIndex]) {
      return { success: false, message: '건물을 찾을 수 없습니다.' };
    }

    const building = this.buildings[buildingId][buildingIndex];
    const maxLevel = building.maxLevel || 1;

    if (building.level >= maxLevel) {
      return { success: false, message: '이미 최대 레벨입니다.' };
    }

    // 업그레이드 비용 (레벨에 따라 증가)
    const upgradeCost = {
      stone: 200 * building.level,
      wood: 100 * building.level
    };

    for (let resource in upgradeCost) {
      if ((this.storage[resource] || 0) < upgradeCost[resource]) {
        return {
          success: false,
          message: `자원 부족: ${resource}`
        };
      }
    }

    for (let resource in upgradeCost) {
      this.storage[resource] -= upgradeCost[resource];
    }

    building.level++;
    building.efficiency = (building.efficiency || 1.0) + 0.1;

    return {
      success: true,
      message: `${buildingId}을(를) 레벨 ${building.level}로 업그레이드했습니다.`,
      newLevel: building.level,
      newEfficiency: building.efficiency
    };
  }

  // ===== 정착지 정보 조회 =====
  getHomesteadStatus() {
    const buildingCount = Object.entries(this.buildings)
      .reduce((sum, [_, buildings]) => sum + buildings.length, 0);
    
    const workerCount = Object.keys(this.workers).length;

    return {
      level: this.level,
      prosperity: this.prosperity,
      reputation: this.reputation,
      buildings: buildingCount,
      workers: workerCount,
      storage: this.storage,
      income: this.dailyIncome
    };
  }

  // ===== 사용 가능한 건물 조회 (레벨별) =====
  getAvailableBuildings(homesteadLevel) {
    const templates = this.getBuildingTemplates();
    const available = {};

    for (let buildingId in templates) {
      const template = templates[buildingId];
      if (template.level <= homesteadLevel) {
        available[buildingId] = template;
      }
    }

    return available;
  }

  // ===== 정착지 레벨 상승 =====
  upgradeHomestead() {
    const nextLevelCost = {
      stone: 500 * this.level,
      wood: 300 * this.level,
      iron_ore: 50 * this.level
    };

    for (let resource in nextLevelCost) {
      if ((this.storage[resource] || 0) < nextLevelCost[resource]) {
        return {
          success: false,
          message: `자원 부족: ${resource}`
        };
      }
    }

    for (let resource in nextLevelCost) {
      this.storage[resource] -= nextLevelCost[resource];
    }

    this.level++;
    this.unlcokedBuildings = this.getAvailableBuildings(this.level);

    return {
      success: true,
      message: `정착지가 레벨 ${this.level}로 상승했습니다!`,
      newLevel: this.level,
      newBuildings: Object.keys(this.unlcokedBuildings)
    };
  }

  // ===== 저장소 용량 조회 =====
  getStorageCapacity() {
    let baseCapacity = 1000;
    
    if (this.buildings['storage']) {
      this.buildings['storage'].forEach(storage => {
        if (storage.completed) {
          baseCapacity += storage.storageBonus * storage.level;
        }
      });
    }

    const totalStored = Object.values(this.storage).reduce((a, b) => a + b, 0);

    return {
      capacity: baseCapacity,
      used: totalStored,
      available: baseCapacity - totalStored,
      percentage: (totalStored / baseCapacity) * 100
    };
  }

  // ===== 자원 판매 =====
  sellResource(resourceType, quantity) {
    if (!this.storage[resourceType] || this.storage[resourceType] < quantity) {
      return {
        success: false,
        message: `${resourceType}이 부족합니다.`
      };
    }

    // 자원별 기본 가격
    const resourcePrices = {
      grain: 50,
      vegetables: 60,
      herbs: 100,
      crafting_materials: 150,
      alchemy_ingredients: 200
    };

    const unitPrice = resourcePrices[resourceType] || 75;
    const totalPrice = unitPrice * quantity;

    this.storage[resourceType] -= quantity;
    this.player.assets.stone += totalPrice;

    return {
      success: true,
      message: `${resourceType} ${quantity}개를 ${totalPrice} 스톤에 판매했습니다.`,
      earnings: totalPrice
    };
  }
}

export { HomesteadSystem };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HomesteadSystem };
}
