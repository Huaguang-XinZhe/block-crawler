import path from "node:path";
import type { Page } from "@playwright/test";
import fse from "fs-extra";

/**
 * 脚本注入器
 * 支持普通脚本和油猴脚本的注入
 */
export class ScriptInjector {
	private scriptDir: string;

	constructor(scriptDir: string) {
		this.scriptDir = scriptDir;
	}

	/**
	 * 在页面加载前注入脚本（使用 addInitScript）
	 * 适用于需要在页面加载前执行的脚本
	 */
	async injectBeforePageLoad(page: Page, scriptNames: string[]): Promise<void> {
		await this.injectScripts(page, scriptNames, {
			inject: (content) => page.addInitScript(content),
			logMessage: (scriptPath) => `✅ 脚本已在页面加载前注入: ${scriptPath}`,
		});
	}

	/**
	 * 在页面加载后注入脚本（使用 evaluate）
	 * 适用于需要在页面加载完成后执行的脚本
	 */
	async injectAfterPageLoad(page: Page, scriptNames: string[]): Promise<void> {
		await this.injectScripts(page, scriptNames, {
			inject: (content) => page.evaluate(content),
			logMessage: (scriptPath) => `✅ 脚本已在页面加载后注入: ${scriptPath}`,
		});
	}

	/**
	 * 通用脚本注入方法
	 * @param page Playwright 页面对象
	 * @param scriptNames 脚本名称数组
	 * @param options 注入选项，包含注入函数和日志消息生成函数
	 */
	private async injectScripts(
		page: Page,
		scriptNames: string[],
		options: {
			inject: (content: string) => Promise<void>;
			logMessage: (scriptPath: string) => string;
		},
	): Promise<void> {
		if (scriptNames.length === 0) {
			return;
		}

		// 映射得到 scriptPaths
		const scriptPaths = scriptNames.map((scriptName) =>
			path.join(this.scriptDir, scriptName),
		);

		const hasUserScript = this.checkHasUserScript(scriptPaths);

		if (hasUserScript) {
			const polyfill = await this.getGMPolyfill();
			await page.addInitScript(polyfill);
			console.log("🔧 油猴 API polyfill 已注入（页面加载前）");
		}

		// 注入用户脚本
		for (const scriptPath of scriptPaths) {
			try {
				const content = await fse.readFile(scriptPath, "utf-8");
				await options.inject(content);
				console.log(options.logMessage(scriptPath));
			} catch (error) {
				console.error(`❌ 注入脚本失败 ${scriptPath}:`, error);
			}
		}
	}

	/**
	 * 检查脚本内容是否为油猴脚本
	 */
	private isUserScript(content: string): boolean {
		return content.includes("// ==UserScript==");
	}

	/**
	 * 获取 GM polyfill 脚本内容
	 */
	private async getGMPolyfill(): Promise<string> {
		const gmFileURL = new URL("./gm-polyfill.js", import.meta.url);
		return await fse.readFile(gmFileURL, "utf-8");
	}

	/**
	 * 检查是否有油猴脚本，传入 scriptPaths
	 */
	private checkHasUserScript(scriptPaths: string[]): boolean {
		for (const scriptPath of scriptPaths) {
			const content = fse.readFileSync(scriptPath, "utf-8");
			if (this.isUserScript(content)) {
				return true;
			}
		}
		return false;
	}
}
