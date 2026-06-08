const fs = require('fs');

const updates = [
  { id: '舊版E13', 費用: '1木+1石' },
  { id: '舊版E18', 費用: '無', 勝利點數: '1分' },
  { id: '舊版E19', 紅利分數: '無' },
  { id: '舊版E20', 勝利點數: '1分' },
  { id: '舊版E27', 費用: '3木+1石', 紅利分數: '2分' },
  { id: '舊版E28', 費用: '1木' },
  { id: '舊版E29', 費用: '無' },
  { id: '舊版E30', 勝利點數: '1分' },
  { id: '舊版E31', 費用: '無', 勝利點數: '1分' },
  { id: '舊版E32', 先決條件: '無' },
  { id: '舊版E33', 費用: '1磚' },
  { id: '舊版E34', 先決條件: '無', 費用: '1蘆葦' },
  { id: '舊版E36', 勝利點數: '1分' },
  { id: '舊版E39', 是否傳遞: '是' },
  { id: '舊版E41', 是否傳遞: '否' },
  { id: '舊版E42', 勝利點數: '無' },
  { id: '舊版E44', 費用: '1木+1磚' },
  { id: '舊版E45', 費用: '2食物', 勝利點數: '無' },
  { id: '舊版E46', 勝利點數: '無' },
  { id: '舊版E50', 費用: '1木', 紅利分數: '無' },
  { id: '舊版E51', 先決條件: '無', 費用: '1木' },
  { id: '舊版E52', 牌名: '圈地->馬廄', 費用: '1木' },
  { id: '舊版E53', 勝利點數: '無', 紅利分數: '無' },
  { id: '舊版E55', 費用: '1蘆葦+3石' },
  { id: '舊版E56', 勝利點數: '無' },
  { id: '舊版E57', 先決條件: '無', 費用: '2石' },
  { id: '舊版E58', 勝利點數: '1分' },
  { id: '舊版E59', 費用: '2木' },
  { id: '舊版E60', 勝利點數: '無' },
  { id: '舊版E61', 先決條件: '3職業', 費用: '4木' },
  { id: '舊版E62', 勝利點數: '無' }
];

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

updates.forEach(u => {
  let card = cards.find(c => c.卡片ID === u.id);
  if (card) {
    if (u.費用 !== undefined) card.費用 = u.費用;
    if (u.勝利點數 !== undefined) card.勝利點數 = u.勝利點數;
    if (u.紅利分數 !== undefined) card.紅利分數 = u.紅利分數;
    if (u.先決條件 !== undefined) card.先決條件 = u.先決條件;
    if (u.是否傳遞 !== undefined) card.是否傳遞 = u.是否傳遞;
    if (u.牌名 !== undefined) card.牌名 = u.牌名;
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log('Updated Old E Minors.');
