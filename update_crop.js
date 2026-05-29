const fs = require('fs');
const path = require('path');

const cardsFile = path.join(__dirname, 'cards.json');
let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

let updated = 0;
cards.forEach(card => {
  if (card.source_image === '舊版改新.jpg' || card.source_image === '舊版改新2.jpg') {
    card.crop_top = 113;
    card.crop_bottom = 99;
    card.crop_left = 182;
    card.crop_right = 164;
    updated++;
  }
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log(`Updated crop parameters for ${updated} cards.`);
