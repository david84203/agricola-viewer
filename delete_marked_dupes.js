const fs = require('fs');

const deletions = [
  "牧羊", "牧羊", "牧羊", "牧羊",
  "採", "販", "蘆葦",
  "模板", "模板", "麵包",
  "村井", "村井", "村井", "村井", "村井", "村井",
  "草莓", "草莓", "草莓", "田", "草莓",
  "鵝", "鵝", "塘", "鵝", "鵝",
  "小麥", "小麥", "擴建", 
  "雞舍 (I084)", "雞舍", "雞舍",
  "烹飪", "交換", "水車"
];

let md = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/duplicates_list.md', 'utf8');
let currentIndex = 0;

for (const sel of deletions) {
  let foundIndex = md.indexOf(sel, currentIndex);
  if (foundIndex === -1) {
    foundIndex = md.indexOf(sel, 0); // fallback
  }
  
  if (foundIndex !== -1) {
    // Find the line boundaries
    let lineStart = md.lastIndexOf('\n', foundIndex) + 1;
    let lineEnd = md.indexOf('\n', foundIndex);
    if (lineEnd === -1) lineEnd = md.length;
    else lineEnd += 1; // include newline
    
    const line = md.substring(lineStart, lineEnd);
    console.log(`Deleting line: ${line.trim()}`);
    
    md = md.substring(0, lineStart) + md.substring(lineEnd);
    currentIndex = lineStart;
  } else {
    console.log(`Could not find: ${sel}`);
  }
}

fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/duplicates_list.md', md);
console.log('Duplicates filtered.');
