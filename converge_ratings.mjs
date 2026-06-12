import { readFileSync } from 'fs';

const BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';
const BATCH_SIZE = 500;

async function converge() {
  const docs = JSON.parse(readFileSync('backup_ratings_2026-06-12.json', 'utf8'));
  console.log(`載入備份：${docs.length} 筆`);

  const oldElos = docs.map(doc => {
    const f = doc.fields || {};
    return Number(f.elo?.integerValue ?? f.elo?.doubleValue ?? 1200);
  });
  const oldMin  = Math.min(...oldElos).toFixed(2);
  const oldMax  = Math.max(...oldElos).toFixed(2);
  const oldAvg  = (oldElos.reduce((s, v) => s + v, 0) / oldElos.length).toFixed(2);
  console.log(`收斂前：min=${oldMin}, max=${oldMax}, avg=${oldAvg}`);

  // 計算新值
  const writes = docs.map(doc => {
    const f = doc.fields || {};
    const oldElo = Number(f.elo?.integerValue ?? f.elo?.doubleValue ?? 1200);
    const newElo = 1200 + 0.5 * (oldElo - 1200);
    return { name: doc.name, newElo };
  });

  const newElos = writes.map(w => w.newElo);
  const newMin  = Math.min(...newElos).toFixed(2);
  const newMax  = Math.max(...newElos).toFixed(2);
  const newAvg  = (newElos.reduce((s, v) => s + v, 0) / newElos.length).toFixed(2);
  console.log(`收斂後：min=${newMin}, max=${newMax}, avg=${newAvg}`);
  console.log(`開始寫入（每批最多 ${BATCH_SIZE}，共 ${Math.ceil(writes.length / BATCH_SIZE)} 批）...`);

  let successCount = 0;

  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = writes.slice(i, i + BATCH_SIZE);
    const body = {
      writes: batch.map(({ name, newElo }) => ({
        update: { name, fields: { elo: { doubleValue: newElo } } },
        updateMask: { fieldPaths: ['elo'] }
      }))
    };

    const res = await fetch(`${BASE}:commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      console.error(`❌ 第 ${Math.floor(i / BATCH_SIZE) + 1} 批 HTTP 錯誤 ${res.status}`);
      console.error(await res.text());
      process.exit(1);
    }

    successCount += batch.length;
    console.log(`  第 ${Math.floor(i / BATCH_SIZE) + 1} 批完成，累計 ${successCount}/${writes.length}`);
  }

  console.log(`\n✅ 完成！總筆數 ${writes.length}，成功 ${successCount}`);
  console.log(`   收斂前：min=${oldMin}, max=${oldMax}, avg=${oldAvg}`);
  console.log(`   收斂後：min=${newMin}, max=${newMax}, avg=${newAvg}`);
}

converge().catch(e => { console.error(e); process.exit(1); });
