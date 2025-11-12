# block-crawler

## 0.5.2

### Patch Changes

- 移除 meta.json 中的 lastUpdate 字段

## 0.5.1

### Patch Changes

- 9c53e08: 修复页面进度追踪问题并恢复 duration 字段

  - 🐛 修复非 Free 页面处理完成后没有被标记到进度的严重 bug
  - ✨ 恢复 `duration` 和 `startTime` 字段以记录每次运行的耗时
  - 🎯 现在所有处理完成的页面（包括 Free 和非 Free）都会被正确标记到进度文件
  - 📊 `duration` 显示本次运行的实际耗时（秒）

## 0.5.0

### Minor Changes

- be8ecaa: 优化元信息持久化机制，支持多次部分运行

  - ✨ Free 页面和 Free Block 现在采用追加而非覆盖策略，支持多次部分运行累积
  - ✨ 添加 `isComplete` 字段标记爬虫是否完整运行（未中断/未发生错误）
  - 🔄 Breaking: 移除 `startTime`、`endTime`、`duration` 字段，改用 `lastUpdate` 字段
  - ✨ MetaCollector 现在会自动加载并合并已有的 Free 数据
  - 🎯 正常完成时 `isComplete` 为 `true`，中断或错误时为 `false`

## 0.4.3

### Patch Changes

- de30dbd: 修复 Free 页面进度记录和 pageHandler 调用问题

  - 🐛 修复 Free 页面没有被标记到进度文件的问题
  - 🐛 修复 pageHandler 在 Free 页面时不会被调用的问题
  - ✨ pageHandler 现在始终会被调用，在 PageContext 中添加 `isFree` 标记让用户决定是否处理
  - 🔧 在 CrawlerOrchestrator 中添加 `normalizePagePath` 方法用于路径标准化

## 0.4.2

### Patch Changes

- 81274ca: 修复 fs-extra 导入方式导致方法不可用的问题

  - 🐛 修复 `import * as fse` 导致 `outputJson` 等方法在 ESM 环境下不可用的问题
  - ✅ 统一所有文件使用 `import fse from "fs-extra"` 导入方式
  - 🔧 确保所有 fs-extra 方法在 TypeScript/ESM 环境下正常工作

## 0.4.1

### Patch Changes

- e2b1542: 修复文件写入方法和优化域名目录格式

  - 🐛 修复 `fse.writeJson` 不存在的错误，改用 `fse.outputJson` 方法
  - 🔄 优化域名目录格式：从横杠分隔改为保留原始点号（如 `www.untitledui.com` 而非 `www-untitledui-com`）
  - ✨ 所有 JSON 写入操作现在自动确保目录存在

## 0.4.0

### Minor Changes

- 完善国际化支持并修复代码质量问题

  - ✨ 完整的国际化支持：所有日志输出现在都支持中英文切换（66 个日志全部国际化）
  - 🔧 新增 30+ 个翻译键，涵盖爬虫任务、进度管理、Block/Page 处理等模块
  - 🛠️ 新增 `scripts/check-i18n.ts` 工具：自动检测未国际化的日志，方便后续维护
  - 🐛 修复代码质量问题：移除未使用的变量，通过 TypeScript 严格检查
  - 📊 改进检查脚本统计逻辑：修复负数问题，统计结果更加清晰准确

## 0.3.0

### Minor Changes

- 0f2ee47: 移除 collectionLinkLocator 配置，统一使用 getByRole('link')

  - ♻️ BREAKING CHANGE: 移除 collectionLinkLocator 配置项
  - ✨ LinkCollector 现在统一使用 `section.getByRole('link')` 查找链接
  - 🎯 简化配置，提高一致性和可访问性
  - 📝 更新所有测试文件移除 collectionLinkLocator 配置

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
