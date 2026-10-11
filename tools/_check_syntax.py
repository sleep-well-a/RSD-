import re, sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'F:\自制软件\app.js', 'r', encoding='utf-8') as f:
    text = f.read()
opens = text.count('{')
closes = text.count('}')
parens_o = text.count('(')
parens_c = text.count(')')
print(f'braces: {{={opens} }}={closes} diff={opens-closes}')
print(f'parens: ({parens_o} )={parens_c} diff={parens_o-parens_c}')
# 找明显中文全角符在 var 声明
for m in re.finditer(r'var\s+([^=]+)=', text):
    name = m.group(1).strip()
    if re.search(r'[一-鿿（）【】]', name):
        print(f'SUSPICIOUS var: {m.group(0)[:80]}')
        break