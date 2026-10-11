#!/usr/bin/env node
// -*- mode: javascript -*-
/**
 * apply_codemod_isfinite.js — jscodeshift codemod（v54.248 同源 bug 防御）
 *
 * 目的：把 `!isNaN(x)` 一律改成 `!Number.isFinite(x)`，避免 v54.248 / v54.271 / v54.273 / v54.274
 *        同源 4 次 boolean 反转 bug（regex 替换丢 !）。
 *
 * 用法：
 *   node tools/apply_codemod_isfinite.js <file.js> [--dry] [--print]
 *
 *   --dry    : dry-run only (默认)
 *   --print  : 输出修改后文件内容
 *
 * 安全流程（参照 v54.272 教训）：
 *   1. cp app.js _backups/pre_codemod_<timestamp>/
 *   2. node tools/apply_codemod_isfinite.js app.js --dry --print   # 看 diff
 *   3. node tools/apply_codemod_isfinite.js app.js --print          # 应用
 *   4. python tests/run_all_tests.py                                 # 验证 52/58+ PASS
 *   5. 跑 3 次连续 EXIT=0 才算稳定（v54.283 教训）
 *
 * 注：app.js v54.283 时代已统一到 Number.isFinite，0 处 isNaN 残留。本工具主要作为
 *     "未来 Edit 时引入 isNaN 时立即被拦截"的防御层。
 */
const fs = require("fs");
const path = require("path");

// 简单 codemod：基于 regex 而非 AST（避免依赖 jscodeshift 安装）
// 因为目标是单一模式：!isNaN(x) → !Number.isFinite(x)
// regex 匹配：!isNaN(<args>)  →  !Number.isFinite(<args>)

function applyCodemod(content) {
  // 模式 1: !isNaN(x) → !Number.isFinite(x)
  // 容忍空格：! isNaN ( x ) 也匹配
  let changed = 0;
  let result = content.replace(
    /!\s*isNaN\s*\(/g,
    () => {
      changed++;
      return "!Number.isFinite(";
    }
  );
  // 模式 2: !Number.isNaN(x) → !Number.isFinite(x) （如果误用了 Number.isNaN）
  result = result.replace(
    /!\s*Number\s*\.\s*isNaN\s*\(/g,
    () => {
      changed++;
      return "!Number.isFinite(";
    }
  );
  return { result, changed };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node tools/apply_codemod_isfinite.js <file.js> [--dry] [--print]");
    process.exit(1);
  }
  const file = args[0];
  const dry = args.includes("--dry");
  const print = args.includes("--print");

  if (!fs.existsSync(file)) {
    console.error(`[codemod] file not found: ${file}`);
    process.exit(1);
  }
  const content = fs.readFileSync(file, "utf8");
  const { result, changed } = applyCodemod(content);

  if (changed === 0) {
    console.log(`[codemod] no changes needed (0 处 !isNaN 残留)`);
    process.exit(0);
  }

  if (dry) {
    console.log(`[codemod] DRY-RUN: ${changed} 处替换（未写入）`);
    process.exit(0);
  }

  fs.writeFileSync(file, result, "utf8");
  console.log(`[codemod] applied ${changed} replacements to ${file}`);
  if (print) {
    // 打印前 5 处替换上下文
    const lines = result.split("\n");
    const beforeLines = content.split("\n");
    let shown = 0;
    for (let i = 0; i < lines.length && shown < 5; i++) {
      if (lines[i] !== beforeLines[i]) {
        console.log(`--- line ${i + 1} ---`);
        console.log(`  before: ${beforeLines[i].trim()}`);
        console.log(`  after:  ${lines[i].trim()}`);
        shown++;
      }
    }
  }
  process.exit(0);
}

main();