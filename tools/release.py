#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.314 自动化 release 流程

一键完成整个发布流程：
1. 备份当前状态
2. 跑 pre-flight 检查（i18n sync + 静态扫描）
3. 构建流动相版 HTML
4. 创建 release/{version}/ 目录
5. 复制文件 + 生成 manifest.json
6. 同步 service-worker.js
7. 打包 zip

用法：
  python tools/release.py v54.314              # 一键发布
  python tools/release.py v54.314 --dry-run   # 只跑检查，不实际发布
  python tools/release.py v54.314 --skip-tests # 跳过 Puppeteer（仅本机检查）
"""
import re
import sys
import shutil
import zipfile
import argparse
import subprocess
from pathlib import Path

ROOT = Path(r'F:\自制软件')
RELEASE_DIR = ROOT / 'release'


def run(cmd, cwd=None, check=True, capture=False, retries=1):
    """Run shell command with retry on failure."""
    if isinstance(cmd, str):
        cmd = cmd.split()
    print(f'  $ {" ".join(cmd) if isinstance(cmd, list) else cmd}')
    last_result = None
    for attempt in range(retries + 1):
        last_result = subprocess.run(
            cmd, cwd=cwd or str(ROOT), shell=isinstance(cmd, str),
            capture_output=capture, text=True, encoding='utf-8', errors='ignore'
        )
        if last_result.returncode == 0:
            return last_result
        if attempt < retries:
            print(f'  WARN: attempt {attempt + 1} failed, retrying...')
        else:
            break
    if check:
        print(f'  ERROR: exit code {last_result.returncode} after {retries + 1} attempts')
        if capture and last_result.stdout: print(f'  STDOUT: {last_result.stdout[:500]}')
        if capture and last_result.stderr: print(f'  STDERR: {last_result.stderr[:500]}')
        sys.exit(1)
    return last_result


def step(msg):
    print(f'\n{"=" * 60}')
    print(f'>>> {msg}')
    print('=' * 60)


def preflight_checks(skip_tests=False):
    """Pre-flight checks before release."""
    step('Pre-flight checks')

    # 1. i18n sync
    print('\n[1] i18n 三方一致性...')
    result = run(['python', str(ROOT / 'tools' / 'check_i18n_sync.py')], capture=True)
    if result.returncode != 0:
        print('  FAIL: i18n 不一致')
        print('  运行 `python tools/check_i18n_sync.py --auto-fix` 自动修复')
        sys.exit(1)
    print('  [OK] i18n 一致')

    # 2. 静态扫描
    print('\n[2] 静态扫描 i18n 硬编码...')
    result = run(['python', str(ROOT / 'tools' / 'scan_i18n_hardcoded.py')], capture=True)
    if result.returncode != 0:
        print('  FAIL: 发现 i18n 硬编码')
        sys.exit(1)
    print('  [OK]')

    print('\n[3] 静态扫描 HTML typos...')
    result = run(['python', str(ROOT / 'tools' / 'scan_html_typos.py')], capture=True)
    if result.returncode != 0:
        print('  FAIL: 发现 HTML typos')
        sys.exit(1)
    print('  [OK]')

    # v54.321 新增：manifest 一致性检查
    print('\n[4] 跨 release manifest 一致性...')
    result = run(['python', str(ROOT / 'tools' / 'check_manifest_consistency.py')], capture=True)
    if result.returncode != 0:
        print('  FAIL: manifest 不一致（运行 `python tools/check_manifest_consistency.py --fix` 自动修复）')
        sys.exit(1)
    print('  [OK]')

    # v54.323 新增：TWA / Android 打包就绪度检查
    print('\n[5] TWA 打包就绪度...')
    result = run(['python', str(ROOT / 'tools' / 'check_twa_readiness.py')], capture=True)
    if result.returncode != 0:
        print('  WARN: TWA 就绪度有失败项（不影响 Web 发布，但会影响 Android 打包）')
        print('  运行 `python tools/check_twa_readiness.py` 查看详情')
        # 不 exit：TWA 就绪度不影响 Web 发布
    else:
        print('  [OK]')

    if not skip_tests:
        # 关键 Puppeteer 测试（快速）
        print('\n[6] 关键 Puppeteer 测试（round17 / round35 / round48）...')
        for t in ['e2e_puppeteer_audit_round17.py',
                  'e2e_puppeteer_round35_critical.js',
                  'e2e_puppeteer_round48_i18n_sync.js']:
            print(f'  - {t}')
            result = run(['node' if t.endswith('.js') else 'python',
                          str(ROOT / 'tests' / t)], capture=True, retries=2)
            if result.returncode != 0:
                print(f'  FAIL: {t}')
                sys.exit(1)
        print('  [OK]')


def backup_current():
    step('备份当前状态')
    result = run(['python', str(ROOT / 'tools' / 'pre_edit_backup.py'), f'pre-release-{sys.argv[1]}'], capture=True)
    print(f'  {result.stdout.strip() if result.stdout else "done"}')


def build_mobile(target):
    step(f'构建流动相版 {target}')
    out_path = ROOT / f'RSD & 含量计算器_流动相版_{target}.html'
    run(['python', str(ROOT / 'tools' / 'build_single_html.py'), '--out', str(out_path)])
    return out_path


def create_release_dir(target, html_path):
    step(f'创建 release/{target}/ 目录')
    target_dir = RELEASE_DIR / target
    target_dir.mkdir(exist_ok=True)

    # 复制 HTML
    shutil.copy2(html_path, target_dir / html_path.name)

    # 生成 manifest.json（v54.323：根目录 manifest.json 为权威源）
    manifest_src = ROOT / 'manifest.json'
    if manifest_src.exists():
        manifest_text = manifest_src.read_text(encoding='utf-8')
        manifest_text = re.sub(
            r'RSD & 含量计算器_流动相版_v54\.\d+\.html',
            f'RSD & 含量计算器_流动相版_{target}.html',
            manifest_text,
        )
        manifest_text = re.sub(r'v54\.\d+', target, manifest_text)
        (target_dir / 'manifest.json').write_text(manifest_text, encoding='utf-8')
        print(f'  ✓ manifest.json（基于根目录权威源）')
    else:
        print(f'  WARN: 根目录 manifest.json 不存在，跳过 manifest 生成')

    # v54.323：复制 icons/ 进发布包（TWA / Android 需要 PNG 图标）
    icons_dir = ROOT / 'icons'
    if icons_dir.exists():
        shutil.copytree(icons_dir, target_dir / 'icons', dirs_exist_ok=True)
        print(f'  ✓ icons/（{len(list(icons_dir.glob("*.png")))} 个 PNG）')

    # 复制 service-worker.js
    sw_src = ROOT / 'service-worker.js'
    if sw_src.exists():
        shutil.copy2(sw_src, target_dir / 'service-worker.js')
        print(f'  ✓ service-worker.js')

    # v54.322 修复：同步根目录 manifest.json 和 service-worker.js
    # （根目录的 RSD & 含量计算器.html 是 dev 版本，引用根目录 PWA 资源；
    #   release.py 之前只更新 release/v54.XXX/，漏掉根目录 → v54.285 时代的
    #   过时 manifest.json 一直没更新，造成 PWA 用户安装到过时版本）
    root_manifest = ROOT / 'manifest.json'
    if root_manifest.exists() and manifest_src.exists():
        shutil.copy2(target_dir / 'manifest.json', root_manifest)
        print(f'  ✓ 根目录 manifest.json 已同步到 {target}')
    root_sw = ROOT / 'service-worker.js'
    if root_sw.exists():
        shutil.copy2(target_dir / 'service-worker.js', root_sw)
        print(f'  ✓ 根目录 service-worker.js 已同步到 {target}')


def sync_sw(target):
    step(f'同步 service-worker.js → {target}')
    run(['python', str(ROOT / 'tools' / 'sync_sw_version.py'), target])


def create_release_notes(target, release_notes_path=None):
    """如果提供了 RELEASE_NOTES.md 路径则复制，否则生成占位。"""
    step('RELEASE_NOTES.md')
    target_dir = RELEASE_DIR / target
    if release_notes_path and Path(release_notes_path).exists():
        shutil.copy2(release_notes_path, target_dir / 'RELEASE_NOTES.md')
        print(f'  ✓ 复制 {release_notes_path} → release/{target}/RELEASE_NOTES.md')
    else:
        # 占位文件
        notes = f"""# RSD & 含量计算器 {target} 发布说明

**发布日期**：待定
**前版本**：auto-detect

## TODO

请编辑此文件添加本次发布内容。
"""
        (target_dir / 'RELEASE_NOTES.md').write_text(notes, encoding='utf-8')
        print(f'  ! 已生成占位文件，请编辑 release/{target}/RELEASE_NOTES.md')


def create_zip(target):
    step(f'打包 release/{target}.zip')
    target_dir = RELEASE_DIR / target
    zip_path = RELEASE_DIR / f'RSD-含量计算器-{target}.zip'
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as f:
        for f_path in target_dir.rglob('*'):
            if f_path.is_file():
                f.write(f_path, f_path.relative_to(RELEASE_DIR.parent))
    size_kb = zip_path.stat().st_size / 1024
    print(f'  [OK] {zip_path.name} ({size_kb:.1f} KB)')


def extract_milestone(target):
    """从 RELEASE_NOTES.md 自动生成 milestone memory + 更新 MEMORY.md 索引。"""
    step(f'生成 milestone memory ({target})')
    result = run(['python', str(ROOT / 'tools' / 'extract_milestone.py'), target], capture=True)
    if result.returncode != 0:
        print('  WARN: 自动 milestone memory 生成失败（不影响发布）')
        return
    # v54.317+ 也更新 MEMORY.md 索引
    idx_result = run(['python', str(ROOT / 'tools' / 'build_memory_index.py')], capture=True)
    if idx_result.returncode == 0:
        print('  [OK] milestone memory + MEMORY.md 索引已更新')
    else:
        print('  [OK] milestone memory 已生成（MEMORY.md 索引更新失败）')


def build_deploy_package(target):
    """v54.324：生成 GitHub Pages 部署包（deploy/）。"""
    step(f'生成 GitHub Pages 部署包（{target}）')
    result = run(['python', str(ROOT / 'tools' / 'build_github_pages.py'), '--version', target],
                 capture=True)
    if result.returncode != 0:
        print('  WARN: 部署包生成失败（不影响 release）')
        if result.stderr:
            print(f'  {result.stderr[:300]}')
    else:
        print('  [OK] deploy/ 已更新')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('version', help='版本号（v54.XXX）')
    parser.add_argument('--dry-run', action='store_true', help='只跑检查不实际发布')
    parser.add_argument('--skip-tests', action='store_true', help='跳过 Puppeteer 测试')
    parser.add_argument('--notes', help='RELEASE_NOTES.md 源文件路径')
    args = parser.parse_args()

    target = args.version
    if not re.match(r'^v54\.\d+$', target):
        print(f'ERROR: 版本格式错误: {target}（应为 v54.314）')
        sys.exit(1)

    print(f'{'=' * 60}')
    print(f'>>> 自动化 release: {target}')
    print(f'{'=' * 60}')

    # 1. Pre-flight checks
    preflight_checks(skip_tests=args.skip_tests)

    if args.dry_run:
        print('\n[DRY-RUN] 跳过实际发布步骤')
        print('  [OK] 预检查通过')
        print(f'  下一步：运行 `python tools/release.py {target}` 不带 --dry-run')
        return

    # 2. 备份
    backup_current()

    # 3. 构建
    html_path = build_mobile(target)

    # 4. 创建 release 目录
    create_release_dir(target, html_path)

    # 5. RELEASE_NOTES
    create_release_notes(target, args.notes)

    # 6. SW 同步
    sync_sw(target)

    # 7. 打包
    create_zip(target)

    # 8. 自动生成 milestone memory
    extract_milestone(target)

    # 9. v54.324：生成 GitHub Pages 部署包
    build_deploy_package(target)

    print(f'\n{'=' * 60}')
    print(f'>>> [OK] {target} 发布完成！')
    print(f'{'=' * 60}')
    print(f'  流动相版: RSD & 含量计算器_流动相版_{target}.html')
    print(f'  发布包:   release/RSD-含量计算器-{target}.zip')
    print(f'  RELEASE_NOTES: release/{target}/RELEASE_NOTES.md')
    print(f'\n  Memory 建议（可选）：')
    print(f'    Write: rsd-milestone-{target.replace(".", "-")}-<feature>.md')


if __name__ == '__main__':
    main()
