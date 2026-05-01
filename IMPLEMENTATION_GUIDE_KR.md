# 던전앤스톤 업데이트 - 6대 시스템 구현 완료

## 📋 구현 개요

다음 6가지 고급 시스템이 게임에 추가되었습니다:

---

## 1️⃣ **경쟁자 파티 시스템 (Rival AI Explorers)**

### 📍 위치
- **exploration_system.js**: rivalParties 시스템  
- **class_player_core.js**: 플레이어 경쟁자 추적

### 🎮 기능
- ✅ **경쟁자 파티 생성**: 플레이어와 같은 층에 진입하는 다양한 성향의 모험가 파티
- ✅ **상자 약탈**: 경쟁자가 플레이어보다 먼저 상자를 열어 전리품을 가져감
- ✅ **막타 우회(Kill Steal)**: 플레이어가 싸우는 몬스터에게 경쟁자가 막타를 칠 확률
- ✅ **통행료/PK 시도**: 플레이어가 빈사 상태(HP ≤ 20%)일 때 경쟁자의 행동
  - 협력적 → 도움 제공
  - 기회주의적 → 통행료 요구 또는 약탈
  - 약탈적 → 직접 공격 시도

### 💾 데이터 구조
```javascript
rival = {
  id, name, x, y,
  hpRate, lootCount,
  role: "cooperative" | "opportunist" | "predatory",
  helpBias, killStealBias, tollBias, pkBias,
  moveCooldown, pressureCooldown, combatCooldown,
  alive
}
```

---

## 2️⃣ **시세 변동 및 암시장 시스템 (Dynamic Economy)**

### 📍 위치
- **living_world_system.js**: market 및 경제 시뮬레이션
- **ui_city.js**: 상점 및 거래소 UI

### 🎮 기능
- ✅ **시세 변동**: 마석, 정수, 균열석, 마력결정체의 매입가 0.8배 ~ 1.5배 범위 변동
- ✅ **주점 소문**: 내일의 시세 변화를 미리 알려주는 대화 시스템
- ✅ **암시장 동향**: 
  - 시세보다 높은 가격에 판매 가능
  - 위조 화폐를 받을 확률 (거래 손실)
  - 치안대 단속 (벌금 부과)

### 💾 데이터 구조
```javascript
market = {
  dayStamp: "1-1",
  multipliers: {
    magic_stone: 1.0,
    essence: 1.0,
    rift_shard: 1.0,
    mana_core: 1.0
  },
  tomorrowHints: [],
  rumorLog: []
}
```

### 📊 가격 조정 함수
```javascript
player.livingWorld.getAdjustedPrice(basePrice, itemName, mode, itemData)
// mode: "buy" | "sell"
// 자동 계산: 시세 배수 적용
```

---

## 3️⃣ **해체 및 도축 시스템 (Butchery & Harvesting)**

### 📍 위치
- **player_advanced_systems.js**: ButcherySystem 클래스
- **ui_combat.js**: showButcheryScreen 함수
- **index.html**: #butchery-screen modal

### 🎮 기능
- ✅ **해체 성공률 계산**: DEX(민첩성) + butcherySkill 기반
- ✅ **3단계 결과**:
  1. **대성공 (5% 미만)**: 온전한 마석 + 특수 부위 + 고기
  2. **성공**: 마석 + 고기
  3. **실패**: 금 간 마석 (헐값)
  4. **대실패 (5% 미만)**: 마석 파괴 + 도구 손상 + 팔 부상

### 💾 데이터 구조
```javascript
player.butcherySkill: 0-100  // 숙련도
player.injuryState.arm = {
  severity: 1-3,
  remainingTurns: n,
  reason: "해체 중 손을 베임"
}
```

### 📊 사용 방법
```javascript
// 전투 승리 후
const result = player.butcherySystem.attemptButchery(monsterData);
// result: { magicStones, pristineMagicStone, material, meat, skillGain }
```

---

## 4️⃣ **평판 및 파티 매칭 시스템 (Reputation & Party Matching)**

### 📍 위치
- **player_advanced_systems.js**: ReputationSystem 클래스
- **npc_ai_enhanced.js**: ENHANCED_NPC_PROFILES

### 🎮 기능
- ✅ **평판 트래킹**:
  - `coward`: 전투 도망 횟수
  - `busDriver`: 마지막 타격(막타) 횟수
  - `shameless`: 동료 사망 후 루팅 횟수

- ✅ **평판 라벨**:
  - "겁쟁이" (coward ≥ 3): A급 NPC는 거절
  - "버스기사" (busDriver ≥ 5): NPC 모집 보너스 (+30%)
  - "파렴치한" (shameless ≥ 2): 일부 NPC는 거절

- ✅ **파티 모집 영향**:
  - 평판 나쁨 → 사기꾼, 초보자만 모집 가능
  - 평판 좋음 → 고급 NPC 우선 제안, 선입금 증가

### 💾 데이터 구조
```javascript
player.reputationProfile = {
  coward: 0,
  busDriver: 0,
  shameless: 0,
  labels: [] // ["겁쟁이", "파렴치한", ...]
}
```

### 📊 메서드
```javascript
player.reputationSystem.addCowardReputation()
player.reputationSystem.addBusDriverReputation(monsterName)
player.reputationSystem.addShamelessReputation(allyName)
player.reputationSystem.canRecruitHighTierNPC()
```

---

## 5️⃣ **부상 및 외상 시스템 (Injury & Trauma)**

### 📍 위치
- **player_advanced_systems.js**: InjurySystem 클래스
- **class_player_core.js**: injuryState 데이터

### 🎮 기능
- ✅ **부위별 부상 (4가지)**:
  1. **다리 부상**: 이동 속도/회피율 감소
  2. **팔 부상**: 공격력/명중률 감소 (해체 시 성공률 ↓)
  3. **머리 부상**: 스킬 사용 시 일정 확률로 턴 넘김
  4. **몸통 부상**: 최대 HP 감소

- ✅ **심각도**: 1-3단계
  - 심각도 1: 가벼운 영향
  - 심각도 2: 중간 영향
  - 심각도 3: 치명적 영향

- ✅ **치유 및 흉터**:
  - 신전 치료 시 부상 제거
  - 흉터 남음 (흉터 개수 증가)
  - 흉터: 매력(CHA) ↓ 하지만 위압감(Intimidation) ↑

### 💾 데이터 구조
```javascript
player.injuryState = {
  leg: { severity: 1-3, remainingTurns: n },
  arm: { severity: 1-3, remainingTurns: n },
  head: { severity: 1-3, remainingTurns: n },
  torso: { severity: 1-3, remainingTurns: n },
  scarCount: 0 // 치료 후 흉터 개수
}
```

### 📊 메서드
```javascript
player.injurySystem.inflictInjury(bodyPart, severity, reason)
player.injurySystem.treatInjuryAtTemple(bodyPart)
player.injurySystem.getCurrentDebuffs()
player.injurySystem.progressInjuries()  // 턴 진행 시 호출
```

---

## 6️⃣ **향상된 NPC AI (Enhanced NPC Interaction)**

### 📍 위치
- **npc_ai_enhanced.js**: EnhancedNPCInteraction 클래스
- **ui_city.js**: NPC 상호작용

### 🎮 기능
- ✅ **NPC 기억 시스템**:
  - NPC별 affinity (-100 ~ 100)
  - 과거 상호작용 기록
  - 마지막 만남 날짜

- ✅ **동적 대사 생성**:
  - 플레이어의 평판에 따라 달라지는 인사말
  - 부상 상태 인식
  - 경제 정보 제공

- ✅ **소문 시스템**:
  - 중요 이벤트는 마을 전체에 퍼짐
  - 다른 NPC의 태도에 영향
  - 글로벌 루머 밀 (최대 10개)

- ✅ **행동 영향도**:
  - gift: +20 호감도
  - help: +15 호감도
  - business: +5 호감도
  - rude: -30 호감도
  - theft: -50 호감도
  - shameless: -40 호감도

### 💾 데이터 구조
```javascript
player.npcAI.npcMemories = {
  "상점 주인": {
    affinity: 0,
    interactions: [],
    lastMeeting: null,
    traits: {},
    relationship: "처음 만남"
  }
}
```

### 📊 메서드
```javascript
player.npcAI.determineNPCAttitude(npcName) // "우호적", "중립적", "적대적"
player.npcAI.generateNPCGreeting(npcName, trait)
player.npcAI.generateContextualResponse(npcName, context)
player.npcAI.affectNPCAttitude(npcName, action, amount)
player.npcAI.canRecruit(npcName) // 모집 가능 여부
```

---

## 🔧 통합 방법

### 1. 새 파일 추가됨
```
- player_advanced_systems.js     (평판, 부상, 해체)
- npc_ai_enhanced.js             (NPC AI)
```

### 2. 수정된 파일
```
- main.js                        (import + 초기화)
- index.html                     (해체 화면 modal 추가)
- ui_combat.js                   (해체 화면 함수)
```

### 3. 초기화 코드
```javascript
// main.js에서 Player 생성 후:
player.reputationSystem = new ReputationSystem(player);
player.injurySystem = new InjurySystem(player);
player.butcherySystem = new ButcherySystem(player);
player.npcAI = new EnhancedNPCInteraction(player);
```

---

## 📊 시스템 간 상호작용

```
플레이어의 행동
    ↓
평판 변화 (ReputationSystem)
    ↓
NPC 반응 변화 (EnhancedNPCInteraction)
    ↓
파티 모집 가능 여부 변경
    ↓
경제 상황 영향 (LivingWorldSimulator)

전투 결과
    ↓
부상 발생 가능 (InjurySystem)
    ↓
해체 시도 (ButcherySystem)
    ↓
경제학적 이득 변수
```

---

## 🎯 플레이어 경험 향상

### 🎭 몰입감
- NPC들이 플레이어의 행동을 기억하고 평가
- 평판에 따라 달라지는 세상의 반응
- 의사결정의 긴 기간 선택지

### 🎲 전략성
- 해체 성공률 관리 (DEX, butcherySkill 투자)
- 시세 트렌드 예측하여 경제 활동
- 부상 관리와 능력 감소의 균형

### 🌍 살아있는 세계
- 경쟁자 파티의 동적 행동
- 경제 변동 요인
- NPC들의 소문과 평판 전파

---

## 📝 사용 예시

```javascript
// 1. 전투 후 해체
const monster = player.currentMonster[0];
const result = player.butcherySystem.attemptButchery(monster);
// -> 마석, 고기, 재료 획득

// 2. 평판 변화
player.reputationSystem.addCowardReputation();
// -> "겁쟁이" 라벨 추가 (3회 이상)

// 3. NPC 상호작용
const greeting = player.npcAI.generateNPCGreeting("상점 주인");
const canRecruit = player.npcAI.canRecruit("전사 NPC");

// 4. 부상 치료
player.injurySystem.treatInjuryAtTemple("arm");
// -> 부상 제거, 흉터 추가

// 5. 경제 정보
const price = player.livingWorld.getAdjustedPrice(100, "마석", "sell");
const rumor = player.livingWorld.getTavernRumor();
```

---

## ✨ 향후 개선 사항

- [ ] 부상당한 팔로 전투 UI 표현 변경
- [ ] 흉터의 시각적 표현 (캐릭터 모델)
- [ ] NPC 친밀도에 따른 전용 퀘스트
- [ ] 평판 전수/복구 시스템
- [ ] 경제 환장 AI (상인들의 대응)
- [ ] 해체 미니게임 (성공률 증가 기회)

---

**작성일**: 2026년 2월 18일  
**버전**: v6.0 (고급 시스템 통합)
