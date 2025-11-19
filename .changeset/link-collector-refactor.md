---
"@huaguang/block-crawler": minor
---

重大架构调整：链接收集改为前置阶段，run() 方法必须单独调用

- **BREAKING**: 移除 `CrawlerConfig` 中的 `startUrl`、`startUrlWaitOptions`、`collectionNameLocator` 和 `collectionCountLocator` 配置项
- **BREAKING**: `.blocks().each()` 和 `.pages().each()` 不再自动执行，必须显式调用 `.run()`
- 新增统一的 `.run()` 方法，必须在配置完成后调用
- 链接收集改为前置阶段，自动跳过已存在的 `collect.json`
- `BlockCrawler` 构造函数的 `config` 参数改为可选
- 链接收集配置：
  - `.collect(url)` - 设置起始 URL（前置阶段）
  - `.wait(until?, timeout?)` - 等待配置
  - `.tabList(locator)` / `.tabSection(locator)` - tab 点击配置
  - `.tabSections(locator)` - tab sections 配置（不需要点击）
  - `.name(locator)` - 名称提取配置
  - `.count(locator, extract?)` - 数量统计配置
- 收集结果保存到 `.crawler/域名/collect.json`
- 新增类型导出：`CollectResult`、`LocatorOrCustom`、`ExtractFunction`

**迁移指南：**

之前的写法：
```ts
const crawler = new BlockCrawler(page, {
  startUrl: "https://flyonui.com/blocks",
  collectionNameLocator: "//h3/text()",
  collectionCountLocator: "p",
});

await crawler
  .blocks('[data-preview]')
  .each(async ({ block }) => { ... });  // 自动执行
```

现在的写法：
```ts
const crawler = new BlockCrawler(page);

// 前置：收集阶段
await crawler
  .collect("https://flyonui.com/blocks")
  .name("//h3/text()")
  .count("p");

// 处理：blocks 或 pages 模式
await crawler
  .blocks('[data-preview]')
  .each(async ({ block }) => { ... });

// 必须：执行
await crawler.run();  // 必须调用！
```

**优势：**
- 收集和处理完全分离，更清晰
- 支持跳过收集（使用已有的 collect.json）
- run() 必须显式调用，避免意外执行

