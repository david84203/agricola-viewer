// 農家樂 playagricola.com ADP 爬蟲
// 執行：node scrape_agricola.mjs
// 結果存到 agricola_adp.json

import http from 'node:http';
import fs from 'node:fs';

const BASE = 'http://playagricola.com/Agricola/Cards/index.php';
const OUT  = './agricola_adp.json';
const PROGRESS = './scrape_progress.json';
const DELAY = 350;   // ms between requests
const MAX_ID = 20000;

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      timeout: 8000,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parsePage(html, id) {
  // 只處理有 ADP 的頁面
  const adpMatch = html.match(/ADP\s*=\s*([\d.]+)\s*-\s*Plays\s*\((\d+)\s*\/\s*(\d+)[^)]*\)\s*-\s*Wins\s*\((\d+)\s*\/\s*(\d+)[^)]*\)\s*-\s*PWR\s*=\s*([\d.]+)/);
  if (!adpMatch) return null;

  // 卡名在第一則留言的 <span style='display:none' id='x{id}x...'>CardName (type-code)<br>...
  const firstSpan = html.match(new RegExp(`<span style='display:none' id='x${id}x\\d+'>([^<(]+?)\\s*\\(([^)]+)\\)`));
  const cardName = firstSpan?.[1]?.trim() || '';
  const typeCode = firstSpan?.[2] || '';
  const cardType = /^occ/i.test(typeCode) ? 'occupation'
    : /^imp|^min/i.test(typeCode) ? 'minor'
    : /^maj/i.test(typeCode) ? 'major'
    : typeCode.toLowerCase() || '';

  return {
    site_id:      id,
    name_en:      cardName,
    card_type:    cardType,
    adp:          parseFloat(adpMatch[1]),
    plays_count:  parseInt(adpMatch[2]),
    plays_total:  parseInt(adpMatch[3]),
    wins_count:   parseInt(adpMatch[4]),
    wins_total:   parseInt(adpMatch[5]),
    pwr:          parseFloat(adpMatch[6]),
    type_code:    typeCode,
  };
}

async function main() {
  // 讀取進度（可中斷後繼續）
  let startId = 1;
  let results = [];
  if (fs.existsSync(PROGRESS)) {
    const prog = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
    startId = prog.nextId;
    results = prog.results;
    console.log(`▶ 繼續上次進度，從 id=${startId} 開始（已找到 ${results.length} 筆）`);
  } else {
    console.log(`▶ 開始掃描 id=1 到 ${MAX_ID}`);
  }

  console.log(`  預計時間：約 ${Math.round((MAX_ID - startId) * DELAY / 60000)} 分鐘\n`);

  for (let id = startId; id <= MAX_ID; id++) {
    await sleep(DELAY);

    try {
      const html = await get(`${BASE}?id=${id}`);
      const data = parsePage(html, id);

      if (data) {
        results.push(data);
        console.log(`✓ id=${id} | ADP=${data.adp} | ${data.card_type} | "${data.name_en}"`);
        // 即時存檔
        fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
      } else if (id % 500 === 0) {
        process.stdout.write(`  ... id=${id} 掃到這裡，找到 ${results.length} 筆\n`);
      }
    } catch (err) {
      if (id % 200 === 0 || err.message !== 'timeout') {
        console.log(`  id=${id} 跳過 (${err.message})`);
      }
    }

    // 每 100 個存一次進度
    if (id % 100 === 0) {
      fs.writeFileSync(PROGRESS, JSON.stringify({ nextId: id + 1, results }));
    }
  }

  // 完成
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  fs.unlinkSync(PROGRESS);
  console.log(`\n✅ 完成！共找到 ${results.length} 張有 ADP 資料的卡牌`);
  console.log(`   結果存在 ${OUT}`);
}

main().catch(console.error);
