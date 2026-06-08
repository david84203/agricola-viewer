const fs = require('fs');
const path = require('path');

const cardsFile = path.join(__dirname, 'cards.json');
let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

let updated = 0;

const colCrops = [
  { left: 17, right: 669 },
  { left: 349, right: 337 },
  { left: 681, right: 5 }
];

const rowCrops = [
  { top: 13, bottom: 676 },
  { top: 344, bottom: 345 },
  { top: 675, bottom: 14 }
];

cards.forEach(card => {
  if (card['卡片ID'].startsWith('G')) {
    let changed = false;

    // Fix Go cards (occupations)
    if (card['圖片'] && card['圖片'].includes('Go')) {
      card.source_image = card['圖片'].replace('images/', '');
      delete card['圖片'];
      
      // They already have crop_top, etc. but need grid info updated to 1x1
      card.grid_cols = 1;
      card.grid_rows = 1;
      card.grid_col = 0;
      card.grid_row = 0;
      changed = true;
    }

    // Fix Gm cards (minors)
    if (card.source_image && card.source_image.startsWith('Gm')) {
      if (card.grid_cols === 3 && card.grid_rows === 3) {
        const col = card.grid_col || 0;
        const row = card.grid_row || 0;
        
        card.crop_left = colCrops[col].left;
        card.crop_right = colCrops[col].right;
        card.crop_top = rowCrops[row].top;
        card.crop_bottom = rowCrops[row].bottom;

        card.grid_cols = 1;
        card.grid_rows = 1;
        card.grid_col = 0;
        card.grid_row = 0;
        changed = true;
      }
    }

    if (changed) updated++;
  }
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log(`Updated ${updated} G cards.`);
