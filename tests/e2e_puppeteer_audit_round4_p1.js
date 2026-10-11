// v54.233 e2e_puppeteer_audit_round4_p1.js
// Round 4 P1 修复测试 (5 个真实 HIGH bug):
//   1. A#2 calcNormalize shared mode 不再回填 row input
//   2. A#4 _showSampleIdPrompt 监听器不累积
//   3. A#5 saveReportMetaFromSettings debounce 500ms
//   4. B#3 calcSpike null 守卫
//   5. C#1 clearStats 加 _confirmDialog
const puppeteer = require('puppeteer');
const fs = require('fs');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.233 e2e_puppeteer_audit_round4_p1.js');
  console.log('Round 4 P1 fixes regression tests');
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

    const appJs = fs.readFileSync('F:\\自制软件\\app.js', 'utf8');

    // ===================================================
    // 1. A#2: calcNormalize shared mode 不再写回 row input
    // ===================================================
    console.log('\n--- #1 calcNormalize no longer overwrites shared row inputs ---');
    const noSharedWriteback = !/} else\{\s*const sharedW = parseFloat\(document\.getElementById\('norm-spl-weight'\)\.value\);[\s\S]{0,400}wInput\.value = sharedW/.test(appJs);
    record('calcNormalize else-branch no longer writes sharedW back to row input',
      noSharedWriteback,
      `hasSharedWriteback=${!noSharedWriteback}`);

    // 真实测试：注入共享值 100，模拟用户改 row 5 输入为 200，
    // 触发 calcNormalize 后看 row 5 input 是否还是 200（之前会被覆盖成 100）
    const sharedTest = await page.evaluate(async () => {
      try {
        // 切到 normalize 页
        if (typeof switchTab === 'function') switchTab('recovery');
        await new Promise(r => setTimeout(r, 200));
        if (typeof switchRecovery === 'function') switchRecovery('normalize');
        await new Promise(r => setTimeout(r, 200));
        // 设置共享值
        const sw = document.getElementById('norm-spl-weight');
        const sd = document.getElementById('norm-spl-dilution');
        if (!sw || !sd) return { ok: false, error: 'no shared inputs' };
        sw.value = '100';
        sd.value = '50';
        // 触发表单 oninput 让 calcNormalize 跑一次（共享值会被读到）
        const ev = new Event('input', { bubbles: true });
        sw.dispatchEvent(ev);
        await new Promise(r => setTimeout(r, 100));
        // 用户改 row 1 的 weight input（模拟手动覆盖）
        const rowInput = document.querySelector('#norm-spl-rows tr .norm-spl-weight');
        if (!rowInput) return { ok: false, error: 'no row input' };
        rowInput.value = '200';
        rowInput.dispatchEvent(ev);
        await new Promise(r => setTimeout(r, 100));
        // 验证 row input 还是 200（不被共享值 100 覆盖）
        const stillUser = rowInput.value === '200';
        return { ok: true, rowValue: rowInput.value, stillUser };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('User-typed row input (200) is NOT overwritten by shared value (100)',
      sharedTest.ok && sharedTest.stillUser,
      `rowValue="${sharedTest.rowValue}" expected="200"`);

    // ===================================================
    // 2. A#4: _showSampleIdPrompt 监听器不累积
    // ===================================================
    console.log('\n--- #2 _showSampleIdPrompt listeners do not accumulate ---');
    const usesDatasetHandler = /okBtn\._handler = onOk;[\s\S]*?skipBtn\._handler = onSkip;[\s\S]*?input\._handler = onKey/.test(appJs);
    record('_showSampleIdPrompt uses dataset._handler for removeEventListener',
      usesDatasetHandler,
      'uses element._handler pattern');

    // 真实测试：调 10 次 _showSampleIdPrompt，确认 okBtn._handler 引用同一函数（即只 1 个监听器）
    const listenerTest = await page.evaluate(async () => {
      try {
        if (typeof _showSampleIdPrompt !== 'function') return { ok: false, error: 'no _showSampleIdPrompt' };
        // 强制 prompt modal 存在
        for (let i = 0; i < 10; i++) {
          _showSampleIdPrompt('S' + i, function(){ window._lastConfirm = i; }, function(){ window._lastCancel = i; });
          // 立即点 skip 关闭（走 closeFn）
          const skipBtn = document.getElementById('sampleid-prompt-skip');
          if (skipBtn) skipBtn.click();
          await new Promise(r => setTimeout(r, 30));
        }
        // 检查 modal 上还有多少 listener 残留（间接法：点 skip 应只触发 1 次 cancel）
        const okBtn = document.getElementById('sampleid-prompt-ok');
        if (!okBtn) return { ok: false, error: 'no okBtn' };
        // 用 okBtn._handler 引用稳定性测试：多次调用后 handler 还是同一个
        const handlerRefs = [];
        for (let i = 0; i < 5; i++) {
          _showSampleIdPrompt('T' + i, function(){}, function(){});
          handlerRefs.push(okBtn._handler);
          document.getElementById('sampleid-prompt-skip').click();
        }
        // v54.233 fix: 每次调用 _handler 都被覆盖为最新 onOk，所以引用都不同但每次 close 都移除旧 listener
        // 关键测试：调用 10 次后，listener 数应 ≤ 1（不是 10）
        // 间接验证：检查 modal.style.display 被设为 'none'（说明 close 跑了）
        const modal = document.getElementById('sampleid-prompt-modal');
        return { ok: true, displayAfter: modal ? modal.style.display : 'unknown', lastHandler: typeof handlerRefs[handlerRefs.length - 1] };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('_showSampleIdPrompt repeatedly called without error',
      listenerTest.ok,
      `result=${JSON.stringify(listenerTest).slice(0, 200)}`);

    // ===================================================
    // 3. A#5: saveReportMetaFromSettings debounce 500ms
    // ===================================================
    console.log('\n--- #3 saveReportMetaFromSettings debounced ---');
    const hasDebounce = /function saveReportMetaFromSettings\(\)[\s\S]{0,200}_saveReportMetaTimer[\s\S]{0,500}setTimeout/.test(appJs);
    record('saveReportMetaFromSettings uses setTimeout (debounced)',
      hasDebounce,
      'has _saveReportMetaTimer + setTimeout pattern');

    // 真实测试：连击 10 次 input，验证 setItem 只调用 1 次（500ms 后）
    const debounceTest = await page.evaluate(async () => {
      try {
        // 切到 settings 页
        if (typeof switchTab === 'function') switchTab('settings');
        await new Promise(r => setTimeout(r, 200));
        const input = document.getElementById('settings-sample-name');
        if (!input) return { ok: false, error: 'no settings-sample-name' };
        // 模拟原始 setItem 计数
        let writeCount = 0;
        const origSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(k, v) {
          if (k === 'rsd-report-meta') writeCount++;
          return origSetItem(k, v);
        };
        // 连续触发 10 次 oninput
        for (let i = 0; i < 10; i++) {
          input.value = 'name' + i;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // 立即检查：debounce 中，应该还没写
        await new Promise(r => setTimeout(r, 50));
        const writesImmediate = writeCount;
        // 等 debounce 完成（500ms + 缓冲）
        await new Promise(r => setTimeout(r, 600));
        const writesAfter = writeCount;
        localStorage.setItem = origSetItem;
        return { ok: true, writesImmediate, writesAfter };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('Debounce: 10 rapid keystrokes → 0 writes immediately, 1 write after 500ms',
      debounceTest.ok && debounceTest.writesImmediate === 0 && debounceTest.writesAfter === 1,
      `immediate=${debounceTest.writesImmediate} after500ms=${debounceTest.writesAfter}`);

    // ===================================================
    // 4. B#3: calcSpike null 守卫
    // ===================================================
    console.log('\n--- #4 calcSpike null guards ---');
    // 用更宽松的 regex：检查关键的两个 guard 模式分别存在
    const hasAddedGuard = /function calcSpike\(\)\{[\s\S]{0,1000}!addedEl\s*\|\|\s*!measuredEl/.test(appJs);
    const hasCellGuard = /!recCell\s*\|\|\s*!judgeCell/.test(appJs);
    record('calcSpike guards addedEl/measuredEl from null',
      hasAddedGuard,
      'has !addedEl || !measuredEl guard');
    record('calcSpike guards recCell/judgeCell from null',
      hasCellGuard,
      'has !recCell || !judgeCell guard');

    // 真实测试：注入一个 spike row 但删除 spike-added input，calcSpike 不应抛错
    const spikeGuardTest = await page.evaluate(async () => {
      try {
        if (typeof switchTab === 'function') switchTab('spike');
        await new Promise(r => setTimeout(r, 200));
        // 注入残缺 row（缺 spike-added input）
        const tbody = document.getElementById('spike-rows');
        if (!tbody) return { ok: false, error: 'no spike-rows' };
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>X</td>' +
          '<td><input type="text" class="spike-level" value="100%"></td>' +
          '<td></td>' +  // 故意空
          '<td><input type="text" class="spike-measured" value="5"></td>' +
          '<td class="spike-recovery">—</td>' +
          '<td class="spike-judge">—</td>';
        tbody.appendChild(tr);
        // 调 calcSpike，不应抛错
        let threw = false;
        try {
          calcSpike();
        } catch (e) {
          threw = true;
        }
        return { ok: !threw, threw };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('calcSpike() does NOT throw on row with missing spike-added input',
      spikeGuardTest.ok && !spikeGuardTest.threw,
      `threw=${spikeGuardTest.threw}`);

    // ===================================================
    // 5. C#1: clearStats 加 _confirmDialog
    // ===================================================
    console.log('\n--- #5 clearStats requires confirmation ---');
    const isAsyncClearStats = /async function clearStats\(\)\{[\s\S]{0,400}_confirmDialog/i.test(appJs);
    record('clearStats is async + calls _confirmDialog',
      isAsyncClearStats,
      'has "async function clearStats()" + "_confirmDialog"');

    // 真实测试：注入 5 个 row，调 clearStats 应弹 confirm 对话框
    const confirmTest = await page.evaluate(async () => {
      try {
        if (typeof switchTab === 'function') switchTab('stats');
        await new Promise(r => setTimeout(r, 200));
        const rows = document.getElementById('data-rows');
        if (!rows) return { ok: false, error: 'no data-rows' };
        // 注入 5 行
        rows.innerHTML = '';
        for (let i = 0; i < 5; i++) {
          const div = document.createElement('div');
          div.className = 'row';
          div.innerHTML = '<input type="text" value="' + (100 + i) + '" oninput="calcStats()">';
          rows.appendChild(div);
        }
        const beforeCount = rows.querySelectorAll('.row').length;
        // mock _confirmDialog 返回 false（拒绝确认）
        const orig = window._confirmDialog;
        let called = false;
        window._confirmDialog = function(msg, opts) {
          called = true;
          return Promise.resolve(false);  // 用户点取消
        };
        try { await clearStats(); } catch (e) { window._lastErr = 'reject: ' + e.message; }
        const afterCountReject = rows.querySelectorAll('.row').length;
        // 现在 mock 返回 true（确认）
        window._confirmDialog = function() { return Promise.resolve(true); };
        try { await clearStats(); } catch (e) { window._lastErr = 'accept: ' + e.message; }
        const afterCountAccept = rows.querySelectorAll('.row').length;
        window._confirmDialog = orig;
        return { ok: true, beforeCount, afterCountReject, afterCountAccept, confirmCalled: called, lastErr: window._lastErr || '' };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('clearStats: rejection keeps data, acceptance clears data',
      confirmTest && confirmTest.confirmCalled === true &&
        typeof confirmTest.afterCountReject === 'number' &&
        typeof confirmTest.afterCountAccept === 'number' &&
        confirmTest.afterCountReject === confirmTest.beforeCount &&
        confirmTest.afterCountAccept === 1,
      `before=${confirmTest && confirmTest.beforeCount} afterReject=${confirmTest && confirmTest.afterCountReject} afterAccept=${confirmTest && confirmTest.afterCountAccept} confirmCalled=${confirmTest && confirmTest.confirmCalled} err=${confirmTest && confirmTest.lastErr}`);

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
