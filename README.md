# Block Crawler Framework

基于 Playwright 的通用 Block 爬虫框架，支持受限并发、进度恢复、单页面或单 Block 处理模式。

## ✨ 特性

🎯 **双模式支持** - Block 模式和页面模式自由切换  
🚀 **受限并发** - 可配置并发数，避免封禁  
💾 **进度恢复** - 支持中断后继续爬取，自动跳过已完成任务  
⚙️ **完全配置化** - 所有参数可配置，支持函数覆盖  
🏗️ **模块化架构** - 单一职责原则，易于维护和扩展  
📦 **自动化管理** - 自动生成进度文件和输出目录  
🔧 **灵活扩展** - 支持配置函数覆盖，无需继承子类  
🌍 **国际化支持** - 完整的中英文日志输出，可通过 locale 配置切换

## 📦 安装

```bash
npm install block-crawler
# 或
pnpm add block-crawler
# 或
yarn add block-crawler
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
│   ├── MetaCollector.ts          # 元信息收集
│   └── CrawlerOrchestrator.ts    # 主协调器 (~270 行)
└── utils/
    ├── task-progress.ts          # 进度管理
    └── i18n.ts                   # 国际化支持
```

### 模块职责

- **ConfigManager** - 配置生成和验证
- **TabProcessor** - Tab 获取、点击、Section 定位
- **LinkCollector** - 收集页面链接，统计 Block 数量
- **BlockProcessor** - Block 获取和处理逻辑
- **PageProcessor** - 单页面处理逻辑
- **MetaCollector** - 元信息收集和统计
- **CrawlerOrchestrator** - 协调各模块，管理并发和进度
- **TaskProgress** - 进度记录和恢复
- **I18n** - 国际化支持，中英文日志切换
- **BlockCrawler** - 提供简洁的公共 API

## 🚀 快速开始

### Block 处理模式

适用于需要提取页面中多个 Block 的场景。

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "block-crawler";

test("爬取组件", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawler = new BlockCrawler({
    startUrl: "https://example.com/components",
    locale: "zh", // 可选：'zh' (中文，默认) 或 'en' (英文)
    tabListAriaLabel: "Categories",
    maxConcurrency: 5,
    
    // 配置链接收集定位符
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
import { BlockCrawler } from "block-crawler";

test("爬取页面", async ({ page }) => {
  const crawler = new BlockCrawler({
    startUrl: "https://example.com/pages",
    maxConcurrency: 3,
    collectionNameLocator: ".page-title",
    collectionCountLocator: ".page-count",
  });

  await crawler.onPage(page, async ({ currentPath, outputDir, currentPage }) => {
    const title = await currentPage.title();
    console.log(`处理页面: ${currentPath}, 标题: ${title}`);
  });
});
```

## ⚙️ 配置选项

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `startUrl` | `string` | - | 起始 URL（必填） |
| `locale` | `'zh' \| 'en'` | `'zh'` | 日志语言（中文或英文） |
| `tabListAriaLabel` | `string?` | undefined | 分类标签的 aria-label |
| `maxConcurrency` | `number` | 5 | 最大并发页面数 |
| `outputDir` | `string` | "output" | 输出目录（会自动在此目录下创建域名子目录） |
| `stateDir` | `string` | ".crawler" | 状态目录（存放进度文件和网站元信息，会自动创建域名子目录） |
| `enableProgressResume` | `boolean` | true | 是否启用进度恢复 |
| `blockNameLocator` | `string` | `role=heading[level=1] >> role=link` | Block 名称定位符 |

### 链接收集配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `collectionNameLocator` | `string?` | - | 集合名称定位符（可选，不提供则只记录 link） |
| `collectionCountLocator` | `string?` | - | 集合数量定位符（可选，不提供则只记录 link） |
| `extractBlockCount` | `(text: string \| null) => number` | 匹配所有数字并相加 | 自定义提取 Block 数量的函数 |

**注意：** 框架自动使用 `getByRole('link')` 查找链接，无需配置链接定位符。

**数量提取逻辑：**
- 默认：匹配文本中的所有数字然后相加（如 `"1 component + 6 variants"` → `7`）
- 自定义：可通过 `extractBlockCount` 函数覆盖默认行为

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
  isFree?: boolean;     // 是否为 Free 页面
}
```

## 🎯 自动化功能

### 自动进度管理

- ✅ **Block 级进度** - 记录每个已完成的 Block，避免重复处理
- ✅ **Page 级进度** - 记录已完成的页面，跳过整个页面
- ✅ **自动保存** - 任务结束或异常时自动保存进度
- ✅ **中断恢复** - 重新运行时自动跳过已完成任务

### 自动文件管理

根据 `startUrl` 自动生成域名子目录：

**目录结构：**
```
project/
├── .crawler/              # 状态目录 (stateDir)
│   ├── example.com/       # 域名子目录
│   │   └── progress.json  # 进度文件
│   └── site-a.com/
│       └── progress.json
└── output/               # 输出目录 (outputDir)
    ├── example.com/      # 域名子目录
    │   ├── component-1/
    │   └── component-2/
    └── site-a.com/
        └── ...
```

**示例：**
```
https://example.com/components
  → 进度: .crawler/example.com/progress.json
  → 输出: output/example.com/

https://site-a.com/library
  → 进度: .crawler/site-a.com/progress.json
  → 输出: output/site-a.com/
```

**特点：**
- ✅ 简洁明了 - 直接使用域名，无哈希
- ✅ 自动隔离 - 不同网站自动分离
- ✅ 易于管理 - 一目了然的目录结构

### 多站点支持

同一项目中爬取多个网站，自动隔离进度和输出：

```typescript
// 网站 A
const crawlerA = new BlockCrawler({
  startUrl: "https://site-a.com/components",
});
// 进度: .crawler/site-a-com/progress.json
// 输出: output/site-a-com/

// 网站 B
const crawlerB = new BlockCrawler({
  startUrl: "https://site-b.com/library",
});
// 进度: .crawler/site-b-com/progress.json
// 输出: output/site-b-com/
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

- [npm 包](https://www.npmjs.com/package/block-crawler)
- [GitHub 仓库](https://github.com/Huaguang-XinZhe/block-crawler)
- [更新日志](./CHANGELOG.md)
