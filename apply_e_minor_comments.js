const fs = require('fs');
const comments = [
  { sel: "無", com: "1份食物" },
  { sel: "無", com: "1根木頭" },
  { sel: "1根木頭", com: "2木+2石" },
  { sel: "退回1座烤爐或磚窯", com: "退還1個烤爐" },
  { sel: "2塊磚頭+1份麥子", com: "無" },
  { sel: "無", com: "3分" },
  { sel: "1根木頭+1塊磚頭+1塊石頭", com: "3木+1石" },
  { sel: "無", com: "2分" },
  { sel: "無", com: "1分" },
  { sel: "1塊磚頭", com: "2塊磚頭" },
  { sel: "無", com: "1分" },
  { sel: "無", com: "1分" },
  { sel: "1木+1磚+1蘆葦+1石", com: "1木+1磚+1蘆葦+2石" },
  { sel: "1分", com: "無" },
  { sel: "4隻動物", com: "4張職業卡" },
  { sel: "1根木頭", com: "2根木頭" },
  { sel: "無", com: "1分" },
  { sel: "1根木頭", com: "3木1石" },
  { sel: "1分", com: "2分" },
  { sel: "1根木頭", com: "無" },
  { sel: "1張職業卡, 2張次要發展卡", com: "1張職業卡, 2張發展卡" },
  { sel: "無", com: "1分" },
  { sel: "雙", com: "偶" },
  { sel: "無", com: "1塊磚頭" },
  { sel: "從此期每次你打出石造次要發展卡時，且打出時不須支付資源。", com: "從此陶藝工坊對你而言視為次要發展卡，且打出時不須支付資源。" },
  { sel: "無", com: "1蘆葦" },
  { sel: "無", com: "1分" },
  { sel: "木頭磚瓦", com: "木構磚屋" },
  { sel: "無", com: "2木" },
  { sel: "回", com: "還" },
  { sel: "聖母像沒有功能。(你必須退回已打出的主要或次要發展卡，而不能從手中更換。)", com: "聖母像沒有功能。(你必須退還已打出的主要或次要發展卡，而不能從手中棄牌。)" },
  { sel: "無", com: "1麥" },
  { sel: "1分", com: "無" },
  { sel: "否", com: "是" },
  { sel: "馬廄", com: "圈地" },
  { sel: "塊", com: "顆" },
  { sel: "無", com: "1木/1磚" },
  { sel: "1分", com: "無" },
  { sel: "無", com: "1木+1磚" },
  { sel: "無", com: "2份食物" },
  { sel: "2分", com: "無" },
  { sel: "無", com: "2根木頭" },
  { sel: "1分", com: "無" },
  { sel: "建築工人小屋", com: "建築工小鏟" },
  { sel: "1分", com: "無" },
  { sel: "無", com: "1木" },
  { sel: "無", com: "1木" },
  { sel: "1根木頭", com: "2根木頭" },
  { sel: "無", com: "1蘆葦+3石" },
  { sel: "1分", com: "無" },
  { sel: "1分", com: "無" },
  { sel: "無", com: "2石" },
  { sel: "無", com: "2根木頭" },
  { sel: "1分", com: "無" },
  { sel: "3", com: "4" }
];

let md = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/E_Minor_Review.md', 'utf8');
let currentIndex = 0;
for (const { sel, com } of comments) {
  let foundIndex = md.indexOf(sel, currentIndex);
  if (foundIndex === -1) {
    foundIndex = md.indexOf(sel, 0); // fallback
  }
  if (foundIndex !== -1) {
    md = md.substring(0, foundIndex) + com + md.substring(foundIndex + sel.length);
    currentIndex = foundIndex + com.length;
  } else {
    console.log("Could not find:", sel);
  }
}
fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/E_Minor_Review_updated.md', md);
console.log('Applied comments.');
