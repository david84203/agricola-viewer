// 探測腳本：先跑這個確認結構，再跑正式爬蟲
// 執行：node scrape_probe.mjs

import http from 'node:http';

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    }).on('error', reject);
  });
}

async function main() {
  const BASE = 'http://playagricola.com/Agricola/Cards/index.php';

  // ── 1. 抓列表頁，看 id 連結的格式和分頁 ──────────────
  console.log('=== 抓列表頁 ===');
  const list = await get(BASE);
  console.log('Status:', list.status);

  // 找所有 id=數字 的連結
  const ids = [...list.html.matchAll(/[?&]id=(\d+)/g)].map(m => m[1]);
  const uniqueIds = [...new Set(ids)];
  console.log('找到的卡片 ID（前20個）:', uniqueIds.slice(0, 20));
  console.log('共找到', uniqueIds.length, '個 ID');

  // 找分頁相關關鍵字
  const hasNext = list.html.includes('next') || list.html.includes('Next') || list.html.includes('下一');
  const pageMatches = [...list.html.matchAll(/page=(\d+)|start=(\d+)|offset=(\d+)/g)].slice(0, 5);
  console.log('分頁參數:', pageMatches.map(m => m[0]));
  console.log('有 next 連結:', hasNext);

  // ── 2. 詳細看 id=7934 的 HTML 中段（找卡名和代碼）──
  console.log('\n=== id=7934 詳細 HTML ===');
  const card = await get(`${BASE}?id=7934`);

  // 印從 ADP 前後各 1000 字的內容
  const adpPos = card.html.indexOf('ADP =');
  if (adpPos > 0) {
    console.log('\n--- ADP 前 1500 字 ---');
    console.log(card.html.slice(Math.max(0, adpPos - 1500), adpPos + 500));
  }

  // 找所有看起來像卡片代碼的字串（排除 CH433）
  const allCodes = [...card.html.matchAll(/\b([A-Z]{1,3}\d{3,4}\*?)\b/g)]
    .map(m => m[1])
    .filter(c => c !== 'CH433');
  console.log('\n排除 CH433 後的代碼:', [...new Set(allCodes)].slice(0, 20));
}

main().catch(console.error);
