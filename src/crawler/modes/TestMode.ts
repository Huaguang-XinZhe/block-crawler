import type { Page } from "@playwright/test";
import type { InternalConfig } from "../../config/ConfigManager";
import type { ExtendedExecutionConfig } from "../../executors/ExecutionContext";
import { BlockProcessor } from "../../processors/BlockProcessor";
import { PageProcessor } from "../../processors/PageProcessor";
import { ScriptInjector } from "../../processors/ScriptInjector";
import { FilenameMappingManager } from "../../state/FilenameMapping";
import { createI18n, type I18n } from "../../utils/i18n";
import { SignalHandler } from "../../utils/signal-handler";
import type { ProcessingConfig } from "../utils/ConfigHelper";

/**
 * 测试模式
 *
 * 职责：
 * - 导航到测试页面
 * - 完全复用 PageProcessor 和 BlockProcessor 的逻辑（不进行并发处理）
 * - 处理信号（SIGINT/SIGTERM）
 */
export class TestMode {
	private i18n: I18n;
	private mappingManager?: FilenameMappingManager;
	private signalHandler?: SignalHandler;

	/**
	 * 检查是否正在终止
	 */
	static isProcessTerminating(): boolean {
		return SignalHandler.isProcessTerminating();
	}

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

		// 生成域名特定的路径
		const { generatePathsForUrl } = await import("../../config/ConfigManager");
		const paths = generatePathsForUrl(this.config, processingConfig.testUrl);

		// 初始化 filename mapping（用于 safe output）
		const outputDir = this.config.outputBaseDir + "/test";
		this.mappingManager = new FilenameMappingManager(
			paths.stateDir,
			this.config.locale,
		);
		await this.mappingManager.initialize();

		// 设置信号处理器
		this.signalHandler = new SignalHandler(this.config.locale, () => {
			if (this.mappingManager) {
				this.mappingManager.saveSync();
			}
		});
		this.signalHandler.setup();

		try {
			// 初始化脚本注入器（使用域名特定的 stateDir）
			const scriptInjector = new ScriptInjector(
				this.config,
				paths.stateDir,
				processingConfig.scriptInjection,
			);

			// 注入 beforePageLoad 脚本
			if (processingConfig.beforeOpenScripts.length > 0) {
				await scriptInjector.injectScripts(
					this.page,
					processingConfig.beforeOpenScripts,
					"beforePageLoad",
				);
			}

			// 导航到测试页面
			await this.navigateToTestPage(
				processingConfig.testUrl,
				processingConfig.waitUntil || "load",
			);

			// 注入 afterPageLoad 脚本
			if (processingConfig.afterOpenScripts.length > 0) {
				await scriptInjector.injectScripts(
					this.page,
					processingConfig.afterOpenScripts,
					"afterPageLoad",
				);
			}

			// 检查页面级 skipFree（如果配置了）
			// 注意：必须尽早检查，在自动滚动之前，这样可以避免不必要的操作
			if (processingConfig.pageSkipFreeText) {
				const { PageProcessor } = await import(
					"../../processors/PageProcessor"
				);
				const isFree = await PageProcessor.checkPageFree(
					this.page,
					this.config,
					processingConfig.pageSkipFreeText,
				);
				if (isFree) {
					console.log(
						this.i18n.t("page.skipFree", { path: processingConfig.testUrl }),
					);
					await this.mappingManager.save();
					return; // 跳过整个页面
				}
			}

			// 执行自动滚动（如果配置了）
			if (processingConfig.autoScroll) {
				await this.performAutoScroll(processingConfig.autoScroll);
			}

			// 执行 page handler（如果配置了）
			if (processingConfig.pageHandler) {
				// 使用真实的 PageProcessor
				const pageProcessor = new PageProcessor(
					this.config,
					outputDir,
					processingConfig.pageHandler,
					this.mappingManager,
				);

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
					blockSkipFree: processingConfig.blockSkipFreeText,
				};

				// 使用真实的 BlockProcessor
				const blockProcessor = new BlockProcessor(
					this.config,
					outputDir,
					processingConfig.blockLocator,
					processingConfig.blockHandler || null,
					undefined, // taskProgress (测试模式不需要)
					undefined, // beforeProcessBlocks
					this.mappingManager,
					false, // verifyBlockCompletion (测试模式不需要验证)
					extendedConfig,
					undefined, // freeRecorder
					undefined, // mismatchRecorder
					undefined, // expectedBlockCount
					undefined, // logger
					processingConfig.blockAutoConfig, // blockAutoConfig
					processingConfig.progressiveLocate, // progressiveLocate
				);

				await blockProcessor.processBlocksInPage(
					this.page,
					processingConfig.testUrl,
				);
			}

			// 保存 filename mapping
			await this.mappingManager.save();
		} finally {
			// 移除信号处理器
			this.signalHandler?.cleanup();
		}
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
