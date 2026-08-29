# -*- coding: utf-8 -*-
"""把 agricola-viewer/images/*.jpg（網頁縮圖）對回 Desktop 的拼版母圖。

作法：兩邊都轉灰階、壓成 48x48、做零均值單位變異數正規化，比 L2 距離。
壓成同一個方形所以長寬比不同不影響比對，只看畫面結構。
輸出 master_map.json：{ repo檔名: {master, dist, runner_up, margin} }

用法: python match_masters.py [輸出.json]
"""
import json
import os
import sys
from PIL import Image
import numpy as np

Image.MAX_IMAGE_PIXELS = None

REPO_DIR = r'D:\Claude Project\agricola-viewer\images'
MASTER_ROOT = r'E:\Users\bboylu\Desktop\農家樂中文化'
N = 48


def signature(path):
    try:
        im = Image.open(path)
        im.draft('L', (N * 8, N * 8))          # 大 JPEG 用 draft 直接抽小解析度，快很多
        im = im.convert('L').resize((N, N), Image.LANCZOS)
    except Exception as exc:                    # noqa: BLE001
        print(f'  略過 {path}: {exc}')
        return None
    a = np.asarray(im, dtype=np.float64).ravel()
    a -= a.mean()
    s = a.std()
    return a / s if s > 1e-6 else a


def collect_masters():
    out = []
    for root, _dirs, files in os.walk(MASTER_ROOT):
        for f in files:
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                out.append(os.path.join(root, f))
    return sorted(out)


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'master_map.json'

    repo_files = sorted(
        f for f in os.listdir(REPO_DIR)
        if f.lower().endswith(('.jpg', '.jpeg')) and os.path.isfile(os.path.join(REPO_DIR, f))
    )
    masters = collect_masters()
    print(f'repo 圖 {len(repo_files)} 張，母圖 {len(masters)} 張，開始建特徵…')

    msig = []
    for i, p in enumerate(masters, 1):
        s = signature(p)
        if s is not None:
            msig.append((p, s))
        if i % 20 == 0:
            print(f'  母圖 {i}/{len(masters)}')
    M = np.stack([s for _p, s in msig])
    paths = [p for p, _s in msig]

    result = {}
    for f in repo_files:
        s = signature(os.path.join(REPO_DIR, f))
        if s is None:
            continue
        d = np.linalg.norm(M - s, axis=1)
        order = np.argsort(d)
        best, second = order[0], order[1]
        result[f] = {
            'master': os.path.relpath(paths[best], MASTER_ROOT).replace('\\', '/'),
            'dist': round(float(d[best]), 2),
            'runner_up': os.path.relpath(paths[second], MASTER_ROOT).replace('\\', '/'),
            'margin': round(float(d[second] - d[best]), 2),
        }

    with open(out_path, 'w', encoding='utf-8') as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    print(f'寫出 {out_path}，共 {len(result)} 筆')


if __name__ == '__main__':
    main()
