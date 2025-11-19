// 配置相关类型

// 点击操作相关类型
export type {
	ClickAndVerify,
	ClickCode,
} from "./actions";
// 收集相关类型
export type {
	CollectResult,
	ExtractFunction,
	LocatorOrCustom,
} from "./collect";
export type { CrawlerConfig } from "./config";
// 处理器相关类型
export type {
	BeforeContext,
	BeforeProcessBlocksHandler,
	BlockContext,
	BlockHandler,
	PageContext,
	PageHandler,
	TestContext,
	TestHandler,
} from "./handlers";

// 元信息相关类型
export type {
	CollectionLink,
	FreeItem,
	SiteMeta,
} from "./meta";
// 进度相关类型
export type {
	ProgressConfig,
	ProgressRebuildConfig,
} from "./progress";
