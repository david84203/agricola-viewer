const fs = require('fs');
let md = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_draft.md', 'utf8');

const lines = md.split('\\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes('| **I072a** | 渡假小屋 |')) {
    line = line.replace('I072a', 'I072');
  } else if (line.includes('| **I072b** | 鵝塘 |') || line.includes('| **I072b** | 鵝卵 |')) {
    line = line.replace('I072b', 'I073');
  } else if (line.match(/\\| \\*\\*I(0[7-9][0-9]|10[0-4])\\*\\* \\|/)) {
    // shift everything from 073 to 104 up by 1
    line = line.replace(/\\| \\*\\*I(0[7-9][0-9]|10[0-4])\\*\\* \\|/, (match, idStr) => {
      if (parseInt(idStr) >= 73) {
        let num = parseInt(idStr) + 1;
        return `| **I${num.toString().padStart(3, '0')}** |`;
      }
      return match;
    });
  }
  lines[i] = line;
}

fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_draft.md', lines.join('\\n'));
console.log('Fixed IDs.');
