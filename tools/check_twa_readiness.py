#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.323：TWA / Android 打包就绪度检查

TWA（Trusted Web Activity）打包要求 PWA 满足一系列条件。本脚本检查
当前项目是否达到可打包状态，并列出缺失项。

检查项（参考 Bubblewrap / PWABuilder 要求）：
  1. manifest.json 存在且 JSON 合法
  2. name / short_name（<= 12 字符）
  3. start_url 指向存在的 HTML
  4. display = standalone / fullscreen
  5. theme_color + background_color
  6. PNG 图标 192x192（any）
  7. PNG 图标 512x512（any）
  8. maskable 图标 512x512
  9. service-worker.js 存在且注册
  10. HTTPS 域名（本地/localhost 不算，需部署后检查）
  11. 图标文件尺寸与声明一致

用法：
  python tools/check_twa_readiness.py            # 本地检查
  python tools/check_twa_readiness.py --url https://example.com   # 检查线上
"""
import re
import sys
import json
import struct
import argparse
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(r'F:\自制软件')
MANIFEST = ROOT / 'manifest.json'
SW = ROOT / 'service-worker.js'
ICONS_DIR = ROOT / 'icons'

PNG_SIG = b'\x89PNG\r\n\x1a\n'


def png_size(path):
    """读 PNG 宽高。"""
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if data[:8] != PNG_SIG or len(data) < 24:
        return None
    w, h = struct.unpack('>II', data[16:24])
    return (w, h)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', help='线上 PWA 根 URL（检查 HTTPS 部署）')
    args = parser.parse_args()

    results = []  # (name, ok, detail)

    def check(name, ok, detail=''):
        results.append((name, ok, detail))

    # 1. manifest 存在
    if not MANIFEST.exists():
        check('manifest.json 存在', False, '文件缺失')
        report(results)
        return
    try:
        m = json.loads(MANIFEST.read_text(encoding='utf-8'))
        check('manifest.json 存在且合法', True)
    except json.JSONDecodeError as e:
        check('manifest.json 存在且合法', False, str(e))
        report(results)
        return

    # 2. name / short_name
    name = m.get('name', '')
    short = m.get('short_name', '')
    check('manifest.name 非空', bool(name), name)
    check('manifest.short_name <= 12 字符', 0 < len(short) <= 12, f'{short}（{len(short)} 字符）')

    # 3. start_url 指向存在的 HTML
    start_url = m.get('start_url', '')
    start_file = start_url.lstrip('./')
    check('manifest.start_url 存在', (ROOT / start_file).exists(), start_url)

    # 4. display
    display = m.get('display', '')
    check('manifest.display = standalone/fullscreen',
          display in ('standalone', 'fullscreen'), display)

    # 5. theme_color + background_color
    check('manifest.theme_color 存在', bool(m.get('theme_color')), m.get('theme_color', ''))
    check('manifest.background_color 存在', bool(m.get('background_color')), m.get('background_color', ''))

    # 6-8. PNG 图标
    icons = m.get('icons', [])
    def find_icon(size, purpose=None):
        for ic in icons:
            if ic.get('sizes') == size and ic.get('type') == 'image/png':
                if purpose is None or purpose in ic.get('purpose', ''):
                    return ic
        return None

    ic192 = find_icon('192x192')
    ic512 = find_icon('512x512')
    ic_mask = find_icon('512x512', 'maskable')
    check('PNG 192x192 (any)', ic192 is not None, ic192['src'] if ic192 else '缺失')
    check('PNG 512x512 (any)', ic512 is not None, ic512['src'] if ic512 else '缺失')
    check('PNG 512x512 (maskable)', ic_mask is not None, ic_mask['src'] if ic_mask else '缺失')

    # 9. 图标文件尺寸与声明一致
    for ic, expect in [(ic192, (192, 192)), (ic512, (512, 512)), (ic_mask, (512, 512))]:
        if not ic:
            continue
        p = ROOT / ic['src'].lstrip('./')
        actual = png_size(p) if p.exists() else None
        label = Path(ic['src']).name
        check(f'{label} 实际尺寸 = {expect[0]}x{expect[1]}',
              actual == expect, f'实际 {actual}')

    # 10. service-worker
    check('service-worker.js 存在', SW.exists())
    if SW.exists():
        sw_text = SW.read_text(encoding='utf-8')
        check('SW 含 install 事件', "addEventListener('install'" in sw_text)
        check('SW 含 fetch 事件', "addEventListener('fetch'" in sw_text)
        check('SW 预缓存 PNG 图标', './icons/icon-192.png' in sw_text)

    # 11. HTTPS 部署（需 --url）
    if args.url:
        check('HTTPS 域名', args.url.startswith('https://'), args.url)
    else:
        check('HTTPS 域名（部署后验证）', None, '未提供 --url，跳过')

    report(results)


def report(results):
    print('TWA / Android 打包就绪度检查')
    print('=' * 64)
    fail = 0
    warn = 0
    for name, ok, detail in results:
        if ok is None:
            print(f'  [SKIP] {name}' + (f' -- {detail}' if detail else ''))
            warn += 1
        elif ok:
            print(f'  [OK]   {name}' + (f' -- {detail}' if detail else ''))
        else:
            print(f'  [FAIL] {name}' + (f' -- {detail}' if detail else ''))
            fail += 1
    print('=' * 64)
    print(f'总结：{len(results) - fail - warn} 通过，{fail} 失败，{warn} 跳过')
    if fail == 0:
        print('[OK] PWA 已满足 TWA 打包要求（HTTPS 部署后即可用 Bubblewrap / PWABuilder 打包）')
        sys.exit(0)
    else:
        print('[FAIL] 需修复上述失败项后才能打包')
        sys.exit(1)


if __name__ == '__main__':
    main()
