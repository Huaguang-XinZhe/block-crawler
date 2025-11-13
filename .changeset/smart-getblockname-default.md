---
"block-crawler": minor
---

优化 getBlockName 默认逻辑和增强 BlockContext

- ✨ 提供 getByRole('heading') 作为默认匹配逻辑
- 🔧 支持复杂 heading 结构自动提取 link 文本
- 📝 未找到 link 时提供清晰的错误提示
- 🎯 BlockContext 添加 isFree 字段，与 PageContext 保持一致

