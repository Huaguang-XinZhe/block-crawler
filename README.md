# Block Crawler Framework

基于 Playwright 的通用 Block 爬虫框架，支持受限并发、进度恢复、单页面或单 Block 处理模式。

## 特性

✨ **双模式支持** - Block 模式和页面模式自由切换  
🚀 **受限并发** - 可配置并发数，避免封禁  
💾 **进度恢复** - 支持中断后继续爬取  
⚙️ **完全配置化** - 所有参数可配置  
🔧 **易于扩展** - 提供 protected 方法供子类覆盖

## 项目结构

```
playwright-demo/
├── src/                          # 框架源代码
│   ├── index.ts                  # 主入口文件
│   ├── types.ts                  # 类型定义
│   ├── crawler.ts                # 核心爬虫类
│   └── utils/                    # 工具类
│       ├── task-progress.ts      # 进度管理
│       └── extract-code.ts       # 代码提取
├── tests/                        # 测试和示例
│   ├── main.spec.ts              # 原始实现（参考）
│   └── multi-site-example.spec.ts  # 多站点爬取示例
├── .crawler/                     # 配置和进度目录
│   ├── config.example.json       # 配置示例
│   ├── config.json               # 配置文件（可选）
│   └── progress-*.json           # 进度文件（自动生成，按网站区分）
├── dist/                         # 构建输出目录
└── output/                       # 爬取结果输出目录
    ├── site-a-com-abc123/        # 网站 A 的输出（自动生成）
    ├── site-b-com-def456/        # 网站 B 的输出（自动生成）
    └── ...                       # 其他网站
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建框架

```bash
pnpm build
```

### 3. 运行示例

**多站点爬取示例：**

```bash
pnpm test tests/multi-site-example.spec.ts
```

**原始实现（对比参考）：**

```bash
pnpm test tests/main.spec.ts
```

## 快速开始

### 方式 1: 使用配置文件（推荐）

**首次使用：创建配置文件**

```typescript
import { BlockCrawler } from "./src";

const crawler = new BlockCrawler({
  startUrl: "https://example.com/components",
  blockLocator: "xpath=//main/div/div/div",
  maxConcurrency: 5,
});

// 保存配置到 .crawler/config.json
await crawler.saveConfigFile();
```

**后续使用：从配置文件加载**

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "./src";

test("爬取组件", async ({ page }) => {
  // 从 .crawler/config.json 加载配置
  const crawler = await BlockCrawler.fromConfigFile();
  
  // 设置处理器并自动运行
  await crawler.onBlock(page, async (context) => {
    // 处理逻辑...
  });
});
```

### 方式 2: 直接传入配置

```typescript
import { test } from "@playwright/test";
import { BlockCrawler, type BlockContext } from "./src";

test("爬取组件", async ({ page }) => {
  const crawler = new BlockCrawler({
    startUrl: "https://example.com/components",
    blockLocator: "xpath=//main/div/div/div",
    blockNameLocator: "role=heading[level=1] >> role=link", // 可选，默认值
    maxConcurrency: 5,
  });

  // 设置处理器并自动运行
  await crawler.onBlock(page, async (context: BlockContext) => {
    const { block, blockName, blockPath, outputDir } = context;
    // 自定义处理逻辑，可以直接使用闭包中的 page...
  });
});
```

### 页面处理模式

适用于需要处理整个页面的场景。

```typescript
import { test } from "@playwright/test";
import { BlockCrawler, type PageContext } from "./src";

test("爬取页面", async ({ page }) => {
  const crawler = new BlockCrawler({
    startUrl: "https://example.com/pages",
    maxConcurrency: 3,
    // 不传 blockLocator = 页面模式
  });

  // 设置处理器并自动运行
  await crawler.onPage(page, async (context: PageContext) => {
    const { currentPath, outputDir } = context;
    // 自定义处理逻辑，可以直接使用闭包中的 page...
  });
});
```

### 多站点爬取

框架自动根据 `startUrl` 生成独立的进度文件和输出目录，支持在同一项目中爬取多个网站：

```typescript
// 爬取网站 A
const crawlerA = new BlockCrawler({
  startUrl: "https://site-a.com/components",
  blockLocator: "xpath=//main/div",
});
// 进度文件：.crawler/progress-site-a-com-abc12345.json
// 输出目录：output/site-a-com-a1b2c3

// 爬取网站 B
const crawlerB = new BlockCrawler({
  startUrl: "https://site-b.com/library",
  blockLocator: ".component",
});
// 进度文件：.crawler/progress-site-b-com-def67890.json
// 输出目录：output/site-b-com-d4e5f6

// 同一域名不同路径也会生成不同的进度文件和输出目录
const crawlerC = new BlockCrawler({
  startUrl: "https://site-a.com/gallery",
  blockLocator: ".gallery-item",
});
// 进度文件：.crawler/progress-site-a-com-xyz98765.json
// 输出目录：output/site-a-com-x7y8z9

// 如果需要自定义输出目录，可以显式指定
const crawlerD = new BlockCrawler({
  startUrl: "https://site-b.com/library",
  blockLocator: ".component",
  outputDir: "custom-output",  // 自定义输出目录
});
```

### 扩展框架

通过继承 `BlockCrawler` 可以自定义核心逻辑：

```typescript
class CustomCrawler extends BlockCrawler {
  // 自定义获取所有 Block 的逻辑
  protected async getAllBlocks(page: Page): Promise<Locator[]> {
    return await page.locator(".custom-block").all();
  }

  // 自定义获取 Block 名称的逻辑
  protected async getBlockName(block: Locator): Promise<string | null> {
    return await block.locator(".title").textContent();
  }
}
```


## 配置选项

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `startUrl` | string | - | 起始 URL（必填，进度文件和输出目录将根据此 URL 自动生成） |
| `blockLocator` | string? | undefined | Block 定位符（传入则启用 Block 模式） |
| `blockNameLocator` | string? | `role=heading[level=1] >> role=link` | Block 名称定位符 |
| `tabListAriaLabel` | string? | undefined | 分类标签的 aria-label |
| `maxConcurrency` | number | 5 | 最大并发页面数 |
| `outputDir` | string | 自动生成 | 输出目录（不指定时根据 `startUrl` 自动生成，如 `output/example-com-a1b2c3`） |
| `configDir` | string | ".crawler" | 配置目录（存放进度文件等） |
| `enableProgressResume` | boolean | true | 是否启用进度恢复 |

### 链接收集定位符配置

用于适配不同网站的 DOM 结构，自定义链接收集逻辑。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `collectionLinkLocator` | string? | `"section > a"` | 集合链接容器定位符（在 section 下查找所有链接） |
| `collectionNameLocator` | string? | `"xpath=/div[2]/div[1]/div[1]"` | 集合名称定位符（在链接元素下查找名称） |
| `collectionCountLocator` | string? | `"xpath=/div[2]/div[1]/div[2]"` | 集合数量文本定位符（在链接元素下查找数量文本） |

**示例：shadcndesign 网站配置**

```typescript
const crawler = new BlockCrawler({
  startUrl: "https://www.shadcndesign.com/pro-blocks",
  blockLocator: "xpath=//main/div/div/div",
  // 自定义定位符以适配 shadcndesign 的 DOM 结构
  collectionLinkLocator: "role=link",
  collectionNameLocator: '[data-slot="card-title"]',
  collectionCountLocator: "p",
});
```

**自动生成规则：**
- **进度文件**：根据 `startUrl` 自动生成唯一的进度文件名
  - 格式：`progress-{hostname}-{hash}.json`
  - 示例：`https://example.com/components` → `.crawler/progress-example-com-a1b2c3d4.json`
- **输出目录**：根据 `startUrl` 自动生成输出目录（如果未指定 `outputDir`）
  - 格式：`output/{hostname}-{pathhash}`（有路径时）或 `output/{hostname}`（根路径时）
  - 示例：`https://example.com/components` → `output/example-com-a1b2c3`
- 支持同一项目中爬取多个网站，每个网站有独立的进度文件和输出目录

## Context 对象

### BlockContext

```typescript
interface BlockContext {
  block: Locator;       // Block 元素
  blockPath: string;    // Block 路径（URL路径 + Block名称）
  blockName: string;    // Block 名称
  outputDir: string;    // 输出目录
}
```

**注意**：`page` 对象可以直接从闭包中使用，不需要从 context 中获取。

### PageContext

```typescript
interface PageContext {
  currentPath: string;  // 当前 URL 路径
  outputDir: string;    // 输出目录
}
```

**注意**：`page` 对象可以直接从闭包中使用，不需要从 context 中获取。

## 开发命令

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

# 版本管理（使用 changesets）
pnpm changeset        # 创建 changeset
pnpm version          # 应用 changesets 并更新版本
pnpm release          # 构建并发布
```

## 技术栈

- **Playwright** - 浏览器自动化
- **TypeScript** - 类型安全
- **p-limit** - 并发控制
- **fs-extra** - 文件操作
- **tsup** - 快速构建工具

## 版本管理

本项目使用 [Changesets](https://github.com/changesets/changesets) 进行版本管理。

### 发布流程

1. **创建 changeset**
   ```bash
   pnpm changeset
   ```
   选择版本类型（major/minor/patch）并描述更改。

2. **应用 changesets**
   ```bash
   pnpm version
   ```
   自动更新版本号和生成 CHANGELOG。

3. **发布到 npm**
   ```bash
   pnpm release
   ```
   构建并发布到 npm 仓库。

## 作为 npm 包使用

构建后，可以将 `dist` 目录发布为 npm 包：

```bash
# 发布到 npm
npm publish

# 或发布到私有仓库
npm publish --registry https://your-registry.com
```

其他项目中使用：

```bash
npm install block-crawler-framework
```

```typescript
import { BlockCrawler } from "block-crawler-framework";
```

## License

ISC

## 贡献

欢迎提交 Issue 和 Pull Request！

