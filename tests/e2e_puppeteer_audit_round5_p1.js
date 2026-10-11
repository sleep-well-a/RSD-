// v54.238 e2e_puppeteer_audit_round5_p1.js
// Round 5 P1 修复测试 - agent 报的 10 个 bug:
//   #1 _setupStorageSync rsd-theme 删除处理
//   #2 saveSpikeHistory NaN→0 污染
//   #3 _exportModuleExcel + exportCVExcel .then().catch()
//   #4 exportHistoryPDF onError UI 反馈
//   #5 drawTrendChart NaN→0 趋势图污染
//   #6 双 class × 6 (动态 HTML 字符串)
//   #7 exportHistoryPDF 静默回退 window.print()
//   #8 _updateThemeBtnLabel 硬编码中文
//   #9 _showFactoryResetUndoToast localStorage 残留
//   #10 loadScript listener 累积
const puppeteer = require('puppeteer');
const fs = require('fs');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.238 e2e_puppeteer_audit_round5_p1.js');
  console.log('Round 5 P1 fixes (agent reported 10 bugs)');
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
    // #1 rsd-theme 删除 fallback to light
    // ===================================================
    console.log('\n--- #1 _setupStorageSync rsd-theme delete fallback ---');
    const themeFallback = /if \(typeof setTheme === 'function'\) setTheme\(val \|\| 'light'\)/.test(appJs);
    record('rsd-theme sync uses (val || "light") fallback', themeFallback,
      '删除时 val=null → fallback light');

    // ===================================================
    // #2 saveSpikeHistory Number.isFinite
    // ===================================================
    console.log('\n--- #2 saveSpikeRecoveryHistory NaN→null ---');
    // 实际函数名是 saveSpikeRecoveryHistory（line 1297），NaN→null 在内部 closure
    const spikeIsFinite = /Number\.isFinite\(v\) \? v : null/.test(appJs) &&
                          /saveSpikeRecoveryHistory[\s\S]{0,2000}recovery:/.test(appJs);
    record('saveSpikeRecoveryHistory uses Number.isFinite (not || 0)', spikeIsFinite);

    // ===================================================
    // #3 export .then().catch() (2 处)
    // ===================================================
    console.log('\n--- #3 export .then().catch() ---');
    const exportHasCatch1 = /function _exportModuleExcel[\s\S]{0,3500}\.catch\(function\(err\)/.test(appJs);
    record('_exportModuleExcel has .catch()', exportHasCatch1);
    // exportCVExcel 是 async function，.catch 距离函数开头约 4023 chars（v54.238 测时约 3603，v54.274+ 加 i18n 化 meta 让 +420 chars）
    // 实际代码: .catch(function(err){ console.error('[export CV] xlsx failed', err);
    const exportCvHasCatch = /exportCVExcel[\s\S]{0,5000}\.catch\(function\(err\)\{ console\.error\('\[export CV\] xlsx failed'/.test(appJs);
    record('exportCVExcel has .catch()', exportCvHasCatch);

    // ===================================================
    // #4 exportHistoryPDF onError UI
    // ===================================================
    console.log('\n--- #4 exportHistoryPDF onError shows alert ---');
    // 实际代码: console.error('PDF export failed:', err); （: 是字面冒号不是 regex 字符）
    const pdfOnErrorAlert = /onError: function\(err\) \{ console\.error\('PDF export failed:', err\); if\(typeof _i18nAlert === 'function'\) _i18nAlert\('cvReportExportFail'\)/.test(appJs);
    record('exportHistoryPDF onError uses _i18nAlert', pdfOnErrorAlert);

    // ===================================================
    // #5 drawTrendChart NaN filter
    // ===================================================
    console.log('\n--- #5 drawTrendChart NaN filter ---');
    // v54.274: 原契约 `/e\.samples.*filter\(Number\.isFinite\)/` 已随 correctness #4/#5 修复失效
    //   （干燥/残渣改用 entry-level e.mean；含量计算改为重算 + Number.isFinite 守卫）。
    // 新契约：_extractChartData 内至少 3 处 Number.isFinite 守卫（stats / 含量重算 / 各类型）。
    const _ecdStart = appJs.indexOf('function _extractChartData(');
    const _ecdEnd = _ecdStart >= 0 ? appJs.indexOf('\nfunction ', _ecdStart + 10) : -1;
    const _ecdBody = _ecdStart >= 0 ? appJs.slice(_ecdStart, _ecdEnd > 0 ? _ecdEnd : _ecdStart + 8000) : '';
    const _finiteCount = (_ecdBody.match(/Number\.isFinite/g) || []).length;
    record('drawTrendChart filters NaN samples (≥3 Number.isFinite guards in _extractChartData)',
      _finiteCount >= 3, 'count=' + _finiteCount);

    // ===================================================
    // #6 双 class 修复 × 6
    // ===================================================
    console.log('\n--- #6 dual class fixed × 6 ---');
    const dualClassStill = /class="(content|drying|residue|titer|uniformity|dissolution)-sample.*"\s+class="/.test(appJs);
    record('No more dual class in sample containers', !dualClassStill,
      dualClassStill ? 'still has dual class' : 'all 6 merged');

    const hasMerged = /class="content-sample sample-row mb-10"/.test(appJs) &&
                      /class="drying-sample sample-row mb-10"/.test(appJs) &&
                      /class="residue-sample sample-row mb-10"/.test(appJs) &&
                      /class="titer-sample sample-row mb-10"/.test(appJs) &&
                      /class="uniformity-sample sample-row mb-10"/.test(appJs) &&
                      /class="dissolution-sample sample-row mb-10"/.test(appJs);
    record('All 6 sample-row containers have merged mb-10', hasMerged);

    // ===================================================
    // #7 exportHistoryPDF silent window.print
    // ===================================================
    console.log('\n--- #7 exportHistoryPDF shows alert before print fallback ---');
    const printFallback = /if \(typeof html2pdf === 'undefined'\) \{[\s\S]{0,200}_i18nAlert\(['"]pdfMissing['"]\)/.test(appJs);
    record('html2pdf undefined → _i18nAlert + window.print()', printFallback);

    // ===================================================
    // #8 _updateThemeBtnLabel i18n
    // ===================================================
    console.log('\n--- #8 _updateThemeBtnLabel uses i18n ---');
    const themeI18n = /function _updateThemeBtnLabel\(\)[\s\S]{0,300}i18n\(['"]btnThemeLight['"]\)/.test(appJs);
    record('_updateThemeBtnLabel uses i18n(btnThemeDark/Light)', themeI18n);

    // 行为测试：en 模式下 _updateThemeBtnLabel 返回英文
    const themeEnTest = await page.evaluate(async () => {
      try {
        if (typeof _setLang === 'function') _setLang('en');
        await new Promise(r => setTimeout(r, 300));
        localStorage.setItem('rsd-theme', 'dark');
        if (typeof _updateThemeBtnLabel === 'function') _updateThemeBtnLabel();
        const label = document.getElementById('theme-btn-label');
        return { ok: true, text: label ? label.textContent : null, isEnglish: label && /[A-Za-z]/.test(label.textContent) };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('en mode theme-btn-label shows English (not 深色)',
      themeEnTest.ok && themeEnTest.isEnglish,
      `text="${themeEnTest.text}"`);

    // 切回中文
    await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
    await new Promise(r => setTimeout(r, 300));

    // ===================================================
    // #9 factoryReset undo localStorage cleanup
    // ===================================================
    console.log('\n--- #9 factoryReset undo localStorage cleanup ---');
    // v54.238 fix: 自动消失时同时清 localStorage undo 数据。
    // 实际代码（line 7267）: setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); try { localStorage.removeItem('rsd-last-factoryreset-undo'); } catch (_) {} }, ms);
    const undoCleanup = /if \(div\.parentNode\) div\.parentNode\.removeChild\(div\);[\s\S]{0,200}localStorage\.removeItem\('rsd-last-factoryreset-undo'\)/.test(appJs);
    record('factoryReset undo toast setTimeout cleans localStorage', undoCleanup);

    // ===================================================
    // #10 loadScript listener
    // ===================================================
    console.log('\n--- #10 loadScript listener cleanup ---');
    const loadScriptCleanup = /existing\._loadHandler[\s\S]{0,200}removeEventListener\(['"]load['"], existing\._loadHandler\)/.test(appJs);
    record('loadScript removes existing _loadHandler before adding new', loadScriptCleanup);

    // 行为测试：loadScript 同一 src 多次调用，第二次不会保留旧 listener
    const loadScriptTest = await page.evaluate(async () => {
      try {
        const testSrc = 'data:text/javascript,console.log(1);';
        // 第一次创建
        await loadScript(testSrc);
        const s = document.querySelector('script[src="' + testSrc + '"]');
        if (!s) return { ok: false, error: 'no script tag created' };

        // 模拟"已有旧 listener"
        const oldHandler = function() {};
        s._loadHandler = oldHandler;
        s.dataset.loaded = 'false';

        // 第二次调 loadScript：应进 else 分支，替换 _loadHandler
        loadScript(testSrc);
        const newHandler = s._loadHandler;
        const isReplaced = newHandler !== oldHandler && typeof newHandler === 'function';

        // 直接验证 _loadHandler 已存在（被重新创建）+ 不等于旧的 = 不会 listener 累积
        return { ok: true, isReplaced, isStable: true, oldHandler, newHandler };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('loadScript replaces old _loadHandler (no listener accumulation)',
      loadScriptTest.ok && loadScriptTest.isReplaced,
      `replaced=${loadScriptTest.isReplaced} (old→new handler ref different)`);

    // ===================================================
    // #11 回归测试：clear 函数 + i18n 系统仍正常
    // ===================================================
    console.log('\n--- #11 regression ---');
    const regression = await page.evaluate(async () => {
      try {
        const origConfirm = window._confirmDialog;
        const fns = ['clearStats', 'clearContent', 'clearSpike', 'clearCurve', 'clearTiter'];
        const results = {};
        for (const fn of fns) {
          window._confirmDialog = function() { return Promise.resolve(false); };
          try { await window[fn](); results[fn] = 'ok'; }
          catch (e) { results[fn] = 'err'; }
        }
        window._confirmDialog = origConfirm;
        return { ok: true, results };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    const regOk = regression.ok && Object.values(regression.results).every(v => v === 'ok');
    record('5 clear functions still work (regression)', regOk);

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
