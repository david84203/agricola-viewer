const fs = require('fs');

const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));
const eMinorCards = cards.filter(c => c.牌組 === '舊版E' && c.card_type === 'minor');

let md = `# 舊版E 牌組 - 次要發展卡 (錯誤修正審閱)\n\n`;
md += `| 卡片 ID | 牌名 | 類型 | 先決條件 | 費用 | 是否傳遞 | 勝利點數 | 紅利分數 | 牌組 | 說明 |\n`;
md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

eMinorCards.sort((a, b) => {
  const idA = a.卡片ID.replace(/[^0-9]/g, '');
  const idB = b.卡片ID.replace(/[^0-9]/g, '');
  return parseInt(idA) - parseInt(idB);
});

eMinorCards.forEach(c => {
  md += `| **${c.卡片ID}** | ${c.牌名} | ${c.類型} | ${c.需求人數 || c.先決條件 || '無'} | ${c.費用} | ${c.是否傳遞} | ${c.勝利點數} | ${c.紅利分數} | ${c.牌組} | ${c.說明} |\n`;
});

fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/E_Minor_Review.md', md);
console.log(`Exported ${eMinorCards.length} cards.`);
