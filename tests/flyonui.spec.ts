import { BlockCrawler } from "@huaguang/block-crawler";
import { Page, test } from "@playwright/test";

test("flyonui", async ({ page }) => {
	test.setTimeout(60 * 1000); // 1 分钟

	const crawler = new BlockCrawler(page, {
		startUrl: "https://flyonui.com/blocks",
	});

	await crawler
		// .collect()
		// .tabSections("//main/section")
		// .name("h3")
		// .count("p")
		.open()
		.page(async ({ currentPage }) => {
			await autoScroll(currentPage);
		})
		.block(
			'//main/div/div[3]/div/div/div[contains(@class, "flex")]',
			async ({ blockName }) => {
				console.log(blockName);
			},
		)
		.skipFree("FREE")
		.run();
});

async function autoScroll(page: Page, step = 1000, interval = 500) {
	await page.evaluate(async () => {
		await new Promise<void>((resolve) => {
			let totalHeight = 0;
			const distance = step;

			const timer = setInterval(() => {
				const scrollHeight = document.body.scrollHeight;
				window.scrollBy(0, distance);
				totalHeight += distance;

				if (totalHeight >= scrollHeight) {
					clearInterval(timer);
					resolve();
				}
			}, interval);
		});
	});
}
