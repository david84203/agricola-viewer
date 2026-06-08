const fs = require('fs');
let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const e_images = [
  '舊版E次發.jpg',
  '舊版E職業1.jpg',
  '舊版E職業2.jpg',
  '舊版E職業3.jpg'
];

let count = 0;
cards.forEach(c => {
  if (e_images.includes(c.source_image)) {
    c.grid_cols = 10;
    c.grid_rows = 7; // TS standard grid is ALWAYS 10x7, regardless of card count
    c.crop_left = 0;
    c.crop_right = 0;
    c.crop_top = 0;
    c.crop_bottom = 0;
    count++;
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log(`Reverted ${count} cards back to grid_rows: 7.`);
