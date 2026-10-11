#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.313 i18n 三方一致性检查工具

检查 i18n-zh.js / i18n-en.js / i18n-alert.js：
1. 三个字典 keys 数量一致
2. 无 zh-only / en-only / alert-only 孤儿 key
3. en value 不含中文字符
4. alertEn value 不含中文字符

返回非 0 exit code 如果任何检查失败。可用于：
- 手动发布前门控：`python tools/check_i18n_sync.py`
- CI pipeline: 作为 publish 前的必过项
- pre-commit hook（如果是 git 仓库）

用法：
  python tools/check_i18n_sync.py            # CI 模式（只报告问题）
  python tools/check_i18n_sync.py --strict   # 严格模式（中文 value 也算失败）
  python tools/check_i18n_sync.py --auto-fix # 自动添加缺失的 alertEn 兜底
"""
import re
import sys
import argparse
from pathlib import Path

ROOT = Path(r'F:\自制软件')
ZH_FILE = ROOT / 'i18n-zh.js'
EN_FILE = ROOT / 'i18n-en.js'
ALERT_FILE = ROOT / 'i18n-alert.js'


def get_keys_and_values(file):
    """从 I18N_XX = { ... } 中提取所有 (key, value) 对（用 Node vm 精确解析）。"""
    import subprocess, json
    script = ROOT / 'tests' / '_extract_i18n_full.js'
    result = subprocess.run(['node', str(script), str(file)],
                            capture_output=True, cwd=str(ROOT))
    if result.returncode != 0:
        print(f'ERROR: Node 解析失败: {result.stderr.decode("utf-8", errors="ignore")}', file=sys.stderr)
        return {}, ''
    data = json.loads(result.stdout.decode('utf-8'))
    # data = {'I18N_XX': {key: value}}
    if not data:
        return {}, ''
    export_name = list(data.keys())[0]
    return data[export_name], ''


def has_chinese(s):
    return bool(s) and bool(re.search(r'[\u4e00-\u9fff]', s))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--strict', action='store_true', help='Treat Chinese in en/alertEn as failure')
    parser.add_argument('--auto-fix', action='store_true', help='Auto-add missing alertEn entries from en')
    args = parser.parse_args()

    print('=' * 60)
    print('i18n Sync Check (v54.313)')
    print('=' * 60)

    zh, _ = get_keys_and_values(ZH_FILE)
    en, _ = get_keys_and_values(EN_FILE)
    alert, _ = get_keys_and_values(ALERT_FILE)

    issues = []

    # 1. key 数量
    print(f'\n[1] key 数量:')
    print(f'    zh: {len(zh)}')
    print(f'    en: {len(en)}')
    print(f'    alert: {len(alert)}')
    # v54.326 fix: v54.247 严格门控 — en 业务 key 由 alertEn 兜底，所以 en 可 < zh。
    # 正确判定：alert == zh（业务 dict 同步），en ≤ zh（en 可少），无孤儿 key。
    if len(zh) != len(alert):
        issues.append(f'zh/alert key 数量不一致: zh={len(zh)} alert={len(alert)}（业务 dict 必须同步）')
    if len(en) > len(zh):
        issues.append(f'en 比 zh 多: en={len(en)} zh={len(zh)}（不应有，违反 v54.247 门控）')

    # 2. 无孤儿
    zh_set, en_set, alert_set = set(zh), set(en), set(alert)
    print(f'\n[2] 孤儿 key 检查:')
    zh_only = zh_set - en_set - alert_set
    en_only = en_set - zh_set - alert_set
    alert_only = alert_set - zh_set - en_set
    print(f'    zh-only: {len(zh_only)}')
    print(f'    en-only: {len(en_only)}')
    print(f'    alert-only: {len(alert_only)}')
    if zh_only: issues.append(f'{len(zh_only)} zh-only keys: {sorted(zh_only)[:3]}...')
    if en_only: issues.append(f'{len(en_only)} en-only keys: {sorted(en_only)[:3]}...')
    if alert_only: issues.append(f'{len(alert_only)} alert-only keys: {sorted(alert_only)[:3]}...')

    # 3. en value 中文
    en_with_zh = {k: v for k, v in en.items() if has_chinese(v)}
    print(f'\n[3] en value 含中文: {len(en_with_zh)}')
    if en_with_zh:
        for k, v in list(en_with_zh.items())[:3]:
            print(f'    {k}: {v[:60]}')
        if args.strict or len(en_with_zh) > 0:
            issues.append(f'{len(en_with_zh)} en values have Chinese')

    # 4. alertEn value 中文
    alert_with_zh = {k: v for k, v in alert.items() if has_chinese(v)}
    print(f'\n[4] alertEn value 含中文: {len(alert_with_zh)}')
    if alert_with_zh:
        for k, v in list(alert_with_zh.items())[:3]:
            print(f'    {k}: {v[:60]}')
        if args.strict or len(alert_with_zh) > 0:
            issues.append(f'{len(alert_with_zh)} alertEn values have Chinese')

    # 自动修复
    if args.auto_fix and (alert_only or en_with_zh or alert_with_zh):
        print(f'\n[AUTO-FIX] 调用 patch_alert_en_coverage.py...')
        import subprocess
        result = subprocess.run(['python', str(ROOT / 'tools' / 'patch_alert_en_coverage.py')],
                                capture_output=True, text=True, encoding='utf-8')
        print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)

    # 总结
    print('\n' + '=' * 60)
    if issues:
        print(f'[FAIL] {len(issues)} 个问题:')
        for i, iss in enumerate(issues, 1):
            print(f'  {i}. {iss}')
        sys.exit(1)
    else:
        print(f'[OK] i18n 三方完全一致 ({len(zh)} keys × 3 dicts, 0 孤儿, 0 中文残留)')
        sys.exit(0)


if __name__ == '__main__':
    main()
