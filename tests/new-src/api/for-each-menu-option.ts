import { type Locator } from "@playwright/test";

/**
 * 遍历下拉菜单中的指定选项，依次选中并执行自定义处理逻辑
 * @param menu - 下拉菜单的 Locator
 * @param options - 需要处理的选项文本列表
 * @param handler - 每个选项被选中后的处理函数
 */
export async function forEachMenuOption(
	menu: Locator,
	options: string[],
	handler: (optionName: string) => Promise<void>,
) {
	const page = menu.page();
	for (const optionName of options) {
		// 打开菜单
		await menu.click();
		// 直接通过文本定位并点击选项（无需遍历）
		await page.getByRole("option", { name: optionName }).click();
		// 执行自定义处理逻辑
		await handler(optionName);
	}
}
