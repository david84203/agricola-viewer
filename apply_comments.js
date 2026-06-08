const fs = require('fs');

const comments = [
  { sel: "1", com: "4分" },
  { sel: "無", com: "1分" },
  { sel: "2根木頭", com: "無" },
  { sel: "2根木頭", com: "1根木頭" },
  { sel: "3根木頭", com: "3根木頭/3塊磚頭+2綑蘆葦" },
  { sel: "鵝卵", com: "鵝塘" },
  { sel: "3根木頭", com: "無" },
  { sel: "否", com: "是" },
  { sel: "2根木頭", com: "1石" },
  { sel: "無", com: "有" },
  { sel: "無", com: "2根木頭" },
  { sel: "無", com: "1根木頭" },
  { sel: "1", com: "無" },
  { sel: "無", com: "1分" },
  { sel: "無", com: "1分" },
  { sel: "否", com: "是" },
  { sel: "1根蘆葦", com: "5木1蘆葦" },
  { sel: "5", com: "無" },
  { sel: "無", com: "有" },
  { sel: "2根木頭", com: "2木/2磚+1蘆葦" },
  { sel: "2", com: "3分" },
  { sel: "2根木頭", com: "2木/2磚+2蘆葦" },
  { sel: "2塊磚頭", com: "1塊磚頭" },
  { sel: "1", com: "無" },
  { sel: "2", com: "1分" },
  { sel: "無", com: "有" },
  { sel: "2塊磚頭", com: "無" },
  { sel: "2根木頭", com: "2磚+3石" },
  { sel: "1", com: "2分" },
  { sel: "3", com: "2分" },
  { sel: "無", com: "有" },
  { sel: "2根木頭", com: "2木/2磚" },
  { sel: "2塊磚頭", com: "2磚+2石" },
  { sel: "1", com: "2分" },
  { sel: "3塊麥田", com: "無" },
  { sel: "1塊磚頭", com: "1份蔬菜+2石" },
  { sel: "無", com: "有" },
  { sel: "2張職業卡", com: "3張職業卡" },
  { sel: "無", com: "1分" },
  { sel: "2根木頭", com: "2木+2石" },
  { sel: "2份食物", com: "無" },
  { sel: "滿足", com: "擴及" },
  { sel: "禽", com: "用" },
  { sel: "1", com: "無" },
  { sel: "2根木頭", com: "1木+2磚+1蘆葦+2石" },
  { sel: "3塊磚頭", com: "3麥" },
  { sel: "否", com: "是" },
  { sel: "無", com: "有" }
];

let md = fs.readFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_draft.md', 'utf8');

let currentIndex = 0;
for (const { sel, com } of comments) {
  let foundIndex = md.indexOf(sel, currentIndex);
  if (foundIndex !== -1) {
    md = md.substring(0, foundIndex) + com + md.substring(foundIndex + sel.length);
    currentIndex = foundIndex + com.length;
  } else {
    console.log("Could not find:", sel, "after index", currentIndex);
  }
}

// Special fixes
// "梯子的說營直接改成跟"蓋屋匠"一樣"
const thatcherDesc = '第7版規則更改：當你擴建房舍、翻修房舍、打出有至少1綑蘆葦和1份其他建築資源的次要發展卡時，你可以少支付1綑蘆葦。';
// We need to replace ladder description
const lines = md.split('\\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('| 梯子 |')) {
    const parts = lines[i].split('|');
    parts[10] = ' ' + thatcherDesc + ' ';
    lines[i] = parts.join('|');
  }
  
  // also fix ID shifts
  // I072b -> I073, I073 -> I074, ..., I104 -> I105
  // But wait! The IDs from the user were just based on my draft. 
  // Let's renumber them!
}
md = lines.join('\\n');

fs.writeFileSync('C:/Users/bboylu/.gemini/antigravity/brain/1d079712-1065-43d9-86dd-dc8dc56f2b2d/I_Minor_draft.md', md);
console.log('Applied comments.');
