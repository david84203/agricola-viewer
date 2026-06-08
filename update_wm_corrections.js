const fs = require('fs');
const lines = fs.readFileSync('corrected_wm_minors.tsv', 'utf8').split('\n').filter(l => l.trim() !== '');

const cardsJson = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

// Skip header
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t');
  if (parts.length < 10) continue;
  
  const id = parts[0].trim();
  const name = parts[1].trim();
  const type = parts[2].trim();
  const req = parts[3].trim();
  let cost = parts[4].trim();
  const pass = parts[5].trim();
  const pts = parts[6].trim();
  const bonus = parts[7].trim();
  const deck = parts[8].trim();
  const desc = parts[9].trim();

  // The user made a typo in WM096 "無 無" instead of "無"
  if (cost === '無 無') {
    cost = '無';
  }

  const cardIndex = cardsJson.findIndex(c => c['卡片ID'] === id);
  if (cardIndex >= 0) {
    cardsJson[cardIndex]['牌名'] = name;
    cardsJson[cardIndex]['類型'] = type;
    cardsJson[cardIndex]['先決條件'] = req;
    cardsJson[cardIndex]['費用'] = cost;
    cardsJson[cardIndex]['是否傳遞'] = pass;
    cardsJson[cardIndex]['勝利點數'] = pts;
    cardsJson[cardIndex]['紅利分數'] = bonus;
    cardsJson[cardIndex]['牌組'] = deck;
    cardsJson[cardIndex]['說明'] = desc;
  }
}

fs.writeFileSync('cards.json', JSON.stringify(cardsJson, null, 2), 'utf8');
console.log('Updated cards.json successfully.');
