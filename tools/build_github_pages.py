#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.324：生成 GitHub Pages 部署包

从最新 release 生成可直接部署到 GitHub Pages 的静态站点。

设计要点：
1. 流动相版 HTML 重命名为 index.html
   （原文件名含中文 + "&"，URL 编码后超长，且 PWA start_url 不利）
2. manifest.json 的 start_url 改为 "./"，图标路径保持 ./icons/
3. service-worker.js 的 PRECACHE_URLS 改为 index.html
4. 生成 .nojekyll（禁用 Jekyll — 否则下划线开头的文件/目录被忽略）
5. 生成 .well-known/assetlinks.json（TWA 用，若不存在则放模板）

输出：deploy/ 目录（可直接 git push 到 GitHub Pages 分支）

用法：
  python tools/build_github_pages.py
  python tools/build_github_pages.py --version v54.323
"""
import re
import sys
import json
import shutil
import argparse
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(r'F:\自制软件')
RELEASE_DIR = ROOT / 'release'
DEPLOY_DIR = ROOT / 'deploy'


def latest_version():
    versions = sorted(
        (d.name for d in RELEASE_DIR.iterdir()
         if d.is_dir() and re.match(r'^v54\.\d+$', d.name)),
        key=lambda s: int(s.split('.')[1]),
    )
    return versions[-1] if versions else None


def build(version):
    src = RELEASE_DIR / version
    if not src.exists():
        print(f'  ERROR: release/{version}/ 不存在')
        sys.exit(1)

    if DEPLOY_DIR.exists():
        shutil.rmtree(DEPLOY_DIR)
    DEPLOY_DIR.mkdir(parents=True)

    # 1. 流动相版 HTML → index.html
    mobile_html = next(src.glob('RSD & 含量计算器_流动相版_*.html'), None)
    if not mobile_html:
        print(f'  ERROR: release/{version}/ 无流动相版 HTML')
        sys.exit(1)
    html_text = mobile_html.read_text(encoding='utf-8')
    # 把内联的 SW 相对路径 + manifest 保持相对，无需改（同目录）
    (DEPLOY_DIR / 'index.html').write_text(html_text, encoding='utf-8')
    print(f'  ✓ index.html（{mobile_html.stat().st_size // 1024} KB）')

    # 2. manifest.json：start_url → ./
    manifest = json.loads((src / 'manifest.json').read_text(encoding='utf-8'))
    manifest['start_url'] = './'
    manifest['scope'] = './'
    # shortcuts 指向 index.html
    for s in manifest.get('shortcuts', []):
        s['url'] = re.sub(
            r'\./RSD & 含量计算器_流动相版_v54\.\d+\.html',
            './index.html', s['url'])
    (DEPLOY_DIR / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'  ✓ manifest.json（start_url=./）')

    # 3. service-worker.js：PRECACHE_URLS → index.html
    sw_text = (src / 'service-worker.js').read_text(encoding='utf-8')
    sw_text = re.sub(
        r'\./RSD & 含量计算器_流动相版_v54\.\d+\.html',
        './index.html', sw_text)
    (DEPLOY_DIR / 'service-worker.js').write_text(sw_text, encoding='utf-8')
    print(f'  ✓ service-worker.js（PRECACHE → index.html）')

    # 4. icons/
    src_icons = src / 'icons'
    if src_icons.exists():
        shutil.copytree(src_icons, DEPLOY_DIR / 'icons')
        print(f'  ✓ icons/（{len(list(src_icons.glob("*.png")))} 个 PNG）')

    # 5. .nojekyll（禁用 Jekyll — 保护 .well-known / 下划线文件）
    (DEPLOY_DIR / '.nojekyll').write_text('', encoding='utf-8')
    print('  ✓ .nojekyll')

    # 6. .well-known/assetlinks.json（TWA）
    (DEPLOY_DIR / '.well-known').mkdir(exist_ok=True)
    assetlinks_src = ROOT / '.well-known' / 'assetlinks.json'
    template_src = ROOT / 'twa' / 'assetlinks.template.json'
    if assetlinks_src.exists():
        shutil.copy2(assetlinks_src, DEPLOY_DIR / '.well-known' / 'assetlinks.json')
        print('  ✓ .well-known/assetlinks.json（已配置）')
    elif template_src.exists():
        shutil.copy2(template_src, DEPLOY_DIR / '.well-known' / 'assetlinks.json')
        print('  ! .well-known/assetlinks.json（模板 — 打包 TWA 后需填入指纹）')

    # 7. 404.html（GitHub Pages SPA 回退）
    (DEPLOY_DIR / '404.html').write_text(
        '<!DOCTYPE html><meta charset="utf-8">'
        '<script>location.replace("/")</script>'
        '<p>Redirecting… <a href="/">首页</a></p>',
        encoding='utf-8')
    print('  ✓ 404.html')

    return DEPLOY_DIR


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', help='release 版本（默认最新）')
    args = parser.parse_args()

    version = args.version or latest_version()
    if not version:
        print('ERROR: 未找到任何 release')
        sys.exit(1)

    print(f'生成 GitHub Pages 部署包（{version}）')
    print('=' * 56)
    build(version)
    print('=' * 56)
    print(f'[OK] 部署包已生成：{DEPLOY_DIR}')
    print()
    print('下一步：')
    print('  1. git init（若尚未初始化）')
    print('  2. 把 deploy/ 内容推送到 GitHub 仓库的 main 分支（或 gh-pages）')
    print('  3. 仓库 Settings → Pages → Source: main / root')
    print('  4. 访问 https://<用户名>.github.io/<仓库名>/')
    print()
    print('  或使用 GitHub Actions 自动部署（见 .github/workflows/deploy-pages.yml）')


if __name__ == '__main__':
    main()
