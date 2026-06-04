const fs = require('fs');
const path = require('path');

const cardsPath = path.join(__dirname, 'cards.json');
const imagesDir = path.join(__dirname, 'images');
const sourceMarkdownPath = process.env.G8_SOURCE_MD || 'C:\\Users\\User\\Downloads\\chatgpt-_43.md';
const sourceImageDir = process.env.G8_SOURCE_IMAGE_DIR || 'D:\\農家樂卡牌\\2016新版\\中文化';

function cardTypeValue(label) {
  if (label === '職業卡') return 'occupation';
  if (label === '次要發展卡') return 'minor';
  return label;
}

function parseMarkdownTable(markdown) {
  const cards = [];
  const groupCounts = new Map();
  let currentImage = null;
  let position = 0;

  for (const line of markdown.split(/\r?\n/)) {
    const groupMatch = line.match(/^\| \*\*(G8o\d+)\*\* \|/);
    if (groupMatch) {
      currentImage = groupMatch[1];
      position = 0;
      groupCounts.set(currentImage, 0);
      continue;
    }

    if (!currentImage || !line.startsWith('|')) continue;
    if (line.includes(':---') || line.includes('卡片 ID')) continue;

    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.length !== 7) {
      throw new Error(`Unexpected table row format: ${line}`);
    }

    const [id, name, type, players, bonus, deck, description] = cells;
    const sourceImage = `${currentImage}.jpg`;
    cards.push({
      '牌名': name,
      '類型': type,
      '是否傳遞': '否',
      '紅利分數': bonus,
      '牌組': deck,
      '卡片ID': id,
      '說明': description,
      card_type: cardTypeValue(type),
      source_image: sourceImage,
      position,
      grid_col: position % 3,
      grid_row: Math.floor(position / 3),
      '人數': players,
    });

    groupCounts.set(currentImage, groupCounts.get(currentImage) + 1);
    position += 1;
  }

  const expectedImages = Array.from({ length: 14 }, (_, idx) => `G8o${idx + 33}`);
  const missingImages = expectedImages.filter(image => !groupCounts.has(image));
  const badCounts = [...groupCounts.entries()].filter(([, count]) => count !== 9);

  if (missingImages.length) {
    throw new Error(`Missing image groups: ${missingImages.join(', ')}`);
  }
  if (badCounts.length) {
    throw new Error(`Expected 9 cards per image, got: ${JSON.stringify(badCounts)}`);
  }
  if (cards.length !== 126) {
    throw new Error(`Expected 126 cards, got ${cards.length}`);
  }

  return cards;
}

function copyImages(sourceImages) {
  fs.mkdirSync(imagesDir, { recursive: true });

  for (const imageName of sourceImages) {
    const source = path.join(sourceImageDir, imageName);
    const target = path.join(imagesDir, imageName);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing source image: ${source}`);
    }
    fs.copyFileSync(source, target);
  }
}

const markdown = fs.readFileSync(sourceMarkdownPath, 'utf8');
const importedCards = parseMarkdownTable(markdown);
const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

const existingKeys = new Set(cards.map(card => [
  card['卡片ID'],
  card.source_image,
  card.position,
].join('|')));

const newCards = importedCards.filter(card => !existingKeys.has([
  card['卡片ID'],
  card.source_image,
  card.position,
].join('|')));

copyImages([...new Set(importedCards.map(card => card.source_image))]);

if (newCards.length) {
  cards.push(...newCards);
  fs.writeFileSync(cardsPath, `${JSON.stringify(cards, null, 2)}\n`, 'utf8');
}

console.log(`Parsed ${importedCards.length} cards from G8o33-G8o46.`);
console.log(`Added ${newCards.length} new cards. Total: ${cards.length}`);
console.log(`Copied ${new Set(importedCards.map(card => card.source_image)).size} images.`);
