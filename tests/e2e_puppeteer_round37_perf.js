// v54.282 Round 37 perf 第三波 — split/join chain 大改造 + _saveBatchSelected debounce
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
  const helpersToast = fs.readFileSync(path.join(ROOT, 'helpers-toast.js'), 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.282 Round 37 perf third wave (split/join + debounce)');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');

  // A1: app.js 中 .split('{N}').join() chain 全部清空
  console.log('\n--- A1: app.js split/join chain 全部清除 ---');
  const appSplitJoin = (appJs.match(/\.split\('\{[0-9]+\}'\)\.join\(/g) || []).length;
  record('A1.1 app.js 无剩余 .split(\'{N}\').join() chain', appSplitJoin === 0, '剩余: ' + appSplitJoin);

  // A2: helpers-toast.js 内部 .split().join() chain 清除
  console.log('\n--- A2: helpers-toast.js _i18nToast 改用 .replace() ---');
  const toastSplitJoin = (helpersToast.match(/\.split\('\{.*?\}'.+?\.join\(/g) || []).length;
  record('A2.1 helpers-toast.js 无剩余 .split().join() chain', toastSplitJoin === 0, '剩余: ' + toastSplitJoin);
  record('A2.2 _i18nToast 用 .replace(/\\{(\\d+)\\}/g, ...) 一次替换',
    helpersToast.includes('.replace(/\\{(\\d+)\\}/g'));

  // A3: _saveBatchSelected debounce
  console.log('\n--- A3: _saveBatchSelected debounce ---');
  const fnStart = appJs.indexOf('function _saveBatchSelected()');
  const fnEnd = appJs.indexOf('\nfunction _loadBatchSelected', fnStart + 100);
  const fnBody = appJs.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 1500);
  record('A3.1 _saveBatchSelected 用 setTimeout debounce',
    fnBody.includes('setTimeout'));
  record('A3.2 _saveBatchSelected 内部 _doSaveBatchSelected 函数',
    fnBody.includes('function _doSaveBatchSelected') || appJs.includes('function _doSaveBatchSelected'));
  record('A3.3 _saveBatchTimer 变量声明',
    appJs.includes('var _saveBatchTimer') || appJs.includes('let _saveBatchTimer'));
  record('A3.4 debounce 延迟 200ms',
    fnBody.includes('200'));

  // A4: 全部源码（除 helpers-toast）应无剩余 split/join chain
  console.log('\n--- A4: 全部源码 split/join chain 总清扫 ---');
  const helpersExport = fs.readFileSync(path.join(ROOT, 'helpers-export.js'), 'utf8');
  const helpersExportComp = fs.readFileSync(path.join(ROOT, 'helpers-export-comprehensive.js'), 'utf8');
  const helpersI18n = fs.readFileSync(path.join(ROOT, 'helpers-i18n.js'), 'utf8');
  const allFiles = {
    'app.js': appJs,
    'helpers-export.js': helpersExport,
    'helpers-export-comprehensive.js': helpersExportComp,
    'helpers-toast.js': helpersToast,
    'helpers-i18n.js': helpersI18n
  };
  for (const [name, content] of Object.entries(allFiles)) {
    const m = (content.match(/\.split\('\{[0-9]+\}'\)\.join\(/g) || []).length;
    record('A4.' + name + ' 无 split/join chain', m === 0, '剩余: ' + m);
  }

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

  // B1: _saveBatchSelected debounce 实际工作
  console.log('\n--- B1: _saveBatchSelected debounce 实际工作 ---');
  const b1 = await page.evaluate(async () => {
    if (typeof window._batchSelected === 'undefined') window._batchSelected = new Set();
    const origSetItem = localStorage.setItem.bind(localStorage);
    let writeCount = 0;
    localStorage.setItem = function(...args) { writeCount++; return origSetItem(...args); };

    // 模拟 10 次连续 toggle
    for (let i = 0; i < 10; i++) {
      window._batchSelected.add(100 + i);
      _saveBatchSelected();
    }

    // debounce 200ms 后只应写 1 次
    await new Promise(r => setTimeout(r, 350));
    const writesAfterDebounce = writeCount;

    localStorage.setItem = origSetItem;
    return { writesAfterDebounce, expected: 1 };
  });
  record('B1.1 10 次 _saveBatchSelected 调用 → localStorage.setItem 1 次',
    b1.writesAfterDebounce === 1, JSON.stringify(b1));

  // B2: _i18nToast .replace() chain 工作
  console.log('\n--- B2: _i18nToast .replace() 工作 ---');
  const b2 = await page.evaluate(async () => {
    if (typeof _i18nToast !== 'function') return { error: 'no _i18nToast' };
    let captured = null;
    const origToast = window.toast;
    window.toast = function(msg, type, dur) { captured = { msg, type, dur }; };
    _i18nToast('toast_saved', 'info', 3000);
    window.toast = origToast;
    return { captured };
  });
  record('B2.1 _i18nToast 调用正常',
    typeof b2 === 'object' && b2.captured !== null, JSON.stringify(b2));

  // B3: 渲染性能（cache + hoist 累积效果）
  console.log('\n--- B3: 渲染性能累积 ---');
  const b3 = await page.evaluate(async () => {
    if (typeof setH === 'function') setH([]);
    const sampleData = { theory: '100.00', measured: '99.50', recovery: '99.50', type: '回收率-简易', time: '2026/10/1 10:00:00' };
    for (let i = 0; i < 200; i++) {
      if (typeof addH === 'function') addH({ ...sampleData, time: '2026/10/1 ' + (i % 24) + ':00:00' });
    }
    await new Promise(r => setTimeout(r, 500));
    if (typeof switchTab === 'function') switchTab('history');
    await new Promise(r => setTimeout(r, 500));
    // 第一次 render
    const t0 = performance.now();
    if (typeof renderHistory === 'function') renderHistory();
    const elapsed1 = performance.now() - t0;
    // 第二次 render（cache + hoist 全命中）
    const t1 = performance.now();
    if (typeof renderHistory === 'function') renderHistory();
    const elapsed2 = performance.now() - t1;
    return { first: Math.round(elapsed1), second: Math.round(elapsed2) };
  });
  record('B3.1 renderHistory 200 条首次渲染 < 500ms',
    b3.first < 500, JSON.stringify(b3));
  record('B3.2 renderHistory 200 条第二次渲染 < 100ms（cache 命中）',
    b3.second < 100, JSON.stringify(b3));

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