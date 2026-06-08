const fs = require('fs');

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

let fisherman = cards.find(c => c.卡片ID === '舊版E161');
if (fisherman) {
  fisherman.說明 = '第7版規則更新：每當你執行「釣魚」累積行動格時，你可以從供應區領取等同於「釣魚」累積行動格上的食物。若你這麼做，每有1張已打出的「釣魚」敘述職業卡，你都必須支付該玩家1份食物。';
  console.log('Updated fisherman.');
}

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
