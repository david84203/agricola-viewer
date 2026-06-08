const fs = require('fs');

const files = ['app.js', 'draft.js', 'tierlist.js', 'list.js'];
let fixed = 0;

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes(`const isComposite = card.source_image.includes('部分.jpg');`)) {
      content = content.replace(
        `const isComposite = card.source_image.includes('部分.jpg');`, 
        `const isComposite = card.source_image.includes('部分.jpg') || card.source_image.includes('舊版');`
      );
      fs.writeFileSync(f, content);
      fixed++;
      console.log(`Fixed ${f}`);
    }
  }
});
console.log(`Total fixed: ${fixed}`);
