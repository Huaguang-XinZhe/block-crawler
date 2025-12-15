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
 * 在浏览器上下文中检测 Block 的 Free 检查策略
 * 使用 evaluate 封装，减少调试日志中的操作数量
 *
 * 策略判断逻辑：
 * 1. heading 内部子元素 > 1 → "heading"（在 heading 中查找）
 * 2. heading 父元素只有 heading 一个子元素 → "grandparent"（在爷爷容器中查找）
 * 3. 其他情况 → "container"（在 heading 父容器中查找）
 */
async function detectFreeCheckStrategy(
	block: Locator,
): Promise<"heading" | "container" | "grandparent" | null> {
	return await block.evaluate((el) => {
		const heading = el.querySelector("h1, h2, h3, h4, h5, h6");
		if (!heading) {
			return null;
		}

		// 检查 heading 内部子元素数量
		const headingChildren = Array.from(heading.children);
		if (headingChildren.length > 1) {
			// heading 内部有多个元素，直接在 heading 中查找
			return "heading";
		}

		// 检查 heading 父元素的子元素数量
		const parent = heading.parentElement;
		if (parent) {
			const siblings = Array.from(parent.children);
			if (siblings.length === 1) {
				// 父元素只有 heading 一个子元素，往上找爷爷容器
				return "grandparent";
			}
		}

		// 默认在 heading 父容器中查找
		return "container";
	});
}

/**
 * 在浏览器上下文中搜索 Free 文本
 * 使用 evaluate 封装，减少调试日志中的操作数量
 */
async function searchFreeText(
	target: Locator,
	strategy: "heading" | "container" | "grandparent",
	searchText: string | RegExp,
): Promise<number> {
	const isRegex = searchText instanceof RegExp;
	const textToSearch = isRegex ? "free" : searchText;

	return await target.evaluate(
		(el, { text, regex, strat }) => {
			const searchRegex = regex ? new RegExp(text, "i") : null;
			let searchContainer: Element = el;

			const heading = el.querySelector("h1, h2, h3, h4, h5, h6");
			if (heading) {
				if (strat === "heading") {
					searchContainer = heading;
				} else if (strat === "container") {
					searchContainer = heading.parentElement || el;
				} else if (strat === "grandparent") {
					const parent = heading.parentElement;
					searchContainer = parent?.parentElement || parent || el;
				}
			}

			// 在搜索范围内查找文本
			const walker = document.createTreeWalker(
				searchContainer,
				NodeFilter.SHOW_TEXT,
				null,
			);

			let count = 0;
			let node: Text | null;
			while ((node = walker.nextNode() as Text | null)) {
				const content = node.textContent?.trim();
				if (!content) continue;

				if (regex) {
					if (searchRegex!.test(content)) count++;
				} else {
					// 字符串使用精确匹配
					if (content === text) count++;
				}
			}
			return count;
		},
		{ text: textToSearch, regex: isRegex, strat: strategy },
	);
}

/**
 * 检查 Page 是否为 Free
 */
export async function checkPageFree(
	page: Page,
	config: InternalConfig,
	skipFree?: string | ((page: Page) => Promise<boolean>),
): Promise<boolean> {
	if (skipFree === undefined) {
		return false;
	}

	// 如果是自定义函数，直接使用
	if (typeof skipFree === "function") {
		return await skipFree(page);
	}

	// 默认使用正则匹配，字符串使用精确匹配
	if (skipFree === "default") {
		const count = await page.getByText(/free/i).count();
		if (count === 0) return false;
		if (count !== 1) {
			const i18n = createI18n(config.locale);
			throw new Error(
				i18n.t("page.freeError", { count, text: "/free/i（忽略大小写）" }),
			);
		}
		return true;
	}

	// 字符串使用精确匹配（exact: true）
	const count = await page.getByText(skipFree, { exact: true }).count();
	if (count === 0) {
		return false;
	}

	if (count !== 1) {
		const i18n = createI18n(config.locale);
		throw new Error(i18n.t("page.freeError", { count, text: skipFree }));
	}

	return true;
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
	if (skipFree === undefined) {
		return false;
	}

	// 如果是自定义函数，直接使用
	if (typeof skipFree === "function") {
		return await skipFree(block);
	}

	// 获取或检测策略
	let strategy = context?.getFreeCheckStrategy() ?? null;

	if (!strategy) {
		// 第一次检测：智能判断策略
		strategy = await detectFreeCheckStrategy(block);
		if (strategy && context) {
			context.setFreeCheckStrategy(strategy);
		}
	}

	// 如果没有 heading，回退到整个 block 搜索
	if (!strategy) {
		// 默认使用正则匹配，字符串使用精确匹配
		const count =
			skipFree === "default"
				? await block.getByText(/free/i).count()
				: await block.getByText(skipFree, { exact: true }).count();

		if (count === 0) return false;
		if (count !== 1) {
			const i18n = createI18n(config.locale);
			const textDisplay =
				skipFree === "default" ? "/free/i（忽略大小写）" : skipFree;
			throw new Error(i18n.t("block.freeError", { count, text: textDisplay }));
		}
		return true;
	}

	// 使用策略搜索
	const searchText = skipFree === "default" ? /free/i : skipFree;
	const count = await searchFreeText(block, strategy, searchText);

	if (count === 0) {
		return false;
	}

	if (count !== 1) {
		const i18n = createI18n(config.locale);
		const textDisplay =
			skipFree === "default" ? "/free/i（忽略大小写）" : skipFree;
		throw new Error(i18n.t("block.freeError", { count, text: textDisplay }));
	}

	return true;
}
