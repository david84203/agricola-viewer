const fs = require('fs');

const cardsJson = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

const biMinors = [
  { id: 'BI10', name: '北緯52度', req: '無', cost: '1木+1石', pass: '否', vp: '無', bonus: '有', desc: '立刻從供應區拿1顆石頭放在一格未使用的農莊空間(放置後視為已使用)。遊戲結束時，每塊直角相鄰這顆石頭的空田給你1分紅利分數。', img: 'BIm1.jpg', r: 0, c: 0 },
  { id: 'BI13', name: '木製鈕扣', req: '2間空屋', cost: '1木', pass: '是', vp: '無', bonus: '無', desc: '你有幾間空房間就立刻得到幾個食客。使用這些食客如同額外的家庭成員，並在這回合結束時退還他們。在這回合中你沒有空房間給新生兒。', img: 'BIm1.jpg', r: 0, c: 1 },
  { id: 'BI05', name: '家欄', req: '無', cost: '1木+1磚', pass: '否', vp: '1分', bonus: '有', desc: '此卡可以容納羊、豬、牛各1隻。僅當你從累積行動格上取得動物時，才能將動物放置於此卡上。此卡上的動物不參與繁殖階段。在最後一次收穫階段，你可以將此卡上的動物換成紅利分數，每隻1分。', img: 'BIm1.jpg', r: 0, c: 2 },
  { id: 'BI03', name: '發酵粉', req: '1張麵包符號發展卡', cost: '無', pass: '否', vp: '無', bonus: '無', desc: '每當你執行「播種和/或烤麵包」行動格時，在你購置的每張主要發展卡上各放1個麥子(從供應區拿取)。每當你打出職業卡時，將那些麥子移進你的個人供應區。(計分前移除你主要發展卡上的所有麥子)', img: 'BIm1.jpg', r: 1, c: 0 },
  { id: 'BI09', name: '足球場', req: '無', cost: '1羊', pass: '否', vp: '1分', bonus: '無', desc: '當你打出此卡時，你可以移除農莊中的1座馬廄並取得1隻牛。此卡可以裝無限數量的牛。(計分時此卡不視作圈地)', img: 'BIm1.jpg', r: 1, c: 1 },
  { id: 'BI07', name: '呂濱斯本紡織廠', req: '1隻羊', cost: '無', pass: '否', vp: '1分', bonus: '無', desc: '當你打出此卡時，其他玩家可以從供應區拿2份食物。有幾位玩家如此做，你就可以支付幾個建築資源到供應區換分，1個1分。支付的資源必須皆相異。', img: 'BIm1.jpg', r: 1, c: 2 },
  { id: 'BI08', name: '吉士', req: '1張爐子符號發展卡', cost: '無', pass: '否', vp: '無', bonus: '無', desc: '打出此卡時剩下幾次收穫階段，你立刻得幾份食物。每當你從累積行動格拿取石頭時，你必須留下1顆石頭在該行動格上。', img: 'BIm1.jpg', r: 2, c: 1 },
  { id: 'BI01', name: '斯本勃城堡', req: '2張職業卡', cost: '1木+1磚+2石', pass: '否', vp: '2分', bonus: '無', desc: '每當任意玩家執行累積木頭/石頭行動格時，從供應區放1塊木頭/石頭到此卡上。每當你用家庭成員執行翻修行動格前，你可以從此卡上拿下最多5個資源到你的供應區。(計分前退還此卡上的所有資源)', img: 'BIm1.jpg', r: 2, c: 2 }
];

const biOccs = [
  { id: 'BI21', name: '總編輯', req: '1+', pass: '否', bonus: '有', desc: '下一次你派成員去執行釣魚行動格時，額外獲得2分紅利分數。在那之後，每次執行獲得1分紅利分數。', img: 'BIo1.jpg', r: 0, c: 0 },
  { id: 'BI15', name: '夜訪吸血鬼', req: '3+', pass: '否', bonus: '無', desc: '此卡只能在你右手邊的玩家(上家)剛執行完累積行動格，接著輪到你時被打出。你立刻執行相同的行動，獲得的東西相同於該格被你上家執行前原有的東西。(從供應區拿取)', img: 'BIo1.jpg', r: 0, c: 1 },
  { id: 'BI18', name: '蘋果漢', req: '1+', pass: '否', bonus: '無', desc: '每次返家階段，你可以支付1份蔬菜以執行「犁一塊田」、「建造柵欄」、或「建造馬廄」的行動，不須派遣家庭成員。', img: 'BIo1.jpg', r: 0, c: 2 },
  { id: 'BI16', name: '研究所創辦人', req: '4+', pass: '否', bonus: '無', desc: '當你打出此卡時，你可以立刻付1份食物買1個麥子。在收穫階段的餵養階段，你的第4和第5位家庭成員合計只需餵1份食物。', img: 'BIo1.jpg', r: 1, c: 0 },
  { id: 'BI20', name: '生存主義者', req: '1+', pass: '否', bonus: '無', desc: '在收成階段的餵養階段，你可以用這張卡將至多4個的相異建築資源轉換成食物，每個換成2份。若你如此做，從取得的食物裡拿1份放到「釣魚」行動格上。', img: 'BIo1.jpg', r: 1, c: 1 },
  { id: 'BI22', name: '抗爭歌手', req: '1+', pass: '否', bonus: '無', desc: '你農莊中每格未使用空地可以裝一隻動物。(該空地仍視為未使用)這些動物不能參與收穫階段的繁殖階段。', img: 'BIo1.jpg', r: 1, c: 2 },
  { id: 'BI23', name: '系統理論家', req: '1+', pass: '否', bonus: '有', desc: '每次你建造至少1座馬廄時，你獲得1份食物。遊戲結束時，若你有2/3/4座馬廄兩兩皆相鄰(包含斜角)，你獲得1/2/3分紅利分數。', img: 'BIo1.jpg', r: 2, c: 0 },
  { id: 'BI24', name: '合作社成員', req: '3+', pass: '否', bonus: '無', desc: '每次其他玩家執行「增加家庭成員」行動，你可以從供應區拿1份食物擺在此卡上。遊戲中限一次，在3/4/5位玩家的遊戲中，你可以支付此卡上的3/4/5份食物使你下一次執行「增加家庭成員」行動如同「增加家庭成員即使沒有空房間」行動。', img: 'BIo1.jpg', r: 2, c: 1 }
];

biMinors.forEach(c => {
  const cardData = {
    "卡片ID": c.id,
    "牌名": c.name,
    "類型": "次要發展卡",
    "先決條件": c.req,
    "費用": c.cost,
    "是否傳遞": c.pass,
    "勝利點數": c.vp,
    "紅利分數": c.bonus,
    "牌組": "BI",
    "說明": c.desc,
    "card_type": "minor",
    "grid_cols": 3,
    "grid_rows": 3,
    "source_image": c.img,
    "grid_row": c.r,
    "grid_col": c.c
  };
  const existingIdx = cardsJson.findIndex(x => x['卡片ID'] === c.id);
  if (existingIdx !== -1) cardsJson[existingIdx] = cardData;
  else cardsJson.push(cardData);
});

biOccs.forEach(c => {
  const cardData = {
    "卡片ID": c.id,
    "牌名": c.name,
    "類型": "職業卡",
    "人數": c.req,
    "是否傳遞": c.pass,
    "紅利分數": c.bonus,
    "牌組": "BI",
    "說明": c.desc,
    "card_type": "occupation",
    "grid_cols": 3,
    "grid_rows": 3,
    "source_image": c.img,
    "grid_row": c.r,
    "grid_col": c.c
  };
  const existingIdx = cardsJson.findIndex(x => x['卡片ID'] === c.id);
  if (existingIdx !== -1) cardsJson[existingIdx] = cardData;
  else cardsJson.push(cardData);
});

fs.writeFileSync('cards.json', JSON.stringify(cardsJson, null, 2), 'utf8');
console.log('BI cards inserted successfully.');
