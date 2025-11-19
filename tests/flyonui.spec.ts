import { BlockCrawler } from "@huaguang/block-crawler";
import { test } from "@playwright/test";

test("flyonui", async ({ page }) => {
	const crawler = new BlockCrawler(page);

	// 前置阶段：收集链接（首次运行必须，后续自动跳过）
	await crawler
		.collect("https://flyonui.com/blocks")
		.tabSections("//main/section")
		.name("//h3/text()")
		.count("p");

	// 处理模式：可选（如果只想收集链接可以不配置）
	// await crawler
	//   .blocks('[data-preview]')
	//   .each(async ({ block, blockName }) => {
	//     // 处理每个 block
	//   });

	// 必须：执行
	await crawler.run();
});
