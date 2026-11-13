// Lu 1113 裁定：秋季母親 C092 與小鎮姑娘 Z325 算同一張，保留 Z325（重複表 n235）。
const assert = require('assert');
global.window = global;
global.localStorage = { getItem: () => null, setItem() {} };
require('./duplicate-utils.js');
const U = Object.values(global).find(v => v && typeof v.buildDuplicateInfo === 'function');
const cards = require('./cards.json');
const pairs = require('./duplicates.json');

const info = U.buildDuplicateInfo(cards, pairs, {});
const keyOf = id => {
  const c = cards.find(x => x['卡片ID'] === id);
  assert.ok(c, `cards.json 找不到 ${id}`);
  return [id, c.source_image || '', c.position ?? ''].join('|');
};
assert.ok(info.nonCanonicalKeys.has(keyOf('C092')), '秋季母親 C092 應被排除');
assert.ok(!info.nonCanonicalKeys.has(keyOf('Z325')), '小鎮姑娘 Z325 應保留');
console.log('PASS 2 / FAIL 0');
