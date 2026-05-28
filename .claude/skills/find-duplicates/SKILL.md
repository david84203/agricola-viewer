---
name: find-duplicates
description: 掃描農家樂卡牌資料庫（cards.json），找出名字重複或效果高度相似（≥95%）的卡牌配對，並更新 duplicates.json 供管理頁面使用。
---

# 農家樂重複卡牌偵測流程

## 專案位置

`D:\Claude Project\agricola-viewer`

## 規則

- **名字重複**：兩張 `card_type` 相同的牌名字完全一樣 → 列入候選
- **效果重複**：說明文字相似度 ≥ 95%（Levenshtein 演算法）且 `card_type` 相同 → 列入候選
- **不算重複**：
  - 職業卡 vs 次要發展卡（card_type 不同）即使同名也不算
  - 刻意設計為一套的卡組（例如木製/紅磚/石板道路）
  - 效果數字不同但模板相同的卡（例如「3個回合」vs「4個回合」）

## Step 1：執行偵測腳本

```bash
cd "D:\Claude Project\agricola-viewer"
node -e "
const cards = require('./cards.json');

// 名字重複（同 card_type）
const nameMap = {};
cards.forEach(c => {
  const name = (c['牌名'] || '').trim();
  if (!name) return;
  if (!nameMap[name]) nameMap[name] = [];
  nameMap[name].push(c);
});
const nameDups = Object.entries(nameMap)
  .filter(([, list]) => list.length > 1)
  .filter(([, list]) => {
    const types = list.map(c => c.card_type);
    return types.every(t => t === types[0]);
  });

// 效果相似（同 card_type，≥95%）
function sim(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.abs(a.length - b.length) / Math.max(a.length, b.length) > 0.1) return 0;
  const dp = Array.from({length: b.length+1}, (_,i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, dp[j], dp[j-1]);
      prev = tmp;
    }
  }
  return 1 - dp[b.length] / Math.max(a.length, b.length);
}
const withDesc = cards.filter(c => c['說明'] && c['說明'].length > 10);
const effectDups = [];
for (let i = 0; i < withDesc.length; i++) {
  for (let j = i+1; j < withDesc.length; j++) {
    const a = withDesc[i], b = withDesc[j];
    if (a.card_type !== b.card_type) continue;
    const s = sim(a['說明'], b['說明']);
    if (s >= 0.95) effectDups.push({ s: Math.round(s*100), a, b });
  }
}

console.log('=== 名字重複（同類型）===');
nameDups.forEach(([name, list]) =>
  console.log(' -', name, ':', list.map(c => c['卡片ID'] + '(' + c['牌組'] + ')').join(' vs ')));

console.log('\n=== 效果相似 ≥95%（同類型）===');
effectDups.forEach(({ s, a, b }) => {
  console.log(' ' + s + '%', a['卡片ID'], a['牌名'], 'vs', b['卡片ID'], b['牌名']);
  console.log('  A:', (a['說明']||'').substring(0,60));
  console.log('  B:', (b['說明']||'').substring(0,60));
});
console.log('\n共', nameDups.length, '組名字重複，', effectDups.length, '組效果相似');
"
```

## Step 2：判讀結果

對每個候選配對，確認：

1. 說明開頭是否相同（只差數字/標點 → 可能是誤判）
2. 卡牌是否出自不同牌組版本（舊版E / I 牌組 vs ABCDE → 通常是真重複）
3. 是否為刻意設計的同模板不同版本卡（道路系列等 → 誤判，不加入）

## Step 3：更新 duplicates.json

**新增配對**（不在現有 38 組內的）：

```bash
node -e "
const fs = require('fs');
const cards = require('./cards.json');
const pairs = require('./duplicates.json');

function defaultCanonical(ids) {
  const priority = id => {
    const c = cards.find(x => x['卡片ID'] === id);
    if (!c) return 3;
    if (c['牌組'] === '舊版E') return 2;
    if (c['牌組'] === 'I') return 1;
    return 0;
  };
  return ids.slice().sort((a, b) => priority(a) - priority(b))[0];
}

// 新增配對範例：
const newPairs = [
  // { label: '牌名A／牌名B', cards: ['CARD_ID_A', 'CARD_ID_B'], type: 'name' },
];

let idx = pairs.length + 1;
newPairs.forEach(p => {
  pairs.push({ id: 'n' + String(idx++).padStart(3,'0'), defaultCanonical: defaultCanonical(p.cards), ...p });
});

fs.writeFileSync('./duplicates.json', JSON.stringify(pairs, null, 2));
console.log('duplicates.json 更新完成，共', pairs.length, '組');
"
```

**刪除誤判**（直接編輯 duplicates.json 移除該物件，或在管理頁面點「這不是重複」）。

## Step 4：在管理頁面確認

打開 `http://localhost:3333/duplicates.html`，對每組配對：
- 閱讀雙方說明，確認是否真重複
- 選擇 ✓ 主要版本（預設已依牌組優先度自動選）
- 誤判點「✕ 這不是重複」

## 注意事項

- 預設主要版本選擇優先度：正規牌組（ABCDE） > I 牌組 > 舊版E
- 管理頁面的決策存在 **localStorage**，換瀏覽器或清快取會重置
- `duplicates.json` 只是初始配對清單，使用者在管理頁面的確認/排除操作才是最終狀態
- 新匯入牌組後應重跑 Step 1 確認有無新重複
