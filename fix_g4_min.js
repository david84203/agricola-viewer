const fs = require('fs');

const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8').replace(/^\uFEFF/, ''));
const oldG4m1Cards = JSON.parse(fs.readFileSync('g4m1_9cards.json', 'utf8'));

// Filter out G4 minor cards
const nonG4Minors = cards.filter(c => !(c['牌組'] === 'G4' && c.card_type === 'minor'));
const myG4Minors = cards.filter(c => c['牌組'] === 'G4' && c.card_type === 'minor');

// Find and remove 1 copy of the duplicates
const seen = new Set();
const dedupedG4Minors = [];
for (const c of myG4Minors) {
  if (seen.has(c['牌名'])) {
    console.log('Removed duplicate:', c['牌名']);
    continue;
  }
  seen.add(c['牌名']);
  dedupedG4Minors.push(c);
}

// Combine: the 9 old cards first, then the 50 new ones
let finalG4Minors = [...oldG4m1Cards, ...dedupedG4Minors];

// Reassign grid positions
finalG4Minors = finalG4Minors.map((c, index) => {
  const imgNum = Math.floor(index / 9) + 1;
  const grid_row = Math.floor((index % 9) / 3);
  const grid_col = (index % 9) % 3;
  return {
    ...c,
    source_image: `G4m${imgNum}.jpg`,
    grid_row: grid_row,
    grid_col: grid_col
  };
});

const finalCards = [...nonG4Minors, ...finalG4Minors];

fs.writeFileSync('cards.json', JSON.stringify(finalCards, null, 2), 'utf8');
console.log(`Re-aligned G4 minors! Total cards: ${finalG4Minors.length}`);
