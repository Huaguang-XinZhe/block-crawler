# 链接收集 API

## 概述

链接收集是爬虫的**前置阶段**，通常在 `blocks()` 或 `pages()` 之前运行。

**重要变更：**
- 收集阶段不再自动执行，需要显式调用 `.run()`
- 已存在 `collect.json` 时会自动跳过收集
- `run()` 方法必须在所有配置完成后调用

## 基本用法

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "@huaguang/block-crawler";

test("collect links", async ({ page }) => {
  const crawler = new BlockCrawler(page);

  // 前置：收集阶段
  await crawler
    .collect('https://example.com/blocks')
    .tabSections('//main/section')
    .name('//h3/text()')
    .count('p');

  // 处理：blocks 或 pages 模式（可选）
  // await crawler.blocks('[data-preview]').each(async ({ block }) => { ... });

  // 必须：执行
  await crawler.run();
});
```

## API 方法

### `.collect(url: string)`

设置起始 URL，必需项。

```typescript
crawler.collect('https://example.com/blocks')
```

### `.wait(until?, timeout?)`

设置页面等待选项。

```typescript
.wait('load', 3000)  // 等待 load 事件，超时 3 秒
.wait('networkidle') // 等待网络空闲
```

### Tab 配置

#### 方案 1：不需要点击 tab

使用 `.tabSections()` 直接获取所有 sections：

```typescript
.tabSections('//main/section')
// 或使用自定义函数
.tabSections(async (page) => page.locator('section[data-tab-content]').all())
```

#### 方案 2：需要点击 tab

配合使用 `.tabList()` 和 `.tabSection()`：

```typescript
.tabList('[role="tablist"]')
.tabSection((page) => page.getByRole("tabpanel"))
```

### `.name(locator)`

配置名称提取逻辑：

```typescript
.name('//h3/text()')
// 或使用自定义函数
.name(link => link.locator('[data-slot="card-title"]'))
```

### `.count(locator, extract?)`

配置数量统计逻辑：

```typescript
.count('p')
// 或自定义提取逻辑
.count(
  link => link.locator('p'),
  (text) => parseInt(text?.match(/\d+/)?.[0] || '0')
)
```

### `.run()`

**必须调用！**在所有配置完成后执行爬虫任务：

```typescript
await crawler.run();
```

执行流程：
1. 如果配置了收集阶段，检查 `collect.json` 是否存在
2. 不存在则执行收集，保存到 `collect.json`
3. 如果配置了 blocks/pages 模式，继续执行处理

返回值：`void`（收集结果保存到文件）

## 输出文件

结果自动保存到 `.crawler/域名/collect.json`：

```json
{
  "summary": {
    "totalLinks": 98,
    "totalBlocks": 1193
  },
  "collections": [
    {
      "link": "/react/components/featured-icons",
      "name": "Featured icons",
      "blockCount": 7
    }
  ]
}
```

## 完整示例

### FlyOnUI（不需要点击 tab）

```typescript
const crawler = new BlockCrawler(page);

await crawler
  .collect('https://flyonui.com/blocks')
  .wait('load')
  .tabSections('//main/section')
  .name('//h3/text()')
  .count('p');

await crawler.run();
```

### HeroUI（需要点击 tab）

```typescript
const crawler = new BlockCrawler(page);

await crawler
  .collect('https://www.heroui.com/blocks')
  .wait('load')
  .tabList('[role="tablist"]')
  .tabSection((page) => page.locator('section').first())
  .name((link) => link.locator('//div[2]/div[1]/div[1]'))
  .count(
    (link) => link.locator('//div[2]/div[1]/div[2]'),
    (text) => parseInt(text?.match(/(\d+)/)?.[1] || '0')
  );

await crawler.run();
```

## 渐进式使用

收集阶段和处理阶段完全分离：

```typescript
const crawler = new BlockCrawler(page);

// 前置：收集链接（首次必须）
await crawler
  .collect('https://example.com/blocks')
  .tabSections('//main/section')
  .name('//h3/text()')
  .count('p');

// 处理：blocks 或 pages（可选）
await crawler
  .blocks('[data-preview]')
  .each(async ({ block, blockName }) => {
    // 处理每个 block
  });

// 必须：执行
await crawler.run();
```

**跳过收集：**

如果 `collect.json` 已存在，可以跳过收集阶段：

```typescript
const crawler = new BlockCrawler(page);

// 跳过收集，直接处理
await crawler
  .blocks('[data-preview]')
  .each(async ({ block }) => { ... });

await crawler.run();  // 会加载 collect.json
```

## 迁移指南

### 旧的写法（v0.18.x）

```typescript
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/blocks",
  collectionNameLocator: "//h3/text()",
  collectionCountLocator: "p",
});

await crawler
  .blocks('[data-preview]')
  .each(async ({ block }) => { ... });  // 自动执行
```

### 新的写法（v0.19.0+）

```typescript
const crawler = new BlockCrawler(page);

// 前置：收集
await crawler
  .collect("https://example.com/blocks")
  .name("//h3/text()")
  .count("p");

// 处理：blocks
await crawler
  .blocks('[data-preview]')
  .each(async ({ block }) => { ... });

// 必须：执行
await crawler.run();
```

## 优势

1. **明确的阶段划分**：收集是前置阶段，处理是主要阶段
2. **自动跳过已收集**：已存在 `collect.json` 时自动跳过，节省时间
3. **配置清晰**：收集相关配置与全局配置分离
4. **灵活性**：每个配置项都支持字符串定位符或自定义函数
5. **显式执行**：`run()` 必须显式调用，避免意外执行

