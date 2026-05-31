# -*- coding: utf-8 -*-
"""
農家樂卡頁裁切器：偵測表格「黑色格線」切出單張卡，供視覺判讀。
（白底 NL 頁、橘底 A/經典頁皆通用，因為都靠黑格線定位，與底色/圖案無關。）

用法:
    python crop_page.py <圖檔> [--scale 1.9] [--out 目錄] [--dark 80] [--thr 0.55]
    # 若自動偵測異常，可手動: --vlines x0,x1,... --hlines y0,y1,...

輸出:
    <out>/<basename>_cardK.png（左→右、上→下）並印出每張 grid_row/grid_col
"""
import sys, os, argparse
from PIL import Image
import numpy as np

def find_lines(frac, thr, gap=6):
    idx=[i for i,v in enumerate(frac) if v>thr]
    out=[]; s=p=None
    for i in idx:
        if s is None: s=p=i
        elif i-p<=gap: p=i
        else: out.append((s+p)//2); s=p=i
    if s is not None: out.append((s+p)//2)
    return out

def cells(lines, dim, min_frac=0.12):
    """相鄰格線之間、寬度足夠者視為一格。"""
    segs=[]
    for a,b in zip(lines, lines[1:]):
        if b-a >= dim*min_frac: segs.append((a,b))
    return segs

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('--scale', type=float, default=1.9)
    ap.add_argument('--out', default=None)
    ap.add_argument('--dark', type=int, default=80, help='黑線亮度門檻(<此值算暗)')
    ap.add_argument('--thr', type=float, default=0.55, help='整條暗比例門檻')
    ap.add_argument('--vlines', default=None); ap.add_argument('--hlines', default=None)
    a=ap.parse_args()
    img=Image.open(a.image); g=np.array(img.convert('L'))
    if a.vlines and a.hlines:
        vl=[int(x) for x in a.vlines.split(',')]; hl=[int(y) for y in a.hlines.split(',')]
    else:
        vl=find_lines((g<a.dark).mean(axis=0), a.thr)
        hl=find_lines((g<a.dark).mean(axis=1), a.thr)
    xc=cells(vl, img.width); yc=cells(hl, img.height)
    if not xc or not yc:
        print('找不到格線。vlines=',vl,'hlines=',hl,'\n可調 --dark/--thr 或手動 --vlines/--hlines'); sys.exit(1)
    base=os.path.splitext(os.path.basename(a.image))[0]
    out=a.out or os.path.join(os.path.dirname(a.image) or '.', base+'_crops')
    os.makedirs(out, exist_ok=True)
    n=1; lines=[]
    for ri,(y0,y1) in enumerate(yc):
        for ci,(x0,x1) in enumerate(xc):
            crop=img.crop((x0,y0,x1,y1)).resize((int((x1-x0)*a.scale), int((y1-y0)*a.scale)))
            crop.save(os.path.join(out, f'{base}_card{n}.png'))
            lines.append(f'  card{n}: grid_row={ri} grid_col={ci}')
            n+=1
    print(f'OK: {len(yc)}x{len(xc)} = {n-1} crops -> {out}')
    print('\n'.join(lines))

if __name__=='__main__':
    main()
