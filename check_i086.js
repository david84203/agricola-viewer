const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const i086 = cards.find(c => c.卡片ID === 'I086');
console.log(i086);
