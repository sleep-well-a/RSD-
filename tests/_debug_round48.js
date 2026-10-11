const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');

(async () => {
  const tmp = path.join(os.tmpdir(), 'debug_' + Date.now());
  const browser = await puppeteer.launch({ headless: true, args: ['--user-data-dir=' + tmp] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  page.on('console', m => console.log('CONSOLE:', m.type(), m.text().slice(0, 200)));
  await page.goto('http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.330.html'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => { try { localStorage.setItem('rsd-lang', 'en'); } catch(e){} location.reload(); });
  await new Promise(r => setTimeout(r, 2000));
  const result = await page.evaluate(() => {
    return {
      currentLang: typeof _currentLang !== 'undefined' ? _currentLang : 'undef',
      savedLang: localStorage.getItem('rsd-lang'),
      i18nCvMdTime: typeof i18n === 'function' ? i18n('cvMdTime') : 'no i18n fn',
      i18nNoHistory: typeof i18n === 'function' ? i18n('noHistory') : 'no i18n fn',
      i18nBatchImport: typeof i18n === 'function' ? i18n('batchImport') : 'no i18n fn',
      hasI18N: typeof I18N !== 'undefined' && !!I18N,
      hasI18N_en: typeof I18N !== 'undefined' && !!I18N.en,
      I18N_en_cvMdTime: typeof I18N !== 'undefined' && I18N.en ? I18N.en.cvMdTime : 'no I18N.en',
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
