// v54.230 e2e_puppeteer_audit_round3.js: 三轮审计 10 个 HIGH bug 修复测试
// C/D/E/F#1 HTML double-class regression (15 sites merged)
// C/D/E/F#2 setH silent failure (callers check return)
// C/D/E/F#3 mpSaveRecipe atomic (snapshot/rollback)
// C/D/E/F#4 removeExt/IntSample wrong i18n key
// + Round 3 agent#1 restoreBackup rollback
// + Round 3 agent#7 importTemplates rollback
// + a11y B#2 aria-live on toast container
// + a11y B#1 tab role semantics
// + a11y B#3 welcome modal focus trap
// + a11y B#4 label/input for= association
const puppeteer = require('puppeteer');
const fs = require('fs');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.230 e2e_puppeteer_audit_round3.js');
  console.log('Round 3 audit (10 HIGH bugs) regression tests');
  console.log('='.repeat(70));

  let browser;
  let pass_count = 0;
  let fail_count = 0;

  function record(name, ok, detail = '') {
    const status = ok ? 'OK' : 'FAIL';
    const line = detail ? `  [${status}] ${name} -- ${detail}` : `  [${status}] ${name}`;
    console.log(line);
    if (ok) pass_count++;
    else fail_count++;
  }

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(HTML_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
    await new Promise(r => setTimeout(r, 500));

    const cleanup = async () => await page.evaluate(() => {
      try { localStorage.removeItem('rsd-calc-history'); } catch(e){}
      try { localStorage.removeItem('rsd-mp-recipes'); } catch(e){}
    });
    await cleanup();

    // ===================================================
    // C/D/E/F #1: HTML double-class bug regression (15 sites)
    // ===================================================
    console.log('\n--- #1 HTML double-class attribute regression ---');
    const html = fs.readFileSync('F:\\自制软件\\RSD & 含量计算器.html', 'utf8');
    // 匹配任何 tag 同时含多个 class= 属性
    const doubleClass = [];
    const tagRe = /<([\w-]+)([^>]*?)>/g;
    let m;
    while ((m = tagRe.exec(html)) !== null) {
      const classes = (m[2].match(/class="[^"]+"/g) || []);
      if (classes.length > 1) doubleClass.push(m[0].slice(0, 200));
    }
    record('No double class="..." attributes in HTML',
      doubleClass.length === 0,
      `count=${doubleClass.length}`);

    // 验证具体元素：15 个本应 hidden 的元素现在 class 含 "hide"
    const hideCheck = await page.evaluate(() => {
      const ids = ['norm-regress-result', 'norm-stats', 'ext-stats', 'int-stats', 'simple-result',
                   'trend-chart-card', 'chart-empty', 'mp-method-card', 'uni-result', 'diss-result',
                   'spike-result', 'spike-history-card'];
      const out = {};
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) out[id] = el.className.includes('hide');
      });
      return out;
    });
    const allHidden = Object.values(hideCheck).every(v => v === true);
    const someFound = Object.keys(hideCheck).length > 0;
    record('Hidden elements actually have "hide" in className',
      allHidden && someFound,
      `checked=${Object.keys(hideCheck).length}/12 ok=${Object.values(hideCheck).filter(v=>v).length}`);

    // ===================================================
    // C/D/E/F #2: setH silent failure → callers check return
    // ===================================================
    console.log('\n--- #2 setH returns false on quota exceeded ---');
    const setHResult = await page.evaluate(async () => {
      try {
        // setH 是 function 声明（top-level），应在全局作用域可见
        const exists = typeof setH === 'function';
        if (!exists) return { ok: false, error: 'setH not in global scope' };
        // 真浏览器可能接受（无 quota 限制），但要保证 setH 仍返回 boolean
        const res = setH('x'.repeat(50 * 1024 * 1024)); // 50MB 几乎必触发 quota
        return { ok: true, returned: res, type: typeof res };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('setH is function and returns boolean',
      setHResult.ok && (setHResult.returned === true || setHResult.returned === false),
      `returned=${setHResult.returned} type=${setHResult.type}`);

    // 源码静态检查：addH 检测 setH 返回值（防止静默丢失）
    const appJs = fs.readFileSync('F:\\自制软件\\app.js', 'utf8');
    const addHHasSetHCheck = /function addH[\s\S]*?if\s*\(\s*!setH\(h\)\)\s*\{\s*h\.shift/.test(appJs);
    record('addH() rolls back on setH failure',
      addHHasSetHCheck,
      `addH contains "if (!setH(h)) { h.shift"`);

    const deleteSingleHasSetHCheck = /function deleteSingle[\s\S]*?if\s*\(\s*!setH\(h\)\)/.test(appJs);
    record('deleteSingle() rolls back on setH failure',
      deleteSingleHasSetHCheck,
      `deleteSingle contains "if (!setH(h))"`);

    // clearHistory 加了 toast
    const clearHistoryHasToast = /function clearHistory[\s\S]*?_i18nToast\('toast_historyClearedFmt'/.test(appJs);
    record('clearHistory() shows success toast after clearing',
      clearHistoryHasToast,
      `clearHistory contains "_i18nToast('toast_historyClearedFmt'"`);

    // i18n key 存在
    // v54.247 split: aggregate from all 4 i18n files
    const i18nData = ['i18n-zh.js', 'i18n-en.js', 'i18n-alert.js', 'i18n-data.js']
      .map(f => fs.readFileSync('F:\\自制软件\\' + f, 'utf8'))
      .join('\n');
    record('toast_historyClearedFmt exists in zh',
      /toast_historyClearedFmt:\s*'[^']*已清空/.test(i18nData),
      'i18n has "toast_historyClearedFmt: \'✓ 已清空"');
    record('toast_historyClearedFmt exists in en',
      /toast_historyClearedFmt:\s*'[^']*Cleared/.test(i18nData),
      'i18n has "toast_historyClearedFmt: \'✓ Cleared"');

    // ===================================================
    // C/D/E/F #3: mpSaveRecipe atomic (snapshot/rollback)
    // ===================================================
    console.log('\n--- #3 mpSaveRecipe atomic transaction ---');
    const mpSaveHasSnapshot = /function mpSaveRecipe[\s\S]*?recipesSnap\s*=\s*mpGetRecipes\(\)[\s\S]*?recipes\s*=\s*recipesSnap\.slice/.test(appJs);
    record('mpSaveRecipe uses snapshot/rollback pattern',
      mpSaveHasSnapshot,
      'mpSaveRecipe contains "recipesSnap = mpGetRecipes(); ... recipes = recipesSnap.slice"');

    // ===================================================
    // C/D/E/F #4: removeExt/IntSample uses sampleNum not hDryingSample
    // ===================================================
    console.log('\n--- #4 removeExtSample/removeIntSample use sampleNum ---');
    const removeExtHasH = /function removeExtSample[\s\S]{0,200}i18n\('hDryingSample'\)/.test(appJs);
    record('removeExtSample NO LONGER uses hDryingSample (was bug)',
      !removeExtHasH,
      `bug still present=${removeExtHasH}`);

    const removeIntHasH = /function removeIntSample[\s\S]{0,200}i18n\('hDryingSample'\)/.test(appJs);
    record('removeIntSample NO LONGER uses hDryingSample (was bug)',
      !removeIntHasH,
      `bug still present=${removeIntHasH}`);

    const removeExtUsesSampleNum = /function removeExtSample[\s\S]{0,1500}i18n\('sampleNum'\)/.test(appJs);
    record('removeExtSample uses sampleNum (correct)',
      removeExtUsesSampleNum,
      `uses sampleNum=${removeExtUsesSampleNum}`);

    const removeIntUsesSampleNum = /function removeIntSample[\s\S]{0,1500}i18n\('sampleNum'\)/.test(appJs);
    record('removeIntSample uses sampleNum (correct)',
      removeIntUsesSampleNum,
      `uses sampleNum=${removeIntUsesSampleNum}`);

    // ===================================================
    // Round 3 Agent Finding #1: restoreBackup rollback
    // ===================================================
    console.log('\n--- Round3 #1 restoreBackup rollback on partial failure ---');
    const restoreBackupHasRollback = /function restoreBackup[\s\S]*?oldSnap[\s\S]*?written[\s\S]*?try\s*\{\s*if\s*\(oldSnap\[k\]\s*===\s*undefined\)/.test(appJs);
    record('restoreBackup has snapshot/rollback logic',
      restoreBackupHasRollback,
      'restoreBackup contains "oldSnap ... written ... try { if (oldSnap[k] === undefined)"');

    // ===================================================
    // Round 3 Agent Finding #7: importTemplates rollback
    // ===================================================
    console.log('\n--- Round3 #7 importTemplates rollback ---');
    const importTemplatesHasRollback = /function importTemplates[\s\S]*?oldSnap[\s\S]*?targetKeys[\s\S]*?written[\s\S]*?if\s*\(oldSnap\[k\]\s*===\s*undefined\)/.test(appJs);
    record('importTemplates has snapshot/rollback logic',
      importTemplatesHasRollback,
      'importTemplates contains "oldSnap ... targetKeys ... written ... if (oldSnap[k] === undefined)"');

    // ===================================================
    // a11y #2: aria-live on toast container
    // ===================================================
    console.log('\n--- a11y #2 aria-live on toast container ---');
    // 先触发一个 toast 让容器创建出来
    await page.evaluate(() => { if (typeof _i18nToast === 'function') _i18nToast('toast_savedShort', 'success', 1000); });
    await new Promise(r => setTimeout(r, 200));
    const toastAria = await page.evaluate(() => {
      const c = document.getElementById('toast-container');
      if (!c) return { ok: false, error: 'no container' };
      return {
        role: c.getAttribute('role'),
        ariaLive: c.getAttribute('aria-live'),
        ariaAtomic: c.getAttribute('aria-atomic'),
      };
    });
    record('#toast-container has role=status',
      toastAria.role === 'status',
      `role="${toastAria.role}"`);
    record('#toast-container has aria-live=polite',
      toastAria.ariaLive === 'polite',
      `aria-live="${toastAria.ariaLive}"`);
    record('#toast-container has aria-atomic=false',
      toastAria.ariaAtomic === 'false',
      `aria-atomic="${toastAria.ariaAtomic}"`);

    // ===================================================
    // a11y #1: tab role semantics
    // ===================================================
    console.log('\n--- a11y #1 tab role semantics ---');
    const tabAria = await page.evaluate(() => {
      const topTabs = document.querySelector('.tabs');
      const subTabs = document.querySelector('.subtabs');
      const firstTab = document.querySelector('.tab.active');
      const firstPanel = document.getElementById('page-stats');
      return {
        topRole: topTabs ? topTabs.getAttribute('role') : null,
        subRole: subTabs ? subTabs.getAttribute('role') : null,
        firstTabRole: firstTab ? firstTab.getAttribute('role') : null,
        firstTabSelected: firstTab ? firstTab.getAttribute('aria-selected') : null,
        firstPanelRole: firstPanel ? firstPanel.getAttribute('role') : null,
      };
    });
    record('.tabs container has role=tablist',
      tabAria.topRole === 'tablist',
      `role="${tabAria.topRole}"`);
    record('.subtabs container has role=tablist',
      tabAria.subRole === 'tablist',
      `role="${tabAria.subRole}"`);
    record('.tab.active has role=tab',
      tabAria.firstTabRole === 'tab',
      `role="${tabAria.firstTabRole}"`);
    record('.tab.active has aria-selected=true',
      tabAria.firstTabSelected === 'true',
      `aria-selected="${tabAria.firstTabSelected}"`);
    record('.page panel has role=tabpanel',
      tabAria.firstPanelRole === 'tabpanel',
      `role="${tabAria.firstPanelRole}"`);

    // 测试切换 tab 时 aria-selected 同步
    const ariaSync = await page.evaluate(async () => {
      try {
        if (typeof switchTab !== 'function') return { ok: false, error: 'no switchTab' };
        switchTab('calc');
        await new Promise(r => setTimeout(r, 100));
        const calcTab = document.querySelectorAll('.tab')[3];
        const statsTab = document.querySelectorAll('.tab')[0];
        return {
          calcSelected: calcTab ? calcTab.getAttribute('aria-selected') : null,
          statsSelected: statsTab ? statsTab.getAttribute('aria-selected') : null,
        };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('switchTab syncs aria-selected (calc=true, stats=false)',
      ariaSync.calcSelected === 'true' && ariaSync.statsSelected === 'false',
      `calc=${ariaSync.calcSelected} stats=${ariaSync.statsSelected}`);
    // 切回 stats
    await page.evaluate(() => switchTab('stats'));
    await new Promise(r => setTimeout(r, 100));

    // ===================================================
    // a11y #3: welcome modal focus trap
    // ===================================================
    console.log('\n--- a11y #3 welcome modal focus trap ---');
    const welcomeTrap = await page.evaluate(async () => {
      try {
        // 强制显示 welcome modal
        const ov = document.getElementById('welcome-overlay');
        if (!ov) return { ok: false, error: 'no welcome-overlay element' };
        // 模拟 _openOverlayWithFocusTrap（直接调用）
        if (typeof window._openOverlayWithFocusTrap === 'function') {
          window._openOverlayWithFocusTrap('welcome-overlay', '[role="dialog"]', () => {});
        }
        await new Promise(r => setTimeout(r, 100));
        // 检查 _focusTrapCleanup 已设置
        const hasCleanup = typeof ov._focusTrapCleanup === 'function';
        // 检查 Escape 关闭
        if (hasCleanup) {
          const esc = new KeyboardEvent('keydown', { key: 'Escape' });
          ov.dispatchEvent(esc);
        }
        return { ok: true, hasCleanup };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('welcome-overlay gets _focusTrapCleanup from _openOverlayWithFocusTrap',
      welcomeTrap.hasCleanup,
      `hasCleanup=${welcomeTrap.hasCleanup}`);

    // closeWelcome 调用 _focusTrapCleanup
    const closeWelcomeHasCleanup = /function closeWelcome[\s\S]*?_focusTrapCleanup/.test(appJs);
    record('closeWelcome cleans up focus trap',
      closeWelcomeHasCleanup,
      'closeWelcome contains "_focusTrapCleanup"');

    // ===================================================
    // a11y #4: label/input for= association
    // ===================================================
    console.log('\n--- a11y #4 label/input for= association ---');
    // 检查 55 个 label/input 配对
    const labelCheck = await page.evaluate(() => {
      let missing = 0, total = 0;
      const labels = document.querySelectorAll('label[for]');
      labels.forEach(l => {
        const id = l.getAttribute('for');
        const target = document.getElementById(id);
        if (target && target.tagName === 'INPUT') total++;
      });
      // 检查所有有 id 的 input 是否都有 label[for=id] / nested label / aria-label
      const inputs = document.querySelectorAll('input[id]:not([type="hidden"])');
      inputs.forEach(i => {
        const lbl = document.querySelector(`label[for="${i.id}"]`);
        const parentLabel = i.closest('label');
        const hasAria = i.hasAttribute('aria-label') && i.getAttribute('aria-label').trim();
        if (!lbl && !parentLabel && !hasAria) missing++;
      });
      return { total, missing, inputCount: inputs.length };
    });
    record('All input[id] have associated label (for= or nested)',
      labelCheck.missing === 0,
      `missing=${labelCheck.missing}/${labelCheck.inputCount} total labels=${labelCheck.total}`);

    await cleanup();

  } catch (e) {
    console.log(`  [FAIL] EXCEPTION: ${e.message}`);
    console.log(e.stack);
    fail_count++;
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n' + '='.repeat(70));
  console.log(`PASS: ${pass_count}/${pass_count + fail_count}`);
  console.log('='.repeat(70));
  process.exit(fail_count === 0 ? 0 : 1);
}

main();