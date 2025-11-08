// 이 파일은 게임의 도시(비전투) UI 함수를 담당합니다.
// (구역 이동, 장소 활동, 상점, 마탑, 길드 등)
// [수정] handleCityAction: NPC 생성 시 player.NPCClass -> player.cb.NPCClass 로 수정

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

    const cityData = player.cb.gameData.cities["라프도니아"];
    if (cityData) {
        Object.keys(cityData).forEach(district => {
             if (cityData[district] && cityData[district].desc) {
                 addButton(menu, `${district} - ${cityData[district].desc}`, () => {
                     // 1구역(황도 카르논) 입장 조건 체크
                     if (district.includes("1구역")) {
                         if (player.specialStats['명성'].value < 50) { // (임시 명성 50 필요)
                             logMessage("명성이 부족하여 황도 카르논에 입장할 수 없습니다.");
                             return;
                         }
                     }
                     
                     player.position = district; // 플레이어 위치 변경
                     logMessage(`${district}(으)로 이동했다.`);
                     player.cb.updateMenu(player); // 메인 메뉴 업데이트
                 });
             }
        });
    }
    addButton(menu, "뒤로 (메인 메뉴)", () => player.cb.updateMenu(player));
}

/**
 * 현재 도시 구역의 활동 장소 메뉴 표시
 * @param {Player} player - 플레이어 객체
 */
export function showCityLocations(player) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 메뉴 초기화
    
    const district = player.cb.gameData.cities.라프도니아[player.position];

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
    addButton(menu, "뒤로 (메인 메뉴)", () => player.cb.updateMenu(player));
}

/**
 * 도시 장소별 행동 처리 (대부분의 도시 기능이 여기에 정의됨)
 * @param {Player} player - 플레이어 객체
 * @param {string} location - 행동을 처리할 장소 이름
 */
export function handleCityAction(player, location) {
    const menu = document.getElementById('menu');
    if (!menu) return;
    menu.innerHTML = ''; // 행동 메뉴 초기화

    const npcs = player.cb.gameData.npcs;
    const shopItems = player.cb.gameData.shopItems;
    const magic = player.cb.gameData.magic;
    const allGameItems = {
        ...player.cb.gameData.items, 
        ...player.cb.gameData.numbersItems, 
        ...player.cb.gameData.shopItems, 
        ...player.cb.gameData.materials
    };

    switch(location) {
        case "라비기온 중앙 도서관":
             const librarian = npcs["도서관 사서 라그나"];
             if (librarian && typeof librarian.action === 'function') {
                librarian.action(player); 
             } else {
                 logMessage("도서관 사서 라그나: 찾는 책이 있나요? (임시 대화)");
             }
            break;

        case "환전소":
            if(player.magic_stones > 0) {
                const exchangeRate = 20; 
                const earnedStones = player.magic_stones * exchangeRate;
                player.gold += earnedStones;
                logMessage(`마석 ${player.magic_stones.toLocaleString()}개를 ${earnedStones.toLocaleString()} 스톤으로 교환했다.`);
                player.magic_stones = 0;
                player.cb.playSfx('sfx-event');
            } else {
                logMessage("교환할 마석이 없다.");
            }
            player.showStatus();
            break;

        case "탐험가 길드 지부":
             const guildReceptionist = npcs["탐험가 길드 접수원"];
             logMessage(guildReceptionist ? guildReceptionist.dialog : "무엇을 도와드릴까요?");

            // 1. 파티원 모집
            addButton(menu, "파티원 모집", () => {
                menu.innerHTML = '';
                logMessage("어떤 등급의 동료를 모집하시겠습니까? (비용이 발생합니다)");
                
                // 9등급부터 3등급까지 모집
                for (let i = 9; i >= 3; i--) { 
                     const cost = (10 - i) * 1000 * (1 + (9-i)*0.5);
                     addButton(menu, `${i}등급 동료 모집 (${cost.toLocaleString()} 스톤)`, () => {
                        if (player.gold < cost) {
                            logMessage("돈이 부족합니다.");
                            return;
                        }
                        if (player.party.length >= 4) {
                            logMessage("파티원이 가득 찼습니다. (최대 4명)");
                            return;
                        }
                        player.gold -= cost;
                        
                        // --- [BUG FIX] ---
                        // player.NPCClass -> player.cb.NPCClass 로 수정
                        const newCompanion = new player.cb.NPCClass(`동료용병-${player.party.length+1}`, "Human", i, player.cb);
                        // --- [FIX END] ---

                        player.party.push(newCompanion);
                        logMessage(`${newCompanion.name}(${i}등급/${newCompanion.trait})와 파티 결속을 맺었다.`);
                        player.cb.playSfx('sfx-event');
                        player.showStatus();
                        handleCityAction(player, location); // 길드 메뉴로 복귀
                    });
                }
                addButton(menu, "뒤로 (길드 메뉴)", () => handleCityAction(player, location));
            });
            
            // 2. 퀘스트 수락
            addButton(menu, "의뢰 확인 (퀘스트)", () => {
                menu.innerHTML = '';
                logMessage("수락 가능한 의뢰 목록:");
                let foundQuest = false;
                for (const questId in player.cb.gameData.quests) {
                    const quest = player.cb.gameData.quests[questId];
                    if (quest.type === "GUILD" && 
                        !player.questManager.completedQuests.includes(questId) &&
                        !player.questManager.activeQuests.some(q => q.id === questId) &&
                        player.level >= (quest.startCondition.level || 1)) 
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
                addButton(menu, "뒤로 (길드 메뉴)", () => handleCityAction(player, location));
            });
            break;

        case "주점":
            logMessage(npcs["주점 주인"] ? npcs["주점 주인"].dialog : "시원한 맥주 한 잔 어때?");
            addButton(menu, "다른 탐험가와 대화하기 (정보 얻기)", () => {
                const tips = player.cb.gameData.companionDialogues;
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
                    const basePrice = allGameItems[itemToSell]?.price || allGameItems[itemToSell]?.tier * 10 || 10;
                    const sellPrice = Math.floor(basePrice / 2);
                    player.gold += sellPrice;
                    player.inventory.splice(itemIndex, 1);
                    logMessage(`${itemToSell}을(를) ${sellPrice} 스톤에 판매했다.`);
                    player.cb.playSfx('sfx-event');
                    player.showStatus();
                    handleCityAction(player, location);
                 } else {
                    logMessage("해당 아이템을 가지고 있지 않다.");
                 }
            });
            break;

        case "대신전 (삼신교)":
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
                            
                            player.essence_skills = player.essence_skills.filter(skillName => {
                                 let skillExistsInOtherEssences = false;
                                 for(const essKey of player.essences) {
                                     const ess = player.cb.gameData.essences[essKey];
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
                            
                            player.cb.playSfx('sfx-event');
                            player.calculateStats(); 
                            player.showStatus(); 
                            handleCityAction(player, location);
                        }
                    });
                });
            } else {
                logMessage("삭제할 정수가 없습니다.");
            }
            break;

        case "대장간":
            logMessage(npcs["대장장이"] ? npcs["대장장이"].dialog : "뭘 도와줄까?");
            addButton(menu, "아이템 제작", () => {
                logMessage("무엇을 제작하시겠습니까? (제작 시스템 구현 필요)");
            });
            addButton(menu, "장비 강화", () => logMessage("장비 강화는 아직 구현되지 않았습니다."));
            addButton(menu, "장비 수리", () => logMessage("장비 수리는 아직 구현되지 않았습니다."));
            break;

        case "여관":
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
                player.cb.playSfx('sfx-event');
                player.showStatus(); 
            }
            break;
            
        case "마탑":
            logMessage("마법사들의 본거지, 마탑에 들어왔습니다. 지식을 탐구하거나 마법을 배울 수 있습니다.");
            addButton(menu, "마법 배우기", () => {
                menu.innerHTML = '';
                logMessage("배울 수 있는 마법 목록:");
                let foundSpell = false;
                for (const spellName in magic) {
                    const spell = magic[spellName];
                    const cost = (spell.grade || 9) * 10000; 
                    if (!player.spells.includes(spellName) && player.level >= (spell.grade || 9)) {
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
                addButton(menu, "뒤로 (마탑 메뉴)", () => handleCityAction(player, location));
            });
            addButton(menu, "마법 연구", () => logMessage("마법 연구는 아직 구현되지 않았습니다."));
            break;

        case "알미너스 중앙 거래소":
            logMessage("알미너스 중앙 거래소입니다. (거래소 기능 구현 필요)");
            break;
            
        case "알미너스 은행":
            logMessage("알미너스 은행입니다. (은행 기능 구현 필요)");
            break;

        case "훈련장":
            logMessage("이능을 시험해볼 수 있는 훈련장입니다. (훈련장 기능 구현 필요)");
            break;

        default:
            logMessage("아직 구현되지 않은 장소입니다.");
    }
    
    // 모든 장소 행동 후 '뒤로' 버튼 추가 (도시 구역 활동 메뉴로 돌아감)
    addButton(menu, "뒤로 (구역 활동 메뉴)", () => showCityLocations(player));
    updateStatusBars(player);
}