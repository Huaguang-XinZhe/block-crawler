---
"@huaguang/block-crawler": minor
---

**🏗️ 彻底重构架构：清晰的单向依赖流**

## ✨ 新特性

### 重新设计的架构

采用 **Facade + Builder + Strategy** 设计模式，实现清晰的单向依赖流：

```
用户代码
   ↓
BlockCrawler (Facade) - 用户API层
   ↓
CollectPhase / BlockMode / PageMode (Builder) - 配置存储层
   ↓
CrawlerOrchestrator (Strategy) - 核心执行层
   ↓
Processors (LinkCollector, BlockProcessor, etc.) - 具体实现层
```

### Phase/Mode 模式（替代旧的 Chain）

- `CollectPhase`: 收集阶段配置，只存储配置不执行操作
- `BlockMode`: Block 处理模式配置
- `PageMode`: Page 处理模式配置
- 所有 Phase/Mode 通过 `getConfig()` 暴露配置，不反向调用 BlockCrawler

### 模块化类型定义

types 目录按功能拆分：
- `types/collect.ts` - 收集相关类型
- `types/handlers.ts` - Handler 上下文和函数类型
- `types/config.ts` - 配置类型
- `types/progress.ts` - 进度相关类型
- `types/meta.ts` - 元数据类型
- `types/actions.ts` - 操作函数类型

## 🔄 破坏性变更

### 移除的内部模块

- 删除 `TabProcessor.ts`（已被 LinkCollectorChain 替代）
- 删除 `LinkCollector.ts`（已被 LinkCollectorChain 替代）

### 移除的配置项

从 `InternalConfig` 中移除（这些配置现在由 `CollectPhase` 管理）：
- `startUrl`
- `startUrlWaitOptions`
- `collectionNameLocator`
- `collectionCountLocator`

### CrawlerOrchestrator 重构

- 不再负责链接收集（由 LinkCollectorChain 负责）
- 接受 `CollectResult` 作为参数，而不是自己执行收集
- 构造函数签名变更，新增 `collectResult`、`baseUrl`、`outputDir` 等参数

## 🐛 修复

### 代码质量

- 修复所有 ESLint 警告
- 移除所有 `any` 类型，使用精确类型（`BlockHandler`、`PageHandler`、`TestHandler`）
- 移除所有非空断言 (`!`)，使用更安全的类型检查
- 添加国际化消息 `common.signalReceived`

### 类型安全

- `i18n.t()` 参数类型从 `any` 改为 `Record<string, string | number | boolean>`
- `CrawlerOrchestrator` 所有 handler 参数使用精确类型

## 📝 迁移指南

### 对用户代码

**无需更改！** 用户 API 保持不变：

```typescript
const crawler = new BlockCrawler(page);

// 收集阶段（配置，不执行）
crawler
  .collect('https://example.com/blocks')
  .tabSections('//main/section')
  .name('//h3')
  .count('p');

// 处理模式（配置，不执行）
crawler
  .blocks('[data-preview]')
  .before(async ({ currentPage }) => { ... })
  .handler(async ({ block, blockName }) => { ... });

// 执行（必须）
await crawler.run();
```

### 对内部开发者

如果你直接使用了内部模块，需要注意：

1. 使用 `LinkCollectorChain` 替代旧的 `TabProcessor` 和 `LinkCollector`
2. `CrawlerOrchestrator` 现在需要 `CollectResult` 参数
3. 所有类型从 `types/` 子目录导入

## 📊 性能

- 构建产物减小：110KB → 98KB (ESM)
- 类型定义大小保持不变：21.77KB

## 🎯 架构优势

1. **单向依赖**：每一层只依赖下一层，无反向调用
2. **职责清晰**：Facade（API）、Builder（配置）、Strategy（执行）各司其职
3. **易于维护**：代码按功能模块化，单文件不超过 500 行
4. **类型安全**：消除 `any` 和 `!`，提升代码质量

