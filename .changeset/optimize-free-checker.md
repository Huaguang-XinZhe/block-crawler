---
"@huaguang/block-crawler": patch
---

**优化：Free-checker 重构为工具函数并增强日志输出**

**1. 修复类型错误**
- 修正 `ExtendedExecutionConfig.skipFree` 支持 Page 和 Locator 两种函数类型
- 在 BlockProcessor 中添加类型断言避免类型冲突

**2. 优化 FreeChecker**
- 从类改为工具函数（更符合 utils 的定位）
- 抽取通用逻辑 `checkFreeGeneric` 减少重复代码
- 移动到 `utils/free-checker.ts`
- 导出两个简洁的工具函数：`checkPageFree` 和 `checkBlockFree`

**3. 增强日志输出**
- 在 `processBlocksInPage` 结束时显示跳过的 Free Blocks 统计
- 列出所有被跳过的 block 名称，让用户清楚看到哪些内容被跳过
- 添加 i18n 翻译键 `block.skipFreeCount`

**使用体验改进：**

之前：看不到跳过了哪些 blocks
```
📦 找到 10 个 Block
Portfolio 1
Portfolio 9
...
```

现在：清晰显示跳过的 blocks
```
📦 找到 10 个 Block
Portfolio 1
Portfolio 9
...

⏭️  已跳过 3 个 Free Block：
   1. Free Portfolio Demo
   2. Basic Free Template
   3. Simple Free Layout
```

