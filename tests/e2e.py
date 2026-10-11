#!/usr/bin/env python3
"""
RSD & 含量计算器 v54.204 E2E 测试套件

测试范围：
  1. 文件加载：HTML/CSS/JS/I18N 4 个资源 HTTP 200
  2. HTML 结构：正确的 script 引用顺序、link 标签
  3. 字符编码：UTF-8 with no BOM
  4. 文件大小：合理范围（不会暴涨）
  5. I18N 完整性：zh 和 en dict keys 对称（除 alert/alertEn）
  6. CSS 完整性：包含关键样式（--primary, .header 等）
  7. JS 完整性：无明显未闭合括号
  8. I18N key 数量报告（v54.253 Fix #2）：zh/en/alert 三个 dict 的 key 数 + 覆盖率不变式
"""
import re
import sys
import os
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = Path(r'F:\自制软件')
HTML = BASE / 'RSD & 含量计算器.html'
CSS = BASE / 'styles.css'
JS = BASE / 'app.js'
I18N = BASE / 'i18n-data.js'
# v54.247 split: i18n-data.js is now a loader; data lives in 3 sibling files
I18N_PARTS = [BASE / 'i18n-zh.js', BASE / 'i18n-en.js', BASE / 'i18n-alert.js', I18N]
PORT = 8765

results = []

def test(name, ok, detail=''):
    results.append({'name': name, 'ok': bool(ok), 'detail': detail})
    # v54.285 P1-A: 替换 ✓/✗ 为 ASCII [OK]/[FAIL]（Windows GBK 不支持 ✓/✗，UnicodeEncodeError）
    mark = '[OK]' if ok else '[FAIL]'
    print(f'  {mark} {name}', f'— {detail}' if detail else '')
    return ok

def start_server():
    """Start local HTTP server, return process"""
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
    """Fetch URL with timeout"""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.URLError as e:
        return None, None, {'error': str(e)}

def test_file_loading():
    print('\n[1] 文件加载测试')
    base_url = f'http://localhost:{PORT}'
    files = [
        ('/', 'HTML', HTML.name),
        ('/styles.css', 'CSS', CSS.name),
        ('/app.js', 'JS', JS.name),
        ('/i18n-data.js', 'I18N', I18N.name),
    ]
    for path, name, fname in files:
        status, content, headers = fetch(base_url + path)
        if status is None:
            test(f'{name} 加载 ({fname})', False, '网络错误')
            continue
        ok = status == 200
        ctype = headers.get('Content-Type', '?') if isinstance(headers, dict) else '?'
        test(f'{name} 加载 ({fname})', ok, f'status={status}, type={ctype}')

def test_html_structure():
    print('\n[2] HTML 结构测试')
    if not HTML.exists():
        test('HTML 文件存在', False)
        return
    s = HTML.read_text(encoding='utf-8')

    # Script tags
    scripts = re.findall(r'<script([^>]*)></script>|<script([^>]*)>(.*?)</script>', s, re.DOTALL)
    external = re.findall(r'<script\s+src="([^"]+)"', s)
    test(f'外部脚本 ({len(external)})', len(external) >= 5,
         ', '.join(s.replace('/', '').replace('.js', '') for s in external[:5]))

    # Link tags
    links = re.findall(r'<link\s+rel="stylesheet"\s+href="([^"]+)"', s)
    test('CSS link 存在', len(links) >= 1, links[0] if links else '')

    # i18n-data.js loaded BEFORE main script
    i18n_pos = s.find('<script src="i18n-data.js"')
    app_pos = s.find('<script src="app.js"')
    if i18n_pos > 0 and app_pos > 0:
        test('i18n-data.js 在 app.js 之前加载', i18n_pos < app_pos,
             f'i18n={i18n_pos}, app={app_pos}')

    # Inline JS should be small (just stub i18n)
    inline_js = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', s, re.DOTALL)
    if inline_js:
        inline_total = sum(len(j) for j in inline_js)
        test(f'内联 JS 很小 (<500 chars)', inline_total < 500, f'{inline_total} chars')

    # UTF-8 BOM check
    has_bom = s.startswith('\ufeff')
    test('无 UTF-8 BOM', not has_bom)

def test_file_sizes():
    print('\n[3] 文件大小测试')
    expected = {
        HTML: (50_000, 150_000),       # 50KB-150KB
        CSS: (15_000, 35_000),         # 15KB-35KB
        JS: (300_000, 510_000),        # 300KB-510KB (v54.255 +4KB 防御性 final cleanup)
        # v54.247: i18n-data.js split into 4 files. Aggregate size matches old single-file size.
        # v54.274: 上限上调（v54.273/274 新增 ~35 业务 key × 2 语言 + emoji prefix）
        I18N_PARTS[0]: (35_000, 65_000),  # i18n-zh.js ~61KB（v54.285 P0-A/C +20 key 后超 60K 上限，调阈值 +5KB 缓冲）
        I18N_PARTS[1]: (30_000, 65_000),  # i18n-en.js ~61KB（同 zh）
        I18N_PARTS[2]: (33_000, 42_000),  # i18n-alert.js ~39KB
        I18N: (50, 2_000),                 # loader is tiny
    }
    for f, (lo, hi) in expected.items():
        if f.exists():
            size = f.stat().st_size
            ok = lo <= size <= hi
            test(f'{f.name} 大小 ({size:,})', ok, f'期望 {lo:,}-{hi:,}')
        else:
            test(f'{f.name} 存在', False)

# v54.253 Fix #2: i18n 字典 key 统计 / 覆盖率工具（跨轮跟踪 key 增长 + Fix #1 的回归防线）
def _count_dict_keys(path):
    """统计 i18n 字典文件的顶层 key 数（兼容 bare / 'quoted' / "quoted" 三种 key 写法）。

    这些文件是一行一个 key 的扁平对象，行首正则即可安全计数；
    行注释（// ...）与块注释行被跳过，值的字面量不会误计（要求 key 紧跟冒号且位于行首）。
    """
    if not path.exists():
        return None
    keys = set()
    for line in path.read_text(encoding='utf-8').splitlines():
        s = line.strip()
        if not s or s.startswith('//') or s.startswith('/*') or s.startswith('*'):
            continue
        m = re.match(r'''^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:''', s)
        if m:
            keys.add(m.group(1) or m.group(2) or m.group(3))
    return keys


def _camel(key):
    """复刻 i18n() 的 kebab→camel 回退（HTML 用 lbl-sample-weight，字典用 lblSampleWeight）"""
    return re.sub(r'-([a-z])', lambda m: m.group(1).upper(), key)


def _html_data_i18n_keys(html_text):
    """抓 HTML 里所有 data-i18n / data-i18n-title / data-i18n-placeholder / data-i18n-aria-label 的 key"""
    return set(re.findall(r'data-i18n(?:-[a-z-]+)?="([^"]+)"', html_text))


def test_i18n_key_counts():
    print('\n[4b] I18N key 数量报告（跨轮增长跟踪）')
    counts = {}
    # 下限取当前实际值略留余量：误删 key 立即报警，正常新增不阻塞
    floors = [('i18n-zh.js', 1000), ('i18n-en.js', 850), ('i18n-alert.js', 740)]
    for name, floor in floors:
        keys = _count_dict_keys(BASE / name)
        if keys is None:
            test(f'{name} 存在', False)
            continue
        counts[name] = keys
        print(f'    · {name}: {len(keys)} keys')      # v54.253 基线: zh=1032 / en=882 / alert=761
        test(f'{name} keys ≥ {floor}', len(keys) >= floor, f'{len(keys)} keys')
    print(f'    · 合计: {sum(len(v) for v in counts.values())} keys')

    zh, en, al = counts.get('i18n-zh.js'), counts.get('i18n-en.js'), counts.get('i18n-alert.js')

    # 不变式 1：zh 有、en 没有的 key 必须能在 alertEn 兜底，否则 en 模式会把原始 key 显示到 UI
    if zh is not None and en is not None and al is not None:
        orphans = sorted((zh - en) - al)
        test('en 缺失的 key 均有 alertEn 兜底', not orphans,
             f'{len(orphans)} 个无兜底' + (f': {orphans[:5]}' if orphans else ''))

        # 不变式 2（v54.253 Fix #1 回归）：HTML 每个 data-i18n* key 都必须在 zh 与 en 两侧都能解析
        html_keys = _html_data_i18n_keys(HTML.read_text(encoding='utf-8'))
        unresolved = sorted(k for k in html_keys
                            if not ({k, _camel(k)} & zh) or not ({k, _camel(k)} & (en | al)))
        test(f'HTML data-i18n* key 全部可解析 ({len(html_keys)} 个)', not unresolved,
             f'{len(unresolved)} 个未解析' + (f': {unresolved[:5]}' if unresolved else ''))


def test_i18n_integrity():
    print('\n[4] I18N dict 完整性测试')
    # v54.247: aggregate content from all 4 split files for regex parsing
    parts = []
    for p in I18N_PARTS:
        if p.exists():
            parts.append(p.read_text(encoding='utf-8'))
        else:
            test(f'{p.name} 存在', False)
            return
    content = '\n'.join(parts)

    # Find all key: 'value' patterns (not just indented ones)
    # Count keys in zh and en dicts
    zh_section = re.search(r'\bzh:\s*\{(.*?)(?=\n\s*en:|\n\s*alertEn:|\n\s*\};)', content, re.DOTALL)
    en_section = re.search(r'\ben:\s*\{(.*?)(?=\n\s*alertEn:|\n\s*\};)', content, re.DOTALL)

    if not zh_section or not en_section:
        # Fallback: simple counts
        zh_keys = set(re.findall(r'^\s*(\w+):\s*[\'"]', content, re.MULTILINE))
        zh_count = sum(1 for k in zh_keys if not k.startswith('//'))
    else:
        zh_keys = set(re.findall(r'^\s*(\w+):\s*[\'"]', zh_section.group(1), re.MULTILINE))

    test(f'zh dict 有 keys (≥300)', len(zh_keys) >= 300, f'{len(zh_keys)} keys')

    # Sample value check - find all save keys (zh, en, alertEn)
    saves = re.findall(r"save:\s*'([^']*)'", content)
    zh_save = next((s for s in saves if '保存' in s), None)
    en_save = next((s for s in saves if 'Save' in s and '保存' not in s), None)
    test('save key zh/en 正确',
         zh_save and en_save and '保存' in zh_save and 'Save' in en_save,
         f'zh={zh_save}, en={en_save}')

def test_css_integrity():
    print('\n[5] CSS 完整性测试')
    if not CSS.exists():
        test('styles.css 存在', False)
        return
    content = CSS.read_text(encoding='utf-8')

    # Key selectors (use more flexible matchers)
    required = [
        (':root', ':root'),
        ('--primary', '--primary'),
        ('.header', '.header'),
        ('.tab', '.tab'),
        ('.btn', '.btn'),
        ('.card', '.card'),
        ('body', 'body'),
        ('.page', '.page'),  # class for pages
    ]
    for name, sel in required:
        test(f'CSS 包含 {name}', sel in content)

def test_js_integrity():
    print('\n[6] JS 完整性测试')
    if not JS.exists():
        test('app.js 存在', False)
        return
    content = JS.read_text(encoding='utf-8')

    # Bracket balance (excluding strings and comments — approximate, ignore false positives)
    opens = content.count('{') - content.count('}')
    parens = content.count('(') - content.count(')')
    brackets = content.count('[') - content.count(']')
    # Allow small imbalance due to strings/comments
    test('大括号平衡', abs(opens) <= 1, f'diff={opens}')
    test('小括号接近平衡', abs(parens) <= 100, f'diff={parens}')
    test('方括号接近平衡', abs(brackets) <= 5, f'diff={brackets}')

    # Key code patterns (in app.js, no longer includes I18N dict or applyI18n)
    # v54.257: i18n() / _currentLang 移到 helpers-i18n.js，所以两者都查
    helpers = JS.parent / 'helpers-i18n.js'
    helpers_content = helpers.read_text(encoding='utf-8') if helpers.exists() else ''
    required = [
        ('function i18n', 'i18n 函数', helpers_content or content),
        ('function switchTab', 'switchTab 函数', content),
        ('var _currentLang', '_currentLang 变量', helpers_content or content),
    ]
    for pattern, name, haystack in required:
        test(f'JS 包含 {name}', pattern in haystack)

def main():
    print('=' * 70)
    print('RSD & 含量计算器 v54.204 E2E 测试')
    print('=' * 70)

    # File checks (no server needed)
    test_file_sizes()
    test_i18n_integrity()
    test_i18n_key_counts()
    test_css_integrity()
    test_js_integrity()

    # Server-dependent tests
    proc = start_server()
    try:
        test_file_loading()
        test_html_structure()
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
    results_file = BASE / 'tests' / 'test_results.json'
    results_file.parent.mkdir(exist_ok=True)
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump({
            'version': 'v54.204',
            'date': time.strftime('%Y-%m-%d %H:%M:%S'),
            'passed': passed,
            'total': total,
            'tests': results,
        }, f, ensure_ascii=False, indent=2)
    print(f'\nResults saved to {results_file}')

    return 0 if passed == total else 1

if __name__ == '__main__':
    sys.exit(main())