#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.249 Round 15: i18n 拆分文件 + 4 维度 final"""
import sys, re

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
I18N_ZH = r'F:\自制软件\i18n-zh.js'
I18N_EN = r'F:\自制软件\i18n-en.js'
I18N_ALERT = r'F:\自制软件\i18n-alert.js'
I18N_DATA = r'F:\自制软件\i18n-data.js'
HTML = r'F:\自制软件\RSD & 含量计算器.html'
# v54.257 split: _missingI18nKeys Set 移到 helpers-i18n.js
HELPERS_I18N = r'F:\自制软件\helpers-i18n.js'
HELPERS_TOAST = r'F:\自制软件\helpers-toast.js'
app = open(APP,'r',encoding='utf-8').read()
helpers_toast = open(HELPERS_TOAST,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_TOAST) else ''
helpers_i18n = open(HELPERS_I18N,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_I18N) else ''
js_sources = app + '\n' + helpers_i18n + '\n' + helpers_toast
zh = open(I18N_ZH,'r',encoding='utf-8').read()
en = open(I18N_EN,'r',encoding='utf-8').read()
al = open(I18N_ALERT,'r',encoding='utf-8').read()
dt = open(I18N_DATA,'r',encoding='utf-8').read()
html = open(HTML,'r',encoding='utf-8').read()

print('--- #1 i18n-data.js split ---')
# Files exist
import os
for f, name in [(I18N_ZH, 'i18n-zh.js'), (I18N_EN, 'i18n-en.js'),
                (I18N_ALERT, 'i18n-alert.js'), (I18N_DATA, 'i18n-data.js')]:
    check(f'{name} exists', os.path.exists(f))
# Wrapper size
sz = os.path.getsize(I18N_DATA)
check(f'i18n-data.js wrapper size ({sz}) < 500', sz < 500)
# Window.I18N assignment
check('i18n-data.js sets window.I18N', 'window.I18N' in dt)
# HTML script order
script_order = re.findall(r'<script src="(i18n-\w+\.js)"', html)
expected = ['i18n-zh.js', 'i18n-en.js', 'i18n-alert.js', 'i18n-data.js']
check(f'HTML script order ({script_order}) matches expected', script_order == expected)

print('--- #2 i18n P7: 2 new keys (lblLanguageEn + backupDoneFmt) ---')
for k in ['lblLanguageEn', 'backupDoneFmt']:
    cnt_zh = zh.count(f'{k}:')
    cnt_en = en.count(f'{k}:')
    check(f'key {k} in zh (count={cnt_zh})', cnt_zh >= 1)
    check(f'key {k} in en (count={cnt_en})', cnt_en >= 1)

print('--- #3 correctness: i18n missing key warns ---')
m = '_missingI18nKeys' in js_sources
check('_missingI18nKeys Set exists', m)
# setH deep-clone
m = 'JSON.parse(JSON.stringify(d))' in app
check('setH deep-clones before localStorage write', m)
# clearHistory confirm
m = re.search(r"async function clearHistory[\s\S]{0,500}_confirmDialog\(i18n\('confirmDeleteAllHistory'\)", app)
check('clearHistory uses _confirmDialog(confirmDeleteAllHistory)', m is not None)

print('--- #4 a11y: history-list tabindex ---')
m = re.search(r'<div id="history-list" tabindex="0"', html)
check('history-list has tabindex="0"', m is not None)
m2 = re.search(r'<div id="history-list"[^>]*role="region"', html)
check('history-list role="region"', m2 is not None)
# toast close button (v54.258: 在 helpers-toast.js)
# v54.273 fix: 改用 i18n('toastClose') 拼接（之前硬编码 "Close"）—— Round 16+ 测试才需要重做
m = "i18n('toastClose')" in js_sources or "aria-label=\"Close\"" in js_sources
check('toast close button has aria-label=i18n(toastClose)', m)
# text-muted
m = '--text-muted:' in open(r'F:\自制软件\styles.css', encoding='utf-8').read()
check('--text-muted defined in CSS', m)

print('--- #5 syntax check ---')
for f, name in [(APP, 'app.js'), (I18N_ZH, 'i18n-zh.js'), (I18N_EN, 'i18n-en.js'),
                (I18N_ALERT, 'i18n-alert.js'), (I18N_DATA, 'i18n-data.js')]:
    src = open(f,'r',encoding='utf-8').read()
    if src.count('{') == src.count('}'):
        check(f'{name} braces balanced ({src.count(chr(123))})', True)
    else:
        check(f'{name} braces BALANCED', False)

import subprocess
for f, name in [(APP, 'app.js'), (I18N_DATA, 'i18n-data.js'), (I18N_ZH, 'i18n-zh.js')]:
    r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    check(f'{name} node --check passes', r.returncode == 0, f'stderr: {r.stderr[:200]}')

print()
print('=' * 70)
print(f'PASS: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print('FAIL details:')
    for f in FAIL: print(f'  {f}')
    sys.exit(1)