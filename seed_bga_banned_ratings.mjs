// 種初始分：BGA 牌組的 26 張禁卡
// 用法：node seed_bga_banned_ratings.mjs
// ⚠️  跑之前確認當下沒有人在評分（會寫正式 Firestore）

import { readFileSync } from 'fs';

const PROJECT = 'project-hub-410cd';
const BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// 26 張 BGA 禁卡與初始分（依 review.js BANNED_GROUPS eloPreset）
const SEEDS = [
  // 過強（eloPreset 1300）
  { id: 'A127',  elo: 1300 },
  { id: 'B010*', elo: 1300 },
  { id: 'A010',  elo: 1300 },
  { id: 'B021',  elo: 1300 },
  { id: 'A048',  elo: 1300 },
  { id: 'C031',  elo: 1300 },
  // 過爛（eloPreset 850）
  { id: 'A107',  elo: 850 },
  { id: 'A151',  elo: 850 },
  { id: 'C144*', elo: 850 },
  { id: 'C111',  elo: 850 },
  { id: 'D158*', elo: 850 },
  { id: 'B146',  elo: 850 },
  { id: 'C157',  elo: 850 },
  { id: 'B101',  elo: 850 },
  { id: 'D140',  elo: 850 },
  { id: 'A154',  elo: 850 },
  { id: 'A100',  elo: 850 },
  { id: 'A132',  elo: 850 },
  { id: 'B147',  elo: 850 },
  { id: 'C058',  elo: 850 },
  { id: 'B052',  elo: 850 },
  { id: 'B018',  elo: 850 },
  // 擾亂戰局（無 eloPreset 對應，fallback 1200）
  { id: 'C093',  elo: 1200 },
  { id: 'C130',  elo: 1200 },
  { id: 'C003*', elo: 1200 },
  { id: 'B022',  elo: 1200 },
];

async function getCard(id) {
  const url = `${BASE}/agricola_ratings/${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${id} failed: ${res.status}`);
  const doc = await res.json();
  const f = doc.fields || {};
  return {
    elo:       Number(f.elo?.integerValue ?? f.elo?.doubleValue ?? null),
    seenCount: Number(f.seenCount?.integerValue ?? 0),
    rankSeen:  Number(f.rankSeen?.integerValue  ?? 0),
  };
}

async function main() {
  console.log('=== 種分前現況確認 ===');
  const beforeMap = {};
  for (const { id } of SEEDS) {
    const cur = await getCard(id);
    beforeMap[id] = cur;
    if (cur) {
      console.log(`  ${id}: elo=${cur.elo}  seenCount=${cur.seenCount}  rankSeen=${cur.rankSeen}`);
    } else {
      console.log(`  ${id}: (文件不存在)`);
    }
  }

  console.log('\n確認以上清單後，腳本將覆寫這 26 張的 elo 欄位（保留其他欄位）。');
  console.log('開始寫入…\n');

  const RBASE = `projects/${PROJECT}/databases/(default)/documents/agricola_ratings`;
  const writes = SEEDS.map(({ id, elo }) => ({
    update: {
      name:   `${RBASE}/${id}`,
      fields: { elo: { doubleValue: elo } },
    },
    updateMask: { fieldPaths: ['elo'] },
  }));

  const res = await fetch(`${BASE}:commit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ writes }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`commit failed ${res.status}: ${txt}`);
  }
  const result = await res.json();
  const statuses = result.writeResults ?? [];
  console.log(`commit 回應：${statuses.length} 筆`);

  console.log('\n=== 驗證 ===');
  let ok = 0;
  for (const { id, elo } of SEEDS) {
    const after = await getCard(id);
    if (after && after.elo === elo) {
      console.log(`  ✓ ${id}: elo=${after.elo}`);
      ok++;
    } else {
      console.log(`  ✗ ${id}: 期望 ${elo}，實際 ${after?.elo ?? '(不存在)'}`);
    }
  }
  console.log(`\n完成 ${ok}/${SEEDS.length}`);
  if (ok < SEEDS.length) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
