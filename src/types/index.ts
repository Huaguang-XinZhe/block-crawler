/**
 * 统一导出所有类型定义
 */

export type { CollectResult } from "../collectors/types";
export type { ClickAndVerify, ClickCode } from "./actions";
export type { CrawlerConfig } from "./config";
export type {
	BeforeContext,
	BlockAutoConfig,
	BlockContext,
	BlockHandler,
	CodeExtractor,
	PageConfig,
	PageContext,
	PageHandler,
	VariantConfig,
} from "./handlers";
export type { CollectionLink, FreeItem, SiteMeta } from "./meta";
export type { ProgressConfig, ProgressRebuildConfig } from "./progress";
