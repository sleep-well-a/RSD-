// v54.267 e2e_puppeteer_audit_round29.js
// Round 29: P2 i18n 收尾 —— zh / en 双侧是否会显示原始 key 字符串
//
//   A. en 模式：对 zh 字典里所有 key 调用 i18n()，统计返回值等于原 key 的数量
//   B. zh 模式：对 en 字典里所有 key 调用 i18n()，统计返回值等于原 key 的数量
//   C. 运行时验证：9 个关键模块切到 en 后，原文文案（如 '统计'）必须变成英文
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

let pass = 0, fail = 0;
const fails = [];
function record(name, ok, detail = '') {
  console.log('  [' + (ok ? 'OK' : 'FAIL') + '] ' + name + (detail ? ' -- ' + detail : ''));
  if (ok) pass++; else { fail++; fails.push(name + (detail ? ' | ' + detail : '')); }
}


async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  let ok = false;
  for (let a = 1; a <= 3 && !ok; a++) {
    try {
      await page.goto(HTML_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction('typeof i18n === "function"', { timeout: 15000 });
      ok = true;
    } catch (e) { await new Promise(r => setTimeout(r, 1500)); }
  }
  if (!ok) { await browser.close(); throw new Error('goto 3 次失败'); }
  await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
  await new Promise(r => setTimeout(r, 400));

  // ===== A. en 模式下 zh 字典所有 key 的 i18n() 输出 =====
  const enLeak = await page.evaluate(async () => {
    _setLang('en');
    await new Promise(r => setTimeout(r, 300));
    const out = { total: 0, leak: [], alertLeak: [] };
    for (const k in I18N.zh) {
      out.total++;
      const v = i18n(k);
      if (v === k) {
        // 区分 zh/en：en 模式 leak 原 key 是真问题（用户看到原始 key 字符串）
        out.leak.push(k);
      }
    }
    _setLang('zh');
    await new Promise(r => setTimeout(r, 300));
    return out;
  });
  record('en 模式下 zh 所有 key 都能解析（不 leak 原 key）',
    enLeak.leak.length === 0,
    enLeak.leak.length === 0 ? `共 ${enLeak.total} key` : `leak ${enLeak.leak.length}/${enLeak.total}: ${enLeak.leak.slice(0, 20).join(', ')}`);

  // ===== B. zh 模式下 en 字典所有 key 的 i18n() 输出 =====
  const zhLeak = await page.evaluate(() => {
    const out = { total: 0, leak: [] };
    for (const k in I18N.en) {
      out.total++;
      const v = i18n(k);
      if (v === k) out.leak.push(k);
    }
    return out;
  });
  record('zh 模式下 en 所有 key 都能解析（不 leak 原 key）',
    zhLeak.leak.length === 0,
    zhLeak.leak.length === 0 ? `共 ${zhLeak.total} key` : `leak ${zhLeak.leak.length}/${zhLeak.total}: ${zhLeak.leak.slice(0, 20).join(', ')}`);

  // ===== C. 关键模块切到 en 后的运行时表现 =====
  const runtime = await page.evaluate(async () => {
    _setLang('en');
    await new Promise(r => setTimeout(r, 300));
    const out = {};
    // 7 个主 tab 文案必须变英文（取字典实际值，避免测试与字典不同步）
    out.tabs = [...document.querySelectorAll('.tabs .tab')].map(t => t.textContent.trim());
    out.tabsExpected = ['tabStats', 'tabRecovery', 'tabSpecial', 'tabCalc', 'tabHistory', 'tabMobile', 'tabSettings'].map(k => I18N.en[k]);
    try { switchRecovery('normalize'); } catch (e) {}
    out.recSubtabs = [...document.querySelectorAll('#page-recovery .subtab')].map(t => t.textContent.trim());
    out.recExpected = ['subtabRecoveryArea', 'subtabExtStd', 'subtabIntStd', 'subtabSimple'].map(k => I18N.en[k]);
    try { switchSpecial('drying'); } catch (e) {}
    out.spSubtabs = [...document.querySelectorAll('#page-special .subtab')].map(t => t.textContent.trim()).slice(0, 4);
    out.spExpected = ['subtabDrying', 'subtabContent', 'subtabResidue', 'subtabTiter'].map(k => I18N.en[k]);
    out.title = document.title;
    out.titleKey = I18N.en.appTitle;
    out.htmlLang = document.documentElement.lang;
    return out;
  });
  record('en 模式 7 个主 tab 文案变英文', JSON.stringify(runtime.tabs) === JSON.stringify(runtime.tabsExpected), JSON.stringify(runtime.tabs));
  record('en 模式回收率 4 个 subtab 文案变英文', JSON.stringify(runtime.recSubtabs) === JSON.stringify(runtime.recExpected), JSON.stringify(runtime.recSubtabs));
  record('en 模式专项前 4 subtab 文案变英文', JSON.stringify(runtime.spSubtabs) === JSON.stringify(runtime.spExpected), JSON.stringify(runtime.spSubtabs));
  record('document.title 在 en 模式下是英文', runtime.title === runtime.titleKey && !/[一-龥]/.test(runtime.title), JSON.stringify({ title: runtime.title, expected: runtime.titleKey }));
  record('document.documentElement.lang 在 en 模式为 en', runtime.htmlLang === 'en', JSON.stringify(runtime.htmlLang));

  await browser.close();
  console.log('\n' + '='.repeat(70));
  console.log('PASS: ' + pass + '/' + (pass + fail));
  if (fails.length) { console.log('[FAIL]'); fails.forEach(f => console.log('   ' + f)); }
  console.log('='.repeat(70));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('EXCEPTION', e); process.exit(1); });