// v54.271 P3 lblSampleWeight 字面量修复验证
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

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.271 P3 lblSampleWeight 字面量验证');
  console.log('='.repeat(70));

  // ============================================================
  // A. 静态字典验证
  // ============================================================
  console.log('\n--- A. 静态字典 ---');

  // zh 已无 (g)
  record('i18n-zh lblSampleWeight 不再含 (g)',
    !i18nZh.includes("lblSampleWeight: 'W(称样量,g)'") &&
    !i18nZh.includes("(称样量,g)"));
  record('i18n-zh lblSampleWeight = 称样量',
    i18nZh.includes("lblSampleWeight: '称样量',"));

  // en 已无 g
  record('i18n-en lblSampleWeight 不再含 (g)',
    !i18nEn.includes("lblSampleWeight: 'W (Sample Weight, g)'") &&
    !i18nEn.includes("(Sample Weight, g)"));
  record('i18n-en lblSampleWeight = Sample Weight',
    i18nEn.includes("lblSampleWeight: 'Sample Weight',"));

  // NoSpace 版本保留 (mg)（密集表格紧凑列头专用）
  record('i18n-zh lblSampleWeightNoSpace 保留 (mg)',
    i18nZh.includes("lblSampleWeightNoSpace: '称样量(mg)'"));
  record('i18n-en lblSampleWeightNoSpace 保留 (mg)',
    i18nEn.includes("lblSampleWeightNoSpace: 'Sample Weight(mg)'"));

  // ============================================================
  // B. Puppeteer 实测：切到各 tab 后 lbl-sample-weight label 渲染
  // ============================================================
  console.log('\n--- B. 浏览器实测 ---');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    try {
      await page.goto(HTML_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      ok = true;
    } catch (e) {
      console.log('  [retry] goto 第 ' + (i + 1) + ' 次失败: ' + e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!ok) { await browser.close(); throw new Error('goto 3 次失败'); }
  await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

  // B1: zh 模式下，遍历所有 tab，收集所有 lbl-sample-weight label 文本
  console.log('\n--- B1: zh 模式各 tab label 文本 ---');
  const b1 = await page.evaluate(async () => {
    if (typeof switchTab !== 'function') return { error: 'no switchTab' };
    const tabs = ['rsd', 'content', 'norm', 'external', 'spike', 'recovery', 'uniformity', 'dissolution', 'titer', 'mp', 'mw'];
    const results = {};
    for (const t of tabs) {
      try {
        switchTab(t);
        await new Promise(r => setTimeout(r, 300));
        const labels = document.querySelectorAll('label[data-i18n="lbl-sample-weight"]');
        const texts = Array.from(labels).map(l => l.textContent.trim()).filter(t => t);
        if (texts.length) results[t] = texts;
      } catch (e) { results[t + '_error'] = e.message; }
    }
    return results;
  });
  const b1AllTexts = Object.values(b1).flat();
  record('zh 模式：所有 tab 的 lbl-sample-weight label 都不含 "W("',
    b1AllTexts.length > 0 && b1AllTexts.every(t => !t.startsWith('W(') && !t.includes(',g)')),
    'tab=' + Object.keys(b1).join(',') + ' | 样本=' + JSON.stringify(b1AllTexts.slice(0, 3)));
  record('zh 模式：所有 tab label 不含 "(g)" 后缀',
    b1AllTexts.every(t => !t.includes(',g)')),
    '样本=' + JSON.stringify(b1AllTexts.slice(0, 3)));
  record('zh 模式：label 不含 "(g)" 后缀（HTML 硬编码初始文本 "称样量 (mg)" 可接受，字典值已是纯 "称样量"）',
    b1AllTexts.every(t => !t.includes(',g)') && !t.includes(', g)')),
    '样本=' + JSON.stringify(b1AllTexts.slice(0, 3)));

  // B2: en 模式同测
  console.log('\n--- B2: en 模式各 tab label 文本 ---');
  const b2 = await page.evaluate(async () => {
    if (typeof _setLang !== 'function') return { error: 'no _setLang' };
    _setLang('en');
    const tabs = ['rsd', 'content', 'norm', 'external', 'spike', 'recovery', 'uniformity', 'dissolution', 'titer', 'mp', 'mw'];
    const results = {};
    for (const t of tabs) {
      try {
        switchTab(t);
        await new Promise(r => setTimeout(r, 300));
        const labels = document.querySelectorAll('label[data-i18n="lbl-sample-weight"]');
        const texts = Array.from(labels).map(l => l.textContent.trim()).filter(t => t);
        if (texts.length) results[t] = texts;
      } catch (e) { results[t + '_error'] = e.message; }
    }
    _setLang('zh');
    return results;
  });
  const b2AllTexts = Object.values(b2).flat();
  record('en 模式：所有 tab 的 lbl-sample-weight label 都不含 "W ("',
    b2AllTexts.length > 0 && b2AllTexts.every(t => !t.startsWith('W ') && !t.includes(', g)')),
    'tab=' + Object.keys(b2).join(',') + ' | 样本=' + JSON.stringify(b2AllTexts.slice(0, 3)));
  record('en 模式：label 显示纯文本 "Sample Weight"',
    b2AllTexts.every(t => t === 'Sample Weight'),
    '样本=' + JSON.stringify(b2AllTexts.slice(0, 3)));

  // B3: i18n() 函数两种调用形式都返回正确值
  console.log('\n--- B3: i18n() 直查返回 ---');
  const b3 = await page.evaluate(() => {
    const _origLang = _currentLang;
    _setLang('zh');
    const zh = i18n('lblSampleWeight');
    const kebabZh = i18n('lbl-sample-weight');
    _setLang('en');
    const en = i18n('lblSampleWeight');
    const kebabEn = i18n('lbl-sample-weight');
    _setLang(_origLang || 'zh');
    return { zh, en, kebabZh, kebabEn };
  });
  record('i18n("lblSampleWeight") zh = 称样量', b3.zh === '称样量', JSON.stringify(b3));
  record('i18n("lblSampleWeight") en = Sample Weight', b3.en === 'Sample Weight', JSON.stringify(b3));
  record('i18n("lbl-sample-weight") kebab fallback zh = 称样量', b3.kebabZh === '称样量', JSON.stringify(b3));
  record('i18n("lbl-sample-weight") kebab fallback en = Sample Weight', b3.kebabEn === 'Sample Weight', JSON.stringify(b3));

  // B4: lblSampleWeightNoSpace 仍正确（密集表格列头不应被影响）
  const b4 = await page.evaluate(() => {
    const _origLang = _currentLang;
    _setLang('zh');
    const zh = i18n('lblSampleWeightNoSpace');
    _setLang('en');
    const en = i18n('lblSampleWeightNoSpace');
    _setLang(_origLang || 'zh');
    return { zh, en };
  });
  record('i18n("lblSampleWeightNoSpace") zh = 称样量(mg) (未受影响)',
    b4.zh === '称样量(mg)', JSON.stringify(b4));
  record('i18n("lblSampleWeightNoSpace") en = Sample Weight(mg) (未受影响)',
    b4.en === 'Sample Weight(mg)', JSON.stringify(b4));

  await browser.close();
  console.log('\n' + '='.repeat(70));
  console.log('PASS: ' + pass + '/' + (pass + fail));
  if (fails.length) { console.log('[FAIL]'); fails.forEach(f => console.log('   ' + f)); }
  console.log('='.repeat(70));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('EXCEPTION', e); process.exit(1); });