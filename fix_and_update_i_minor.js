const fs = require('fs');

let draft = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_draft.md', 'utf8');

// Fix the header
draft = draft.replace('第7版規則更改：當你擴建房舍、翻修房舍、打出有至少1綑蘆葦和1份其他建築資源的次要發展卡時，你可以少支付1綑蘆葦。', '說明');

fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_draft.md', draft);

const lines = draft.split('\n');
let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
let updatedCount = 0;

for (const line of lines) {
  if (line.trim().startsWith('| **I')) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 11) {
      const id = parts[1].replace(/[*]/g, '');
      const req = parts[4];
      const cost = parts[5];
      const pass = parts[6];
      const pts = parts[7];
      const bonus = parts[8];
      let desc = parts[10];

      // Fix ladder (I091)
      if (id === 'I091') {
        desc = '第7版規則更改：當你擴建房舍、翻修房舍、打出有至少1綑蘆葦和1份其他建築資源的次要發展卡時，你可以少支付1綑蘆葦。';
      }

      const cardIndex = cards.findIndex(c => c.卡片ID === id);
      if (cardIndex !== -1) {
        cards[cardIndex].先決條件 = req;
        cards[cardIndex].費用 = cost;
        cards[cardIndex].是否傳遞 = pass;
        cards[cardIndex].勝利點數 = pts;
        cards[cardIndex].紅利分數 = bonus;
        cards[cardIndex].說明 = desc;
        updatedCount++;
      }
    }
  }
}

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log('Updated ' + updatedCount + ' I Minor cards in DB.');
