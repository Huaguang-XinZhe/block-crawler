/**
 * Block Crawler Framework
 * 一个基于 Playwright 的通用爬虫框架
 * 支持受限并发、进度恢复、单页面或单 Block 处理模式
 */

export { LinkCollector } from "./collectors/LinkCollector";
// Collector types
export type {
	CollectResult,
	ExtractionConfig,
	LinkCollectorConfig,
	LocatorOrCustom,
	LocatorsOrCustom,
	SectionConfig,
	WaitOptions,
} from "./collectors/types";
// Main exports
export { BlockCrawler } from "./crawler/BlockCrawler";

// State management
export type { FilenameMapping } from "./state/FilenameMapping";
export { FilenameMappingManager } from "./state/FilenameMapping";
export type { FreeRecord } from "./state/FreeRecorder";
export { FreeRecorder } from "./state/FreeRecorder";
export { TaskProgress } from "./state/TaskProgress";

// Type exports
export type {
	BeforeContext,
	BlockAutoConfig,
	BlockContext,
	BlockHandler,
	ClickAndVerify,
	ClickCode,
	CodeExtractor,
	CollectionLink,
	CrawlerConfig,
	FreeItem,
	PageContext,
	PageHandler,
	ProgressConfig,
	ProgressRebuildConfig,
	SiteMeta,
	VariantConfig,
} from "./types";
export { defaultCodeExtractor } from "./utils/default-code-extractor";
// Utils
export type { Locale } from "./utils/i18n";
export type { SafeOutput } from "./utils/safe-output";
