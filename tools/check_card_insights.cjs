// 檢查 card-insights.json：每個鍵都要是 cards.json／reference-cards.json 裡的卡片ID，值是非空字串。
// 改講評檔後必跑：node tools/check_card_insights.cjs
const path = require('path');
const root = path.join(__dirname, '..');
const insights = require(path.join(root, 'card-insights.json'));
const ids = new Set(require(path.join(root, 'cards.json')).concat(require(path.join(root, 'reference-cards.json'))).map((c) => String(c['卡片ID']).trim()));
const bad = Object.entries(insights).filter(([id, text]) => !ids.has(id) || typeof text !== 'string' || !text.trim());
if (bad.length) {
  console.error('有問題的講評：\n' + bad.map(([id]) => `  ${id}${ids.has(id) ? '：內容空白' : '：找不到這個卡片ID'}`).join('\n'));
  process.exit(1);
}
console.log(`card-insights.json OK：${Object.keys(insights).length} 張`);
