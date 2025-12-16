import path from "node:path";
import type { Page } from "@playwright/test";
import pLimit from "p-limit";
import { ScriptInjector } from "../module";
import type { WaitUntil } from "../shared/types";
import { findProjectRoot } from "../shared/utils";

interface HandlePageConcurrentlyOptions {
	concurrency: number;
	gotoWaitUntil: WaitUntil;
	scriptInjection: {
		scriptsDir: string;
		beforePageLoadScripts: string[];
		afterPageLoadScripts: string[];
	};
}

/** 并发处理页面 */
export async function handlePageConcurrently(
	page: Page,
	domain: string,
	linkPaths: string[],
	handler: (currentPage: Page, linkPath: string) => Promise<void>,
	options?: Partial<HandlePageConcurrentlyOptions>,
): Promise<void> {
	const limit = pLimit(options?.concurrency ?? 5);
	const waitUntil = options?.gotoWaitUntil ?? "load";
	const scriptInjection = options?.scriptInjection;

	// 初始化脚本注入器（如果需要）
	let injector: ScriptInjector | undefined;
	if (scriptInjection) {
		injector = new ScriptInjector(
			scriptInjection.scriptsDir ?? constructScriptDir(domain),
		);
	}

	const tasks = linkPaths.map((linkPath) =>
		limit(async () => {
			const currentPage = await page.context().newPage();
			const beforePageLoadScripts = scriptInjection?.beforePageLoadScripts;
			const afterPageLoadScripts = scriptInjection?.afterPageLoadScripts;

			try {
				// 在页面加载前注入脚本
				if (injector && beforePageLoadScripts) {
					await injector.injectBeforePageLoad(
						currentPage,
						beforePageLoadScripts,
					);
				}

				// 导航到页面
				const link = `https://${domain}${linkPath}`;
				await currentPage.goto(link, { waitUntil });

				// 在页面加载后注入脚本
				if (injector && afterPageLoadScripts) {
					await injector.injectAfterPageLoad(currentPage, afterPageLoadScripts);
				}

				// 执行处理函数
				await handler(currentPage, linkPath);
			} catch (error) {
				console.error(`处理页面出错 ${linkPath}:`, error);
				throw error;
			}
		}),
	);

	await Promise.all(tasks);
}

// 构造脚本目录
function constructScriptDir(domain: string): string {
	return path.join(findProjectRoot(), ".crawler", domain, "scripts");
}
