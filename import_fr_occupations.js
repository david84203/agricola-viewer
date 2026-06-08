const fs = require('fs');
const path = require('path');

const cardsFile = './cards.json';
const drafts = [
  { file: 'C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/FR_Occupation_1_2_3_draft.md', imgs: ['FRo1.jpg', 'FRo2.jpg', 'FRo3.jpg'] },
  { file: 'C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/FR_Occupation_4_5_6_draft.md', imgs: ['FRo4.jpg', 'FRo5.jpg', 'FRo6.jpg'] }
];

let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

drafts.forEach(draft => {
  const content = fs.readFileSync(draft.file, 'utf8');
  const lines = content.split('\n');
  
  let currentImgIndex = 0;
  let currentImg = draft.imgs[currentImgIndex];
  let position = 0;
  
  lines.forEach(line => {
    if (line.startsWith('#')) {
      for (let img of draft.imgs) {
        if (line.includes(img)) {
          currentImg = img;
          position = 0;
        }
      }
    } else if (line.startsWith('| **FR')) {
      const parts = line.split('|').map(s => s.trim());
      // Format: | 卡片 ID | 牌名 | 類型 | 需求人數 | 紅利分數 | 牌組 | 說明 |
      const id = parts[1].replace(/\*/g, '');
      const name = parts[2];
      const type = parts[3];
      const req = parts[4];
      const bonus = parts[5] === '無' ? '無' : parts[5];
      const deck = parts[6];
      const desc = parts[7];
      
      const newCard = {
        "牌名": name,
        "類型": "職業卡",
        "是否傳遞": "否",
        "紅利分數": bonus,
        "牌組": "FR",
        "卡片ID": id,
        "說明": desc,
        "card_type": "occupation",
        "source_image": currentImg,
        "position": position,
        "grid_col": position % 3,
        "grid_row": Math.floor(position / 3),
        "人數": req
      };
      
      const existingIdx = cards.findIndex(c => c['卡片ID'] === id);
      if (existingIdx !== -1) {
        cards[existingIdx] = Object.assign(cards[existingIdx], newCard);
      } else {
        cards.push(newCard);
      }
      
      position++;
    }
  });
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2));
console.log('Imported FR Occupation cards successfully.');
