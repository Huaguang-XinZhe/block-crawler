---
"@huaguang/block-crawler": patch
---

优化文件名 sanitize 逻辑和映射记录机制

**改进原则：**
在保证安全的前提下，尽可能不改变原文件名

**主要变更：**

1. **更保守的 sanitize 策略**
   - 保留空格（空格在大多数系统是合法的）
   - 只替换真正非法的字符：`< > : " / \ | ? *`
   - 移除控制字符和删除字符
   - 避免过度修改文件名

2. **完善映射记录**
   - 记录完整路径的映射，不仅仅是文件名
   - 修复 block 模式下路径变化未记录的问题
   - 修复用户提供 filePath 时的路径处理
   - 确保所有文件名变化都被记录

**示例：**

变更前（过于激进）：
- `"Step 1: Forgot password"` → `"Step_1__Forgot_password"` （空格被替换）

变更后（更保守）：
- `"Step 1: Forgot password"` → `"Step 1_ Forgot password"` （只替换冒号，保留空格）

