import { writeFileSync } from 'fs';

const BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents';

async function backup() {
  const docs = [];
  let pageToken = null;

  do {
    let url = `${BASE}/agricola_ratings?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    (data.documents || []).forEach(doc => docs.push(doc));
    pageToken = data.nextPageToken || null;
    console.log(`  fetched ${docs.length} so far...`);
  } while (pageToken);

  const filename = `backup_ratings_2026-06-12.json`;
  writeFileSync(filename, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`\n✅ 備份完成：${docs.length} 筆 → ${filename}`);

  if (docs.length !== 3504) {
    console.warn(`⚠️ 警告：預期 3504 筆，實際 ${docs.length} 筆，請確認再繼續！`);
    process.exit(1);
  }
}

backup().catch(e => { console.error(e); process.exit(1); });
