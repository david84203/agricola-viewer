const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const fishCards = cards.filter(c => c.牌名 && (c.牌名.includes('漁夫') || c.說明.includes('釣魚') || c.牌名.includes('釣客')));
console.log(fishCards);
