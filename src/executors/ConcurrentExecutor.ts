import type { Page } from "@playwright/test";
import type {
	BeforeContext,
	BlockHandler,
	CollectResult,
	PageHandler,
} from "../types";
import type { CollectionLink } from "../types/meta";
import type { AutoScrollConfig } from "../utils/autoScroll";
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
		const total = allLinks.length;
		let completed = 0;
		let failed = 0;

		// 加载已知的 Free 页面
		const knownFreePages = await this.loadKnownFreePages();

		console.log(
			`\n${this.context.i18n.t("crawler.startConcurrent", {
				concurrency: this.context.config.maxConcurrency,
			})}`,
		);
		console.log(
			`\n${this.context.i18n.t("crawler.startProcessing", { total })}\n`,
		);

		await Promise.allSettled(
			allLinks.map((linkObj: CollectionLink, index: number) =>
				this.context.limit(async () => {
					const normalizedPath = linkObj.link.startsWith("/")
						? linkObj.link.slice(1)
						: linkObj.link;

					// 创建页面上下文日志记录器（排除 baseUrlPath）
					const displayPath =
						this.context.baseUrlPath &&
						linkObj.link.startsWith(this.context.baseUrlPath)
							? linkObj.link.slice(this.context.baseUrlPath.length)
							: linkObj.link;
					const logger = createLogger(displayPath);

					// 跳过已完成的页面
					if (this.context.taskProgress?.isPageComplete(normalizedPath)) {
						logger.log(
							this.context.i18n.t("crawler.skipCompleted", {
								name: linkObj.name || normalizedPath,
							}),
						);
						completed++;
						return;
					}

					// 跳过已知的 Free 页面
					if (knownFreePages.has(linkObj.link)) {
						logger.log(
							this.context.i18n.t("crawler.skipKnownFree", {
								name: linkObj.name || linkObj.link,
							}),
						);
						this.context.freeRecorder.addFreePage(linkObj.link);
						completed++;
						return;
					}

					try {
						await this.linkExecutor.execute(
							page,
							linkObj.link,
							index === 0,
							options,
						);
						completed++;
						const progress = `${completed + failed}/${total}`;
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

						failed++;
						const progress = `${completed + failed}/${total}`;

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

		this.printStatistics(completed, failed, total);
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
