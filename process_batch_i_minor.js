const fs = require('fs');

const mdContent = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_draft.md', 'utf8');
const lines = mdContent.split('\n');

const newCards = [];
let row = 0;
let col = 0;

for (const line of lines) {
  if (line.trim().startsWith('| **I')) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 11) {
      const id = parts[1].replace(/[*]/g, '');
      const name = parts[2];
      const type = parts[3];
      const req = parts[4];
      const cost = parts[5];
      const pass = parts[6];
      const pts = parts[7];
      const bonus = parts[8];
      const deck = parts[9];
      const desc = parts[10];

      newCards.push({
        "卡片ID": id,
        "牌名": name,
        "類型": type,
        "先決條件": req,
        "費用": cost,
        "是否傳遞": pass,
        "勝利點數": pts,
        "紅利分數": bonus,
        "牌組": deck,
        "說明": desc,
        "card_type": "minor",
        "source_image": "I次發.jpg",
        "position": row * 10 + col,
        "grid_col": col,
        "grid_row": row,
        "grid_cols": 10,
        "grid_rows": 7
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

fs.writeFileSync('duplicates_i_minor.json', JSON.stringify(duplicates, null, 2));

// Insert cards
cards = cards.concat(newCards);
fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));

// Copy image
if (!fs.existsSync('images/I次發.jpg')) {
  fs.copyFileSync('E:/Users/bboylu/Desktop/農家樂中文化/舊版牌/I次發.jpg', 'images/I次發.jpg');
}

console.log('Processed', newCards.length, 'I minor cards.');
console.log('Found', duplicates.length, 'duplicates.');
