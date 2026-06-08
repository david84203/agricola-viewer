const fs = require('fs');

const dupes = JSON.parse(fs.readFileSync('duplicates_occ3.json', 'utf8'));
if (dupes.length === 0) return;

let appendStr = '';
dupes.forEach(d => {
  appendStr += `| **${d.newCard['牌名']}** (${d.newCard['卡片ID']}) | ${d.reason} | ${d.existCard['牌名']} (${d.existCard['卡片ID']}) |\n`;
});

fs.appendFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/duplicates_list.md', appendStr);
console.log('Appended to duplicates_list.md');
