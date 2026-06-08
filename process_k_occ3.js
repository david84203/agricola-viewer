const fs = require('fs');

const mdContent = fs.readFileSync('C:\\Users\\bboylu\\.gemini\\antigravity\\brain\\1d079712-1065-43d9-86dd-dc8dc56f2b2d\\K_Occupation_3_draft.md', 'utf8');

const lines = mdContent.split('\n');
const newCards = [];
let row = 0;
let col = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.trim().startsWith('| **K')) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 8) { // Because we added 紅利分數, there are 8 parts now (0-7 indices, sometimes 8 if trailing pipe)
      const id = parts[1].replace(/[*]/g, '');
      const name = parts[2];
      const type = parts[3];
      const req = parts[4];
      const bonus = parts[5];
      const deck = parts[6];
      const desc = parts[7];

      newCards.push({
        "卡片ID": id,
        "牌名": name,
        "類型": type,
        "需求人數": req,
        "紅利分數": bonus,
        "牌組": deck,
        "說明": desc,
        "card_type": "occupation",
        "source_image": "K職業3.jpg",
        "position": row * 10 + col,
        "grid_col": col,
        "grid_row": row,
        "grid_cols": 10,
        "grid_rows": 7, // same as previous ones, just standard 10x7 grid calculation. Though this image has 1 row, crop calculations usually just use the absolute grid row/col if source image has that many.
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

console.log('Processed', newCards.length, 'K occupation 3 cards.');
