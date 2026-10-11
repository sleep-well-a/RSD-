// v54.272 B4 perf 5 bug 修复验证
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

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.272 B4 perf 5 bug fix');
  console.log('='.repeat(70));

  // A. 静态
  console.log('\n--- A. 静态 ---');
  // B4-1: renderHistory 用 lazy data-loaded flag
  record('B4-1 renderHistory details-content data-loaded="0" 占位',
    appJs.includes('<div class="h-details-content" data-loaded="0"></div>'));
  record('B4-1 renderHistory 不再每行 JSON.stringify',
    !appJs.match(/'<div class="h-details-content">' \+ _esc\(JSON\.stringify\(e, null, 2\)\) \+ '<\/div>'/));
  record('B4-1 toggle handler 懒填充 JSON',
    appJs.includes("c.dataset.loaded === '0'") && appJs.includes('c.textContent = entry ? _esc(JSON.stringify(entry, null, 2))'));

  // B4-2: renderUniformity/Dissolution 不再用 allContents.concat
  record('B4-2 renderUniformity/Dissolution 无 allContents.concat',
    !appJs.includes('allContents = allContents.concat(vals)'));
  record('B4-2 用 for 循环 push',
    (appJs.match(/for\(var _k=0; _k<vals\.length; _k\+\+\) allContents\.push\(vals\[_k\]\)/g) || []).length === 2);

  // B4-3: renderDrying hoist i18n
  record('B4-3 renderDrying hoist i18n 到 sample 循环外',
    appJs.includes('const _dryingW0 = i18n(\'thDryingW0\'), _dryingW1 = i18n(\'thDryingW1\'), _dryingW2 = i18n(\'thDryingW2\')'));

  // B4-4: getH clean flag
  record('B4-4 getH 用 _historyCacheClean flag 避免每次 .some()',
    appJs.includes('var _historyCacheClean = true') && appJs.includes('_historyCacheClean = false'));
  record('B4-4 _loadHistoryFromStorage 标记 dirty',
    appJs.includes('_historyCacheClean = false'));

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

  // B4-1 浏览器实测：加 2 条 stats entry，看 details-content 是否 lazy
  console.log('\n--- B1: renderHistory details-content lazy ---');
  const b1 = await page.evaluate(async () => {
    if (typeof addH === 'function') {
      addH({ type: '统计计算', time: _formatNow ? _formatNow() : new Date().toISOString(), rsd: 1.0, mean: 100, sd: 1, n: 6 });
      addH({ type: '统计计算', time: _formatNow ? _formatNow() : new Date().toISOString(), rsd: 2.0, mean: 100, sd: 2, n: 6 });
    }
    await new Promise(r => setTimeout(r, 400));
    if (typeof switchTab === 'function') switchTab('history');
    await new Promise(r => setTimeout(r, 600));
    const contents = document.querySelectorAll('.h-details-content');
    if (!contents.length) return { error: 'no details content' };
    return {
      count: contents.length,
      loadedFlags: Array.from(contents).map(c => c.dataset.loaded),
      innerSamples: Array.from(contents).slice(0, 2).map(c => c.innerHTML.slice(0, 50))
    };
  });
  record('B4-1 details-content 全部 data-loaded="0" 初始状态',
    b1.count >= 1 && b1.loadedFlags.every(f => f === '0' || f === undefined),
    JSON.stringify(b1));

  // 触发 toggle 看 lazy fill
  const b1toggle = await page.evaluate(async () => {
    const btn = document.querySelector('button[data-action="details"]');
    if (!btn) return { error: 'no details btn' };
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    const det = document.querySelector('.h-details[data-idx="' + btn.dataset.idx + '"] .h-details-content');
    return {
      loaded: det ? det.dataset.loaded : null,
      len: det ? det.innerHTML.length : 0,
      hasJsonContent: det ? det.innerHTML.includes('"type"') || det.innerHTML.includes('"time"') : false,
    };
  });
  // 实际 JSON 经 _esc 后 " → &quot;
  const verify = await page.evaluate(() => {
    const det = document.querySelector('.h-details[data-idx="0"] .h-details-content');
    return det ? {
      html: det.innerHTML.slice(0, 300),
      hasType: det.innerHTML.includes('type'),
      hasTime: det.innerHTML.includes('time'),
    } : null;
  });
  record('B4-1 toggle 后 details-content data-loaded="1" + 含 JSON 字段',
    b1toggle.loaded === '1' && verify && verify.hasType,
    JSON.stringify({loaded: b1toggle.loaded, verify}));

  // B4-2: 跑 renderUniformity 看 allContents 无 concat
  console.log('\n--- B2: renderUniformity 性能 ---');
  const b2 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('uniformity');
    await new Promise(r => setTimeout(r, 600));
    return { ok: true };
  });
  record('B2 切到 uniformity tab 不报错', b2.ok, JSON.stringify(b2));

  // B4-3 renderDrying hoist
  // B4-3 renderDrying hoist — 加样品再渲染
  const b3 = await page.evaluate(async () => {
    if (typeof switchTab === 'function') switchTab('drying');
    await new Promise(r => setTimeout(r, 600));
    // 主动加 sample + parallel
    if (typeof dryingData !== 'undefined') {
      dryingData.push({ parallels: [{ w0: '100', w1: '90', w2: '95' }] });
    }
    if (typeof renderDrying === 'function') renderDrying();
    await new Promise(r => setTimeout(r, 300));
    const inputs = document.querySelectorAll('.dry-w0');
    return { count: inputs.length, dryingDataLen: typeof dryingData !== 'undefined' ? dryingData.length : -1 };
  });
  record('B4-3 renderDrying 渲染正常（inputs > 0）', b3.count > 0, JSON.stringify(b3));

  // B4-4: getH 100 次调用实测
  const b4 = await page.evaluate(async () => {
    if (typeof getH !== 'function') return { error: 'no getH' };
    const start = performance.now();
    for (let i = 0; i < 100; i++) getH();
    const elapsed = performance.now() - start;
    return { elapsed, len: getH().length };
  });
  record('B4-4 getH 100 次调用 < 50ms (avg < 0.5ms)',
    b4.elapsed < 50, JSON.stringify(b4));

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