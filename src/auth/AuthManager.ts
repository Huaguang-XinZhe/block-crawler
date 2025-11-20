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
			console.log(`\n✓ ${this.i18n.t("auth.reuseExisting")}`);
			console.log(`  ${authFile}`);

			// 读取并应用认证状态到当前 context
			const storageState = await fse.readJSON(authFile);
			const context = this.page.context();

			// 应用 cookies
			if (storageState.cookies && storageState.cookies.length > 0) {
				await context.addCookies(storageState.cookies);
			}

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
}
