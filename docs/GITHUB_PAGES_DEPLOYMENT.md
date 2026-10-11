# RSD & 含量计算器 — GitHub Pages 部署指南

> 把 PWA 部署到 GitHub Pages（免费 HTTPS），为 PWABuilder 打包原生 App 做准备。
> 生成时间：2026-10-11（v54.324）

## 目录

1. [为什么需要部署](#为什么需要部署)
2. [前置要求](#前置要求)
3. [方案一：手动部署（最快）](#方案一手动部署)
4. [方案二：GitHub Actions 自动部署（推荐）](#方案二github-actions-自动部署)
5. [自定义域名（可选）](#自定义域名可选)
6. [部署后验证](#部署后验证)
7. [衔接 PWABuilder 打包](#衔接-pwabuilder-打包)
8. [常见问题](#常见问题)

---

## 为什么需要部署

TWA（原生 App）打包要求：

1. **HTTPS 公开域名** — Digital Asset Links 必须通过 HTTPS 验证域名所有权
2. **PWA 可访问** — 浏览器需通过 HTTPS 注册 Service Worker（`localhost` 除外）

GitHub Pages 免费提供 HTTPS + 稳定域名，是最省事的方案。

---

## 前置要求

- [Git](https://git-scm.com/) 已安装
- [GitHub](https://github.com/) 账号
- 本地已生成部署包：`python tools/build_github_pages.py`

---

## 方案一：手动部署

### 步骤

```bash
# 1. 在项目根目录初始化 git（若尚未初始化）
cd "F:/自制软件"
git init
git add .
git commit -m "RSD 含量计算器 v54.XXX"

# 2. 在 GitHub 创建空仓库（网页操作），假设名为 rsd-calc
git remote add origin https://github.com/<你的用户名>/rsd-calc.git
git branch -M main
git push -u origin main
```

**注意**：项目很大（含 release/ 历史 + _backups/）。建议用 `.gitignore` 排除：

```gitignore
# .gitignore
_backups/
__pycache__/
*.pyc
node_modules/
_test_run_*.log
```

### 用 deploy/ 作为 Pages 源（推荐）

只把 `deploy/` 内容推到一个独立分支（如 `gh-pages`）：

```bash
# 生成部署包
python tools/build_github_pages.py

# 推送到 gh-pages 分支
cd deploy
git init
git add -A
git commit -m "Deploy v54.XXX"
git branch -M gh-pages
git remote add origin https://github.com/<用户名>/rsd-calc.git
git push -f origin gh-pages
```

然后在 GitHub：**Settings → Pages → Source: gh-pages / (root)**。

访问地址：`https://<用户名>.github.io/rsd-calc/`

---

## 方案二：GitHub Actions 自动部署

**推荐**：每次发布新版本自动部署，无需手动操作。

### 步骤

1. 确保 `.github/workflows/deploy-pages.yml` 已提交到仓库（本项目已提供）
2. 推送代码到 `main` 分支
3. GitHub → **Settings → Pages → Source: GitHub Actions**
4. 之后每次 `release/` 变化或手动触发 workflow，自动重新部署

workflow 会自动：
- 跑 `python tools/build_github_pages.py` 生成 `deploy/`
- 上传并部署到 GitHub Pages

### 手动触发

GitHub → **Actions → Deploy to GitHub Pages → Run workflow**

---

## 自定义域名（可选）

如果拥有域名（如 `rsd.example.com`）：

### 步骤

1. 在仓库根或 `deploy/` 放 `CNAME` 文件：

   ```
   rsd.example.com
   ```

2. DNS 配置（在域名注册商处）：

   | 类型 | 名称 | 值 |
   |---|---|---|
   | CNAME | rsd | `<用户名>.github.io` |

3. GitHub → **Settings → Pages → Custom domain** 填入域名 → 勾选 **Enforce HTTPS**

4. 等待 DNS 生效 + Let's Encrypt 证书签发（几分钟到几小时）

### 更新 manifest 的 home 域名

自定义域名后，重新生成部署包（`build_github_pages.py` 会自动处理相对路径，无需改域名）。

---

## 部署后验证

### 1. 基础访问

```bash
curl -I https://<用户名>.github.io/rsd-calc/
# 应返回 200 + content-type: text/html
```

### 2. PWA 资源

```bash
curl -I https://<用户名>.github.io/rsd-calc/manifest.json
curl -I https://<用户名>.github.io/rsd-calc/icons/icon-192.png
curl -I https://<用户名>.github.io/rsd-calc/service-worker.js
curl -I https://<用户名>.github.io/rsd-calc/.well-known/assetlinks.json
# 全部应返回 200
```

### 3. TWA 就绪度（含 HTTPS）

```bash
python tools/check_twa_readiness.py --url https://<用户名>.github.io/rsd-calc/
```

### 4. Lighthouse PWA 审计

Chrome DevTools → Lighthouse → 勾选 PWA → 分析。

关键指标：
- ✅ Installable（可安装）
- ✅ Service Worker 已注册
- ✅ Manifest 有效
- ✅ HTTPS

### 5. 手动安装测试

Chrome 地址栏右侧应出现 **安装** 图标（⊕），点击可安装为桌面/移动应用。

---

## 衔接 PWABuilder 打包

部署完成后：

1. 访问 [https://www.pwabuilder.com](https://www.pwabuilder.com)
2. 输入 URL：`https://<用户名>.github.io/rsd-calc/`
3. 点击 **Start** → 查看评分
4. **Package for Stores** → **Android**
5. 配置：
   - Package ID：`com.haizhou.rsdcalc`
   - App name：RSD 含量计算器
   - Signing key：**Create new**（下载保存 keystore！）
6. 下载 APK + AAB + `assetlinks.json`
7. 把 `assetlinks.json` 部署到 `deploy/.well-known/assetlinks.json` 并重新推送

详见 `docs/TWA_DEPLOYMENT.md`。

---

## 常见问题

### Q: GitHub Pages 忽略了下划线开头的文件/目录

**原因**：Jekyll 处理时忽略 `_` 开头文件。

**解决**：本项目已生成 `.nojekyll` 文件（放在 `deploy/` 根），禁用 Jekyll。

### Q: `.well-known/assetlinks.json` 返回 404

**原因**：Jekyll 或路径问题。

**解决**：
1. 确认 `.nojekyll` 存在
2. 确认文件在 `deploy/.well-known/assetlinks.json`
3. 用 curl 直接测试完整路径

### Q: 中文文件名导致 URL 超长

**原因**：原流动相版文件名含中文 + `&`。

**解决**：`build_github_pages.py` 已把流动相版重命名为 `index.html`，start_url 改为 `./`。

### Q: Service Worker 更新不生效

**原因**：SW 缓存策略。

**解决**：本项目 SW 用 network-first（HTML）+ CACHE_VERSION 版本化缓存。发布新版本时 `CACHE_VERSION` 会自动更新（`sync_sw_version.py`），旧缓存自动清理。

### Q: Pages 部署后显示 404

**原因**：Pages 源设置不对，或部署目录为空。

**解决**：
1. Settings → Pages 确认 Source 指向正确分支/目录
2. 确认该分支根目录有 `index.html`
3. 等待 1-2 分钟（Pages 构建需要时间）

### Q: 仓库体积过大

**原因**：`release/` 含 40+ 个版本，每个约 1MB。

**解决**：
- `.gitignore` 排除 `release/`（只提交 `deploy/`）
- 或只提交最新版本
- 或用 Git LFS

---

## 部署检查清单

- [ ] `python tools/build_github_pages.py` 生成 deploy/
- [ ] `.gitignore` 排除 `_backups/` / `node_modules/` / `__pycache__/`
- [ ] 推送到 GitHub（main 或 gh-pages）
- [ ] Settings → Pages 配置源
- [ ] `curl -I` 验证 200
- [ ] `check_twa_readiness.py --url <域名>` 全部 OK
- [ ] Lighthouse PWA 审计通过
- [ ] Chrome 显示"安装"图标
- [ ] （TWA 打包后）assetlinks.json 填入指纹
