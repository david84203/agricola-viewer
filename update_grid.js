const fs = require('fs');
const path = require('path');

const cardsFile = path.join(__dirname, 'cards.json');
let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

let updated = 0;
cards.forEach(card => {
  if (card.source_image === '舊版改新.jpg' || card.source_image === '舊版改新2.jpg') {
    card.grid_cols = 3;
    card.grid_rows = 3;
    updated++;
  }
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log(`Updated grid_cols and grid_rows for ${updated} cards.`);
