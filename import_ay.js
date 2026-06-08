const fs = require('fs');

const cardsFile = './cards.json';
const drafts = [
  { file: 'C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/AY_missing_m2_draft.md', type: 'minor', img: 'AYm2.jpg' },
  { file: 'C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/AY_missing_o2_draft.md', type: 'occ', img: 'AYo2.jpg' },
  { file: 'C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/AY_missing_o3_draft.md', type: 'occ', img: 'AYo3.jpg' }
];

let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

drafts.forEach(draft => {
  const content = fs.readFileSync(draft.file, 'utf8');
  const lines = content.split('\n');
  let pos = 0;
  
  lines.forEach(line => {
    if (line.startsWith('| **')) {
      const parts = line.split('|').map(s => s.trim());
      
      if (draft.type === 'minor' && parts.length >= 10) {
        const id = parts[1].replace(/[*]/g, '');
        const name = parts[2];
        const cardType = parts[3];
        const req = parts[4];
        const cost = parts[5];
        const pass = parts[6];
        const vp = parts[7];
        const bonus = parts[8];
        const deck = parts[9];
        const desc = parts[10];
        
        cards.push({
          "牌名": name,
          "類型": cardType,
          "先決條件": req,
          "費用": cost,
          "是否傳遞": pass,
          "勝利點數": vp,
          "紅利分數": bonus,
          "牌組": deck,
          "卡片ID": id,
          "說明": desc,
          "card_type": "minor_improvement",
          "source_image": draft.img,
          "position": pos,
          "grid_col": pos % 3,
          "grid_row": Math.floor(pos / 3)
        });
        pos++;
      } else if (draft.type === 'occ' && parts.length >= 7) {
        const id = parts[1].replace(/[*]/g, '');
        const name = parts[2];
        const cardType = parts[3];
        const req = parts[4];
        const bonus = parts[5];
        const deck = parts[6];
        const desc = parts[7];
        
        cards.push({
          "牌名": name,
          "類型": cardType,
          "人數": req,
          "紅利分數": bonus,
          "牌組": deck,
          "卡片ID": id,
          "說明": desc,
          "card_type": "occupation",
          "source_image": draft.img,
          "position": pos,
          "grid_col": pos % 3,
          "grid_row": Math.floor(pos / 3)
        });
        pos++;
      }
    }
  });
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log('Imported AY cards successfully.');
