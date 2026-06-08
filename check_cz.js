const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8').replace(/^\uFEFF/, ''));

const counts = {};
let updatedCount = 0;

for (const card of cards) {
  if ((card['牌組'] === 'Cz' || card['卡片ID'].startsWith('Cz')) && card.source_image) {
    if (card.grid_col === undefined || card.grid_row === undefined) {
      const img = card.source_image;
      if (counts[img] === undefined) {
        // Find max position currently assigned in this image to continue from it?
        // Wait, if some cards ALREADY have coordinates, sequential assignment might overlap!
        counts[img] = 0;
      }
      
      // Let's just output them first so I can inspect.
      console.log('Missing coord for: ' + card['卡片ID'] + ' in ' + img);
    }
  }
}
