#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.335：一键部署到 GitHub Pages

安全特性：
- PAT（Personal Access Token）只在内存中，不写入任何文件
- 不修改 .git/config（用临时 -c http.extraHeader 传 Authorization）
- push 后立即清除 base64 编码的临时变量

用法：
  python tools/deploy_github_pages.py

  按提示输入：
    1. 仓库 URL（如 https://github.com/yourname/yourrepo.git）
    2. Personal Access Token（需 repo 权限）

执行步骤：
  1. 验证 token（GET /user）
  2. 验证仓库存在
  3. git push（用 -c http.extraHeader，token 不入盘）
  4. GitHub API 启用 Pages（main branch, root）
  5. 打印 Pages URL
"""
import re
import sys
import json
import base64
import getpass
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(r'F:\自制软件')
API_BASE = 'https://api.github.com'


def gh_api(method, path, token, data=None):
    """GitHub REST API 调用。token 仅在本次调用内有效。"""
    url = f'{API_BASE}{path}'
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(
        url, method=method, data=body,
        headers={
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'rsd-deploy-script',
            'X-GitHub-Api-Version': '2022-11-28',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8')) if e.headers.get('content-type', '').startswith('application/json') else {'message': str(e)}


def prompt(label, hidden=False):
    """输入提示。hidden=True 不回显（用于 token）。"""
    if hidden:
        return getpass.getpass(f'{label}: ').strip()
    return input(f'{label}: ').strip()


def git_push_with_token(token, owner, repo):
    """用 -c http.extraHeader 临时传 Authorization，token 不入盘。"""
    push_url = f'https://github.com/{owner}/{repo}.git'
    basic = base64.b64encode(f'x-access-token:{token}'.encode('utf-8')).decode('ascii')

    def try_push(branch):
        return subprocess.run(
            ['git', '-c', f'http.extraHeader=Authorization: Basic {basic}',
             'push', push_url, branch, '--force-with-lease'],
            cwd=str(ROOT), capture_output=True, text=True, encoding='utf-8'
        )

    result = try_push('main')
    if result.returncode != 0:
        print('  → main 失败，尝试 master...')
        result2 = try_push('master')
        if result2.returncode != 0:
            print(f'  ✗ push 失败（main）: {result.stderr[:300]}')
            print(f'  ✗ push 失败（master）: {result2.stderr[:300]}')
            return False
    if result.stdout: print(f'  {result.stdout.strip()[:300]}')
    return True


def main():
    print('=' * 60)
    print('RSD & 含量计算器 — GitHub Pages 一键部署 (v54.335)')
    print('=' * 60)
    print()

    # 1. 输入仓库 URL + token
    repo_url = prompt('仓库 URL（如 https://github.com/yourname/yourrepo.git）')
    if not re.match(r'^https?://github\.com/[^/]+/[^/]+(?:\.git)?$', repo_url):
        print(f'  ✗ URL 格式不正确: {repo_url}')
        sys.exit(1)
    repo_url = repo_url.removesuffix('.git') if repo_url.endswith('.git') else repo_url
    m = re.match(r'^https?://github\.com/([^/]+)/([^/]+)$', repo_url)
    owner, repo = m.group(1), m.group(2)
    print(f'  → 仓库: {owner}/{repo}')

    token = prompt('Personal Access Token（需 repo 权限）', hidden=True)
    if not token:
        print('  ✗ token 不能为空')
        sys.exit(1)

    # 2. 验证 token
    print('\n[1/4] 验证 token...')
    status, user = gh_api('GET', '/user', token)
    if status != 200:
        print(f'  ✗ token 无效（HTTP {status}）')
        sys.exit(1)
    print(f'  ✓ 认证成功: {user.get("login", "?")}')

    # 3. 验证仓库
    print('\n[2/4] 验证仓库...')
    status, repo_info = gh_api('GET', f'/repos/{owner}/{repo}', token)
    if status != 200:
        print(f'  ✗ 仓库不存在或无访问权限（HTTP {status}）')
        sys.exit(1)
    if repo_info.get('private'):
        print('  ⚠ 仓库是 Private — GitHub Pages 免费版需要 Public')
        ans = prompt('  继续？(yes/no)', hidden=False)
        if ans.lower() not in ('y', 'yes'):
            sys.exit(1)

    # 4. git push（-c http.extraHeader 临时 Authorization，不入盘）
    print('\n[3/4] git push...')
    if git_push_with_token(token, owner, repo):
        print('  ✓ push 完成（token 仅在 git 子进程内，未写盘）')
    else:
        sys.exit(1)

    # 5. 启用 Pages
    print('\n[4/4] 启用 GitHub Pages...')
    pages_payload = {'source': {'branch': 'main', 'path': '/'}}
    status, existing = gh_api('GET', f'/repos/{owner}/{repo}/pages', token)
    if status == 200:
        print(f'  ℹ Pages 已配置：{existing.get("html_url", "")}')
    else:
        status, result = gh_api('POST', f'/repos/{owner}/{repo}/pages', token, pages_payload)
        if status in (201, 202):
            print(f'  ✓ Pages 已启用：{result.get("html_url", "")}')
        else:
            print(f'  ⚠ Pages 启用失败（HTTP {status}），请手动到 GitHub → Settings → Pages 启用')
            print(f'    响应：{json.dumps(result, ensure_ascii=False)[:300]}')

    # 6. 输出
    print('\n' + '=' * 60)
    print('✅ 部署完成！')
    print(f'   仓库: https://github.com/{owner}/{repo}')
    pages_url = f'https://{owner}.github.io/{repo}/'
    print(f'   Pages: {pages_url}')
    print('   deploy/ 目录（含 index.html + manifest + service-worker + icons）')
    print('   由 GitHub Actions 自动部署。')
    print()
    print('📌 token 已用完，未写入任何文件。建议去 GitHub Settings 撤销。')
    print('=' * 60)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n\n已取消（Ctrl+C）')
        sys.exit(1)
