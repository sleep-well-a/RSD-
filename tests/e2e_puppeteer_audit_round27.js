// v54.265 e2e_puppeteer_audit_round27.js
// Round 27: P1 a11y 修复验证（icon-only 按钮 / 错误浮层 / 模态 / tab ARIA）
//
//   A. 静态 HTML：confirm-dialog alertdialog、无 aria-label="-"、tab/tabpanel 数量与引用完整性
//   B. 运行时 zh：动态创建的删除按钮带 aria-label；tab ARIA；错误浮层 role=alert；
//      _showSampleIdPrompt 的 alertdialog + 焦点恢复
//   C. _setLang('en')：data-i18n-aria-label 生效，aria-label 变英文；切回 zh
const puppeteer = require('puppeteer');
const fs = require('fs');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';
const HTML_FILE = 'F:\\自制软件\\RSD & 含量计算器.html';

let pass = 0, fail = 0;
const failures = [];
function record(name, ok, detail = '') {
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' -- ' + detail : ''}`);
  if (ok) pass++; else { fail++; failures.push(name + (detail ? ' | ' + detail : '')); }
}

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.265 Round 27 a11y 验证');
  console.log('='.repeat(70));

  const html = fs.readFileSync(HTML_FILE, 'utf8');

  // ============================================================
  // A. 静态 HTML
  // ============================================================
  console.log('\n--- A. 静态 HTML ---');

  record('#confirm-dialog role=alertdialog',
    /id="confirm-dialog"[^>]*/.test(html) &&
    /<div role="alertdialog" aria-modal="true" aria-labelledby="confirm-msg" id="confirm-dialog"/.test(html));

  record('HTML 无 aria-label="-" 残留', !html.includes('aria-label="-"'));
  record('HTML tablist = 4', (html.match(/role="tablist"/g) || []).length === 4,
    `got ${(html.match(/role="tablist"/g) || []).length}`);
  record('HTML role="tab" = 24', (html.match(/role="tab"/g) || []).length === 24,
    `got ${(html.match(/role="tab"/g) || []).length}`);
  record('HTML role="tabpanel" = 24', (html.match(/role="tabpanel"/g) || []).length === 24,
    `got ${(html.match(/role="tabpanel"/g) || []).length}`);
  record('HTML 计算器减号键 ariaCalcMinus x2',
    (html.match(/data-i18n-aria-label="ariaCalcMinus"/g) || []).length === 2);
  record('header-settings-btn 未被误注入 role=tab',
    /<button class="header-btn" id="header-settings-btn" onclick="switchTab\('settings'\)"/.test(html));
  {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
    record('HTML 无重复 id', dup.length === 0, dup.join(','));
  }

  // ============================================================
  // 启动浏览器
  // ============================================================
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  // v54.265: 用 domcontentloaded + 显式 waitForFunction，避免 networkidle0 在
  // 单线程 python http.server 被前面 38 个套件压住时抖动（首跑超时、单跑 PASS）。
  let navOk = false;
  for (let attempt = 1; attempt <= 3 && !navOk; attempt++) {
    try {
      await page.goto(HTML_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction('typeof i18n === "function"', { timeout: 15000 });
      navOk = true;
    } catch (e) {
      console.log(`  [..] goto attempt ${attempt} failed: ${e.message.split('\n')[0]}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  if (!navOk) { await browser.close(); throw new Error('page.goto 3 次均失败'); }
  await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
  await new Promise(r => setTimeout(r, 600));

  // ============================================================
  // B. 运行时 zh
  // ============================================================
  console.log('\n--- B. 运行时（zh）---');

  // B1. 动态删除按钮 aria-label
  const dyn = await page.evaluate(() => {
    const out = {};
    // 面积归一化法对照品峰面积行 → ariaRemoveRow
    try {
      if (typeof switchSpecial === 'function') switchSpecial('curve');
      if (typeof switchRecovery === 'function') switchRecovery('normalize');
    } catch (_) {}
    try { addNormStdAreaRow(); } catch (e) { out.err1 = String(e); }
    try { addCurveRow(); } catch (e) { out.err2 = String(e); }
    try { if (typeof switchRecovery === 'function') switchRecovery('external'); addExtSample(); } catch (e) { out.err3 = String(e); }
    try { if (typeof switchRecovery === 'function') switchRecovery('normalize'); addNormSampleRow(); } catch (e) { out.err4 = String(e); }
    try { addNormRegressRow(); } catch (e) { out.err5 = String(e); }
    function last(fn) {
      const all = [...document.querySelectorAll(`button[onclick^="${fn}("]`)];
      const b = all[all.length - 1];
      return b ? { al: b.getAttribute('aria-label'), key: b.getAttribute('data-i18n-aria-label'), type: b.getAttribute('type') } : null;
    }
    out.stdArea = last('removeNormStdAreaRow');
    out.curveRow = last('removeCurveRow');
    out.extSample = last('removeExtSample');
    out.normSample = last('removeNormSampleRow');
    out.normRegress = last('removeNormRegressRow');
    // 全部 icon-only 删除按钮都必须有 aria-label
    const iconOnly = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === '-');
    out.iconOnlyTotal = iconOnly.length;
    out.iconOnlyMissing = iconOnly.filter(b => !b.getAttribute('aria-label') || b.getAttribute('aria-label') === '-').length;
    out.iconOnlyNoType = iconOnly.filter(b => b.getAttribute('type') !== 'button').length;
    return out;
  });
  record('addNormStdAreaRow 按钮 aria-label=删除此行', dyn.stdArea && dyn.stdArea.al === '删除此行' && dyn.stdArea.key === 'ariaRemoveRow', JSON.stringify(dyn.stdArea));
  record('addCurveRow 按钮 aria-label=删除此行', dyn.curveRow && dyn.curveRow.al === '删除此行', JSON.stringify(dyn.curveRow));
  record('addExtSample 按钮 aria-label=删除本样品', dyn.extSample && dyn.extSample.al === '删除本样品' && dyn.extSample.key === 'ariaRemoveSample', JSON.stringify(dyn.extSample));
  record('addNormSampleRow 按钮 aria-label=删除本样品', dyn.normSample && dyn.normSample.al === '删除本样品', JSON.stringify(dyn.normSample));
  record('addNormRegressRow 按钮 aria-label=删除此行', dyn.normRegress && dyn.normRegress.al === '删除此行', JSON.stringify(dyn.normRegress));
  record('所有 icon-only "-" 按钮都有非 "-" 的 aria-label', dyn.iconOnlyMissing === 0 && dyn.iconOnlyTotal > 0,
    `total=${dyn.iconOnlyTotal} missing=${dyn.iconOnlyMissing}`);
  record('所有 icon-only "-" 按钮 type="button"', dyn.iconOnlyNoType === 0, `noType=${dyn.iconOnlyNoType}`);

  // B2. tab ARIA（运行时 _initTabAria 之后）
  const tabs = await page.evaluate(() => {
    const out = {};
    const tl = document.querySelector('.tabs');
    out.containerRole = tl && tl.getAttribute('role');
    const tabsArr = [...tl.querySelectorAll('.tab')];
    out.tabIds = tabsArr.map(t => t.id);
    out.tabRoles = tabsArr.map(t => t.getAttribute('role'));
    out.selected = tabsArr.map(t => t.getAttribute('aria-selected'));
    out.tabindex = tabsArr.map(t => t.getAttribute('tabindex'));
    out.controlsResolve = tabsArr.every(t => {
      const c = t.getAttribute('aria-controls');
      return c && document.getElementById(c);
    });
    // panel → aria-labelledby 必须指向存在的 tab
    const panels = [...document.querySelectorAll('[role="tabpanel"]')];
    out.panelCount = panels.length;
    out.panelLabelDangling = panels.filter(p => {
      const l = p.getAttribute('aria-labelledby');
      return !l || !document.getElementById(l);
    }).length;
    // 容器 role
    out.subtablistRoles = [...document.querySelectorAll('.subtabs')].map(s => s.getAttribute('role'));
    return out;
  });
  record('.tabs 容器 role=tablist', tabs.containerRole === 'tablist', tabs.containerRole);
  record('7 个 tab 全 role=tab', tabs.tabRoles.length === 7 && tabs.tabRoles.every(r => r === 'tab'), JSON.stringify(tabs.tabRoles));
  record('tab id 为 tl0-tab-0..6', JSON.stringify(tabs.tabIds) === JSON.stringify(['tl0-tab-0','tl0-tab-1','tl0-tab-2','tl0-tab-3','tl0-tab-4','tl0-tab-5','tl0-tab-6']), JSON.stringify(tabs.tabIds));
  record('仅一个 tab aria-selected=true', tabs.selected.filter(v => v === 'true').length === 1, JSON.stringify(tabs.selected));
  record('active tab tabindex=0 其余 -1', tabs.tabindex.filter(v => v === '0').length === 1 && tabs.tabindex.filter(v => v === '-1').length === 6, JSON.stringify(tabs.tabindex));
  record('全部 tab aria-controls 可解析', tabs.controlsResolve);
  record('tabpanel = 24 且 aria-labelledby 无悬空', tabs.panelCount === 24 && tabs.panelLabelDangling === 0,
    `count=${tabs.panelCount} dangling=${tabs.panelLabelDangling}`);
  record('3 个 .subtabs 容器 role=tablist', tabs.subtablistRoles.length === 3 && tabs.subtablistRoles.every(r => r === 'tablist'), JSON.stringify(tabs.subtablistRoles));

  // B3. tab 切换后 aria-selected 跟随（回归：静态属性不得与 JS 冲突）
  const afterSwitch = await page.evaluate(() => {
    switchTab('history');
    const tl = document.querySelector('.tabs');
    const t = [...tl.querySelectorAll('.tab')].find(x => x.getAttribute('aria-controls') === 'page-history');
    const r = { sel: t.getAttribute('aria-selected'), ti: t.getAttribute('tabindex') };
    switchTab('stats');
    const t0 = [...tl.querySelectorAll('.tab')].find(x => x.getAttribute('aria-controls') === 'page-stats');
    r.selBack = t0.getAttribute('aria-selected');
    return r;
  });
  record('switchTab 后 aria-selected/tabindex 正确跟随', afterSwitch.sel === 'true' && afterSwitch.ti === '0' && afterSwitch.selBack === 'true', JSON.stringify(afterSwitch));

  // B4. 计算器减号键
  const calcKey = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button.calc-key')].find(x => x.getAttribute('onclick') === "calcInsert('-')");
    return b ? { al: b.getAttribute('aria-label'), key: b.getAttribute('data-i18n-aria-label') } : null;
  });
  record('计算器减号键 aria-label=减号', calcKey && calcKey.al === '减号' && calcKey.key === 'ariaCalcMinus', JSON.stringify(calcKey));

  // B5. 全局错误浮层 role=alert + aria-live
  const errOverlay = await page.evaluate(async () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'v54_265_test_error', filename: 'test.js', lineno: 1 }));
    await new Promise(r => setTimeout(r, 100));
    const div = [...document.querySelectorAll('div[role="alert"]')].find(d => (d.textContent || '').includes('v54_265_test_error'));
    if (!div) return { found: false };
    const r = { found: true, live: div.getAttribute('aria-live'), text: div.textContent };
    div.remove();
    return r;
  });
  record('window error → div[role=alert][aria-live=assertive]', errOverlay.found && errOverlay.live === 'assertive', JSON.stringify(errOverlay));
  record('错误浮层文案 i18n 化（zh）', errOverlay.found && errOverlay.text.includes('（详细请按 F12 查看 Console）'), errOverlay.text);

  const rejOverlay = await page.evaluate(async () => {
    const ev = new Event('unhandledrejection');
    ev.reason = new Error('v54_265_test_rejection');
    window.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 100));
    const div = [...document.querySelectorAll('div[role="alert"]')].find(d => (d.textContent || '').includes('v54_265_test_rejection'));
    if (!div) return { found: false };
    const r = { found: true, live: div.getAttribute('aria-live') };
    div.remove();
    return r;
  });
  record('unhandledrejection → div[role=alert][aria-live=assertive]', rejOverlay.found && rejOverlay.live === 'assertive', JSON.stringify(rejOverlay));

  // B6. _showSampleIdPrompt modal a11y + 焦点恢复
  const sid = await page.evaluate(async () => {
    const opener = document.getElementById('header-settings-btn');
    opener.focus();
    const before = document.activeElement && document.activeElement.id;
    let confirmed = null;
    _showSampleIdPrompt('S-001', v => { confirmed = v; }, () => { confirmed = 'SKIP'; });
    await new Promise(r => setTimeout(r, 60));
    const modal = document.getElementById('sampleid-prompt-modal');
    const title = document.getElementById('sampleid-prompt-title');
    const input = document.getElementById('sampleid-prompt-input');
    const r = {
      before,
      role: modal && modal.getAttribute('role'),
      ariaModal: modal && modal.getAttribute('aria-modal'),
      labelledby: modal && modal.getAttribute('aria-labelledby'),
      titleExists: !!title,
      titleText: title && title.textContent,
      titleMatches: !!(title && modal.getAttribute('aria-labelledby') === title.id),
      inputLabelled: input && input.getAttribute('aria-labelledby'),
      inputLabelledResolves: !!(input && document.getElementById(input.getAttribute('aria-labelledby'))),
      focusedIsInput: document.activeElement === input,
    };
    // 关闭（Skip）→ 焦点应回到 opener
    document.getElementById('sampleid-prompt-skip').click();
    await new Promise(r => setTimeout(r, 60));
    r.afterCloseFocus = document.activeElement && document.activeElement.id;
    r.confirmed = confirmed;
    r.display = modal.style.display;
    return r;
  });
  record('#sampleid-prompt-modal role=alertdialog', sid.role === 'alertdialog', JSON.stringify(sid));
  record('#sampleid-prompt-modal aria-modal=true', sid.ariaModal === 'true');
  record('aria-labelledby 指向存在的标题元素', sid.labelledby === 'sampleid-prompt-title' && sid.titleExists && sid.titleMatches);
  record('输入框 aria-labelledby 可解析', !!sid.inputLabelled && sid.inputLabelledResolves);
  record('打开时焦点落在输入框', sid.focusedIsInput === true, JSON.stringify({ before: sid.before, focusedIsInput: sid.focusedIsInput }));
  record('关闭（Skip）后焦点回到打开它的按钮', sid.afterCloseFocus === sid.before && sid.before === 'header-settings-btn',
    JSON.stringify({ before: sid.before, after: sid.afterCloseFocus }));
  record('Skip 触发 onCancel 且 modal 隐藏', sid.confirmed === 'SKIP' && sid.display === 'none', JSON.stringify({ confirmed: sid.confirmed, display: sid.display }));

  // ============================================================
  // C. 语言切换
  // ============================================================
  console.log('\n--- C. 语言切换（en）---');
  const en = await page.evaluate(async () => {
    switchSpecial('curve');
    addCurveRow();
    _setLang('en');
    await new Promise(r => setTimeout(r, 400));
    const all = [...document.querySelectorAll(`button[onclick^="removeCurveRow("]`)];
    const b = all[all.length - 1];
    const minus = [...document.querySelectorAll('button.calc-key')].find(x => x.getAttribute('onclick') === "calcInsert('-')");
    const r = {
      curveAria: b && b.getAttribute('aria-label'),
      minusAria: minus && minus.getAttribute('aria-label'),
      tabLabel: document.querySelector('.tabs .tab[aria-controls="page-stats"]').textContent.trim(),
      tabSelected: document.querySelector('.tabs .tab[aria-controls="page-stats"]').getAttribute('aria-selected'),
      minKey: i18n('ariaRemoveRow'),
    };
    _setLang('zh');
    await new Promise(r => setTimeout(r, 400));
    const all2 = [...document.querySelectorAll(`button[onclick^="removeCurveRow("]`)];
    r.curveAriaBack = all2[all2.length - 1].getAttribute('aria-label');
    r.minusAriaBack = [...document.querySelectorAll('button.calc-key')].find(x => x.getAttribute('onclick') === "calcInsert('-')").getAttribute('aria-label');
    return r;
  });
  record('en 模式 ariaRemoveRow = Delete this row', en.minKey === 'Delete this row', en.minKey);
  record('en 模式删除按钮 aria-label 同步为英文', en.curveAria === 'Delete this row', JSON.stringify(en.curveAria));
  record('en 模式减号键 aria-label=Minus', en.minusAria === 'Minus', JSON.stringify(en.minusAria));
  record('en 模式 tab 文案变英文', en.tabLabel === 'Statistics', JSON.stringify(en.tabLabel));
  record('en 模式 tab aria-selected 不受影响', en.tabSelected === 'true', JSON.stringify(en.tabSelected));
  record('切回 zh 后 aria-label 恢复中文', en.curveAriaBack === '删除此行' && en.minusAriaBack === '减号',
    JSON.stringify({ curve: en.curveAriaBack, minus: en.minusAriaBack }));

  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log(`PASS: ${pass}/${pass + fail}`);
  if (failures.length) {
    console.log('[FAIL]');
    failures.forEach(f => console.log('   ' + f));
  }
  console.log('='.repeat(70));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('EXCEPTION', e); process.exit(1); });
