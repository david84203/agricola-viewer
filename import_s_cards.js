const fs = require('fs');
const path = require('path');

// Each deck maps to its image files with slot counts [filename, slots]
// Most images have 9 slots; S10m2 only has 2 cards (thumbnail shows it's mostly blank)
const deckImages = {
  S1:  [['S1m2.jpg',9],  ['S1o1.jpg',9],  ['S1o2m1.jpg',9]],
  S2:  [['S2m2.jpg',9],  ['S2o1.jpg',9],  ['S2o2m1.jpg',9]],
  S3:  [['S3m2.jpg',9],  ['S3o1.jpg',9],  ['S3o2m1.jpg',9]],
  S4:  [['S4m2.jpg',9],  ['S4o1.jpg',9],  ['S4o2m1.jpg',9]],
  S5:  [['S5m2.jpg',9],  ['S5o1.jpg',9],  ['S5o2m1.jpg',9]],
  S6:  [['S6m1.jpg',9],  ['S6o1.jpg',9],  ['S6o2m2.jpg',9]],
  S7:  [['S7m1.jpg',9],  ['S7o1.jpg',9],  ['S7o2m2.jpg',9]],
  S8:  [['S8m1.jpg',9],  ['S8o1.jpg',9],  ['S8o2m2.jpg',9]],
  S9:  [['S9m1.jpg',9],  ['S9o1.jpg',9],  ['S9o2m2.jpg',9]],
  S10: [['S10m1.jpg',9], ['S10m2.jpg',2], ['S10o1.jpg',9]],
  S11: [['S11m1.jpg',9], ['S11o1.jpg',9]],
};

function parseCard(line) {
  if (line.startsWith('卡片 ID：')) {
    const m = line.match(
      /^卡片 ID：(\S+) 牌名：(.+?) 類型：次要發展卡 先決條件：(.+?) 費用：(.+?) 是否傳遞：(.+?) 勝利點數：(.+?) 紅利分數：(.+?) 牌組：(\S+) 說明：(.+)$/
    );
    if (!m) return null;
    return {
      卡片ID: m[1], 牌名: m[2], card_type: 'minor', 牌組: m[8], 說明: m[9],
      類型: '次要發展卡',
      先決條件: m[3] === '無' ? '無' : m[3],
      費用: m[4] === '無' ? '無' : m[4],
      是否傳遞: m[5],
      勝利點數: m[6] === '無' ? '無' : m[6],
      紅利分數: m[7],
      grid_cols: 3, grid_rows: 3,
    };
  }
  if (line.startsWith('【')) {
    const m = line.match(
      /^【(.+?)】(.+?) 類型：職業卡 需求人數：(.+?) 人 紅利：(\S+) 牌組：(\S+) 說明：(.+)$/
    );
    if (!m) return null;
    return {
      卡片ID: m[1], 牌名: m[2], card_type: 'occupation', 牌組: m[5], 說明: m[6],
      人數: m[3], 紅利分數: m[4],
      grid_cols: 3, grid_rows: 3,
    };
  }
  return null;
}

function parseText(text) {
  return text.split('\n').map(l => l.trim()).map(parseCard).filter(Boolean);
}

const allCards = [
  ...parseText(fs.readFileSync('E:/Users/bboylu/Downloads/S1S2.md', 'utf8')),
  ...parseText(fs.readFileSync('E:/Users/bboylu/Downloads/S3-S11.md', 'utf8')),
];
console.log(`解析到 ${allCards.length} 張卡`);

// Group by deck (cards in text are already in deck order)
const byDeck = {};
for (const card of allCards) {
  const d = card.牌組;
  if (!byDeck[d]) byDeck[d] = [];
  byDeck[d].push(card);
}

// Assign images per deck (9 per image, reset at each image boundary)
for (const [deck, images] of Object.entries(deckImages)) {
  const cards = byDeck[deck] || [];
  let imgIdx = 0;
  let posInImg = 0;

  for (const card of cards) {
    if (imgIdx >= images.length) {
      console.error(`${deck}: 圖片不夠用！卡片: ${card.牌名} (已用 ${images.length} 張圖)`);
      break;
    }
    const [imgName, slots] = images[imgIdx];
    card.source_image = imgName;
    card.grid_col = posInImg % 3;
    card.grid_row = Math.floor(posInImg / 3);
    card.position = posInImg;

    posInImg++;
    if (posInImg >= slots) { posInImg = 0; imgIdx++; }
  }
  console.log(`${deck}: ${cards.length} 張卡 → 用了 ${imgIdx + (posInImg > 0 ? 1 : 0)} 張圖 (最後一張 ${posInImg} 張卡)`);
}

// Update cards.json
const cardsJsonPath = path.join(__dirname, 'cards.json');
const existing = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));
const filtered = existing.filter(c => !c['牌組'] || !/^S\d+$/.test(String(c['牌組'])));
const final = [...filtered, ...allCards];
fs.writeFileSync(cardsJsonPath, JSON.stringify(final, null, 2), 'utf8');
console.log(`\n移除舊 S 系列 ${existing.length - filtered.length} 筆，新增 ${allCards.length} 筆，總計 ${final.length} 筆`);
