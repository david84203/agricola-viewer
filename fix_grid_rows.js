const fs = require('fs');
let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

let count = 0;
cards.forEach(c => {
  if (c.source_image === '舊版E職業1.jpg' || c.source_image === '舊版E職業2.jpg') {
    if (c.grid_rows === 3) {
      c.grid_rows = 7;
      count++;
    }
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log(`Fixed ${count} cards.`);
