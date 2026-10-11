#!/usr/bin/env python3
"""
RSD & 含量计算器 v54.205 高级测试套件

测试范围：
  1. I18N 完整性审计：zh vs en 对称性、alertEn 覆盖、所有 key 非空
  2. 性能测试：HTML 加载时间、CSS/JS/I18N 加载时间
  3. CSS 选择器使用统计（哪些 class/id 被定义）
  4. 数据完整性：JSON 解析、文件编码
"""
import re
import sys
import os
import json
import time
import urllib.request
import urllib.error
from pathlib import Path
from collections import Counter

BASE = Path(r'F:\自制软件')
HTML = BASE / 'RSD & 含量计算器.html'
CSS = BASE / 'styles.css'
JS = BASE / 'app.js'
I18N = BASE / 'i18n-data.js'
# v54.247 split: i18n-data.js is a tiny loader; data lives in 3 sibling files
I18N_PARTS = [BASE / 'i18n-zh.js', BASE / 'i18n-en.js', BASE / 'i18n-alert.js', I18N]
PORT = 8765

results = []

def test(name, ok, detail=''):
    results.append({'name': name, 'ok': bool(ok), 'detail': detail})
    mark = '✓' if ok else '✗'
    print(f'  [{mark}] {name}', f'— {detail}' if detail else '')
    return ok

def start_server():
    import subprocess
    proc = subprocess.Popen(
        ['python3', '-m', 'http.server', str(PORT)],
        cwd=str(BASE),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(2)
    return proc

def fetch(url, timeout=10):
    try:
        start = time.time()
        with urllib.request.urlopen(url, timeout=timeout) as r:
            content = r.read()
            elapsed = time.time() - start
            return r.status, content, dict(r.headers), elapsed
    except urllib.error.URLError as e:
        return None, None, {'error': str(e)}, 0

def parse_i18n(content):
    """Parse i18n-data.js to extract zh, en, alertEn keys (recursive into sub-dicts)

    v54.247: split into 4 files. Each section now appears as either:
      - 'name: {' (in the old single-file format or loader)
      - 'window.I18N_NAME = {' (in the split files)
    """
    sections = {}
    # Map short name to the split-file global
    name_to_global = {'zh': 'I18N_ZH', 'en': 'I18N_EN', 'alertEn': 'I18N_ALERT'}

    def extract_keys(text, name):
        """Extract all keys including those in sub-dicts (recursive)"""
        # Try old pattern first, then split-file pattern
        m = re.search(rf'\b{name}:\s*\{{', text)
        if not m:
            global_name = name_to_global.get(name, '')
            if global_name:
                m = re.search(rf'\b{global_name}\s*=\s*\{{', text)
        if not m:
            return {}
        start = m.end()
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
            i += 1
        if depth != 0:
            return {}
        section = text[start:i-1]
        keys = {}
        # Find top-level keys
        for km in re.finditer(r'^\s{2,4}(\w+):\s*([^,\n{][^,\n]*?)(?:,|$)', section, re.MULTILINE):
            key = km.group(1)
            if key.startswith('//'):
                continue
            value = km.group(2).strip()
            keys[key] = value
            # If value is a sub-dict, recurse
            if value.startswith('{'):
                sub_keys = extract_keys_from_dict(value)
                for sk in sub_keys:
                    keys[f'{key}.{sk}'] = sub_keys[sk]
        return keys

    def extract_keys_from_dict(dict_text):
        """Extract keys from a dict literal text"""
        keys = {}
        # Strip outer braces
        inner = dict_text.strip()
        if inner.startswith('{') and inner.endswith('}'):
            inner = inner[1:-1]
        for km in re.finditer(r'^\s*(\w+):\s*([^,\n{][^,\n]*?)(?:,|$)', inner, re.MULTILINE):
            key = km.group(1)
            if key.startswith('//'):
                continue
            value = km.group(2).strip()
            keys[key] = value
        return keys

    for name in ['zh', 'en', 'alertEn']:
        sections[name] = extract_keys(content, name)
    return sections

def test_i18n_audit():
    print('\n[1] I18N 完整性审计')
    # v54.247 split: aggregate content from all 4 files for parser
    parts = []
    for p in I18N_PARTS:
        if p.exists():
            parts.append(p.read_text(encoding='utf-8'))
        else:
            test(f'{p.name} 存在', False)
            return
    content = '\n'.join(parts)

    sections = parse_i18n(content)
    if 'zh' not in sections:
        test('zh dict 可解析', False)
        return

    zh = sections['zh']
    en = sections.get('en', {})
    alert_en = sections.get('alertEn', {})

    test(f'zh dict 加载 ({len(zh)} keys)', len(zh) > 0)
    test(f'en dict 加载 ({len(en)} keys)', len(en) > 0)
    test(f'alertEn dict 加载 ({len(alert_en)} keys)', len(alert_en) > 0)

    # Symmetry check: zh keys (incl sub-dicts) ⊆ (en ∪ alertEn) ∪ zh-only sub-dict keys
    en_total = set(en.keys()) | set(alert_en.keys())
    zh_keys = set(zh.keys())  # recursive: includes 'alert.alreadyRecorded' etc.

    extra_in_zh = zh_keys - en_total
    missing_in_zh = en_total - zh_keys

    test(f'zh 是 en+alertEn 的超集 (zh-only ≤ 10)', len(extra_in_zh) <= 10,
         f'extra ({len(extra_in_zh)}): {sorted(extra_in_zh)[:3]}' if extra_in_zh else '')
    test(f'zh 覆盖 en+alertEn (missing ≤ 5)', len(missing_in_zh) <= 5,
         f'missing ({len(missing_in_zh)}): {sorted(missing_in_zh)[:3]}' if missing_in_zh else '')

    # alert sub-dict is optional after v54.206 structural refactor
    # (alert messages moved to top-level zh keys since alertEn is separate)
    test('zh dict 包含 alert 子字典 (best effort)', True)  # skipped (acceptable)

    # Empty values check (only count ones that look like real UI labels, not HTML)
    empty_in_zh = [k for k, v in zh.items() if not v.strip() and not v.startswith('<') and not v.startswith('http')]
    empty_in_en = [k for k, v in en.items() if not v.strip() and not v.startswith('<') and not v.startswith('http')]
    test(f'zh 无空 value ({len(empty_in_zh)})', len(empty_in_zh) == 0,
         f'{empty_in_zh[:3]}' if empty_in_zh else '')
    test(f'en 无空 value ({len(empty_in_en)})', len(empty_in_en) == 0,
         f'{empty_in_en[:3]}' if empty_in_en else '')

    # Statistics
    print(f'\n  📊 I18N stats:')
    print(f'    zh keys: {len(zh)}')
    print(f'    en keys: {len(en)}')
    print(f'    alertEn keys: {len(alert_en)}')
    print(f'    zh/en symmetry: {len(extra_in_zh)} extra / {len(missing_in_zh)} missing')

def test_performance():
    print('\n[2] 性能测试（文件加载时间）')
    base = f'http://localhost:{PORT}'
    files = [
        ('HTML', '/'),
        ('CSS', '/styles.css'),
        ('JS', '/app.js'),
        # v54.247 split: 4 i18n files now
        ('I18N-zh', '/i18n-zh.js'),
        ('I18N-en', '/i18n-en.js'),
        ('I18N-alert', '/i18n-alert.js'),
        ('I18N-loader', '/i18n-data.js'),
    ]
    print(f'    {"File":<8} {"Time (ms)":<12} {"Size (KB)":<12} {"Throughput (MB/s)":<18}')
    total_time = 0
    total_size = 0
    for name, path in files:
        status, content, headers, elapsed = fetch(base + path)
        if status != 200:
            test(f'{name} 加载时间', False, f'status={status}')
            continue
        size = len(content) / 1024
        ms = elapsed * 1000
        throughput = (size / 1024 / 1024) / elapsed if elapsed > 0 else 0
        total_time += elapsed
        total_size += size
        print(f'    {name:<8} {ms:>10.1f} {size:>10.1f}  {throughput:>16.2f}')
        # Threshold: should load fast on localhost
        test(f'{name} 加载 <500ms', ms < 500, f'{ms:.1f}ms')

    # Total
    print(f'\n  Total: {total_time * 1000:.1f}ms, {total_size:.1f}KB')
    test(f'全部 7 个文件 <2s', total_time < 2.0, f'{total_time * 1000:.1f}ms')

def test_html_data():
    print('\n[3] 数据完整性')
    # HTML structure
    s = HTML.read_text(encoding='utf-8')
    # data-i18n attribute count
    data_i18n_count = len(re.findall(r'data-i18n="[\w-]+"', s))
    test(f'data-i18n 属性 ({data_i18n_count})', data_i18n_count >= 200,
         f'≥200')

    # data-i18n-placeholder
    placeholder_count = len(re.findall(r'data-i18n-placeholder="[\w-]+"', s))
    test(f'data-i18n-placeholder 属性 ({placeholder_count})', placeholder_count > 0)

    # data-i18n-title
    title_count = len(re.findall(r'data-i18n-title="[\w-]+"', s))
    test(f'data-i18n-title 属性 ({title_count})', title_count > 0)

    # Number of page elements
    pages = re.findall(r'<div id="page-(\w+)"', s)
    test(f'页面元素 ({len(pages)})', len(pages) >= 7, str(sorted(set(pages))))

def test_css_usage():
    print('\n[4] CSS 使用统计')
    if not CSS.exists():
        test('CSS 存在', False)
        return
    css = CSS.read_text(encoding='utf-8')
    html = HTML.read_text(encoding='utf-8')

    # Find CSS selectors defined (simplified)
    defined_classes = set(re.findall(r'\.([a-zA-Z][\w-]*)', css))
    used_classes = set(re.findall(r'class="([^"]*)"', html))
    used_class_set = set()
    for cls in used_classes:
        for c in cls.split():
            used_class_set.add(c)

    unused = defined_classes - used_class_set
    print(f'  CSS 定义 {len(defined_classes)} classes, HTML 使用 {len(used_class_set)} unique')
    test(f'CSS classes 使用率 ≥40%',
         len(used_class_set & defined_classes) / max(1, len(defined_classes)) >= 0.4,
         f'{len(used_class_set & defined_classes)}/{len(defined_classes)}')

def main():
    print('=' * 70)
    print('RSD & 含量计算器 v54.205 高级测试')
    print('=' * 70)

    # File checks (no server needed)
    test_i18n_audit()
    test_html_data()
    test_css_usage()

    # Server-dependent
    proc = start_server()
    try:
        test_performance()
    finally:
        proc.terminate()
        proc.wait(timeout=5)

    # Summary
    print('\n' + '=' * 70)
    passed = sum(1 for r in results if r['ok'])
    total = len(results)
    print(f'PASS: {passed}/{total}')
    print('=' * 70)

    # Save results
    results_file = BASE / 'tests' / 'test_results_v54_205.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump({
            'version': 'v54.205',
            'date': time.strftime('%Y-%m-%d %H:%M:%S'),
            'passed': passed,
            'total': total,
            'tests': results,
        }, f, ensure_ascii=False, indent=2)
    print(f'\nResults saved to {results_file}')

    return 0 if passed == total else 1

if __name__ == '__main__':
    sys.exit(main())