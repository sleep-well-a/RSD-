// v54.220 e2e_puppeteer_calc.js: 计算功能测试 - 验证 RSD/含量/回收率真实计算
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.220 e2e_puppeteer_calc.js');
  console.log('计算功能测试 (RSD/含量/回收率) - 真实计算验证');
  console.log('='.repeat(70));

  let browser;
  let pass_count = 0;
  let fail_count = 0;

  function record(name, ok, detail = '') {
    const status = ok ? '✓' : '✗';
    const line = detail ? `  [${status}] ${name} — ${detail}` : `  [${status}] ${name}`;
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

    // === Test 1: 真实计算函数存在性 ===
    console.log('\n--- 真实计算函数存在性 ---');
    const calcFns = await page.evaluate(() => {
      const fns = [
        'calcStats',         // 主统计函数
        'calcStatsFromArray', // 纯函数统计
        'calcExpr',          // 表达式求值
        'calcNormalize',     // 归一化
        'calcExternal',      // 外标法
        'calcInternal',      // 内标法
        'calcSimple',        // 简单回收
        'calcSpike',         // 加样回收
        'calcCurve',         // 曲线法
        'calcMw',            // 分子量
        'calcUniformity',    // 含量均匀度
        'calcDissolution',   // 溶出度
        'stdF',              // 标准差/变异系数
      ];
      const result = {};
      for (const f of fns) {
        result[f] = typeof window[f] === 'function';
      }
      return result;
    });
    for (const [fn, exists] of Object.entries(calcFns)) {
      record(`window.${fn} 存在`, exists);
    }

    // === Test 2: calcStatsFromArray 数学正确性 ===
    console.log('\n--- calcStatsFromArray 数学正确性 ---');
    // 测试数据 [100, 102, 98, 101, 99]
    // mean = 100, sd = sqrt(10/(5-1)) = sqrt(2.5) ≈ 1.5811
    // RSD = 1.5811%
    const rsdMathTest = await page.evaluate(() => {
      if (typeof calcStatsFromArray !== 'function') return { found: false };
      const r = calcStatsFromArray([100, 102, 98, 101, 99]);
      return {
        found: true,
        n: r.n,
        mean: r.mean,
        sd: r.sd,
        rsd: r.rsd,
      };
    });
    record('calcStatsFromArray 可调用', rsdMathTest.found);
    record('n = 5', rsdMathTest.n === 5, `n=${rsdMathTest.n}`);
    record('mean = 100', rsdMathTest.mean === 100, `mean=${rsdMathTest.mean}`);
    record('sd ≈ 1.5811', Math.abs(rsdMathTest.sd - 1.5811) < 0.001, `sd=${rsdMathTest.sd}`);
    record('RSD ≈ 1.5811%', Math.abs(rsdMathTest.rsd - 1.5811) < 0.001, `RSD=${rsdMathTest.rsd}%`);

    // === Test 3: 边界情况 ===
    console.log('\n--- calcStatsFromArray 边界 ---');
    const edgeTests = await page.evaluate(() => {
      const tests = [];
      // 空数组
      const r1 = calcStatsFromArray([]);
      tests.push({ name: '空数组', ok: r1.n === 0 && r1.rsd === null });
      // 单元素
      const r2 = calcStatsFromArray([42]);
      tests.push({ name: '单元素', ok: r2.n === 1 && r2.mean === 42 && r2.rsd === null });
      // 两元素 [8,12]: mean=10, sd=sqrt((4+4)/(2-1))=sqrt(8)=2.828, RSD=28.28%
      const r3 = calcStatsFromArray([8, 12]);
      tests.push({ name: '两元素 [8,12] sd=√8', ok: Math.abs(r3.sd - Math.sqrt(8)) < 0.001,
        sd: r3.sd });
      // 全部相同 (rsd=0)
      const r4 = calcStatsFromArray([5, 5, 5, 5]);
      tests.push({ name: '全相同', ok: r4.rsd === 0 });
      // 9 元素 (sample std ≈ 3.0277)
      const r5 = calcStatsFromArray([2, 4, 4, 4, 5, 5, 7, 9]);
      tests.push({ name: '8元素 sd≈2.138', ok: Math.abs(r5.sd - 2.138) < 0.01, sd: r5.sd });
      return tests;
    });
    for (const t of edgeTests) {
      record(`边界 ${t.name}`, t.ok, t.sd !== undefined ? `sd=${t.sd}` : '');
    }

    // === Test 4: calcStats 集成函数（更新 DOM）===
    console.log('\n--- calcStats 集成 ---');
    await page.evaluate(() => switchTab('stats'));
    await new Promise(r => setTimeout(r, 300));

    const statsIntegTest = await page.evaluate(() => {
      // 找数据输入框并填入测试数据
      const rows = document.querySelectorAll('#data-rows input');
      if (rows.length === 0) {
        // 尝试更宽泛的查找
        const allRows = document.querySelectorAll('input[inputmode="decimal"]');
        if (allRows.length === 0) return { found: false, msg: 'no #data-rows input' };
        // 用所有 decimal input
        const testData = ['100', '102', '98', '101', '99'];
        for (let i = 0; i < Math.min(allRows.length, testData.length); i++) {
          allRows[i].value = testData[i];
          allRows[i].dispatchEvent(new Event('input', { bubbles: true }));
        }
        try {
          calcStats();
          return {
            found: true,
            used: 'decimal-inputs',
            n: document.getElementById('res-n')?.textContent,
            mean: document.getElementById('res-mean')?.textContent,
            sd: document.getElementById('res-sd')?.textContent,
            rsd: document.getElementById('res-rsd')?.textContent,
          };
        } catch (e) { return { found: true, error: e.message }; }
      }
      // 填入 5 个测试值
      const testData = ['100', '102', '98', '101', '99'];
      for (let i = 0; i < Math.min(rows.length, testData.length); i++) {
        rows[i].value = testData[i];
        rows[i].dispatchEvent(new Event('input', { bubbles: true }));
      }
      // 调用 calcStats
      try {
        calcStats();
        return {
          found: true,
          n: document.getElementById('res-n')?.textContent,
          mean: document.getElementById('res-mean')?.textContent,
          sd: document.getElementById('res-sd')?.textContent,
          rsd: document.getElementById('res-rsd')?.textContent,
        };
      } catch (e) {
        return { found: true, error: e.message };
      }
    });
    record('calcStats 集成执行', statsIntegTest.found && !statsIntegTest.error,
      JSON.stringify(statsIntegTest).slice(0, 120));

    // === Test 5: Mobile 归一化法 ===
    console.log('\n--- Mobile 归一化法 ---');
    await page.evaluate(() => switchTab('mobile'));
    await new Promise(r => setTimeout(r, 200));

    const mobileBtnTest = await page.evaluate(() => {
      // 找 mobile 页面的计算触发方式：
      // mobile 页面用 autoCalc() 实时计算 + calcNormalize 等具体函数
      const page = document.getElementById('page-mobile');
      if (!page) return { total: 0, realTimeInputs: 0 };

      const inputs = [...page.querySelectorAll('input[oninput]')];
      const calcInputs = inputs.filter(i => /calc/i.test(i.getAttribute('oninput') || ''));
      const buttons = [...page.querySelectorAll('button')];

      return {
        total: buttons.length,
        realTimeInputs: calcInputs.length,
        btnTexts: buttons.map(b => b.textContent.trim().slice(0, 15)).slice(0, 8),
        sampleOninputs: calcInputs.slice(0, 3).map(i => i.getAttribute('oninput').slice(0, 40)),
      };
    });
    record('mobile page 有按钮', mobileBtnTest.total > 0, `total=${mobileBtnTest.total}`);
    record('mobile page 有 calc* 实时计算输入', mobileBtnTest.realTimeInputs > 0,
      `count=${mobileBtnTest.realTimeInputs}, samples=${JSON.stringify(mobileBtnTest.sampleOninputs)}`);

    // === Test 6: Calc 页面计算器 1+2=3 ===
    console.log('\n--- Calc 计算器 1+2 ---');
    await page.evaluate(() => switchTab('calc'));
    await new Promise(r => setTimeout(r, 200));

    const calcTest = await page.evaluate(() => {
      const allBtns = [...document.querySelectorAll('#page-calc button')];
      const find = (regex) => allBtns.find(b => regex.test(b.textContent.trim()));
      const oneBtn = find(/^1$/);
      const plusBtn = find(/^\+$/);
      const twoBtn = find(/^2$/);
      const equalsBtn = find(/^=$|等于/);
      if (oneBtn && plusBtn && twoBtn && equalsBtn) {
        oneBtn.click(); plusBtn.click(); twoBtn.click(); equalsBtn.click();
        const display = document.querySelector('#page-calc .display, #page-calc input[type="text"], #page-calc #calc-display');
        return {
          ok: true,
          displayValue: display ? (display.value || display.textContent) : null,
        };
      }
      return { ok: false, msg: '未找到所需按钮' };
    });
    record('可模拟 1+2 计算', calcTest.ok && calcTest.displayValue === '3.00000',
      `display=${calcTest.displayValue}`);

    // === Test 7: Calc 表达式计算器 (calcExpr) ===
    console.log('\n--- calcExpr 表达式计算 ---');
    const exprTest = await page.evaluate(() => {
      if (typeof calcExpr !== 'function') return { found: false };
      try {
        const r1 = calcExpr('2+3*4');     // 应为 14
        const r2 = calcExpr('(10-2)/4');  // 应为 2
        const r3 = calcExpr('100');       // 应为 100
        return {
          found: true,
          r1: typeof r1 === 'object' ? r1.value : r1,
          r2: typeof r2 === 'object' ? r2.value : r2,
          r3: typeof r3 === 'object' ? r3.value : r3,
        };
      } catch (e) { return { found: true, error: e.message }; }
    });
    record('calcExpr 可调用', exprTest.found);
    record('calcExpr("2+3*4") = 14', exprTest.r1 === 14, `r1=${exprTest.r1}`);
    record('calcExpr("(10-2)/4") = 2', exprTest.r2 === 2, `r2=${exprTest.r2}`);
    record('calcExpr("100") = 100', exprTest.r3 === 100, `r3=${exprTest.r3}`);

    // === Test 8: Recovery method 切换可见性 ===
    console.log('\n--- Recovery method 切换 ---');
    await page.evaluate(() => switchTab('recovery'));
    await new Promise(r => setTimeout(r, 200));

    const recoveryMethods = await page.evaluate(() => {
      const methods = ['normalize', 'external', 'internal', 'simple'];
      const summary = { methodSwitchOk: true, perMethod: {}, allHaveContainer: true };
      for (const m of methods) {
        try {
          switchRecovery(m);
          // 检查切换后整个页面的状态：只有当前 method inline=block
          const states = {};
          let inlineBlockCount = 0;
          for (const mm of methods) {
            const el = document.getElementById('rec-' + mm);
            if (!el) { summary.allHaveContainer = false; continue; }
            const inline = el.style.display;
            states[mm] = inline;
            if (inline === 'block') inlineBlockCount++;
          }
          summary.perMethod[m] = { states, inlineBlockCount };
          if (inlineBlockCount !== 1) summary.methodSwitchOk = false;
        } catch (e) { summary.perMethod[m] = { error: e.message }; summary.methodSwitchOk = false; }
      }
      return summary;
    });
    record('recovery 4 种 method 容器都存在', recoveryMethods.allHaveContainer);
    let allOk = recoveryMethods.methodSwitchOk;
    record('recovery 每次切换后仅 1 个 method inline block', allOk,
      JSON.stringify(recoveryMethods.perMethod).slice(0, 200));

    // === Test 9: Special method 切换可见性 ===
    console.log('\n--- Special method 切换 ---');
    await page.evaluate(() => switchTab('special'));
    await new Promise(r => setTimeout(r, 200));

    const specialMethods = await page.evaluate(() => {
      const methods = ['drying', 'content', 'residue', 'titer', 'mw', 'uniformity', 'dissolution', 'curve', 'spike'];
      const result = {};
      for (const m of methods) {
        try {
          switchSpecial(m);
          const el = document.getElementById('sp-' + m);
          result[m] = {
            exists: !!el,
            visible: el ? el.style.display !== 'none' : false,
            display: el ? el.style.display : 'missing',
          };
        } catch (e) { result[m] = { error: e.message }; }
      }
      return result;
    });
    const specialExists = Object.values(specialMethods).filter(v => v.exists).length;
    record('special 9 种 method 容器都存在', specialExists === 9,
      `count=${specialExists}/9`);

    // === Test 10: stdF 函数 (变异系数) ===
    console.log('\n--- stdF 函数 ---');
    const stdFTest = await page.evaluate(() => {
      if (typeof stdF !== 'function') return { found: false };
      try {
        const r = stdF([100, 102, 98, 101, 99]);
        return {
          found: true,
          hasResult: !!r,
          rsd: r?.rsd || r?.RSD,
          keys: r ? Object.keys(r) : [],
        };
      } catch (e) { return { found: true, error: e.message }; }
    });
    record('stdF 可调用', stdFTest.found);

  } catch (e) {
    console.log(`  [✗] EXCEPTION: ${e.message}`);
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