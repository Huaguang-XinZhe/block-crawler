import { BlockCrawler } from "@huaguang/block-crawler";
import { test } from "@playwright/test";

test("flyonui", async ({ page }) => {
	test.setTimeout(60 * 1000); // 1 分钟

	const crawler = new BlockCrawler(page, {
		startUrl: "https://flyonui.com/blocks",
		maxConcurrency: 5,
		progress: {
			enable: false,
		},
	});

	await crawler
		.auth("https://flyonui.com/auth/login")
		// .collect()
		// .tabSections("//main/section")
		// .name("h3")
		// .count("p")
		.open("https://flyonui.com/blocks/marketing-ui/portfolio", "load")
		.page({
			autoScroll: true,
		})
		.block(
			'//main/div/div[3]/div/div/div[contains(@class, "flex")]',
			async ({ blockName }) => {
				console.log(blockName);
			},
		)
		// 测试默认匹配（忽略大小写的 "free"）
		.skipFree() // 等同于 .skipFree("FREE")，因为 DOM 中是 "FREE"
		.run();
});
