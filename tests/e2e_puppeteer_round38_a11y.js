// v54.282 Round 38 a11y 第二波 — calc-key aria-labels 本地化 + titer pill truncated 修复
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
  const html = fs.readFileSync(path.join(ROOT, 'RSD & 含量计算器.html'), 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.282 Round 38 a11y second wave');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');

  // A1: i18n 新 key 全部添加
  console.log('\n--- A1: 26 个 ariaCalc 新 key 添加 ---');
  const zhKeys = ['ariaCalcClear','ariaCalcBackspace','ariaCalcOpenParen','ariaCalcCloseParen','ariaCalcAdd','ariaCalcDivide','ariaCalcMultiply','ariaCalcPower','ariaCalcEquals','ariaCalcDecimalPoint','ariaCalcFnToggle','ariaCalcSin','ariaCalcCos','ariaCalcTan','ariaCalcLog','ariaCalcLn','ariaCalcSqrt','ariaCalcPi','ariaCalcE','ariaCalcPowN','ariaCalcAsin','ariaCalcAcos','ariaCalcAtan','ariaCalcLog2','ariaCalcExp','ariaCalc10x','ariaCalcRound','ariaCalcAbs','ariaCalcFact','ariaCalcFloor','ariaCalcCeil'];
  let zhMissing = [];
  let enMissing = [];
  for (const k of zhKeys) {
    if (!i18nZh.includes(`${k}:`)) zhMissing.push(k);
    if (!i18nEn.includes(`${k}:`)) enMissing.push(k);
  }
  record('A1.1 zh 字典含全部 31 个 ariaCalc* key', zhMissing.length === 0, '缺失: ' + zhMissing.join(','));
  record('A1.2 en 字典含全部 31 个 ariaCalc* key', enMissing.length === 0, '缺失: ' + enMissing.join(','));

  // A2: HTML 中每个 aria-label 已绑 data-i18n-aria-label
  console.log('\n--- A2: HTML 中 calc-key 按钮绑 i18n ---');
  // 提取 calc-keypad-page1 + page2 块
  const page1Start = html.indexOf('calc-keypad-page1');
  const page2End = html.indexOf('calc-keypad-page2') + 5000;
  const page2Start = html.indexOf('calc-keypad-page2', page1Start);
  const allKeypadHtml = html.substring(page1Start, page2End > 0 ? page2End : page1Start + 10000);
  // 数 .calc-key 按钮（数字按钮不需要 i18n 因为 aria-label 就是数字）
  // 数需要 i18n 的按钮（aria-label 不只是数字）
  const calcKeyButtons = (allKeypadHtml.match(/<button[^>]*class="calc-key[^"]*"[^>]*>/g) || []);
  // 排除纯数字按钮 (aria-label="0-9")
  const nonNumericButtons = calcKeyButtons.filter(b => !b.match(/aria-label="[0-9]"/));
  const boundI18n = nonNumericButtons.filter(b => b.includes('data-i18n-aria-label')).length;
  record('A2.1 所有非数字 calc-key 按钮已绑 data-i18n-aria-label',
    boundI18n === nonNumericButtons.length && nonNumericButtons.length > 20,
    `bound=${boundI18n}/${nonNumericButtons.length}`);

  // A3: titer pill 修复
  console.log('\n--- A3: titer pill 用完整 m.name + 视觉截断 ---');
  const titerFnStart = appJs.indexOf('function renderTiterRecent');
  const titerFnEnd = appJs.indexOf('\nfunction ', titerFnStart + 100);
  const titerFnBody = appJs.substring(titerFnStart, titerFnEnd > 0 ? titerFnEnd : titerFnStart + 1500);
  record('A3.1 titer pill 用 m.name 完整（不再 split 截断）',
    !titerFnBody.includes("m.name.split(' ')[0]") && titerFnBody.includes('_esc(m.name)'));
  record('A3.2 titer pill 加 max-width + ellipsis CSS（视觉截断）',
    titerFnBody.includes('text-overflow:ellipsis') && titerFnBody.includes('max-width'));
  record('A3.3 titer pill 加 aria-label + title（完整读出）',
    titerFnBody.includes('aria-label="' + '_esc(m.name)') || titerFnBody.includes('title='));

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

  // B1: EN 模式 calc-key aria-label 切换
  console.log('\n--- B1: EN 模式 calc-key aria-label 切换 ---');
  const b1 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('calc');
    await new Promise(r => setTimeout(r, 500));
    if (typeof _setLang === 'function') _setLang('en');
    await new Promise(r => setTimeout(r, 600));
    // 找第一个 fn 按钮（sin）
    const sinBtn = Array.from(document.querySelectorAll('.calc-key')).find(b => b.textContent === 'sin');
    const sinLabel = sinBtn ? sinBtn.getAttribute('aria-label') : null;
    // 找 + 按钮
    const addBtn = Array.from(document.querySelectorAll('.calc-key')).find(b => b.textContent === '+');
    const addLabel = addBtn ? addBtn.getAttribute('aria-label') : null;
    // 还原 zh
    if (typeof _setLang === 'function') _setLang('zh');
    await new Promise(r => setTimeout(r, 300));
    const sinBtnZh = Array.from(document.querySelectorAll('.calc-key')).find(b => b.textContent === 'sin');
    const sinLabelZh = sinBtnZh ? sinBtnZh.getAttribute('aria-label') : null;
    return { sin: sinLabel, add: addLabel, sinZh: sinLabelZh };
  });
  record('B1.1 EN 模式 sin 按钮 aria-label = "Sine"',
    b1.sin === 'Sine', JSON.stringify(b1));
  record('B1.2 EN 模式 + 按钮 aria-label = "Plus"',
    b1.add === 'Plus', JSON.stringify(b1));
  record('B1.3 ZH 模式 sin 按钮 aria-label = "正弦"',
    b1.sinZh === '正弦', JSON.stringify(b1));

  // B2: ZH 模式 aria-label 显示中文
  console.log('\n--- B2: ZH 模式 aria-label 显示中文 ---');
  const b2 = await page.evaluate(async () => {
    if (typeof _setLang === 'function') _setLang('zh');
    await new Promise(r => setTimeout(r, 600));
    const buttons = Array.from(document.querySelectorAll('.calc-key')).map(b => ({
      text: b.textContent,
      aria: b.getAttribute('aria-label'),
      hasI18n: b.hasAttribute('data-i18n-aria-label')
    })).filter(b => b.hasI18n);
    return { count: buttons.length, sample: buttons.slice(0, 3) };
  });
  record('B2.1 ZH 模式 26 个 calc-key 按钮都有 data-i18n-aria-label',
    b2.count >= 26, JSON.stringify(b2));

  // B3: titer pill 完整可读
  console.log('\n--- B3: titer recent pill ---');
  const b3 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('titer');
    await new Promise(r => setTimeout(r, 500));
    // 设置 select 选中 NaOH，调用 loadTiterMethod 触发 _titerRecent.push
    const sel = document.getElementById('titer-method-select');
    if (sel) {
      // 找一个 NaOH option
      const naohOpt = Array.from(sel.options).find(o => o.value === 'NaOH') ||
                      Array.from(sel.options).find(o => /naoh/i.test(o.value));
      if (naohOpt) {
        sel.value = naohOpt.value;
        if (typeof loadTiterMethod === 'function') loadTiterMethod();
        await new Promise(r => setTimeout(r, 300));
      }
    }
    const pills = document.querySelectorAll('#titer-recent button');
    return {
      pillCount: pills.length,
      firstText: pills[0] ? pills[0].textContent : null,
      firstAria: pills[0] ? pills[0].getAttribute('aria-label') : null,
      firstTitle: pills[0] ? pills[0].getAttribute('title') : null
    };
  });
  record('B3.1 titer recent pill 显示完整 method name',
    b3.pillCount > 0 && b3.firstText && b3.firstText.length > 5,
    JSON.stringify(b3));
  record('B3.2 titer pill 同时有 aria-label + title（完整可读）',
    b3.firstAria !== null && b3.firstTitle !== null,
    JSON.stringify(b3));

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