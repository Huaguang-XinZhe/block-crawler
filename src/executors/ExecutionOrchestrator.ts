import type { Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import type { TaskProgress } from "../state/TaskProgress";
import type {
	BeforeContext,
	BlockHandler,
	CollectResult,
	PageHandler,
} from "../types";
import { createI18n } from "../utils/i18n";
import { ConcurrentExecutor } from "./ConcurrentExecutor";
import {
	ExecutionContext,
	type ExtendedExecutionConfig,
} from "./ExecutionContext";

/**
 * 执行协调器（简化版）
 *
 * 职责：
 * - 初始化执行上下文
 * - 协调执行流程
 * - 清理资源
 */
export class ExecutionOrchestrator {
	private context: ExecutionContext;
	private executor: ConcurrentExecutor;
	private cleanupCalled = false; // 防止重复调用 cleanup

	constructor(
		config: InternalConfig,
		private collectResult: CollectResult,
		baseUrl: string,
		outputDir: string,
		stateDir: string,
		freeFile: string,
		taskProgress: TaskProgress | undefined,
		extendedConfig: ExtendedExecutionConfig = {},
	) {
		const i18n = createI18n(config.locale);

		this.context = new ExecutionContext(
			config,
			baseUrl,
			outputDir,
			stateDir,
			freeFile,
			taskProgress,
			i18n,
			extendedConfig,
		);

		this.executor = new ConcurrentExecutor(this.context);
	}

	/**
	 * 清理资源（保存进度和 Free 记录）
	 * @param silent 是否静默执行（不输出日志）
	 */
	async cleanup(silent: boolean = false): Promise<void> {
		// 防止重复调用
		if (this.cleanupCalled) {
			return;
		}
		this.cleanupCalled = true;
		
		await this.context.cleanup(silent);
	}

	/**
	 * 执行爬取流程
	 */
	async run(
		page: Page,
		blockSectionLocator: string | null,
		blockHandler: BlockHandler | null,
		pageHandler: PageHandler | null,
		beforeProcessBlocks: ((context: BeforeContext) => Promise<void>) | null,
		options?: {
			waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
			beforeOpenScripts?: string[];
			afterOpenScripts?: string[];
			verifyBlockCompletion?: boolean;
			autoScroll?: boolean | { step?: number; interval?: number };
		},
	): Promise<void> {
		console.log(`\n${this.context.i18n.t("crawler.taskStart")}`);
		console.log(
			this.context.i18n.t("crawler.targetUrl", { url: this.context.baseUrl }),
		);
		console.log(
			this.context.i18n.t("crawler.maxConcurrency", {
				count: this.context.config.maxConcurrency,
			}),
		);
		console.log(
			this.context.i18n.t("crawler.outputDir", { dir: this.context.outputDir }),
		);

		const mode = blockSectionLocator
			? this.context.i18n.t("crawler.modeBlock")
			: this.context.i18n.t("crawler.modePage");
		console.log(this.context.i18n.t("crawler.mode", { mode }));

		// 初始化上下文
		await this.context.initialize();

		let isComplete = false;
		try {
			// 输出收集结果信息
			console.log(`\n${this.context.i18n.t("link.complete")}`);
			console.log(
				`   ${this.context.i18n.t("link.totalLinks", {
					count: this.collectResult.totalLinks,
				})}`,
			);
			console.log(
				`   ${this.context.i18n.t("link.totalBlocks", {
					count: this.collectResult.totalBlocks,
				})}`,
			);
			console.log();

			// 并发执行所有链接
			await this.executor.executeAll(page, this.collectResult, {
				blockSectionLocator,
				blockHandler,
				pageHandler,
				beforeProcessBlocks,
				waitUntil: options?.waitUntil,
				beforeOpenScripts: options?.beforeOpenScripts || [],
				afterOpenScripts: options?.afterOpenScripts || [],
				verifyBlockCompletion: options?.verifyBlockCompletion ?? true,
				autoScroll: options?.autoScroll,
			});

			console.log(`\n${this.context.i18n.t("crawler.allComplete")}\n`);
			isComplete = true;
		} catch (error) {
			console.error(`\n${this.context.i18n.t("common.error")}`);
			isComplete = false;
			throw error;
		} finally {
			await this.context.cleanup();
		}
	}
}
