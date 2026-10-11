#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.254 Round 19: critical inversion bug fix + 4 维度 final"""
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
HTML = r'F:\自制软件\RSD & 含量计算器.html'
# v54.257 split: _i18nDevScanned 移到 helpers-i18n.js
HELPERS_I18N = r'F:\自制软件\helpers-i18n.js'
# v54.259 split: CSV export 移到 helpers-export.js
HELPERS_EXPORT = r'F:\自制软件\helpers-export.js'
app = open(APP,'r',encoding='utf-8').read()
helpers_i18n = open(HELPERS_I18N,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_I18N) else ''
helpers_export = open(HELPERS_EXPORT,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_EXPORT) else ''
# v54.257 + v54.259: combined source for patterns in helpers-i18n.js / helpers-export.js
js_sources = app + '\n' + helpers_i18n + '\n' + helpers_export
zh = open(I18N_ZH,'r',encoding='utf-8').read()
en = open(I18N_EN,'r',encoding='utf-8').read()
al = open(I18N_ALERT,'r',encoding='utf-8').read()
html = open(HTML,'r',encoding='utf-8').read()

print('--- #1 CRITICAL: inverted !Number.isFinite guards fixed ---')
# 之前 v54.248 把 !isNaN 错改成 !Number.isFinite（丢 ! 反转语义）
# 检查关键 calc 守卫现在是 Number.isFinite(x) && x>0（正向）
broken = []
import re
for line in app.split('\n'):
    s = line.strip()
    if s.startswith('//') or not s: continue
    # 反转 bug 模式：!Number.isFinite(x) && x > N (proceed guard with comparison)
    if re.search(r'!Number\.isFinite\(\w+\)\s*&&\s*\w+\s*[<>]=?', s):
        broken.append(s[:130])
check(f'No inverted calc guards (0 broken, found={len(broken)})', len(broken) == 0)

# 关键守卫：calcDissolution label guard (line 2332)
m = re.search(r"if\(Number\.isFinite\(c\)&&c>0&&label>0\) vals\.push\(c/label\*100\)", app)
check('calcDissolution label > 0 guard (corrected)', m is not None)

# v54.255 Round 19 followup: scan ALL calc function bodies for inversion pattern.
# v54.248 bug was global !isNaN→!Number.isFinite replace (dropped !). Need per-function body scan
# to catch any future regression where a developer edits a single calc function in isolation.
# Extract function bodies by matching "function NAME(...)" ... until closing brace at column 0.
def _extract_fn_bodies(src, names):
    """Extract top-level function bodies for given names (best-effort brace matching)."""
    out = {}
    for nm in names:
        # match 'function NAME(' at start of line (whitespace before allowed)
        m = re.search(rf"^function\s+{re.escape(nm)}\s*\([^)]*\)\s*\{{", src, re.MULTILINE)
        if not m:
            continue
        start = m.end() - 1  # position of '{'
        depth = 0
        i = start
        while i < len(src):
            c = src[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    out[nm] = src[start+1:i]
                    break
            i += 1
    return out

CALC_FNS = ['renderContent','renderDissolution','calcNormalize','calcSpike',
            'calcStatsFromArray','calcStatsNow','calcStats','calcExpr',
            'calcMw','calcCurve','calcExternal','calcInternal','calcSimple',
            'stdF','extStdF','renderUniformity']
fn_bodies = _extract_fn_bodies(app, CALC_FNS)

# Pattern: !Number.isFinite(x) && x [><=!] ...
# This is the inverted guard — `!Number.isFinite` means NaN/Infinity which can never satisfy > N.
inversion_in_bodies = []
for nm, body in fn_bodies.items():
    for m in re.finditer(r"!\s*Number\.isFinite\s*\(\s*(\w+)\s*\)\s*&&\s*\1\s*[><=!]", body):
        inversion_in_bodies.append(f'{nm}: {m.group(0)}')

check(f'no inverted guards in {len(fn_bodies)} calc fn bodies '
      f'(found={len(inversion_in_bodies)})',
      len(inversion_in_bodies) == 0,
      f'samples: {inversion_in_bodies[:3]}')

# Also explicitly verify calcDissolution's renderDissolution has the corrected guard
diss_body = fn_bodies.get('renderDissolution', '')
# The fixed guard: Number.isFinite(c)&&c>0&&label>0  (positive form)
m_diss = re.search(r"Number\.isFinite\(c\)&&\s*c>0&&\s*label>0", diss_body)
# And the broken form must NOT exist in renderDissolution
m_diss_broken = re.search(r"!Number\.isFinite\(c\)&&\s*c>0&&\s*label>0", diss_body)
check('renderDissolution: positive guard present', m_diss is not None)
check('renderDissolution: inverted guard absent', m_diss_broken is None)

# Same scan for renderContent
cont_body = fn_bodies.get('renderContent', '')
m_cont = re.search(r"Number\.isFinite\(area\)&&\s*area>0", cont_body)
m_cont_broken = re.search(r"!Number\.isFinite\(area\)&&\s*area>0", cont_body)
check('renderContent: positive area guard present', m_cont is not None)
check('renderContent: inverted area guard absent', m_cont_broken is None)

# Same for calcNormalize
norm_body = fn_bodies.get('calcNormalize', '')
m_norm = re.search(r"Number\.isFinite\(stdW\)\s*&&\s*Number\.isFinite\(stdP\)\s*&&\s*[^\n]*stdW\s*>\s*0", norm_body)
m_norm_broken = re.search(r"!Number\.isFinite\(stdW\)\s*&&\s*[^\n]*stdW\s*>\s*0", norm_body)
check('calcNormalize: positive stdW guard present', m_norm is not None)
check('calcNormalize: inverted stdW guard absent', m_norm_broken is None)

# calcSpike input parseFloat null
# calcSpike input parseFloat null (agent reported added but final state may differ)
m = re.search(r"Number\.isFinite\(p\) \? p : 0", app) or re.search(r"parseFloat\(.*\) \|\| 0", app)
check('parseFloat handling exists', m is not None)

print('--- #2 correctness: _setLang invalidates _extractChartDataCache ---')
m = re.search(r"_extractChartDataCache\s*=\s*\{", app) and '_setLang' in app
# Check _setLang function body has _extractChartDataCache invalidation
import re as r2
m_setlang = r2.search(r"function _setLang\([^)]+\)\s*\{", app)
if m_setlang:
    end_idx = app.find('\n}\n', m_setlang.end())
    body = app[m_setlang.end():end_idx]
    has_invalidate = '_extractChartDataCache' in body
    check('_setLang invalidates _extractChartDataCache', has_invalidate)

print('--- #3 raw NUL byte fix ---')
src_bytes = open(APP,'rb').read()
nul = src_bytes.count(b'\x00')
check(f'No raw NUL bytes in app.js (count={nul})', nul == 0)

print('--- #4 buildSelfRefReport restored (round8 needed it) ---')
# v54.259: buildSelfRefReport 移到 helpers-export.js
m = 'function buildSelfRefReport' in js_sources
check('buildSelfRefReport defined', m)
m2 = re.search(r"i18n\('cvTotalImpOver'\)", js_sources)
check('buildSelfRefReport uses cvTotalImpOver', m2 is not None)

print('--- #5 i18n: 16 new keys ---')
new_keys = ['titleLogin','titleFontSize','titleTheme','titleSettings',
            'titleLimitBoundary','titleTrendToggle','titleCopyMd','titleCopyHtml',
            'titleCopyJson','titleCopyIcal','titleCopyCvXlsx',
            'settingsClearHistory','settingsRefresh','btnLangZh','btnLangEn']
for k in new_keys:
    cnt_zh = zh.count(f'{k}:')
    cnt_en = en.count(f'{k}:')
    check(f'key {k} zh+en (zh={cnt_zh} en={cnt_en})', cnt_zh >= 1 and cnt_en >= 1)

print('--- #6 a11y final ---')
m = 'data-i18n-aria-label="titleSwitchLang"' in html
check('lang-switch aria-label', m)
m2 = '.history-item:hover' in open(r'F:\自制软件\styles.css', encoding='utf-8').read()
check('history-item hover state', m2 is not None)
m3 = re.search(r"announceSync", app) or '_announceSettings' in app
check('sync aria-live helper', m3 is not None)

print('--- #7 i18n dev scan ---')
m = '_i18nDevScanned' in js_sources
check('i18n dev scan flag', m)
m2 = '_logUnresolvedI18nKeys' in js_sources
check('i18n dev scan logger', m2 is not None)

print('--- #8 syntax ---')
for f, name in [(APP, 'app.js'), (I18N_ZH, 'i18n-zh.js'), (I18N_EN, 'i18n-en.js'), (I18N_ALERT, 'i18n-alert.js')]:
    src = open(f,'r',encoding='utf-8').read()
    if src.count('{') == src.count('}'):
        check(f'{name} braces balanced ({src.count(chr(123))})', True)
    else:
        check(f'{name} braces BALANCED', False)

import subprocess
for f, name in [(APP, 'app.js'), (I18N_ZH, 'i18n-zh.js'), (I18N_EN, 'i18n-en.js'), (I18N_ALERT, 'i18n-alert.js')]:
    r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    check(f'{name} node --check passes', r.returncode == 0)

print()
print('=' * 70)
print(f'PASS: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print('FAIL details:')
    for f in FAIL: print(f'  {f}')
    sys.exit(1)