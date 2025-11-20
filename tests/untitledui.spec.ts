import { BlockCrawler } from "@huaguang/block-crawler";
import { type Locator, test } from "@playwright/test";

test("untitledui", async ({ page }) => {
	test.setTimeout(2 * 60 * 1000); // 2 分钟

	const crawler = new BlockCrawler(page, {
		startUrl: "https://www.untitledui.com/react/components",
		skipFree: "FREE",
		locale: "zh",
		collectionLinkWaitOptions: {
			// 得加这个，不加这个，Live view 的点击可能会失效❗
			waitUntil: "networkidle",
		},
		scriptInjection: {
			script: "custom-script.js", // 单个脚本，从 .crawler/www.untitledui.com/ 读取
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

	// 如果需要登录，可以使用 auth() 方法
	// await crawler
	//   .auth(async (page) => {
	//     await page.goto("https://www.untitledui.com/login");
	//     await page.fill("#username", "user");
	//     await page.fill("#password", "pass");
	//     await page.click("button[type=submit]");
	//     await page.waitForURL("**/dashboard");
	//   })

	// 独立的收集阶段
	await crawler
		.collect()
		.tabSections(async (page) => {
			// 返回所有包含内容的 sections
			return page.locator("xpath=//section[3]/div/div").all();
		})
		.name("p:first-of-type")
		.count("p:last-of-type")
		.run();

	// 独立的处理阶段
	await crawler
		.open("networkidle")
		.page(async ({ currentPage, clickAndVerify }) => {
			// 前置逻辑示例：在整个页面执行
			const listViewTab = currentPage.getByRole("tab", { name: "List view" });
			// 使用 clickAndVerify 确保点击生效（tab 元素会自动验证 aria-selected）
			if (await listViewTab.isVisible({ timeout: 0 })) {
				await clickAndVerify(listViewTab);
			}
		})
		.block("[data-preview]", async ({ block, safeOutput, clickCode }) => {
			// 使用 clickCode 点击 Code 按钮（内置验证）
			await clickCode();
			// 获取内部 pre
			const code = await extractCodeFromDOM(block);
			// 输出到文件
			await safeOutput(code);
		})
		.run();

	// 测试模式示例
	// await crawler
	//   .open("networkidle")
	//   .page(async ({ currentPage, clickAndVerify }) => {
	//     // 前置逻辑：点击切换到 List view
	//     const listViewTab = currentPage.getByRole("tab", { name: "List view" });
	//     if (await listViewTab.isVisible({ timeout: 0 })) {
	//       await clickAndVerify(listViewTab);
	//     }
	//   })
	//   .test(
	//     "https://www.untitledui.com/react/components/sign-up-pages",
	//     "[data-preview]",
	//     { index: 1 }
	//   )
	//   .run();
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
