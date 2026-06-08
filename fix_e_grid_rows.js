const fs = require('fs');

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

// 舊版E次發.jpg: 53 cards, image 9088x10000, 6 rows of 10
// 舊版E職業1.jpg: 28 cards, image 9402x10000, 3 rows of 10
// 舊版E職業2.jpg: 24 cards, image 3840x4096, 3 rows of 10
// 舊版E職業3.jpg: 21 cards, image 3724x4096, 3 rows of 10

const corrections = {
  '舊版E次發.jpg':  { grid_cols: 10, grid_rows: 6 },
  '舊版E職業1.jpg': { grid_cols: 10, grid_rows: 3 },
  '舊版E職業2.jpg': { grid_cols: 10, grid_rows: 3 },
  '舊版E職業3.jpg': { grid_cols: 10, grid_rows: 3 },
};

let count = 0;
cards.forEach(c => {
  if (corrections[c.source_image]) {
    const fix = corrections[c.source_image];
    c.grid_cols = fix.grid_cols;
    c.grid_rows = fix.grid_rows;
    c.crop_left = 0;
    c.crop_right = 0;
    c.crop_top = 0;
    c.crop_bottom = 0;
    count++;
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log(`Fixed ${count} 舊版E cards.`);
Object.keys(corrections).forEach(img => {
  const all = cards.filter(c => c.source_image === img);
  console.log(`  ${img}: ${all.length} cards → rows=${corrections[img].grid_rows}`);
});
