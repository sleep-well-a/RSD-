// v54.272 色对比度 WCAG AA 审计
// 抓取真实渲染颜色 → 计算 contrast ratio → 标记 fail（< 4.5 for normal text / < 3.0 for large）
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = 'F:\\自制软件';
const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

// WCAG 2.1 对比度计算：luminance-based ratio
function relLum(rgb) {
  // sRGB to linear
  const a = rgb.map(v => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function ratio(rgb1, rgb2) {
  const l1 = relLum(rgb1);
  const l2 = relLum(rgb2);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}
function parseRgb(s) {
  if (!s || typeof s !== 'string') return null;
  // 处理 rgba 透明度 — modal overlay 实际叠加在白底上（页面 #f8fafc 接近白），
  // compositing 后会比纯 alpha 测试看到的更深 → 这里直接 compositing 到白
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  const r = +m[1], g = +m[2], b = +m[3];
  const a = m[4] !== undefined ? +m[4] : 1;
  if (a === 1) return [r, g, b];
  // 与白色 compositing（modal overlay 在白底上叠半透明黑）
  return [Math.round(r * a + 255 * (1 - a)), Math.round(g * a + 255 * (1 - a)), Math.round(b * a + 255 * (1 - a))];
}

let pass = 0, fail = 0;
const fails = [];
function record(name, ok, detail = '') {
  console.log('  [' + (ok ? 'OK' : 'FAIL') + '] ' + name + (detail ? ' -- ' + detail : ''));
  if (ok) pass++; else { fail++; fails.push(name + (detail ? ' | ' + detail : '')); }
}

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.272 色对比度 WCAG AA 审计');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-cache', '--disk-cache-size=0'] });
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

  // Puppeteer 实测所有可见文字元素的 color × background-color 对比度
  console.log('\n--- A. Puppeteer 实测（zh 模式） ---');
  const probe = await page.evaluate(() => {
    function getComputed(el, prop) {
      return getComputedStyle(el).getPropertyValue(prop).trim();
    }
    // 抓取所有可见文字元素
    const sel = 'body *:not(script):not(style):not(meta):not(link):not(head)';
    const els = Array.from(document.querySelectorAll(sel));
    const results = [];
    for (const el of els) {
      const tag = el.tagName.toLowerCase();
      // 只测有可见文字的元素
      const text = el.innerText ? el.innerText.trim() : '';
      if (!text || text.length > 100) continue;
      // 跳过非文字元素
      if (['script', 'style', 'meta', 'link', 'head'].includes(tag)) continue;
      const color = getComputed(el, 'color');
      const bg = getComputed(el, 'background-color');
      if (!color) continue;
      // bg 为 transparent / rgba(0,0,0,0) 时往祖先找。但 modal-card 已有 #fff 实心 bg，跳过 modal-overlay 半透层
      let actualBg = bg;
      let cur = el;
      while (cur && (actualBg === 'rgba(0, 0, 0, 0)' || actualBg === 'transparent' || !actualBg)) {
        // 跳过 modal-overlay（其上文字实际在 .modal-card 的 #fff 上）
        if (cur.classList && cur.classList.contains('modal-overlay')) {
          actualBg = 'rgba(0, 0, 0, 0)';  // 标记跳过
          break;
        }
        actualBg = getComputed(cur, 'background-color');
        cur = cur.parentElement;
      }
      // 如果祖先是 modal-overlay（如 modal-card 内嵌文字），跳到 modal-card 实心 bg
      let p = el.parentElement;
      while (p && p.classList && p.classList.contains('modal-overlay')) {
        actualBg = getComputed(p.querySelector('.modal-card') || p).backgroundColor;
        break;
      }
      results.push({
        tag,
        cls: el.className ? (typeof el.className === 'string' ? el.className : el.className.baseVal || '') : '',
        id: el.id || '',
        text: text.substring(0, 30),
        color,
        bg: actualBg
      });
    }
    return results;
  });

  // 计算 ratio，标记 fail
  const failed = [];
  const passed = [];
  for (const r of probe) {
    const fg = parseRgb(r.color);
    const bg = parseRgb(r.bg);
    if (!fg || !bg) continue;
    // visually-hidden WCAG 豁免（仅 SR 用户感知，视觉无影响）
    if (r.cls.includes('visually-hidden')) continue;
    // modal-overlay 上的所有内容（实际显示在 modal-card #fff 上方，半透黑让后面变暗但文字本身 on #fff）
    if (r.bg === 'rgba(0, 0, 0, 0.5)' || r.cls.includes('modal-overlay')) continue;
    const rat = ratio(fg, bg);
    const text = r.text.replace(/\s+/g, ' ').trim();
    // AA: ≥4.5 normal text, ≥3.0 large text (≥18pt or 14pt bold)
    const isLarge = r.tag === 'h1' || r.tag === 'h2' || r.tag === 'h3' || parseInt(r.cls.match(/fs-(\d+)/)?.[1] || '0') >= 18;
    const thresh = isLarge ? 3.0 : 4.5;
    const item = {
      tag: r.tag, cls: r.cls.substring(0, 30), id: r.id,
      text: text.substring(0, 30),
      fg: r.color, bg: r.bg,
      ratio: rat.toFixed(2), thresh, isLarge
    };
    if (rat < thresh) failed.push(item);
    else passed.push(item);
  }
  console.log(`  共 ${passed.length + failed.length} 个元素，FAIL ${failed.length} 个（ratio < 阈值）`);

  // 按 text 聚合（同一文字可能有多个 ratio）
  const failByText = {};
  for (const f of failed) {
    const key = f.text;
    if (!failByText[key]) failByText[key] = [];
    failByText[key].push(f);
  }

  // 报告 top fail（按 ratio 升序）
  const sortedFails = failed.slice().sort((a, b) => parseFloat(a.ratio) - parseFloat(b.ratio));
  console.log('\n  最低 contrast 10 项:');
  for (const f of sortedFails.slice(0, 10)) {
    console.log(`    ${f.ratio}:1 (${f.isLarge ? 'large' : 'normal'} thresh ${f.thresh}) <${f.tag}.${f.cls.substring(0,20)}> "${f.text}" fg=${f.fg} bg=${f.bg}`);
  }

  // 关键 UI 元素对比度
  console.log('\n--- B. 关键 UI 元素（明确标 fail/pass） ---');

  // 1. body 文字 vs bg（最重要）
  const bodyRat = await page.evaluate(() => {
    const b = document.body;
    const color = getComputedStyle(b).color;
    const bg = getComputedStyle(b).backgroundColor;
    return { color, bg };
  });
  const bodyFg = parseRgb(bodyRat.color);
  const bodyBg = parseRgb(bodyRat.bg);
  if (bodyFg && bodyBg) {
    const r = ratio(bodyFg, bodyBg);
    record(`body 文字对比度 ${r.toFixed(2)}:1 ≥ 4.5 (AA)`, r >= 4.5, `fg=${bodyRat.color} bg=${bodyRat.bg}`);
  }

  // 2. tab.active vs 背景
  const tabActive = await page.evaluate(() => {
    const t = document.querySelector('.tab.active');
    if (!t) return null;
    return {
      color: getComputedStyle(t).color,
      bg: getComputedStyle(document.querySelector('.tabs')).backgroundColor
    };
  });
  if (tabActive) {
    const fg = parseRgb(tabActive.color);
    const bg = parseRgb(tabActive.bg);
    if (fg && bg) {
      const r = ratio(fg, bg);
      record(`tab.active 对比度 ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5, `fg=${tabActive.color} bg=${tabActive.bg}`);
    }
  }

  // 3. .btn-primary (白底蓝字？or 蓝底白字?)
  const btnPrim = await page.evaluate(() => {
    const b = document.querySelector('.btn-primary');
    if (!b) return null;
    return { color: getComputedStyle(b).color, bg: getComputedStyle(b).backgroundColor };
  });
  if (btnPrim) {
    const fg = parseRgb(btnPrim.color);
    const bg = parseRgb(btnPrim.bg);
    if (fg && bg) {
      const r = ratio(fg, bg);
      record(`.btn-primary 对比度 ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5, `fg=${btnPrim.color} bg=${btnPrim.bg}`);
    }
  }

  // 4. .btn-outline
  const btnOutline = await page.evaluate(() => {
    const b = document.querySelector('.btn-outline');
    if (!b) return null;
    return { color: getComputedStyle(b).color, bg: getComputedStyle(b).backgroundColor };
  });
  if (btnOutline) {
    const fg = parseRgb(btnOutline.color);
    const bg = parseRgb(btnOutline.bg);
    if (fg && bg) {
      const r = ratio(fg, bg);
      record(`.btn-outline 对比度 ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5, `fg=${btnOutline.color} bg=${btnOutline.bg}`);
    }
  }

  // 5. .label (.result-item .label)
  const label = await page.evaluate(() => {
    const b = document.querySelector('.result-item .label');
    if (!b) return null;
    return {
      color: getComputedStyle(b).color,
      bg: getComputedStyle(b.parentElement).backgroundColor
    };
  });
  if (label) {
    const fg = parseRgb(label.color);
    const bg = parseRgb(label.bg);
    if (fg && bg) {
      const r = ratio(fg, bg);
      record(`.result-item .label 对比度 ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5, `fg=${label.color} bg=${label.bg}`);
    }
  }

  // 6. .h-type-stats
  const htype = await page.evaluate(() => {
    const b = document.querySelector('.h-type-stats');
    if (!b) return null;
    return { color: getComputedStyle(b).color, bg: getComputedStyle(b).backgroundColor };
  });
  if (htype) {
    const fg = parseRgb(htype.color);
    const bg = parseRgb(htype.bg);
    if (fg && bg) {
      const r = ratio(fg, bg);
      record(`.h-type-stats 对比度 ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5, `fg=${htype.color} bg=${htype.bg}`);
    }
  }

  await browser.close();
  console.log('\n' + '='.repeat(70));
  console.log(`PASS: ${pass}/${pass + fail}`);
  console.log(`实测 fail 元素: ${failed.length}/${passed.length + failed.length}`);
  if (fails.length) {
    console.log('[FAIL]');
    fails.forEach(f => console.log('   ' + f));
  }
  console.log('='.repeat(70));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('EXCEPTION', e); process.exit(1); });