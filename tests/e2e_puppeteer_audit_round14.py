#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.248 Round 14: 4 维度 final（4 bug / 215 en 翻译补齐 / 50+ !isNaN → Number.isFinite）"""
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

print('--- #1 perf already in place (v54.246) ---')
m = '_debounceCalc(calcCurve' in app
check('calcCurve debounced', m)
m2 = '_fragWrap' in app
check('renderXxx uses DocumentFragment', m2)
m3 = 'rsd-collapsed-cards' in app
check('card-collapsed persisted', m3)

print('--- #2 i18n P6: 215 en + 1 zh keys added ---')
new_keys = ['hW0', 'cvReportHeader', 'cvReportMode', 'mpTotalVolume',
            'loginFailPrefix', 'signupFailPrefix', 'sampleIdPromptCurrent',
            'verdictCompliant', 'verdictNonCompliant', 'placeholderFirstRow',
            'csvColSampleOriginal', 'icalTiterRecalTitle', 'icalReportReviewDesc']
for k in new_keys:
    cnt_zh = len(re.findall(rf"^\s+{k}:", i18n[0:i18n.find('zh:')+3], re.MULTILINE))
    cnt_en = len(re.findall(rf"^\s+{k}:", i18n[i18n.find('zh:'):], re.MULTILINE))
    cnt = i18n.count(f'{k}:')
    check(f'i18n key {k} (count={cnt})', cnt >= 2, f'expected ≥2')

# en 段 ≥ 700 keys
# v54.247: in the loader, 'en:' appears as 'en: window.I18N_EN,'. The actual section
# starts with 'window.I18N_EN = {' in i18n-en.js. Find that marker.
en_section_start = i18n.find('window.I18N_EN = {')
if en_section_start < 0:
    en_section_start = i18n.find('en:')
en_keys = re.findall(r"^\s+([a-zA-Z_]\w*):", i18n[en_section_start:], re.MULTILINE)
check(f'en 段 key 数 ({len(en_keys)}) ≥ 700', len(en_keys) >= 700)

# data-i18n-title on buttons
title_attrs = html.count('data-i18n-title=')
check(f'HTML data-i18n-title count ({title_attrs}) ≥ 12', title_attrs >= 12)

print('--- #3 correctness: 50+ isNaN → Number.isFinite ---')
m = '!isNaN(' in app
check('No more !isNaN( in app.js', not m)
# _saveJson toast
m = '_saveJsonFailNotified' in app
check('_saveJson adds toast on failure', m)
# restoreBackup flashEl (i18n 之前已存在)
m = 'restoreFailRolledback' in app
check('restoreBackup uses restoreFailRolledback', m)
# calcExpr length limit
m = re.search(r"trimmed\.length > 200", app)
check('calcExpr 200 char limit', m is not None)

print('--- #4 a11y ---')
# card-title focus-visible
m = re.search(r'\.card-title:focus-visible', css)
check('card-title :focus-visible outline', m is not None)
# setupStorageSync toast for theme/lang
m = re.search(r"_i18nToast\('toast_storageSynced'", app)
check('_setupStorageSync adds storageSynced toast', m is not None)
# sample row aria-label
m = 'placeholderSampleArea' in app
check('sample input has placeholderSampleArea aria-label', m)

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