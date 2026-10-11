// v54.273 Round 33 critical 8 bug 修复验证
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
  const exportJs = fs.readFileSync(path.join(ROOT, 'helpers-export.js'), 'utf8');
  const toastJs = fs.readFileSync(path.join(ROOT, 'helpers-toast.js'), 'utf8');
  const i18nZh = fs.readFileSync(path.join(ROOT, 'i18n-zh.js'), 'utf8');
  const i18nEn = fs.readFileSync(path.join(ROOT, 'i18n-en.js'), 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.273 Round 33 critical 8 bug 修复');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');
  // C1 spike recovery
  record('C1 app.js:1553 recoveries 用 Number.isFinite',
    appJs.includes('if(Number.isFinite(r)) recoveries.push(r)'));
  record('C1 app.js:1553 无残留 !Number.isFinite(r)',
    !/spike-rows.*tr\)[^=]+?if\(!Number.isFinite\(r\)\) recoveries\.push/.test(appJs));
  // C2 mp select onchange
  record('C2 app.js:4931 mp select 行不再用反斜杠引号字符串',
    !appJs.includes("'\\'\\\\' + _esc(i18n(\\\\\'\\\\'mpSolventLabel\\\\'\\\\'))"));
  record('C2 mp select onchange="onSel(\' + i + \'"', appJs.includes("onchange=\"onSel(' + i + ',this.value)\""));
  // C3 renderTiterStatCards 读 h.T
  record('C3 app.js:7416 tVals 用 h.T', appJs.includes('parseFloat(h.T)'));
  record('C3 app.js:7416 范围仅 renderTiterStatCards 内有 parseFloat h.T 而非 h.t',
    !/titerHist\.map\(h => parseFloat\(h\.t\)\)\.filter/.test(appJs));
  // C5 export helpers-export
  record('C5 helpers-export.js:69 加 drySpl per row + indep/shared 分支',
    exportJs.includes('drySpl = (100 - splM - splR) / 100'));
  record('C5 dryStd > 0 守卫',
    exportJs.includes('dryStd > 0'));
  // C6 setReportMeta — 排除注释残留
  record('C6 app.js:3364 setReportMetaFail 不在代码中（注释除外）',
    !/^[^/]*flashEl\(['"]setReportMetaFail['"]/.test(appJs.split('\n').filter(l => !l.trim().startsWith('/*') && !l.trim().startsWith('//')).join('\n')));

  // ===== v54.24 Media fixes =====
  // M1 helpers-export-comprehensive.js: l.slope → l.a（saveCurveHistory 字段名）
  const exportComp = fs.readFileSync(path.join(ROOT, 'helpers-export-comprehensive.js'), 'utf8');
  record('M1 helpers-export-comprehensive.js:273-274 用 l.a/l.b 不用 l.slope/l.intercept',
    exportComp.includes('if (l.a != null) la.push([i18n(\'hMdColSlopeA\'), l.a])') &&
    exportComp.includes('if (l.b != null) la.push([i18n(\'hMdColInterceptB\'), l.b])'));
  record('M1 helpers-export-comprehensive.js flattenLinear 用 l.a/l.b',
    exportComp.includes('slope: l.a, intercept: l.b'));

  // M5 app.js:5340 用 i18n(counterUnit) 不用 \' 条\' + \'无变化\' 改 i18n(mpNoChange)
  record('M5 app.js:5340 用 i18n(counterUnit) 替代字面 \' 条\'',
    appJs.includes('parsed.skipped + i18n(\'counterUnit\')') &&
    !/parsed\.skipped\s*\+\s*' 条'/.test(appJs));
  record('M5 app.js:5341 用 i18n(\'mpNoChange\') 替代字面 \'无变化\'',
    appJs.includes('i18n(\'mpNoChange\')') &&
    !/parts\.length\s*\?\s*parts\.join\([^)]+\)\s*:\s*'无变化'/.test(appJs));

  // M3 helpers-export.js header 检测加英文
  record('M3 helpers-export.js:25 加英文 No./Name 检测',
    exportJs.includes('/序号|杂质名称|No\\.|Name/i'));

  // M2 helpers-export-comprehensive.js i18n 化 threshold source + generator
  record('M2 helpers-export-comprehensive.js:382 i18n(cvReportGeneratorSelf)',
    exportComp.includes("generator: i18n('cvReportGeneratorSelf')"));
  record('M2 helpers-export-comprehensive.js:352/355 i18n 三阈值 source',
    exportComp.includes("source: i18n('cvThresholdPrecisionSource')") &&
    exportComp.includes("source: i18n('cvThresholdLinearSource')") &&
    exportComp.includes("source: i18n('cvThresholdStabilitySource')"));

  // 字典新 key
  record('字典含 cvReportGeneratorSelf zh', i18nZh.includes("cvReportGeneratorSelf:"));
  record('字典含 cvReportGeneratorSelf en', i18nEn.includes("cvReportGeneratorSelf:"));
  record('字典含 cvThresholdPrecisionSource zh', i18nZh.includes("cvThresholdPrecisionSource:"));
  record('字典含 mpNoChange zh', i18nZh.includes("mpNoChange: '无变化'"));
  record('字典含 mpNoChange en', i18nEn.includes("mpNoChange: 'No change'"));
  // I1 addParallel 缺 >
  record('I1 app.js 6 处 data-i18n="addParallel">+ 添加平行样 (无 +)',
    (appJs.match(/data-i18n="addParallel">\+/g) || []).length === 6);
  record('I1 app.js 无残留 data-i18n="addParallel"+ 添加平行样',
    !appJs.includes('data-i18n="addParallel"+'));
  // A1 h-checkbox aria-label
  record('A1 app.js:3511 h-checkbox 加 aria-label',
    appJs.includes('class="h-checkbox" data-idx=') && appJs.match(/h-checkbox[^>]*aria-label=/));
  // I3 toast Close i18n
  record('I3 helpers-toast.js:295 aria-label 用 i18n 拼接 toastClose',
    toastJs.includes("aria-label=\"' + i18n('toastClose') + '\""));
  record('I3 helpers-toast.js 无残留 aria-label="Close"',
    !toastJs.match(/aria-label="Close"/));
  // 字典
  record('字典含 toastClose zh', i18nZh.includes("toastClose: '关闭'"));
  record('字典含 toastClose en', i18nEn.includes("toastClose: 'Close'"));
  record('字典含 ariaSelectHistoryEntry zh', i18nZh.includes("ariaSelectHistoryEntry: '选择历史条目'"));
  record('字典含 ariaSelectHistoryEntry en', i18nEn.includes("ariaSelectHistoryEntry: 'Select history entry'"));

  // B. Puppeteer 实测
  console.log('\n--- B. Puppeteer 实测 ---');
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

  // A1 实测：h-checkbox 含 aria-label
  console.log('\n--- A1: h-checkbox aria-label ---');
  const a1 = await page.evaluate(async () => {
    if (typeof addH === 'function') {
      addH({ type: '统计计算', time: _formatNow ? _formatNow() : new Date().toISOString(), rsd: 1, mean: 100, sd: 1, n: 6 });
    }
    await new Promise(r => setTimeout(r, 600));
    if (typeof switchTab === 'function') switchTab('history');
    await new Promise(r => setTimeout(r, 1500)); /* 等 renderHistory 完成 */
    if (typeof renderHistory === 'function') renderHistory();
    await new Promise(r => setTimeout(r, 800));
    const cb = document.querySelector('.h-checkbox');
    return cb ? { hasAria: !!cb.getAttribute('aria-label'), aria: cb.getAttribute('aria-label') } : null;
  });
  record('A1 h-checkbox 实测有 aria-label',
    a1 && a1.hasAria && a1.aria && a1.aria.length > 0,
    JSON.stringify(a1));

  // C2 实测：mp select onchange
  console.log('\n--- C2: mp select onchange ---');
  const c2 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('mp');
    await new Promise(r => setTimeout(r, 600));
    const sel = document.querySelector('#mp-rows select');
    if (!sel) return { error: 'no select' };
    return {
      onchange: sel.getAttribute('onchange'),
      ariaLabel: sel.getAttribute('aria-label'),
      valid: /onSel\(\d+,/.test(sel.getAttribute('onchange') || '')
    };
  });
  record('C2 mp select onchange 含数字不是字面 "+i+"',
    c2.onchange && /onSel\(\d+,this\.value\)/.test(c2.onchange),
    JSON.stringify(c2));
  record('C2 mp select aria-label 是 i18n 文本不是字面',
    c2.ariaLabel && !/^\s*\'\s*\+/.test(c2.ariaLabel),
    JSON.stringify(c2));

  // I1 实测：6 个 添加平行样 按钮
  console.log('\n--- I1: 添加平行样 按钮 ---');
  const i1 = await page.evaluate(async () => {
    const tabs = ['content', 'drying', 'residue', 'titer', 'uniformity', 'dissolution'];
    const counts = [];
    for (const t of tabs) {
      try { switchTab(t); await new Promise(r => setTimeout(r, 300)); } catch (_) {}
      const btn = document.querySelector(`button[data-i18n="addParallel"]`);
      counts.push({ t, has: !!btn, text: btn ? btn.textContent.trim() : null });
    }
    return counts;
  });
  const allHaveBtn = i1.every(x => x.has);
  record('I1 6 个 tab 都有添加平行样按钮 (data-i18n="addParallel")',
    allHaveBtn, JSON.stringify(i1.filter(x => !x.has)));
  record('I1 6 个按钮文本含"添加平行样"',
    i1.every(x => x.text && x.text.includes('添加平行样')), JSON.stringify(i1));

  // I3 实测：toast 关闭按钮 aria-label
  console.log('\n--- I3: toast 关闭按钮 aria-label ---');
  const i3 = await page.evaluate(async () => {
    if (typeof _i18nToast !== 'function') return { error: 'no _i18nToast' };
    _i18nToast('toastSaved', 'success', 5000);
    await new Promise(r => setTimeout(r, 300));
    const btn = document.querySelector('.toast-close');
    return btn ? { aria: btn.getAttribute('aria-label') } : null;
  });
  record('I3 toast close 按钮 aria-label 是 i18n zh "关闭"',
    i3 && i3.aria === '关闭', JSON.stringify(i3));

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