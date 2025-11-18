---
"@huaguang/block-crawler": minor
---

### 重大重构：进度配置统一到 `progress` 对象

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
  .rebuild({ blockType: 'file', saveToProgress: true })
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
      blockType: 'file',
      saveToProgress: true,
      checkBlockComplete: async (blockPath, outputDir) => {
        // 可选：自定义检查逻辑
      }
    }
  }
});

await crawler
  .blocks("[data-preview]")
  .each(async ({ block }) => {
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

