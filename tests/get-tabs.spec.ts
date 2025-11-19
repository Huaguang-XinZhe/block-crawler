import { test } from "@playwright/test";

const START_URL = "https://pro.mufengapp.cn/components";
// const START_URL = 'https://www.shadcndesign.com/pro-blocks';
// 如果不穿这个，就默认不配 name，然后取第一个 tablist
const TAB_LIST_NAME = "Categories";

test("test", async ({ page }) => {
	await page.goto(START_URL);
	const tabList = await page.getByRole("tablist", { name: TAB_LIST_NAME });
	const tabs = tabList.getByRole("tab");

	// 循环 tabs
	for (let i = 0; i < (await tabs.count()); i++) {
		const tab = tabs.nth(i);
		const text = await tab.textContent();

		// 第一个跳过点击
		if (i === 0) {
			console.log(`跳过点击第一个 tab: ${text}`);
			continue;
		}

		console.log(`点击了 ${text} 的 tab`);
		await tab.click();
	}
});
