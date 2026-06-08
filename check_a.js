const fs = require('fs');
const cards = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const aCards = cards.filter(c => c.source_image === 'A次發部分.jpg');
if (aCards.length > 0) {
    console.log('A次發部分.jpg Sample:');
    console.log(aCards[0]);
} else {
    console.log('No A次發部分.jpg cards found.');
}
