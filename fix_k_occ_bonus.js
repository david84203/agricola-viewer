const fs = require('fs');
let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const hasBonus = ['K273', 'K274', 'K276', 'K280', 'K282'];

cards.forEach(c => {
  if (c.card_type === 'occupation' && c['卡片ID'].startsWith('K')) {
    c['紅利分數'] = hasBonus.includes(c['卡片ID']) ? '有' : '無';
    
    if (c['卡片ID'] === 'K288') {
      c['說明'] = '每次你以家庭成員執行行動，同時取得石頭和蘆葦時，選擇以下一項：獲得1塊磚頭；或是獲得1份麥子。';
    }
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log('Fixed K Occupation bonus points and K288 desc');
