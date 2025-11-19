import type { Page } from "@playwright/test";
import { createI18n, type I18n } from "../utils/i18n";
import type { InternalConfig } from "./ConfigManager";

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

	constructor(config: InternalConfig, _stateDir: string) {
		this.i18n = createI18n(config.locale);
		this.enabled = !!config.scriptInjection;
		this.globalTiming = config.scriptInjection?.timing;

		// 预加载所有脚本内容
		if (this.enabled && config.scriptInjection) {
			const { script, scripts } = config.scriptInjection;

			// 处理单个脚本（从根目录）
			if (script) {
				this.loadScripts([script], false);
			}

			// 处理多个脚本（从 scripts 子目录）
			if (scripts && scripts.length > 0) {
				this.loadScripts(scripts, true);
			}
		}
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
}
