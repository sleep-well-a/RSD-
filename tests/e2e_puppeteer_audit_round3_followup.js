// v54.231 e2e_puppeteer_audit_round3_followup.js
// 续修 Round 3 审计 MEDIUM/LOW 项:
//   3. Trend canvas aria-label (B#6)
//   3b. uni-verdict / spike-verdict aria-live (B#8)
//   4. Modal click-outside-to-close (B#5)
//   5. Mobile inline width overflow @media 480px (C#6 + C#8)
//   7. restoreBackup / factoryReset undo window (C#9)
//   8. CSS .input-error 重复规则清理 (C#10)
const puppeteer = require('puppeteer');
const fs = require('fs');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.231 e2e_puppeteer_audit_round3_followup.js');
  console.log('Round 3 MEDIUM/LOW follow-up (6 items)');
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
    await page.setViewport({ width: 480, height: 800 }); // 模拟移动端
    await page.goto(HTML_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
    await new Promise(r => setTimeout(r, 500));

    // ===================================================
    // 3. Trend canvas aria-label (B#6)
    // ===================================================
    console.log('\n--- #3 Trend canvas aria-label ---');
    const trendAria = await page.evaluate(() => {
      const c = document.getElementById('trend-canvas');
      if (!c) return { ok: false, error: 'no canvas' };
      return {
        role: c.getAttribute('role'),
        ariaLabel: c.getAttribute('aria-label'),
      };
    });
    record('trend-canvas has role=img',
      trendAria.role === 'img',
      `role="${trendAria.role}"`);
    record('trend-canvas has non-empty aria-label',
      trendAria.ariaLabel && trendAria.ariaLabel.length > 5,
      `aria-label="${trendAria.ariaLabel}"`);

    // ===================================================
    // 3b. Verdict divs have aria-live (B#8)
    // ===================================================
    console.log('\n--- #3b Verdict divs aria-live ---');
    const verdictAria = await page.evaluate(() => {
      const u = document.getElementById('uni-verdict');
      const s = document.getElementById('spike-verdict');
      return {
        uni: u ? u.getAttribute('aria-live') : null,
        spike: s ? s.getAttribute('aria-live') : null,
      };
    });
    record('uni-verdict has aria-live=polite',
      verdictAria.uni === 'polite',
      `aria-live="${verdictAria.uni}"`);
    record('spike-verdict has aria-live=polite',
      verdictAria.spike === 'polite',
      `aria-live="${verdictAria.spike}"`);

    // ===================================================
    // 4. Modal click-outside-to-close (B#5)
    // ===================================================
    console.log('\n--- #4 Modal click-outside-to-close ---');
    const appJs = fs.readFileSync('F:\\自制软件\\app.js', 'utf8');
    // v54.258 split: toast/dialog 移到 helpers-toast.js — _openOverlayWithFocusTrap 在那里
    const helpersToast = fs.readFileSync('F:\\自制软件\\helpers-toast.js', 'utf8');
    const helperHasBackdrop = /function _openOverlayWithFocusTrap[\s\S]*?onBackdropClick[\s\S]*?e\.target\s*===\s*ov/.test(helpersToast);
    record('_openOverlayWithFocusTrap has click-outside handler',
      helperHasBackdrop,
      'helper contains onBackdropClick with e.target === ov');

    const cleanupRemovesBackdrop = /ov\._focusTrapCleanup\s*=\s*\(\)\s*=>\s*\{[\s\S]*?removeEventListener\('mousedown',\s*onBackdropClick\)/.test(helpersToast);
    record('cleanup removes mousedown listener',
      cleanupRemovesBackdrop,
      'cleanup contains removeEventListener("mousedown", onBackdropClick)');

    // 实际测试：用 migration-overlay（HTML 真实存在的 overlay）+ Puppeteer 真实点击
    // 不用 welcome-overlay（因为它在 app.js 里 showWelcomeIfFirstRun 才动态创建，行为复杂）
    const ovBox = await page.evaluate(() => {
      const ov = document.getElementById('migration-overlay');
      if (!ov) return null;
      const r = ov.getBoundingClientRect();
      return { x: Math.max(1, r.left + 2), y: Math.max(1, r.top + 2), w: r.width, h: r.height };
    });
    let clickOutsideResult = { called: false };
    if (ovBox) {
      const setupOk = await page.evaluate(() => {
        try {
          const ov = document.getElementById('migration-overlay');
          window._testCloseCalled = false;
          window._testCloseFn = () => { window._testCloseCalled = true; };
          if (typeof window._openOverlayWithFocusTrap === 'function') {
            window._openOverlayWithFocusTrap('migration-overlay', '#migration-dialog', window._testCloseFn);
            return true;
          }
          return false;
        } catch (e) { window._testSetupErr = e.message; return false; }
      });
      await new Promise(r => setTimeout(r, 200));
      try {
        // 真实点击 overlay 左上角（远离 dialog 中心）
        await page.mouse.click(ovBox.x, ovBox.y);
        await new Promise(r => setTimeout(r, 300));
        clickOutsideResult = await page.evaluate(() => ({
          called: !!window._testCloseCalled,
          ovDisplay: document.getElementById('migration-overlay').style.display,
        }));
      } catch (e) {
        clickOutsideResult = { called: false, error: e.message };
      }
    }
    record('click on overlay backdrop closes modal',
      clickOutsideResult.called === true,
      `closeFn called=${clickOutsideResult.called} ovDisplay=${clickOutsideResult.ovDisplay} box=${JSON.stringify(ovBox)}`);

    // ===================================================
    // 5. Mobile inline width overflow @media 480px (C#6 + C#8)
    // ===================================================
    console.log('\n--- #5 Mobile @media 480px ---');
    const css = fs.readFileSync('F:\\自制软件\\styles.css', 'utf8');
    const has480Media = /@media \(max-width:\s*480px\)/.test(css);
    record('@media (max-width: 480px) exists',
      has480Media,
      'CSS contains @media (max-width: 480px)');

    const overridesSampleId = /#current-sample-id[^}]*width:\s*100%/.test(css);
    record('@media 480px overrides #current-sample-id width',
      overridesSampleId,
      '@media contains "#current-sample-id ... width: 100%"');

    const overridesSpikeLimit = /#spike-limit-low[^}]*width:\s*50px/.test(css);
    record('@media 480px overrides spike limit width',
      overridesSpikeLimit,
      '@media contains "#spike-limit-low ... width: 50px"');

    // 实际 viewport=480 测试布局（current-sample-id 在 history 页）
    await page.setViewport({ width: 480, height: 800 });
    // 等渲染稳定
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
    await new Promise(r => setTimeout(r, 800));
    // 注入 sample id 值确保 input 有 layout
    const hasElements = await page.evaluate(() => {
      const el = document.getElementById('current-sample-id');
      const batch = document.getElementById('current-batch');
      const card = document.getElementById('current-sample-card');
      if (el) el.value = 'TEST';
      if (batch) batch.value = 'B001';
      return {
        hasEl: !!el,
        hasBatch: !!batch,
        hasCard: !!card,
        cardDisplay: card ? getComputedStyle(card).display : null,
      };
    });
    await new Promise(r => setTimeout(r, 100));
    const overflowCheck = await page.evaluate(() => {
      const histPage = document.getElementById('page-history');
      const sampleId = document.getElementById('current-sample-id');
      const histDisplay = histPage ? getComputedStyle(histPage).display : null;
      const cardBox = sampleId ? sampleId.closest('.card').getBoundingClientRect() : null;
      const inputBox = sampleId ? sampleId.getBoundingClientRect() : null;
      const docW = document.documentElement.scrollWidth;
      return {
        ok: true,
        cardW: cardBox ? cardBox.width : null,
        inputW: inputBox ? inputBox.width : null,
        docW: docW,
        viewport: window.innerWidth,
        histDisplay,
        hasOverflow: docW > window.innerWidth + 2,
      };
    });
    record('At 480px viewport, history page visible',
      overflowCheck.histDisplay === 'block',
      `histDisplay=${overflowCheck.histDisplay} hasElements=${JSON.stringify(hasElements)}`);
    record('At 480px viewport, no horizontal overflow',
      overflowCheck.ok && !overflowCheck.hasOverflow && overflowCheck.inputW !== null,
      `docW=${overflowCheck.docW} viewport=${overflowCheck.viewport} cardW=${overflowCheck.cardW}`);
    record('At 480px viewport, sample-id input width is constrained (was 160px inline)',
      overflowCheck.ok && overflowCheck.inputW !== null && overflowCheck.inputW <= 220,
      `inputW=${overflowCheck.inputW} (CSS override sets 100% max-width:200px)`);

    // ===================================================
    // 7. restoreBackup undo window (C#9)
    // ===================================================
    console.log('\n--- #7 restoreBackup / factoryReset undo ---');
    const restoreHasUndo = /function _showRestoreUndoToast[\s\S]*?_undoLastRestore\(\)/.test(appJs);
    record('_showRestoreUndoToast + _undoLastRestore functions exist',
      restoreHasUndo,
      'app.js contains _showRestoreUndoToast + _undoLastRestore');

    const restoreStoresUndo = /localStorage\.setItem\('rsd-last-restore-undo'/.test(appJs);
    record('restoreBackup stores rsd-last-restore-undo',
      restoreStoresUndo,
      'app.js stores rsd-last-restore-undo after success');

    const factoryHasUndo = /function _showFactoryResetUndoToast[\s\S]*?_factoryResetUndone\s*=\s*true/.test(appJs);
    record('factoryReset has undo flow',
      factoryHasUndo,
      'app.js contains _showFactoryResetUndoToast + undo flag');

    const factoryChecksFlag = /window\._factoryResetUndone/.test(appJs);
    record('factoryReset setTimeout checks undo flag',
      factoryChecksFlag,
      'app.js contains "window._factoryResetUndone" check before reload');

    // i18n keys
    // v54.247 split: aggregate from all 4 i18n files
    const i18nData = ['i18n-zh.js', 'i18n-en.js', 'i18n-alert.js', 'i18n-data.js']
      .map(f => fs.readFileSync('F:\\自制软件\\' + f, 'utf8'))
      .join('\n');
    record('toast_restoreUndone exists in zh',
      /toast_restoreUndone:\s*'[^']*撤销/.test(i18nData),
      'i18n has "toast_restoreUndone: \'✓ 已撤销');
    record('toast_restoreUndone exists in en',
      /toast_restoreUndone:\s*'[^']*undone/.test(i18nData),
      'i18n has "toast_restoreUndone: \'✓ Last restore undone');
    record('toast_factoryResetUndone exists in zh',
      /toast_factoryResetUndone:\s*'[^']*撤销恢复出厂/.test(i18nData),
      'i18n has "toast_factoryResetUndone: \'✓ 已撤销恢复出厂');
    record('undoExpired exists in zh',
      /undoExpired:\s*'[^']*撤销已过期/.test(i18nData),
      'i18n has "undoExpired: \'撤销已过期');

    // 实际测试 _showRestoreUndoToast
    const undoTest = await page.evaluate(async () => {
      try {
        // 模拟一次"恢复"，先写入 rsd-last-restore-undo
        const snap = { 'rsd-calc-history': '[]', 'rsd-theme': '"light"' };
        localStorage.setItem('rsd-last-restore-undo', JSON.stringify({
          time: Date.now(),
          oldSnap: snap,
          restoredKeys: ['rsd-calc-history'],
        }));
        // 调用 undo
        if (typeof window._undoLastRestore !== 'function') return { ok: false, error: 'no _undoLastRestore' };
        window._undoLastRestore();
        await new Promise(r => setTimeout(r, 200));
        // 验证 rsd-last-restore-undo 已被清除
        const after = localStorage.getItem('rsd-last-restore-undo');
        return { ok: true, cleared: after === null, calcHistory: localStorage.getItem('rsd-calc-history') };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('_undoLastRestore() executes and clears rsd-last-restore-undo',
      undoTest.ok && undoTest.cleared === true,
      `cleared=${undoTest.cleared} calcHistory=${undoTest.calcHistory}`);

    // 测试 _showRestoreUndoToast 实际创建 toast
    const toastCreateTest = await page.evaluate(async () => {
      try {
        if (typeof window._showRestoreUndoToast !== 'function') return { ok: false, error: 'no helper' };
        // 先确保 container 存在
        if (typeof window._getToastContainer === 'function') window._getToastContainer();
        // 清除已有 toast
        const c = document.getElementById('toast-container');
        if (c) c.innerHTML = '';
        window._showRestoreUndoToast(5);
        await new Promise(r => setTimeout(r, 100));
        const c2 = document.getElementById('toast-container');
        return { ok: true, hasToast: c2 && c2.children.length > 0, text: c2 ? c2.textContent : '' };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('_showRestoreUndoToast() creates visible toast',
      toastCreateTest.ok && toastCreateTest.hasToast,
      `hasToast=${toastCreateTest.hasToast} text="${toastCreateTest.text.slice(0, 80)}"`);

    // ===================================================
    // 8. CSS .input-error dedup (C#10)
    // ===================================================
    console.log('\n--- #8 CSS .input-error dedup ---');
    // 计算 .input-error 出现次数
    const inputErrorCount = (css.match(/\.input-error\s*\{/g) || []).length;
    record('.input-error defined only once',
      inputErrorCount === 1,
      `count=${inputErrorCount} (was 2 before dedup)`);

    // 验证保留的是 CSS-variable 版本（var(--danger) + #fff5f5）
    const hasVarDanger = /\.input-error\s*\{[^}]*var\(--danger\)/.test(css);
    record('.input-error uses CSS variable --danger',
      hasVarDanger,
      '.input-error uses var(--danger) not hex');

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
