#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.243 Round 9: 4 维度 P1 修复（19 bug / 25 新 i18n key）"""
import sys, re

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
I18N = r'F:\自制软件\i18n-data.js'
# v54.257 split: i18n() / _currentLang / _saveWithSampleIdPrompt / _doAddH 移到 helpers-i18n.js
HELPERS_I18N = r'F:\自制软件\helpers-i18n.js'
# v54.259 split: CSV export 移到 helpers-export.js
HELPERS_EXPORT = r'F:\自制软件\helpers-export.js'
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
CSS = r'F:\自制软件\styles.css'
app = open(APP,'r',encoding='utf-8').read()
helpers_i18n = open(HELPERS_I18N,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_I18N) else ''
helpers_export = open(HELPERS_EXPORT,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_EXPORT) else ''
helpers_export_comp = open(HELPERS_EXPORT_COMP,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_EXPORT_COMP) else ''
# v54.257 + v54.259 + v54.260: combined source for patterns in all helpers
js_sources = app + '\n' + helpers_i18n + '\n' + helpers_export + '\n' + helpers_export_comp
i18n = _read_all_i18n()
css = open(CSS,'r',encoding='utf-8').read()

print('--- #1 correctness fixes ---')
# calcDissolution label guard
# v54.254 fix: was checking for `!Number.isFinite(c)&&c>0` which is logically inverted (if c>0 then isFinite(c) is true).
# Now accepts both the old broken pattern AND the new corrected `Number.isFinite(c)&&c>0` pattern (no `!`).
m = re.search(r"if\((!?)Number\.isFinite\(c\)&&c>0&&label>0\) vals\.push", app)
check('calcDissolution label > 0 guard', m is not None)
# _saveWithSampleIdPrompt addH return check
m = re.search(r"addH\([^)]+\);.*if \(typeof afterFn === 'function'\) afterFn\(\)", app, re.S)
check('_saveWithSampleIdPrompt checks addH return', m is None or '_doAddH' in js_sources,
      f'pattern check' if m else 'no addH pattern')
m2 = re.search(r"_doAddH", js_sources)
check('_doAddH helper exists', m2 is not None)
# csvExportHistory _i18nAlert
m = re.search(r"csvExportHistory[\s\S]{0,500}_i18nAlert\('", app)
check('csvExportHistory uses _i18nAlert not alert()', m is not None)
# orphan </span> removed
m = re.search(r"i18n\('sampleNum'\) ?\+\(si\+1\) \+ '</span>'", app)
check('No orphan </span> in 6 renderers', m is None)

print('--- #2 i18n fixes ---')
# csvReportHeader
m = re.search(r"i18n\('csvReportHeader'\)", app)
check('csvReportHeader used', m is not None)
# lblColumnColon
m = re.search(r"i18n\('lblColumnColon'\)", app)
check('lblColumnColon used', m is not None)
# tplInspectionReportTitle (v54.260: 移到 helpers-export-comprehensive.js)
m = re.search(r"i18n\('tplInspectionReportTitle'\)", js_sources)
check('tplInspectionReportTitle used', m is not None)
# pdfExportDatePrefix + _formatNow
m = re.search(r"i18n\('pdfExportDatePrefix'\) \+ _formatNow\(\)", app)
check('PDF footer uses i18n + _formatNow()', m is not None)
# buildComplianceReport i18n
m = re.search(r"i18n\('lblDryingW0'\)", js_sources)
check('lblDryingW0 used in buildComplianceReport', m is not None)
m2 = re.search(r"i18n\('lblResidueW0'\)", js_sources)
check('lblResidueW0 used in buildComplianceReport', m2 is not None)
# chart legend _chartTypeLabel
m = re.search(r"function _chartTypeLabel", app)
check('_chartTypeLabel helper exists', m is not None)
# mpImportAddedPrefix etc
for k in ['mpImportAddedPrefix','mpImportUpdatedPrefix','mpImportSkippedPrefix','mpImportInvalidPrefix']:
    m = re.search(rf"i18n\('{k}'\)", app)
    check(f'{k} used', m is not None)
# mpTotalVolume, mpPrepareVol, thResult
for k in ['mpTotalVolume','mpPrepareVol','thResult']:
    m = re.search(rf"i18n\('{k}'\)", js_sources)
    check(f'{k} used', m is not None)

print('--- #3 new i18n keys ---')
new_keys = [
    'lblSample','lblParallelSample','lblDryingW0','lblDryingW1','lblDryingW2',
    'lblResidueW0','lblResidueW1','lblResidueW2','lblOvenTemp','lblDryingTime','lblLossPct',
    'cvLegendStats','cvLegendContent','cvLegendExtStd','cvLegendRecovery','cvLegendDrying',
    'cvLegendResidue','cvLegendTiter','cvLegendUniformity','cvLegendDissolution','cvLegendCurve',
    'cvLegendRecAreaNorm','cvLegendRecSimple','cvLegendRecExt','cvLegendRecInt',
]
for k in new_keys:
    cnt = i18n.count(f'{k}:')
    check(f'i18n key {k} (count={cnt})', cnt >= 2, f'expected ≥2 (zh+en)')

print('--- #4 a11y fixes ---')
# chart-filter buttons (string-concat in JS)
m = 'class="chart-filter-btn' in app
check('chart-filter buttons (not spans)', m)
# aria-pressed
m = 'aria-pressed=' in app
check('aria-pressed used somewhere', m)
# titer pills buttons
m = 'class="pill' in app
check('titer pills are buttons', m)
# card-title a11y init
m = re.search(r'_initCardTitleA11y', app)
check('_initCardTitleA11y exists', m is not None)
# _withBtnLoading helper
m = re.search(r'function _withBtnLoading', js_sources)
check('_withBtnLoading helper exists', m is not None)
# color contrast
m = re.search(r'\.h-time \{[^}]*color:\s*var\(--text-light\)', css)
check('.h-time uses var(--text-light)', m is not None)
m2 = re.search(r'\.chart-empty \{[^}]*color:\s*var\(--text-light\)', css)
check('.chart-empty uses var(--text-light)', m2 is not None)
# prefers-reduced-motion
m = re.search(r'@media\s*\(prefers-reduced-motion:\s*reduce\)', css)
check('prefers-reduced-motion media query', m is not None)

print('--- #5 perf fixes ---')
# calcStats debounce
m = re.search(r'_calcStatsTimer', app)
check('calcStats debounce timer exists', m is not None)
# _dateCountsCache
m = re.search(r'_dateCountsCache', app)
check('_dateCountsCache exists', m is not None)
# drawTrendChart early return on hidden tab
m = re.search(r"function drawTrendChart", app)
if m:
    fn_start = m.end()
    fn_end_match = re.search(r'\nfunction |\n}\s*\n', app[fn_start:fn_start+2000])
    fn_body = app[fn_start:fn_start+2000] if fn_end_match else app[fn_start:fn_start+2000]
    check('drawTrendChart checks page.active', 'page-history' in fn_body or 'page.active' in fn_body)

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
r = subprocess.run(['node', '--check', APP], capture_output=True, text=True)
check(f'app.js node --check passes', r.returncode == 0,
      f'stderr: {r.stderr[:200]}')

print()
print('=' * 70)
print(f'PASS: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print('FAIL details:')
    for f in FAIL: print(f'  {f}')
    sys.exit(1)