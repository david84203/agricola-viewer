/* ══════════════════════════════════════════════════
   藍圖 2（1103 Lu 選定）：LUGA 實戰單卡統計 → card-match-stats.json
   卡片視窗顯示「出現 N 局／平均名次／前兩名比例」，<5 局標「樣本不足」。

   來源：Firestore project-hub-410cd 的 match_results/{房號}（agricola-online net.js 完賽時寫入，REST 公開可讀）
   母體（Lu 1103）：
     - ranked＝true（線上 4 人、四個不同帳號、沒投降、沒過短、沒人代打）
     - 不含雙打（teamMode：名次是隊伍名次，「前兩名」意義不同）
     - 玩家 recordExcluded 的那筆不計
     - 打過禁卡／被重複取代的卡（exclusions_audit.json 的 excluded）的那一筆「整筆」不計
   卡 ID：去掉尾巴的 `*`（舊局寫法）後若 cards.json 沒有，再試加 `*`；`blank-occ-…`（空白職業）略過。

   用法：node tools/build_match_stats.cjs [--exclusions <json>] [--dry]
   輸出：card-match-stats.json（一張卡一行，順序照卡號排序，重跑 diff 看得懂）
   每週排程：先跑本檔，再跑 build_card_profile.cjs（它會把統計併進 card-profile.json）
   ══════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const DRY = argv.includes('--dry');
const EXCL = path.resolve(argOf('--exclusions') || path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json'));
const OUT = path.join(VIEWER, 'card-match-stats.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/project-hub-410cd/databases/(default)/documents/match_results';
const die = (m) => { console.error('❌ 中止：' + m); process.exit(1); };

// Firestore REST 值 → JS
function val(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
  return undefined;
}

async function fetchAll() {
  const docs = [];
  let token = '';
  for (let page = 0; page < 1000; page++) {
    const mask = ['ranked', 'teamMode', 'playerCount', 'players', 'takeoverRecordOwners'].map((f) => `mask.fieldPaths=${f}`).join('&');
    const url = `${BASE}?pageSize=300&${mask}${token ? '&pageToken=' + encodeURIComponent(token) : ''}`;
    const res = await fetch(url);
    if (!res.ok) die(`讀 match_results 失敗 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    for (const d of j.documents || []) docs.push({ id: d.name.split('/').pop(), ...val({ mapValue: { fields: d.fields || {} } }) });
    if (!j.nextPageToken) return docs;
    token = j.nextPageToken;
  }
  die('翻頁超過 1000 頁，不正常');
}

(async () => {
  if (!fs.existsSync(EXCL)) die(`找不到 ${EXCL}，先到 agricola-online 跑 node audit_exclusions.cjs --json`);
  const excluded = new Set(Object.keys(JSON.parse(fs.readFileSync(EXCL, 'utf8')).excluded || {}));
  if (excluded.size < 300) die(`排除名單只有 ${excluded.size} 張，不像完整名單`);
  const known = new Set(JSON.parse(fs.readFileSync(path.join(VIEWER, 'cards.json'), 'utf8')).map((c) => String(c['卡片ID'])));
  const ref = path.join(VIEWER, 'reference-cards.json');
  if (fs.existsSync(ref)) for (const c of JSON.parse(fs.readFileSync(ref, 'utf8'))) known.add(String(c['卡片ID']));

  const norm = (raw) => {
    const s = String(raw || '').trim();
    if (!s || s.startsWith('blank-')) return null;
    if (known.has(s)) return s;
    const bare = s.replace(/\*+$/, '');
    if (known.has(bare)) return bare;
    if (known.has(bare + '*')) return bare + '*';
    return null;
  };

  const docs = await fetchAll();
  const c = { total: docs.length, unranked: 0, team: 0, records: 0, recExcluded: 0, recBanned: 0, unknownIds: new Set() };
  const acc = {}; // id -> { n, rankSum, top2 }
  const games = new Set();
  for (const d of docs) {
    if (d.ranked !== true) { c.unranked++; continue; }
    if (d.takeoverRecordOwners && Object.keys(d.takeoverRecordOwners).length) { c.unranked++; continue; } // 接棒局仍計成績（Lu 1108），但同座位兩人打，不進單卡樣本
    if (d.teamMode === 'double') { c.team++; continue; } // 舊局沒有欄位＝single
    for (const p of d.players || []) {
      if (p.recordExcluded) { c.recExcluded++; continue; }
      const rank = Number(p.rank);
      if (!(rank >= 1 && rank <= 4)) continue;
      const ids = new Set();
      for (const raw of p.playedCards || []) {
        const id = norm(raw);
        if (id) ids.add(id); else if (raw && !String(raw).startsWith('blank-')) c.unknownIds.add(String(raw));
      }
      if ([...ids].some((id) => excluded.has(id))) { c.recBanned++; continue; }
      c.records++; games.add(d.id);
      for (const id of ids) {
        const a = (acc[id] ||= { n: 0, rankSum: 0, top2: 0 });
        a.n++; a.rankSum += rank; if (rank <= 2) a.top2++;
      }
    }
  }

  const stats = Object.fromEntries(Object.entries(acc).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([id, a]) => [id, { n: a.n, avgRank: Math.round(a.rankSum / a.n * 100) / 100, top2: Math.round(a.top2 / a.n * 100) / 100 }]));
  const nGe5 = Object.values(stats).filter((s) => s.n >= 5).length;

  console.log(`match_results ${c.total} 局：非 ranked ${c.unranked}、雙打 ${c.team} 不計 → 採用 ${games.size} 局`);
  console.log(`玩家紀錄：採用 ${c.records} 筆；recordExcluded ${c.recExcluded}、打過排除卡 ${c.recBanned} 筆不計`);
  console.log(`有統計 ${Object.keys(stats).length} 張，其中 ≥5 局 ${nGe5} 張`);
  if (c.unknownIds.size) console.log(`⚠ 對不上 cards.json 的卡 ID ${c.unknownIds.size} 種：${[...c.unknownIds].slice(0, 15).join('、')}`);
  if (DRY) return;

  const now = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const lines = Object.entries(stats).map(([id, s]) => `  ${JSON.stringify(id)}: ${JSON.stringify(s)}`);
  const meta = `  "_meta": ${JSON.stringify({ generatedAt: now + ' (台北)', games: games.size, records: c.records })}`;
  fs.writeFileSync(OUT, `{\n${[meta, ...lines].join(',\n')}\n}\n`, 'utf8');
  console.log(`→ ${OUT}`);
})().catch((e) => die(e.stack || String(e)));
