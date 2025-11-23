import type { Page } from "@playwright/test";
import type { InternalConfig } from "../../config/ConfigManager";
import type { ExtendedExecutionConfig } from "../../executors/ExecutionContext";
import { BlockProcessor } from "../../processors/BlockProcessor";
import { PageProcessor } from "../../processors/PageProcessor";
import { FilenameMappingManager } from "../../state/FilenameMapping";
import { createI18n, type I18n } from "../../utils/i18n";
import type { ProcessingConfig } from "../utils/ConfigHelper";

/**
 * 测试模式
 *
 * 职责：
 * - 导航到测试页面
 * - 完全复用 PageProcessor 和 BlockProcessor 的逻辑（不进行并发处理）
 */
export class TestMode {
	private i18n: I18n;

	constructor(
		private config: InternalConfig,
		private page: Page,
	) {
		this.i18n = createI18n(config.locale);
	}

	/**
	 * 执行测试模式
	 */
	async execute(processingConfig: ProcessingConfig): Promise<void> {
		if (!processingConfig.testUrl) {
			throw new Error("测试模式需要提供 testUrl");
		}

		// 导航到测试页面
		await this.navigateToTestPage(
			processingConfig.testUrl,
			processingConfig.waitUntil || "load",
		);

		// 注入脚本警告
		if (
			processingConfig.beforeOpenScripts.length > 0 ||
			processingConfig.afterOpenScripts.length > 0
		) {
			console.warn(this.i18n.t("crawler.testScriptWarning"));
		}

		// 执行自动滚动（如果配置了）
		if (processingConfig.autoScroll) {
			await this.performAutoScroll(processingConfig.autoScroll);
		}

		// 初始化 filename mapping（用于 safe output）
		const outputDir = this.config.outputBaseDir + "/test";
		const mappingManager = new FilenameMappingManager(
			this.config.stateBaseDir,
			this.config.locale,
		);
		await mappingManager.initialize();

		// 执行 page handler（如果配置了）
		if (processingConfig.pageHandler) {
			// 使用真实的 PageProcessor
			const pageProcessor = new PageProcessor(
				this.config,
				outputDir,
				processingConfig.pageHandler,
				mappingManager,
			);

			// 检查是否为 Free Page（仅在 skipFreeMode 为 "page" 时）
			if (
				processingConfig.skipFreeMode === "page" &&
				processingConfig.skipFreeText
			) {
				const isFree = await PageProcessor.checkPageFree(
					this.page,
					this.config,
					processingConfig.skipFreeText,
				);
				if (isFree) {
					console.log(
						this.i18n.t("page.skipFree", { path: processingConfig.testUrl }),
					);
					await mappingManager.save();
					return; // 跳过整个页面
				}
			}

			await pageProcessor.processPage(this.page, processingConfig.testUrl);
		}

		// 执行 block handler（如果配置了）
		if (
			(processingConfig.blockHandler || processingConfig.blockAutoConfig) &&
			processingConfig.blockLocator
		) {
			// 准备 ExtendedExecutionConfig
			const extendedConfig: ExtendedExecutionConfig = {
				getBlockName: processingConfig.getBlockName,
				blockNameLocator: processingConfig.blockNameLocator,
				getAllBlocks: processingConfig.getAllBlocks,
				scriptInjection: processingConfig.scriptInjection,
				skipFreeMode: processingConfig.skipFreeMode,
				// skipFree 根据 skipFreeMode 传递
				skipFree:
					processingConfig.skipFreeMode === "block"
						? processingConfig.skipFreeText
						: processingConfig.skipFreeMode === "page"
							? processingConfig.skipFreeText
							: undefined,
			};

			// 使用真实的 BlockProcessor
			const blockProcessor = new BlockProcessor(
				this.config,
				outputDir,
				processingConfig.blockLocator,
				processingConfig.blockHandler || null,
				undefined, // taskProgress (测试模式不需要)
				undefined, // beforeProcessBlocks
				mappingManager,
				false, // verifyBlockCompletion (测试模式不需要验证)
				extendedConfig,
				undefined, // freeRecorder
				undefined, // mismatchRecorder
				undefined, // expectedBlockCount
				undefined, // logger
				processingConfig.blockAutoConfig, // blockAutoConfig
			);

			await blockProcessor.processBlocksInPage(
				this.page,
				processingConfig.testUrl,
			);
		}

		// 保存 filename mapping
		await mappingManager.save();
	}

	/**
	 * 导航到测试页面
	 */
	private async navigateToTestPage(
		url: string,
		waitUntil: "load" | "domcontentloaded" | "networkidle" | "commit",
	): Promise<void> {
		console.log(`\n${this.i18n.t("crawler.testVisitingUrl", { url })}`);
		await this.page.goto(url, { waitUntil });
		console.log(this.i18n.t("crawler.pageLoaded"));
	}

	/**
	 * 执行自动滚动
	 */
	private async performAutoScroll(
		autoScroll: boolean | { step?: number; interval?: number },
	): Promise<void> {
		const { autoScrollToBottom } = await import("../../utils/auto-scroll");
		const scrollConfig = typeof autoScroll === "boolean" ? {} : autoScroll;
		console.log(`\n${this.i18n.t("page.autoScrolling")}`);
		const result = await autoScrollToBottom(this.page, scrollConfig);
		if (result.success) {
			console.log(
				`${this.i18n.t("page.autoScrollComplete", { duration: result.duration })}\n`,
			);
		} else {
			console.log(
				this.i18n.t("page.autoScrollError") +
					` (${result.duration}s)${result.error ? `: ${result.error}` : ""}\n`,
			);
		}
	}
}
