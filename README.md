# UI Blocks Crawler Framework

基于 Playwright 的通用 Block 爬虫框架，支持受限并发、进度恢复、单页面或单 Block 处理模式。

## ✨ 特性

🎯 **双模式支持** - Block 模式和页面模式自由切换  
🚀 **受限并发** - 可配置并发数，避免封禁  
💾 **进度恢复** - 支持中断后继续爬取，自动跳过已完成任务  
⚙️ **完全配置化** - 所有参数可配置，支持函数覆盖  
🏗️ **模块化架构** - 单一职责原则，易于维护和扩展  
📦 **自动化管理** - 自动生成进度文件和输出目录  
🔧 **灵活扩展** - 支持配置函数覆盖，无需继承子类

## 📦 安装

```bash
npm install ui-blocks-crawler
# 或
pnpm add ui-blocks-crawler
# 或
yarn add ui-blocks-crawler
```

## 🏗️ 架构设计

框架采用模块化设计，每个模块职责单一：

```
src/
├── crawler.ts                    # 公共 API (~170 行)
├── types.ts                      # 类型定义
├── index.ts                      # 导出入口
├── core/                         # 核心模块
│   ├── ConfigManager.ts          # 配置管理 (~150 行)
│   ├── TabProcessor.ts           # Tab 处理 (~95 行)
│   ├── LinkCollector.ts          # 链接收集 (~95 行)
│   ├── BlockProcessor.ts         # Block 处理 (~140 行)
│   ├── PageProcessor.ts          # Page 处理 (~35 行)
│   └── CrawlerOrchestrator.ts    # 主协调器 (~210 行)
└── utils/
    └── task-progress.ts          # 进度管理
```

### 模块职责

- **ConfigManager** - 配置生成、验证、保存和加载
- **TabProcessor** - Tab 获取、点击、Section 定位
- **LinkCollector** - 收集页面链接，统计 Block 数量
- **BlockProcessor** - Block 获取和处理逻辑
- **PageProcessor** - 单页面处理逻辑
- **CrawlerOrchestrator** - 协调各模块，管理并发和进度
- **BlockCrawler** - 提供简洁的公共 API

## 🚀 快速开始

### Block 处理模式

适用于需要提取页面中多个 Block 的场景。

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "ui-blocks-crawler";

test("爬取组件", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawler = new BlockCrawler({
    startUrl: "https://example.com/components",
    tabListAriaLabel: "Categories",
    maxConcurrency: 5,
    
    // 配置链接收集定位符
    collectionLinkLocator: "section > a",
    collectionNameLocator: "xpath=/div[2]/div[1]/div[1]",
    collectionCountLocator: "xpath=/div[2]/div[1]/div[2]",
    
    // 配置 Tab Section 获取方式（可选）
    getTabSection: (page, tabText) => {
      return page.locator("section")
        .filter({ has: page.getByRole("heading", { name: tabText }) });
    },
  });

  // Block 定位符作为 onBlock 的参数传入
  await crawler.onBlock(
    page,
    "xpath=//main/div/div/div",  // Block 定位符
    async ({ block, blockName, blockPath, outputDir, currentPage }) => {
      // 处理单个 Block
      const code = await block.textContent();
      await fse.outputFile(`${outputDir}/${blockPath}.txt`, code);
    }
  );
});
```

### 页面处理模式

适用于需要处理整个页面的场景。

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "ui-blocks-crawler";

test("爬取页面", async ({ page }) => {
  const crawler = new BlockCrawler({
    startUrl: "https://example.com/pages",
    maxConcurrency: 3,
    collectionLinkLocator: "a.page-link",
    collectionNameLocator: ".page-title",
    collectionCountLocator: ".page-count",
  });

  await crawler.onPage(page, async ({ currentPath, outputDir, currentPage }) => {
    const title = await currentPage.title();
    console.log(`处理页面: ${currentPath}, 标题: ${title}`);
  });
});
```

### 配置文件模式（推荐）

**首次使用：创建配置文件**

```typescript
const crawler = new BlockCrawler({
  startUrl: "https://example.com/components",
  maxConcurrency: 5,
  // ... 其他配置
});

// 保存配置到 .crawler/config.json
await crawler.saveConfigFile();
```

**后续使用：从配置文件加载**

```typescript
test("爬取组件", async ({ page }) => {
  // 从 .crawler/config.json 加载配置
  const crawler = await BlockCrawler.fromConfigFile();
  
  await crawler.onBlock(page, "xpath=//div", async (context) => {
    // 处理逻辑...
  });
});
```

## ⚙️ 配置选项

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `startUrl` | `string` | - | 起始 URL（必填） |
| `tabListAriaLabel` | `string?` | undefined | 分类标签的 aria-label |
| `maxConcurrency` | `number` | 5 | 最大并发页面数 |
| `outputDir` | `string?` | 自动生成 | 输出目录 |
| `configDir` | `string` | ".crawler" | 配置目录 |
| `enableProgressResume` | `boolean` | true | 是否启用进度恢复 |
| `blockNameLocator` | `string` | `role=heading[level=1] >> role=link` | Block 名称定位符 |

### 链接收集配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `collectionLinkLocator` | `string` | - | 集合链接定位符（必填） |
| `collectionNameLocator` | `string` | - | 集合名称定位符（必填） |
| `collectionCountLocator` | `string` | - | 集合数量定位符（必填） |

### 等待选项配置

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `startUrlWaitOptions` | `object?` | 访问 startUrl 时的等待选项 |
| `collectionLinkWaitOptions` | `object?` | 访问集合链接时的等待选项 |

```typescript
// 等待选项示例
{
  waitUntil: "domcontentloaded",  // "load" | "domcontentloaded" | "networkidle" | "commit"
  timeout: 30000
}
```

### 高级配置（函数覆盖）

支持通过配置函数来覆盖默认行为，无需继承子类：

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `getTabSection` | `(page: Page, tabText: string) => Locator` | 获取 Tab 对应的 Section |
| `getAllTabTexts` | `(page: Page) => Promise<string[]>` | 直接返回所有 Tab 文本（跳过点击） |
| `getAllBlocks` | `(page: Page) => Promise<Locator[]>` | 获取所有 Block 元素 |
| `getBlockName` | `(block: Locator) => Promise<string \| null>` | 获取 Block 名称 |

**示例：shadcndesign 配置**

```typescript
const crawler = new BlockCrawler({
  startUrl: "https://www.shadcndesign.com/pro-blocks",
  maxConcurrency: 5,
  collectionLinkLocator: "role=link",
  collectionNameLocator: '[data-slot="card-title"]',
  collectionCountLocator: "p",
  
  // 使用配置函数，无需继承子类
  getTabSection: (page, tabText) => {
    return page.getByRole("tabpanel", { name: tabText });
  },
});

await crawler.onBlock(
  page,
  "xpath=//main/div/div/div",
  async ({ block, blockName }) => {
    // 处理逻辑
  }
);
```

**示例：直接提供所有 Tab 文本**

```typescript
const crawler = new BlockCrawler({
  startUrl: "https://example.com/components",
  
  // 直接返回所有 Tab 文本，跳过 Tab 点击
  getAllTabTexts: async (page) => {
    return ["Button", "Input", "Card", "Modal"];
  },
  
  getTabSection: (page, tabText) => {
    return page.locator(`[data-category="${tabText}"]`);
  },
});
```

## 📋 Context 对象

### BlockContext

```typescript
interface BlockContext {
  currentPage: Page;    // 当前页面实例（可能是新打开的页面）
  block: Locator;       // Block 元素
  blockPath: string;    // Block 路径（URL路径 + Block名称）
  blockName: string;    // Block 名称
  outputDir: string;    // 输出目录
}
```

### PageContext

```typescript
interface PageContext {
  currentPage: Page;    // 当前页面实例（可能是新打开的页面）
  currentPath: string;  // 当前 URL 路径
  outputDir: string;    // 输出目录
}
```

## 🎯 自动化功能

### 自动进度管理

- ✅ **Block 级进度** - 记录每个已完成的 Block，避免重复处理
- ✅ **Page 级进度** - 记录已完成的页面，跳过整个页面
- ✅ **自动保存** - 任务结束或异常时自动保存进度
- ✅ **中断恢复** - 重新运行时自动跳过已完成任务

### 自动文件管理

根据 `startUrl` 自动生成：

**进度文件命名规则：**
```
格式: .crawler/progress-{hostname}-{hash}.json
示例: https://example.com/components
  → .crawler/progress-example-com-a1b2c3d4.json
```

**输出目录命名规则：**
```
格式: output/{hostname}-{hash}
示例: https://example.com/components
  → output/example-com-a1b2c3
```

### 多站点支持

同一项目中爬取多个网站，自动隔离进度和输出：

```typescript
// 网站 A
const crawlerA = new BlockCrawler({
  startUrl: "https://site-a.com/components",
});
// 进度: .crawler/progress-site-a-com-abc12345.json
// 输出: output/site-a-com-a1b2c3

// 网站 B
const crawlerB = new BlockCrawler({
  startUrl: "https://site-b.com/library",
});
// 进度: .crawler/progress-site-b-com-def67890.json
// 输出: output/site-b-com-d4e5f6
```

## 🛠️ 开发命令

```bash
# 构建框架
pnpm build

# 监听模式构建
pnpm dev

# 运行测试
pnpm test

# UI 模式运行测试
pnpm test:ui

# 调试模式
pnpm test:debug

# 有头模式（显示浏览器）
pnpm test:headed
```

## 📦 版本管理

本项目使用 [Changesets](https://github.com/changesets/changesets) 进行版本管理。

```bash
# 1. 创建 changeset
pnpm changeset

# 2. 应用 changesets（更新版本号和 CHANGELOG）
pnpm changeset version

# 3. 发布到 npm
pnpm release
```

## 🔧 技术栈

- **Playwright** - 浏览器自动化
- **TypeScript** - 类型安全
- **p-limit** - 并发控制
- **fs-extra** - 文件操作
- **tsup** - 快速构建工具
- **changesets** - 版本管理

## 📄 License

ISC

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 🔗 链接

- [npm 包](https://www.npmjs.com/package/ui-blocks-crawler)
- [GitHub 仓库](https://github.com/Huaguang-XinZhe/ui-blocks-crawler)
- [更新日志](./CHANGELOG.md)
