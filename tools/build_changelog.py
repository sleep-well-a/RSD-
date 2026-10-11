#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.315 CHANGELOG 自动生成工具

聚合 release/v54.XXX/RELEASE_NOTES.md 为一份主 CHANGELOG.md。
支持：
- 按版本倒序
- 提取每版的关键信息（功能、修复、统计）
- 保持原 RELEASE_NOTES.md 不变（作为详细 changelog）

用法：
  python tools/build_changelog.py            # 输出到 stdout
  python tools/build_changelog.py --write    # 写入 CHANGELOG.md
  python tools/build_changelog.py --since v54.310  # 仅 v54.310+
"""
import re
import sys
import argparse
from pathlib import Path

ROOT = Path(r'F:\自制软件')
RELEASE_DIR = ROOT / 'release'
CHANGELOG_PATH = ROOT / 'CHANGELOG.md'


def get_versions():
    """扫描 release/ 目录，按版本号倒序返回。"""
    versions = []
    for d in RELEASE_DIR.iterdir():
        if d.is_dir() and re.match(r'^v54\.\d+$', d.name):
            m = re.match(r'^v54\.(\d+)$', d.name)
            if m:
                versions.append((int(m.group(1)), d.name))
    versions.sort(reverse=True)
    return [v[1] for v in versions]


def parse_release_notes(notes_path):
    """从 RELEASE_NOTES.md 提取关键信息。"""
    if not notes_path.exists():
        return None
    text = notes_path.read_text(encoding='utf-8')

    info = {
        'date': None,
        'prev': None,
        'theme': None,
        'puppeteer': None,
        'static': None,
    }

    # 日期
    m = re.search(r'\*\*发布日期\*\*[：:]\s*(\S+)', text)
    if m: info['date'] = m.group(1)

    # 前版本
    m = re.search(r'\*\*前版本\*\*[：:]\s*(\S+)', text)
    if m: info['prev'] = m.group(1)

    # 主题（第一个 ## 标题）
    m = re.search(r'##\s+(.+?)\n', text)
    if m: info['theme'] = m.group(1).strip()

    # Puppeteer 测试
    m = re.search(r'\*\*Puppeteer 总计\*\*[：:]\s*(\d+ 套件[^\n]+)', text)
    if m: info['puppeteer'] = m.group(1).strip()

    # 静态扫描
    if re.search(r'0 findings|0 violations|0/1138', text):
        info['static'] = 'clean'

    return info


def build_changelog(since=None):
    """构建 CHANGELOG 内容。"""
    versions = get_versions()
    if since:
        # 过滤 since 之后的版本
        since_num = int(since.replace('v54.', ''))
        versions = [v for v in versions if int(v.replace('v54.', '')) >= since_num]

    out = []
    out.append('# RSD & 含量计算器 — 更新日志\n')
    out.append(f'自动生成自 `release/*/RELEASE_NOTES.md`（{len(versions)} 个版本）。\n')
    out.append('**最新版本**\n')

    if versions:
        latest = versions[0]
        out.append(f'## {latest}（最新）\n')
        latest_notes = RELEASE_DIR / latest / 'RELEASE_NOTES.md'
        info = parse_release_notes(latest_notes)
        if info:
            if info['date']: out.append(f'- **发布日期**：{info["date"]}')
            if info['prev']: out.append(f'- **前版本**：{info["prev"]}')
            if info['theme']: out.append(f'- **主题**：{info["theme"]}')
            if info['puppeteer']: out.append(f'- **Puppeteer**：{info["puppeteer"]}')
            if info['static']: out.append(f'- **静态扫描**：clean')
        out.append('')
        out.append(f'详细：[release/{latest}/RELEASE_NOTES.md](release/{latest}/RELEASE_NOTES.md)\n')

    out.append('\n---\n\n')
    out.append('# 历史版本\n')

    for v in versions:
        out.append(f'\n## {v}\n')
        notes = RELEASE_DIR / v / 'RELEASE_NOTES.md'
        info = parse_release_notes(notes)
        if info:
            if info['date']: out.append(f'- **日期**：{info["date"]}')
            if info['theme']: out.append(f'- **主题**：{info["theme"]}')
            if info['puppeteer']: out.append(f'- **Puppeteer**：{info["puppeteer"]}')
            if info['static']: out.append(f'- **静态扫描**：clean')
        out.append(f'- 详细：[release/{v}/RELEASE_NOTES.md](release/{v}/RELEASE_NOTES.md)\n')

    return ''.join(out)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true', help='写入 CHANGELOG.md')
    parser.add_argument('--since', help='仅显示 >= 此版本（如 v54.310）')
    args = parser.parse_args()

    content = build_changelog(args.since)
    if args.write:
        CHANGELOG_PATH.write_text(content, encoding='utf-8')
        print(f'Wrote {CHANGELOG_PATH}')
    else:
        # 强制 utf-8 输出到 stdout（避免 Windows gbk 编码问题）
        import sys as _sys
        _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        print(content)


if __name__ == '__main__':
    main()
