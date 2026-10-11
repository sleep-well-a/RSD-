#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.298 alertEn 兜底补全脚本

策略：用 Node vm 加载 i18n-en.js / i18n-zh.js，提取所有 keys + 序列化值。
然后把 en 中所有不在 alertEn 的 key 加到 alertEn。
"""
import subprocess
import json
import re
import sys

ALERT_FILE = r'F:\自制软件\i18n-alert.js'
NODE_HELPER = r'F:\自制软件\tools\_extract_dict.js'


def run_extract(basename, export_name):
    """Run node helper to extract dict as JSON lines."""
    p = subprocess.run(
        ['node', NODE_HELPER, basename, export_name],
        capture_output=True, text=True, encoding='utf-8'
    )
    if p.returncode != 0:
        print(f'NODE ERROR: {p.stderr[:500]}')
        sys.exit(1)
    result = {}
    for line in p.stdout.split('\n'):
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        result[obj['k']] = obj['v']
    return result


def main():
    print('Extracting en dict via Node...')
    en_dict = run_extract('i18n-en.js', 'I18N_EN')
    print(f'en dict loaded: {len(en_dict)} keys')

    print('Extracting zh dict via Node...')
    zh_dict = run_extract('i18n-zh.js', 'I18N_ZH')
    print(f'zh dict loaded: {len(zh_dict)} keys')

    alert_text = open(ALERT_FILE, 'r', encoding='utf-8').read()
    alert_keys = set(re.findall(r'^\s*([a-zA-Z][\w-]*)\s*:', alert_text, re.MULTILINE))
    print(f'alert dict: {len(alert_keys)} keys')

    missing_en = set(en_dict.keys()) - alert_keys
    missing_zh = set(zh_dict.keys()) - alert_keys
    print(f'en - alert: {len(missing_en)}')
    print(f'zh - alert: {len(missing_zh)}')

    # Build additions: en keys → use en value
    additions = []
    for k in sorted(missing_en):
        if k in en_dict:
            additions.append((k, en_dict[k]))

    # zh-only keys → use zh value
    zh_only = set(zh_dict.keys()) - set(en_dict.keys())
    for k in sorted(missing_zh):
        if k in zh_only and k in zh_dict:
            additions.append((k, zh_dict[k]))
            print(f'  zh-only add: {k} = {str(zh_dict[k])[:50]}')

    print(f'Total additions: {len(additions)}')

    # Build new entries (sorted alphabetically)
    new_lines = []
    for k, v in additions:
        # Quote key if it has hyphens (kebab-case) — invalid as bare identifier
        key_str = f"'{k}'" if '-' in k else k
        if isinstance(v, str):
            js_val = json.dumps(v, ensure_ascii=False)
            new_lines.append(f'    {key_str}: {js_val},')
        elif isinstance(v, bool):
            new_lines.append(f'    {key_str}: {"true" if v else "false"},')
        elif isinstance(v, (int, float)):
            new_lines.append(f'    {key_str}: {v},')
        elif v is None:
            new_lines.append(f'    {key_str}: null,')
        else:
            new_lines.append(f'    {key_str}: {json.dumps(v, ensure_ascii=False)},')

    # Insert into alert
    m = re.search(r'(window\.I18N_ALERT\s*=\s*\{)(.*?)(\n\}\s*;?\s*$)', alert_text, re.DOTALL)
    if not m:
        print('ERROR: cannot parse alert dict structure')
        sys.exit(1)

    pre = alert_text[:m.end(1)]
    body = m.group(2)
    post = alert_text[m.start(3):]

    new_body = body.rstrip()
    if new_body.endswith(','):
        new_body = new_body + '\n' + '\n'.join(new_lines) + '\n'
    else:
        new_body = new_body + ',\n' + '\n'.join(new_lines) + '\n'

    new_alert = pre + new_body + post

    with open(ALERT_FILE, 'w', encoding='utf-8') as f:
        f.write(new_alert)

    new_keys = set(re.findall(r'^\s*([a-zA-Z][\w-]*)\s*:', new_alert, re.MULTILINE))
    print(f'\nAfter patch: alert has {len(new_keys)} keys')
    print(f'zh - alert: {len(set(zh_dict.keys()) - new_keys)}')
    print(f'en - alert: {len(set(en_dict.keys()) - new_keys)}')


if __name__ == '__main__':
    main()
