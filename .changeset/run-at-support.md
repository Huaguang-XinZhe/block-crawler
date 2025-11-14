---
"@huaguang/block-crawler": patch
---

支持油猴脚本的 @run-at 元数据

**新功能：**
- 自动解析油猴脚本的 `@run-at` 元数据
- 支持 `document-start`、`document-end`、`document-idle` 三种执行时机
- 智能映射到框架的 `beforePageLoad` 和 `afterPageLoad`

**执行时机优先级：**
1. 配置的 `timing` 参数（如果指定）- 配置优先
2. 油猴脚本的 `@run-at` 元数据 - 脚本自定义
3. 默认值 `afterPageLoad` - 兜底默认

**使用场景：**
- 不设置 `timing`：每个脚本按照自己的 `@run-at` 执行
- 设置了 `timing`：所有脚本统一按照配置执行
- 混合使用：部分脚本有 `@run-at`，部分没有，各自按照优先级执行

**文档更新：**
- 说明 `@run-at` 元数据支持
- 添加执行时机优先级说明
- 更新示例代码

