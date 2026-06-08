const fs = require('fs');

const fixDraftAndTierlist = (file) => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  const oldChunk = `    const usableW = img.naturalWidth  - CROP.offsetLeft - CROP.offsetRight;
    const usableH = img.naturalHeight - CROP.offsetTop  - CROP.offsetBottom;
    const cellW = usableW / GRID_COLS;
    const cellH = usableH / GRID_ROWS;
    const drawH = cellH * topFraction;
    canvas.width  = cellW;
    canvas.height = drawH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, CROP.offsetLeft + col * cellW, CROP.offsetTop + row * cellH, cellW, drawH, 0, 0, cellW, drawH);`;

  const newChunk = `    const isComposite = imgFile.includes('部分.jpg') || imgFile.includes('舊版');
    const cols = isComposite ? 10 : GRID_COLS;
    const rows = isComposite ? 3 : GRID_ROWS;
    const offL = isComposite ? 0 : CROP.offsetLeft;
    const offR = isComposite ? 0 : CROP.offsetRight;
    const offT = isComposite ? 0 : CROP.offsetTop;
    const offB = isComposite ? 0 : CROP.offsetBottom;

    const usableW = img.naturalWidth  - offL - offR;
    const usableH = img.naturalHeight - offT  - offB;
    const cellW = usableW / cols;
    const cellH = usableH / rows;
    const drawH = cellH * topFraction;
    
    canvas.width  = cellW;
    canvas.height = drawH;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, offL + col * cellW, offT + row * cellH, cellW, drawH, 0, 0, cellW, drawH);`;

  if (content.includes('CROP.offsetLeft - CROP.offsetRight')) {
      content = content.replace(oldChunk, newChunk);
      fs.writeFileSync(file, content);
      console.log(`Fixed ${file}`);
  } else {
      console.log(`Could not find chunk in ${file}`);
  }
};

fixDraftAndTierlist('draft.js');
fixDraftAndTierlist('tierlist.js');
