// e2e_puppeteer_round42_i18n_en_zh.js
// v54.303 新增：验证 i18n-en.js 中无残留中文字符串（100+ 处全部翻译）
const puppeteer = require('puppeteer');
const fs = require('fs');

const PASS = [];
const FAIL = [];
function record(name, ok, detail) {
  if (ok) { PASS.push(name); console.log('  [OK] ' + name); }
  else { FAIL.push(name + ' | ' + (detail || '')); console.log('  [FAIL] ' + name + ' ' + (detail || '')); }
}

// 静态检查：i18n-en.js 中所有 value 不能含中文（注释除外）
function staticCheckEnFile() {
  const text = fs.readFileSync('F:/自制软件/i18n-en.js', 'utf-8');
  // 行级匹配：找到 `key: '<value>'` 模式，且 value 含中文
  // 跳过 /* ... */ 注释和 // 注释
  const lines = text.split('\n');
  const issues = [];
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // 跳过块注释内的行
    if (inBlockComment) {
      const endIdx = line.indexOf('*/');
      if (endIdx >= 0) {
        inBlockComment = false;
        line = line.slice(endIdx + 2);
      } else {
        continue;
      }
    }
    // 处理块注释开始
    const blockStart = line.indexOf('/*');
    const blockEnd = line.indexOf('*/');
    if (blockStart >= 0 && (blockEnd < 0 || blockStart < blockEnd)) {
      // 块注释跨多行
      inBlockComment = true;
      line = line.slice(0, blockStart);
    }
    // 移除行内 // 注释
    const commentIdx = line.indexOf('//');
    if (commentIdx >= 0) line = line.slice(0, commentIdx);
    // 移除行内块注释
    const inlineBlockStart = line.indexOf('/*');
    const inlineBlockEnd = line.indexOf('*/');
    if (inlineBlockStart >= 0 && inlineBlockEnd > inlineBlockStart) {
      line = line.slice(0, inlineBlockStart) + line.slice(inlineBlockEnd + 2);
    }
    // 匹配单引号 value
    const matches = line.match(/'[^']*[\u4e00-\u9fff][^']*'/g) || [];
    issues.push(...matches);
  }
  return { count: issues.length, samples: issues.slice(0, 5) };
}

(async () => {
  // 1. 静态检查
  console.log('--- #1 静态检查 i18n-en.js ---');
  const staticResult = staticCheckEnFile();
  record('i18n-en.js 中 value 不含中文字符', staticResult.count === 0,
    `found ${staticResult.count} values with Chinese chars: ${JSON.stringify(staticResult.samples)}`);

  // 2. 运行时检查：英文模式下，常见 toast 应该是英文
  console.log('\n--- #2 运行时检查 en 模式 toast ---');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.303.html');
  await page.goto(url, { waitUntil: 'networkidle0' });

  // 切到英文
  await page.evaluate(() => {
    try { localStorage.setItem('rsd-lang', 'en'); } catch (e) {}
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 检查关键 toast 是英文
  const checks = await page.evaluate(() => {
    function getI18n(key) {
      try { return i18n(key); } catch (e) { return null; }
    }
    return {
      noHistory: getI18n('noHistory'),
      noData: getI18n('noData'),
      noValidNumbers: getI18n('noValidNumbers'),
      pdfMissing: getI18n('pdfMissing'),
      xlsxMissing: getI18n('xlsxMissing'),
      csvHelperMissing: getI18n('csvHelperMissing'),
      titerEmpty: getI18n('titerEmpty'),
      dryingEmpty: getI18n('dryingEmpty'),
      dissolutionEmpty: getI18n('dissolutionEmpty'),
      sampleEmpty: getI18n('sampleEmpty'),
      // Toast keys
      toast_renamed: getI18n('toast_renamed'),
      toast_recipeDeleted: getI18n('toast_recipeDeleted'),
      toast_restoreUndone: getI18n('toast_restoreUndone'),
      // 一些 UI 元素
      uiOnline: getI18n('uiOnline'),
      uiOffline: getI18n('uiOffline'),
      lblOvenTemp: getI18n('lblOvenTemp'),
    };
  });

  // 验证：返回的 value 不能含中文
  for (const [k, v] of Object.entries(checks)) {
    if (v == null) {
      record(`i18n('${k}') 不为 null`, v !== null);
    } else {
      const hasZh = /[\u4e00-\u9fff]/.test(v);
      record(`en 模式 i18n('${k}') 纯英文 (${v.slice(0, 40)})`, !hasZh,
        hasZh ? `value contains Chinese: ${v}` : null);
    }
  }

  // 3. zh 模式对照（不应被破坏）
  console.log('\n--- #3 zh 模式对照 ---');
  await page.evaluate(() => {
    try { localStorage.setItem('rsd-lang', 'zh'); } catch (e) {}
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  const zhChecks = await page.evaluate(() => {
    return {
      noHistory: i18n('noHistory'),
      noData: i18n('noData'),
    };
  });
  record('zh 模式 noHistory 含中文', /[\u4e00-\u9fff]/.test(zhChecks.noHistory), 'value: ' + zhChecks.noHistory);
  record('zh 模式 noData 含中文', /[\u4e00-\u9fff]/.test(zhChecks.noData), 'value: ' + zhChecks.noData);

  await browser.close();

  console.log();
  console.log('='.repeat(70));
  console.log('PASS: ' + PASS.length + '/' + (PASS.length + FAIL.length));
  if (FAIL.length) {
    console.log('FAIL details:');
    for (const f of FAIL) console.log('  ' + f);
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
