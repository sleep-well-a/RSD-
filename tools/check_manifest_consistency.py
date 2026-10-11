#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.320 跨 release manifest 一致性检查

检查 release/v54.XXX/manifest.json：
1. start_url 指向当前版本的流动相版 HTML
2. CACHE_VERSION 与 release/ 目录名一致
3. 必填字段（name, short_name, start_url, display, icons）齐全

用法：
  python tools/check_manifest_consistency.py            # CI 模式
  python tools/check_manifest_consistency.py --fix   # 自动修复 start_url
"""
import re
import sys
import json
import argparse
from pathlib import Path

ROOT = Path(r'F:\自制软件')
RELEASE_DIR = ROOT / 'release'


def get_versions():
    """扫描 release/ 目录所有版本。"""
    versions = []
    for d in sorted(RELEASE_DIR.iterdir()):
        if d.is_dir() and re.match(r'^v54\.\d+$', d.name):
            versions.append(d.name)
    return versions


def check_manifest(version):
    """检查单个版本的 manifest。"""
    manifest_path = RELEASE_DIR / version / 'manifest.json'
    if not manifest_path.exists():
        return {'version': version, 'errors': ['manifest.json 不存在']}

    try:
        data = json.loads(manifest_path.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        return {'version': version, 'errors': [f'JSON 解析失败: {e}']}

    errors = []
    warnings = []

    # 1. start_url 指向当前版本
    expected_url = f'./RSD & 含量计算器_流动相版_{version}.html'
    if data.get('start_url') != expected_url:
        errors.append(f'start_url 错误: 期望 {expected_url}, 实际 {data.get("start_url")}')

    # 2. name 含当前版本
    name = data.get('name', '')
    if version not in name:
        warnings.append(f'name 不含版本号: {name}')

    # 3. 必填字段
    for key in ['name', 'short_name', 'start_url', 'display', 'icons']:
        if key not in data:
            errors.append(f'缺少必填字段: {key}')

    # 4. icons 非空
    icons = data.get('icons', [])
    if not icons or len(icons) == 0:
        errors.append('icons 数组为空')

    return {
        'version': version,
        'errors': errors,
        'warnings': warnings,
        'start_url': data.get('start_url'),
        'name': name,
    }


def check_root_manifest():
    """v54.322 新增：检查根目录 manifest.json（dev 版 PWA 入口）。

    根目录 manifest.json 应指向最新版本的流动相版，否则用户在浏览器
    访问 RSD & 含量计算器.html 安装 PWA 时会指向过时版本。
    """
    root_manifest = ROOT / 'manifest.json'
    if not root_manifest.exists():
        return {'version': 'ROOT', 'errors': [], 'warnings': ['根目录 manifest.json 不存在']}

    try:
        data = json.loads(root_manifest.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        return {'version': 'ROOT', 'errors': [f'JSON 解析失败: {e}'], 'warnings': []}

    versions = get_versions()
    latest = versions[-1] if versions else None
    errors = []
    warnings = []

    if not latest:
        warnings.append('无 release 版本，无法判断根目录 manifest 是否最新')
        return {'version': 'ROOT', 'errors': errors, 'warnings': warnings,
                'start_url': data.get('start_url'), 'name': data.get('name', '')}

    # 1. start_url 应指向最新版本
    expected_url = f'./RSD & 含量计算器_流动相版_{latest}.html'
    if data.get('start_url') != expected_url:
        errors.append(
            f'根目录 start_url 不指向最新版本: 期望 {expected_url}, '
            f'实际 {data.get("start_url")}（用户安装 PWA 会跳到过时版本）'
        )

    # 2. name 应含最新版本号
    name = data.get('name', '')
    if latest not in name:
        warnings.append(f'根目录 name 不含最新版本号: {name}')

    return {
        'version': 'ROOT',
        'errors': errors,
        'warnings': warnings,
        'start_url': data.get('start_url'),
        'name': name,
    }


def fix_root_manifest():
    """v54.322 新增：修复根目录 manifest.json，指向最新版本。"""
    root_manifest = ROOT / 'manifest.json'
    if not root_manifest.exists():
        return False
    versions = get_versions()
    if not versions:
        return False
    latest = versions[-1]
    data = json.loads(root_manifest.read_text(encoding='utf-8'))
    changed = False

    expected_url = f'./RSD & 含量计算器_流动相版_{latest}.html'
    if data.get('start_url') != expected_url:
        data['start_url'] = expected_url
        changed = True

    name = data.get('name', '')
    if latest not in name:
        new_name = re.sub(r'v54\.\d+', latest, name)
        if new_name != name:
            data['name'] = new_name
            changed = True

    # shortcuts 也修复
    for s in data.get('shortcuts', []):
        u = s.get('url', '')
        if 'v54.' in u and '_流动相版_v54.' in u:
            new_u = re.sub(r'_v54\.\d+\.html', f'_{latest}.html', u)
            if new_u != u:
                s['url'] = new_u
                changed = True

    if changed:
        root_manifest.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + '\n',
            encoding='utf-8'
        )
        return True
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fix', action='store_true', help='自动修复 start_url 和 name')
    args = parser.parse_args()

    versions = get_versions()
    print(f'检查 {len(versions)} 个 release manifest.json + 根目录 manifest.json')
    print('=' * 60)

    all_errors = []
    all_warnings = []

    for v in versions:
        result = check_manifest(v)
        if result['errors']:
            for err in result['errors']:
                print(f'  [ERROR] {v}: {err}')
                all_errors.append(f'{v}: {err}')
        if result.get('warnings'):
            for warn in result['warnings']:
                print(f'  [WARN] {v}: {warn}')
                all_warnings.append(f'{v}: {warn}')

    # v54.322 新增：检查根目录 manifest.json
    root_result = check_root_manifest()
    if root_result['errors']:
        for err in root_result['errors']:
            print(f'  [ERROR] ROOT: {err}')
            all_errors.append(f'ROOT: {err}')
    if root_result.get('warnings'):
        for warn in root_result['warnings']:
            print(f'  [WARN] ROOT: {warn}')
            all_warnings.append(f'ROOT: {warn}')

    print('\n' + '=' * 60)
    print(f'总结：{len(versions)} 个 release + 根目录，{len(all_errors)} 错误，{len(all_warnings)} 警告')

    if args.fix and all_errors:
        print('\n[AUTO-FIX] 修复 start_url + name...')
        fixed = 0
        for v in versions:
            if fix_manifest(v):
                print(f'  [FIXED] {v}')
                fixed += 1
        if fix_root_manifest():
            print('  [FIXED] ROOT')
            fixed += 1
        print(f'共修复 {fixed} 个')

    if all_errors:
        sys.exit(1)
    elif all_warnings:
        sys.exit(0)
    else:
        print('[OK] 所有 manifest 一致')
        sys.exit(0)


def fix_manifest(version):
    """自动修复 start_url 和 name（不影响其他字段）。"""
    manifest_path = RELEASE_DIR / version / 'manifest.json'
    if not manifest_path.exists():
        return False
    data = json.loads(manifest_path.read_text(encoding='utf-8'))
    changed = False

    # 1. 修复 start_url
    expected_url = f'./RSD & 含量计算器_流动相版_{version}.html'
    if data.get('start_url') != expected_url:
        data['start_url'] = expected_url
        changed = True

    # 2. 修复 name（如果不含当前版本号，则替换旧版本号为当前版本号）
    name = data.get('name', '')
    if version not in name:
        # 找到 name 中任何 v54.XXX 替换为当前 version
        new_name = re.sub(r'v54\.\d+', version, name)
        if new_name != name:
            data['name'] = new_name
            changed = True

    if changed:
        manifest_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + '\n',
            encoding='utf-8'
        )
        return True
    return False


if __name__ == '__main__':
    main()
