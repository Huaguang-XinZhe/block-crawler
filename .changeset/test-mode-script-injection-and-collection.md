---
"@huaguang/block-crawler": minor
---

测试模式支持脚本注入和油猴脚本，优化收集和 skipFree 逻辑

**主要改进：**

1. **测试模式支持脚本注入**
   - ✨ 测试模式现在支持 `beforePageLoad` 和 `afterPageLoad` 脚本注入
   - 🔧 移除了 LinkExecutor 中的 `!isFirst` 限制，使所有模式都支持脚本注入
   - 🐛 修复脚本路径错误：使用域名特定的 stateDir 而不是 stateBaseDir
   - 🧹 删除了"测试模式暂不支持脚本注入"的警告提示
   - 📍 脚本文件位置：`.crawler/域名/scripts/脚本名.js`

2. **支持油猴脚本（UserScript）**
   - 🔧 自动检测并为油猴脚本注入必要的 API polyfill
   - ✅ 支持的油猴 API：
     - `GM_xmlhttpRequest` - 使用 fetch API 模拟 HTTP 请求
     - `GM_getValue/GM_setValue` - 使用 localStorage 模拟数据存储
     - `GM_deleteValue/GM_listValues` - 数据管理
     - `GM_info` - 脚本信息
   - 🎯 自动识别 `// ==UserScript==` 标记

3. **优化收集阶段逻辑（智能跳过）**
   - 🎯 **只有在：配置了 section + 没有 collect.json 时才执行收集**
   - ⏭️ 其他情况自动跳过收集阶段：
     - 未配置 section → 跳过
     - 已有 collect.json → 跳过（避免重复收集）
   - 🔧 测试模式支持执行收集（如果配置了 section 且没有 collect.json）

4. **优化页面级和 Block 级 skipFree**
   - ⚡ 页面级 skipFree 检查提前到自动滚动之前执行
   - 🎯 如果检测到 Free 页面，立即跳过，避免不必要的滚动和后续操作
   - 🐛 修复 bug：调用 `.block()` 后不再覆盖页面级 skipFree 配置
   - 📍 执行顺序：导航 → 注入脚本 → **skipFree 检查**（页面级）→ 自动滚动 → page handler → block handler（block 级 skipFree）
   - 🎪 明确区分两种 skipFree：
     - **页面级**（`.page().skipFree()`）：跳过整个页面
     - **block 级**（`.block().skipFree()`）：跳过单个 block
   - 🔧 内部实现：使用 `pageSkipFreeText` 和 `blockSkipFreeText` 独立存储配置

5. **修复 BlockAutoConfig 单文件提取**
   - 🐛 修复只提供 `extractCode` 但没有 `fileTabs` 时无法输出文件的问题
   - ✨ 支持最简单的使用方式：`.block(selector, { extractCode: fn })`
   - 🎯 自动使用 `index.tsx` 作为默认文件名
   - 🔍 如果 block 内有多个 pre 元素，自动取最后一个（`last()`）
   - 📍 `AutoFileProcessor.processSingleFile()` 处理单文件场景

**使用示例：**

```typescript
await crawler
  .collect()
  .tabSections("//section[3]/div/div")
  .name("p:first-of-type")
  .inject(["custom-script.js"]) // ✅ 测试模式现在支持脚本注入
  .open("https://example.com/specific-page", "networkidle") // 测试模式
  .page(async ({ currentPage }) => {
    // 处理逻辑
  })
  .run(); // ✅ 会先执行收集（如果没有 collect.json），再执行测试
```

**脚本文件位置：** `.crawler/域名/scripts/custom-script.js`

**技术细节：**

- `TestMode.ts`：添加 ScriptInjector 实例化和脚本注入逻辑，使用 `generatePathsForUrl` 生成正确的域名特定路径
- `LinkExecutor.ts`：移除脚本注入的 `isFirst` 条件判断
- `BlockCrawler.ts`：重构 `run()` 方法，使测试模式支持收集阶段
- `i18n.ts`：删除 `crawler.testScriptWarning` 翻译项

