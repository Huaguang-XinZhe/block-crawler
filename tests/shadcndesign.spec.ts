import { test, type Locator } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler, type BlockContext } from "../src"; // 这里的 ../ 又和 path.join 中的不同❗

test("test", async ({ page }) => {
  // 创建 crawler 实例
  const crawler = new BlockCrawler({
    startUrl: "https://www.shadcndesign.com/pro-blocks",
    maxConcurrency: 5,
  });

  // 设置 Block 处理器
  crawler.onBlock(
    async ({ block, page, blockPath, outputDir }: BlockContext) => {
      // 点击切换到 Code
      await clickCodeTab(block);
    }
  );
});
