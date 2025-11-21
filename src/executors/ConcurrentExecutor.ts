import type { Page } from "@playwright/test";
import { FreeRecorder } from "../state/FreeRecorder";
import type {
	BeforeContext,
	BlockHandler,
	CollectResult,
	PageHandler,
} from "../types";
import type { CollectionLink } from "../types/meta";
import type { AutoScrollConfig } from "../utils/autoScroll";
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
			`\n${this.context.i18n.t("crawler.startProcessing", { total })}`,
		);

		await Promise.allSettled(
			allLinks.map((linkObj: CollectionLink, index: number) =>
				this.context.limit(async () => {
					const normalizedPath = linkObj.link.startsWith("/")
						? linkObj.link.slice(1)
						: linkObj.link;

					// 跳过已完成的页面
					if (this.context.taskProgress?.isPageComplete(normalizedPath)) {
						console.log(
							this.context.i18n.t("crawler.skipCompleted", {
								name: linkObj.name || normalizedPath,
							}),
						);
						completed++;
						return;
					}

					// 跳过已知的 Free 页面
					if (knownFreePages.has(linkObj.link)) {
						console.log(
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
						console.log(
							`${this.context.i18n.t("crawler.linkComplete", {
								progress,
								name: linkObj.name || linkObj.link,
							})}\n`,
						);
					} catch (error) {
						failed++;
						const progress = `${completed + failed}/${total}`;
						console.error(
							`${this.context.i18n.t("crawler.linkFailed", {
								progress,
								name: linkObj.name || linkObj.link,
							})}\n`,
							error,
						);
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
