const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const images = [...new Set(cards.filter(c => c.source_image && c.source_image.includes('舊版E')).map(c => c.source_image))];
images.forEach(img => {
  const all = cards.filter(c => c.source_image === img);
  const sample = all[0];
  console.log(`\n${img}: ${all.length} 張`);
  console.log(`  grid_cols=${sample.grid_cols}, grid_rows=${sample.grid_rows}`);
  console.log(`  crop_left=${sample.crop_left}, crop_right=${sample.crop_right}, crop_top=${sample.crop_top}, crop_bottom=${sample.crop_bottom}`);
});
