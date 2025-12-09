import { type BlockAutoConfig, BlockCrawler } from "@huaguang/block-crawler";
import { test } from "@playwright/test";
import { extractCodeFromPre } from "./utils/extract-code";

test("heroui crawler", async ({ page }) => {
  // 设置超时
  test.setTimeout(2 * 60 * 1000); // 2 分钟

  const crawler = new BlockCrawler(page, {
    startUrl: "https://pro.mufengapp.cn/components",
  });

  await crawler
    // .collect()
    // .tabSections("//main/div/div[2]/section")
    // .name("//div[2]/div[1]/div[1]")
    // .count("//div[2]/div[1]/div[2]")
    // .open("https://pro.mufengapp.cn/components/application/navbars")
    .open()
    .block("//main/div/div/div", {
      fileTabs: (block) =>
        block
          .getByRole("tablist", {
            name: "Select active file",
          })
          .getByRole("tab")
          .all(),
      extractCode: extractCodeFromPre,
      variants: [
        {
          buttonLocator: (block) =>
            block.getByRole("button", { name: "TypeScript Change theme" }),
          nameMapping: { TypeScript: "ts", JavaScript: "js" },
          // waitTime: 500,
        },
      ],
    } as BlockAutoConfig)
    .skipFree()
    .run();
});
