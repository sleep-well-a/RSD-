#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.316 milestone memory 自动生成

从 release/{version}/RELEASE_NOTES.md 提取关键信息，
生成 ~/.claude/.../memory/rsd-milestone-v54-XXX-slug.md 格式 memory 文件。

用法：
  python tools/extract_milestone.py v54.316          # 单个版本
  python tools/extract_milestone.py v54.316 --dry-run # 只输出不写文件
  python tools/extract_milestone.py --all            # 扫描所有 release/*
"""
import re
import sys
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path(r'F:\自制软件')
RELEASE_DIR = ROOT / 'release'
MEMORY_DIR = Path(r'C:\Users\sleep well\.claude\projects\C--Users-sleep-well\memory')


def parse_release_notes(notes_path):
    """从 RELEASE_NOTES.md 解析关键信息。"""
    if not notes_path.exists():
        return None
    text = notes_path.read_text(encoding='utf-8')

    info = {
        'date': None,
        'prev': None,
        'theme': None,
        'theme_raw': None,
        'changes': [],
        'puppeteer': None,
        'static': 'unknown',
    }

    # 日期
    m = re.search(r'\*\*发布日期\*\*[：:]\s*(\S+)', text)
    if m: info['date'] = m.group(1)

    # 前版本
    m = re.search(r'\*\*前版本\*\*[：:]\s*(\S+)', text)
    if m: info['prev'] = m.group(1)

    # 主题（第一个 ## 标题）
    m = re.search(r'^##\s+(.+?)$', text, re.MULTILINE)
    if m:
        info['theme_raw'] = m.group(1).strip()
        info['theme'] = info['theme_raw']

    # Puppeteer
    m = re.search(r'\*\*Puppeteer 总计\*\*[：:]\s*([^\n]+)', text)
    if m: info['puppeteer'] = m.group(1).strip()

    # 静态扫描
    if re.search(r'0 findings|0 violations', text):
        info['static'] = 'clean'

    # 关键改动（提取 ### 改动 / ## 改动 后的子节）
    in_changes = False
    current_section = None
    for line in text.split('\n'):
        if re.match(r'^#{2,3}\s+改动', line):
            in_changes = True
            continue
        if re.match(r'^##\s+', line) and in_changes and not re.match(r'^#{2,3}\s+改动', line):
            # 下一个一级标题（不是 ### 改动）= 结束
            break
        if in_changes:
            if re.match(r'^###\s+', line):
                current_section = line[4:].strip()
            elif line.startswith('- ') and current_section:
                item = line[2:].strip()
                if item and not item.startswith('*'):
                    info['changes'].append((current_section, item))
            elif line.startswith('  - '):
                item = line[4:].strip()
                if item:
                    info['changes'].append((current_section, item))

    return info


def make_slug(theme, version):
    """从主题生成英文 slug。"""
    # 优先用关键词
    if not theme:
        return version.replace('.', '-')

    s = theme.lower()
    # 移除 emoji
    s = re.sub(r'[\U0001F300-\U0001F9FF\U0001F600-\U0001F64F\U0001F680-\U0001F6FF\u2600-\u26FF\u2700-\u27BF]', '', s)

    # 关键词映射
    keyword_map = {
        'alerten': 'alerten',
        'alert en': 'alerten',
        'dark mode': 'dark-mode',
        '批量导出': 'batch-export',
        '批量导入': 'batch-import',
        '批量': 'batch',
        'i18n': 'i18n',
        '测试': 'test',
        'chart': 'chart',
        '性能': 'perf',
        'a11y': 'a11y',
        'focus': 'focus',
        'service': 'sw',
        'sw': 'sw',
        'tool': 'tool',
        '工具': 'tool',
        '移动端': 'mobile',
        'release': 'release',
        'changelog': 'changelog',
        '一键发布': 'release-automation',
        'pwa': 'pwa',
        'memory': 'memory',
    }
    for k, v in keyword_map.items():
        if k in s:
            return f'{v}'

    # 否则取前几个英文/数字词
    words = re.findall(r'[a-z0-9]+', s)
    if words:
        return '-'.join(words[:3])
    # 否则用版本号
    return version.replace('.', '-')


def build_milestone_content(version, info):
    """生成 milestone memory 文件内容。"""
    slug = make_slug(info['theme_raw'], version)
    today = datetime.now().isoformat(timespec='seconds')

    content = f'''---
name: rsd-milestone-{version.replace(".", "-")}-{slug}
description: {info["theme_raw"] or "发布"}
metadata:
  node_type: memory
  type: project
  modified: {today}
  originSessionId: auto-extracted
---

{version}（{info["date"] or "未知日期"}）已发布。

## 核心改动

'''
    # 关键改动
    if info['changes']:
        # 按 section 分组
        sections = {}
        for sec, item in info['changes']:
            sections.setdefault(sec, []).append(item)
        for sec, items in sections.items():
            content += f'### {sec}\n\n'
            for item in items[:8]:  # 最多 8 项
                content += f'- {item}\n'
            if len(items) > 8:
                content += f'- ...（共 {len(items)} 项，详见 RELEASE_NOTES）\n'
            content += '\n'
    else:
        content += f'### {info["theme_raw"]}\n\n详见 [release/{version}/RELEASE_NOTES.md](release/{version}/RELEASE_NOTES.md)\n\n'

    content += f'''## 测试结果

- **Puppeteer**：{info["puppeteer"] or "未记录"}
- **静态扫描**：{info["static"]}

## 完整发布链

`F:\\自制软件\\release\\`：
```
v54.285 → ... → {info["prev"] or "v54.XXX"} → {version}
```

## 剩余候选任务

详见 [TODO_PLAN.md](../../TODO_PLAN.md)
'''
    return content, slug


def extract_one(version, dry_run=False):
    """提取单个版本到 memory。"""
    notes_path = RELEASE_DIR / version / 'RELEASE_NOTES.md'
    info = parse_release_notes(notes_path)
    if not info:
        print(f'  ERROR: 找不到 {notes_path}', file=sys.stderr)
        return None

    content, slug = build_milestone_content(version, info)
    filename = f'rsd-milestone-{version.replace(".", "-")}-{slug}.md'
    out_path = MEMORY_DIR / filename

    if dry_run:
        print(f'[DRY-RUN] {filename}')
        print('---')
        # 强制 utf-8 输出
        import sys as _sys
        _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        print(content[:500] + '...')
        return out_path

    out_path.write_text(content, encoding='utf-8')
    print(f'  [OK] {filename}')
    return out_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('version', nargs='?', help='版本号（v54.XXX）')
    parser.add_argument('--all', action='store_true', help='扫描所有 release/*')
    parser.add_argument('--dry-run', action='store_true', help='只输出不写文件')
    args = parser.parse_args()

    MEMORY_DIR.mkdir(parents=True, exist_ok=True)

    if args.all:
        versions = sorted([d.name for d in RELEASE_DIR.iterdir()
                          if d.is_dir() and re.match(r'^v54\.\d+$', d.name)],
                         reverse=True)
        print(f'处理 {len(versions)} 个版本...')
        for v in versions:
            extract_one(v, args.dry_run)
    elif args.version:
        if not re.match(r'^v54\.\d+$', args.version):
            print(f'ERROR: 版本格式错误: {args.version}')
            sys.exit(1)
        extract_one(args.version, args.dry_run)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
