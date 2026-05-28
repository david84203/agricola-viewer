const fs = require('fs');
const path = require('path');

const rawCards = [
  // 6.jpg
  { id: "A002*", name: "走耕", type: "minor", cost: "2份食物", pts: "無", req: "無", desc: "你立即犁1塊田。在你打出此卡後，將其傳給你左手邊的玩家，加入他的手牌中。", deck: "A", bonus: "無", pass: "是", img: "006.jpg" },
  // 13.jpg
  { id: "A009*", name: "幼畜市場", type: "minor", cost: "1隻羊", pts: "無", req: "無", desc: "你立即獲得1頭牛（此卡效果等於你用1隻羊換取1頭牛）。在你打出此卡後，將其傳給你左手邊的玩家，加入他的手牌中。", deck: "A", bonus: "無", pass: "是", img: "013.jpg" },
  // 14.jpg
  { id: "A050*", name: "牛奶壺", type: "minor", cost: "1塊磚頭", pts: "無", req: "無", desc: "每當有玩家（包含你）使用「牛市」累積行動格時，你獲得3份食物，每位其他玩家獲得1份食物。", deck: "A", bonus: "無", pass: "否", img: "014.jpg" },
  { id: "B010*", name: "篷車", type: "minor", cost: "3根木頭3份食物", pts: "無", req: "無", desc: "此卡視為一個房間，供一位家庭成員居住。", deck: "B", bonus: "無", pass: "否", img: "014.jpg" },
  { id: "B077*", name: "土坑", type: "minor", cost: "1份食物", pts: "1分", req: "3張職業卡", desc: "你每次使用「臨時工」行動格時，便額外獲得3塊磚頭。", deck: "B", bonus: "無", pass: "否", img: "014.jpg" },
  { id: "A055*", name: "儲藏室", type: "minor", cost: "1根木頭1塊磚頭", pts: "無", req: "無", desc: "你每次購買一張主要發展卡或打出一張次要發展卡（含此卡）後，你獲得1份食物。", deck: "A", bonus: "無", pass: "否", img: "014.jpg" },
  { id: "A063*", name: "荷式風車", type: "minor", cost: "2根木頭2塊石頭", pts: "2分", req: "無", desc: "若你在緊接著有收成階段的回合中，執行一次「烤麵包」行動，則你額外獲得3份食物。", deck: "A", bonus: "無", pass: "否", img: "014.jpg" },
  { id: "A056*", name: "籃子", type: "minor", cost: "1綑蘆葦", pts: "無", req: "無", desc: "你每次使用木頭累積行動格後，可立即用2根木頭換取3份食物，將這2根木頭放在該累積行動格上。", deck: "A", bonus: "無", pass: "否", img: "014.jpg" },
  { id: "A053*", name: "陶製菸斗", type: "minor", cost: "1塊磚頭", pts: "無", req: "無", desc: "在每回合的結束階段中，若你在同回合的行動階段獲得至少7份建築資源，你獲得2份食物。", deck: "A", bonus: "無", pass: "否", img: "014.jpg" },
  { id: "A044*", name: "塘邊小屋", type: "minor", cost: "1根木頭", pts: "1分", req: "恰好2張職業卡", desc: "在接下來的3個回合行動格上各放1份食物。你在這些回合開始時，領取該格上的食物。", deck: "A", bonus: "無", pass: "否", img: "014.jpg" },
  { id: "B008*", name: "蔬菜攤", type: "minor", cost: "1份小麥", pts: "無", req: "無", desc: "你立即獲得1份蔬菜（此卡效果等於你用1份小麥換取1份蔬菜）。在你打出此卡後，將其傳給你左手邊的玩家，加入他的手牌中。", deck: "B", bonus: "無", pass: "是", img: "014.jpg" },
  // 15.jpg
  { id: "B057*", name: "廚具櫃", type: "minor", cost: "1根木頭1塊磚頭", pts: "無", req: "無", desc: "每回合開始時，若你住在木屋，便獲得1份食物。", deck: "B", bonus: "無", pass: "否", img: "015.jpg" },
  { id: "B039*", name: "織布機", type: "minor", cost: "2根木頭", pts: "1分", req: "2張職業卡", desc: "在每次收成階段的收割作物步驟中，若你有至少1/4/7隻羊，便獲得1/2/3份食物。遊戲結束計分時，你每有3隻羊便獲得1分紅利分數。", deck: "B", bonus: "有", pass: "否", img: "015.jpg" },
  { id: "B025*", name: "麵包鏟", type: "minor", cost: "1根木頭", pts: "無", req: "無", desc: "當你打出此卡時，立即獲得1份食物。你每打出一張職業卡，可以額外執行一次「烤麵包」行動。", deck: "B", bonus: "無", pass: "否", img: "015.jpg" },
  { id: "B045*", name: "草莓園", type: "minor", cost: "1根木頭", pts: "2分", req: "2塊蔬菜田", desc: "在接下來的3個回合行動格上各放1份食物，你在這些回合開始時，領取該格上的食物。", deck: "B", bonus: "無", pass: "否", img: "015.jpg" },
  { id: "B050*", name: "奶油攪拌器", type: "minor", cost: "1根木頭", pts: "1分", req: "至多3張職業卡", desc: "在每次收成階段的收割作物步驟中，你每有3隻羊便獲得1份食物，每有2頭牛便獲得1份食物。", deck: "B", bonus: "無", pass: "否", img: "015.jpg" },
  { id: "B036*", name: "瓶瓶罐罐", type: "minor", cost: "見下文", pts: "4分", req: "無", desc: "你必須為你的每位家庭成員各支付1塊磚頭和1份食物，才能打出此卡。", deck: "B", bonus: "無", pass: "否", img: "015.jpg" },
  { id: "B056*", name: "小溪", type: "minor", cost: "無", pts: "無", req: "你有1位家庭成員在「釣魚」", desc: "你每次使用「釣魚」累積行動格上方的四個累積行動格之一，便額外獲得1份食物。", deck: "B", bonus: "無", pass: "否", img: "015.jpg" },
  { id: "B047*", name: "鯡魚鍋", type: "minor", cost: "1塊磚頭", pts: "無", req: "無", desc: "你每次使用「釣魚」累積行動格時，在接下來3個回合行動格上各放1份食物。你在這些回合開始時，領取該格上的食物。", deck: "B", bonus: "無", pass: "否", img: "015.jpg" },
  { id: "B033*", name: "豪華暖爐", type: "minor", cost: "1塊石頭", pts: "-3分", req: "已翻修成磚屋或石屋", desc: "當你打出此卡時，遊戲尚餘的每個完整回合（不含本回合），都讓你立即獲得1分紅利分數。直到遊戲結束，你不能再翻修房舍。", deck: "B", bonus: "有", pass: "否", img: "015.jpg" },
  // 16.jpg
  { id: "B084*", name: "一籃橡子", type: "minor", cost: "1綑蘆葦", pts: "無", req: "3張職業卡", desc: "在接下來的2個回合行動格上各放1頭豬，你在這些回合開始時，領取該格上的豬。", deck: "B", bonus: "無", pass: "否", img: "016.jpg" },
  { id: "B068*", name: "豆田", type: "minor", cost: "1份小麥", pts: "1分", req: "2張職業卡", desc: "此卡視為1塊農田，你只能在其上種植蔬菜。", deck: "B", bonus: "無", pass: "否", img: "016.jpg" },
  { id: "B062*", name: "乾草叉", type: "minor", cost: "1根木頭", pts: "無", req: "無", desc: "你每次使用「小麥種子」行動格時，若「犁田」行動格已被佔據，便額外獲得3份食物。", deck: "B", bonus: "無", pass: "否", img: "016.jpg" },
  { id: "A026*", name: "臥室", type: "minor", cost: "1根木頭", pts: "1分", req: "2塊麥田", desc: "你可使用任何一個「增加家庭成員」行動格，即使該行動格上已有其他玩家的家庭成員。", deck: "A", bonus: "無", pass: "否", img: "016.jpg" },
  { id: "B074*", name: "密林", type: "minor", cost: "無", pts: "無", req: "個人供應區有5塊磚頭", desc: "在接下來的每個偶數回合行動格上各放1根木頭，你在這些回合開始時，領取該格上的木頭。", deck: "B", bonus: "無", pass: "否", img: "016.jpg" },
  { id: "B061*", name: "三田輪耕法", type: "minor", cost: "無", pts: "無", req: "3張職業卡", desc: "在每次收成階段的收割作物步驟開始時，若你有至少1塊麥田、1塊蔬菜田和1塊空農田，便獲得3份食物。", deck: "B", bonus: "無", pass: "否", img: "016.jpg" },
  { id: "A024*", name: "打穀板", type: "minor", cost: "1根木頭", pts: "1分", req: "2張職業卡", desc: "你每次使用「犁田」或「耕作」行動格時，可以額外執行一次「烤麵包」行動。", deck: "A", bonus: "無", pass: "否", img: "016.jpg" },
  { id: "B080*", name: "陶器", type: "minor", cost: "1塊磚頭", pts: "無", req: "無", desc: "在任何時候，你可用2/3/4塊磚頭換取1/2/3塊石頭。", deck: "B", bonus: "無", pass: "否", img: "016.jpg" },
  { id: "B066*", name: "推車", type: "minor", cost: "2根木頭", pts: "無", req: "2張職業卡", desc: "在第5、8、11和14回合行動格上各放1份小麥（僅在尚未開始的回合放置），你在這些回合開始時，領取該格上的小麥。", deck: "B", bonus: "無", pass: "否", img: "016.jpg" },
  // 17.jpg
  { id: "B002*", name: "迷你圈地", type: "minor", cost: "2份食物", pts: "無", req: "無", desc: "你立即將1個區域圈成圈地，不須支付木頭（若你已有圈地，該新圈地必須緊鄰既有的圈地）。在你打出此卡後，將其傳給你左手邊的玩家，加入他的手牌中。", deck: "B", bonus: "無", pass: "是", img: "017.jpg" },
  { id: "A019*", name: "手推犁", type: "minor", cost: "1根木頭", pts: "無", req: "無", desc: "在目前回合數加上5的回合行動格上放1張農田板塊，在該回合開始時，你可以將該板塊放入你的農莊。", deck: "A", bonus: "無", pass: "否", img: "017.jpg" },
  { id: "B019*", name: "板犁", type: "minor", cost: "2根木頭", pts: "無", req: "1張職業卡", desc: "在此卡上放置2張農田板塊。遊戲中你可以使用以下效果2次：當你使用「犁田」行動格時，額外拿取此卡上的1張農田板塊放入你的農莊。", deck: "B", bonus: "無", pass: "否", img: "017.jpg" },
  { id: "A005*", name: "磚頭倉庫", type: "minor", cost: "1份食物", pts: "無", req: "無", desc: "你的個人供應區每有2塊磚頭，立即獲得1塊磚頭。在你打出此卡後，將其傳給你左手邊的玩家，加入他的手牌中。", deck: "A", bonus: "無", pass: "是", img: "017.jpg" },
  { id: "A016*", name: "黏土壓實", type: "minor", cost: "無", pts: "無", req: "無", desc: "當你打出此卡時，立即獲得1塊磚頭。當你建造柵欄時，可以支付磚頭來替代木頭。", deck: "A", bonus: "無", pass: "否", img: "017.jpg" },
  { id: "B013*", name: "木匠小屋", type: "minor", cost: "1根木頭+1顆石頭", pts: "無", req: "無", desc: "你每擴建一個木造房間，只須支付2根木頭與2綑蘆葦。", deck: "B", bonus: "無", pass: "否", img: "017.jpg" },
  { id: "B024*", name: "套索", type: "minor", cost: "1綑蘆葦", pts: "無", req: "無", desc: "你可連續派遣剛好2位家庭成員執行行動，每當你讓其中至少1位使用「羊市」、「豬市」或「牛市」累積行動格時，便能如此做。", deck: "B", bonus: "無", pass: "否", img: "017.jpg" },
  { id: "A012*", name: "飲水槽", type: "minor", cost: "1塊磚頭", pts: "無", req: "無", desc: "你的每個圈地（不論有無馬廄）可額外容納至多2隻動物。", deck: "A", bonus: "無", pass: "否", img: "017.jpg" },
  { id: "A038*", name: "羊毛毯", type: "minor", cost: "無", pts: "無", req: "5隻羊", desc: "遊戲結束計分時，若你住在木/磚/石屋，你獲得3/2/0分紅利分數。", deck: "A", bonus: "有", pass: "否", img: "017.jpg" },
  // 18.jpg
  { id: "A083*", name: "牧羊杖", type: "minor", cost: "1根木頭", pts: "無", req: "無", desc: "你每次圈出1個佔地至少4個區域的新圈地時，立即獲得2隻羊，將其安置於此新圈地中。", deck: "A", bonus: "無", pass: "否", img: "018.jpg" },
  { id: "A075*", name: "鋸木廠", type: "minor", cost: "2塊石頭", pts: "2分", req: "至多3張職業卡", desc: "你的每張發展卡費用都減少1根木頭。", deck: "A", bonus: "無", pass: "否", img: "018.jpg" },
  { id: "A069*", name: "大型溫室", type: "minor", cost: "2根木頭", pts: "無", req: "2張職業卡", desc: "在目前回合數加上4、7與9的回合行動格中各放1份蔬菜。你在這些回合開始時，領取該格上的蔬菜。", deck: "A", bonus: "無", pass: "否", img: "018.jpg" },
  { id: "A080*", name: "採石鉗", type: "minor", cost: "1根木頭", pts: "無", req: "無", desc: "你每次使用一個石頭累積行動格時，額外獲得1塊石頭。", deck: "A", bonus: "無", pass: "否", img: "018.jpg" },
  { id: "A067*", name: "穀物勺", type: "minor", cost: "1根木頭", pts: "無", req: "無", desc: "你每次使用「小麥種子」行動格時，額外獲得1份小麥。", deck: "A", bonus: "無", pass: "否", img: "018.jpg" },
  { id: "B016*", name: "礦工鎚", type: "minor", cost: "1根木頭", pts: "無", req: "無", desc: "當你打出此卡時，立即獲得1份食物。每次你翻修房舍時，不須支付木頭即可建設一棟馬廄。", deck: "B", bonus: "無", pass: "否", img: "018.jpg" },
  { id: "A033*", name: "大農莊", type: "minor", cost: "無", pts: "無", req: "所有區域均已使用", desc: "遊戲尚餘的每個完整回合（不含本回合）都讓你立即獲得1分紅利分數及2份食物。", deck: "A", bonus: "有", pass: "否", img: "018.jpg" },
  { id: "A071*", name: "鏟子", type: "minor", cost: "1根木頭", pts: "無", req: "無", desc: "任何時候，你可以從其上有至少2份作物的農田上，移動1份作物到一塊空農田上。", deck: "A", bonus: "無", pass: "否", img: "018.jpg" },
  { id: "A078*", name: "獨木舟", type: "minor", cost: "2根木頭", pts: "1分", req: "1張職業卡", desc: "你每次使用「釣魚」累積行動格時，額外獲得1份食物與1綑蘆葦。", deck: "A", bonus: "無", pass: "否", img: "018.jpg" },
  // 19.jpg
  { id: "A032*", name: "馬槽", type: "minor", cost: "2根木頭", pts: "無", req: "無", desc: "遊戲結束計分時，若你的圈地至少包含6/7/8/10個區域，你獲得1/2/3/4分紅利分數。", deck: "A", bonus: "有", pass: "否", img: "019.jpg" },
  { id: "A092*", name: "養父母", type: "occ", desc: "你可以支付1份食物，讓你在本回合新增的家庭成員執行一個行動，執行行動後，該家庭成員不再算是「新生兒」。", deck: "A", bonus: "無", pass: "否", img: "019.jpg" },
  { id: "B166*", name: "養牛婦", type: "occ", desc: "你每次使用「小麥種子」行動格時，可以支付1份食物來換取1頭牛。", deck: "B", bonus: "無", pass: "否", img: "019.jpg" },
  { id: "B126*", name: "木匠", type: "occ", desc: "當你擴建房舍時，每擴建一個房間，僅須支付3份對應的建築資源和2綑蘆葦（例如：擴建一間木造房間，僅須3根木頭與2綑蘆葦）。", deck: "B", bonus: "無", pass: "否", img: "019.jpg" },
  { id: "B142*", name: "菜販", type: "occ", desc: "你每次使用「小麥種子」行動格時，額外獲得1份蔬菜。", deck: "B", bonus: "無", pass: "否", img: "019.jpg" },
  { id: "B164*", name: "召羊人", type: "occ", desc: "將目前的回合數加上2、5、8與10，在這些回合行動格中各放1隻羊。你在這些回合開始時，領取該格上的羊。", deck: "B", bonus: "無", pass: "否", img: "019.jpg" },
  { id: "B145*", name: "撿柴人", type: "occ", desc: "你每次翻修房舍或擴建一個房間時，可以支付1根木頭來替代1或2綑蘆葦的費用。", deck: "B", bonus: "無", pass: "否", img: "019.jpg" },
  { id: "B156*", name: "倉庫管理員", type: "occ", desc: "你每次使用「建材市場」行動格時，可以額外獲得1塊磚頭或1份小麥。", deck: "B", bonus: "無", pass: "否", img: "019.jpg" },
  { id: "B163*", name: "神父", type: "occ", desc: "一旦你是唯一一位只有2個房間的玩家，立即獲得3根木頭、2塊磚頭、1綑蘆葦與1塊石頭（僅獲得一次）。", deck: "B", bonus: "無", pass: "否", img: "019.jpg" },
  // 20.jpg
  { id: "B118*", name: "小戶農家", type: "occ", desc: "每回合開始時，若你有剛好2個房間，則獲得1根木頭。", deck: "B", bonus: "無", pass: "否", img: "020.jpg" },
  { id: "B109*", name: "造紙人", type: "occ", desc: "在打出此卡後，每次你打出一張職業卡前，可以立即支付1根木頭，來獲得等同你面前職業卡張數的食物。", deck: "B", bonus: "無", pass: "否", img: "020.jpg" },
  { id: "A108*", name: "採菇人", type: "occ", desc: "你每次使用木頭累積行動格後，可以立即用1根木頭換取2份食物，將用來轉換的木頭放在該累積行動格上。", deck: "A", bonus: "無", pass: "否", img: "020.jpg" },
  { id: "B121*", name: "地理學家", type: "occ", desc: "你每次使用「森林」或「蘆葦池」累積行動格時，額外獲得1塊磚頭。3人以上遊戲時，使用「黏土坑」累積行動格亦能額外獲得1塊磚頭。", deck: "B", bonus: "無", pass: "否", img: "020.jpg" },
  { id: "B108*", name: "顧爐工", type: "occ", desc: "你每次使用一個木頭累積行動格時，可額外執行一次「烤麵包」行動。", deck: "B", bonus: "無", pass: "否", img: "020.jpg" },
  { id: "A133*", name: "吹牛大王", type: "occ", desc: "遊戲結束計分時，若你面前有至少5/6/7/8/9/10張發展卡，則獲得2/3/4/5/7/9分紅利分數。", deck: "A", bonus: "有", pass: "否", img: "020.jpg" },
  { id: "B107*", name: "男僕", type: "occ", desc: "一旦你住在石屋，在接下來的每個回合行動格中各放3份食物。你在這些回合開始時，領取該格上的食物。", deck: "B", bonus: "無", pass: "否", img: "020.jpg" },
  { id: "B104*", name: "牧羊童", type: "occ", desc: "你可在任何時候將1隻羊轉換成1頭豬、1份蔬菜或1塊石頭。", deck: "B", bonus: "無", pass: "否", img: "020.jpg" },
  { id: "B114*", name: "無子嗣者", type: "occ", desc: "每回合開始時，若你有至少3個房間但只有2位家庭成員，獲得1份食物和1份作物（小麥或蔬菜）。", deck: "B", bonus: "無", pass: "否", img: "020.jpg" },
  // 21.jpg
  { id: "B089*", name: "馬伕", type: "occ", desc: "當你打出此卡時，立即獲得1根木頭。一旦你住在石屋，每回合開始時，可以支付1根木頭來建設剛好1棟馬廄。", deck: "B", bonus: "無", pass: "否", img: "021.jpg" },
  { id: "A090*", name: "馭犁者", type: "occ", desc: "一旦你住在石屋中，在每回合開始時，可以支付1份食物來犁1塊田。", deck: "A", bonus: "無", pass: "否", img: "021.jpg" },
  { id: "B098*", name: "有機農", type: "occ", desc: "遊戲結束計分時，你每有一個圈地，其上有至少1隻動物且尚可容納3隻以上動物，獲得1分紅利分數。", deck: "B", bonus: "有", pass: "否", img: "021.jpg" },
  { id: "B087*", name: "工頭", type: "occ", desc: "你每次使用「臨時工」行動格時，可以擴建剛好一個房間或翻修房舍（仍須支付對應費用）。", deck: "B", bonus: "無", pass: "否", img: "021.jpg" },
  { id: "A143*", name: "切石工", type: "occ", desc: "你執行發展卡、擴建房舍和翻修房舍行動時，皆可少支付1塊石頭。", deck: "A", bonus: "無", pass: "否", img: "021.jpg" },
  { id: "B136*", name: "管家", type: "occ", desc: "若遊戲尚有1/3/6/9個回合未開始進行，你立即獲得1/2/3/4根木頭。遊戲結束計分時，有最多房間的每一位玩家獲得3分紅利分數。", deck: "B", bonus: "有", pass: "否", img: "021.jpg" },
  { id: "B091*", name: "農事幫工", type: "occ", desc: "你每次使用「臨時工」行動格時，可以額外犁1塊田。", deck: "B", bonus: "無", pass: "否", img: "021.jpg" },
  { id: "B123*", name: "屋頂壓載工", type: "occ", desc: "當你打出此卡時，可以立即支付1份食物，來獲得等同你房間數量的石頭。", deck: "B", bonus: "無", pass: "否", img: "021.jpg" },
  { id: "A138*", name: "鏢魚手", type: "occ", desc: "你每次使用「釣魚」累積行動格時，可以支付1根木頭來獲得1綑蘆葦和等同家庭成員數的食物。", deck: "A", bonus: "無", pass: "否", img: "021.jpg" },
  // 22.jpg
  { id: "A160*", name: "魯特琴手", type: "occ", desc: "每次其他玩家使用「賣藝」累積行動格時，你獲得1份食物和1根木頭，之後你可立即支付2份食物來換取剛好1份蔬菜。", deck: "A", bonus: "無", pass: "否", img: "022.jpg" },
  { id: "A088*", name: "樹籬修剪工", type: "occ", desc: "你每次執行「建造柵欄」行動時，所建造的柵欄中，其中3根不須支付木頭。", deck: "A", bonus: "無", pass: "否", img: "022.jpg" },
  { id: "A098*", name: "馬廄建築師", type: "occ", desc: "遊戲結束計分時，你的每棟圈地外馬廄讓你獲得1分紅利分數。", deck: "A", bonus: "有", pass: "否", img: "022.jpg" },
  { id: "B099*", name: "家庭教師", type: "occ", desc: "遊戲結束計分時，你在此卡之後打出的每一張職業卡，都讓你獲得1分紅利分數。", deck: "B", bonus: "有", pass: "否", img: "022.jpg" },
  { id: "B102*", name: "顧問", type: "occ", desc: "在1/2/3/4人遊戲中，當你打出此卡時，立即獲得2份小麥/3塊磚頭/2綑蘆葦/2隻羊。", deck: "B", bonus: "無", pass: "否", img: "022.jpg" },
  { id: "A155*", name: "雜耍藝人", type: "occ", desc: "你每次使用「賣藝」累積行動格時，額外獲得1根木頭和1份小麥。", deck: "A", bonus: "無", pass: "否", img: "022.jpg" },
  { id: "B097*", name: "學者", type: "occ", desc: "一旦你住在石屋，每回合開始時，可以支付1份食物作為職業卡費用來打出一張職業卡，或支付1張次要發展卡上的費用來打出該卡。", deck: "B", bonus: "無", pass: "否", img: "022.jpg" },
  { id: "B095*", name: "砌磚大師", type: "occ", desc: "你每次購買一張主要發展卡時，可以減少石頭的費用，減少的數量等於你已擴建的房間數量（你起始的2個房間不計入）。", deck: "B", bonus: "無", pass: "否", img: "022.jpg" },
  { id: "A102*", name: "雜貨商", type: "occ", desc: "如圖所示，將貨物依序疊在此卡上(木頭,磚頭,蘆葦,石頭,小麥,蔬菜,羊,豬,牛，依序堆疊)，你可在任何時候支付1份食物換取此貨物堆頂的1份貨物。", deck: "A", bonus: "無", pass: "否", img: "022.jpg" },
  // 23.jpg
  { id: "A119*", name: "拾木者", type: "occ", desc: "你每次使用「犁田」、「小麥種子」、「運用小麥」或「耕作」行動格，在該次行動結束時，你獲得1根木頭。", deck: "A", bonus: "無", pass: "否", img: "023.jpg" },
  { id: "A120*", name: "磚屋師傅", type: "occ", desc: "一旦你的木屋翻修成其他等級，在接下來的5個回合行動格中各放2塊磚頭。你在這些回合開始時，領取該格上的磚頭。", deck: "A", bonus: "無", pass: "否", img: "023.jpg" },
  { id: "A125*", name: "牧師", type: "occ", desc: "打出此卡時，若你住在磚屋中，且剛好只有兩個房間，你立即獲得3塊磚頭、2綑蘆葦與2塊石頭。", deck: "A", bonus: "無", pass: "否", img: "023.jpg" },
  { id: "A114*", name: "季節工", type: "occ", desc: "你每次使用「臨時工」行動格時，額外獲得1份小麥。從第6回合起，你可改為額外獲得1份蔬菜。", deck: "A", bonus: "無", pass: "否", img: "023.jpg" },
  { id: "A165*", name: "野豬哺育師", type: "occ", desc: "當你打出此卡時，立即獲得1頭野豬。你的野豬將在第12回合結束前進行一次「繁殖牲畜」步驟（若屆時有空間安置新生小豬）。", deck: "A", bonus: "無", pass: "否", img: "023.jpg" },
  { id: "A123*", name: "架樑工", type: "occ", desc: "你每次擴建或翻修房舍時，可以支付1根木頭來替代剛好2塊磚頭或2塊石頭的費用，但每個房間/行動僅限一次。", deck: "A", bonus: "無", pass: "否", img: "023.jpg" },
  { id: "A110*", name: "泥灰供應商", type: "occ", desc: "你每次擴建至少1個磚造房間或將磚屋翻修成石屋時，獲得3份食物。", deck: "A", bonus: "無", pass: "否", img: "023.jpg" },
  { id: "A116*", name: "伐木工", type: "occ", desc: "你每次使用一個木頭累積行動格時，額外獲得1根木頭。", deck: "A", bonus: "無", pass: "否", img: "023.jpg" },
  // 24.jpg
  { id: "A112*", name: "小麥收割工", type: "occ", desc: "當你打出此卡時，立即獲得1份小麥。在收成階段的收割作物步驟中，你可以從你的每塊麥田上額外收割1份小麥。", deck: "A", bonus: "無", pass: "否", img: "024.jpg" },
  { id: "A147*", name: "牲畜趕集人", type: "occ", desc: "你每次使用「羊市」、「豬市」或「牛市」累積行動格時，可以支付1份食物來額外換取1隻同種類的動物。", deck: "A", bonus: "無", pass: "否", img: "024.jpg" },
  { id: "A111*", name: "泥水師傅", type: "occ", desc: "你每次擴建至少1個房間時，可以在接下來4個回合行動格上各放1份食物。你在這些回合開始時，領取該格上的食物。", deck: "A", bonus: "無", pass: "否", img: "024.jpg" },
  { id: "A086*", name: "馴養員", type: "occ", desc: "當你打出此卡時，立即選擇獲得1根木頭或1份小麥。你的每個房間皆可安置1隻任意種類的動物，而非整棟房舍裡只能養一隻寵物。", deck: "A", bonus: "無", pass: "否", img: "024.jpg" },
  { id: "A087*", name: "管理員", type: "occ", desc: "當你翻修房舍時，可以將木屋直接翻修成石屋，不須先翻修成磚屋。", deck: "A", bonus: "無", pass: "否", img: "024.jpg" }
];

const cardsJsonPath = path.join(__dirname, 'cards.json');
const existingCards = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));

const formattedCards = [];
for (const card of rawCards) {
  if (card.type === 'minor') {
    formattedCards.push({
      "牌名": card.name,
      "類型": "次要發展卡",
      "先決條件": card.req,
      "費用": card.cost,
      "是否傳遞": card.pass,
      "勝利點數": card.pts,
      "紅利分數": card.bonus,
      "牌組": card.deck,
      "卡片ID": card.id,
      "說明": card.desc,
      "card_type": "minor",
      "source_image": card.img
    });
  } else if (card.type === 'occ') {
    formattedCards.push({
      "牌名": card.name,
      "類型": "職業卡",
      "是否傳遞": card.pass,
      "紅利分數": card.bonus,
      "牌組": card.deck,
      "卡片ID": card.id,
      "說明": card.desc,
      "card_type": "occupation",
      "source_image": card.img
    });
  }
}

// Add these to existingCards
let added = 0;
for (const fc of formattedCards) {
  if (!existingCards.some(c => c['卡片ID'] === fc['卡片ID'])) {
    existingCards.push(fc);
    added++;
  }
}

// Ensure the new ones get positions properly? Or maybe just let them have no position? The other script didn't set position either. Let's just append.
fs.writeFileSync(cardsJsonPath, JSON.stringify(existingCards, null, 2), 'utf8');
console.log(`Added ${added} correctly formatted cards.`);
