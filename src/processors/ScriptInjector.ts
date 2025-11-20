import type { Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import { createI18n, type I18n } from "../utils/i18n";

interface ScriptInfo {
	content: string;
	timing: "beforePageLoad" | "afterPageLoad";
}

/**
 * 脚本注入器
 * 职责：处理脚本文件的读取和注入，支持油猴脚本格式
 */
export class ScriptInjector {
	private i18n: I18n;
	private scripts: Map<string, ScriptInfo> = new Map();
	private enabled: boolean;
	private stateDir: string;

	constructor(
		config: InternalConfig,
		stateDir: string,
		scriptInjection?: boolean | { enabled: boolean; scripts?: string[] },
	) {
		this.i18n = createI18n(config.locale);
		this.enabled = !!scriptInjection;
		this.stateDir = stateDir;
		// 注意：脚本现在通过 injectScripts() 方法动态注入，不再在构造函数中预加载
	}

	/**
	 * 检查是否启用了脚本注入
	 */
	isEnabled(): boolean {
		return this.enabled && this.scripts.size > 0;
	}

	/**
	 * 检查是否有需要在指定时机注入的脚本
	 */
	private hasScriptsForTiming(
		timing: "beforePageLoad" | "afterPageLoad",
	): boolean {
		for (const script of this.scripts.values()) {
			if (script.timing === timing) {
				return true;
			}
		}
		return false;
	}

	/**
	 * 在页面加载前注入脚本（使用 addInitScript）
	 * 适用于需要在页面加载前执行的脚本
	 */
	async injectBeforePageLoad(page: Page): Promise<void> {
		if (!this.isEnabled() || !this.hasScriptsForTiming("beforePageLoad")) {
			return;
		}

		for (const [scriptName, scriptInfo] of this.scripts) {
			if (scriptInfo.timing !== "beforePageLoad") {
				continue;
			}

			try {
				await page.addInitScript(scriptInfo.content);
				console.log(this.i18n.t("script.injectedBefore", { name: scriptName }));
			} catch (error) {
				console.error(
					this.i18n.t("script.injectError", {
						name: scriptName,
						error: String(error),
					}),
				);
			}
		}
	}

	/**
	 * 在页面加载后注入脚本
	 * 适用于需要在页面加载完成后执行的脚本
	 */
	async injectAfterPageLoad(page: Page): Promise<void> {
		if (!this.isEnabled() || !this.hasScriptsForTiming("afterPageLoad")) {
			return;
		}

		for (const [scriptName, scriptInfo] of this.scripts) {
			if (scriptInfo.timing !== "afterPageLoad") {
				continue;
			}

			try {
				await page.evaluate(scriptInfo.content);
				console.log(this.i18n.t("script.injectedAfter", { name: scriptName }));
			} catch (error) {
				console.error(
					this.i18n.t("script.injectError", {
						name: scriptName,
						error: String(error),
					}),
				);
			}
		}
	}

	/**
	 * 统一注入接口（根据配置的时机自动选择）
	 * @param page 页面对象
	 * @param beforeLoad 是否在页面加载前调用（true 表示在 goto 前，false 表示在 goto 后）
	 */
	async inject(page: Page, beforeLoad: boolean): Promise<void> {
		if (beforeLoad) {
			await this.injectBeforePageLoad(page);
		} else {
			await this.injectAfterPageLoad(page);
		}
	}

	/**
	 * 动态注入指定脚本列表
	 * @param page 页面对象
	 * @param scriptNames 脚本名称列表（从 .crawler/域名/scripts/ 目录加载）
	 * @param timing 注入时机
	 */
	async injectScripts(
		page: Page,
		scriptNames: string[],
		timing: "beforePageLoad" | "afterPageLoad",
	): Promise<void> {
		const fs = await import("node:fs/promises");
		const path = await import("node:path");

		for (const scriptName of scriptNames) {
			try {
				const scriptPath = path.join(this.stateDir, "scripts", scriptName);
				const content = await fs.readFile(scriptPath, "utf-8");

				if (timing === "beforePageLoad") {
					await page.addInitScript(content);
					console.log(
						this.i18n.t("script.injectedBefore", { name: scriptName }),
					);
				} else {
					await page.evaluate(content);
					console.log(
						this.i18n.t("script.injectedAfter", { name: scriptName }),
					);
				}
			} catch (error) {
				console.error(
					this.i18n.t("script.injectError", {
						name: scriptName,
						error: String(error),
					}),
				);
			}
		}
	}
}
