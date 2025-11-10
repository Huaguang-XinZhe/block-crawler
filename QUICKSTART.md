# 快速开始指南

## 框架已创建完成 ✅

Block Crawler Framework 已成功创建并提交到 `feature/crawler-framework` 分支。

## 项目结构

```
📦 block-crawler-framework
├── 📂 src/                       # 框架源代码
│   ├── index.ts                  # 导出接口
│   ├── types.ts                  # 类型定义
│   ├── crawler.ts                # 核心爬虫类
│   └── utils/
│       ├── task-progress.ts      # 进度管理
│       └── extract-code.ts       # 代码提取工具
├── 📂 tests/                     # 测试和示例
│   ├── main.spec.ts              # 原始实现（参考）
│   ├── main-with-framework.spec.ts  # ✨ Block 模式示例
│   └── page-mode-example.spec.ts    # ✨ 页面模式示例
├── 📂 dist/                      # 构建产物
│   ├── index.js / index.cjs
│   └── index.d.ts / index.d.cts
├── 📄 README.md                  # 项目说明
├── 📄 FRAMEWORK.md               # 详细文档
└── 📄 package.json               # 包配置
```

## 立即开始

### 1. Block 处理模式（推荐用于组件爬取）

```typescript
import { test } from "@playwright/test";
import { BlockCrawler, type BlockContext } from "../src";

test("爬取组件", async ({ page }) => {
  // 1️⃣ 创建爬虫实例并配置
  const crawler = new BlockCrawler({
    startUrl: "https://pro.mufengapp.cn/components",
    tabListAriaLabel: "Categories",
    maxConcurrency: 5,
    blockLocator: "xpath=//main/div/div/div", // 指定 Block 定位符
    outputDir: "output",
    enableProgressResume: true,
  });

  // 2️⃣ 设置 Block 处理逻辑
  crawler.onBlock(async (context: BlockContext) => {
    // 只需关注单个 Block 的处理
    const { block, blockName, page } = context;
    console.log(`处理: ${blockName}`);
    
    // 你的爬取逻辑...
  });

  // 3️⃣ 运行
  await crawler.run(page);
});
```

### 2. 页面处理模式（用于整页爬取）

```typescript
import { test } from "@playwright/test";
import { BlockCrawler, type PageContext } from "../src";

test("爬取页面", async ({ page }) => {
  const crawler = new BlockCrawler({
    startUrl: "https://example.com/pages",
    maxConcurrency: 3,
    // 不传 blockLocator = 页面模式
  });

  crawler.onPage(async (context: PageContext) => {
    // 处理整个页面
    const { page, currentPath } = context;
    console.log(`处理: ${currentPath}`);
    
    // 你的爬取逻辑...
  });

  await crawler.run(page);
});
```

## 核心优势

### ✅ 配置化

**之前（388 行）：**
```typescript
const START_URL = "https://...";
const MAX_PAGE_COUNT = 5;
const OUTPUT_DIR = "output";
// ... 硬编码在代码中
```

**现在：**
```typescript
const crawler = new BlockCrawler({
  startUrl: "https://...",
  maxConcurrency: 5,
  outputDir: "output",
  // ... 清晰的配置对象
});
```

### ✅ 关注点分离

**之前：** 需要处理标签遍历、链接收集、并发控制、进度管理等所有细节

**现在：** 只需关注核心业务逻辑（Block 或页面处理）

```typescript
crawler.onBlock(async (context) => {
  // 只写你的处理逻辑
});
```

### ✅ 可复用

框架可用于不同网站，只需更改配置和处理逻辑：

```typescript
// 网站 A
const crawlerA = new BlockCrawler({
  startUrl: "https://site-a.com",
  blockLocator: "xpath=//main/div",
});

// 网站 B
const crawlerB = new BlockCrawler({
  startUrl: "https://site-b.com",
  blockLocator: ".component-block",
});
```

## 运行示例

```bash
# 1. 构建框架
pnpm build

# 2. 运行 Block 模式示例
pnpm test tests/main-with-framework.spec.ts

# 3. 运行页面模式示例
pnpm test tests/page-mode-example.spec.ts

# 4. 对比原始实现
pnpm test tests/main.spec.ts
```

## 配置参数说明

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `startUrl` | ✅ | - | 起始网址 |
| `blockLocator` | ❌ | undefined | Block 定位符（传入=Block 模式） |
| `tabListAriaLabel` | ❌ | undefined | 分类标签的 aria-label |
| `maxConcurrency` | ❌ | 5 | 最大并发页面数 |
| `outputDir` | ❌ | "output" | 输出目录 |
| `progressFile` | ❌ | "progress.json" | 进度文件 |
| `timeout` | ❌ | 120000 | 超时（毫秒） |
| `enableProgressResume` | ❌ | true | 启用进度恢复 |

## Context 对象

### BlockContext（Block 模式）

```typescript
interface BlockContext {
  page: Page;           // 当前页面
  block: Locator;       // Block 元素
  currentPath: string;  // 当前路径
  blockName: string;    // Block 名称
  blockPath: string;    // Block 完整路径
  outputDir: string;    // 输出目录
}
```

### PageContext（页面模式）

```typescript
interface PageContext {
  page: Page;           // 当前页面
  currentPath: string;  // 当前路径
  outputDir: string;    // 输出目录
}
```

## 进阶功能

### 自定义 Block 名称获取

```typescript
import { BlockCrawler } from "../src";

class CustomCrawler extends BlockCrawler {
  protected async getBlockName(block: Locator): Promise<string | null> {
    // 自定义获取逻辑
    return await block.locator(".title").textContent();
  }
}
```

### 禁用进度恢复

```typescript
const crawler = new BlockCrawler({
  // ...
  enableProgressResume: false,
});
```

### 获取进度信息

```typescript
const progress = crawler.getTaskProgress();
console.log(`已完成: ${progress?.getCompletedCount()}`);
```

## 发布为 npm 包

```bash
# 1. 更新 package.json 中的 name 和 version
# 2. 构建
pnpm build

# 3. 发布
npm publish
```

## 下一步

1. ✅ 框架已创建并提交到 `feature/crawler-framework` 分支
2. 📝 查看 `FRAMEWORK.md` 了解详细文档
3. 🧪 运行示例文件测试框架
4. 🎨 根据需求自定义处理逻辑
5. 🚀 发布为 npm 包供其他项目使用

## 反馈与支持

如有问题或建议，欢迎提 Issue！

---

**享受简洁高效的爬虫开发体验！** 🎉

