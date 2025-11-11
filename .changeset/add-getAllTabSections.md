---
"ui-blocks-crawler": minor
---

新增 `getAllTabSections` 配置选项，支持跳过 tab 点击直接获取所有 sections

**新增功能：**

- ✨ 新增 `getAllTabSections` 配置，支持直接获取所有 tab sections（跳过 tab 点击）
- ✨ 新增 `extractTabTextFromSection` 配置，自定义从 section 中提取 tab 文本的逻辑
- 📝 框架会自动从每个 section 的 heading 元素中提取 tab 文本（支持 h1-h6）
- ⚠️ 添加配置冲突检查，防止 `getAllTabSections` 与 tab 点击相关配置同时使用

**配置冲突说明：**

`getAllTabSections` 不能与以下配置同时使用：
- `tabListAriaLabel` - 用于定位 tab 列表
- `getTabSection` - 用于根据 tabText 获取 section
- `tabSectionLocator` - 定位符版本的 getTabSection

**使用示例：**

```typescript
const crawler = new BlockCrawler({
  // 直接获取所有 tab sections（跳过 tab 点击）
  getAllTabSections: async (page) => {
    return page.locator('section[data-tab-content]').all();
  },
  
  // 可选：自定义提取 tab 文本（如果不配置，会自动查找 heading）
  extractTabTextFromSection: async (section) => {
    return section.getByRole("heading", { level: 2 }).textContent();
  },
});
```

**适用场景：**

- ✅ 所有 tab 内容都在页面上，不需要点击切换
- ✅ 页面使用 CSS 隐藏/显示 tab 内容
- ✅ 想要更快的爬取速度（跳过点击等待）

**改进点：**

- 🎯 支持更多网站架构（不依赖 tab 点击）
- ⚡ 提升爬取速度（无需等待 tab 切换）
- 🛡️ 配置冲突检查，提供清晰的错误提示
- 📖 详细的错误提示，帮助开发者快速定位问题

