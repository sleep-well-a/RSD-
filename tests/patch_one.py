#!/usr/bin/env python3
"""
v54.272 patch_one.py — 单文件 AST patch 工具（一次只改一个文件）
把 `const browser = await puppeteer.launch(...)` 改为：
  const SHARED_WS = process.env.SHARED_WS_ENDPOINT || null;
  const browser = SHARED_WS
    ? await puppeteer.connect({ browserWSEndpoint: SHARED_WS })
    : await puppeteer.launch(<原参数>);

要点：
1. SHARED_WS 在外层 main() 顶层（不在 try 块内）— 避免 finally 访问 ReferenceError
2. close 行的 `await browser.close()` 改为 `await (SHARED_WS ? browser.disconnect() : browser.close())`
"""
import sys
import re
from pathlib import Path

# v54.272: sentinel 检测 patch 是否已应用（避免重复）
SHARED_WS_LOCALSTORAGE_CLEAR = 'await page.evaluate(() => localStorage.clear())'

def patch_file(path: Path):
    text = path.read_text(encoding='utf-8')
    orig = text
    fname = path.name

    # 跳过 _chrome_launcher.js
    if fname == '_chrome_launcher.js':
        return False, 'skip launcher'

    # 没 patch（无 SHARED_WS）→ 全 patch
    if 'SHARED_WS_ENDPOINT' not in text:
        pass  # continue to full patch
    elif SHARED_WS_LOCALSTORAGE_CLEAR in text:
        return False, 'already complete'

    # 检查含 puppeteer.launch
    if 'puppeteer.launch' not in text:
        return False, 'no puppeteer.launch'

    # 找到 main() 函数起点（async function main(）
    main_match = re.search(r'async\s+function\s+main\s*\([^)]*\)\s*\{', text)
    if not main_match:
        return False, 'no async function main'

    # 在 main() 起点后插入 SHARED_WS 声明（顶层，不在 try 内）
    insert_pos = main_match.end()
    decl = '\n  const SHARED_WS = process.env.SHARED_WS_ENDPOINT || null;\n'
    text = text[:insert_pos] + decl + text[insert_pos:]

    # 找 puppeteer.launch 调用（支持 const/let/var + browser = ... / 嵌套 launch = ... / 裸 launch）
    launch_re = re.compile(
        r'(?:((?:const|let|var)\s+)?browser\s*=\s*)?(?::\s*)?await\s+puppeteer\.launch\(',
        re.MULTILINE
    )
    m = launch_re.search(text)
    if not m:
        return False, 'no launch pattern (const browser = ...)'

    # 提取整个 puppeteer.launch(...) 调用到匹配的 ) — 需要括号匹配
    start = m.start()
    launch_call_start = m.end()  # 'await puppeteer.launch(' 之后

    # 括号平衡找到匹配的 )
    depth = 1
    i = launch_call_start
    while i < len(text) and depth > 0:
        ch = text[i]
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        i += 1
    if depth != 0:
        return False, 'unbalanced parens'
    launch_call_end = i  # ')'

    # 提取 launch 参数（圆括号内的内容）
    launch_args = text[launch_call_start:launch_call_end - 1]

    # 找 launch 前的缩进
    line_start = text.rfind('\n', 0, start) + 1
    indent_match = re.match(r'[ \t]*', text[line_start:])
    indent = indent_match.group(0) if indent_match else '  '

    # 替换：<prefix>await puppeteer.launch(<args>) →
    #   SHARED_WS
    #     ? await puppeteer.connect({ browserWSEndpoint: SHARED_WS })
    #     : await puppeteer.launch(<args>);
    prefix = m.group(1) or ''  # 可能为空（裸 launch）
    replacement = (
        f'{prefix}SHARED_WS\n'
        f'{indent}  ? await puppeteer.connect({{ browserWSEndpoint: SHARED_WS }})\n'
        f'{indent}  : await puppeteer.launch({launch_args});'
    )
    text = text[:start] + replacement + text[launch_call_end:]

    # 替换 close: `await browser.close()` → `await (SHARED_WS ? browser.disconnect() : browser.close())`
    text = re.sub(
        r'await\s+browser\.close\(\)',
        'await (SHARED_WS ? browser.disconnect() : browser.close())',
        text
    )

    # v54.272: shared mode 下清 localStorage（避免 rsd-lang/rsd-theme 等 key 跨 suite 污染）
    if SHARED_WS_LOCALSTORAGE_CLEAR not in text:
        # 找 goto HTML_URL 之前一行（允许跨多行 + 各种参数）
        goto_re = re.compile(r"await\s+page\.goto\(\s*HTML_URL", re.DOTALL)
        gm = goto_re.search(text)
        if gm:
            clear_indent = re.match(r'[ \t]*', text[text.rfind('\n', 0, gm.start())+1:]).group(0)
            clear_block = (
                f'{clear_indent}if (SHARED_WS) try {{ await page.evaluate(() => localStorage.clear()); }} catch (_) {{}}\n'
                f'{clear_indent}'
            )
            text = text[:gm.start()] + clear_block + text[gm.start():]

    if text == orig:
        return False, 'no change'

    path.write_text(text, encoding='utf-8')
    return True, 'patched'


def main():
    if len(sys.argv) < 2:
        print('用法: python tests/patch_one.py <file.js>')
        sys.exit(1)
    f = Path(sys.argv[1])
    if not f.exists():
        print(f'不存在: {f}')
        sys.exit(1)
    ok, msg = patch_file(f)
    print(f'[{"ok" if ok else "skip"}] {f.name}: {msg}')


if __name__ == '__main__':
    main()