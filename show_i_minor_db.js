const fs = require('fs');

const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const iMinors = cards.filter(c => c.牌組 === 'I' && c.card_type === 'minor');

let md = `# I牌組 - 次要發展卡 (目前資料庫內容)\n\n`;
md += `以下是目前資料庫中「I牌組次要發展卡」的實際內容，請確認各項數值是否正確更新：\n\n`;
md += `| 卡片 ID | 牌名 | 先決條件 | 費用 | 是否傳遞 | 勝利點數 | 紅利分數 | 說明 |\n`;
md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

iMinors.forEach(c => {
  md += `| **${c.卡片ID}** | ${c.牌名} | ${c.先決條件} | ${c.費用} | ${c.是否傳遞} | ${c.勝利點數} | ${c.紅利分數} | ${c.說明} |\n`;
});

fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_DB_Review.md', md);
console.log('Generated DB review artifact.');
