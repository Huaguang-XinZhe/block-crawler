---
"@huaguang/block-crawler": patch
---

**重构：抽取 FreeChecker 模块并让 TestMode 完全复用真实 Processors**

**重构目标：**
- 保证 TestMode 测试的就是真实的处理逻辑
- 遵循单一职责原则

**变更内容：**

1. **创建 FreeChecker 模块**
   - 统一处理 page 和 block 级别的 skipFree 逻辑
   - 支持字符串和函数两种配置方式
   - 避免代码重复

2. **重构 PageProcessor 和 BlockProcessor**
   - 使用 FreeChecker 替代重复代码
   - 保持原有功能不变

3. **完全重写 TestMode**
   - 移除所有重复的处理逻辑实现（约 140 行代码）
   - 直接使用 `PageProcessor` 处理 page handler
   - 直接使用 `BlockProcessor` 处理 block handler
   - 只保留导航和自动滚动等测试模式特有的逻辑

**优势：**
- 测试模式现在测试的就是生产环境的代码
- 代码复用，减少维护成本（净删除约 67 行代码）
- 单一职责，逻辑清晰
- 确保 skipFree 逻辑在测试模式和正常模式下完全一致

**影响：**
- 内部重构，对外 API 无影响
- 测试模式的行为保持一致

