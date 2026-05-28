/**
 * fix_grid.js
 * 針對 cards.json 中缺少 position / grid_col / grid_row 的卡牌，
 * 依照同一張 source_image 中已佔用的格子，將剩餘格子依序分配。
 */

const fs = require('fs');
const path = require('path');

const cardsPath = path.join(__dirname, 'cards.json');
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// 計算每張 source_image 已使用的 position 集合
const takenPositions = {};
for (const c of cards) {
  if (c.source_image && typeof c.grid_col === 'number' && typeof c.grid_row === 'number') {
    const pos = c.grid_row * 3 + c.grid_col;
    if (!takenPositions[c.source_image]) takenPositions[c.source_image] = new Set();
    takenPositions[c.source_image].add(pos);
  }
}

// 找出待補的卡
const toFix = cards.filter(c => c.source_image && typeof c.grid_col !== 'number');

// 依 source_image 分組
const groups = {};
for (const c of toFix) {
  if (!groups[c.source_image]) groups[c.source_image] = [];
  groups[c.source_image].push(c);
}

let fixed = 0;
for (const [img, group] of Object.entries(groups)) {
  const taken = takenPositions[img] || new Set();
  // 找出未使用的位置（0~8）
  const available = [];
  for (let i = 0; i < 9; i++) {
    if (!taken.has(i)) available.push(i);
  }

  console.log(`\n📄 ${img}: ${group.length} 張待補，可用格子: [${available.join(', ')}]`);

  for (let i = 0; i < group.length; i++) {
    if (i >= available.length) {
      console.warn(`  ⚠ 格子不夠！${group[i]['卡片ID']} 無法分配`);
      continue;
    }
    const pos = available[i];
    group[i].position = pos;
    group[i].grid_col = pos % 3;
    group[i].grid_row = Math.floor(pos / 3);
    console.log(`  ✓ ${group[i]['卡片ID']} → position ${pos} (col=${group[i].grid_col}, row=${group[i].grid_row})`);
    fixed++;
  }
}

fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2), 'utf8');
console.log(`\n✅ 完成！共補齊 ${fixed} 張卡牌的 grid 資訊。`);
