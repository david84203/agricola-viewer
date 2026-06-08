const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

// Show sample cards per source image
const images = [...new Set(cards.filter(c => c.source_image && c.source_image.startsWith('I')).map(c => c.source_image))];
images.forEach(img => {
  const sample = cards.find(c => c.source_image === img);
  const all = cards.filter(c => c.source_image === img);
  const maxCol = Math.max(...all.map(c => c.grid_col));
  const maxRow = Math.max(...all.map(c => c.grid_row));
  console.log(`${img}: ${all.length} cards, grid_cols=${sample.grid_cols}, grid_rows=${sample.grid_rows}, maxCol=${maxCol}, maxRow=${maxRow}`);
});
