// 重複卡排除口徑（Lu 1120）：輪抽／排序／覆盤一律用 nonCanonicalKeys，
// 鎖住兩個舊 bug：①正主存成精確 key（ID|圖|位置）時，舊的 excludedRefs 把正主本身也排除
// ②管理頁存的精確配對，覆盤只拿 ID 查而排不掉
const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.window = globalThis;
require('./duplicate-utils.js');

const cards = [
  { '卡片ID': 'X1', source_image: 'x.jpg', position: 1 },
  { '卡片ID': 'Y1', source_image: 'y.jpg', position: 2 },
  { '卡片ID': 'P1', source_image: 'p.jpg', position: 3 },
  { '卡片ID': 'Q1', source_image: 'q.jpg', position: 4 },
];
const pairs = [
  { id: 'n1', type: 'name', cards: ['X1', 'Y1'], defaultCanonical: 'X1|x.jpg|1' }, // ①
  { id: 'c1', type: 'custom', cards: ['P1|p.jpg|3', 'Q1|q.jpg|4'], defaultCanonical: 'P1|p.jpg|3' }, // ②
];
const info = DuplicateCards.buildDuplicateInfo(cards, pairs, { picked: {}, dismissed: [], custom: [] });
const excludedIds = cards.filter(c => info.nonCanonicalKeys.has(DuplicateCards.getCardKey(c))).map(c => c['卡片ID']);
assert.deepStrictEqual(excludedIds.sort(), ['Q1', 'Y1'], '只排除被取代的那張，正主保留');
assert.ok(info.excludedRefs.has('X1'), '前提：舊口徑 excludedRefs 會誤含正主 X1（所以不能再用它）');

for (const f of ['draft.js', 'rank.js', 'review.js']) {
  const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  assert.ok(!/\.excludedRefs/.test(src), `${f} 不應再用 excludedRefs`);
  assert.ok(/\.nonCanonicalKeys/.test(src), `${f} 應改用 nonCanonicalKeys`);
}
console.log('dup_precise_canon_test: 全部通過');
