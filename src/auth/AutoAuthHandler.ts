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
	/** .env 文件所在目录（可选，默认为 .crawler/域名/ 目录） */
	envDir?: string;
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
	private extractDomainPrefix(url: string): string {
		try {
			const urlObj = new URL(url);
			const hostname = urlObj.hostname;
			// 提取二级域名（去掉 www. 和顶级域名）
			const parts = hostname.split(".");
			const domain =
				parts.length > 2 && parts[0] === "www" ? parts[1] : parts[0];
			return domain.toUpperCase();
		} catch (error) {
			throw new Error(
				`${this.i18n.t("auth.errors.invalidUrl")}: ${url}\n${error}`,
			);
		}
	}

	/**
	 * 从 .env 文件读取登录凭据
	 * @param domain 域名前缀
	 * @param envDir .env 文件所在目录
	 */
	private async getCredentials(
		domain: string,
		envDir?: string,
	): Promise<{
		email: string;
		password: string;
	}> {
		// 如果指定了 envDir，从该目录的 .env 文件读取
		if (envDir) {
			try {
				const path = await import("node:path");
				const { config } = await import("dotenv");
				const envPath = path.resolve(envDir, ".env");
				config({ path: envPath });
			} catch (error) {
				// 加载失败，继续尝试从环境变量读取
			}
		}

		const emailKey = `${domain}_EMAIL`;
		const passwordKey = `${domain}_PASSWORD`;

		const email = process.env[emailKey];
		const password = process.env[passwordKey];

		if (!email || !password) {
			const envLocation = envDir
				? `${envDir}/.env`
				: ".env 文件或环境变量";
			throw new Error(
				`${this.i18n.t("auth.errors.noCredentials", { domain })}\n位置: ${envLocation}`,
			);
		}

		return { email, password };
	}

	/**
	 * 创建自动登录 handler
	 */
	createHandler(options: AutoAuthOptions): (page: Page) => Promise<void> {
		return async (page: Page) => {
			const { loginUrl, redirectUrl, envDir } = options;

			// 提取域名并获取凭据（从 envDir/.env 或环境变量）
			const domainPrefix = this.extractDomainPrefix(loginUrl);
			const { email, password } = await this.getCredentials(
				domainPrefix,
				envDir,
			);

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
 */
export function createAutoAuthHandler(
	options: AutoAuthOptions,
	locale: Locale = "zh",
): (page: Page) => Promise<void> {
	const handler = new AutoAuthHandler(locale);
	return handler.createHandler(options);
}
