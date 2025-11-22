---
"@huaguang/block-crawler": patch
---

feat: 优化 Free 组件文件管理和日志显示

**主要改进：**

1. **优化 Free 文件管理**：
   - 当没有 free 数据时，不创建新的 `free.json` 文件
   - 已存在的文件保持原样，不会被删除
   - 避免创建空的 free.json 文件

2. **增强日志显示**：
   - 在进度初始化时显示 Free 记录加载情况
   - 添加 `free.loaded` 国际化消息（中英文）
   - 显示跳过的 Block 和 Page 数量

**影响：**
- 不会产生空的 free.json 文件
- 用户可以更清楚地了解 Free 组件的加载情况

