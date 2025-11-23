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
 * - 处理信号（SIGINT/SIGTERM）
 */
export class TestMode {
	private i18n: I18n;
	private mappingManager?: FilenameMappingManager;
	private signalHandler?: (signal: NodeJS.Signals) => void;
	private static isTerminating = false;
	private static handlingSignal = false; // 防止重复处理信号

	/**
	 * 检查是否正在终止
	 */
	static isProcessTerminating(): boolean {
		return TestMode.isTerminating;
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

		// 设置信号处理器
		this.setupSignalHandlers();

		try {
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
			this.mappingManager = new FilenameMappingManager(
				this.config.stateBaseDir,
				this.config.locale,
			);
			await this.mappingManager.initialize();

			// 执行 page handler（如果配置了）
			if (processingConfig.pageHandler) {
				// 使用真实的 PageProcessor
				const pageProcessor = new PageProcessor(
					this.config,
					outputDir,
					processingConfig.pageHandler,
					this.mappingManager,
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
						await this.mappingManager.save();
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
					this.mappingManager,
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
			await this.mappingManager.save();
		} finally {
			// 移除信号处理器
			this.removeSignalHandlers();
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

	/**
	 * 设置信号处理器
	 */
	private setupSignalHandlers(): void {
		const handler = (signal: NodeJS.Signals) => {
			// 防止重复处理
			if (TestMode.handlingSignal) {
				return;
			}
			TestMode.handlingSignal = true;
			TestMode.isTerminating = true;

			console.log(`\n${this.i18n.t("common.signalReceived", { signal })}\n`);

			// 立即移除信号处理器，防止再次触发
			this.removeSignalHandlers();

			// 同步执行清理并退出
			this.performCleanupAndExit();
		};

		process.once("SIGINT", handler);
		process.once("SIGTERM", handler);
		this.signalHandler = handler;
	}

	/**
	 * 执行清理并退出
	 */
	private performCleanupAndExit(): void {
		try {
			if (this.mappingManager) {
				// 同步保存 filename mapping
				this.mappingManager.saveSync();
			}
			console.log(`\n${this.i18n.t("common.stateSaved")}\n`);
		} catch (error) {
			console.error(
				this.i18n.t("progress.saveFailed", {
					error: error instanceof Error ? error.message : String(error),
				}),
			);
		} finally {
			// 确保退出
			process.exit(0);
		}
	}

	/**
	 * 移除信号处理器
	 */
	private removeSignalHandlers(): void {
		if (this.signalHandler) {
			process.off("SIGINT", this.signalHandler);
			process.off("SIGTERM", this.signalHandler);
			this.signalHandler = undefined;
		}
	}
}
