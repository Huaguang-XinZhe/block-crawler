/**
 * Block Crawler Framework
 * 一个基于 Playwright 的通用爬虫框架
 * 支持受限并发、进度恢复、单页面或单 Block 处理模式
 */

export { BlockCrawler } from "./crawler";
export { TaskProgress } from "./utils/task-progress";
export type {
  CrawlerConfig,
  PageContext,
  BlockContext,
  PageHandler,
  BlockHandler,
  BeforeProcessBlocksHandler,
  CollectionLink,
  SiteMeta,
  FreeItem,
} from "./types";
export type { Locale } from "./utils/i18n";

