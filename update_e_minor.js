const fs = require('fs');

const mdContent = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/E_Minor_Review_updated.md', 'utf8');
const lines = mdContent.split('\n');

const updates = {};
for (const line of lines) {
  if (line.trim().startsWith('| **舊版E')) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 9) {
      const id = parts[1].replace(/[*]/g, '');
      const name = parts[2];
      const type = parts[3];
      const req = parts[4];
      const cost = parts[5];
      const pass = parts[6];
      const pts = parts[7];
      const bonus = parts[8];
      const deck = parts[9];
      const desc = parts[10];

      updates[id] = {
        name, type, req, cost, pass, pts, bonus, deck, desc
      };
    }
  }
}

let cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
let updatedCount = 0;

cards.forEach(c => {
  if (updates[c.卡片ID]) {
    const u = updates[c.卡片ID];
    c['牌名'] = u.name;
    c['類型'] = u.type;
    if (u.req && u.req !== '無') {
      c['需求人數'] = undefined;
      c['先決條件'] = u.req;
    } else {
      c['先決條件'] = '無';
    }
    c['費用'] = u.cost;
    c['是否傳遞'] = u.pass;
    c['勝利點數'] = u.pts;
    c['紅利分數'] = u.bonus;
    c['牌組'] = u.deck;
    c['說明'] = u.desc;
    updatedCount++;
  }
});

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2));
console.log(`Updated ${updatedCount} Old E Minor cards in cards.json.`);
