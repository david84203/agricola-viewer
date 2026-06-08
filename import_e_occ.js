const fs = require('fs');

const cardsFile = './cards.json';
const drafts = [
  'C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/E_Occupation_1_draft.md',
  'C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/E_Occupation_2_draft.md',
  'C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/E_Occupation_3_draft.md'
];

let cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));

// Mapping for source_image and position
const getPlacementInfo = (id) => {
  const num = parseInt(id.replace('E', ''), 10);
  if (num >= 85 && num <= 93) {
    return { img: 'E101.jpg', pos: num - 85 };
  }
  if (num >= 94 && num <= 102) {
    return { img: 'E102.jpg', pos: num - 94 };
  }
  if (num >= 103 && num <= 111) {
    return { img: 'E103.jpg', pos: num - 103 };
  }
  if (num >= 112 && num <= 120) {
    return { img: 'E104.jpg', pos: num - 112 };
  }
  if (num >= 121 && num <= 129) {
    const pos = num === 121 ? 0 : num === 122 ? 1 : num === 123 ? 2 : num === 124 ? 3 : num === 126 ? 5 : num === 127 ? 6 : num === 128 ? 7 : num === 129 ? 8 : -1;
    return { img: 'E105.jpg', pos };
  }
  if (num >= 130 && num <= 138) {
    return { img: 'E106.jpg', pos: num - 130 };
  }
  if (num >= 139 && num <= 147) {
    return { img: 'E107.jpg', pos: num - 139 };
  }
  if (num >= 148 && num <= 156) {
    const pos = num === 148 ? 0 : num === 150 ? 2 : num === 151 ? 3 : num === 152 ? 4 : num === 153 ? 5 : num === 154 ? 6 : num === 155 ? 7 : num === 156 ? 8 : -1;
    return { img: 'E108.jpg', pos };
  }
  if (num >= 157 && num <= 165) {
    return { img: 'E109.jpg', pos: num - 157 };
  }
  if (num >= 166 && num <= 168) {
    return { img: 'E110.jpg', pos: num - 166 };
  }
  return null;
};

drafts.forEach(draft => {
  const content = fs.readFileSync(draft, 'utf8');
  const lines = content.split('\n');
  lines.forEach(line => {
    if (line.startsWith('| **E')) {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 8) {
        const id = parts[1].replace(/[*]/g, '');
        if (id === 'B085') return;
        
        const name = parts[2];
        const type = parts[3];
        const req = parts[4];
        const bonus = parts[5];
        const deck = parts[6];
        const desc = parts[7];
        
        const placement = getPlacementInfo(id);
        if (placement && placement.pos !== -1) {
          const grid_col = placement.pos % 3;
          const grid_row = Math.floor(placement.pos / 3);
          
          cards.push({
            "牌名": name,
            "類型": type,
            "人數": req,
            "紅利分數": bonus,
            "牌組": deck,
            "卡片ID": id,
            "說明": desc,
            "card_type": "occupation",
            "source_image": placement.img,
            "position": placement.pos,
            "grid_col": grid_col,
            "grid_row": grid_row
          });
        }
      }
    }
  });
});

fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
console.log('Imported successfully.');
