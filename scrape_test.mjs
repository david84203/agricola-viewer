// 快速驗證爬蟲邏輯，只掃幾個已知 ID
import http from 'node:http';

const BASE = 'http://playagricola.com/Agricola/Cards/index.php';

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

function parsePage(html, id) {
  const adpMatch = html.match(/ADP\s*=\s*([\d.]+)\s*-\s*Plays\s*\((\d+)\s*\/\s*(\d+)[^)]*\)\s*-\s*Wins\s*\((\d+)\s*\/\s*(\d+)[^)]*\)\s*-\s*PWR\s*=\s*([\d.]+)/);
  if (!adpMatch) return null;

  // 卡名在第一則留言的 <span style='display:none' id='x{id}x...'>CardName (type-code)<br>...
  const firstSpan = html.match(new RegExp(`<span style='display:none' id='x${id}x\\d+'>([^<(]+?)\\s*\\(([^)]+)\\)`));
  const cardName = firstSpan?.[1]?.trim() || '(找不到名稱)';
  const typeCode = firstSpan?.[2] || '';
  const cardType = /^occ/i.test(typeCode) ? 'occupation'
    : /^imp|^min/i.test(typeCode) ? 'minor'
    : /^maj/i.test(typeCode) ? 'major'
    : typeCode.toLowerCase() || '?';

  return {
    site_id:   id,
    name_en:   cardName,
    card_type: cardType,
    adp:       parseFloat(adpMatch[1]),
    plays:     `${adpMatch[2]}/${adpMatch[3]}`,
    wins:      `${adpMatch[4]}/${adpMatch[5]}`,
    pwr:       parseFloat(adpMatch[6]),
  };
}

// 掃描直到找到 10 筆有 ADP 的資料（3 個並行）
const WANT = 10;
const CONCURRENCY = 5;
let found = 0;
let scanned = 0;
let consecutive_empty = 0;
const GIVE_UP_AFTER = 2000; // 連續 2000 個沒資料就停

async function checkId(id) {
  try {
    const html = await get(`${BASE}?id=${id}`);
    scanned++;
    const data = parsePage(html, id);
    if (data) {
      found++;
      consecutive_empty = 0;
      console.log(`\n[${found}/10] id=${id} | ADP=${data.adp} | ${data.card_type} | "${data.name_en}" | plays=${data.plays} | wins=${data.wins} | pwr=${data.pwr}`);
      if (found <= 3) {
        // 找 </style></head><body> 之後的第一段實際內容
        const bodyStart = html.indexOf('<body>');
        console.log('\n--- 頁面主體前 2000 字 ---');
        console.log(html.slice(bodyStart > 0 ? bodyStart : 0, (bodyStart > 0 ? bodyStart : 0) + 2000));
        console.log('---');
      }
    } else {
      consecutive_empty++;
      process.stdout.write(scanned % 100 === 0 ? `\n  掃到 id=${id}...` : '.');
    }
  } catch(e) { scanned++; consecutive_empty++; }
}

let id = 7050;
while (id <= 20000 && found < WANT && consecutive_empty < GIVE_UP_AFTER) {
  const batch = [];
  for (let i = 0; i < CONCURRENCY && id <= 13000; i++, id++) {
    batch.push(checkId(id));
  }
  await Promise.all(batch);
  await new Promise(r => setTimeout(r, 150));
}
console.log(`\n完成，共找到 ${found} 筆`);
