const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8').replace(/^\uFEFF/, ''));
const reqMap = JSON.parse(fs.readFileSync('req_map_2.json', 'utf8').replace(/^\uFEFF/, ''));

let count = 0;
for (const card of cards) {
  if (reqMap[card['卡片ID']]) {
    card['人數'] = reqMap[card['卡片ID']];
    count++;
  }
}

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2), 'utf8');
console.log("Updated " + count + " cards.");
