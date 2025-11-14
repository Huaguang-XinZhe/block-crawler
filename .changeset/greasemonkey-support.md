---
"@huaguang/block-crawler": minor
---

新增油猴脚本支持

**新功能：**
- 完全支持油猴（Tampermonkey）脚本格式
- 自动识别和处理油猴脚本元数据（`// ==UserScript==`）
- 提供完整的油猴API polyfill

**支持的油猴API：**
- `GM_addStyle(css)` - 添加CSS样式
- `GM_getValue/GM_setValue/GM_deleteValue/GM_listValues` - 数据存储
- `GM_xmlhttpRequest(details)` - 网络请求（基于fetch实现）
- `GM_info` - 脚本信息对象
- `GM_log` - 日志输出
- `unsafeWindow` - 原始window对象

**使用说明：**
- 可以直接使用现有的油猴脚本，无需修改
- 自动区分普通JavaScript和油猴脚本格式
- 存储API使用sessionStorage模拟，会话期间数据保持

**文档更新：**
- 新增油猴脚本支持说明
- 提供油猴脚本使用示例
- 列出支持的API和注意事项

