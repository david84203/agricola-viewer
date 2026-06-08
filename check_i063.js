const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const i063 = cards.find(c => c.卡片ID === 'I063');
console.log(i063);
