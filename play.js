const RESOURCE_LABELS = {
  wood: '木',
  clay: '磚',
  reed: '蘆',
  stone: '石',
  grain: '麥',
  vegetable: '菜',
  food: '食',
  sheep: '羊',
  boar: '豬',
  cattle: '牛',
};

const RESOURCE_ORDER = ['wood', 'clay', 'reed', 'stone', 'grain', 'vegetable', 'food'];
const ANIMAL_ORDER = ['sheep', 'boar', 'cattle'];
const FARM_COLUMNS = 5;
const FARM_CELL_LEFTS = [3.7, 22.0, 40.3, 58.6, 76.9];
const FARM_CELL_TOPS = [19.7, 44.8, 69.9];
const FARM_CELL_SIZE = 15;
const RESOURCE_ICON_PATHS = {
  wood: 'images/online-table/wood.png',
  clay: 'images/online-table/clay.png',
  reed: 'images/online-table/reed.png',
  stone: 'images/online-table/stone.png',
  grain: 'images/online-table/grain.png',
  vegetable: 'images/online-table/vegetable.png',
  food: 'images/online-table/food.png',
  sheep: 'images/online-table/sheep.png',
  boar: 'images/online-table/boar.png',
  cattle: 'images/online-table/cattle.png',
};
const ROOM_IMAGE_PATHS = {
  wood: 'images/online-table/woodenhouse.png',
  clay: 'images/online-table/clayhouse.png',
  stone: 'images/online-table/stonehouse.png',
};
const FIELD_IMAGE_PATH = 'images/online-table/field.png';
const MAJOR_BOARD_IMAGE_PATH = 'images/online-table/Mboard.png';
const MAJOR_CARD_SLOTS = [
  { left: 2.2, top: 4.5 },
  { left: 21.8, top: 4.5 },
  { left: 41.4, top: 4.5 },
  { left: 61.0, top: 4.5 },
  { left: 80.6, top: 4.5 },
  { left: 2.2, top: 53.4 },
  { left: 21.8, top: 53.4 },
  { left: 41.4, top: 53.4 },
  { left: 61.0, top: 53.4 },
  { left: 80.6, top: 53.4 },
];
const MAJOR_IMPROVEMENTS = [
  { id: 'M01', name: '火爐', type: 'major', deck: '主要發展卡', image: 'images/online-table/M01.png' },
  { id: 'M02', name: '火爐', type: 'major', deck: '主要發展卡', image: 'images/online-table/M02.png' },
  { id: 'M03', name: '壁爐', type: 'major', deck: '主要發展卡', image: 'images/online-table/M03.png' },
  { id: 'M04', name: '壁爐', type: 'major', deck: '主要發展卡', image: 'images/online-table/M04.png' },
  { id: 'M05', name: '水井', type: 'major', deck: '主要發展卡', image: 'images/online-table/M05.png' },
  { id: 'M06', name: '磚造烤爐', type: 'major', deck: '主要發展卡', image: 'images/online-table/M06.png' },
  { id: 'M07', name: '石造烤爐', type: 'major', deck: '主要發展卡', image: 'images/online-table/M07.png' },
  { id: 'M08', name: '木工坊', type: 'major', deck: '主要發展卡', image: 'images/online-table/M08.png' },
  { id: 'M09', name: '陶藝工坊', type: 'major', deck: '主要發展卡', image: 'images/online-table/M09.png' },
  { id: 'M10', name: '蘆葦工坊', type: 'major', deck: '主要發展卡', image: 'images/online-table/M10.png' },
].map((card, index) => ({
  ...card,
  instanceId: `major-${card.id}`,
  slot: MAJOR_CARD_SLOTS[index],
}));
const MAJOR_IMPROVEMENT_COSTS = {
  M01: { clay: 2 },
  M02: { clay: 3 },
  M03: { clay: 4 },
  M04: { clay: 5 },
  M05: { wood: 1, stone: 3 },
  M06: { clay: 3, stone: 1 },
  M07: { clay: 1, stone: 3 },
  M08: { wood: 2, stone: 2 },
  M09: { clay: 2, stone: 2 },
  M10: { reed: 2, stone: 2 },
};

function farmCellPositionStyle(index) {
  const row = Math.floor(index / FARM_COLUMNS);
  const col = index % FARM_COLUMNS;
  return `--farm-cell-left:${FARM_CELL_LEFTS[col]}%;--farm-cell-top:${FARM_CELL_TOPS[row]}%;--farm-cell-size:${FARM_CELL_SIZE}%;`;
}
const ROOM_COSTS = {
  wood: { wood: 5, reed: 2 },
  clay: { clay: 5, reed: 2 },
  stone: { stone: 5, reed: 2 },
};
const RENOVATION_NEXT = { wood: 'clay', clay: 'stone' };
const STABLE_COST = { wood: 2 };
const SINGLE_PASTURE_COST = { wood: 4 };
const SINGLE_PASTURE_FENCES = 4;
const FENCE_SIDES = ['top', 'right', 'bottom', 'left'];
const FENCE_OPPOSITE = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' };
const FENCE_DELTAS = {
  top: -FARM_COLUMNS,
  right: 1,
  bottom: FARM_COLUMNS,
  left: -1,
};
const RESOURCE_SHORT_LABELS = {
  wood: '木',
  clay: '磚',
  reed: '葦',
  stone: '石',
  grain: '麥',
  vegetable: '菜',
  food: '食物',
  sheep: '羊',
  boar: '豬',
  cattle: '牛',
};
const HARVEST_ROUNDS = [4, 7, 9, 11, 13, 14];
const PHASE_LABELS = {
  ROUND_START: '回合開始',
  REPLENISH_PHASE: '準備階段',
  WORK_PHASE_START: '工作階段開始',
  WORK_PHASE: '工作階段',
  WORK_PHASE_END: '工作階段結束',
  RETURN_HOME: '返家階段',
  HARVEST_START: '收成開始',
  HARVEST_FIELD: '收割階段',
  HARVEST_FEED: '餵養階段',
  HARVEST_BREED: '繁殖階段',
  HARVEST_END: '收成結束',
  ROUND_END: '回合結束',
  GAME_END: '遊戲結束',
};

const COLOR_LABELS = {
  red: '紅色',
  green: '綠色',
  blue: '藍色',
  purple: '紫色',
};

const COLOR_CLASS = {
  red: 'color-red',
  green: 'color-green',
  blue: 'color-blue',
  purple: 'color-purple',
};

const initialPlayers = [
  { id: 'red', name: 'Lu', color: 'red' },
  { id: 'green', name: 'Han', color: 'green' },
  { id: 'blue', name: '玩家三', color: 'blue' },
  { id: 'purple', name: '玩家四', color: 'purple' },
];

const actionBoardPanels = [
  { id: 'left', title: '基礎行動板', columns: 3, rows: 6 },
  { id: 'middle', title: '回合行動板 A', columns: 3, rows: 6 },
  { id: 'right', title: '回合行動板 B', columns: 4, rows: 2 },
];

const actionSpaceDefs = [
  { id: 'wood_2_left', name: '2 根木頭', boardText: '每回合 +2 木頭', kind: '累積格', accumulate: { wood: 2 }, board: { panel: 'left', col: 1, row: 1, rowSpan: 2 } },
  { id: 'clay_2_left', name: '2 塊磚頭', boardText: '每回合 +2 磚頭', kind: '累積格', accumulate: { clay: 2 }, board: { panel: 'left', col: 2, row: 1, rowSpan: 2 } },
  { id: 'build_rooms_stables', name: '擴建房舍', shortName: '擴建房舍', boardText: '建造房間 / 馬廄', kind: '建設', farmAction: 'build', board: { panel: 'left', col: 3, row: 1 } },

  { id: 'wood_1_left', name: '1 根木頭', boardText: '每回合 +1 木頭', kind: '累積格', accumulate: { wood: 1 }, board: { panel: 'left', col: 1, row: 3, rowSpan: 2 } },
  { id: 'resource_market', name: '拿 1 組蘆葦、1 顆石頭與 1 份食物', shortName: '蘆葦、石頭、食物', boardText: '置入個人供應區', kind: '立即格', gain: { reed: 1, stone: 1, food: 1 }, board: { panel: 'left', col: 2, row: 3, rowSpan: 2 } },
  { id: 'starting_player', name: '起始玩家', shortName: '起始玩家', boardText: '打 1 張次要發展卡', kind: '起始玩家 + 次要發展卡', cardAction: 'minor', board: { panel: 'left', col: 3, row: 2 } },

  { id: 'traveling_players', name: '賣藝', boardText: '1 食物', kind: '累積格', accumulate: { food: 1 }, board: { panel: 'left', col: 1, row: 5, rowSpan: 2 } },
  { id: 'occupation_1', name: '打 1 張職業卡', shortName: '打 1 張職業', boardText: '付出食物後打出職業', kind: '出牌', cardAction: 'occupation', board: { panel: 'left', col: 2, row: 5, rowSpan: 2 } },
  { id: 'grain_seeds', name: '拿 1 份麥子', shortName: '拿 1 份麥子', boardText: '置入個人供應區', kind: '立即格', gain: { grain: 1 }, board: { panel: 'left', col: 3, row: 3 } },

  { id: 'plow_1_field_left', name: '犁 1 塊農田', shortName: '犁田', boardText: '新增 1 塊農田', kind: '農場操作', farmAction: 'field', board: { panel: 'left', col: 3, row: 4 } },
  { id: 'occupation_2', name: '打 1 張職業卡', shortName: '打 1 張職業', boardText: '第一張免費；之後付食物', kind: '出牌', cardAction: 'occupation', board: { panel: 'left', col: 3, row: 5 } },
  { id: 'day_laborer', name: '臨時工', shortName: '臨時工', boardText: '獲得 2 份食物', kind: '立即格', gain: { food: 2 }, board: { panel: 'left', col: 3, row: 6 } },

  { id: 'major_minor_improvement', name: '打 1 張主要或次要發展卡', shortName: '主要或次要發展', boardText: '第一季', kind: '出牌', cardAction: 'minor', enabledRound: 1, board: { panel: 'middle', col: 1, row: 1, rowSpan: 2 } },
  { id: 'build_fences', name: '建造柵欄', shortName: '柵欄', boardText: '每根柵欄支付 1 根木頭', kind: '建設', farmAction: 'pasture', enabledRound: 2, board: { panel: 'middle', col: 2, row: 1, rowSpan: 2 } },
  { id: 'stone_1_middle', name: '1 顆石頭', boardText: '每回合 +1 石頭', kind: '累積格', accumulate: { stone: 1 }, enabledRound: 5, board: { panel: 'middle', col: 3, row: 1, rowSpan: 2 } },

  { id: 'wood_3_middle', name: '3 根木頭', boardText: '每回合 +3 木頭', kind: '累積格', accumulate: { wood: 3 }, board: { panel: 'middle', col: 1, row: 3 } },
  { id: 'sow_bake', name: '播種 / 烤麵包', shortName: '播種 / 烤麵包', boardText: '和 / 或', kind: '農場操作', farmAction: 'sow', enabledRound: 3, board: { panel: 'middle', col: 2, row: 3, rowSpan: 2 } },
  { id: 'family_growth_minor', name: '增加家庭成員', shortName: '增加家庭成員', boardText: '1 張次要發展卡', kind: '家庭成員 + 次要發展卡', enabledRound: 6, board: { panel: 'middle', col: 3, row: 3, rowSpan: 2 } },

  { id: 'clay_1_middle', name: '1 塊磚頭', boardText: '每回合 +1 磚頭', kind: '累積格', accumulate: { clay: 1 }, board: { panel: 'middle', col: 1, row: 4 } },
  { id: 'sheep_1', name: '1 隻羊', boardText: '每回合 +1 羊', kind: '累積格', accumulate: { sheep: 1 }, enabledRound: 4, board: { panel: 'middle', col: 2, row: 5, rowSpan: 2 } },
  { id: 'renovation_major_minor', name: '翻修房舍', shortName: '翻修房舍', boardText: '1 張主要或次要發展卡', kind: '翻修 + 發展卡', farmAction: 'renovate', enabledRound: 7, board: { panel: 'middle', col: 3, row: 5, rowSpan: 2 } },

  { id: 'reed_1_middle', name: '1 組蘆葦', boardText: '每回合 +1 蘆葦', kind: '累積格', accumulate: { reed: 1 }, board: { panel: 'middle', col: 1, row: 5 } },
  { id: 'fishing', name: '釣魚', boardText: '1 份食物', kind: '累積格', accumulate: { food: 1 }, board: { panel: 'middle', col: 1, row: 6 } },

  { id: 'vegetable_1', name: '拿 1 份蔬菜', shortName: '拿 1 份蔬菜', boardText: '置入個人供應區', kind: '立即格', gain: { vegetable: 1 }, enabledRound: 8, board: { panel: 'right', col: 1, row: 1 } },
  { id: 'stone_1_right', name: '1 顆石頭', boardText: '每回合 +1 石頭', kind: '累積格', accumulate: { stone: 1 }, enabledRound: 10, board: { panel: 'right', col: 2, row: 1 } },
  { id: 'family_growth_without_room', name: '增加家庭成員', shortName: '增加家庭成員', boardText: '即使無空房也可以生人', kind: '家庭成員', enabledRound: 12, board: { panel: 'right', col: 3, row: 1 } },
  { id: 'renovation_fences', name: '翻修房舍', shortName: '翻修房舍', boardText: '建造柵欄', kind: '翻修 + 建造柵欄', farmAction: 'renovate', enabledRound: 14, board: { panel: 'right', col: 4, row: 1 } },

  { id: 'boar_1', name: '1 隻野豬', boardText: '每回合 +1 野豬', kind: '累積格', accumulate: { boar: 1 }, enabledRound: 9, board: { panel: 'right', col: 1, row: 2 } },
  { id: 'cattle_1', name: '1 頭牛', boardText: '每回合 +1 牛', kind: '累積格', accumulate: { cattle: 1 }, enabledRound: 11, board: { panel: 'right', col: 2, row: 2 } },
  { id: 'plow_sow', name: '犁 1 塊農田', shortName: '犁田 / 播種', boardText: '和 / 或播種', kind: '農場操作', farmAction: 'field', enabledRound: 13, board: { panel: 'right', col: 3, row: 2 } },
];

const sampleHand = [
  { id: 'A119', name: '柴火收集者', type: 'occupation', text: '示範卡：發動時可手動獲得食物或木頭。' },
  { id: 'C039', name: '船屋', type: 'minor', text: '示範卡：打出後放到已出牌區。' },
  { id: 'B084', name: '特色食品', type: 'minor', text: '示範卡：可用手動發動面板記錄效果。' },
  { id: 'C127', name: '侍童', type: 'occupation', text: '示範卡：第一版不自動判斷複雜條件。' },
  { id: 'E140', name: '車夫', type: 'occupation', text: '示範卡：卡牌流程先做管理與 log。' },
];
const IMPORTED_HAND_OCCUPATIONS = 7;
const IMPORTED_HAND_MINORS = 7;
const DRAFT_STAGE_LABELS = {
  occupation: '職業輪抽',
  minor: '次要發展卡輪抽',
};
const DRAFT_PASS_LABELS = {
  occupation: '職業卡順時鐘傳',
  minor: '次要發展卡逆時鐘傳',
};
const DRAFT_PASS_DIRECTION = {
  occupation: 1,
  minor: -1,
};
const DRAFT_SEAT_POSITIONS = ['bottom', 'right', 'top', 'left'];
const NOTES_STORAGE_KEY = 'agricola-player-notes-v1';
const UNDO_LIMIT = 25;
const undoStack = [];

const state = {
  round: 1,
  phaseId: 'ROUND_START',
  started: false,
  currentPlayerIndex: 0,
  viewedFarmPlayerId: initialPlayers[0].id,
  seatRandomized: false,
  playerOrder: initialPlayers.map((player) => player.id),
  startPlayerId: initialPlayers[0].id,
  nextStartPlayerId: initialPlayers[0].id,
  selectedActionId: null,
  selectedSowCrop: null,
  selectedBuildChoice: null,
  selectedBuildRooms: 1,
  selectedBuildStables: 0,
  selectedImprovementSource: 'minor',
  pendingFarmAction: null,
  pendingCardAction: null,
  handFilter: 'all',
  cardLibraryLoaded: false,
  spectatorMode: false,
  chatMessages: [],
  notePlayerId: initialPlayers[0].id,
  playerNotes: loadPlayerNotes(),
  majorImprovements: Object.fromEntries(MAJOR_IMPROVEMENTS.map((card) => [card.id, { available: true }])),
  majorBoardExpanded: false,
  draft: {
    active: false,
    stage: 'occupation',
    pickNumber: 1,
    currentPlayerIndex: 0,
    selectedCardId: null,
    packs: { occupation: {}, minor: {} },
  },
  players: Object.fromEntries(
    initialPlayers.map((player) => [
      player.id,
      {
        ...player,
        resources: { wood: 0, clay: 0, reed: 0, stone: 0, grain: 0, vegetable: 0, food: 3 },
        animals: { sheep: 0, boar: 0, cattle: 0 },
        workers: { total: 2, available: 2, newborns: 0 },
        fences: 15,
        stables: 4,
        beggingCards: 0,
        farm: createInitialFarm(player.id),
        hand: sampleHand.map((card, index) => ({ ...card, instanceId: `${player.id}-${card.id}-${index}` })),
        played: [],
      },
    ]),
  ),
  actionSpaces: Object.fromEntries(
    actionSpaceDefs.map((space) => [
      space.id,
      {
        ...space,
        tokens: {},
        occupiedBy: null,
      },
    ]),
  ),
  logs: [],
};

function createInitialFarm() {
  return Array.from({ length: 15 }, (_, index) => {
    if (index === 5 || index === 10) {
      return createFarmCell(index, 'room', 'wood');
    }
    return createFarmCell(index);
  });
}

function createFarmCell(index, terrain = 'empty', roomType = null) {
  return {
    index,
    terrain,
    roomType,
    stable: false,
    animals: {},
    fences: { top: false, right: false, bottom: false, left: false },
    pastureGroup: null,
  };
}

function loadPlayerNotes() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '{}') || {};
  } catch {
    saved = {};
  }
  return Object.fromEntries(initialPlayers.map((player) => [player.id, String(saved[player.id] || '')]));
}

function savePlayerNotes() {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(state.playerNotes));
  } catch {
    addLog('備忘錄儲存失敗：瀏覽器目前無法寫入本機資料。');
  }
}

function cloneGameState() {
  return JSON.parse(JSON.stringify(state));
}

function restoreGameState(snapshot) {
  Object.keys(state).forEach((key) => {
    delete state[key];
  });
  Object.assign(state, JSON.parse(JSON.stringify(snapshot)));
}

function pushUndoState(label) {
  undoStack.push({
    label,
    snapshot: cloneGameState(),
  });
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function undoLastAction() {
  if (state.spectatorMode) {
    rejectSpectatorAction('返回一步');
    return;
  }
  const previous = undoStack.pop();
  if (!previous) {
    addLog('沒有可以返回的步驟。');
    return;
  }
  closeActionModal();
  closeCardInfo();
  closeHand();
  restoreGameState(previous.snapshot);
  addLog(`返回一步：${previous.label}`);
  render();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function urlSegment(value) {
  return encodeURIComponent(String(value ?? ''));
}

function cleanCardId(value) {
  return String(value ?? '').replaceAll('*', '').trim();
}

function cardImagePath(deck, cardId) {
  const cleanId = cleanCardId(cardId);
  if (!deck || !cleanId) return '';
  return `images/cards/${urlSegment(deck)}/${urlSegment(cleanId)}.webp`;
}

function normalizeImportedCard(rawCard) {
  const id = cleanCardId(rawCard['卡片ID']);
  const deck = String(rawCard['牌組'] || '').trim();
  const type = rawCard.card_type === 'occupation' ? 'occupation' : 'minor';
  return {
    id,
    deck,
    name: rawCard['牌名'] || id,
    type,
    requirement: rawCard['先決條件'] || '',
    cost: rawCard['費用'] || '',
    points: rawCard['勝利點數'] || '',
    bonus: rawCard['紅利分數'] || '',
    text: rawCard['說明'] || '',
    image: cardImagePath(deck, id),
  };
}

function importedCardSortValue(card) {
  return `${card.deck.padStart(4, '0')}-${card.id.padStart(8, '0')}-${card.name}`;
}

function dealImportedCards(cards) {
  const occupations = cards
    .filter((card) => card.type === 'occupation')
    .sort((a, b) => importedCardSortValue(a).localeCompare(importedCardSortValue(b), 'zh-Hant'));
  const minors = cards
    .filter((card) => card.type === 'minor')
    .sort((a, b) => importedCardSortValue(a).localeCompare(importedCardSortValue(b), 'zh-Hant'));
  const neededOcc = IMPORTED_HAND_OCCUPATIONS * state.playerOrder.length;
  const neededMinor = IMPORTED_HAND_MINORS * state.playerOrder.length;
  if (occupations.length < neededOcc || minors.length < neededMinor) return false;

  const draftPacks = { occupation: {}, minor: {} };
  state.playerOrder.forEach((playerId, playerIndex) => {
    const player = state.players[playerId];
    const occStart = playerIndex * IMPORTED_HAND_OCCUPATIONS;
    const minorStart = playerIndex * IMPORTED_HAND_MINORS;
    draftPacks.occupation[playerId] = occupations
      .slice(occStart, occStart + IMPORTED_HAND_OCCUPATIONS)
      .map((card, index) => ({ ...card, instanceId: `${player.id}-draft-occ-${card.id}-${index}` }));
    draftPacks.minor[playerId] = minors
      .slice(minorStart, minorStart + IMPORTED_HAND_MINORS)
      .map((card, index) => ({ ...card, instanceId: `${player.id}-draft-minor-${card.id}-${index}` }));
    player.hand = [];
  });
  state.draft = {
    active: true,
    stage: 'occupation',
    pickNumber: 1,
    currentPlayerIndex: 0,
    selectedCardId: null,
    packs: draftPacks,
  };
  state.currentPlayerIndex = 0;
  state.cardLibraryLoaded = true;
  addLog(`已匯入 ${cards.length} 張卡牌，開啟輪抽：每位玩家 ${IMPORTED_HAND_OCCUPATIONS} 張職業與 ${IMPORTED_HAND_MINORS} 張次要發展卡。`);
  render();
  return true;
}

async function loadImportedCards() {
  try {
    const response = await fetch('cards.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rawCards = await response.json();
    const cards = rawCards
      .map(normalizeImportedCard)
      .filter((card) => card.id && card.deck && (card.type === 'occupation' || card.type === 'minor'));
    if (!dealImportedCards(cards)) {
      addLog('卡牌匯入失敗：職業或次要發展卡數量不足，已保留示範手牌。');
    }
  } catch (error) {
    addLog(`卡牌匯入失敗：${error.message}。已保留示範手牌。`);
  }
}

const els = {
  turnBanner: document.getElementById('turnBanner'),
  roundValue: document.getElementById('roundValue'),
  phaseValue: document.getElementById('phaseValue'),
  currentPlayerValue: document.getElementById('currentPlayerValue'),
  workersValue: document.getElementById('workersValue'),
  actionBoard: document.getElementById('actionBoard'),
  majorBoardPanel: document.querySelector('.major-board-panel'),
  majorBoard: document.getElementById('majorBoard'),
  majorBoardToggleBtn: document.getElementById('majorBoardToggleBtn'),
  majorModal: document.getElementById('majorModal'),
  majorModalBoard: document.getElementById('majorModalBoard'),
  majorModalSummary: document.getElementById('majorModalSummary'),
  majorList: document.getElementById('majorList'),
  farmTitle: document.getElementById('farmTitle'),
  farmViewerTabs: document.getElementById('farmViewerTabs'),
  farmGrid: document.getElementById('farmGrid'),
  farmSelectionBar: document.getElementById('farmSelectionBar'),
  activeResourceStrip: document.getElementById('activeResourceStrip'),
  playedOcc: document.getElementById('playedOcc'),
  playedMinor: document.getElementById('playedMinor'),
  playerList: document.getElementById('playerList'),
  seatOrderLabel: document.getElementById('seatOrderLabel'),
  logList: document.getElementById('logList'),
  spectatorToggleBtn: document.getElementById('spectatorToggleBtn'),
  chatModeLabel: document.getElementById('chatModeLabel'),
  chatList: document.getElementById('chatList'),
  chatInput: document.getElementById('chatInput'),
  chatForm: document.getElementById('chatForm'),
  handOwnerLabel: document.getElementById('handOwnerLabel'),
  handRow: document.getElementById('handRow'),
  handModal: document.getElementById('handModal'),
  draftOverlay: document.getElementById('draftOverlay'),
  draftTable: document.getElementById('draftTable'),
  notesModal: document.getElementById('notesModal'),
  notesTabs: document.getElementById('notesTabs'),
  notesModalTitle: document.getElementById('notesModalTitle'),
  notesOwnerLabel: document.getElementById('notesOwnerLabel'),
  notesTextarea: document.getElementById('notesTextarea'),
  notesSaveState: document.getElementById('notesSaveState'),
  actionModal: document.getElementById('actionModal'),
  actionModalTitle: document.getElementById('actionModalTitle'),
  actionModalBody: document.getElementById('actionModalBody'),
  confirmActionBtn: document.getElementById('confirmActionBtn'),
  harvestModal: document.getElementById('harvestModal'),
  harvestBody: document.getElementById('harvestBody'),
};

function currentPlayer() {
  const playerIndex = state.draft.active ? state.draft.currentPlayerIndex : state.currentPlayerIndex;
  return state.players[state.playerOrder[playerIndex]];
}

function viewedFarmPlayer() {
  const player = currentPlayer();
  if (state.pendingFarmAction) return player;
  return state.players[state.viewedFarmPlayerId] || player;
}

function formatPlayer(player) {
  return `<span class="color-dot ${COLOR_CLASS[player.color]}"></span><span>${COLOR_LABELS[player.color]} ${player.name}</span>`;
}

function resourceIconHtml(type, className = 'resource-icon') {
  const iconPath = RESOURCE_ICON_PATHS[type];
  if (!iconPath) return '';
  return `<img class="${className}" src="${escapeHtml(iconPath)}" alt="${escapeHtml(RESOURCE_LABELS[type] || type)}" loading="lazy" />`;
}

function resourcePill(type, value) {
  return `<span class="resource-pill res-${type}" aria-label="${escapeHtml(RESOURCE_LABELS[type] || type)} ${value}"><span>${value}</span>${resourceIconHtml(type)}</span>`;
}

function compactResourcePill(type, value) {
  return `<span class="action-resource-chip res-${type}" aria-label="${escapeHtml(RESOURCE_LABELS[type] || type)} ${value}"><span>${value}</span>${resourceIconHtml(type, 'resource-icon action-resource-icon')}</span>`;
}

function actionResourceHtml(space) {
  const resourceSource = space.accumulate
    ? Object.fromEntries(Object.keys(space.accumulate).map((type) => [type, space.tokens[type] || 0]))
    : space.tokens;
  const entries = Object.entries(resourceSource || {}).filter(([type, value]) => space.accumulate ? type in space.accumulate : value > 0);
  if (!entries.length) return '';
  return `<div class="action-resource-stack">${entries.map(([type, value]) => compactResourcePill(type, value)).join('')}</div>`;
}

function actionSeasonLabel(enabledRound) {
  if (!enabledRound) return '';
  if (enabledRound <= 4) return '第一季';
  if (enabledRound <= 7) return '第二季';
  if (enabledRound <= 9) return '第三季';
  if (enabledRound <= 11) return '第四季';
  if (enabledRound <= 13) return '第五季';
  return '第六季';
}

function formatResources(resources, animals = {}) {
  return [
    ...RESOURCE_ORDER.map((type) => resourcePill(type, resources[type] || 0)),
    ...ANIMAL_ORDER.map((type) => resourcePill(type, animals[type] || 0)),
  ].join('');
}

function addLog(message) {
  state.logs.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    round: state.round,
    message,
  });
  renderLogs();
}

function canControlGame() {
  return !state.spectatorMode;
}

function rejectSpectatorAction(actionName = '操作') {
  if (canControlGame()) return false;
  addLog(`旁觀者模式不能${actionName}。`);
  return true;
}

function render() {
  if (state.draft.active) state.currentPlayerIndex = state.draft.currentPlayerIndex;
  const player = currentPlayer();
  const farmPlayer = viewedFarmPlayer();
  els.roundValue.textContent = state.round;
  els.phaseValue.textContent = PHASE_LABELS[state.phaseId] || state.phaseId;
  els.currentPlayerValue.innerHTML = formatPlayer(player);
  els.workersValue.textContent = `${player.workers.available} / ${player.workers.total}`;
  els.turnBanner.innerHTML = turnBannerHtml(player);
  els.farmTitle.textContent = `${COLOR_LABELS[farmPlayer.color]}玩家農場`;
  els.handOwnerLabel.textContent = `${COLOR_LABELS[player.color]} ${player.name}`;
  els.activeResourceStrip.innerHTML = formatResources(farmPlayer.resources, farmPlayer.animals);
  els.seatOrderLabel.textContent = state.seatRandomized
    ? `座位：${state.playerOrder.map((id) => COLOR_LABELS[state.players[id].color]).join(' → ')}`
    : '座位未隨機';

  renderActionBoard();
  renderFarmTabs(farmPlayer);
  renderFarm(farmPlayer);
  renderFarmSelectionBar();
  renderPlayers();
  renderHand(player);
  renderPlayedCards(farmPlayer);
  renderLogs();
  renderControlState();
  renderChat();
  renderDraft();
  if (!els.notesModal.hidden) renderNotesModal();
  if (!els.majorModal.hidden) renderMajorModal();
}

function turnBannerHtml(player) {
  if (state.pendingCardAction) {
    return `${formatPlayer(player)} 請選擇要打出的${state.pendingCardAction.type === 'major' ? '主要發展卡' : '次要發展卡'}`;
  }
  if (state.pendingFarmAction) {
    const space = state.actionSpaces[state.pendingFarmAction.actionId];
    return `${formatPlayer(player)} 請在農場選擇「${space.name}」的位置`;
  }
  if (state.phaseId === 'ROUND_START') return `第 ${state.round} 回合開始。請按「補料」翻開回合卡並補貨。`;
  if (state.phaseId === 'WORK_PHASE') return `${formatPlayer(player)} 必須選擇 1 項行動`;
  if (state.phaseId === 'WORK_PHASE_END') return '工作階段結束。工作階段結束收益會早於收成，可用於本次收成。';
  if (state.phaseId === 'RETURN_HOME') return '請按「返家」收回家庭成員，收成回合會在返家後結算。';
  if (state.phaseId === 'GAME_END') return '第 14 回合收成已結束，遊戲結束。';
  return PHASE_LABELS[state.phaseId] || state.phaseId;
}

function renderActionBoard() {
  const player = currentPlayer();
  els.actionBoard.innerHTML = actionBoardPanels.map((panel) => {
    const spaces = actionSpaceDefs
      .filter((spaceDef) => spaceDef.board.panel === panel.id)
      .map((spaceDef) => {
        const space = state.actionSpaces[spaceDef.id];
        const enabled = !space.enabledRound || state.round >= space.enabledRound;
        const available = canControlGame() && !state.pendingFarmAction && state.phaseId === 'WORK_PHASE' && enabled && !space.occupiedBy && player.workers.available > 0;
        const resourceHtml = enabled ? actionResourceHtml(space) : '';
        const occupiedPlayer = space.occupiedBy ? state.players[space.occupiedBy] : null;
        const classes = ['action-space'];
        if (available) classes.push('available');
        if (space.occupiedBy) classes.push('occupied');
        if (!enabled) classes.push('locked');
        if (space.accumulate) classes.push('accumulate-space');
        if (space.enabledRound) classes.push('round-action-space');
        const seasonLabel = actionSeasonLabel(space.enabledRound);

        return `
          <button class="${classes.join(' ')}" type="button" data-action-id="${space.id}" style="grid-column:${space.board.col};grid-row:${space.board.row} / span ${space.board.rowSpan || 1};" ${available ? '' : 'disabled'}>
            ${seasonLabel ? `<span class="action-season-badge">${seasonLabel}</span>` : ''}
            <span class="action-name">${enabled ? (space.shortName || space.name) : `第 ${space.enabledRound} 回合`}</span>
            ${resourceHtml}
            ${occupiedPlayer ? `
              <span class="worker-meeple ${COLOR_CLASS[occupiedPlayer.color]}" aria-label="${COLOR_LABELS[occupiedPlayer.color]}玩家佔據">
                <span class="worker-meeple-label">${COLOR_LABELS[occupiedPlayer.color]}</span>
              </span>
            ` : ''}
          </button>
        `;
      }).join('');

    return `
      <section class="action-panel action-panel-${panel.id}" aria-label="${panel.title}">
        <div class="action-panel-title">${panel.title}</div>
        <div class="action-panel-grid" style="--panel-columns:${panel.columns};--panel-rows:${panel.rows};">
          ${spaces}
        </div>
        ${panel.id === 'right' ? majorActionDockHtml() : ''}
      </section>
    `;
  }).join('');

  els.actionBoard.querySelectorAll('[data-action-id]').forEach((button) => {
    button.addEventListener('click', () => openActionModal(button.dataset.actionId));
  });
  els.actionBoard.querySelectorAll('[data-open-major-inline]').forEach((button) => {
    button.addEventListener('click', openMajorModal);
  });
}

function remainingMajorCards() {
  return MAJOR_IMPROVEMENTS.filter((card) => state.majorImprovements[card.id]?.available !== false);
}

function majorActionDockHtml() {
  const remaining = remainingMajorCards().length;
  return `
    <div class="major-action-dock" aria-label="主要發展卡供應區">
      <div>
        <span class="phase-label">供應區</span>
        <strong>主要發展卡</strong>
        <span>${remaining} / ${MAJOR_IMPROVEMENTS.length}</span>
      </div>
      <button class="ghost-btn" type="button" data-open-major-inline>查看剩餘主發</button>
    </div>
  `;
}

function renderMajorBoardInto(container) {
  if (!container) return;
  container.style.backgroundImage = `url("${MAJOR_BOARD_IMAGE_PATH}")`;
  container.innerHTML = MAJOR_IMPROVEMENTS.map((card) => {
    const available = state.majorImprovements[card.id]?.available !== false;
    const statusLabel = available ? '剩餘' : '已取得';
    return `
      <button class="major-board-card${available ? '' : ' taken'}" type="button" data-major-card-id="${card.id}" style="--major-left:${card.slot.left}%;--major-top:${card.slot.top}%;" aria-label="${escapeHtml(card.name)} ${statusLabel}">
        <img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="lazy" />
        ${available ? '' : '<span class="major-card-taken">已取得</span>'}
      </button>
    `;
  }).join('');

  container.querySelectorAll('[data-major-card-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.pendingCardAction?.type === 'major') {
        playMajorImprovement(button.dataset.majorCardId);
      } else {
        openCardInfo(`major-${button.dataset.majorCardId}`);
      }
    });
  });
}

function openMajorModal() {
  els.majorModal.hidden = false;
  renderMajorModal();
}

function closeMajorModal() {
  els.majorModal.hidden = true;
}

function renderMajorModal() {
  const remaining = remainingMajorCards();
  els.majorModalSummary.textContent = `目前剩餘 ${remaining.length} / ${MAJOR_IMPROVEMENTS.length} 張主要發展卡`;
  renderMajorBoardInto(els.majorModalBoard);
  els.majorList.innerHTML = remaining.map((card) => `
    <article class="major-list-card">
      <button class="major-list-thumb" type="button" data-major-info-id="${card.id}" aria-label="查看 ${escapeHtml(card.name)}">
        <img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="lazy" />
      </button>
      <div>
        <strong>${escapeHtml(card.name)}</strong>
        <span>${escapeHtml(card.id)} ・ 主要發展卡</span>
      </div>
    </article>
  `).join('') || '<div class="modal-summary">主要發展卡已全部被取得。</div>';

  els.majorList.querySelectorAll('[data-major-info-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.pendingCardAction?.type === 'major') {
        playMajorImprovement(button.dataset.majorInfoId);
      } else {
        openCardInfo(`major-${button.dataset.majorInfoId}`);
      }
    });
  });
}

function renderFarmSelectionBar() {
  const pending = state.pendingFarmAction;
  if (!pending || !els.farmSelectionBar) {
    if (els.farmSelectionBar) els.farmSelectionBar.hidden = true;
    return;
  }
  els.farmSelectionBar.hidden = false;
  if (pending.mode === 'build') {
    const roomCount = pending.selectedRooms?.length || 0;
    const stableCount = pending.selectedStables?.length || 0;
    els.farmSelectionBar.innerHTML = `
      <div class="selection-summary">
        <strong>選擇建造位置</strong>
        <span>房間 ${roomCount}/${pending.buildRooms} ・ 馬廄 ${stableCount}/${pending.buildStables}</span>
      </div>
      <div class="selection-actions">
        <button class="ghost-btn ${pending.placementKind === 'room' ? 'active' : ''}" type="button" data-build-placement="room" ${pending.buildRooms <= 0 ? 'disabled' : ''}>放房間</button>
        <button class="ghost-btn ${pending.placementKind === 'stable' ? 'active' : ''}" type="button" data-build-placement="stable" ${pending.buildStables <= 0 ? 'disabled' : ''}>放馬廄</button>
        <button class="primary-btn" type="button" data-farm-selection-confirm>確認建造</button>
        <button class="ghost-btn" type="button" data-farm-selection-cancel>取消</button>
      </div>
    `;
  } else if (pending.mode === 'pasture') {
    const selectedCount = Object.keys(pending.pastureGroups || {}).length;
    const fenceCount = pastureFenceSegments(pending.pastureGroups || {}).length;
    const groupIds = [...new Set(Object.values(pending.pastureGroups || {}))].sort((a, b) => a - b);
    const visibleGroupIds = [...new Set([1, 2, 3, 4, pending.currentPastureGroup || 1, ...groupIds])].sort((a, b) => a - b);
    const nextGroup = Math.max(1, ...groupIds, pending.currentPastureGroup || 1) + 1;
    els.farmSelectionBar.innerHTML = `
      <div class="selection-summary">
        <strong>選擇圈地範圍</strong>
        <span>${selectedCount} 格 ・ ${groupIds.length || 1} 個圈地 ・ 需要 ${fenceCount} 根柵欄/木頭</span>
      </div>
      <div class="selection-actions">
        ${visibleGroupIds.map((groupId) => `<button class="ghost-btn ${pending.currentPastureGroup === groupId ? 'active' : ''}" type="button" data-pasture-group="${groupId}">第 ${groupId} 圈地</button>`).join('')}
        <button class="ghost-btn" type="button" data-pasture-group="${nextGroup}">新增圈地</button>
        <button class="primary-btn" type="button" data-farm-selection-confirm>確認圈地</button>
        <button class="ghost-btn" type="button" data-farm-selection-cancel>取消</button>
      </div>
    `;
  } else {
    els.farmSelectionBar.hidden = true;
    return;
  }

  els.farmSelectionBar.querySelectorAll('[data-build-placement]').forEach((button) => {
    button.addEventListener('click', () => {
      state.pendingFarmAction.placementKind = button.dataset.buildPlacement;
      render();
    });
  });
  els.farmSelectionBar.querySelectorAll('[data-pasture-group]').forEach((button) => {
    button.addEventListener('click', () => {
      state.pendingFarmAction.currentPastureGroup = Number(button.dataset.pastureGroup);
      render();
    });
  });
  els.farmSelectionBar.querySelector('[data-farm-selection-confirm]')?.addEventListener('click', confirmPendingFarmSelection);
  els.farmSelectionBar.querySelector('[data-farm-selection-cancel]')?.addEventListener('click', cancelPendingFarmSelection);
}

function cancelPendingFarmSelection() {
  state.pendingFarmAction = null;
  render();
}

function confirmPendingFarmSelection() {
  const pending = state.pendingFarmAction;
  if (!pending) return;
  if (pending.mode === 'build') {
    const rooms = pending.selectedRooms || [];
    const stables = pending.selectedStables || [];
    if (rooms.length !== pending.buildRooms || stables.length !== pending.buildStables) {
      addLog('建造位置還沒選完。');
      render();
      return;
    }
    state.pendingFarmAction = null;
    state.viewedFarmPlayerId = pending.playerId;
    finalizeAction(pending.actionId, { buildPlacements: { rooms, stables } });
    return;
  }
  if (pending.mode === 'pasture') {
    if (!Object.keys(pending.pastureGroups || {}).length) {
      addLog('請至少選擇 1 格圈地。');
      render();
      return;
    }
    state.pendingFarmAction = null;
    state.viewedFarmPlayerId = pending.playerId;
    finalizeAction(pending.actionId, { pastureGroups: pending.pastureGroups });
  }
}

function renderFarmTabs(farmPlayer) {
  els.farmViewerTabs.innerHTML = state.playerOrder.map((id) => {
    const player = state.players[id];
    const active = player.id === farmPlayer.id ? ' active' : '';
    const current = player.id === currentPlayer().id ? ' current' : '';
    return `
      <button class="farm-view-btn${active}${current}" type="button" data-farm-player-id="${player.id}" ${state.pendingFarmAction ? 'disabled' : ''}>
        ${COLOR_LABELS[player.color]}
      </button>
    `;
  }).join('');

  els.farmViewerTabs.querySelectorAll('[data-farm-player-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.viewedFarmPlayerId = button.dataset.farmPlayerId;
      render();
    });
  });
}

function renderFarm(player) {
  els.farmGrid.innerHTML = player.farm.map((cell) => {
    const selectable = canSelectFarmCell(player, cell);
    const selectionClass = farmSelectionClass(cell);
    const label = cell.terrain === 'room' ? '房'
      : cell.terrain === 'field' ? '田'
        : cell.terrain === 'pasture' ? '圈'
          : '';
    const terrainImage = cell.terrain === 'room'
      ? ROOM_IMAGE_PATHS[cell.roomType || 'wood']
      : cell.terrain === 'field'
        ? FIELD_IMAGE_PATH
        : '';
    const coverHtml = terrainImage
      ? `<img class="farm-cell-cover" src="${escapeHtml(terrainImage)}" alt="${escapeHtml(label)}" loading="lazy" />`
      : '';
    const cropHtml = cell.crop
      ? `<span class="crop-badge res-${cell.crop.type}"><span>${cell.crop.count}</span>${resourceIconHtml(cell.crop.type, 'resource-icon farm-token-icon')}</span>`
      : '';
    const stableHtml = cell.stable
      ? `<span class="stable-badge stable-${player.color}" title="${escapeHtml(COLOR_LABELS[player.color])}馬廄" aria-label="${escapeHtml(COLOR_LABELS[player.color])}馬廄"></span>`
      : '';
    const animalHtml = cellAnimalEntries(cell).length
      ? `<span class="animal-badge">${cellAnimalEntries(cell).map(([type, value]) => `<span>${value}</span>${resourceIconHtml(type, 'resource-icon farm-token-icon')}`).join('')}</span>`
      : '';
    return `
      <button class="farm-cell ${cell.terrain}${selectable ? ' selectable' : ''}${selectionClass}" type="button" data-farm-index="${cell.index}" style="${farmCellPositionStyle(cell.index)}">
        ${coverHtml}
        ${farmFenceHtml(cell)}
        <span class="cell-label">${label}</span>
        ${stableHtml}
        ${cropHtml}
        ${animalHtml}
      </button>
    `;
  }).join('');

  els.farmGrid.querySelectorAll('[data-farm-index]').forEach((button) => {
    button.addEventListener('click', () => chooseFarmCell(Number(button.dataset.farmIndex)));
  });
}

function farmFenceHtml(cell) {
  return FENCE_SIDES
    .filter((side) => cell.fences?.[side])
    .map((side) => `<span class="farm-fence fence-${side}"></span>`)
    .join('');
}

function farmSelectionClass(cell) {
  const pending = state.pendingFarmAction;
  if (!pending || pending.playerId !== viewedFarmPlayer().id) return '';
  if (pending.mode === 'build') {
    if (pending.selectedRooms?.includes(cell.index)) return ' selected-room';
    if (pending.selectedStables?.includes(cell.index)) return ' selected-stable';
  }
  if (pending.mode === 'pasture' && pending.pastureGroups?.[cell.index]) {
    return ` selected-pasture pasture-draft-${pending.pastureGroups[cell.index]}`;
  }
  return '';
}

function renderPlayers() {
  els.playerList.innerHTML = state.playerOrder.map((id) => {
    const player = state.players[id];
    const active = player.id === currentPlayer().id ? ' active' : '';
    return `
      <article class="player-card${active}">
        <div class="player-title">
          <span class="player-name">${formatPlayer(player)}</span>
          <span class="player-meta">${player.workers.available}/${player.workers.total} 人</span>
        </div>
        <div class="resource-strip">${formatResources(player.resources, player.animals)}</div>
        <div class="player-meta">柵欄 ${player.fences}/15 ・ 馬廄 ${player.stables}/4 ・ 乞討 ${player.beggingCards} ・ 已出牌 ${player.played.length}</div>
      </article>
    `;
  }).join('');
}

function renderHand(player) {
  const cards = player.hand.filter((card) => state.handFilter === 'all' || card.type === state.handFilter);
  const sections = state.handFilter === 'all'
    ? [
      ['occupation', '職業手牌', cards.filter((card) => card.type === 'occupation')],
      ['minor', '次要發展卡手牌', cards.filter((card) => card.type === 'minor')],
    ]
    : [[state.handFilter, state.handFilter === 'occupation' ? '職業手牌' : '次要發展卡手牌', cards]];

  els.handRow.innerHTML = sections.map(([type, title, sectionCards]) => `
    <section class="hand-section hand-section-${type}">
      <div class="hand-section-title">${title} <span>${sectionCards.length}</span></div>
      <div class="hand-card-grid">
        ${sectionCards.map((card) => handCardHtml(card)).join('')}
      </div>
    </section>
  `).join('');

  els.handRow.querySelectorAll('[data-card-id]').forEach((target) => {
    target.addEventListener('click', (event) => {
      if (event.target.closest('[data-card-info-id]')) return;
      playCard(target.dataset.cardId);
    });
    target.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      playCard(target.dataset.cardId);
    });
  });
  els.handRow.querySelectorAll('[data-card-info-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openCardInfo(button.dataset.cardInfoId);
    });
  });
}

function renderDraft() {
  if (!state.draft.active) {
    document.body.classList.remove('draft-active');
    els.draftOverlay.hidden = true;
    els.draftTable.innerHTML = '';
    return;
  }

  document.body.classList.add('draft-active');
  els.draftOverlay.hidden = false;

  const draft = state.draft;
  const currentPlayerId = state.playerOrder[draft.currentPlayerIndex];
  const currentPlayerData = state.players[currentPlayerId];
  const currentPack = draft.packs[draft.stage][currentPlayerId] || [];
  const pickedCount = currentPlayerData.hand.filter((card) => card.type === draft.stage).length;
  const selectedCard = currentPack.find((card) => card.instanceId === draft.selectedCardId);
  const totalPicks = draft.stage === 'occupation' ? IMPORTED_HAND_OCCUPATIONS : IMPORTED_HAND_MINORS;

  const playerProgress = state.playerOrder.map((playerId) => {
    const player = state.players[playerId];
    const pack = draft.packs[draft.stage][playerId] || [];
    const active = playerId === currentPlayerId;
    const stagePicked = player.hand.filter((card) => card.type === draft.stage).length;
    return `
      <article class="draft-player-progress${active ? ' active' : ''}">
        <strong>${formatPlayer(player)}</strong>
        <span>已扣 ${stagePicked} 張</span>
        <span>${active ? `正在扣第 ${draft.pickNumber} 包` : `目前牌包 ${pack.length} 張`}</span>
      </article>
    `;
  }).join('');

  els.draftTable.innerHTML = `
    <section class="draft-simulator">
      <header class="draft-center-head">
        <div>
          <div class="phase-label">開局輪抽</div>
          <h2 class="draft-title">${DRAFT_STAGE_LABELS[draft.stage]}</h2>
          <div class="draft-subtitle">${COLOR_LABELS[currentPlayerData.color]} ${escapeHtml(currentPlayerData.name)} 已扣 ${pickedCount} 張牌，正在扣第 ${draft.pickNumber} 包牌</div>
          <div class="draft-meta-row">
            <span class="draft-chip">第 ${draft.pickNumber} / ${totalPicks} 輪</span>
            <span class="draft-chip">${DRAFT_PASS_LABELS[draft.stage]}</span>
            <span class="draft-chip">目前牌包 ${currentPack.length} 張</span>
            <span class="draft-chip">已選 ${pickedCount} 張</span>
          </div>
        </div>
        <div class="draft-controls">
          <button class="ghost-btn" type="button" id="quickDraftBtn">快速輪抽</button>
        </div>
      </header>
      <section class="draft-player-progress-row" aria-label="玩家輪抽進度">
        ${playerProgress}
      </section>
      <div class="draft-picked-slots" aria-label="已選手牌">
        ${draftPickedGroupsHtml(currentPlayerData, draft.stage, totalPicks)}
      </div>
      <p class="draft-help">點選卡片後，再按右下角「確認選擇」。</p>
      <div class="draft-card-grid">
        ${currentPack.length
          ? currentPack.map((card) => draftCardHtml(card)).join('')
          : '<div class="draft-picked-row">這包牌已經選完，等待其他玩家完成這一手。</div>'}
      </div>
      <footer class="draft-confirm-bar">
        <div>
          <span class="phase-label">目前選擇</span>
          <strong>${selectedCard ? escapeHtml(selectedCard.name) : '尚未選擇'}</strong>
        </div>
        <button class="primary-btn" type="button" id="draftConfirmBtn" ${selectedCard && !state.spectatorMode ? '' : 'disabled'}>確認選擇</button>
      </footer>
    </section>
  `;

  els.draftTable.querySelectorAll('[data-draft-card-id]').forEach((target) => {
    if ('disabled' in target) target.disabled = state.spectatorMode;
    target.addEventListener('click', (event) => {
      if (event.target.closest('[data-card-info-id]')) return;
      chooseDraftCard(target.dataset.draftCardId);
    });
    target.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      chooseDraftCard(target.dataset.draftCardId);
    });
  });
  els.draftTable.querySelectorAll('[data-card-info-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openCardInfo(button.dataset.cardInfoId);
    });
  });
  const quickDraftBtn = document.getElementById('quickDraftBtn');
  if (quickDraftBtn) {
    quickDraftBtn.disabled = state.spectatorMode;
    quickDraftBtn.addEventListener('click', quickDraftForTesting);
  }
  const draftConfirmBtn = document.getElementById('draftConfirmBtn');
  if (draftConfirmBtn) {
    draftConfirmBtn.addEventListener('click', confirmDraftSelection);
  }
}

function draftPickedGroupsHtml(player, stage, totalPicks) {
  const occupationPicked = player.hand.filter((card) => card.type === 'occupation');
  const stagePicked = player.hand.filter((card) => card.type === stage);
  const stageTitle = stage === 'occupation' ? '已扣職業卡' : '已扣次要發展卡';
  const previousOccupationHtml = stage === 'minor'
    ? `
      <div class="draft-picked-group">
        <div class="draft-picked-group-title">已扣職業卡</div>
        <div class="draft-picked-slots" aria-label="已扣職業卡">
          ${draftPickedCardsHtml(occupationPicked, IMPORTED_HAND_OCCUPATIONS)}
        </div>
      </div>
    `
    : '';

  return `
    <div class="draft-picked-area">
      ${previousOccupationHtml}
      <div class="draft-picked-group">
        <div class="draft-picked-group-title">${stageTitle}</div>
        <div class="draft-picked-slots" aria-label="${stageTitle}">
          ${draftPickedCardsHtml(stagePicked, totalPicks)}
        </div>
      </div>
    </div>
  `;
}

function draftPickedCardsHtml(pickedCards, totalPicks) {
  return Array.from({ length: totalPicks }, (_, index) => {
    const slotNumber = index + 1;
    const card = pickedCards[index];
    const current = slotNumber === pickedCards.length + 1;
    if (card) {
      return `
        <button class="draft-picked-card" type="button" data-card-info-id="${card.instanceId}" aria-label="查看已選手牌 ${escapeHtml(card.name)}">
          <span class="draft-picked-thumb">
            ${card.image ? `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="eager" decoding="sync" />` : ''}
          </span>
          <span class="draft-picked-name">${escapeHtml(card.name)}</span>
        </button>
      `;
    }
    return `<span class="draft-slot${current ? ' current' : ''}">${slotNumber}</span>`;
  }).join('');
}

function draftPacketHtml(pack, active) {
  if (!pack.length) {
    return '<div class="draft-packet">空包</div>';
  }
  return Array.from({ length: pack.length }, (_, index) => `
    <div class="draft-packet${active && index === 0 ? ' current' : ''}">
      ${index === 0 ? `<span>${pack.length} 張</span>` : ''}
    </div>
  `).join('');
}

function draftCardHtml(card) {
  const typeLabel = card.type === 'occupation' ? '職業' : '次要發展卡';
  const meta = [typeLabel, card.deck, card.id].filter(Boolean).map(escapeHtml).join(' · ');
  const tags = [
    card.cost ? `費用 ${card.cost}` : '',
    card.requirement ? `條件 ${card.requirement}` : '',
    card.points ? `${card.points} 分` : '',
  ].filter(Boolean);
  const detail = card.text || card.bonus || '沒有文字說明。';
  return `
    <article class="draft-card${state.draft.selectedCardId === card.instanceId ? ' selected' : ''}" data-draft-card-id="${card.instanceId}" tabindex="0" role="button" aria-label="選擇 ${escapeHtml(card.name)}">
      ${state.draft.selectedCardId === card.instanceId ? '<span class="draft-selected-badge">已選</span>' : ''}
      <div class="draft-card-thumb">
        ${card.image ? `<img class="draft-card-image" src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="eager" decoding="sync" onerror="this.closest('.draft-card').classList.add('image-missing'); this.remove();" />` : '<span class="draft-card-id">沒有圖片</span>'}
      </div>
      <div class="draft-card-body">
        <div class="draft-card-title">${escapeHtml(card.name)}</div>
        <div class="draft-card-id">${meta}</div>
        ${tags.length ? `<div class="draft-card-tags">${tags.map((tag) => `<span class="draft-card-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        <div class="draft-card-detail">${escapeHtml(detail)}</div>
        <button class="draft-card-select-btn" type="button">${state.draft.selectedCardId === card.instanceId ? '已選取' : '選擇'}</button>
      </div>
      <button class="draft-card-info-btn" type="button" data-card-info-id="${card.instanceId}" aria-label="查看 ${escapeHtml(card.name)} 詳細資訊">i</button>
    </article>
  `;
}

function chooseDraftCard(instanceId) {
  if (rejectSpectatorAction('輪抽選牌')) return;
  if (!state.draft.active) return;
  state.draft.selectedCardId = instanceId;
  render();
}

function confirmDraftSelectionLegacy() {
  if (rejectSpectatorAction('輪抽選牌')) return;
  if (!state.draft.active || !state.draft.selectedCardId) return;
  const draft = state.draft;
  const playerId = state.playerOrder[draft.currentPlayerIndex];
  const player = state.players[playerId];
  const pack = draft.packs[draft.stage][playerId] || [];
  const cardIndex = pack.findIndex((card) => card.instanceId === draft.selectedCardId);
  if (cardIndex < 0) return;
  if (state.pendingCardAction) {
    if (state.pendingCardAction.playerId !== player.id) return;
    const pending = state.pendingCardAction;
    const card = player.hand[cardIndex];
    if (pending.type !== 'minor' || card.type !== 'minor') {
      addLog('請選擇手上的次要發展卡。');
      return;
    }
    pushUndoState('打出次要發展卡');
    player.hand.splice(cardIndex, 1);
    player.played.push(card);
    completeCardAction(pending.actionId, `${COLOR_LABELS[player.color]} 打出次要發展卡「${card.name}」。`);
    closeHand();
    return;
  }

  pushUndoState('輪抽確認');
  const [card] = pack.splice(cardIndex, 1);
  player.hand.push(card);
  draft.selectedCardId = null;
  addLog(`${COLOR_LABELS[player.color]} 輪抽選了 1 張${card.type === 'occupation' ? '職業' : '次要發展卡'}。`);
  advanceDraftTurn();
  render();
}

function confirmDraftSelection() {
  if (rejectSpectatorAction('輪抽選牌')) return;
  if (!state.draft.active || !state.draft.selectedCardId) return;
  const draft = state.draft;
  const playerId = state.playerOrder[draft.currentPlayerIndex];
  const player = state.players[playerId];
  const pack = draft.packs[draft.stage][playerId] || [];
  const cardIndex = pack.findIndex((card) => card.instanceId === draft.selectedCardId);
  if (cardIndex < 0) return;

  pushUndoState('輪抽確認');
  const [card] = pack.splice(cardIndex, 1);
  player.hand.push(card);
  draft.selectedCardId = null;
  addLog(`${COLOR_LABELS[player.color]} 輪抽選了 1 張${card.type === 'occupation' ? '職業' : '次要發展卡'}。`);
  advanceDraftTurn();
  render();
}

function findVisibleCard(instanceId) {
  if (instanceId?.startsWith('major-')) {
    const majorId = instanceId.replace('major-', '');
    return MAJOR_IMPROVEMENTS.find((card) => card.id === majorId) || null;
  }
  const draft = state.draft;
  if (draft.active) {
    const draftCards = Object.values(draft.packs[draft.stage] || {}).flat();
    const draftCard = draftCards.find((card) => card.instanceId === instanceId);
    if (draftCard) return draftCard;
  }
  for (const player of Object.values(state.players)) {
    const card = [...player.hand, ...player.played].find((item) => item.instanceId === instanceId);
    if (card) return card;
  }
  return null;
}

function openCardInfo(instanceId) {
  const card = findVisibleCard(instanceId);
  if (!card) return;
  const typeLabel = card.type === 'occupation' ? '職業' : card.type === 'major' ? '主要發展卡' : '次要發展卡';
  const meta = [...new Set([typeLabel, card.deck, card.id].filter(Boolean))].join(' · ');
  const tags = [
    card.cost ? `費用：${card.cost}` : '',
    card.requirement ? `條件：${card.requirement}` : '',
    card.points ? `分數：${card.points}` : '',
    card.bonus ? `紅利：${card.bonus}` : '',
  ].filter(Boolean);
  document.getElementById('cardInfoTitle').textContent = card.name;
  document.getElementById('cardInfoMeta').textContent = meta || '卡片資訊';
  document.getElementById('cardInfoBody').innerHTML = `
    <div class="card-info-preview">
      ${card.image ? `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" />` : '<div class="modal-summary">沒有圖片</div>'}
      <div class="card-info-text">
        ${tags.length ? `${escapeHtml(tags.join('\n'))}\n\n` : ''}${escapeHtml(card.text || (card.type === 'major' ? '主要發展卡效果請看左側卡圖。' : '沒有文字說明。'))}
      </div>
    </div>
  `;
  document.getElementById('cardInfoModal').hidden = false;
}

function closeCardInfo() {
  document.getElementById('cardInfoModal').hidden = true;
}

function quickDraftForTesting() {
  if (rejectSpectatorAction('快速輪抽')) return;
  if (!state.draft.active) return;
  pushUndoState('快速輪抽');
  ['occupation', 'minor'].forEach((stage) => {
    state.playerOrder.forEach((playerId) => {
      const pack = state.draft.packs[stage]?.[playerId] || [];
      if (!pack.length) return;
      state.players[playerId].hand.push(...pack);
      state.draft.packs[stage][playerId] = [];
    });
  });
  state.draft.selectedCardId = null;
  addLog('測試模式：快速完成輪抽，所有剩餘牌已加入玩家手牌。');
  finishDraft();
}

function advanceDraftTurn() {
  const draft = state.draft;
  const playerCount = state.playerOrder.length;
  if (draft.currentPlayerIndex < playerCount - 1) {
    draft.currentPlayerIndex += 1;
    state.currentPlayerIndex = draft.currentPlayerIndex;
    return;
  }

  passDraftPacks(draft.stage);
  draft.pickNumber += 1;

  if (draftStagePacksEmpty(draft.stage)) {
    if (draft.stage === 'occupation') {
      draft.stage = 'minor';
      draft.pickNumber = 1;
      draft.currentPlayerIndex = 0;
      state.currentPlayerIndex = 0;
      addLog('職業輪抽完成，開始次要發展卡輪抽。');
      return;
    }
    finishDraft();
    return;
  }

  draft.currentPlayerIndex = 0;
  state.currentPlayerIndex = 0;
}

function passDraftPacks(stage) {
  const direction = DRAFT_PASS_DIRECTION[stage] || 1;
  const nextPacks = {};
  const playerCount = state.playerOrder.length;
  state.playerOrder.forEach((playerId, index) => {
    const nextIndex = (index + direction + playerCount) % playerCount;
    nextPacks[state.playerOrder[nextIndex]] = state.draft.packs[stage][playerId] || [];
  });
  state.draft.packs[stage] = nextPacks;
}

function draftStagePacksEmpty(stage) {
  return state.playerOrder.every((playerId) => !(state.draft.packs[stage][playerId] || []).length);
}

function finishDraft() {
  if (!state.draft.active) return;
  state.draft.active = false;
  state.currentPlayerIndex = 0;
  state.viewedFarmPlayerId = state.playerOrder[0];
  addLog('開局輪抽完成，進入第 1 回合準備。');
  render();
}

function openNotes(playerId = currentPlayer().id) {
  state.notePlayerId = playerId;
  els.notesModal.hidden = false;
  renderNotesModal();
  els.notesTextarea.focus();
}

function closeNotes() {
  els.notesModal.hidden = true;
}

function openHand() {
  if (rejectSpectatorAction('查看手牌')) return;
  if (state.draft.active) return;
  els.handModal.hidden = false;
  updateHandPendingUI();
  renderHand(currentPlayer());
}

function updateHandPendingUI() {
  const skipBtn = document.getElementById('skipCardActionBtn');
  if (!skipBtn) return;
  const pending = state.pendingCardAction;
  const active = pending && pending.type !== 'major' && pending.playerId === currentPlayer().id;
  skipBtn.hidden = !active;
}

function skipPendingCardAction() {
  const pending = state.pendingCardAction;
  if (!pending) return;
  const player = currentPlayer();
  if (pending.playerId !== player.id) return;
  els.handModal.hidden = true;
  pushUndoState('派人（未打牌）');
  completeCardAction(pending.actionId, `${COLOR_LABELS[player.color]} 派人到「${state.actionSpaces[pending.actionId]?.name || ''}」，未打牌。`);
}

function closeHand() {
  els.handModal.hidden = true;
  const pending = state.pendingCardAction;
  if (pending && pending.type !== 'major') {
    state.pendingCardAction = null;
    render();
  }
}

function renderNotesModal() {
  const notePlayer = state.players[state.notePlayerId] || currentPlayer();
  state.notePlayerId = notePlayer.id;
  els.notesModalTitle.textContent = `${COLOR_LABELS[notePlayer.color]} ${notePlayer.name}`;
  els.notesOwnerLabel.textContent = `${COLOR_LABELS[notePlayer.color]} ${notePlayer.name} 的備忘錄`;
  els.notesTextarea.value = state.playerNotes[notePlayer.id] || '';
  els.notesSaveState.textContent = els.notesTextarea.value.trim() ? '已自動儲存' : '空白備忘錄';
  els.notesTabs.innerHTML = state.playerOrder.map((id) => {
    const player = state.players[id];
    const active = id === notePlayer.id ? ' active' : '';
    const hasNote = (state.playerNotes[id] || '').trim().length > 0;
    return `
      <button class="notes-tab${active}" type="button" data-note-player-id="${player.id}">
        <span>${formatPlayer(player)}</span>
        <span class="notes-tab-count">${hasNote ? '有' : '空'}</span>
      </button>
    `;
  }).join('');

  els.notesTabs.querySelectorAll('[data-note-player-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.notePlayerId = button.dataset.notePlayerId;
      renderNotesModal();
    });
  });
}

function handCardHtml(card) {
  const typeLabel = card.type === 'occupation' ? '職業' : '次要發展卡';
  const meta = [typeLabel, card.deck, card.id].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <article class="hand-card${state.spectatorMode ? ' disabled' : ''}" data-card-id="${card.instanceId}" tabindex="${state.spectatorMode ? '-1' : '0'}" role="button" aria-label="打出 ${escapeHtml(card.name)}">
      <div class="hand-card-thumb">
        ${card.image ? `<img class="hand-card-image" src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="lazy" onerror="this.closest('.hand-card').classList.add('image-missing'); this.remove();" />` : ''}
      </div>
      <div class="hand-card-body">
        <div class="hand-card-title">${escapeHtml(card.name)}</div>
        <div class="hand-card-id">${meta}</div>
      </div>
      <button class="draft-card-info-btn hand-card-info-btn" type="button" data-card-info-id="${card.instanceId}" aria-label="查看 ${escapeHtml(card.name)} 詳細資訊">i</button>
    </article>
  `;
}

function renderPlayedCards(player) {
  const occ = player.played.filter((card) => card.type === 'occupation');
  const developments = player.played.filter((card) => card.type !== 'occupation');
  els.playedOcc.innerHTML = occ.map((card) => playedCardHtml(card)).join('') || '<span class="player-meta">尚未打出</span>';
  els.playedMinor.innerHTML = developments.map((card) => playedCardHtml(card)).join('') || '<span class="player-meta">尚未打出</span>';
  document.querySelectorAll('[data-played-card-info-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openCardInfo(button.dataset.playedCardInfoId);
    });
  });
}

function playedCardHtml(card) {
  return `
    <article class="mini-card">
      <div class="mini-card-thumb">
        ${card.image ? `<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="lazy" onerror="this.closest('.mini-card').classList.add('image-missing'); this.remove();" />` : ''}
      </div>
      <div class="mini-card-body">
        <div class="mini-card-title">${escapeHtml(card.name)}</div>
      </div>
      <button class="draft-card-info-btn mini-card-info-btn" type="button" data-played-card-info-id="${card.instanceId}" aria-label="查看 ${escapeHtml(card.name)} 詳細資訊">i</button>
    </article>
  `;
}

function renderLogs() {
  els.logList.innerHTML = state.logs.map((log) => `<li>R${log.round}：${escapeHtml(log.message)}</li>`).join('');
}

function renderControlState() {
  els.spectatorToggleBtn.textContent = state.spectatorMode ? '旁觀者：開' : '旁觀者：關';
  els.spectatorToggleBtn.classList.toggle('active', state.spectatorMode);
  els.spectatorToggleBtn.setAttribute('aria-pressed', String(state.spectatorMode));
  document.getElementById('randomSeatsBtn').disabled = state.spectatorMode || state.draft.active;
  document.getElementById('openHandBtn').disabled = state.spectatorMode || state.draft.active;
  document.getElementById('openHandBtn').textContent = `手牌 ${currentPlayer().hand.length}`;
  document.getElementById('undoBtn').disabled = state.spectatorMode || !undoStack.length;
  document.getElementById('replenishBtn').disabled = state.spectatorMode || state.draft.active;
  document.getElementById('returnHomeBtn').disabled = state.spectatorMode;
  document.getElementById('clearLogBtn').disabled = state.spectatorMode;
  els.chatModeLabel.textContent = state.spectatorMode ? '旁觀者發言' : '玩家發言';
}

function renderChat() {
  els.chatList.innerHTML = state.chatMessages.map((message) => `
    <li>
      <div class="chat-message-head">
        <span>${escapeHtml(message.author)}</span>
        <span>${escapeHtml(message.time)}</span>
      </div>
      <div class="chat-message-body">${escapeHtml(message.text)}</div>
    </li>
  `).join('') || '<li><div class="chat-message-body">尚無訊息。</div></li>';
  els.chatList.scrollTop = els.chatList.scrollHeight;
}

function addChatMessage(text) {
  const cleanText = text.trim();
  if (!cleanText) return;
  const player = currentPlayer();
  const author = state.spectatorMode ? '旁觀者' : `${COLOR_LABELS[player.color]} ${player.name}`;
  state.chatMessages.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    author,
    text: cleanText,
    time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
  });
  renderChat();
}

function openActionModal(actionId) {
  if (rejectSpectatorAction('派人')) return;
  const player = currentPlayer();
  const space = state.actionSpaces[actionId];
  state.selectedActionId = actionId;
  state.selectedSowCrop = null;
  state.selectedBuildChoice = null;
  els.actionModalTitle.textContent = space.name;

  const tokenRows = Object.entries(space.tokens)
    .filter(([, value]) => value > 0)
    .map(([type, value]) => resourcePill(type, value));
  const gainRows = Object.entries(space.gain || {})
    .filter(([, value]) => value > 0)
    .map(([type, value]) => resourcePill(type, value));
  const sowOptions = space.farmAction === 'sow' ? sowCropOptions(player) : [];
  if (sowOptions.length) state.selectedSowCrop = sowOptions[0].type;
  if (space.farmAction === 'build') {
    state.selectedBuildChoice = 'room';
    state.selectedBuildRooms = 1;
    state.selectedBuildStables = 0;
  }
  if (space.id === 'major_minor_improvement') {
    state.selectedImprovementSource = 'minor';
  }
  if (space.cardAction === 'occupation') {
    const playedOcc = player.played.filter((card) => card.type === 'occupation').length;
    state.selectedOccupationFood = playedOcc === 0 ? 0 : 1;
  }
  if (space.farmAction === 'sow') {
    state.selectedBakeGrain = 0;
    state.selectedBakeFood = 0;
  }
  const extra = [];
  if (space.farmAction === 'field') extra.push('確認後請在農場選擇 1 格未使用地，放置 1 片田地。');
  if (space.farmAction === 'build') extra.push('可以擴建 1 間房舍，或支付 2 木建造 1 間馬廄。');
  if (space.farmAction === 'pasture') extra.push('MVP 先以單格圈地處理：選擇 1 格未使用地，支付 4 木與 4 根柵欄，容量 2 隻同種動物。');
  if (space.farmAction === 'sow') extra.push('可只播種、只烤麵包、或兩者都做。播種需選空田；烤麵包請依你的烤爐自行填「花幾麥換幾食物」。');
  if (space.farmAction === 'renovate') {
    const next = renovationTarget(player);
    if (!next) {
      extra.push('你的房子已經是石屋，無法再翻修。');
    } else {
      extra.push(`翻修會把全部 ${roomCount(player)} 間房子升級為${RESOURCE_LABELS[next]}屋，支付 ${formatCostForLog(renovationCost(player))}。`);
    }
    if (space.id === 'renovation_major_minor') extra.push('翻修後可再手動從手牌打 1 張發展卡（第一版手動）。');
    if (space.id === 'renovation_fences') extra.push('翻修後若要建柵欄，請另用「建造柵欄」格（第一版手動）。');
  }
  if (space.id === 'family_growth_minor') extra.push('需要有空房，確認後增加 1 位家庭成員。');
  if (space.id === 'family_growth_without_room') extra.push('不需要空房，確認後增加 1 位家庭成員。');
  if (space.cardAction === 'occupation') extra.push('確認後請從手牌選 1 張職業卡打出。首張預設免費、第 2 張起預設 1 食物，可自行修改。');
  if (space.id === 'starting_player') extra.push('確認後你會成為起始玩家，並可從手牌打 1 張次要發展卡（可按「不打牌，直接派人」略過）。');
  if (space.id === 'major_minor_improvement') extra.push('確認後依上方選擇，從供應區或手牌打出 1 張發展卡。');

  els.actionModalBody.innerHTML = `
    <div class="modal-summary">
      <strong>${COLOR_LABELS[player.color]} ${player.name}</strong> 將派出 1 個家庭成員。
    </div>
    <div class="modal-summary">
      <div class="phase-label">會獲得</div>
      <div class="token-row">${[...tokenRows, ...gainRows].join('') || '沒有自動資源，僅記錄行動。'}</div>
    </div>
    ${space.farmAction === 'build' ? buildOptionsHtmlV2(player) : ''}
    ${space.id === 'major_minor_improvement' ? improvementSourceHtml() : ''}
    ${space.cardAction === 'occupation' ? `
      <div class="modal-summary">
        <label class="occupation-food-field">打出此職業支付食物：
          <input type="number" min="0" inputmode="numeric" data-occupation-food value="${state.selectedOccupationFood}" />
        </label>
      </div>` : ''}
    ${space.farmAction === 'sow' ? sowOptionsHtml(sowOptions) : ''}
    ${space.farmAction === 'sow' ? `
      <div class="modal-summary">
        <div class="phase-label">烤麵包（可選）</div>
        <label class="bake-field">花 <input type="number" min="0" inputmode="numeric" data-bake-grain value="${state.selectedBakeGrain}" /> 麥
          → 換 <input type="number" min="0" inputmode="numeric" data-bake-food value="${state.selectedBakeFood}" /> 食物</label>
      </div>` : ''}
    ${extra.length ? `<div class="modal-summary">${extra.join('<br>')}</div>` : ''}
  `;
  els.actionModalBody.querySelectorAll('[data-sow-crop]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSowCrop = button.dataset.sowCrop;
      els.actionModalBody.querySelectorAll('[data-sow-crop]').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
  els.actionModalBody.querySelectorAll('[data-build-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedBuildChoice = button.dataset.buildChoice;
      els.actionModalBody.querySelectorAll('[data-build-choice]').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
  els.actionModalBody.querySelectorAll('[data-occupation-food]').forEach((input) => {
    input.addEventListener('input', () => {
      state.selectedOccupationFood = Math.max(0, Number(input.value) || 0);
    });
  });
  els.actionModalBody.querySelectorAll('[data-bake-grain]').forEach((input) => {
    input.addEventListener('input', () => {
      state.selectedBakeGrain = Math.max(0, Number(input.value) || 0);
    });
  });
  els.actionModalBody.querySelectorAll('[data-bake-food]').forEach((input) => {
    input.addEventListener('input', () => {
      state.selectedBakeFood = Math.max(0, Number(input.value) || 0);
    });
  });
  els.actionModalBody.querySelectorAll('[data-build-count]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = Math.max(0, Number(input.value) || 0);
      if (input.dataset.buildCount === 'rooms') state.selectedBuildRooms = value;
      if (input.dataset.buildCount === 'stables') state.selectedBuildStables = value;
    });
  });
  els.actionModalBody.querySelectorAll('[data-improvement-source]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedImprovementSource = button.dataset.improvementSource;
      els.actionModalBody.querySelectorAll('[data-improvement-source]').forEach((item) => item.classList.toggle('active', item === button));
    });
  });
  els.actionModal.hidden = false;
}

function closeActionModal() {
  state.selectedActionId = null;
  state.selectedSowCrop = null;
  state.selectedBuildChoice = null;
  state.selectedBuildRooms = 1;
  state.selectedBuildStables = 0;
  state.selectedImprovementSource = 'minor';
  state.selectedOccupationFood = 0;
  state.selectedBakeGrain = 0;
  state.selectedBakeFood = 0;
  els.actionModal.hidden = true;
}

function farmSelectionMode(space) {
  if (space.farmAction === 'field') return 'field';
  if (space.farmAction === 'build') return 'build';
  if (space.farmAction === 'pasture') return 'pasture';
  if (space.farmAction === 'sow') return 'sow';
  return null;
}

function canSelectFarmCell(player, cell) {
  if (state.spectatorMode) return false;
  if (!state.pendingFarmAction || state.pendingFarmAction.playerId !== player.id) return false;
  if (state.pendingFarmAction.mode === 'field') return cell.terrain === 'empty';
  if (state.pendingFarmAction.mode === 'build') return canSelectBuildCell(player, cell);
  if (state.pendingFarmAction.mode === 'pasture') return cell.terrain === 'empty' || Boolean(state.pendingFarmAction.pastureGroups?.[cell.index]);
  if (state.pendingFarmAction.mode === 'sow') return cell.terrain === 'field' && !cell.crop;
  return false;
}

function chooseFarmCell(index) {
  if (rejectSpectatorAction('選擇農場格')) return;
  if (!state.pendingFarmAction) return;
  const player = currentPlayer();
  const cell = player.farm[index];
  if (!cell || !canSelectFarmCell(player, cell)) {
    addLog('這個位置不能執行目前的農場操作。');
    return;
  }

  if (state.pendingFarmAction.mode === 'build') {
    toggleBuildSelection(player, index);
    render();
    return;
  }

  if (state.pendingFarmAction.mode === 'pasture') {
    togglePastureSelection(index);
    render();
    return;
  }

  const { actionId, cropType, buildType, bakeGrain, bakeFood } = state.pendingFarmAction;
  state.pendingFarmAction = null;
  state.viewedFarmPlayerId = player.id;
  finalizeAction(actionId, { farmIndex: index, cropType, buildType, bakeGrain, bakeFood });
}

function adjacentIndices(index) {
  const row = Math.floor(index / FARM_COLUMNS);
  const col = index % FARM_COLUMNS;
  return [
    row > 0 ? index - FARM_COLUMNS : null,
    row < 2 ? index + FARM_COLUMNS : null,
    col > 0 ? index - 1 : null,
    col < FARM_COLUMNS - 1 ? index + 1 : null,
  ].filter((item) => item !== null);
}

function hasAdjacentRoom(player, index) {
  return adjacentIndices(index).some((nextIndex) => player.farm[nextIndex]?.terrain === 'room');
}

function canBuildStableOnCell(player, cell) {
  if (player.stables <= 0 || cell.stable) return false;
  return cell.terrain === 'empty' || cell.terrain === 'pasture';
}

function canSelectBuildCell(player, cell) {
  const pending = state.pendingFarmAction;
  if (!pending || pending.mode !== 'build') return false;
  const roomSelected = pending.selectedRooms?.includes(cell.index);
  const stableSelected = pending.selectedStables?.includes(cell.index);
  if (roomSelected || stableSelected) return true;
  if (pending.placementKind === 'room') {
    if ((pending.selectedRooms || []).length >= pending.buildRooms) return false;
    if (pending.selectedStables?.includes(cell.index)) return false;
    return cell.terrain === 'empty' && hasAdjacentRoomOrPlannedRoom(player, cell.index, pending.selectedRooms || []);
  }
  if ((pending.selectedStables || []).length >= pending.buildStables) return false;
  if (pending.selectedRooms?.includes(cell.index)) return false;
  return canBuildStableOnCell(player, cell);
}

function hasAdjacentRoomOrPlannedRoom(player, index, plannedRooms = []) {
  const planned = new Set(plannedRooms);
  return adjacentIndices(index).some((nextIndex) => player.farm[nextIndex]?.terrain === 'room' || planned.has(nextIndex));
}

function toggleBuildSelection(player, index) {
  const pending = state.pendingFarmAction;
  if (!pending || pending.mode !== 'build') return;
  const rooms = pending.selectedRooms || [];
  const stables = pending.selectedStables || [];
  if (rooms.includes(index)) {
    pending.selectedRooms = rooms.filter((item) => item !== index);
    return;
  }
  if (stables.includes(index)) {
    pending.selectedStables = stables.filter((item) => item !== index);
    return;
  }
  if (pending.placementKind === 'room') {
    if (rooms.length < pending.buildRooms && player.farm[index]?.terrain === 'empty') {
      pending.selectedRooms = [...rooms, index];
    }
    return;
  }
  if (stables.length < pending.buildStables && canBuildStableOnCell(player, player.farm[index])) {
    pending.selectedStables = [...stables, index];
  }
}

function togglePastureSelection(index) {
  const pending = state.pendingFarmAction;
  if (!pending || pending.mode !== 'pasture') return;
  const groups = pending.pastureGroups || {};
  if (groups[index]) {
    delete groups[index];
  } else {
    groups[index] = pending.currentPastureGroup || 1;
  }
  pending.pastureGroups = { ...groups };
}

function buildPlanCost(player, roomCount, stableCount) {
  const roomType = currentRoomType(player);
  const cost = {};
  Object.entries(ROOM_COSTS[roomType]).forEach(([type, value]) => {
    cost[type] = (cost[type] || 0) + value * roomCount;
  });
  Object.entries(STABLE_COST).forEach(([type, value]) => {
    cost[type] = (cost[type] || 0) + value * stableCount;
  });
  return cost;
}

function canBuildRoomPlan(player, roomIndexes) {
  const remaining = new Set(roomIndexes);
  const connected = new Set(player.farm.filter((cell) => cell.terrain === 'room').map((cell) => cell.index));
  let changed = true;
  while (changed) {
    changed = false;
    [...remaining].forEach((index) => {
      if (adjacentIndices(index).some((nextIndex) => connected.has(nextIndex))) {
        connected.add(index);
        remaining.delete(index);
        changed = true;
      }
    });
  }
  return remaining.size === 0;
}

function neighborIndexForSide(index, side) {
  const row = Math.floor(index / FARM_COLUMNS);
  const col = index % FARM_COLUMNS;
  if (side === 'top') return row > 0 ? index - FARM_COLUMNS : null;
  if (side === 'bottom') return row < 2 ? index + FARM_COLUMNS : null;
  if (side === 'left') return col > 0 ? index - 1 : null;
  if (side === 'right') return col < FARM_COLUMNS - 1 ? index + 1 : null;
  return null;
}

function pastureFenceSegments(pastureGroups) {
  const selected = new Set(Object.keys(pastureGroups).map(Number));
  const segmentMap = new Map();
  selected.forEach((index) => {
    FENCE_SIDES.forEach((side) => {
      const neighbor = neighborIndexForSide(index, side);
      const sameGroup = neighbor !== null && selected.has(neighbor) && pastureGroups[neighbor] === pastureGroups[index];
      if (sameGroup) return;
      const sharedDifferentGroup = neighbor !== null && selected.has(neighbor);
      if (sharedDifferentGroup && index > neighbor) return;
      const key = sharedDifferentGroup
        ? `${Math.min(index, neighbor)}-${Math.max(index, neighbor)}`
        : `${index}-${side}`;
      segmentMap.set(key, {
        index,
        side,
        neighbor: sharedDifferentGroup ? neighbor : null,
        opposite: FENCE_OPPOSITE[side],
      });
    });
  });
  return [...segmentMap.values()];
}

function currentRoomType(player) {
  return player.farm.find((cell) => cell.terrain === 'room')?.roomType || 'wood';
}

function renovationTarget(player) {
  return RENOVATION_NEXT[currentRoomType(player)] || null;
}

function renovationCost(player) {
  const next = renovationTarget(player);
  if (!next) return null;
  return { [next]: roomCount(player), reed: 1 };
}

function hasResources(player, cost) {
  return Object.entries(cost).every(([type, value]) => (player.resources[type] || 0) >= value);
}

function payResources(player, cost) {
  Object.entries(cost).forEach(([type, value]) => {
    player.resources[type] -= value;
  });
}

function roomCount(player) {
  return player.farm.filter((cell) => cell.terrain === 'room').length;
}

function growFamily(player, allowWithoutRoom) {
  const emptyRooms = roomCount(player) - player.workers.total;
  if (!allowWithoutRoom && emptyRooms <= 0) {
    addLog(`${COLOR_LABELS[player.color]} 沒有空房，不能增加家庭成員。`);
    return false;
  }
  player.workers.total += 1;
  player.workers.newborns += 1;
  addLog(`${COLOR_LABELS[player.color]} 增加 1 位家庭成員。`);
  return true;
}

function emptyFieldCount(player) {
  return player.farm.filter((cell) => cell.terrain === 'field' && !cell.crop).length;
}

function sowCropOptions(player) {
  const options = [];
  if ((player.resources.grain || 0) > 0) {
    options.push({ type: 'grain', label: '播麥子', fieldCount: 3 });
  }
  if ((player.resources.vegetable || 0) > 0) {
    options.push({ type: 'vegetable', label: '播蔬菜', fieldCount: 2 });
  }
  return options;
}

function sowOptionsHtml(options) {
  if (!options.length) {
    return `
      <div class="modal-summary">
        <div class="phase-label">播種</div>
        <div class="player-meta">你目前沒有可播種的麥子或蔬菜。</div>
      </div>
    `;
  }
  return `
    <div class="modal-summary">
      <div class="phase-label">選擇作物</div>
      <div class="sow-options">
        ${options.map((option, index) => `
          <button class="crop-option ${index === 0 ? 'active' : ''}" type="button" data-sow-crop="${option.type}">
            ${option.label}
            <span>${option.fieldCount} 份在田上</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function plantedCropCount(cropType) {
  return cropType === 'vegetable' ? 2 : 3;
}

function buildOptionsHtml(player) {
  const roomType = currentRoomType(player);
  const roomCost = ROOM_COSTS[roomType];
  return `
    <div class="modal-summary">
      <div class="phase-label">選擇建造</div>
      <div class="sow-options">
        <button class="crop-option active" type="button" data-build-choice="room">
          擴建房舍
          <span>${formatCostForLog(roomCost)}</span>
        </button>
        <button class="crop-option" type="button" data-build-choice="stable">
          建造馬廄
          <span>${formatCostForLog(STABLE_COST)}，剩餘 ${player.stables} 間</span>
        </button>
      </div>
    </div>
  `;
}

function buildOptionsHtmlV2(player) {
  const roomType = currentRoomType(player);
  const roomCost = ROOM_COSTS[roomType];
  return `
    <div class="modal-summary">
      <div class="phase-label">建造數量</div>
      <div class="build-count-grid">
        <label>
          <span>房間</span>
          <input type="number" min="0" max="6" value="1" data-build-count="rooms" />
          <small>每間 ${formatCostForLog(roomCost)}</small>
        </label>
        <label>
          <span>馬廄</span>
          <input type="number" min="0" max="${player.stables}" value="0" data-build-count="stables" />
          <small>每個 ${formatCostForLog(STABLE_COST)}，剩餘 ${player.stables}</small>
        </label>
      </div>
    </div>
  `;
}

function improvementSourceHtml() {
  return `
    <div class="modal-summary">
      <div class="phase-label">發展卡來源</div>
      <div class="sow-options">
        <button class="crop-option active" type="button" data-improvement-source="minor">
          打手上的次要發展卡
          <span>從目前玩家手牌選擇</span>
        </button>
        <button class="crop-option" type="button" data-improvement-source="major">
          打供應區主要發展卡
          <span>從主要發展卡供應區選擇並自動扣費</span>
        </button>
      </div>
    </div>
  `;
}

function confirmAction() {
  if (rejectSpectatorAction('確認行動')) return;
  const actionId = state.selectedActionId;
  if (!actionId) return;
  const space = state.actionSpaces[actionId];
  const player = currentPlayer();
  if (state.phaseId !== 'WORK_PHASE' || space.occupiedBy || player.workers.available <= 0) {
    closeActionModal();
    return;
  }

  const selectionMode = farmSelectionMode(space);
  if (space.cardAction) {
    const type = space.id === 'major_minor_improvement'
      ? (state.selectedImprovementSource === 'major' ? 'major' : 'minor')
      : space.cardAction;
    state.pendingCardAction = { actionId, playerId: player.id, type };
    if (type === 'occupation') state.pendingCardAction.foodCost = Math.max(0, state.selectedOccupationFood || 0);
    closeActionModal();
    if (type === 'major') {
      openMajorModal();
    } else {
      state.handFilter = type;
      openHand();
    }
    render();
    return;
  }

  if (selectionMode) {
    if (selectionMode === 'sow') {
      const bakeGrain = Math.max(0, state.selectedBakeGrain || 0);
      const bakeFood = Math.max(0, state.selectedBakeFood || 0);
      const canSow = emptyFieldCount(player) > 0 && state.selectedSowCrop && (player.resources[state.selectedSowCrop] || 0) > 0;
      if (!canSow && bakeGrain <= 0) {
        addLog(`${COLOR_LABELS[player.color]} 沒有可播種的作物，也沒有要烤麵包。`);
        closeActionModal();
        render();
        return;
      }
      if (bakeGrain > (player.resources.grain || 0)) {
        addLog(`${COLOR_LABELS[player.color]} 麥子不足，無法烤這麼多。`);
        closeActionModal();
        render();
        return;
      }
      if (!canSow) {
        closeActionModal();
        finalizeAction(actionId, { bakeGrain, bakeFood });
        return;
      }
    }
    if (selectionMode === 'build') {
      const buildRooms = Math.max(0, state.selectedBuildRooms || 0);
      const buildStables = Math.max(0, state.selectedBuildStables || 0);
      if (buildRooms + buildStables <= 0) {
        addLog('請至少選擇 1 個房間或 1 個馬廄。');
        closeActionModal();
        render();
        return;
      }
      if (buildStables > player.stables) {
        addLog(`${COLOR_LABELS[player.color]} 馬廄數量不足。`);
        closeActionModal();
        render();
        return;
      }
      const cost = buildPlanCost(player, buildRooms, buildStables);
      if (!hasResources(player, cost)) {
        addLog(`${COLOR_LABELS[player.color]} 資源不足，無法同時建造這些房間與馬廄。`);
        closeActionModal();
        render();
        return;
      }
    }
    state.pendingFarmAction = {
      actionId,
      mode: selectionMode,
      playerId: player.id,
      cropType: state.selectedSowCrop,
      buildType: state.selectedBuildChoice,
    };
    if (selectionMode === 'build') {
      state.pendingFarmAction.buildRooms = Math.max(0, state.selectedBuildRooms || 0);
      state.pendingFarmAction.buildStables = Math.max(0, state.selectedBuildStables || 0);
      state.pendingFarmAction.placementKind = state.pendingFarmAction.buildRooms > 0 ? 'room' : 'stable';
      state.pendingFarmAction.selectedRooms = [];
      state.pendingFarmAction.selectedStables = [];
    }
    if (selectionMode === 'pasture') {
      state.pendingFarmAction.currentPastureGroup = 1;
      state.pendingFarmAction.pastureGroups = {};
    }
    if (selectionMode === 'sow') {
      state.pendingFarmAction.bakeGrain = Math.max(0, state.selectedBakeGrain || 0);
      state.pendingFarmAction.bakeFood = Math.max(0, state.selectedBakeFood || 0);
    }
    closeActionModal();
    render();
    return;
  }

  finalizeAction(actionId);
}

function finalizeAction(actionId, options = {}) {
  const space = state.actionSpaces[actionId];
  const player = currentPlayer();
  if (state.phaseId !== 'WORK_PHASE' || space.occupiedBy || player.workers.available <= 0) {
    render();
    return;
  }

  pushUndoState(`派人：${space.name}`);
  if (space.farmAction === 'field') {
    const cell = player.farm[options.farmIndex];
    if (!cell || cell.terrain !== 'empty') {
      addLog('犁田失敗：請選擇未使用地。');
      render();
      return;
    }
    cell.terrain = 'field';
  }

  if (space.farmAction === 'build') {
    if (options.buildPlacements) {
      const rooms = options.buildPlacements.rooms || [];
      const stables = options.buildPlacements.stables || [];
      if (!canBuildRoomPlan(player, rooms)) {
        addLog('擴建房舍失敗：新房間必須連接既有房間。');
        render();
        return;
      }
      if (stables.some((index) => !canBuildStableOnCell(player, player.farm[index]))) {
        addLog('建造馬廄失敗：請選擇可建造馬廄的農莊格。');
        render();
        return;
      }
      if (stables.length > player.stables) {
        addLog(`${COLOR_LABELS[player.color]} 馬廄數量不足。`);
        render();
        return;
      }
      const totalCost = buildPlanCost(player, rooms.length, stables.length);
      if (!hasResources(player, totalCost)) {
        addLog(`${COLOR_LABELS[player.color]} 資源不足，無法完成這次建造。`);
        render();
        return;
      }
      const roomType = currentRoomType(player);
      payResources(player, totalCost);
      rooms.forEach((index) => {
        const cell = player.farm[index];
        cell.terrain = 'room';
        cell.roomType = roomType;
        cell.pastureGroup = null;
        cell.fences = { top: false, right: false, bottom: false, left: false };
      });
      stables.forEach((index) => {
        player.farm[index].stable = true;
      });
      player.stables -= stables.length;
      addLog(`${COLOR_LABELS[player.color]} 建造 ${rooms.length} 間房間、${stables.length} 個馬廄，支付 ${formatCostForLog(totalCost)}。`);
    } else {
    const cell = player.farm[options.farmIndex];
    const buildType = options.buildType === 'stable' ? 'stable' : 'room';
    if (buildType === 'stable') {
      if (!cell || !canBuildStableOnCell(player, cell)) {
        addLog('建造馬廄失敗：請選擇可建造馬廄的農場格。');
        render();
        return;
      }
      if (!hasResources(player, STABLE_COST)) {
        addLog(`${COLOR_LABELS[player.color]} 資源不足，無法建造馬廄。`);
        render();
        return;
      }
      payResources(player, STABLE_COST);
      cell.stable = true;
      player.stables -= 1;
      addLog(`${COLOR_LABELS[player.color]} 支付 ${formatCostForLog(STABLE_COST)}，建造 1 間馬廄。`);
    } else {
      const roomType = currentRoomType(player);
      const cost = ROOM_COSTS[roomType];
    if (!cell || cell.terrain !== 'empty' || !hasAdjacentRoom(player, cell.index)) {
      addLog('擴建失敗：新房間必須蓋在既有房間的相鄰空地。');
      render();
      return;
    }
    if (!hasResources(player, cost)) {
      addLog(`${COLOR_LABELS[player.color]} 資源不足，無法擴建房舍。`);
      render();
      return;
    }
    payResources(player, cost);
    cell.terrain = 'room';
    cell.roomType = roomType;
    addLog(`${COLOR_LABELS[player.color]} 支付 ${formatCostForLog(cost)}，擴建 1 間${RESOURCE_LABELS[roomType]}屋。`);
    }
    }
  }

  if (space.farmAction === 'pasture') {
    if (options.pastureGroups) {
      const pastureGroups = options.pastureGroups;
      const selectedIndexes = Object.keys(pastureGroups).map(Number);
      const fenceSegments = pastureFenceSegments(pastureGroups);
      const fenceCost = fenceSegments.length;
      if (!selectedIndexes.length) {
        addLog('建造柵欄失敗：請至少選擇 1 格圈地。');
        render();
        return;
      }
      if (selectedIndexes.some((index) => player.farm[index]?.terrain !== 'empty')) {
        addLog('建造柵欄失敗：圈地範圍只能選未使用地。');
        render();
        return;
      }
      if (player.fences < fenceCost) {
        addLog(`${COLOR_LABELS[player.color]} 柵欄數量不足，需要 ${fenceCost} 根柵欄。`);
        render();
        return;
      }
      if (!hasResources(player, { wood: fenceCost })) {
        addLog(`${COLOR_LABELS[player.color]} 木頭不足，需要 ${fenceCost} 木。`);
        render();
        return;
      }
      payResources(player, { wood: fenceCost });
      player.fences -= fenceCost;
      selectedIndexes.forEach((index) => {
        const cell = player.farm[index];
        cell.terrain = 'pasture';
        cell.pastureGroup = `${player.id}-${pastureGroups[index]}`;
        cell.fences = { top: false, right: false, bottom: false, left: false };
      });
      fenceSegments.forEach((segment) => {
        player.farm[segment.index].fences[segment.side] = true;
        if (segment.neighbor !== null) {
          player.farm[segment.neighbor].fences[segment.opposite] = true;
        }
      });
      addLog(`${COLOR_LABELS[player.color]} 建立 ${new Set(Object.values(pastureGroups)).size} 個圈地，使用 ${fenceCost} 根柵欄與 ${fenceCost} 木。`);
    } else {
    const cell = player.farm[options.farmIndex];
    if (!cell || cell.terrain !== 'empty') {
      addLog('建造柵欄失敗：MVP 版請選擇未使用地建立單格圈地。');
      render();
      return;
    }
    if (player.fences < SINGLE_PASTURE_FENCES) {
      addLog(`${COLOR_LABELS[player.color]} 柵欄數量不足，無法建立單格圈地。`);
      render();
      return;
    }
    if (!hasResources(player, SINGLE_PASTURE_COST)) {
      addLog(`${COLOR_LABELS[player.color]} 資源不足，無法建造柵欄。`);
      render();
      return;
    }
    payResources(player, SINGLE_PASTURE_COST);
    player.fences -= SINGLE_PASTURE_FENCES;
    cell.terrain = 'pasture';
    addLog(`${COLOR_LABELS[player.color]} 支付 ${formatCostForLog(SINGLE_PASTURE_COST)}與 ${SINGLE_PASTURE_FENCES} 根柵欄，建立 1 格圈地。`);
  }
  }

  if (space.farmAction === 'sow' && options.farmIndex != null) {
    const cell = player.farm[options.farmIndex];
    const cropType = options.cropType;
    if (!cell || cell.terrain !== 'field' || cell.crop) {
      addLog('播種失敗：請選擇空的農田。');
      render();
      return;
    }
    if (!cropType || (player.resources[cropType] || 0) <= 0) {
      addLog(`${COLOR_LABELS[player.color]} 沒有可播種的作物。`);
      render();
      return;
    }
    player.resources[cropType] -= 1;
    cell.crop = { type: cropType, count: plantedCropCount(cropType) };
    addLog(`${COLOR_LABELS[player.color]} 播種 1 份${RESOURCE_LABELS[cropType]}，田上放置 ${cell.crop.count} 份。`);
  }

  if (space.farmAction === 'sow' && (options.bakeGrain || 0) > 0) {
    const bakeGrain = Math.max(0, options.bakeGrain || 0);
    const bakeFood = Math.max(0, options.bakeFood || 0);
    if ((player.resources.grain || 0) < bakeGrain) {
      addLog(`${COLOR_LABELS[player.color]} 麥子不足，無法烤麵包。`);
      render();
      return;
    }
    player.resources.grain -= bakeGrain;
    player.resources.food += bakeFood;
    addLog(`${COLOR_LABELS[player.color]} 烤麵包：${bakeGrain} 麥 → ${bakeFood} 食物。`);
  }

  if (space.farmAction === 'renovate') {
    const next = renovationTarget(player);
    if (!next) {
      addLog(`${COLOR_LABELS[player.color]} 的房子已是石屋，無法再翻修。`);
      render();
      return;
    }
    const cost = renovationCost(player);
    if (!hasResources(player, cost)) {
      addLog(`${COLOR_LABELS[player.color]} 資源不足，無法翻修房舍。需要 ${formatCostForLog(cost)}。`);
      render();
      return;
    }
    payResources(player, cost);
    player.farm.forEach((cell) => {
      if (cell.terrain === 'room') cell.roomType = next;
    });
    addLog(`${COLOR_LABELS[player.color]} 支付 ${formatCostForLog(cost)}，將 ${roomCount(player)} 間房子翻修為${RESOURCE_LABELS[next]}屋。`);
  }

  if (space.id === 'family_growth_minor' && !growFamily(player, false)) {
    render();
    return;
  }

  if (space.id === 'family_growth_without_room' && !growFamily(player, true)) {
    render();
    return;
  }

  player.workers.available -= 1;
  space.occupiedBy = player.id;

  const gains = mergeResourceMaps(space.tokens, space.gain || {});
  const appliedGains = applyGain(player, gains);
  space.tokens = {};

  if (space.id === 'starting_player') {
    state.nextStartPlayerId = player.id;
  }

  addLog(`${COLOR_LABELS[player.color]} 派人到「${space.name}」${formatGainForLog(appliedGains)}`);
  closeActionModal();
  advanceTurn();
  render();
}

function mergeResourceMaps(...maps) {
  const result = {};
  maps.forEach((map) => {
    Object.entries(map).forEach(([type, value]) => {
      result[type] = (result[type] || 0) + value;
    });
  });
  return result;
}

function applyGain(player, gains) {
  const applied = {};
  Object.entries(gains).forEach(([type, value]) => {
    if (RESOURCE_ORDER.includes(type)) {
      player.resources[type] += value;
      applied[type] = (applied[type] || 0) + value;
    } else if (ANIMAL_ORDER.includes(type)) {
      const placed = addAnimalsToFarm(player, type, value);
      if (placed > 0) applied[type] = (applied[type] || 0) + placed;
    }
  });
  return applied;
}

function cellAnimalEntries(cell) {
  return Object.entries(cell.animals || {}).filter(([, value]) => value > 0);
}

function cellAnimalCount(cell) {
  return cellAnimalEntries(cell).reduce((total, [, value]) => total + value, 0);
}

function cellAnimalType(cell) {
  return cellAnimalEntries(cell)[0]?.[0] || null;
}

function roomPetCount(player) {
  return player.farm
    .filter((cell) => cell.terrain === 'room')
    .reduce((total, cell) => total + cellAnimalCount(cell), 0);
}

function animalCellCapacity(player, cell, type) {
  const existingType = cellAnimalType(cell);
  if (existingType && existingType !== type) return 0;
  if (cell.terrain === 'room') {
    return roomPetCount(player) > 0 && !cell.animals[type] ? 0 : 1;
  }
  if (cell.terrain === 'pasture') {
    return cell.stable ? 4 : 2;
  }
  if (cell.stable) return 1;
  return 0;
}

function addAnimalsToFarm(player, type, count) {
  let remaining = count;
  player.farm.forEach((cell) => {
    if (remaining <= 0) return;
    const capacity = animalCellCapacity(player, cell, type);
    const used = cellAnimalCount(cell);
    const free = Math.max(0, capacity - used);
    if (free <= 0) return;
    const placed = Math.min(remaining, free);
    cell.animals[type] = (cell.animals[type] || 0) + placed;
    remaining -= placed;
  });
  syncPlayerAnimals(player);
  if (remaining > 0) {
    addLog(`${COLOR_LABELS[player.color]} 的農場容量不足，${remaining} 隻${RESOURCE_LABELS[type]}退回供應區。`);
  }
  return count - remaining;
}

function syncPlayerAnimals(player) {
  ANIMAL_ORDER.forEach((type) => {
    player.animals[type] = player.farm.reduce((total, cell) => total + (cell.animals?.[type] || 0), 0);
  });
}

function formatGainForLog(gains) {
  const entries = Object.entries(gains).filter(([, value]) => value > 0);
  if (!entries.length) return '。';
  return `，獲得 ${entries.map(([type, value]) => `${RESOURCE_LABELS[type]} +${value}`).join('、')}。`;
}

function formatCostForLog(cost) {
  return Object.entries(cost)
    .filter(([, value]) => value > 0)
    .map(([type, value]) => `${RESOURCE_LABELS[type]} ${value}`)
    .join('、');
}

function replenish() {
  if (rejectSpectatorAction('補料')) return;
  if (state.draft.active) {
    addLog('輪抽尚未完成，不能開始補料。');
    return;
  }
  if (state.phaseId !== 'ROUND_START' && state.phaseId !== 'REPLENISH_PHASE') {
    addLog(`現在是「${PHASE_LABELS[state.phaseId]}」，不能補料。`);
    return;
  }

  pushUndoState(`補料：第 ${state.round} 回合`);
  state.phaseId = 'ROUND_START';
  addLog(`ROUND_START：第 ${state.round} 回合開始，翻開第 ${state.round} 回合行動卡。`);
  state.phaseId = 'REPLENISH_PHASE';
  Object.values(state.actionSpaces).forEach((space) => {
    if (space.enabledRound && state.round < space.enabledRound) return;
    Object.entries(space.accumulate || {}).forEach(([type, value]) => {
      space.tokens[type] = (space.tokens[type] || 0) + value;
    });
  });
  state.started = true;
  addLog(`REPLENISH_PHASE：第 ${state.round} 回合補貨完成。`);
  state.phaseId = 'WORK_PHASE_START';
  addLog('WORK_PHASE_START：由起始玩家開始派工。');
  state.phaseId = 'WORK_PHASE';
  render();
}

function returnHome() {
  if (rejectSpectatorAction('返家')) return;
  if (state.draft.active) {
    addLog('輪抽尚未完成，不能返家。');
    return;
  }
  if (state.phaseId !== 'WORK_PHASE_END' && state.phaseId !== 'RETURN_HOME') {
    addLog(`現在是「${PHASE_LABELS[state.phaseId]}」，還不能返家。`);
    return;
  }

  const stillHasWorker = state.playerOrder.some((id) => state.players[id].workers.available > 0);
  if (stillHasWorker) {
    addLog('返家失敗：仍有玩家尚未派出所有家庭成員。');
    return;
  }

  pushUndoState(`返家：第 ${state.round} 回合`);
  state.phaseId = 'RETURN_HOME';
  addLog('RETURN_HOME：所有家庭成員返家。');
  Object.values(state.actionSpaces).forEach((space) => {
    space.occupiedBy = null;
  });
  state.playerOrder.forEach((id) => {
    const player = state.players[id];
    player.workers.available = player.workers.total;
  });

  if (HARVEST_ROUNDS.includes(state.round)) {
    startHarvest();
    return;
  }

  finishRound();
  render();
}

function advanceTurn() {
  const nextIndex = state.playerOrder.findIndex((id, index) => index > state.currentPlayerIndex && state.players[id].workers.available > 0);
  if (nextIndex >= 0) {
    state.currentPlayerIndex = nextIndex;
    return;
  }
  const wrappedIndex = state.playerOrder.findIndex((id) => state.players[id].workers.available > 0);
  if (wrappedIndex >= 0) {
    state.currentPlayerIndex = wrappedIndex;
  } else {
    state.phaseId = 'WORK_PHASE_END';
    addLog('WORK_PHASE_END：所有家庭成員都已派出。');
  }
}

function startHarvest() {
  state.phaseId = 'HARVEST_START';
  addLog(`HARVEST_START：第 ${state.round} 回合收成開始。`);

  state.phaseId = 'HARVEST_FIELD';
  state.playerOrder.forEach((id) => harvestFields(state.players[id]));
  addLog('HARVEST_FIELD：每塊已播種農田收成 1 份作物。');

  state.phaseId = 'HARVEST_FEED';
  addLog('HARVEST_FEED：請在餵食面板調整資源後確認餵食。');
  openHarvestModal();
  render();
}

function finishHarvestFeeding() {
  if (rejectSpectatorAction('確認餵食')) return;
  if (state.phaseId !== 'HARVEST_FEED') return;
  state.playerOrder.forEach((id) => feedFamily(state.players[id]));

  state.phaseId = 'HARVEST_BREED';
  state.playerOrder.forEach((id) => breedAnimals(state.players[id]));

  state.phaseId = 'HARVEST_END';
  addLog(`HARVEST_END：第 ${state.round} 回合收成結束。`);

  els.harvestModal.hidden = true;
  finishRound();
  render();
}

const HARVEST_CONVERT_TYPES = ['grain', 'vegetable', 'sheep', 'boar', 'cattle'];

function openHarvestModal() {
  els.harvestModal.hidden = false;
  renderHarvestModal();
}

function feedNeed(player) {
  const newborns = player.workers.newborns || 0;
  const adults = Math.max(0, player.workers.total - newborns);
  return adults * 2 + newborns;
}

function renderHarvestModal() {
  els.harvestBody.innerHTML = state.playerOrder.map((id) => {
    const player = state.players[id];
    const need = feedNeed(player);
    const food = player.resources.food || 0;
    const shortage = Math.max(0, need - food);
    const status = shortage > 0
      ? `<span class="harvest-short">食物差 ${shortage}，將得 ${shortage} 張乞討卡</span>`
      : '<span class="harvest-ok">食物足夠</span>';
    return `
      <div class="harvest-row" data-harvest-player="${player.id}">
        <div class="harvest-row-head">
          <strong>${COLOR_LABELS[player.color]} ${escapeHtml(player.name)}</strong>
          <span>需要 ${need} 食物 ・ 目前 ${food} 食物</span>
          ${status}
        </div>
        <div class="harvest-convert">
          <select data-convert-res>
            ${HARVEST_CONVERT_TYPES.map((type) => `<option value="${type}">${RESOURCE_LABELS[type]}</option>`).join('')}
          </select>
          <input type="number" min="0" value="1" data-convert-amount /> →
          <input type="number" min="0" value="2" data-convert-food /> 食物
          <button class="ghost-btn" type="button" data-convert-go>換</button>
        </div>
      </div>
    `;
  }).join('');

  els.harvestBody.querySelectorAll('[data-harvest-player]').forEach((row) => {
    const playerId = row.dataset.harvestPlayer;
    row.querySelector('[data-convert-go]').addEventListener('click', () => {
      const resType = row.querySelector('[data-convert-res]').value;
      const amount = Math.max(0, Number(row.querySelector('[data-convert-amount]').value) || 0);
      const food = Math.max(0, Number(row.querySelector('[data-convert-food]').value) || 0);
      convertToFood(playerId, resType, amount, food);
    });
  });
}

function convertToFood(playerId, resType, amount, food) {
  if (rejectSpectatorAction('換食物')) return;
  const player = state.players[playerId];
  if (!player || amount <= 0) return;
  const isAnimal = ANIMAL_ORDER.includes(resType);
  const available = isAnimal ? (player.animals[resType] || 0) : (player.resources[resType] || 0);
  if (available < amount) {
    addLog(`${COLOR_LABELS[player.color]} ${RESOURCE_LABELS[resType]} 不足，無法轉換。`);
    return;
  }
  if (isAnimal) {
    removeAnimalsFromFarm(player, resType, amount);
  } else {
    player.resources[resType] -= amount;
  }
  player.resources.food += food;
  addLog(`${COLOR_LABELS[player.color]} 收成換食物：${amount} ${RESOURCE_LABELS[resType]} → ${food} 食物。`);
  renderHarvestModal();
  render();
}

function removeAnimalsFromFarm(player, type, count) {
  let remaining = count;
  player.farm.forEach((cell) => {
    if (remaining <= 0) return;
    const have = cell.animals?.[type] || 0;
    if (have <= 0) return;
    const removed = Math.min(remaining, have);
    cell.animals[type] -= removed;
    if (cell.animals[type] <= 0) delete cell.animals[type];
    remaining -= removed;
  });
  syncPlayerAnimals(player);
  return count - remaining;
}

function harvestFields(player) {
  player.farm.forEach((cell) => {
    if (!cell.crop || cell.crop.count <= 0) return;
    player.resources[cell.crop.type] += 1;
    cell.crop.count -= 1;
    if (cell.crop.count <= 0) delete cell.crop;
  });
}

function feedFamily(player) {
  const foodNeeded = feedNeed(player);
  const paid = Math.min(player.resources.food, foodNeeded);
  player.resources.food -= paid;
  const shortage = foodNeeded - paid;
  if (shortage > 0) {
    player.beggingCards += shortage;
    addLog(`HARVEST_FEED：${COLOR_LABELS[player.color]} 需要 ${foodNeeded} 食物，只支付 ${paid}，取得 ${shortage} 張乞討卡。`);
  } else {
    addLog(`HARVEST_FEED：${COLOR_LABELS[player.color]} 支付 ${foodNeeded} 食物餵養家人。`);
  }
}

function breedAnimals(player) {
  ANIMAL_ORDER.forEach((type) => {
    if ((player.animals[type] || 0) < 2) return;
    const placed = addAnimalsToFarm(player, type, 1);
    if (placed > 0) {
      addLog(`HARVEST_BREED：${COLOR_LABELS[player.color]} 的${RESOURCE_LABELS[type]}繁殖 +1。`);
    } else {
      addLog(`HARVEST_BREED：${COLOR_LABELS[player.color]} 的${RESOURCE_LABELS[type]}有繁殖資格，但沒有空間收納新生動物。`);
    }
  });
}

function finishRound() {
  state.phaseId = 'ROUND_END';
  addLog(`ROUND_END：第 ${state.round} 回合結束。`);
  state.playerOrder.forEach((id) => {
    state.players[id].workers.newborns = 0;
  });

  if (state.round >= 14) {
    state.phaseId = 'GAME_END';
    addLog('第 14 回合收成後，遊戲結束。');
    return;
  }

  state.round += 1;
  applyStartPlayerForNextRound();
  state.phaseId = 'ROUND_START';
  state.started = false;
  state.currentPlayerIndex = 0;
  addLog(`進入第 ${state.round} 回合。`);
}

function applyStartPlayerForNextRound() {
  const startId = state.nextStartPlayerId || state.startPlayerId || state.playerOrder[0];
  const startIndex = state.playerOrder.indexOf(startId);
  if (startIndex > 0) {
    state.playerOrder = [
      ...state.playerOrder.slice(startIndex),
      ...state.playerOrder.slice(0, startIndex),
    ];
  }
  state.startPlayerId = state.playerOrder[0];
  state.nextStartPlayerId = state.startPlayerId;
}

function randomizeSeats() {
  if (rejectSpectatorAction('隨機座位')) return;
  if (state.draft.active) {
    addLog('輪抽已開始，不能重新隨機座位。');
    return;
  }
  const shuffled = [...state.playerOrder];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  pushUndoState('隨機座位');
  state.playerOrder = shuffled;
  state.currentPlayerIndex = 0;
  state.startPlayerId = shuffled[0];
  state.nextStartPlayerId = shuffled[0];
  state.viewedFarmPlayerId = shuffled[0];
  state.seatRandomized = true;
  addLog(`系統隨機座位：${shuffled.map((id) => COLOR_LABELS[state.players[id].color]).join(' → ')}。`);
  render();
}

function completeCardAction(actionId, message) {
  const space = state.actionSpaces[actionId];
  const player = currentPlayer();
  if (!space || space.occupiedBy || player.workers.available <= 0) {
    state.pendingCardAction = null;
    render();
    return;
  }
  player.workers.available -= 1;
  space.occupiedBy = player.id;
  if (space.id === 'starting_player') {
    state.nextStartPlayerId = player.id;
  }
  state.pendingCardAction = null;
  addLog(message);
  advanceTurn();
  render();
}

function playMajorImprovement(majorId) {
  if (rejectSpectatorAction('打主要發展卡')) return;
  const pending = state.pendingCardAction;
  if (!pending || pending.type !== 'major') {
    openCardInfo(`major-${majorId}`);
    return;
  }
  const player = currentPlayer();
  if (pending.playerId !== player.id) return;
  if (state.majorImprovements[majorId]?.available === false) {
    addLog('這張主要發展卡已被取得。');
    return;
  }
  const card = MAJOR_IMPROVEMENTS.find((item) => item.id === majorId);
  if (!card) return;
  const cost = MAJOR_IMPROVEMENT_COSTS[majorId] || {};
  if (!hasResources(player, cost)) {
    addLog(`${COLOR_LABELS[player.color]} 資源不足，無法打出「${card.name}」。需要 ${formatCostForLog(cost)}。`);
    return;
  }
  pushUndoState('打出主要發展卡');
  payResources(player, cost);
  state.majorImprovements[majorId].available = false;
  player.played.push({ ...card, instanceId: `${player.id}-played-${card.id}-${Date.now()}` });
  closeMajorModal();
  completeCardAction(pending.actionId, `${COLOR_LABELS[player.color]} 支付 ${formatCostForLog(cost)}，打出主要發展卡「${card.name}」。`);
}

function playCard(instanceId) {
  if (rejectSpectatorAction('打出手牌')) return;
  if (state.draft.active) {
    addLog('輪抽尚未完成，不能打出手牌。');
    return;
  }
  const player = currentPlayer();
  const cardIndex = player.hand.findIndex((card) => card.instanceId === instanceId);
  const playCardPending = state.pendingCardAction;
  if (cardIndex < 0) return;
  if (playCardPending) {
    if (playCardPending.playerId !== player.id) return;
    const card = player.hand[cardIndex];
    if (playCardPending.type === 'major') {
      addLog('請從供應區選擇主要發展卡。');
      return;
    }
    const label = playCardPending.type === 'occupation' ? '職業' : '次要發展卡';
    if (card.type !== playCardPending.type) {
      addLog(`請選擇手上的${label}。`);
      return;
    }
    let costNote;
    if (playCardPending.type === 'occupation') {
      const foodCost = Math.max(0, playCardPending.foodCost || 0);
      if ((player.resources.food || 0) < foodCost) {
        addLog(`${COLOR_LABELS[player.color]} 食物不足，無法支付 ${foodCost} 食物打出職業「${card.name}」。`);
        return;
      }
      pushUndoState(`打出${label}`);
      if (foodCost > 0) {
        player.resources.food -= foodCost;
        costNote = `，支付 ${foodCost} 食物`;
      } else {
        costNote = '（免費）';
      }
    } else {
      pushUndoState(`打出${label}`);
      costNote = cardCostNote(card);
    }
    player.hand.splice(cardIndex, 1);
    player.played.push(card);
    completeCardAction(playCardPending.actionId, `${COLOR_LABELS[player.color]} 打出${label}「${card.name}」${costNote}。`);
    closeHand();
    return;
  }
  pushUndoState('打出手牌');
  const [card] = player.hand.splice(cardIndex, 1);
  player.played.push(card);
  addLog(`${COLOR_LABELS[player.color]} 打出${card.type === 'occupation' ? '職業' : '次要發展卡'}「${card.name}」${cardCostNote(card)}。`);
  render();
}

function cardCostNote(card) {
  const cost = String(card.cost || '').trim();
  if (!cost || cost === '無') return '';
  return `（費用 ${cost}，請手動扣料）`;
}

document.getElementById('replenishBtn').addEventListener('click', replenish);
document.getElementById('returnHomeBtn').addEventListener('click', returnHome);
document.getElementById('randomSeatsBtn').addEventListener('click', randomizeSeats);
document.getElementById('undoBtn').addEventListener('click', undoLastAction);
document.getElementById('openHandBtn').addEventListener('click', openHand);
document.getElementById('openMajorBtn').addEventListener('click', openMajorModal);
document.getElementById('spectatorToggleBtn').addEventListener('click', () => {
  state.spectatorMode = !state.spectatorMode;
  closeActionModal();
  state.pendingFarmAction = null;
  addLog(state.spectatorMode ? '已切換為旁觀者模式。' : '已切換為玩家操作模式。');
  render();
});
document.getElementById('openNotesBtn').addEventListener('click', () => openNotes());
document.getElementById('clearLogBtn').addEventListener('click', () => {
  if (rejectSpectatorAction('清空紀錄')) return;
  state.logs = [];
  renderLogs();
});
els.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addChatMessage(els.chatInput.value);
  els.chatInput.value = '';
});
document.getElementById('closeActionModal').addEventListener('click', closeActionModal);
document.getElementById('cancelActionBtn').addEventListener('click', closeActionModal);
document.getElementById('closeNotesModal').addEventListener('click', closeNotes);
document.getElementById('doneNotesBtn').addEventListener('click', closeNotes);
document.getElementById('closeHandModal').addEventListener('click', closeHand);
document.getElementById('skipCardActionBtn').addEventListener('click', skipPendingCardAction);
document.getElementById('confirmHarvestBtn').addEventListener('click', finishHarvestFeeding);
document.getElementById('closeMajorModal').addEventListener('click', closeMajorModal);
document.getElementById('closeCardInfoModal').addEventListener('click', closeCardInfo);
els.confirmActionBtn.addEventListener('click', confirmAction);
els.actionModal.addEventListener('click', (event) => {
  if (event.target === els.actionModal) closeActionModal();
});
els.notesModal.addEventListener('click', (event) => {
  if (event.target === els.notesModal) closeNotes();
});
els.handModal.addEventListener('click', (event) => {
  if (event.target === els.handModal) closeHand();
});
document.getElementById('cardInfoModal').addEventListener('click', (event) => {
  if (event.target === document.getElementById('cardInfoModal')) closeCardInfo();
});
els.notesTextarea.addEventListener('input', () => {
  state.playerNotes[state.notePlayerId] = els.notesTextarea.value;
  savePlayerNotes();
  els.notesSaveState.textContent = els.notesTextarea.value.trim() ? '已自動儲存' : '空白備忘錄';
  els.notesTabs.querySelectorAll('[data-note-player-id]').forEach((button) => {
    if (button.dataset.notePlayerId !== state.notePlayerId) return;
    const count = button.querySelector('.notes-tab-count');
    if (count) count.textContent = els.notesTextarea.value.trim() ? '有' : '空';
  });
});

document.querySelectorAll('[data-hand-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.handFilter = button.dataset.handFilter;
    document.querySelectorAll('[data-hand-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderHand(currentPlayer());
  });
});

addLog('單機原型已建立。先按「隨機座位」，再按「補料」開始測試。');
render();
void loadImportedCards();
