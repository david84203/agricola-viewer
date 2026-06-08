const fs = require('fs');
const path = require('path');

const goCards = [
  // Go1
  { "卡片ID": "G028", "牌名": "易怒者", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "有", "牌組": "G", "說明": "在你打出此卡時，若遊戲尚有1/3/6/9回合，則你獲得1/2/3/4根木頭。在遊戲結束時，有最少家庭成員或同為有最少家庭成員的玩家獲得2點紅利分數。", "圖片": "images/Go1.jpg", crop_top: 13, crop_bottom: 676, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G029", "牌名": "港口大師", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "每次你執行「釣魚」行動時，你得到額外1綑蘆葦。每當其他玩家執行「釣魚」行動時，你得到1綑蘆葦和1份食物。", "圖片": "images/Go1.jpg", crop_top: 13, crop_bottom: 676, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G023", "牌名": "貪吃者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "有", "牌組": "G", "說明": "在遊戲最後一次的收成階段，餵養家人之後，你可以支付3份食物換取1點紅利分數，最多換取6點紅利分數。", "圖片": "images/Go1.jpg", crop_top: 13, crop_bottom: 676, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G059", "牌名": "花言巧語者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "每次你從行動格上取得食物時，你得到額外的1份食物。透過職業或發展卡而得到的食物不算在內。", "圖片": "images/Go1.jpg", crop_top: 344, crop_bottom: 345, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G055", "牌名": "松露獵人", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "每次你以家庭成員執行行動，取得木頭時，若你有1/2/3頭豬，則你獲得額外的1/2/3份食物。", "圖片": "images/Go1.jpg", crop_top: 344, crop_bottom: 345, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G044", "牌名": "珍珠打撈者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "每次你執行「釣魚」行動時，得到額外的1顆石頭。可以使用「釣魚」行動格得到的食物再多買石頭，每顆石頭需付2份食物。", "圖片": "images/Go1.jpg", crop_top: 344, crop_bottom: 345, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G001", "牌名": "變通設計家", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "每當你建設柵欄或馬廄時，可使用等量的磚頭或石頭來取代木頭。每當你擴建房舍時，亦可使用等量的磚頭或石頭來取代木頭，每間房間最多使用2塊磚頭以及2塊石頭。", "圖片": "images/Go1.jpg", crop_top: 675, crop_bottom: 14, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G006", "牌名": "工匠", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "每次收成階段可使用一次：當你使用發展卡將建築資源轉換成食物時，你可以額外得到2份食物。", "圖片": "images/Go1.jpg", crop_top: 675, crop_bottom: 14, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G039", "牌名": "數學家", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "從第6回合開始，每回合開始階段補充料後，若是有2個木頭的行動格上的木頭數目相等，你可以從其中1格拿走1根木頭。對於磚頭的行動格也同樣適用。在5人遊戲，同樣適用於石頭的行動格。每回合你至多只能因此得到1個資源。", "圖片": "images/Go1.jpg", crop_top: 675, crop_bottom: 14, crop_left: 681, crop_right: 5 },

  // Go2
  { "卡片ID": "G035", "牌名": "求職者", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "這張卡打出後，不算是1張職業卡。在每回合開始時，若你打出的職業卡數，比2位其他玩家少，則你可以支付1份食物打出1張職業卡。(以此方式打出的職業卡不能回到玩家手上。)", "圖片": "images/Go2.jpg", crop_top: 13, crop_bottom: 676, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G049", "牌名": "種子大師", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "你隨時可以支付1份食物將1份小麥轉換成1份蔬菜；你隨時可以將1份蔬菜轉換成1份小麥。", "圖片": "images/Go2.jpg", crop_top: 13, crop_bottom: 676, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G019", "牌名": "美食評論家", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "有", "牌組": "G", "說明": "在打出此卡後，你下一次執行「釣魚」行動時，從供應區拿1份食物放到此卡上。每當你烤麵包，或將動物、蔬菜、建築資源轉換成食物時，你可以將被轉換的東西放在此卡上。遊戲結束時，此卡上有4/5/6/7+種不同種類的物品，你得到1/2/4/6分。", "圖片": "images/Go2.jpg", crop_top: 13, crop_bottom: 676, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G054", "牌名": "徵稅員", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "每當有其他玩家購買主要發展卡時，你可以拿走1個該玩家支付的建築資源，由你選擇拿走哪1個。你可以選擇額外再支付1份食物，若你如此做，則可以再獲得1個該玩家支付的建築資源。", "圖片": "images/Go2.jpg", crop_top: 344, crop_bottom: 345, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G048", "牌名": "馬戲團指導", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "每次你執行「賣藝」行動時，你可以打出1張次要發展卡，或是支付1份小麥打出1張主要發展卡。", "圖片": "images/Go2.jpg", crop_top: 344, crop_bottom: 345, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G060", "牌名": "冬季手工藝家", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在每次收成的「收割作物」及「餵養家人」階段之間，你可以打出1張次要發展卡，或是支付2份食物購買1張主要發展卡。(發展卡費用照常支付。)", "圖片": "images/Go2.jpg", crop_top: 344, crop_bottom: 345, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G046", "牌名": "池塘巡守員", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "在每回合的工作階段結束後，每位玩家都執行完行動後，你可以支付1份食物，將你派遣至「釣魚」行動格的家庭成員，移動到1個會累積木頭的行動格並且拿取該格的木頭。", "圖片": "images/Go2.jpg", crop_top: 675, crop_bottom: 14, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G034", "牌名": "發明家", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "對你而言，所有價格在4個建築資源以上的發展卡，都可以少支付1個資源，由你選擇少哪1個資源。", "圖片": "images/Go2.jpg", crop_top: 675, crop_bottom: 14, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G024", "牌名": "嫁接植物者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在「繁殖動物」階段，若你的個人供應區有2份以上麥子，你得到1份麥子；若你的個人供應區有2份以上蔬菜，你得到1份蔬菜。", "圖片": "images/Go2.jpg", crop_top: 675, crop_bottom: 14, crop_left: 681, crop_right: 5 },

  // Go3
  { "卡片ID": "G030", "牌名": "校長", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "有", "牌組": "G", "說明": "每當有其他玩家打出職業卡時，從公用區拿1份食物放在此卡上。每次你要打出職業卡時，你可以使用這張卡上的食物來支付費用。在4/5人遊戲結束時，此卡上每有3/4份食物，你獲得1點紅利分數。", "圖片": "images/Go3.jpg", crop_top: 13, crop_bottom: 676, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G047", "牌名": "資源收集者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在接下來4個回合的行動格上，放置1根木頭、1塊磚頭、1綑蘆葦、1顆石頭，4者的順序由你決定。在這些回合開始時領取該格上的資源。", "圖片": "images/Go3.jpg", crop_top: 13, crop_bottom: 676, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G057", "牌名": "素食者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "每次你將麥子或蔬菜轉換成食物，你得到額外的1份食物。整個遊戲過程中，你不得將動物轉換成食物。", "圖片": "images/Go3.jpg", crop_top: 13, crop_bottom: 676, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G032", "牌名": "狂熱份子", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "每當有其他玩家打出職業卡時，你可以支付1份食物打出1張次要發展卡，或是支付2份食物打出1張主要發展卡。", "圖片": "images/Go3.jpg", crop_top: 344, crop_bottom: 345, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G036", "牌名": "大器晚成的人", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "遊戲中任何時候，只要你的家庭成員數比任何其他玩家的家庭成員數都少，而且你的房舍內還有空房間，則你可以立即增加1名家庭成員。如此增加的家庭成員不算是新生兒，並且在當回合就可以執行行動。", "圖片": "images/Go3.jpg", crop_top: 344, crop_bottom: 345, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G033", "牌名": "製鋤者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "每當你至少建造1根柵欄時，你可以支付1份食物犁1片田。", "圖片": "images/Go3.jpg", crop_top: 344, crop_bottom: 345, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G025", "牌名": "女生意人", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在你打出此卡時，可以立即購買2張發展卡(主要或次要皆可)，以正常費用支付。", "圖片": "images/Go3.jpg", crop_top: 675, crop_bottom: 14, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G058", "牌名": "村莊農夫", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "有", "牌組": "G", "說明": "在你打出此卡時，若遊戲尚有1/3/6/9回合，則你獲得1/2/3/4根木頭。在遊戲結束時，有最多塊田或同為有最多塊田的玩家獲得3點紅利分數。", "圖片": "images/Go3.jpg", crop_top: 675, crop_bottom: 14, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G012", "牌名": "紅蘿蔔農夫", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "從公用區拿3份蔬菜放在此卡上，每次你執行「犁1塊農田」行動時，可以支付1份食物得到此卡上的1份蔬菜。", "圖片": "images/Go3.jpg", crop_top: 675, crop_bottom: 14, crop_left: 681, crop_right: 5 },

  // Go4
  { "卡片ID": "G053", "牌名": "堆石者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "當你建造柵欄或馬廄時，你可以將部分或全部費用使用石頭支付，每顆石頭等於2根木頭。", "圖片": "images/Go4.jpg", crop_top: 13, crop_bottom: 676, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G038", "牌名": "麵包大師的學徒", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在你打出此卡時，將箭頭標示在1個行動格上，該格的行動加上「和/或 烤麵包」。當其他玩家使用該行動格執行烤麵包時，你從公用區得到1份食物。在你打出此卡時，你可以立即執行一次「烤麵包」。", "圖片": "images/Go4.jpg", crop_top: 13, crop_bottom: 676, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G027", "牌名": "愛小麥的人", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "有", "牌組": "G", "說明": "在你打出此卡時，若遊戲尚有7個完整回合，你可以立刻犁1塊田，並且立刻在這塊田上種植小麥(你個人的供應區要有小麥種子)。在遊戲結束時，有最多麥子或同為有最多麥子的玩家獲得2點紅利分數。", "圖片": "images/Go4.jpg", crop_top: 13, crop_bottom: 676, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G008", "牌名": "拍賣官", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "分別在第7/9/11/13回合的行動格上，各擺2綑蘆葦、3根木頭、3塊磚頭、2塊石頭。在這些回合開始時，由所有玩家出食物競標，以暗標方式進行，將食物握在手中。出價最高者得到行動格上的資源，你得到該玩家所出的食物。若你贏得競標，則將你出的食物支付至公用區。競標出價若有平手，由當回合的玩家順位決定輸贏。", "圖片": "images/Go4.jpg", crop_top: 344, crop_bottom: 345, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G052", "牌名": "石頭商人", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "每次你以行動取得石頭時，你可以立刻支付1份食物，打出1張費用含石頭的發展卡。", "圖片": "images/Go4.jpg", crop_top: 344, crop_bottom: 345, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G050", "牌名": "歌手", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在你打出此卡時，得到2個建築資源(相同或不相同皆可)。", "圖片": "images/Go4.jpg", crop_top: 344, crop_bottom: 345, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G009", "牌名": "麵包師傅的女兒", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "若有其他玩家打出「麵包師傅」或「烘焙大師」時，你可立即打出此卡，而不須支付任何費用。你可以派遣你的家庭成員，去執行「拿1份小麥」或「播種 和/或 烤麵包」的行動，即使該行動格上已經有其他玩家的家庭成員。當你打出此卡時，你可以立即執行1次「烤麵包」。", "圖片": "images/Go4.jpg", crop_top: 675, crop_bottom: 14, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G007", "牌名": "天文學家", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "有", "牌組": "G", "說明": "在你打出此卡時，得到2份食物。若你有3/4/5位家庭成員使用3/4/5個相鄰的行動格，形成垂直或水平的一直線，則你獲得1/3/5分的紅利分數。這些相鄰的行動格必須大小相同。", "圖片": "images/Go4.jpg", crop_top: 675, crop_bottom: 14, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G016", "牌名": "圍籬幫手", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "每當其他玩家執行「建造柵欄」行動時，你可以支付該玩家1份食物並且執行「建造柵欄」行動。", "圖片": "images/Go4.jpg", crop_top: 675, crop_bottom: 14, crop_left: 681, crop_right: 5 },

  // Go5
  { "卡片ID": "G026", "牌名": "小麥農夫", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在「收割作物」階段一開始時，若你的農田上已播種的麥子數目有1/4/7/10個，你得到1/2/3/4份食物。", "圖片": "images/Go5.jpg", crop_top: 13, crop_bottom: 676, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G020", "牌名": "白吃白喝的人", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "每一回合，你第1個派遣的家庭成員，可以派至1個已經被其他玩家佔領的行動格執行行動。每回合你的第1個家庭成員不能派遣至「起始玩家」格。", "圖片": "images/Go5.jpg", crop_top: 13, crop_bottom: 676, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G018", "牌名": "漁夫的學徒", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "每當其他玩家執行「釣魚」行動時，你可以支付該玩家1份食物並且打出1張職業卡。", "圖片": "images/Go5.jpg", crop_top: 13, crop_bottom: 676, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G003", "牌名": "動物持有家", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "有", "牌組": "G", "說明": "在你打出此卡時，或遊戲尚有1/3/6/9回合，則你獲得1/2/3/4根木頭。在遊戲結束時，有最多動物或同為有最多動物的玩家獲得3點紅利分數。", "圖片": "images/Go5.jpg", crop_top: 344, crop_bottom: 345, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G015", "牌名": "家庭顧問", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在工作階段結束時，若你全部的家庭成員皆派遣至同一塊板子上工作，總計有2/3/4個家庭成員(新生兒不計算在內)，則你獲得1份食物/小麥/蔬菜。", "圖片": "images/Go5.jpg", crop_top: 344, crop_bottom: 345, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G031", "牌名": "好幫手", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "你可以派遣你的家庭成員，去執行「翻修房舍」、「擴建房舍」、「打1張主要或次要發展卡」的行動，即使該行動格上已經有其他玩家的家庭成員。", "圖片": "images/Go5.jpg", crop_top: 344, crop_bottom: 345, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G014", "牌名": "早起者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "在你打出此卡時，得到1隻羊。在你的收成階段，先執行「繁殖動物」，再執行「收割作物」以及「餵養家人」。剛出生的動物若沒有空間圈養，可以立即轉換成食物。", "圖片": "images/Go5.jpg", crop_top: 675, crop_bottom: 14, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G022", "牌名": "吹玻璃工", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "若你擁有烤爐，在收成階段，吹玻璃工可以將1/2塊磚頭轉換成3/5份食物。", "圖片": "images/Go5.jpg", crop_top: 675, crop_bottom: 14, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G056", "牌名": "替補者", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "若某個行動格上恰有1位你的家庭成員，你可以再派遣1位家庭成員至該行動格再執行1次行動。(新生兒算是家庭成員。)", "圖片": "images/Go5.jpg", crop_top: 675, crop_bottom: 14, crop_left: 681, crop_right: 5 },

  // Go6
  { "卡片ID": "G042", "牌名": "最古老的職業", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "無", "牌組": "G", "說明": "從第5回合開始，每當有其他玩家執行「臨時工」行動時，他可以支付你2份食物以增加家庭成員。(該玩家房舍內要有空房間才能如此做。如果你自己執行「臨時工」，不需支付食物便可增加家庭成員)", "圖片": "images/Go6.jpg", crop_top: 13, crop_bottom: 676, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G005", "牌名": "建築師", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "你擴建每間房間時可得到2份食物。你建造每棟馬廄時可得到1份食物。", "圖片": "images/Go6.jpg", crop_top: 13, crop_bottom: 676, crop_left: 349, crop_right: 337 },
  { "卡片ID": "G051", "牌名": "搬石工", "card_type": "occupation", "遊玩人數": "3+", "紅利分數": "無", "牌組": "G", "說明": "在第8、10、12、14回合的行動格上，各擺1塊石頭。在這些回合開始時領取該格上的石頭。", "圖片": "images/Go6.jpg", crop_top: 13, crop_bottom: 676, crop_left: 681, crop_right: 5 },
  { "卡片ID": "G021", "牌名": "隱士", "card_type": "occupation", "遊玩人數": "4+", "紅利分數": "有", "牌組": "G", "說明": "遊戲結束時，若這張卡是你唯一有打出的職業卡，你獲得6點紅利分數。", "圖片": "images/Go6.jpg", crop_top: 344, crop_bottom: 345, crop_left: 17, crop_right: 669 },
  { "卡片ID": "G011", "牌名": "紅蘿蔔蛋糕師傅", "card_type": "occupation", "遊玩人數": "1+", "紅利分數": "無", "牌組": "G", "說明": "每當你將蔬菜轉換成食物時，你可以立即執行一次「烤麵包」行動。紅蘿蔔蛋糕師傅可以隨時將1份蔬菜轉換成2份食物。", "圖片": "images/Go6.jpg", crop_top: 344, crop_bottom: 345, crop_left: 349, crop_right: 337 }
];

const cardsFilePath = path.join(__dirname, 'cards.json');
const cardsData = JSON.parse(fs.readFileSync(cardsFilePath, 'utf-8'));

// Delete existing cards if present (for idempotency)
const newIds = goCards.map(c => c['卡片ID']);
const filteredCards = cardsData.filter(c => !newIds.includes(c['卡片ID']));

// Add the new cards
const updatedCards = [...filteredCards, ...goCards];

fs.writeFileSync(cardsFilePath, JSON.stringify(updatedCards, null, 2));
console.log(`Successfully imported ${goCards.length} Go cards.`);
