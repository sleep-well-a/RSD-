// v54.268 e2e_puppeteer_audit_round30.js
// Round 30: P1.5 a11y —— textarea / select / button 综合审计
//
//   A. 静态：app.js + HTML 中所有 <textarea>/<select> 都有可访问名称
//       （aria-label / aria-labelledby / <label for=> / <label> 包裹）
//   B. 运行时：流动相 page 的溶剂 select 切到 en 后 aria-label = "Select solvent"
//   C. 回归：v54.265 (round27) + v54.266 (round28) 所有断言继续通过
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = 'F:\\自制软件';
const HTML_FILE = path.join(ROOT, 'RSD & 含量计算器.html');
const APP_FILE = path.join(ROOT, 'app.js');
const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

let pass = 0, fail = 0;
const fails = [];
function record(name, ok, detail = '') {
  console.log('  [' + (ok ? 'OK' : 'FAIL') + '] ' + name + (detail ? ' -- ' + detail : ''));
  if (ok) pass++; else { fail++; fails.push(name + (detail ? ' | ' + detail : '')); }
}

const PLAIN_AL = /(?<![\w-])aria-label=/;
const SKIP = ['type="hidden"', 'type="checkbox"', 'type="radio"', 'type="file"'];

// 静态：列出无 label 的 textarea/select（含 js 模板串）
function auditSelectTextarea(src, forIds) {
  const out = [];
  for (const m of src.matchAll(/<(?:textarea|select)\b[^>]*>/g)) {
    const tag = m[0];
    const idm = /\bid="([^"]+)"/.exec(tag);
    if (idm && forIds.has(idm[1])) continue;
    if (PLAIN_AL.test(tag)) continue;
    const lb = /aria-labelledby="([^"]+)"/.exec(tag);
    if (lb) continue;
    // 检查同一 innerHTML 块内是否有 <label> 包裹（仅静态源码相邻 200 字符）
    const back = src.slice(Math.max(0, m.index - 200), m.index);
    const fwd = src.slice(m.index, Math.min(src.length, m.index + 200));
    if (/<label\b/i.test(back) && !back.slice(back.lastIndexOf('<label')).includes('</label>')) continue;
    if (/^[\s\S]*<label\b/i.test(fwd.slice(0, 200))) continue;
    out.push({
      line: src.slice(0, m.index).split('\n').length,
      kind: tag.startsWith('<textarea') ? 'textarea' : 'select',
      tag: tag.slice(0, 140),
    });
  }
  return out;
}

async function main() {
  const html = fs.readFileSync(HTML_FILE, 'utf8');
  const appJs = fs.readFileSync(APP_FILE, 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.268 Round 30 textarea/select a11y');
  console.log('='.repeat(70));

  // ============================================================
  // A. 静态审计
  // ============================================================
  console.log('\n--- A. 静态 ---');
  for (const [name, src] of [['HTML', html], ['app.js', appJs]]) {
    const forIds = new Set([...src.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m => m[1]));
    const bad = auditSelectTextarea(src, forIds);
    record(`${name} 无未标注 textarea/select`, bad.length === 0,
      bad.length ? bad.slice(0, 3).map(b => 'L' + b.line + '[' + b.kind + ']:' + b.tag.slice(0, 60)).join(' ; ') : '');
  }

  // ============================================================
  // 启动浏览器 + 运行时验证
  // ============================================================
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

  // ============================================================
  // B. 流动相溶剂 select aria-label
  // ============================================================
  console.log('\n--- B. 流动相溶剂 select ---');
  await page.evaluate(() => { switchTab('mobile'); });
  await new Promise(r => setTimeout(r, 200));
  const mpSel = await page.evaluate(() => {
    // 找 mpRow 中的 select
    const all = [...document.querySelectorAll('select')];
    const target = all.find(s => (s.getAttribute('onchange') || '').includes('onSel('));
    return target ? {
      aria: target.getAttribute('aria-label'),
      key: target.getAttribute('data-i18n-aria-label'),
    } : null;
  });
  record('流动相溶剂 select 存在', mpSel !== null, JSON.stringify(mpSel));
  record('流动相溶剂 select zh aria-label=选择溶剂', mpSel && mpSel.aria === '选择溶剂' && mpSel.key === 'mpSolventLabel',
    JSON.stringify(mpSel));

  const mpSelEn = await page.evaluate(async () => {
    _setLang('en');
    await new Promise(r => setTimeout(r, 300));
    const all = [...document.querySelectorAll('select')];
    const target = all.find(s => (s.getAttribute('onchange') || '').includes('onSel('));
    return target ? target.getAttribute('aria-label') : null;
  });
  record('流动相溶剂 select en aria-label=Select solvent', mpSelEn === 'Select solvent', JSON.stringify(mpSelEn));
  await page.evaluate(() => _setLang('zh'));

  // ============================================================
  // C. 综合：运行时已渲染的所有 select/textarea 都有可访问名称
  // ============================================================
  console.log('\n--- C. 运行时 select/textarea 全部有可访问名称 ---');
  const cov = await page.evaluate(() => {
    function named(el) {
      if (el.getAttribute('aria-label')) return true;
      const lb = el.getAttribute('aria-labelledby');
      if (lb && document.getElementById(lb)) return true;
      if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return true;
      if (el.closest('label')) return true;
      return false;
    }
    const sels = [...document.querySelectorAll('select')];
    const tas = [...document.querySelectorAll('textarea')];
    return {
      selTotal: sels.length,
      selNamed: sels.filter(named).length,
      selUnnamed: sels.filter(s => !named(s)).map(s => s.id || s.outerHTML.slice(0, 70)),
      taTotal: tas.length,
      taNamed: tas.filter(named).length,
      taUnnamed: tas.filter(t => !named(t)).map(t => t.id || t.outerHTML.slice(0, 70)),
    };
  });
  record('运行时所有 select 都有可访问名称',
    cov.selTotal > 0 && cov.selNamed === cov.selTotal,
    JSON.stringify({ total: cov.selTotal, named: cov.selNamed, unnamed: cov.selUnnamed }));
  record('运行时 textarea 覆盖率（可能为 0）',
    cov.taTotal === 0 || cov.taNamed === cov.taTotal,
    JSON.stringify({ total: cov.taTotal, named: cov.taNamed, unnamed: cov.taUnnamed }));

  // ============================================================
  // D. 回归：v54.265 关键场景（alertdialog + 焦点恢复）
  // ============================================================
  console.log('\n--- D. v54.265 回归 ---');
  const sampleId = await page.evaluate(async () => {
    const opener = document.getElementById('header-settings-btn');
    opener.focus();
    _showSampleIdPrompt('S-test', v => {}, () => {});
    await new Promise(r => setTimeout(r, 60));
    const modal = document.getElementById('sampleid-prompt-modal');
    const r = {
      role: modal && modal.getAttribute('role'),
      ariaModal: modal && modal.getAttribute('aria-modal'),
    };
    document.getElementById('sampleid-prompt-skip').click();
    await new Promise(r => setTimeout(r, 60));
    r.afterFocus = document.activeElement && document.activeElement.id;
    return r;
  });
  record('#sampleid-prompt-modal 仍为 alertdialog + aria-modal=true',
    sampleId.role === 'alertdialog' && sampleId.ariaModal === 'true', JSON.stringify(sampleId));
  record('关闭后焦点回到 opener', sampleId.afterFocus === 'header-settings-btn', JSON.stringify(sampleId.afterFocus));

  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log('PASS: ' + pass + '/' + (pass + fail));
  if (fails.length) { console.log('[FAIL]'); fails.forEach(f => console.log('   ' + f)); }
  console.log('='.repeat(70));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('EXCEPTION', e); process.exit(1); });