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
    
    // 配置进度恢复（可选）
    progress: {
      enable: true,  // 启用进度恢复，默认 true
      rebuild: {
        blockType: 'file',  // 'file' | 'directory'，默认 'file'
        saveToProgress: true,  // 是否保存重建的进度，默认 true
        // 可选：自定义 block 完整性检查
        checkBlockComplete: async (blockPath, outputDir) => {
          // 自定义逻辑...
          return true;
        }
      }
    },
  });

  // 链式调用 Block 处理模式
  await crawler
    .blocks("xpath=//main/div/div/div")  // Block 定位符
    // 可选：{ verifyBlockCompletion: false } (默认true，生产环境可关闭)
    .before(async ({ currentPage, clickAndVerify }) => {
      // 可选：前置逻辑，在匹配页面所有 Block 之前执行
      
      // 使用 clickAndVerify 确保点击生效（自动重试）
      await clickAndVerify(
        currentPage.getByRole('button', { name: 'Show All' })
      );
      await currentPage.waitForTimeout(1000); // 等待动画完成
    })
    .each(async ({ block, blockName, blockPath, safeOutput, currentPage, clickCode }) => {
      // 使用 clickCode 点击 Code 标签（自动验证和重试）
      await clickCode();
      
      // 处理每个 Block
      const code = await block.textContent();
      // 使用 safeOutput 安全输出（自动处理文件名 sanitize）
      await safeOutput(code ?? '', `${blockPath}.txt`);
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

**专为快速测试单个页面的提取逻辑设计**，无需运行完整的爬虫流程。

**特点：**
- 跳过链接收集阶段，直接访问指定页面
- 不进行并发处理，只处理指定的测试页面
- 支持 page 和 block 处理器
- 完全独立，不与收集阶段关联

```typescript
import { test } from "@playwright/test";
import { BlockCrawler } from "@huaguang/block-crawler";

test("测试页面提取", async ({ page }) => {
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com/components", // 用于生成输出目录
  });

  // 在 open() 中指定 testUrl，即可进入测试模式
  await crawler
    .open("https://example.com/components/buttons", "load")
    .page({
      autoScroll: true, // 启用自动滚动
      handler: async ({ currentPage, safeOutput }) => {
        console.log("页面处理逻辑");
        // 执行页面级操作
      }
    })
    .block("[data-preview]", async ({ block, blockName, safeOutput, clickCode }) => {
      console.log(`测试 block: ${blockName}`);
      
      // 使用 clickCode 点击 Code 按钮
      await clickCode();
      
      // 获取代码内容
      const code = await block.locator('pre').textContent();
      
      // 使用 safeOutput 安全输出（自动处理文件名 sanitize）
      await safeOutput(code ?? '');
    })
    .run();
});
```

**使用场景：**
- 🔍 快速验证单个页面的提取逻辑是否正确
- 🐛 调试特定页面的代码提取问题
- 🧪 开发新的提取规则前进行实验
- ⚡ 无需等待完整爬虫流程即可测试

**注意：** 当在 `open()` 中指定了 testUrl，框架会自动进入测试模式，忽略收集阶段配置。

## ⚙️ 配置选项

### Blocks 方法选项

`blocks()` 方法支持可选的第二个参数，用于配置Block 模式行为：

```typescript
crawler.blocks(sectionLocator: string, options?: BlockModeOptions)
```

| 选项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `verifyBlockCompletion` | `boolean` | `true` | 验证 Block 采集完整性 |

**功能说明：**

当开启时（默认），框架会在关闭页面前验证Block 采集完整性：
- 记录定位到的 block 总数（预期数量）
- 记录实际处理的 block 数量
- 如果不一致：
  - **Debug 模式**：调用 `page.pause()` 暂停并打印详细信息
  - **非 Debug 模式**：只打印详细信息，提示使用 `--debug` 进行调试

**使用示例：**

```typescript
// 默认开启验证（推荐用于开发/调试）
await crawler.blocks("[data-preview]").each(...);

// 生产环境关闭验证
await crawler.blocks("[data-preview]", { verifyBlockCompletion: false }).each(...);
```

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `startUrl` | `string` | - | 起始 URL（必填） |
| `locale` | `'zh' \| 'en'` | `'zh'` | 日志语言（中文或英文） |
| `tabListAriaLabel` | `string?` | undefined | 分类标签的 aria-label |
| `maxConcurrency` | `number` | 5 | 最大并发页面数 |
| `outputDir` | `string` | "output" | 输出目录（会自动在此目录下创建域名子目录） |
| `stateDir` | `string` | ".crawler" | 状态目录（存放进度文件和网站元信息，会自动创建域名子目录） |
| `progress` | `ProgressConfig` | `{ enable: true }` | 进度恢复配置（见进度恢复配置部分） |
| `blockNameLocator` | `string` | `role=heading[level=1] >> role=link` | Block 名称定位符 |

### 并发配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `useIndependentContext` | `boolean` | `false` | 使用独立的浏览器上下文 |
| `maxConcurrency` | `number` | 5 | 最大并发页面数 |

**useIndependentContext 功能说明：**

当开启时，每个并发页面会创建独立的 `BrowserContext`，完全隔离各页面状态。

**优点：**
- ✅ 完全隔离，避免状态污染
- ✅ 点击、输入等操作更稳定
- ✅ 适合高并发场景

**缺点：**
- ⚠️ 内存占用略高
- ⚠️ 无法共享 cookies/storage

**使用场景：**
- 并发爬取时遇到点击失效、状态混乱
- 需要完全隔离的页面环境

**使用示例：**

```typescript
// 并发场景开启（推荐）
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  useIndependentContext: true,  // 开启独立 context
  maxConcurrency: 5,
  // ... 其他配置
});
```

### 调试配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `pauseOnError` | `boolean` | `true` | 遇到错误时自动暂停 |

**功能说明：**

当开启时（默认），在处理过程中遇到错误（如 timeout、selector 错误等）时：
- **Debug 模式**（`--debug` 运行）：自动调用 `page.pause()` 暂停页面，方便检查
- **非 Debug 模式**：输出错误信息但不暂停，提示使用 `--debug` 进行调试

**使用场景：**
- 在 `--debug` 模式下运行时开启（默认）
- 生产环境建议关闭，避免阻塞流程

**使用示例：**

```typescript
// 开启错误暂停（默认）
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  pauseOnError: true,  // 开启错误暂停
  // ... 其他配置
});

// 生产环境关闭
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  pauseOnError: false,  // 遇到错误继续执行
  // ... 其他配置
});
```

**运行方式：**

```bash
# Debug 模式运行（遇到错误会自动暂停）
pnpm test:debug tests/example.spec.ts

# 非 Debug 模式运行（遇到错误只输出提示）
pnpm test tests/example.spec.ts
```

**错误暂停示例：**

Debug 模式（`--debug`）：
```
🛑 检测到错误，页面已暂停方便检查
   类型: Block
   位置: Button Component
   错误: Timeout 10000ms exceeded.

   💡 提示: 检查完成后，可以在全局配置中关闭 pauseOnError 以继续运行
```

非 Debug 模式：
```
❌ 检测到错误
   类型: Block
   位置: Button Component
   错误: Timeout 10000ms exceeded.

   💡 提示:
   - 使用 --debug 模式运行可以自动暂停页面进行检查
   - 或在全局配置中关闭 pauseOnError 以跳过错误继续运行
```

### 进度恢复配置

进度恢复功能支持中断后继续爬取，避免重复处理已完成的任务。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `progress.enable` | `boolean` | `true` | 是否启用进度恢复 |
| `progress.rebuild` | `ProgressRebuildConfig` | - | 进度重建配置（可选） |
| `progress.rebuild.blockType` | `'file' \| 'directory'` | `'file'` | Block 类型（文件或目录） |
| `progress.rebuild.saveToProgress` | `boolean` | `true` | 是否保存重建的进度到 progress.json |
| `progress.rebuild.checkBlockComplete` | `Function` | - | 自定义 Block 完整性检查函数 |

**功能说明：**

当 `progress.enable` 为 `true` 时：
1. 优先从 `progress.json` 加载已完成的任务
2. 如果 `progress.json` 不存在，则从输出目录重建进度
3. 重建时根据 `blockType` 智能识别已完成的 Block（支持 `.tsx`、`.ts`、`.jsx`、`.js`、`.vue`、`.svelte` 等组件文件）
4. 根据 `saveToProgress` 决定是否将重建的进度保存到 `progress.json`

当 `progress.enable` 为 `false` 时：
- 从头开始爬取（但仍会跳过 `skipFree` 配置的免费项目）

**使用示例：**

```typescript
// 基础配置（使用默认值）
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  progress: {
    enable: true  // 启用进度恢复，默认配置
  }
});

// 完整配置（针对目录类型的 Block）
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  progress: {
    enable: true,
    rebuild: {
      blockType: 'directory',  // Block 是目录而非文件
      saveToProgress: true,
      // 自定义完整性检查（可选）
      checkBlockComplete: async (blockPath, outputDir) => {
        const fullPath = path.join(outputDir, blockPath);
        // 检查目录中是否有特定文件
        return fs.existsSync(path.join(fullPath, 'index.tsx'));
      }
    }
  }
});

// 禁用进度恢复（从头开始）
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  progress: {
    enable: false
  }
});
```

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
| `scriptInjection.script` | `string?` | 单个脚本文件名，从 `.crawler/域名/` 目录读取 |
| `scriptInjection.scripts` | `string[]?` | 多个脚本文件名列表，从 `.crawler/域名/scripts/` 目录读取 |
| `scriptInjection.timing` | `'beforePageLoad' \| 'afterPageLoad'?` | 注入时机，默认 `'afterPageLoad'` |

**注意：** `script` 和 `scripts` 不能同时设置，必须选择其中一个。

```typescript
// 示例 1：单个脚本（从根目录）
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  scriptInjection: {
    script: 'custom-script.js',  // 从 .crawler/example.com/ 读取
    timing: 'afterPageLoad'
  }
});

// 示例 2：多个脚本（从 scripts 子目录）
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  scriptInjection: {
    scripts: ['utils.js', 'helpers.js'],  // 从 .crawler/example.com/scripts/ 读取
    timing: 'afterPageLoad'
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
.before(handler: (context: BeforeContext) => Promise<void>)
```

**参数说明（BeforeContext）：**
- `currentPage`：当前正在处理的页面（可能是新创建的页面，而不是原始测试 page）
- `clickAndVerify`：智能点击函数，自动验证点击效果并重试
- `clickCode`：专用于点击 Code 标签的函数（内部使用 `clickAndVerify`）

**使用场景：**
- 点击按钮展开隐藏的内容
- Toggle 切换显示更多选项
- 滚动页面触发懒加载
- 等待动画或过渡完成

**示例 1：基础使用**
```typescript
await crawler
  .blocks("[data-preview]")
  .before(async ({ currentPage }) => {
    // 前置逻辑：点击"显示全部"按钮
    await currentPage.getByRole('button', { name: 'Show All' }).click();
    await currentPage.waitForTimeout(500); // 等待动画
  })
  .each(async ({ block, blockName }) => {
    // 处理 Block
  });
```

**示例 2：使用 clickAndVerify（推荐）**
```typescript
await crawler
  .blocks("[data-preview]")
  .before(async ({ currentPage, clickAndVerify }) => {
    // 使用 clickAndVerify 确保点击生效（自动验证 tab 的 aria-selected）
    await clickAndVerify(
      currentPage.getByRole('tab', { name: 'React' })
    );
    
    // 或自定义验证逻辑
    await clickAndVerify(
      currentPage.getByRole('button', { name: 'Show All' }),
      async () => {
        // 验证按钮是否已展开
        return await currentPage.locator('.expanded').isVisible();
      },
      { timeout: 5000, retries: 3 }  // 可选配置
    );
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
  safeOutput: SafeOutput; // 安全输出函数（自动处理文件名 sanitize，默认路径：${outputDir}/${blockPath}.tsx）
  clickAndVerify: ClickAndVerify; // 智能点击函数（自动验证和重试）
  clickCode: ClickCode; // 点击 Code 标签的专用函数
}
```

### TestContext

```typescript
interface TestContext {
  currentPage: Page;    // 当前页面实例
  section: Locator;     // 目标 section
  blockName: string;    // Block 名称
  outputDir: string;    // 输出目录
  safeOutput: SafeOutput; // 安全输出函数（自动处理文件名 sanitize，默认路径：${outputDir}/test-${blockName}.tsx）
  clickAndVerify: ClickAndVerify; // 智能点击函数（自动验证和重试）
  clickCode: ClickCode; // 点击 Code 标签的专用函数
}
```

### PageContext

```typescript
interface PageContext {
  currentPage: Page;    // 当前页面实例（可能是新打开的页面）
  currentPath: string;  // 当前 URL 路径
  outputDir: string;    // 输出目录
  safeOutput: SafeOutput; // 安全输出函数（自动处理文件名 sanitize，需要显式传入 filePath）
  clickAndVerify: ClickAndVerify; // 智能点击函数（自动验证和重试）
  clickCode: ClickCode; // 点击 Code 标签的专用函数
}
```

### BeforeContext

```typescript
interface BeforeContext {
  currentPage: Page;    // 当前页面实例
  clickAndVerify: ClickAndVerify; // 智能点击函数（自动验证和重试）
}
```

### ClickAndVerify 类型

```typescript
type ClickAndVerify = (
  locator: Locator,
  verifyFn?: () => Promise<boolean>,
  options?: { timeout?: number; retries?: number }
) => Promise<void>;
```

**功能说明：**
- 自动验证点击效果并重试（默认 3 次）
- 如果未提供 `verifyFn`，会根据元素 `role` 智能选择验证逻辑：
  - `role="tab"`：检查 `aria-selected="true"`
  - 其他元素：检查 `isVisible()`
- 在调试模式下，失败时会自动暂停页面供用户检查
- 支持国际化日志输出

**使用示例：**
```typescript
// 自动验证（tab 自动检查 aria-selected）
await clickAndVerify(page.getByRole('tab', { name: 'Code' }));

// 自定义验证
await clickAndVerify(
  page.getByRole('button', { name: 'Expand' }),
  async () => await page.locator('.content').isVisible(),
  { timeout: 5000, retries: 3 }
);
```

### ClickCode 类型

```typescript
type ClickCode = (
  locator?: Locator,
  options?: { timeout?: number; retries?: number }
) => Promise<void>;
```

**功能说明：**
- 专用于点击 "Code" 标签的便捷函数
- 默认定位符：`getByRole('tab', { name: 'Code' })`
- 内部使用 `clickAndVerify` 实现，自动验证和重试

**使用示例：**
```typescript
// 使用默认定位符
await clickCode();

// 使用自定义定位符
await clickCode(page.getByRole('tab', { name: 'React' }));

// 配置超时和重试
await clickCode(undefined, { timeout: 5000, retries: 5 });
```

## 📝 安全文件输出

框架提供了 `safeOutput` 函数，用于安全地写入文件，自动处理文件名中的非法字符。

### 特性

- ✅ **自动文件名清理** - 移除或替换非法字符（`< > : " / \ | ? *` 等）
- ✅ **智能默认路径** - 根据模式自动生成默认路径
- ✅ **路径 sanitize** - 所有路径（包括用户传入的）都会自动 sanitize
- ✅ **跨平台兼容** - 确保在 Windows、macOS、Linux 上都能正常工作

### 使用方式

```typescript
// Block 模式 - 使用默认路径
await crawler
  .blocks("[data-preview]")
  .each(async ({ block, safeOutput }) => {
    const code = await extractCode(block);
    await safeOutput(code); // 默认路径：${outputDir}/${blockPath}.tsx
  });

// Test 模式 - 使用默认路径
await crawler
  .test("https://example.com/page", "[data-preview]", 1)
  .run(async ({ section, safeOutput }) => {
    const code = await extractCode(section);
    await safeOutput(code); // 默认路径：${outputDir}/test-${blockName}.tsx
  });

// 自定义路径（也会自动 sanitize）
await safeOutput(code, "custom/path/to/file.tsx");

// Page 模式 - 必须显式传入路径
await crawler
  .pages()
  .each(async ({ safeOutput }) => {
    const content = await extractContent();
    await safeOutput(content, "page-content.html");
  });
```

### 解决的问题

当组件名包含特殊字符时（如 `"Step 1: Forgot password"`），直接使用 `fse.outputFile` 可能会导致：
- ❌ 文件名被截断
- ❌ 内容无法写入
- ❌ 文件系统异常

使用 `safeOutput` 可以自动处理这些问题，确保文件安全写入。

### 文件名映射

框架会自动在 `.crawler/域名/filename-mapping.json` 中记录文件名 sanitize 前后的对应关系，方便从 sanitize 后的文件名反推出原始组件名。

**映射文件位置：**
```
.crawler/
└── www.untitledui.com/
    ├── progress.json
    ├── meta.json
    └── filename-mapping.json  # 文件名映射文件
```

**使用示例：**

```typescript
import { FilenameMappingManager } from "@huaguang/block-crawler";

// 从 sanitize 后的文件名获取原始文件名
const original = await FilenameMappingManager.getOriginal(
  ".crawler/www.untitledui.com",
  "test-Step_1__Forgot_password.tsx"
);
// 返回: "test-Step 1: Forgot password.tsx"

// 加载所有映射
const mapping = await FilenameMappingManager.load(".crawler/www.untitledui.com");
// 返回: { 
//   "test-Step_1__Forgot_password.tsx": "test-Step 1: Forgot password.tsx",
//   ...
// }
```

**特性：**
- ✅ 自动记录：当文件名被 sanitize 改变时自动记录
- ✅ 避免冗余：仅在文件名发生变化时记录
- ✅ 原子写入：使用原子写入确保数据一致性
- ✅ 易于查询：提供静态方法方便外部查询

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
│   │   ├── progress.json  # 进度文件
│   │   ├── meta.json      # 元信息文件
│   │   └── filename-mapping.json  # 文件名映射文件
│   └── site-a.com/
│       ├── progress.json
│       ├── meta.json
│       └── filename-mapping.json
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

## 💡 点击稳定性最佳实践

在并发环境下，点击操作可能会因为各种原因失效。框架提供了多种方案确保点击稳定性。

### 方案 1：使用 clickAndVerify / clickCode（推荐）

框架内置了 `clickAndVerify` 和 `clickCode` 函数，自动处理点击验证和重试：

```typescript
await crawler
  .blocks("[data-preview]")
  .before(async ({ currentPage, clickAndVerify }) => {
    // 使用 clickAndVerify 确保点击生效（自动验证和重试）
    await clickAndVerify(
      currentPage.getByRole('tab', { name: 'React' })
      // tab 元素会自动验证 aria-selected="true"
    );
  })
  .each(async ({ block, clickCode, safeOutput }) => {
    // 使用 clickCode 点击 Code 标签（内置验证和重试）
    await clickCode();
    
    const code = await extractCodeFromDOM(block);
    await safeOutput(code);
  });
```

**特性：**
- ✅ 自动验证点击效果（tab 自动检查 `aria-selected`）
- ✅ 失败自动重试（默认 3 次）
- ✅ 调试模式自动暂停供检查
- ✅ 国际化日志输出
- ✅ 捕获点击超时并重试

### 方案 2：使用独立 Context

```typescript
const crawler = new BlockCrawler(page, {
  startUrl: "https://example.com/components",
  useIndependentContext: true,  // 🔥 开启独立 context
  maxConcurrency: 5,
});
```

### 总结

| 方案 | 优点 | 适用场景 |
|------|------|----------|
| clickAndVerify / clickCode | 自动验证和重试，容错性强 | 所有点击场景（推荐） |
| 独立 Context | 完全隔离，避免状态污染 | 高并发场景 |
| pauseOnError | 错误时暂停调试 | 开发调试阶段 |

**建议组合使用：**
```typescript
const crawler = new BlockCrawler(page, {
  useIndependentContext: true,  // 独立 context，避免状态污染
  pauseOnError: true,           // 遇到错误暂停检查
});

await crawler
  .blocks("[data-preview]")
  .each(async ({ block, clickCode, safeOutput }) => {
    // 使用内置的 clickCode，自动验证和重试
    await clickCode();
    
    const code = await extractCodeFromDOM(block);
    await safeOutput(code);
  });
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
