import { test } from "@playwright/test";
import {
	fetchBlockCodes,
	forEachBlock,
	forEachMenuOption,
} from "./new-src/api";
import { BlockNameCollector } from "./new-src/module";

test("shadcnblocks2", async ({ page }) => {
	test.setTimeout(60 * 1000);

	const targetDomain = "www.shadcnblocks.com";
	const collector = new BlockNameCollector({ domain: targetDomain });

	await page.goto(`https://${targetDomain}/blocks`, {
		waitUntil: "networkidle",
	});

	const dropdown = page.getByRole("combobox").nth(2);

	await forEachMenuOption(dropdown, ["Basic", "Pro"], async (optionName) => {
		console.log(`已选中: ${optionName}`);

		// 定位所有 block 之前的预处理
		await page.getByRole("radio", { name: "List view" }).click();

		// 渐进式遍历所有 block
		await forEachBlock(
			page.locator("//div[@id='block-list']/div/div"),
			async (block, blockName) => {
				console.log(`blockName: ${blockName}`);
				if (blockName) {
					collector.add(blockName, optionName); // 带级别
				}
			},
			{
				blockName: {
					timeout: 2000,
				},
			},
		);
	});

	const names = collector.getAll();

	//   await collector.save();
	//   console.log(`收集完成，共 ${collector.size} 个 block`);

	// const names = await collector.loadNames("Pro");

	if (names.length === 0) {
		console.log("没有找到 blockNames，请先运行收集任务");
		return;
	}

	//   // 调试：查看单个请求的响应头
	//   const debug = await fetchBlockDebug(targetDomain, names[0]);
	//   console.log("原始响应头:", debug.rawHeaders);
	//   console.log("解析后的 Set-Cookie:", debug.setCookies);

	// 并发获取代码
	await fetchBlockCodes(names, targetDomain, "code");
});
