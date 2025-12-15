import { test, Locator } from "@playwright/test";
import { BlockNameCollector } from "./utils/block-name-collector";
import { fetchBlockCodes, fetchBlockDebug } from "./utils/curl-fetcher";
import { retryOnce } from "./utils/utils";

interface ForEachBlockOptions {
	/** blockName 获取配置 */
	blockName?: {
		/** 定位器（相对于 block），默认使用 getByRole('heading') */
		locator?: Locator;
		/** 超时时间（毫秒），默认 1000 */
		timeout?: number;
	};
	/** 渐进式定位：处理完当前批次后检查新增，直到没有新增为止。默认 true */
	progressive?: boolean;
}

/**
 * 遍历 blocks 并执行处理逻辑，自动获取 blockName
 * @param blocksLocator - blocks 的 Locator
 * @param handler - 处理函数，接收 block 和 blockName
 * @param options - 可选配置
 */
async function forEachBlock(
	blocksLocator: Locator,
	handler: (block: Locator, blockName: string | null) => Promise<void>,
	options?: ForEachBlockOptions,
) {
	const { blockName = {}, progressive = true } = options ?? {};
	const { locator: blockNameLocator, timeout = 1000 } = blockName;

	// 获取 blockName 的辅助函数
	const getBlockName = (block: Locator) => {
		const nameLocator = blockNameLocator ?? block.getByRole("heading");
		return retryOnce(
			() => nameLocator.textContent({ timeout }),
			() =>
				block.evaluate((el) =>
					el.scrollIntoView({ behavior: "auto", block: "start" }),
				),
		);
	};

	if (!progressive) {
		// 只定位一次
		const blocks = await blocksLocator.all();
		for (const block of blocks) {
			const blockName = await getBlockName(block);
			await handler(block, blockName);
		}
	} else {
		// 渐进式定位：处理完当前批次后，检查是否有新增
		let processedCount = 0;
		while (true) {
			const allBlocks = await blocksLocator.all();
			const newBlocks = allBlocks.slice(processedCount);
			if (newBlocks.length === 0) break;

			console.log(
				`发现 ${newBlocks.length} 个新 block，总计 ${allBlocks.length}`,
			);
			for (const block of newBlocks) {
				const blockName = await getBlockName(block);
				await handler(block, blockName);
			}
			processedCount = allBlocks.length;
		}
	}
}

/**
 * 遍历下拉菜单中的指定选项，依次选中并执行自定义处理逻辑
 * @param menu - 下拉菜单的 Locator
 * @param options - 需要处理的选项文本列表
 * @param handler - 每个选项被选中后的处理函数
 */
async function forEachMenuOption(
	menu: Locator,
	options: string[],
	handler: (optionName: string) => Promise<void>,
) {
	const page = menu.page();
	for (const optionName of options) {
		// 打开菜单
		await menu.click();
		// 直接通过文本定位并点击选项（无需遍历）
		await page.getByRole("option", { name: optionName }).click();
		// 执行自定义处理逻辑
		await handler(optionName);
	}
}

// ===================== 使用示例 =====================

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
