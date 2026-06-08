const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const sample = cards.filter(c => c.source_image === 'I次發.jpg').slice(0, 5);
sample.forEach(c => {
  console.log(JSON.stringify({
    id: c['卡片ID'],
    name: c['牌名'],
    grid_col: c.grid_col,
    grid_row: c.grid_row,
    grid_cols: c.grid_cols,
    grid_rows: c.grid_rows,
    crop_left: c.crop_left,
    crop_right: c.crop_right,
    crop_top: c.crop_top,
    crop_bottom: c.crop_bottom,
    source_image: c.source_image,
  }, null, 2));
});
