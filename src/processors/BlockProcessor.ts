import type { Locator, Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import type { ExtendedExecutionConfig } from "../executors/ExecutionContext";
import type { FilenameMappingManager } from "../state/FilenameMapping";
import type { FreeRecorder } from "../state/FreeRecorder";
import type { MismatchRecorder } from "../state/MismatchRecorder";
import type { TaskProgress } from "../state/TaskProgress";
import type {
	BeforeContext,
	BlockAutoConfig,
	BlockContext,
	BlockHandler,
	BlockSectionConfig,
	ConditionalBlockConfig,
} from "../types";
import type { ClickAndVerify } from "../types/actions";
import { createClickAndVerify, createClickCode } from "../utils/click-actions";
import { isDebugMode } from "../utils/debug";
import { checkBlockFree as checkBlockFreeUtil } from "../utils/free-checker";
import { createI18n, type I18n } from "../utils/i18n";
import {
	ContextLogger,
	type ContextLogger as IContextLogger,
} from "../utils/logger";
import { createSafeOutput } from "../utils/safe-output";
import { AutoFileProcessor } from "./AutoFileProcessor";
import { BlockNameExtractor } from "./BlockNameExtractor";
import { ProcessingContext } from "./ProcessingContext";

/**
 * Block 处理器
 * 职责：处理所有与 Block 相关的操作
 */
export class BlockProcessor {
	private i18n: I18n;
	private blockNameExtractor: BlockNameExtractor;
	private logger: IContextLogger;
	private context: ProcessingContext;

	constructor(
		private config: InternalConfig,
		private outputDir: string,
		private blockSectionLocator: string,
		private blockHandler: BlockHandler | null,
		private taskProgress?: TaskProgress,
		private beforeProcessBlocks?:
			| ((context: BeforeContext) => Promise<void>)
			| null,
		private filenameMappingManager?: FilenameMappingManager,
		private verifyBlockCompletion: boolean = true,
		private extendedConfig: ExtendedExecutionConfig = {},
		private freeRecorder?: FreeRecorder,
		private mismatchRecorder?: MismatchRecorder,
		private expectedBlockCount?: number, // 预期的组件数
		logger?: IContextLogger,
		private blockAutoConfig?: BlockAutoConfig, // 自动处理配置
		private progressiveLocate?: boolean, // 渐进式定位
		private conditionalBlockConfigs?: ConditionalBlockConfig[], // 条件配置数组（已废弃）
		private blockSectionConfigs?: BlockSectionConfig[], // 多 Block Section 配置
	) {
		this.i18n = createI18n(config.locale);
		this.blockNameExtractor = new BlockNameExtractor(config, extendedConfig);
		this.logger = logger || new ContextLogger();
		this.context = new ProcessingContext();
	}

	/**
	 * 处理页面中的所有 Blocks
	 * 注意：调用此方法前应该已经在 CrawlerOrchestrator 中检查过页面级 Free
	 */
	async processBlocksInPage(
		page: Page,
		pagePath: string,
	): Promise<{
		totalCount: number;
		freeBlocks: string[];
	}> {
		// 执行前置逻辑（如果配置了）
		if (this.beforeProcessBlocks) {
			const clickAndVerify = createClickAndVerify(this.config.locale);
			const beforeContext: BeforeContext = {
				currentPage: page,
				clickAndVerify,
			};
			await this.beforeProcessBlocks(beforeContext);
		}

		// 新的多 Block Section 配置模式
		if (this.blockSectionConfigs && this.blockSectionConfigs.length > 0) {
			return await this.processMultipleBlockSections(page, pagePath);
		}

		// 检查是否启用渐进式定位
		const isProgressiveMode = !!this.progressiveLocate;

		if (isProgressiveMode) {
			// 使用渐进式定位模式
			return await this.processBlocksProgressively(page, pagePath);
		} else {
			// 使用传统的一次性定位模式
			return await this.processBlocksTraditional(page, pagePath);
		}
	}

	/**
	 * 处理多个 Block Section 配置
	 * 遍历每个配置，分别定位和处理
	 */
	private async processMultipleBlockSections(
		page: Page,
		pagePath: string,
	): Promise<{
		totalCount: number;
		freeBlocks: string[];
	}> {
		let totalCompletedCount = 0;
		const allFreeBlocks: string[] = [];
		const normalizedUrlPath = this.normalizePagePath(pagePath);
		const clickAndVerify = createClickAndVerify(this.config.locale);

		for (const sectionConfig of this.blockSectionConfigs!) {
			// 获取当前 sectionLocator 定位到的所有 block
			const blocks = await page.locator(sectionConfig.sectionLocator).all();
			const blockCount = blocks.length;

			// 记录日志：每个 sectionLocator 定位到的区块数量
			this.logger.log(
				this.i18n.t("block.sectionFound", {
					locator: sectionConfig.sectionLocator,
					count: blockCount,
				}),
			);

			if (blockCount === 0) {
				continue;
			}

			// 处理每个 block
			for (const block of blocks) {
				const result = await this.processBlockWithSectionConfig(
					page,
					block,
					sectionConfig,
					clickAndVerify,
					normalizedUrlPath,
				);

				if (result.success) {
					totalCompletedCount++;
				}
				if (result.isFree && result.blockName) {
					allFreeBlocks.push(result.blockName);
				}
			}
		}

		// 如果所有 block 都已完成，标记页面为完成
		if (totalCompletedCount > 0) {
			this.taskProgress?.markPageComplete(normalizedUrlPath);
		}

		return {
			totalCount: totalCompletedCount,
			freeBlocks: allFreeBlocks,
		};
	}

	/**
	 * 使用 BlockSectionConfig 处理单个 Block
	 */
	private async processBlockWithSectionConfig(
		page: Page,
		block: Locator,
		sectionConfig: BlockSectionConfig,
		clickAndVerify: ClickAndVerify,
		normalizedUrlPath: string,
	): Promise<{ success: boolean; isFree: boolean; blockName?: string }> {
		// 滚动 block 到视口顶部
		await this.scrollToTop(block);

		// clickCode（智能检测 tab/button，带重试与验证）
		const clickCode = createClickCode(block, clickAndVerify, this.context);

		// 预处理（可选）：允许把 clickLocator/codeRegion 这类“步骤逻辑”收敛到一个地方
		let preparedCodeRegion: Locator | undefined;
		let skipDefaultClick = false;
		if (sectionConfig.prepare) {
			const result = await sectionConfig.prepare({
				currentPage: page,
				block,
				clickAndVerify,
				clickCode,
			});
			if (result?.codeRegion) preparedCodeRegion = result.codeRegion;
			if (result?.skipDefaultClick) skipDefaultClick = true;
		}

		// 如果有 clickLocator，先点击；否则默认 clickCode()
		if (sectionConfig.clickLocator) {
			const clickTarget = sectionConfig.clickLocator(block);
			try {
				// 使用 100ms 超时快速判断是否存在
				await clickTarget.waitFor({ state: "visible", timeout: 100 });
				await clickTarget.click();
			} catch {
				// 元素不存在，跳过此 block
				this.logger.log(this.i18n.t("block.clickLocatorNotFound"));
				return { success: false, isFree: false };
			}
		} else if (!skipDefaultClick) {
			await clickCode();
		}

		// 确定代码区域：prepare 返回优先，其次用旧的 codeRegion（兼容）
		const codeRegion =
			preparedCodeRegion ||
			(sectionConfig.codeRegion ? sectionConfig.codeRegion(block) : undefined);

		// 解析提取配置：extractConfig 优先，兼容旧的 config
		const extractConfig = sectionConfig.extractConfig || sectionConfig.config;
		if (!extractConfig) {
			throw new Error(
				"BlockSectionConfig 缺少 extractConfig（或旧字段 config）",
			);
		}

		// 如果 skipPreChecks，跳过 blockName/进度/Free 检查
		if (sectionConfig.skipPreChecks) {
			try {
				const autoProcessor = new AutoFileProcessor(
					this.config,
					extractConfig,
					this.outputDir,
					"", // blockPath 为空
					"", // blockName 为空
					this.context,
					codeRegion,
				);

				await autoProcessor.process(block, page);
				return { success: true, isFree: false };
			} catch (error) {
				return this.handleProcessingError(page, error, "");
			}
		}

		// 执行前置检查
		const preCheckResult = await this.performPreChecks(
			page,
			block,
			normalizedUrlPath,
		);
		if (!preCheckResult.shouldProcess) {
			return preCheckResult.result!;
		}

		try {
			const autoProcessor = new AutoFileProcessor(
				this.config,
				extractConfig,
				this.outputDir,
				preCheckResult.blockPath!,
				preCheckResult.blockName!,
				this.context,
				codeRegion,
			);

			await autoProcessor.process(block, page);
			this.taskProgress?.markBlockComplete(preCheckResult.blockPath!);

			return {
				success: true,
				isFree: false,
				blockName: preCheckResult.blockName,
			};
		} catch (error) {
			return this.handleProcessingError(page, error, preCheckResult.blockName!);
		}
	}

	/**
	 * 传统模式：一次性定位所有 block 并处理
	 */
	private async processBlocksTraditional(
		page: Page,
		pagePath: string,
	): Promise<{
		totalCount: number;
		freeBlocks: string[];
	}> {
		// 获取所有 block 节点（作为实际定位到的数量）
		const blocks = await this.getAllBlocks(page);
		const actualCount = blocks.length;
		this.logger.log(this.i18n.t("block.found", { count: actualCount }));

		// 验证组件数量是否与预期一致
		if (this.expectedBlockCount !== undefined && this.mismatchRecorder) {
			if (actualCount !== this.expectedBlockCount) {
				this.logger.warn(
					this.i18n.t("block.mismatchWarning", {
						expected: this.expectedBlockCount,
						actual: actualCount,
					}),
				);
				this.mismatchRecorder.addMismatch(
					pagePath,
					this.expectedBlockCount,
					actualCount,
				);

				// 如果未配置 ignoreMismatch，跳过此页面
				if (!this.config.ignoreMismatch) {
					this.logger.warn(this.i18n.t("block.skipMismatch"));
					return {
						totalCount: 0,
						freeBlocks: [],
					};
				}

				// 配置了 ignoreMismatch，继续处理但已记录
				this.logger.log(this.i18n.t("block.continueWithMismatch"));
			}
		}

		let completedCount = 0;
		let processedCount = 0; // 实际处理的 block 数量（包括 free 和跳过的）
		const freeBlocks: string[] = [];
		const processedBlockNames: string[] = []; // 记录所有处理过的 block 名称

		// 遍历处理每个 block
		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			const result = await this.processSingleBlock(page, block, pagePath);

			if (result.blockName) {
				processedBlockNames.push(result.blockName);
			}

			processedCount++;

			if (result.success) {
				completedCount++;
			}

			if (result.isFree && result.blockName) {
				freeBlocks.push(result.blockName);
			}
		}

		// 如果所有 block 都已完成，标记页面为完成
		if (completedCount === blocks.length && blocks.length > 0) {
			const normalizedPath = this.normalizePagePath(pagePath);
			this.taskProgress?.markPageComplete(normalizedPath);
		}

		// 验证 Block 采集完整性（如果启用）
		if (this.verifyBlockCompletion) {
			const isComplete = await this.verifyCompletion(
				page,
				pagePath,
				actualCount,
				processedCount,
				processedBlockNames,
			);

			// 只在验证通过时输出简洁的确认信息
			if (isComplete) {
				this.logger.log(
					this.i18n.t("block.verifyComplete", { count: processedCount }),
				);
			}
		}

		// 返回实际处理的数量（不包括跳过的）
		return {
			totalCount: completedCount,
			freeBlocks,
		};
	}

	/**
	 * 渐进式模式：分批定位并处理 block
	 * 适用于渐进式加载的页面
	 */
	private async processBlocksProgressively(
		page: Page,
		pagePath: string,
	): Promise<{
		totalCount: number;
		freeBlocks: string[];
	}> {
		this.logger.log(
			this.i18n.t("block.progressiveMode", { batchSize: "动态" }),
		);

		let completedCount = 0;
		let processedCount = 0;
		const freeBlocks: string[] = [];
		const processedBlockNames: string[] = [];
		const processedBlockNamesSet = new Set<string>(); // 使用 blockName 去重

		let batchNumber = 0;
		let hasMoreBlocks = true;

		while (hasMoreBlocks) {
			batchNumber++;

			// 获取当前可见的所有 block
			const allBlocks = await this.getAllBlocks(page);

			// 过滤出未处理的 block
			// 注意：这里不能提前获取 blockName 判断，因为有些 block 可能还在加载中（如 loading spinner）
			// 我们需要先处理（滚动到视口），让它加载出来后再获取 blockName
			const unprocessedBlocks: Locator[] = [];
			for (let i = 0; i < allBlocks.length; i++) {
				const block = allBlocks[i];
				// 尝试快速获取 blockName（不等待加载）
				let blockName: string | null = null;
				try {
					// 先尝试获取 heading，如果存在且可见，则获取 blockName
					const heading = block.getByRole("heading").first();
					const headingCount = await heading.count();
					if (headingCount > 0) {
						blockName = await this.blockNameExtractor.extract(block);
					}
				} catch {
					// 如果获取失败，说明可能还在加载，先加入待处理列表
				}

				// 如果有 blockName 且已处理，跳过；否则加入待处理列表
				if (!blockName || !processedBlockNamesSet.has(blockName)) {
					unprocessedBlocks.push(block);
				}
			}

			// 如果没有未处理的 block，退出循环
			if (unprocessedBlocks.length === 0) {
				this.logger.log(this.i18n.t("block.progressiveComplete"));
				hasMoreBlocks = false;
				break;
			}

			// 当前批次就是所有未处理的 block（动态批次大小）
			const currentBatch = unprocessedBlocks;
			const batchSize = currentBatch.length;

			// 滚动到当前批次最后一个 block 的底部
			const lastBlockInBatch = currentBatch[currentBatch.length - 1];
			await lastBlockInBatch.evaluate((el) => {
				el.scrollIntoView({ behavior: "smooth", block: "end" });
			});

			this.logger.log(
				this.i18n.t("block.progressiveBatch", {
					batch: batchNumber,
					count: currentBatch.length,
				}),
			);

			// 处理当前批次的 block
			for (let i = 0; i < currentBatch.length; i++) {
				const block = currentBatch[i];
				const result = await this.processSingleBlock(page, block, pagePath);

				if (result.blockName) {
					processedBlockNames.push(result.blockName);
					processedBlockNamesSet.add(result.blockName);
				}

				processedCount++;

				if (result.success) {
					completedCount++;
				}

				if (result.isFree && result.blockName) {
					freeBlocks.push(result.blockName);
				}
			}
		}

		this.logger.log(
			this.i18n.t("block.progressiveTotal", { count: processedCount }),
		);

		// 如果所有 block 都已完成，标记页面为完成
		if (completedCount > 0) {
			const normalizedPath = this.normalizePagePath(pagePath);
			this.taskProgress?.markPageComplete(normalizedPath);
		}

		// 验证 Block 采集完整性（如果启用）
		// 在渐进式模式下，我们不验证预期数量，因为渐进式加载的 block 数量可能会动态变化
		if (this.verifyBlockCompletion && !this.expectedBlockCount) {
			this.logger.log(
				this.i18n.t("block.verifyComplete", { count: processedCount }),
			);
		}

		// 返回实际处理的数量
		return {
			totalCount: completedCount,
			freeBlocks,
		};
	}

	/**
	 * 检查单个 Block 是否为 Free
	 *
	 * @remarks
	 * skipFree 支持：
	 *   - undefined: 未启用跳过
	 *   - "default": 使用默认匹配 /free/i（忽略大小写）
	 *   - string: 精确匹配指定文本
	 *   - function: 自定义判断逻辑
	 */
	private async isBlockFree(block: Locator): Promise<boolean> {
		// 使用 blockSkipFree 配置
		return await checkBlockFreeUtil(
			block,
			this.config,
			this.extendedConfig.blockSkipFree,
			this.context,
		);
	}

	/**
	 * 处理单个 Block
	 * 执行顺序：
	 * 1. 滚动到视口
	 * 2. 如果有条件配置，先匹配（可能跳过前置检查）
	 * 3. 获取 blockName（除非 skipPreChecks）
	 * 4. 检查是否已完成（除非 skipPreChecks）
	 * 5. 检查是否为 Free（除非 skipPreChecks）
	 * 6. 执行自定义处理逻辑
	 */
	private async processSingleBlock(
		page: Page,
		block: Locator,
		urlPath: string,
	): Promise<{ success: boolean; isFree: boolean; blockName?: string }> {
		// 0. 滚动 block 到视口顶部，确保懒加载内容渲染
		await this.scrollToTop(block);

		const clickAndVerify = createClickAndVerify(this.config.locale);
		const normalizedUrlPath = this.normalizePagePath(urlPath);

		// 1. 如果有条件配置，先匹配（可能跳过前置检查）
		if (
			this.conditionalBlockConfigs &&
			this.conditionalBlockConfigs.length > 0
		) {
			const matched = await AutoFileProcessor.matchConditionalConfig(
				block,
				this.conditionalBlockConfigs,
			);

			if (matched) {
				// 如果 skipPreChecks，直接处理，跳过 blockName/进度/Free 检查
				if (matched.skipPreChecks) {
					return this.processBlockWithConfig(
						page,
						block,
						matched,
						clickAndVerify,
						normalizedUrlPath,
						"", // blockPath 为空
						"", // blockName 为空
					);
				}

				// 否则继续执行前置检查，但记住匹配结果
				const preCheckResult = await this.performPreChecks(
					page,
					block,
					normalizedUrlPath,
				);
				if (!preCheckResult.shouldProcess) {
					return preCheckResult.result!;
				}

				return this.processBlockWithConfig(
					page,
					block,
					matched,
					clickAndVerify,
					normalizedUrlPath,
					preCheckResult.blockPath!,
					preCheckResult.blockName!,
				);
			}

			// 没有匹配的条件配置，执行前置检查后记录警告
			const preCheckResult = await this.performPreChecks(
				page,
				block,
				normalizedUrlPath,
			);
			if (!preCheckResult.shouldProcess) {
				return preCheckResult.result!;
			}

			this.logger.warn(
				this.i18n.t("block.noMatchingConfig", {
					name: preCheckResult.blockName!,
				}),
			);
			return {
				success: true,
				isFree: false,
				blockName: preCheckResult.blockName,
			};
		}

		// 2. 没有条件配置，执行正常的前置检查
		const preCheckResult = await this.performPreChecks(
			page,
			block,
			normalizedUrlPath,
		);
		if (!preCheckResult.shouldProcess) {
			return preCheckResult.result!;
		}

		const { blockPath, blockName } = preCheckResult;
		const context = this.createBlockContext(
			page,
			block,
			blockPath!,
			blockName!,
			clickAndVerify,
		);

		try {
			// 如果配置了单个自动处理配置，使用 AutoFileProcessor
			if (this.blockAutoConfig) {
				await context.clickCode();

				const autoProcessor = new AutoFileProcessor(
					this.config,
					this.blockAutoConfig,
					this.outputDir,
					blockPath!,
					blockName!,
					this.context,
				);

				await autoProcessor.process(block, page);
			}
			// 传统方式：使用 blockHandler
			else if (this.blockHandler) {
				await this.blockHandler(context);
			}

			this.taskProgress?.markBlockComplete(blockPath!);
			return { success: true, isFree: false, blockName };
		} catch (error) {
			return this.handleProcessingError(page, error, blockName!);
		}
	}

	/**
	 * 执行前置检查（获取 blockName、进度检查、Free 检查）
	 */
	private async performPreChecks(
		page: Page,
		block: Locator,
		normalizedUrlPath: string,
	): Promise<{
		shouldProcess: boolean;
		blockName?: string;
		blockPath?: string;
		result?: { success: boolean; isFree: boolean; blockName?: string };
	}> {
		// 获取 block 名称（带重试）
		const blockName = await this.getBlockNameWithRetry(block);

		if (!blockName) {
			this.logger.warn(this.i18n.t("block.nameEmpty"));
			const html = await block.innerHTML();
			this.logger.log(`html: ${html}`);
			await page.pause();
			return {
				shouldProcess: false,
				result: { success: false, isFree: false },
			};
		}

		const blockPath = `${normalizedUrlPath}/${blockName}`;

		// 检查是否已完成
		if (this.taskProgress?.isBlockComplete(blockPath)) {
			this.logger.log(this.i18n.t("block.skip", { name: blockName }));
			return {
				shouldProcess: false,
				result: { success: true, isFree: false, blockName },
			};
		}

		// 检查是否为 Free Block
		const isFree = await this.isBlockFree(block);
		if (isFree) {
			this.logger.log(this.i18n.t("block.skipFree", { name: blockName }));
			if (this.freeRecorder) {
				this.freeRecorder.addFreeBlock(blockPath, normalizedUrlPath);
			}
			return {
				shouldProcess: false,
				result: { success: true, isFree: true, blockName },
			};
		}

		return { shouldProcess: true, blockName, blockPath };
	}

	/**
	 * 使用匹配的配置处理 Block
	 */
	private async processBlockWithConfig(
		page: Page,
		block: Locator,
		matched: {
			config: BlockAutoConfig;
			whenLocator: Locator;
			codeRegion?: Locator;
			skipPreChecks?: boolean;
		},
		clickAndVerify: ClickAndVerify,
		normalizedUrlPath: string,
		blockPath: string,
		blockName: string,
	): Promise<{ success: boolean; isFree: boolean; blockName?: string }> {
		try {
			// 点击匹配到的 when 元素
			await matched.whenLocator.click();

			// 使用匹配的配置创建自动文件处理器（传入 codeRegion）
			const autoProcessor = new AutoFileProcessor(
				this.config,
				matched.config,
				this.outputDir,
				blockPath,
				blockName,
				this.context,
				matched.codeRegion,
			);

			// 处理文件和变种
			await autoProcessor.process(block, page);

			// 只有在有 blockPath 时才标记完成
			if (blockPath) {
				this.taskProgress?.markBlockComplete(blockPath);
			}

			return {
				success: true,
				isFree: false,
				blockName: blockName || undefined,
			};
		} catch (error) {
			return this.handleProcessingError(page, error, blockName);
		}
	}

	/**
	 * 创建 BlockContext
	 */
	private createBlockContext(
		page: Page,
		block: Locator,
		blockPath: string,
		blockName: string,
		clickAndVerify: ClickAndVerify,
	): BlockContext {
		return {
			currentPage: page,
			block,
			blockPath,
			blockName,
			outputDir: this.outputDir,
			safeOutput: createSafeOutput(
				"block",
				this.outputDir,
				this.filenameMappingManager,
				blockPath,
			),
			clickAndVerify,
			clickCode: createClickCode(block, clickAndVerify, this.context),
		};
	}

	/**
	 * 处理错误
	 */
	private async handleProcessingError(
		page: Page,
		error: unknown,
		blockName: string,
	): Promise<{ success: boolean; isFree: boolean; blockName?: string }> {
		// 检测是否是进程终止导致的错误（Ctrl+C）
		const isTerminationError =
			error instanceof Error &&
			(error.message.includes("Test ended") ||
				error.message.includes("Browser closed") ||
				error.message.includes("Target closed"));

		if (isTerminationError) {
			return {
				success: false,
				isFree: false,
				blockName: blockName || undefined,
			};
		}

		// 导入 ProcessingMode 来检查终止状态
		try {
			const { ProcessingMode } = await import(
				"../crawler/modes/ProcessingMode"
			);
			if (ProcessingMode.isProcessTerminating()) {
				return {
					success: false,
					isFree: false,
					blockName: blockName || undefined,
				};
			}
		} catch {
			// 如果无法导入 ProcessingMode（如测试模式），继续处理错误
		}

		// 如果开启了 pauseOnError，暂停页面方便检查
		if (this.config.pauseOnError) {
			const debugMode = isDebugMode();
			const messageKey = debugMode
				? "error.pauseOnErrorDebug"
				: "error.pauseOnErrorNonDebug";

			this.logger.error(
				this.i18n.t(messageKey, {
					type: "Block",
					name: blockName || "unknown",
					path: "",
					error: error instanceof Error ? error.message : String(error),
				}),
			);

			if (debugMode) {
				await page.pause();
			}
		}

		return { success: false, isFree: false, blockName: blockName || undefined };
	}

	/**
	 * 获取所有 Block 元素
	 *
	 * 优先级：
	 * 1. 配置的 getAllBlocks 函数
	 * 2. 使用 blockSectionLocator
	 */
	private async getAllBlocks(page: Page): Promise<Locator[]> {
		if (this.extendedConfig.getAllBlocks) {
			this.logger.log(this.i18n.t("block.getAllCustom"));
			return await this.extendedConfig.getAllBlocks(page);
		}

		return await page.locator(this.blockSectionLocator).all();
	}

	/**
	 * 获取 Block 名称
	 * 使用 BlockNameExtractor 统一处理
	 */
	private async getBlockName(block: Locator): Promise<string | null> {
		return await this.blockNameExtractor.extract(block);
	}

	/**
	 * 获取 block 名称（带重试机制）
	 * 懒加载场景下，DOM 可能需要一点时间渲染
	 */
	private async getBlockNameWithRetry(
		block: Locator,
		maxRetries = 3,
		retryDelay = 200,
	): Promise<string | null> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			const name = await this.getBlockName(block);
			if (name) {
				return name;
			}

			// 最后一次尝试不需要等待
			if (attempt < maxRetries) {
				await block.page().waitForTimeout(retryDelay);
			}
		}
		return null;
	}

	/**
	 * 滚动元素到视口顶部
	 * 用于触发懒加载内容的渲染
	 */
	private async scrollToTop(element: Locator): Promise<void> {
		await element.evaluate((el) => {
			el.scrollIntoView({ block: "start", behavior: "instant" });
		});
	}

	/**
	 * 验证 Block 采集完整性
	 * 如果预期数量与实际处理数量不一致，暂停并提示用户检查
	 *
	 * @returns 是否验证通过
	 */
	private async verifyCompletion(
		page: Page,
		pagePath: string,
		expectedCount: number,
		processedCount: number,
		processedBlockNames: string[],
	): Promise<boolean> {
		if (expectedCount !== processedCount) {
			const debugMode = isDebugMode();

			this.logger.error(this.i18n.t("block.verifyIncomplete"));
			this.logger.logItems({
				预期数量: expectedCount,
				实际处理: processedCount,
				差异: expectedCount - processedCount,
			});

			// 根据日志级别输出详细信息
			const logLevel = this.config.logLevel;
			if (logLevel === "debug") {
				console.log(`\n${this.i18n.t("block.processedList")}`);
				processedBlockNames.forEach((name, idx) => {
					console.log(`  ${idx + 1}. ${name}`);
				});
			}

			// 只在 debug 环境下暂停
			if (debugMode) {
				console.log(this.i18n.t("error.pauseBeforeDebug"));
				await page.pause();
			} else if (logLevel !== "silent") {
				console.log(
					"\n💡 提示: 使用 --debug 模式运行可以自动暂停页面进行检查\n",
				);
			}

			return false;
		}

		return true;
	}

	/**
	 * 标准化页面路径
	 */
	private normalizePagePath(link: string): string {
		// 如果是完整 URL，提取路径部分
		if (link.startsWith("http://") || link.startsWith("https://")) {
			try {
				const url = new URL(link);
				link = url.pathname;
			} catch (e) {
				// 如果解析失败，使用原始链接
			}
		}
		return link.startsWith("/") ? link.slice(1) : link;
	}
}
