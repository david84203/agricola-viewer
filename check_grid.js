const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const i063 = cards.find(c => c.卡片ID === 'I063');
const i064 = cards.find(c => c.卡片ID === 'I064');
console.log('I063:', i063.牌名, 'col:', i063.grid_col, 'row:', i063.grid_row);
console.log('I064:', i064.牌名, 'col:', i064.grid_col, 'row:', i064.grid_row);
