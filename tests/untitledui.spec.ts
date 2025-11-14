import { test, type Page, type Locator } from "@playwright/test";
import { BlockCrawler } from "@huaguang/block-crawler";
import fse from "fs-extra";

test("untitledui", async ({ page }) => {
  const crawler = new BlockCrawler(page, {
    startUrl: "https://www.untitledui.com/react/components",
    skipPageFree: "FREE",
    // locale: "en",
    collectionNameLocator: "p:first-of-type",
    collectionCountLocator: "p:last-of-type",
    collectionLinkWaitOptions: {
      waitUntil: "networkidle",
    },
    scriptInjection: {
      scripts: ["custom-script.js"],
      timing: "afterPageLoad", // 在页面加载后注入
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
  //   .each(async ({ block, blockName, blockPath, outputDir, currentPage }) => {
  //     // 点击 Code
  //     await block.getByRole("tab", { name: "Code" }).click();
  //     // 获取内部 pre
  //     const pre = block.locator('pre').last();
  //     // 获取内部 pre 的文本
  //     const text = await pre.textContent() ?? "";
  //     // 输出到文件
  //     await fse.outputFile(`${outputDir}/${blockPath}/index.tsx`, text);
  //   });

  await crawler
    .test(
      "https://www.untitledui.com/react/marketing/landing-pages",
      "[data-preview]"
    )
    .run(async ({ section, blockName, currentPage, outputDir }) => {
      console.log(`测试组件: ${blockName}`);
      // 点击 Code
      await currentPage.getByRole('tab', { name: 'Code' }).click();
      // 获取内部 pre
      const pre = section.locator('pre').last();
      // 获取内部 pre 的文本
      const text = await pre.textContent() ?? "";
      // 输出到文件
      await fse.outputFile(`${outputDir}/test-${blockName}.tsx`, text);
    });
});

// 如果元素存在且可见（立即判断），则点击
async function clickIfVisibleNow(locator: Locator) {
  if (await locator.isVisible({ timeout: 0 })) {
    await locator.click();
  }
}
