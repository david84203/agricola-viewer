// 讀朋友的卡效編碼快照（31 個 batch-*.json），依「卡片ID＋牌名」雙鎖定對上本站 cards.json，
// 輸出 effects.json（與 cards.json 同層）。只做資料合併，不執行任何卡效。
// 可重跑（每次從快照全量重建，不做增量 upsert）。
//
// 雙鎖定說明：朋友的 batch JSON 本身只有 cardId，沒有牌名欄位。牌名比對改用朋友原始
// 卡庫（D:\農家樂單機版\packages\cards\data\cards.json，即 batch 檔案的編碼依據來源）
// 與本站 cards.json 互相比對；若該路徑不存在則降級為僅 ID 比對，並在報告中註明。
const fs = require('fs');
const path = require('path');

const SNAPSHOT_DIR = 'D:/Claude Project/_friend_effects_snapshot_20260709';
const ENGINE_CARDS_PATH = 'D:/農家樂單機版/packages/cards/data/cards.json';
const OUT_PATH = path.join(__dirname, 'effects.json');
const REPORT_PATH = path.join(
  'C:/Users/bboylu/AppData/Local/Temp/claude/D--Claude-Project/94993493-d1be-45d4-a97f-044d881181d1/scratchpad',
  'effects_merge_report.json'
);

// ── 讀本站 cards.json（唯一真相，只讀不寫）──
const viewerCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'cards.json'), 'utf8'));
const viewerNameById = new Map(viewerCards.map(c => [c['卡片ID'], c['牌名']]));

// ── 讀朋友原始卡庫（用於牌名雙鎖定，找不到則降級）──
let engineNameById = null;
if (fs.existsSync(ENGINE_CARDS_PATH)) {
  const engineCards = JSON.parse(fs.readFileSync(ENGINE_CARDS_PATH, 'utf8'));
  engineNameById = new Map();
  for (const c of engineCards) {
    if (!engineNameById.has(c['卡片ID'])) engineNameById.set(c['卡片ID'], c['牌名']);
  }
}

// ── 讀 31 個 batch 檔 ──
const batchFiles = fs.readdirSync(SNAPSHOT_DIR)
  .filter(f => /^batch-.*\.json$/.test(f))
  .sort();

let records = [];
for (const f of batchFiles) {
  const arr = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf8'));
  records = records.concat(arr);
}

// ── 依卡片ID＋牌名雙鎖定合併 ──
const merged = [];
const notFound = [];   // cardId 在本站 cards.json 查不到
const nameMismatch = []; // cardId 在兩邊都有，但牌名不同（疑似不同卡）

for (const rec of records) {
  const id = rec.cardId;
  const viewerName = viewerNameById.get(id);

  if (viewerName === undefined) {
    notFound.push({ cardId: id, engineName: engineNameById ? engineNameById.get(id) : undefined });
    continue;
  }

  if (engineNameById) {
    const engineName = engineNameById.get(id);
    if (engineName !== undefined && engineName !== viewerName) {
      nameMismatch.push({ cardId: id, viewerName, engineName });
      continue;
    }
  }

  // 保留朋友原始欄位不變，另加 matchedName 供核對
  merged.push({ ...rec, matchedName: viewerName });
}

fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2), 'utf8');

const report = {
  generatedAt: new Date().toISOString(),
  totalEncoded: records.length,
  matched: merged.length,
  notFoundInViewerCards: notFound,
  nameMismatch,
  nameCrossCheckEnabled: !!engineNameById,
};
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

console.log(`讀入編碼: ${records.length} 張（${batchFiles.length} 個 batch 檔）`);
console.log(`名稱雙鎖定: ${engineNameById ? '啟用（比對朋友原始卡庫）' : '停用（找不到 ' + ENGINE_CARDS_PATH + '，降級為僅 ID 比對）'}`);
console.log(`成功合併: ${merged.length} 張 -> ${OUT_PATH}`);
console.log(`本站查無此ID: ${notFound.length} 張`);
console.log(`同ID不同牌名（不合併）: ${nameMismatch.length} 張`);
console.log(`完整報告: ${REPORT_PATH}`);
