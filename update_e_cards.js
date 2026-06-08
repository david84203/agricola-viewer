const fs = require('fs');

const updates = [
  { id: '舊版E217', 紅利分數: '有' },
  { id: '舊版E197', 紅利分數: '有' },
  { id: '舊版E177', 紅利分數: '有' },
  { id: '舊版E170', 紅利分數: '有' },
  { id: '舊版E156', 紅利分數: '有' },
  { id: '舊版E46', 費用: '2木' },
  { id: '舊版E42', 費用: '1木/1磚' },
  { id: '舊版E11', 牌名: '農田', 先決條件: '無', 費用: '1份食物' },
  { id: '舊版E12', 牌名: '釣竿', 費用: '1木' },
  { id: '舊版E26', 牌名: '刨子', 費用: '1木' },
  { id: '舊版E27', 牌名: '木造烤爐', 勝利點數: '2', 紅利分數: '無' },
  { id: '舊版E40', 牌名: '迷你圈地' },
  { id: '舊版E52', 牌名: '馬廄' },
  { id: '舊版E56', 牌名: '採石鉗', 紅利分數: '無' }
];

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
let updatedCount = 0;

updates.forEach(u => {
  let card = cards.find(c => c.卡片ID === u.id);
  if (card) {
    if (u.費用 !== undefined) card.費用 = u.費用;
    if (u.勝利點數 !== undefined) card.勝利點數 = u.勝利點數;
    if (u.紅利分數 !== undefined) card.紅利分數 = u.紅利分數;
    if (u.先決條件 !== undefined) card.先決條件 = u.先決條件;
    if (u.牌名 !== undefined) card.牌名 = u.牌名;
    updatedCount++;
    console.log(`Updated ${u.id}`);
  } else {
    console.log(`Warning: Could not find card ${u.id}`);
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log('Updated ' + updatedCount + ' Old E cards.');
