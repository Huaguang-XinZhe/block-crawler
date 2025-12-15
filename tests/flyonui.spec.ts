import { type BlockAutoConfig, BlockCrawler } from "@huaguang/block-crawler";
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
		.open("https://flyonui.com/blocks/marketing-ui/portfolio") // 测试这个页面
		// .open() // 并发处理
		// .page({
		// 	autoScroll: true,
		// })
		.block('//main/div/div[3]/div/div/div[contains(@class, "flex")]', true, {
			tabContainer: (block) => block.locator("//div[2]/div[2]/div[1]/div"), // 容器 Locator
			tabRole: "button", // 该网站使用 button 作为 tab
			// extractCode 使用默认（从 pre 获取 textContent）
		})
		// 测试默认匹配（忽略大小写的 "free"）
		.skipFree()
		.run();
});
