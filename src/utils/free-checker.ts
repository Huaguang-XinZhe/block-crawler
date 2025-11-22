import type { Locator, Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import { createI18n } from "./i18n";

/**
 * Free 内容检查工具
 *
 * ⚠️ 重要说明：
 * - 匹配的是 **DOM 中的文本内容**，不是网页显示的文本
 * - CSS 可能会改变显示效果（如 text-transform、visibility 等）
 * - 建议使用浏览器开发者工具检查实际的 DOM 文本
 * - 对于 Block 级别检查，会在 heading 的容器元素内查找（避免误匹配 Block 主体内容区域的文本）
 */

/**
 * 通用的 Free 检查逻辑
 * @param target Page 或 Locator
 * @param config 配置
 * @param skipFree 跳过配置：
 *   - undefined: 未启用跳过
 *   - "default": 使用默认匹配 /free/i（忽略大小写）
 *   - string: 精确匹配指定文本
 *   - function: 自定义判断逻辑
 * @param errorMessageKey 错误消息的 i18n key
 */
async function checkFreeGeneric<T extends Page | Locator>(
	target: T,
	config: InternalConfig,
	skipFree: string | ((target: T) => Promise<boolean>) | undefined,
	errorMessageKey: "page.freeError" | "block.freeError",
): Promise<boolean> {
	if (skipFree === undefined) {
		return false;
	}

	// 如果是 Locator（Block），只在 heading 的容器元素内查找
	// 如果是 Page，在整个页面查找
	const searchTarget =
		"getByRole" in target
			? (await target.getByRole("heading").count()) > 0
				? target.getByRole("heading").first().locator("..")
				: target
			: target;

	// "default" 表示使用默认匹配：/free/i（忽略大小写）
	if (skipFree === "default") {
		const count = await searchTarget.getByText(/free/i).count();

		if (count === 0) {
			return false;
		}

		if (count !== 1) {
			const i18n = createI18n(config.locale);
			throw new Error(
				i18n.t(errorMessageKey, { count, text: "/free/i（忽略大小写）" }),
			);
		}

		return true;
	}

	// 字符串配置：使用 getByText 查找（子串匹配）
	if (typeof skipFree === "string") {
		const count = await searchTarget.getByText(skipFree).count();

		if (count === 0) {
			return false;
		}

		if (count !== 1) {
			const i18n = createI18n(config.locale);
			throw new Error(i18n.t(errorMessageKey, { count, text: skipFree }));
		}

		return true;
	}

	// 函数配置：使用自定义判断逻辑
	return await skipFree(target);
}

/**
 * 检查 Page 是否为 Free
 */
export async function checkPageFree(
	page: Page,
	config: InternalConfig,
	skipFree?: string | ((page: Page) => Promise<boolean>),
): Promise<boolean> {
	return await checkFreeGeneric(page, config, skipFree, "page.freeError");
}

/**
 * 检查 Block 是否为 Free
 */
export async function checkBlockFree(
	block: Locator,
	config: InternalConfig,
	skipFree?: string | ((locator: Locator) => Promise<boolean>),
): Promise<boolean> {
	return await checkFreeGeneric(block, config, skipFree, "block.freeError");
}
