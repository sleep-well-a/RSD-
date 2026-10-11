#!/usr/bin/env python3
# v54.216 e2e_chrome.py: 通过 Chrome DevTools MCP 端口验证真实 i18n 行为
"""
测试方法：
  1. 通过 chrome-devtools-mcp 的 CDP HTTP API（默认 127.0.0.1:9222）查询
  2. 在浏览器里调用 i18n() 函数验证所有 key 都能找到
  3. 切换 zh/en 验证 zh_fallback = 0
  4. 验证 7 个 page 在 DOM 中都存在
"""
import sys, json, urllib.request, urllib.error

CDP_URL = 'http://127.0.0.1:9222'

def get_pages():
    """获取浏览器里打开的所有 page"""
    try:
        resp = urllib.request.urlopen(f'{CDP_URL}/json', timeout=3)
        return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return []

def find_rsd_page(pages):
    """找 RSD 计算器页面"""
    for p in pages:
        url = p.get('url', '')
        if '含量计算器' in url or 'RSD' in url:
            return p
    return None

def eval_in_page(ws_url, expression):
    """通过 WebSocket 在浏览器里执行 JS"""
    try:
        import websocket
    except ImportError:
        return None, "websocket-client not installed"
    try:
        ws = websocket.create_connection(ws_url, timeout=10)
        msg = {
            'id': 1,
            'method': 'Runtime.evaluate',
            'params': {
                'expression': expression,
                'returnByValue': True,
                'awaitPromise': True,
            }
        }
        ws.send(json.dumps(msg))
        result = json.loads(ws.recv())
        ws.close()
        if 'result' in result and 'result' in result['result']:
            r = result['result']['result']
            return r.get('value'), None
        return None, f"unexpected: {result}"
    except Exception as e:
        return None, f"Exception: {e}"

def main():
    print('=' * 70)
    print('RSD Calculator - v54.216 e2e_chrome.py')
    print('(Chrome DevTools MCP 端口验证)')
    print('=' * 70)

    pages = get_pages()
    if not pages:
        print(f'  [✗] Chrome DevTools MCP 未运行（{CDP_URL}）')
        print('      请先启动 chrome-devtools-mcp server')
        return 1

    rsd = find_rsd_page(pages)
    if not rsd:
        print(f'  [✗] 未找到 RSD 计算器页面')
        print(f'      当前 pages: {[p.get("url") for p in pages]}')
        return 1

    ws_url = rsd.get('webSocketDebuggerUrl')
    print(f'  [✓] 找到 RSD 页面: {rsd.get("url", "")[:80]}...')
    print(f'      WS: {ws_url[:60]}...')

    tests = []

    # Test 1: i18n() 函数存在
    result, err = eval_in_page(ws_url, 'typeof i18n === "function" ? "yes" : "no"')
    tests.append(('i18n 函数存在', result == 'yes', f'result={result}, err={err}'))

    # Test 2: zh 模式下 _currentLang = 'zh'
    result, err = eval_in_page(ws_url, 'typeof _currentLang !== "undefined" ? _currentLang : "undef"')
    tests.append(('zh 模式当前语言', result == 'zh', f'lang={result}'))

    # Test 3: 7 个 page 都存在
    js = '''(() => {
        const pages = ['page-stats','page-recovery','page-calc','page-history','page-special','page-settings','page-mobile'];
        return pages.map(p => !!document.getElementById(p));
    })()'''
    result, err = eval_in_page(ws_url, js)
    if result:
        all_found = all(result)
        tests.append(('7 个 page 都存在 (zh)', all_found, f'{sum(result)}/7 found, list={result}'))
    else:
        tests.append(('7 个 page 都存在 (zh)', False, f'err={err}'))

    # Test 4: en 模式 zh_fallback = 0
    js = '''(() => {
        _setLang('en');
        await new Promise(r => setTimeout(r, 100));
        const visible = [...document.querySelectorAll('[data-i18n]')].filter(el => el.offsetParent !== null);
        const zhFallback = visible.filter(el => /[一-鿿]/.test(el.textContent)).length;
        _setLang('zh');
        return zhFallback;
    })()'''
    # Wrap as async function
    js_async = f'(async () => {{ {js} }})()'
    result, err = eval_in_page(ws_url, js_async)
    tests.append(('en 模式 zh_fallback = 0', result == 0, f'zh_fallback={result}'))

    # Test 5: en 模式 7 个 page 都存在
    js = '''(() => {
        _setLang('en');
        await new Promise(r => setTimeout(r, 100));
        const pages = ['page-stats','page-recovery','page-calc','page-history','page-special','page-settings','page-mobile'];
        const found = pages.map(p => !!document.getElementById(p));
        _setLang('zh');
        return found;
    })()'''
    js_async = f'(async () => {{ {js} }})()'
    result, err = eval_in_page(ws_url, js_async)
    if result:
        all_found = all(result)
        tests.append(('en 模式 7 个 page 都存在', all_found, f'{sum(result)}/7 found'))
    else:
        tests.append(('en 模式 7 个 page 都存在', False, f'err={err}'))

    # Test 6: 几个已知 key 在 zh/en 都正确翻译
    js = '''(() => {
        const keys = ['btnThemeLight', 'btnThemeDark', 'lblMultiInjectAvg', 'spCurveTitle'];
        const result = {};
        _setLang('zh');
        await new Promise(r => setTimeout(r, 50));
        result.zh = {};
        for (const k of keys) result.zh[k] = i18n(k);
        _setLang('en');
        await new Promise(r => setTimeout(r, 50));
        result.en = {};
        for (const k of keys) result.en[k] = i18n(k);
        _setLang('zh');
        return result;
    })()'''
    js_async = f'(async () => {{ {js} }})()'
    result, err = eval_in_page(ws_url, js_async)
    if result:
        # 验证 zh 不是 key 本身（说明找到了翻译）
        all_pass = True
        details = []
        for k in ['btnThemeLight', 'btnThemeDark', 'lblMultiInjectAvg', 'spCurveTitle']:
            zh = result.get('zh', {}).get(k, 'MISSING')
            en = result.get('en', {}).get(k, 'MISSING')
            ok = (zh != k and zh != 'MISSING' and en != k and en != 'MISSING')
            all_pass = all_pass and ok
            details.append(f'{k}: zh={zh[:20]}... en={en[:20]}...')
        tests.append(('4 个 key 都有 zh/en 翻译', all_pass, '; '.join(details)))

    # Test 7: data-i18n 元素总数
    result, err = eval_in_page(ws_url, 'document.querySelectorAll("[data-i18n]").length')
    tests.append(('data-i18n 元素总数 >= 300', (result or 0) >= 300, f'count={result}'))

    # 输出结果
    pass_count = 0
    fail_count = 0
    for name, ok, detail in tests:
        status = '✓' if ok else '✗'
        print(f'  [{status}] {name} — {detail}')
        if ok:
            pass_count += 1
        else:
            fail_count += 1

    print('=' * 70)
    print(f'PASS: {pass_count}/{pass_count + fail_count}')
    print('=' * 70)

    return 0 if fail_count == 0 else 1

if __name__ == '__main__':
    sys.exit(main())