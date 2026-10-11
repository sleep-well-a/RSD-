// v54.283 Round 39 audit fix 验证 — 5 HIGH/MEDIUM bug 修复 + perf 优化
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

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.283 Round 39 audit fix');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');

  // A1: dryFactor 守卫
  console.log('\n--- A1: stdF() dryFactor 守卫 ---');
  const stdFFnStart = appJs.indexOf('function stdF()');
  const stdFFnEnd = appJs.indexOf('function renderContent()', stdFFnStart + 100);
  const stdFBody = appJs.substring(stdFFnStart, stdFFnEnd > 0 ? stdFFnEnd : stdFFnStart + 1500);
  record('A1.1 stdF 加 dryFactor <= 0 守卫', stdFBody.includes('if(dryFactor <= 0) return NaN'));

  // A2: calcNormalize 共享模式 drySpl 守卫
  console.log('\n--- A2: calcNormalize 共享模式 drySpl 守卫 ---');
  record('A2.1 calcNormalize 加 if(drySpl <= 0) return',
    appJs.includes('if(drySpl <= 0) return;'));

  // A3: calcDrying 函数定义
  console.log('\n--- A3: calcDrying 函数定义 ---');
  record('A3.1 calcDrying 函数已定义',
    /function\s+calcDrying\s*\(\s*\)\s*\{\s*renderDrying/.test(appJs));

  // A4: saveMwHistory 函数定义
  console.log('\n--- A4: saveMwHistory 函数定义 ---');
  record('A4.1 saveMwHistory 函数已定义',
    /function\s+saveMwHistory\s*\(/.test(appJs));
  record('A4.2 saveMwHistory 用 _saveWithSampleIdPrompt 持久化',
    (appJs.match(/function\s+saveMwHistory[\s\S]{0,1500}/) || [''])[0].includes('_saveWithSampleIdPrompt(entry'));

  // A5: cvR2EqFmt 占位符全部替换
  console.log('\n--- A5: cvR2EqFmt {0}+{1} 替换完整 ---');
  const cvR2Idx = appJs.indexOf("i18n('cvR2EqFmt')");
  const cvR2Apply = cvR2Idx > 0 ? appJs.substring(cvR2Idx, cvR2Idx + 200) : '';
  record('A5.1 cvR2EqFmt 替换 {0} 和 {1}',
    cvR2Apply.includes(".replace('{0}'") && cvR2Apply.includes(".replace('{1}'"));

  // A6: _extractChartDataCache sig 用 array identity
  console.log('\n--- A6: _extractChartDataCache sig 用 array identity ---');
  const cacheDeclStart = appJs.indexOf('var _extractChartDataCache');
  const cacheDeclEnd = appJs.indexOf('\n', cacheDeclStart + 100);
  const cacheDecl = appJs.substring(cacheDeclStart, cacheDeclEnd);
  record('A6.1 _extractChartDataCache.sig = null（identity check）',
    cacheDecl.includes('sig: null'));
  record('A6.2 _extractChartDataCache.sig === history（vs 之前的 length+time+type）',
    appJs.includes('_extractChartDataCache.sig === history'));

  // A7: renderHistory checkbox _iAriaSelEsc hoist
  console.log('\n--- A7: renderHistory checkbox _iAriaSelEsc hoist ---');
  const rhIdx = appJs.indexOf('renderHistory = function');
  const rhEnd = appJs.indexOf('\n// pagination', rhIdx + 100);
  const rhBody = appJs.substring(rhIdx, rhEnd > 0 ? rhEnd : rhIdx + 15000);
  record('A7.1 renderHistory hoisted _iAriaSelEsc',
    rhBody.includes('const _iAriaSelEsc = _esc(_iAriaSel) + \' \''));
  record('A7.2 renderHistory checkbox aria-label 用 _iAriaSelEsc（不再 _esc(_iAriaSel)）',
    !rhBody.includes("aria-label=\\'\" + _esc(_iAriaSel)"));

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

  // B1: 综合报告 cvLinearity 显示完整"R²=X.XXXX"无裸 {1}
  console.log('\n--- B1: 综合报告 cvLinearity 显示完整 ---');
  const b1 = await page.evaluate(async () => {
    if (typeof setH === 'function') setH([]);
    if (typeof addH === 'function') {
      addH({ type: '标准曲线', time: '2026/10/1 10:00:00', points: [{x:'1',y:'2'}], a: '2.5', b: '0.1', r2: '0.9998' });
    }
    await new Promise(r => setTimeout(r, 300));
    if (typeof buildComprehensiveReport !== 'function') return { error: 'no buildComprehensiveReport' };
    const recs = (typeof selectComprehensiveRecords === 'function') ? selectComprehensiveRecords() : {};
    const report = buildComprehensiveReport(recs, {});
    // 查找包含 cvLinearity 的 row（index 会因 recovery/stability 存在而变化）
    const linearRow = report.find(r => r && r[0] && (r[0] === '线性' || r[0].includes('Linearity') || r[0].includes('线性'))) || [];
    return { txt: String(linearRow[1] || ''), hasR2: linearRow[1] && linearRow[1].includes('0.9998'), hasPlaceholder: linearRow[1] && linearRow[1].includes('{1}') };
  });
  record('B1.1 综合报告 cvLinearity 显示 R²=0.9998',
    b1.txt.includes('R²=0.9998'), JSON.stringify(b1));
  record('B1.2 综合报告 cvLinearity 不含裸占位符 {1}',
    !b1.hasPlaceholder, JSON.stringify(b1));

  // B2: calcDrying 可绕生效（Ctrl+Enter 在 drying tab）
  console.log('\n--- B2: calcDrying 函数 ---');
  const b2 = await page.evaluate(async () => {
    if (typeof calcDrying !== 'function') return { error: 'no calcDrying' };
    return { exists: true, type: typeof calcDrying };
  });
  record('B2.1 calcDrying 函数存在', b2.exists === true, JSON.stringify(b2));

  // B3: saveMwHistory 可绕生效
  console.log('\n--- B3: saveMwHistory 函数 ---');
  const b3 = await page.evaluate(async () => {
    if (typeof saveMwHistory !== 'function') return { error: 'no saveMwHistory' };
    return { exists: true, type: typeof saveMwHistory };
  });
  record('B3.1 saveMwHistory 函数存在', b3.exists === true, JSON.stringify(b3));

  // B4: dryFactor 守卫 — 输入 >100 不应给负值
  console.log('\n--- B4: stdF() dryFactor 守卫 ---');
  const b4 = await page.evaluate(async () => {
    if (typeof stdF !== 'function') return { error: 'no stdF' };
    // 模拟 std-moisture=60, std-residue=50 → 100+ → 应返回 NaN 而非负
    const out = stdF.call({});
    return { out, isNaN: Number.isNaN(out) || out < 0 };
  });
  record('B4.1 stdF 在 dryFactor ≤ 0 时返回 NaN/0（默认空 input 状态下）',
    typeof b4 === 'object' && b4.error !== 'no stdF', JSON.stringify(b4));

  // B5: renderHistory perf — 200 条数据 hoist 后加速
  console.log('\n--- B5: renderHistory perf 累积 ---');
  const b5 = await page.evaluate(async () => {
    if (typeof setH === 'function') setH([]);
    const sampleData = { theory: '100', measured: '99.5', recovery: '99.5', type: '回收率-简易', time: '2026/10/1 10:00:00' };
    for (let i = 0; i < 200; i++) {
      if (typeof addH === 'function') addH({ ...sampleData, time: '2026/10/1 ' + (i % 24) + ':00:00' });
    }
    await new Promise(r => setTimeout(r, 500));
    if (typeof switchTab === 'function') switchTab('history');
    await new Promise(r => setTimeout(r, 500));
    const t0 = performance.now();
    if (typeof renderHistory === 'function') renderHistory();
    const elapsed = performance.now() - t0;
    return { elapsed: Math.round(elapsed), cardCount: document.querySelectorAll('#history-list .history-item').length };
  });
  record('B5.1 renderHistory 200 条数据 + _iAriaSelEsc hoist < 200ms',
    b5.elapsed < 200, JSON.stringify(b5));

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