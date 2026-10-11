#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.325 / v54.332：RSD & 含量计算器 — OCR 后端服务

包装 paddleocr skill 的 run_pipeline.py，提供 HTTP API 让浏览器 PWA 调用。

API（v54.332 新增进度轮询）：
  GET  /health                  — 健康检查
  POST /ocr/start                — 上传 PDF → 异步启动 → 返回 job_id
  GET  /ocr/status/<job_id>      — 查询进度（status / stage / progress / result）
  POST /ocr/extract              — 同步版本（v54.332 保留兜底）
  GET  /reports/<job_id>/...     — OCR 生成的 HTML 报告

start 参数：
  pdf     = PDF 文件
  keys    = 字段列表（逗号分隔，可选；默认 ['RSD', '含量', '回收率']）
  backend = local|baidu|vision|glm（默认 local）

status 返回：
  { "status": "running|done|error",
    "stage": "split|text|keys|table|done"（run_pipeline.py 4 阶段）,
    "progress": 0-100,
    "elapsed_sec": 12.3,
    "result": {fields, elapsed_sec, ...}（status=done 时）,
    "error": "..."（status=error 时）}

启动：
  python tools/ocr_server.py --port 8766
"""
import re
import sys
import json
import time
import threading
import argparse
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, abort

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# paddleocr skill 路径
PADDLEOCR_SKILL = Path(r'C:\Users\sleep well\.claude\skills\paddleocr')
PADDLEOCR_SCRIPTS = PADDLEOCR_SKILL / 'scripts'
PADDLEOCR_RUNNER = PADDLEOCR_SCRIPTS / 'run_pipeline.py'

# 默认字段
DEFAULT_KEYS = ['RSD', '含量', '回收率', '均值', '标准差', '样品名', '批号']

# 输出目录
OUTPUT_BASE = Path(tempfile.gettempdir()) / 'rsd_ocr_jobs'
OUTPUT_BASE.mkdir(exist_ok=True)

# v54.332：阶段识别（parse stdout 提取阶段信息）
STAGE_PATTERNS = [
    (r'Stage 1 拆页', 'split'),
    (r'Stage 2A', 'text'),
    (r'Stage 2B 表格', 'table'),
    (r'Stage 2C 字段', 'keys'),
    (r'Stage 3 聚合', 'done'),
]
STAGE_PROGRESS = {'split': 20, 'text': 50, 'keys': 80, 'table': 70, 'done': 95}

app = Flask(__name__)


@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


def parse_stage(line):
    for pattern, stage in STAGE_PATTERNS:
        if re.search(pattern, line):
            return stage
    return None


def write_status(job_dir, status_data):
    try:
        (job_dir / 'status.json').write_text(
            json.dumps(status_data, ensure_ascii=False) + '\n', encoding='utf-8')
    except Exception:
        pass


def _collect_raw_text(job_dir):
    """v54.333：合并 job_dir/pages/*.txt 为 raw_text 字段（OCR 全文）。"""
    pages_dir = job_dir / 'pages'
    if not pages_dir.exists():
        return ''
    texts = []
    for txt in sorted(pages_dir.glob('*.txt')):
        try:
            texts.append(f'--- {txt.name} ---\n' + txt.read_text(encoding='utf-8', errors='ignore'))
        except Exception:
            pass
    return '\n\n'.join(texts)


def run_pipeline_background(job_dir, pdf_path, keys, backend):
    """v54.332：后台跑 pipeline，更新 status.json。"""
    cmd = [
        sys.executable, str(PADDLEOCR_RUNNER),
        '--pdf', str(pdf_path), '--out', str(job_dir),
        '--backend', backend, '--mode', 'all',
    ]
    if keys:
        prompts = {k: f'请从报告中提取{k}（含数值与单位）' for k in keys}
        cmd.extend(['--prompts', json.dumps(prompts, ensure_ascii=False)])

    write_status(job_dir, {
        'status': 'running', 'stage': 'split', 'progress': 0,
        'elapsed_sec': 0, 'job_id': job_dir.name,
    })

    start = time.time()
    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding='utf-8', errors='ignore',
        )
        for line in proc.stdout:
            stage = parse_stage(line)
            if stage:
                elapsed = round(time.time() - start, 1)
                write_status(job_dir, {
                    'status': 'running', 'stage': stage,
                    'progress': STAGE_PROGRESS.get(stage, 50),
                    'elapsed_sec': elapsed, 'job_id': job_dir.name,
                })
        proc.wait(timeout=180)
        if proc.returncode != 0:
            raise RuntimeError(f'pipeline 失败 (rc={proc.returncode})')

        elapsed = round(time.time() - start, 1)
        fields_path = job_dir / 'fields.json'
        fields = json.loads(fields_path.read_text(encoding='utf-8')) if fields_path.exists() else {}
        report_path = job_dir / 'report.html'
        # v54.333：收集 raw_text（用户可手动看/复制原始文本）
        raw_text = _collect_raw_text(job_dir)
        # v54.333：列出可用的表格（如果有 PPStructureV3 输出）
        tables_dir = job_dir / 'tables'
        tables = []
        if tables_dir.exists():
            for html in sorted(tables_dir.glob('*.html')):
                tables.append({'file': html.name, 'url': f'/reports/{job_dir.name}/{html.name}'})
        result = {
            'fields': fields,
            'report_url': f'/reports/{job_dir.name}/report.html' if report_path.exists() else None,
            'elapsed_sec': elapsed,
            'pages': sum(1 for _ in (job_dir / 'pages').glob('*.png')) if (job_dir / 'pages').exists() else 0,
            'raw_text': raw_text,
            'tables': tables,
        }
        write_status(job_dir, {
            'status': 'done', 'stage': 'done', 'progress': 100,
            'elapsed_sec': elapsed, 'job_id': job_dir.name,
            'result': result,
        })
    except subprocess.TimeoutExpired:
        write_status(job_dir, {
            'status': 'error', 'stage': 'split', 'progress': 0,
            'elapsed_sec': round(time.time() - start, 1), 'job_id': job_dir.name,
            'error': 'pipeline 超时（>180s）',
        })
    except Exception as e:
        write_status(job_dir, {
            'status': 'error', 'stage': 'split', 'progress': 0,
            'elapsed_sec': round(time.time() - start, 1), 'job_id': job_dir.name,
            'error': str(e),
        })


def run_pipeline(pdf_path, output_dir, keys, backend='local'):
    """v54.332 保留的同步版本（兜底）。"""
    cmd = [
        sys.executable, str(PADDLEOCR_RUNNER),
        '--pdf', str(pdf_path), '--out', str(output_dir),
        '--backend', backend, '--mode', 'all',
    ]
    if keys:
        prompts = {k: f'请从报告中提取{k}（含数值与单位）' for k in keys}
        cmd.extend(['--prompts', json.dumps(prompts, ensure_ascii=False)])

    start = time.time()
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore',
            timeout=180,
        )
        elapsed = time.time() - start
        if result.returncode != 0:
            return {'error': f'pipeline 失败 (rc={result.returncode})',
                    'stderr': result.stderr[-500:] if result.stderr else ''}
        fields_path = output_dir / 'fields.json'
        fields = json.loads(fields_path.read_text(encoding='utf-8')) if fields_path.exists() else {}
        report_path = output_dir / 'report.html'
        return {
            'fields': fields,
            'report_url': f'/reports/{output_dir.name}/report.html' if report_path.exists() else None,
            'elapsed_sec': round(elapsed, 1),
            'pages': sum(1 for _ in (output_dir / 'pages').glob('*.png')) if (output_dir / 'pages').exists() else 0,
        }
    except subprocess.TimeoutExpired:
        return {'error': 'pipeline 超时（>180s）'}
    except FileNotFoundError:
        return {'error': f'找不到 run_pipeline.py: {PADDLEOCR_RUNNER}'}


@app.route('/health')
def health():
    return jsonify({
        'ok': True,
        'service': 'rsd-ocr-server',
        'version': 'v54.332',
        'paddleocr_skill': PADDLEOCR_SKILL.exists(),
        'runner_exists': PADDLEOCR_RUNNER.exists(),
        'output_dir': str(OUTPUT_BASE),
        'endpoints': ['/health', '/ocr/start', '/ocr/status/<id>', '/ocr/extract', '/reports/<id>/...'],
    })


@app.route('/ocr/start', methods=['POST', 'OPTIONS'])
def ocr_start():
    """v54.332：异步启动 OCR job，立即返回 job_id。"""
    if request.method == 'OPTIONS':
        return ('', 204)
    if 'pdf' not in request.files:
        return jsonify({'error': '缺少 pdf 文件'}), 400
    pdf_file = request.files['pdf']
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({'error': '仅支持 PDF 文件'}), 400
    keys = request.form.get('keys', ','.join(DEFAULT_KEYS)).split(',')
    keys = [k.strip() for k in keys if k.strip()] or DEFAULT_KEYS
    backend = request.form.get('backend', 'local')

    job_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:17]
    job_dir = OUTPUT_BASE / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = job_dir / pdf_file.filename
    pdf_file.save(pdf_path)

    thread = threading.Thread(
        target=run_pipeline_background,
        args=(job_dir, pdf_path, keys, backend),
        daemon=True,
    )
    thread.start()

    return jsonify({
        'job_id': job_id,
        'status_url': f'/ocr/status/{job_id}',
        'backend': backend,
        'keys': keys,
    })


@app.route('/ocr/status/<job_id>')
def ocr_status(job_id):
    """v54.332：查询 OCR job 进度。"""
    job_dir = OUTPUT_BASE / job_id
    status_path = job_dir / 'status.json'
    if not status_path.exists():
        if not job_dir.exists():
            return jsonify({'error': 'job 不存在', 'job_id': job_id}), 404
        return jsonify({'status': 'pending', 'stage': 'split', 'progress': 0,
                        'elapsed_sec': 0, 'job_id': job_id})
    try:
        data = json.loads(status_path.read_text(encoding='utf-8'))
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': f'status 解析失败: {e}', 'job_id': job_id}), 500


@app.route('/ocr/extract', methods=['POST', 'OPTIONS'])
def ocr_extract():
    """v54.332 保留同步版本（兜底）。"""
    if request.method == 'OPTIONS':
        return ('', 204)
    if 'pdf' not in request.files:
        return jsonify({'error': '缺少 pdf 文件'}), 400
    pdf_file = request.files['pdf']
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({'error': '仅支持 PDF 文件'}), 400
    keys = request.form.get('keys', ','.join(DEFAULT_KEYS)).split(',')
    keys = [k.strip() for k in keys if k.strip()] or DEFAULT_KEYS
    backend = request.form.get('backend', 'local')
    job_id = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:17]
    job_dir = OUTPUT_BASE / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = job_dir / pdf_file.filename
    pdf_file.save(pdf_path)
    result = run_pipeline(pdf_path, job_dir, keys, backend)
    result['job_id'] = job_id
    result['backend'] = backend
    result['keys'] = keys
    return jsonify(result)


@app.route('/reports/<job_id>/<filename>')
def serve_report(job_id, filename):
    job_dir = OUTPUT_BASE / job_id
    if not job_dir.exists():
        abort(404)
    return send_from_directory(job_dir, filename)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--host', default='127.0.0.1')
    args = parser.parse_args()

    if not PADDLEOCR_RUNNER.exists():
        print(f'  ERROR: 找不到 paddleocr runner: {PADDLEOCR_RUNNER}')
        sys.exit(1)

    print(f'  PaddleOCR 路径: {PADDLEOCR_SKILL}')
    print(f'  Output 目录:    {OUTPUT_BASE}')
    print(f'  启动 OCR 后端:  http://{args.host}:{args.port}')
    print(f'  健康检查:       http://{args.host}:{args.port}/health')
    print(f'  v54.332 端点:   /ocr/start (异步), /ocr/status/<id> (轮询)')
    app.run(host=args.host, port=args.port, threaded=True, debug=False)


if __name__ == '__main__':
    main()
