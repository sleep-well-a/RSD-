#!/usr/bin/env python3
# v54.217 run_all_tests.py: 一次跑所有测试套件
# v54.227 run_all_tests.py: 添加 e2e_puppeteer_storage_sync_keys.js
"""
统一入口：
  python tests/run_all_tests.py
"""
# v54.284 工具链：静态扫描器（v54.248-283 七轮复盘教训防御层）
import subprocess
for tool in [
    'tools/scan_i18n_hardcoded.py',
    'tools/scan_html_typos.py',
    'tools/audit_a11y_aria.py',
]:
    r = subprocess.run(['python', tool], cwd='F:/自制软件')
    if r.returncode != 0:
        print('[FAIL] ' + tool + ' exit=' + str(r.returncode), file=sys.stderr)
        sys.exit(1)

import subprocess
import sys
import os
import io

# v54.231: 把 stdout/stderr 切到 UTF-8（Windows 默认 GBK 会让中文 / ✓ 抛 UnicodeEncodeError）
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 切到项目根目录
PROJECT_ROOT = r'F:\自制软件'

def run_test(name, cmd, cwd=PROJECT_ROOT, timeout=180):
    print()
    print('=' * 70)
    print(f'> {name}')
    print('=' * 70)
    # v54.231 fix: Windows 默认 GBK 让中文 / 勾号（✓）打印抛错。
    # 给子进程注入 PYTHONIOENCODING=utf-8，node 输出也按 UTF-8 解码。
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=False,
            timeout=timeout,
            env=env,
        )
        try:
            stdout = result.stdout.decode('utf-8', errors='replace')
        except Exception:
            stdout = result.stdout.decode('gbk', errors='replace') if result.stdout else ''
        try:
            stderr = result.stderr.decode('utf-8', errors='replace')
        except Exception:
            stderr = result.stderr.decode('gbk', errors='replace') if result.stderr else ''
        if stdout:
            print(stdout)
        if stderr and result.returncode != 0:
            print('STDERR:', stderr)
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print(f'[*] TIMEOUT after {timeout}s')
        return False
    except Exception as e:
        print(f'[EXCEPTION]: {e}')
        return False


def run_test_with_retry(name, cmd, cwd=PROJECT_ROOT, max_retry=2):
    """v54.272 Puppeteer runner 修复：Puppeteer 偶发启动失败（navigation timeout / connection refused /
    偶发 Chrome 进程卡死）时自动重试。最多重试 2 次 = 共 3 次尝试。
    与基线 run_test 等价，但 flaky 测试会被自动救回。"""
    for attempt in range(max_retry + 1):
        if attempt > 0:
            print(f'\n[RETRY {attempt}/{max_retry}] {name} (Puppeteer 偶发失败，自动重试)\n')
        ok = run_test(name, cmd, cwd=cwd)
        if ok:
            return True
    return False

def main():
    suites = [
        ('[1] e2e.py (静态文件测试)', ['python', 'tests/e2e.py']),
        ('[2] e2e_advanced.py (高级静态测试)', ['python', 'tests/e2e_advanced.py']),
        ('[3] e2e_browser.py (i18n 静态测试)', ['python', 'tests/e2e_browser.py']),
        ('[4] e2e_puppeteer.js (Puppeteer i18n 测试)', ['node', 'tests/e2e_puppeteer.js']),
        ('[5] e2e_puppeteer_interactions.js (Puppeteer 交互测试)', ['node', 'tests/e2e_puppeteer_interactions.js']),
        ('[6] e2e_puppeteer_forms.js (Puppeteer 表单+持久化)', ['node', 'tests/e2e_puppeteer_forms.js']),
        ('[7] e2e_puppeteer_calc.js (Puppeteer 计算功能)', ['node', 'tests/e2e_puppeteer_calc.js']),
        ('[8] e2e_puppeteer_export.js (Puppeteer 数据导出)', ['node', 'tests/e2e_puppeteer_export.js']),
        ('[9] e2e_puppeteer_history.js (Puppeteer 历史记录)', ['node', 'tests/e2e_puppeteer_history.js']),
        ('[10] e2e_puppeteer_debug_tag.js (Puppeteer debug-tag 提示)', ['node', 'tests/e2e_puppeteer_debug_tag.js']),
        ('[11] e2e_puppeteer_multi_tab.js (Puppeteer 多 tab 同步)', ['node', 'tests/e2e_puppeteer_multi_tab.js']),
        ('[12] e2e_puppeteer_print.js (Puppeteer 打印预览)', ['node', 'tests/e2e_puppeteer_print.js']),
        ('[13] e2e_puppeteer_storage_sync_keys.js (Puppeteer 5-key 同步)', ['node', 'tests/e2e_puppeteer_storage_sync_keys.js']),
        ('[14] e2e_puppeteer_audit_fixes.js (Puppeteer 5 个审计修复)', ['node', 'tests/e2e_puppeteer_audit_fixes.js']),
        ('[15] e2e_puppeteer_audit_round2.js (Puppeteer 二轮 10 bug 修复)', ['node', 'tests/e2e_puppeteer_audit_round2.js']),
        ('[16] e2e_puppeteer_audit_round3.js (Puppeteer 三轮 10 HIGH 修复)', ['node', 'tests/e2e_puppeteer_audit_round3.js']),
        ('[17] e2e_puppeteer_audit_round3_followup.js (Puppeteer 三轮 MEDIUM/LOW 续修)', ['node', 'tests/e2e_puppeteer_audit_round3_followup.js']),
        ('[18] e2e_puppeteer_audit_round4_p0.js (Puppeteer Round 4 P0 修复)', ['node', 'tests/e2e_puppeteer_audit_round4_p0.js']),
        ('[19] e2e_puppeteer_audit_round4_p1.js (Puppeteer Round 4 P1 修复)', ['node', 'tests/e2e_puppeteer_audit_round4_p1.js']),
        ('[20] e2e_puppeteer_audit_round4_p2.js (Puppeteer Round 4 P2 MEDIUM/LOW)', ['node', 'tests/e2e_puppeteer_audit_round4_p2.js']),
        ('[21] e2e_puppeteer_audit_round4_p3.js (Puppeteer Round 4 P3 MEDIUM/LOW)', ['node', 'tests/e2e_puppeteer_audit_round4_p3.js']),
        ('[22] e2e_puppeteer_audit_round4_p4.js (Puppeteer Round 4 P4 7 个 P2 漏网 clear)', ['node', 'tests/e2e_puppeteer_audit_round4_p4.js']),
        ('[23] e2e_puppeteer_audit_round4_p4_extended.js (Puppeteer Round 4 P4 D#1-D#5)', ['node', 'tests/e2e_puppeteer_audit_round4_p4_extended.js']),
        ('[24] e2e_puppeteer_audit_round5.js (Puppeteer Round 5 6 硬编码 confirm i18n)', ['node', 'tests/e2e_puppeteer_audit_round5.js']),
        ('[25] e2e_puppeteer_audit_round5_p1.js (Puppeteer Round 5 P1 agent 报 10 bug)', ['node', 'tests/e2e_puppeteer_audit_round5_p1.js']),
        ('[26] e2e_puppeteer_audit_round7.py (Round 7 mpBatch + iCal i18n)', ['python', 'tests/e2e_puppeteer_audit_round7.py']),
        ('[27] e2e_puppeteer_audit_round8.py (Round 8 4维度审计修复)', ['python', 'tests/e2e_puppeteer_audit_round8.py']),
        ('[28] e2e_puppeteer_audit_round9.py (Round 9 4维度 P1 修复)', ['python', 'tests/e2e_puppeteer_audit_round9.py']),
        ('[29] e2e_puppeteer_audit_round10.py (Round 10 4维度深度 P1 修复)', ['python', 'tests/e2e_puppeteer_audit_round10.py']),
        ('[30] e2e_puppeteer_audit_round11.py (Round 11 4维度终轮)', ['python', 'tests/e2e_puppeteer_audit_round11.py']),
        ('[31] e2e_puppeteer_audit_round12.py (Round 12 4维度 final cleanup)', ['python', 'tests/e2e_puppeteer_audit_round12.py']),
        ('[32] e2e_puppeteer_audit_round13.py (Round 13 4维度 final)', ['python', 'tests/e2e_puppeteer_audit_round13.py']),
        ('[33] e2e_puppeteer_audit_round14.py (Round 14 4维度 final)', ['python', 'tests/e2e_puppeteer_audit_round14.py']),
        ('[34] e2e_puppeteer_audit_round15.py (Round 15 i18n 拆分)', ['python', 'tests/e2e_puppeteer_audit_round15.py']),
        ('[35] e2e_puppeteer_audit_round16.py (Round 16 4维度 final)', ['python', 'tests/e2e_puppeteer_audit_round16.py']),
        ('[36] e2e_puppeteer_audit_round17.py (Round 17 i18n fallback chain hardening)', ['python', 'tests/e2e_puppeteer_audit_round17.py']),
        ('[37] e2e_puppeteer_audit_round19.py (Round 19 critical fix + final)', ['python', 'tests/e2e_puppeteer_audit_round19.py']),
        ('[38] e2e_puppeteer_audit_round20.py (Round 20 inverted-guard regression)', ['python', 'tests/e2e_puppeteer_audit_round20.py']),
        ('[39] e2e_puppeteer_audit_round27.js (Round 27 P1 a11y 修复)', ['node', 'tests/e2e_puppeteer_audit_round27.js']),
        ('[40] e2e_puppeteer_audit_round28.js (Round 28 input/table aria-label)', ['node', 'tests/e2e_puppeteer_audit_round28.js']),
        ('[41] e2e_puppeteer_audit_round29.js (Round 29 i18n leak + title 同步)', ['node', 'tests/e2e_puppeteer_audit_round29.js']),
        ('[42] e2e_puppeteer_audit_round30.js (Round 30 select/textarea a11y)', ['node', 'tests/e2e_puppeteer_audit_round30.js']),
        ('[43] e2e_puppeteer_audit_round31.js (Round 31 重量单位切换 mg ↔ g)', ['node', 'tests/e2e_puppeteer_audit_round31.js']),
        ('[44] e2e_puppeteer_audit_round32.js (Round 32 4 维度审计 10 bug 修复)', ['node', 'tests/e2e_puppeteer_audit_round32.js']),
        ('[45] e2e_puppeteer_audit_contrast.js (v54.272 WCAG AA 色对比度)', ['node', 'tests/e2e_puppeteer_audit_contrast.js']),
        ('[46] e2e_puppeteer_p2_chart_legend.js (v54.272 P2 chart legend + canvas aria-label i18n)', ['node', 'tests/e2e_puppeteer_p2_chart_legend.js']),
        ('[47] e2e_puppeteer_b1_correctness.js (v54.272 B1 correctness 4 bug fix)', ['node', 'tests/e2e_puppeteer_b1_correctness.js']),
        ('[48] e2e_puppeteer_b2_i18n.js (v54.272 B2 i18n 6 bug fix)', ['node', 'tests/e2e_puppeteer_b2_i18n.js']),
        ('[49] e2e_puppeteer_b3_a11y.js (v54.272 B3 a11y 4 bug fix)', ['node', 'tests/e2e_puppeteer_b3_a11y.js']),
        ('[50] e2e_puppeteer_b4_perf.js (v54.272 B4 perf 5 bug fix)', ['node', 'tests/e2e_puppeteer_b4_perf.js']),
        ('[51] e2e_puppeteer_round33_critical.js (v54.273 Round 33 critical 8 bug fix)', ['node', 'tests/e2e_puppeteer_round33_critical.js']),
        ('[52] e2e_puppeteer_round34_critical.js (v54.274 Round 34 critical 5 bug fix)', ['node', 'tests/e2e_puppeteer_round34_critical.js']),
        ('[53] e2e_puppeteer_round35_critical.js (v54.281 Round 35 critical + HIGH 10 bug fix)', ['node', 'tests/e2e_puppeteer_round35_critical.js']),
        ('[54] e2e_puppeteer_round36_perf.js (v54.282 Round 36 perf 第二波)', ['node', 'tests/e2e_puppeteer_round36_perf.js']),
        ('[55] e2e_puppeteer_round37_perf.js (v54.282 Round 37 perf 第三波 split/join + debounce)', ['node', 'tests/e2e_puppeteer_round37_perf.js']),
        ('[56] e2e_puppeteer_round38_a11y.js (v54.282 Round 38 a11y 第二波 calc-key + titer pill)', ['node', 'tests/e2e_puppeteer_round38_a11y.js']),
        ('[57] e2e_puppeteer_round39_audit.js (v54.283 Round 39 audit fix 5 HIGH)', ['node', 'tests/e2e_puppeteer_round39_audit.js']),
        ('[58] e2e_puppeteer_round39_v2.js (v54.283 Round 39 第二轮 histType map + tooltip + cache)', ['node', 'tests/e2e_puppeteer_round39_v2.js']),
    ]

    print('=' * 70)
    print('RSD Calculator - v54.254 全量测试')
    print('=' * 70)

    passed = []
    failed = []

    for name, cmd in suites:
        ok = run_test_with_retry(name, cmd)
        if ok:
            passed.append(name)
        else:
            failed.append(name)

    print()
    print('=' * 70)
    print('Summary')
    print('=' * 70)
    print(f'[PASS] {len(passed)}/{len(suites)}')
    for n in passed:
        print(f'   {n}')
    if failed:
        print(f'[FAIL] {len(failed)}')
        for n in failed:
            print(f'   {n}')
    print('=' * 70)

    return 0 if not failed else 1

if __name__ == '__main__':
    sys.exit(main())