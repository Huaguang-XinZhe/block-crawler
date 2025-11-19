/**
 * Block Crawler Framework
 * 一个基于 Playwright 的通用爬虫框架
 * 支持受限并发、进度恢复、单页面或单 Block 处理模式
 */

// Main exports
export { BlockCrawler } from "./BlockCrawler";
// Type exports - Phase/Mode
export type { BlockModeOptions } from "./phases/BlockMode";
// Type exports - Actions
export type {
	ClickAndVerify,
	ClickCode,
} from "./types/actions";
// Type exports - Collect
export type {
	CollectResult,
	ExtractFunction,
	LocatorOrCustom,
} from "./types/collect";
// Type exports - Config
export type { CrawlerConfig } from "./types/config";
// Type exports - Handlers
export type {
	BeforeContext,
	BeforeProcessBlocksHandler,
	BlockContext,
	BlockHandler,
	PageContext,
	PageHandler,
	TestContext,
	TestHandler,
} from "./types/handlers";
// Type exports - Meta
export type {
	CollectionLink,
	FreeItem,
	SiteMeta,
} from "./types/meta";
// Type exports - Progress
export type { ProgressConfig, ProgressRebuildConfig } from "./types/progress";
export type { FilenameMapping } from "./utils/filename-mapping";
export { FilenameMappingManager } from "./utils/filename-mapping";
export type { Locale } from "./utils/i18n";
export type { SafeOutput } from "./utils/safe-output";
export { TaskProgress } from "./utils/task-progress";
