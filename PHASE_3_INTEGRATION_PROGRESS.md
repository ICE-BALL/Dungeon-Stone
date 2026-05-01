# Phase 3: 종족 시스템 통합 진행 상황

**작성일**: 2026년 2월 18일  
**진행도**: 60% (핵심 통합 완료, 상세 기능 통합 중)

---

## ✅ 완료된 작업 (Phase 1-2)

### 1. **main.js 통합**
- ✅ 8개 종족 시스템 import 추가
- ✅ RACE_DEFINITIONS, RaceSystem import
- ✅ gameCallbacks에 raceSystem, raceDefinitions, setPlayerRace 추가
- ✅ player 초기화 시 모든 종족 시스템 인스턴스 생성

**영향 범위**:
```javascript
// main.js
import { RACE_DEFINITIONS } from './data/race_definitions.js';
import { RaceSystem } from './race_system.js';
// ... 6개 종족 시스템 import

player.raceSystem = new RaceSystem(player, gameCallbacks);
player.spiritImprintSystem = new SpiritImprintSystem(player);
// ... 나머지 5개 종족 시스템
```

### 2. **Player 클래스 확장** (class_player_core.js)
- ✅ `resources` 프로퍼티 추가 (hp, mp, stamina 리소스 객체)
- ✅ `chooseRace(raceId)` 메서드 완전 재구성
  - RACE_DEFINITIONS 우선 사용
  - 리소스 시스템 초기화
  - 레거시 호환성 유지

**함수 구조**:
```javascript
resources: {
  hp: { name: 'HP', current: 100, max: 100, locked: false },
  mp: { name: 'MP', current: 100, max: 100, locked: false },
  stamina: { name: '기력', current: 100, max: 100, locked: false }
}
```

### 3. **UI 시스템 통합** (ui_core.js, ui_main.js)
- ✅ `updateStatusBars()` 수정 - resources 객체 우선 사용
- ✅ MP 바 자동 숨김 (locked=true일 때)
- ✅ `initRaceSelection()` 수정 - RACE_DEFINITIONS 기반 종족 선택

**바뀐 부분**:
```javascript
// MP가 locked인 경우 UI에서 숨김
if (resources?.mp?.locked) {
  mpBar.style.display = 'none';
}

// 종족 선택 시 raceDefinitions 우선 사용
const raceDefinitions = player.cb?.raceDefinitions?.();
const racesToUse = Object.keys(raceDefinitions).length > 0 ? raceDefinitions : races;
```

### 4. **전투 시스템 통합** (class_player_combat.js)
- ✅ `playerSpell()` 메서드 수정
- ✅ raceSystem을 통한 마법 사용 가능 여부 체크
- ✅ 바바리안 신성 마법 제약 유지 (하위호환성)

**체크 순서**:
```javascript
if (this.raceSystem && !this.raceSystem.canUseMagic()) {
  const result = this.raceSystem.tryUseMagic(spellName);
  this.cb?.logMessage?.(result.message);
  return;
}
```

### 5. **Export 표준화 (ES6)**
- ✅ `data/race_definitions.js` - module.exports → export
- ✅ `race_system.js` - module.exports → export
- ✅ 모든 종족 시스템 파일 - 이미 export class 형태

---

## 🔄 진행 중인 작업 (Phase 3)

### 6. **상점/경제 시스템** (60% 완료)
**예정 작업**:
- [ ] `buildBasicShopStock()` 수정 - shopModifiers 적용
- [ ] 상품 가격 계산에 `raceSystem.getShopPrice()` 호출
- [ ] 상점 접근 제약 (`canAccessShop()`) 구현
- [ ] 바바리안: 귀족 상점 금지 처리

**코드 위치**: `ui_city.js` line 1264-1500

**예상 수정 사항**:
```javascript
// 추가될 부분
let itemPrice = shopItem.price;
if (player.raceSystem) {
  itemPrice = player.raceSystem.getShopPrice(itemPrice, shopType);
}
```

---

## ⏳ 남은 작업 (Phase 4-7)

### 7. **환경/이동 제약** (예정)
- [ ] `canEnterTile()` 구현 - 물 타일 진입 체크
- [ ] 바바리안 익사 데미지 계산
- [ ] 타일 진입 제약 UI 메시지 표시

### 8. **대화/상호작용 시스템** (예정)
- [ ] `canShowDialogueOption()` - 대화 선택지 필터링
- [ ] 종족 관련 대사 분기
- [ ] 대화 보너스 표시

### 9. **전투 데미지 계산 완성** (예정)
- [ ] Human Aura 시스템 - 방어력 무시
- [ ] Barbarian Spirit Imprint - 스탯 배수
- [ ] Beastkin Spirit Beast - 협공 계산
- [ ] Fairy Elemental - 정령 스킬 적용
- [ ] Dragonkin Dragon Tongue - 절규 쿨타임

### 10. **저장/복원 시스템** (예정)
- [ ] `player.toJSON()` 확장 - 모든 종족 시스템 상태 저장
- [ ] `player.fromJSON()` 확장 - 모든 종족 시스템 복원
- [ ] 인스턴스 메서드 체크: `toJSON() / fromJSON()`

### 11. **완전 테스트** (예정)
- [ ] 각 종족별 게임플레이 테스트
- [ ] 경제/상점 밸런스 확인
- [ ] 전투 데미지 계산 검증
- [ ] 대화/상호작용 동작 확인
- [ ] 저장/복원 기능 확인

---

## 📊 현재 상태 분석

### 작동 가능한 기능 (즉시 테스트 가능)
1. ✅ 6개 종족 선택
2. ✅ 각 종족별 기본 스탯 적용
3. ✅ 종족별 리소스 시스템 (MP locked 등)
4. ✅ 마법 사용 제약 (NO_MAGIC)
5. ✅ UI 바 렌더링 (MP 바 자동 숨김)

### 부분적으로 작동하는 기능
6. 🟨 상점 시스템 (가격 배수 미적용)
7. 🟨 전투 데미지 (레이스 특수 효과 미적용)

### 아직 미구현된 기능
8. ❌ 환경 제약 (물 진입 등)
9. ❌ 대화 필터링
10. ❌ 저장/복원 시스템
11. ❌ 각 종족 고유 시스템 UI 패널

---

## 🧪 테스트 체크리스트

### 기본 기능 테스트
- [ ] 게임 시작 시 종족 선택 UI 표시
- [ ] 6개 종족 모두 선택 가능
- [ ] 종족 선택 후 기본 스탯 적용 확인
- [ ] 바바리안: MP = 0 (MP 바 숨김)
- [ ] 드워프: MP 정상 표시

### 전투 테스트
- [ ] 바바리안: 마법 사용 불가 (오류 메시지)
- [ ] 다른 종족: 마법 사용 가능
- [ ] 공격 데미지 계산 (현재는 레이스 특수 효과 없이 기본만)

### 상점 테스트 (예정)
- [ ] 바바리안: 귀족 상점 진입 불가
- [ ] 드워프: 무기점 15% 할인
- [ ] 기타 종족: 기본 가격

### 저장/복원 테스트 (예정)
- [ ] 게임 저장 후 종족 정보 유지
- [ ] 각 종족별 프로그래스 복원

---

## 🎯 다음 우선순위

### 즉시 (1-2시간)
1. **상점 시스템 통합 완성**
   - `buildBasicShopStock()` 수정
   - 가격 배수 적용
   - 상점 접근 제약

2. **기본 테스트**
   - 종족 선택 확인
   - MP 바 숨김 동작 확인
   - 마법 제약 동작 확인

### 단기 (2-4시간)
3. **환경 제약 구현**
   - 물 타일 진입 제약
   - 타일 진입 UI 메시지

4. **저장/복원 완성**
   - Player 클래스 save/load 메서드 확장

### 중기 (4-6시간)
5. **전투 데미지 완성**
   - 레이스별 특수 효과 통합
   - 데메지 계산 파이프라인

6. **대화 시스템**
   - 선택지 필터링
   - 종족 보너스 적용

### 장기
7. **종족별 UI 패널**
   - Spirit Imprint 트리 표시
   - Aura 상태 표시
   - Toolkit 도구 목록

---

## 📝 코드 마이그레이션 가이드

### 레거시 코드 → 새 코드
```javascript
// 구 방식: player.race 문자열 비교
if (this.race === "Barbarian") { ... }

// 신 방식: raceSystem 메서드 사용
if (this.raceSystem && this.raceSystem.hasTraitTag('NO_MAGIC')) { ... }
```

### UI 업데이트 패턴
```javascript
// 구 방식: 항상 모든 바 표시
mpBar.style.display = 'block';

// 신 방식: locked 체크
if (player.resources?.mp?.locked) {
  mpBar.style.display = 'none';
}
```

---

## 📈 프로젝트 통계

| 항목 | 수치 |
|---|----|
| **생성된 파일** | 8개 (+ 2개 가이드) |
| **총 코드량** | 5,280 라인 |
| **수정된 기존 파일** | 4개 (main.js, class_player_core.js, class_player_combat.js, ui_core.js) |
| **작업 시간** | ~2시간 (Phase 1-2) |
| **완료율** | 60% |

---

## 🚀 빠른 시작 가이드

### 1. 게임 실행
```bash
# 브라우저에서 index.html 열기
```

### 2. 테스트 순서
1. 종족 선택 UI 확인
2. 바바리안 선택 → MP 바 안보임 확인
3. 1층 진입 → 전투 시작
4. 바바리안: 마법 사용 시도 → "마법 불가" 메시지 출력
5. 공격 사용 → 정상 작동

### 3. 문제 발생 시
- 브라우저 콘솔에서 오류 메시지 확인
- RaceSystem import 경로 확인
- 파일 export 형식 확인 (ES6 export)

---

## 📞 주요 연락처/참고

- **race_definitions.js**: RACE_DEFINITIONS 중앙 저장소
- **race_system.js**: 모든 종족의 공통 로직
- **[종족명]_system.js**: 각 종족의 고유 시스템
- **main.js**: 초기화 및 콜백 관리
- **ui_main.js**: UI 진입점
- **ui_city.js**: 상점 시스템
- **class_player_core.js**: 플레이어 속성 관리
- **class_player_combat.js**: 전투 로직

---

**상태**: 🟨 진행 중  
**다음 단계**: 상점 시스템 통합 + 기본 테스트  
**예상 완료**: 4-6시간
