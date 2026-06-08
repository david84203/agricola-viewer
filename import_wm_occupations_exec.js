const fs = require('fs');

const occupations = require('./temp_wm_occupations.js');
const cardsJson = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

// Map layout for each image
const imageMap = {
  'Wmo1.jpg': ['WM054', 'WM015', 'WM043', 'WM033', 'WM038', 'WM040', 'WM025', 'WM017', 'WM004'],
  'Wmo2.jpg': ['WM049', 'WM008', 'WM018', 'WM055', 'WM020', 'WM045', 'WM023', 'WM047', 'WM003'],
  'Wmo3.jpg': ['WM051', 'WM031', 'WM027', 'WM007', 'WM001', 'WM026', 'WM050', 'WM028', 'WM005'],
  'Wmo4.jpg': ['WM042', 'WM016', 'WM034', 'WM044', 'WM048', 'WM029', 'WM041', 'WM009', 'WM046'],
  'Wmo6.jpg': ['WM053', 'WM037', 'WM022', 'WM030', 'WM013', 'WM010', 'WM002', 'WM014', 'WM052'],
  'Wmo7.jpg': ['WM035', 'WM011', 'WM019', 'WM036', 'WM032', 'WM021', 'WM006']
};

const processedCards = [];

for (const card of occupations) {
  let sourceImage = '';
  let gridRow = 0;
  let gridCol = 0;

  for (const [img, ids] of Object.entries(imageMap)) {
    const idx = ids.indexOf(card.id);
    if (idx !== -1) {
      sourceImage = img;
      gridRow = Math.floor(idx / 3);
      gridCol = idx % 3;
      break;
    }
  }

  const existingIdx = cardsJson.findIndex(c => c['卡片ID'] === card.id);
  
  const cardData = {
    "卡片ID": card.id,
    "牌名": card.name,
    "類型": "職業卡",
    "先決條件": card.req,
    "費用": "無",
    "是否傳遞": "否",
    "勝利點數": "無",
    "紅利分數": card.bonus ? card.bonus : "無",
    "牌組": "Wm",
    "說明": card.desc,
    "source_image": sourceImage,
    "grid_row": gridRow,
    "grid_col": gridCol
  };

  if (existingIdx !== -1) {
    cardsJson[existingIdx] = cardData;
  } else {
    cardsJson.push(cardData);
  }
}

fs.writeFileSync('cards.json', JSON.stringify(cardsJson, null, 2), 'utf8');
console.log('Successfully imported Wm occupations.');
