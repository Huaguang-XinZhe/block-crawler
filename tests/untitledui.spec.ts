import { test } from "@playwright/test";
import { BlockCrawler } from "block-crawler";

test("untitledui", async ({ page }) => {
  const crawler = new BlockCrawler({
    startUrl: "https://www.untitledui.com/react/components",
    skipPageFree: "FREE",

    // 使用新的 getAllTabSections 模式（跳过 tab 点击）
    getAllTabSections: async (page) => {
      // 返回所有包含内容的 sections
      return page.locator("xpath=//section[3]/div/div").all();
    },
  });

  await crawler.onPage(page, async ({ currentPage }) => {
    const url = currentPage.url();
    console.log(`url: ${url}`);
  });
});
