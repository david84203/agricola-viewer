const fs = require('fs');
const path = require('path');

const waMinors = [
  { "卡片ID": "WA027", "牌名": "第六感學院", "card_type": "minor", "類別": "次要發展卡", "先決條件": "1張職業卡", "費用": "2食物", "是否傳遞": "否", "勝利點數": "2", "紅利分數": "無", "牌組": "WA", "說明": "在每個回合的返家階段，若下列6種貨物在你的個人供應區中，你只有恰好1種的數量為0個，你從供應區獲得1份該貨物。下列6種貨物中，若你恰好只有1份該貨物，你無法將其轉換為食物。", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 0 },
  { "卡片ID": "WA005", "牌名": "啤酒博物館", "card_type": "minor", "類別": "次要發展卡", "先決條件": "2塊麥田", "費用": "2木+2磚", "是否傳遞": "否", "勝利點數": "2", "紅利分數": "無", "牌組": "WA", "說明": "在每個收成階段的餵養階段，你可以使用此卡將1份麥子轉換成6份食物，但你在下個收成階段的收割階段才會獲得這6份食物。", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 0 },
  { "卡片ID": "WA006", "牌名": "啤酒大廳", "card_type": "minor", "類別": "次要發展卡", "先決條件": "無", "費用": "2磚", "是否傳遞": "否", "勝利點數": "2", "紅利分數": "無", "牌組": "WA", "說明": "當你打出此卡，你獲得1份麥子。在每個返家階段開始時，若你所有的人員皆派遣到同1個遊戲版圖上，你可以使用此卡將1份麥子轉換為3份食物。", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 0 },
  { "卡片ID": "WA012", "牌名": "鑄鐵烤爐", "card_type": "minor", "類別": "次要發展卡", "先決條件": "無", "費用": "3磚", "是否傳遞": "否", "勝利點數": "2", "紅利分數": "無", "牌組": "WA", "說明": "每當你使用「烤麵包」行動或你打出1張職業卡後，你可以使用此烤爐將1份麥子轉換為4份食物。", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 1 },
  { "卡片ID": "WA014", "牌名": "貓舌餅乾", "card_type": "minor", "類別": "次要發展卡", "先決條件": "無", "費用": "1食物", "是否傳遞": "否", "勝利點數": "1", "紅利分數": "無", "牌組": "WA", "說明": "每當你在工作階段中執行「增加家庭成員」行動時，你獲得1個食客且可以立即派遣去使用「釣魚」累積行動格。(若「釣魚」累積行動格已被佔據則無法派遣食客)", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 1 },
  { "卡片ID": "WA018", "牌名": "修道院廢墟", "card_type": "minor", "類別": "次要發展卡", "先決條件": "無", "費用": "5食物", "是否傳遞": "否", "勝利點數": "1", "紅利分數": "無", "牌組": "WA", "說明": "在接下來的每個回合行動格上各擺上1份食物。你在這些回合開始時，領取該格上的食物。", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 1 },
  { "卡片ID": "WA017", "牌名": "灰色腦細胞", "card_type": "minor", "類別": "次要發展卡", "先決條件": "無", "費用": "無", "是否傳遞": "是", "勝利點數": "無", "紅利分數": "無", "牌組": "WA", "說明": "打出此卡時，你面前每有1張未使用過其功能的次要發展卡你獲得1根木頭。在你打出此卡後，將其傳給你左手邊的玩家，加入他的手牌中。", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 2 },
  { "卡片ID": "WA010", "牌名": "弗朗基椿", "card_type": "minor", "類別": "次要發展卡", "先決條件": "2張職業卡", "費用": "無", "是否傳遞": "否", "勝利點數": "無", "紅利分數": "無", "牌組": "WA", "說明": "在你農莊中任意數量的未使用區域上，從供應區各擺上1顆石頭。這些區域仍視為未使用區域，你只能在這些區域上擴建房舍。每當你在這些區域上擴建房舍，每間房舍可以減少支付1份任意資源，接著你可以將該區域上的石頭放入你的個人供應區。", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 2 },
  { "卡片ID": "WA013", "牌名": "理想景觀", "card_type": "minor", "類別": "次要發展卡", "先決條件": "至少8個未使用區域", "費用": "無", "是否傳遞": "否", "勝利點數": "-1", "紅利分數": "4", "牌組": "WA", "說明": "遊戲結束計分時，若你的農莊中有恰好占地6格的4個圈地、5塊農田板塊和4間房舍。你獲得4分紅利分數。", "source_image": "wa01.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 2 },
  { "卡片ID": "WA029", "牌名": "廣場噴水池", "card_type": "minor", "類別": "次要發展卡", "先決條件": "無", "費用": "3石", "是否傳遞": "否", "勝利點數": "3", "紅利分數": "無", "牌組": "WA", "說明": "在接下來的6個回合行動格上各擺上1份食物。你在這些回合開始時，領取該格上的食物。此卡視為1個井", "source_image": "wa02.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 0 },
  { "卡片ID": "WA023", "牌名": "朝聖地", "card_type": "minor", "類別": "次要發展卡", "先決條件": "已打出的發展卡牌面分數總和至少3分", "費用": "無", "是否傳遞": "否", "勝利點數": "無", "紅利分數": "無", "牌組": "WA", "說明": "此卡視為1個所有玩家皆可使用的額外行動格。其他玩家使用此行動格必須支付你1份麥子來獲得1份蔬菜、1顆石頭和1分紅利分數。若你自己使用此行動格，改為支付1份麥子到供應區使用此效果。", "source_image": "wa02.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 0 },
  { "卡片ID": "WA030", "牌名": "河港", "card_type": "minor", "類別": "次要發展卡", "先決條件": "無", "費用": "1食物", "是否傳遞": "否", "勝利點數": "1", "紅利分數": "無", "牌組": "WA", "說明": "在每個工作階段開始時，檢查有最多單一貨物的行動格。你可以支付1份食物從供應區購買1份該貨物。若有2格以上最多單一貨物的行動格。你選擇其中1種貨物購買。", "source_image": "wa02.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 0 }
];

const cardsFile = path.join(__dirname, 'cards.json');
let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

let added = 0;
let updated = 0;
waMinors.forEach(newCard => {
  const existingIndex = cards.findIndex(c => c['卡片ID'] === newCard['卡片ID']);
  if (existingIndex !== -1) {
    cards[existingIndex] = { ...cards[existingIndex], ...newCard };
    updated++;
  } else {
    cards.push(newCard);
    added++;
  }
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log(`Successfully processed ${waMinors.length} minor cards. Added ${added} new cards. Updated ${updated} cards.`);
