const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const ladder = cards.find(c => c.牌名 === '梯子' || c.牌名 === '梯子');
console.log(ladder);
