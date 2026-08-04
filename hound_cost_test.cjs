const fs = require('fs');
const assert = require('assert');

const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const hound = cards.find((card) => card['卡片ID'] === '9478');
assert(hound, 'cards.json 必須包含 9478 獵犬');
assert.equal(hound['牌名'], '獵犬');
assert.equal(hound['費用'], '無', '獵犬應為無費用');

const source = fs.readFileSync('add_g8m16_30.js', 'utf8');
assert(source.includes('c("9478","獵犬","第3季或之後打出","無"'),
  'G8 匯入來源也必須維持獵犬無費用，避免重建 cards.json 時復發');

console.log('獵犬費用檢查通過：cards.json 與 G8 匯入來源皆為無費用。');
