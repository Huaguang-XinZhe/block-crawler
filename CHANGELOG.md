# block-crawler

## 0.6.1

### Patch Changes

- 只要设置了 skipFree 就从 meta.json 中加载已知的 Free 页面

## 0.6.0

### Minor Changes

- 46f69a3: 新增智能跳过已知 Free 页面功能

  **功能说明：**

  在 `skipFree` 开启且 `enableProgressResume` 关闭的情况下，从 `meta.json` 中读取之前运行时记录的 Free 页面列表，在打开页面之前直接跳过这些页面。

  **使用场景：**

  1. **不恢复进度，但想跳过 Free 页面**

     - `skipFree: "FREE"` ✅
     - `enableProgressResume: false` ✅
     - 框架自动从 `meta.json` 加载已知 Free 页面列表

  2. **恢复进度模式**
     - `enableProgressResume: true`
     - 此功能不启用（进度恢复已经会跳过已完成页面）

  **性能提升：**

  对于已知的 Free 页面：

  - ❌ 之前：打开页面 → goto → 检查 Free → 跳过
  - ✅ 之后：**直接跳过**（不打开页面，不 goto）

  **节省时间：**

  - 每个已知 Free 页面节省 1-2 秒（避免页面打开和 goto）
  - 如果有 10 个 Free 页面，总计节省 10-20 秒

  **示例输出：**

  ```
  📋 已加载 2 个已知 Free 页面

  🚀 开始并发处理所有链接 (最大并发: 5)...

  📦 开始处理 50 个集合链接...

  🆓 跳过已知 Free 页面: Featured Icons
  🆓 跳过已知 Free 页面: Utility Buttons
  ```

  **工作流程：**

  1. **第一次运行：**

     - 访问所有页面
     - 检测到 Free 页面并记录到 `meta.json`
     - 完成后 `meta.json` 包含 Free 页面列表

  2. **后续运行：**
     - 读取 `meta.json` 中的 Free 页面列表
     - 在处理链接前直接跳过这些页面
     - 不打开页面，不执行 goto
     - 性能大幅提升

  **配置示例：**

  ```typescript
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com",
    skipFree: "FREE", // 启用 Free 检测
    enableProgressResume: false, // 关闭进度恢复
    // ... 其他配置
  });

  await crawler.block(/* ... */).run();
  ```

## 0.5.0

### Minor Changes

- 161cfa3: 统一 skipPageFree 和 skipBlockFree 为 skipFree

  **破坏性变更：**

  - 移除 `skipPageFree` 配置
  - 移除 `skipBlockFree` 配置
  - 新增统一的 `skipFree` 配置

  **新设计：**

  `skipFree` 会根据模式自动适配：

  **Page 模式：**

  - 检查页面是否有 Free 标志
  - 有则跳过整个页面

  **Block 模式：**

  1. 先检查整个页面是否有 Free 标志（说明单个 block 没有 Free 标志）
  2. 如果页面有 Free 标志，跳过所有 block
  3. 如果页面没有 Free 标志，再检查单个 block 是否有 Free 标志

  **迁移指南：**

  之前：

  ```typescript
  {
    skipPageFree: "FREE",  // Page 模式
    skipBlockFree: "FREE", // Block 模式
  }
  ```

  之后：

  ```typescript
  {
    skipFree: "FREE"; // 自动适配两种模式
  }
  ```

  **其他变更：**

  - 时间格式：`startTime` 从 ISO 格式改为本地时间格式（`2025/11/14 22:49:49`）

  **优点：**

  - 统一配置，简化使用
  - Block 模式智能处理：页面级 Free 标志会跳过所有 block
  - 更符合实际使用场景

### Patch Changes

- d3a8c77: 优化 Free 页面检测逻辑和性能

  **优化内容：**

  1. **统一 Free 页面检测（Page 和 Block 模式）**

     - 将 Free 页面检测逻辑提升到 `CrawlerOrchestrator` 中统一处理
     - 使用 `PageProcessor.checkPageFree()` 静态方法作为公共检测逻辑
     - 避免在 `PageProcessor` 和 `BlockProcessor` 中重复代码

  2. **提前检测，最大化性能**

     - 执行顺序：`goto` → **检查 Free** → 注入脚本 → 处理逻辑
     - Free 页面直接返回，不注入 afterPageLoad 脚本，不执行处理逻辑
     - Block 模式下，Free 页面不再执行 `getAllBlocks()`（节省数百毫秒）

  3. **正确记录 Free 页面**

     - 之前：Block 模式检测到 Free 页面，但未记录到 meta.json
     - 之后：Page 和 Block 模式统一记录 Free 页面
     - meta.json 中的 `freePages.total` 和 `freePages.links` 现在准确

  4. **时间格式改进**
     - 使用 `toLocaleString()` 自动适配本地时间格式
     - 更简洁，更符合系统习惯

  **性能提升：**

  对于每个 Free 页面：

  - ❌ 之前：goto → 注入脚本 → 定位 block → 检查 Free → 跳过
  - ✅ 之后：goto → 检查 Free → 直接返回

  节省时间：

  - 不注入 afterPageLoad 脚本（节省 ~50ms）
  - 不执行 `getAllBlocks()`（节省 200-500ms）
  - **总计每个 Free 页面节省 250-550ms**

  **示例输出：**

  之前（Block 模式）：

  ```
  📦 找到 7 个 Block          # 浪费时间定位 block
  🆓 跳过 Free 页面
  - Free 页面数: 0            # 未记录
  ```

  之后（Block 模式）：

  ```
  🆓 跳过 Free 页面            # 直接跳过，不定位 block，不注入脚本
  - Free 页面数: 2            # 正确记录
  ```

## 0.4.1

### Patch Changes

- a1eac9a: 重构 Free 跳过逻辑

  **行为变更：**

  - `skipPageFree`: 检测到 Free 页面时，**直接跳过** `each` handler 执行（之前会执行 handler 但传入 `isFree: true`）
  - `skipBlockFree`: 检测到 Free Block 时，**直接跳过** `each` handler 执行（之前会执行 handler 但传入 `isFree: true`）
  - 测试模式：**忽略** `skipPageFree` 和 `skipBlockFree` 配置（因为测试模式不使用这些 processor）

  **接口变更：**

  - **移除** `PageContext.isFree` 字段
  - **移除** `BlockContext.isFree` 字段
  - 保留 `FreeItem.isFree`（用于元数据记录）

  **迁移指南：**

  之前的逻辑：

  ```typescript
  await crawler.blocks("[data-preview]").each(async ({ block, isFree }) => {
    if (isFree) {
      console.log("跳过 Free Block");
      return;
    }
    // 处理 Block
  });
  ```

  之后的逻辑：

  ```typescript
  await crawler.blocks("[data-preview]").each(async ({ block }) => {
    // Free Block 不会进入这里，已被自动跳过
    // 直接处理 Block
  });
  ```

  **优点：**

  - 更简洁：用户无需在 handler 中判断 `isFree`
  - 更高效：Free 内容在进入 handler 前就被过滤
  - 更直观：配置的 skip 选项真正"跳过"了处理逻辑

## 0.4.0

### Minor Changes

- 1d935c4: 重构脚本注入配置：分离单个和多个脚本

  **破坏性变更：**

  - `scriptInjection.scripts` 从必填变为可选
  - 新增 `scriptInjection.script` 字段用于单个脚本

  **新设计：**

  - `script`（单数）：单个脚本，从 `.crawler/域名/` 根目录读取
  - `scripts`（复数）：多个脚本，从 `.crawler/域名/scripts/` 子目录读取
  - 两者互斥，必须选择其中一个

  **迁移指南：**

  之前：

  ```typescript
  scriptInjection: {
    scripts: ["custom-script.js"];
  }
  ```

  之后（单个脚本）：

  ```typescript
  scriptInjection: {
    script: "custom-script.js"; // 从 .crawler/域名/ 读取
  }
  ```

  之后（多个脚本）：

  ```typescript
  scriptInjection: {
    scripts: ["utils.js", "helpers.js"]; // 从 .crawler/域名/scripts/ 读取
  }
  ```

  **配置验证：**

  - 增加验证逻辑，防止 `script` 和 `scripts` 同时设置
  - 确保至少设置其中一个
  - 提供清晰的错误提示和示例

  **优点：**

  - 单个脚本更方便，直接放在根目录
  - 多个脚本更有组织，统一放在 scripts 子目录
  - 语义更清晰，单复数分明

## 0.3.1

### Patch Changes

- 119c8f3: 支持油猴脚本的 @run-at 元数据

  **新功能：**

  - 自动解析油猴脚本的 `@run-at` 元数据
  - 支持 `document-start`、`document-end`、`document-idle` 三种执行时机
  - 智能映射到框架的 `beforePageLoad` 和 `afterPageLoad`

  **执行时机优先级：**

  1. 配置的 `timing` 参数（如果指定）- 配置优先
  2. 油猴脚本的 `@run-at` 元数据 - 脚本自定义
  3. 默认值 `afterPageLoad` - 兜底默认

  **使用场景：**

  - 不设置 `timing`：每个脚本按照自己的 `@run-at` 执行
  - 设置了 `timing`：所有脚本统一按照配置执行
  - 混合使用：部分脚本有 `@run-at`，部分没有，各自按照优先级执行

  **文档更新：**

  - 说明 `@run-at` 元数据支持
  - 添加执行时机优先级说明
  - 更新示例代码

## 0.3.0

### Minor Changes

- 0358c5b: 新增油猴脚本支持

  **新功能：**

  - 完全支持油猴（Tampermonkey）脚本格式
  - 自动识别和处理油猴脚本元数据（`// ==UserScript==`）
  - 提供完整的油猴 API polyfill

  **支持的油猴 API：**

  - `GM_addStyle(css)` - 添加 CSS 样式
  - `GM_getValue/GM_setValue/GM_deleteValue/GM_listValues` - 数据存储
  - `GM_xmlhttpRequest(details)` - 网络请求（基于 fetch 实现）
  - `GM_info` - 脚本信息对象
  - `GM_log` - 日志输出
  - `unsafeWindow` - 原始 window 对象

  **使用说明：**

  - 可以直接使用现有的油猴脚本，无需修改
  - 自动区分普通 JavaScript 和油猴脚本格式
  - 存储 API 使用 sessionStorage 模拟，会话期间数据保持

  **文档更新：**

  - 新增油猴脚本支持说明
  - 提供油猴脚本使用示例
  - 列出支持的 API 和注意事项

## 0.2.2

### Patch Changes

- 3906d1d: 修复测试模式中的 extractBlockName 方法

  **问题：**

  - 测试模式中 extractBlockName 方法实现过于简单，导致无法正确提取组件名称，总是返回 "Unknown"

  **修复：**

  - 将 BlockProcessor 中的完整默认逻辑移植到测试模式的 extractBlockName 方法
  - 实现了完整的三级优先级：getBlockName 函数 > blockNameLocator > 默认逻辑
  - 默认逻辑会检查 heading 内部子元素数量，智能提取组件名称

  **文档更新：**

  - 完善了 README.md 中 getBlockName 默认逻辑的说明
  - 区分了 Block 模式和测试模式在错误处理上的差异

- ad62611: 重构 block 名称提取逻辑

  **优化内容：**

  - 创建独立的 `BlockNameExtractor` 工具类，统一处理 block 名称提取逻辑
  - `BlockProcessor` 和 `CrawlerOrchestrator` 共享同一套提取逻辑，避免重复代码
  - 明确类型定义：`section` 参数从 `any` 改为 `Locator`
  - 统一错误处理：测试模式和 Block 模式行为一致，结构复杂但未找到 link 时都会抛出错误

  **技术改进：**

  - 单一职责：提取逻辑独立封装
  - 代码复用：两处调用共享同一实现
  - 类型安全：移除 `any` 类型使用

## 0.2.1

### Patch Changes

- 8f87d6b: 临时修改包名为 @huaguang/block-crawler（24 小时后将改回 block-crawler）

## 0.2.0

### Minor Changes

- 新增脚本注入和测试模式功能

  **新功能：**

  1. **脚本注入** - 支持在并发访问的页面中注入自定义 JavaScript 脚本

     - 配置 `scriptInjection.scripts` 指定脚本文件（从 `.crawler/域名/` 目录读取）
     - 配置 `scriptInjection.timing` 选择注入时机（`beforePageLoad` 或 `afterPageLoad`）
     - 仅对并发页面注入，startUrl 的初始页面不注入
     - 新增 `ScriptInjector` 核心模块处理脚本加载和注入

  2. **测试模式** - 快速测试单个组件的提取逻辑
     - 使用 `.test(url, sectionLocator, blockName?)` 方法
     - 支持 `.before()` 前置逻辑（页面加载后、获取 section 前执行）
     - 支持 `.run()` 执行测试逻辑
     - 跳过链接收集阶段，直接访问指定页面
     - 应用 `collectionLinkWaitOptions` 和 `scriptInjection` 配置
     - 新增 `TestContext` 和 `TestHandler` 类型定义

  **改进：**

  - 完善国际化支持，新增脚本注入和测试模式相关的中英文日志
  - 更新文档，添加详细的使用示例和说明
  - 优化架构，新增 `ScriptInjector` 模块

## 1.1.0

### Minor Changes

- 实现页面脚本注入

## 1.0.0

### Major Changes

- 重大 API 重构：链式调用设计

  **BREAKING CHANGES:**

  - ✨ BlockCrawler 构造函数：page 作为第一个参数 `new BlockCrawler(page, config)`
  - 🔄 移除 `onBlock()` 和 `onPage()` 方法
  - ✨ 新增链式调用 API：
    - Block 模式：`crawler.blocks(locator).before(fn).each(fn)`
    - Page 模式：`crawler.pages().each(fn)`
  - 📝 before() 是可选的链式方法，语义更清晰
  - 🎯 统一优雅的 API 设计，顺序固定且自然

  **迁移指南：**

  ```typescript
  // 旧 API
  const crawler = new BlockCrawler(config);
  await crawler.onBlock(page, locator, handler, beforeHandler);
  await crawler.onPage(page, handler);

  // 新 API
  const crawler = new BlockCrawler(page, config);
  await crawler.blocks(locator).before(beforeHandler).each(handler);
  await crawler.pages().each(handler);
  ```

## 0.8.1

### Patch Changes

- 文档改进：明确 beforeProcessBlocks 的参数

  - 📝 将参数名从 `page` 改为 `currentPage` 以保持一致性
  - 📚 添加详细的 JSDoc 说明：参数是当前处理的页面，可能不是原始测试 page
  - ✨ 在所有示例和文档中添加注释说明

## 0.8.0

### Minor Changes

- 添加 beforeProcessBlocks 前置函数支持

  - ✨ `onBlock` 方法新增第四个可选参数 `beforeProcessBlocks`
  - 🔧 在匹配页面所有 Block 之前执行前置逻辑
  - 📝 支持点击按钮、toggle 切换、滚动触发懒加载等场景
  - 📚 更新文档和示例代码

## 0.7.0

### Minor Changes

- 758cfbd: 优化 getBlockName 默认逻辑和增强 BlockContext

  - ✨ 提供 getByRole('heading') 作为默认匹配逻辑
  - 🔧 支持复杂 heading 结构自动提取 link 文本
  - 📝 未找到 link 时提供清晰的错误提示
  - 🎯 BlockContext 添加 isFree 字段，与 PageContext 保持一致

## 0.6.0

### Minor Changes

- 6838052: 优化 extractBlockCount 默认行为

  - ✨ 默认逻辑改为匹配文本中的所有数字然后相加
  - 📝 支持 "1 component + 6 variants" 等多数字格式
  - 🔧 更新类型注释和示例说明

## 0.5.2

### Patch Changes

- 移除 meta.json 中的 lastUpdate 字段

## 0.5.1

### Patch Changes

- 9c53e08: 修复页面进度追踪问题并恢复 duration 字段

  - 🐛 修复非 Free 页面处理完成后没有被标记到进度的严重 bug
  - ✨ 恢复 `duration` 和 `startTime` 字段以记录每次运行的耗时
  - 🎯 现在所有处理完成的页面（包括 Free 和非 Free）都会被正确标记到进度文件
  - 📊 `duration` 显示本次运行的实际耗时（秒）

## 0.5.0

### Minor Changes

- be8ecaa: 优化元信息持久化机制，支持多次部分运行

  - ✨ Free 页面和 Free Block 现在采用追加而非覆盖策略，支持多次部分运行累积
  - ✨ 添加 `isComplete` 字段标记爬虫是否完整运行（未中断/未发生错误）
  - 🔄 Breaking: 移除 `startTime`、`endTime`、`duration` 字段，改用 `lastUpdate` 字段
  - ✨ MetaCollector 现在会自动加载并合并已有的 Free 数据
  - 🎯 正常完成时 `isComplete` 为 `true`，中断或错误时为 `false`

## 0.4.3

### Patch Changes

- de30dbd: 修复 Free 页面进度记录和 pageHandler 调用问题

  - 🐛 修复 Free 页面没有被标记到进度文件的问题
  - 🐛 修复 pageHandler 在 Free 页面时不会被调用的问题
  - ✨ pageHandler 现在始终会被调用，在 PageContext 中添加 `isFree` 标记让用户决定是否处理
  - 🔧 在 CrawlerOrchestrator 中添加 `normalizePagePath` 方法用于路径标准化

## 0.4.2

### Patch Changes

- 81274ca: 修复 fs-extra 导入方式导致方法不可用的问题

  - 🐛 修复 `import * as fse` 导致 `outputJson` 等方法在 ESM 环境下不可用的问题
  - ✅ 统一所有文件使用 `import fse from "fs-extra"` 导入方式
  - 🔧 确保所有 fs-extra 方法在 TypeScript/ESM 环境下正常工作

## 0.4.1

### Patch Changes

- e2b1542: 修复文件写入方法和优化域名目录格式

  - 🐛 修复 `fse.writeJson` 不存在的错误，改用 `fse.outputJson` 方法
  - 🔄 优化域名目录格式：从横杠分隔改为保留原始点号（如 `www.untitledui.com` 而非 `www-untitledui-com`）
  - ✨ 所有 JSON 写入操作现在自动确保目录存在

## 0.4.0

### Minor Changes

- 完善国际化支持并修复代码质量问题

  - ✨ 完整的国际化支持：所有日志输出现在都支持中英文切换（66 个日志全部国际化）
  - 🔧 新增 30+ 个翻译键，涵盖爬虫任务、进度管理、Block/Page 处理等模块
  - 🛠️ 新增 `scripts/check-i18n.ts` 工具：自动检测未国际化的日志，方便后续维护
  - 🐛 修复代码质量问题：移除未使用的变量，通过 TypeScript 严格检查
  - 📊 改进检查脚本统计逻辑：修复负数问题，统计结果更加清晰准确

## 0.3.0

### Minor Changes

- 0f2ee47: 移除 collectionLinkLocator 配置，统一使用 getByRole('link')

  - ♻️ BREAKING CHANGE: 移除 collectionLinkLocator 配置项
  - ✨ LinkCollector 现在统一使用 `section.getByRole('link')` 查找链接
  - 🎯 简化配置，提高一致性和可访问性
  - 📝 更新所有测试文件移除 collectionLinkLocator 配置

## 0.2.0

### Minor Changes

- c327353: 新增元信息收集和可选定位符功能

  - ✨ collectionNameLocator 和 collectionCountLocator 改为可选，如果不提供则只记录 link
  - ✨ 新增 skipPageFree 配置，支持跳过 Free 页面（支持字符串和函数配置）
  - ✨ 新增 skipBlockFree 配置，支持跳过 Free Block（支持字符串和函数配置）
  - ✨ 新增 MetaCollector 模块，自动收集网站元信息到 .crawler/域名/meta.json
  - 📊 元信息包括：collectionLinks、展示总数、真实总数、Free 页面/Block 统计、耗时等
  - 🔧 PageProcessor 和 BlockProcessor 返回 free 状态信息
  - 🔧 CrawlerOrchestrator 集成元信息收集和保存
  - 📝 导出新的 SiteMeta 和 FreeItem 类型

### Patch Changes

- 8bb1e14: 优化元信息收集和错误处理

  - ✨ 在 meta.json 中添加 totalLinks 字段显示收集到的链接总数
  - 🔧 Free 匹配时严格验证数量必须为 1，如果不足或超过则报错提示
  - 🛡️ 添加 Ctrl+C 信号处理器，中断时自动保存进度和元信息
  - 📊 控制台输出优化：分别显示总链接数和总组件数

## 0.1.0

### 初始发布

基于 Playwright 的通用 Block 爬虫框架。

#### ✨ 核心特性

- 🎯 **双模式支持** - Block 模式和页面模式自由切换
- 🚀 **受限并发** - 可配置并发数，避免封禁
- 💾 **进度恢复** - 支持中断后继续爬取，自动跳过已完成任务
- ⚙️ **完全配置化** - 所有参数可配置，支持函数覆盖
- 🏗️ **模块化架构** - 单一职责原则，易于维护和扩展
- 📦 **自动化管理** - 自动生成进度文件和输出目录

#### 🏗️ 模块化架构

- **ConfigManager** - 配置生成和验证
- **TabProcessor** - Tab 获取、点击、Section 定位
- **LinkCollector** - 收集页面链接，统计 Block 数量
- **BlockProcessor** - Block 获取和处理逻辑
- **PageProcessor** - 单页面处理逻辑
- **CrawlerOrchestrator** - 协调各模块，管理并发和进度
- **BlockCrawler** - 提供简洁的公共 API

#### 📁 自动文件管理

根据 `startUrl` 自动生成域名子目录：

- 进度文件：`.crawler/域名/progress.json`
- 输出目录：`output/域名/`

#### ⚙️ 灵活配置

支持通过配置函数覆盖默认行为，无需继承子类：

- `getAllTabSections` - 直接获取所有 tab sections（跳过 tab 点击）
- `extractTabTextFromSection` - 自定义提取 tab 文本
- `getTabSection` - 自定义获取 tab section
- `getAllBlocks` - 自定义获取所有 Block 元素
- `getBlockName` - 自定义获取 Block 名称
- `extractBlockCount` - 自定义提取 Block 数量

#### 🛡️ 配置冲突检查

框架会自动检查配置冲突并提供清晰的错误提示，帮助开发者快速定位问题。
