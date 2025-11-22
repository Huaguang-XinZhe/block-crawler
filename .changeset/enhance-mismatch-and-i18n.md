---
"@huaguang/block-crawler": patch
---

feat: 组件数验证增强与国际化完善

- **mismatch.json 增强**：添加 `total` 字段显示不匹配总数
- **ignoreMismatch 配置**：新增全局配置选项，启用后即使组件数不匹配也继续处理（但仍记录）
- **国际化完善**：修复所有硬编码日志，统一使用 i18n
- **类型修复**：修复 domain 参数缺失和类型断言问题

