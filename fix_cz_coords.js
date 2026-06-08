const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8').replace(/^\uFEFF/, ''));

const counts = {};
let updatedCount = 0;

for (const card of cards) {
  if (card['牌組'] === 'Cz' || card['卡片ID'].startsWith('Cz')) {
    if (card.source_image === 'Cz101.jpg' || card.source_image === 'Cz02.jpg') {
      const img = card.source_image;
      if (counts[img] === undefined) counts[img] = 0;
      
      card.grid_col = counts[img] % 3;
      card.grid_row = Math.floor(counts[img] / 3);
      
      counts[img]++;
      updatedCount++;
    }
  }
}

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2), 'utf8');
console.log("Updated " + updatedCount + " Cz cards.");
