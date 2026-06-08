const fs = require('fs');

const frMinors = [
  {
    "卡片ID": "FR039",
    "牌名": "騎馬狩獵",
    "類型": "次要發展卡",
    "先決條件": "無",
    "費用": "無",
    "是否傳遞": "否",
    "勝利點數": "2分",
    "紅利分數": "無",
    "牌組": "FR",
    "說明": "在目前回合數加上4和7，並於對應的回合數上各從遊戲供應區擺上1頭野豬。這些回合開始時，你可支付1份食物獲得1隻野豬。",
    "card_type": "minor",
    "grid_cols": 3,
    "grid_rows": 3,
    "source_image": "Wmm7.jpg",
    "grid_row": 0,
    "grid_col": 1
  },
  {
    "卡片ID": "FR049",
    "牌名": "勒阿弗爾港口",
    "類型": "次要發展卡",
    "先決條件": "1張烤爐",
    "費用": "無",
    "是否傳遞": "否",
    "勝利點數": "無",
    "紅利分數": "無",
    "牌組": "FR",
    "說明": "每當你執行「烤麵包」行動時，你可以將1/2個磚頭轉換成1/2個石頭。",
    "card_type": "minor",
    "grid_cols": 3,
    "grid_rows": 3,
    "source_image": "Wmm7.jpg",
    "grid_row": 0,
    "grid_col": 2
  },
  {
    "卡片ID": "FR059",
    "牌名": "巫女躍動之界",
    "類型": "次要發展卡",
    "先決條件": "3張職業卡",
    "費用": "無",
    "是否傳遞": "否",
    "勝利點數": "無",
    "紅利分數": "有",
    "牌組": "FR",
    "說明": "你可以選擇將此卡放置在你農場版圖邊界，此卡將與圖板相接並視為兩塊空地，你獲得1分紅利分數。或者放在農場兩塊相鄰的未使用空地上，它們從此不視作你農場的一部分。",
    "card_type": "minor",
    "grid_cols": 3,
    "grid_rows": 3,
    "source_image": "Wmm7.jpg",
    "grid_row": 1,
    "grid_col": 1
  },
  {
    "卡片ID": "FR032",
    "牌名": "家庭作業",
    "類型": "次要發展卡",
    "先決條件": "無",
    "費用": "2食物",
    "是否傳遞": "否",
    "勝利點數": "2分",
    "紅利分數": "無",
    "牌組": "FR",
    "說明": "打出此卡時，立刻再打出至多兩張職業卡。(你仍須支付職業卡上的額外費用)",
    "card_type": "minor",
    "grid_cols": 3,
    "grid_rows": 3,
    "source_image": "Wmm7.jpg",
    "grid_row": 1,
    "grid_col": 2
  },
  {
    "卡片ID": "FR036",
    "牌名": "沼澤",
    "類型": "次要發展卡",
    "先決條件": "無",
    "費用": "無",
    "是否傳遞": "否",
    "勝利點數": "無",
    "紅利分數": "無",
    "牌組": "FR",
    "說明": "打出此卡時，可以立刻退還不同的2隻動物犁2塊農田。",
    "card_type": "minor",
    "grid_cols": 3,
    "grid_rows": 3,
    "source_image": "Wmm7.jpg",
    "grid_row": 2,
    "grid_col": 2
  }
];

const cardsJson = JSON.parse(fs.readFileSync('./cards.json', 'utf8'));

frMinors.forEach(card => {
  const existsIndex = cardsJson.findIndex(c => c["卡片ID"] === card["卡片ID"]);
  if (existsIndex >= 0) {
    cardsJson[existsIndex] = card;
  } else {
    cardsJson.push(card);
  }
});

fs.writeFileSync('./cards.json', JSON.stringify(cardsJson, null, 2), 'utf8');
console.log(`Successfully imported ${frMinors.length} FR cards.`);
