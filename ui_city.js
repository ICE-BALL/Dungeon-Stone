// 파일: ui_city.js
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

function createActionSection(menu, title, desc = "") {
    const section = document.createElement('section');
    section.className = 'city-action-section';

    if (title) {
        const heading = document.createElement('h3');
        heading.className = 'city-action-title';
        heading.textContent = title;
        section.appendChild(heading);
    }

    if (desc) {
        const sub = document.createElement('p');
        sub.className = 'city-action-desc';
        sub.textContent = desc;
        section.appendChild(sub);
    }

    const grid = document.createElement('div');
    grid.className = 'city-action-grid';
    section.appendChild(grid);

    menu.appendChild(section);
    return grid;
}

function addActionCard(grid, { title, desc = "", meta = "", onClick = null, variant = "default", disabled = false }) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `city-action-card ${variant}`;
    card.innerHTML = `
        <span class="city-card-title">${title}</span>
        ${desc ? `<span class="city-card-desc">${desc}</span>` : ""}
        ${meta ? `<span class="city-card-meta">${meta}</span>` : ""}
    `;
    card.disabled = Boolean(disabled);
    if (onClick && !disabled) {
        card.onclick = onClick;
    }
    grid.appendChild(card);
    return card;
}

function renderSubGridMenu(menu, backLabel, backHandler, title, desc = "") {
    menu.innerHTML = '';
    const backBtn = addButton(menu, backLabel, backHandler);
    backBtn.style.borderLeftColor = "var(--color-stamina)";
    const hr = document.createElement('hr');
    hr.style.borderColor = "var(--color-border)";
    menu.appendChild(hr);
    return createActionSection(menu, title, desc);
}

function renderShopGrid(menu, player, location, shopItems, allGameItems) {
    menu.innerHTML = '';
    const backBtn = addButton(menu, "뒤로 (구역 활동 메뉴)", () => player.cb?.showCityLocations(player));
    backBtn.style.borderLeftColor = "var(--color-stamina)";
    const hr = document.createElement('hr');
    hr.style.borderColor = "var(--color-border)";
    menu.appendChild(hr);

    const section = document.createElement('section');
    section.className = 'city-action-section city-shop-section';
    section.innerHTML = `
        <h3 class="city-action-title">상점가</h3>
        <p class="city-action-desc">보유 스톤: ${player.gold.toLocaleString()} | 구매/판매를 카드형 목록에서 선택할 수 있습니다.</p>
    `;
    menu.appendChild(section);

    const layout = document.createElement('div');
    layout.className = 'city-shop-layout';
    section.appendChild(layout);

    const buyWrap = document.createElement('div');
    buyWrap.className = 'city-shop-column';
    buyWrap.innerHTML = `<h4 class="city-shop-column-title">구매 목록</h4>`;
    layout.appendChild(buyWrap);

    const buyGrid = document.createElement('div');
    buyGrid.className = 'city-action-grid city-shop-grid';
    buyWrap.appendChild(buyGrid);

    Object.entries(shopItems)
        .sort((a, b) => (a[1]?.price || 0) - (b[1]?.price || 0))
        .forEach(([itemName, shopItem]) => {
            addActionCard(buyGrid, {
                title: itemName,
                desc: shopItem?.desc || "설명 없음",
                meta: `${(shopItem?.price || 0).toLocaleString()} 스톤`,
                variant: 'buy',
                onClick: () => {
                    const price = shopItem?.price || 0;
                    if (player.gold < price) {
                        logMessage("돈이 부족하다.");
                        return;
                    }
                    player.gold -= price;
                    player.addItem(itemName);
                    logMessage(`${itemName}을(를) 구매했다.`);
                    player.showStatus();
                    renderShopGrid(menu, player, location, shopItems, allGameItems);
                }
            });
        });

    const sellWrap = document.createElement('div');
    sellWrap.className = 'city-shop-column';
    sellWrap.innerHTML = `<h4 class="city-shop-column-title">판매 가능 아이템</h4>`;
    layout.appendChild(sellWrap);

    const sellGrid = document.createElement('div');
    sellGrid.className = 'city-action-grid city-shop-grid';
    sellWrap.appendChild(sellGrid);

    const invCounts = (player.inventory || []).reduce((acc, itemName) => {
        acc[itemName] = (acc[itemName] || 0) + 1;
        return acc;
    }, {});

    const sellable = Object.keys(invCounts).sort((a, b) => a.localeCompare(b, 'ko'));

    if (sellable.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'city-grid-empty';
        empty.textContent = "판매할 아이템이 없습니다.";
        sellWrap.appendChild(empty);
    } else {
        sellable.forEach((itemName) => {
            const count = invCounts[itemName];
            const basePrice = allGameItems[itemName]?.price || allGameItems[itemName]?.tier * 100 || 10;
            const sellPrice = Math.floor(basePrice / 2);
            addActionCard(sellGrid, {
                title: itemName,
                desc: `${count}개 보유`,
                meta: `판매가 ${sellPrice.toLocaleString()} 스톤`,
                variant: 'sell',
                onClick: () => {
                    const idx = player.inventory.indexOf(itemName);
                    if (idx < 0) {
                        logMessage("해당 아이템을 가지고 있지 않다.");
                        return;
                    }
                    player.inventory.splice(idx, 1);
                    player.gold += sellPrice;
                    logMessage(`${itemName}을(를) ${sellPrice.toLocaleString()} 스톤에 판매했다.`);
                    player.cb?.playSfx?.('sfx-event');
                    player.showStatus();
                    renderShopGrid(menu, player, location, shopItems, allGameItems);
                }
            });
        });
    }
}

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
    const cityData = player.cb?.gameData?.cities?.["라프도니아"];
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
        const grid = createActionSection(menu, `${player.position} 활동 장소`, "원하는 장소 카드를 선택하세요.");
        Object.keys(district.locations).forEach(loc => {
            if (district.locations[loc] && district.locations[loc].desc) {
                addActionCard(grid, {
                    title: loc,
                    desc: district.locations[loc].desc,
                    onClick: () => {
                        logMessage(`${loc}(으)로 이동했다.`);
                        handleCityAction(player, loc);
                    }
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
             {
                const grid = createActionSection(menu, "라비기온 중앙 도서관", "지식과 기록을 탐색할 수 있습니다.");
                addActionCard(grid, {
                    title: "사서와 대화",
                    desc: "도서관 사서 라그나에게 정보를 요청합니다.",
                    meta: "대화 / 정보 탐색",
                    onClick: () => {
                        const librarian = npcs["도서관 사서 라그나"];
                        if (librarian && typeof librarian.action === 'function') {
                            librarian.action(player);
                        } else {
                            logMessage("도서관 사서 라그나: 찾는 책이 있나요? (임시 대화)");
                        }
                    }
                });
             }
            break;

        case "환전소":
            {
                const grid = createActionSection(menu, "환전소", "마석을 스톤으로 환전합니다.");
                addActionCard(grid, {
                    title: "마석 전량 환전",
                    desc: "현재 보유한 마석을 전부 스톤으로 교환합니다.",
                    meta: `보유 마석 ${player.magic_stones.toLocaleString()}개`,
                    variant: "buy",
                    onClick: () => {
                        if(player.magic_stones > 0) {
                            const exchangeRate = 20; // (임의: 9등급 20스톤)
                            const earnedStones = player.magic_stones * exchangeRate;
                            player.gold += earnedStones;
                            logMessage(`마석 ${player.magic_stones.toLocaleString()}개를 ${earnedStones.toLocaleString()} 스톤으로 교환했다.`);
                            player.magic_stones = 0;
                            player.cb?.playSfx?.('sfx-event');
                        } else {
                            logMessage("교환할 마석이 없다.");
                        }
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;

        case "탐험가 길드 지부":
             /* AUTO-FIX: added optional chaining ?. for safety (Rule 8); review required */
             player.questManager?.checkProgress('TALK', '탐험가 길드 접수원', 1);
             const guildReceptionist = npcs["탐험가 길드 접수원"];
             logMessage(guildReceptionist ? guildReceptionist.dialog : "무엇을 도와드릴까요?");
            {
                const grid = createActionSection(menu, "탐험가 길드 지부", "길드 업무를 카드에서 선택하세요.");
                addActionCard(grid, {
                    title: "파티원 모집",
                    desc: "등급별 동료를 고용해 파티를 보강합니다.",
                    onClick: () => {
                        logMessage("어떤 등급의 동료를 모집하시겠습니까? (비용이 발생합니다)");
                        const recruitGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (길드 메뉴)",
                            () => handleCityAction(player, location),
                            "동료 모집",
                            "등급이 높을수록 비용이 증가합니다."
                        );
                        const traits = ["전사", "탐색꾼", "인도자", "신관", "마법사"];
                        for (let i = 9; i >= 3; i--) {
                            const cost = (10 - i) * 1000 * (1 + (9 - i) * 0.5);
                            addActionCard(recruitGrid, {
                                title: `${i}등급 동료`,
                                desc: "무작위 성향의 동료를 모집합니다.",
                                meta: `${cost.toLocaleString()} 스톤`,
                                onClick: () => {
                                    if (player.gold < cost) {
                                        logMessage("돈이 부족합니다.");
                                        return;
                                    }
                                    if (player.party.length >= 4) {
                                        logMessage("파티원이 가득 찼습니다. (최대 4명)");
                                        return;
                                    }
                                    if (player.cb?.NPCClass) {
                                        player.gold -= cost;
                                        const randomTrait = traits[Math.floor(Math.random() * traits.length)];
                                        const newCompanion = new player.cb.NPCClass(`동료용병-${player.party.length+1}`, "Human", i, player.cb, randomTrait);
                                        player.party.push(newCompanion);
                                        logMessage(`${newCompanion.name}(${i}등급/${newCompanion.trait})와 파티 결속을 맺었다.`);
                                        player.cb?.playSfx?.('sfx-event');
                                        player.showStatus();
                                        handleCityAction(player, location);
                                    } else {
                                        logMessage("오류: NPC 생성자를 찾을 수 없어 동료를 모집할 수 없습니다.");
                                    }
                                }
                            });
                        }
                    }
                });

                addActionCard(grid, {
                    title: "의뢰 확인",
                    desc: "수락 가능한 길드 퀘스트를 확인합니다.",
                    onClick: () => {
                        const questGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (길드 메뉴)",
                            () => handleCityAction(player, location),
                            "길드 의뢰",
                            "수락 가능한 퀘스트 목록입니다."
                        );
                        logMessage("수락 가능한 의뢰 목록:");
                        let foundQuest = false;
                        const quests = player.cb.gameData?.quests || {};
                        for (const questId in quests) {
                            const quest = quests[questId];
                            if (quest.type === "GUILD" &&
                                !player.questManager.completedQuests.includes(questId) &&
                                !player.questManager.activeQuests.some(q => q.id === questId) &&
                                player.level >= (quest.startCondition?.level || 1))
                            {
                                foundQuest = true;
                                addActionCard(questGrid, {
                                    title: quest.title,
                                    desc: quest.description,
                                    meta: `시작 레벨 ${quest.startCondition?.level || 1}+`,
                                    onClick: () => {
                                        player.questManager.acceptQuest(questId);
                                        handleCityAction(player, location);
                                    }
                                });
                            }
                        }
                        if (!foundQuest) {
                            addActionCard(questGrid, {
                                title: "수락 가능한 의뢰 없음",
                                desc: "현재 조건에 맞는 길드 의뢰가 없습니다.",
                                disabled: true
                            });
                        }
                    }
                });

                addActionCard(grid, {
                    title: "파티 결속 (24시간)",
                    desc: "파티원과의 유대를 강화합니다.",
                    onClick: () => {
                        logMessage("[결속] 마법으로 파티원들과의 유대가 24시간 동안 강화되었습니다.");
                    }
                });
            }
            break;

        case "주점":
            logMessage(npcs["주점 주인"] ? npcs["주점 주인"].dialog : "시원한 맥주 한 잔 어때?");
            {
                const grid = createActionSection(menu, "주점", "탐험가들과 정보를 교환할 수 있습니다.");
                addActionCard(grid, {
                    title: "탐험가와 대화",
                    desc: "랜덤 정보나 팁을 얻습니다.",
                    onClick: () => {
                        const tips = Array.isArray(player.cb.gameData?.companionDialogues) ? player.cb.gameData.companionDialogues : ["정보가 없습니다."];
                        logMessage(`옆 테이블 탐험가: "${tips[Math.floor(Math.random() * tips.length)]}"`);
                    }
                });
            }
            break;

        case "상점가":
            logMessage(npcs["상점 주인"] ? npcs["상점 주인"].dialog : "어서 오세요!");
            renderShopGrid(menu, player, location, shopItems, allGameItems);
            break;

        case "대신전 (삼신교)":
            player.questManager?.checkProgress('TALK', '교단 신관', 1);
            logMessage(npcs["교단 신관"] ? npcs["교단 신관"].dialog : "신의 은총이 함께하길...");
            {
                const grid = createActionSection(menu, "대신전 (삼신교)", "정수 삭제를 진행할 수 있습니다.");
                if(player.essences.length > 0) {
                    logMessage("삭제할 정수를 선택하세요. 삭제 비용은 5,000,000 스톤입니다.");
                    player.essences.forEach((essenceKey, index) => {
                        const cost = 5000000;
                        addActionCard(grid, {
                            title: `${essenceKey} 정수`,
                            desc: "정수 삭제",
                            meta: `${cost.toLocaleString()} 스톤`,
                            variant: 'sell',
                            onClick: () => {
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

                                    player.cb?.playSfx?.('sfx-event');
                                    player.calculateStats();
                                    player.showStatus();
                                    handleCityAction(player, location);
                                }
                            }
                        });
                    });
                } else {
                    addActionCard(grid, {
                        title: "삭제할 정수 없음",
                        desc: "현재 보유 중인 정수가 없습니다.",
                        disabled: true
                    });
                }
            }
            break;

        case "대장간":
            player.questManager?.checkProgress('TALK', '대장장이', 1);
            logMessage(npcs["대장장이"] ? npcs["대장장이"].dialog : "뭘 도와줄까?");
            {
                const grid = createActionSection(menu, "대장간", "장비 수리/제작/강화를 진행합니다.");
                addActionCard(grid, {
                    title: "장비 수리",
                    desc: "모든 장비를 수리합니다.",
                    meta: "100 스톤",
                    onClick: () => {
                        const cost = 100;
                        if (player.gold < cost) {
                            logMessage("수리비가 부족합니다.");
                            return;
                        }
                        player.gold -= cost;
                        logMessage("모든 장비가 완벽하게 수리되었습니다.");
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
                addActionCard(grid, {
                    title: "아이템 제작",
                    desc: "재료를 이용해 아이템을 제작합니다.",
                    onClick: () => logMessage("무엇을 제작하시겠습니까? (제작 시스템 구현 필요)")
                });
                addActionCard(grid, {
                    title: "장비 강화",
                    desc: "장비 성능을 강화합니다.",
                    onClick: () => logMessage("장비 강화는 아직 구현되지 않았습니다.")
                });
            }
            break;

        case "여관":
            player.questManager?.checkProgress('TALK', '여관 주인', 1);
            {
                const innCost = 200;
                logMessage(npcs["여관 주인"] ? npcs["여관 주인"].dialog : `하룻밤에 ${innCost} 스톤입니다.`);
                const grid = createActionSection(menu, "여관", "휴식을 통해 체력과 마력을 회복합니다.");
                addActionCard(grid, {
                    title: "하룻밤 숙박",
                    desc: "HP/MP/기력 완전 회복",
                    meta: `${innCost.toLocaleString()} 스톤`,
                    onClick: () => {
                        if(player.gold < innCost) {
                            logMessage("돈이 부족하여 여관에 묵을 수 없다.");
                            return;
                        }
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
                        player.cb?.playSfx?.('sfx-event');
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
            }
            break;
            
        case "마탑":
            player.questManager?.checkProgress('TALK', '마탑 마법사', 1); // (임의의 NPC 이름)
            logMessage("마법사들의 본거지, 마탑에 들어왔습니다. 지식을 탐구하거나 마법을 배울 수 있습니다.");
            {
                const grid = createActionSection(menu, "마탑", "지식을 탐구하거나 마법을 배울 수 있습니다.");
                addActionCard(grid, {
                    title: "마법 배우기",
                    desc: "보유 스톤으로 새로운 마법을 습득합니다.",
                    onClick: () => {
                        const spellGrid = renderSubGridMenu(
                            menu,
                            "뒤로 (마탑 메뉴)",
                            () => handleCityAction(player, location),
                            "습득 가능한 마법",
                            "카드를 눌러 즉시 습득합니다."
                        );

                        logMessage("배울 수 있는 마법 목록:");
                        let foundSpell = false;
                        for (const spellName in magic) {
                            const spell = magic[spellName];
                            const cost = (10 - (spell.grade || 9)) * 5000 + 1000;
                            if (!player.spells.includes(spellName)) {
                                foundSpell = true;
                                addActionCard(spellGrid, {
                                    title: `[${spell.grade}등급] ${spellName}`,
                                    desc: spell.desc,
                                    meta: `${cost.toLocaleString()} 스톤`,
                                    onClick: () => {
                                        if (player.gold < cost) {
                                            logMessage("마법을 배우기에 스톤이 부족합니다.");
                                            return;
                                        }
                                        player.gold -= cost;
                                        player.learnSpell(spellName);
                                        handleCityAction(player, location);
                                    }
                                });
                            }
                        }
                        if (!foundSpell) {
                            addActionCard(spellGrid, {
                                title: "학습 가능한 마법 없음",
                                desc: "현재 더 배울 수 있는 마법이 없습니다.",
                                disabled: true
                            });
                        }
                    }
                });
                addActionCard(grid, {
                    title: "마법 연구",
                    desc: "마탑 연구실에서 고급 연구를 진행합니다.",
                    onClick: () => logMessage("마법 연구는 아직 구현되지 않았습니다.")
                });
            }
            break;

        case "훈련장":
            logMessage("이능 및 스킬 사용이 허가된 훈련 공간입니다.");
            {
                const grid = createActionSection(menu, "훈련장", "능력 향상을 위한 훈련을 진행합니다.");
                addActionCard(grid, {
                    title: "기본 훈련",
                    desc: "근력/민첩성/지구력/정신력 중 1 상승",
                    meta: "500 스톤 (하루 1회)",
                    onClick: () => {
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
                        const statsToTrain = ["근력", "민첩성", "지구력", "정신력"];
                        const trainedStat = statsToTrain[Math.floor(Math.random() * statsToTrain.length)];
                        player.stats[trainedStat]++;
                        logMessage(`훈련을 통해 [${trainedStat}] 스탯이 1 상승했습니다!`);
                        player.calculateStats();
                        player.showStatus();
                        handleCityAction(player, location);
                    }
                });
                if (player.race === "Human") {
                    addActionCard(grid, {
                        title: "오러 수련",
                        desc: "인간 전용 심화 수련",
                        meta: "1000 스톤",
                        onClick: () => logMessage("오러 수련은 아직 구현되지 않았습니다.")
                    });
                }
            }
            break;

        case "알미너스 중앙 거래소":
            {
                const grid = createActionSection(menu, "알미너스 중앙 거래소", "검색/위탁 판매 기능을 이용할 수 있습니다.");
                addActionCard(grid, {
                    title: "아이템 검색",
                    desc: "시세와 거래 가능 여부를 조회합니다.",
                    meta: "수수료 3,000 스톤",
                    onClick: () => {
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
                            player.showStatus();
                            handleCityAction(player, location);
                        }
                    }
                });
                addActionCard(grid, {
                    title: "아이템 위탁 판매",
                    desc: "거래소에 아이템을 등록합니다.",
                    onClick: () => logMessage("위탁 판매는 아직 구현되지 않았습니다.")
                });
            }
            break;
            
        case "알미너스 은행":
            logMessage(`현재 잔고: ${player.gold.toLocaleString()} 스톤 | 은행 예금: ${player.bankGold.toLocaleString()} 스톤`);
            {
                const grid = createActionSection(menu, "알미너스 은행", "입금과 출금을 카드로 선택합니다.");
                addActionCard(grid, {
                    title: "입금",
                    desc: "소지 스톤을 은행 예금으로 이체",
                    onClick: () => {
                        const amountStr = prompt("입금할 금액을 입력하세요:");
                        const amount = parseInt(amountStr);
                        if (amount > 0 && player.gold >= amount) {
                            player.gold -= amount;
                            player.bankGold += amount;
                            logMessage(`${amount.toLocaleString()} 스톤을 입금했습니다.`);
                            player.showStatus();
                            handleCityAction(player, location);
                        } else if (amount > 0) {
                            logMessage("잔고가 부족합니다.");
                        }
                    }
                });
                addActionCard(grid, {
                    title: "출금",
                    desc: "은행 예금을 소지 스톤으로 인출",
                    onClick: () => {
                        const amountStr = prompt("출금할 금액을 입력하세요:");
                        const amount = parseInt(amountStr);
                        if (amount > 0 && player.bankGold >= amount) {
                            player.bankGold -= amount;
                            player.gold += amount;
                            logMessage(`${amount.toLocaleString()} 스톤을 출금했습니다.`);
                            player.showStatus();
                            handleCityAction(player, location);
                        } else if (amount > 0) {
                            logMessage("예금이 부족합니다.");
                        }
                    }
                });
            }
            break;

        default:
            logMessage("아직 구현되지 않은 장소입니다.");
    }
    
    // [제거] "뒤로" 버튼을 맨 위로 옮겼기 때문에 하단에서는 제거
    // addButton(menu, "뒤로 (구역 활동 메뉴)", () => player.cb?.showCityLocations(player));
    updateStatusBars(player);
}
