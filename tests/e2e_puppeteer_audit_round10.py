#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.244 Round 10: 4 维度深度 P1 修复（16+ bug / 1 新 i18n key）"""
import sys, re

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
I18N = r'F:\自制软件\i18n-data.js'
# v54.257 split: i18n infrastructure 移到 helpers-i18n.js
HELPERS_I18N = r'F:\自制软件\helpers-i18n.js'
HELPERS_TOAST = r'F:\自制软件\helpers-toast.js'
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
helpers_i18n = open(HELPERS_I18N,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_I18N) else ''
js_sources = app + '\n' + helpers_i18n + '\n' + helpers_toast
i18n = _read_all_i18n()
html = open(HTML,'r',encoding='utf-8').read()
css = open(CSS,'r',encoding='utf-8').read()

print('--- #1 correctness fixes ---')
# _doAddH (already v54.243)
m = re.search(r"function _doAddH", js_sources)
check('_doAddH helper exists', m is not None)
# saveStatsHistory null RSD
m = re.search(r"mean !== 0 \?", app)
check('saveStatsHistory uses mean !== 0', m is not None)
m2 = 'rsd == null' in app
check('renderHistory checks null rsd', m2)
# CSS.escape for date
m = re.search(r"CSS\.escape\(dateKey\)", app)
check('_toggleDateGroup uses CSS.escape', m is not None)
# canvas 0×0 guard
m = re.search(r"canvas\.offsetWidth === 0 \|\| canvas\.offsetHeight === 0", app)
check('drawTrendChart canvas 0×0 guard', m is not None)
# openLoginModal listener fix
m = re.search(r"ov\._loginKeyHandler", app)
check('openLoginModal tracks _loginKeyHandler', m is not None)
# processInput bare function names
m = '\\b(?:sin|cos|tan' in app
check('processInput regex matches bare sin/cos', m)

print('--- #2 a11y fixes ---')
# _wireTablistArrowKeys
m = re.search(r"_wireTablistArrowKeys", app)
check('_wireTablistArrowKeys helper', m is not None)
# h-date-group button
m = 'class="h-date-group' in app
check('h-date-group is button', m)
# aria-expanded toggle
m = 'aria-expanded=' in app
check('aria-expanded used', m)
# _announceChartState
m = re.search(r"_announceChartState", app)
check('_announceChartState helper', m is not None)
# visually-hidden
m = re.search(r"\.visually-hidden", css)
check('visually-hidden CSS class', m is not None)
# select labels
m = re.search(r'<label for="lang-switch"', html)
check('lang-switch has for= label', m is not None)
m2 = re.search(r'<label for="mp-preset"', html)
check('mp-preset has for= label', m2 is not None)
# CSV button aria-label
m = re.search(r'aria-label="[^"]*CSV', html)
check('CSV button has aria-label', m is not None)
# toast assertive live
m = re.search(r'_withAssertiveLive', js_sources)
check('_withAssertiveLive helper', m is not None)

print('--- #3 i18n fixes ---')
# mpSelectSolvent / mpCustomSolvent
m1 = re.search(r"i18n\('mpSelectSolvent'\)", app)
m2 = re.search(r"i18n\('mpCustomSolvent'\)", app)
check('mpSelectSolvent used', m1 is not None)
check('mpCustomSolvent used', m2 is not None)
# placeholderFirstRow
m = re.search(r"placeholderFirstRow", i18n)
check('placeholderFirstRow in i18n', m is not None)
# verdict compliant / non-compliant
m1 = re.search(r"i18n\('verdictCompliant'\)", app)
m2 = re.search(r"i18n\('verdictNonCompliant'\)", app)
check('verdictCompliant used', m1 is not None)
check('verdictNonCompliant used', m2 is not None)
# Round 24: _setLang 同步 html[lang] 属性（a11y：让 screen reader 正确切换发音）
m = re.search(r"document\.documentElement\.lang\s*=\s*\(_currentLang === 'en' \? 'en' : 'zh-CN'\)", app) or \
    re.search(r"document\.documentElement\.lang\s*=\s*\(.*=== 'en'.*\?.*'en'.*:.*'zh-CN'.*\)", app)
check('_setLang syncs html[lang] for a11y', m is not None)

print('--- #4 syntax check ---')
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
check(f'app.js node --check passes', r.returncode == 0,
      f'stderr: {r.stderr[:200]}')
r2 = subprocess.run(['node', '--check', I18N], capture_output=True, text=True, encoding='utf-8', errors='replace')
check(f'i18n-data.js node --check passes', r2.returncode == 0,
      f'stderr: {r2.stderr[:200]}')

print()
print('=' * 70)
print(f'PASS: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print('FAIL details:')
    for f in FAIL: print(f'  {f}')
    sys.exit(1)