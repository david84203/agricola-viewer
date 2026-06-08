const fs = require('fs');

const wmMinors = require('./temp_wm_minors.js');
const cardsJson = JSON.parse(fs.readFileSync('./cards.json', 'utf8'));

// Wmm7 positions based on manual transcription
const wmm7Positions = {
  "WM079": { r: 0, c: 0 },
  "WM091": { r: 1, c: 0 },
  "WM111": { r: 2, c: 0 },
  "WM112": { r: 2, c: 1 }
};

let currentImgIndex = 1;
let currentCardInImg = 0;

for (let i = 0; i < wmMinors.length; i++) {
  const card = wmMinors[i];
  
  card["卡片ID"] = card.id;
  card["牌名"] = card.name;
  card["類型"] = card.type;
  card["先決條件"] = card.req;
  card["費用"] = card.cost;
  card["是否傳遞"] = card.pass;
  card["勝利點數"] = card.pts;
  card["紅利分數"] = card.bonus;
  card["牌組"] = card.deck;
  card["說明"] = card.desc;
  
  delete card.id;
  delete card.name;
  delete card.type;
  delete card.req;
  delete card.cost;
  delete card.pass;
  delete card.pts;
  delete card.bonus;
  delete card.deck;
  delete card.desc;

  card.card_type = "minor";
  card.grid_cols = 3;
  card.grid_rows = 3;

  if (currentImgIndex <= 6) {
    card.source_image = `Wmm${currentImgIndex}.jpg`;
    card.grid_row = Math.floor(currentCardInImg / 3);
    card.grid_col = currentCardInImg % 3;
    
    currentCardInImg++;
    if (currentCardInImg >= 9) {
      currentCardInImg = 0;
      currentImgIndex++;
    }
  } else {
    // Wmm7
    card.source_image = "Wmm7.jpg";
    const pos = wmm7Positions[card["卡片ID"]];
    if (pos) {
      card.grid_row = pos.r;
      card.grid_col = pos.c;
    } else {
      console.error("Unknown position for card in Wmm7:", card["卡片ID"]);
    }
  }

  // Check if card already exists
  const existsIndex = cardsJson.findIndex(c => c["卡片ID"] === card["卡片ID"] || c["牌名"] === card["牌名"]);
  if (existsIndex >= 0) {
    console.log(`Card ${card["卡片ID"]} (${card["牌名"]}) already exists. Overwriting...`);
    cardsJson[existsIndex] = card;
  } else {
    cardsJson.push(card);
  }
}

fs.writeFileSync('./cards.json', JSON.stringify(cardsJson, null, 2), 'utf8');
console.log(`Successfully processed ${wmMinors.length} minor improvements and updated cards.json`);
