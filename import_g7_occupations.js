const fs = require('fs');
const path = require('path');

const cardsPath = path.join(__dirname, 'cards.json');
const imagesDir = path.join(__dirname, 'images');
const sourceTextPath = process.env.G7_SOURCE_TEXT || 'C:\\Users\\User\\Downloads\\G7職業.txt';
const sourceImageDir = process.env.G7_SOURCE_IMAGE_DIR || 'D:\\農家樂卡牌\\2016新版\\TTS圖';
const writeMode = process.argv.includes('--write');

const sectionNamePattern = /^G7o\d+$/;
const cardPattern = /【([^】]+)】(.+?) 類型：(.+?) 需求人數：(.+?) 人 紅利：(.+?) 牌組：(.+?) 說明：([\s\S]*?)(?=\r?\n\r?\n【|$)/g;

function splitSections(text) {
  const sections = [];
  let current = null;

  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (sectionNamePattern.test(trimmed)) {
      if (current) sections.push(current);
      current = { name: trimmed, lines: [] };
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) sections.push(current);
  return sections;
}

function parseSections(sections) {
  const cards = [];
  const counts = [];

  for (const section of sections) {
    const body = section.lines.join('\n').trim();
    let position = 0;
    let match;

    cardPattern.lastIndex = 0;
    while ((match = cardPattern.exec(body)) !== null) {
      const [, id, name, type, players, bonus, deck, description] = match;
      cards.push({
        '牌名': name.trim(),
        '類型': type.trim(),
        '是否傳遞': '否',
        '紅利分數': bonus.trim(),
        '牌組': deck.trim(),
        '卡片ID': id.trim(),
        '說明': description.trim().replace(/\s+/g, ' '),
        card_type: 'occupation',
        source_image: `${section.name}.jpg`,
        position,
        grid_col: position % 3,
        grid_row: Math.floor(position / 3),
        grid_cols: 3,
        grid_rows: 3,
        '人數': players.trim(),
      });
      position += 1;
    }

    counts.push({ section: section.name, count: position });
  }

  return { cards, counts };
}

function cardKey(card) {
  return [card['卡片ID'], card.source_image, card.position].join('|');
}

function copyImages(sourceImages) {
  fs.mkdirSync(imagesDir, { recursive: true });

  for (const imageName of sourceImages) {
    const source = path.join(sourceImageDir, imageName);
    const target = path.join(imagesDir, imageName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing source image: ${source}`);
    }
    if (writeMode) fs.copyFileSync(source, target);
  }
}

const text = fs.readFileSync(sourceTextPath, 'utf8');
const sections = splitSections(text);
if (sections.length !== 12) {
  throw new Error(`Expected 12 image sections, got ${sections.length}`);
}

const { cards: importedCards, counts } = parseSections(sections);
for (const { section, count } of counts) {
  if (count < 1 || count > 9) {
    throw new Error(`${section} has ${count} cards; expected 1-9 cards per image.`);
  }
}

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const existingKeys = new Set(cards.map(cardKey));
const newCards = importedCards.filter(card => !existingKeys.has(cardKey(card)));
const sourceImages = [...new Set(importedCards.map(card => card.source_image))];

copyImages(sourceImages);

if (writeMode && newCards.length) {
  cards.push(...newCards);
  fs.writeFileSync(cardsPath, `${JSON.stringify(cards, null, 2)}\n`, 'utf8');
}

console.log(`Mode: ${writeMode ? 'write' : 'dry-run'}`);
console.log(`Sections: ${sections.length}`);
console.log(counts.map(({ section, count }) => `${section}: ${count}`).join('\n'));
console.log(`Parsed cards: ${importedCards.length}`);
console.log(`New cards: ${newCards.length}`);
console.log(`Images: ${sourceImages.length}`);
console.log('Samples:');
for (const card of importedCards.slice(0, 5)) {
  console.log(`${card.source_image} #${card.position}: ${card['卡片ID']} ${card['牌名']} (${card['牌組']})`);
}
