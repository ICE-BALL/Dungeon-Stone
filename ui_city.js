// 이 파일은 게임의 도시(비전투) UI 함수를 담당합니다.
// (구역 이동, 장소 활동, 상점, 마탑, 길드 등)
// [수정] handleCityAction: "뒤로 가기" 버튼을 맨 위에 추가하여 상점가 스크롤 버그 해결

// --- 핵심 UI 유틸리티 임포트 ---
import {
    logMessage,
    addButton,
    showModal,
    hideModal,
    updateStatusBars
} from './ui_core.js';

/**
 * 도시 구역 이동 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCityDistricts(player) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 메뉴 초기화
    logMessage("어느 구역으로 이동하시겠습니까?");

    /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
    const cityData = player.cb.gameData?.cities?.["라프도니아"];
    if (cityData) {
        Object.keys(cityData).forEach(district => {
             if (cityData[district] && cityData[district].desc) {
                 addButton(menu, `${district} - ${cityData[district].desc}`, () => {
                     // 1구역(황도 카르논) 입장 조건 체크
                     if (district.includes("1구역")) {
                         /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
                         if (player.specialStats?.['명성']?.value < 50) { // (임시 명성 50 필요)
                             logMessage("명성이 부족하여 황도 카르논에 입장할 수 없습니다.");
                             return;
                         }
                     }
                     
                     player.position = district; // 플레이어 위치 변경
                     logMessage(`${district}(으)로 이동했다.`);
                     
                     // [확장 계획 3] 퀘스트 진행 체크 (REACH)
                     /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                     player.questManager?.checkProgress('REACH', district, 1);
                     
                     /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                     player.cb?.updateMenu(player); // 메인 메뉴 업데이트
                 });
             }
        });
    }
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    addButton(menu, "뒤로 (메인 메뉴)", () => player.cb?.updateMenu(player));
}

/**
 * 현재 도시 구역의 활동 장소 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCityLocations(player) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 메뉴 초기화
    
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
    const district = player.cb.gameData?.cities?.라프도니아?.[player.position];

    if (district && district.locations) {
        logMessage(`현재 구역 [${player.position}]에서 활동할 장소를 선택하세요.`);
        Object.keys(district.locations).forEach(loc => {
             if (district.locations[loc] && district.locations[loc].desc) {
                 addButton(menu, `${loc} - ${district.locations[loc].desc}`, () => {
                     logMessage(`${loc}(으)로 이동했다.`);
                     handleCityAction(player, loc); // 해당 장소 행동 처리
                 });
             }
        });
    } else {
        logMessage("현재 구역에는 특별한 활동 장소가 없습니다.");
    }
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    addButton(menu, "뒤로 (메인 메뉴)", () => player.cb?.updateMenu(player));
}

/**
 * [대규모 수정] 도시 장소별 행동 처리 (모든 도시 기능 구현)
 * @param {Player} player - 플레이어 객체
 * @param {string} location - 행동을 처리할 장소 이름
 */
export function handleCityAction(player, location) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 행동 메뉴 초기화

    // [!!!] [버그 수정] "뒤로 가기" 버튼을 가장 먼저 추가합니다.
    // 이렇게 하면 상점가 등에 아이템이 많아도 항상 뒤로가기 버튼이 보입니다.
    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
    const backBtn = addButton(menu, "뒤로 (구역 활동 메뉴)", () => player.cb?.showCityLocations(player));
    backBtn.style.borderLeftColor = "var(--color-stamina)"; // 뒤로가기 버튼 강조

    // [신규] 시각적 구분을 위한 구분선 추가
    const hr = document.createElement('hr');
    hr.style.borderColor = "var(--color-border)";
    menu.appendChild(hr);


    // [신규] 필요한 모든 데이터 미리 불러오기
    /* AUTO-FIX: added guards for this.gameData to avoid TypeError when undefined (Rule 4) */
    const npcs = player.cb.gameData?.npcs || {};
    const shopItems = player.cb.gameData?.items || {}; // [수정] static_content.json의 items 사용
    const magic = player.cb.gameData?.magic || {};
    const allGameItems = {
        ...(player.cb.gameData?.items || {}), 
        ...(player.cb.gameData?.numbersItems || {}), 
        ...(player.cb.gameData?.shopItems || {}), // (shopItems은 이제 items와 동일)
        ...(player.cb.gameData?.materials || {})
    };

    switch(location) {
        case "라비기온 중앙 도서관":
             /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
             player.questManager?.checkProgress('TALK', '도서관 사서 라그나', 1);
             const librarian = npcs["도서관 사서 라그나"];
             if (librarian && typeof librarian.action === 'function') {
                librarian.action(player); 
             } else {
                 logMessage("도서관 사서 라그나: 찾는 책이 있나요? (임시 대화)");
             }
            break;

        case "환전소":
            if(player.magic_stones > 0) {
                const exchangeRate = 20; // (임의: 9등급 20스톤)
                const earnedStones = player.magic_stones * exchangeRate;
                player.gold += earnedStones;
                logMessage(`마석 ${player.magic_stones.toLocaleString()}개를 ${earnedStones.toLocaleString()} 스톤으로 교환했다.`);
                player.magic_stones = 0;
                /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                player.cb?.playSfx('sfx-event');
            } else {
                logMessage("교환할 마석이 없다.");
            }
            player.showStatus();
            break;

        case "탐험가 길드 지부":
             /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
             player.questManager?.checkProgress('TALK', '탐험가 길드 접수원', 1);
             const guildReceptionist = npcs["탐험가 길드 접수원"];
             logMessage(guildReceptionist ? guildReceptionist.dialog : "무엇을 도와드릴까요?");

            // 1. 파티원 모집
            addButton(menu, "파티원 모집", () => {
                menu.innerHTML = '';
                // [버그 수정] 뒤로가기 버튼 상단에 다시 추가
                addButton(menu, "뒤로 (길드 메뉴)", () => handleCityAction(player, location)).style.borderLeftColor = "var(--color-stamina)";
                menu.appendChild(document.createElement('hr'));
                
                logMessage("어떤 등급의 동료를 모집하시겠습니까? (비용이 발생합니다)");
                
                const traits = ["전사", "탐색꾼", "인도자", "신관", "마법사"];

                // 9등급부터 3등급까지 모집
                for (let i = 9; i >= 3; i--) { 
                     const cost = (10 - i) * 1000 * (1 + (9-i)*0.5); // (임의 계산식)
                     addButton(menu, `${i}등급 동료 모집 (${cost.toLocaleString()} 스톤)`, () => {
                        if (player.gold < cost) {
                            logMessage("돈이 부족합니다.");
                            return;
                        }
                        if (player.party.length >= 4) {
                            logMessage("파티원이 가득 찼습니다. (최대 4명)");
                            return;
                        }
                        
                        /* AUTO-FIX: player.cb.NPCClass 사용 */
                        if (player.cb?.NPCClass) {
                            player.gold -= cost;
                            const randomTrait = traits[Math.floor(Math.random() * traits.length)];
                            const newCompanion = new player.cb.NPCClass(`동료용병-${player.party.length+1}`, "Human", i, player.cb, randomTrait);
                            
                            player.party.push(newCompanion);
                            logMessage(`${newCompanion.name}(${i}등급/${newCompanion.trait})와 파티 결속을 맺었다.`);
                            /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                            player.cb?.playSfx('sfx-event');
                            player.showStatus();
                            handleCityAction(player, location); // 길드 메뉴로 복귀
                        } else {
                            logMessage("오류: NPC 생성자를 찾을 수 없어 동료를 모집할 수 없습니다.");
                        }
                    });
                }
            });
            
            // 2. 퀘스트 수락
            addButton(menu, "의뢰 확인 (퀘스트)", () => {
                menu.innerHTML = '';
                // [버그 수정] 뒤로가기 버튼 상단에 다시 추가
                addButton(menu, "뒤로 (길드 메뉴)", () => handleCityAction(player, location)).style.borderLeftColor = "var(--color-stamina)";
                menu.appendChild(document.createElement('hr'));

                logMessage("수락 가능한 의뢰 목록:");
                let foundQuest = false;
                /* AUTO-FIX: added guard for this.gameData.quests to avoid TypeError (Rule 4) */
                const quests = player.cb.gameData?.quests || {};
                for (const questId in quests) {
                    const quest = quests[questId];
                    /* AUTO-FIX: added optional chaining ?. for safety (Rule 4) */
                    if (quest.type === "GUILD" && 
                        !player.questManager.completedQuests.includes(questId) &&
                        !player.questManager.activeQuests.some(q => q.id === questId) &&
                        player.level >= (quest.startCondition?.level || 1)) 
                    {
                        foundQuest = true;
                        addButton(menu, `[${quest.title}] - ${quest.description}`, () => {
                            player.questManager.acceptQuest(questId);
                            handleCityAction(player, location);
                        });
                    }
                }
                if (!foundQuest) {
                    logMessage("현재 수락 가능한 의뢰가 없습니다.");
                }
            });
            // 3. 결속 (임시 기능)
            addButton(menu, "파티 결속 (24시간)", () => {
                logMessage("[결속] 마법으로 파티원들과의 유대가 24시간 동안 강화되었습니다.");
            });
            break;

        case "주점":
            logMessage(npcs["주점 주인"] ? npcs["주점 주인"].dialog : "시원한 맥주 한 잔 어때?");
            addButton(menu, "다른 탐험가와 대화하기 (정보 얻기)", () => {
                /* AUTO-FIX: added guard for this.gameData.companionDialogues to avoid TypeError (Rule 4) */
                const tips = Array.isArray(player.cb.gameData?.companionDialogues) ? player.cb.gameData.companionDialogues : ["정보가 없습니다."];
                logMessage(`옆 테이블 탐험가: "${tips[Math.floor(Math.random() * tips.length)]}"`);
            });
            break;

        case "상점가":
            logMessage(npcs["상점 주인"] ? npcs["상점 주인"].dialog : "어서 오세요!");
            // 구매
            Object.keys(shopItems).forEach(item => {
                 const shopItem = shopItems[item];
                 addButton(menu, `구매: ${item} (${shopItem.price.toLocaleString()} 스톤) - ${shopItem.desc}`, () => {
                     if (player.gold >= shopItem.price) {
                         player.gold -= shopItem.price;
                         player.addItem(item); 
                         logMessage(`${item}을(를) 구매했다.`);
                         player.showStatus(); // 골드/아이템 UI 갱신
                     } else {
                         logMessage("돈이 부족하다.");
                     }
                 });
            });
            // 판매
            addButton(menu, "아이템 판매", () => {
                const itemToSell = prompt("판매할 아이템 이름을 정확히 입력하세요:");
                 if (!itemToSell) return;

                 const itemIndex = player.inventory.indexOf(itemToSell);
                 if (itemIndex > -1) {
                    // [수정] 모든 아이템 DB에서 가격 정보 조회
                    const basePrice = allGameItems[itemToSell]?.price || allGameItems[itemToSell]?.tier * 100 || 10;
                    const sellPrice = Math.floor(basePrice / 2); // (임의: 50% 가격)
                    player.gold += sellPrice;
                    player.inventory.splice(itemIndex, 1);
                    logMessage(`${itemToSell}을(를) ${sellPrice} 스톤에 판매했다.`);
                    /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                    player.cb?.playSfx('sfx-event');
                    player.showStatus();
                    // (상점 메뉴로 돌아가기 위해 다시 호출)
                    handleCityAction(player, location);
                 } else {
                    logMessage("해당 아이템을 가지고 있지 않다.");
                 }
            });
            break;

        case "대신전 (삼신교)":
            /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
            player.questManager?.checkProgress('TALK', '교단 신관', 1);
            logMessage(npcs["교단 신관"] ? npcs["교단 신관"].dialog : "신의 은총이 함께하길...");
            
            // 정수 삭제
            if(player.essences.length > 0) {
                logMessage("삭제할 정수를 선택하세요. 삭제 비용은 5,000,000 스톤입니다.");
                player.essences.forEach((essenceKey, index) => {
                     const cost = 5000000; 
                    addButton(menu, `정수 삭제: ${essenceKey} (${cost.toLocaleString()} 스톤)`, () => {
                        if (player.gold < cost) {
                            logMessage("정수 삭제 비용이 부족합니다.");
                            return;
                        }
                        if (confirm(`정말로 [${essenceKey}] 정수를 삭제하시겠습니까?`)) {
                            player.gold -= cost;
                            const removed = player.essences.splice(index, 1)[0];
                            logMessage(`신관의 도움으로 [${removed}] 정수의 흔적을 지웠다.`);
                            
                            // [신규] 해당 정수에서 배운 액티브 스킬 제거
                            player.essence_skills = player.essence_skills.filter(skillName => {
                                 let skillExistsInOtherEssences = false;
                                 for(const essKey of player.essences) {
                                     /* AUTO-FIX: added optional chaining ?. for safety (Rule 4); review required */
                                     const ess = player.cb.gameData?.essences?.[essKey];
                                     if (ess && ess.active) {
                                         const skills = Array.isArray(ess.active) ? ess.active : [ess.active];
                                         if (skills.some(s => s.name === skillName)) {
                                             skillExistsInOtherEssences = true;
                                             break;
                                         }
                                     }
                                 }
                                 return skillExistsInOtherEssences;
                            });
                            
                            /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                            player.cb?.playSfx('sfx-event');
                            player.calculateStats(); 
                            player.showStatus(); 
                            handleCityAction(player, location); // 대신전 메뉴로 복귀
                        }
                    });
                });
            } else {
                logMessage("삭제할 정수가 없습니다.");
            }
            break;

        case "대장간":
            /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
            player.questManager?.checkProgress('TALK', '대장장이', 1);
            logMessage(npcs["대장장이"] ? npcs["대장장이"].dialog : "뭘 도와줄까?");
            
            addButton(menu, "장비 수리 (100 스톤)", () => {
                const cost = 100;
                if (player.gold < cost) {
                    logMessage("수리비가 부족합니다.");
                    return;
                }
                player.gold -= cost;
                logMessage("모든 장비가 완벽하게 수리되었습니다.");
                player.showStatus();
            });
            addButton(menu, "아이템 제작", () => {
                logMessage("무엇을 제작하시겠습니까? (제작 시스템 구현 필요)");
            });
            addButton(menu, "장비 강화", () => logMessage("장비 강화는 아직 구현되지 않았습니다."));
            break;

        case "여관":
             /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
             player.questManager?.checkProgress('TALK', '여관 주인', 1);
             const innCost = 200; 
             logMessage(npcs["여관 주인"] ? npcs["여관 주인"].dialog : `하룻밤에 ${innCost} 스톤입니다.`);
            if(player.gold < innCost) {
                logMessage("돈이 부족하여 여관에 묵을 수 없다.");
            } else {
                player.hp = player.maxHp;
                player.mp = player.maxMp;
                player.stamina = player.maxStamina;
                player.fatigue = 0;
                player.party.forEach(member => {
                    member.hp = member.maxHp;
                    member.mp = member.maxMp;
                });
                player.gold -= innCost;
                logMessage(`여관에서 하루 묵으며 모든 것을 회복했다. (${innCost} 스톤 지불)`);
                /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
                player.cb?.playSfx('sfx-event');
                player.showStatus(); 
            }
            break;
            
        case "마탑":
            /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
            player.questManager?.checkProgress('TALK', '마탑 마법사', 1); // (임의의 NPC 이름)
            logMessage("마법사들의 본거지, 마탑에 들어왔습니다. 지식을 탐구하거나 마법을 배울 수 있습니다.");
            addButton(menu, "마법 배우기", () => {
                menu.innerHTML = '';
                // [버그 수정] 뒤로가기 버튼 상단에 다시 추가
                addButton(menu, "뒤로 (마탑 메뉴)", () => handleCityAction(player, location)).style.borderLeftColor = "var(--color-stamina)";
                menu.appendChild(document.createElement('hr'));

                logMessage("배울 수 있는 마법 목록:");
                let foundSpell = false;
                for (const spellName in magic) {
                    const spell = magic[spellName];
                    const cost = (10 - (spell.grade || 9)) * 5000 + 1000; // (임의 등급별 가격)
                    if (!player.spells.includes(spellName)) {
                        foundSpell = true;
                        addButton(menu, `[${spell.grade}등급] ${spellName} (${cost.toLocaleString()} 스톤) - ${spell.desc}`, () => {
                            if (player.gold < cost) {
                                logMessage("마법을 배우기에 스톤이 부족합니다.");
                                return;
                            }
                            player.gold -= cost;
                            player.learnSpell(spellName); 
                            handleCityAction(player, location); 
                        });
                    }
                }
                if (!foundSpell) {
                    logMessage("현재 배울 수 있는 마법이 없습니다.");
                }
            });
            addButton(menu, "마법 연구", () => logMessage("마법 연구는 아직 구현되지 않았습니다."));
            break;

        case "훈련장":
            logMessage("이능 및 스킬 사용이 허가된 훈련 공간입니다.");
            addButton(menu, "기본 훈련 (500 스톤)", () => {
                const cost = 500;
                if (player.daysInLabyrinth === player.lastTrainedDate) {
                    logMessage("훈련은 하루에 한 번만 가능합니다.");
                    return;
                }
                if (player.gold < cost) {
                    logMessage("훈련 비용이 부족합니다.");
                    return;
                }
                player.gold -= cost;
                player.lastTrainedDate = player.daysInLabyrinth;
                
                // [수정] 겜바바 설정.txt 기반 스탯만 훈련
                const statsToTrain = ["근력", "민첩성", "지구력", "정신력"];
                const trainedStat = statsToTrain[Math.floor(Math.random() * statsToTrain.length)];
                player.stats[trainedStat]++;
                logMessage(`훈련을 통해 [${trainedStat}] 스탯이 1 상승했습니다!`);
                player.calculateStats();
                player.showStatus();
            });
            // [신규] 인간 종족 오러 훈련
            if (player.race === "Human") {
                addButton(menu, "오러 수련 (1000 스톤)", () => {
                    // (오러 레벨업 로직 구현 필요)
                    logMessage("오러 수련은 아직 구현되지 않았습니다.");
                });
            }
            break;

        case "알미너스 중앙 거래소":
            addButton(menu, "아이템 검색 (수수료 3,000 스톤)", () => {
                const cost = 3000;
                if (player.gold < cost) {
                    logMessage("검색 수수료가 부족합니다.");
                    return;
                }
                const itemToSearch = prompt("검색할 아이템 이름을 입력하세요:");
                if (itemToSearch) {
                    player.gold -= cost;
                    const itemData = allGameItems[itemToSearch];
                    if (itemData) {
                        const price = itemData.price || itemData.tier * 100 || 50;
                        logMessage(`[${itemToSearch}] 검색 결과: 현재 ${price.toLocaleString()} 스톤에 거래되고 있습니다.`);
                    } else {
                        logMessage(`[${itemToSearch}](은)는 거래소에 매물이 없습니다.`);
                    }
                }
            });
            addButton(menu, "아이템 위탁 판매", () => logMessage("위탁 판매는 아직 구현되지 않았습니다."));
            break;
            
        case "알미너스 은행":
            logMessage(`현재 잔고: ${player.gold.toLocaleString()} 스톤 | 은행 예금: ${player.bankGold.toLocaleString()} 스톤`);
            addButton(menu, "입금", () => {
                const amountStr = prompt("입금할 금액을 입력하세요:");
                const amount = parseInt(amountStr);
                if (amount > 0 && player.gold >= amount) {
                    player.gold -= amount;
                    player.bankGold += amount;
                    logMessage(`${amount.toLocaleString()} 스톤을 입금했습니다.`);
                    player.showStatus();
                } else if (amount > 0) {
                    logMessage("잔고가 부족합니다.");
                }
            });
            addButton(menu, "출금", () => {
                const amountStr = prompt("출금할 금액을 입력하세요:");
                const amount = parseInt(amountStr);
                if (amount > 0 && player.bankGold >= amount) {
                    player.bankGold -= amount;
                    player.gold += amount;
                    logMessage(`${amount.toLocaleString()} 스톤을 출금했습니다.`);
                    player.showStatus();
                } else if (amount > 0) {
                    logMessage("예금이 부족합니다.");
                }
            });
            break;

        default:
            logMessage("아직 구현되지 않은 장소입니다.");
    }
    
    // [제거] "뒤로" 버튼을 맨 위로 옮겼기 때문에 하단에서는 제거
    // addButton(menu, "뒤로 (구역 활동 메뉴)", () => player.cb?.showCityLocations(player));
    updateStatusBars(player);
}