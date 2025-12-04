import path from "node:path";
import type { Page } from "@playwright/test";
import fse from "fs-extra";
import { createI18n, type Locale } from "../utils/i18n";

/**
 * 认证管理器
 *
 * 职责：
 * - 检测认证状态文件是否存在
 * - 执行登录流程
 * - 保存认证状态到文件
 * - 提供认证状态文件路径
 */
export class AuthManager {
	private i18n;

	constructor(
		private page: Page,
		private stateDir: string,
		private authHandler?: (page: Page) => Promise<void>,
		locale: Locale = "zh",
	) {
		this.i18n = createI18n(locale);
	}

	/**
	 * 确保认证状态
	 *
	 * 如果未配置 authHandler，不使用认证
	 * 如果 auth.json 存在，读取并应用 cookies 到当前 context
	 * 如果 auth.json 不存在，执行登录并保存
	 */
	async ensureAuth(): Promise<void> {
		if (!this.authHandler) {
			return; // 未配置 auth，不使用认证
		}

		const authFile = path.join(this.stateDir, "auth.json");

		// 检测文件是否存在
		if (await fse.pathExists(authFile)) {
			await this.applyAuthFromFile(authFile);
			return;
		}

		// 执行登录并保存
		console.log(`\n🔐 ${this.i18n.t("auth.performLogin")}`);
		await this.authHandler(this.page);

		// 确保目录存在
		await fse.ensureDir(this.stateDir);
		await this.page.context().storageState({ path: authFile });

		console.log(`✓ ${this.i18n.t("auth.saved")}`);
		console.log(`  ${authFile}`);
	}

	/**
	 * 直接使用现有认证（不执行登录流程）
	 *
	 * 如果 auth.json 存在，读取并应用 cookies 到当前 context
	 * 如果 auth.json 不存在，抛出错误
	 */
	async applyExistingAuth(): Promise<void> {
		const authFile = path.join(this.stateDir, "auth.json");

		// 检测文件是否存在
		if (await fse.pathExists(authFile)) {
			await this.applyAuthFromFile(authFile);
			return;
		}

		// 文件不存在，抛出错误
		throw new Error(
			this.i18n.t("auth.fileNotFound", { path: authFile }) ||
				`认证文件不存在: ${authFile}，请先使用 .auth(loginUrl) 进行登录`,
		);
	}

	/**
	 * 从文件应用认证状态
	 */
	private async applyAuthFromFile(authFile: string): Promise<void> {
		console.log(`\n✓ ${this.i18n.t("auth.reuseExisting")}`);
		console.log(`  ${authFile}`);

		// 读取文件内容
		const fileContent = await fse.readJSON(authFile);
		const context = this.page.context();

		// 检测格式并转换
		const cookies = this.normalizeCookies(fileContent);

		// 应用 cookies
		if (cookies.length > 0) {
			await context.addCookies(cookies);
		}
	}

	/**
	 * 规范化 cookies 格式
	 * 支持两种格式：
	 * 1. Playwright storageState: { cookies: [...], origins: [...] }
	 * 2. 浏览器插件导出: [{ domain, expirationDate, ... }]
	 */
	private normalizeCookies(
		fileContent: unknown,
	): Parameters<ReturnType<typeof this.page.context>["addCookies"]>[0] {
		// 格式 1: Playwright storageState
		if (
			fileContent &&
			typeof fileContent === "object" &&
			"cookies" in fileContent &&
			Array.isArray((fileContent as { cookies: unknown }).cookies)
		) {
			return (fileContent as { cookies: unknown[] }).cookies as Parameters<
				ReturnType<typeof this.page.context>["addCookies"]
			>[0];
		}

		// 格式 2: 浏览器插件导出的 cookie 数组
		if (Array.isArray(fileContent)) {
			return fileContent.map((cookie) => {
				// 构建 URL（用于 Playwright 识别 cookie 的归属）
				const protocol = cookie.secure ? "https" : "http";
				// 移除 domain 前导点
				const cleanDomain = cookie.domain?.replace(/^\./, "") || "";
				const url = `${protocol}://${cleanDomain}${cookie.path || "/"}`;

				return {
					name: cookie.name,
					value: cookie.value,
					url, // 使用 URL 而不是 domain + path
					// expirationDate -> expires
					expires: cookie.expirationDate ?? cookie.expires ?? -1,
					httpOnly: cookie.httpOnly ?? false,
					secure: cookie.secure ?? false,
					// sameSite: null -> "Lax"
					sameSite: this.normalizeSameSite(cookie.sameSite),
				};
			});
		}

		return [];
	}

	/**
	 * 规范化 sameSite 值
	 */
	private normalizeSameSite(
		value: unknown,
	): "Strict" | "Lax" | "None" | undefined {
		if (value === "strict" || value === "Strict") return "Strict";
		if (value === "lax" || value === "Lax") return "Lax";
		if (value === "none" || value === "None") return "None";
		// null, undefined, 或其他值 -> undefined (让 Playwright 使用默认值)
		return undefined;
	}
}
