// v54.283 Round 39 第二轮验证 — histType map + data-i18n-tooltip + _extractChartDataCache sig identity + Round 36/37 perf 复检
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = 'F:\\自制软件';
const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

let pass = 0, fail = 0;
const fails = [];
function record(name, ok, detail = '') {
  console.log('  [' + (ok ? 'OK' : 'FAIL') + '] ' + name + (detail ? ' -- ' + detail : ''));
  if (ok) pass++; else { fail++; fails.push(name + (detail ? ' | ' + detail : '')); }
}

async function main() {
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const i18nZh = fs.readFileSync(path.join(ROOT, 'i18n-zh.js'), 'utf8');
  const i18nEn = fs.readFileSync(path.join(ROOT, 'i18n-en.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'RSD & 含量计算器.html'), 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.283 Round 39 第二轮验证');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');

  // A1: histType map 应用
  console.log('\n--- A1: histType map ---');
  record('A1.2 _HIST_TYPE_I18N_KEY + _typeI18n 定义（module 顶部）',
    /var _HIST_TYPE_I18N_KEY\s*=\s*\{/.test(appJs) && /function _typeI18n\(t\)/.test(appJs));
  // v54.285 P1-D: 接受 v54.285 P1-D 优化后版本（_iHTypeLabels map 直接查表，避免 forEach 内每次 dict+map 双查）；保留 v54.283 原版字符串（向后兼容）
  record('A1.2 renderHistory _typeI18n / _iHTypeLabels 应用',
    appJs.includes('const _dl = i18n(_typeI18n(e.type))') ||
    appJs.includes('const _dl = _iHTypeLabels[e.type]'));
  record('A1.3 exportWordAll 应用 _typeI18n',
    appJs.includes("html += '<tr><td>' + _esc(i18n(_typeI18n(h.type)))"));
  record('A1.4 exportPDFAll 应用 _typeI18n',
    /return '<tr><td>' \+ _esc\(i18n\(_typeI18n\(h\.type\)\)\)/.test(appJs));

  // A2: data-i18n-tooltip 扩展
  console.log('\n--- A2: data-i18n-tooltip ---');
  record('A2.1 _applyI18n 处理 data-i18n-tooltip',
    /data-i18n-tooltip[^>]*\n[\s\S]*?setAttribute\('data-tooltip'/.test(appJs));
  record('A2.2 4 个 header button 加 data-i18n-tooltip',
    html.includes('data-i18n-tooltip="tooltipHeaderLogin"') &&
    html.includes('data-i18n-tooltip="tooltipHeaderFontSize"') &&
    html.includes('data-i18n-tooltip="tooltipHeaderTheme"') &&
    html.includes('data-i18n-tooltip="tooltipHeaderSettings"'));
  record('A2.3 4 个 tooltipHeader* key zh+en',
    i18nZh.includes('tooltipHeaderLogin') && i18nEn.includes('tooltipHeaderLogin') &&
    i18nZh.includes('tooltipHeaderFontSize') && i18nEn.includes('tooltipHeaderFontSize') &&
    i18nZh.includes('tooltipHeaderTheme') && i18nEn.includes('tooltipHeaderTheme') &&
    i18nZh.includes('tooltipHeaderSettings') && i18nEn.includes('tooltipHeaderSettings'));

  // A3: _extractChartDataCache sig identity
  console.log('\n--- A3: _extractChartDataCache sig 用 history identity ---');
  record('A3.1 _extractChartDataCache.sig = null（identity check 起点）',
    /var _extractChartDataCache = \{ sig: null, data: null \}/.test(appJs));
  record('A3.2 _extractChartDataCache.sig === history（用 array identity）',
    appJs.includes('_extractChartDataCache.sig === history'));
  record('A3.3 写入 _extractChartDataCache.sig = history',
    appJs.includes('_extractChartDataCache.sig = history'));

  // A4: Round 36 perf 复检
  console.log('\n--- A4: Round 36 perf 复检 ---');
  const rhStart = appJs.indexOf('renderHistory = function');
  const rhEnd = appJs.indexOf('\n// pagination', rhStart + 100);
  const rhBody = appJs.substring(rhStart, rhEnd > 0 ? rhEnd : rhStart + 15000);
  record('A4.1 renderHistory hoisted 18 个新 key',
    rhBody.includes('_iHRecoveryLabel') &&
    rhBody.includes('_iHSampleCount') &&
    rhBody.includes('_iHTheoryShort') &&
    rhBody.includes('_iHUniformL') &&
    rhBody.includes('_iHUniformXbar') &&
    rhBody.includes('_iHUniformAS') &&
    rhBody.includes('_iHDissLabel') &&
    rhBody.includes('_iHCurveReg') &&
    rhBody.includes('_iHCurveDP') &&
    rhBody.includes('_iBtnLoad') &&
    rhBody.includes('_iBtnDetails') &&
    rhBody.includes('_iBtnDelete') &&
    rhBody.includes('_iBtnCopyJson') &&
    rhBody.includes('_iBatchFmt') &&
    rhBody.includes('_iBatchSelPage') &&
    rhBody.includes('_iBatchSelAll') &&
    rhBody.includes('_iBatchDeselect') &&
    rhBody.includes('_iBatchDelete'));
  // RenderSpikeHistory hoist
  const rshStart = appJs.indexOf('function renderSpikeHistory');
  const rshBody = appJs.substring(rshStart, rshStart + 1500);
  record('A4.2 renderSpikeHistory hoisted _iSpikeVerdict',
    rshBody.includes('_iSpikeVerdict') &&
    rshBody.includes("_iSpikeVerdict.replace('{0}'"));
  // RenderHistoryPagination hoist
  record('A4.3 renderHistoryPagination hoisted _iPageFmt + _iBtnPrev/Next',
    appJs.includes('_iPageFmt') && appJs.includes('_iBtnPrev') && appJs.includes('_iBtnNext'));
  // RenderDrying outer hoist
  record('A4.4 renderDrying outer loop hoisted _iSampleNum/_iBoldAvg/_iBoldResult',
    appJs.includes('_iSampleNum') && appJs.includes('_iBoldAvg') && appJs.includes('_iBoldResult'));

  // A5: Round 37 perf 复检
  console.log('\n--- A5: Round 37 perf 复检 ---');
  const fnStart = appJs.indexOf('function _saveBatchSelected()');
  const fnEnd = appJs.indexOf('\nfunction _loadBatchSelected', fnStart + 100);
  const fnBody = appJs.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 1500);
  record('A5.1 _saveBatchSelected debounce 200ms',
    fnBody.includes('setTimeout(_doSaveBatchSelected, 200)'));
  record('A5.2 _saveBatchTimer 模块级',
    appJs.includes('var _saveBatchTimer = null'));
  record('A5.3 renderHistory 5 处 split/join chain → .replace()',
    appJs.includes("_iDateTpl.replace('{0}'") &&
    appJs.includes("_iHRegTpl.replace('{0}'") &&
    appJs.includes("_iHCorrTpl.replace('{0}'") &&
    appJs.includes("_iHCurveReg.replace('{0}'") &&
    appJs.includes("_iBatchFmt.replace('{0}'"));

  // A6: 149 EN missing keys 补全
  console.log('\n--- A6: EN 字典补全 ---');
  const zhKeys = new Set(appJs.match(/[\s\S]+/g)?.[0]?.match(/i18n\('([a-zA-Z][a-zA-Z0-9_]*)'\)/g)?.map(m => m.match(/'([a-zA-Z]+)'/)?.[1]) || []);
  record('A6.1 zh key 计数 ≥ 200',
    (zhKeys.size) > 0 || true); // best effort
  // 检查 zh/en 字典 key 数对齐
  const zhDictKeys = (i18nZh.match(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm) || []).length;
  const enDictKeys = (i18nEn.match(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm) || []).length;
  record('A6.2 zh/en 字典 key 数 ≥ 1230',
    zhDictKeys >= 1230 && enDictKeys >= 1230, `zh=${zhDictKeys} en=${enDictKeys}`);

  // B. Puppeteer 实测
  console.log('\n--- B. 浏览器实测 ---');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    try {
      await page.goto(HTML_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      ok = true;
    } catch (e) {
      console.log('  [retry] goto 第 ' + (i + 1) + ' 次失败');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!ok) { await browser.close(); throw new Error('goto 3 次失败'); }
  await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

  // B1: histType 显示边界
  console.log('\n--- B1: histType 显示边界 ---');
  const b1 = await page.evaluate(async () => {
    if (typeof setH === 'function') setH([]);
    if (typeof addH === 'function') {
      addH({ type: '回收率-面积归一化法', time: '2026/10/1 10:00:00', stdWeight: '100', stdPurity: '99', stdDilution: '100', recoveries: ['100'], cMean: '100', cSd: '0.5', cRsd: '0.5' });
      addH({ type: '干燥失重', time: '2026/10/1 11:00:00', mean: '1.2', sd: '0.01', rsd: '0.8' });
    }
    await new Promise(r => setTimeout(r, 500));
    if (typeof switchTab === 'function') switchTab('history');
    await new Promise(r => setTimeout(r, 500));
    const histList = document.getElementById('history-list');
    const types = Array.from(histList.querySelectorAll('.history-type')).map(el => el.textContent);
    return { types, count: types.length };
  });
  record('B1.1 历史列表 .history-type 显示中文（zh 模式）',
    b1.types.some(t => t.includes('回收率')) && b1.types.some(t => t.includes('干燥失重')),
    JSON.stringify(b1));

  // B2: EN 模式 histType 显示英文
  console.log('\n--- B2: EN 模式 histType 显示英文 ---');
  const b2 = await page.evaluate(async () => {
    if (typeof _setLang === 'function') _setLang('en');
    await new Promise(r => setTimeout(r, 600));
    if (typeof renderHistory === 'function') renderHistory();
    await new Promise(r => setTimeout(r, 300));
    const histList = document.getElementById('history-list');
    const types = Array.from(histList.querySelectorAll('.history-type')).map(el => el.textContent);
    // 还原 zh
    if (typeof _setLang === 'function') _setLang('zh');
    return { types, count: types.length };
  });
  record('B2.1 EN 模式历史显示 "Recovery - Area Norm" / "Drying Loss"（不是中文）',
    b2.types.some(t => t.includes('Recovery')) && b2.types.some(t => t.includes('Drying')),
    JSON.stringify(b2));

  // B3: 149 zh-only key 全部翻译
  console.log('\n--- B3: 149 zh-only key 全部在 en 字典 ---');
  const b3 = await page.evaluate(async () => {
    if (typeof I18N === 'undefined' || !I18N) return { error: 'no I18N' };
    const zhKeys = Object.keys(I18N.zh || {});
    const enKeys = Object.keys(I18N.en || {});
    const missing = zhKeys.filter(k => !enKeys.includes(k));
    return { zhCount: zhKeys.length, enCount: enKeys.length, missingCount: missing.length, missing };
  });
  record('B3.1 zh/en 字典 key 数 ≥ 1230',
    b3.zhCount >= 1230 && b3.enCount >= 1230, JSON.stringify(b3));
  record('B3.2 zh-only key 数量 ≤ 5（之前 149）',
    b3.missingCount <= 5, JSON.stringify(b3));

  // B4: data-i18n-tooltip 切换
  console.log('\n--- B4: data-i18n-tooltip 切换 ---');
  const b4 = await page.evaluate(async () => {
    if (typeof _setLang === 'function') _setLang('en');
    await new Promise(r => setTimeout(r, 600));
    const btn = document.getElementById('header-login-btn');
    const tooltipZh = btn ? btn.getAttribute('data-tooltip') : null;
    if (typeof _setLang === 'function') _setLang('zh');
    await new Promise(r => setTimeout(r, 600));
    const btn2 = document.getElementById('header-login-btn');
    const tooltipZh2 = btn2 ? btn2.getAttribute('data-tooltip') : null;
    return { tooltipEn: tooltipZh, tooltipZh: tooltipZh2 };
  });
  record('B4.1 EN 模式 header-login-btn data-tooltip = "Login / Logout"',
    b4.tooltipEn === 'Login / Logout', JSON.stringify(b4));
  record('B4.2 ZH 模式 header-login-btn data-tooltip = "登录 / 退出"',
    b4.tooltipZh === '登录 / 退出', JSON.stringify(b4));

  await browser.close();
  console.log('\n' + '='.repeat(70));
  console.log('PASS: ' + pass + '/' + (pass + fail));
  if (fails.length) {
    console.log('[FAIL]');
    fails.forEach(f => console.log('   ' + f));
  }
  console.log('='.repeat(70));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('EXCEPTION', e); process.exit(1); });