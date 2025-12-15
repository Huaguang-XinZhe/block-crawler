import { test } from "@playwright/test";
import { fetchNewBlocks } from "./new-src/api/fetch-new-blocks";

test("shadcnblocks.request.new", async ({ page }) => {
	test.setTimeout(2 * 60 * 1000); // 2 分钟

	await fetchNewBlocks(page, {
		domain: "www.shadcnblocks.com",
		newBlocksLocator: page.locator(
			'//div[@id="section-2"]/div/div[2]/div/div/div',
		),
		codePath: "code",
	});
});
