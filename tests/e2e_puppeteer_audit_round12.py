#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.246 Round 12: 4 维度 final cleanup（14 bug / 11 新 i18n key）"""
import sys, re

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
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
i18n = _read_all_i18n()
html = open(HTML,'r',encoding='utf-8').read()
css = open(CSS,'r',encoding='utf-8').read()

print('--- #1 perf: renderHistory delegation ---')
m = '_cbDelegateBound' in app
check('renderHistory checkbox delegateBound flag', m)
m2 = "container.addEventListener('change'" in app or "history-list').addEventListener('change'" in app
check('history-list has single delegated change listener', m2)

print('--- #2 a11y: tabs → button ---')
# count buttons with role=tab or class tab/subtab
btn_count = app.count('class="tab"') + app.count("class='tab'")
html_btn_count = html.count('<button type="button" class="tab"') + html.count('<button type="button" class="subtab"')
m = html_btn_count >= 20  # 7 main + 17 subtab
check(f'tabs/subtabs are buttons (count={html_btn_count})', m)
# no div tabs
div_tabs = html.count('<div class="tab"') + html.count('<div class="subtab"')
check(f'No more <div class="tab/subtab"> (count={div_tabs})', div_tabs == 0)
# CSS reset for button.tab
m = re.search(r'\.tab\s*\{[^}]*border:\s*none', css)
check('.tab CSS removes native button border', m is not None)

print('--- #3 a11y: touch target sizes ---')
m = re.search(r'\.btn-xs\s*\{[^}]*min-height:\s*36px', css)
check('.btn-xs min-height 36px', m is not None)
m2 = re.search(r'\.h-details-toggle\s*\{[^}]*min-height:\s*36px', css)
check('.h-details-toggle min-height 36px', m2 is not None)

print('--- #4 i18n: 11 new keys ---')
new_keys = [
    'uiClearStatsConfirm','emptyHistorySubtitle','cvHistoryExportTime',
    'cvHtmlReportTitleH2','cvHtmlSummaryH3','cvTimePointDataLabel',
    'cvHtmlReportTitleH1','cvHtmlExportTime','cvHtmlSummaryH2',
    'cvNoCalibration','confirmNetworkWeakFmt',
]
for k in new_keys:
    cnt = i18n.count(f'{k}:')
    check(f'i18n key {k} (count={cnt})', cnt >= 2, f'expected ≥2 (zh+en)')

# qrImg.alt uses i18n
m = "qrImg.alt = i18n('cardTitleReportQr')" in app
check('qrImg.alt uses i18n', m)
# networkWeakFmt.replace
m = "i18n('confirmNetworkWeakFmt')" in app
check('confirmNetworkWeakFmt used', m)
# placeholder i18n-placeholder
m = 'data-i18n-placeholder' in html
check('HTML data-i18n-placeholder used', m)

print('--- #5 correctness ---')
# _historyCache JSON.parse(JSON.stringify(h))
# v54.249 fix: deep-clone moved into setH()（line 522: `_historyCache = snapshot`；line 520: `var snapshot = JSON.parse(JSON.stringify(d))`）。v54.281 进一步删除 addH 末尾的冗余 deep-clone（setH 已做）。测试保留"addH 调用后 _historyCache 是 deep-clone 的"语义，匹配 setH 内部 snapshot 赋值模式。
m = re.search(r"_historyCache\s*=\s*(?:JSON\.parse\(JSON\.stringify\([a-zA-Z_]+\)\)|snapshot\b)", app)
check('addH deep-clones cache (via setH snapshot)', m is not None)
# _updateScrollHints after renderHistory
m = re.search(r"renderHistory\(\);[\s\S]{0,200}_updateScrollHints", app)
check('_updateScrollHints after renderHistory', m is not None)
# h-details-toggle aria-expanded
m = re.search(r'aria-expanded="false"[^>]*data-details|details.*?aria-expanded', app)
check('h-details-toggle aria-expanded', m is not None)

print('--- #6 syntax check ---')
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