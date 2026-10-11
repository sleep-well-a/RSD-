#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.245 Round 11: 4 维度最终轮（12 bug / 7 新 i18n key / Chart.js perf）"""
import sys, re

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
# v54.258 split: toast/dialog 移到 helpers-toast.js
HELPERS_TOAST = r'F:\自制软件\helpers-toast.js'
I18N = r'F:\自制软件\i18n-data.js'
# v54.247 split: aggregate content from all 4 files for regex parsing
I18N_PARTS = [
    r'F:\自制软件\i18n-zh.js',
    r'F:\自制软件\i18n-en.js',
    r'F:\自制软件\i18n-alert.js',
    r'F:\自制软件\i18n-data.js',
]
def _read_all_i18n():
    out = []
    for p in I18N_PARTS:
        with open(p, 'r', encoding='utf-8') as f:
            out.append(f.read())
    return '\n'.join(out)
HTML = r'F:\自制软件\RSD & 含量计算器.html'
CSS = r'F:\自制软件\styles.css'
app = open(APP,'r',encoding='utf-8').read()
helpers_toast = open(HELPERS_TOAST,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_TOAST) else ''
js_sources = app + chr(10) + helpers_toast
i18n = _read_all_i18n()
html = open(HTML,'r',encoding='utf-8').read()
css = open(CSS,'r',encoding='utf-8').read()

print('--- #1 perf fixes (Chart.js) ---')
# _trendChartArgsCache
m = '_trendChartArgsCache' in app
check('_trendChartArgsCache exists', m)
m2 = '_curveChartArgsCache' in app
check('_curveChartArgsCache exists', m2)
# chart.update via chart.resize()
m = re.search(r"_chartInstance\.resize\(\)", app)
check('drawTrendChart uses chart.resize() on no-op', m is not None)
m2 = re.search(r"_curveChartInstance\.resize\(\)", app)
check('drawCurveChart uses chart.resize() on no-op', m2 is not None)
# resize raf debounce
m = '_resizeRaf' in app
check('window resize uses rAF debounce', m)

print('--- #2 print + focus fixes ---')
# print-active class
m = '.print-active' in css
check('print-active CSS class exists', m)
m2 = re.search(r'\.page\.print-active', css)
check('.page.print-active has display:block', m2 is not None)
# chart-container canvas hidden in print
m = re.search(r'\.chart-container canvas \{ display:none !important', css)
check('chart canvas hidden in print', m is not None)
# _setPrintActive
m = '_setPrintActive' in app
check('_setPrintActive helper exists', m)
# afterprint cleanup
m = 'afterprint' in app
check('afterprint cleanup registered', m)
# _initCardTitleA11y in switchTab
m = '_initCardTitleA11y' in app and 'after renderHistory' in app
check('switchTab re-inits card-title a11y', m)

print('--- #3 correctness fixes ---')
# _openOverlayWithFocusTrap re-queries focusables
m = re.search(r"queryFocusables", js_sources)
check('focusables re-queried per Tab press', m is not None)
# csvMissingArgs guard
m = re.search(r"if\(!headers \|\| !rowFn\)", app)
check('csvExportHistory args guard', m is not None)
m2 = 'csvMissingArgs' in i18n
check('csvMissingArgs key in i18n', m2)

print('--- #4 i18n fixes ---')
# card-title data-i18n
new_keys = [
    'cardTitleReportMeta','cardTitleReportQr','cardTitleDataMgmt',
    'cardTitleComprehensivePreview','exportTemplateDoneFmt','importTemplateDoneFmt',
]
for k in new_keys:
    cnt = i18n.count(f'{k}:')
    check(f'i18n key {k} (count={cnt})', cnt >= 2, f'expected ≥2')

# _setSyncStatus uses i18n for template export/import
m = re.search(r"i18n\('exportTemplateDoneFmt'\)", app)
check('exportAllTemplates uses i18n', m is not None)
m2 = re.search(r"i18n\('importTemplateDoneFmt'\)", app)
check('importTemplates uses i18n', m2 is not None)

# html card-title data-i18n attrs
for k in ['cardTitleReportMeta','cardTitleReportQr','cardTitleDataMgmt','cardTitleComprehensivePreview']:
    m = f'data-i18n="{k}"' in html
    check(f'HTML data-i18n="{k}"', m)

print('--- #5 syntax check ---')
if app.count('{') == app.count('}'):
    check(f'app.js braces balanced ({app.count(chr(123))})', True)
else:
    check('app.js braces BALANCED', False, f'{app.count(chr(123))} vs {app.count(chr(125))}')
if i18n.count('{') == i18n.count('}'):
    check(f'i18n braces balanced ({i18n.count(chr(123))})', True)
else:
    check('i18n braces BALANCED', False, f'{i18n.count(chr(123))} vs {i18n.count(chr(125))}')

import subprocess
r = subprocess.run(['node', '--check', APP], capture_output=True, text=True, encoding='utf-8', errors='replace')
check(f'app.js node --check passes', r.returncode == 0, f'stderr: {r.stderr[:200]}')
r2 = subprocess.run(['node', '--check', I18N], capture_output=True, text=True, encoding='utf-8', errors='replace')
check(f'i18n-data.js node --check passes', r2.returncode == 0, f'stderr: {r2.stderr[:200]}')

print()
print('=' * 70)
print(f'PASS: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print('FAIL details:')
    for f in FAIL: print(f'  {f}')
    sys.exit(1)