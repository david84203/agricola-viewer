const fs = require('fs');

const mdContent = fs.readFileSync('C:\\Users\\bboylu\\.gemini\\antigravity\\brain\\1d079712-1065-43d9-86dd-dc8dc56f2b2d\\K_Occupation_2_draft.md', 'utf8');

const lines = mdContent.split('\n');
const newCards = [];
let row = 0;
let col = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.trim().startsWith('| **K')) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 7) {
      const id = parts[1].replace(/[*]/g, '');
      const name = parts[2];
      const type = parts[3];
      const req = parts[4];
      const deck = parts[5];
      const desc = parts[6];

      newCards.push({
        "卡片ID": id,
        "牌名": name,
        "類型": type,
        "需求人數": req,
        "牌組": deck,
        "說明": desc,
        "card_type": "occupation",
        "source_image": "K職業2.jpg",
        "position": row * 10 + col,
        "grid_col": col,
        "grid_row": row,
        "grid_cols": 10,
        "grid_rows": 7,
        "crop_left": 0,
        "crop_right": 0,
        "crop_top": 0,
        "crop_bottom": 0
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

// Add new cards
cards = cards.concat(newCards);
fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));

console.log('Processed', newCards.length, 'K occupation 2 cards.');
