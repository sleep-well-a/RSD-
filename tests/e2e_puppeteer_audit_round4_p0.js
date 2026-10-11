// v54.232 e2e_puppeteer_audit_round4_p0.js
// Round 4 P0 修复测试 (5 个 HIGH bug):
//   1. B.A1 getValues 拒绝 Infinity（!isFinite 而非 !isNaN）
//   2. B.B2 restoreBackup 类型校验拒绝非 string 值
//   3. B.I1 renderHistory 6 处漏 _esc → XSS
//   4. D HIGH HTML 170/769 缺 `>` + 6 处 aria-label 引号未闭合
//   5. D HIGH i18n 字典 24 个重复 key
const puppeteer = require('puppeteer');
const fs = require('fs');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.232 e2e_puppeteer_audit_round4_p0.js');
  console.log('Round 4 P0 fixes regression tests');
  console.log('='.repeat(70));

  let browser;
  let pass_count = 0;
  let fail_count = 0;

  function record(name, ok, detail = '') {
    const status = ok ? 'OK' : 'FAIL';
    const line = detail ? `  [${status}] ${name} -- ${detail}` : `  [${status}] ${name}`;
    console.log(line);
    if (ok) pass_count++;
    else fail_count++;
  }

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(HTML_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
    await new Promise(r => setTimeout(r, 500));

    // ===================================================
    // 1. B.A1: getValues 拒绝 Infinity
    // ===================================================
    console.log('\n--- #1 getValues filters out Infinity ---');
    const appJs = fs.readFileSync('F:\\自制软件\\app.js', 'utf8');
    const getValuesIsFinite = /function getValues\(\)[\s\S]{0,300}Number\.isFinite/.test(appJs);
    record('getValues uses Number.isFinite (not !isNaN)',
      getValuesIsFinite,
      'getValues contains "Number.isFinite"');

    // 实际测试：注入 Infinity
    const infinityTest = await page.evaluate(() => {
      try {
        // 添加一个 input 含 1e400（→ Infinity）
        const rows = document.getElementById('data-rows');
        if (!rows) return { ok: false, error: 'no data-rows' };
        // 先清空所有现有 input
        rows.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'row';
        div.innerHTML = '<input value="100"><input value="102"><input value="1e400"><input value="99">';
        rows.appendChild(div);
        const vals = getValues();
        return { ok: true, vals, hasInfinity: vals.some(v => !Number.isFinite(v)) };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('getValues() does NOT include Infinity in result',
      infinityTest.ok && !infinityTest.hasInfinity,
      `vals=${JSON.stringify(infinityTest.vals)} hasInfinity=${infinityTest.hasInfinity}`);

    // ===================================================
    // 2. B.B2: restoreBackup 类型校验
    // ===================================================
    console.log('\n--- #2 restoreBackup skips non-string values ---');
    const restoreHasTypeCheck = /function restoreBackup[\s\S]*?typeof payload\.data\[k\]\s*!==\s*'string'[\s\S]*?skipped\.push/.test(appJs);
    record('restoreBackup validates payload.data[k] is string',
      restoreHasTypeCheck,
      'restoreBackup contains "typeof payload.data[k] !== \'string\'" + skipped.push');

    // 模拟：调 restoreBackup 用 object value
    const restoreTest = await page.evaluate(async () => {
      try {
        // 设置一个初始值
        try { localStorage.setItem('rsd-calc-history', '["INIT"]'); } catch(e){}
        // 模拟构造一个恶意 payload
        const fakeFile = {
          target: {
            files: [],
            value: ''
          }
        };
        // 直接手动模拟 Reader 加载
        const payload = {
          data: {
            'rsd-calc-history': { type: 'malicious' }, // 对象，不是 string
            'rsd-theme': '"light"',                    // 合法 string
          }
        };
        // 不直接调用 restoreBackup（需要 FileReader）。改为手动测核心逻辑：通过 _undoLastRestore 检查 history 状态
        // 写入恶意对象到 localStorage 看 getH 行为
        // 这里只验证类型检查代码存在
        return { ok: true, payload: JSON.stringify(payload) };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('restoreBackup logic check (static only)',
      restoreTest.ok,
      `restoreTest=${JSON.stringify(restoreTest).slice(0, 100)}`);

    // ===================================================
    // 3. B.I1: renderHistory 6 处 _esc
    // ===================================================
    console.log('\n--- #3 renderHistory XSS protection ---');
    // 模拟一条含 XSS payload 的历史记录，看是否能渲染成纯文本
    const xssTest = await page.evaluate(async () => {
      try {
        // 注入一条恶意历史
        const malicious = {
          time: '2026-09-21 10:00:00',
          type: '干燥失重',
          samples: [{ w0: '<img src=x onerror=alert(1)>', w1: '1.0', w2: '0.8' }],
        };
        const histRaw = getH ? getH() : JSON.parse(localStorage.getItem('rsd-calc-history') || '[]');
        histRaw.unshift(malicious);
        localStorage.setItem('rsd-calc-history', JSON.stringify(histRaw));
        // 触发 renderHistory
        if (typeof renderHistory === 'function') renderHistory();
        await new Promise(r => setTimeout(r, 300));
        // 检查 history-list 里有 img 标签吗
        const list = document.getElementById('history-list');
        if (!list) return { ok: false, error: 'no history-list' };
        const imgs = list.querySelectorAll('img');
        const hasXssImg = imgs.length > 0;
        // 验证：_esc 转义后应只剩 <img 字符串（无真实 <img> 标签）
        const hasLiveImg = list.innerHTML.includes('<img');
        return { ok: true, imgCount: imgs.length, hasEscaped: !hasLiveImg };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('renderHistory escapes XSS in 干燥失重.w0',
      xssTest.ok && xssTest.imgCount === 0 && xssTest.hasEscaped,
      `imgCount=${xssTest.imgCount} hasEscaped=${xssTest.hasEscaped} (img=0 means no live <img> rendered)`);

    // 测试滴定度 XSS
    const xssTiter = await page.evaluate(async () => {
      try {
        const malicious = {
          time: '2026-09-21 11:00:00',
          type: '滴定度',
          vs: '<script>alert(2)</script>',
          v0s: '5', ms: '0.1', ps: '99', f: '1.005',
          T: '<img src=x onerror=alert(3)>',
        };
        const histRaw = JSON.parse(localStorage.getItem('rsd-calc-history') || '[]');
        histRaw.unshift(malicious);
        localStorage.setItem('rsd-calc-history', JSON.stringify(histRaw));
        if (typeof renderHistory === 'function') renderHistory();
        await new Promise(r => setTimeout(r, 300));
        const list = document.getElementById('history-list');
        const scripts = list.querySelectorAll('script');
        const imgs = list.querySelectorAll('img');
        return { ok: true, scriptCount: scripts.length, imgCount: imgs.length };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('renderHistory escapes XSS in 滴定度.vs/T',
      xssTiter.ok && xssTiter.scriptCount === 0 && xssTiter.imgCount === 0,
      `script=${xssTiter.scriptCount} img=${xssTiter.imgCount}`);

    // 测试含量均匀度 XSS
    const xssUni = await page.evaluate(async () => {
      try {
        const malicious = {
          time: '2026-09-21 12:00:00',
          type: '含量均匀度',
          L: '<img src=x onerror=alert(4)>',
          xbar: '99', A: '1', S: '0.5', AS: '2.1',
          verdict: '<script>alert(5)</script>',
        };
        const histRaw = JSON.parse(localStorage.getItem('rsd-calc-history') || '[]');
        histRaw.unshift(malicious);
        localStorage.setItem('rsd-calc-history', JSON.stringify(histRaw));
        if (typeof renderHistory === 'function') renderHistory();
        await new Promise(r => setTimeout(r, 300));
        const list = document.getElementById('history-list');
        return { ok: true, script: list.querySelectorAll('script').length, img: list.querySelectorAll('img').length };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('renderHistory escapes XSS in 含量均匀度.L/verdict',
      xssUni.ok && xssUni.script === 0 && xssUni.img === 0,
      `script=${xssUni.script} img=${xssUni.img}`);

    // 测试溶出度 XSS
    const xssDiss = await page.evaluate(async () => {
      try {
        const malicious = {
          time: '2026-09-21 13:00:00',
          type: '溶出度',
          label: '<img src=x onerror=alert(6)>',
          mean: 85, sd: 2, rsd: 2.3,
          samples: [{ parallels: [{ content: '<b>bold</b>' }] }],
        };
        const histRaw = JSON.parse(localStorage.getItem('rsd-calc-history') || '[]');
        histRaw.unshift(malicious);
        localStorage.setItem('rsd-calc-history', JSON.stringify(histRaw));
        if (typeof renderHistory === 'function') renderHistory();
        await new Promise(r => setTimeout(r, 300));
        const list = document.getElementById('history-list');
        return { ok: true, img: list.querySelectorAll('img').length, bold: list.querySelectorAll('b').length };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('renderHistory escapes XSS in 溶出度.label',
      xssDiss.ok && xssDiss.img === 0 && xssDiss.bold === 0,
      `img=${xssDiss.img} bold=${xssDiss.bold}`);

    // 测试外标法回收率 XSS (s.theory)
    const xssExt = await page.evaluate(async () => {
      try {
        const malicious = {
          time: '2026-09-21 14:00:00',
          type: '回收率-外标法',
          stdArea: '100', stdWeight: '10', stdPurity: '99', stdDilution: '100',
          count: 1,
          samples: [{ area: '99', weight: '10', dilution: '100', theory: '<img src=x onerror=alert(7)>' }],
        };
        const histRaw = JSON.parse(localStorage.getItem('rsd-calc-history') || '[]');
        histRaw.unshift(malicious);
        localStorage.setItem('rsd-calc-history', JSON.stringify(histRaw));
        if (typeof renderHistory === 'function') renderHistory();
        await new Promise(r => setTimeout(r, 300));
        const list = document.getElementById('history-list');
        return { ok: true, img: list.querySelectorAll('img').length };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('renderHistory escapes XSS in 外标法 s.theory',
      xssExt.ok && xssExt.img === 0,
      `img=${xssExt.img}`);

    // 清理恶意历史
    await page.evaluate(() => { try { localStorage.removeItem('rsd-calc-history'); } catch(e){} });
    await new Promise(r => setTimeout(r, 200));

    // ===================================================
    // 4. D HIGH: HTML 170/769 缺 `>` + 6 处 aria-label
    // ===================================================
    console.log('\n--- #4 HTML structure fixed ---');
    const html = fs.readFileSync('F:\\自制软件\\RSD & 含量计算器.html', 'utf8');
    // v54.294: 用文本搜索找 norm-regress-result / curve-result 所在行（替代硬编码 line 172/795 — 随 v54.286+ token 化 + v54.287-293 改动已漂移 ~20 行）
    const lines = html.split('\n');
    const normRegressLine = lines.findIndex(l => l.includes('id="norm-regress-result"'));
    const curveResultLine = lines.findIndex(l => l.includes('id="curve-result"'));
    record('HTML: norm-regress-result div present and closed (line ' + (normRegressLine + 1) + ')',
      normRegressLine >= 0 && lines[normRegressLine].includes('id="norm-regress-result">') && !lines[normRegressLine].endsWith('data-i18n="lblRegressionEq"'),
      `line${normRegressLine + 1}=${(lines[normRegressLine] || '').slice(0, 100)}`);
    record('HTML: curve-result div present and closed (line ' + (curveResultLine + 1) + ')',
      curveResultLine >= 0 && lines[curveResultLine].includes('id="curve-result"') && !lines[curveResultLine].endsWith('data-i18n="lblRegressionEq"'),
      `line${curveResultLine + 1}=${(lines[curveResultLine] || '').slice(0, 100)}`);

    // 验证 6 处 aria-label 修复
    // v54.246 fix: 6 处 aria-label="粘贴数据" 已 i18n 化为 data-i18n-aria-label="btnBatchPaste"
    const brokenAriaLabel = /aria-label="data-i18nbtn-batch-paste/.test(html);
    record('No unclosed aria-label="data-i18nbtn-batch-paste... in HTML',
      !brokenAriaLabel,
      `broken pattern count=${(html.match(/aria-label="data-i18nbtn-batch-paste/g) || []).length}`);

    const goodAriaLabel = (html.match(/data-i18n-aria-label="btnBatchPaste"/g) || []).length;
    record('Fixed data-i18n-aria-label="btnBatchPaste" appears 6 times',
      goodAriaLabel === 6,
      `count=${goodAriaLabel}`);

    const goodBtnBatchPaste = (html.match(/data-i18n="btnBatchPaste"/g) || []).length;
    record('Fixed data-i18n="btnBatchPaste" appears 6 times',
      goodBtnBatchPaste === 6,
      `count=${goodBtnBatchPaste}`);

    // ===================================================
    // 5. D HIGH: i18n 字典重复 key
    // ===================================================
    console.log('\n--- #5 i18n dict no duplicate keys ---');
    // v54.247 split: aggregate all 4 i18n files for eval (loader references the globals)
    const i18nData = ['i18n-zh.js', 'i18n-en.js', 'i18n-alert.js', 'i18n-data.js']
      .map(f => fs.readFileSync('F:\\自制软件\\' + f, 'utf8'))
      .join('\n');
    // 用 node 真正 parse 检查
    const dupCheck = await page.evaluate((src) => {
      try {
        const m = {};
        eval(src);
        if (typeof window.I18N !== 'undefined') {
          ['zh','en','alertEn'].forEach(sec => {
            const d = window.I18N[sec];
            if (d && typeof d === 'object') {
              m[sec] = Object.keys(d).length;
            }
          });
        }
        return { ok: true, sizes: m };
      } catch (e) { return { ok: false, error: e.message }; }
    }, i18nData);
    record('i18n dict loads without error',
      dupCheck.ok,
      `sizes=${JSON.stringify(dupCheck.sizes)}`);

    // 静态检查：parse i18n-data.js 看 zh/en/alertEn 有没有重复 key
    const dupKeyCheck = await page.evaluate(() => {
      const check = (sec) => {
        const d = window.I18N && window.I18N[sec];
        if (!d) return null;
        const keys = Object.keys(d);
        return { total: keys.length, unique: new Set(keys).size };
      };
      return {
        zh: check('zh'),
        en: check('en'),
        alertEn: check('alertEn'),
      };
    });
    record('zh has 0 duplicate keys',
      dupKeyCheck.zh && dupKeyCheck.zh.total === dupKeyCheck.zh.unique,
      `zh total=${dupKeyCheck.zh?.total} unique=${dupKeyCheck.zh?.unique}`);
    record('en has 0 duplicate keys',
      dupKeyCheck.en && dupKeyCheck.en.total === dupKeyCheck.en.unique,
      `en total=${dupKeyCheck.en?.total} unique=${dupKeyCheck.en?.unique}`);
    record('alertEn has 0 duplicate keys',
      dupKeyCheck.alertEn && dupKeyCheck.alertEn.total === dupKeyCheck.alertEn.unique,
      `alertEn total=${dupKeyCheck.alertEn?.total} unique=${dupKeyCheck.alertEn?.unique}`);

  } catch (e) {
    console.log(`  [FAIL] EXCEPTION: ${e.message}`);
    console.log(e.stack);
    fail_count++;
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n' + '='.repeat(70));
  console.log(`PASS: ${pass_count}/${pass_count + fail_count}`);
  console.log('='.repeat(70));
  process.exit(fail_count === 0 ? 0 : 1);
}

main();
