#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.311 SW 自动同步工具

扫描 release/ 目录，找到最新版本，自动更新 service-worker.js 的：
1. 顶部注释 v54.XX
2. CACHE_VERSION 字符串
3. PRECACHE_URLS 中流动相版 HTML 文件名
4. fallback URL 注释

用法：
  python tools/sync_sw_version.py            # 自动检测 release/v54.31X 目录
  python tools/sync_sw_version.py v54.312    # 指定版本
"""
import re
import sys
import os
from pathlib import Path

ROOT = Path(r'F:\自制软件')
SW_PATH = ROOT / 'service-worker.js'
RELEASE_DIR = ROOT / 'release'


def find_latest_version():
    """扫描 release/ 找最新 v54.XX 版本。"""
    versions = []
    for d in RELEASE_DIR.iterdir():
        if d.is_dir() and re.match(r'^v54\.\d+$', d.name):
            # 提取数字
            m = re.match(r'^v54\.(\d+)$', d.name)
            if m:
                versions.append((int(m.group(1)), d.name))
    if not versions:
        return None
    versions.sort(reverse=True)
    return versions[0][1]


def sync_sw(target_version):
    """更新 service-worker.js 到目标版本。"""
    sw_text = SW_PATH.read_text(encoding='utf-8')

    # 1. 顶部注释
    sw_text = re.sub(
        r'// v54\.\d+ PWA 离线支持（每次发布 v54\.30x 都更新.*?\n',
        f'// {target_version} PWA 离线支持（每次发布 v54.30x 都更新：CACHE_VERSION + PRECACHE_URLS + fallback URL）\n',
        sw_text,
    )

    # 2. CACHE_VERSION
    sw_text = re.sub(
        r"const CACHE_VERSION = 'v54\.\d+-\d+';",
        f"const CACHE_VERSION = '{target_version}-1';",
        sw_text,
    )

    # 3. PRECACHE_URLS 流动相版 HTML
    sw_text = re.sub(
        r"\./RSD & 含量计算器_流动相版_v54\.\d+\.html",
        f"./RSD & 含量计算器_流动相版_{target_version}.html",
        sw_text,
    )

    # 4. fallback URL（在 catch 块内）
    # 匹配 `html'` + 2 `)`，替换为 `html'` + 2 `)`，保留第 3 个 `)`（避免累积）
    sw_text = re.sub(
        r"\./RSD & 含量计算器_流动相版_v54\.\d+\.html'\)\)",
        f"./RSD & 含量计算器_流动相版_{target_version}.html'))",
        sw_text,
    )

    SW_PATH.write_text(sw_text, encoding='utf-8')

    # 复制到 release/{target_version}/service-worker.js
    target_dir = RELEASE_DIR / target_version
    if target_dir.exists():
        target_sw = target_dir / 'service-worker.js'
        target_sw.write_text(sw_text, encoding='utf-8')
        print(f'  已同步到: {target_sw}')

    return sw_text


def main():
    # 参数或自动检测
    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        target = find_latest_version()
        if not target:
            print('ERROR: 未找到任何 release/v54.XX 目录')
            sys.exit(1)
        print(f'[AUTO] 检测到最新版本: {target}')

    # 验证版本格式
    if not re.match(r'^v54\.\d+$', target):
        print(f'ERROR: 版本格式错误: {target}（应为 v54.310）')
        sys.exit(1)

    # 验证 release 目录存在
    target_dir = RELEASE_DIR / target
    if not target_dir.exists():
        print(f'ERROR: release/{target}/ 不存在')
        sys.exit(1)

    # 验证 release 目录中流动相版文件存在
    mobile_html = target_dir / f'RSD & 含量计算器_流动相版_{target}.html'
    if not mobile_html.exists():
        print(f'ERROR: 流动相版文件不存在: {mobile_html}')
        sys.exit(1)

    print(f'同步 service-worker.js → {target}')

    # 读取当前 SW 状态
    current = SW_PATH.read_text(encoding='utf-8')
    current_version = re.search(r"const CACHE_VERSION = 'v54\.(\d+)", current)
    if current_version:
        current_ver_str = 'v54.' + current_version.group(1)
        if current_ver_str == target:
            print(f'  当前已是 {target}，无需更新')
            return

    sync_sw(target)

    # 验证
    new_text = SW_PATH.read_text(encoding='utf-8')
    if f"CACHE_VERSION = '{target}-1'" in new_text:
        print(f'  [OK] CACHE_VERSION = {target}-1')
    if f"./RSD & 含量计算器_流动相版_{target}.html" in new_text:
        print(f'  [OK] PRECACHE_URLS + fallback URL = {target}')

    # 验证 release 目录也被同步
    target_sw = target_dir / 'service-worker.js'
    if target_sw.exists():
        if f"CACHE_VERSION = '{target}-1'" in target_sw.read_text(encoding='utf-8'):
            print(f'  [OK] release/{target}/service-worker.js also synced')

    print(f'\n[OK] service-worker.js 已同步到 {target}')


if __name__ == '__main__':
    main()
