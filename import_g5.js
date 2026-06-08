const fs = require('fs');

const draftPath = "C:\\Users\\bboylu\\.gemini\\antigravity\\brain\\d83e9263-c468-4d3e-a9f4-014d95662753\\artifacts\\g5_cards_draft.md";
let md = fs.readFileSync(draftPath, 'utf8');

// Replacements
md = md.replace('6163-5 | 煉金術士的實驗室 | 次要發展卡 | 3張職業卡 | 無 | 否 | 1 | 無 | G5', '6163-5 | 煉金術士的實驗室 | 次要發展卡 | 3張職業卡 | 無 | 否 | 有 | 無 | G5');
md = md.replace('6482-2 | 迴廊 | 次要發展卡 | 無 | 2石+1蘆葦 | 否 | 無 | 1 | G5', '6482-2 | 迴廊 | 次要發展卡 | 無 | 2石+1蘆葦 | 否 | 無 | 有 | G5');
md = md.replace('1鐵? (灰黑色橢圓圖示)', '1石');
md = md.replace('267-7 | 煮鍋 | 次要發展卡 | 1張煮鍋符號發展卡 | 1鐵?', '267-7 | 煮鍋 | 次要發展卡 | 1張煮鍋符號發展卡 | 1石');
md = md.replace('叫賣版的推車', '叫賣販的推車');
md = md.replace('5242-3 | 糧袋 | 次要發展卡 | 無 | 1布? (灰白色)', '5242-3 | 糧袋 | 次要發展卡 | 無 | 1蘆葦');
md = md.replace('5511-6 | 釘籃 | 次要發展卡 | 無 | 1布? (灰白色)', '5511-6 | 釘籃 | 次要發展卡 | 無 | 1蘆葦');
md = md.replace('5197-3 | 生麵團 | 次要發展卡 | 無 | 1麥', '5197-3 | 生麵團 | 次要發展卡 | 無 | 1食物');
md = md.replace('3492-7 | 農場名稱標誌 | 次要發展卡 | 無 | 1木 | 否 | 無 | 2 | G5', '3492-7 | 農場名稱標誌 | 次要發展卡 | 無 | 1木 | 否 | 無 | 有 | G5');
md = md.replace('每當你使用「拿1份麥子」行動格時，你每有1張[烤麵包符號]發展卡，你額外獲得1份麥子。', '每當你使用「拿1份麥子」行動格時，你每有1張烤麵包符號發展卡，你額外獲得1份麥子。');
md = md.replace('6600-3 | 鐵製烤爐 | 次要發展卡 | 無 | 3鐵?', '6600-3 | 鐵製烤爐 | 次要發展卡 | 無 | 3石頭');
md = md.replace(' | 2 | 無 | G5 | 每當你執行「烤麵包」行動時：-1麥 -> 6食物。打出此卡時，可以立即執行1次「烤麵包」行動。', ' | 有 | 無 | G5 | 每當你執行「烤麵包」行動時：1麥 -> 6食物。打出此卡時，可以立即執行1次「烤麵包」行動。');
md = md.replace('6447-7 | 益生菌食物 | 次要發展卡 | 無 | 2麥', '6447-7 | 益生菌食物 | 次要發展卡 | 無 | 2食物');
md = md.replace('3838-3 | 鐵鍬 | 次要發展卡 | 無 | 1鐵?', '3838-3 | 鐵鍬 | 次要發展卡 | 無 | 1木');
md = md.replace('5093-4 | 石斧 | 次要發展卡 | 2張職業卡 | 1木+1石', '5093-4 | 石斧 | 次要發展卡 | 2張職業卡 | 1木+1磚');
md = md.replace('4637-7 | 茶 | 次要發展卡 | 家庭成員在「播種和/或烤麵包」行動格上 | 1麥', '4637-7 | 茶 | 次要發展卡 | 家庭成員在「播種和/或烤麵包」行動格上 | 1食物');
md = md.replace('5169-4 | 丁字鋤 | 次要發展卡 | 無 | 1石/鐵?', '5169-4 | 丁字鋤 | 次要發展卡 | 無 | 1石');
md = md.replace('786-8 | 許願井 | 次要發展卡 | 退還主發井 | 1木/石?', '786-8 | 許願井 | 次要發展卡 | 退還主發井 | 1石');
md = md.replace('6217-4 | 安慰獎 | 次要發展卡 | 無 | 1麥', '6217-4 | 安慰獎 | 次要發展卡 | 無 | 1食物');
md = md.replace('6237-8 | 資源交易員 | 職業卡 | 1+ | 無 | G5', '6237-8 | 資源交易員 | 職業卡 | 1+ | 有 | G5');
md = md.replace('(由上到下疊放: 木、磚、石、蘆葦、木、磚、石)', '(由下到上疊放: 石、磚、石、蘆葦、木、磚)');
md = md.replace('(由上到下疊放: 麥子, 磚頭?, 木頭, 野豬, 羊, 牛, 麵包?)', '(由下到上疊放: 磚、木、麥)');

let lines = md.split('\n').map(l => l.trim());
let currentImage = '';
let parsedCards = [];

for (let line of lines) {
  if (line.startsWith('## 來源圖片:')) {
    currentImage = line.split('## 來源圖片:')[1].trim();
  } else if (line && !line.startsWith('---') && !line.includes('卡片 ID | 牌名') && line.includes('|')) {
    let parts = line.split('|').map(x => x.trim());
    if (parts.length >= 7) {
      if (currentImage.startsWith('G5m')) {
        let cardObj = {
          "卡片ID": parts[0],
          "牌名": parts[1],
          "類型": parts[2],
          "先決條件": parts[3] === "無" || !parts[3] ? "" : parts[3],
          "費用": parts[4] === "無" || !parts[4] ? "" : parts[4],
          "是否傳遞": parts[5] === "是" ? "是" : "否",
          "勝利點數": parts[6] === "無" || !parts[6] ? "" : parts[6],
          "紅利分數": parts[7],
          "牌組": parts[8],
          "說明": parts[9],
          "card_type": "minor",
          "source_image": currentImage
        };
        parsedCards.push(cardObj);
      } else if (currentImage.startsWith('G5o')) {
        let cardObj = {
          "卡片ID": parts[0],
          "牌名": parts[1],
          "類型": parts[2],
          "先決條件": parts[3] === "無" || !parts[3] ? "" : parts[3],
          "費用": "",
          "是否傳遞": "否",
          "勝利點數": "",
          "紅利分數": parts[4],
          "牌組": parts[5],
          "說明": parts[6],
          "card_type": "occupation",
          "source_image": currentImage
        };
        parsedCards.push(cardObj);
      }
    }
  }
}

// Calculate grid properties
let imgIndexMap = {};
for (let c of parsedCards) {
  let img = c.source_image;
  if (!imgIndexMap[img]) imgIndexMap[img] = 0;
  let idx = imgIndexMap[img]++;
  c.grid_col = idx % 3;
  c.grid_row = Math.floor(idx / 3);
}

const cardsFile = 'cards.json';
let existingCards = JSON.parse(fs.readFileSync(cardsFile, 'utf8').replace(/^\uFEFF/, ''));

// Remove any existing G5 cards to avoid dupes during script dev
let filteredCards = existingCards.filter(c => !(c.source_image && c.source_image.startsWith('G5')));

filteredCards = filteredCards.concat(parsedCards);

fs.writeFileSync(cardsFile, JSON.stringify(filteredCards, null, 2), 'utf8');
console.log('Successfully added G5 cards! Count: ' + parsedCards.length);
