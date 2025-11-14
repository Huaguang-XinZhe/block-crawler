---
"@huaguang/block-crawler": patch
---

优化 Free 页面检测逻辑和性能

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

