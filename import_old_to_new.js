const fs = require('fs');
const path = require('path');

const cardsFile = path.join(__dirname, 'cards.json');
let cards = [];
try {
  cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));
} catch (err) {
  console.error("Error reading cards.json", err);
  process.exit(1);
}

const minors = [
  {
    "卡片ID": "D075*", "牌名": "灌木林", "類別": "次要發展卡", "先決條件": "1張職業卡", "費用": "1根木頭", "是否傳遞": "否", "勝利點數": "1", "紅利分數": "無", "牌組": "D", "說明": "你可以使用此卡種植2份木頭，且將此卡視為1塊農田。播種和收成的方式如同麥子。(遊戲結束時，此卡不視為1塊農田進入計分。)", "card_type": "minor", "source_image": "舊版改新.jpg", "position": 0, "grid_col": 0, "grid_row": 0
  },
  {
    "卡片ID": "D078*", "牌名": "蘆葦池", "類別": "次要發展卡", "先決條件": "3張職業卡", "費用": "無", "是否傳遞": "否", "勝利點數": "無", "紅利分數": "無", "牌組": "D", "說明": "在接下來3個回合的行動格上，各擺1捆蘆葦。在這些回合開始時，領取該格上的蘆葦。", "card_type": "minor", "source_image": "舊版改新.jpg", "position": 1, "grid_col": 1, "grid_row": 0
  },
  {
    "卡片ID": "C026*", "牌名": "連枷", "類別": "次要發展卡", "先決條件": "無", "費用": "1份食物", "是否傳遞": "否", "勝利點數": "無", "紅利分數": "無", "牌組": "C", "說明": "當你打出此卡時立刻獲得2份食物。每次你使用『犁1塊農田』或是『犁1塊農田和/或播種』行動格時，你可以同時執行1次『烤麵包』行動。", "card_type": "minor", "source_image": "舊版改新.jpg", "position": 2, "grid_col": 2, "grid_row": 0
  },
  {
    "卡片ID": "C076*", "牌名": "木頭推車", "類別": "次要發展卡", "先決條件": "3張職業卡", "費用": "3根木頭", "是否傳遞": "否", "勝利點數": "無", "紅利分數": "無", "牌組": "C", "說明": "每次你以家庭成員執行行動，取得木頭累積格上的木頭時，你獲得額外的2根木頭。", "card_type": "minor", "source_image": "舊版改新.jpg", "position": 3, "grid_col": 0, "grid_row": 1
  },
  {
    "卡片ID": "C074*", "牌名": "私有林區", "類別": "次要發展卡", "先決條件": "1張職業卡", "費用": "2份食物", "是否傳遞": "否", "勝利點數": "無", "紅利分數": "無", "牌組": "C", "說明": "在之後的每個偶數回合行動格上，各擺1根木頭。在這些回合開始時領取該格上的木頭。", "card_type": "minor", "source_image": "舊版改新.jpg", "position": 4, "grid_col": 1, "grid_row": 1
  },
  {
    "卡片ID": "D084*", "牌名": "飼料丸", "類別": "次要發展卡", "先決條件": "無", "費用": "無", "是否傳遞": "否", "勝利點數": "無", "紅利分數": "無", "牌組": "D", "說明": "當你打出此卡時立刻獲得1隻羊。在你的收成階段，餵養你的家庭成員時，你可以選擇棄掉1份蔬菜；若你如此做，則你獲得1隻你的農莊中已經有的種類的動物。", "card_type": "minor", "source_image": "舊版改新.jpg", "position": 5, "grid_col": 2, "grid_row": 1
  },
  {
    "卡片ID": "D012*", "牌名": "擠奶場所", "類別": "次要發展卡", "先決條件": "無", "費用": "1份麥子", "是否傳遞": "否", "勝利點數": "1", "紅利分數": "無", "牌組": "D", "說明": "在你的每個收成階段的餵養階段，你獲得1份食物。你將無法在你的房舍中飼養任何動物作為寵物。(即使你有『訓養員』，此卡效應依然有效。)", "card_type": "minor", "source_image": "舊版改新.jpg", "position": 7, "grid_col": 1, "grid_row": 2
  }
];

const occs = [
  {
    "卡片ID": "A093*", "牌名": "製床師", "類別": "職業卡", "需求人數": "1+", "紅利分數": "無", "牌組": "A", "說明": "每當你在你的房舍中增加居住空間時，你可以支付1根木頭和1份麥子立即獲得『增加家庭成員』行動。", "card_type": "occ", "source_image": "舊版改新2.jpg", "position": 0, "grid_col": 0, "grid_row": 0
  },
  {
    "卡片ID": "C089*", "牌名": "馬廄工頭", "類別": "職業卡", "需求人數": "1+", "紅利分數": "無", "牌組": "C", "說明": "當你打出此卡時，你可以立刻以1根木頭建造剛好1棟馬廄。你的恰好1棟圈地外馬廄可以居住至多3隻同種類的動物。", "card_type": "occ", "source_image": "舊版改新2.jpg", "position": 2, "grid_col": 2, "grid_row": 0
  },
  {
    "卡片ID": "C152*", "牌名": "偶戲師", "類別": "職業卡", "需求人數": "4+", "紅利分數": "無", "牌組": "C", "說明": "每當有其他玩家執行「賣藝」行動格時，你可以選擇支付他1份食物；若你如此做，則你可以打1張職業卡。", "card_type": "occ", "source_image": "舊版改新2.jpg", "position": 3, "grid_col": 0, "grid_row": 1
  },
  {
    "卡片ID": "C166*", "牌名": "召牛人", "類別": "職業卡", "需求人數": "4+", "紅利分數": "無", "牌組": "C", "說明": "將目前的回合數加上5與8，並在此兩回合的行動格中，各擺1頭牛。在這些回合開始時，領取該格上的牛。", "card_type": "occ", "source_image": "舊版改新2.jpg", "position": 4, "grid_col": 1, "grid_row": 1
  },
  {
    "卡片ID": "C135*", "牌名": "總管", "類別": "職業卡", "需求人數": "3+", "紅利分數": "有", "牌組": "C", "說明": "在你打出此卡時，若遊戲尚有1/3/6/9回合，則你獲得1/2/3/4根木頭。在遊戲結束時，所有未承受任何扣分的玩家獲得3點紅利分數。", "card_type": "occ", "source_image": "舊版改新2.jpg", "position": 5, "grid_col": 2, "grid_row": 1
  },
  {
    "卡片ID": "D162*", "牌名": "燒磚工", "類別": "職業卡", "需求人數": "4+", "紅利分數": "無", "牌組": "D", "說明": "當你打出此卡時，你立刻獲得2塊磚頭。在任何時候，你皆可以將2/3/4塊磚頭，轉換成1/2/3顆石頭。", "card_type": "occ", "source_image": "舊版改新2.jpg", "position": 6, "grid_col": 0, "grid_row": 2
  },
  {
    "卡片ID": "C098*", "牌名": "立方塊雕刻員", "類別": "職業卡", "需求人數": "1+", "紅利分數": "有", "牌組": "C", "說明": "當你打出此卡時，你立刻獲得1根木頭。在你的收成階段，收割作物時，你可以支付至多1根木頭與1份食物；若你如此做，則你獲得1點紅利分數。", "card_type": "occ", "source_image": "舊版改新2.jpg", "position": 7, "grid_col": 1, "grid_row": 2
  }
];

const newCards = [...minors, ...occs];
let added = 0;
let updated = 0;

newCards.forEach(newCard => {
  const idx = cards.findIndex(c => c["卡片ID"] === newCard["卡片ID"]);
  if (idx !== -1) {
    cards[idx] = newCard;
    updated++;
  } else {
    cards.push(newCard);
    added++;
  }
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log(`Successfully added ${added} cards and updated ${updated} cards.`);
