const fs = require('fs');

const draft = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Occ2_draft.md', 'utf8');
let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

// Filter out old versions if any (prevent dupes)
const lines = draft.split('\n').filter(l => l.startsWith('| **I'));

const newCards = [];
lines.forEach((line, index) => {
  const parts = line.split('|').map(p => p.trim());
  if (parts.length < 9) return;
  
  const idStr = parts[1].replace(/\*\*/g, ''); // e.g. I221
  const name = parts[2];
  const type = parts[3];
  const players = parts[4];
  const pass = parts[5];
  const bonus = parts[6];
  const deck = parts[7];
  const desc = parts[8];

  const cardObj = {
    "卡片ID": idStr,
    "牌名": name,
    "類型": "職業卡",
    "需求人數": players,
    "是否傳遞": pass,
    "紅利分數": bonus,
    "牌組": deck,
    "說明": desc,
    "card_type": "occupation",
    "source_image": "I職業2.jpg",
    "position": index,
    "grid_col": index % 10,
    "grid_row": Math.floor(index / 10),
    "grid_cols": 10,
    "grid_rows": 7,
    "crop_left": 0,
    "crop_right": 0,
    "crop_top": 0,
    "crop_bottom": 0
  };

  newCards.push(cardObj);
});

// Remove existing I_Occ2 to avoid duplicates if rerunning
cards = cards.filter(c => c.source_image !== 'I職業2.jpg');
cards = cards.concat(newCards);

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log(`Successfully added ${newCards.length} cards from I_Occ2_draft.`);
