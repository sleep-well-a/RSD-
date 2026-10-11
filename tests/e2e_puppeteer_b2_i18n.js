// v54.272 B2 i18n 6 bug 修复验证
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
  const i18nZh = fs.readFileSync(path.join(ROOT, 'i18n-zh.js'), 'utf8');
  const i18nEn = fs.readFileSync(path.join(ROOT, 'i18n-en.js'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'RSD & 含量计算器.html'), 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.272 B2 i18n 6 bug fix');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');
  // B2-1: cvMean/cvSD/cvRsdPct/reportData 在 zh+en
  ['cvMean', 'cvSD', 'cvRsdPct', 'reportData', 'reportItem', 'reportValue'].forEach(k => {
    record(`B2-1 i18n-zh 含 ${k}`, i18nZh.includes(`${k}:`));
    record(`B2-1 i18n-en 含 ${k}`, i18nEn.includes(`${k}:`));
  });
  // B2-2: CV metadata zh/en
  ['cvSheetPrecision', 'cvSheetAccuracy', 'cvSheetLinearity', 'cvSheetStability',
   'cvMetaBatch', 'cvMetaOperator', 'cvMetaInstrument', 'cvMetaColumn',
   'cvMethodType', 'cvDataPointCount', 'cvSlopeA', 'cvInterceptB', 'cvR2', 'cvAvgRecoveryPct'].forEach(k => {
    record(`B2-2 i18n-zh 含 ${k}`, i18nZh.includes(`${k}:`));
    record(`B2-2 i18n-en 含 ${k}`, i18nEn.includes(`${k}:`));
  });
  // B2-2 app.js 不再硬编码 '批号', '检测员', '仪器', '色谱柱' 等
  record('B2-2 app.js 无 _metaRows 硬编码批号/检测员/仪器/色谱柱',
    !appJs.match(/function _metaRows\(m\) \{ return \[\[i18n\('metaSampleName'\), m\.sampleName\|\>''[^}]*\['批号',/));
  record('B2-2 app.js 4 处 sheet 名走 i18n',
    appJs.includes("i18n('cvSheetPrecision')") &&
    appJs.includes("i18n('cvSheetAccuracy')") &&
    appJs.includes("i18n('cvSheetLinearity')") &&
    appJs.includes("i18n('cvSheetStability')"));
  // B2-3: settings 标签 HTML 端加 data-i18n
  record('B2-3 HTML settings-sample-name label 加 data-i18n',
    html.includes('data-i18n="metaSampleName" for="settings-sample-name"'));
  record('B2-3 HTML settings-batch/operator/instrument/column label 加 data-i18n',
    html.includes('data-i18n="cvMetaBatch"') &&
    html.includes('data-i18n="cvMetaOperator"') &&
    html.includes('data-i18n="cvMetaInstrument"') &&
    html.includes('data-i18n="cvMetaColumn"'));
  record('B2-3 HTML supabase-url/key label 加 data-i18n',
    html.includes('data-i18n="lblSupabaseUrl"') &&
    html.includes('data-i18n="lblSupabaseAnonKey"'));
  // B2-5: preview zh='预览' 不是 'Preview'
  record('B2-5 zh preview = 预览（不是 Preview）',
    i18nZh.includes("preview: '预览'") && !i18nZh.match(/preview:\s*'Preview'/));
  // B2-5 HTML 8 Preview 全部 i18n 化
  record('B2-5 HTML 无残留 aria-label="Preview">Preview',
    !html.includes('aria-label="Preview">Preview'));
  // B2-5 HTML CSV 按钮 aria-label 用 i18n key
  record('B2-5 HTML CSV 按钮用 data-i18n-aria-label',
    html.includes('data-i18n-aria-label="exportCsv"') &&
    !html.includes('aria-label="CSV">📊 CSV'));

  // B. 浏览器实测
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

  // B2-1 直查新 key
  const b21 = await page.evaluate(() => {
    const _o = _currentLang;
    _setLang('zh');
    const zh = { cvMean: i18n('cvMean'), cvSD: i18n('cvSD'), cvRsdPct: i18n('cvRsdPct'), reportData: i18n('reportData') };
    _setLang('en');
    const en = { cvMean: i18n('cvMean'), cvSD: i18n('cvSD'), cvRsdPct: i18n('cvRsdPct'), reportData: i18n('reportData') };
    _setLang(_o);
    return { zh, en };
  });
  record('B2-1 cvMean zh="平均值", en="Mean"',
    b21.zh.cvMean === '平均值' && b21.en.cvMean === 'Mean', JSON.stringify(b21));
  record('B2-1 cvSD/cvRsdPct/reportData 双语有效',
    b21.zh.cvSD === 'SD' && b21.en.cvSD === 'SD' &&
    b21.zh.cvRsdPct === 'RSD (%)' && b21.en.cvRsdPct === 'RSD (%)' &&
    b21.zh.reportData === '数据' && b21.en.reportData === 'Data',
    JSON.stringify(b21));

  // B2-3 zh 模式 settings 标签渲染中文
  const b23 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('settings');
    await new Promise(r => setTimeout(r, 600));
    const get = id => {
      const el = document.querySelector(`label[for="${id}"]`);
      return el ? el.textContent.trim() : null;
    };
    return {
      sampleName: get('settings-sample-name'),
      batch: get('settings-batch'),
      operator: get('settings-operator'),
      instrument: get('settings-instrument'),
      column: get('settings-column'),
      supabaseUrl: get('supabase-url-input'),
      supabaseKey: get('supabase-key-input'),
    };
  });
  record('B2-3 zh 模式 settings-sample-name 显示中文',
    b23.sampleName === '样品名', JSON.stringify(b23));
  record('B2-3 zh 模式 settings-batch 显示 "批号"',
    b23.batch === '批号', JSON.stringify(b23));
  record('B2-3 zh 模式 settings-instrument 显示中文',
    b23.instrument && b23.instrument.includes('仪器'), JSON.stringify(b23));
  record('B2-3 zh 模式 supabase-url 显示 "Supabase URL"',
    b23.supabaseUrl === 'Supabase URL', JSON.stringify(b23));

  // B2-3 en 模式
  const b23en = await page.evaluate(async () => {
    if (typeof _setLang === 'function') _setLang('en');
    await new Promise(r => setTimeout(r, 500));
    const get = id => {
      const el = document.querySelector(`label[for="${id}"]`);
      return el ? el.textContent.trim() : null;
    };
    const result = {
      sampleName: get('settings-sample-name'),
      batch: get('settings-batch'),
      supabaseUrl: get('supabase-url-input'),
    };
    if (typeof _setLang === 'function') _setLang('zh');
    return result;
  });
  record('B2-3 en 模式 settings-sample-name 显示英文',
    b23en.sampleName === 'Sample Name', JSON.stringify(b23en));
  record('B2-3 en 模式 settings-batch 显示 "Batch"',
    b23en.batch === 'Batch', JSON.stringify(b23en));

  // B2-5 Preview 按钮 zh 显示中文
  const b25 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('drying');
    await new Promise(r => setTimeout(r, 500));
    const btn = document.querySelector('button[onclick*="renderSpecialPreview(\'drying\')"]');
    if (!btn) return { error: 'no btn' };
    return {
      text: btn.textContent.trim(),
      aria: btn.getAttribute('aria-label'),
    };
  });
  record('B2-5 Preview 按钮 zh 显示 "预览"',
    b25.text === '预览', JSON.stringify(b25));

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