#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.241 Round 7: mpRenderRecipes / mpBatchPrep / iCal 硬编码中文 i18n-ize"""
import sys, os, re, json

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')

APP = r'F:\自制软件\app.js'
I18N = r'F:\自制软件\i18n-data.js'
# v54.260 split: iCal / comprehensive 移到 helpers-export-comprehensive.js
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
app = open(APP,'r',encoding='utf-8').read()
helpers_export_comp = open(HELPERS_EXPORT_COMP,'r',encoding='utf-8').read() if __import__('os').path.exists(HELPERS_EXPORT_COMP) else ''
# v54.260: combined source for patterns in helpers-export-comprehensive.js
js_sources = app + '\n' + helpers_export_comp
i18n = _read_all_i18n()
print('--- #1 mpRenderRecipes empty state i18n ---')
# 检查硬编码中文 + i18n 调用同时存在
m = re.search(r"if \(!recipes\.length\) \{.*?listEl\.innerHTML\s*=\s*'[^']*'\s*\+\s*_esc\(i18n\('mpEmptyListHint'", app, re.S)
check('mpRenderRecipes empty state uses i18n(mpEmptyListHint)', m is not None,
      f'match found' if m else 'no match')

print('--- #2 mpRenderRecipes checkbox title bug ---')
m = re.search(r'<input type="checkbox"[^>]*title="勾选用于批量配制"', app)
check('No more bare title=勾选用于批量配制', m is None,
      f'found at: {m.group()[:80] if m else "n/a"}')
m2 = re.search(r'<input type="checkbox"[^>]*titleBatchCheck', app)
check('checkbox uses i18n title pattern', m2 is not None and 'i18n(' in m2.group())

print('--- #3 mpRenderRecipes 载入 button i18n ---')
m = re.search(r'<button[^>]*mpLoadRecipe[^>]*>载入</button>', app)
check('No more bare 载入 button text', m is None)
m2 = re.search(r'<button[^>]*mpLoadRecipe[^>]*>.*?btnLoadInline.*?</button>', app, re.S)
check('载入 button uses btnLoadInline i18n', m2 is not None)

print('--- #4 mpBatchPrep target mL i18n ---')
m = re.search(r'@ 目标[^"]*mL', app)
check('No more bare "@ 目标" prefix', m is None)
m2 = re.search(r'mpBatchTableTargetFmt', app)
check('mpBatchTableTargetFmt i18n key used', m2 is not None)

print('--- #5 mpBatchPrep no valid ratios i18n ---')
m = re.search(r'所选配方无有效比例数据', app)
check('No more bare 所选配方无有效比例数据', m is None)
m2 = re.search(r"i18n\('mpNoValidRatios'\)", app)
check('mpNoValidRatios i18n key used', m2 is not None)

print('--- #6 mpExportBatchCSV header + filename prefix i18n ---')
m = re.search(r"\[?\'配方\',i18n\('cvTargetVol'\)", app)
check('No more bare 配方 CSV header', m is None)
m2 = re.search(r"i18n\('mpBatchCSVHeader'\)", app)
check('mpBatchCSVHeader i18n key used', m2 is not None)
m3 = re.search(r"'流动相批量配制_'", app)
check('No more bare 流动相批量配制_ filename prefix', m3 is None)
m4 = re.search(r"i18n\('mpBatchCSVPrefix'\)", app)
check('mpBatchCSVPrefix i18n key used', m4 is not None)

print('--- #7 iCal review description i18n ---')
m = re.search(r'RSD & 含量计算器生成的综合验证报告已满 30 天', app)
check('No more bare RSD & 含量计算器生成...', m is None)
m2 = re.search(r"i18n\('icalReportReviewDesc'\)", js_sources)
check('icalReportReviewDesc i18n key used', m2 is not None)
m3 = re.search(r"'样品：'", app)
check('No more bare 样品： prefix', m3 is None)

print('--- #8 iCal titer recal title + desc i18n ---')
m = re.search(r"'🧪 滴定度重新校准提醒'", app)
check('No more bare 🧪 滴定度重新校准提醒', m is None)
m2 = re.search(r"i18n\('icalTiterRecalTitle'\)", js_sources)
check('icalTiterRecalTitle i18n key used', m2 is not None)
m3 = re.search(r"'滴定液有效期将至'", app)
check('No more bare 滴定液有效期将至', m3 is None)
m4 = re.search(r"i18n\('icalTiterRecalDesc'\)", js_sources)
check('icalTiterRecalDesc i18n key used', m4 is not None)

print('--- #9 iCal filename prefix i18n ---')
m = re.search(r"'综合验证报告_日历提醒'", app)
check('No more bare 综合验证报告_日历提醒', m is None)
m2 = re.search(r"i18n\('icalCalFilePrefix'\)", js_sources)
check('icalCalFilePrefix i18n key used', m2 is not None)
m3 = re.search(r"'分析验证'", app)
check('No more bare 分析验证 category', m3 is None)
m4 = re.search(r"i18n\('icalCatReview'\)", js_sources)
check('icalCatReview i18n key used', m4 is not None)

print('--- #10 csvExportHistory custom filter i18n ---')
m = re.search(r"'（自定义筛选）'", app)
check('No more bare （自定义筛选）', m is None)
m2 = re.search(r"i18n\('cvCustomFilterNote'\)", app)
check('cvCustomFilterNote i18n key used', m2 is not None)

print('--- #11 i18n dict new keys exist ---')
new_keys = [
    'mpEmptyListHint', 'mpBatchTableTargetFmt', 'mpNoValidRatios',
    'mpBatchCSVHeader', 'mpBatchCSVPrefix', 'btnLoadInline',
    'icalReportReviewDesc', 'icalMetaDetails', 'icalTiterRecalTitle',
    'icalTiterRecalDesc', 'icalCalFilePrefix', 'icalCatReview',
    'icalCatTiterRecal', 'cvCustomFilterNote', 'cvStabilityRecorded',
]
for k in new_keys:
    m_zh = re.search(rf"^\s+{k}:\s*'", i18n, re.MULTILINE)
    m_en = re.search(rf"^\s+{k}:\s*'", i18n[m_zh.end()-1:] if m_zh else '', re.MULTILINE)
    # count occurrences
    cnt = i18n.count(f'{k}:')
    check(f'key {k} in zh+en (count={cnt})', cnt >= 2, f'expected ≥2, got {cnt}')

print('--- #12 syntax check ---')
# braces
if app.count('{') == app.count('}'):
    check(f'app.js braces balanced ({app.count(chr(123))})', True)
else:
    check(f'app.js braces BALANCED', False, f'{app.count(chr(123))} vs {app.count(chr(125))}')
if i18n.count('{') == i18n.count('}'):
    check(f'i18n braces balanced ({i18n.count(chr(123))})', True)
else:
    check(f'i18n braces BALANCED', False, f'{i18n.count(chr(123))} vs {i18n.count(chr(125))}')

print()
print('=' * 70)
print(f'PASS: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print('FAIL details:')
    for f in FAIL: print(f'  {f}')
    sys.exit(1)
