import type { PageHandler } from "../types/handlers";

/**
 * Page 模式配置
 */
export interface PageModeConfig {
	handler: PageHandler;
}

/**
 * Page 处理模式 (Builder Pattern)
 *
 * 职责：只负责收集配置，不执行任何操作
 *
 * @example
 * const mode = new PageMode()
 *   .handler(async ({ currentPage }) => { ... });
 * const config = mode.getConfig();
 */
export class PageMode {
	private config: Partial<PageModeConfig> = {};

	/**
	 * 设置 Page 处理函数
	 */
	handler(handler: PageHandler): this {
		this.config.handler = handler;
		return this;
	}

	/**
	 * 获取配置（供 BlockCrawler 读取）
	 */
	getConfig(): PageModeConfig {
		if (!this.config.handler) {
			throw new Error("必须设置 Page handler");
		}
		return this.config as PageModeConfig;
	}
}
