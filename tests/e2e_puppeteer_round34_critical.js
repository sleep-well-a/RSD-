// v54.274 Round 34 critical 5 bug 修复验证
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
  console.log('RSD Calculator - v54.274 Round 34 critical 5 bug fix');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');
  // i18n #1
  record('i18n#1 app.js 用 i18n(titerCategoryAll) 不用字面 全部',
    appJs.includes("renderTiterMethodOptions(i18n('titerCategoryAll'))") &&
    !appJs.includes("renderTiterMethodOptions('全部')"));
  // a11y #3 / correctness #6: /div> 字面量
  record('a11y#3/corr#6 app.js 无 ">/div>" 字面量',
    !appJs.includes('">/div>'));
  // a11y #1: card.id 不再被覆盖
  record('a11y#1 _initCardTitleA11y 无 body = card 兜底',
    !appJs.includes('body = card; // 没 .card-body 时'));
  record('a11y#1 _initCardTitleA11y 只在 .card-body 存在时设 aria-controls',
    /if\(body\)\{[\r\n]/.test(appJs) && appJs.includes("t.setAttribute('aria-controls', bodyId)"));
  // perf #2: _loadCollapsedMap hoist
  record('perf#2 _initCardTitleA11y hoist _loadCollapsedMap',
    appJs.includes('const _collapsedMap = _loadCollapsedMap(); /* v54.274 perf #2'));
  // 更简单：截取 _initCardTitleA11y 函数体，数 _loadCollapsedMap() 调用次数（应为 1）
  const fnStart = appJs.indexOf('function _initCardTitleA11y(){');
  const fnEnd = appJs.indexOf('\nfunction ', fnStart + 10);
  const fnBody = fnStart >= 0 ? appJs.slice(fnStart, fnEnd > 0 ? fnEnd : fnStart + 3000) : '';
  const callCount = (fnBody.match(/_loadCollapsedMap\(\)/g) || []).length;
  record('perf#2 _initCardTitleA11y 内 _loadCollapsedMap() 只调 1 次',
    callCount === 1, 'callCount=' + callCount);
  // perf #1: weight unit cache
  record('perf#1 _getWeightUnit 用 _weightUnitCache',
    appJs.includes('var _weightUnitCache = undefined') &&
    appJs.includes('if (_weightUnitCache !== undefined) return _weightUnitCache'));
  record('perf#1 setWeightUnit 同步 cache',
    appJs.includes('_weightUnitCache = u; /* v54.274 perf #1'));

  // ===== v54.274 第二批：correctness #3/#4/#5/#8 + i18n #2/#9/#13/#14/#15 + a11y #7 =====
  const exportJs2 = fs.readFileSync(path.join(ROOT, 'helpers-export.js'), 'utf8');
  const toastJs2 = fs.readFileSync(path.join(ROOT, 'helpers-toast.js'), 'utf8');
  const html2 = fs.readFileSync(path.join(ROOT, 'RSD & 含量计算器.html'), 'utf8');

  // correctness #3: collectExtData 存 theory
  record('corr#3 helpers-export.js collectExtData 存 theory 字段',
    exportJs2.includes('theory: theory, recovery: rec'));
  // correctness #4: 干燥/残渣 用 e.mean
  record('corr#4 干燥失重 trend 用 e.mean（不再读 s.loss）',
    !appJs.includes("s.loss];}).filter(Number.isFinite)") &&
    appJs.includes("var dLossMean = parseFloat(e.mean)"));
  record('corr#4 炽灼残渣 trend 用 e.mean',
    appJs.includes("var dResMean = parseFloat(e.mean)"));
  // correctness #5: 含量计算 trend 重算
  record('corr#5 含量计算 trend 用 e.stdArea/stdWeight 重算',
    appJs.includes('var _cf = _stdA / (_stdW * _stdP / 100 * _dryStdF / _stdD)') &&
    !appJs.includes('e.samples[0].result != null'));
  // correctness #8: rfmt 接受 string
  record('corr#8 rfmt 接受数字字符串',
    appJs.includes("var n = (typeof v === 'string') ? parseFloat(v) : v;"));
  // i18n #2: cvPageNumFmt
  record('i18n#2 PDF 页脚用 cvPageNumFmt',
    appJs.includes("i18n('cvPageNumFmt').replace('{0}', i)") &&
    !appJs.includes("'第 ' + i + ' / '"));
  record('i18n#2 字典 cvPageNumFmt zh/en',
    i18nZh.includes("cvPageNumFmt: '第 {0} / {1} 页'") && i18nEn.includes("cvPageNumFmt: 'Page {0} / {1}'"));
  // i18n #13: 8 sheet 名
  record('i18n#13 8 个 export*Excel 用 i18n(cvSheet*)',
    appJs.includes("i18n('cvSheetNorm')") && appJs.includes("i18n('cvSheetExt')") &&
    appJs.includes("i18n('cvSheetInt')") && appJs.includes("i18n('cvSheetDrying')") &&
    appJs.includes("i18n('cvSheetResidue')") && appJs.includes("i18n('cvSheetTiter')") &&
    appJs.includes("i18n('cvSheetUniformity')") && appJs.includes("i18n('cvSheetDissolution')"));
  record('i18n#13 字典 8 cvSheet* zh+en',
    i18nZh.includes("cvSheetNorm: '面积归一化法'") && i18nEn.includes("cvSheetNorm: 'Area Norm.'"));
  record('i18n#13 sheet 名 ≤31 字符（Excel 限制）',
    (i18nEn.match(/cvSheet\w+: '([^']+)'/g) || []).every(s => {
      const m = s.match(/: '([^']+)'/); return m && m[1].length <= 31;
    }));
  // i18n #9: toast suppressed hint
  record('i18n#9 helpers-toast.js 用 toastSuppressedHintFmt',
    toastJs2.includes("i18n('toastSuppressedHintFmt').replace('{0}', info.count)") &&
    !toastJs2.includes('🔇 已被抑制 '));
  record('i18n#9 字典 toastSuppressedHintFmt zh/en',
    i18nZh.includes('toastSuppressedHintFmt') && i18nEn.includes('toastSuppressedHintFmt'));
  // i18n #14: history-list aria-label
  record('i18n#14 HTML history-list 加 data-i18n-aria-label',
    html2.includes('id="history-list"') && html2.includes('data-i18n-aria-label="lblHistoryList"'));
  record('i18n#14 字典 lblHistoryList zh/en',
    i18nZh.includes("lblHistoryList: '历史记录列表'") && i18nEn.includes("lblHistoryList: 'History list'"));
  // i18n #15: M<sub>盐</sub>
  record('i18n#15 HTML M<sub data-i18n="lblSalt">',
    html2.includes('M<sub data-i18n="lblSalt">盐</sub>'));
  record('i18n#15 字典 lblSalt zh/en',
    i18nZh.includes("lblSalt: '盐'") && i18nEn.includes("lblSalt: 'Salt'"));
  // a11y #7: switchRecovery scoped
  record('a11y#7 switchRecovery 用 #page-recovery .subtab',
    appJs.includes("querySelectorAll('#page-recovery .subtab')"));
  record('a11y#7 无残留全局 querySelectorAll(\'.subtab\')',
    !/document\.querySelectorAll\('\.subtab'\)/.test(appJs));

  // ===== v54.274 第三批：i18n #3/#4/#5/#6/#7/#10/#11 =====
  record('i18n#3 MP batch CSV 表头用 lblComponent/lblAmount/lblUnit',
    appJs.includes("i18n('lblComponent'),i18n('ratioPercent'),i18n('lblAmount'),i18n('lblUnit')"));
  record('i18n#3 字典 lblUnit zh/en', i18nZh.includes("lblUnit: '单位'") && i18nEn.includes("lblUnit: 'Unit'"));
  record('i18n#4 Storage overview 用 lblStorageOverviewFmt',
    appJs.includes("i18n('lblStorageOverviewFmt').replace('{0}', h.length)") &&
    !appJs.includes("'Storage overview: '"));
  record('i18n#5 buildComprehensiveReport meta 4 处用 cvMeta*',
    appJs.includes("r.push([i18n('cvMetaBatch'), _pm.batch") &&
    appJs.includes("r.push([i18n('cvMetaColumn'), _pm.column"));
  record('i18n#6 _metaRows 用 cvMeta*',
    appJs.includes("[i18n('cvMetaBatch'), m.batch||'']"));
  record('i18n#7 recoverySheet 用 cvMethodType/cvSD/cvRsdPct',
    appJs.includes("[[i18n('cvMethodType'), records.recovery?.type") &&
    appJs.includes("[i18n('cvSD'), records.recovery?.cSd") &&
    appJs.includes("[i18n('cvRsdPct'), records.recovery?.cRsd"));
  record('i18n#10 MP solid 用 mpUnitSolid',
    appJs.includes("+i18n('mpUnitSolid')") && !appJs.includes('+" g (固)"'));
  record('i18n#11 mpRowsSummary 用 mpRowsEmpty',
    appJs.includes("return i18n('mpRowsEmpty')") && !appJs.includes("return '（空）'"));
  record('字典 mpUnitSolid / mpRowsEmpty zh+en',
    i18nZh.includes("mpUnitSolid: ' g (固)'") && i18nEn.includes("mpUnitSolid: ' g (solid)'") &&
    i18nZh.includes("mpRowsEmpty: '（空）'") && i18nEn.includes("mpRowsEmpty: '(empty)'"));

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

  // B1: EN 模式 滴定液 select 非空
  console.log('\n--- B1: EN 模式 滴定液 select 非空 ---');
  const b1 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('titer');
    await new Promise(r => setTimeout(r, 600));
    if (typeof _setLang === 'function') _setLang('en');
    await new Promise(r => setTimeout(r, 600));
    // 重新触发 renderTiterMethodOptions（模拟 tab 切换）
    if (typeof initTiterFull === 'function') { try { initTiterFull(); } catch(_){} }
    await new Promise(r => setTimeout(r, 400));
    const sel = document.getElementById('titer-method-select');
    const optCount = sel ? sel.querySelectorAll('option').length : 0;
    const zh = i18n('titerCategoryAll');
    if (typeof _setLang === 'function') _setLang('zh');
    return { optCount, titerCategoryAllEn: zh };
  });
  record('B1 EN 模式 滴定液 select option 数 > 1（之前 0）',
    b1.optCount > 1, JSON.stringify(b1));
  record('B1 titerCategoryAll en = "All"',
    b1.titerCategoryAllEn === 'All', JSON.stringify(b1));

  // B2: card.id 未被重命名 → toggleHideInputs 可用
  console.log('\n--- B2: card.id 未被重命名 ---');
  const b2 = await page.evaluate(() => {
    const ids = ['norm-spl-card', 'ext-spl-card', 'int-spl-card'];
    const found = ids.map(id => ({ id, exists: !!document.getElementById(id) }));
    return found;
  });
  record('B2 norm-spl-card / ext-spl-card / int-spl-card 保留原名',
    b2.every(x => x.exists), JSON.stringify(b2));

  // B3: toggleHideInputs 实际工作
  console.log('\n--- B3: toggleHideInputs 实际工作 ---');
  const b3 = await page.evaluate(async () => {
    const card = document.getElementById('norm-spl-card');
    if (!card) return { error: 'no card' };
    const before = card.classList.contains('hide-inputs');
    if (typeof toggleHideInputs === 'function') toggleHideInputs('norm-spl-card');
    await new Promise(r => setTimeout(r, 200));
    const after = card.classList.contains('hide-inputs');
    if (typeof toggleHideInputs === 'function') toggleHideInputs('norm-spl-card'); // 还原
    return { before, after, changed: before !== after };
  });
  record('B3 toggleHideInputs 切换 hide-inputs class',
    b3.changed === true, JSON.stringify(b3));

  // B4: 滴定度 stat cards 数字不消失
  console.log('\n--- B4: 滴定度 stat card 数字显示 ---');
  const b4 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('titer');
    await new Promise(r => setTimeout(r, 500));
    // 加一条 titer 历史让 stat card 有数字
    if (typeof addH === 'function') {
      addH({ type: '滴定度', time: _formatNow ? _formatNow() : new Date().toISOString(), vs: '20', v0s: '0.05', ms: '100', ps: '0.1', f: '1.005', T: '0.9988' });
    }
    await new Promise(r => setTimeout(r, 400));
    if (typeof renderTiterStatCards === 'function') renderTiterStatCards();
    await new Promise(r => setTimeout(r, 400));
    const el = document.getElementById('titer-stat-cards') || document.querySelector('.titer-stat-cards');
    if (!el) return { error: 'no stat cards container' };
    const html = el.innerHTML;
    const labelDivs = el.querySelectorAll('[data-i18n^="titer"]');
    // 检查数字 div 是否与 label div 平级（不嵌套）
    const nested = Array.from(labelDivs).filter(d => d.querySelector('div[style*="font-size:18px"]'));
    return { hasLiteralDiv: html.includes('">/div>'), nestedCount: nested.length, labelCount: labelDivs.length };
  });
  record('B4 滴定度 stat card 无 /div> 字面量',
    b4.hasLiteralDiv === false, JSON.stringify(b4));
  record('B4 数字 div 不与 label div 嵌套',
    b4.nestedCount === 0, JSON.stringify(b4));

  // B5: _getWeightUnit cache 行为
  console.log('\n--- B5: _getWeightUnit cache ---');
  const b5 = await page.evaluate(async () => {
    if (typeof setWeightUnit !== 'function') return { error: 'no setWeightUnit' };
    setWeightUnit('g');
    const a = _getWeightUnit();
    setWeightUnit('mg');
    const b = _getWeightUnit();
    // 直接改 localStorage 看 cache 是否 stale（应仍返回 mg，因为 setWeightUnit 已同步）
    localStorage.setItem('rsd-weight-unit', 'g');
    const c = _getWeightUnit(); // cache 仍 mg（直到 setWeightUnit 或 _invalidate 调用）
    localStorage.setItem('rsd-weight-unit', 'mg');
    setWeightUnit('mg'); // 还原
    return { afterSetG: a, afterSetMg: b, afterDirectStorageChange: c };
  });
  record('B5 setWeightUnit(g) → _getWeightUnit()=g',
    b5.afterSetG === 'g', JSON.stringify(b5));
  record('B5 setWeightUnit(mg) → _getWeightUnit()=mg',
    b5.afterSetMg === 'mg', JSON.stringify(b5));

  // B6: correctness #4/#5 — trend chart 实际能画干燥/残渣/含量
  console.log('\n--- B6: trend 干燥/残渣/含量 数据（_extractChartData）---');
  const b6 = await page.evaluate(async () => {
    // 清历史 + 加 3 条不同类型
    if (typeof setH === 'function') setH([]);
    if (typeof addH === 'function') {
      addH({ type: '干燥失重', time: '2026/10/1 10:00:00', mean: '1.2345', sd: '0.01', rsd: '0.8', count: 3, samples: [{ parallels: [{ w0: '100', w1: '95', w2: '93.8' }] }] });
      addH({ type: '炽灼残渣', time: '2026/10/1 11:00:00', mean: '0.4321', sd: '0.005', rsd: '1.1', count: 3, samples: [{ parallels: [{ w0: '50', w1: '50', w2: '49.8' }] }] });
      addH({ type: '外标含量', time: '2026/10/1 12:00:00',
        stdArea: '100000', stdWeight: '100', stdPurity: '99', stdDilution: '100', stdMoisture: '0', stdResidue: '0',
        samples: [{ weight: '100', dilution: '100', moisture: '0', residue: '0', parallels: [{ area: '99000' }] }] });
    }
    await new Promise(r => setTimeout(r, 500));
    // _extractChartData(history) 接受参数（生产调用点 app.js:930 `_extractChartData(h)`）
    var groups = null;
    if (typeof _extractChartData === 'function') {
      try { groups = _extractChartData(getH()); } catch (e) { return { error: e.message }; }
    }
    if (!groups) return { error: 'no groups' };
    const result = {};
    Object.keys(groups).forEach(k => { if (groups[k] && groups[k].length) result[k] = groups[k].length; });
    return { groups: result, hLen: typeof getH === 'function' ? getH().length : -1 };
  });
  record('B6 干燥失重 trend 有数据点（之前永远空）',
    b6.groups && (b6.groups['干燥失重'] > 0 || b6.groups['干燥失重(drying)'] > 0),
    JSON.stringify(b6));
  record('B6 炽灼残渣 trend 有数据点（之前永远空）',
    b6.groups && (b6.groups['炽灼残渣'] > 0 || b6.groups['炽灼残渣(residue)'] > 0),
    JSON.stringify(b6));
  record('B6 外标含量 trend 有数据点（之前永远空）',
    b6.groups && Object.keys(b6.groups).some(k => k.includes('含量') && b6.groups[k] > 0),
    JSON.stringify(b6));

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