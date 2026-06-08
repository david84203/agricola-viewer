const fs = require('fs');

const mdContent = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Occ1_draft.md', 'utf8');
const lines = mdContent.split('\n');

const newCards = [];
let row = 0;
let col = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.trim().startsWith('| **I')) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 9) {
      const id = parts[1].replace(/[*]/g, '');
      let name = parts[2];
      const type = parts[3];
      const req = parts[4];
      const pass = parts[5];
      let bonus = parts[6];
      const deck = parts[7];
      let desc = parts[8];

      // Apply user edits manually to be exact
      if (id === 'I229') name = '讒言者';
      if (id === 'I237') desc = '第7版規則更新：每當你執行「賣藝」累積行動格時，你可以從供應區領取等同於「賣藝」累積行動格上的食物。若你這麼做，每有1張已打出的「賣藝」敘述職業卡，你都必須支付該玩家1份食物。';
      if (id === 'I246') bonus = '有';
      if (id === 'I252') name = '野豬哺育師';

      newCards.push({
        "卡片ID": id,
        "牌名": name,
        "類型": type,
        "需求人數": req,
        "是否傳遞": pass,
        "紅利分數": bonus,
        "牌組": deck,
        "說明": desc,
        "card_type": "occupation",
        "source_image": "I職業1.jpg",
        "position": row * 10 + col,
        "grid_col": col,
        "grid_row": row,
        "grid_cols": 10,
        "grid_rows": 2
      });
      
      col++;
      if (col >= 10) {
        col = 0;
        row++;
      }
    }
  }
}

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

// Check duplicates
const duplicates = [];

function getSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const set1 = new Set(s1.split(''));
  const set2 = new Set(s2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

newCards.forEach(nc => {
  cards.forEach(ec => {
    const nameMatch = nc['牌名'] === ec['牌名'];
    const effectMatch = getSimilarity(nc['說明'], ec['說明']) > 0.8;
    
    if (nameMatch || effectMatch) {
      duplicates.push({
        newCard: nc,
        existCard: ec,
        reason: nameMatch && effectMatch ? '名稱與效果重複' : (nameMatch ? '名稱重複' : '效果重複')
      });
    }
  });
});

fs.writeFileSync('duplicates_i_occ1.json', JSON.stringify(duplicates, null, 2));

// Insert cards
cards = cards.concat(newCards);
fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));

// Copy image
if (!fs.existsSync('images/I職業1.jpg')) {
  fs.copyFileSync('E:/Users/bboylu/Desktop/農家樂中文化/舊版牌/I職業1.jpg', 'images/I職業1.jpg');
}

console.log('Processed', newCards.length, 'I occ1 cards.');
console.log('Found', duplicates.length, 'duplicates.');
