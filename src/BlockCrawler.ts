import path from "node:path";
import type { Page } from "@playwright/test";
import fse from "fs-extra";
import { LinkCollectorChain } from "./collector/LinkCollectorChain";
import {
	createInternalConfig,
	extractHostname,
	generatePathsForUrl,
	type InternalConfig,
} from "./core/ConfigManager";
import { CrawlerOrchestrator } from "./core/CrawlerOrchestrator";
import { BlockMode } from "./phases/BlockMode";
import { CollectPhase } from "./phases/CollectPhase";
import { PageMode } from "./phases/PageMode";
import type { CollectResult } from "./types/collect";
import type { CrawlerConfig } from "./types/config";
import type {
	BeforeProcessBlocksHandler,
	BlockContext,
	PageContext,
	TestHandler,
} from "./types/handlers";
import { createI18n, type I18n } from "./utils/i18n";
import { TaskProgress } from "./utils/task-progress";

/**
 * Block 爬虫 (Facade Pattern)
 *
 * 职责：
 * 1. 提供用户友好的链式 API
 * 2. 协调各个阶段/模式
 * 3. 委托给 CrawlerOrchestrator 执行
 *
 * 不负责：
 * - 具体的爬取逻辑（由 CrawlerOrchestrator 负责）
 * - 配置的存储（由 Phase/Mode 负责）
 *
 * @example
 * const crawler = new BlockCrawler(page);
 *
 * // 前置：收集阶段
 * crawler
 *   .collect('https://example.com/blocks')
 *   .tabSections('//main/section')
 *   .name('//h3/text()')
 *   .count('p');
 *
 * // 处理：Block 模式
 * crawler
 *   .blocks('[data-preview]')
 *   .before(async (page) => { ... })
 *   .each(async ({ block }) => { ... });
 *
 * // 必须：执行
 * await crawler.run();
 */
export class BlockCrawler {
	private config: InternalConfig;
	private i18n: I18n;

	// 阶段/模式（Builder Pattern）
	private collectPhase?: CollectPhase;
	private blockMode?: BlockMode;
	private pageMode?: PageMode;

	// 执行器（延迟初始化）
	private taskProgress?: TaskProgress;
	private orchestrator?: CrawlerOrchestrator;
	private signalHandler?: NodeJS.SignalsListener;

	constructor(
		private page: Page,
		config?: CrawlerConfig,
	) {
		this.config = createInternalConfig(config || {});
		this.i18n = createI18n(this.config.locale);
	}

	// ==================== 配置阶段 ====================

	/**
	 * 配置收集阶段（前置阶段）
	 *
	 * @param startUrl 起始 URL
	 * @returns CollectPhase 支持链式配置
	 */
	collect(startUrl: string): CollectPhase {
		this.collectPhase = new CollectPhase(startUrl);
		return this.collectPhase;
	}

	/**
	 * 配置 Block 处理模式
	 *
	 * @param sectionLocator Block 区域定位符
	 * @param options 可选配置
	 * @returns BlockMode 支持链式配置
	 */
	blocks(
		sectionLocator: string,
		options?: { verifyBlockCompletion?: boolean },
	): BlockMode {
		this.blockMode = new BlockMode(sectionLocator, options);
		return this.blockMode;
	}

	/**
	 * 配置 Page 处理模式
	 *
	 * @returns PageMode 支持链式配置
	 */
	pages(): PageMode {
		this.pageMode = new PageMode();
		return this.pageMode;
	}

	/**
	 * 测试模式（直接执行，不需要 run()）
	 *
	 * @param url 测试 URL
	 * @param sectionLocator Section 定位符
	 * @param sectionIndex Section 索引（可选）
	 * @param blockName Block 名称（可选）
	 */
	test(
		url: string,
		sectionLocator: string,
		sectionIndex?: number,
		blockName?: string,
	): {
		before: (handler: BeforeProcessBlocksHandler) => {
			run: (handler: TestHandler) => Promise<void>;
		};
		run: (handler: TestHandler) => Promise<void>;
	} {
		let beforeHandler: BeforeProcessBlocksHandler | undefined;

		return {
			before: (handler: BeforeProcessBlocksHandler) => {
				beforeHandler = handler;
				return {
					run: (testHandler: TestHandler) =>
						this.runTestMode(
							url,
							sectionLocator,
							sectionIndex,
							blockName,
							testHandler,
							beforeHandler,
						),
				};
			},
			run: (handler: TestHandler) =>
				this.runTestMode(
					url,
					sectionLocator,
					sectionIndex,
					blockName,
					handler,
					beforeHandler,
				),
		};
	}

	// ==================== 执行阶段 ====================

	/**
	 * 执行爬虫任务（必须调用）
	 *
	 * 执行流程：
	 * 1. 如果配置了收集阶段，检查/执行收集
	 * 2. 如果配置了处理模式，执行处理
	 */
	async run(): Promise<void> {
		// 步骤 1: 执行收集阶段（如果配置了）
		if (this.collectPhase) {
			await this.executeCollect();
		}

		// 步骤 2: 执行处理模式（如果配置了）
		if (this.blockMode) {
			await this.executeBlockMode();
		} else if (this.pageMode) {
			await this.executePageMode();
		} else {
			// 只执行了收集，没有处理模式
			if (!this.collectPhase) {
				throw new Error("必须配置收集阶段或处理模式（blocks/pages）");
			}
		}
	}

	// ==================== 内部执行方法 ====================

	/**
	 * 执行收集阶段
	 */
	private async executeCollect(): Promise<CollectResult> {
		if (!this.collectPhase) {
			throw new Error("未配置收集阶段");
		}

		const collectConfig = this.collectPhase.getConfig();
		const i18n = createI18n(this.config.locale);

		// 检查是否已有收集结果
		const existingResult = await this.loadCollectResult(collectConfig.startUrl);

		if (existingResult) {
			console.log(
				`\n${i18n.t("collect.skipExisting", { count: existingResult.summary.totalLinks })}`,
			);
			return existingResult;
		}

		// 执行收集
		const chain = new LinkCollectorChain(this.page)
			.collect(collectConfig.startUrl)
			.setLocale(this.config.locale)
			.setStateDir(this.config.stateBaseDir);

		if (collectConfig.waitUntil || collectConfig.waitTimeout) {
			chain.wait(collectConfig.waitUntil, collectConfig.waitTimeout);
		}

		if (collectConfig.tabSections) {
			chain.tabSections(collectConfig.tabSections);
		} else if (collectConfig.tabList && collectConfig.tabSection) {
			chain.tabList(collectConfig.tabList);
			chain.tabSection(collectConfig.tabSection);
		}

		if (collectConfig.name) {
			chain.name(collectConfig.name);
		}

		if (collectConfig.count) {
			chain.count(collectConfig.count.locator, collectConfig.count.extract);
		}

		return await chain.run();
	}

	/**
	 * 加载已有的收集结果
	 */
	private async loadCollectResult(
		startUrl: string,
	): Promise<CollectResult | null> {
		const hostname = extractHostname(startUrl, this.config.locale);
		const collectFile = path.join(
			this.config.stateBaseDir,
			hostname,
			"collect.json",
		);

		if (await fse.pathExists(collectFile)) {
			return await fse.readJson(collectFile);
		}

		return null;
	}

	/**
	 * 执行 Block 模式
	 */
	private async executeBlockMode(): Promise<void> {
		if (!this.blockMode) return;
		if (!this.collectPhase) {
			throw new Error("Block 模式需要先配置收集阶段");
		}

		const blockConfig = this.blockMode.getConfig();
		const collectConfig = this.collectPhase.getConfig();

		// 先执行收集（如果还没有收集结果）
		const collectResult = await this.executeCollect();

		// 初始化执行器（传入收集结果）
		await this.initializeOrchestrator(collectConfig.startUrl, collectResult);

		this.setupSignalHandlers();

		try {
			await this.executeInternal(
				blockConfig.sectionLocator,
				blockConfig.handler,
				null,
				blockConfig.beforeHandler,
				null,
				blockConfig.options,
			);
		} finally {
			this.removeSignalHandlers();
		}
	}

	/**
	 * 执行 Page 模式
	 */
	private async executePageMode(): Promise<void> {
		if (!this.pageMode) return;
		if (!this.collectPhase) {
			throw new Error("Page 模式需要先配置收集阶段");
		}

		const pageConfig = this.pageMode.getConfig();
		const collectConfig = this.collectPhase.getConfig();

		// 先执行收集（如果还没有收集结果）
		const collectResult = await this.executeCollect();

		// 初始化执行器（传入收集结果）
		await this.initializeOrchestrator(collectConfig.startUrl, collectResult);

		this.setupSignalHandlers();

		try {
			await this.executeInternal(
				null,
				null,
				pageConfig.handler,
				undefined,
				null,
			);
		} finally {
			this.removeSignalHandlers();
		}
	}

	/**
	 * 初始化 Orchestrator
	 */
	private async initializeOrchestrator(
		startUrl: string,
		collectResult: CollectResult,
	): Promise<void> {
		const paths = generatePathsForUrl(this.config, startUrl);

		this.taskProgress = new TaskProgress(
			paths.progressFile,
			paths.outputDir,
			paths.stateDir,
			this.config.locale,
			this.config.progress,
		);

		this.orchestrator = new CrawlerOrchestrator(
			this.config,
			collectResult,
			startUrl,
			paths.outputDir,
			paths.stateDir,
			paths.metaFile,
			this.taskProgress,
		);
	}

	/**
	 * 测试模式（内部执行）
	 */
	private async runTestMode(
		url: string,
		sectionLocator: string,
		sectionIndex: number | undefined,
		blockName: string | undefined,
		handler: TestHandler,
		beforeHandler?: BeforeProcessBlocksHandler,
	): Promise<void> {
		await this.executeInternal(null, null, null, undefined, {
			url,
			sectionLocator,
			sectionIndex,
			blockName,
			handler,
			beforeHandler,
		});
	}

	/**
	 * 内部执行方法（委托给 CrawlerOrchestrator）
	 */
	private async executeInternal(
		blockSectionLocator: string | null,
		blockHandler: ((context: BlockContext) => Promise<void>) | null,
		pageHandler: ((context: PageContext) => Promise<void>) | null,
		beforeProcessBlocks: BeforeProcessBlocksHandler | undefined,
		testMode: {
			url: string;
			sectionLocator: string;
			sectionIndex?: number;
			blockName?: string;
			handler: TestHandler;
			beforeHandler?: BeforeProcessBlocksHandler;
		} | null,
		blockOptions?: { verifyBlockCompletion?: boolean },
	): Promise<void> {
		if (!this.orchestrator) {
			throw new Error("Orchestrator 未初始化");
		}

		await this.orchestrator.run(
			this.page,
			blockSectionLocator,
			blockHandler,
			pageHandler,
			beforeProcessBlocks || null,
			testMode,
			blockOptions,
		);
	}

	// ==================== 信号处理 ====================

	private setupSignalHandlers(): void {
		const handler: NodeJS.SignalsListener = async (signal) => {
			console.log(`\n${this.i18n.t("common.signalReceived", { signal })}`);
			await this.taskProgress?.saveProgress();
			process.exit(0);
		};

		process.on("SIGINT", handler);
		process.on("SIGTERM", handler);
		this.signalHandler = handler;
	}

	private removeSignalHandlers(): void {
		if (this.signalHandler) {
			process.off("SIGINT", this.signalHandler);
			process.off("SIGTERM", this.signalHandler);
		}
	}

	// ==================== Getters ====================

	get outputBaseDir(): string {
		return this.config.outputBaseDir;
	}

	get stateBaseDir(): string {
		return this.config.stateBaseDir;
	}
}
