const fs = require('fs');
const XLSX = require('xlsx');

const cards = JSON.parse(fs.readFileSync('./cards.json', 'utf8'));
const wb = XLSX.readFile('E:/Users/bboylu/Downloads/G8m31m21.xlsx');

function parseRow(row, headers) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] ?? null; });
  return obj;
}

function toStr(val) {
  if (val === null || val === undefined) return '無';
  return String(val);
}

let updated = 0;
let added = 0;

// ── Sheet1: G8m31/32 cards (18 cards, match by 牌名 + source order)
{
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Order in xlsx matches order in cards.json for G8m31/32
  const g8Targets = cards.filter(c => c.source_image === 'G8m31.jpg' || c.source_image === 'G8m32.jpg')
    .sort((a, b) => {
      const imgOrder = ['G8m31.jpg', 'G8m32.jpg'];
      const ai = imgOrder.indexOf(a.source_image) * 10 + a.position;
      const bi = imgOrder.indexOf(b.source_image) * 10 + b.position;
      return ai - bi;
    });

  dataRows.forEach((row, i) => {
    const r = parseRow(row, headers);
    const target = g8Targets[i];
    if (!target) { console.log(`No target for Sheet1 row ${i + 1}`); return; }

    // Skip duplicate ID issue: if xlsx ID conflicts with another card's ID, keep original
    const xlsxId = toStr(r['卡片 ID']);
    const idConflict = xlsxId !== toStr(target['卡片ID']) && cards.find(c => c['卡片ID'] === xlsxId);
    if (!idConflict && xlsxId && xlsxId !== '無') {
      target['卡片ID'] = xlsxId;
    }

    target['先決條件'] = toStr(r['先決條件']);
    target['費用'] = toStr(r['費用']);
    target['是否傳遞'] = toStr(r['是否傳遞']);
    target['勝利點數'] = r['勝利點數'] !== null && r['勝利點數'] !== '' && r['勝利點數'] !== '無'
      ? `${r['勝利點數']}分` : '無';
    target['紅利分數'] = toStr(r['紅利分數']);
    target['說明'] = toStr(r['說明']);
    updated++;
    console.log(`Sheet1 updated: ${target['牌名']} (${target['卡片ID']})`);
  });
}

// ── Sheet2: G4 cards, deduplicate by 卡片ID (last wins)
{
  const ws = wb.Sheets[wb.SheetNames[1]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Deduplicate: last occurrence wins
  const deduped = new Map();
  dataRows.forEach(row => {
    const id = toStr(row[0]);
    deduped.set(id, row);
  });

  deduped.forEach((row, id) => {
    const r = parseRow(row, headers);
    const existing = cards.find(c => c['卡片ID'] === id);

    if (existing) {
      existing['先決條件'] = toStr(r['先決條件']);
      existing['費用'] = toStr(r['費用']);
      existing['是否傳遞'] = toStr(r['是否傳遞']);
      existing['勝利點數'] = r['勝利點數'] !== null && r['勝利點數'] !== '' && r['勝利點數'] !== '無'
        ? `${r['勝利點數']}分` : '無';
      existing['紅利分數'] = toStr(r['紅利分數']);
      existing['牌組'] = toStr(r['牌組']);
      existing['說明'] = toStr(r['說明']);
      updated++;
      console.log(`Sheet2 updated: ${existing['牌名']} (${id})`);
    } else {
      // New card without image info
      cards.push({
        牌名: toStr(r['牌名']),
        類型: toStr(r['類型']),
        先決條件: toStr(r['先決條件']),
        費用: toStr(r['費用']),
        是否傳遞: toStr(r['是否傳遞']),
        勝利點數: r['勝利點數'] !== null && r['勝利點數'] !== '' && r['勝利點數'] !== '無'
          ? `${r['勝利點數']}分` : '無',
        紅利分數: toStr(r['紅利分數']),
        牌組: toStr(r['牌組']),
        卡片ID: id,
        說明: toStr(r['說明']),
        card_type: 'minor',
        source_image: null,
        position: null,
        grid_col: null,
        grid_row: null,
      });
      added++;
      console.log(`Sheet2 added new: ${r['牌名']} (${id})`);
    }
  });
}

fs.writeFileSync('./cards.json', JSON.stringify(cards, null, 2), 'utf8');
console.log(`\nDone: ${updated} updated, ${added} added. Total: ${cards.length}`);
