#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.323：填充 Digital Asset Links（assetlinks.json）

根据域名 + 签名指纹生成 TWA 所需的 assetlinks.json。

用法：
  python tools/fill_assetlinks.py --domain rsd-calc.example.com \
      --fingerprint "AA:BB:CC:...:99"
  python tools/fill_assetlinks.py --domain example.com --fingerprint auto \
      --keystore android.keystore --alias android

输出：
  .well-known/assetlinks.json（需部署到 https://域名/.well-known/assetlinks.json）
"""
import re
import sys
import json
import argparse
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(r'F:\自制软件')
TEMPLATE = ROOT / 'twa' / 'assetlinks.template.json'
DEFAULT_PACKAGE = 'com.haizhou.rsdcalc'


def get_fingerprint_from_keystore(keystore, alias):
    """从 keystore 提取 SHA-256 指纹（需要 keytool 在 PATH）。"""
    import subprocess
    try:
        result = subprocess.run(
            ['keytool', '-list', '-v', '-keystore', keystore, '-alias', alias],
            capture_output=True, text=True, encoding='utf-8', errors='ignore'
        )
    except FileNotFoundError:
        print('  ERROR: 找不到 keytool（需要 JDK）。请手动提供 --fingerprint')
        sys.exit(1)
    if result.returncode != 0:
        print(f'  ERROR: keytool 失败: {result.stderr[:200]}')
        sys.exit(1)
    m = re.search(r'SHA256:\s*([0-9A-F:]{95})', result.stdout)
    if not m:
        print('  ERROR: 未找到 SHA256 指纹')
        sys.exit(1)
    return m.group(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--domain', required=True, help='PWA 域名（不含 https://）')
    parser.add_argument('--fingerprint', required=True,
                        help='SHA-256 指纹（AA:BB:...）或 "auto"（从 keystore 提取）')
    parser.add_argument('--package', default=DEFAULT_PACKAGE, help='Android packageId')
    parser.add_argument('--keystore', help='keystore 路径（--fingerprint auto 时必需）')
    parser.add_argument('--alias', default='android', help='keystore alias')
    parser.add_argument('--out', help='输出路径（默认 .well-known/assetlinks.json）')
    args = parser.parse_args()

    if args.fingerprint == 'auto':
        if not args.keystore:
            print('  ERROR: --fingerprint auto 需要 --keystore')
            sys.exit(1)
        print(f'从 keystore 提取指纹: {args.keystore}')
        fingerprint = get_fingerprint_from_keystore(args.keystore, args.alias)
        print(f'  SHA-256: {fingerprint}')
    else:
        fingerprint = args.fingerprint

    # 规范化指纹（去空格、大写）
    fingerprint = fingerprint.strip().upper()

    # 优先用模板
    if TEMPLATE.exists():
        data = json.loads(TEMPLATE.read_text(encoding='utf-8'))
    else:
        data = [{
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {"namespace": "android_app", "package_name": args.package,
                       "sha256_cert_fingerprints": []}
        }]

    data[0]['target']['package_name'] = args.package
    data[0]['target']['sha256_cert_fingerprints'] = [fingerprint]

    out_path = Path(args.out) if args.out else ROOT / '.well-known' / 'assetlinks.json'
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'\n[OK] 已生成: {out_path}')
    print(f'  域名:    {args.domain}')
    print(f'  包名:    {args.package}')
    print(f'  指纹:    {fingerprint}')
    print(f'\n部署到: https://{args.domain}/.well-known/assetlinks.json')
    print('验证:   https://developers.google.com/digital-asset-links/tools/generator')


if __name__ == '__main__':
    main()
