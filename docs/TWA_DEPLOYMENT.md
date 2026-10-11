# RSD & 含量计算器 — 移动端原生 App 打包指南（TWA / Capacitor）

> 本文档说明如何把本项目（PWA）打包为可在 Android / iOS 安装的原生 App。
> 生成时间：2026-10-11（v54.323）

## 目录

1. [现状与前置条件](#现状与前置条件)
2. [方案对比](#方案对比)
3. [路径 A：PWABuilder（推荐，无需本地工具链）](#路径-apwabuilder)
4. [路径 B：Bubblewrap（本地构建，需 JDK + Android SDK）](#路径-bbubblewrap)
5. [路径 C：Capacitor（跨平台，需 Android Studio / Xcode）](#路径-ccapacitor)
6. [Digital Asset Links 配置](#digital-asset-links-配置)
7. [发布到应用商店](#发布到应用商店)
8. [本项目已完成的准备工作](#本项目已完成的准备工作)

---

## 现状与前置条件

### 项目类型
- **纯静态 PWA**：单个 HTML（含内联 JS/CSS）+ external .js 开发版
- **依赖 CDN**：Chart.js / xlsx / html2pdf（已在 service-worker 预缓存）
- **无后端**：数据存 localStorage（可选 Supabase 云同步）

### 两个硬前置条件

| # | 条件 | 现状 | 说明 |
|---|---|---|---|
| 1 | **HTTPS 公开域名** | ❌ 未部署 | TWA 必须通过 HTTPS 验证域名所有权（Digital Asset Links）；PWA 也需 HTTPS 才能注册 SW |
| 2 | **PNG 图标** | ✅ 已完成（v54.323）| `icons/icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`icon-1024.png` |

**关键**：在打包前，必须先完成 PWA 的 HTTPS 部署（见下方"部署选项"）。

### 部署选项（必须先完成）

| 服务 | 成本 | HTTPS | 自定义域名 | 难度 |
|---|---|---|---|---|
| **GitHub Pages** | 免费 | ✅ | ✅ | 低 |
| **Cloudflare Pages** | 免费 | ✅ | ✅ | 低 |
| **Vercel / Netlify** | 免费 | ✅ | ✅ | 低 |
| **自建服务器** | 服务器成本 | 需配证书 | ✅ | 中 |

推荐 **GitHub Pages** 或 **Cloudflare Pages**（免费、自动 HTTPS、支持自定义域名）。

---

## 方案对比

| 维度 | PWABuilder | Bubblewrap | Capacitor |
|---|---|---|---|
| 平台 | Android + iOS | Android only | Android + iOS |
| 本地工具链 | ❌ 不需要 | 需 JDK + Android SDK | 需 Android Studio / Xcode |
| 操作方式 | 网页上传 URL | 命令行 | 命令行 + 原生 IDE |
| 输出 | APK/AAB + Xcode 项目 | APK/AAB | APK/AAB + .ipa |
| 原生 API | 受限（TWA 沙箱）| 受限 | 完全访问 |
| 适合场景 | **纯 Web 应用** | 纯 Web 应用 | 需要原生功能 |

**本项目的推荐**：
- **纯 Web 计算器** → **PWABuilder**（最快，云端一键生成）
- 需要设备功能（相机扫描报告、文件系统）→ **Capacitor**

---

## 路径 A：PWABuilder

**最快路径，无需本地安装任何工具。**

### 步骤

1. 完成 PWA 的 HTTPS 部署（见上），记下域名，例如 `https://rsd-calc.example.com`
2. 访问 [https://www.pwabuilder.com](https://www.pwabuilder.com)
3. 输入 PWA URL，点击 **Start**
4. 查看评分报告（本项目应接近满分：有 manifest、SW、PNG 图标、maskable）
5. 点击 **Package for Stores** → 选择 **Android**
6. 配置：
   - **Package ID**：`com.haizhou.rsdcalc`（与 `twa/twa-manifest.template.json` 一致）
   - **App name**：RSD 含量计算器
   - **Signing key**：选择 "Create new" 让 PWABuilder 生成（**务必下载保存 keystore**）
7. 点击 **Download** → 得到 `.apk`（测试）+ `.aab`（上架）+ `assetlinks.json`
8. 把 `assetlinks.json` 部署到 `https://你的域名/.well-known/assetlinks.json`
9. 用 APK 在 Android 设备安装测试（应无浏览器地址栏）

### PWABuilder 生成的 assetlinks.json

PWABuilder 会自动生成正确的 `assetlinks.json`（含 SHA-256 指纹）。直接部署到 `.well-known/` 目录。

---

## 路径 B：Bubblewrap

**本地构建，完全可控。需要 JDK 17+ 和 Android SDK。**

### 前置安装

```bash
# 1. JDK 17（Windows：下载 Temurin 17，设置 JAVA_HOME）
# 2. Android SDK（通过 Android Studio 或 commandline-tools）
# 3. Bubblewrap CLI
npm install -g @bubblewrap/cli
```

### 步骤

```bash
# 1. 复制配置模板并填入你的域名
cp twa/twa-manifest.template.json twa/twa-manifest.json
# 编辑 twa/twa-manifest.json：把 REPLACE_WITH_YOUR_DOMAIN 替换为实际域名

# 2. 初始化 Android 项目（Bubblewrap 会拉取并校验 manifest）
cd twa
bubblewrap init --manifest https://你的域名/manifest.json

# 3. 生成签名密钥（首次）
bubblewrap build
# 或手动：keytool -genkey -v -keystore android.keystore -alias android \
#         -keyalg RSA -keysize 2048 -validity 10000

# 4. 构建 APK + AAB
bubblewrap build

# 5. 获取签名指纹（用于 assetlinks.json）
bubblewrap fingerprint      # 或 keytool -list -v -keystore android.keystore
```

### 部署 assetlinks.json

```bash
# 用 bubblewrap 生成的指纹填充模板
python tools/fill_assetlinks.py --domain 你的域名 --fingerprint AA:BB:CC:...
# 输出到 .well-known/assetlinks.json，部署到服务器
```

### 验证

```bash
# Google 官方验证工具
# https://developers.google.com/digital-asset-links/tools/generator
# 或直接访问 https://你的域名/.well-known/assetlinks.json 确认可访问
```

---

## 路径 C：Capacitor

**跨平台（Android + iOS），可访问原生 API。需要 Android Studio / Xcode。**

### 步骤

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "RSD 含量计算器" com.haizhou.rsdcalc

# 添加平台
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios          # 需要 macOS + Xcode

# 把 web 资源目录指向构建产物
# capacitor.config.json: { "webDir": "release/v54.XXX" }

npx cap sync
npx cap open android     # 打开 Android Studio 构建
```

**注意**：Capacitor 打包的是**本地文件**（不是远程 URL），所以不需要 Digital Asset Links，但需要把整个发布目录复制进 `webDir`。

---

## Digital Asset Links 配置

TWA 需要证明"App 和网站属于同一方"。在网站根目录部署：

```
https://你的域名/.well-known/assetlinks.json
```

内容（`twa/assetlinks.template.json` 模板）：

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.haizhou.rsdcalc",
    "sha256_cert_fingerprints": ["你的签名 SHA-256 指纹"]
  }
}]
```

### 获取 SHA-256 指纹

```bash
# 调试密钥（本地测试）
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# 发布密钥
keytool -list -v -keystore android.keystore -alias android
# 复制 SHA256 那一行的值
```

### 常见问题

- **App 顶部有浏览器地址栏** → assetlinks.json 未生效。检查：
  1. URL 可访问且 Content-Type 为 `application/json`
  2. 指纹完全匹配（含冒号，大写）
  3. package_name 与 app 一致
- **验证工具**：https://developers.google.com/digital-asset-links/tools/generator

---

## 发布到应用商店

### Google Play（Android）

1. 注册 [Google Play Console](https://play.google.com/console)（一次性 $25）
2. 创建应用 → 上传 `app-release-bundle.aab`
3. 填写商店信息（截图、描述、隐私政策）
4. 提交审核（1-7 天）

**注意**：TWA 上架需要提供隐私政策 URL（即使不收集数据）。

### App Store（iOS，需 Capacitor 路径）

1. 需要 macOS + Xcode + Apple Developer 账号（$99/年）
2. 用 Capacitor 生成 Xcode 项目 → Archive → 上传 App Store Connect
3. 审核更严格（2-7 天）

**iOS 限制**：纯 PWA 无法上架 App Store；必须用 Capacitor 包装成原生 App。

---

## 本项目已完成的准备工作

| 项 | 状态 | 文件 |
|---|---|---|
| PNG 图标 192/512/1024 | ✅ | `icons/icon-{192,512,1024}.png` |
| maskable 图标 | ✅ | `icons/icon-maskable-512.png` |
| manifest PNG icons | ✅ | `manifest.json` |
| SW 预缓存图标 | ✅ | `service-worker.js` PRECACHE_URLS |
| Bubblewrap 配置模板 | ✅ | `twa/twa-manifest.template.json` |
| assetlinks 模板 | ✅ | `twa/assetlinks.template.json` |
| 就绪度检查工具 | ✅ | `tools/check_twa_readiness.py` |
| 图标生成工具 | ✅ | `tools/generate_pwa_icons.js` |

### 验证就绪度

```bash
python tools/check_twa_readiness.py
# 全部 OK 后（含 HTTPS 部署）即可开始打包
```

### 剩余待办（需用户决策/操作）

- [ ] **PWA HTTPS 部署**（GitHub Pages / Cloudflare Pages / 自建）
- [ ] 选择打包路径（PWABuilder / Bubblewrap / Capacitor）
- [ ] 生成签名密钥并妥善保存
- [ ] 部署 assetlinks.json
- [ ] （可选）注册 Google Play / App Store 开发者账号
