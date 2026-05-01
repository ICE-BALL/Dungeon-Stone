/**
 * ===== 용인족 용언 시스템 (Dragon Tongue System) =====
 * 마나를 쓰지 않고 쿨타임만 존재하는 강력한 절규
 * 레벨 10, 20, 30 달성 시 자동 해금
 */

export class DragonTongueSystem {
  constructor(player) {
    this.player = player;
    this.unlockedTongues = [];
    this.activeTongues = {};
    this.tongueDefinitions = this.initializeTongues();
  }

  // ===== 용언 정의 =====
  initializeTongues() {
    return {
      // 레벨 10 해금: Dov (공포)
      dov_fear: {
        id: 'dov_fear',
        name: '[Dov] 공포의 절규',
        translation: 'Dov = Fear',
        unlockLevel: 10,
        cooldown: 6,
        mpCost: 0,              // MP 소모 없음
        description:
          '화면 내 모든 적에게 공포를 부여합니다. 해당 적들은 3턴간 도망칩니다.',
        effect: {
          type: 'crowd_control',
          target: 'all_enemies_in_view',
          affliction: 'fear',
          duration: 3,
          behavior: 'flee'
        },
        powerLevel: 'moderate',
        animationName: 'dragon_roar_fear'
      },

      // 레벨 20 해금: Yol (화염)
      yol_fire: {
        id: 'yol_fire',
        name: '[Yol] 화염의 절규',
        translation: 'Yol = Fire',
        unlockLevel: 20,
        cooldown: 5,
        mpCost: 0,
        description: '전방 3x3 범위에 방어 무시 화염 브레스를 뿜어냅니다.',
        effect: {
          type: 'area_attack',
          target: 'cone_3x3_front',
          damage: 120,
          element: 'fire',
          defenseBypass: true,
          bypassPercentage: 1.0,  // 100% 무시
          burnDuration: 3,
          burnDamagePerTurn: 10
        },
        powerLevel: 'high',
        animationName: 'dragon_breath_fire'
      },

      // 레벨 30 해금: Fus (거절/밀어내기)
      fus_force: {
        id: 'fus_force',
        name: '[Fus] 거절의 절규',
        translation: 'Fus = Force/Reject',
        unlockLevel: 30,
        cooldown: 4,
        mpCost: 0,
        description:
          '인접한 모든 적을 3칸 뒤로 밀쳐내고 기절시킵니다 (1턴).',
        effect: {
          type: 'knockback_cc',
          target: 'adjacent_all',
          pushDistance: 3,
          affliction: 'stun',
          stunDuration: 1,
          damageOnKnockback: 50
        },
        powerLevel: 'high',
        animationName: 'dragon_roar_force'
      }
    };
  }

  // ===== 용언 자동 해금 =====
  /**
   * 플레이어 레벨 업 시 자동 해금 체크
   */
  checkLevelUpUnlock(newLevel) {
    const unlockedTongues = [];

    for (let tongueId in this.tongueDefinitions) {
      const tongue = this.tongueDefinitions[tongueId];

      // 이미 해금했는지 확인
      if (this.unlockedTongues.includes(tongueId)) {
        continue;
      }

      // 레벨 도달했는지 확인
      if (newLevel >= tongue.unlockLevel) {
        this.unlockedTongues.push(tongueId);
        unlockedTongues.push(tongue);
      }
    }

    return unlockedTongues;
  }

  // ===== 용언 해금 확인 =====
  isTongueUnlocked(tongueId) {
    return this.unlockedTongues.includes(tongueId);
  }

  /**
   * 현재 해금된 용언 목록
   */
  getUnlockedTongues() {
    return this.unlockedTongues.map(tongueId => this.tongueDefinitions[tongueId]);
  }

  // ===== 용언 사용 =====
  /**
   * 용언 사용 요청
   */
  useTongue(tongueId) {
    if (!this.isTongueUnlocked(tongueId)) {
      return { success: false, message: '아직 해금되지 않은 용언입니다.' };
    }

    const tongue = this.tongueDefinitions[tongueId];

    // 쿨다운 확인
    const currentCooldown = this.activeTongues[tongueId] || 0;
    if (currentCooldown > 0) {
      return {
        success: false,
        message: `쿨타임 중입니다. (${currentCooldown}턴)`
      };
    }

    // 용언 발동!
    this.activeTongues[tongueId] = tongue.cooldown;

    return {
      success: true,
      message: `${tongue.name} 발동!`,
      tongue: tongue,
      effect: tongue.effect
    };
  }

  // ===== 쿨다운 관리 =====
  /**
   * 턴 종료 시 쿨다운 감소
   */
  processTurnCooldowns() {
    for (let tongueId in this.activeTongues) {
      this.activeTongues[tongueId] -= 1;

      if (this.activeTongues[tongueId] <= 0) {
        delete this.activeTongues[tongueId];
      }
    }
  }

  /**
   * 특정 용언의 쿨다운 조회
   */
  getTongueCooldown(tongueId) {
    return this.activeTongues[tongueId] || 0;
  }

  // ===== 용언 효과 적용 =====

  /**
   * Dov (공포): 모든 적에게 공포 부여 -> 3턴간 도망
   */
  applyFearEffect(enemies) {
    const affectedEnemies = [];

    for (let enemy of enemies) {
      enemy.afflictions = enemy.afflictions || [];
      enemy.afflictions.push({
        type: 'fear',
        duration: 3,
        behavior: 'flee'
      });

      affectedEnemies.push({
        enemyId: enemy.id,
        enemyName: enemy.name,
        effect: 'fear'
      });
    }

    return affectedEnemies;
  }

  /**
   * Yol (화염): 전방 3x3 화염 브레스
   */
  applyFlameBurst(targetArea) {
    // targetArea = {x, y} 플레이어 앞 3x3 영역
    const damage = 120;
    const burnDuration = 3;

    const affectedTargets = targetArea.enemies || [];

    return {
      damage: damage,
      element: 'fire',
      defenseBypass: true,
      affectedCount: affectedTargets.length,
      burnDuration: burnDuration,
      animation: 'fire_cone_3x3'
    };
  }

  /**
   * Fus (거절): 인접한 적을 3칸 뒤로 밀어냄 + 기절
   */
  applyKnockbackForce(adjacentEnemies) {
    const affectedEnemies = [];

    for (let enemy of adjacentEnemies) {
      // 거리 계산 후 반대 방향으로 3칸 이동
      const knockbackX = enemy.x - this.player.x;
      const knockbackY = enemy.y - this.player.y;

      // 새 위치 계산
      const newX = enemy.x + knockbackX * 3;
      const newY = enemy.y + knockbackY * 3;

      // 기절 부여
      enemy.afflictions = enemy.afflictions || [];
      enemy.afflictions.push({
        type: 'stun',
        duration: 1
      });

      affectedEnemies.push({
        enemyId: enemy.id,
        enemyName: enemy.name,
        knockbackFrom: { x: enemy.x, y: enemy.y },
        knockbackTo: { x: newX, y: newY },
        damage: 50,
        effect: 'knockback_stun'
      });
    }

    return affectedEnemies;
  }

  // ===== 용인족 패시브 연계 =====

  /**
   * 고대 혈통: 초기 스탯 1.5배
   */
  getAncientBloodlineMultiplier() {
    return 1.5;
  }

  /**
   * 오만: 경험치 획득량 200% 필요
   */
  getExperienceRequirementMultiplier() {
    return 2.0;
  }

  /**
   * 드래곤 위압 면역: 드래곤 공포 효과 무시
   */
  isDragonFearImmune() {
    return true;
  }

  /**
   * 느린 성장으로 인한 파티 플레이 경험치 거부
   */
  canSharePartyExperience() {
    return false; // 용인족은 경험치를 독식함
  }

  // ===== UI 및 정보 =====

  /**
   * 용언 전체 트리 UI
   */
  getDragonTongueTreeUI() {
    const allTongues = Object.values(this.tongueDefinitions).sort(
      (a, b) => a.unlockLevel - b.unlockLevel
    );

    return {
      totalTongues: allTongues.length,
      unlockedCount: this.unlockedTongues.length,
      tongues: allTongues.map(tongue => ({
        id: tongue.id,
        name: tongue.name,
        translation: tongue.translation,
        unlockLevel: tongue.unlockLevel,
        cooldown: tongue.cooldown,
        description: tongue.description,
        powerLevel: tongue.powerLevel,
        isUnlocked: this.unlockedTongues.includes(tongue.id),
        currentCooldown: this.activeTongues[tongue.id] || 0
      }))
    };
  }

  /**
   * 특정 용언 상세 정보
   */
  getTongueInfo(tongueId) {
    return this.tongueDefinitions[tongueId] || null;
  }

  /**
   * 다음 해금될 용언 정보
   */
  getNextUnlockableTongue(currentLevel) {
    const unlockedIds = new Set(this.unlockedTongues);

    for (let tongueId in this.tongueDefinitions) {
      if (!unlockedIds.has(tongueId)) {
        const tongue = this.tongueDefinitions[tongueId];

        if (currentLevel >= tongue.unlockLevel) {
          return {
            action: 'unlock',
            tongue: tongue,
            message: `새로운 용언이 해금되었습니다: ${tongue.name}`
          };
        }

        return {
          action: 'preview',
          tongue: tongue,
          message: `레벨 ${tongue.unlockLevel}에서 ${tongue.name}을(를) 배울 수 있습니다.`,
          levelRemaining: tongue.unlockLevel - currentLevel
        };
      }
    }

    return null; // 모든 용언 해금함
  }

  /**
   * 용어 사전 (각 용언의 설명)
   */
  getLanguageLore() {
    return {
      intro:
        '고대 용의 언어. 우주의 근원적 힘을 담은 절규. 매 단계마다 새로운 진리가 나타난다.',
      tongues: {
        dov: '공포(Fear). 상대방의 정신을 흔들어 전장에서 벗어나게 한다.',
        yol: '화염(Fire). 용의 내장에서 나온 원초적 불. 모든 것을 태운다.',
        fus: '거절(Force). 용의 의지로 공간을 밀어낸다. 최고의 방어는 공격.'
      }
    };
  }

  // ===== 상태 저장/복원 =====
  toJSON() {
    return {
      unlockedTongues: this.unlockedTongues,
      activeTongues: this.activeTongues
    };
  }

  fromJSON(data) {
    this.unlockedTongues = data.unlockedTongues || [];
    this.activeTongues = data.activeTongues || {};
  }
}
