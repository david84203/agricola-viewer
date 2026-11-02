const fs = require('fs');
const assert = require('assert');

// 卡圖右上角費用：兩組圖示中間畫斜線＝二擇一（/），直排沒斜線＝都要付（+）。
// 以下卡片卡圖是直排沒斜線，卡表曾誤登成「/」（1102 房 Y2UY 回報產蛋箱，玩家只付 2 木就打出）。
// 每筆：[卡片ID, 牌名, 正確費用, 匯入原始檔]
const FIXED = [
  ['10565-5', '產蛋箱', '2木+1麥', 'import_g8m49_66.js'],
];

const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const profile = fs.readFileSync('card-profile.json', 'utf8');

for (const [id, name, cost, src] of FIXED) {
  const card = cards.find((c) => c['卡片ID'] === id);
  assert(card, `cards.json 必須包含 ${id} ${name}`);
  assert.equal(card['牌名'], name);
  assert.equal(card['費用'], cost, `${name} 費用應為 ${cost}（卡圖無斜線＝都要付）`);
  const line = profile.split('\n').find((l) => l.includes(`"${id}":`));
  assert(line && line.includes(`"face":"${cost}"`), `card-profile.json 的 ${name} face 應為 ${cost}`);
  const source = fs.readFileSync(src, 'utf8');
  assert(source.includes(`'${id}','${name}',`) && source.includes(`'${cost}'`),
    `${src} 也要改成 ${cost}，避免重建 cards.json 時復發`);
}

console.log(`費用「且／或」檢查通過：${FIXED.length} 張與卡圖一致。`);
