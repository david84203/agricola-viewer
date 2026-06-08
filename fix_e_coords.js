const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8').replace(/^\uFEFF/, ''));

for (const card of cards) {
  if (card['卡片ID'] === 'E026') { card.grid_col = 1; card.grid_row = 2; }
  if (card['卡片ID'] === 'E027') { card.grid_col = 2; card.grid_row = 2; }
  
  if (card['卡片ID'] === 'E047') { card.grid_col = 1; card.grid_row = 0; }
  if (card['卡片ID'] === 'E048') { card.grid_col = 2; card.grid_row = 0; }
  if (card['卡片ID'] === 'E049') { card.grid_col = 0; card.grid_row = 1; }
  if (card['卡片ID'] === 'E050') { card.grid_col = 1; card.grid_row = 1; }
  if (card['卡片ID'] === 'E051') { card.grid_col = 2; card.grid_row = 1; }
  if (card['卡片ID'] === 'E052') { card.grid_col = 0; card.grid_row = 2; }
  if (card['卡片ID'] === 'E053') { card.grid_col = 1; card.grid_row = 2; }
  if (card['卡片ID'] === 'E054') { card.grid_col = 2; card.grid_row = 2; }
  
  if (card['卡片ID'] === 'E059') { card.grid_col = 1; card.grid_row = 1; }
  if (card['卡片ID'] === 'E061') { card.grid_col = 0; card.grid_row = 2; }
  if (card['卡片ID'] === 'E062') { card.grid_col = 1; card.grid_row = 2; }
  if (card['卡片ID'] === 'E063') { card.grid_col = 2; card.grid_row = 2; }
}

fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2), 'utf8');
console.log("Updated E deck coordinates.");
