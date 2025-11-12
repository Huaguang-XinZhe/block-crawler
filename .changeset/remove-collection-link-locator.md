---
"block-crawler": minor
---

移除 collectionLinkLocator 配置，统一使用 getByRole('link')

- ♻️ BREAKING CHANGE: 移除 collectionLinkLocator 配置项
- ✨ LinkCollector 现在统一使用 `section.getByRole('link')` 查找链接
- 🎯 简化配置，提高一致性和可访问性
- 📝 更新所有测试文件移除 collectionLinkLocator 配置

