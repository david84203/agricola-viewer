
const fs = require('fs');
const uuid = require('crypto').randomUUID;

function parseMarkdownTable(filepath, ctypeBase) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    const tableLines = lines.filter(l => l.startsWith('|'));
    if (tableLines.length < 3) return [];
    
    const data = [];
    for (let i = 2; i < tableLines.length; i++) {
        const cols = tableLines[i].split('|').map(c => c.trim()).slice(1, -1);
        if (cols.length < 11) continue;
        
        const card_id = cols[0];
        const name = cols[1];
        const eng_name = cols[2];
        const ctype = cols[3];
        const prereq = cols[4];
        const cost = cols[5];
        const passing = cols[6];
        const vp = cols[7];
        const bonus = cols[8];
        const deck = cols[9];
        const desc = cols[10];
        
        let imgName = '';
        if (ctype === '次要發展') {
            const num = (i - 2); 
            const sheet = Math.floor(num / 9) + 1;
            imgName = 'images/Om' + sheet + '.jpg';
        } else {
            const num = (i - 2); 
            const sheet = Math.floor(num / 9) + 1;
            imgName = 'images/Oo' + sheet + '.jpg';
        }
        
        const card = {
            id: card_id,
            name: name,
            description: desc,
            type: ctype,
            deck: deck,
            uuid: uuid(),
            source_image: imgName,
            grid_cols: 3,
            grid_rows: 3,
            image_index: (i - 2) % 9
        };
        
        if (ctype === '次要發展') {
            card.cost = cost !== '無' ? cost : '';
            card.vp = vp !== '無' ? parseInt(vp, 10) || vp : 0;
            card.passing = passing === '是';
            card.bonusPoints = bonus === '有';
            if (prereq !== '無') card.prerequisite = prereq;
        } else {
            if (prereq !== '無') card.prerequisite = prereq;
            card.passing = passing === '是';
            card.bonusPoints = bonus === '有';
        }
        data.push(card);
    }
    return data;
}

const minors = parseMarkdownTable('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/o_minors_draft.md', '次要發展');
const occs = parseMarkdownTable('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/o_occs_draft.md', '職業');

const allNew = [...minors, ...occs];

const jsonPath = 'cards.json';
let cards = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
cards = cards.concat(allNew);
fs.writeFileSync(jsonPath, JSON.stringify(cards, null, 2), 'utf-8');
console.log('Imported ' + allNew.length + ' cards into cards.json');

