/* ══════════════════════════════════════════════════
   藍圖 2（1103 Lu 選定）：把 Obsidian「舊 25 類 tag」裡 channels.json 沒有的 5 類，
   以 role:["read"] 的「特性」頻道補進 channels.json。

   來源：cards.json 每張卡的 tags 數字欄（Lu 的 25 類，校對檔
        Dropbox 600_Project/烏嘎嘎桌遊/agricola-viewer/農家樂25類tag校對.md）
   對照：17 晚生不生／20 卡片農田／21 烹飪工具／22 動物飼養空間／24 任務卡
   排除：禁卡＋被重複取代的卡（../agricola-online/exclusions_audit.json 的 excluded，
        先跑 agricola-online 的 audit_exclusions.cjs --json，不可手打）

   role 只用 read：純標籤，不進類型（只看 get/cause）、不進 combo（只看 get/cause/react/pay），
   路線規則依頻道名比對，新名字不會命中。卡片視窗在「特性」一行顯示（build_card_profile.cjs）。

   做法：純文字插入——在該卡 channels 陣列最後一筆 `   }` 與 `  ]` 之間插新 entry，
        不 parse→stringify 寫回；寫完 parse 新舊檔，確認除了新增的 entry 之外完全相同。
        重跑冪等（已有同名頻道就跳過）。

   用法：node tools/apply_trait_channels.cjs [--dry]
   ══════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VIEWER = path.resolve(__dirname, '..');
const CHANNELS = path.join(VIEWER, 'channels.json');
const EXCL = path.join(VIEWER, '..', 'agricola-online', 'exclusions_audit.json');
const DRY = process.argv.includes('--dry');
const die = (m) => { console.error('❌ 中止：' + m); process.exit(1); };

const TRAITS = { 17: '晚生不生', 20: '卡片農田', 21: '烹飪工具', 22: '動物飼養空間', 24: '任務卡' };

if (!fs.existsSync(EXCL)) die('找不到 ' + EXCL + '，先跑 agricola-online 的 audit_exclusions.cjs --json');
const excluded = new Set(Object.keys(JSON.parse(fs.readFileSync(EXCL, 'utf8')).excluded || {}));
if (excluded.size < 300) die(`排除名單只有 ${excluded.size} 張，不像完整名單`);

const cards = JSON.parse(fs.readFileSync(path.join(VIEWER, 'cards.json'), 'utf8'));
const text = fs.readFileSync(CHANNELS, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const before = JSON.parse(text);

const plan = {}; // id -> [trait...]
const counts = Object.fromEntries(Object.values(TRAITS).map((t) => [t, 0]));
const missing = [];
for (const c of cards) {
  const id = String(c['卡片ID']);
  if (excluded.has(id)) continue;
  const tags = (c.tags || []).map(Number);
  const want = Object.keys(TRAITS).filter((t) => tags.includes(+t)).map((t) => TRAITS[t]);
  if (!want.length) continue;
  if (!before[id]) { missing.push(id); continue; }
  const have = new Set(before[id].channels.map((e) => e.ch));
  const add = want.filter((t) => !have.has(t));
  for (const t of want) counts[t]++;
  if (add.length) plan[id] = add;
}
if (missing.length) die(`這些卡 channels.json 沒收，要先補頻道：${missing.join('、')}`);

const entryLines = (ch) => ['   {', `    "ch": ${JSON.stringify(ch)},`, '    "role": [', '     "read"', '    ]', '   }'];
let out = text;
for (const [id, add] of Object.entries(plan)) {
  const head = `${eol} ${JSON.stringify(id)}: {${eol}`;
  const start = out.indexOf(head);
  if (start < 0 || out.indexOf(head, start + 1) >= 0) die(`找不到唯一的卡片區塊：${id}`);
  const closeTok = `${eol}   }${eol}  ]`;
  const close = out.indexOf(closeTok, start);
  const nextCard = out.indexOf(`${eol} "`, start + head.length);
  if (close < 0 || (nextCard >= 0 && close > nextCard)) die(`區塊格式不符：${id}`);
  const ins = add.map((t) => entryLines(t).join(eol)).join(',' + eol);
  out = out.slice(0, close) + `${eol}   },${eol}` + ins + `${eol}  ]` + out.slice(close + closeTok.length);
}

// 自檢：新檔 parse 後＝舊檔＋新增 entry
const after = JSON.parse(out);
const expect = JSON.parse(text);
for (const [id, add] of Object.entries(plan)) for (const t of add) expect[id].channels.push({ ch: t, role: ['read'] });
if (JSON.stringify(after) !== JSON.stringify(expect)) die('自檢失敗：新檔內容不等於「舊檔＋新增 entry」');

const added = Object.values(plan).reduce((n, a) => n + a.length, 0);
console.log(`排除卡 ${excluded.size} 張已濾。各類張數：` + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join('／'));
console.log(`本次新增 ${added} 筆 entry（${Object.keys(plan).length} 張卡）；自檢 ✅`);
if (!DRY && added) fs.writeFileSync(CHANNELS, out);
