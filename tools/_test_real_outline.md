# Slide 1: RSD & 含量计算器 v54.284

**Visual: hero-statement**

药品质量标准研究的瑞士军刀
化学分析师的工具集

RSD 是相对标准偏差计算工具。覆盖 8 大药检模块：含量、回收率、滴定度、干燥失重、炽灼残渣、含量均匀度、溶出度、标准曲线。

---

# Slide 2: 8 大功能模块

**Visual: cards-3**

[Card 1: 统计计算]
均值 / SD / RSD%
所有计算结果自动保存到历史

[Card 2: 回收率]
面积归一化法 / 外标法 / 内标法 / 简易
中国药典 9101 验证流程

[Card 3: 含量计算]
HPLC / GC / UV 外标法
公式：(A样×W对×P对)/(A对×W样/D样)

---

# Slide 3: 技术特性

**Visual: cards-3**

[Card 1: 单文件 PWA]
HTML/CSS/JS 无外部依赖
SheetJS CDN 导出 Excel
localStorage 200 条历史

[Card 2: 专业计算器]
双层键盘布局
三角函数 / 阶乘 / 取整
所有输入支持数学表达式

[Card 3: 安全评估]
Function('use strict')
沙箱求值
焦点保护

---

# Slide 4: 工具链 (v54.284)

**Visual: table**

| 工具 | 用途 | 位置 |
| :--- | :--- | :--- |
| scan_i18n_hardcoded.py | 扫 i18n 漏网 | tools/ |
| scan_html_typos.py | 扫 HTML typo | tools/ |
| audit_a11y_aria.py | aria 判据 | tools/ |
| axe-core Puppeteer | WCAG 2.0 AA | tests/ |
| chartjs-plugin-a11y | 图表键盘 | tests/ |
| pdf-a11y | PDF 审计 | tests/ |

---

# Slide 5: v54.284 工具链覆盖

**Visual: table**

| 问题类 | 工具 | 历史复发 |
| :--- | :--- | :--- |
| boolean 反转 | apply_codemod_isfinite + dev 自检 | 4 次（v54.248/271/273/274）|
| i18n 硬编码 | scan_i18n_hardcoded | 7 次（v54.276-283）|
| HTML typo | scan_html_typos | 2 次（v54.271/281）|
| a11y 陷阱 | audit_a11y_aria + axe-core | 多次 |
| 备份时机 | pre_edit_backup | 2 次（v54.270/283）|
| 改动失控 | SOP + SOP 文档 | 1 次（v54.272）|

---

# Slide 6: 测试状态

**Visual: hero-statement**

53 / 58 PASS — 3 次连续 EXIT=0
5 个遗留 FAIL（v54.283 时代，不算异常）

工具链已为 RSD 项目建立 6 类问题防御层