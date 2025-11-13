import { test, type Page, type Locator } from "@playwright/test";
import { BlockCrawler } from "block-crawler";

test("untitledui", async ({ page }) => {
  const crawler = new BlockCrawler(page, {
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

  await crawler
    .blocks("[data-preview]")
    .before(async (currentPage) => {
      // 前置逻辑示例：在匹配所有 Block 之前执行
      await clickIfVisibleNow(currentPage, currentPage.getByRole('tab', { name: 'List view' }));
    })
    .each(async ({ block, blockName, blockPath, outputDir, currentPage }) => {
      console.log(`blockName: ${blockName}`);
    });
});


// 如果元素存在且可见（立即判断），则点击
async function clickIfVisibleNow(page: Page, locator: Locator) {
  if (await locator.isVisible({ timeout: 0 })) {
    await locator.click();
  }
}