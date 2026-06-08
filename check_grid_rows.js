const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const i_occ1 = cards.find(c => c.source_image === 'I職業1.jpg');
console.log('I職業1 grid_rows:', i_occ1.grid_rows);
