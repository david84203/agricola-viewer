const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const occupations = cards.filter(c => c.card_type === 'occupation' || c['類型'] === '職業卡');
const missing = occupations.filter(c => !c['人數'] && c.source_image && c.grid_col !== undefined);

const targets = missing.map(c => ({
  id: c['卡片ID'],
  img: c.source_image,
  col: c.grid_col,
  row: c.grid_row
}));

fs.writeFileSync('missing.json', JSON.stringify(targets, null, 2));
console.log("Dumped " + targets.length + " missing cards to missing.json");
