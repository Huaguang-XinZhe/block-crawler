---
"ui-blocks-crawler": patch
---

重构：模块化代码结构，应用单一职责原则

**重构内容：**

将 800 行的 `crawler.ts` 重构为模块化架构：

1. **`ConfigManager`** - 配置管理
   - 负责配置的生成、验证、保存和加载
   - 提供静态方法用于配置操作

2. **`TabProcessor`** - Tab 处理
   - 负责所有与 Tab 相关的操作
   - 获取 Tab、点击 Tab、获取 Tab Section

3. **`LinkCollector`** - 链接收集
   - 负责收集页面中的集合链接
   - 统计 Block 数量

4. **`BlockProcessor`** - Block 处理
   - 负责 Block 的处理逻辑
   - 获取 Block、处理 Block、获取 Block 名称

5. **`PageProcessor`** - Page 处理
   - 负责单页面的处理逻辑

6. **`CrawlerOrchestrator`** - 主协调器
   - 协调各个模块，执行完整的爬取流程
   - 管理并发和进度

7. **`BlockCrawler`** - 公共 API
   - 简化为仅提供公共 API 接口
   - 从 ~800 行减少到 ~170 行

**改进：**

- ✅ 单一职责：每个模块专注于一个职责
- ✅ 可维护性：代码更易于理解和修改
- ✅ 可测试性：每个模块可独立测试
- ✅ 可扩展性：更容易添加新功能
- ✅ 向后兼容：保持相同的公共 API

**文件结构：**

```
src/
├── crawler.ts          (~170 行，公共 API)
├── types.ts
├── index.ts
├── core/
│   ├── ConfigManager.ts      (~150 行)
│   ├── TabProcessor.ts       (~95 行)
│   ├── LinkCollector.ts      (~95 行)
│   ├── BlockProcessor.ts     (~140 行)
│   ├── PageProcessor.ts      (~35 行)
│   └── CrawlerOrchestrator.ts (~210 行)
└── utils/
    ├── task-progress.ts
    └── extract-code.ts
```

**无破坏性变更：** 对外 API 完全兼容，用户代码无需修改。

