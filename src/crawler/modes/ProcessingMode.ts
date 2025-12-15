import type { Page } from "@playwright/test";
import type { CollectResult } from "../../collectors/types";
import type { InternalConfig } from "../../config/ConfigManager";
import { generatePathsForUrl } from "../../config/ConfigManager";
import type { ExtendedExecutionConfig } from "../../executors/ExecutionContext";
import { ExecutionOrchestrator } from "../../executors/ExecutionOrchestrator";
import { TaskProgress } from "../../state/TaskProgress";
import { createI18n, type I18n } from "../../utils/i18n";
import { SignalHandler } from "../../utils/signal-handler";
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
	 * 执行处理阶段
	 */
	async execute(
		collectResult: CollectResult,
		processingConfig: ProcessingConfig,
		startUrl?: string,
	): Promise<void> {
		// 初始化执行器
		await this.initializeOrchestrator(
			collectResult,
			processingConfig,
			startUrl,
		);

		// 设置信号处理器
		this.signalHandler = new SignalHandler(this.config.locale, () => {
			if (this.orchestrator) {
				this.orchestrator.cleanupSync();
			}
		});
		this.signalHandler.setup();

		try {
			if (!this.orchestrator) {
				throw new Error("Orchestrator 未初始化");
			}

			await this.orchestrator.run(
				this.page,
				processingConfig.blockLocator || null,
				processingConfig.blockHandler || null,
				processingConfig.blockAutoConfig || null,
				processingConfig.conditionalBlockConfigs || null,
				processingConfig.blockSectionConfigs || null,
				processingConfig.pageHandler || null,
				null,
				{
					waitUntil: processingConfig.waitUntil,
					beforeOpenScripts: processingConfig.beforeOpenScripts,
					afterOpenScripts: processingConfig.afterOpenScripts,
					autoScroll: processingConfig.autoScroll,
					progressiveLocate: processingConfig.progressiveLocate,
				},
			);
		} finally {
			this.signalHandler?.cleanup();
		}
	}

	/**
	 * 初始化 Orchestrator
	 */
	private async initializeOrchestrator(
		collectResult: CollectResult,
		processingConfig: ProcessingConfig,
		startUrl?: string,
	): Promise<void> {
		if (!startUrl) {
			throw new Error("startUrl is required for processing mode");
		}
		const paths = generatePathsForUrl(this.config, startUrl);

		// 只有显式配置 enable: true 时才启用进度管理
		if (this.config.progress?.enable === true) {
			this.taskProgress = new TaskProgress(
				paths.progressFile,
				paths.outputDir,
				paths.stateDir,
				this.config.locale,
				this.config.progress,
			);
		}

		// 构建扩展配置
		const extendedConfig: ExtendedExecutionConfig = {
			getBlockName: processingConfig.getBlockName,
			blockNameLocator: processingConfig.blockNameLocator,
			getAllBlocks: processingConfig.getAllBlocks,
			scriptInjection: processingConfig.scriptInjection,
			pageSkipFree: processingConfig.pageSkipFreeText,
			blockSkipFree: processingConfig.blockSkipFreeText,
		};

		this.orchestrator = new ExecutionOrchestrator(
			this.config,
			collectResult,
			startUrl,
			paths.outputDir,
			paths.stateDir,
			paths.domain,
			paths.freeFile,
			this.taskProgress,
			extendedConfig,
		);
	}
}
