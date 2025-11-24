import type { Locator, Page } from "@playwright/test";
import type {
	CountExtractFunction,
	LinkCollectorConfig,
	LocatorOrCustom,
	LocatorsOrCustom,
	NameExtractFunction,
	SectionConfig,
} from "../../collectors/types";
import type { BlockAutoConfig } from "../../types/handlers";
import type { Locale } from "../../utils/i18n";

/**
 * 收集阶段配置
 */
export interface CollectionConfig {
	startUrl?: string;
	collectWaitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
	collectWaitTimeout?: number;
	tabListConfig?: LocatorOrCustom<Page>;
	tabSectionConfig?: LocatorOrCustom<Page>;
	tabSectionsConfig?: LocatorsOrCustom<Page>;
	nameConfig?: {
		locator: LocatorOrCustom<Locator>;
		extract?: NameExtractFunction;
	};
	countConfig?: {
		locator: LocatorOrCustom<Locator>;
		extract?: CountExtractFunction;
	};
}

/**
 * 处理阶段配置
 */
export interface ProcessingConfig {
	waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
	beforeOpenScripts: string[];
	afterOpenScripts: string[];
	pageHandler?: any;
	blockLocator?: string;
	blockHandler?: any;
	// Block 自动处理配置
	blockAutoConfig?: BlockAutoConfig;
	// 渐进式定位（批次大小固定为 3）
	progressiveLocate?: boolean;
	// 页面级 skipFree: undefined = 未设置, "default" = 使用默认匹配(/free/i), string = 精确匹配
	pageSkipFreeText?: string;
	// Block 级 skipFree: undefined = 未设置, "default" = 使用默认匹配(/free/i), string = 精确匹配
	blockSkipFreeText?: string;
	// 当前配置阶段（用于确定 skipFree 作用范围）
	_currentConfigStage?: "page" | "block";
	// 测试模式配置
	testUrl?: string;
	// 页面级自动滚动配置
	autoScroll?: boolean | { step?: number; interval?: number };
	// Block 相关配置
	getBlockName?: (
		block: import("@playwright/test").Locator,
	) => Promise<string | null>;
	blockNameLocator?: string;
	getAllBlocks?: (
		page: import("@playwright/test").Page,
	) => Promise<import("@playwright/test").Locator[]>;
	// 脚本注入配置
	scriptInjection?: boolean | { enabled: boolean; scripts?: string[] };
}

/**
 * 测试模式配置
 */
export interface TestConfig {
	url: string;
	locator: string;
	options?: { index?: number; name?: string };
}

/**
 * 配置辅助工具
 */
export class ConfigHelper {
	/**
	 * 检查是否配置了 section
	 */
	static hasSection(config: CollectionConfig): boolean {
		return !!config.tabSectionsConfig || !!config.tabSectionConfig;
	}

	/**
	 * 构建 SectionConfig
	 */
	static buildSectionConfig(config: CollectionConfig): SectionConfig {
		const hasTabSections = !!config.tabSectionsConfig;
		const hasTabSection = !!config.tabSectionConfig;

		// 检查互斥性
		if (hasTabSections && hasTabSection) {
			throw new Error(
				"不能同时配置 tabSections 和 tabSection。请选择其中一种模式：\n" +
					"- 静态模式：使用 .tabSections()\n" +
					"- Tabs 模式：使用 .tabSection()（tabList 可选）",
			);
		}

		// 静态模式
		if (hasTabSections) {
			return {
				mode: "static",
				tabSections: config.tabSectionsConfig!,
			};
		}

		// Tabs 模式
		return {
			mode: "tabs",
			tabList: config.tabListConfig,
			tabSection: config.tabSectionConfig!,
		};
	}

	/**
	 * 构建 LinkCollectorConfig
	 */
	static buildCollectorConfig(
		config: CollectionConfig,
		page: Page,
		locale: Locale,
		stateBaseDir: string,
	): LinkCollectorConfig {
		const section = ConfigHelper.buildSectionConfig(config);

		return {
			startUrl: config.startUrl!,
			page,
			section,
			extraction: {
				name: config.nameConfig,
				count: config.countConfig,
			},
			wait: {
				waitUntil: config.collectWaitUntil,
				timeout: config.collectWaitTimeout,
			},
			locale,
			stateDir: stateBaseDir,
		};
	}
}
