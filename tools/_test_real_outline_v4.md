# Slide 1: RSD & 含量计算器 v54.284

**Visual: title-cover**

RSD & 含量计算器 v54.284
药品质量标准研究的瑞士军刀

覆盖 8 大药检模块：含量、回收率、滴定度、干燥失重、炽灼残渣、含量均匀度、溶出度、标准曲线。

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
公式 (A样W对P对)/(A对W样/D样)

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
Function use strict
沙箱求值
焦点保护

---

# Slide 4: 工具链 (v54.284)

**Visual: cards-2**

[Card 1: 静态扫描器]
scan_i18n_hardcoded 扫 i18n 漏网
scan_html_typos 扫 HTML typo
audit_a11y_aria aria 判据
均在 tools/

[Card 2: Puppeteer 测试]
axe-core WCAG 2.0 AA
chartjs-plugin-a11y 图表键盘
pdf-a11y PDF 审计
均在 tests/

---

# Slide 5: 工具链覆盖

**Visual: cards-2**

[Card 1: 高频问题]
boolean 反转 4 次 v54.248-274
i18n 硬编码 7 次 v54.276-283
HTML typo 2 次 v54.271/281

[Card 2: 防御层]
a11y 陷阱 多次
备份时机 2 次 v54.270/283
改动失控 1 次 v54.272
全部已有 SOP + 工具

---

# Slide 6: 测试状态

**Visual: title-cover**

RSD v54.284 测试 53 / 58 PASS
3 次连续 EXIT=0 稳定

5 个遗留 FAIL 不算异常
工具链已为 RSD 项目建立 6 类问题防御层