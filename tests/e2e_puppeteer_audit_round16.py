#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.250 Round 16: 4 维度 final（9 bug / 7 placeholder en 翻译）"""
import sys, re, os

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
HTML = r'F:\自制软件\RSD & 含量计算器.html'
CSS = r'F:\自制软件\styles.css'
I18N_ZH = r'F:\自制软件\i18n-zh.js'
I18N_EN = r'F:\自制软件\i18n-en.js'
# v54.257 split: i18n() empty key guard 移到 helpers-i18n.js
HELPERS_I18N = r'F:\自制软件\helpers-i18n.js'
HELPERS_TOAST = r'F:\自制软件\helpers-toast.js'
app = open(APP,'r',encoding='utf-8').read()
helpers_toast = open(HELPERS_TOAST,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_TOAST) else ''
helpers_i18n = open(HELPERS_I18N,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_I18N) else ''
js_sources = app + '\n' + helpers_i18n
html = open(HTML,'r',encoding='utf-8').read()
zh = open(I18N_ZH,'r',encoding='utf-8').read()
en = open(I18N_EN,'r',encoding='utf-8').read()
css = open(CSS,'r',encoding='utf-8').read()

print('--- #1 perf: _extractChartData cache + i18n hoist ---')
m = '_extractChartDataCache' in app
check('_extractChartDataCache exists', m)
m2 = '_trendSuffixLabel' in app
check('i18n hoist outside loop', m2)
# invalidation sites (sig-based invalidation uses .sig = '' and cache clear)
invalid_sites = app.count('_extractChartDataCache.sig =') + app.count('_extractChartDataCache = null') + app.count('_extractChartDataCache.data =')
check(f'cache invalidation sites (≥3, count={invalid_sites})', invalid_sites >= 3)

print('--- #2 i18n: 4 hardcoded title + 6 placeholder en ---')
# 4 title="复制上行" replaced
m = re.findall(r'title="复制上行"', app)
check(f'No more hardcoded title="复制上行" (count={len(m)})', len(m) == 0)
m2 = re.findall(r"i18n\('titleCopyUpRow'\)", app)
check(f'titleCopyUpRow used (count={len(m2)})', len(m2) >= 4)
# 6 placeholder en keys
new_keys = ['placeholderSampleIdOverride','placeholderBatchOverride','placeholderRecipeName',
            'placeholderSearchTiter','placeholderAuto','placeholderInjectMeta']
for k in new_keys:
    cnt_zh = zh.count(f'{k}:')
    cnt_en = en.count(f'{k}:')
    check(f'key {k} zh+en (zh={cnt_zh} en={cnt_en})', cnt_zh >= 1 and cnt_en >= 1)

print('--- #3 correctness: 4 fixes ---')
# i18n empty key guard
m = "if (!key || typeof key !== 'string') return ''" in js_sources
check('i18n empty key guard', m)
# renderHistory Array.isArray
m = "Array.isArray(h)" in app
check('renderHistory Array.isArray guard', m)
# _extractChartDataCache invalidation
m = '_extractChartDataCache' in app
check('_extractChartDataCache invalidation sites', m)
# savePlan addH error surfacing
m = re.search(r"if \(addH\(e\)\) _i18nAlert", app, re.S) or re.search(r"if \(addH\(e\)\) _i18nToast", app, re.S)
check('savePlan addH error surfacing', m is not None)

print('--- #4 a11y: print button + backup reminder ---')
m = re.search(r'<button id="btn-print-pdf"', html)
check('btn-print-pdf id', m is not None)
m2 = re.search(r'aria-busy', app)
check('aria-busy used', m2 is not None)
m3 = re.search(r'<span id="backup-reminder-status"[^>]*aria-live="polite"', html)
check('backup-reminder aria-live', m3 is not None)

print('--- #5 syntax check ---')
for f, name in [(APP, 'app.js'), (I18N_ZH, 'i18n-zh.js'), (I18N_EN, 'i18n-en.js')]:
    src = open(f,'r',encoding='utf-8').read()
    if src.count('{') == src.count('}'):
        check(f'{name} braces balanced ({src.count(chr(123))})', True)
    else:
        check(f'{name} braces BALANCED', False)

import subprocess
for f, name in [(APP, 'app.js'), (I18N_ZH, 'i18n-zh.js'), (I18N_EN, 'i18n-en.js')]:
    r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    check(f'{name} node --check', r.returncode == 0, f'stderr: {r.stderr[:200]}')

print()
print('=' * 70)
print(f'PASS: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print('FAIL details:')
    for f in FAIL: print(f'  {f}')
    sys.exit(1)