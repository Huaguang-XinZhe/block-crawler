import { BlockCrawler } from "@huaguang/block-crawler";
import { test } from "@playwright/test";

test("flyonui", async ({ page }) => {
	const crawler = new BlockCrawler(page);

	// 收集阶段
	await crawler
		.startUrl("https://flyonui.com/blocks")
		.tabSections("//main/section")
		.name("h3")
		.count("p")
		.run();
});
