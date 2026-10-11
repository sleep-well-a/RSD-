# RSD & 含量计算器 — 后续待执行计划

> 生成时间：2026-10-11
> 更新：2026-10-11（**v54.324 已发布 — 移动端原生 App 方向准备完成**）
> 当前版本：v54.324
> 已发布：27 个版本（v54.285 → v54.324）
> Puppeteer 套件：74（1360+ 断言）

## 当前方向：移动端原生 App（用户已选 GitHub Pages + PWABuilder）

### ✅ 本地准备已完成（v54.322 → v54.324）

| # | 任务 | 完成版本 |
|---|---|---|
| 1 | PNG 图标生成（4 尺寸，含 maskable）| v54.323 |
| 2 | manifest PNG icons + SW 预缓存 | v54.323 |
| 3 | TWA 配置模板（twa-manifest + assetlinks）| v54.323 |
| 4 | TWA 就绪检查工具（17 项）| v54.323 |
| 5 | TWA 部署指南（3 条打包路径）| v54.323 |
| 6 | GitHub Pages 部署包生成器 | v54.324 |
| 7 | GitHub Actions 自动部署 workflow | v54.324 |
| 8 | 部署验证测试（8 项断言）| v54.324 |
| 9 | GitHub Pages 部署指南 | v54.324 |
| 10 | 根目录 manifest 修复（36 版本过时）| v54.322 |

### ⏳ 待用户操作（无法由 AI 完成）

| # | 任务 | 说明 |
|---|---|---|
| 1 | git init + 推送到 GitHub | 需 GitHub 账号 |
| 2 | Settings → Pages 启用 | 或等 Actions 自动部署 |
| 3 | 验证 HTTPS + Lighthouse | `check_twa_readiness.py --url <域名>` |
| 4 | PWABuilder 上传 URL | 生成 APK/AAB（需签名密钥）|
| 5 | 部署 assetlinks.json | 填 PWABuilder 提供的指纹 |
| 6 | （可选）注册 Google Play | $25 一次性 |

详见 `docs/GITHUB_PAGES_DEPLOYMENT.md` + `docs/TWA_DEPLOYMENT.md`。

## v54.321 完成总结

| # | 任务 | 状态 | 实际完成版本 |
|---|---|---|---|
| 1 | **PWA 端到端测试** | ✅ 已完成 | v54.318 |
| 2 | **更多 chart 类型适配检查** | ✅ 已完成 | v54.319 |
| 3 | **release.py 增强（自动写 memory）** | ✅ 已完成 | v54.316 |
| 4 | **跨版本 memory 自动更新** | ✅ 已完成 | v54.317 |
| 5 | **manifest 一致性集成到 release.py** | ✅ 已完成 | v54.321 |
| 6 | **修 v54.286-v54.297 manifest name 警告** | ✅ 已完成 | v54.321 |
| 7 | **修 v54.320 manifest start_url regression** | ✅ 已完成 | v54.321 |

**7/7 任务全部完成。**

## v54.321 改动详情

### 1. 集成 check_manifest_consistency 到 release.py

`release.py` pre-flight checks 新增 `[4] 跨 release manifest 一致性`，发布前自动检查。

### 2. 扩展 check_manifest_consistency --fix

`--fix` 现在同时修 start_url + name（之前只修 start_url）。

### 3. 修复 11 个历史 manifest

- **name 修复（10 个）**：v54.286-v54.297 全部从 v54.285 改为对应版本号
- **start_url 修复（1 个）**：v54.320 manifest 从 v54.297 改回 v54.320

修复后：`34 个版本，0 错误，0 警告 [OK]`

## 任务详细分析

### #1 PWA 端到端测试

**目标**：模拟 PWA 完整使用流程，包括：
- 首次访问 → 触发 SW 安装
- 离线模式（关闭网络）→ 验证 SW cache 命中
- 二次访问 → 验证 network-first 策略
- add to home screen manifest 检测

**关键文件**：
- `tests/e2e_puppeteer_pwa_e2e.js`（新）

**关键挑战**：
- Service Worker 需要 HTTPS 或 localhost（已满足）
- 离线测试需要 `puppeteer.setOfflineMode(true)`
- 等待 SW activate（可能需要 100-500ms）

**风险**：PWA 测试在 CI 环境可能不稳定（依赖浏览器具体实现）

---

### #2 更多 chart 类型适配检查

**目标**：扩展 round44/45/51 到其他 chart 类型：
- 标准曲线 chart（`drawCurveChart`）
- spike recovery chart
- 趋势线 / 阈值线

**关键文件**：
- `tests/e2e_puppeteer_round53_other_charts.js`（新）

**低价值理由**：用户实际使用中主要看 trend chart，其他 chart 是次要

---

### #3 release.py 增强（自动写 memory）

**目标**：发布时自动生成 `rsd-milestone-v54.XXX-feature.md` memory 文件

**关键文件**：
- `tools/release.py`（新增 `write_memory` 步骤）
- `tools/extract_milestone.py`（从 RELEASE_NOTES.md 提取关键信息）

**实现思路**：
```python
# release.py 新增
def write_memory(version, notes_text):
    """从 RELEASE_NOTES 提取关键信息生成 milestone memory。"""
    milestone_path = MEMORY_DIR / f'rsd-milestone-{version.replace(".", "-")}-<slug>.md'
    milestone_path.write_text(template.format(version=version, ...))
```

**重要问题**：slug 怎么生成？需要从主题提取关键词。例如 v54.315 → "v54-315-changelog"。

---

### #4 跨版本 memory 自动更新

**目标**：自动把多个版本的 milestone 合并到 `MEMORY.md` 索引

**关键文件**：
- `tools/build_memory_index.py`（新）

**实现思路**：
- 扫描所有 `rsd-milestone-v54-XXX-*.md` 文件
- 按版本号倒序排序
- 生成 MEMORY.md 的链接条目

**依赖**：需 #3 先生成 milestone 文件

## 推荐执行顺序

按价值/复杂度比 + 依赖关系：

```
#3 (release.py 自动写 memory)        [1.5h, 价值高]
   ↓
#4 (跨版本 memory 自动更新)            [1h, 价值中]
   ↓
#1 (PWA 端到端测试)                  [2-3h, 价值中]
   ↓
#2 (更多 chart 类型适配检查)          [1h, 价值低]
```

**理由**：
- #3 完成后 #4 才有数据
- #1 PWA 测试是独立大块，留出足够时间
- #2 chart 测试价值低，放最后

## 备选执行顺序（如果想先看高价值独立任务）

```
#1 (PWA 端到端测试)                  [2-3h, 价值中, 独立]
#3 (release.py 自动写 memory)        [1.5h, 价值高]
#4 (跨版本 memory 自动更新)            [1h, 价值中, 依赖 #3]
#2 (更多 chart 类型适配检查)          [1h, 价值低]
```

## 任务详解（按推荐顺序）

### #3 release.py 增强（推荐第一个）

**步骤**：
1. 设计 milestone memory 模板
2. 实现 `extract_milestone_slug()`（从主题提取英文 slug）
3. release.py 新增 `write_memory` 步骤
4. 测试 v54.316 release 验证自动生成

**预期输出**：
```
~/.claude/projects/.../memory/rsd-milestone-v54-316-xxx.md
~/.claude/projects/.../memory/MEMORY.md （自动更新）
```

---

### #4 跨版本 memory 自动更新

**步骤**：
1. 扫描所有 milestone memory 文件
2. 解析 frontmatter（version, date）
3. 按版本号倒序生成 MEMORY.md 链接列表
4. 与现有的手动 MEMORY.md 内容合并

---

### #1 PWA 端到端测试

**步骤**：
1. 写 `e2e_puppeteer_pwa_e2e.js`：
   - 首次访问 → 验证 SW 注册
   - 等待 SW activate
   - 模拟 offline → 验证 cache 命中
2. 写 round 套件
3. 发布 v54.317+ 时跑

---

### #2 更多 chart 类型适配检查

**步骤**：
1. 扩展 round51 到 curve chart
2. 加 spike chart 检查
3. 13 项断言目标

## 时间预算

总计 5.5-6.5 小时（约 1 个工作日）

## 风险评估

| 风险 | 可能性 | 影响 | 缓解 |
|---|---|---|---|
| PWA 测试在 headless Chrome 不稳定 | 中 | 中 | 加 retry + skip 模式 |
| 自动 memory 模板风格不一致 | 低 | 低 | 第一个版本人工 review |
| Chart 测试代码重复 | 低 | 低 | 提取共用 helper |

## 决策点

请选择：
1. **按推荐顺序**（#3 → #4 → #1 → #2）
2. **按备选顺序**（#1 → #3 → #4 → #2）
3. **只做高价值的**（只做 #3 + #4，跳过 #1 #2）
4. **自定义**（你指定顺序或跳过某些）

---

**当前状态**：v54.315 已发布，等待你的决策。
