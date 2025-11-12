---
"block-crawler": minor
---

新增元信息收集和可选定位符功能

- ✨ collectionNameLocator 和 collectionCountLocator 改为可选，如果不提供则只记录 link
- ✨ 新增 skipPageFree 配置，支持跳过 Free 页面（支持字符串和函数配置）
- ✨ 新增 skipBlockFree 配置，支持跳过 Free Block（支持字符串和函数配置）
- ✨ 新增 MetaCollector 模块，自动收集网站元信息到 .crawler/域名/meta.json
- 📊 元信息包括：collectionLinks、展示总数、真实总数、Free 页面/Block 统计、耗时等
- 🔧 PageProcessor 和 BlockProcessor 返回 free 状态信息
- 🔧 CrawlerOrchestrator 集成元信息收集和保存
- 📝 导出新的 SiteMeta 和 FreeItem 类型

