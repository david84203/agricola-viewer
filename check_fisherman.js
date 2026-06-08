const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const fisherman = cards.find(c => c.牌名 === '漁夫' && c.牌組 === 'I');
console.log('Fisherman:', fisherman);

const juggler = cards.find(c => c.牌名 === '雜技員' && c.牌組 === 'I');
console.log('Juggler:', juggler);
