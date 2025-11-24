import { BlockCrawler } from "@huaguang/block-crawler";
import { type Locator, test } from "@playwright/test";

test("untitledui", async ({ page }) => {
	test.setTimeout(2 * 60 * 1000); // 2 分钟

	const crawler = new BlockCrawler(page, {
		startUrl: "https://www.untitledui.com/react/components",
	});

	await crawler
		// .collect()
		// .tabSections("//section[3]/div/div")
		// .name("p:first-of-type")
		// .count("p:last-of-type")
		.inject(["custom-script.js"])
		// .open("networkidle")
		.open(
			"https://www.untitledui.com/react/components/text-editors",
			"networkidle",
		)
		.page(async ({ currentPage, clickAndVerify }) => {
			// 前置逻辑示例：在整个页面执行
			const listViewTab = currentPage.getByRole("tab", { name: "List view" });
			// 立即判断是否可见，如果可见则点击
			if (await listViewTab.isVisible({ timeout: 0 })) {
				// 使用 clickAndVerify 确保点击生效（tab 元素会自动验证 aria-selected）
				await clickAndVerify(listViewTab);
			}
		})
		.skipFree("FREE")
		.block("[data-preview]", {
			extractCode: extractCodeFromPre,
		})
		.run();
});

// 从 DOM 中提取 Code
async function extractCodeFromPre(pre: Locator): Promise<string> {
	// 等待 export 文本出现
	await pre
		.getByText("export")
		.first()
		.waitFor({ state: "visible", timeout: 10000 }); // 最大等待 10s（以后都设置的大一些，如果超过这个时间那就一定是有问题了❗）
	const rawText = (await pre.textContent()) ?? "";
	return rawText.replace(/Show more/, "").trim();
}
