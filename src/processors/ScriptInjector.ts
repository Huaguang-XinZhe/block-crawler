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
	 * 检查脚本是否是油猴脚本（UserScript）
	 */
	private isUserScript(content: string): boolean {
		return content.includes("// ==UserScript==");
	}

	/**
	 * 生成油猴 API polyfill
	 * 为油猴脚本提供必要的 API 模拟
	 */
	private getGMPolyfill(): string {
		return `
// Tampermonkey API Polyfill for Playwright
(function() {
    'use strict';
    
    // GM_xmlhttpRequest polyfill using fetch
    window.GM_xmlhttpRequest = function(details) {
        const {
            method = 'GET',
            url,
            headers = {},
            data,
            onload,
            onerror,
            ontimeout,
            timeout = 30000
        } = details;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            if (ontimeout) ontimeout();
        }, timeout);

        const fetchOptions = {
            method: method,
            headers: headers,
            signal: controller.signal
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            fetchOptions.body = data;
        }

        fetch(url, fetchOptions)
            .then(response => {
                clearTimeout(timeoutId);
                return response.text().then(text => ({
                    status: response.status,
                    statusText: response.statusText,
                    responseText: text,
                    response: text,
                    readyState: 4
                }));
            })
            .then(result => {
                if (onload) onload(result);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    if (ontimeout) ontimeout();
                } else {
                    if (onerror) onerror(error);
                }
            });
    };

    // 其他常用油猴 API 的 polyfill
    window.GM_getValue = function(key, defaultValue) {
        const value = localStorage.getItem('GM_' + key);
        return value !== null ? JSON.parse(value) : defaultValue;
    };

    window.GM_setValue = function(key, value) {
        localStorage.setItem('GM_' + key, JSON.stringify(value));
    };

    window.GM_deleteValue = function(key) {
        localStorage.removeItem('GM_' + key);
    };

    window.GM_listValues = function() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('GM_')) {
                keys.push(key.substring(3));
            }
        }
        return keys;
    };

    window.GM_info = {
        script: {
            name: 'UserScript via Playwright',
            version: '1.0'
        },
        scriptHandler: 'Playwright ScriptInjector',
        version: '1.0'
    };

    console.log('[GM] Tampermonkey API polyfill loaded');
})();
`;
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

		let hasUserScript = false;

		// 预检查是否有油猴脚本
		for (const scriptName of scriptNames) {
			try {
				const scriptPath = path.join(this.stateDir, "scripts", scriptName);
				const content = await fs.readFile(scriptPath, "utf-8");
				if (this.isUserScript(content)) {
					hasUserScript = true;
					break;
				}
			} catch (error) {
				// 继续检查其他脚本
			}
		}

		// 如果有油猴脚本，先注入 polyfill
		if (hasUserScript) {
			try {
				if (timing === "beforePageLoad") {
					await page.addInitScript(this.getGMPolyfill());
				} else {
					await page.evaluate(this.getGMPolyfill());
				}
				console.log(
					this.i18n.t("script.gmPolyfillInjected") ||
						"🔧 油猴 API polyfill 已注入",
				);
			} catch (error) {
				console.warn(
					this.i18n.t("script.gmPolyfillError") || "⚠️  油猴 polyfill 注入失败:",
					error,
				);
			}
		}

		// 注入用户脚本
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
