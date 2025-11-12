---
"block-crawler": patch
---

修复 fs-extra 导入方式导致方法不可用的问题

- 🐛 修复 `import * as fse` 导致 `outputJson` 等方法在 ESM 环境下不可用的问题
- ✅ 统一所有文件使用 `import fse from "fs-extra"` 导入方式
- 🔧 确保所有 fs-extra 方法在 TypeScript/ESM 环境下正常工作

