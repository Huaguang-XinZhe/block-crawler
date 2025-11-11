# block-crawler-framework

## 2.0.0

### Major Changes

- 重大 API 重构：简化配置和使用方式

  **Breaking Changes:**

  1. **`blockSectionLocator` 移至 `onBlock` 参数**

     - 之前：在配置中传入 `blockSectionLocator`
     - 现在：作为 `onBlock` 的第二个参数传入

     ```typescript
     // 旧的
     const crawler = new BlockCrawler({
       blockSectionLocator: "xpath=//main/div"
     });
     await crawler.onBlock(page, handler);

     // 新的
     const crawler = new BlockCrawler({ ... });
     await crawler.onBlock(page, "xpath=//main/div", handler);
     ```

  2. **`getTabSection` 支持直接配置函数**

     - 现在可以直接在配置中传入 `getTabSection` 函数，无需继承子类
     - 优先级：配置函数 > `tabSectionLocator` > 子类重写

     ```typescript
     // 方式 1：配置函数（推荐，无需继承）
     const crawler = new BlockCrawler({
       getTabSection: (page, tabText) =>
         page.getByRole("tabpanel", { name: tabText })
     });

     // 方式 2：配置定位符
     const crawler = new BlockCrawler({
       tabSectionLocator: '[role="tabpanel"][aria-label="{tabText}"]'
     });

     // 方式 3：继承重写（复杂场景）
     class MyCrawler extends BlockCrawler {
       protected getTabSection(page, tabText) { ... }
     }
     ```

  **改进：**

  - 🎯 更清晰的 API：`blockSectionLocator` 只在 Block 模式需要时传入
  - 🚀 更简单的使用：无需继承子类，直接配置函数即可
  - 📝 更好的日志：显示使用了哪种 `getTabSection` 方式
  - ✨ 更灵活的配置：同时支持字符串定位符、配置函数和继承重写三种方式

## 1.0.1

### Patch Changes

- 补充作者：mufeng

## 1.0.0

### Major Changes

- 重大更改：包名从 `block-crawler-framework` 更改为 `ui-blocks-crawler`

  - 📦 包名更改：`block-crawler-framework` → `ui-blocks-crawler`
  - 🧹 清理依赖：将 `cli-progress`、`@types/cli-progress`、`ora` 从 dependencies 移到 devDependencies（这些仅在测试中使用）
  - ⚡ 核心依赖现在仅包含：`fs-extra` 和 `p-limit`

  **迁移指南：**

  如果你之前使用 `block-crawler-framework`，请更新导入：

  ```typescript
  // 旧的
  import { BlockCrawler } from "block-crawler-framework";

  // 新的
  import { BlockCrawler } from "ui-blocks-crawler";
  ```

  然后重新安装：

  ```bash
  pnpm remove block-crawler-framework
  pnpm add -D ui-blocks-crawler
  ```

## 0.2.0

### Minor Changes

- 3c3a1c3: 🎉 首次发布 Block Crawler Framework

  ### 核心功能

  - ✨ 双模式支持：Block 处理模式和页面处理模式
  - 🚀 受限并发控制：可配置最大并发数
  - 💾 进度恢复机制：支持中断后继续爬取
  - ⚙️ 完全配置化：所有参数可通过配置对象设置
  - 🔧 易于扩展：提供 protected 方法供子类覆盖

  ### 主要特性

  - 支持通过 `blockLocator` 和 `blockNameLocator` 自定义定位逻辑
  - 提供 `getAllBlocks()` 和 `getBlockName()` 方法供子类覆盖
  - 自动管理并发和进度，简化爬虫开发
  - 完整的 TypeScript 类型支持
  - 基于 Playwright 的现代化爬虫解决方案
