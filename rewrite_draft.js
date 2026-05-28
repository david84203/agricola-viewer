const fs = require('fs');
const d = JSON.parse(fs.readFileSync('cards.json'));
const newlyAdded = d.filter(c => c.position === undefined);

let md = '# 卡牌匯入草稿 (新增的 53 張卡牌)\n\n以下是排除掉系統內已經有的重複卡牌後，真正新增的 53 張卡牌。請幫我過目一下格式與內容是否有誤：\n\n## 次要發展卡\n| 卡片ID | 牌名 | 先決條件 | 費用 | 是否傳遞 | 勝利點數 | 紅利分數 | 牌組 | 說明 |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

newlyAdded.filter(c => c['類型'] === '次要發展卡').forEach(c => {
  md += `| ${c['卡片ID']} | ${c['牌名']} | ${c['先決條件']} | ${c['費用']} | ${c['是否傳遞']} | ${c['勝利點數']} | ${c['紅利分數']} | ${c['牌組']} | ${c['說明']} |\n`;
});

md += '\n## 職業卡\n| 卡片ID | 牌名 | 是否傳遞 | 紅利分數 | 牌組 | 說明 |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n';

newlyAdded.filter(c => c['類型'] === '職業卡').forEach(c => {
  md += `| ${c['卡片ID']} | ${c['牌名']} | ${c['是否傳遞']} | ${c['紅利分數']} | ${c['牌組']} | ${c['說明']} |\n`;
});

fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/imported_cards_draft.md', md);
console.log('Draft rewritten with 53 cards.');
