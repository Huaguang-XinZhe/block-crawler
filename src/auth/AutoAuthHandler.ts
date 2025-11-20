import type { Page } from "@playwright/test";
import { createI18n, type Locale } from "../utils/i18n";

/**
 * 自动登录配置
 */
export interface AutoAuthOptions {
	/** 登录页面 URL */
	loginUrl: string;
	/** 登录后跳转的 URL 模式（可选） */
	redirectUrl?: string;
}

/**
 * 自动登录处理器
 *
 * 支持常见的邮箱+密码登录场景：
 * - 自动检测 2 个 textbox（email + password）
 * - 自动检测包含 "sign in" 的 button
 * - 自动填写并提交
 * - 等待登录完成
 *
 * 超出以上条件会抛出错误，提示使用自定义 handler
 */
export class AutoAuthHandler {
	private i18n;

	constructor(locale: Locale = "zh") {
		this.i18n = createI18n(locale);
	}

	/**
	 * 从 URL 提取域名前缀用于环境变量命名
	 * 例如：https://www.flyonui.com/login → FLYONUI
	 */
	/**
	 * 从 .env 文件读取登录凭据
	 * @param envDir .env 文件所在目录（.crawler/域名/ 目录）
	 */
	private async getCredentials(envDir: string): Promise<{
		email: string;
		password: string;
	}> {
		// 从指定目录的 .env 文件读取
		try {
			const path = await import("node:path");
			const { config } = await import("dotenv");
			const envPath = path.resolve(envDir, ".env");
			config({ path: envPath });
		} catch (error) {
			// 加载失败，抛出错误
			throw new Error(
				`${this.i18n.t("auth.errors.loadEnvFailed")}\n位置: ${envDir}/.env\n错误: ${error}`,
			);
		}

		const email = process.env.EMAIL;
		const password = process.env.PASSWORD;

		if (!email || !password) {
			throw new Error(
				`${this.i18n.t("auth.errors.noCredentials")}\n位置: ${envDir}/.env`,
			);
		}

		return { email, password };
	}

	/**
	 * 创建自动登录 handler
	 * @param options 登录配置
	 * @param envDir .env 文件所在目录（.crawler/域名/ 目录）
	 */
	createHandler(
		options: AutoAuthOptions,
		envDir: string,
	): (page: Page) => Promise<void> {
		return async (page: Page) => {
			const { loginUrl, redirectUrl } = options;

			// 从 envDir/.env 读取凭据
			const { email, password } = await this.getCredentials(envDir);

			console.log(`\n${this.i18n.t("auth.autoDetecting")}`);

			// 访问登录页
			await page.goto(loginUrl);

			// 检测登录表单
			console.log(this.i18n.t("auth.autoDetectingForm"));

			// 1. 检测 textbox 数量
			const textboxes = await page.getByRole("textbox").all();
			if (textboxes.length !== 2) {
				throw new Error(
					this.i18n.t("auth.errors.invalidForm") +
						`\n${this.i18n.t("auth.errors.textboxCount", {
							count: textboxes.length,
						})}`,
				);
			}

			// 2. 识别 email 和 password 输入框
			let emailInput: (typeof textboxes)[0] | null = null;
			let passwordInput: (typeof textboxes)[0] | null = null;

			for (const textbox of textboxes) {
				const name = (await textbox.getAttribute("name")) || "";
				const type = (await textbox.getAttribute("type")) || "";
				const placeholder = (await textbox.getAttribute("placeholder")) || "";
				const ariaLabel = (await textbox.getAttribute("aria-label")) || "";

				const allText =
					`${name} ${type} ${placeholder} ${ariaLabel}`.toLowerCase();

				if (allText.includes("email") || allText.includes("mail")) {
					emailInput = textbox;
				} else if (allText.includes("password") || allText.includes("pass")) {
					passwordInput = textbox;
				}
			}

			if (!emailInput || !passwordInput) {
				throw new Error(
					this.i18n.t("auth.errors.invalidForm") +
						`\n${this.i18n.t("auth.errors.cannotIdentifyInputs")}`,
				);
			}

			// 3. 检测 sign in button
			const buttons = await page
				.getByRole("button")
				.filter({
					hasText: /sign[\s-]?in/i,
				})
				.all();

			if (buttons.length !== 1) {
				throw new Error(
					this.i18n.t("auth.errors.invalidForm") +
						`\n${this.i18n.t("auth.errors.buttonCount", {
							count: buttons.length,
						})}`,
				);
			}

			const signInButton = buttons[0];

			// 4. 填写表单
			console.log(this.i18n.t("auth.autoFillCredentials"));
			await emailInput.fill(email);
			await passwordInput.fill(password);

			// 5. 提交表单
			console.log(this.i18n.t("auth.autoSubmitting"));
			await signInButton.click();

			// 6. 等待跳转
			console.log(this.i18n.t("auth.autoWaitingRedirect"));
			if (redirectUrl) {
				// 使用用户指定的跳转 URL
				await page.waitForURL(redirectUrl);
			} else {
				// 默认：等待 URL 不再包含 "login" 或 "auth"
				await page.waitForURL((url) => {
					const urlString = url.toString().toLowerCase();
					return !urlString.includes("/login") && !urlString.includes("/auth");
				});
			}

			console.log(this.i18n.t("auth.autoLoginSuccess"));
		};
	}
}

/**
 * 创建自动登录 handler
 * @param options 登录配置
 * @param envDir .env 文件所在目录（.crawler/域名/ 目录）
 * @param locale 语言
 */
export function createAutoAuthHandler(
	options: AutoAuthOptions,
	envDir: string,
	locale: Locale = "zh",
): (page: Page) => Promise<void> {
	const handler = new AutoAuthHandler(locale);
	return handler.createHandler(options, envDir);
}
