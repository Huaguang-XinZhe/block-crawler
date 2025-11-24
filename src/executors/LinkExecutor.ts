import type { Page } from "@playwright/test";
import { BlockProcessor } from "../processors/BlockProcessor";
import { PageProcessor } from "../processors/PageProcessor";
import type {
	BeforeContext,
	BlockAutoConfig,
	BlockHandler,
	PageHandler,
} from "../types";
import {
	type AutoScrollConfig,
	autoScrollToBottom,
	formatScrollConfig,
} from "../utils/auto-scroll";
import { type ContextLogger, createLogger } from "../utils/logger";
import type { ExecutionContext } from "./ExecutionContext";

/**
 * 链接执行器
 *
 * 职责：
 * - 处理单个链接的完整流程
 * - 打开页面、注入脚本、执行处理器
 */
export class LinkExecutor {
	constructor(private context: ExecutionContext) {}

	/**
	 * 执行单个链接的处理
	 */
	async execute(
		page: Page,
		relativeLink: string,
		isFirst: boolean,
		options: {
			blockSectionLocator: string | null;
			blockHandler: BlockHandler | null;
			blockAutoConfig: BlockAutoConfig | null;
			pageHandler: PageHandler | null;
			beforeProcessBlocks: ((context: BeforeContext) => Promise<void>) | null;
			waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
			beforeOpenScripts?: string[];
			afterOpenScripts?: string[];
			verifyBlockCompletion?: boolean;
			autoScroll?: boolean | AutoScrollConfig;
			expectedBlockCount?: number; // 新增：预期的组件数
			progressiveLocate?: boolean; // 新增：渐进式定位
		},
	): Promise<void> {
		const domain = new URL(this.context.baseUrl).hostname;
		const url = `https://${domain}${relativeLink}`;

		// 创建页面上下文日志记录器（排除 baseUrlPath）
		const displayPath =
			this.context.baseUrlPath &&
			relativeLink.startsWith(this.context.baseUrlPath)
				? relativeLink.slice(this.context.baseUrlPath.length)
				: relativeLink;
		const logger = createLogger(displayPath);

		// 创建页面（第一次使用传入的页面，后续创建新 tab）
		const newPage = await this.createPage(page, isFirst);

		try {
			// 注入 beforeOpen 脚本
			if (options.beforeOpenScripts?.length) {
				await this.context.scriptInjector.injectScripts(
					newPage,
					options.beforeOpenScripts,
					"beforePageLoad",
				);
			}

			logger.log(this.context.i18n.t("crawler.visitingPage", { url }));
			const gotoOptions = options.waitUntil
				? { waitUntil: options.waitUntil }
				: { waitUntil: "load" as const };
			await newPage.goto(url, gotoOptions);

			// 注入 afterOpen 脚本
			if (options.afterOpenScripts?.length) {
				await this.context.scriptInjector.injectScripts(
					newPage,
					options.afterOpenScripts,
					"afterPageLoad",
				);
			}

			// 检查页面是否为 Free（如果配置了页面级 skipFree）
			if (this.context.extendedConfig.pageSkipFree) {
				const isPageFree = await PageProcessor.checkPageFree(
					newPage,
					this.context.config,
					this.context.extendedConfig.pageSkipFree,
				);
				if (isPageFree) {
					logger.log(
						this.context.i18n.t("page.skipFree", { path: relativeLink }),
					);
					this.context.freeRecorder.addFreePage(relativeLink);
					this.context.taskProgress?.markPageComplete(
						this.normalizePagePath(relativeLink),
					);
					return;
				}
			}

			// 自动滚动页面（如果配置了）
			if (options.autoScroll) {
				await this.autoScrollPage(newPage, options.autoScroll, logger);
			}

			// 先执行页面级处理器（如果配置了）
			if (options.pageHandler) {
				await this.processPage(newPage, relativeLink, options.pageHandler);
			}

			// 再执行 Block 级处理器（如果配置了）
			if (
				options.blockSectionLocator &&
				(options.blockHandler || options.blockAutoConfig)
			) {
				await this.processBlocks(
					newPage,
					relativeLink,
					options.blockSectionLocator,
					options.blockHandler,
					options.blockAutoConfig,
					options.beforeProcessBlocks,
					options.verifyBlockCompletion ?? true,
					options.expectedBlockCount, // 传递预期组件数
					options.progressiveLocate ?? false, // 传递渐进式定位配置
					logger,
				);
			}
		} finally {
			logger.log(
				this.context.i18n.t("crawler.closePage", { path: relativeLink }),
			);
			await newPage.close();
		}
	}

	/**
	 * 创建页面实例
	 */
	private async createPage(page: Page, isFirst: boolean): Promise<Page> {
		if (isFirst) {
			return page;
		}

		// 复用同一个 context（在同一浏览器窗口中打开新 tab）
		// 认证状态已经通过 auth() 在第一个页面中设置，后续页面自动继承
		return await page.context().newPage();
	}

	/**
	 * 自动滚动页面
	 */
	private async autoScrollPage(
		page: Page,
		config: boolean | AutoScrollConfig,
		logger: ContextLogger,
	): Promise<void> {
		// 解析配置
		const scrollConfig: AutoScrollConfig =
			typeof config === "boolean" ? {} : config;

		const step = scrollConfig.step ?? 800;
		const interval = scrollConfig.interval ?? 500;
		const timeout = scrollConfig.timeout ?? 120000;

		logger.log(this.context.i18n.t("page.autoScrolling"));

		// 只在自定义参数时才显示参数详情
		const isCustom =
			scrollConfig.step !== undefined ||
			scrollConfig.interval !== undefined ||
			scrollConfig.timeout !== undefined;

		if (isCustom) {
			logger.logItems({
				step: `${step}px`,
				interval: `${interval}ms`,
				timeout: `${timeout}ms`,
			});
		}

		// 执行滚动
		const result = await autoScrollToBottom(page, scrollConfig);

		// 输出结果
		if (result.success) {
			logger.log(
				this.context.i18n.t("page.autoScrollComplete", {
					duration: result.duration.toFixed(2),
				}),
			);
		} else {
			// 检查是否是用户主动停止（Ctrl+C）
			const isUserAbort = result.error?.includes(
				"Target page, context or browser has been closed",
			);
			if (isUserAbort) {
				// 用户主动停止，不输出错误日志
				return;
			}

			logger.warn(this.context.i18n.t("page.autoScrollError"));
			logger.logItems({
				耗时: `${result.duration.toFixed(2)}s`,
				错误: result.error || "未知错误",
			});
		}
	}

	/**
	 * 处理 Block 模式
	 */
	private async processBlocks(
		page: Page,
		relativeLink: string,
		blockSectionLocator: string,
		blockHandler: BlockHandler | null,
		blockAutoConfig: BlockAutoConfig | null,
		beforeProcessBlocks: ((context: BeforeContext) => Promise<void>) | null,
		verifyBlockCompletion: boolean,
		expectedBlockCount: number | undefined,
		progressiveLocate: boolean,
		logger: ContextLogger,
	): Promise<void> {
		const blockProcessor = new BlockProcessor(
			this.context.config,
			this.context.outputDir,
			blockSectionLocator,
			blockHandler,
			this.context.taskProgress,
			beforeProcessBlocks,
			this.context.filenameMappingManager,
			verifyBlockCompletion,
			this.context.extendedConfig,
			this.context.freeRecorder,
			this.context.mismatchRecorder,
			expectedBlockCount,
			logger,
			blockAutoConfig ?? undefined,
			progressiveLocate,
		);

		await blockProcessor.processBlocksInPage(page, relativeLink);
	}

	/**
	 * 处理 Page 模式
	 */
	private async processPage(
		page: Page,
		relativeLink: string,
		pageHandler: PageHandler,
	): Promise<void> {
		const pageProcessor = new PageProcessor(
			this.context.config,
			this.context.outputDir,
			pageHandler,
			this.context.filenameMappingManager,
		);

		await pageProcessor.processPage(page, relativeLink);

		// 标记页面为完成
		this.context.taskProgress?.markPageComplete(
			this.normalizePagePath(relativeLink),
		);
	}

	/**
	 * 标准化页面路径
	 */
	private normalizePagePath(link: string): string {
		return link.startsWith("/") ? link.slice(1) : link;
	}
}
