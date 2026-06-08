const fs = require('fs');

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

let count = 0;
cards.forEach(c => {
  if (c.source_image && c.source_image.startsWith('K')) {
    c.crop_left = 0;
    c.crop_right = 0;
    c.crop_top = 0;
    c.crop_bottom = 0;
    count++;
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log('Fixed crops for', count, 'K cards.');
