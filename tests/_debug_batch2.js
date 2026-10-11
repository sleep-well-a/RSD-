const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
(async () => {
  const tmp = path.join(os.tmpdir(), 'dbg2_' + Date.now());
  const browser = await puppeteer.launch({ headless: true, args: ['--user-data-dir=' + tmp] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器.html'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => { if (window.switchTab) window.switchTab('settings'); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).forEach(k => localStorage.removeItem(k));
  });
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    ['a','b','c'].forEach(n => {
      dt.items.add(new File(['x'+n], n+'.pdf', { type: 'application/pdf' }));
    });
    console.log('files set:', dt.files.length, [...dt.files].map(f => `${f.name}|${f.size}`));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  const filesAfterChange = await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    return input.files ? [...input.files].map(f => `${f.name}|${f.size}`) : [];
  });
  console.log('files after change:', filesAfterChange);
  const btn = await page.evaluate(() => {
    const b = document.getElementById('ocr-extract-btn');
    return { disabled: b.disabled, text: b.textContent };
  });
  console.log('extract btn:', btn);
  await browser.close();
})();
