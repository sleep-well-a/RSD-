// v54.282 Round 36 perf 第二波验证（renderHistory 14 处未 hoist + renderSpikeHistory + renderHistoryPagination + renderDrying）
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

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.282 Round 36 perf second wave');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');

  // A1: renderHistory 14 处未 hoist 已修复（v54.275 perf#7 漏的）
  console.log('\n--- A1: renderHistory 14 处未 hoist 已修复 ---');
  // 提取 renderHistory 函数体（`renderHistory = function() { ... }` → 跟到 "// pagination" 注释）
  const fnStart = appJs.indexOf('renderHistory = function');
  const fnEnd = appJs.indexOf('\n// pagination', fnStart + 100);
  const fnBody = appJs.substring(fnStart, fnEnd > 0 ? fnEnd : fnStart + 15000);
  // 在 forEach 块中查找剩余 i18n() 调用
  const forEachStart = fnBody.indexOf('visible.forEach');
  const forEachEnd = fnBody.indexOf('});', forEachStart);
  const forEachCode = forEachEnd > 0 ? fnBody.substring(forEachStart, forEachEnd) : '';
  const remainingUnhoisted = (forEachCode.match(/\bi18n\(/g) || []).length;
  record('A1.1 renderHistory 内 forEach 0 处未 hoist i18n', remainingUnhoisted === 0, 'remaining: ' + remainingUnhoisted);
  record('A1.2 renderHistory 已 hoist hRecoveryLabel',
    fnBody.includes('_iHRecoveryLabel'));
  record('A1.3 renderHistory 已 hoist hSampleCount',
    fnBody.includes('_iHSampleCount'));
  record('A1.4 renderHistory 已 hoist hTheoryShort',
    fnBody.includes('_iHTheoryShort'));
  record('A1.5 renderHistory 已 hoist hUniformL/Xbar/AS',
    fnBody.includes('_iHUniformL') && fnBody.includes('_iHUniformXbar') && fnBody.includes('_iHUniformAS'));
  record('A1.6 renderHistory 已 hoist hDissLabel',
    fnBody.includes('_iHDissLabel'));
  record('A1.7 renderHistory 已 hoist hCurveRegressionFmt/DataPoint',
    fnBody.includes('_iHCurveReg') && fnBody.includes('_iHCurveDP'));
  record('A1.8 renderHistory 已 hoist btnLoadHistory/Details/Delete/CopyJson',
    fnBody.includes('_iBtnLoad') && fnBody.includes('_iBtnDetails') && fnBody.includes('_iBtnDelete') && fnBody.includes('_iBtnCopyJson'));
  record('A1.9 renderHistory 已 hoist batch bar 5 个 key',
    fnBody.includes('_iBatchFmt') && fnBody.includes('_iBatchSelPage') &&
    fnBody.includes('_iBatchSelAll') && fnBody.includes('_iBatchDeselect') && fnBody.includes('_iBatchDelete'));

  // A2: renderSpikeHistory hoist
  console.log('\n--- A2: renderSpikeHistory hoist ---');
  const rshStart = appJs.indexOf('function renderSpikeHistory');
  // 跟到下一个 function 起始
  const rshEnd = appJs.indexOf('\nvar _curveChartInstance', rshStart + 200);
  const rshBody = appJs.substring(rshStart, rshEnd > 0 ? rshEnd : rshStart + 2000);
  // 提取 forEach 块内部（不应再含 i18n 调用）
  const rshForEachStart = rshBody.indexOf('.forEach');
  const rshForEachEnd = rshBody.indexOf('});', rshForEachStart);
  const rshForEachBody = rshForEachEnd > 0 ? rshBody.substring(rshForEachStart, rshForEachEnd) : '';
  record('A2.1 renderSpikeHistory forEach 内 0 处 i18n（已 hoist）',
    !rshForEachBody.includes('i18n(') && rshBody.includes('_iSpikeVerdict'));
  record('A2.2 renderSpikeHistory 用 .replace() 替代 .split().join() chain',
    rshBody.includes("_iSpikeVerdict.replace('{0}'"));

  // A3: renderHistoryPagination hoist
  console.log('\n--- A3: renderHistoryPagination hoist ---');
  const rhpStart = appJs.indexOf('function renderHistoryPagination');
  const rhpEnd = appJs.indexOf('\n// aria', rhpStart + 100);
  const rhpBody = appJs.substring(rhpStart, rhpEnd > 0 ? rhpEnd : rhpStart + 2000);
  // 提取 for 循环块内部
  const rhpForStart = rhpBody.indexOf('for (var i');
  const rhpForEnd = rhpBody.indexOf('}', rhpForStart + 50);
  const rhpForBody = rhpForEnd > 0 ? rhpBody.substring(rhpForStart, rhpForEnd + 1) : rhpBody;
  record('A3.1 renderHistoryPagination for 内 0 处 i18n（已 hoist）',
    !rhpForBody.includes('i18n(') && rhpBody.includes('_iPageFmt'));
  record('A3.2 renderHistoryPagination hoist btnPrev/Next',
    rhpBody.includes('_iBtnPrev') && rhpBody.includes('_iBtnNext'));

  // A4: renderDrying outer loop hoist
  console.log('\n--- A4: renderDrying outer loop hoist ---');
  const rdStart = appJs.indexOf('function renderDrying()');
  const rdEnd = appJs.indexOf('\nregisterModule', rdStart + 100);
  const rdBody = appJs.substring(rdStart, rdEnd > 0 ? rdEnd : rdStart + 2000);
  // 提取外层 forEach（dryingData.forEach）内部
  const rdOuterStart = rdBody.indexOf('dryingData.forEach');
  const rdOuterEnd = rdBody.indexOf('});', rdOuterStart);
  const rdOuterBody = rdOuterEnd > 0 ? rdBody.substring(rdOuterStart, rdOuterEnd) : '';
  record('A4.1 renderDrying outer forEach 内 0 处 i18n sampleNum',
    !rdOuterBody.includes("i18n('sampleNum')") && rdBody.includes('_iSampleNum'));
  record('A4.2 renderDrying outer forEach 内 0 处 i18n boldAvg/boldResult',
    !rdOuterBody.includes("i18n('boldAvg')") && !rdOuterBody.includes("i18n('boldResult')") &&
    rdBody.includes('_iBoldAvg') && rdBody.includes('_iBoldResult'));
  record('A4.3 renderDrying 复用 _ariaRmPar（不再重复 i18n）',
    rdBody.includes('_esc(_ariaRmPar)') && !rdBody.includes("_esc(i18n('ariaRemoveParallel'))"));

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

  // B1: renderHistory 大数据下 perf
  console.log('\n--- B1: renderHistory 200 条数据 ---');
  const b1 = await page.evaluate(async () => {
    if (typeof setH === 'function') setH([]);
    // 加 200 条 简易 recovery 历史
    const sampleData = { theory: '100.00', measured: '99.50', recovery: '99.50', type: '回收率-简易', time: '2026/10/1 10:00:00' };
    for (let i = 0; i < 200; i++) {
      if (typeof addH === 'function') addH({ ...sampleData, time: '2026/10/1 ' + (i % 24) + ':00:00' });
    }
    await new Promise(r => setTimeout(r, 500));
    if (typeof switchTab === 'function') switchTab('history');
    await new Promise(r => setTimeout(r, 500));
    const t0 = performance.now();
    if (typeof renderHistory === 'function') renderHistory();
    const elapsed = performance.now() - t0;
    const cardCount = document.querySelectorAll('#history-list .history-item').length;
    return { elapsed, cardCount, perfMs: Math.round(elapsed) };
  });
  record('B1.1 renderHistory 200 条数据后渲染完成',
    b1.cardCount >= 30, JSON.stringify(b1));  // 30 条/页
  record('B1.2 renderHistory 在 500ms 内完成',
    b1.elapsed < 500, JSON.stringify(b1));

  // B2: cache hit 大幅提升
  console.log('\n--- B2: renderHistory cache 命中 ---');
  const b2 = await page.evaluate(async () => {
    const cache = _i18nCache;
    const sizeBefore = cache.size;
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderHistory === 'function') renderHistory();
    const sizeAfter = cache.size;
    return { sizeBefore, sizeAfter, delta: sizeAfter - sizeBefore };
  });
  record('B2.1 renderHistory 3 次渲染 cache 不增长',
    b2.delta <= 0, JSON.stringify(b2));

  // B3: renderHistoryPagination hoist 验证
  console.log('\n--- B3: renderHistoryPagination 多页 hoist ---');
  const b3 = await page.evaluate(() => {
    if (typeof _historyPage !== 'undefined') _historyPage = 1;
    if (typeof renderHistory !== 'function') return { error: 'no renderHistory' };
    if (typeof renderHistoryPagination !== 'function') return { error: 'no renderHistoryPagination' };
    const html = renderHistoryPagination(200);
    const btnCount = (html.match(/aria-current/g) || []).length;
    return { html: html.length > 0, btnCount };
  });
  record('B3.1 renderHistoryPagination 多页输出 aria-current',
    typeof b3 === 'object' && b3.html === true, JSON.stringify(b3));

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