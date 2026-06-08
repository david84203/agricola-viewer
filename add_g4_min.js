const fs = require('fs');

const rawText = fs.readFileSync('G4_minors.txt', 'utf8').trim();
const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);

const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8').replace(/^\uFEFF/, ''));

// Remove any existing G4 minor cards if they exist (just in case of re-run)
const filteredCards = cards.filter(c => !(c['牌組'] === 'G4' && c.card_type === 'minor'));

// lines[0] is the header
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const parts = line.split('\t');
  if (parts.length < 10) continue;

  const [id, name, type, req, cost, pass, vp, bonus, deck, desc] = parts;
  
  const index = i - 1; // 0-based
  const imgNum = Math.floor(index / 9) + 1;
  const grid_row = Math.floor((index % 9) / 3);
  const grid_col = (index % 9) % 3;

  const cardObj = {
    "卡片ID": id,
    "牌名": name,
    "類型": type,
    "先決條件": req === "無" || req === "—" || !req ? "" : req,
    "費用": cost === "無" || cost === "—" || !cost ? "" : cost,
    "是否傳遞": pass === "是" ? "是" : "否",
    "勝利點數": vp === "無" || vp === "—" || !vp ? "" : vp,
    "紅利分數": bonus,
    "牌組": deck,
    "說明": desc,
    "card_type": "minor",
    "source_image": `G4m${imgNum}.jpg`,
    "grid_col": grid_col,
    "grid_row": grid_row
  };
  
  filteredCards.push(cardObj);
}

fs.writeFileSync('cards.json', JSON.stringify(filteredCards, null, 2), 'utf8');
console.log('Added ' + (lines.length - 1) + ' G4 minor cards!');
