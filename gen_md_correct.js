const fs = require('fs');
const w = require('./temp_wm_minors.js');
let md = '# Wm 次要發展卡草稿\n\n';
md += '| 卡片 ID | 牌名 | 類型 | 先決條件 | 費用 | 是否傳遞 | 勝利點數 | 紅利分數 | 牌組 | 說明 |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';
w.forEach(c => {
  md += `| ${c.id} | ${c.name} | ${c.type} | ${c.req} | ${c.cost} | ${c.pass} | ${c.pts} | ${c.bonus} | ${c.deck} | ${c.desc} |\n`;
});
fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/wm_minors_draft.md', md, 'utf8');
console.log('Done');
