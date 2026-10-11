#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.323：把生成的 PNG 图标写入根目录 manifest.json

TWA / Android 需要 PNG 图标，之前 manifest 只有 SVG data URL。
本脚本更新根目录 manifest.json 的 icons 数组为：
  - PNG 192/512（any）+ PNG 512（maskable）— Android / TWA 用
  - SVG data URL（any）— 浏览器 PWA 保留（矢量、无网络请求）

根目录 manifest.json 是权威源：release.py 发布时读取它生成
release/v54.XXX/manifest.json 并把 icons/ 复制进发布包。

用法：
  python tools/update_manifest_icons.py
"""
import sys
import json
import argparse
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(r'F:\自制软件')
ICONS_DIR = ROOT / 'icons'

SVG_192 = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'"
           "%3E%3Crect fill='%232563eb' width='192' height='192' rx='32'/%3E"
           "%3Ctext x='96' y='128' font-size='96' text-anchor='middle' fill='white' "
           "font-family='system-ui'%3E%CE%A3%3C/text%3E%3C/svg%3E")


def build_icons():
    """构造 icons 数组（PNG 三件套 + SVG 兜底）。"""
    return [
        {"src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "./icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png",
         "purpose": "maskable"},
        {"src": SVG_192, "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
    ]


def update_one(manifest_path):
    if not manifest_path.exists():
        return False
    data = json.loads(manifest_path.read_text(encoding='utf-8'))
    new_icons = build_icons()
    if data.get('icons') == new_icons:
        return False
    data['icons'] = new_icons
    manifest_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
    )
    return True


def main():
    argparse.ArgumentParser().parse_args()

    # 前提检查：PNG 图标存在
    missing = [f for f in ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']
               if not (ICONS_DIR / f).exists()]
    if missing:
        print(f'  ERROR: 缺少 PNG 图标 {missing}')
        print('  先运行：node tools/generate_pwa_icons.js')
        sys.exit(1)

    root_manifest = ROOT / 'manifest.json'
    if update_one(root_manifest):
        print('  [OK] 根目录 manifest.json 的 icons 已更新为 PNG 三件套 + SVG 兜底')
    else:
        print('  （根目录 manifest.json 的 icons 已是最新，无需更新）')
    print('\n下一步：运行 release.py 发布时会把 icons/ 复制进发布包')


if __name__ == '__main__':
    main()
