import type { Page } from "@playwright/test";
import type { CollectResult } from "../../collectors/types";
import type { InternalConfig } from "../../config/ConfigManager";
import { generatePathsForUrl } from "../../config/ConfigManager";
import type { ExtendedExecutionConfig } from "../../executors/ExecutionContext";
import { ExecutionOrchestrator } from "../../executors/ExecutionOrchestrator";
import { TaskProgress } from "../../state/TaskProgress";
import { createI18n, type I18n } from "../../utils/i18n";
import type { ProcessingConfig } from "../utils/ConfigHelper";

/**
 * 处理模式
 *
 * 职责：
 * - 初始化执行器
 * - 执行页面/Block 处理
 * - 处理信号（SIGINT/SIGTERM）
 */
export class ProcessingMode {
	private i18n: I18n;
	private taskProgress?: TaskProgress;
	private orchestrator?: ExecutionOrchestrator;
	private signalHandler?: (signal: NodeJS.Signals) => void;
	private static isTerminating = false;
	private static handlingSignal = false; // 防止重复处理信号

	/**
	 * 检查是否正在终止
	 */
	static isProcessTerminating(): boolean {
		return ProcessingMode.isTerminating;
	}

	constructor(
		private config: InternalConfig,
		private page: Page,
	) {
		this.i18n = createI18n(config.locale);
	}

	/**
	 * 执行处理阶段
	 */
	async execute(
		collectResult: CollectResult,
		processingConfig: ProcessingConfig,
	): Promise<void> {
		// 初始化执行器
		await this.initializeOrchestrator(collectResult, processingConfig);

		this.setupSignalHandlers();

		try {
			if (!this.orchestrator) {
				throw new Error("Orchestrator 未初始化");
			}

			await this.orchestrator.run(
				this.page,
				processingConfig.blockLocator || null,
				processingConfig.blockHandler || null,
				processingConfig.pageHandler || null,
				null,
				{
					waitUntil: processingConfig.waitUntil,
					beforeOpenScripts: processingConfig.beforeOpenScripts,
					afterOpenScripts: processingConfig.afterOpenScripts,
					autoScroll: processingConfig.autoScroll,
				},
			);
		} finally {
			this.removeSignalHandlers();
		}
	}

	/**
	 * 初始化 Orchestrator
	 */
	private async initializeOrchestrator(
		collectResult: CollectResult,
		processingConfig: ProcessingConfig,
	): Promise<void> {
		const startUrl = collectResult.startUrl;
		const paths = generatePathsForUrl(this.config, startUrl);

		this.taskProgress = new TaskProgress(
			paths.progressFile,
			paths.outputDir,
			paths.stateDir,
			this.config.locale,
			this.config.progress,
		);

		// 构建扩展配置
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

		this.orchestrator = new ExecutionOrchestrator(
			this.config,
			collectResult,
			startUrl,
			paths.outputDir,
			paths.stateDir,
			paths.freeFile,
			this.taskProgress,
			extendedConfig,
		);
	}

	/**
	 * 设置信号处理器
	 */
	private setupSignalHandlers(): void {
		const handler = (signal: NodeJS.Signals) => {
			// 防止重复处理
			if (ProcessingMode.handlingSignal) {
				return;
			}
			ProcessingMode.handlingSignal = true;
			ProcessingMode.isTerminating = true;

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
			if (this.orchestrator) {
				// 使用同步方法确保保存完成
				this.orchestrator.cleanupSync();
			}
			console.log("\n✅ 状态保存完成\n");
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
