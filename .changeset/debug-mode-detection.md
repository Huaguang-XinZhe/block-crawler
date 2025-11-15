---
"@huaguang/block-crawler": patch
---

优化 Debug 模式下的暂停行为和日志输出

**主要改进：**

1. **智能 Debug 模式检测**
   - 新增 `isDebugMode()` 工具函数
   - 自动检测 PWDEBUG、PW_TEST_DEBUG、PLAYWRIGHT_INSPECTOR 环境变量
   - 根据运行模式智能调整行为

2. **差异化日志输出**
   - **Debug 模式**：输出"页面已暂停方便检查"，真正调用 `page.pause()`
   - **非 Debug 模式**：输出"使用 --debug 模式可以暂停页面"，不调用 `page.pause()`
   - 避免非 Debug 模式下的误导性日志

3. **影响范围**
   - `pauseOnError` 功能：只在 Debug 模式下暂停
   - `verifyBlockCompletion` 功能：只在 Debug 模式下暂停
   - 保持功能逻辑不变，仅优化用户体验

**使用体验：**

```bash
# Debug 模式（会真正暂停）
pnpm test:debug tests/example.spec.ts

# 非 Debug 模式（不会暂停，只提示）
pnpm test tests/example.spec.ts
```

**日志对比：**

Debug 模式：
```
🛑 检测到错误，页面已暂停方便检查
   类型: Block
   位置: Button Component
   错误: Timeout 10000ms exceeded.
```

非 Debug 模式：
```
❌ 检测到错误
   类型: Block
   位置: Button Component
   错误: Timeout 10000ms exceeded.

   💡 提示: 使用 --debug 模式运行可以自动暂停页面进行检查
```

