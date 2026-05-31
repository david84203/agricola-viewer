// 讀 cards_*.md 的 Markdown 表格，依 卡片ID upsert 進 cards.json（不動其他卡）
const fs=require('fs');
const path=require('path');
function parseMd(file){
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
  const tbl=lines.filter(l=>l.trim().startsWith('|'));
  if(tbl.length<2) return [];
  const header=tbl[0].split('|').slice(1,-1).map(s=>s.trim());
  const rows=[];
  for(let i=2;i<tbl.length;i++){ // skip header + separator
    const cells=tbl[i].split('|').slice(1,-1).map(s=>s.trim());
    if(cells.length<header.length) continue;
    // 說明為最後一欄：若內含 | 已被切開，重新合併尾段
    if(cells.length>header.length){
      const head=cells.slice(0,header.length-1);
      const rest=cells.slice(header.length-1).join(' | ');
      head.push(rest); cells.length=0; cells.push(...head);
    }
    const o={}; header.forEach((h,j)=>o[h]=cells[j]);
    rows.push(o);
  }
  return rows;
}
function toCard(r){
  const isOcc=r.card_type==='occupation';
  const c={卡片ID:r.卡片ID,牌名:r.牌名,card_type:r.card_type,牌組:r.牌組,
    說明:r.說明,source_image:r.source_image,
    grid_cols:3,grid_rows:3,grid_col:+r.grid_col,grid_row:+r.grid_row};
  if(isOcc){ c.遊玩人數=r.遊玩人數; c.紅利分數=r.紅利分數; }
  else { c.類型='次要發展卡'; c.先決條件=r.先決條件||'無'; c.費用=r.費用||'無';
    c.是否傳遞=r.是否傳遞; c.勝利點數=r.勝利點數||'無'; c.紅利分數=r.紅利分數; }
  return c;
}
const files=fs.readdirSync('.').filter(f=>/^cards_.*\.md$/.test(f));
const data=JSON.parse(fs.readFileSync('cards.json','utf8'));
let added=0,updated=0,total=0;
for(const f of files){
  for(const r of parseMd(f)){
    if(!r.卡片ID) continue; total++;
    const nc=toCard(r);
    const i=data.findIndex(c=>c['卡片ID']===nc['卡片ID']);
    if(i!==-1){ data[i]={...data[i],...nc}; updated++; } else { data.push(nc); added++; }
  }
}
fs.writeFileSync('cards.json',JSON.stringify(data,null,2),'utf8');
console.log(`from ${files.join(',')}: ${total} rows -> added ${added}, updated ${updated}`);
