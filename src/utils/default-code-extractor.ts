import type { Locator } from "@playwright/test";

/**
 * 默认代码提取器
 * 智能检测并提取代码内容，优先级：
 * 1. Prism 代码块（检测 prism-code 类）→ 使用专门的提取逻辑
 * 2. 普通 pre 元素 → 使用 textContent
 *
 * @param pre - pre 元素的 Locator
 * @returns 提取的代码字符串
 */
export async function defaultCodeExtractor(pre: Locator): Promise<string> {
	return await pre.evaluate((element) => {
		// 检测是否是 Prism 代码块
		const isPrism =
			element.classList.contains("prism-code") ||
			element.className.includes("language-");

		if (isPrism) {
			// Prism 代码块提取逻辑
			const clone = element.cloneNode(true) as HTMLElement;

			// 移除所有导致重复的元素
			clone.querySelectorAll(".copy-token").forEach((el) => {
				el.remove();
			});

			// 每个 summary 内的 ellipsis-token 其后所有兄弟元素都移除
			clone.querySelectorAll("summary").forEach((summary) => {
				const ellipsis = summary.querySelector(".ellipsis-token");
				if (ellipsis) {
					let sibling = ellipsis.nextSibling;
					while (sibling) {
						const next = sibling.nextSibling;
						sibling.remove();
						sibling = next;
					}
					ellipsis.remove();
				}
			});

			// 获取所有 token-line 的文本内容并用换行符连接
			const lines = Array.from(clone.querySelectorAll(".token-line"));
			if (lines.length > 0) {
				return lines
					.map((line) => (line as HTMLElement).textContent || "")
					.join("\n");
			}

			// 如果没有 token-line，回退到 textContent
			return clone.textContent || "";
		}

		// 普通 pre 元素，直接使用 textContent
		return element.textContent || "";
	});
}
