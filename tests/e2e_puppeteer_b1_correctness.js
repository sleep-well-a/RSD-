// v54.272 B1 correctness 4 bug 修复验证
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
  console.log('RSD Calculator - v54.272 B1 correctness 4 bug fix');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');
  record('B1-1 judgeEntry 已反转 (!Number.isFinite → Number.isFinite)',
    appJs.includes('if (Number.isFinite(rsd)) { /* v54.272 fix (correctness CRITICAL)') &&
    !appJs.match(/if \(!Number\.isFinite\(rsd\)\) \{\s*if \(rsd > 5\)/));
  record('B1-2 calcCurve predicted-y 用 Number.isFinite 三元',
    appJs.includes('py.textContent = Number.isFinite(x) ? (a*x+b).toPrecision(6) : \'—\''));
  record('B1-2 calcCurve 无残留 !Number.isFinite(x) 后接 NaN',
    !appJs.match(/py && !Number\.isFinite\(x\)\) py\.textContent\s*=\s*\(a\*x\+b\)/));
  record('B1-3 renderTiterTrend fVals 用 filter Number.isFinite + 早 return',
    appJs.includes('const fVals = titerHist.map(x => parseFloat(x.f)).filter(Number.isFinite)') &&
    appJs.includes('if(fVals.length === 0) return;'));
  record('B1-3 renderTiterTrend 无残留 parseFloat(x.f) || 1（排除注释）',
    !appJs.match(/^(?!\/\*|\s*\*|.*\/\/).*parseFloat\(x\.f\)\s*\|\|\s*1\s*$/m));
  record('B1-4 _applyWeightUnitToAllInputs 有 stale-cache invalidation 逻辑',
    appJs.includes('_origHasCache') && appJs.includes('_weightRawMg.delete(el)'));

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

  // B1-1 judgeEntry 实测
  console.log('\n--- B1-1: judgeEntry RSD=10 应判失败 ---');
  const b11 = await page.evaluate(() => {
    const entry = { type: '统计计算', rsd: 10 };
    const result = judgeEntry(entry);
    return { verdict: result.verdict, issues: result.issues.map(i => i.rule) };
  });
  record('B1-1 judgeEntry RSD=10 应有 issues（之前因反转永远为空）',
    b11.issues.length > 0 && b11.issues.includes('RSD<=5%'),
    JSON.stringify(b11));

  // B1-2 calcCurve 实测
  console.log('\n--- B1-2: calcCurve invalid x → "—" 而非 "NaN" ---');
  const b12 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('curve');
    await new Promise(r => setTimeout(r, 300));
    const rows = document.querySelectorAll('#curve-rows tr');
    if (rows.length === 0) return { error: 'no curve rows' };
    const firstInput = rows[0].querySelector('input');
    firstInput.value = 'abc';
    firstInput.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof calcCurve === 'function') calcCurve();
    await new Promise(r => setTimeout(r, 400));
    const py = rows[0].querySelector('.result-col');
    return { py: py ? py.textContent.trim() : null };
  });
  record('B1-2 invalid x 显示 "—" 而非 "NaN"',
    b12.py !== 'NaN' && (b12.py === '—' || b12.py === ''),
    JSON.stringify(b12));

  // B1-3 renderTiterTrend 实测（添加 titer entry with f=0）
  console.log('\n--- B1-3: renderTiterTrend f=0 不被替换成 1 ---');
  const b13 = await page.evaluate(async () => {
    if (typeof addH === 'function') {
      addH({ type: '滴定度', time: _formatNow ? _formatNow() : new Date().toISOString(), f: 0, T: 1.0 });
    }
    await new Promise(r => setTimeout(r, 500));
    if (typeof renderTiterTrend === 'function') {
      try { renderTiterTrend(); } catch(e) { return { error: e.message }; }
    }
    const svg = document.getElementById('titer-trend-svg');
    if (!svg) return { error: 'no svg' };
    const circles = svg.querySelectorAll('circle');
    const innerHtml = svg.innerHTML.slice(0, 200);
    return { circleCount: circles.length, innerHtml };
  });
  record('B1-3 renderTiterTrend 至少 1 个 circle（f=0 不再被替换成 1 也不被过滤）',
    b13.circleCount >= 1, JSON.stringify(b13));

  // B1-4 _applyWeightUnitToAllInputs 实测 — 输入 0.05 g 切到 mg 应显示 50
  console.log('\n--- B1-4: _applyWeightUnitToAllInputs 不丢用户输入 ---');
  const b14 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('spike');
    await new Promise(r => setTimeout(r, 300));
    const el = document.getElementById('spike-original');
    if (!el) return { error: 'no spike-original' };
    if (typeof _setLang === 'function') _setLang('zh');
    // 默认 mg 模式 → 设 50
    if (typeof _applyWeightUnitToAllInputs === 'function') _applyWeightUnitToAllInputs();
    el.value = '50';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    // 切到 g
    if (typeof setWeightUnit === 'function') setWeightUnit('g');
    await new Promise(r => setTimeout(r, 300));
    const gVal = el.value;
    // 用户改成 0.05
    el.value = '0.05';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    // 切回 mg
    if (typeof setWeightUnit === 'function') setWeightUnit('mg');
    await new Promise(r => setTimeout(r, 300));
    const mgVal = el.value;
    if (typeof setWeightUnit === 'function') setWeightUnit('mg'); // 还原
    return { gVal, mgVal };
  });
  record('B1-4 spike-original: mg→g→手动改 0.05→mg 应保持 50（不被旧 cache 覆盖）',
    b14.gVal === '0.05' && b14.mgVal === '50', JSON.stringify(b14));

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