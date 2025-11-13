import { test } from "@playwright/test";
import { BlockCrawler } from "block-crawler";

test("untitledui", async ({ page }) => {
  const crawler = new BlockCrawler({
    startUrl: "https://www.untitledui.com/react/components",
    skipPageFree: "FREE",
    // locale: "en",
    collectionNameLocator: "p:first-of-type",
    collectionCountLocator: "p:last-of-type",
    // 使用新的 getAllTabSections 模式（跳过 tab 点击）
    getAllTabSections: async (page) => {
      // 返回所有包含内容的 sections
      return page.locator("xpath=//section[3]/div/div").all();
    },
  });

  await crawler.onBlock(
    page,
    "[data-preview]",
    async ({ block, blockName, blockPath, outputDir, currentPage }) => {
      console.log(`blockName: ${blockName}`);
    },
    async (page) => {
      // 前置逻辑示例：在匹配所有 Block 之前执行
      // 比如点击按钮、toggle 切换等操作
      // await page.getByRole('button', { name: 'Show All' }).click();
    }
  );

  // await crawler.onPage(page, async ({ currentPage }) => {
  //   const url = currentPage.url();
  //   console.log(`url: ${url}`);
  // });
});
