import { test } from "@playwright/test";
import { BlockCrawler } from "../src";

test("tailark", async ({ page }) => {
	test.setTimeout(2 * 60 * 1000); // 2 分钟

	const crawler = new BlockCrawler(page, {
		startUrl: "https://pro.tailark.com/blocks",
	});

	await crawler
		.collect("networkidle")
		.tabSections("//main/div[1]/div/div[2]/div[2]/div[1]/div/div/div")
		// todo name 和 count 的逻辑有问题❗
		// .name((section) => section.getByRole("link"))
		// .count((section) => section.getByRole("paragraph").last())
		// .name("role[link]")
		// .count("role[paragraph]:last-of-type")
		.run();
});
