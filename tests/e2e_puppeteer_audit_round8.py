#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.242 Round 8: 4 维度并行审计修复"""
import sys, re

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
# v54.258 split: toast/dialog 移到 helpers-toast.js
HELPERS_TOAST = r'F:\自制软件\helpers-toast.js'
# v54.259 split: CSV export 移到 helpers-export.js
HELPERS_EXPORT = r'F:\自制软件\helpers-export.js'
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
app = open(APP,'r',encoding='utf-8').read()
helpers_toast = open(HELPERS_TOAST,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_TOAST) else ''
helpers_export = open(HELPERS_EXPORT,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_EXPORT) else ''
# v54.258 + v54.259: combined source for patterns in helpers-toast.js / helpers-export.js
js_sources = app + chr(10) + helpers_toast + chr(10) + helpers_export
i18n = _read_all_i18n()
print('--- #1 renderTiterTrend nested svg fix ---')
m = re.search(r"svg\.innerHTML\s*=\s*'<svg", app)
check('No more nested <svg> in renderTiterTrend', m is None)
m2 = re.search(r"svg\.setAttribute\('viewBox'", app)
check('renderTiterTrend uses setAttribute viewBox', m2 is not None)

print('--- #2 calcCurve off-by-one fix ---')
m = re.search(r"document\.getElementById\('curve-py-'\+\(i\+1\)\)", app)
check('No more getElementById curve-py off-by-one', m is None)
m2 = re.search(r"row\.querySelector\('\.result-col'\)", app)
check('calcCurve uses row.querySelector(.result-col)', m2 is not None)

print('--- #3 calcNormalize negative guard ---')
m = re.search(r"w === 0 \|\| d === 0", app)
check('No more w === 0 || d === 0 in calcNormalize', m is None)
m2 = re.search(r"!Number\.isFinite\(w\) \|\| !Number\.isFinite\(d\) \|\| !Number\.isFinite\(area\) \|\| w <= 0 \|\| d <= 0", app)
check('calcNormalize uses w <= 0 || d <= 0', m2 is not None)

print('--- #4 syncAllReal error toast ---')
m = re.search(r"_i18nToast\('syncFailed'", app)
check('syncAllReal catch adds _i18nToast(syncFailed)', m is not None)

print('--- #5 _batchDeleteSelected stale idx guard ---')
m = re.search(r"Number\.isInteger\(n\) && n >= 0 && n < h\.length", app)
check('_batchDeleteSelected uses n < h.length guard', m is not None)

print('--- #6 calcExpr hoisted regexes ---')
consts = re.findall(r'const CALC_EXPR_\w+ =', app)
check(f'calcExpr hoisted regexes (count={len(consts)})', len(consts) >= 18,
      f'expected ≥18, got {len(consts)}')

print('--- #7 CSV headers i18n ---')
csv_keys = ['csvColSeq','csvColPeakArea','csvColIsPeakArea','csvColSpectrumNo',
            'csvColImpName','csvColSampleOriginal','csvColLimitLow','csvColLimitHigh',
            'csvColRsdLimit','csvColAdded','csvColMeasured','csvColMeanPct','csvColSd',
            'csvColRsdPct','csvColOverallVerdict','csvColTheoryPct','csvColMeasuredPct',
            'csvColVerdict','csvColStdA','csvColPPct','csvColDMl','csvColMoisture',
            'csvColResidue','csvColParallelNo']
for k in csv_keys:
    cnt = i18n.count(f'{k}:')
    check(f'i18n key {k} (count={cnt})', cnt >= 2, f'expected ≥2 (zh+en)')

print('--- #8 i18n dict 70 new keys exist ---')
new_keys = ['csvReportHeader','cvReportMode','cvReportImpFormula','tplDataColon',
            'tplTheoryColon','tplMeasuredColon','tplContentParen','tplSampleHash',
            'tplVerdictColon','tplDataPointsColon','tplLabelLimitColon',
            'normModeIndependent','cvReportDataPoints','cvReportRecoveries',
            'cvConcentrationX','cvResponseY','pdfExportDatePrefix','chartFilterAllBtn',
            'loginFailPrefix','signupFailPrefix','backupOverdueAction',
            'sampleIdPromptCurrent','thResult','mpTotalVolume','mpPrepareVol',
            'mpImportAddedPrefix','mpImportUpdatedPrefix','mpImportSkippedPrefix',
            'mpImportInvalidPrefix','mpSelectSolvent','mpCustomSolvent',
            'errBackupMissingData','verdictCompliant','verdictNonCompliant',
            'tplExportOk','tplImportOk','tplInspectionReportTitle','lblColumnColon',
            'titerFirstRowPh','titleCopyUpRow','btnCopyUpRow','placeholderInputValue',
            'cvTotalImpOver','cvTotalImpOk','cvSingleImpOver','cvSingleImpOk']
for k in new_keys:
    cnt = i18n.count(f'{k}:')
    check(f'key {k} (count={cnt})', cnt >= 2, f'expected ≥2')

print('--- #9 login/signup fail prefix i18n ---')
m1 = re.search(r"_setLoginStatus\(i18n\('loginFailPrefix'\)", app)
check('signIn uses i18n(loginFailPrefix)', m1 is not None)
m2 = re.search(r"_setLoginStatus\(i18n\('signupFailPrefix'\)", app)
check('signUp uses i18n(signupFailPrefix)', m2 is not None)

print('--- #10 backup overdue + sample ID prompt i18n ---')
m = re.search(r"_setSyncStatus\(i18n\('backupOverdueAction'\)\)", app)
check('backup overdue uses i18n', m is not None)
m2 = re.search(r"i18n\('sampleIdPromptCurrent'\)", app)
check('sample ID prompt current uses i18n', m2 is not None)

print('--- #11 impurity verdict i18n ---')
m = re.search(r"i18n\('cvTotalImpOver'\).*:.*i18n\('cvTotalImpOk'\)", js_sources, re.S)
check('impurity verdict uses cvTotalImpOver/cvTotalImpOk', m is not None)
m2 = re.search(r"i18n\('cvSingleImpOver'\).*:.*i18n\('cvSingleImpOk'\)", js_sources, re.S)
check('impurity verdict uses cvSingleImpOver/cvSingleImpOk', m2 is not None)

print('--- #12 syntax check ---')
if app.count('{') == app.count('}'):
    check(f'app.js braces balanced ({app.count(chr(123))})', True)
else:
    check('app.js braces BALANCED', False, f'{app.count(chr(123))} vs {app.count(chr(125))}')
if i18n.count('{') == i18n.count('}'):
    check(f'i18n braces balanced ({i18n.count(chr(123))})', True)
else:
    check('i18n braces BALANCED', False, f'{i18n.count(chr(123))} vs {i18n.count(chr(125))}')

# node syntax check via subprocess
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
