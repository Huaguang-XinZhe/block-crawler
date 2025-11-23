import type { Locator } from "@playwright/test";

/**
 * 默认代码提取器
 * 从 pre 元素中提取文本内容
 *
 * @param pre - pre 元素的 Locator
 * @returns 提取的代码字符串
 */
export async function defaultCodeExtractor(pre: Locator): Promise<string> {
	return (await pre.textContent()) ?? "";
}
