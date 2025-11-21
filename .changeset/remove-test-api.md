---
"@huaguang/block-crawler": minor
---

**重大变更：移除 test() 链式 API**

将测试模式整合到 `open()` 方法中，简化 API 使用。

**变更内容：**
- 移除 `test()` 链式方法
- `open()` 方法现在支持传入测试 URL 作为第一个参数
- 当 `open()` 的第一个参数是 URL（以 "http" 开头）时，自动进入测试模式
- 测试模式下只访问指定页面，不进行并发处理

**迁移指南：**

旧用法（已移除）：
```typescript
await crawler
  .test("https://example.com/page", "[data-preview]", { index: 0 })
  .run(async ({ section }) => { ... });
```

新用法：
```typescript
await crawler
  .open("https://example.com/page", "load")
  .page({ autoScroll: true })
  .block("[data-preview]", async ({ block }) => { ... })
  .run();
```

**优势：**
- API 更简洁，减少概念负担
- 与正常模式的使用方式更一致
- 支持 page 和 block 处理器的完整功能

