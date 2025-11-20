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
	 * 解析 .env 文件内容
	 * @param content .env 文件内容
	 */
	private parseEnvFile(content: string): Record<string, string> {
		const result: Record<string, string> = {};

		for (const line of content.split("\n")) {
			// 去除首尾空白
			const trimmed = line.trim();

			// 跳过空行和注释
			if (!trimmed || trimmed.startsWith("#")) {
				continue;
			}

			// 查找第一个 = 号
			const equalIndex = trimmed.indexOf("=");
			if (equalIndex === -1) {
				continue;
			}

			// 提取 key 和 value
			const key = trimmed.slice(0, equalIndex).trim();
			let value = trimmed.slice(equalIndex + 1).trim();

			// 去除引号（单引号或双引号）
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			result[key] = value;
		}

		return result;
	}

	/**
	 * 从 .env 文件读取登录凭据
	 * @param envDir .env 文件所在目录（.crawler/域名/ 目录）
	 */
	private async getCredentials(envDir: string): Promise<{
		email: string;
		password: string;
	}> {
		const path = await import("node:path");
		const fs = await import("node:fs/promises");
		const envPath = path.resolve(envDir, ".env");

		try {
			// 读取 .env 文件
			const content = await fs.readFile(envPath, "utf-8");

			// 解析文件内容
			const env = this.parseEnvFile(content);

			const email = env.EMAIL;
			const password = env.PASSWORD;

			if (!email || !password) {
				throw new Error(
					`${this.i18n.t("auth.errors.noCredentials")}\n位置: ${envPath}`,
				);
			}

			return { email, password };
		} catch (error) {
			// 文件不存在或读取失败
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				throw new Error(
					`${this.i18n.t("auth.errors.envFileNotFound")}\n位置: ${envPath}`,
				);
			}

			throw new Error(
				`${this.i18n.t("auth.errors.loadEnvFailed")}\n位置: ${envPath}\n错误: ${error}`,
			);
		}
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
