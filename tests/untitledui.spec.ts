import { BlockCrawler } from "@huaguang/block-crawler";
import { type Locator, test } from "@playwright/test";

test("untitledui", async ({ page }) => {
	test.setTimeout(2 * 60 * 1000); // 2 分钟

	const crawler = new BlockCrawler(page, {
		startUrl: "https://www.untitledui.com/react/components",
		skipFree: "FREE",
		// useIndependentContext: true, // 开了这个模式也解决不了点击失效的问题❗
		locale: "zh",
		collectionNameLocator: "p:first-of-type",
		collectionCountLocator: "p:last-of-type",
		collectionLinkWaitOptions: {
			// 得加这个，不加这个，Live view 的点击可能会失效❗
			waitUntil: "networkidle",
		},
		scriptInjection: {
			script: "custom-script.js", // 单个脚本，从 .crawler/www.untitledui.com/ 读取
		},
		// 使用新的 getAllTabSections 模式（跳过 tab 点击）
		getAllTabSections: async (page) => {
			// 返回所有包含内容的 sections
			return page.locator("xpath=//section[3]/div/div").all();
		},
		// 进度恢复配置
		// progress: {
		//   enable: true,
		//   rebuild: {
		//     blockType: "file", // untitledui 的 block 是文件
		//     saveToProgress: true,
		//   },
		// },
	});

	await crawler
		.blocks("[data-preview]")
		.before(async ({ currentPage, clickAndVerify }) => {
			// 前置逻辑示例：在匹配所有 Block 之前执行
			const listViewTab = currentPage.getByRole("tab", { name: "List view" });
			// 使用 clickAndVerify 确保点击生效（tab 元素会自动验证 aria-selected）
			if (await listViewTab.isVisible({ timeout: 0 })) {
				await clickAndVerify(listViewTab);
			}
		})
		.each(async ({ block, safeOutput, clickCode }) => {
			// 使用 clickCode 点击 Code 按钮（内置验证）
			await clickCode();
			// 获取内部 pre
			const code = await extractCodeFromDOM(block);
			// 输出到文件
			await safeOutput(code);
		});

	// await crawler
	//   .test(
	//     "https://www.untitledui.com/react/components/sign-up-pages",
	//     "[data-preview]",
	//     1
	//   )
	//   .before(async ({ currentPage, clickAndVerify }) => {
	//     // 前置逻辑示例：在匹配所有 Block 之前执行
	//     const listViewTab = currentPage.getByRole("tab", { name: "List view" });
	//     if (await listViewTab.isVisible({ timeout: 0 })) {
	//       // tab 元素会自动验证 aria-selected，无需手动写验证函数
	//       await clickAndVerify(listViewTab);
	//     }
	//   })
	//   .run(async ({ section, blockName, safeOutput, clickCode }) => {
	//     console.log(`测试组件: ${blockName}`);
	//     // 使用 clickCode 点击 Code 按钮（内置验证）
	//     await clickCode();
	//     // 获取内部 pre
	//     const code = await extractCodeFromDOM(section);
	//     // 使用 safeOutput 安全输出（自动处理文件名 sanitize）
	//     await safeOutput(code);
	//   });
});

// 从 DOM 中提取 Code
async function extractCodeFromDOM(section: Locator): Promise<string> {
	const pre = section.locator("pre").last();
	// 等待 export 文本出现
	await pre
		.getByText("export")
		.first()
		.waitFor({ state: "visible", timeout: 10000 }); // 最大等待 10s（以后都设置的大一些，如果超过这个时间那就一定是有问题了❗）
	const rawText = (await pre.textContent()) ?? "";
	return rawText.replace(/Show more/, "").trim();
}
