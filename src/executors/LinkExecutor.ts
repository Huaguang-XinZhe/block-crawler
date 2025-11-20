import type { Page } from "@playwright/test";
import { BlockProcessor } from "../processors/BlockProcessor";
import { PageProcessor } from "../processors/PageProcessor";
import type { BeforeContext, BlockHandler, PageHandler } from "../types";
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
			pageHandler: PageHandler | null;
			beforeProcessBlocks: ((context: BeforeContext) => Promise<void>) | null;
			waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
			beforeOpenScripts?: string[];
			afterOpenScripts?: string[];
			verifyBlockCompletion?: boolean;
		},
	): Promise<void> {
		const domain = new URL(this.context.baseUrl).hostname;
		const url = `https://${domain}${relativeLink}`;

		// 根据配置决定是否使用独立 context
		const newPage = await this.createPage(page, isFirst);

		try {
			// 注入 beforeOpen 脚本
			if (!isFirst && options.beforeOpenScripts?.length) {
				await this.context.scriptInjector.injectScripts(
					newPage,
					options.beforeOpenScripts,
					"beforePageLoad",
				);
			}

			console.log(this.context.i18n.t("crawler.visitingPage", { url }));
			const gotoOptions = options.waitUntil
				? { waitUntil: options.waitUntil }
				: { waitUntil: "load" as const };
			await newPage.goto(url, gotoOptions);

			// 注入 afterOpen 脚本
			if (!isFirst && options.afterOpenScripts?.length) {
				await this.context.scriptInjector.injectScripts(
					newPage,
					options.afterOpenScripts,
					"afterPageLoad",
				);
			}

			// 检查页面是否为 Free
			const isPageFree = await PageProcessor.checkPageFree(
				newPage,
				this.context.config,
				this.context.extendedConfig.skipFree,
			);
			if (isPageFree) {
				console.log(
					this.context.i18n.t("page.skipFree", { path: relativeLink }),
				);
				this.context.freeRecorder.addFreePage(relativeLink);
				this.context.taskProgress?.markPageComplete(
					this.normalizePagePath(relativeLink),
				);
				return;
			}

			// 根据模式决定处理方式
			if (options.blockSectionLocator && options.blockHandler) {
				await this.processBlocks(
					newPage,
					relativeLink,
					options.blockSectionLocator,
					options.blockHandler,
					options.beforeProcessBlocks,
					options.verifyBlockCompletion ?? true,
				);
			} else if (options.pageHandler) {
				await this.processPage(newPage, relativeLink, options.pageHandler);
			}
		} finally {
			console.log(
				`${this.context.i18n.t("crawler.closePage", { path: relativeLink })}`,
			);
			await newPage.close();

			// 如果使用了独立 context，也需要关闭
			if (!isFirst && this.context.config.useIndependentContext) {
				await newPage.context().close();
			}
		}
	}

	/**
	 * 创建页面实例
	 */
	private async createPage(page: Page, isFirst: boolean): Promise<Page> {
		if (isFirst) {
			return page;
		}

		if (this.context.config.useIndependentContext) {
			// 创建独立的 context
			const browser = page.context().browser();
			if (!browser) {
				throw new Error("无法获取浏览器实例");
			}
			const context = await browser.newContext();
			return await context.newPage();
		}

		// 共享 context
		return await page.context().newPage();
	}

	/**
	 * 处理 Block 模式
	 */
	private async processBlocks(
		page: Page,
		relativeLink: string,
		blockSectionLocator: string,
		blockHandler: BlockHandler,
		beforeProcessBlocks: ((context: BeforeContext) => Promise<void>) | null,
		verifyBlockCompletion: boolean,
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
		);

		const result = await blockProcessor.processBlocksInPage(page, relativeLink);

		// 记录 free blocks
		result.freeBlocks.forEach((blockName) => {
			this.context.freeRecorder.addFreeBlock(blockName);
		});
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
