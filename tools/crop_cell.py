# -*- coding: utf-8 -*-
"""從拼版母圖切出指定的一格卡。

三種拼版都吃得動（見 MASTER_IMAGE_MAP.md）：
  ・舊版牌            黑底、卡片邊靠邊沒有間隙   → 找到內容區後等分
  ・2016新版/中文化   白底、卡片之間有留白、最上面還有一條標題列 → 靠留白找出每一格
  ・2016新版/TTS圖    黑底、卡片之間有細間隙                     → 同上

底色不猜：黑底與白底兩種假設都算一遍，挑「兩軸都能靠間隙切出正確格數、
且每格大小最平均」的那一種。標題列因為明顯較矮，取最大的 N 段時會自動被淘汰。

用法:
    python crop_cell.py <母圖> <總欄數> <總列數> <row> <col> <輸出> [寬x高] [--debug]

row / col 是 0-based，與 cards.json 的 grid_row / grid_col 相同。
不給寬x高就輸出原始解析度。
"""
import sys
from PIL import Image
import numpy as np

Image.MAX_IMAGE_PIXELS = None


def runs_of(mask):
    out, s = [], None
    for i, v in enumerate(mask):
        if v and s is None:
            s = i
        elif not v and s is not None:
            out.append((s, i))
            s = None
    if s is not None:
        out.append((s, len(mask)))
    return out


def bands(profile, n, span, min_frac=0.02):
    """把「有內容」的布林剖面切成 n 段。夠切就用間隙，不夠就等分。"""
    segs = [r for r in runs_of(profile) if r[1] - r[0] > span * min_frac]
    if len(segs) >= n:
        top = sorted(segs, key=lambda r: r[1] - r[0], reverse=True)[:n]
        return sorted(top), 'gutter'
    if not segs:
        segs = [(0, span)]
    a, b = max(segs, key=lambda r: r[1] - r[0])
    step = (b - a) / n
    return [(round(a + i * step), round(a + (i + 1) * step)) for i in range(n)], 'even'


def spread(bs):
    """每格大小的相對離散度，越小越像規則網格。"""
    sizes = np.array([b - a for a, b in bs], dtype=float)
    return float(sizes.std() / sizes.mean()) if sizes.mean() else 9.9


def try_bg(small, bg, cols, rows):
    content = np.abs(small - bg) > 45
    cb, cm = bands(content.mean(axis=0) > 0.02, cols, small.shape[1])
    rb, rm = bands(content.mean(axis=1) > 0.02, rows, small.shape[0])
    score = (cm == 'gutter') + (rm == 'gutter')
    return {'bg': bg, 'cols': cb, 'rows': rb, 'mode': (cm, rm),
            'score': score, 'spread': spread(cb) + spread(rb)}


def detect(path, cols, rows, debug=False):
    im = Image.open(path)
    im.draft('L', (2400, 2400))          # 大 JPEG 先降解析度掃，位置再按比例還原
    small = np.asarray(im.convert('L'), dtype=np.int16)
    sh, sw = small.shape
    full_w, full_h = Image.open(path).size
    sx, sy = full_w / sw, full_h / sh

    cands = [try_bg(small, 0, cols, rows), try_bg(small, 255, cols, rows)]
    best = max(cands, key=lambda c: (c['score'], -c['spread']))
    if debug:
        for c in cands:
            print(f"  底色{c['bg']:>4}: mode={c['mode']} score={c['score']} spread={c['spread']:.3f}"
                  + ('  <= 採用' if c is best else ''))
        print(f"  掃描解析度={sw}x{sh}  欄={best['cols']}")
        print(f"  列={best['rows']}")
    return ([(round(a * sx), round(b * sx)) for a, b in best['cols']],
            [(round(a * sy), round(b * sy)) for a, b in best['rows']])


def main():
    debug = '--debug' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--debug']
    src, cols, rows, row, col, out = args[:6]
    cols, rows, row, col = int(cols), int(rows), int(row), int(col)
    size = args[6] if len(args) > 6 else None

    col_bands, row_bands = detect(src, cols, rows, debug)
    x0, x1 = col_bands[col]
    y0, y1 = row_bands[row]
    im = Image.open(src).convert('RGB').crop((x0, y0, x1, y1))
    print(f'切出 ({x0},{y0})-({x1},{y1}) -> {im.size}')
    if size:
        w, h = (int(v) for v in size.lower().split('x'))
        im = im.resize((w, h), Image.LANCZOS)
    im.save(out, quality=92, method=6)
    print('已存', out, im.size)


if __name__ == '__main__':
    main()
