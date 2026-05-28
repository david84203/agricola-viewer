const fs = require('fs');

const rawCards = [
  // C106
  { id: "C134", name: "牛王子", type: "occ", players: "3+", pass: "否", bonus: "無", deck: "C", desc: "遊戲結束計分時，你農莊中的每個飼養至少1頭牛的空間(包含房間)，讓你獲得1分。", img: "C106.jpg" },
  { id: "C132", name: "木瓦製造商", type: "occ", players: "3+", pass: "否", bonus: "無", deck: "C", desc: "當你翻修成石屋，你可以從你的個人供應區，在你的每間房間各放上1根木頭。遊戲結束計分時，房間上的每根木頭讓你獲得1分。", img: "C106.jpg" },
  { id: "C131", name: "私人教師", type: "occ", players: "3+", pass: "否", bonus: "無", deck: "C", desc: "你每次使用「1份小麥」行動格時，若任何「打1張職業卡」行動格已被佔據，你可以支付1份食物打1張職業卡。", img: "C106.jpg" },
  { id: "C125", name: "夜班工人", type: "occ", players: "1+", pass: "否", bonus: "無", deck: "C", desc: "在每個工作階段開始前，你可以派遣1位人員到1個建築資源的累積行動格，該建築資源必須是你的個人供應區沒有的類型。", img: "C106.jpg" },
  { id: "C094", name: "馬廄清掃工", type: "occ", players: "1+", pass: "否", bonus: "無", deck: "C", desc: "在任何時候，你可以執行「建造馬廄」行動而不需派遣人員。若你這麼做，每間馬廄的建造費用你必須支付1根木頭和1份食物。", img: "C106.jpg" },

  // Cz101
  { id: "Cz08", name: "風笛手", type: "occ", players: "3+", pass: "否", bonus: "無", deck: "Cz", desc: "你立即獲得2份食物。你可以將使用「打1張職業卡」行動格打出此卡的家庭成員返回家裡，並視為當回合你尚未派遣該家庭成員。(你可以在下1次輪到你的回合行動再次派遣該家庭成員)", img: "Cz101.jpg" },
  { id: "Cz07", name: "官員", type: "occ", players: "4+", pass: "否", bonus: "無", deck: "Cz", desc: "從你的個人供應區放3份食物在此卡上。每回合1次，你可以支付此卡上的1份食物來派遣1名人員到1個恰好只被1名人員佔據的行動格上。(不論是你或是其他玩家所佔據)(你可以在任何時候將此卡上的食物拿回你的個人供應區)", img: "Cz101.jpg" },
  { id: "Cz05", name: "英雄", type: "occ", players: "1+", pass: "否", bonus: "無", deck: "Cz", desc: "你立即獲得3份食物。遊戲中1次，你可以棄掉1頭野豬來立即執行「增加家庭成員」行動且不須派遣家庭成員。你必須有居住空間讓該家庭成員可以居住。(若為在收成階段的餵養階段後的新生兒，下1回合仍視為新生兒不能派遣)", img: "Cz101.jpg" },
  { id: "Cz09", name: "獨生子", type: "occ", players: "3+", pass: "否", bonus: "有", deck: "Cz", desc: "若遊戲尚有3/6/9個回合未開始進行，你立即獲得1/2/3根木頭。遊戲結束計分時，若你只有恰好3位家庭成員，你獲得3分紅利分數。(食客標記不視為家庭成員)", img: "Cz101.jpg" },
  { id: "Cz11", name: "強盜", type: "occ", players: "4+", pass: "否", bonus: "無", deck: "Cz", desc: "每回合1次，輪到你的回合輪次時，你可以跳過1次派遣家庭成員的機會。若你這麼做，你可以從供應區獲得1根木頭或1份食物。你只能在至少有1位玩家還有至少1位成員尚未派遣時跳過1次派遣家庭成員的機會。", img: "Cz101.jpg" },
  { id: "Cz12", name: "聖尼古拉斯", type: "occ", players: "3+", pass: "否", bonus: "無", deck: "Cz", desc: "計算遊戲開始後已生出的家庭成員數量，你立即獲得相同數量的食物(最多6份)。(包含成人家成員和新生兒)所有玩家中，每位家庭成員最少的玩家立即獲得1份蔬菜。", img: "Cz101.jpg" },
  { id: "Cz10", name: "告密者", type: "occ", players: "1+", pass: "否", bonus: "無", deck: "Cz", desc: "立即將1張你已打出的職業卡覆蓋，接著你可以選擇獲得5份食物或1頭牛。你將失去所有被覆蓋的職業卡的效果。(該職業卡仍被視為已打出的1張職業卡)", img: "Cz101.jpg" },
  { id: "Cz04", name: "國家教師", type: "occ", players: "4+", pass: "否", bonus: "無", deck: "Cz", desc: "當所有玩家在打出1張職業卡時，都可以少支付1份食物。若其他玩家少支付1份食物，你從供應區獲得1份食物。", img: "Cz101.jpg" },
  { id: "Cz02", name: "週末工作者", type: "occ", players: "1+", pass: "否", bonus: "無", deck: "Cz", desc: "每當你翻修房舍後，你可以擴建1間房舍，你需要支付1綑蘆葦、1份翻修前房舍等級的建築資源(木頭或磚頭)和2份翻修後房舍等級的資源(磚頭或石頭)。", img: "Cz101.jpg" },

  // Cz02
  { id: "Cz19", name: "酒窖", type: "minor", req: "無", cost: "1棟圈地外馬廄", pass: "否", points: "2", bonus: "無", deck: "Cz", desc: "立即將1棟圈地外馬廄翻倒，該馬廄視為1個酒窖且不視為1棟馬廄。你無法在該酒窖內飼養動物。在每個收成階段的餵養階段，你獲得2份食物。酒窖所在的區域視為已使用區域，你可以在該區域柵欄且視為圈地。", img: "Cz02.jpg" }
];

let existingCards = [];
try {
  existingCards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
} catch (e) {
  console.error("Error reading cards.json", e);
}

const existingIds = new Set(existingCards.map(c => c['卡片ID']));

let addedCount = 0;
for (const card of rawCards) {
  if (!existingIds.has(card.id)) {
    let newCard;
    if (card.type === 'occ') {
      newCard = {
        "牌名": card.name,
        "類型": "職業卡",
        "人數": card.players,
        "是否傳遞": card.pass,
        "紅利分數": card.bonus,
        "牌組": card.deck,
        "卡片ID": card.id,
        "說明": card.desc,
        "card_type": "occupation",
        "source_image": card.img
      };
    } else if (card.type === 'minor') {
      newCard = {
        "牌名": card.name,
        "類型": "次要發展卡",
        "先決條件": card.req,
        "費用": card.cost,
        "是否傳遞": card.pass,
        "勝利點數": card.points,
        "紅利分數": card.bonus,
        "牌組": card.deck,
        "卡片ID": card.id,
        "說明": card.desc,
        "card_type": "minor",
        "source_image": card.img
      };
    }
    existingCards.push(newCard);
    addedCount++;
  } else {
    console.log(`Card ${card.id} already exists. Skipping.`);
  }
}

fs.writeFileSync('cards.json', JSON.stringify(existingCards, null, 2));
console.log(`Added ${addedCount} new cards. Total cards: ${existingCards.length}`);
