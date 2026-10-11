// v54.284 e2e_puppeteer_a11y.js — axe-core 集成测试（v54.265-282 a11y 教训防御层）
//
// 目的：用 axe-core 自动跑全 DOM a11y 检查，作为 v54.265-282 P1 a11y 修复的回归保障。
//        自动捕获：
//        - v54.256 aria-label 判据陷阱（'aria-label' in tag 误判 data-i18n-aria-label）
//        - icon-only 按钮无 accessible name（v54.265 修过 48+7 个）
//        - 213 个 input aria-label（v54.266 修过）
//        - 80 个 <th scope="col"> + 13 硬编码表头（v54.266/267 修过）
//        - 65 个 calc-key aria-label（v54.282 Round 38）
//        - WCAG AA color contrast（v54.272 contrast 已修）
//        - select/textarea a11y（v54.268 唯一 select 真问题）
//
// 用法：
//   # 默认：跑 axe-core full rules
//   node tests/e2e_puppeteer_a11y.js
//
//   # 仅特定规则（更快）
//   node tests/e2e_puppeteer_a11y.js --tags wcag2aa
//
//   # 跑多语言（zh + en）
//   node tests/e2e_puppeteer_a11y.js --langs zh,en
//
// 退出码：0 = 0 violations，1 = 有 violation
//
// 端口：8765（参照其他 e2e_puppeteer_*.js）

const puppeteer = require('puppeteer');
const axeCore = require('axe-core');
const fs = require('fs');
const path = require('path');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';
const ROOT = path.resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { tags: null, langs: ['zh'], output: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tags' && args[i + 1]) {
      opts.tags = args[i + 1].split(',');
      i++;
    } else if (args[i] === '--langs' && args[i + 1]) {
      opts.langs = args[i + 1].split(',');
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      opts.output = args[i + 1];
      i++;
    }
  }
  return opts;
}

async function runAxeOnPage(page, opts) {
  // 注入 axe-core 源码到 page
  await page.evaluate(axeCore.source);

  // 构造 axe.run options
  const axeOpts = {};
  if (opts.tags) axeOpts.runOnly = { type: 'tag', values: opts.tags };

  // 跑 axe
  return await page.evaluate((opts) => {
    /* eslint-disable no-undef */
    return axe.run(document, opts).then(results => results);
    /* eslint-enable no-undef */
  }, axeOpts);
}

async function main() {
  const opts = parseArgs();
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.284 e2e_puppeteer_a11y.js (axe-core)');
  console.log(`Tags: ${opts.tags || 'all'}, Langs: ${opts.langs.join(',')}`);
  console.log('='.repeat(70));

  const allResults = [];
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    for (const lang of opts.langs) {
      console.log(`\n--- ${lang} 模式 ---`);
      const page = await browser.newPage();
      await page.setCacheEnabled(false);

      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) {
        try {
          await page.goto(HTML_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
          ok = true;
        } catch (e) {
          console.log(`  [retry] goto 第 ${i + 1} 次失败: ${e.message}`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!ok) throw new Error('Page load failed 3 times');

      await page.waitForFunction('typeof i18n === "function"', { timeout: 10000 });
      await page.evaluate((l) => { if (typeof _setLang === 'function') _setLang(l); }, lang);
      await new Promise(r => setTimeout(r, 1500));

      try {
        const results = await runAxeOnPage(page, opts);
        const violations = results.violations || [];
        const incomplete = results.incomplete || [];
        console.log(`  Violations: ${violations.length}`);
        console.log(`  Incomplete: ${incomplete.length}`);
        // 按 rule id 汇总
        const byRule = {};
        for (const v of violations) {
          byRule[v.id] = byRule[v.id] || { count: 0, impact: v.impact, nodes: [] };
          byRule[v.id].count += v.nodes.length;
          byRule[v.id].nodes.push(...v.nodes.slice(0, 3).map(n => n.target.join(' ')));
        }
        for (const [rid, info] of Object.entries(byRule)) {
          console.log(`    [${info.impact || 'unknown'}] ${rid}: ${info.count} 处`);
          for (const t of info.nodes.slice(0, 3)) {
            console.log(`      - ${t}`);
          }
        }
        allResults.push({ lang, violations, incomplete });
      } catch (e) {
        console.log(`  [ERROR] axe.run failed: ${e.message}`);
        allResults.push({ lang, error: e.message });
      }

      await page.close();
    }
  } finally {
    if (browser) await browser.close();
  }

  // 汇总
  console.log('\n' + '='.repeat(70));
  console.log('Summary');
  console.log('='.repeat(70));
  let totalViolations = 0;
  for (const r of allResults) {
    if (r.error) {
      console.log(`  ${r.lang}: ERROR ${r.error}`);
      continue;
    }
    totalViolations += r.violations.length;
    console.log(`  ${r.lang}: ${r.violations.length} violations, ${r.incomplete.length} incomplete`);
  }
  console.log(`\nTotal violations: ${totalViolations}`);

  if (opts.output) {
    fs.writeFileSync(opts.output, JSON.stringify(allResults, null, 2));
    console.log(`Report written to ${opts.output}`);
  }

  process.exit(totalViolations > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});