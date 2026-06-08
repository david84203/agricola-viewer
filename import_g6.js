const fs = require('fs');

const cardsFile = 'cards.json';
const cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8').replace(/^\uFEFF/, ''));

// Remove old G6 minor/occ if they exist
const filteredCards = cards.filter(c => !(c['牌組'] && c['牌組'].startsWith('G6')));

// --- Import Minor Devs from markdown ---
const minorDraftPath = 'C:\\\\Users\\\\bboylu\\\\.gemini\\\\antigravity\\\\brain\\\\d83e9263-c468-4d3e-a9f4-014d95662753\\\\artifacts\\\\g6_cards_draft.md';
const minorText = fs.readFileSync(minorDraftPath, 'utf8');
const minorLines = minorText.split('\n').map(l => l.trim());

let currentImgMinor = 0;
let minorIndex = 0;
let addedMinors = 0;

for (let line of minorLines) {
  if (line.startsWith('## 來源圖片: G6m')) {
    const match = line.match(/G6m(\d+)/);
    if (match) {
      currentImgMinor = parseInt(match[1]);
      minorIndex = 0; // reset index per image
    }
  } else if (line.match(/^\d+-?\d* \|/)) {
    const parts = line.split(' | ');
    if (parts.length >= 10) {
      const id = parts[0].trim();
      const name = parts[1].trim();
      const type = parts[2].trim();
      const req = parts[3].trim();
      const cost = parts[4].trim();
      const pass = parts[5].trim();
      const vp = parts[6].trim();
      const bonus = parts[7].trim();
      const deck = parts[8].trim();
      const desc = parts[9].trim();

      const grid_row = Math.floor(minorIndex / 3);
      const grid_col = minorIndex % 3;

      const cardObj = {
        "卡片ID": id,
        "牌名": name,
        "類型": "次要發展卡", // Standardize type
        "先決條件": req === "無" || req === "—" || !req ? "" : req,
        "費用": cost === "無" || cost === "—" || !cost ? "" : cost,
        "是否傳遞": pass === "是" ? "是" : "否",
        "勝利點數": vp === "無" || vp === "—" || !vp ? "" : vp,
        "紅利分數": bonus === "無" || !bonus ? "" : bonus,
        "牌組": deck,
        "說明": desc,
        "card_type": "minor",
        "source_image": `G6m${currentImgMinor}.jpg`,
        "grid_col": grid_col,
        "grid_row": grid_row
      };
      filteredCards.push(cardObj);
      minorIndex++;
      addedMinors++;
    }
  }
}

// --- Import Approved Occupations ---
// We will use the exact text the user provided, which maps to G6o5 ~ G6o10.
const occRaw = fs.readFileSync('G6_occ_approved.txt', 'utf8').trim();
const occLines = occRaw.split('\n').map(l => l.trim()).filter(l => l);

const imgMapping = [
  { img: 5, count: 9 },
  { img: 6, count: 9 },
  { img: 7, count: 9 },
  { img: 8, count: 9 },
  { img: 9, count: 9 },
  { img: 10, count: 2 }
];

let lineIdx = 1; // skip header
let addedOccs = 0;

for (let mapping of imgMapping) {
  let imgNum = mapping.img;
  let occIndex = 0; // reset per image
  for (let i = 0; i < mapping.count; i++) {
    if (lineIdx >= occLines.length) break;
    const line = occLines[lineIdx];
    const parts = line.split('\t');
    if (parts.length >= 7) {
      const id = parts[0].trim();
      const name = parts[1].trim();
      const type = parts[2].trim();
      const req = parts[3].trim();
      const bonus = parts[4].trim();
      const deck = parts[5].trim();
      const desc = parts[6].trim();

      const grid_row = Math.floor(occIndex / 3);
      const grid_col = occIndex % 3;

      const cardObj = {
        "卡片ID": id,
        "牌名": name,
        "類型": "職業卡", // Standardize
        "需求人數": req === "—" || !req ? "" : req,
        "紅利分數": bonus === "無" || !bonus ? "" : bonus,
        "牌組": deck,
        "說明": desc,
        "card_type": "occupation",
        "source_image": `G6o${imgNum}.jpg`,
        "grid_col": grid_col,
        "grid_row": grid_row,
        "人數": req === "—" || !req ? "" : req
      };
      filteredCards.push(cardObj);
      occIndex++;
      addedOccs++;
    }
    lineIdx++;
  }
}

fs.writeFileSync(cardsFile, JSON.stringify(filteredCards, null, 2), 'utf8');
console.log(`Successfully added ${addedMinors} minor cards and ${addedOccs} occupation cards.`);
