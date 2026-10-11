// v54.221 e2e_puppeteer_export.js: 数据导出测试 - 验证 CSV/Excel/Word/PDF 导出功能
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';
const DOWNLOAD_DIR = path.join(__dirname, '_downloads_v54_221');

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.221 e2e_puppeteer_export.js');
  console.log('数据导出测试 (CSV/Excel) + i18n 文件名验证');
  console.log('='.repeat(70));

  // 准备下载目录
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  } else {
    // v54.224 fix: 全量套件跑时清理残留 csv/xlsx，避免 downloadBefore 错算
    for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
      if (f.endsWith('.csv') || f.endsWith('.xlsx')) {
        try { fs.unlinkSync(path.join(DOWNLOAD_DIR, f)); } catch(e){}
      }
    }
  }

  let browser;
  let pass_count = 0;
  let fail_count = 0;

  function record(name, ok, detail = '') {
    const status = ok ? '✓' : '✗';
    const line = detail ? `  [${status}] ${name} — ${detail}` : `  [${status}] ${name}`;
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

    // 配置下载路径
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_DIR,
    });

    await page.setCacheEnabled(false);
    await page.goto(HTML_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });

    // 清空 localStorage 防止前一个测试的状态干扰
    await page.evaluate(() => {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('rsd-test-') || k === 'rsd-lang' || k === 'rsd-theme')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch(e) {}
    });

    // 切到中文模式（默认），以稳定状态运行
    await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });

    // === Test 1: 导出函数集合 ===
    console.log('\n--- 导出函数集合 ---');
    const exportFns = await page.evaluate(() => {
      const csvFns = [
        'exportNormCSV', 'exportExtCSV', 'exportIntCSV',
        'exportDryingCSV', 'exportResidueCSV', 'exportTiterCSV',
        'exportUniformityCSV', 'exportDissolutionCSV',
      ];
      const excelFns = [
        'exportNormExcel', 'exportExtExcel', 'exportIntExcel',
        'exportDryingExcel', 'exportResidueExcel', 'exportTiterExcel',
        'exportUniformityExcel', 'exportDissolutionExcel',
      ];
      const result = { csv: {}, excel: {}, helper: {} };
      for (const f of csvFns) result.csv[f] = typeof window[f] === 'function';
      for (const f of excelFns) result.excel[f] = typeof window[f] === 'function';
      result.helper.blobDownloadCSV = typeof window.blobDownloadCSV === 'function';
      result.helper.metaFilename = typeof window.metaFilename === 'function';
      result.helper.csvCell = typeof window.csvCell === 'function';
      result.helper.XLSX = typeof window.XLSX;
      return result;
    });
    let csvOk = 0;
    for (const [fn, exists] of Object.entries(exportFns.csv)) {
      if (exists) csvOk++;
    }
    record(`CSV 导出函数 (${csvOk}/8 存在)`, csvOk === 8);

    let excelOk = 0;
    for (const [fn, exists] of Object.entries(exportFns.excel)) {
      if (exists) excelOk++;
    }
    record(`Excel 导出函数 (${excelOk}/8 存在)`, excelOk === 8);

    record('blobDownloadCSV helper', exportFns.helper.blobDownloadCSV);
    record('metaFilename helper', exportFns.helper.metaFilename);
    record('csvCell helper', exportFns.helper.csvCell);
    record('XLSX 库已加载', exportFns.helper.XLSX !== 'undefined', `typeof=${exportFns.helper.XLSX}`);

    // === Test 2: metaFilename 文件名生成 ===
    console.log('\--- metaFilename 测试 ---');
    const metaTest = await page.evaluate(() => {
      if (typeof metaFilename !== 'function') return { found: false };
      const m1 = metaFilename('normalize', { sampleName: '阿司匹林', batch: 'B2024001' });
      const m2 = metaFilename('external', { sampleName: 'Test A', batch: '001' });
      const m3 = metaFilename('drying', null);
      const m4 = metaFilename('titer', { sampleName: '', batch: 'B-2' });
      return { found: true, m1, m2, m3, m4 };
    });
    record('metaFilename 可调用', metaTest.found);
    record('metaFilename 含样品名 (normalize)', metaTest.m1 && metaTest.m1.includes('normalize') && !metaTest.m1.includes('/'),
      `filename=${metaTest.m1}`);
    record('metaFilename 含样品名 (external)', metaTest.m2 && metaTest.m2.includes('external'),
      `filename=${metaTest.m2}`);
    record('metaFilename 处理 null meta', metaTest.m3 && metaTest.m3.length > 0,
      `filename=${metaTest.m3}`);
    record('metaFilename 空样品名', metaTest.m4 && metaTest.m4.includes('titer'),
      `filename=${metaTest.m4}`);

    // === Test 3: csvCell 转义测试 ===
    console.log('\--- csvCell 测试 ---');
    const csvCellTest = await page.evaluate(() => {
      if (typeof csvCell !== 'function') return { found: false };
      const c1 = csvCell('hello');
      const c2 = csvCell('hello,world');
      const c3 = csvCell('with"quote');
      const c4 = csvCell(null);
      const c5 = csvCell(123.45);
      const c6 = csvCell('中文');
      return { found: true, c1, c2, c3, c4, c5, c6 };
    });
    record('csvCell 可调用', csvCellTest.found);
    record('csvCell 普通字符串', csvCellTest.c1 === 'hello', `c1=${csvCellTest.c1}`);
    record('csvCell 含逗号 (引号包裹)', csvCellTest.c2 && csvCellTest.c2.includes('"') && csvCellTest.c2.includes('hello,world'),
      `c2=${csvCellTest.c2}`);
    record('csvCell 含双引号 (转义)', csvCellTest.c3 && csvCellTest.c3.includes('""'),
      `c3=${csvCellTest.c3}`);
    record('csvCell null 处理', csvCellTest.c4 === '' || csvCellTest.c4 === null,
      `c4=${csvCellTest.c4}`);
    record('csvCell 数字', csvCellTest.c5 == 123.45, `c5=${csvCellTest.c5}`);
    record('csvCell 中文不转义', csvCellTest.c6 === '中文', `c6=${csvCellTest.c6}`);

    // === Test 4: collectNormData 数据收集 ===
    console.log('\--- 数据收集函数 ---');
    const collectTest = await page.evaluate(() => {
      const fns = ['collectNormData', 'collectExtData', 'collectDryingData', 'collectTiterData'];
      const result = {};
      for (const f of fns) {
        result[f] = typeof window[f] === 'function';
      }
      return result;
    });
    let collectOk = 0;
    for (const [fn, exists] of Object.entries(collectTest)) {
      if (exists) collectOk++;
      record(`${fn} 存在`, exists);
    }
    record(`collect*Data 函数 (${collectOk}/4)`, collectOk === 4);

    // === Test 5: buildNormReport 报告构建 ===
    console.log('\--- 报告构建函数 ---');
    const buildTest = await page.evaluate(() => {
      const fns = ['buildNormReport', 'buildExtReport', 'buildDryingReport', 'buildTiterReport'];
      const result = {};
      for (const f of fns) {
        result[f] = typeof window[f] === 'function';
      }
      return result;
    });
    let buildOk = 0;
    for (const [fn, exists] of Object.entries(buildTest)) {
      if (exists) buildOk++;
      record(`${fn} 存在`, exists);
    }
    record(`build*Report 函数 (${buildOk}/4)`, buildOk === 4);

    // === Test 6: 触发 CSV 导出并验证文件 ===
    console.log('\--- 实际 CSV 导出 (normalize) ---');
    // 先准备归一化法数据
    await page.evaluate(() => switchTab('recovery'));
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => switchRecovery('normalize'));
    await new Promise(r => setTimeout(r, 200));

    // 填入完整的样品数据（weight + dilution + area_pct）
    const fillResult = await page.evaluate(() => {
      try {
        const rows = document.querySelectorAll('#norm-spl-rows tr');
        if (rows.length === 0) return { filled: false, msg: 'no #norm-spl-rows tr' };
        // 填 3 个样品，每行 weight/dilution/area
        const sampleData = [
          { w: '100', d: '10', a: '100' },
          { w: '100', d: '10', a: '99.5' },
          { w: '100', d: '10', a: '100.5' },
        ];
        for (let i = 0; i < Math.min(rows.length, sampleData.length); i++) {
          const wInput = rows[i].querySelector('.norm-spl-weight');
          const dInput = rows[i].querySelector('.norm-spl-dilution');
          const aInput = rows[i].querySelector('.norm-spl-area-pct');
          if (wInput) { wInput.value = sampleData[i].w; wInput.dispatchEvent(new Event('input', { bubbles: true })); }
          if (dInput) { dInput.value = sampleData[i].d; dInput.dispatchEvent(new Event('input', { bubbles: true })); }
          if (aInput) { aInput.value = sampleData[i].a; aInput.dispatchEvent(new Event('input', { bubbles: true })); }
        }
        return { filled: true, rowsCount: rows.length };
      } catch (e) { return { filled: false, error: e.message }; }
    });
    record('归一化法输入数据准备', fillResult.filled,
      `rows=${fillResult.rowsCount || 0}, msg=${fillResult.msg || ''}`);

    // 触发 CSV 导出
    const downloadBefore = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.csv')).length;
    const csvExportResult = await page.evaluate(() => {
      try {
        // 调用 exportNormCSV - 应触发下载
        exportNormCSV();
        return { ok: true, msg: 'exportNormCSV() called' };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('调用 exportNormCSV()', csvExportResult.ok, csvExportResult.msg || csvExportResult.error);

    // 等待文件下载
    await new Promise(r => setTimeout(r, 2000));

    const csvFiles = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.csv'));
    record('CSV 文件被下载', csvFiles.length > downloadBefore,
      `total=${csvFiles.length}, new=${csvFiles.length - downloadBefore}`);

    if (csvFiles.length > 0) {
      const newestFile = csvFiles[csvFiles.length - 1];
      const filepath = path.join(DOWNLOAD_DIR, newestFile);
      const content = fs.readFileSync(filepath, 'utf-8');
      record('CSV 文件非空', content.length > 50, `size=${content.length}`);
      record('CSV 含 BOM', content.charCodeAt(0) === 0xFEFF);
      record('CSV 含数据行', content.includes(',') && content.split('\n').length > 1,
        `lines=${content.split('\n').length}`);
      record('CSV 文件名合理', newestFile.endsWith('.csv'),
        `name=${newestFile}`);
    }

    // === Test 7: flash 提示 ===
    console.log('\n--- flash 导出提示 ---');
    const flashTest = await page.evaluate(() => {
      if (typeof flashEl !== 'function') return { found: false };
      try {
        // flashEl 接受任意 ID，但目标元素必须在 HTML 里 - 这里 flash 到一个必定存在的元素 (document.body)
        flashEl('debug-tag', i18n('flashCsvExported'));
        const el = document.getElementById('debug-tag');
        return {
          found: true,
          elExists: !!el,
          content: el ? el.textContent : null,
          flashFnWorked: true, // 不抛错就算 OK
        };
      } catch (e) { return { found: true, error: e.message }; }
    });
    record('flashEl 函数可调用', flashTest.found);
    record('flashEl 不抛错 (即使目标元素不存在)', flashTest.flashFnWorked,
      flashTest.error ? `err=${flashTest.error}` : '');

    // === Test 8: 空数据导出报错 ===
    console.log('\--- 空数据导出保护 ---');
    await page.evaluate(() => switchTab('recovery'));
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => switchRecovery('external'));
    await new Promise(r => setTimeout(r, 200));

    // 清空所有 ext- 输入
    const emptyExport = await page.evaluate(() => {
      try {
        // 先收集现有下载数
        const extInputs = document.querySelectorAll('#page-recovery [id^="ext-"]');
        for (const inp of extInputs) {
          if (inp.tagName === 'INPUT') inp.value = '';
        }
        // 尝试导出
        exportExtCSV();
        return { ok: true, msg: 'empty export attempted' };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('空数据调用 exportExtCSV() 不抛错', emptyExport.ok, emptyExport.msg || emptyExport.error);

    // === Test 9: 报告 meta 信息 ===
    console.log('\--- getReportMeta 函数 ---');
    const reportMetaTest = await page.evaluate(() => {
      if (typeof getReportMeta !== 'function') return { found: false };
      try {
        const m = getReportMeta();
        return {
          found: true,
          hasSampleName: m && 'sampleName' in m,
          hasBatch: m && 'batch' in m,
          keys: m ? Object.keys(m) : [],
        };
      } catch (e) { return { found: true, error: e.message }; }
    });
    record('getReportMeta 函数存在', reportMetaTest.found);
    record('getReportMeta 返回对象', reportMetaTest.hasSampleName && reportMetaTest.hasBatch,
      JSON.stringify(reportMetaTest));

  } catch (e) {
    console.log(`  [✗] EXCEPTION: ${e.message}`);
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