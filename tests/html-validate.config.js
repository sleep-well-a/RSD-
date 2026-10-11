// v54.284 html-validate 配置（业界主流 HTML linter）
//
// 目的：扫 RSD & 含量计算器.html 中所有 <th scope="..."> / <input> / <button> 的合法性
//        v54.271/281 <th scope="col"ead"> 两次复发的工业级防御层
//
// 覆盖规则：
//   - element-required-attributes
//   - no-duplicate-id
//   - no-redundant-role
//   - attribute-allowed-values     // <th scope="..."> 必须为 {col, row, colgroup, rowgroup}
//   - wcag/h32  // form input must have label
//   - wcag/h36 / <button><a> 必须有 accessible name
//   - no-aria-hidden-on-focusable
//
// 注：html-validate 默认用 parsed fixture 模式，需提供 source 文件

module.exports = {
  root: true,
  extends: ["html-validate:recommended"],
  plugins: [],
  rules: {
    // v54.271/281 教训：<th scope="..."> 必须为合法值
    "attribute-allowed-values": [
      "error",
      {
        "th": {
          "scope": ["col", "row", "colgroup", "rowgroup"],
        },
      },
    ],
    // v54.265-266 P1 a11y：input 需有 label 或 aria-label
    "wcag/h32": ["error", { "requiredAncestors": ["label", "fieldset"] }],
    // button 必须有 accessible name（v54.265 修过 48+7 个 icon-only）
    "wcag/h36": "error",
    // 不重复 ID（v54.282 multi-tab 测试）
    "no-duplicate-id": "error",
    // 不冗余 role（如 <button role="button">）
    "no-redundant-role": "error",
  },
  // 容忍 RSD 项目特殊属性
  elements: [
    "html5",
    {
      // RSD 用 data-i18n-* 自定义属性
      "data-i18n": { "*": { "attribute": "string" } },
      "data-i18n-placeholder": { "*": { "attribute": "string" } },
      "data-i18n-title": { "*": { "attribute": "string" } },
      "data-i18n-value": { "*": { "attribute": "string" } },
      "data-i18n-aria-label": { "*": { "attribute": "string" } },
      "data-i18n-tooltip": { "*": { "attribute": "string" } },
      // RSD 历史属性
      "onclick": { "*": { "attribute": "string" } },
      "oninput": { "*": { "attribute": "string" } },
      "onchange": { "*": { "attribute": "string" } },
      "data-action": { "*": { "attribute": "string" } },
      "data-idx": { "*": { "attribute": "string" } },
      "data-batch-action": { "*": { "attribute": "string" } },
      "data-loaded": { "*": { "attribute": "string" } },
      "data-group-date": { "*": { "attribute": "string" } },
      "data-date": { "*": { "attribute": "string" } },
    },
  ],
};