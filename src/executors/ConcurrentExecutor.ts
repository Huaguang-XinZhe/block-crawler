import type { Page } from "@playwright/test";
import type {
	BeforeContext,
	BlockHandler,
	CollectResult,
	PageHandler,
} from "../types";
import type { CollectionLink } from "../types/meta";
import type { AutoScrollConfig } from "../utils/auto-scroll";
import { createLogger } from "../utils/logger";
import type { ExecutionContext } from "./ExecutionContext";
import { LinkExecutor } from "./LinkExecutor";

/**
 * 并发执行器
 *
 * 职责：
 * - 管理多个链接的并发执行
 * - 处理进度统计和错误处理
 */
export class ConcurrentExecutor {
	private linkExecutor: LinkExecutor;
	private completed = 0;
	private failed = 0;
	private total = 0;
	private previousCompletedPages = 0;

	constructor(private context: ExecutionContext) {
		this.linkExecutor = new LinkExecutor(context);
	}

	/**
	 * 并发处理所有链接
	 */
	async executeAll(
		page: Page,
		collectResult: CollectResult,
		options: {
			blockSectionLocator: string | null;
			blockHandler: BlockHandler | null;
			pageHandler: PageHandler | null;
			beforeProcessBlocks: ((context: BeforeContext) => Promise<void>) | null;
			waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
			beforeOpenScripts?: string[];
			afterOpenScripts?: string[];
			verifyBlockCompletion?: boolean;
			autoScroll?: boolean | AutoScrollConfig;
		},
	): Promise<void> {
		const allLinks = collectResult.collections;

		// 统计已完成的页面数量
		this.previousCompletedPages =
			this.context.taskProgress?.getCompletedPageCount() || 0;
		this.completed = 0; // 本次新完成的数量
		this.failed = 0;

		// 加载已知的 Free 页面
		const knownFreePages = await this.loadKnownFreePages();

		// 先过滤出需要处理的链接（排除已完成的）
		const pendingLinks: CollectionLink[] = [];
		let skippedCompleted = 0;
		let skippedFree = 0;

		for (const linkObj of allLinks) {
			const normalizedPath = linkObj.link.startsWith("/")
				? linkObj.link.slice(1)
				: linkObj.link;

			// 跳过已完成的页面
			if (this.context.taskProgress?.isPageComplete(normalizedPath)) {
				skippedCompleted++;
				continue;
			}

			// 跳过已知的 Free 页面
			if (knownFreePages.has(linkObj.link)) {
				skippedFree++;
				continue;
			}

			pendingLinks.push(linkObj);
		}

		// 更新 total 为实际需要处理的数量
		this.total = pendingLinks.length;

		console.log(
			`\n${this.context.i18n.t("crawler.startConcurrent", {
				concurrency: this.context.config.maxConcurrency,
			})}`,
		);

		// 输出跳过统计
		if (skippedCompleted > 0) {
			console.log(
				this.context.i18n.t("crawler.skippedCompleted", { count: skippedCompleted }),
			);
		}
		if (skippedFree > 0) {
			console.log(
				this.context.i18n.t("crawler.skippedFree", { count: skippedFree }),
			);
		}

		console.log(
			`\n${this.context.i18n.t("crawler.processingLinks", { total: this.total })}\n`,
		);

		await Promise.allSettled(
			pendingLinks.map((linkObj: CollectionLink, index: number) =>
				this.context.limit(async () => {
					// normalizedPath 变量未使用，因为已经在前面过滤掉已完成的了

					// 创建页面上下文日志记录器（排除 baseUrlPath）
					const displayPath =
						this.context.baseUrlPath &&
						linkObj.link.startsWith(this.context.baseUrlPath)
							? linkObj.link.slice(this.context.baseUrlPath.length)
							: linkObj.link;
					const logger = createLogger(displayPath);

				try {
					await this.linkExecutor.execute(
						page,
						linkObj.link,
						index === 0,
						{
							...options,
							expectedBlockCount: linkObj.blockCount, // 传递预期组件数
						},
					);
					this.completed++;
					const progress = `${this.completed + this.failed}/${this.total}`;
					logger.log(
						this.context.i18n.t("crawler.linkComplete", {
							progress,
						}),
					);
				} catch (error) {
						// 检查是否是用户主动停止（Ctrl+C）
						const errorMessage =
							error instanceof Error ? error.message : String(error);
						const isUserAbort = errorMessage.includes(
							"Target page, context or browser has been closed",
						);

						// 用户主动停止不计入失败，也不输出错误
						if (isUserAbort) {
							return;
						}

						this.failed++;
						const progress = `${this.completed + this.failed}/${this.total}`;

						// 根据日志级别输出不同详细程度的错误信息
						const logLevel = this.context.config.logLevel;
						if (logLevel === "debug") {
							logger.error(
								this.context.i18n.t("crawler.linkFailed", {
									progress,
								}),
								error,
							);
						} else if (logLevel === "info") {
							logger.error(
								this.context.i18n.t("crawler.linkFailedSimple", {
									progress,
									error: errorMessage.split("\n")[0], // 只显示第一行错误信息
								}),
							);
						}
						// silent 模式不输出错误详情
					}
				}),
			),
		);

		// 获取总的已完成数量（包括跳过的）
		const totalCompleted = this.completed + this.previousCompletedPages;

		this.printStatistics(totalCompleted, this.failed, this.total);
	}

	/**
	 * 打印当前统计信息（用于中断时）
	 */
	printCurrentStatistics(): void {
		this.printStatistics(this.completed, this.failed, this.total);
	}

	/**
	 * 加载已知的 Free 页面
	 */
	private async loadKnownFreePages(): Promise<Set<string>> {
		const knownFreePages = new Set<string>();

		// FreeRecorder 在 initialize() 时已经加载了 Free 页面
		const freePagesList = this.context.freeRecorder.getFreePages();

		if (freePagesList.length > 0) {
			freePagesList.forEach((page) => knownFreePages.add(page));
			console.log(
				this.context.i18n.t("crawler.loadedFreePages", {
					count: knownFreePages.size,
				}),
			);
		}

		return knownFreePages;
	}

	/**
	 * 打印统计信息
	 */
	private printStatistics(
		completed: number,
		failed: number,
		total: number,
	): void {
		console.log(`\n${this.context.i18n.t("crawler.statistics")}`);
		console.log(
			`   ${this.context.i18n.t("crawler.success", { count: completed, total })}`,
		);
		console.log(
			`   ${this.context.i18n.t("crawler.failed", { count: failed, total })}`,
		);
	}
}
