(function () {
  // 卡圖檔 CDN：圖已搬到 Cloudflare Pages（免費、流量無上限）。
  // 這是卡圖網址的單一開關——回滾只要設 localStorage hv-card-cdn 指回 viewer 自己（如 './'）即可。
  const CARD_IMG_CDN = localStorage.getItem('hv-card-cdn') || 'https://agricola-cards.pages.dev/';
  const MANIFEST_URL = './card-images.json?v=20260809-a063-user';
  const DECKS = new Set([
    'A', 'B', 'BI', 'C', 'Cz', 'D', 'E', 'FL', 'FR', 'G', 'G4', 'G5',
    'G5+', 'G6', 'G7', 'G8', 'G9', 'HH', 'I', 'K', 'L', 'NL', 'O', 'OX',
    'PI', 'QQ', 'S', 'S12', 'S13', 'WA', 'WM', 'Z', 'AY'
  ]);

  let manifest = { byId: {}, byDeckId: {} };
  let loadPromise = null;
  const imageCache = {};

  function sanitizePart(value) {
    return String(value || '').replace(/[<>:"/\\|?*]/g, '').trim();
  }

  function sanitizeId(value) {
    return sanitizePart(String(value || '').replace(/\.[^.]+$/, ''));
  }

  function getCardId(card) {
    if (!card) return '';
    for (const [key, value] of Object.entries(card)) {
      if (typeof value !== 'string') continue;
      if (key.includes('ID')) return value;
    }
    for (const value of Object.values(card)) {
      if (typeof value !== 'string') continue;
      if (/^[A-Z]{1,3}\d{2,3}\*?[a-z]?$/.test(value)) return value;
      if (/^\d{2,5}(?:-\d+)?[a-z]?$/.test(value)) return value;
    }
    return '';
  }

  function getCardDeck(card) {
    if (!card) return '';
    for (const value of Object.values(card)) {
      if (typeof value === 'string' && DECKS.has(value)) return value;
    }
    const match = String(getCardId(card)).match(/^[A-Z]+/);
    return match ? match[0] : '';
  }

  async function load() {
    if (!loadPromise) {
      loadPromise = fetch(MANIFEST_URL)
        .then(r => (r.ok ? r.json() : { byId: {}, byDeckId: {} }))
        .then(data => {
          manifest = {
            byId: data.byId || {},
            byDeckId: data.byDeckId || {},
          };
          return manifest;
        })
        .catch(() => manifest);
    }
    return loadPromise;
  }

  function getPath(card) {
    const id = sanitizeId(getCardId(card));
    if (!id) return '';
    const deck = sanitizePart(getCardDeck(card));
    const rel = (deck && manifest.byDeckId?.[`${deck}/${id}`]) || manifest.byId?.[id] || '';
    if (!rel) return '';
    // 絕對網址原樣用（主要發展卡 M01～M10 的圖直接吃 LUGA 現成的 online-table 卡圖）
    return /^https?:\/\//.test(rel) ? rel : CARD_IMG_CDN + rel;
  }

  // 卡圖解碼後一張約 2MB，縮圖牆一次上千張會炸掉記憶體，只留最近用到的
  const IMAGE_CACHE_MAX = 120;
  function remember(path, img) {
    imageCache[path] = img;
    const keys = Object.keys(imageCache);
    if (keys.length > IMAGE_CACHE_MAX) delete imageCache[keys[0]];
  }

  // maxWidth：畫布寬度上限（0＝照原圖）。縮圖傳上限，卡片大圖／彈窗不傳。
  function draw(canvas, imagePath, topFraction = 1, onError, maxWidth = 0) {
    if (!canvas || !imagePath) return false;
    const drawImage = img => {
      const sourceW = img.naturalWidth || img.width;
      const sourceH = img.naturalHeight || img.height;
      const drawH = Math.max(1, Math.round(sourceH * topFraction));
      const shrink = maxWidth > 0 ? Math.min(1, maxWidth / sourceW) : 1;   // 只縮不放
      canvas.width = Math.max(1, Math.round(sourceW * shrink));
      canvas.height = Math.max(1, Math.round(drawH * shrink));
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, sourceW, drawH, 0, 0, canvas.width, canvas.height);
      canvas.dataset.drawn = '1';
    };

    if (imageCache[imagePath]) {
      drawImage(imageCache[imagePath]);
      return true;
    }

    const img = new Image();
    img.onload = () => {
      remember(imagePath, img);
      drawImage(img);
    };
    img.onerror = () => {
      if (typeof onError === 'function') onError();
    };
    img.src = imagePath;
    return true;
  }

  window.CardImages = { load, getPath, draw };
})();
