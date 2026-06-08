const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');
const lines = appJs.split('\n');
const start = lines.findIndex(l => l.includes('function renderCanvases'));
if (start !== -1) {
  console.log(lines.slice(start, start + 30).join('\n'));
} else {
  // Try another approach
  const imgCacheIdx = appJs.indexOf('const imgCache = {};');
  if (imgCacheIdx !== -1) {
    console.log(appJs.substring(imgCacheIdx, imgCacheIdx + 1500));
  }
}
