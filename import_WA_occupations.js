const fs = require('fs');
const path = require('path');

const waOccupations = [
  { "卡片ID": "WA038", "牌名": "針織工藝教師", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "WA", "說明": "每當任何玩家使用「起始玩家」行動格時，若你有至少2位人員(包含食客)在你家尚未派遣，你獲得2份食物。", "source_image": "WA1.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 0 },
  { "卡片ID": "WA034", "牌名": "聽話的兄弟", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "WA", "說明": "一旦你有恰好4位家庭成員(不包含食客)，每當你派遣你的第3位人員後，你可以立即派遣你的第4位人員，即便是派遣到同1個行動格。", "source_image": "WA1.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 0 },
  { "卡片ID": "WA042", "牌名": "風景畫家", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "WA", "說明": "每回合奇數回合開始時，若你農莊正中間的3格空間為未使用空間，你獲得1份食物。(正中間3格為被8格空間環繞的橫向3格空間)", "source_image": "WA1.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 0 },
  { "卡片ID": "WA045", "牌名": "歌曲創作者", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "WA", "說明": "從供應區放3份食物和1份麥子在此卡上。每當其他玩家第1/2/3次使用「賣藝」累積行動格，你從此卡上獲得1份食物/1份麥子/2份食物。當此卡上的貨物被拿光後，每當其他玩家使用「賣藝」累積行動格，你獲得1份蔬菜。", "source_image": "WA1.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 1 },
  { "卡片ID": "WA055", "牌名": "街頭歌手", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "WA", "說明": "每當你派遣人員使用「賣藝」累積行動格，你可以立即派遣第2位人員到同1個行動格上。(你的第2位人員並未使用「賣藝」累積行動格)若你這麼做，你獲得2份麥子和1份蔬菜。", "source_image": "WA1.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 1 },
  { "卡片ID": "WA056", "牌名": "超現實主義者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "WA", "說明": "對你而言，每份蘆葦和食物視為1點，木頭視為2點，磚頭視為3點，石頭視為4點。每當你執行「打1張主要發展卡」行動，你可以花費至少9點來取代正常費用購買任意1張下排的主要發展卡。", "source_image": "WA1.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 1 },
  { "卡片ID": "WA057", "牌名": "修補匠", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "WA", "說明": "此卡視為1個只有你可以使用的行動格。你只能在工作階段中派遣你的第1位人員來使用此行動格。每當你使用此行動格，你獲得4種建築資源各1份。", "source_image": "WA1.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 2 },
  { "卡片ID": "WA051", "牌名": "旅遊經紀人", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "WA", "說明": "將1份麥子、1根木頭、1塊磚頭、1綑蘆葦和1隻羊放在此卡上。每當任何玩家使用「起始玩家」行動格前，你可以從此卡上拿取任意1份貨物。", "source_image": "WA1.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 2 },
  { "卡片ID": "WA049", "牌名": "家庭看護", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "WA", "說明": "在第12、13、14回合，你不能派遣前2位人員使用第12、13、14回合的行動格。你在第12、13、14回合皆可以額外派遣1名食客。", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 0 },
  { "卡片ID": "WA033", "牌名": "碼頭工人", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "WA", "說明": "在每回合的工作階段開始時，你可以獲得1份任意建築資源。若你選擇獲得蘆葦或石頭，你跳過第1次派遣人員的行動；若你選擇獲得木頭或磚頭，你跳過第2次派遣人員的行動。(你之後仍可派遣被跳過的人員)", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 0 },
  { "卡片ID": "WA036", "牌名": "陪產婦", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "WA", "說明": "若你未曾增加家庭成員，當其他玩家增加家庭成員時，你可以從供應區獲得1份麥子。", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 0 },
  { "卡片ID": "WA037", "牌名": "創始之父", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "WA", "說明": "每當其他玩家派遣人員使用「賣藝」累積行動格，你可以從你的個人供應區將1棟馬廄放在此卡上。每當你打出1張發展卡時，你可以免費建造1棟此卡上的馬廄。", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 1 },
  { "卡片ID": "WA035", "牌名": "壁畫家", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "WA", "說明": "每當你翻修時，你可以用1顆石頭取代1綑蘆葦。每當你擴建每間房舍時，你可以用2顆石頭取代2綑蘆葦(不能只用1顆石頭取代1綑蘆葦)。每綑被石頭取代的蘆葦讓你獲得2份食物。", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 1 },
  { "卡片ID": "WA059", "牌名": "德國明星", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "有", "牌組": "WA", "說明": "遊戲結束計分時，若你所有的農田板塊形成矩形或正方形，圈地也形成矩形或正方形，你獲得3分紅利分數。(如3x2的大小或1x3的大小)", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 1 },
  { "卡片ID": "WA054", "牌名": "商品詐欺師", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "WA", "說明": "從供應區將2根木頭、2塊磚頭、1顆石頭和1綑蘆葦放到此卡上。你可以用此卡上的建築資源支付打出卡片的費用或支付卡片效應的費用。在下1個收成階段結束時，此卡上每有1個建築資源，你領取1張乞討卡。", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 0, "grid_row": 2 },
  { "卡片ID": "WA039", "牌名": "軍事領袖", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "有", "牌組": "WA", "說明": "你只能在第12回合或之前打出此卡。當你打出此卡後，你不能在第13和第14回合派遣你的人員，你不會進入第13和第14回合的收成階段。遊戲結束計分時，你獲得13分紅利分數。", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 1, "grid_row": 2 },
  { "卡片ID": "WA060", "牌名": "兩個孩子的媽", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "WA", "說明": "若你有恰好4位家庭成員(不包含食客)，每當你在工作階段派遣你的第2位家庭成員，你可以將其派遣至第1到第7回合的兩張直角相鄰且未被佔據的回合行動卡上。若你這麼做，你可以決定使用行動卡的順序。在此之後，該2格行動格皆視為已被佔據。", "source_image": "WA2.jpg", "grid_cols": 3, "grid_rows": 3, "grid_col": 2, "grid_row": 2 }
];

const cardsFile = path.join(__dirname, 'cards.json');
let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

let added = 0;
let updated = 0;
waOccupations.forEach(newCard => {
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
console.log(`Successfully processed ${waOccupations.length} occupation cards. Added ${added} new cards. Updated ${updated} cards.`);
