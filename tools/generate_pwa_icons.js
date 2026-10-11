#!/usr/bin/env node
// v54.323 新增：为 TWA / Android 生成 PNG 图标
//
// 背景：TWA（Trusted Web Activity）和 Android 安装要求 PNG 图标，
// 当前 manifest.json 只有 SVG data URL（浏览器 PWA 支持，但 Android 打包不支持）。
//
// 本脚本用 puppeteer 渲染 SVG → PNG，输出到 icons/ 目录：
//   - icon-192.png          192x192  any
//   - icon-512.png          512x512  any
//   - icon-maskable-512.png 512x512  maskable（带 20% safe zone 内缩）
//   - icon-1024.png         1024x1024  高分辨率（Play Store / iOS）
//
// 用法：node tools/generate_pwa_icons.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'icons');

const BRAND = '#2563eb';       // --primary（与 manifest theme_color 一致）
const BG = '#2563eb';
const GLYPH = 'Σ';

// 生成一个 SVG 字符串（rx = 圆角，scale = 字形缩放，maskable 时内缩）
function makeSvg(size, { radius = 0.166, glyphScale = 0.5, inset = 0 } = {}) {
  const rx = Math.round(size * radius);
  const inner = size * (1 - inset * 2);
  const fontSize = Math.round(inner * glyphScale);
  const cx = size / 2;
  const cy = size / 2 + fontSize * 0.35; // 视觉居中（基线补偿）
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect fill="${BG}" width="${size}" height="${size}" rx="${rx}"/>
  <text x="${cx}" y="${cy}" font-size="${fontSize}" text-anchor="middle"
        fill="white" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
        font-weight="600">${GLYPH}</text>
</svg>`;
}

async function renderPng(page, svg, size, outPath) {
  const html = `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; }
    html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
    svg { display: block; }
  </style></head><body>${svg}</body></html>`;
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: outPath, omitBackground: true, type: 'png' });
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + path.join(require('os').tmpdir(), 'pwa_icons_' + Date.now())]
  });
  const page = await browser.newPage();

  const jobs = [
    { file: 'icon-192.png',          size: 192,  opts: {} },
    { file: 'icon-512.png',          size: 512,  opts: {} },
    { file: 'icon-1024.png',         size: 1024, opts: {} },
    // maskable：Android 会裁切圆形/方形，内容需在中心 80% 安全区内
    { file: 'icon-maskable-512.png', size: 512,  opts: { inset: 0.1, radius: 0 } },
  ];

  for (const job of jobs) {
    const svg = makeSvg(job.size, job.opts);
    const outPath = path.join(OUT_DIR, job.file);
    await renderPng(page, svg, job.size, outPath);
    const bytes = fs.statSync(outPath).size;
    console.log(`  [OK] ${job.file} (${job.size}x${job.size}, ${bytes} bytes)`);
  }

  await browser.close();
  console.log(`\n图标已生成到：${OUT_DIR}`);
  console.log('下一步：运行 `node tools/update_manifest_icons.js` 把 PNG 图标写入 manifest.json');
})().catch(e => { console.error(e); process.exit(1); });
