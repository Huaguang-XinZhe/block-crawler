---
"@huaguang/block-crawler": minor
---

新增智能跳过已知 Free 页面功能

**功能说明：**

在 `skipFree` 开启且 `enableProgressResume` 关闭的情况下，从 `meta.json` 中读取之前运行时记录的 Free 页面列表，在打开页面之前直接跳过这些页面。

**使用场景：**

1. **不恢复进度，但想跳过 Free 页面**
   - `skipFree: "FREE"` ✅
   - `enableProgressResume: false` ✅
   - 框架自动从 `meta.json` 加载已知 Free 页面列表

2. **恢复进度模式**
   - `enableProgressResume: true`
   - 此功能不启用（进度恢复已经会跳过已完成页面）

**性能提升：**

对于已知的 Free 页面：
- ❌ 之前：打开页面 → goto → 检查 Free → 跳过
- ✅ 之后：**直接跳过**（不打开页面，不 goto）

**节省时间：**
- 每个已知 Free 页面节省 1-2 秒（避免页面打开和 goto）
- 如果有 10 个 Free 页面，总计节省 10-20 秒

**示例输出：**

```
📋 已加载 2 个已知 Free 页面

🚀 开始并发处理所有链接 (最大并发: 5)...

📦 开始处理 50 个集合链接...

🆓 跳过已知 Free 页面: Featured Icons
🆓 跳过已知 Free 页面: Utility Buttons
```

**工作流程：**

1. **第一次运行：**
   - 访问所有页面
   - 检测到 Free 页面并记录到 `meta.json`
   - 完成后 `meta.json` 包含 Free 页面列表

2. **后续运行：**
   - 读取 `meta.json` 中的 Free 页面列表
   - 在处理链接前直接跳过这些页面
   - 不打开页面，不执行 goto
   - 性能大幅提升

**配置示例：**

```typescript
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com",
  skipFree: "FREE",              // 启用 Free 检测
  enableProgressResume: false,   // 关闭进度恢复
  // ... 其他配置
});

await crawler.block(/* ... */).run();
```

