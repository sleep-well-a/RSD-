import sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'F:\自制软件\app.js', 'r', encoding='utf-8') as f:
    text = f.read()
lines = text.split('\n')
# 跟踪每行 paren 平衡
stack = []
unbalanced_at = []
for ln, line in enumerate(lines, 1):
    # 简化：跳过字符串和注释里的括号
    in_str = False
    in_template = False
    in_line_comment = False
    in_block_comment = False
    i = 0
    while i < len(line):
        ch = line[i]
        nxt = line[i+1] if i+1 < len(line) else ''
        if in_line_comment:
            i += 1
            continue
        if in_block_comment:
            if ch == '*' and nxt == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_str:
            if ch == '\\':
                i += 2
                continue
            if ch == '"':
                in_str = False
            i += 1
            continue
        if in_template:
            if ch == '\\':
                i += 2
                continue
            if ch == '`':
                in_template = False
            i += 1
            continue
        if ch == '/' and nxt == '/':
            in_line_comment = True
            i += 2
            continue
        if ch == '/' and nxt == '*':
            in_block_comment = True
            i += 2
            continue
        if ch == '"':
            in_str = True
            i += 1
            continue
        if ch == "'":
            in_str = True  # 简化
            i += 1
            continue
        if ch == '`':
            in_template = True
            i += 1
            continue
        if ch == '(':
            stack.append(('(', ln, i))
            i += 1
            continue
        if ch == ')':
            if stack and stack[-1][0] == '(':
                stack.pop()
            else:
                unbalanced_at.append((') extra', ln, i))
            i += 1
            continue
        i += 1

print(f'未关闭的 (  栈深度: {len(stack)}')
print(f'前 5 个未关闭 (  :')
for s in stack[:5]:
    print(f'  L{s[1]}: pos {s[2]} : {lines[s[1]-1][:100]}')
print(f'额外 )  {len(unbalanced_at)} 个')
if unbalanced_at:
    for s in unbalanced_at[:5]:
        print(f'  L{s[1]}: pos {s[2]} : {lines[s[1]-1][:100]}')