import type { Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import type { FilenameMappingManager } from "../state/FilenameMapping";
import type { PageContext, PageHandler } from "../types";
import { createClickAndVerify, createClickCode } from "../utils/click-actions";
import { isDebugMode } from "../utils/debug";
import { createI18n, type I18n } from "../utils/i18n";
import { createSafeOutput } from "../utils/safe-output";

/**
 * Page 处理器
 * 职责：处理单个页面
 */
export class PageProcessor {
	private i18n: I18n;

	constructor(
		private config: InternalConfig,
		private outputDir: string,
		private pageHandler: PageHandler,
		private filenameMappingManager?: FilenameMappingManager,
	) {
		this.i18n = createI18n(config.locale);
	}

	/**
	 * 检查页面是否为 Free（静态方法，供外部调用）
	 */
	static async checkPageFree(
		page: Page,
		config: InternalConfig,
		skipFree?: string | ((page: Page) => Promise<boolean>),
	): Promise<boolean> {
		if (!skipFree) {
			return false;
		}

		// 字符串配置：使用 getByText 精确匹配
		if (typeof skipFree === "string") {
			const count = await page.getByText(skipFree, { exact: true }).count();

			if (count === 0) {
				return false;
			}

			if (count !== 1) {
				const i18n = createI18n(config.locale);
				throw new Error(i18n.t("page.freeError", { count, text: skipFree }));
			}

			return true;
		}

		// 函数配置：使用自定义判断逻辑
		return await skipFree(page);
	}

	/**
	 * 处理单个页面
	 * 注意：调用此方法前应该已经在 CrawlerOrchestrator 中检查过 Free 页面
	 */
	async processPage(page: Page, currentPath: string): Promise<void> {
		const clickAndVerify = createClickAndVerify(this.config.locale);
		const context: PageContext = {
			currentPage: page,
			currentPath,
			outputDir: this.outputDir,
			safeOutput: createSafeOutput(
				"page",
				this.outputDir,
				this.filenameMappingManager,
			),
			clickAndVerify,
			clickCode: createClickCode(page, clickAndVerify),
		};

		try {
			await this.pageHandler(context);
		} catch (error) {
			// 如果开启了 pauseOnError，暂停页面方便检查
			if (this.config.pauseOnError) {
				const debugMode = isDebugMode();
				const messageKey = debugMode
					? "error.pauseOnErrorDebug"
					: "error.pauseOnErrorNonDebug";

				console.error(
					this.i18n.t(messageKey, {
						type: "Page",
						name: "",
						path: currentPath,
						error: error instanceof Error ? error.message : String(error),
					}),
				);

				// 只在 debug 模式下暂停
				if (debugMode) {
					await page.pause();
				}
			}

			throw error;
		}
	}
}
