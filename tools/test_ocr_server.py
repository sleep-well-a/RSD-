#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.325：OCR 后端服务的本地测试 / 启动辅助

包含 3 个模式：
  --smoke     : 用 Flask test_client 跑 /health / 400 / CORS（无需真启动 OCR）
  --start     : 后台启动 ocr_server.py（需用户授权，因为会调用 run_pipeline）
  --probe     : 探测现有 8766 端口的 OCR 服务是否在线

用法：
  python tools/test_ocr_server.py --smoke
  python tools/test_ocr_server.py --probe
  python tools/test_ocr_server.py --start        # 后台启动
"""
import sys
import time
import argparse
import subprocess
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(r'F:\自制软件')
OCR_SERVER = ROOT / 'tools' / 'ocr_server.py'


def smoke():
    """用 Flask test_client 跑 /health + 错误路径 + CORS（无需启动）。"""
    print('OCR server smoke test (Flask test_client)')
    print('=' * 60)
    sys.path.insert(0, str(ROOT / 'tools'))
    from ocr_server import app, PADDLEOCR_RUNNER

    PASS = []
    FAIL = []

    def check(name, ok, detail=''):
        if ok:
            PASS.append(name)
            print(f'  [OK]   {name}' + (f' -- {detail}' if detail else ''))
        else:
            FAIL.append(name)
            print(f'  [FAIL] {name}' + (f' -- {detail}' if detail else ''))

    with app.test_client() as c:
        # /health
        r = c.get('/health')
        check('GET /health 200', r.status_code == 200, f'rc={r.status_code}')
        j = r.json or {}
        check('service = rsd-ocr-server', j.get('service') == 'rsd-ocr-server')
        check('paddleocr_skill 存在', j.get('paddleocr_skill') is True)
        check('runner_exists', j.get('runner_exists') is True)
        check('output_dir 已配置', bool(j.get('output_dir')))

        # 错误路径
        r = c.post('/ocr/extract')
        check('POST /ocr/extract 无文件返回 400', r.status_code == 400)
        check('错误信息为中文', '缺少' in (r.json or {}).get('error', ''))

        r = c.post('/ocr/extract', data={'pdf': (b'not pdf', 'test.txt')},
                   content_type='multipart/form-data')
        check('非 PDF 文件返回 400', r.status_code == 400)

        # CORS preflight
        r = c.options('/ocr/extract')
        check('OPTIONS 204', r.status_code == 204)
        check('CORS header = *', r.headers.get('Access-Control-Allow-Origin') == '*')
        check('CORS methods 含 POST', 'POST' in (r.headers.get('Access-Control-Allow-Methods') or ''))

    check('paddleocr runner 路径正确', PADDLEOCR_RUNNER.exists(), str(PADDLEOCR_RUNNER))

    print('=' * 60)
    total = len(PASS) + len(FAIL)
    print(f'PASS: {len(PASS)}/{total}')
    if FAIL:
        print(f'FAIL: {len(FAIL)}')
        sys.exit(1)
    print('[OK] ocr_server.py 结构正确（真实 OCR 调用需启动服务后跑 PDF）')


def probe():
    """探测 8766 端口是否有 OCR 服务在线。"""
    import urllib.request
    print('Probe OCR server @ http://localhost:8766')
    print('=' * 60)
    try:
        with urllib.request.urlopen('http://localhost:8766/health', timeout=3) as r:
            print(f'  [OK] HTTP {r.status}')
            print(f'  body: {r.read().decode("utf-8")}')
    except urllib.error.URLError as e:
        print(f'  [FAIL] 服务未运行或不可达: {e.reason}')
        print()
        print('启动方法：')
        print('  python tools/ocr_server.py --port 8766')
        sys.exit(1)


def start():
    """后台启动 OCR server。"""
    print(f'后台启动 OCR server: {OCR_SERVER}')
    print('=' * 60)
    log_path = ROOT / '_backups' / 'ocr_server.log'
    log_path.parent.mkdir(exist_ok=True)
    # Windows: 用 CREATE_NEW_PROCESS_GROUP 便于后台
    proc = subprocess.Popen(
        [sys.executable, str(OCR_SERVER), '--port', '8766'],
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0,
        stdout=open(log_path, 'ab'),
        stderr=subprocess.STDOUT,
    )
    print(f'  PID: {proc.pid}')
    print(f'  log: {log_path}')
    # 等 3 秒看启动状态
    time.sleep(3)
    import urllib.request
    try:
        with urllib.request.urlopen('http://localhost:8766/health', timeout=3) as r:
            print(f'  [OK] 服务已启动: HTTP {r.status}')
    except Exception as e:
        print(f'  [WARN] 3 秒内未响应（可能启动慢）: {e}')
    print()
    print('停止：taskkill /F /PID', proc.pid)


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--smoke', action='store_true', help='本地 Flask test_client 烟雾测试')
    group.add_argument('--probe', action='store_true', help='探测现有 8766 服务')
    group.add_argument('--start', action='store_true', help='后台启动 OCR server')
    args = parser.parse_args()

    if args.smoke:
        smoke()
    elif args.probe:
        probe()
    elif args.start:
        start()


if __name__ == '__main__':
    main()
