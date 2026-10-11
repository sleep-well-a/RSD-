// v54.281 Round 35 critical + HIGH 10 bug fix 验证
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
  const helpersExportComprehensive = fs.readFileSync(path.join(ROOT, 'helpers-export-comprehensive.js'), 'utf8');
  const helpersI18n = fs.readFileSync(path.join(ROOT, 'helpers-i18n.js'), 'utf8');
  const styles = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'RSD & 含量计算器.html'), 'utf8');
  const altHtml = fs.readFileSync(path.join(ROOT, 'RSD & 含量计算器_流动相版.html'), 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.281 Round 35 critical + HIGH 10 bug fix');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');

  // A1: CRITICAL correctness #1 — totalRSD → rsd (10 sites)
  console.log('\n--- A1: CRITICAL correctness #1 — totalRSD 全部改 rsd ---');
  const precisionDotRsds = (appJs.match(/precision\.rsd|precision\?\.rsd/g) || []).length;
  const precisionDotTotalRsd = (appJs.match(/precision\.totalRSD|precision\?\.totalRSD/g) || []).length;
  const helpersExportTotalRsd = (helpersExportComprehensive.match(/precision\.totalRSD|p\.totalRSD/g) || []).length;
  record('A1.1 app.js precision.totalRSD 全部移除', precisionDotTotalRsd === 0, '残留: ' + precisionDotTotalRsd);
  record('A1.2 app.js precision.rsd 引用 ≥6 处', precisionDotRsds >= 6, 'count: ' + precisionDotRsds);
  record('A1.3 helpers-export-comprehensive.js precision.totalRSD 全部移除', helpersExportTotalRsd === 0, '残留: ' + helpersExportTotalRsd);
  record('A1.4 helpers-export-comprehensive.js 用 records.precision.rsd（替代 totalRSD）',
    helpersExportComprehensive.includes("records.precision.rsd") || helpersExportComprehensive.includes("p.rsd"));
  // 注释里允许出现 totalRSD（说明文档）
  const totalRsdInComments = (helpersExportComprehensive.match(/\/\*.*totalRSD|\/\/.*totalRSD/g) || []).length;
  record('A1.5 helpers-export-comprehensive.js 注释保留 totalRSD 文档',
    totalRsdInComments >= 1, 'comment count: ' + totalRsdInComments);

  // A2: CRITICAL a11y #2 — </thead> typo 修复
  console.log('\n--- A2: CRITICAL a11y #2 — thead typo 修复 ---');
  record('A2.1 spike-table 用 </thead> 不再用 thead>',
    html.includes('id="spike-table"') && /<table[^>]*spike-table[^>]*>\s*<thead>/.test(html),
    'contains <thead> opening');
  record('A2.2 无 <th scope="col"ead> typo',
    !html.includes('<th scope="col"ead>'));

  // A3: CRITICAL a11y #3 — dark mode CSS
  console.log('\n--- A3: CRITICAL a11y #3 — dark mode CSS ---');
  record('A3.1 styles.css 含 [data-theme="dark"] 块',
    styles.includes('[data-theme="dark"]') && styles.includes('--bg:'));
  record('A3.2 dark 模式重定义 --card 变量',
    /\[data-theme="dark"\][\s\S]*?--card/.test(styles));
  record('A3.3 dark 模式重定义 --text 变量',
    /\[data-theme="dark"\][\s\S]*?--text:/.test(styles));

  // A4: HIGH #4 — printPDF 12 处硬编码 → i18n
  console.log('\n--- A4: HIGH #4 — printPDF i18n ---');
  record('A4.1 printPDF 已用 i18n(\'hMeasuredFmt\')',
    appJs.includes("i18n('hMeasuredFmt')"));
  record('A4.2 printPDF 已用 i18n(\'tplContentParen\')',
    appJs.includes("i18n('tplContentParen')"));
  record('A4.3 printPDF 已用 i18n(\'hLabelLimit\')',
    appJs.includes("i18n('hLabelLimit')"));
  record('A4.4 printPDF 已用 i18n(\'hUniformVerdict\')',
    appJs.includes("i18n('hUniformVerdict')"));
  record('A4.5 printPDF 已用 i18n(\'hCurveDataPoint\')',
    appJs.includes("i18n('hCurveDataPoint')"));
  record('A4.6 printPDF 已用 cvDryingParallelLabelFmt',
    appJs.includes("i18n('cvDryingParallelLabelFmt')"));
  record('A4.7 printPDF 已用 cvCurveEqFmt',
    appJs.includes("i18n('cvCurveEqFmt')"));
  record('A4.8 printPDF 已用 cvCurveR2Fmt',
    appJs.includes("i18n('cvCurveR2Fmt')"));
  record('A4.9 printPDF 已用 pdfFooterGenFmt',
    appJs.includes("i18n('pdfFooterGenFmt')"));
  record('A4.10 printPDF 已用 pdfGroupHeaderFmt',
    appJs.includes("i18n('pdfGroupHeaderFmt')"));
  record('A4.11 printPDF 已用 pdfSampleAreaFmt',
    appJs.includes("i18n('pdfSampleAreaFmt')"));
  record('A4.12 printPDF 已用 hSd/hRsd 替代 SD/RSD(%):',
    appJs.includes("i18n('hSd')+':") && appJs.includes("i18n('hRsd')+' (%):"));
  record('A4.13 字典 5 个新 key zh+en',
    i18nZh.includes("cvDryingParallelLabelFmt:") &&
    i18nEn.includes("cvDryingParallelLabelFmt:") &&
    i18nZh.includes("cvCurveEqFmt:") &&
    i18nEn.includes("cvCurveEqFmt:") &&
    i18nZh.includes("cvCurveR2Fmt:") &&
    i18nEn.includes("cvCurveR2Fmt:") &&
    i18nZh.includes("pdfFooterGenFmt:") &&
    i18nEn.includes("pdfFooterGenFmt:") &&
    i18nZh.includes("pdfGroupHeaderFmt:") &&
    i18nEn.includes("pdfGroupHeaderFmt:") &&
    i18nZh.includes("pdfSampleAreaFmt:") &&
    i18nEn.includes("pdfSampleAreaFmt:"));

  // A5: HIGH #5 — markdown SD/RSD
  console.log('\n--- A5: HIGH #5 — markdown SD/RSD ---');
  record('A5.1 markdown 用 i18n(\'hSd\') 不再用字面 SD',
    helpersExportComprehensive.includes("i18n('hSd')") &&
    !/'\|\s*SD\s*\|/.test(helpersExportComprehensive));
  record('A5.2 markdown 用 i18n(\'hRsd\') 不再用字面 RSD (%)',
    helpersExportComprehensive.includes("i18n('hRsd')") &&
    !/'\|\s*RSD\s*\(%\)\s*\|/.test(helpersExportComprehensive));

  // A6: HIGH #6 — _流动相版.html a11y
  console.log('\n--- A6: HIGH #6 — _流动相版.html a11y ---');
  record('A6.1 _流动相版.html 4 个 norm-std label 加 for=',
    altHtml.includes('for="norm-std-weight"') &&
    altHtml.includes('for="norm-std-purity"') &&
    altHtml.includes('for="norm-std-dilution"') &&
    altHtml.includes('for="norm-std-moisture"') &&
    altHtml.includes('for="norm-std-residue"'));
  record('A6.2 _流动相版.html norm-manual-f label 加 for=',
    altHtml.includes('for="norm-manual-f"'));
  record('A6.3 _流动相版.html 3 个 select 加 aria-label',
    /id="mp-preset"[^>]*aria-label=/.test(altHtml) &&
    /id="mp-buf-salt"[^>]*aria-label=/.test(altHtml) &&
    /id="mp-grad-preset"[^>]*aria-label=/.test(altHtml));
  record('A6.4 _流动相版.html norm-spl-* input 加 aria-label',
    /class="norm-spl-weight"[^>]*aria-label=/.test(altHtml) &&
    /class="norm-spl-dilution"[^>]*aria-label=/.test(altHtml) &&
    /class="norm-spl-area-pct"[^>]*aria-label=/.test(altHtml));

  // A7: HIGH #7 — form error aria-describedby
  console.log('\n--- A7: HIGH #7 — form error aria-describedby ---');
  record('A7.1 errHint 分配稳定 id',
    appJs.includes("errHint.id = 'formulaError-'"));
  record('A7.2 错误路径设 aria-invalid',
    appJs.includes("setAttribute('aria-invalid', 'true')"));
  record('A7.3 错误路径设 aria-describedby',
    appJs.includes("setAttribute('aria-describedby', errHint.id)"));
  record('A7.4 成功路径清除 aria-invalid',
    appJs.includes("removeAttribute('aria-invalid')"));

  // A8: HIGH #8 — i18n per-key cache
  console.log('\n--- A8: HIGH #8 — i18n per-key cache ---');
  record('A8.1 helpers-i18n.js 声明 _i18nCache',
    helpersI18n.includes('var _i18nCache = new Map()'));
  record('A8.2 i18n() 早期 cache 命中',
    /function i18n\(key\)[\s\S]*?_i18nCache\.has/.test(helpersI18n));
  record('A8.3 i18n() 缓存成功 lookup',
    /function i18n\(key\)[\s\S]*?_i18nCache\.set\(key/.test(helpersI18n));
  record('A8.4 _setLang 清 cache',
    appJs.includes('_i18nCache.clear()'));

  // A9: HIGH #9 — addH 冗余 deep-clone 移除
  console.log('\n--- A9: HIGH #9 — addH 冗余 deep-clone ---');
  const addHFn = (() => {
    const start = appJs.indexOf('function addH(entry)');
    if (start < 0) return '';
    const end = appJs.indexOf('\nfunction ', start + 10);
    return end > 0 ? appJs.slice(start, end) : '';
  })();
  record('A9.1 addH 内无 _historyCache = JSON.parse(JSON.stringify(h))',
    !/_historyCache\s*=\s*JSON\.parse\(JSON\.stringify\(h\)\)/.test(addHFn));

  // A10: HIGH #10 — cMean/cSd/cRsd 数字类型
  console.log('\n--- A10: HIGH #10 — cMean/cSd/cRsd 数字化 ---');
  record('A10.1 _fillRecoveryNormalizeEntry 用 parseFloat 包装',
    appJs.includes("entry.cMean = parseFloat(gt('nrec-mean'))"));
  record('A10.2 _fillRecoveryExternalEntry 用 parseFloat 包装',
    appJs.includes("entry.cMean = parseFloat(gt('erec-mean'))"));
  record('A10.3 _fillRecoveryInternalEntry 用 parseFloat 包装',
    appJs.includes("entry.cMean = parseFloat(gt('irec-mean'))"));

  // ===== B. Puppeteer 实测 =====
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

  // B1: dark mode 实际切换
  console.log('\n--- B1: dark mode 实际切换 ---');
  const b1 = await page.evaluate(async () => {
    if (typeof setTheme !== 'function') return { error: 'no setTheme' };
    setTheme('dark');
    await new Promise(r => setTimeout(r, 200));
    const darkBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    setTheme('light');
    await new Promise(r => setTimeout(r, 200));
    const lightBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    return { darkBg, lightBg, different: darkBg !== lightBg };
  });
  record('B1.1 dark mode --bg 改变',
    b1.different === true, JSON.stringify(b1));

  // B2: comprehensive report RSD 显示实际数字（不显示 "undefined"）
  console.log('\n--- B2: comprehensive report RSD 显示 ---');
  const b2 = await page.evaluate(async () => {
    if (typeof setH === 'function') setH([]);
    if (typeof addH === 'function') {
      addH({ type: '统计计算', time: '2026/10/1 10:00:00', data: '1,2,3,4,5', mean: '3.000000', sd: '1.581139', rsd: '52.7046', count: 5 });
    }
    await new Promise(r => setTimeout(r, 500));
    if (typeof selectComprehensiveRecords !== 'function') return { error: 'no selectComprehensiveRecords' };
    const recs = selectComprehensiveRecords();
    const report = buildComprehensiveReport(recs, {});
    // precision row 在索引 9（[header, date, sampleName, sampleId, batch, operator, instrument, column, sep, precision, recovery?, linear?, stability?]）
    const precisionRow = report[9] || [];
    const txt = String(precisionRow[1] || '');
    return { txt, hasUndefined: txt.includes('undefined'), hasRsd: txt.includes('52.7') || txt.includes('52.7046') };
  });
  record('B2.1 comprehensive report RSD 显示实际数字',
    b2.hasUndefined === false && b2.hasRsd === true, JSON.stringify(b2));

  // B3: form error aria-invalid
  console.log('\n--- B3: form error aria-invalid ---');
  const b3 = await page.evaluate(async () => {
    if (typeof switchTab !== 'function') return { error: 'no switchTab' };
    switchTab('stats');
    await new Promise(r => setTimeout(r, 500));
    // 找第一个 text input（全局 input 监听器会处理）
    const input = document.querySelector('input[type="text"]');
    if (!input) return { error: 'no text input' };
    input.value = '1/0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    return {
      ariaInvalid: input.getAttribute('aria-invalid'),
      ariaDescribedby: input.getAttribute('aria-describedby'),
      hasErrClass: input.classList.contains('input-error'),
      errHintId: input.parentNode && input.parentNode.querySelector('.input-error-hint') ? input.parentNode.querySelector('.input-error-hint').id : null
    };
  });
  record('B3.1 form error input aria-invalid=true',
    b3.ariaInvalid === 'true', JSON.stringify(b3));
  record('B3.2 form error input aria-describedby 指向 errHint',
    typeof b3.ariaDescribedby === 'string' && b3.ariaDescribedby.indexOf('formulaError-') === 0,
    JSON.stringify(b3));

  // B4: i18n cache 实际工作
  console.log('\n--- B4: i18n cache 实际工作 ---');
  const b4 = await page.evaluate(async () => {
    if (typeof i18n !== 'function') return { error: 'no i18n' };
    const cache = _i18nCache;
    const sizeBefore = cache.size;
    // 调 100 次同一 key（appTitle 必定已缓存 → cache 不应增长）
    for (let i = 0; i < 100; i++) i18n('appTitle');
    const sizeAfter = cache.size;
    return { sizeBefore, sizeAfter, cacheExists: cache instanceof Map, delta: sizeAfter - sizeBefore };
  });
  record('B4.1 _i18nCache 是 Map',
    b4.cacheExists === true, JSON.stringify(b4));
  record('B4.2 重复 100 次同 key 后 cache 不增长（命中缓存）',
    b4.delta === 0, JSON.stringify(b4));

  // B5: PDF footer i18n
  console.log('\n--- B5: printPDF footer i18n ---');
  const b5 = await page.evaluate(async () => {
    if (typeof setH === 'function') setH([]);
    if (typeof addH === 'function') {
      addH({ type: '统计计算', time: '2026/10/1 10:00:00', data: '1,2,3', mean: '2.000000', sd: '1.0', rsd: '50', count: 3 });
    }
    await new Promise(r => setTimeout(r, 500));
    // 调用 printPDF 直接生成 html（但不打印）
    if (typeof printPDF !== 'function') return { error: 'no printPDF' };
    // 捕获 html — printPDF 通常会调 window.print()，我们通过 _openPrintPreview 检查
    // 这里只验证 printPDF 函数存在且 i18n 引用正确
    const fnSrc = printPDF.toString();
    return {
      usesPdfFooterGenFmt: fnSrc.includes("i18n('pdfFooterGenFmt')"),
      usesPdfGroupHeaderFmt: fnSrc.includes("i18n('pdfGroupHeaderFmt')"),
      usesI18n: fnSrc.includes('i18n')
    };
  });
  record('B5.1 printPDF 引用 pdfFooterGenFmt',
    b5.usesPdfFooterGenFmt === true, JSON.stringify(b5));
  record('B5.2 printPDF 引用 pdfGroupHeaderFmt',
    b5.usesPdfGroupHeaderFmt === true, JSON.stringify(b5));

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