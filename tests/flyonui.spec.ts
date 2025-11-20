import { BlockCrawler } from "@huaguang/block-crawler";
import { test } from "@playwright/test";

test("flyonui", async ({ page }) => {
	test.setTimeout(60 * 1000); // 1 分钟

	const crawler = new BlockCrawler(page, {
		startUrl: "https://flyonui.com/blocks",
	});

	await crawler
		.auth("https://flyonui.com/auth/login")
		// .collect()
		// .tabSections("//main/section")
		// .name("h3")
		// .count("p")
		.open()
		.page({
			autoScroll: true, // 启用自动滚动（默认 step=1000, interval=500）
		})
		.block(
			'//main/div/div[3]/div/div/div[contains(@class, "flex")]',
			async ({ blockName }) => {
				console.log(blockName);
			},
		)
		.skipFree("FREE") // 跳过 free block
		.run();
});
