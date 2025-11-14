# Block Crawler Framework

基于 Playwright 的通用 Block 爬虫框架，支持受限并发、进度恢复、单页面或单 Block 处理模式。

## ✨ 特性

🎯 **三种模式** - Block 模式、页面模式、测试模式自由切换  
🚀 **受限并发** - 可配置并发数，避免封禁  
💾 **进度恢复** - 支持中断后继续爬取，自动跳过已完成任务  
⚙️ **完全配置化** - 所有参数可配置，支持函数覆盖  
🏗️ **模块化架构** - 单一职责原则，易于维护和扩展  
📦 **自动化管理** - 自动生成进度文件和输出目录  
🔧 **灵活扩展** - 支持配置函数覆盖，无需继承子类  
💉 **脚本注入** - 支持在并发页面中注入自定义 JavaScript 脚本  
🧪 **快速测试** - 测试模式快速验证单个组件的提取逻辑  
🌍 **国际化支持** - 完整的中英文日志输出，可通过 locale 配置切换

## 📦 安装

```bash
npm install @huaguang/block-crawler
# 或
pnpm add @huaguang/block-crawler
# 或
yarn add @huaguang/block-crawler
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
│   ├── ScriptInjector.ts         # 脚本注入 (~110 行)
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
- **ScriptInjector** - 脚本注入管理，支持在并发页面注入自定义脚本
- **CrawlerOrchestrator** - 协调各模块，管理并发和进度
- **TaskProgress** - 进度记录和恢复
- **I18n** - 国际化支持，中英文日志切换
- **BlockCrawler** - 提供简洁的公共 API

## 🚀 快速开始

### Block 处理模式

适用于需要提取页面中多个 Block 的场景。

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "@huaguang/block-crawler";

test("爬取组件", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawler = new BlockCrawler(page, {
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

  // 链式调用 Block 处理模式
  await crawler
    .blocks("xpath=//main/div/div/div")  // Block 定位符
    .before(async (currentPage) => {
      // 可选：前置逻辑，在匹配页面所有 Block 之前执行
      await currentPage.getByRole('button', { name: 'Show All' }).click();
      await currentPage.waitForTimeout(1000); // 等待动画完成
    })
    .each(async ({ block, blockName, blockPath, outputDir, currentPage }) => {
      // 处理每个 Block
      const code = await block.textContent();
      await fse.outputFile(`${outputDir}/${blockPath}.txt`, code);
    });
});
```

### 页面处理模式

适用于需要处理整个页面的场景。

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "@huaguang/block-crawler";

test("爬取页面", async ({ page }) => {
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com/pages",
    maxConcurrency: 3,
    collectionNameLocator: ".page-title",
    collectionCountLocator: ".page-count",
  });

  await crawler
    .pages()
    .each(async ({ currentPath, outputDir, currentPage }) => {
      const title = await currentPage.title();
      console.log(`处理页面: ${currentPath}, 标题: ${title}`);
    });
});
```

### 测试模式

**专为快速测试单个组件的提取逻辑设计**，无需运行完整的爬虫流程。

**特点：**
- 跳过链接收集阶段，直接访问指定页面
- 支持指定 blockName 或使用第一个匹配的 section
- 应用 `collectionLinkWaitOptions` 和 `scriptInjection` 配置
- 完全独立，不与 Block/Page 模式并行

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "@huaguang/block-crawler";
import fse from "fs-extra";

test("测试组件提取", async ({ page }) => {
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com/components", // 仍需提供（用于输出目录）
    collectionLinkWaitOptions: {
      waitUntil: "networkidle",
    },
    scriptInjection: {
      scripts: ['custom.js'],
      timing: 'afterPageLoad'
    }
  });

  // 基础用法：测试第一个匹配的组件
  await crawler
    .test(
      "https://example.com/components/buttons",  // 页面 URL（必填）
      "[data-preview]"                            // 所有 blockSection 的定位符（必填）
    )
    .run(async ({ section, blockName, currentPage, outputDir }) => {
      console.log(`测试组件: ${blockName}`);
      const code = await section.locator('pre').textContent();
      await fse.outputFile(`${outputDir}/test-${blockName}.tsx`, code ?? '');
    });
});

test("测试指定组件", async ({ page }) => {
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com/components",
  });

  // 指定 blockName
  await crawler
    .test(
      "https://example.com/components/buttons",
      "[data-preview]",
      "Primary Button"  // 指定组件名称（可选）
    )
    .before(async (currentPage) => {
      // 可选：在提取前执行操作
      await currentPage.getByRole('tab', { name: 'Code' }).click();
      await currentPage.waitForTimeout(500);
    })
    .run(async ({ section, blockName, currentPage, outputDir }) => {
      console.log(`测试组件: ${blockName}`);
      // 执行测试逻辑
    });
});
```

**使用场景：**
- 🔍 快速验证组件提取逻辑是否正确
- 🐛 调试特定组件的代码提取问题
- 🧪 开发新的提取规则前进行实验
- ⚡ 无需等待完整爬虫流程即可测试

**注意：** 测试模式与 Block/Page 模式互斥，同一时间只能使用一种模式。

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

### 脚本注入配置

支持在并发访问的页面中注入自定义 JavaScript 脚本，可用于修改页面行为、注入工具函数等。

**特性：**
- ✅ 支持普通 JavaScript 脚本
- ✅ 支持油猴（Tampermonkey）脚本格式
- ✅ 自动识别并处理油猴脚本元数据
- ✅ 提供完整的油猴API polyfill

**注意：** `startUrl` 的初始页面不会注入脚本，只有并发访问的链接页面会注入。

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `scriptInjection` | `object?` | 脚本注入配置 |
| `scriptInjection.scripts` | `string[]` | 要注入的脚本文件名列表，从 `.crawler/域名/` 目录读取 |
| `scriptInjection.timing` | `'beforePageLoad' \| 'afterPageLoad'` | 注入时机，默认 `'afterPageLoad'` |

```typescript
// 脚本注入示例
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  scriptInjection: {
    scripts: ['custom-script.js', 'utils.js'],  // 从 .crawler/example.com/ 读取
    timing: 'afterPageLoad'  // 或 'beforePageLoad'
  }
});
```

**注入时机说明：**
- `beforePageLoad`：在页面加载前注入（使用 `addInitScript`），适合需要在页面初始化前执行的脚本
- `afterPageLoad`：在页面加载完成后注入（在 `goto` 之后执行），适合操作已加载的 DOM

#### 普通脚本示例

`.crawler/example.com/custom-script.js`：
```javascript
// 在控制台输出信息
console.log('🎨 Custom script injected!');

// 添加自定义属性到 body
document.body.setAttribute('data-script-injected', 'true');

// 注入工具函数
window.customUtils = {
  log: (msg) => console.log(`[Custom] ${msg}`)
};
```

#### 油猴脚本支持

框架完全支持油猴脚本格式，自动处理元数据并提供以下API的polyfill：

**支持的油猴API：**
- `GM_addStyle(css)` - 添加CSS样式
- `GM_getValue(key, defaultValue)` - 获取存储值
- `GM_setValue(key, value)` - 设置存储值
- `GM_deleteValue(key)` - 删除存储值
- `GM_listValues()` - 列出所有存储键
- `GM_xmlhttpRequest(details)` - 发起网络请求
- `GM_info` - 脚本信息对象
- `GM_log(message)` - 日志输出
- `unsafeWindow` - 原始window对象

**支持的油猴元数据：**
- `@run-at` - 指定脚本执行时机
  - `document-start` → 页面加载前执行（`beforePageLoad`）
  - `document-end` → 页面加载后执行（`afterPageLoad`）
  - `document-idle` → 页面加载后执行（`afterPageLoad`）

**执行时机优先级：**
1. 配置的 `timing` 参数（如果指定）
2. 油猴脚本的 `@run-at` 元数据
3. 默认值 `afterPageLoad`

**油猴脚本示例 1：修改链接颜色（`.crawler/example.com/change-link-color.js`）**

```javascript
// ==UserScript==
// @name         修改链接颜色
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  修改所有链接的颜色为红色
// @author       你
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 使用 GM_addStyle 插入自定义 CSS
    GM_addStyle(`
        a {
            color: red !important;
        }
    `);
})();
```

**说明：** 此脚本指定了 `@run-at document-start`，会在页面加载前执行。如果配置中设置了 `timing` 参数，则以配置为准。

**油猴脚本示例 2：访问计数器**

```javascript
// ==UserScript==
// @name         计数器
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    // 读取计数
    const count = GM_getValue('visitCount', 0);
    console.log('访问次数:', count);
    
    // 更新计数
    GM_setValue('visitCount', count + 1);
})();
```

**说明：** 此脚本指定了 `@run-at document-end`，会在 DOM 加载完成后执行。

**注意：**
- 油猴脚本的 `// ==UserScript==` 元数据会被自动识别和处理
- 不需要修改现有的油猴脚本，直接使用即可
- 存储API使用 `sessionStorage` 模拟，数据在浏览器会话期间保持
- `GM_xmlhttpRequest` 使用原生 `fetch` 实现，可能不支持所有油猴的高级特性

### 高级配置（函数覆盖）

支持通过配置函数来覆盖默认行为，无需继承子类：

| 配置项 | 类型 | 默认行为 | 说明 |
|--------|------|----------|------|
| `getTabSection` | `(page: Page, tabText: string) => Locator` | - | 获取 Tab 对应的 Section |
| `getAllTabTexts` | `(page: Page) => Promise<string[]>` | - | 直接返回所有 Tab 文本（跳过点击） |
| `getAllBlocks` | `(page: Page) => Promise<Locator[]>` | - | 获取所有 Block 元素 |
| `getBlockName` | `(block: Locator) => Promise<string \| null>` | `getByRole('heading')` | 获取 Block 名称 |

**getBlockName 默认逻辑：**
1. 优先使用配置的 `getBlockName` 函数
2. 如果配置了非默认的 `blockNameLocator`，使用它
3. 默认逻辑：使用 `block.getByRole('heading')` 查找 heading 元素
   - 如果 heading 内部子元素 > 1（结构复杂），自动提取内部的 link 文本
   - 如果 heading 内部子元素 ≤ 1，直接取 heading 的文本内容
   - 如果结构复杂但未找到 link，会抛出错误提示配置 `getBlockName` 或 `blockNameLocator`

### Block 前置逻辑

`.before()` 方法用于在匹配页面所有 Block 之前执行前置逻辑，是链式调用中的可选步骤：

**函数签名：**
```typescript
.before(handler: (currentPage: Page) => Promise<void>)
```

**参数说明：**
- `currentPage`：当前正在处理的页面（可能是新创建的页面，而不是原始测试 page）

**使用场景：**
- 点击按钮展开隐藏的内容
- Toggle 切换显示更多选项
- 滚动页面触发懒加载
- 等待动画或过渡完成

**示例：**
```typescript
await crawler
  .blocks("[data-preview]")
  .before(async (currentPage) => {
    // 前置逻辑：点击"显示全部"按钮
    await currentPage.getByRole('button', { name: 'Show All' }).click();
    await currentPage.waitForTimeout(500); // 等待动画
  })
  .each(async ({ block, blockName }) => {
    // 处理 Block
  });
```

**示例：shadcndesign 配置**

```typescript
const crawler = new BlockCrawler(page, {
  startUrl: "https://www.shadcndesign.com/pro-blocks",
  maxConcurrency: 5,
  collectionNameLocator: '[data-slot="card-title"]',
  collectionCountLocator: "p",
  
  // 使用配置函数，无需继承子类
  getTabSection: (page, tabText) => {
    return page.getByRole("tabpanel", { name: tabText });
  },
});

await crawler
  .blocks("xpath=//main/div/div/div")
  .each(async ({ block, blockName }) => {
    // 处理逻辑
  });
```

**示例：直接提供所有 Tab 文本**

```typescript
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  
  // 直接返回所有 Tab 文本，跳过 Tab 点击
  getAllTabTexts: async (page) => {
    return ["Button", "Input", "Card", "Modal"];
  },
  
  getTabSection: (page, tabText) => {
    return page.locator(`[data-category="${tabText}"]`);
  },
});

await crawler
  .blocks(".block")
  .each(async ({ block }) => {
    // 处理逻辑
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
