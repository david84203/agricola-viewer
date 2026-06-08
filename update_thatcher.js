const fs = require('fs');

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
let count = 0;

cards.forEach(c => {
  if (c.卡片ID === '舊版E157') {
    c.說明 = '第7版規則更改：當你擴建房舍、翻修房舍、打出有至少1綑蘆葦和1份其他建築資源的次要發展卡時，你可以少支付1綑蘆葦。';
    count++;
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log(`Updated ${count} cards.`);
