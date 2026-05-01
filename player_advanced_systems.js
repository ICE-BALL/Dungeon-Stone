// 파일: player_advanced_systems.js
// 역할: 평판, 부상, 해체 스킬 고도화 시스템

/**
 * 평판(Reputation) 시스템
 * 플레이어의 행동에 따른 특정 평판 트래킹
 */
export class ReputationSystem {
    constructor(player) {
        this.player = player;
    }

    initializeReputationProfile() {
        if (!this.player.reputationProfile) {
            this.player.reputationProfile = {
                coward: 0,              // 도망친 횟수
                busDriver: 0,           // 마지막 타격 횟수
                shameless: 0,           // 동료 사망 후 루팅 횟수
                labels: []              // 획득한 평판 라벨
            };
        }
    }

    /**
     * 전투 도망: "겁쟁이" 평판 증가
     */
    addCowardReputation(reason = "전투에서 도망침") {
        this.initializeReputationProfile();
        this.player.reputationProfile.coward += 1;
        if (this.player.reputationProfile.coward >= 3 && !this.player.reputationProfile.labels.includes("겁쟁이")) {
            this.player.reputationProfile.labels.push("겁쟁이");
            this.player.cb?.logMessage?.(`[평판] "겁쟁이"라는 평판을 얻었습니다. A급 NPC는 당신을 거부할 것입니다.`);
        }
    }

    /**
     * 승리 기여도 높음(마지막 타격): "버스기사" 평판 증가
     */
    addBusDriverReputation(monsterName = "") {
        this.initializeReputationProfile();
        this.player.reputationProfile.busDriver += 1;
        if (this.player.reputationProfile.busDriver >= 5 && !this.player.reputationProfile.labels.includes("버스기사")) {
            this.player.reputationProfile.labels.push("버스기사");
            this.player.cb?.logMessage?.(`[평판] 많은 몬스터에게 마지막 타격을 가한 당신은 "버스기사"라 불리게 되었습니다.`);
        }
    }

    /**
     * 동료 사망 후 루팅만 함: "파렴치한" 평판 증가
     */
    addShamelessReputation(allyName = "동료") {
        this.initializeReputationProfile();
        this.player.reputationProfile.shameless += 1;
        if (this.player.reputationProfile.shameless >= 2 && !this.player.reputationProfile.labels.includes("파렴치한")) {
            this.player.reputationProfile.labels.push("파렴치한");
            this.player.cb?.logMessage?.(`[평판] 당신은 "파렴치한 배신자"라는 악명을 얻었습니다. 이제 일부 NPC는 당신을 거부합니다.`);
        }
    }

    /**
     * 파티 모집에 영향을 주는 평판 체크
     */
    canRecruitHighTierNPC() {
        this.initializeReputationProfile();
        const badRepCount = (this.player.reputationProfile.labels.includes("겁쟁이") ? 1 : 0)
                          + (this.player.reputationProfile.labels.includes("파렴치한") ? 1 : 0);
        return badRepCount === 0;
    }

    getReputationModifierForNPC() {
        this.initializeReputationProfile();
        let modifier = 1.0;
        if (this.player.reputationProfile.labels.includes("겁쟁이")) modifier *= 0.7;
        if (this.player.reputationProfile.labels.includes("파렴치한")) modifier *= 0.6;
        if (this.player.reputationProfile.labels.includes("버스기사")) modifier *= 1.3;
        return modifier;
    }

    getReputationReport() {
        this.initializeReputationProfile();
        const labels = this.player.reputationProfile.labels.length > 0 
            ? this.player.reputationProfile.labels.join(", ")
            : "평판 없음";
        return {
            cowardCount: this.player.reputationProfile.coward,
            busDriverCount: this.player.reputationProfile.busDriver,
            shamelessCount: this.player.reputationProfile.shameless,
            labels
        };
    }
}

/**
 * 부상(Injury) 시스템
 * 플레이어 신체 부상 및 디버프 관리
 */
export class InjurySystem {
    constructor(player) {
        this.player = player;
    }

    initializeInjuryState() {
        if (!this.player.injuryState) {
            this.player.injuryState = {
                leg: null,           // { severity: 1-3, remainingTurns: n }
                arm: null,
                head: null,
                torso: null,
                scarCount: 0         // 치료 후 흉터 개수
            };
        }
    }

    /**
     * 특정 부위에 부상 발생
     */
    inflictInjury(bodyPart, severity = 1, reason = "") {
        this.initializeInjuryState();
        if (!["leg", "arm", "head", "torso"].includes(bodyPart)) return false;

        const existing = this.player.injuryState[bodyPart];
        if (existing && existing.severity >= 3) {
            // 이미 심한 부상이 있으면 스킵
            return false;
        }

        severity = Math.max(1, Math.min(3, severity));
        const duration = { 1: 3, 2: 6, 3: 12 }[severity];

        this.player.injuryState[bodyPart] = {
            severity,
            remainingTurns: duration,
            acquiredAt: Date.now(),
            reason
        };

        this._applyInjuryDebuff(bodyPart, severity);
        this.player.cb?.logMessage?.(this._getInjuryMessage(bodyPart, severity, reason));
        return true;
    }

    /**
     * 부상으로 인한 디버프 적용
     */
    _applyInjuryDebuff(bodyPart, severity) {
        // 플레이어 스탯을 임시로 감소시킴
        const debuffAmount = severity * 0.15; // 심각도당 15% 감소
        
        switch (bodyPart) {
            case "leg":
                // 이동속도 및 회피율 감소 (플레이어 evasion 감소)
                this.player.evasionBonus = Math.max(-0.5, (this.player.evasionBonus || 0) - debuffAmount);
                break;
            case "arm":
                // 공격력 및 명중률 감소 (강타 데미지 감소)
                // 실제 공격 로직에서 처리됨
                break;
            case "head":
                // 스킬 사용 시 일정 확률로 멍때림 발생
                // 턴 진행 로직에서 처리됨
                break;
            case "torso":
                // 체력 최대값 감소
                const hpReduction = Math.max(1, Math.floor(this.player.maxHp * debuffAmount));
                this.player.maxHp = Math.max(10, this.player.maxHp - hpReduction);
                break;
        }
    }

    /**
     * 부상 메시지 생성
     */
    _getInjuryMessage(bodyPart, severity, reason) {
        const bodyNames = {
            leg: "다리",
            arm: "팔",
            head: "머리",
            torso: "몸통"
        };
        const severityNames = {
            1: "가벼운",
            2: "심한",
            3: "치명적인"
        };
        const desc = `${bodyNames[bodyPart]}에 ${severityNames[severity]} 부상을 입었습니다. (${reason})`;
        return `[부상] ${desc}`;
    }

    /**
     * 부상으로 인한 디버프 반환 (현재 적용 중인 모든 부상)
     */
    getCurrentDebuffs() {
        this.initializeInjuryState();
        const debuffs = [];
        const parts = ["leg", "arm", "head", "torso"];
        parts.forEach(part => {
            if (this.player.injuryState[part]) {
                const injury = this.player.injuryState[part];
                if (injury.remainingTurns > 0) {
                    debuffs.push(`${part}_injury_${injury.severity}`);
                }
            }
        });
        return debuffs;
    }

    /**
     * 턴 진행 (부상 지속 시간 감소)
     */
    progressInjuries() {
        this.initializeInjuryState();
        const parts = ["leg", "arm", "head", "torso"];
        parts.forEach(part => {
            if (this.player.injuryState[part] && this.player.injuryState[part].remainingTurns > 0) {
                this.player.injuryState[part].remainingTurns -= 1;
                if (this.player.injuryState[part].remainingTurns <= 0) {
                    this._healInjury(part);
                }
            }
        });
    }

    /**
     * 신전 치료 (부상 제거)
     */
    treatInjuryAtTemple(bodyPart) {
        this.initializeInjuryState();
        if (!this.player.injuryState[bodyPart]) return false;

        const severity = this.player.injuryState[bodyPart].severity;
        this._healInjury(bodyPart);
        
        // 흉터 생성
        this.player.injuryState.scarCount = (this.player.injuryState.scarCount || 0) + 1;
        
        // 흉터는 매력(CHA)를 깎지만 위압감(Intimidation) 보너스 제공
        // (후에 스탯 계산 함수에서 처리)
        
        this.player.cb?.logMessage?.[`[치료] ${bodyPart} 부상이 치료되었습니다. 흉터가 남았습니다. (흉터 ${this.player.injuryState.scarCount}개)`];
        return true;
    }

    /**
     * 부상 완전 치유
     */
    _healInjury(bodyPart) {
        this.initializeInjuryState();
        if (this.player.injuryState[bodyPart]) {
            const injury = this.player.injuryState[bodyPart];
            
            // 디버프 복구
            switch (bodyPart) {
                case "leg":
                    this.player.evasionBonus = Math.min(0, (this.player.evasionBonus || 0) + injury.severity * 0.15);
                    break;
                case "arm":
                    // 복구
                    break;
                case "head":
                    // 복구
                    break;
                case "torso":
                    const hpReduction = Math.max(1, Math.floor(this.player.maxHp * injury.severity * 0.15));
                    this.player.maxHp = Math.min(this.player.maxHp + hpReduction, this.player.maxHp);
                    break;
            }
            
            this.player.injuryState[bodyPart] = null;
        }
    }

    getInjuryReport() {
        this.initializeInjuryState();
        const state = this.player.injuryState;
        const injuries = [];
        if (state.leg) injuries.push(`다리 부상 (심각도 ${state.leg.severity}, 남은 시간 ${state.leg.remainingTurns})`);
        if (state.arm) injuries.push(`팔 부상 (심각도 ${state.arm.severity}, 남은 시간 ${state.arm.remainingTurns})`);
        if (state.head) injuries.push(`머리 부상 (심각도 ${state.head.severity}, 남은 시간 ${state.head.remainingTurns})`);
        if (state.torso) injuries.push(`몸통 부상 (심각도 ${state.torso.severity}, 남은 시간 ${state.torso.remainingTurns})`);
        return {
            activeInjuries: injuries,
            scarCount: state.scarCount || 0
        };
    }
}

/**
 * 해체 및 도축(Butchery) 스킬 시스템
 * 몬스터 처치 후 마석/유용한 재료 추출
 */
export class ButcherySystem {
    constructor(player) {
        this.player = player;
    }

    initializeButcherySkill() {
        if (typeof this.player.butcherySkill !== 'number') {
            this.player.butcherySkill = 0;
        }
    }

    grantItem(itemName, count = 1) {
        const total = Math.max(0, Math.floor(Number(count || 0)));
        for (let i = 0; i < total; i++) {
            this.player.addItem(itemName);
        }
    }

    /**
     * 해체 난이도 계산
     */
    calculateButcheryDifficulty(monsterData) {
        const grade = Math.max(1, Number(monsterData.grade || 5));
        const hp = Math.max(50, Number(monsterData.hp || 100));
        // 등급이 낮을수록(강한 몬스터) 해체가 어려움
        return {
            baseSuccessRate: 0.5 + ((grade - 1) * 0.05), // 1등급: 50%, 9등급: 90%
            difficulty: 10 - grade
        };
    }

    /**
     * 해체 성공률 계산
     * DEX(민첩성)와 butcherySkill에 따라 결정됨
     */
    calculateSuccessRate(monsterData) {
        this.initializeButcherySkill();
        const difficulty = this.calculateButcheryDifficulty(monsterData);
        const dex = Number(this.player.currentStats?.["민첩성"] || this.player.stats?.["민첩성"] || 10);
        
        // 민첩성 기반 보정
        const dexBonus = (dex - 10) * 0.03; // 민첩성 10 = 0%, 15 = 15% 보너스
        
        // 스킬 레벨 기반 보정
        const skillBonus = Math.min(0.4, this.player.butcherySkill * 0.02); // 최대 40% 보너스
        
        let successRate = difficulty.baseSuccessRate + dexBonus + skillBonus;
        
        // 부상 패널티: 팔 부상이 있으면 성공률 감소
        if (this.player.injuryState?.arm) {
            const rawSeverity = this.player.injuryState.arm.severity;
            const severity = rawSeverity === "major"
                ? 3
                : (rawSeverity === "minor" ? 1 : Math.max(1, Number(rawSeverity || 1)));
            successRate *= (1 - severity * 0.12);
        }
        
        return Math.max(0, Math.min(1, successRate));
    }

    /**
     * 해체 스킬 사용 (전투 승리 후 호출)
     */
    attemptButchery(monsterData) {
        this.initializeButcherySkill();
        
        const successRate = this.calculateSuccessRate(monsterData);
        const roll = Math.random();
        
        if (roll < 0.05) {
            // 대실패 모드
            return this._catastrophicFailure(monsterData);
        } else if (roll < successRate * 0.3) {
            // 대성공 모드
            return this._criticalSuccess(monsterData);
        } else if (roll < successRate) {
            // 보통 성공
            return this._normalSuccess(monsterData);
        } else {
            // 실패
            return this._failure(monsterData);
        }
    }

    /**
     * 대성공: 온전한 마석 + 특수 부위 + 고기 모두 획득
     */
    _criticalSuccess(monsterData) {
        const grade = Math.max(1, Number(monsterData.grade || 5));
        const baseValue = {
            1: { stone: 450, material: 3 }, // 높은 가치
            5: { stone: 200, material: 2 },
            9: { stone: 100, material: 1 }
        };
        
        let value = baseValue[grade] || baseValue[5];
        if (grade < 5) {
            // 보간
            const ratio = (grade - 1) / 4;
            value = {
                stone: Math.floor(100 + (baseValue[1].stone - 100) * ratio),
                material: Math.ceil(1 + (baseValue[1].material - 1) * ratio)
            };
        } else if (grade > 5) {
            const ratio = (grade - 5) / 4;
            value = {
                stone: Math.floor(200 - (200 - 100) * ratio),
                material: Math.ceil(2 - (2 - 1) * ratio)
            };
        }

        const results = {
            magicStones: value.stone,
            pristineMagicStone: 1,  // 온전한 마석
            material: value.material, // 제작 재료
            meat: Math.max(1, Math.floor((10 - grade) * 0.8)), // 고기
            skillGain: 3  // 스킬 숙련도
        };

        this.player.magic_stones = (this.player.magic_stones || 0) + results.magicStones;
        this.grantItem("온전한 마석", results.pristineMagicStone);
        this.grantItem("제작 재료", results.material);
        this.grantItem("신선한 고기", results.meat);
        this.player.butcherySkill = (this.player.butcherySkill || 0) + results.skillGain;
        
        this.player.cb?.logMessage?.(`[대성공] ${monsterData.name}에서 온전한 마석, 특수 부위, 신선한 고기를 모두 추출했습니다!`);
        
        return results;
    }

    /**
     * 보통 성공: 마석 + 고기
     */
    _normalSuccess(monsterData) {
        const grade = Math.max(1, Number(monsterData.grade || 5));
        const stoneValue = Math.max(30, 120 - (grade * 10));
        const meat = Math.max(1, Math.floor((10 - grade) * 0.5));

        const results = {
            magicStones: stoneValue,
            meat,
            skillGain: 1
        };

        this.player.magic_stones = (this.player.magic_stones || 0) + results.magicStones;
        this.grantItem("신선한 고기", results.meat);
        this.player.butcherySkill = (this.player.butcherySkill || 0) + results.skillGain;
        
        this.player.cb?.logMessage?.(`[성공] ${monsterData.name}에서 마석(${results.magicStones}개)과 고기를 추출했습니다.`);
        
        return results;
    }

    /**
     * 실패: 금 간 마석(헐값) + 부산물 없음
     */
    _failure(monsterData) {
        const grade = Math.max(1, Number(monsterData.grade || 5));
        const crackedValue = Math.max(10, 40 - (grade * 4)); // 헐값

        const results = {
            magicStones: crackedValue,
            cracked: true,
            skillGain: 0
        };

        this.player.magic_stones = (this.player.magic_stones || 0) + results.magicStones;
        
        this.player.cb?.logMessage?.(`[실패] ${monsterData.name}에서 금 간 마석만 겨우 추출했습니다. (${results.magicStones}개)`);
        
        return results;
    }

    /**
     * 대실패: 마석 파괴 + 도구 손상 + 플레이어 부상(손 베임)
     */
    _catastrophicFailure(monsterData) {
        this.player.applyCombatInjury?.({
            force: true,
            damage: Math.max(12, Math.floor(Number(this.player.maxHp || 100) * 0.12)),
            source: "해체 중 손 베임"
        });
        if (!this.player.applyCombatInjury && this.player.injuryState) {
            this.player.injuryState.arm = this.player.injuryState.arm || {
                severity: "minor",
                source: "해체 중 손을 베임",
                timestamp: Date.now()
            };
        }

        const results = {
            magicStones: 0,
            destroyed: true,
            toolDamaged: true,
            playerInjured: true,
            skillGain: -1
        };

        this.player.hp = Math.max(1, this.player.hp - 15); // 부상으로 인한 HP 손실
        this.player.butcherySkill = Math.max(0, (this.player.butcherySkill || 0) + results.skillGain);
        this.player.calculateStats?.();
        
        this.player.cb?.logMessage?.(`[대실패] 해체 중 손을 베었습니다! (팔 부상 발생, -15 HP)`);
        this.player.cb?.logMessage?.(`해체 도구가 손상되었고 마석은 완전히 파괴되었습니다.`);
        
        return results;
    }

    /**
     * 해체 숙련도 보고서
     */
    getButcheryReport() {
        this.initializeButcherySkill();
        return {
            skillLevel: this.player.butcherySkill,
            skillDescription: this._getSkillDescription(),
            nextLevelRequirement: (Math.floor(this.player.butcherySkill / 10) + 1) * 10
        };
    }

    _getSkillDescription() {
        const level = this.player.butcherySkill;
        if (level < 5) return "초보";
        if (level < 15) return "미숙";
        if (level < 30) return "숙련자";
        if (level < 50) return "전문가";
        return "장인";
    }
}
