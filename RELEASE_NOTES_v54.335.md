# RSD & 含量计算器 v54.335 发布说明

**发布日期**：2026-10-11
**前版本**：v54.334

## 🚀 一键 GitHub Pages 部署脚本（移动 App 路线收官）

### 背景

移动 App 方向最后一个缺失环节是"用户部署到 GitHub Pages"。v54.335 提供一个**安全的 Python 一键脚本**，让用户在本地跑 + 输入 token，自动完成 git push + Pages 启用。

### 改动

#### 1. `tools/deploy_github_pages.py`（~150 行）

**安全特性**：
- ✅ Token 仅在内存中（用 `getpass` 不回显）
- ✅ 不修改 `.git/config`（用 `git -c http.extraHeader` 临时传 Authorization）
- ✅ 不写任何 token 到磁盘
- ✅ Push 完 base64 编码立即失效（函数返回）
- ✅ 建议用户跑完去 GitHub Settings 撤销 token

**流程**：
```
[1/4] 验证 token (GET /user)
[2/4] 验证仓库 (GET /repos/owner/repo)
[3/4] git push (用临时 -c http.extraHeader)
[4/4] GitHub API 启用 Pages (POST /repos/owner/repo/pages)
```

**用法**：
```bash
python tools/deploy_github_pages.py
# 输入仓库 URL + Personal Access Token
# 完成后输出 Pages URL（如 https://yourname.github.io/yourrepo/）
```

#### 2. 用户操作指南（部署流程）

**前置**：
1. 在 GitHub 创建空仓库（**Public**）
2. 创建 Personal Access Token（`repo` 权限）

**部署**：
```bash
# 1. 撤销旧 token（如果已暴露）
# 2. 跑脚本
python tools/deploy_github_pages.py
# 输入：仓库 URL + 新 token
# 输出：Pages URL
```

**持续集成**（自动化后续版本）：
- 每次 `release.py` 发布新版本
- 我跑 `git push` 触发 GitHub Actions
- Actions 自动重新 build deploy/ 并部署到 Pages
- 用户**完全不用操作**

### 累计（v54.298 → v54.335）

- **Puppeteer 套件**：58 → 75（+17）
- **断言总数**：~1100 → ~1397（+297）
- **新发布版本**：**38** 个
- **新工具**：**21** 个（含 deploy_github_pages.py）
- **OCR 端到端**：10 个版本（v54.325-334）
- **移动 App 路线**：本地准备 + 部署脚本完成（v54.322-335）

### 完整路线总览（v54.298 → v54.335，38 个版本）

| 阶段 | 版本 | 内容 |
|---|---|---|
| **项目打磨** | v54.298-320 | 22 个版本的 bug 修复 + 工具增强 |
| **OCR 端到端** | v54.325-334 | 10 个版本（后端 → 前端 → 应用 → 进度 → 缓存 → 报告 → 批处理 → 真实进度 → 原始文本 → 一键复制） |
| **移动 App 路线** | v54.322-335 | 本地准备（PNG 图标、TWA 配置、就绪检查）+ 部署包 + Actions + **一键部署脚本（v54.335）** |
| **+ 15 类 pre-existing bug 修复** | - | check_manifest、check_i18n、round48/round52 mock 等 |

## 发布包

- 文件：`RSD-含量计算器-v54.335.zip`
- 流动相版：`RSD & 含量计算器_流动相版_v54.335.html`
- 新增工具：`tools/deploy_github_pages.py`（一键 GitHub Pages 部署）
