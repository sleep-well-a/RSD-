#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.247 Round 13: 4 维度 final cleanup（16 bug / 29 新 i18n key / aria-label 大清理）"""
import sys, re

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
I18N = r'F:\自制软件\i18n-data.js'
# v54.257 split: i18n() 函数移到 helpers-i18n.js（含 fallback chain gate）
HELPERS_I18N = r'F:\自制软件\helpers-i18n.js'
# v54.260 split: comprehensive exports 移到 helpers-export-comprehensive.js
HELPERS_EXPORT_COMP = r'F:\自制软件\helpers-export-comprehensive.js'
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
app = open(APP,'r',encoding='utf-8').read()
helpers_i18n = open(HELPERS_I18N,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_I18N) else ''
helpers_export_comp = open(HELPERS_EXPORT_COMP,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_EXPORT_COMP) else ''
# v54.257 + v54.260: combined source for patterns in helpers-i18n.js / helpers-export-comprehensive.js
js_sources = app + '\n' + helpers_i18n + '\n' + helpers_export_comp
i18n = _read_all_i18n()
html = open(HTML,'r',encoding='utf-8').read()

print('--- #1 a11y: type="button" + fieldsets ---')
# Count buttons with type="button"
btn_count = html.count('type="button"')
check(f'HTML has type="button" (count={btn_count})', btn_count >= 40)
# fieldsets
fs_count = html.count('<fieldset')
check(f'fieldsets present (count={fs_count})', fs_count >= 3)
# legends
lg_count = html.count('<legend')
check(f'legends present (count={lg_count})', lg_count >= 3)

print('--- #2 i18n: 115 aria-label → data-i18n-aria-label ---')
m = html.count('data-i18n-aria-label=')
check(f'data-i18n-aria-label count (count={m})', m >= 80, f'expected ≥80')
# _applyI18n handles [data-i18n-aria-label]
m2 = 'data-i18n-aria-label' in app
check('_applyI18n handles aria-label', m2)

print('--- #3 i18n fallback bug fix (en 不再泄露 zh) ---')
# v54.257: 旧 fallback 路径 `if (I18N.zh && I18N.zh[camelKey]) return I18N.zh[camelKey]` after alertEn — 现在应该 gate `_currentLang === 'zh'`
# 此检查现在在 helpers-i18n.js（v54.257 拆分）
m = re.search(r"_currentLang === 'zh' && I18N.zh && I18N.zh\[camelKey\]", js_sources)
check('en 模式不 fallback 到 zh', m is not None)

print('--- #4 new i18n keys (29) ---')
new_keys = [
    'titleAdd','titleAddDataPoint','titleAddInjection','titleAddPoint','titleAddRow',
    'titleBackupAll','titleCalcInput','titleChartFilter','titleClearHistory',
    'titleDownloadCurveCSV','titleDownloadExtStdCSV','titleDownloadRecoveryCSV','titleDownloadSpikeCSV',
    'titleFactoryReset','titleFontDefault','titleLimitBoundaryOn','titleLimitUpper',
    'titlePaste','titlePrintPDF','titleRecipeName','titleSaveAsRecipe',
    'titleSelectBackupJSON','titleSelectRecipeCSV','titleSelectTemplateJSON',
    'titleTemplateExport','titleTemplateImport','titleToggleLineBar','titleTrendLineOn',
    'factoryResetDone',
]
for k in new_keys:
    cnt = i18n.count(f'{k}:')
    check(f'i18n key {k} (count={cnt})', cnt >= 2, f'expected ≥2')

print('--- #5 correctness ---')
# setReportMeta snapshot/restore
m = re.search(r"setReportMeta[\s\S]{0,400}snapshot", app)
check('setReportMeta snapshot/restore', m is not None)
# metaFilename control char strip
m = re.search(r"\\\\x00-", app) or '\\x00' in app
check('metaFilename strips control chars', m)
# escapeText \r handling (v54.260: escapeText 移到 helpers-export-comprehensive.js)
m = '\\r' in js_sources and 'escapeText' in js_sources
check('escapeText handles \\r', m)
# factoryReset cache invalidation
m = re.search(r"factoryReset[\s\S]{0,500}_historyCache = null", app, re.S)
check('factoryReset invalidates _historyCache', m is not None)

print('--- #6 a11y: toast button + modal button type="button" ---')
m = re.search(r"_showRestoreUndoToast[\s\S]{0,500}btn\.type = 'button'", app, re.S)
check('restore toast has type=button', m is not None)

print('--- #7 syntax check ---')
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