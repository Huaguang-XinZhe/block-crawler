import type { Locator, Page } from "@playwright/test";
import type { CollectionLink } from "../types/meta";
import type { Locale } from "../utils/i18n";

/**
 * 收集结果类型
 */
export interface CollectResult {
	/** 最后更新时间 */
	lastUpdate: string;
	/** 链接总数 */
	totalLinks: number;
	/** Block 总数 */
	totalBlocks: number;
	/** 集合列表 */
	collections: CollectionLink[];
}

/**
 * 定位符或自定义逻辑（单个）
 */
export type LocatorOrCustom<T = Locator> =
	| string
	| ((parent: T) => Locator | Promise<Locator>);

/**
 * 定位符或自定义逻辑（多个）
 */
export type LocatorsOrCustom<T = Locator> =
	| string
	| ((parent: T) => Locator[] | Promise<Locator[]>);

/**
 * 提取函数（用于 count）
 */
export type CountExtractFunction<T = string | null> = (text: T) => number;

/**
 * 名称提取函数（用于 name）
 */
export type NameExtractFunction = (locator: Locator) => Promise<string>;

/**
 * Section 提取配置（两种模式：static、tabs）
 */
export type SectionConfig =
	| {
			/** 模式：静态定位符 */
			mode: "static";
			/** 定位符或自定义逻辑 */
			tabSections: LocatorsOrCustom<Page>;
	  }
	| {
			/** 模式：需要点击 tab 切换 */
			mode: "tabs";
			/** Tab list 定位符（可选，未提供时使用页面第一个 role 为 tablist 的元素） */
			tabList?: LocatorOrCustom<Page>;
			/** Tab section 定位符 */
			tabSection: LocatorOrCustom<Page>;
	  };
/**
 * 链接信息提取配置
 */
export interface ExtractionConfig {
	/** 名称提取配置 */
	name?: {
		locator: LocatorOrCustom<Locator>;
		extract?: NameExtractFunction;
	};
	/** 数量提取配置 */
	count?: {
		locator: LocatorOrCustom<Locator>;
		extract?: CountExtractFunction;
	};
}

/**
 * 等待选项
 */
export interface WaitOptions {
	/** 等待类型 */
	waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
	/** 超时时间（毫秒） */
	timeout?: number;
}

/**
 * LinkCollector 主配置
 */
export interface LinkCollectorConfig {
	/** 起始 URL */
	startUrl: string;
	/** Page 实例 */
	page: Page;
	/** Section 提取配置 */
	section: SectionConfig;
	/** 链接信息提取配置 */
	extraction?: ExtractionConfig;
	/** 等待选项 */
	wait?: WaitOptions;
	/** 语言 */
	locale?: Locale;
	/** 状态目录 */
	stateDir?: string;
}
