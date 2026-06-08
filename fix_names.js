const fs = require('fs');
let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

cards.forEach(c => {
  if (c['卡片ID'] === 'K284') {
    c['牌名'] = '木材分配員';
  }
  if (c['卡片ID'] === 'K306') {
    c['牌名'] = '馴養員';
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log('Fixed K284 and K306 names');
