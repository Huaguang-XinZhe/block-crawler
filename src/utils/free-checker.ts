import type { Locator, Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import { createI18n } from "./i18n";

/**
 * Free 内容检查工具
 */

/**
 * 通用的 Free 检查逻辑
 * @param target Page 或 Locator
 * @param config 配置
 * @param skipFree 跳过配置（字符串或函数）
 * @param errorMessageKey 错误消息的 i18n key
 */
async function checkFreeGeneric<T extends Page | Locator>(
	target: T,
	config: InternalConfig,
	skipFree: string | ((target: T) => Promise<boolean>) | undefined,
	errorMessageKey: "page.freeError" | "block.freeError",
): Promise<boolean> {
	if (!skipFree) {
		return false;
	}

	// 字符串配置：使用 getByText 查找（子串匹配）
	if (typeof skipFree === "string") {
		const count = await target.getByText(skipFree).count();

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

