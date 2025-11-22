import type { Locator, Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import type { ExtendedExecutionConfig } from "../executors/ExecutionContext";
import type { FilenameMappingManager } from "../state/FilenameMapping";
import type { TaskProgress } from "../state/TaskProgress";
import type { BeforeContext, BlockContext, BlockHandler } from "../types";
import { createClickAndVerify, createClickCode } from "../utils/click-actions";
import { isDebugMode } from "../utils/debug";
import { checkBlockFree as checkBlockFreeUtil } from "../utils/free-checker";
import { createI18n, type I18n } from "../utils/i18n";
import {
	ContextLogger,
	type ContextLogger as IContextLogger,
} from "../utils/logger";
import { createSafeOutput } from "../utils/safe-output";
import { BlockNameExtractor } from "./BlockNameExtractor";

/**
 * Block 处理器
 * 职责：处理所有与 Block 相关的操作
 */
export class BlockProcessor {
	private i18n: I18n;
	private blockNameExtractor: BlockNameExtractor;
	private logger: IContextLogger;

	constructor(
		private config: InternalConfig,
		private outputDir: string,
		private blockSectionLocator: string,
		private blockHandler: BlockHandler,
		private taskProgress?: TaskProgress,
		private beforeProcessBlocks?:
			| ((context: BeforeContext) => Promise<void>)
			| null,
		private filenameMappingManager?: FilenameMappingManager,
		private verifyBlockCompletion: boolean = true,
		private extendedConfig: ExtendedExecutionConfig = {},
		logger?: IContextLogger,
	) {
		this.i18n = createI18n(config.locale);
		this.blockNameExtractor = new BlockNameExtractor(config, extendedConfig);
		this.logger = logger || new ContextLogger();
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

		// 获取所有 block 节点（作为预期数量）
		const blocks = await this.getAllBlocks(page);
		const expectedCount = blocks.length;
		this.logger.log(this.i18n.t("block.found", { count: expectedCount }));

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
				expectedCount,
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

		// 输出跳过的 Free Blocks 统计
		if (freeBlocks.length > 0) {
			this.logger.log(
				`\n⏭️  ${this.i18n.t("block.skipFreeCount", { count: freeBlocks.length })}`,
			);
			freeBlocks.forEach((name, idx) => {
				this.logger.log(`   ${idx + 1}. ${name}`);
			});
		}

		// 返回实际处理的数量（不包括跳过的）
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
	 *   - null: 使用默认匹配 /free/i（忽略大小写）
	 *   - string: 精确匹配指定文本
	 *   - function: 自定义判断逻辑
	 */
	private async isBlockFree(block: Locator): Promise<boolean> {
		// 在 block 处理器中，skipFree 只会是 string | null 或接收 Locator 的函数
		return await checkBlockFreeUtil(
			block,
			this.config,
			this.extendedConfig.skipFree as
				| string
				| null
				| ((locator: Locator) => Promise<boolean>)
				| undefined,
		);
	}

	/**
	 * 处理单个 Block
	 * 执行顺序：
	 * 1. 获取 blockName
	 * 2. 检查是否已完成（避免不必要的 DOM 查询）
	 * 3. 检查是否为 Free（需要 DOM 查询）
	 * 4. 执行自定义处理逻辑
	 */
	private async processSingleBlock(
		page: Page,
		block: Locator,
		urlPath: string,
	): Promise<{ success: boolean; isFree: boolean; blockName?: string }> {
		// 1. 获取 block 名称
		const blockName = await this.getBlockName(block);

		if (!blockName) {
			this.logger.warn(this.i18n.t("block.nameEmpty"));
			// 打印当前 block 的 html
			const html = await block.innerHTML();
			this.logger.log(`html: ${html}`);
			await page.pause();
			return { success: false, isFree: false };
		}

		// 构建 blockPath
		const normalizedUrlPath = this.normalizePagePath(urlPath);
		const blockPath = `${normalizedUrlPath}/${blockName}`;

		// 2. 检查是否已完成（优先检查，避免不必要的 DOM 查询）
		if (this.taskProgress?.isBlockComplete(blockPath)) {
			this.logger.log(this.i18n.t("block.skip", { name: blockName }));
			return { success: true, isFree: false, blockName };
		}

		// 3. 检查是否为 Free Block（需要 DOM 查询，所以放在完成状态检查之后）
		const isFree = await this.isBlockFree(block);
		if (isFree) {
			this.logger.log(this.i18n.t("block.skipFree", { name: blockName }));
			// 如果是 Free Block，直接跳过处理
			return { success: true, isFree: true, blockName };
		}

		const clickAndVerify = createClickAndVerify(this.config.locale);
		const context: BlockContext = {
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
			clickCode: createClickCode(block, clickAndVerify),
		};

		try {
			// 只有非 Free Block 才调用 blockHandler
			await this.blockHandler(context);
			this.taskProgress?.markBlockComplete(blockPath);
			return { success: true, isFree: false, blockName };
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

			// 如果是终止导致的错误，不显示错误信息
			if (isTerminating || isTerminationError) {
				return { success: false, isFree: false, blockName };
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
						name: blockName,
						path: "",
						error: error instanceof Error ? error.message : String(error),
					}),
				);

				// 只在 debug 模式下暂停
				if (debugMode) {
					await page.pause();
				}
			}

			return { success: false, isFree: false, blockName };
		}
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
				console.log("\n已处理的 Block:");
				processedBlockNames.forEach((name, idx) => {
					console.log(`  ${idx + 1}. ${name}`);
				});
			}

			// 只在 debug 环境下暂停
			if (debugMode) {
				console.log("\n⏸️  页面即将暂停，请检查问题...\n");
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
		return link.startsWith("/") ? link.slice(1) : link;
	}
}
