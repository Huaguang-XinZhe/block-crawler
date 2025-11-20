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
	 * 从环境变量读取登录凭据
	 */
	private getCredentials(domain: string): {
		email: string;
		password: string;
	} {
		const emailKey = `${domain}_EMAIL`;
		const passwordKey = `${domain}_PASSWORD`;

		const email = process.env[emailKey];
		const password = process.env[passwordKey];

		if (!email || !password) {
			throw new Error(this.i18n.t("auth.errors.noCredentials", { domain }));
		}

		return { email, password };
	}

	/**
	 * 创建自动登录 handler
	 */
	createHandler(options: AutoAuthOptions): (page: Page) => Promise<void> {
		return async (page: Page) => {
			const { loginUrl, redirectUrl } = options;

			// 动态加载 dotenv（避免顶层静态 import 导致的打包问题）
			try {
				const { config } = await import("dotenv");
				config();
			} catch (error) {
				// dotenv 可能不存在或加载失败，继续执行（可能已经有环境变量）
			}

			// 提取域名并获取凭据
			const domainPrefix = this.extractDomainPrefix(loginUrl);
			const { email, password } = this.getCredentials(domainPrefix);

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
