# -*- coding: utf-8 -*-
"""從拼版母圖切出指定格；格線＝把「非黑內容區」等分成 rows x cols。

用法: python crop_cell.py <母圖> <cols> <rows> <row> <col> <輸出> [寬x高]
row/col 皆 0-based（與 cards.json 的 grid_row / grid_col 同）。
"""
import sys
from PIL import Image
import numpy as np

Image.MAX_IMAGE_PIXELS = None


def content_box(path, dark=40, min_frac=0.02):
    a = np.asarray(Image.open(path).convert('L'))
    h, w = a.shape
    content = a > dark
    col_has = content.mean(axis=0) > min_frac
    row_has = content.mean(axis=1) > min_frac

    def first_run(mask, limit):
        s = None
        for i, v in enumerate(mask):
            if v and s is None:
                s = i
            elif not v and s is not None:
                if i - s > limit * 0.02:
                    return s, i
                s = None
        return (s, len(mask)) if s is not None else (0, len(mask))

    x0, x1 = first_run(col_has, w)
    y0, y1 = first_run(row_has, h)
    return x0, y0, x1, y1


def main():
    src, cols, rows, row, col, out = sys.argv[1:7]
    cols, rows, row, col = int(cols), int(rows), int(row), int(col)
    size = sys.argv[7] if len(sys.argv) > 7 else None

    x0, y0, x1, y1 = content_box(src)
    cw = (x1 - x0) / cols
    ch = (y1 - y0) / rows
    box = (round(x0 + col * cw), round(y0 + row * ch),
           round(x0 + (col + 1) * cw), round(y0 + (row + 1) * ch))
    im = Image.open(src).convert('RGB').crop(box)
    print(f'內容區 ({x0},{y0})-({x1},{y1})  格 {cw:.1f}x{ch:.1f}  切出 {box} -> {im.size}')
    if size:
        w, h = (int(v) for v in size.lower().split('x'))
        im = im.resize((w, h), Image.LANCZOS)
    im.save(out, quality=92, method=6)
    print('已存', out, im.size)


if __name__ == '__main__':
    main()
