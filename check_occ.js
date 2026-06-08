const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const occupations = cards.filter(c => c.card_type === 'occupation' || c['類型'] === '職業卡');
const missing = occupations.filter(c => !c['人數']);
console.log('Total occupations: ' + occupations.length);
console.log('Missing 人數: ' + missing.length);
if (missing.length > 0) {
  console.log('First 10 missing:');
  missing.slice(0, 10).forEach(c => console.log(c['卡片ID'] + ' ' + c['牌名']));
}
