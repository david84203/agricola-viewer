const fs = require('fs');

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

let updatedCount = 0;
cards.forEach(c => {
  if (c.source_image && c.source_image.startsWith('I')) {
    c.grid_rows = 7;
    c.grid_cols = 10;
    c.crop_left = 0;
    c.crop_right = 0;
    c.crop_top = 0;
    c.crop_bottom = 0;
    updatedCount++;
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log(`Updated grid_rows for ${updatedCount} I cards.`);
