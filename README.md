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
│   ├── main-with-framework.spec.ts  # Block 模式示例
│   └── page-mode-example.spec.ts    # 页面模式示例
├── dist/                         # 构建输出目录
└── output/                       # 爬取结果输出目录
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

**Block 处理模式示例：**

```bash
pnpm test tests/main-with-framework.spec.ts
```

**页面处理模式示例：**

```bash
pnpm test tests/page-mode-example.spec.ts
```

**原始实现（对比参考）：**

```bash
pnpm test tests/main.spec.ts
```

## 快速开始

### Block 处理模式

适用于需要处理页面中多个相似组件的场景。

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

  crawler.onBlock(async (context: BlockContext) => {
    const { block, blockName, currentPath, outputDir } = context;
    // currentPath = URL路径 + blockName
    // 自定义处理逻辑...
  });

  await crawler.run(page);
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

  crawler.onPage(async (context: PageContext) => {
    const { page, currentPath, outputDir } = context;
    // 自定义处理逻辑...
  });

  await crawler.run(page);
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

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `startUrl` | string | - | 起始 URL（必填） |
| `blockLocator` | string? | undefined | Block 定位符（传入则启用 Block 模式） |
| `blockNameLocator` | string? | `role=heading[level=1] >> role=link` | Block 名称定位符 |
| `tabListAriaLabel` | string? | undefined | 分类标签的 aria-label |
| `maxConcurrency` | number | 5 | 最大并发页面数 |
| `outputDir` | string | "output" | 输出目录 |
| `progressFile` | string | "progress.json" | 进度文件路径 |
| `timeout` | number | 120000 | 超时时间（毫秒） |
| `enableProgressResume` | boolean | true | 是否启用进度恢复 |

## Context 对象

### BlockContext

```typescript
interface BlockContext {
  page: Page;           // 当前页面
  block: Locator;       // Block 元素
  currentPath: string;  // URL路径 + Block名称
  blockName: string;    // Block 名称
  outputDir: string;    // 输出目录
}
```

### PageContext

```typescript
interface PageContext {
  page: Page;           // 当前页面
  currentPath: string;  // 当前 URL 路径
  outputDir: string;    // 输出目录
}
```

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

