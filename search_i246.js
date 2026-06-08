const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const i246 = cards.find(c => c.卡片ID === 'I246');
console.log('I246:', i246);
