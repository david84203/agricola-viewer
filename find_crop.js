const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');
const lines = appJs.split('\n');
const start = lines.findIndex(l => l.includes('const CROP'));
if (start !== -1) {
  console.log(lines.slice(start, start + 10).join('\n'));
}
