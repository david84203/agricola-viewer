const fs = require('fs');

const findGridLogic = () => {
  const files = ['list.html', 'list.js', 'app.js', 'index.html'];
  for (const f of files) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      const idx = content.indexOf('grid_col');
      if (idx !== -1) {
        console.log(`\nFound in ${f}:`);
        const start = Math.max(0, idx - 200);
        const end = Math.min(content.length, idx + 400);
        console.log(content.substring(start, end));
      }
    }
  }
};

findGridLogic();
