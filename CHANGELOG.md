# block-crawler

## 0.2.0

### Minor Changes

- c327353: 新增元信息收集和可选定位符功能

  - ✨ collectionNameLocator 和 collectionCountLocator 改为可选，如果不提供则只记录 link
  - ✨ 新增 skipPageFree 配置，支持跳过 Free 页面（支持字符串和函数配置）
  - ✨ 新增 skipBlockFree 配置，支持跳过 Free Block（支持字符串和函数配置）
  - ✨ 新增 MetaCollector 模块，自动收集网站元信息到 .crawler/域名/meta.json
  - 📊 元信息包括：collectionLinks、展示总数、真实总数、Free 页面/Block 统计、耗时等
  - 🔧 PageProcessor 和 BlockProcessor 返回 free 状态信息
  - 🔧 CrawlerOrchestrator 集成元信息收集和保存
  - 📝 导出新的 SiteMeta 和 FreeItem 类型

### Patch Changes

- 8bb1e14: 优化元信息收集和错误处理

  - ✨ 在 meta.json 中添加 totalLinks 字段显示收集到的链接总数
  - 🔧 Free 匹配时严格验证数量必须为 1，如果不足或超过则报错提示
  - 🛡️ 添加 Ctrl+C 信号处理器，中断时自动保存进度和元信息
  - 📊 控制台输出优化：分别显示总链接数和总组件数

## 0.1.0

### 初始发布

基于 Playwright 的通用 Block 爬虫框架。

#### ✨ 核心特性

- 🎯 **双模式支持** - Block 模式和页面模式自由切换
- 🚀 **受限并发** - 可配置并发数，避免封禁
- 💾 **进度恢复** - 支持中断后继续爬取，自动跳过已完成任务
- ⚙️ **完全配置化** - 所有参数可配置，支持函数覆盖
- 🏗️ **模块化架构** - 单一职责原则，易于维护和扩展
- 📦 **自动化管理** - 自动生成进度文件和输出目录

#### 🏗️ 模块化架构

- **ConfigManager** - 配置生成和验证
- **TabProcessor** - Tab 获取、点击、Section 定位
- **LinkCollector** - 收集页面链接，统计 Block 数量
- **BlockProcessor** - Block 获取和处理逻辑
- **PageProcessor** - 单页面处理逻辑
- **CrawlerOrchestrator** - 协调各模块，管理并发和进度
- **BlockCrawler** - 提供简洁的公共 API

#### 📁 自动文件管理

根据 `startUrl` 自动生成域名子目录：

- 进度文件：`.crawler/域名/progress.json`
- 输出目录：`output/域名/`

#### ⚙️ 灵活配置

支持通过配置函数覆盖默认行为，无需继承子类：

- `getAllTabSections` - 直接获取所有 tab sections（跳过 tab 点击）
- `extractTabTextFromSection` - 自定义提取 tab 文本
- `getTabSection` - 自定义获取 tab section
- `getAllBlocks` - 自定义获取所有 Block 元素
- `getBlockName` - 自定义获取 Block 名称
- `extractBlockCount` - 自定义提取 Block 数量

#### 🛡️ 配置冲突检查

框架会自动检查配置冲突并提供清晰的错误提示，帮助开发者快速定位问题。
