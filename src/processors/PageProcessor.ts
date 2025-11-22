import type { Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import type { FilenameMappingManager } from "../state/FilenameMapping";
import type { PageContext, PageHandler } from "../types";
import { createClickAndVerify, createClickCode } from "../utils/click-actions";
import { isDebugMode } from "../utils/debug";
import { checkPageFree as checkPageFreeUtil } from "../utils/free-checker";
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
	 *
	 * @param skipFree 跳过配置：
	 *   - undefined: 未启用跳过
	 *   - null: 使用默认匹配 /free/i（忽略大小写）
	 *   - string: 精确匹配指定文本
	 *   - function: 自定义判断逻辑
	 */
	static async checkPageFree(
		page: Page,
		config: InternalConfig,
		skipFree?: string | null | ((page: Page) => Promise<boolean>),
	): Promise<boolean> {
		return await checkPageFreeUtil(page, config, skipFree);
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
			// 检测是否是进程终止导致的错误（Ctrl+C）
			const isTerminationError =
				error instanceof Error &&
				(error.message.includes("Test ended") ||
					error.message.includes("Browser closed") ||
					error.message.includes("Target closed"));

			// 导入 ProcessingMode 来检查终止状态
			const { ProcessingMode } = await import(
				"../crawler/modes/ProcessingMode"
			);
			const isTerminating = ProcessingMode.isProcessTerminating();

			// 如果是终止导致的错误，直接抛出不显示错误信息
			if (isTerminating || isTerminationError) {
				throw error;
			}

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
