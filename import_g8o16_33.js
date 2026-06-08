const fs = require('fs');
const XLSX = require('xlsx');

const cards = JSON.parse(fs.readFileSync('./cards.json', 'utf8'));
const wb = XLSX.readFile('E:/Users/bboylu/Downloads/G8o16o32.xlsx');

const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
const dataRows = rows.slice(1); // skip header

function toStr(val) {
  if (val === null || val === undefined) return '無';
  return String(val).trim();
}

// 18 images: G8o16 ~ G8o33, 9 cards each
const startImg = 16;
let updated = 0, added = 0, skipped = 0;

dataRows.forEach((row, idx) => {
  const imgNum = startImg + Math.floor(idx / 9);
  const pos = idx % 9;
  const imgName = `G8o${imgNum}.jpg`;

  const id = toStr(row[0]);
  const name = toStr(row[1]);
  const type = toStr(row[2]);
  const players = toStr(row[3]);
  const bonus = toStr(row[4]);
  const deck = toStr(row[5]);
  const desc = toStr(row[6]);

  if (!id || id === '無') {
    console.log(`SKIP (no ID): ${name} in ${imgName} pos ${pos}`);
    skipped++;
    return;
  }

  const cardData = {
    牌名: name,
    類型: type,
    是否傳遞: '否',
    紅利分數: bonus,
    牌組: deck,
    卡片ID: id,
    說明: desc,
    card_type: 'occupation',
    source_image: imgName,
    position: pos,
    grid_col: pos % 3,
    grid_row: Math.floor(pos / 3),
    人數: players,
  };

  const existing = cards.findIndex(c => c['卡片ID'] === id);
  if (existing >= 0) {
    Object.assign(cards[existing], cardData);
    console.log(`UPDATE: ${name} (${id}) -> ${imgName}[${pos}]`);
    updated++;
  } else {
    cards.push(cardData);
    console.log(`ADD: ${name} (${id}) -> ${imgName}[${pos}]`);
    added++;
  }
});

fs.writeFileSync('./cards.json', JSON.stringify(cards, null, 2), 'utf8');
console.log(`\nDone: ${updated} updated, ${added} added, ${skipped} skipped. Total: ${cards.length}`);
