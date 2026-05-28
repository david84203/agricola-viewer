// 針對指定 ID 查詢，印出完整 body 供診斷
import http from 'node:http';

const BASE = 'http://playagricola.com/Agricola/Cards/index.php';
const TARGET_IDS = [7061];

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      timeout: 8000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

for (const id of TARGET_IDS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ID = ${id}`);
  console.log('='.repeat(60));
  try {
    const { status, html } = await get(`${BASE}?id=${id}`);
    console.log(`HTTP ${status}，頁面長度 ${html.length} bytes`);

    const fullAdpMatch = html.match(/ADP\s*=\s*([\d.]+)\s*-\s*Plays/);
    if (!fullAdpMatch) { console.log('❌ 沒有 ADP'); continue; }

    const adpPos = html.indexOf(fullAdpMatch[0]);
    console.log(`✓ ADP 在位置 ${adpPos}`);

    // 搜尋頁面裡 id 出現的所有地方（找卡名顯示位置）
    const idStr = String(id);
    const idMatches = [...html.matchAll(new RegExp(idStr, 'g'))];
    console.log(`\n"${idStr}" 在頁面出現 ${idMatches.length} 次，前10筆：`);
    idMatches.slice(0, 10).forEach((m, i) => {
      const ctx = html.slice(Math.max(0, m.index - 50), m.index + 100).replace(/\n/g, ' ');
      console.log(`  [${i}] pos=${m.index}: ...${ctx}...`);
    });

    // 找 JavaScript 裡的 cardData 或 card 變數
    const scriptIdx = html.indexOf("'"+idStr+"'");
    console.log(`\n字串 '${idStr}' 位置：${scriptIdx}`);
    if (scriptIdx >= 0) console.log(html.slice(Math.max(0, scriptIdx-100), scriptIdx+300));

    // 印 adpPos 前後的 <td> 內容（論壇第一篇留言）
    // 找整個 table 的開頭（往前找最近的 <table）
    const tableIdx = html.lastIndexOf('<table', adpPos);
    console.log(`\n最近的 <table 在 pos=${tableIdx}`);
    console.log('\n--- 該 table 開頭 2000 bytes ---');
    console.log(html.slice(tableIdx, tableIdx + 2000));

  } catch(e) {
    console.log(`❌ 錯誤：${e.message}`);
  }
  await new Promise(r => setTimeout(r, 500));
}
