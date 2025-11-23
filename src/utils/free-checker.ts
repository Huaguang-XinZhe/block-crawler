import type { Locator, Page } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import type { ProcessingContext } from "../processors/ProcessingContext";
import { createI18n } from "./i18n";

/**
 * Free 内容检查工具
 *
 * ⚠️ 重要说明：
 * - 匹配的是 **DOM 中的文本内容**，不是网页显示的文本
 * - CSS 可能会改变显示效果（如 text-transform、visibility 等）
 * - 建议使用浏览器开发者工具检查实际的 DOM 文本
 * - 对于 Block 级别检查，支持智能策略检测和缓存
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
 * @param context 处理上下文（可选，用于缓存策略）
 */
async function checkFreeGeneric<T extends Page | Locator>(
	target: T,
	config: InternalConfig,
	skipFree: string | ((target: T) => Promise<boolean>) | undefined,
	errorMessageKey: "page.freeError" | "block.freeError",
	context?: ProcessingContext,
): Promise<boolean> {
	if (skipFree === undefined) {
		return false;
	}

	// 如果是自定义函数，直接使用
	if (typeof skipFree === "function") {
		return await skipFree(target);
	}

	// 如果是 Locator（Block），使用智能策略检测
	let searchTarget: Locator | Page = target;
	if ("getByRole" in target && context) {
		const strategy = context.getFreeCheckStrategy();

		if (strategy) {
			// 使用缓存的策略
			if (strategy === "heading") {
				const heading = target.getByRole("heading").first();
				searchTarget = (await heading.count()) > 0 ? heading : target;
			} else {
				// container
				const heading = target.getByRole("heading").first();
				searchTarget =
					(await heading.count()) > 0 ? heading.locator("..") : target;
			}
		} else {
			// 第一次检测：智能判断策略
			const heading = target.getByRole("heading").first();
			const headingCount = await heading.count();

			if (headingCount > 0) {
				const children = await heading.locator("> *").count();

				if (children > 1) {
					// heading 内部有多个元素，直接在 heading 中查找
					searchTarget = heading;
					context.setFreeCheckStrategy("heading");
				} else {
					// heading 内部只有一个元素，在容器中查找
					searchTarget = heading.locator("..");
					context.setFreeCheckStrategy("container");
				}
			}
		}
	} else if ("getByRole" in target) {
		// 没有 context 的情况，使用旧逻辑
		const heading = target.getByRole("heading").first();
		searchTarget =
			(await heading.count()) > 0 ? heading.locator("..") : target;
	}

	const searchText = skipFree === "default" ? /free/i : skipFree;
	const count = await searchTarget.getByText(searchText).count();

	if (count === 0) {
		return false;
	}

	if (count !== 1) {
		const i18n = createI18n(config.locale);
		const textDisplay =
			skipFree === "default" ? "/free/i（忽略大小写）" : skipFree;
		throw new Error(i18n.t(errorMessageKey, { count, text: textDisplay }));
	}

	return true;
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
	context?: ProcessingContext,
): Promise<boolean> {
	return await checkFreeGeneric(
		block,
		config,
		skipFree,
		"block.freeError",
		context,
	);
}

