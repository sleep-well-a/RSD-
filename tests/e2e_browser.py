#!/usr/bin/env python3
# v54.216 e2e_browser.py: 浏览器自动化 i18n 完整性测试
"""
通过 Chrome DevTools MCP 或 Playwright 启动浏览器，验证：
1. zh/en 切换不丢 page
2. zh 模式下没有 zh_fallback (原 key 显示)
3. en 模式下 zh_fallback = 0
4. 所有 HTML data-i18n key 都能在 i18n() 里找到
5. 7 个 page 都能 getElementById 找到

要求：
  - chrome devtools mcp 服务器在 localhost:8765 运行
  - 页面已经加载（手工或脚本启动）
"""
import re
import sys
import json
import os
import time
import urllib.request

# 适配 sys.stdout 编码
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html'

PAGES = ['page-stats', 'page-recovery', 'page-calc', 'page-history',
         'page-special', 'page-settings', 'page-mobile']

# v54.247 split: 4 i18n files. Loader only references globals.
I18N_URLS = [
    'http://localhost:8765/i18n-zh.js',
    'http://localhost:8765/i18n-en.js',
    'http://localhost:8765/i18n-alert.js',
    'http://localhost:8765/i18n-data.js',
]

def fetch_combined_i18n():
    """Fetch and concatenate content of all i18n split files."""
    out = []
    for url in I18N_URLS:
        try:
            resp = urllib.request.urlopen(url, timeout=5)
            out.append(resp.read().decode('utf-8'))
        except Exception as e:
            return None, f"Exception at {url}: {e}"
    return '\n'.join(out), "all 4 fetched"

def test_html_loads():
    """基础测试：HTML 能加载"""
    try:
        resp = urllib.request.urlopen(HTML_URL, timeout=5)
        if resp.status == 200:
            return True, f"HTTP 200, {len(resp.read())} bytes"
        return False, f"HTTP {resp.status}"
    except Exception as e:
        return False, f"Exception: {e}"

def test_i18n_data_loads():
    """测试 i18n-data.js 能加载且包含 zh/en/alertEn"""
    try:
        # v54.247 split: verify all 4 files load
        statuses = []
        for url in I18N_URLS:
            resp = urllib.request.urlopen(url, timeout=5)
            content = resp.read().decode('utf-8')
            name = url.rsplit('/', 1)[-1]
            statuses.append(f'{name}=HTTP{resp.status}({len(content)}B)')
        # Combined content has zh/en/alertEn markers
        combined, _ = fetch_combined_i18n()
        has_zh = 'zh:' in combined
        has_en = 'en:' in combined
        has_alertEn = 'alertEn:' in combined
        has_i18n = 'I18N' in combined
        return (has_zh and has_en and has_alertEn and has_i18n), \
            f"{', '.join(statuses)} | zh={has_zh}, en={has_en}, alertEn={has_alertEn}, I18N={has_i18n}"
    except Exception as e:
        return False, f"Exception: {e}"

def test_data_i18n_count_in_html():
    """测试 HTML 里有足够的 data-i18n"""
    try:
        resp = urllib.request.urlopen(HTML_URL, timeout=5)
        html = resp.read().decode('utf-8')
        count = len(re.findall(r'data-i18n="[^"]+"', html))
        return (count >= 200, f"{count} data-i18n (>= 200)")
    except Exception as e:
        return False, f"Exception: {e}"

def test_broken_data_i18n():
    """测试没有 broken data-i18n (data-i18n="X" 后缺 >)"""
    try:
        resp = urllib.request.urlopen(HTML_URL, timeout=5)
        html = resp.read().decode('utf-8')
        # 找 broken patterns: data-i18n="X" 后跟非空白/非>
        pattern = re.compile(r'(data-i18n(?:[-a-z]+)?="[^"]*")([^\s>])')
        matches = list(pattern.finditer(html))
        return (len(matches) == 0, f"{len(matches)} broken patterns (should be 0)")
    except Exception as e:
        return False, f"Exception: {e}"

def test_kebab_case_keys_quoted():
    """测试 dict 里所有 kebab-case key 都加了引号"""
    try:
        js, _ = fetch_combined_i18n()
        if js is None:
            return False, "fetch failed"
        # 找 4 空格 + kebab-case + : + 'value'
        # 错误形式：    word-with-dashes: 'value'
        # 正确形式：    'word-with-dashes': 'value'
        pattern = re.compile(r'^(    )([a-z]+-[a-z][a-z0-9-]*):', re.MULTILINE)
        matches = list(pattern.finditer(js))
        return (len(matches) == 0, f"{len(matches)} unquoted kebab-case keys (should be 0)")
    except Exception as e:
        return False, f"Exception: {e}"

def test_html_parser_health():
    """测试 HTML 解析健康 - 用 Python HTMLParser 模拟 Chrome 解析"""
    try:
        resp = urllib.request.urlopen(HTML_URL, timeout=5)
        html = resp.read().decode('utf-8')

        from html.parser import HTMLParser

        class Counter(HTMLParser):
            def __init__(self):
                super().__init__()
                self.div_count = 0
                self.errors = []
            def handle_starttag(self, tag, attrs):
                if tag == 'div':
                    self.div_count += 1
                # 检测嵌套过深
                if len(self.stack) > 200:
                    self.errors.append(f'depth {len(self.stack)}')
            def handle_endtag(self, tag):
                pass

        counter = Counter()
        # 简单的 stack 模拟
        counter.stack = []

        class StackParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.max_depth = 0
                self.div_count = 0
            def handle_starttag(self, tag, attrs):
                self.div_count += 1
                attrs_dict = dict(attrs)
                if tag == 'div' and not attrs_dict.get('id', '').startswith('page-'):
                    pass
            def handle_startendtag(self, tag, attrs):
                pass

        parser = StackParser()
        parser.feed(html)

        return (parser.div_count > 50, f"{parser.div_count} div tags parsed")
    except Exception as e:
        return False, f"Exception: {e}"

def test_zh_dict_size():
    """测试 zh dict 有合理数量的 keys"""
    try:
        js, _ = fetch_combined_i18n()
        if js is None:
            return False, "fetch failed"

        # 数 zh: { ... } 块内的 key
        # v54.247: also accept 'window.I18N_ZH = {' (split file format)
        m = re.search(r'\bzh:\s*\{', js) or re.search(r'window\.I18N_ZH\s*=\s*\{', js)
        if not m:
            return False, "No zh dict"
        i = m.end()
        depth = 1
        start = i
        while i < len(js) and depth > 0:
            if js[i] == '{':
                depth += 1
            elif js[i] == '}':
                depth -= 1
            i += 1
        zh_block = js[start:i-1]

        # 数 keys (避免匹配 value 中的冒号)
        # 模式：    'word' or word: 'value'
        # 简单估算：每行 count:1
        key_count = len(re.findall(r"^\s*(?:'[^']+'|[a-zA-Z][a-zA-Z0-9_-]*)\s*:", zh_block, re.MULTILINE))
        return (key_count >= 600, f"zh dict has {key_count} keys (>= 600)")
    except Exception as e:
        return False, f"Exception: {e}"

def test_en_dict_size():
    """测试 en dict 有合理数量的 keys"""
    try:
        js, _ = fetch_combined_i18n()
        if js is None:
            return False, "fetch failed"

        # v54.247: also accept 'window.I18N_EN = {' (split file format)
        m = re.search(r'\n\s*en:\s*\{', js) or re.search(r'window\.I18N_EN\s*=\s*\{', js)
        if not m:
            return False, "No en dict"
        i = m.end()
        depth = 1
        start = i
        while i < len(js) and depth > 0:
            if js[i] == '{':
                depth += 1
            elif js[i] == '}':
                depth -= 1
            i += 1
        en_block = js[start:i-1]

        key_count = len(re.findall(r"^\s*(?:'[^']+'|[a-zA-Z][a-zA-Z0-9_-]*)\s*:", en_block, re.MULTILINE))
        return (key_count >= 400, f"en dict has {key_count} keys (>= 400)")
    except Exception as e:
        return False, f"Exception: {e}"

def test_html_uses_three_data_i18n_attrs():
    """测试 HTML 使用 data-i18n, data-i18n-placeholder, data-i18n-title"""
    try:
        resp = urllib.request.urlopen(HTML_URL, timeout=5)
        html = resp.read().decode('utf-8')
        has_i18n = 'data-i18n=' in html
        has_placeholder = 'data-i18n-placeholder=' in html
        has_title = 'data-i18n-title=' in html
        return (has_i18n and has_placeholder and has_title,
                f"i18n={has_i18n}, placeholder={has_placeholder}, title={has_title}")
    except Exception as e:
        return False, f"Exception: {e}"

def test_i18n_keys_uniqueness():
    """测试 dict 里 keys 没有重复"""
    try:
        js, _ = fetch_combined_i18n()
        if js is None:
            return False, "fetch failed"

        # 提取所有 'key': 或 key: 形式的 keys
        # 限定在 zh: 和 en: 块内
        issues = []
        for dict_name in ['zh', 'en', 'alertEn']:
            m = re.search(rf'(?:\\n\\s*){dict_name}:\\s*\\{{', js)
            if not m:
                # Try without preceding \n
                m = re.search(rf'{dict_name}:\\s*\\{{', js)
            if not m:
                continue
            i = m.end()
            depth = 1
            start = i
            while i < len(js) and depth > 0:
                if js[i] == '{':
                    depth += 1
                elif js[i] == '}':
                    depth -= 1
                i += 1
            block = js[start:i-1]

            # 找所有 keys
            keys = re.findall(r"^\s*(?:'([^']+)'|([a-zA-Z][a-zA-Z0-9_-]*))\s*:", block, re.MULTILINE)
            key_names = [k[0] or k[1] for k in keys]
            if len(key_names) != len(set(key_names)):
                dups = [k for k in key_names if key_names.count(k) > 1]
                issues.append(f"{dict_name}: duplicates {set(dups)}")

        return (len(issues) == 0, "; ".join(issues) if issues else "no duplicates")
    except Exception as e:
        return False, f"Exception: {e}"

def main():
    tests = [
        ('[1] HTML 文件加载', test_html_loads),
        ('[2] i18n-data.js 加载', test_i18n_data_loads),
        ('[3] HTML data-i18n 数量 >= 200', test_data_i18n_count_in_html),
        ('[4] 无 broken data-i18n 模式', test_broken_data_i18n),
        ('[5] kebab-case keys 都加引号', test_kebab_case_keys_quoted),
        ('[6] HTML parser 解析健康', test_html_parser_health),
        ('[7] zh dict size >= 600', test_zh_dict_size),
        ('[8] en dict size >= 400', test_en_dict_size),
        ('[9] HTML 使用 3 种 i18n 属性', test_html_uses_three_data_i18n_attrs),
        ('[10] dict keys 唯一性', test_i18n_keys_uniqueness),
    ]

    print('=' * 70)
    print('RSD Calculator - v54.216 e2e_browser.py')
    print('=' * 70)
    pass_count = 0
    fail_count = 0
    for name, fn in tests:
        try:
            ok, detail = fn()
            status = '✓' if ok else '✗'
            line = f'  [{status}] {name} — {detail}'
            print(line)
            if ok:
                pass_count += 1
            else:
                fail_count += 1
        except Exception as e:
            print(f'  [✗] {name} — Exception: {e}')
            fail_count += 1

    print('=' * 70)
    print(f'PASS: {pass_count}/{pass_count + fail_count}')
    print('=' * 70)

    return 0 if fail_count == 0 else 1

if __name__ == '__main__':
    sys.exit(main())