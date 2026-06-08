const fs = require('fs');
const path = require('path');

const cardsFile = path.join(__dirname, 'cards.json');
let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

let updated = 0;

cards.forEach(card => {
  if (card.source_image && (card.source_image.startsWith('Gm') || card.source_image.startsWith('Go'))) {
    
    // Reverse engineer grid_col and grid_row from crop_left and crop_top if they exist
    if (card.crop_left !== undefined) {
      if (card.crop_left === 17) card.grid_col = 0;
      else if (card.crop_left === 349) card.grid_col = 1;
      else if (card.crop_left === 681) card.grid_col = 2;
    }
    
    if (card.crop_top !== undefined) {
      if (card.crop_top === 13) card.grid_row = 0;
      else if (card.crop_top === 344) card.grid_row = 1;
      else if (card.crop_top === 675) card.grid_row = 2;
    }

    // Set correct grid cols/rows
    card.grid_cols = 3;
    card.grid_rows = 3;
    
    // Remove individual crop bounds so app.js uses the zero-margin default
    delete card.crop_left;
    delete card.crop_right;
    delete card.crop_top;
    delete card.crop_bottom;
    
    updated++;
  }
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log(`Cleaned up ${updated} G cards.`);
