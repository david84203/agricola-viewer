const fs = require('fs');

const occDraft = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/z_occupations_draft.md', 'utf8');
const minDraft = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/z_minors_draft.md', 'utf8');

const parseTable = (md, type) => {
    const lines = md.split('\n');
    let data = [];
    let parsing = false;
    for (let line of lines) {
        if (line.startsWith('| 卡片 ID')) {
            parsing = true;
            continue;
        }
        if (parsing && line.startsWith('| :---')) continue;
        if (parsing && line.startsWith('|')) {
            const cols = line.split('|').map(s => s.trim()).filter(s => s !== '');
            if (cols.length < 10 && type === 'minor') continue; // safety check
            
            if (type === 'minor') {
                data.push({
                    '卡片ID': cols[0],
                    '牌名': cols[1],
                    '類型': cols[3],
                    '先決條件': cols[4],
                    '費用': cols[5],
                    '是否傳遞': cols[6],
                    '勝利點數': cols[7],
                    '紅利分數': cols[8],
                    '牌組': cols[9],
                    '說明': cols[10],
                    'card_type': 'minor'
                });
            } else {
                data.push({
                    '卡片ID': cols[0],
                    '牌名': cols[1],
                    '類型': cols[3],
                    '先決條件': cols[4],
                    '費用': '無',
                    '是否傳遞': '否',
                    '勝利點數': '無',
                    '紅利分數': '無',
                    '牌組': 'Z',
                    '說明': cols[5],
                    'card_type': 'occupation'
                });
            }
        } else if (parsing) {
            parsing = false; // end of table
        }
    }
    return data;
};

const occCards = parseTable(occDraft, 'occupation');
const minCards = parseTable(minDraft, 'minor');

console.log("Parsed " + occCards.length + " Occupations and " + minCards.length + " Minors.");

let cardsJson = JSON.parse(fs.readFileSync('cards.json', 'utf8').replace(/^\uFEFF/, ''));

// Filter out old Z cards if they existed to prevent duplicates
cardsJson = cardsJson.filter(c => !c['卡片ID'].startsWith('Z3'));

// Assign grid positions for Minors
minCards.forEach((c, i) => {
    const sheetIdx = Math.floor(i / 9) + 1;
    const localIdx = i % 9;
    c.grid_cols = 3;
    c.grid_rows = 3;
    c.source_image = "Zm" + sheetIdx + ".jpg";
    c.grid_col = localIdx % 3;
    c.grid_row = Math.floor(localIdx / 3);
    cardsJson.push(c);
});

// Assign grid positions for Occupations
occCards.forEach((c, i) => {
    const sheetIdx = Math.floor(i / 9) + 1;
    const localIdx = i % 9;
    c.grid_cols = 3;
    c.grid_rows = 3;
    c.source_image = "Zo" + sheetIdx + ".jpg";
    c.grid_col = localIdx % 3;
    c.grid_row = Math.floor(localIdx / 3);
    cardsJson.push(c);
});

fs.writeFileSync('cards.json', JSON.stringify(cardsJson, null, 2), 'utf8');
console.log('Successfully written to cards.json!');
