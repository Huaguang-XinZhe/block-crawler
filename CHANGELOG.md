# block-crawler

## 0.20.0

### Minor Changes

- 添加链式 auth() API 实现自动化认证管理

  **新增功能:**

  - 新增 `.auth(loginHandler)` 链式方法，自动管理认证状态
  - 认证状态文件自动保存到 `.crawler/域名/auth.json`
  - 自动检测和复用已有的认证文件
  - 注释掉 `.auth()` 即可跳过认证（即使文件存在）

  **实现细节:**

  - 如果 `auth.json` 不存在：执行登录并保存认证状态
  - 如果 `auth.json` 存在：自动复用，跳过登录流程
  - 如果不调用 `.auth()`：不使用认证（即使文件存在）

  **使用示例:**

  ```typescript
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com",
  });

  await crawler
    .auth(async (page) => {
      // 登录逻辑
      await page.goto("https://example.com/login");
      await page.fill("#username", "user");
      await page.fill("#password", "pass");
      await page.click("button[type=submit]");
      await page.waitForURL("**/dashboard");
    })
    .collect()
    .tabSections("section")
    .open()
    .page(async ({ currentPage }) => {
      // 所有页面自动带认证状态
    })
    .run();
  ```

  **适用场景:**

  - 需要登录才能访问的页面
  - 需要保持会话状态的爬取任务
  - 跨多个页面共享认证信息

## 0.19.0

### Minor Changes

- 重构 API：将 startUrl 移到全局配置，移除 startUrl() 和 wait() 方法，新增 collect() 方法

  **Breaking Changes:**

  - 移除 `.startUrl()` 方法：现在需要在构造函数中配置 `startUrl`
  - 移除 `.wait()` 方法：使用 `.collect(waitUntil)` 替代
  - 移除自动查找 collect.json 的逻辑：现在必须配置 `startUrl`

  **新增功能:**

  - 新增 `.collect(waitUntil?, timeout?)` 方法用于配置收集阶段等待选项
  - `startUrl` 现在作为全局配置项在构造函数中传入

  **迁移指南:**

  ```typescript
  // 旧写法
  const crawler = new BlockCrawler(page);
  await crawler
    .startUrl("https://example.com")
    .wait("networkidle")
    .tabSections("section")
    .run();

  // 新写法
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com",
  });
  await crawler.collect("networkidle").tabSections("section").run();
  ```

## 0.18.0

### Minor Changes

- d401bf5: ### 重大重构：进度配置统一到 `progress` 对象

  将进度恢复相关的所有配置统一整合到 `progress` 配置对象中，并移除链式 `rebuild()` 方法，使配置更加清晰和易用。

  #### 主要变更

  1. **配置重构**：

     - 移除 `enableProgressResume`，改用 `progress.enable`
     - 移除链式 `rebuild()` 方法，改为在配置中直接设置 `progress.rebuild`
     - 新增 `ProgressConfig` 和 `ProgressRebuildConfig` 类型

  2. **默认值调整**：

     - `progress.enable`: 默认 `true`（开启进度恢复）
     - `progress.rebuild.blockType`: 默认 `'file'`
     - `progress.rebuild.saveToProgress`: 默认 `true`

  3. **增强功能**：
     - 智能识别组件文件：支持 `.tsx`, `.ts`, `.jsx`, `.js`, `.vue`, `.svelte`
     - 页面访问日志：并发访问页面时打印访问信息
     - `actualTotalCount` 优化：进度恢复开启时覆盖而不是累加

  #### 配置示例

  **旧配置（v0.17.0）**：

  ```typescript
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com",
    enableProgressResume: true,
  });

  await crawler
    .blocks("[data-preview]")
    .rebuild({ blockType: "file", saveToProgress: true })
    .each(async ({ block }) => {
      // ...
    });
  ```

  **新配置（v0.18.0）**：

  ```typescript
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com",
    progress: {
      enable: true,
      rebuild: {
        blockType: "file",
        saveToProgress: true,
        checkBlockComplete: async (blockPath, outputDir) => {
          // 可选：自定义检查逻辑
        },
      },
    },
  });

  await crawler.blocks("[data-preview]").each(async ({ block }) => {
    // ...
  });
  ```

  #### Breaking Changes

  - 移除 `CrawlerConfig.enableProgressResume`，请改用 `progress.enable`
  - 移除 `BlockChain.rebuild()` 和 `PageChain.rebuild()` 链式方法
  - 移除 `RebuildOptions` 类型，改用 `ProgressRebuildConfig`

  #### Migration Guide

  1. 将 `enableProgressResume` 改为 `progress.enable`
  2. 将链式 `.rebuild()` 调用改为配置中的 `progress.rebuild`
  3. 更新导入类型：`RebuildOptions` → `ProgressRebuildConfig`

## 0.17.0

### Minor Changes

- 添加链式 `rebuild()` 方法，支持从 outputDir 扫描重建进度

  **核心功能：**

  1. **链式 `rebuild()` 方法**

     - 可在 `blocks()` 和 `pages()` 后调用
     - 扫描 outputDir 已有文件，在内存中标记为完成
     - 仅在 progress.json 不存在时生效
     - 默认不保存到 progress.json（可配置）

  2. **灵活的配置选项**

     - `blockType`: 指定 block 类型（'file' 或 'directory'）
     - `saveToProgress`: 是否保存到 progress.json（默认 false）
     - `checkBlockComplete`: 自定义检查函数

  3. **智能识别策略**
     - 动态识别"页面目录"（不依赖固定路径段数）
     - 根据 `blockType` 识别 block（文件或目录）
     - 默认"存在即完成"逻辑

  **使用示例：**

  ```typescript
  // untitledui: block 是文件，只在内存中标记
  await crawler
    .blocks("[data-preview]")
    .rebuild({ blockType: "file" })
    .before(async ({ currentPage, clickAndVerify }) => {
      await clickAndVerify(currentPage.getByRole("tab", { name: "List view" }));
    })
    .each(async ({ block, safeOutput }) => {
      const code = await block.locator("pre").textContent();
      await safeOutput(code ?? "");
    });

  // heroui: block 是目录，保存到 progress.json
  await crawler
    .blocks("[data-preview]")
    .rebuild({ blockType: "directory", saveToProgress: true })
    .each(async ({ block, safeOutput }) => {
      // ...
    });

  // 自定义检查逻辑
  await crawler
    .blocks("[data-preview]")
    .rebuild({
      blockType: "directory",
      saveToProgress: true,
      checkBlockComplete: async (blockPath, outputDir) => {
        const dir = path.join(outputDir, blockPath);
        const files = await fse.readdir(dir);
        return files.some((f) => f.endsWith(".tsx") && f.includes("index"));
      },
    })
    .each(async ({ block, safeOutput }) => {
      // ...
    });

  // pages 模式也支持
  await crawler
    .pages()
    .rebuild({ blockType: "file" })
    .each(async ({ currentPage, currentPath }) => {
      // ...
    });
  ```

  **配置说明：**

  ```typescript
  interface RebuildOptions {
    /**
     * Block 的存储类型
     * - 'file': block 是文件，存在即完成（如 untitledui）
     * - 'directory': block 是目录，存在即完成（如 heroui）
     * @default 'file'
     */
    blockType?: "file" | "directory";

    /**
     * 是否将扫描结果保存到 progress.json
     * - false（默认）：只在内存中标记，不保存文件
     * - true：保存到 progress.json，下次启动可直接使用
     * @default false
     */
    saveToProgress?: boolean;

    /**
     * 自定义检查 block 是否完成的函数
     * 如果提供，将覆盖默认的"存在即完成"逻辑
     */
    checkBlockComplete?: (
      blockPath: string,
      outputDir: string
    ) => Promise<boolean>;
  }
  ```

  **重建逻辑：**

  1. 扫描 outputDir，动态识别"页面目录"

     - 如果目录下有 .tsx 文件 → 页面目录（blockType='file'）
     - 如果子目录内有 .tsx 文件 → 页面目录（blockType='directory'）

  2. 对于每个页面，扫描其下的 block

     - blockType='file'：扫描 .tsx 文件
     - blockType='directory'：扫描子目录

  3. 检查 block 是否完成

     - 默认：存在即完成
     - 自定义：使用 `checkBlockComplete` 函数

  4. 在内存中标记已完成的 blocks 和 pages

     - 页面假设完整（只要有 block 就标记为完成）

  5. 可选保存到 progress.json
     - `saveToProgress=false`（默认）：不保存
     - `saveToProgress=true`：保存到文件

  **优势：**

  - ✅ 不依赖固定路径结构，自动适应不同网站
  - ✅ 支持两种 block 类型（文件/目录）
  - ✅ 灵活的检查逻辑（默认或自定义）
  - ✅ 可选持久化（内存或文件）
  - ✅ 链式调用，语法简洁

  **破坏性变更：**

  - `TaskProgress` 构造函数签名变更：
    - 移除 `assumePageComplete` 参数
    - 新增可选的 `rebuildConfig` 参数（但仅在内部使用）
  - 移除了全局配置中的 `assumePageComplete` 选项（现在通过 `rebuild()` 方法配置）

  **迁移指南：**

  旧代码（使用全局配置）：

  ```typescript
  const crawler = new BlockCrawler(page, {
    startUrl: "...",
    assumePageComplete: true,
  });
  ```

  新代码（使用 rebuild() 方法）：

  ```typescript
  const crawler = new BlockCrawler(page, {
    startUrl: "...",
  });

  await crawler
    .blocks("[data-preview]")
    .rebuild({ blockType: "file" }) // 明确配置重建行为
    .each(async ({ block, safeOutput }) => {
      // ...
    });
  ```

## 0.16.0

### Minor Changes

- 重构进度恢复机制，优化文件名映射和进度重建逻辑

  **重大改进：**

  1. **文件名映射简化**

     - `filename-mapping.json` 现在只记录文件名，不记录完整路径
     - 示例：`"Step 1_ Forgot password.tsx": "Step 1: Forgot password.tsx"`（之前是完整路径）
     - 更简洁，更易维护

  2. **进度重建机制重构**

     - 移除了旧的基于 js/ts 目录文件数对比的重建逻辑
     - 新逻辑：检查 block 目录下是否存在 `.tsx` 文件
     - 支持使用 `filename-mapping.json` 恢复原始文件名
     - 更加灵活和准确

  3. **新增 `assumePageComplete` 配置**

     - 用于控制进度重建时的页面完整性假设
     - `true`（默认）：只要页面目录存在就标记为已完成，跳过大部分链接（提高恢复速度）
     - `false`：需要检查页面内所有 block 是否完整，逐个验证（确保完整性）
     - 仅在从 outputDir 重建进度时生效（progress.json 不存在或被删除）

  4. **进度恢复逻辑总结**

     - **进度来源**：
       - 优先：`progress.json`（如果存在且 `enableProgressResume=true`）
       - 备用：从 `outputDir` 扫描重建
     - **重建策略**：
       - `assumePageComplete=true`：快速恢复，假设已存在的页面完整
       - `assumePageComplete=false`：完整验证，确保数据准确
     - **推荐配置**：默认使用 `true` 提高恢复速度，如果怀疑数据不完整再设为 `false`

  5. **actualTotalCount 优化**
     - 只累加实际处理的页面/block 数量
     - 跳过的页面（已完成、Free 页面）不计入
     - 更准确反映实际工作量

  **使用示例：**

  ```typescript
  const crawler = new BlockCrawler({
    startUrl: "https://example.com",
    enableProgressResume: true,
    assumePageComplete: true, // 默认值，快速恢复
  });

  // 如果需要完整性检查
  const strictCrawler = new BlockCrawler({
    startUrl: "https://example.com",
    enableProgressResume: true,
    assumePageComplete: false, // 完整验证每个页面
  });
  ```

  **配置说明：**

  ```typescript
  interface CrawlerConfig {
    /**
     * 重建进度时是否假设页面已完整
     * 仅在从 outputDir 重建进度时生效（progress.json 不存在或 enableProgressResume=false）
     *
     * - true（默认）：只要页面目录存在就标记为已完成，可以跳过大部分链接（不打开页面）
     * - false：需要检查页面内所有 block 是否完整，会逐个打开页面验证
     *
     * 推荐默认为 true，以提高恢复速度。如果怀疑数据不完整，可设为 false 进行完整性检查。
     */
    assumePageComplete?: boolean;
  }
  ```

  **破坏性变更：**

  - `TaskProgress` 构造函数签名变更：
    - 旧：`constructor(progressFile, outputDir, locale)`
    - 新：`constructor(progressFile, outputDir, stateDir, locale, assumePageComplete)`
  - `filename-mapping.json` 格式变更：只存储文件名，不存储完整路径

  **迁移指南：**

  如果你有旧的 `filename-mapping.json`，建议删除后重新生成：

  ```bash
  rm .crawler/*/filename-mapping.json
  ```

  下次运行时会自动生成新格式的映射文件。

## 0.15.0

### Minor Changes

- 添加 `clickAndVerify` 和 `clickCode` 辅助函数到上下文中

  **新增功能：**

  1. **clickAndVerify 函数**：点击并验证的辅助函数，支持重试机制

     - 参数：locator（要点击的元素）、verifyFn（验证函数，**可选**）、options（timeout 和 retries）
     - **智能验证**：如果不提供 verifyFn，将自动根据元素的 role 选择验证方式
       - `role="tab"` → 验证 `aria-selected="true"`
       - 其他 role → 验证元素可见性
     - 自动重试直到验证通过或达到最大重试次数
     - 可用于 `each`、`run` 和 `before` 的所有上下文

  2. **clickCode 函数**：专门用于点击 Code 按钮的便捷函数

     - 内部使用 `clickAndVerify` 的自动验证功能
     - 默认定位器：`getByRole('tab', { name: 'Code' })`
     - 自动验证 tab 的 `aria-selected="true"`
     - 可用于 `each` 和 `run` 上下文（不在 `before` 中）

  3. **BeforeContext 接口**：新增 before 函数的专用上下文类型
     - 包含 `currentPage` 和 `clickAndVerify`
     - 不包含 `clickCode` 和 `safeOutput`（避免混淆）

  **使用示例：**

  ```typescript
  await crawler
    .blocks("[data-preview]")
    .before(async ({ currentPage, clickAndVerify }) => {
      // 示例 1: tab 元素自动验证（无需手动写验证函数）
      await clickAndVerify(currentPage.getByRole("tab", { name: "List view" }));

      // 示例 2: 自定义验证逻辑
      await clickAndVerify(
        currentPage.getByRole("button", { name: "Show All" }),
        async () => {
          const isExpanded = await currentPage.getByText("Content").isVisible();
          return isExpanded;
        }
      );
    })
    .each(async ({ block, clickCode, clickAndVerify, safeOutput }) => {
      // 使用 clickCode 点击 Code 按钮（推荐）
      await clickCode();

      // 或直接使用 clickAndVerify（tab 会自动验证）
      await clickAndVerify(block.getByRole("tab", { name: "Preview" }));

      const code = await block.locator("pre").textContent();
      await safeOutput(code ?? "");
    });
  ```

  **破坏性变更：**

  - `BeforeProcessBlocksHandler` 类型签名从 `(currentPage: Page) => Promise<void>` 改为 `(context: BeforeContext) => Promise<void>`
  - 需要更新现有的 `before` 回调函数以使用新的上下文结构

## 0.14.0

### Minor Changes

- 添加 `clickAndVerify` 和 `clickCode` 辅助函数到上下文中

  **新增功能：**

  1. **clickAndVerify 函数**：点击并验证的辅助函数，支持重试机制

     - 参数：locator（要点击的元素）、verifyFn（验证函数，**可选**）、options（timeout 和 retries）
     - **智能验证**：如果不提供 verifyFn，将自动根据元素的 role 选择验证方式
       - `role="tab"` → 验证 `aria-selected="true"`
       - 其他 role → 验证元素可见性
     - 自动重试直到验证通过或达到最大重试次数
     - 可用于 `each`、`run` 和 `before` 的所有上下文

  2. **clickCode 函数**：专门用于点击 Code 按钮的便捷函数

     - 内部使用 `clickAndVerify` 的自动验证功能
     - 默认定位器：`getByRole('tab', { name: 'Code' })`
     - 自动验证 tab 的 `aria-selected="true"`
     - 可用于 `each` 和 `run` 上下文（不在 `before` 中）

  3. **BeforeContext 接口**：新增 before 函数的专用上下文类型
     - 包含 `currentPage` 和 `clickAndVerify`
     - 不包含 `clickCode` 和 `safeOutput`（避免混淆）

  **使用示例：**

  ```typescript
  await crawler
    .blocks("[data-preview]")
    .before(async ({ currentPage, clickAndVerify }) => {
      // 示例 1: tab 元素自动验证（无需手动写验证函数）
      await clickAndVerify(currentPage.getByRole("tab", { name: "List view" }));

      // 示例 2: 自定义验证逻辑
      await clickAndVerify(
        currentPage.getByRole("button", { name: "Show All" }),
        async () => {
          const isExpanded = await currentPage.getByText("Content").isVisible();
          return isExpanded;
        }
      );
    })
    .each(async ({ block, clickCode, clickAndVerify, safeOutput }) => {
      // 使用 clickCode 点击 Code 按钮（推荐）
      await clickCode();

      // 或直接使用 clickAndVerify（tab 会自动验证）
      await clickAndVerify(block.getByRole("tab", { name: "Preview" }));

      const code = await block.locator("pre").textContent();
      await safeOutput(code ?? "");
    });
  ```

  **破坏性变更：**

  - `BeforeProcessBlocksHandler` 类型签名从 `(currentPage: Page) => Promise<void>` 改为 `(context: BeforeContext) => Promise<void>`
  - 需要更新现有的 `before` 回调函数以使用新的上下文结构

## 0.13.1

### Patch Changes

- 9b53825: 优化 Debug 模式下的暂停行为和日志输出

  **主要改进：**

  1. **智能 Debug 模式检测**

     - 新增 `isDebugMode()` 工具函数
     - 自动检测 PWDEBUG、PW_TEST_DEBUG、PLAYWRIGHT_INSPECTOR 环境变量
     - 根据运行模式智能调整行为

  2. **差异化日志输出**

     - **Debug 模式**：输出"页面已暂停方便检查"，真正调用 `page.pause()`
     - **非 Debug 模式**：输出"使用 --debug 模式可以暂停页面"，不调用 `page.pause()`
     - 避免非 Debug 模式下的误导性日志

  3. **影响范围**
     - `pauseOnError` 功能：只在 Debug 模式下暂停
     - `verifyBlockCompletion` 功能：只在 Debug 模式下暂停
     - 保持功能逻辑不变，仅优化用户体验

  **使用体验：**

  ```bash
  # Debug 模式（会真正暂停）
  pnpm test:debug tests/example.spec.ts

  # 非 Debug 模式（不会暂停，只提示）
  pnpm test tests/example.spec.ts
  ```

  **日志对比：**

  Debug 模式：

  ```
  🛑 检测到错误，页面已暂停方便检查
     类型: Block
     位置: Button Component
     错误: Timeout 10000ms exceeded.
  ```

  非 Debug 模式：

  ```
  ❌ 检测到错误
     类型: Block
     位置: Button Component
     错误: Timeout 10000ms exceeded.

     💡 提示: 使用 --debug 模式运行可以自动暂停页面进行检查
  ```

## 0.13.0

### Minor Changes

- 8c69ce2: 新增 useIndependentContext 配置，解决并发场景下的状态污染问题

  **主要功能：**

  1. **独立 Context 模式**

     - 为每个并发页面创建独立的 BrowserContext
     - 完全隔离页面状态，避免互相干扰
     - 默认关闭，需手动开启

  2. **解决的问题**

     - 并发场景下点击操作失效
     - 页面状态混乱、状态污染
     - 提高并发稳定性

  3. **自动资源管理**
     - 页面关闭时自动清理对应的 Context
     - 避免内存泄漏

  **使用方式：**

  ```typescript
  // 并发场景开启（推荐）
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com/components",
    useIndependentContext: true, // 开启独立 context
    maxConcurrency: 5,
    // ... 其他配置
  });
  ```

  **优缺点对比：**

  | 特性         | 共享 Context (默认) | 独立 Context |
  | ------------ | ------------------- | ------------ |
  | 状态隔离     | ❌ 可能互相影响     | ✅ 完全隔离  |
  | 并发稳定性   | ⚠️ 一般             | ✅ 高        |
  | 内存占用     | ✅ 低               | ⚠️ 略高      |
  | Cookies 共享 | ✅ 支持             | ❌ 不支持    |

  **适用场景：**

  - 并发爬取时遇到点击失效、状态混乱
  - 需要完全隔离的页面环境
  - 高并发场景（推荐）

  **文档更新：**

  - 添加"点击稳定性最佳实践"章节
  - 提供 2 种点击稳定方案
  - 包含完整的代码示例

## 0.12.2

### Patch Changes

- 起始页面处理完后也要关闭

## 0.12.1

### Patch Changes

- 报错时不在控制台输出详细日志

## 0.12.0

### Minor Changes

- 2698042: 新增 pauseOnError 配置，遇到错误时自动暂停方便检查

  **主要功能：**

  1. **全局配置**

     - 添加 `pauseOnError` 配置项
     - 默认开启（`true`）
     - 生产环境可关闭

  2. **错误捕获**

     - Block 处理错误时自动暂停
     - Page 处理错误时自动暂停
     - 打印详细的错误信息和类型

  3. **国际化支持**
     - 中英文错误提示
     - 包含检查提示和解决建议

  **使用方式：**

  ```typescript
  // 调试时使用（默认开启）
  const crawler = new BlockCrawler(page, {
    pauseOnError: true, // 默认值
    // ... 其他配置
  });

  // 生产环境关闭
  const crawler = new BlockCrawler(page, {
    pauseOnError: false,
    // ... 其他配置
  });
  ```

  **错误暂停示例：**

  ```
  ❌ 处理 block 失败: Button Component
  TimeoutError: Timeout 10000ms exceeded.

  🛑 检测到错误，页面已暂停方便检查
     类型: Block
     错误: Timeout 10000ms exceeded.

     💡 提示: 检查完成后，可以在全局配置中关闭 pauseOnError 以继续运行
  ```

  **适用场景：**

  - `--debug` 模式下自动检查问题
  - 开发阶段快速定位错误
  - 生产环境建议关闭，避免阻塞流程

## 0.11.0

### Minor Changes

- 30bbbe4: 重构 Block 采集完整性验证功能，移至 blocks() 方法配置

  **主要变更：**

  1. **配置位置调整**

     - 从全局配置移至 `blocks()` 方法的第二个参数
     - 更符合语义，仅在 Block 模式下使用

  2. **默认开启验证**

     - `verifyBlockCompletion` 默认值改为 `true`
     - 开发/调试时自动验证，生产环境手动关闭

  3. **国际化支持**
     - 添加中英文日志输出
     - 验证信息支持完整的 i18n

  **使用方式：**

  ```typescript
  // 默认开启验证（推荐）
  await crawler.blocks("[data-preview]").each(async ({ block }) => {
    // ...
  });

  // 生产环境关闭
  await crawler
    .blocks("[data-preview]", { verifyBlockCompletion: false })
    .each(async ({ block }) => {
      // ...
    });
  ```

  **破坏性变更：**

  如果之前在全局配置中使用了 `verifyBlockCompletion`，需要迁移到 `blocks()` 方法：

  ```typescript
  // 之前（不再支持）
  const crawler = new BlockCrawler(page, {
    verifyBlockCompletion: true,
  });

  // 现在
  const crawler = new BlockCrawler(page, {
    // ...
  });
  await crawler.blocks("[data-preview]", { verifyBlockCompletion: true });
  ```

## 0.10.0

### Minor Changes

- 97cf1eb: 新增 Block 采集完整性验证功能（调试工具）

  **新增配置：**

  - `verifyBlockCompletion` (boolean, 默认 false)：开启 Block 采集完整性验证

  **功能说明：**

  在 --debug 模式下运行测试时，可以开启此功能确保组件采集完整：

  1. 记录 sectionLocator 定位到的 block 总数（预期数量）
  2. 记录实际采集的 block 数量
  3. 如果两者不一致，调用 page.pause() 暂停
  4. 打印详细的采集信息和已处理的 block 列表

  **使用示例：**

  ```typescript
  const crawler = new BlockCrawler(page, {
    startUrl: "https://example.com/components",
    verifyBlockCompletion: true, // 开启完整性验证
  });

  await crawler.blocks("[data-preview]").each(async ({ block, safeOutput }) => {
    // 采集逻辑
  });
  ```

  **适用场景：**

  - 调试特定页面的采集问题
  - 验证 sectionLocator 是否正确
  - 确保所有组件都被正确采集

  **注意：** 问题解决后，建议关闭此配置以避免不必要的暂停。

## 0.9.1

### Patch Changes

- 0c83c76: 修复原子写入临时文件位置，改为使用系统临时目录

  **问题：**
  临时文件（`.tmp`）被放在 `.crawler/域名/` 目录下，污染了工作目录。

  **修复：**

  - 临时文件现在放在系统临时目录（`os.tmpdir()`）
  - 使用 UUID 确保临时文件名唯一性
  - 临时文件格式：`block-crawler-{UUID}.tmp`
  - 写入成功后通过 `move` 原子替换到目标位置
  - 失败时自动清理临时文件

- fd18dd4: 优化文件名 sanitize 逻辑和映射记录机制

  **改进原则：**
  在保证安全的前提下，尽可能不改变原文件名

  **主要变更：**

  1. **更保守的 sanitize 策略**

     - 保留空格（空格在大多数系统是合法的）
     - 只替换真正非法的字符：`< > : " / \ | ? *`
     - 移除控制字符和删除字符
     - 避免过度修改文件名

  2. **完善映射记录**
     - 记录完整路径的映射，不仅仅是文件名
     - 修复 block 模式下路径变化未记录的问题
     - 修复用户提供 filePath 时的路径处理
     - 确保所有文件名变化都被记录

  **示例：**

  变更前（过于激进）：

  - `"Step 1: Forgot password"` → `"Step_1__Forgot_password"` （空格被替换）

  变更后（更保守）：

  - `"Step 1: Forgot password"` → `"Step 1_ Forgot password"` （只替换冒号，保留空格）

## 0.9.0

### Minor Changes

- 0fa6213: 新增文件名映射功能，记录 sanitize 前后的对应关系

  **功能说明：**

  在 `.crawler/域名/filename-mapping.json` 文件中维护文件名映射，记录 sanitize 前后的对应关系，方便从 sanitize 后的文件名反推出原始组件名。

  **特性：**

  1. **自动映射记录**

     - 当文件名被 sanitize 改变时自动记录
     - 仅在文件名发生变化时记录（避免冗余）
     - 支持 Block、Test、Page 三种模式

  2. **映射文件位置**

     - 存储在 `.crawler/域名/filename-mapping.json`
     - 与 `progress.json` 和 `meta.json` 在同一目录
     - 使用原子写入确保数据一致性

  3. **工具函数**
     - `FilenameMappingManager.getOriginal()` - 从 sanitize 后的文件名获取原始文件名
     - `FilenameMappingManager.load()` - 加载所有映射
     - 支持实例方法和静态方法

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
  const mapping = await FilenameMappingManager.load(
    ".crawler/www.untitledui.com"
  );
  // 返回: {
  //   "test-Step_1__Forgot_password.tsx": "test-Step 1: Forgot password.tsx",
  //   ...
  // }
  ```

  **解决的问题：**

  - ✅ 当组件名包含特殊字符（如 `"Step 1: Forgot password"`）时，sanitize 后的文件名会变成 `"Step_1__Forgot_password"`，丢失了原始信息
  - ✅ 通过映射文件可以轻松从 sanitize 后的文件名反推出原始组件名
  - ✅ 方便后续处理和分析，保持组件名的语义信息

## 0.8.0

### Minor Changes

- a8b409d: 新增 safeOutput 函数，自动处理文件名 sanitize

  **功能说明：**

  在 BlockContext、TestContext、PageContext 中新增 `safeOutput` 函数，用于安全地写入文件，自动处理文件名中的非法字符（如冒号、斜杠等）。

  **特性：**

  1. **自动文件名清理**

     - 移除或替换文件名中的非法字符（`< > : " / \ | ? *` 等）
     - 处理控制字符和空格
     - 限制文件名长度，确保跨平台兼容

  2. **智能默认路径**

     - **Block 模式**：默认路径 `${outputDir}/${blockPath}.tsx`
     - **Test 模式**：默认路径 `${outputDir}/test-${blockName}.tsx`
     - **Page 模式**：需要显式传入 `filePath`

  3. **路径 sanitize**
     - 所有路径（包括默认路径和用户传入的）都会自动 sanitize
     - 支持相对路径和绝对路径
     - 自动处理路径中的每个部分（目录名和文件名）

  **使用示例：**

  ```typescript
  // Test 模式 - 使用默认路径（自动 sanitize）
  await crawler
    .test("https://example.com/page", "[data-preview]", 1)
    .run(async ({ section, safeOutput }) => {
      const code = await extractCode(section);
      await safeOutput(code); // 自动处理 "Step 1: Forgot password" 这样的文件名
    });

  // Block 模式 - 使用默认路径
  await crawler.blocks("[data-preview]").each(async ({ block, safeOutput }) => {
    const code = await extractCode(block);
    await safeOutput(code); // 自动处理 blockPath 中的特殊字符
  });

  // 自定义路径（也会自动 sanitize）
  await safeOutput(code, "custom/path/to/file.tsx");
  ```

  **解决的问题：**

  - ✅ 防止文件名包含特殊字符（如 `:`、`/`）导致文件写入失败
  - ✅ 自动处理组件名中的空格和特殊字符
  - ✅ 确保跨平台兼容性（Windows、macOS、Linux）

## 0.7.0

### Minor Changes

- 3d649e5: 重构原子写入逻辑，优化代码结构

  **改进内容：**

  1. **创建通用原子写入工具模块** (`src/utils/atomic-write.ts`)

     - 封装原子写入逻辑（临时文件 + 原子替换 + 重试机制）
     - 支持可配置选项（重试次数、延迟、验证等）
     - 统一管理文件写入的原子性保证

  2. **重构 MetaCollector，遵循单一职责原则**

     - 将 `save()` 方法拆分为多个职责单一的方法：
       - `hasContent()` - 检查是否有内容
       - `shouldSkipSave()` - 判断是否跳过保存
       - `mergeWithExisting()` - 合并已有数据
       - `prepareMetaForSave()` - 准备保存数据
       - `logSaveStats()` - 输出统计信息
     - 主方法 `save()` 现在只负责协调流程

  3. **重构 TaskProgress，同样拆分逻辑**
     - `hasProgress()` - 检查是否有进度
     - `shouldSkipSave()` - 判断是否跳过保存
     - `prepareProgressData()` - 准备进度数据
     - 使用统一的 `atomicWriteJson()` 工具

  **优势：**

  - ✅ **单一职责**：每个方法只做一件事，代码更清晰
  - ✅ **代码复用**：原子写入逻辑统一管理，消除重复代码
  - ✅ **易于维护**：逻辑清晰，便于测试和修改
  - ✅ **易于扩展**：如需调整原子写入行为，只需修改一个地方

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
