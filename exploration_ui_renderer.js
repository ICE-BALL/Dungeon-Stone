/**
 * ===== 맵 이벤트 시각화 시스템 =====
 * 던전 맵에 광물, 균열, 아이템, NPC, 경쟁자 등을 시각적 기호로 표시
 * 게임의 exploration UI를 확장하여 사용자가 환경을 더 잘 이해할 수 있게 함
 */

class MapEventRenderer {
  constructor(explorationSystem) {
    this.explorationSystem = explorationSystem;
    this.eventLayer = null;
    this.mapCanvas = null;
    this.showMinerals = true;
    this.showRifts = true;
    this.showItems = true;
    this.showRivals = true;
    this.showNPCs = true;
    this.eventSymbols = this.initializeEventSymbols();
  }

  // ===== 이벤트 기호 정의 =====
  initializeEventSymbols() {
    return {
      mineral_copper: { symbol: '◯', color: '#B87333', class: 'event-mineral-copper' },
      mineral_iron: { symbol: '◆', color: '#6B4423', class: 'event-mineral-iron' },
      mineral_silver: { symbol: '◇', color: '#C0C0C0', class: 'event-mineral-silver' },
      mineral_gold: { symbol: '◈', color: '#FFD700', class: 'event-mineral-gold' },
      mineral_mithril: { symbol: '◉', color: '#5FD3BC', class: 'event-mineral-mithril' },
      mineral_adamantite: { symbol: '●', color: '#1E90FF', class: 'event-mineral-adamantite' },
      mineral_high_tier: { symbol: '✦', color: '#FF6B6B', class: 'event-mineral-high' },
      
      rift_unstable: { symbol: '✘', color: '#FF00FF', class: 'event-rift-unstable' },
      rift_active: { symbol: '⊕', color: '#00FF00', class: 'event-rift-active' },
      rift_dormant: { symbol: '⊗', color: '#808080', class: 'event-rift-dormant' },
      
      item_legendary: { symbol: '★', color: '#FFD700', class: 'event-item-legendary' },
      item_epic: { symbol: '◆', color: '#FF00FF', class: 'event-item-epic' },
      item_rare: { symbol: '◈', color: '#00BFFF', class: 'event-item-rare' },
      item_uncommon: { symbol: '○', color: '#00FF00', class: 'event-item-uncommon' },
      
      rival_party: { symbol: 'P', color: '#FF4500', class: 'event-rival-party' },
      rival_cooperative: { symbol: 'ⓐ', color: '#32CD32', class: 'event-rival-coop' },
      rival_opportunist: { symbol: 'ⓑ', color: '#FFD700', class: 'event-rival-opp' },
      
      npc_merchant: { symbol: '⊙', color: '#FFA500', class: 'event-npc-merchant' },
      npc_questgiver: { symbol: '?', color: '#FFD700', class: 'event-npc-quest' },
      npc_named: { symbol: 'N', color: '#FF69B4', class: 'event-npc-named' },
      
      portal_safe: { symbol: '||', color: '#00FF00', class: 'event-portal-safe' },
      portal_danger: { symbol: '!', color: '#FF0000', class: 'event-portal-danger' },
      
      player_location: { symbol: '@', color: '#FFFF00', class: 'event-player' }
    };
  }

  // ===== 맵 렌더링 초기화 =====
  initializeMapLayer(mapContainerId = 'map-events-layer') {
    const container = document.getElementById(mapContainerId);
    if (!container) {
      console.warn(`Container ${mapContainerId} not found`);
      return false;
    }

    // 기존 레이어 제거
    const existing = container.querySelector('.map-event-overlay');
    if (existing) existing.remove();

    // 새로운 오버레이 레이어 생성
    this.eventLayer = document.createElement('div');
    this.eventLayer.className = 'map-event-overlay';
    this.eventLayer.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      font-family: monospace;
      font-size: 12px;
      line-height: 1.2;
      pointer-events: none;
      z-index: 50;
      overflow: hidden;
    `;

    container.appendChild(this.eventLayer);
    return true;
  }

  // ===== 현재 층의 모든 이벤트 렌더링 =====
  renderMapEvents(currentLayer, playerX, playerY, mapWidth, mapHeight) {
    if (!this.eventLayer) {
      this.initializeMapLayer();
    }

    // 기존 이벤트 제거
    this.eventLayer.innerHTML = '';

    const events = this.gatherMapEvents(currentLayer, playerX, playerY, mapWidth, mapHeight);

    events.forEach(event => {
      const element = this.createEventElement(event);
      if (element) {
        this.eventLayer.appendChild(element);
      }
    });
  }

  // ===== 맵 이벤트 수집 =====
  gatherMapEvents(layer, playerX, playerY, mapWidth, mapHeight) {
    const events = [];

    if (!this.explorationSystem) return events;

    // 1. 플레이어 위치
    if (this.explorationSystem.player) {
      events.push({
        type: 'player',
        x: playerX,
        y: playerY,
        symbol: this.eventSymbols.player_location.symbol,
        color: this.eventSymbols.player_location.color,
        tooltip: '플레이어'
      });
    }

    // 2. 광물 표시 (miningSystem이 있으면)
    if (this.showMinerals && this.explorationSystem.player && this.explorationSystem.player.miningSystem) {
      // 동적으로 광물 위치 생성 (레이어별)
      const mineralCount = this.generateMineralLocations(layer, mapWidth, mapHeight);
      events.push(...mineralCount);
    }

    // 3. 균열 (Rifts) 표시
    if (this.showRifts && this.explorationSystem.fixedEvents) {
      const rifts = this.explorationSystem.fixedEvents.filter(e => e.type === 'rift');
      rifts.forEach(rift => {
        const symbol = this.getEventSymbol('rift', rift.subtype || 'active');
        events.push({
          type: 'rift',
          x: rift.x,
          y: rift.y,
          symbol: symbol.symbol,
          color: symbol.color,
          tooltip: `균열 (${rift.subtype || 'active'})`
        });
      });
    }

    // 4. 고정 아이템 표시
    if (this.showItems && this.explorationSystem.fixedEvents) {
      const items = this.explorationSystem.fixedEvents.filter(e => e.type === 'item');
      items.forEach(item => {
        const rarity = item.rarity || 'uncommon';
        const symbol = this.getEventSymbol('item', rarity);
        events.push({
          type: 'item',
          x: item.x,
          y: item.y,
          symbol: symbol.symbol,
          color: symbol.color,
          tooltip: `${rarity} 아이템`
        });
      });
    }

    // 5. 경쟁 파티 (Rival Parties) 표시
    if (this.showRivals && this.explorationSystem.rivalParties) {
      this.explorationSystem.rivalParties.forEach(rival => {
        const symbol = this.getEventSymbol('rival', rival.role || 'default');
        events.push({
          type: 'rival',
          x: rival.x,
          y: rival.y,
          symbol: symbol.symbol,
          color: symbol.color,
          tooltip: `경쟁자: ${rival.name || '불명'}`
        });
      });
    }

    // 6. NPC 표시
    if (this.showNPCs && this.explorationSystem.spawnedNPCs) {
      this.explorationSystem.spawnedNPCs.forEach(npc => {
        const npcType = npc.isQuestGiver ? 'questgiver' : (npc.role === 'merchant' ? 'merchant' : 'named');
        const symbol = this.getEventSymbol('npc', npcType);
        events.push({
          type: 'npc',
          x: npc.x,
          y: npc.y,
          symbol: symbol.symbol,
          color: symbol.color,
          tooltip: `NPC: ${npc.name || '불명'}`
        });
      });
    }

    // 7. 포탈 표시
    if (this.explorationSystem.portals) {
      this.explorationSystem.portals.forEach(portal => {
        const danger = portal.dangerLevel > 5 ? 'danger' : 'safe';
        const symbol = this.getEventSymbol('portal', danger);
        events.push({
          type: 'portal',
          x: portal.x,
          y: portal.y,
          symbol: symbol.symbol,
          color: symbol.color,
          tooltip: `포탈 (${portal.destination})`
        });
      });
    }

    return events;
  }

  // ===== 광물 위치 동적 생성 =====
  generateMineralLocations(layer, mapWidth, mapHeight, mineralCount = 8) {
    const events = [];
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < mineralCount; i++) {
      const seed = layer * 1000 + i + Date.now() % 1000;
      const x = Math.floor(seededRandom(seed) * mapWidth);
      const y = Math.floor(seededRandom(seed + 1) * mapHeight);

      const mineralType = this.selectMineralForLayer(layer);
      const symbol = this.getEventSymbol('mineral', mineralType);

      events.push({
        type: 'mineral',
        x: x,
        y: y,
        symbol: symbol.symbol,
        color: symbol.color,
        mineralType: mineralType,
        tooltip: `광물: ${mineralType}`
      });
    }

    return events;
  }

  // ===== 층별 광물 유형 선택 =====
  selectMineralForLayer(layer) {
    const mineralTypes = {
      1: ['copper', 'iron'],
      2: ['copper', 'iron', 'silver'],
      3: ['iron', 'silver', 'gold'],
      4: ['silver', 'gold', 'mithril'],
      5: ['gold', 'mithril', 'adamantite'],
      6: ['mithril', 'adamantite'],
      7: ['adamantite', 'high_tier'],
      8: ['high_tier'],
      9: ['high_tier'],
      10: ['high_tier']
    };

    const available = mineralTypes[layer] || ['copper'];
    return available[Math.floor(Math.random() * available.length)];
  }

  // ===== 이벤트 기호 선택 =====
  getEventSymbol(eventType, subtype = 'default') {
    const symbolKey = `${eventType}_${subtype}`;
    return this.eventSymbols[symbolKey] || this.eventSymbols[eventType] || {
      symbol: '?',
      color: '#FFFFFF'
    };
  }

  // ===== 이벤트 요소 생성 =====
  createEventElement(event) {
    const div = document.createElement('div');
    div.className = `map-event map-event-${event.type}`;
    div.style.cssText = `
      position: absolute;
      left: ${event.x * 8}px;
      top: ${event.y * 8}px;
      color: ${event.color};
      font-weight: bold;
      text-shadow: 1px 1px 2px #000000;
      cursor: pointer;
      user-select: none;
    `;

    div.textContent = event.symbol;
    div.title = event.tooltip || '';

    // 호버 효과
    div.addEventListener('mouseenter', () => {
      div.style.textShadow = `0 0 8px ${event.color}`;
      div.style.fontSize = '14px';
    });

    div.addEventListener('mouseleave', () => {
      div.style.textShadow = '1px 1px 2px #000000';
      div.style.fontSize = '12px';
    });

    return div;
  }

  // ===== 토글 메서드 =====
  toggleMinerals() {
    this.showMinerals = !this.showMinerals;
  }

  toggleRifts() {
    this.showRifts = !this.showRifts;
  }

  toggleItems() {
    this.showItems = !this.showItems;
  }

  toggleRivals() {
    this.showRivals = !this.showRivals;
  }

  toggleNPCs() {
    this.showNPCs = !this.showNPCs;
  }

  // ===== 범례 표시 =====
  renderLegend(parentElementId = 'map-legend') {
    const parent = document.getElementById(parentElementId);
    if (!parent) return;

    let legendHTML = '<div class="map-legend-container" style="background: #222; color: #FFF; padding: 10px; border-radius: 5px; font-size: 11px;">';
    legendHTML += '<h4 style="margin: 0 0 8px 0; border-bottom: 1px solid #666; padding-bottom: 4px;">맵 범례</h4>';

    const categories = {
      '물질': ['mineral_copper', 'mineral_gold', 'mineral_high_tier'],
      '이벤트': ['rift_active', 'item_rare', 'portal_safe'],
      '개체': ['player_location', 'rival_party', 'npc_merchant', 'portal_danger']
    };

    for (let category in categories) {
      legendHTML += `<div style="margin: 4px 0;"><strong>${category}:</strong>`;
      categories[category].forEach(symbolKey => {
        const symbol = this.eventSymbols[symbolKey];
        if (symbol) {
          legendHTML += `<span style="display: inline-block; margin: 0 4px; color: ${symbol.color}; font-weight: bold;">${symbol.symbol}</span>`;
        }
      });
      legendHTML += '</div>';
    }

    legendHTML += '</div>';
    parent.innerHTML = legendHTML;
  }

  // ===== 맵 정보 패널 =====
  showMapInfo(currentLayer) {
    return {
      layer: currentLayer,
      visibleEvents: {
        minerals: this.showMinerals,
        rifts: this.showRifts,
        items: this.showItems,
        rivals: this.showRivals,
        npcs: this.showNPCs
      },
      legend: this.generateLegendText()
    };
  }

  // ===== 범례 텍스트 생성 =====
  generateLegendText() {
    return `
=== 맵 범례 ===
광물: ◯(구리) ◆(철) ◇(은) ◈(금) ◉(미스릴) ●(아다만타이트) ✦(최상급)
균열: ✘(불안정) ⊕(활성) ⊗(휴면)
아이템: ★(전설) ◆(에픽) ◈(희귀) ○(일반)
NPC: ⊙(상인) ?(의뢰자) N(명명된)
기타: @ (플레이어) P/ⓐ/ⓑ(경쟁자) ||(포탈)
    `.trim();
  }
}

export { MapEventRenderer };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MapEventRenderer };
}
