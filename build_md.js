// 一次性:從 cards.json 反向產生 cards_NL.md（本次 NL/FL 工作集）
const fs=require('fs');
const d=JSON.parse(fs.readFileSync('cards.json','utf8'));
const srcs=['NL1.jpg','NL2.jpg','NL3.jpg','NL4.jpg','NL02.jpg','NL03.jpg','NL04.jpg','NL05.jpg'];
const cols=['卡片ID','牌組','card_type','牌名','遊玩人數','先決條件','費用','是否傳遞','勝利點數','紅利分數','source_image','grid_col','grid_row','說明'];
const exclude=['NL106','NL063']; // 既有殘缺卡(非本次匯入),不納入草稿
const rows=d.filter(c=>srcs.includes(c.source_image) && !exclude.includes(c.卡片ID))
  .sort((a,b)=>srcs.indexOf(a.source_image)-srcs.indexOf(b.source_image)||a.grid_row-b.grid_row||a.grid_col-b.grid_col);
let out='# 農家樂 NL/FL 卡牌資料草稿\n\n';
out+='> 本檔為資料來源（source of truth）。改完執行 `node generate_cards.js` 即可同步進 cards.json。\n';
out+='> 職業卡只填「遊玩人數」；次要發展卡填「先決條件/費用/是否傳遞/勝利點數」。空欄留白。\n';
out+='> grid 皆 3x3。`說明`為最後一欄。\n\n';
out+='| '+cols.join(' | ')+' |\n';
out+='|'+cols.map(()=>'---').join('|')+'|\n';
for(const c of rows){
  const v=cols.map(k=>{let x=c[k];return (x===undefined||x===null)?'':String(x);});
  out+='| '+v.join(' | ')+' |\n';
}
fs.writeFileSync('cards_NL.md',out,'utf8');
console.log('cards_NL.md rows:',rows.length);
