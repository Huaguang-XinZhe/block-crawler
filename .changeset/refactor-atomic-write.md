---
"@huaguang/block-crawler": minor
---

重构原子写入逻辑，优化代码结构

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

