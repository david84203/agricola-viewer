const fs = require('fs');

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

cards.forEach(c => {
  // 1. Update I089 & I104
  if (c.卡片ID === 'I089' || c.牌名 === '紅磚道路') {
    c.勝利點數 = '1';
    c.紅利分數 = '有';
  }
  if (c.卡片ID === 'I104' || c.牌名 === '每週例行市場') {
    c.紅利分數 = '無';
  }

  // 2. Update 長者 & 農民
  if (c.牌名 === '長者' || c.牌名 === '農民') {
    c.紅利分數 = '有';
  }

  // 3. Fix crop offsets for I decks
  if (c.source_image && c.source_image.startsWith('I')) {
    c.crop_left = 0;
    c.crop_right = 0;
    c.crop_top = 0;
    c.crop_bottom = 0;
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log('Fixed updates and image crops.');
