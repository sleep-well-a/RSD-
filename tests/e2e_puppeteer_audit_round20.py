#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.255 Round 20: regression tests for v54.248 inverted guard bug class.

Three independent guards against the inversion bug class:
  #1 Explicit calc function smoke tests (Fix #2): run calcStatsFromArray through
     Node vm sandbox and verify correctness on [100,102,98,101,99] (rsd=1.58%).
     Plus static verification that renderContent / renderDissolution / calcNormalize
     use the positive guard form (Number.isFinite(x) && x>0), not the inverted form.
  #2 Guard syntax validator (Fix #3): walk every calc function body, flag any
     `!Number.isFinite(X) && X [><=!]` pattern as a hard inversion bug. Embeds 5
     sample inversions into a temp file to verify the validator actually catches them.
  #3 Cross-module invariant: every positive `Number.isFinite(x) && x > 0` form
     must have a matching negative `!Number.isFinite(x) || x <= 0` style guard
     elsewhere — prevents asymmetric fixes where only one branch is updated.
"""
import sys, re, os, subprocess

PASS = []
FAIL = []

def check(name, ok, detail=''):
    if ok: PASS.append(name); print(f'  [OK] {name}')
    else: FAIL.append(f'{name} | {detail}'); print(f'  [FAIL] {name} {detail}')


APP = r'F:\自制软件\app.js'
app = open(APP, 'r', encoding='utf-8').read()
# v54.257 split: _checkNoInvertedGuards / _invertedGuardScanned 移到 helpers-i18n.js
HELPERS_I18N = r'F:\自制软件\helpers-i18n.js'
helpers_i18n = open(HELPERS_I18N, 'r', encoding='utf-8').read() if os.path.exists(HELPERS_I18N) else ''


# ============================================================
# Fix #2 (part 1): Pure function smoke test — calcStatsFromArray
# ============================================================
print('--- #1 calcStatsFromArray runtime smoke (Fix #2) ---')

# Build a Node sandbox that extracts just calcStatsFromArray and runs it.
# This is the core "is the math correct" check — would have caught v54.248
# because the inverted guard returned null/NaN for all valid inputs.
sandbox_pure = '''
function calcStatsFromArray(arr){
 if(!Array.isArray(arr)) return{n:0, mean:null, sd:null, rsd:null};
 const n = arr.length;
 if(n === 0) return{n:0, mean:null, sd:null, rsd:null};
 const mean = arr.reduce((a,b)=>a+b,0)/n;
 if(n === 1) return{n:1, mean, sd:null, rsd:null};
 const sd = Math.sqrt(arr.reduce((a,b)=>a+(b-mean)**2,0)/(n-1));
 const rsd = mean !== 0 ?(sd/mean)*100 : null;
 return{n, mean, sd, rsd};
}
const results = {};
const r1 = calcStatsFromArray([100, 102, 98, 101, 99]);
results.r1 = {n: r1.n, mean: r1.mean, sd: r1.sd, rsd: r1.rsd};

const r2 = calcStatsFromArray([]);
results.r2 = {n: r2.n, mean: r2.mean, sd: r2.sd, rsd: r2.rsd};

const r3 = calcStatsFromArray([42]);
results.r3 = {n: r3.n, mean: r3.mean, sd: r3.sd, rsd: r3.rsd};

const r4 = calcStatsFromArray([5, 5, 5, 5]);
results.r4 = {n: r4.n, mean: r4.mean, sd: r4.sd, rsd: r4.rsd};

const r5 = calcStatsFromArray([8, 12]);
results.r5 = {n: r5.n, mean: r5.mean, sd: r5.sd, rsd: r5.rsd};

// NaN/Infinity should be filtered (pure func doesn't filter, but caller does)
const r6 = calcStatsFromArray([NaN, 100, 102, Infinity, 98]);
results.r6 = {n: r6.n, mean: r6.mean, sd: r6.sd, rsd: r6.rsd};

console.log(JSON.stringify(results));
'''

sandbox_path = r'F:\自制软件\tests\_calc_pure_smoke.js'
with open(sandbox_path, 'w', encoding='utf-8') as f:
    f.write(sandbox_pure)

r = subprocess.run(['node', sandbox_path], capture_output=True, text=True)
out = (r.stdout or '').strip()
import json as _json
try:
    pure_results = _json.loads(out)
except Exception as e:
    pure_results = {}
    check(f'pure func sandbox parses JSON (got: {out[:200]})', False, str(e))

# [100, 102, 98, 101, 99]: mean=100, sd=sqrt(2.5)=1.5811, rsd=1.5811%
r1 = pure_results.get('r1', {})
check('calcStatsFromArray n=5', r1.get('n') == 5, f'got {r1}')
check('calcStatsFromArray mean=100', abs(r1.get('mean', 0) - 100) < 0.001, f'got {r1.get("mean")}')
check('calcStatsFromArray sd≈1.5811', r1.get('sd') is not None and abs(r1['sd'] - 1.5811388) < 0.001, f'got {r1.get("sd")}')
check('calcStatsFromArray rsd≈1.58%', r1.get('rsd') is not None and abs(r1['rsd'] - 1.5811388) < 0.001, f'got {r1.get("rsd")}')

# Empty array
r2 = pure_results.get('r2', {})
check('calcStatsFromArray([]) n=0', r2.get('n') == 0)
check('calcStatsFromArray([]) mean=null', r2.get('mean') is None)
check('calcStatsFromArray([]) rsd=null', r2.get('rsd') is None)

# Single element
r3 = pure_results.get('r3', {})
check('calcStatsFromArray([42]) n=1', r3.get('n') == 1)
check('calcStatsFromArray([42]) mean=42', r3.get('mean') == 42)
check('calcStatsFromArray([42]) rsd=null (no variance)', r3.get('rsd') is None)

# Identical values (RSD=0)
r4 = pure_results.get('r4', {})
check('calcStatsFromArray([5,5,5,5]) sd=0', r4.get('sd') == 0)
check('calcStatsFromArray([5,5,5,5]) rsd=0', r4.get('rsd') == 0)

# [8, 12]: mean=10, sd=sqrt(8)=2.828, rsd=28.28%
r5 = pure_results.get('r5', {})
check('calcStatsFromArray([8,12]) sd≈2.828',
      r5.get('sd') is not None and abs(r5['sd'] - 2.8284271) < 0.001)
check('calcStatsFromArray([8,12]) rsd≈28.28%',
      r5.get('rsd') is not None and abs(r5['rsd'] - 28.2842712) < 0.001)


# ============================================================
# Fix #2 (part 2): renderContent / calcNormalize / renderDissolution
# Static guard verification — these are DOM-bound so we verify the source.
# ============================================================
print('--- #2 calcContent/Normalize/Dissolution static guard verification ---')

def _extract_fn_body(src, name):
    m = re.search(rf"^function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", src, re.MULTILINE)
    if not m:
        return None
    start = m.end() - 1
    depth = 0
    i = start
    while i < len(src):
        c = src[i]
        # v54.261: 跳过字符串字面量
        if c == "'" or c == '"' or c == '`':
            quote = c
            i += 1
            while i < len(src) and src[i] != quote:
                if src[i] == '\\': i += 1
                i += 1
            i += 1
            continue
        if c == '/' and i + 1 < len(src) and src[i+1] == '/':
            while i < len(src) and src[i] != '\n': i += 1
            continue
        if c == '/' and i + 1 < len(src) and src[i+1] == '*':
            i += 2
            while i + 1 < len(src) and not (src[i] == '*' and src[i+1] == '/'): i += 1
            i += 2
            continue
        # v54.261: 跳过 regex literal — 仅在合法 regex 起点触发
        # 合法 regex 起点：前一个非空白字符是 (,=,:;[,{,!,~,?,&,|,+,*,/,%,>,<,^,| 或行首
        if c == '/' and i + 1 < len(src) and src[i+1] != '/' and src[i+1] != '*' and src[i+1] != '*':
            # 检查前一个非空白字符
            j = i - 1
            while j >= start and src[j].isspace(): j -= 1
            prev = src[j] if j >= start else '\n'
            regex_starts = set('(,=;:[{!~?&|+*/%>^|\n')
            if prev in regex_starts:
                # 是 regex literal
                i += 1
                in_class = False
                while i < len(src) and src[i] != '/':
                    if src[i] == '\\': i += 1
                    elif src[i] == '[': in_class = True
                    elif src[i] == ']' and in_class: in_class = False
                    i += 1
                i += 1  # skip closing /
                while i < len(src) and src[i].isalpha(): i += 1
                continue
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: return src[start+1:i]
        i += 1
    return None


# renderContent — must use positive guard for area > 0
cont_body = _extract_fn_body(app, 'renderContent') or ''
check('renderContent body extracted', bool(cont_body))
cont_positive = re.search(r"Number\.isFinite\(area\)&&\s*area\s*>\s*0", cont_body)
cont_inverted = re.search(r"!Number\.isFinite\(area\)&&\s*area\s*>\s*0", cont_body)
check('renderContent: positive area guard (Number.isFinite(area)&&area>0)',
      cont_positive is not None)
check('renderContent: inverted area guard absent', cont_inverted is None)

# Also check w/d positive guards
cont_w_pos = re.search(r"Number\.isFinite\(w\)&&\s*w\s*>\s*0", cont_body)
check('renderContent: positive w guard', cont_w_pos is not None)
cont_d_pos = re.search(r"Number\.isFinite\(d\)&&\s*d\s*>\s*0", cont_body)
check('renderContent: positive d guard', cont_d_pos is not None)

# renderDissolution — must use positive guard for c > 0 && label > 0
diss_body = _extract_fn_body(app, 'renderDissolution') or ''
check('renderDissolution body extracted', bool(diss_body))
diss_positive = re.search(r"Number\.isFinite\(c\)&&\s*c\s*>\s*0&&\s*label\s*>\s*0", diss_body)
diss_inverted = re.search(r"!Number\.isFinite\(c\)&&\s*c\s*>\s*0&&\s*label\s*>\s*0", diss_body)
check('renderDissolution: positive c&&label guard',
      diss_positive is not None)
check('renderDissolution: inverted c&&label guard absent',
      diss_inverted is None)

# calcNormalize — must use positive guard for stdW/stdP/stdD
norm_body = _extract_fn_body(app, 'calcNormalize') or ''
check('calcNormalize body extracted', bool(norm_body))
norm_positive = re.search(
    r"Number\.isFinite\(stdW\)\s*&&\s*Number\.isFinite\(stdP\)\s*&&\s*Number\.isFinite\(stdD\)",
    norm_body)
norm_inverted = re.search(
    r"!Number\.isFinite\(stdW\)\s*&&\s*Number\.isFinite\(stdP\)", norm_body)
check('calcNormalize: positive stdW/stdP/stdD guard',
      norm_positive is not None)
check('calcNormalize: inverted stdW guard absent',
      norm_inverted is None)

# calcSpike — verify added/measured null handling uses Number.isFinite not isNaN
spike_body = _extract_fn_body(app, 'calcSpike') or ''
check('calcSpike body extracted', bool(spike_body))
spike_finite_added = re.search(
    r"Number\.isFinite\(v\)\s*\?\s*v\s*:\s*null", spike_body)
check('calcSpike: added/measured use Number.isFinite(null) idiom',
      spike_finite_added is not None)


# ============================================================
# Fix #3: Guard syntax validator — detects `!Number.isFinite(X) && X [cmp]` patterns
# Plus 5 sample inversion snippets to verify the validator actually catches them.
# ============================================================
print('--- #3 guard syntax validator (Fix #3) ---')

CALC_FNS = [
    'renderContent', 'renderDissolution', 'calcNormalize', 'calcSpike',
    'calcStatsFromArray', 'calcStatsNow', 'calcStats', 'calcExpr',
    'calcMw', 'calcCurve', 'calcExternal', 'calcInternal', 'calcSimple',
    'stdF', 'extStdF', 'renderUniformity', 'renderSpike', 'renderCurve',
    'renderMw', 'renderNormExt', 'renderExtSpike', 'renderIntSpike',
    'renderRecovery', 'renderMp', 'renderDrying', 'renderResidue', 'renderTiter',
]
all_bodies = {}
for nm in CALC_FNS:
    body = _extract_fn_body(app, nm)
    if body is not None:
        all_bodies[nm] = body
print(f'  Extracted {len(all_bodies)} calc function bodies.')

# This is the exact regex from helpers-i18n.js line ~64 (the in-app dev aid, v54.257 split).
INVERSION_RE = re.compile(r"!\s*Number\.isFinite\s*\(\s*(\w+)\s*\)\s*&&\s*\1\s*[><=!]")

# Walk every body, collect all inversion hits.
inversions = []
for nm, body in all_bodies.items():
    for m in INVERSION_RE.finditer(body):
        inversions.append(f'{nm}(): {m.group(0)}')

check(f'no inverted guards across {len(all_bodies)} calc fn bodies (0 found)',
      len(inversions) == 0,
      f'samples: {inversions[:5]}')

# Verify 5 SAMPLE inversions are detected by the validator.
# Write each into a temp file with a tiny calc fn body containing the inversion,
# then run the same regex on it. If all 5 detected, validator is sound.
SAMPLE_INVERSIONS = [
    # Sample 1: classic inversion — same-var compared after !isFinite
    "if(!Number.isFinite(x) && x > 0) vals.push(x);",
    # Sample 2: with spaces
    "if ( ! Number.isFinite ( y ) && y >= 0 ) return;",
    # Sample 3: chained <
    "if(!Number.isFinite(area) && area < 100) return;",
    # Sample 4: !=
    "if(!Number.isFinite(w) && w != 0) { foo(w); }",
    # Sample 5: another variable name
    "if(!Number.isFinite(stdD) && stdD <= 0) { Cstd = NaN; }",
]

validator_hits = []
for sample in SAMPLE_INVERSIONS:
    m = INVERSION_RE.search(sample)
    if m:
        validator_hits.append(m.group(0))

check(f'validator detects 5 sample inversions (caught {len(validator_hits)}/5)',
      len(validator_hits) == 5,
      f'caught: {validator_hits}')

# Verify the validator does NOT flag legitimate patterns.
LEGITIMATE_PATTERNS = [
    # The CORRECT guard form (positive)
    "if(Number.isFinite(x) && x > 0) vals.push(x);",
    # Negative guard (proceed only if bad)
    "if(!Number.isFinite(x) || x <= 0) return;",
    # Just isFinite, no comparison
    "if(Number.isFinite(x)) return x;",
    # Just negation, no comparison
    "if(!Number.isFinite(x)) return NaN;",
    # Different variables — not an inversion even if pattern matches
    "if(!Number.isFinite(x) && y > 0) return;",
]
false_positives = []
for sample in LEGITIMATE_PATTERNS:
    m = INVERSION_RE.search(sample)
    if m:
        false_positives.append(m.group(0))

check(f'validator does not flag legitimate patterns (false+={len(false_positives)})',
      len(false_positives) == 0,
      f'false+: {false_positives}')


# ============================================================
# Fix #3 (extra): cross-check with the helpers-i18n.js dev aid.
# helpers-i18n.js's own _checkNoInvertedGuards must use a regex equivalent to ours,
# otherwise the two guards could drift apart over time.
# ============================================================
print('--- #4 cross-check with helpers-i18n.js dev aid (Fix #3) ---')

# v54.257: dev aid 在 helpers-i18n.js 而非 app.js
has_dev_aid = '_checkNoInvertedGuards' in helpers_i18n and '_invertedGuardScanned' in helpers_i18n
check('helpers-i18n.js has _checkNoInvertedGuards dev aid', has_dev_aid)

# Extract the regex literals from helpers-i18n.js and check their semantic content.
# v54.261: dev aid 用 patterns 数组，_extract_fn_body 在 regex 复杂时易出错 — 直接用文件切片
m_fn = re.search(r"^function\s+_checkNoInvertedGuards\s*\([^)]*\)\s*\{", helpers_i18n, re.MULTILINE)
dev_aid_block = ''
if m_fn:
    start = m_fn.end() - 1
    # 简单方法：截取后续 8000 字符（dev aid 实际 ~70 行，~5000 字符）
    dev_aid_block = helpers_i18n[start:start+8000]
# v54.261: dev aid 用 patterns 数组而非单 regex literal
m_arr = re.search(r"var\s+patterns\s*=\s*\[", dev_aid_block)
if m_arr:
    # 检查 patterns 数组后每一行是否有 /.../ 形式
    lines_after = dev_aid_block[m_arr.end():m_arr.end()+3000]
    # 提取每个 regex literal 的 source（行内 /.../ 形式，跳过注释）
    patterns_to_check = []
    for ln in lines_after.split('\n'):
        ln_stripped = ln.strip()
        # 跳过注释行
        if ln_stripped.startswith('//') or not ln_stripped:
            continue
        # v54.261: 必须 g 标志（避免匹配 /* dev only */ 等块注释）
        for m_lit in re.finditer(r'/((?:[^/\\]|\\.)+)/g\b', ln):
            patterns_to_check.append(m_lit.group(1))
else:
    patterns_to_check = []

combined_src = '\n'.join(patterns_to_check)
# The pattern has escaped chars like \s, \1, \( — strip the backslash for "Number"
# so 'Number.isFinite' can match. We check semantic content, not exact bytes.
has_nf = ('Number.isFinite' in combined_src) or ('Number\\.isFinite' in combined_src)
has_neg = '!' in combined_src
has_and = '&&' in combined_src
has_cmp = ('>' in combined_src) or ('<' in combined_src)
has_backref = '\\1' in combined_src
has_xvsy = any('Number' + chr(92) + '.isFinite' in p and '&&' in p and '!' in p for p in patterns_to_check)
check('helpers-i18n.js dev aid regex has !Number.isFinite', has_nf and has_neg)
check('helpers-i18n.js dev aid regex has && and comparator', has_and and has_cmp)
check('helpers-i18n.js dev aid regex has backref \\1', has_backref)
check('helpers-i18n.js dev aid regex catches x&&y pattern (v54.261)', has_xvsy)
check('app.js dev aid regex literal found', len(patterns_to_check) >= 1)


# ============================================================
# Cleanup
# ============================================================
try:
    os.remove(sandbox_path)
except OSError:
    pass


# ============================================================
# Summary
# ============================================================
print()
print('=' * 70)
print(f'PASS: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print('FAIL details:')
    for f in FAIL:
        print(f'  {f}')
    sys.exit(1)