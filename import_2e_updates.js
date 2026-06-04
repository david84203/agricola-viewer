const fs = require('fs');
const path = require('path');

const cardsPath = path.join(__dirname, 'cards.json');
const imagesDir = path.join(__dirname, 'images');
const sourceTextPath = process.env.UPDATE_SOURCE_TEXT || 'C:\\Users\\User\\.codex\\attachments\\332f78fb-9a12-408c-8c99-1af4bd4970f4\\pasted-text.txt';
const sourceImageDir = process.env.UPDATE_SOURCE_IMAGE_DIR || 'D:\\農家樂卡牌\\2016新版\\中文化';

const imagePlan = [
  { image: '2版牌更新m1O5.jpg', count: 7 },
  { image: '2版牌更新O1.jpg', count: 9 },
  { image: '2版牌更新O2.jpg', count: 9 },
  { image: '2版牌更新O3.jpg', count: 9 },
  { image: '2版牌更新O4.jpg', count: 9 },
  { image: '2版牌更新O5.jpg', count: 2 },
];

function normalizeBonus(value) {
  return value.startsWith('有') ? '有' : '無';
}

function parseMinor(line) {
  const match = line.match(/^卡片 ID：(.+?) 牌名：(.+?) 類型：(.+?) 先決條件：(.+?) 費用：(.+?) 是否傳遞：(.+?) 勝利點數：(.+?) 紅利分數：(.+?) 牌組：(.+?) 說明：(.+)$/);
  if (!match) throw new Error(`Cannot parse minor card: ${line}`);
  const [, id, name, type, prerequisite, cost, pass, vp, bonus, deck, description] = match;
  return {
    '牌名': name,
    '類型': type,
    '是否傳遞': pass,
    '先決條件': prerequisite,
    '費用': cost,
    '勝利點數': vp,
    '紅利分數': normalizeBonus(bonus),
    '牌組': deck,
    '卡片ID': id,
    '說明': description,
    card_type: 'minor',
  };
}

function parseOccupation(line) {
  const match = line.match(/^【(.+?)】(.+?) 類型：(.+?) 需求人數：(.+?) 人 紅利：(.+?) 牌組：(.+?) 說明：(.+)$/);
  if (!match) throw new Error(`Cannot parse occupation card: ${line}`);
  const [, id, name, type, players, bonus, deck, description] = match;
  return {
    '牌名': name,
    '類型': type,
    '是否傳遞': '否',
    '紅利分數': normalizeBonus(bonus),
    '牌組': deck,
    '卡片ID': id,
    '說明': description,
    card_type: 'occupation',
    '人數': players,
  };
}

function parseCards(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.startsWith('卡片 ID：') ? parseMinor(line) : parseOccupation(line));
}

function assignImages(cards) {
  const plannedCount = imagePlan.reduce((sum, item) => sum + item.count, 0);
  if (cards.length !== plannedCount) {
    throw new Error(`Expected ${plannedCount} cards, got ${cards.length}`);
  }

  let index = 0;
  for (const { image, count } of imagePlan) {
    for (let position = 0; position < count; position += 1) {
      const card = cards[index];
      card.source_image = image;
      card.position = position;
      card.grid_col = position % 3;
      card.grid_row = Math.floor(position / 3);
      index += 1;
    }
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

const importedCards = assignImages(parseCards(fs.readFileSync(sourceTextPath, 'utf8')));
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

copyImages(imagePlan.map(item => item.image));

if (newCards.length) {
  cards.push(...newCards);
  fs.writeFileSync(cardsPath, `${JSON.stringify(cards, null, 2)}\n`, 'utf8');
}

console.log(`Parsed ${importedCards.length} cards from 2版牌更新 images.`);
console.log(`Added ${newCards.length} new cards. Total: ${cards.length}`);
console.log(`Copied ${imagePlan.length} images.`);
