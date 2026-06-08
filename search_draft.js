const fs = require('fs');
const text = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_draft.md', 'utf8');
const searchStr = '第7版規則更改';
console.log('Index:', text.indexOf(searchStr));
