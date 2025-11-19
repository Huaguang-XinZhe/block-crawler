import type { Locator, Page } from "@playwright/test";
import type { ExtractFunction, LocatorOrCustom } from "../types/collect";

/**
 * 收集阶段配置
 */
export interface CollectConfig {
	startUrl: string;
	waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
	waitTimeout?: number;
	tabList?: LocatorOrCustom<Page>;
	tabSection?: LocatorOrCustom<Page>;
	tabSections?: ((page: Page) => Promise<Locator[]>) | string;
	name?: LocatorOrCustom<Locator>;
	count?: {
		locator: LocatorOrCustom<Locator>;
		extract?: ExtractFunction;
	};
}

/**
 * 收集阶段 (Builder Pattern)
 *
 * 职责：只负责收集配置，不执行任何操作
 *
 * @example
 * const phase = new CollectPhase('https://example.com/blocks')
 *   .tabSections('//main/section')
 *   .name('//h3/text()')
 *   .count('p');
 * const config = phase.getConfig();
 */
export class CollectPhase {
	private config: CollectConfig;

	constructor(startUrl: string) {
		this.config = { startUrl };
	}

	/**
	 * 设置等待选项
	 */
	wait(
		until?: "load" | "domcontentloaded" | "networkidle" | "commit",
		timeout?: number,
	): this {
		this.config.waitUntil = until;
		this.config.waitTimeout = timeout;
		return this;
	}

	/**
	 * 设置 tab list 配置（需要点击 tab 的场景）
	 */
	tabList(locatorOrCustom: LocatorOrCustom<Page>): this {
		this.config.tabList = locatorOrCustom;
		return this;
	}

	/**
	 * 设置 tab section 配置（需要点击 tab 的场景）
	 */
	tabSection(locatorOrCustom: LocatorOrCustom<Page>): this {
		this.config.tabSection = locatorOrCustom;
		return this;
	}

	/**
	 * 设置 tab sections 配置（不需要点击 tab 的场景）
	 */
	tabSections(
		locatorOrCustom: string | ((page: Page) => Promise<Locator[]>),
	): this {
		this.config.tabSections = locatorOrCustom;
		return this;
	}

	/**
	 * 设置名称提取配置
	 */
	name(locatorOrCustom: LocatorOrCustom<Locator>): this {
		this.config.name = locatorOrCustom;
		return this;
	}

	/**
	 * 设置数量统计配置
	 */
	count(locator: LocatorOrCustom<Locator>, extract?: ExtractFunction): this {
		this.config.count = { locator, extract };
		return this;
	}

	/**
	 * 获取配置（供 BlockCrawler 读取）
	 */
	getConfig(): CollectConfig {
		return this.config;
	}
}
