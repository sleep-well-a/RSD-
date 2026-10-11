// v54.272 B3 a11y 4 bug 修复验证
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
  const html = fs.readFileSync(path.join(ROOT, 'RSD & 含量计算器.html'), 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.272 B3 a11y 4 bug fix');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');
  record('B3-1 calc-display 加 aria-live + role="status"',
    /id="calc-display"[^>]*aria-live="polite"/.test(html) && html.includes('id="calc-display"') && html.includes('role="status"'));
  record('B3-2 sync-status 加 aria-live',
    /id="sync-status"[^>]*aria-live="polite"/.test(html));
  record('B3-2 sync-status 移除 opacity:.7',
    !html.includes('id="sync-status" style="font-size:12px;font-weight:400;opacity:.7"'));
  record('B3-3 login-status 加 aria-live',
    /id="login-status"[^>]*aria-live="polite"/.test(html));
  record('B3-4 curveChart canvas 加 role="img" + data-i18n-aria-label',
    /id="curveChart"[^>]*role="img"[^>]*data-i18n-aria-label="cardTitleCurveChart"/.test(html));

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

  const b = await page.evaluate(() => {
    const get = id => {
      const el = document.getElementById(id);
      if (!el) return null;
      return {
        ariaLive: el.getAttribute('aria-live'),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
      };
    };
    const canvas = document.getElementById('curveChart');
    return {
      calcDisplay: get('calc-display'),
      syncStatus: get('sync-status'),
      loginStatus: get('login-status'),
      curveChart: canvas ? { role: canvas.getAttribute('role'), ariaLabel: canvas.getAttribute('aria-label') } : null,
    };
  });
  record('B. calc-display aria-live=polite', b.calcDisplay && b.calcDisplay.ariaLive === 'polite', JSON.stringify(b.calcDisplay));
  record('B. sync-status aria-live=polite', b.syncStatus && b.syncStatus.ariaLive === 'polite', JSON.stringify(b.syncStatus));
  record('B. login-status aria-live=polite', b.loginStatus && b.loginStatus.ariaLive === 'polite', JSON.stringify(b.loginStatus));
  record('B. curveChart role=img + aria-label', b.curveChart && b.curveChart.role === 'img' && b.curveChart.ariaLabel, JSON.stringify(b.curveChart));

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