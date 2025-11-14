import { test, type Locator } from "@playwright/test";
import { BlockCrawler } from "@huaguang/block-crawler";

test("untitledui", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000); // 2 分钟

  const crawler = new BlockCrawler(page, {
    startUrl: "https://www.untitledui.com/react/components",
    skipFree: "FREE",
    enableProgressResume: false,
    locale: "en",
    collectionNameLocator: "p:first-of-type",
    collectionCountLocator: "p:last-of-type",
    collectionLinkWaitOptions: {
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
  });

  // await crawler
  //   .blocks("[data-preview]")
  //   .before(async (currentPage) => {
  //     // 前置逻辑示例：在匹配所有 Block 之前执行
  //     await clickIfVisibleNow(currentPage.getByRole('tab', { name: 'List view' }));
  //   })
  //   .each(async ({ block, blockPath, outputDir }) => {
  //     // 点击 Code
  //     await block.getByRole('tab', { name: 'Code' }).click();
  //     // 获取内部 pre
  //     const code = await extractCodeFromDOM(block);
  //     // 输出到文件
  //     await fse.outputFile(`${outputDir}/${blockPath}.tsx`, code);
  //   });

  await crawler
    .test(
      "https://www.untitledui.com/react/components/forgot-password-pages",
      "[data-preview]",
      1
    )
    .before(async (currentPage) => {
      // 前置逻辑示例：在匹配所有 Block 之前执行
      await clickIfVisibleNow(
        currentPage.getByRole("tab", { name: "List view" })
      );
    })
    .run(async ({ section, blockName, safeOutput }) => {
      console.log(`测试组件: ${blockName}`);
      // 点击 Code
      await section.getByRole("tab", { name: "Code" }).click();
      // 获取内部 pre
      const code = await extractCodeFromDOM(section);
      // 使用 safeOutput 安全输出（自动处理文件名 sanitize）
      await safeOutput(code);
    });
});

// 从 DOM 中提取 Code
async function extractCodeFromDOM(section: Locator): Promise<string> {
  const pre = section.locator("pre").last();
  // 等待 import 文本出现
  await pre
    .getByText("import")
    .first()
    .waitFor({ state: "visible", timeout: 1500 });
  const rawText = (await pre.textContent()) ?? "";
  return rawText.replace(/Show more/, "").trim();
}

// 如果元素存在且可见（立即判断），则点击
async function clickIfVisibleNow(locator: Locator) {
  if (await locator.isVisible({ timeout: 0 })) {
    await locator.click();
  }
}
