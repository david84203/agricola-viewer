const fs = require('fs');
let content = fs.readFileSync('draft.js', 'utf8');

// Replace all calls
content = content.replace(/drawCrop\(([^,]+),\s*card\.source_image,\s*card\.grid_col,\s*card\.grid_row(?:,\s*([^)]+))?\)/g, (match, p1, p2) => {
  return p2 ? `drawCrop(${p1}, card, ${p2})` : `drawCrop(${p1}, card)`;
});

// Replace the function body
const oldFuncRegex = /\/\/ topFraction: 1 = full card, 0\.5 = top half only\r?\nfunction drawCrop\(canvas, imgFile, col, row, topFraction = 1\) \{[\s\S]*?(?=\n\/\/ ── Modal ──────────────────────────────────────────)/;

const newFunc = `// topFraction: 1 = full card, 0.5 = top half only
function drawCrop(canvas, card, topFraction = 1) {
  if (!canvas || !card || !card.source_image) return;
  const key = IMG_BASE + card.source_image;

  const draw = (img) => {
    // Check if the image is a composite (from the older set named ...部分.jpg or 舊版)
    const isComposite = card.source_image.includes('部分.jpg') || card.source_image.includes('舊版');

    const cols = card.grid_cols || (isComposite ? 10 : GRID_COLS);
    const rows = card.grid_rows || (isComposite ? 3 : GRID_ROWS);
    
    // Default crop offsets unless overridden
    const offsetLeft = card.crop_left !== undefined ? card.crop_left : (isComposite ? 0 : CROP.offsetLeft);
    const offsetRight = card.crop_right !== undefined ? card.crop_right : (isComposite ? 0 : CROP.offsetRight);
    const offsetTop = card.crop_top !== undefined ? card.crop_top : (isComposite ? 0 : CROP.offsetTop);
    const offsetBottom = card.crop_bottom !== undefined ? card.crop_bottom : (isComposite ? 0 : CROP.offsetBottom);

    const usableW = img.naturalWidth  - offsetLeft - offsetRight;
    const usableH = img.naturalHeight - offsetTop  - offsetBottom;
    const cellW = usableW / cols;
    const cellH = usableH / rows;
    const drawH = cellH * topFraction;
    
    canvas.width  = cellW;
    canvas.height = drawH;
    const ctx = canvas.getContext('2d');
    
    const sx = offsetLeft + (card.grid_col || 0) * cellW;
    const sy = offsetTop + (card.grid_row || 0) * cellH;
    
    ctx.drawImage(img, sx, sy, cellW, drawH, 0, 0, cellW, drawH);
  };

  if (imageCache[key]) {
    draw(imageCache[key]);
  } else {
    const img = new Image();
    img.onload = () => { imageCache[key] = img; draw(img); };
    img.onerror = () => {
      canvas.width = 180; canvas.height = Math.round(130 * topFraction);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1d2437';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = key;
  }
}
`;

content = content.replace(oldFuncRegex, newFunc);
fs.writeFileSync('draft.js', content, 'utf8');
console.log('draft.js updated successfully!');
