// site-lists.js：禁卡／BGA 名單以 Firestore 為唯一來源（Lu 1120）
// 鎖住舊 bug：雲端解禁的卡被寫死清單「聯集」擋回去。
const assert = require('assert');
const path = require('path');

function freshModule({ banDoc, bgaDoc, fail = false }) {
  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  let calls = 0;
  global.fetch = async url => {
    calls++;
    if (fail) throw new Error('offline');
    const doc = url.endsWith('/banlist') ? banDoc : bgaDoc;
    return { ok: !!doc, json: async () => doc || {} };
  };
  const file = path.join(__dirname, 'site-lists.js');
  delete require.cache[require.resolve(file)];
  global.window = {};
  require(file);
  return { SL: global.window.SiteLists, store, calls: () => calls };
}

const banDoc = ids => ({ fields: { groups: { arrayValue: { values: [
  { mapValue: { fields: { label: { stringValue: '過強職業卡' }, ids: { arrayValue: { values: ids.map(stringValue => ({ stringValue })) } } } } },
] } } } });

(async () => {
  // 1. 雲端讀到 → 完全採用，不併入備援（K270 在備援裡，雲端沒有就不是禁卡）
  {
    const { SL } = freshModule({ banDoc: banDoc(['A127']), bgaDoc: { fields: { ids: { arrayValue: { values: [{ stringValue: 'I100' }] } } } } });
    assert.ok(SL.FALLBACK_BANNED_GROUPS.some(g => g.ids.includes('K270')), '前提：K270 在備援清單');
    const ids = SL.bannedIdSet(await SL.loadBannedGroups());
    assert.deepStrictEqual([...ids], ['A127'], '雲端名單要完全覆蓋備援');
    const bga = await SL.loadBgaExtraIds();
    assert.ok(SL.isBga({ '牌組': 'I', '卡片ID': 'I100' }, bga), 'GM 額外標記的卡算 BGA');
    assert.ok(SL.isBga({ '牌組': 'C', '卡片ID': 'C999' }, bga), 'A～E 牌組算 BGA');
    assert.ok(!SL.isBga({ '牌組': 'I', '卡片ID': 'I101' }, bga), '其他卡不算 BGA');
  }
  // 2. 雲端讀不到 → 用備援
  {
    const { SL } = freshModule({ fail: true });
    const ids = SL.bannedIdSet(await SL.loadBannedGroups());
    assert.ok(ids.has('K270'), '離線時退回備援');
    assert.strictEqual((await SL.loadBgaExtraIds()).size, 0);
  }
  // 3. 快取：第二次（同頁）不重抓；fresh 會重抓並更新快取
  {
    const m = freshModule({ banDoc: banDoc(['A127']), bgaDoc: { fields: { ids: { arrayValue: {} } } } });
    await m.SL.loadBannedGroups();
    await m.SL.loadBannedGroups();
    assert.strictEqual(m.calls(), 1, '同頁只抓一次');
    await m.SL.loadBannedGroups({ fresh: true });
    assert.strictEqual(m.calls(), 2, 'fresh 要重抓');
    assert.ok(JSON.parse(m.store.agricola_banlist_cache).data[0].ids.includes('A127'), '寫入共用快取');
  }
  // 4. 頁面不得再寫死禁卡陣列（全站只留 site-lists.js 一份備援）
  {
    const fs = require('fs');
    for (const f of ['app.js', 'draft.js', 'rank.js', 'tierlist.js', 'review.js', 'compare.js', 'profile.js', 'list.js']) {
      const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
      assert.ok(!/'K270'/.test(src), `${f} 不應再寫死禁卡 ID`);
    }
  }
  console.log('site_lists_test: 全部通過');
})().catch(e => { console.error(e); process.exit(1); });
