const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
(async () => {
  const tmp = path.join(os.tmpdir(), 'dbg_' + Date.now());
  const browser = await puppeteer.launch({ headless: true, args: ['--user-data-dir=' + tmp] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器.html'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => { if (window.switchTab) window.switchTab('settings'); });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    window.__ocrCalls = [];
    window.__originalFetch = window.fetch.bind(window);
    const orig = window.__originalFetch;
    window.fetch = function(url) {
      const s = String(url);
      if (s.includes('localhost:8766/')) {
        window.__ocrCalls.push((s.includes('start')?'START':'STATUS') + ' ' + s);
        return Promise.resolve({ ok: true, status: 200,
          json: () => Promise.resolve({ status: 'done', stage: 'done', progress: 100,
            result: { fields: { RSD: { value: '1%', confidence: 0.9, page: 1 } }, elapsed_sec: 0.5, pages: 1 } }),
          text: () => Promise.resolve('') });
      }
      return orig(url);
    };
    Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).forEach(k => localStorage.removeItem(k));
  });
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    dt.items.add(new File(['x'], 'b.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  const cacheBefore = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).length);
  console.log('cache keys before extract:', cacheBefore);
  await page.evaluate(() => { if (window.extractOcrFields) window.extractOcrFields(); });
  await new Promise(r => setTimeout(r, 1500));
  const calls = await page.evaluate(() => window.__ocrCalls);
  const cacheAfter = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).length);
  console.log('fetch calls:', calls);
  console.log('cache keys after extract:', cacheAfter);
  console.log('cache keys:', await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-'))));
  await browser.close();
})();
